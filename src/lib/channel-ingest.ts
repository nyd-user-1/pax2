import "server-only"

import { get, now, putOnce, query, remove, type Item } from "@/lib/ledger"
import { channelAccessToken } from "@/lib/youtube"

// What a connected channel brings in (onboarding, tier 1: no video files needed).
//
// Only public videos come in by default. A private or unlisted video stores nothing, not its title, until
// the user picks it (setPermitted); the picker lists them live from YouTube without storing them
// (listNonPublic). Un-picking one, or a video leaving the public set, deletes its rows on the next run.
//
// The work runs on the pax2-channel-ingest Lambda (lambda/channel-ingest), handed off by kick() the moment
// a channel is connected or its picks change, so the user moves on while it runs; pages only read
// progress(). A run walks three phases:
//
//   catalog  every upload on the channel (playlistItems.list, videos.list; about one quota unit per 50
//            videos on the YouTube Data API), keeping the public and the picked ones. Each kept video that
//            can be fetched from outside the account (not private) enters the fetch-targets queue.
//   stats    the YouTube Analytics API per kept video, lifetime — the contract is every non-monetary field
//            on docs/ANALYTICS-API.html: views, watch time, average view duration and percentage, likes,
//            shares, subscribers gained; comments, dislikes, engaged views, subscribers lost, playlist adds
//            and removes; card impressions, clicks and click rate; and thumbnail impressions and their
//            click-through rate. 50 videos a call, in metric groups the API caps at ten; a group the API
//            refuses drops out with a note instead of stopping the run.
//   curves   the audience-retention curve per kept video: audienceWatchRatio and relativeRetentionPerformance
//            on YouTube's fixed grid of 100 points of elapsedVideoTimeRatio, 0.01 to 1.00, as parallel
//            arrays (each row names its grid). Viewer demographics (viewerPercentage by age group and
//            gender) ride the same per-video step. Two calls per video.
//
// Every row of one run carries the run's runAt in its sort key, so a training join reads a coherent
// snapshot of a video (metadata, totals and curve) without matching timestamps.
//
// DynamoDB rows, joinable on youtubeId:
//
//   pk                      sk                              item
//   YOUTUBE#connected       <channelId>                     every channel connected, the first time
//   YTCH#<channelId>        RUN#<runAt>                     a run started; RUN#<runAt>#catalog|stats|done close each phase
//   YTCH#<channelId>        PERMIT#<iso>                    the private and unlisted videos the user picked; the latest wins
//   YTCH#<channelId>        KICK#<iso> / FAIL#<iso>         a hand-off to the Lambda; a run that stopped on an error
//   YTVID#<channelId>       <youtubeId>#<runAt>             the video's metadata and public counts
//   YTSTAT#<channelId>      <youtubeId>#<runAt>             its YouTube Analytics totals
//   YTCURVE#<channelId>     <youtubeId>#<runAt>             its retention curve
//   YTDEMO#<channelId>      <youtubeId>#<runAt>             its viewer demographics
//   FETCH#target            <youtubeId>                     the acquisition queue (docs/FETCH-WORKER.md)
//   FETCH#req#<youtubeId>   <email>                         who asked for it

const DATA = "https://www.googleapis.com/youtube/v3"
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports"
const CURVES_PER_STEP = 12
const FN = process.env.PAX2_INGEST_FN ?? "pax2-channel-ingest"
/** A Lambda run lasts at most 15 minutes; a run with no hand-off for longer than this has stopped. */
const STALE_MS = 16 * 60_000

