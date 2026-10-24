"use server"

import { randomBytes, randomInt } from "node:crypto"

import { currentUser, forbidDemo, requireAdmin } from "@/lib/auth"
import { get, put, query } from "@/lib/ledger"
import { ABOUT, newTest, publicSurvey, youtubeId, type MessageTest, type PublicSurvey, type Response, type Step } from "@/lib/message-tests"

// Message tests (lib/message-tests.ts) in the ledger:
//   MTEST#all       <testId>     the test: its arms, questions and settings
//   MRESP#<testId>  <respId>     one respondent, rewritten at each step they finish
// Setting up and reading tests is for admins. The respondent's steps are open to anyone holding the
// link: each is checked against the respondent's current step, so none can be skipped or answered twice,
// and the arm is drawn on the server after the background questions.

const TESTS = "MTEST#all"
const RESP = (id: string) => `MRESP#${id}`
const rid = () => randomBytes(9).toString("base64url")

type Row = MessageTest & { pk: string; sk: string }
type RespRow = Response & { pk: string; sk: string }

const strip = <T extends { pk: string; sk: string }>({ pk: _pk, sk: _sk, ...rest }: T) => rest

export async function listTests(): Promise<(MessageTest & { complete: number })[]> {
  await requireAdmin()
  const tests = (await query<Row>(TESTS)).map((r) => strip(r) as MessageTest)
  const counts = await Promise.all(tests.map(async (t) => (await query<RespRow>(RESP(t.id))).filter((r) => r.step === "done" && !r.preview).length))
  return tests.map((t, i) => ({ ...t, complete: counts[i] })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function createTest(): Promise<string> {
  const user = await requireAdmin()
  forbidDemo(user)
  const id = rid().slice(0, 8)
  await put({ pk: TESTS, sk: id, ...newTest(id, user.email) })
  return id
}

export async function loadTest(id: string): Promise<{ test: MessageTest; responses: Response[] } | null> {
  await requireAdmin()
  const row = await get<Row>(TESTS, id)
  if (!row) return null
  const responses = (await query<RespRow>(RESP(id))).map((r) => strip(r) as Response)
  return { test: strip(row) as MessageTest, responses }
}

const clean = (s: unknown, max = 2000) => String(s ?? "").slice(0, max)
const lines = (a: unknown) => (Array.isArray(a) ? a.map((x) => clean(x, 400)).filter(Boolean).slice(0, 12) : [])
const index = (n: unknown, len: number) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < len ? (n as number) : 0)

/** Save the setup. Arms keep their ids, so responses already given stay attached to them. */
export async function saveTest(t: MessageTest): Promise<MessageTest> {
  forbidDemo(await requireAdmin())
  const prev = await get<Row>(TESTS, t.id)
  if (!prev) throw new Error("No such test.")
  const attentionOptions = lines(t.attention.options)
  const checkOptions = t.videoCheck ? lines(t.videoCheck.options) : []
  const voteOptions = lines(t.vote.options)
  const compOptions = t.comprehension ? lines(t.comprehension.options) : []
  const placeboAt = Math.max(0, t.arms.findIndex((a) => a.placebo))
  const next: MessageTest = {
    ...prev,
    name: clean(t.name, 120) || "Untitled test",
    measure: clean(t.measure, 80),
    status: t.status === "live" || t.status === "closed" ? t.status : "draft",
    arms: t.arms.slice(0, 12).map((a, i) => ({
      id: /^[a-z0-9-]{2,24}$/.test(a.id) ? a.id : `arm-${rid().slice(0, 5).toLowerCase()}`,
      label: clean(a.label, 80) || `Video ${i + 1}`,
      youtube: youtubeId(a.youtube),
      placebo: i === placeboAt,
      check: a.check == null || !checkOptions.length ? null : index(a.check, checkOptions.length),
    })),
    attention: { question: clean(t.attention.question), options: attentionOptions, answer: index(t.attention.answer, attentionOptions.length) },
    videoCheck: t.videoCheck && checkOptions.length ? { question: clean(t.videoCheck.question), options: checkOptions } : null,
    vote: { question: clean(t.vote.question), options: voteOptions, yes: (t.vote.yes ?? []).filter((y) => Number.isInteger(y) && y >= 0 && y < voteOptions.length) },
    comprehension: t.comprehension && compOptions.length ? { explainer: clean(t.comprehension.explainer, 4000), question: clean(t.comprehension.question), options: compOptions, answer: index(t.comprehension.answer, compOptions.length) } : null,
    perArm: Math.min(20000, Math.max(10, Math.round(Number(t.perArm) || 500))),
    confidence: t.confidence === 95 ? 95 : 90,
    completion: { code: prev.completion.code, url: clean(t.completion.url, 500), screenUrl: clean(t.completion.screenUrl, 500) },
    updatedAt: new Date().toISOString(),
  }
  if (next.status === "live") {
    if (!next.arms.some((a) => a.placebo && a.youtube)) throw new Error("The placebo needs a video before the test goes live.")
    if (!next.arms.some((a) => !a.placebo && a.youtube)) throw new Error("Add at least one test video before the test goes live.")
    if (!next.vote.yes.length) throw new Error("Mark which vote answers count as support.")
  }
  await put({ pk: TESTS, sk: next.id, ...next })
  return next
}

// ---------- the respondent ----------

export type Begin = { open: true; respId: string; survey: PublicSurvey; preview: boolean } | { open: false }

/** A respondent arrives. `panel` is the link's query string (a panel's participant and study ids). An
 *  admin's `preview` runs a draft test and is never counted. */
export async function beginSurvey(testId: string, panel: Record<string, string>, preview: boolean): Promise<Begin> {
  const row = await get<Row>(TESTS, String(testId).slice(0, 24))
  if (!row) return { open: false }
  const asPreview = preview && !!(await currentUser())?.admin
  if (row.status !== "live" && !asPreview) return { open: false }
  const id = rid()
  const kept = Object.fromEntries(Object.entries(panel).slice(0, 8).map(([k, v]) => [clean(k, 40), clean(v, 120)]))
  const r: Response = { id, testId: row.id, step: "consent", preview: asPreview, panel: kept, startedAt: new Date().toISOString(), completedAt: null, attention: null, passed: null, about: {}, arm: null, watched: null, check: null, vote: null, comprehension: null }
  await put({ pk: RESP(row.id), sk: id, ...r })
  return { open: true, respId: id, survey: publicSurvey(row), preview: asPreview }
}

export type Next = { step: Step; video?: string; code?: string; url?: string }

const after = (t: MessageTest, s: Step): Step =>
  s === "consent" ? "attention" : s === "about" ? "video" : s === "video" ? (t.videoCheck ? "check" : "vote") : s === "check" ? "vote" : s === "vote" ? (t.comprehension ? "comprehension" : "done") : "done"

/** One finished step. The answer must belong to the respondent's current step. */
export async function submitStep(testId: string, respId: string, step: Step, value: unknown): Promise<Next> {
  const t = await get<Row>(TESTS, String(testId).slice(0, 24))
  const r = await get<RespRow>(RESP(String(testId).slice(0, 24)), String(respId).slice(0, 24))
  if (!t || !r) throw new Error("This survey link is no longer valid.")
  if (r.step !== step) throw new Error("That step is already done.")
  const now = new Date().toISOString()
  const save = (patch: Partial<Response>) => put({ ...r, ...patch })
  const finish = async (patch: Partial<Response>): Promise<Next> => {
    await save({ ...patch, step: "done", completedAt: now })
    return { step: "done", code: t.completion.code, url: t.completion.url ? t.completion.url.replace("{code}", t.completion.code) : undefined }
  }
  if (step === "consent") {
    await save({ step: "attention" })
    return { step: "attention" }
  }
  if (step === "attention") {
    const a = index(value, t.attention.options.length)
    if (a !== t.attention.answer) {
      await save({ attention: a, passed: false, step: "screened", completedAt: now })
      return { step: "screened", url: t.completion.screenUrl || undefined }
    }
    await save({ attention: a, passed: true, step: "about" })
    return { step: "about" }
  }
  if (step === "about") {
    const v = (value ?? {}) as Record<string, string>
    const about: Record<string, string> = {}
    for (const q of ABOUT) {
      if (!q.options.includes(v[q.key])) throw new Error("Answer every question to continue.")
      about[q.key] = v[q.key]
    }
    // The draw: one arm, uniformly at random, after every pre-treatment answer is in.
    const arms = t.arms.filter((x) => x.youtube)
    const arm = arms[randomInt(arms.length)]
    await save({ about, arm: arm.id, step: "video" })
    return { step: "video", video: arm.youtube }
  }
  if (step === "video") {
    const next = after(t, "video")
    await save({ watched: Math.max(0, Math.round(Number(value) || 0)), step: next })
    return { step: next }
  }
  if (step === "check" && t.videoCheck) {
    await save({ check: index(value, t.videoCheck.options.length), step: "vote" })
    return { step: "vote" }
  }
  if (step === "vote") {
    const vote = index(value, t.vote.options.length)
    if (!t.comprehension) return finish({ vote })
    await save({ vote, step: "comprehension" })
    return { step: "comprehension" }
  }
  if (step === "comprehension" && t.comprehension) return finish({ comprehension: index(value, t.comprehension.options.length) })
  throw new Error("That step is already done.")
}

/** The respondent's video again after a reload: their own arm, never a fresh draw. */
export async function resumeVideo(testId: string, respId: string): Promise<string | null> {
  const t = await get<Row>(TESTS, String(testId).slice(0, 24))
  const r = await get<RespRow>(RESP(String(testId).slice(0, 24)), String(respId).slice(0, 24))
  return t && r?.arm ? (t.arms.find((a) => a.id === r.arm)?.youtube ?? null) : null
}