export type ChannelMeta = { channelId: string; title: string; handle: string | null; thumbnail: string | null; subscribers: number | null; videoCount: number | null; publishedAt: string; uploads: string }
export type VideoRow = Item & { channelId: string; youtubeId: string; runAt: string; title: string; description: string; tags: string[]; durationSec: number; published: string; privacy: string | null; views: number | null; likes: number | null; comments: number | null; thumbnail: string | null }
export type StatRow = Item & { channelId: string; youtubeId: string; runAt: string; views: number | null; estimatedMinutesWatched: number | null; averageViewDuration: number | null; averageViewPercentage: number | null; likes: number | null; shares: number | null; subscribersGained: number | null; comments: number | null; dislikes: number | null; engagedViews: number | null; subscribersLost: number | null; videosAddedToPlaylists: number | null; videosRemovedFromPlaylists: number | null; cardImpressions: number | null; cardClicks: number | null; cardClickRate: number | null; impressions: number | null; impressionsCtr: number | null }
export const CURVE_GRID = "elapsedVideoTimeRatio, 100 points, 0.01 to 1.00; watch[k] and relative[k] are read at ratio[k]"
export type CurveRow = Item & { channelId: string; youtubeId: string; runAt: string; at: string; grid: string; ratio: number[]; watch: number[]; relative: number[] }
export const DEMO_GRID = "ageGroup × gender; pct[k] is viewerPercentage for (ageGroup[k], gender[k])"
export type DemoRow = Item & { channelId: string; youtubeId: string; runAt: string; at: string; grid: string; ageGroup: string[]; gender: string[]; pct: number[] }
type RunRow = Item & { runAt: string; by: string }
type CatalogRow = Item & { runAt: string; ids: string[]; channel: ChannelMeta; hidden: number }
type PermitRow = Item & { at: string; ids: string[]; by: string }
type StatsDoneRow = Item & { runAt: string; impressions: "yes" | "no"; extras?: "yes" | "no"; cards?: "yes" | "no"; note: string | null }

export type Progress = {
  runAt: string
  phase: "catalog" | "stats" | "curves" | "done"
  done: number
  total: number
  channel: ChannelMeta | null
  /** Private and unlisted videos left out because the user has not picked them. */
  hidden: number
  /** Why the run stopped, when it stopped on an error. */
  error: string | null
}

async function yt<T>(token: string, url: string): Promise<T> {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  const j = (await r.json()) as T & { error?: { message?: string } }
  if (!r.ok) {
    const msg = j.error?.message ?? "refused"
    if (/has not been used in project|is disabled/.test(msg)) throw new Error(`The ${new URL(url).hostname.startsWith("youtubeanalytics") ? "YouTube Analytics API" : "YouTube Data API"} is not enabled on PAX's Google Cloud project yet; the analysis resumes once it is.`)
    throw new Error(`${new URL(url).hostname} ${r.status}: ${msg}`)
  }
  return j
}

/** ISO 8601 duration (PT1M5S) to seconds. */
export function isoSeconds(d: string | undefined) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d ?? "")
  return m ? Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0) : 0
}

const num = (v: unknown) => (v == null || v === "" ? null : Number(v))

async function pool<T>(items: T[], n: number, f: (t: T) => Promise<unknown>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await f(items[i++])
  }))
}

const latest = <T extends { sk: string }>(rows: T[]) => rows.sort((a, b) => b.sk.localeCompare(a.sk))[0] ?? null

async function latestRun(channelId: string) {
  const rows = await query<RunRow>(`YTCH#${channelId}`, "RUN#")
  const starts = rows.filter((r) => /^RUN#[^#]+$/.test(r.sk))
  const run = latest(starts)
  if (!run) return null
  const phase = (p: string) => rows.find((r) => r.sk === `${run.sk}#${p}`) ?? null
  return { run, catalog: phase("catalog") as CatalogRow | null, stats: phase("stats") as StatsDoneRow | null, done: phase("done") }
}

/** Starts a fresh run (on every grant and every change of picks), unless one started in the last minute
 *  and the picks have not changed since. */
export async function startRun(channelId: string, by: string, force = false) {
  const cur = await latestRun(channelId)
  if (!force && cur && Date.now() - Date.parse(cur.run.runAt) < 60_000) return cur.run.runAt
  const runAt = now()
  await putOnce({ pk: `YTCH#${channelId}`, sk: `RUN#${runAt}`, runAt, by })
  await putOnce({ pk: "YOUTUBE#connected", sk: channelId, at: runAt, by })
  return runAt
}

type Listed = { id: string; snippet: { title: string; description?: string; tags?: string[]; publishedAt: string; thumbnails?: Record<string, { url: string }> }; contentDetails: { duration: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }; status?: { privacyStatus?: string } }

/** Every upload on the channel, live from the YouTube Data API. Held in memory only; the callers decide
 *  what may be stored. */
async function listAll(channelId: string) {
  const token = await channelAccessToken(channelId)
  type Ch = { items?: { id: string; snippet: { title: string; customUrl?: string; publishedAt: string; thumbnails?: { default?: { url: string } } }; contentDetails: { relatedPlaylists: { uploads: string } }; statistics: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean } }[] }
  const c = (await yt<Ch>(token, `${DATA}/channels?part=snippet,contentDetails,statistics&id=${channelId}`)).items?.[0]
  if (!c) throw new Error("YouTube returned no such channel.")
  const meta: ChannelMeta = {
    channelId,
    title: c.snippet.title,
    handle: c.snippet.customUrl ?? null,
    thumbnail: c.snippet.thumbnails?.default?.url ?? null,
    subscribers: c.statistics.hiddenSubscriberCount ? null : num(c.statistics.subscriberCount),
    videoCount: num(c.statistics.videoCount),
    publishedAt: c.snippet.publishedAt,
    uploads: c.contentDetails.relatedPlaylists.uploads,
  }
  const ids: string[] = []
  let page: string | undefined
  do {
    type Pl = { items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string }
    const p = await yt<Pl>(token, `${DATA}/playlistItems?part=contentDetails&maxResults=50&playlistId=${meta.uploads}${page ? `&pageToken=${page}` : ""}`)
    for (const it of p.items ?? []) ids.push(it.contentDetails.videoId)
    page = p.nextPageToken
  } while (page)
  const unique = [...new Set(ids)]
  const videos: Listed[] = []
  for (let i = 0; i < unique.length; i += 50) {
    const v = await yt<{ items?: Listed[] }>(token, `${DATA}/videos?part=snippet,contentDetails,statistics,status&maxResults=50&id=${unique.slice(i, i + 50).join(",")}`)
    videos.push(...(v.items ?? []))
  }
  return { meta, videos }
}

const isPublic = (v: { status?: { privacyStatus?: string } }) => v.status?.privacyStatus === "public"
const thumb = (th: Record<string, { url: string }> | undefined) => ((th ?? {}).medium ?? (th ?? {}).high ?? (th ?? {}).default)?.url ?? null

/** The private and unlisted videos the user has picked, from the latest pick. */
export async function permitted(channelId: string): Promise<Set<string>> {
  const rows = await query<PermitRow>(`YTCH#${channelId}`, "PERMIT#")
  return new Set(latest(rows)?.ids ?? [])
}

/** The channel's private and unlisted videos for the picker, live from YouTube; nothing here is stored. */
export async function listNonPublic(channelId: string) {
  const [{ videos }, picked] = await Promise.all([listAll(channelId), permitted(channelId)])
  return videos
    .filter((v) => !isPublic(v))
    .map((v) => ({ youtubeId: v.id, title: v.snippet.title, privacy: v.status?.privacyStatus ?? "private", published: v.snippet.publishedAt, durationSec: isoSeconds(v.contentDetails.duration), thumbnail: thumb(v.snippet.thumbnails), picked: picked.has(v.id) }))
    .sort((a, b) => b.published.localeCompare(a.published))
}

/** Records the user's picks and hands a fresh run to the Lambda, which adds the picked videos and deletes
 *  the rows of any video no longer picked. */
export async function setPermitted(channelId: string, ids: string[], by: string) {
  const at = now()
  await putOnce({ pk: `YTCH#${channelId}`, sk: `PERMIT#${at}`, at, ids: [...new Set(ids)], by })
  await startRun(channelId, by, true)
  await kick(channelId, by)
}

/** Deletes every stored row of the channel's videos that are not in `keep`. */
async function prune(channelId: string, keep: Set<string>) {
  const gone = async (pk: string) => {
    const rows = await query<Item & { youtubeId: string }>(pk)
    await pool(rows.filter((r) => !keep.has(r.youtubeId)), 8, (r) => remove(r.pk, r.sk))
  }
  await Promise.all([gone(`YTVID#${channelId}`), gone(`YTSTAT#${channelId}`), gone(`YTCURVE#${channelId}`), gone(`YTDEMO#${channelId}`)])
  const targets = (await query<FetchTarget>("FETCH#target")).filter((t) => t.channelId === channelId && !keep.has(t.youtubeId))
  await pool(targets, 8, async (t) => {
    await remove("FETCH#target", t.youtubeId)
    for (const r of await query(`FETCH#req#${t.youtubeId}`)) await remove(r.pk, r.sk)
  })
}

async function catalog(channelId: string, runAt: string, by: string): Promise<CatalogRow> {
  const [{ meta, videos }, picked] = await Promise.all([listAll(channelId), permitted(channelId)])
  const kept = videos.filter((v) => isPublic(v) || picked.has(v.id))
  const rows: VideoRow[] = kept.map((x) => ({
    pk: `YTVID#${channelId}`, sk: `${x.id}#${runAt}`, channelId, youtubeId: x.id, runAt,
    title: x.snippet.title, description: (x.snippet.description ?? "").slice(0, 5000), tags: x.snippet.tags ?? [],
    durationSec: isoSeconds(x.contentDetails.duration), published: x.snippet.publishedAt, privacy: x.status?.privacyStatus ?? null,
    views: num(x.statistics?.viewCount), likes: num(x.statistics?.likeCount), comments: num(x.statistics?.commentCount),
    thumbnail: thumb(x.snippet.thumbnails),
  }))
  await prune(channelId, new Set(rows.map((r) => r.youtubeId)))
  await pool(rows, 8, async (r) => {
    await putOnce(r)
    // A private video can't be fetched from outside the account; only the owner's own upload reads it.
    if (r.privacy !== "private") await enqueueFetch(r.youtubeId, channelId, by)
  })
  const done: CatalogRow = { pk: `YTCH#${channelId}`, sk: `RUN#${runAt}#catalog`, runAt, ids: rows.map((r) => r.youtubeId), channel: meta, hidden: videos.length - kept.length, at: now() }
  await putOnce(done)
  return done
}

async function stats(channelId: string, runAt: string, cat: CatalogRow) {
  const token = await channelAccessToken(channelId)
  const start = cat.channel.publishedAt.slice(0, 10)
  const end = new Date().toISOString().slice(0, 10)
  const base = `${ANALYTICS}?ids=channel==MINE&startDate=${start}&endDate=${end}&dimensions=video&sort=-views&maxResults=50`
  type Report = { columnHeaders?: { name: string }[]; rows?: (string | number)[][] }
  const table = (r: Report) => {
    const names = (r.columnHeaders ?? []).map((h) => h.name)
    return new Map((r.rows ?? []).map((row) => [String(row[0]), Object.fromEntries(names.map((n, k) => [n, row[k]]))]))
  }
  let impressions: "yes" | "no" = "yes"
  let extras: "yes" | "no" = "yes"
  let cards: "yes" | "no" = "yes"
  let note: string | null = null
  const noted = (e: unknown) => (note = [note, (e as Error).message.slice(0, 300)].filter(Boolean).join(" | "))
  const out: StatRow[] = []
  for (let i = 0; i < cat.ids.length; i += 50) {
    const batch = cat.ids.slice(i, i + 50)
    const filter = `&filters=video==${batch.join(",")}`
    const core = table(await yt<Report>(token, `${base}&metrics=views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,shares,subscribersGained${filter}`))
    let ext = new Map<string, Record<string, unknown>>()
    if (extras === "yes") {
      try {
        ext = table(await yt<Report>(token, `${base}&metrics=comments,dislikes,engagedViews,subscribersLost,videosAddedToPlaylists,videosRemovedFromPlaylists${filter}`))
      } catch (e) {
        extras = "no"
        noted(e)
      }
    }
    let crd = new Map<string, Record<string, unknown>>()
    if (cards === "yes") {
      try {
        crd = table(await yt<Report>(token, `${base}&metrics=cardImpressions,cardClicks,cardClickRate${filter}`))
      } catch (e) {
        cards = "no"
        noted(e)
      }
    }
    let imp = new Map<string, Record<string, unknown>>()
    if (impressions === "yes") {
      try {
        imp = table(await yt<Report>(token, `${base}&metrics=views,videoThumbnailImpressions,videoThumbnailImpressionsClickRate${filter}`))
      } catch (e) {
        impressions = "no"
        noted(e)
      }
    }
    for (const id of batch) {
      const a = core.get(id) ?? {}
      const x = ext.get(id) ?? {}
      const c = crd.get(id) ?? {}
      const b = imp.get(id) ?? {}
      out.push({
        pk: `YTSTAT#${channelId}`, sk: `${id}#${runAt}`, channelId, youtubeId: id, runAt,
        views: num(a.views), estimatedMinutesWatched: num(a.estimatedMinutesWatched), averageViewDuration: num(a.averageViewDuration), averageViewPercentage: num(a.averageViewPercentage),
        likes: num(a.likes), shares: num(a.shares), subscribersGained: num(a.subscribersGained),
        comments: num(x.comments), dislikes: num(x.dislikes), engagedViews: num(x.engagedViews),
        subscribersLost: num(x.subscribersLost), videosAddedToPlaylists: num(x.videosAddedToPlaylists), videosRemovedFromPlaylists: num(x.videosRemovedFromPlaylists),
        cardImpressions: num(c.cardImpressions), cardClicks: num(c.cardClicks), cardClickRate: num(c.cardClickRate),
        impressions: num(b.videoThumbnailImpressions), impressionsCtr: num(b.videoThumbnailImpressionsClickRate),
      })
    }
  }
  await pool(out, 8, (r) => putOnce(r))
  await putOnce({ pk: `YTCH#${channelId}`, sk: `RUN#${runAt}#stats`, runAt, impressions, extras, cards, note, at: now() })
}

async function curves(channelId: string, runAt: string, cat: CatalogRow): Promise<{ done: number; total: number; finished: boolean }> {
  const have = new Set((await query<CurveRow>(`YTCURVE#${channelId}`)).filter((r) => r.runAt === runAt).map((r) => r.youtubeId))
  const watched = new Map((await query<StatRow>(`YTSTAT#${channelId}`)).filter((r) => r.runAt === runAt).map((r) => [r.youtubeId, r.views ?? 0]))
  const missing = cat.ids.filter((id) => !have.has(id))
  const next = missing.slice(0, CURVES_PER_STEP)
  if (next.length) {
    const token = await channelAccessToken(channelId)
    const start = cat.channel.publishedAt.slice(0, 10)
    const end = new Date().toISOString().slice(0, 10)
    await pool(next, 4, async (id) => {
      const at = now()
      let rows: (string | number)[][] = []
      let demo: (string | number)[][] = []
      // A video nobody has watched has no curve; it is stored empty so it is not asked for again.
      if ((watched.get(id) ?? 0) > 0) {
        type Report = { rows?: (string | number)[][] }
        const r = await yt<Report>(token, `${ANALYTICS}?ids=channel==MINE&startDate=${start}&endDate=${end}&dimensions=elapsedVideoTimeRatio&metrics=audienceWatchRatio,relativeRetentionPerformance&filters=video==${id}`)
        rows = r.rows ?? []
        const d = await yt<Report>(token, `${ANALYTICS}?ids=channel==MINE&startDate=${start}&endDate=${end}&dimensions=ageGroup,gender&metrics=viewerPercentage&filters=video==${id}`)
        demo = d.rows ?? []
      }
      // The demographics row goes in first: the curve row's presence is what marks the video finished.
      await putOnce({ pk: `YTDEMO#${channelId}`, sk: `${id}#${runAt}`, channelId, youtubeId: id, runAt, at, grid: DEMO_GRID, ageGroup: demo.map((x) => String(x[0])), gender: demo.map((x) => String(x[1])), pct: demo.map((x) => Number(x[2])) })
      await putOnce({ pk: `YTCURVE#${channelId}`, sk: `${id}#${runAt}`, channelId, youtubeId: id, runAt, at, grid: CURVE_GRID, ratio: rows.map((x) => Number(x[0])), watch: rows.map((x) => Number(x[1])), relative: rows.map((x) => Number(x[2])) })
    })
  }
  const left = missing.length - next.length
  return { done: cat.ids.length - left, total: cat.ids.length, finished: left === 0 }
}

/** One step of the channel's latest run; call until phase is "done". */
export async function ingestStep(channelId: string, by: string): Promise<Progress> {
  let cur = await latestRun(channelId)
  if (!cur) {
    await startRun(channelId, by)
    cur = await latestRun(channelId)
  }
  const { run } = cur!
  const base = { runAt: run.runAt, error: null }
  if (cur!.done) return { ...base, phase: "done", done: cur!.catalog?.ids.length ?? 0, total: cur!.catalog?.ids.length ?? 0, channel: cur!.catalog?.channel ?? null, hidden: cur!.catalog?.hidden ?? 0 }
  if (!cur!.catalog) {
    const cat = await catalog(channelId, run.runAt, by)
    return { ...base, phase: "stats", done: 0, total: cat.ids.length, channel: cat.channel, hidden: cat.hidden }
  }
  const cat = cur!.catalog
  if (!cur!.stats) {
    await stats(channelId, run.runAt, cat)
    return { ...base, phase: "curves", done: 0, total: cat.ids.length, channel: cat.channel, hidden: cat.hidden ?? 0 }
  }
  const c = await curves(channelId, run.runAt, cat)
  if (c.finished) await putOnce({ pk: `YTCH#${channelId}`, sk: `RUN#${run.runAt}#done`, runAt: run.runAt, at: now() })
  return { ...base, phase: c.finished ? "done" : "curves", done: c.done, total: c.total, channel: cat.channel, hidden: cat.hidden ?? 0 }
}

/** The Lambda's loop: steps until the run is done or the time left runs short. */
export async function runUntil(channelId: string, by: string, msLeft: () => number) {
  let p = await ingestStep(channelId, by)
  while (p.phase !== "done" && msLeft() > 90_000) p = await ingestStep(channelId, by)
  return p
}

/** Records why a run stopped, for the page to show. */
export async function recordFailure(channelId: string, message: string) {
  const at = now()
  await putOnce({ pk: `YTCH#${channelId}`, sk: `FAIL#${at}`, at, message: message.slice(0, 500) })
}

/** Hands the channel's run to the Lambda (asynchronously; returns at once). */
export async function kick(channelId: string, by: string, hop = 0) {
  const at = now()
  await putOnce({ pk: `YTCH#${channelId}`, sk: `KICK#${at}`, at, by, hop })
  const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda")
  const lambda = new LambdaClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
  await lambda.send(new InvokeCommand({ FunctionName: FN, InvocationType: "Event", Payload: new TextEncoder().encode(JSON.stringify({ channelId, by, hop })) }))
}

/** The page's poll: where the run stands, handing it to the Lambda again if it stalled without finishing. */
export async function pollRun(channelId: string, by: string): Promise<Progress | null> {
  const p = await progress(channelId)
  if (!p || p.phase === "done") return p
  const kicks = await query<Item & { at: string }>(`YTCH#${channelId}`, "KICK#")
  const last = latest(kicks)?.at
  if (!last || Date.now() - Date.parse(last) > STALE_MS) await kick(channelId, by)
  return p
}

/** Where the channel's latest run stands, without doing any work. */
export async function progress(channelId: string): Promise<Progress | null> {
  const cur = await latestRun(channelId)
  if (!cur) return null
  const total = cur.catalog?.ids.length ?? 0
  const phase = cur.done ? "done" : !cur.catalog ? "catalog" : !cur.stats ? "stats" : "curves"
  let done = cur.done ? total : 0
  if (phase === "curves") done = (await query<CurveRow>(`YTCURVE#${channelId}`)).filter((r) => r.runAt === cur.run.runAt).length
  const [fails, kicks] = await Promise.all([query<Item & { at: string; message: string }>(`YTCH#${channelId}`, "FAIL#"), query<Item & { at: string }>(`YTCH#${channelId}`, "KICK#")])
  const fail = latest(fails)
  const kick = latest(kicks)
  const error = phase !== "done" && fail && (!kick || fail.at > kick.at) ? fail.message : null
  return { runAt: cur.run.runAt, phase, done, total, channel: cur.catalog?.channel ?? null, hidden: cur.catalog?.hidden ?? 0, error }
}

/** The latest completed catalog of the channel, with the latest stats and curve per video. */
export async function channelData(channelId: string) {
  const runs = await query<CatalogRow & StatsDoneRow>(`YTCH#${channelId}`, "RUN#")
  const cat = latest(runs.filter((r) => r.sk.endsWith("#catalog")) as CatalogRow[])
  if (!cat) return null
  const statsDone = runs.find((r) => r.sk === `RUN#${cat.runAt}#stats`) as StatsDoneRow | undefined
  const [vids, stats, curves, demos] = await Promise.all([query<VideoRow>(`YTVID#${channelId}`), query<StatRow>(`YTSTAT#${channelId}`), query<CurveRow>(`YTCURVE#${channelId}`), query<DemoRow>(`YTDEMO#${channelId}`)])
  const pick = <T extends { youtubeId: string; sk: string }>(rows: T[]) => {
    const m = new Map<string, T>()
    for (const r of rows) if (!m.has(r.youtubeId) || m.get(r.youtubeId)!.sk < r.sk) m.set(r.youtubeId, r)
    return m
  }
  const v = pick(vids)
  const s = pick(stats)
  const c = pick(curves)
  const d = pick(demos)
  // An un-picked video drops from view at once, before the Lambda deletes its rows.
  const picked = await permitted(channelId)
  const videos = cat.ids
    .map((id) => ({ video: v.get(id) ?? null, stat: s.get(id) ?? null, curve: c.get(id) ?? null, demo: d.get(id) ?? null }))
    .filter((x): x is { video: VideoRow; stat: StatRow | null; curve: CurveRow | null; demo: DemoRow | null } => !!x.video && (x.video.privacy === "public" || picked.has(x.video.youtubeId)))
  return { channel: cat.channel, runAt: cat.runAt, impressions: statsDone?.impressions ?? null, hidden: cat.hidden ?? 0, videos }
}

// ---------- Tier 2: the fetch-targets queue (docs/FETCH-WORKER.md) ----------

export type FetchTarget = Item & { youtubeId: string; channelId: string; requestedBy: string; at: string }

/** Puts a video in the acquisition queue once; every user who asks is recorded beside it. */
export async function enqueueFetch(youtubeId: string, channelId: string, by: string) {
  const at = now()
  await putOnce({ pk: "FETCH#target", sk: youtubeId, youtubeId, channelId, requestedBy: by, at })
  await putOnce({ pk: `FETCH#req#${youtubeId}`, sk: by, at })
}

export const fetchTarget = (youtubeId: string) => get<FetchTarget>("FETCH#target", youtubeId)
