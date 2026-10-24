// The analysis behind a message test (methodology in lib/message-tests.ts), and the simulator that checks
// it: respondents generated with known, planted lifts, run through the same analysis, so the estimate can
// be seen to recover them before any real respondent is paid for. Pure functions: browser and server.

import { ABOUT, type Arm, type MessageTest, type Response } from "@/lib/message-tests"

export type Lift = { est: number; se: number; lo: number; hi: number; p: number }

// ---------- the normal distribution ----------

function erf(x: number) {
  // Abramowitz and Stegun 7.1.26, |error| < 1.5e-7.
  const s = Math.sign(x)
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}
const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))
const Z = { 90: 1.6448536, 95: 1.959964 } as const

const lift = (est: number, se: number, conf: 90 | 95): Lift => ({ est, se, lo: est - Z[conf] * se, hi: est + Z[conf] * se, p: se > 0 ? 2 * (1 - normCdf(Math.abs(est / se))) : 1 })

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length

// ---------- estimators ----------

/** Difference in means with the Neyman standard error. */
export function diffInMeans(y1: number[], y0: number[], conf: 90 | 95): Lift | null {
  if (y1.length < 2 || y0.length < 2) return null
  const m1 = mean(y1)
  const m0 = mean(y0)
  const v = (a: number[], mu: number) => a.reduce((s, x) => s + (x - mu) ** 2, 0) / (a.length - 1)
  return lift(m1 - m0, Math.sqrt(v(y1, m1) / y1.length + v(y0, m0) / y0.length), conf)
}

/** Gauss-Jordan inverse with partial pivoting; null when the matrix is singular. */
function invert(m: number[][]): number[][] | null {
  const n = m.length
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    if (Math.abs(a[p][c]) < 1e-10) return null
    ;[a[c], a[p]] = [a[p], a[c]]
    const d = a[c][c]
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d
    for (let r = 0; r < n; r++) {
      if (r === c || a[r][c] === 0) continue
      const f = a[r][c]
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]
    }
  }
  return a.map((r) => r.slice(n))
}

/** Lin (2013): OLS of y on treatment, centered covariates and their interactions with treatment; the
 *  treatment coefficient is the lift, with an HC2 robust standard error. Null when the sample is too
 *  small for the covariates or the design is singular (the caller falls back to the difference in means). */
export function linEstimate(y: number[], t: number[], X: number[][], conf: 90 | 95): Lift | null {
  const n = y.length
  const k = X[0]?.length ?? 0
  const keep: number[] = []
  const means: number[] = []
  for (let j = 0; j < k; j++) {
    if (!X.some((r) => r[j] !== X[0][j])) continue
    keep.push(j)
    means.push(X.reduce((s, r) => s + r[j], 0) / n)
  }
  const rows = X.map((r, i) => {
    const c = keep.map((j, q) => r[j] - means[q])
    return [1, t[i], ...c, ...c.map((v) => v * t[i])]
  })
  const p = rows[0]?.length ?? 0
  if (n < 2 * p + 20) return null
  const xtx = Array.from({ length: p }, () => new Array<number>(p).fill(0))
  const xty = new Array<number>(p).fill(0)
  for (let i = 0; i < n; i++) {
    const r = rows[i]
    for (let a = 0; a < p; a++) {
      xty[a] += r[a] * y[i]
      for (let b = 0; b < p; b++) xtx[a][b] += r[a] * r[b]
    }
  }
  const inv = invert(xtx)
  if (!inv) return null
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * xty[j], 0))
  const meat = Array.from({ length: p }, () => new Array<number>(p).fill(0))
  for (let i = 0; i < n; i++) {
    const r = rows[i]
    const e = y[i] - r.reduce((s, v, j) => s + v * beta[j], 0)
    const ir = inv.map((row) => row.reduce((s, v, j) => s + v * r[j], 0))
    const h = r.reduce((s, v, j) => s + v * ir[j], 0)
    const w = (e * e) / Math.max(1e-9, 1 - h)
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) meat[a][b] += r[a] * r[b] * w
  }
  // V[1][1] = (inv · meat · inv)[1][1]
  const left = inv[1]
  let v11 = 0
  for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) v11 += left[a] * meat[a][b] * inv[b][1]
  return lift(beta[1], Math.sqrt(Math.max(0, v11)), conf)
}

/** Holm's step-down correction: which of the p-values hold at `alpha` across all of them. */
export function holm(ps: number[], alpha: number): boolean[] {
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p)
  const out = new Array<boolean>(ps.length).fill(false)
  for (let r = 0; r < order.length; r++) {
    if (order[r].p > alpha / (order.length - r)) break
    out[order[r].i] = true
  }
  return out
}

// ---------- a test's results ----------

export type ArmResult = { arm: Arm; n: number; yes: number; comprehension: number | null; watched: number | null; checkPass: number | null; yesLift: Lift | null; yesLiftRaw: Lift | null; compLift: Lift | null; holds: boolean }
export type GroupCell = { group: string; n: number; nPlacebo: number; lift: Lift | null; small: boolean }
export type Results = {
  confidence: 90 | 95
  placebo: { arm: Arm; n: number; yes: number; comprehension: number | null } | null
  arms: ArmResult[]
  groups: { key: string; label: string; byArm: Record<string, GroupCell[]> }[]
  counts: { started: number; screened: number; incomplete: number; complete: number }
}

const SMALL = 75
const ADJUST = ABOUT.filter((q) => q.adjust)

/** Dummy-coded covariates, the first option of each question the baseline. */
const covariates = (r: Response) => ADJUST.flatMap((q) => q.options.slice(1).map((o) => (r.about[q.key] === o ? 1 : 0)))

export function analyze(test: MessageTest, responses: Response[]): Results {
  const conf = test.confidence
  const real = responses.filter((r) => !r.preview)
  const done = real.filter((r) => r.step === "done" && r.passed && r.arm && r.vote != null)
  const counts = { started: real.length, screened: real.filter((r) => r.step === "screened").length, incomplete: real.filter((r) => r.step !== "done" && r.step !== "screened").length, complete: done.length }
  const yesOf = (r: Response): number => (test.vote.yes.includes(r.vote!) ? 1 : 0)
  const compOf = (r: Response): number | null => (test.comprehension && r.comprehension != null ? (r.comprehension === test.comprehension.answer ? 1 : 0) : null)
  const placeboArm = test.arms.find((a) => a.placebo) ?? null
  const inArm = (id: string) => done.filter((r) => r.arm === id)
  const share = (rs: Response[], f: (r: Response) => number | null) => {
    const v = rs.map(f).filter((x): x is number => x != null)
    return v.length ? mean(v) : null
  }
  const p0 = placeboArm ? inArm(placeboArm.id) : []
  const placebo = placeboArm ? { arm: placeboArm, n: p0.length, yes: share(p0, yesOf) ?? 0, comprehension: share(p0, compOf) } : null

  const arms: ArmResult[] = test.arms
    .filter((a) => !a.placebo)
    .map((arm) => {
      const p1 = inArm(arm.id)
      const both = [...p1, ...p0]
      const t = both.map((r) => (r.arm === arm.id ? 1 : 0))
      const yesLiftRaw = placeboArm ? diffInMeans(p1.map(yesOf), p0.map(yesOf), conf) : null
      const yesLift = placeboArm ? (linEstimate(both.map(yesOf), t, both.map(covariates), conf) ?? yesLiftRaw) : null
      const c1 = p1.map(compOf).filter((x): x is number => x != null)
      const c0 = p0.map(compOf).filter((x): x is number => x != null)
      const checked = p1.filter((r) => r.check != null && arm.check != null)
      return {
        arm,
        n: p1.length,
        yes: share(p1, yesOf) ?? 0,
        comprehension: share(p1, compOf),
        watched: null,
        checkPass: checked.length ? checked.filter((r) => r.check === arm.check).length / checked.length : null,
        yesLift,
        yesLiftRaw,
        compLift: placeboArm ? diffInMeans(c1, c0, conf) : null,
        holds: false,
      }
    })
  const holds = holm(arms.map((a) => a.yesLift?.p ?? 1), conf === 90 ? 0.1 : 0.05)
  arms.forEach((a, i) => (a.holds = holds[i]))

  const groups = ABOUT.map((q) => ({
    key: q.key,
    label: q.label,
    byArm: Object.fromEntries(
      arms.map((a) => [
        a.arm.id,
        q.options.map((o) => {
          const g1 = inArm(a.arm.id).filter((r) => r.about[q.key] === o)
          const g0 = p0.filter((r) => r.about[q.key] === o)
          return { group: o, n: g1.length, nPlacebo: g0.length, lift: diffInMeans(g1.map(yesOf), g0.map(yesOf), conf), small: g1.length < SMALL || g0.length < SMALL }
        }),
      ]),
    ),
  }))
  return { confidence: conf, placebo, arms, groups, counts }
}

// ---------- the simulator ----------

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SHARES: Record<string, number[]> = { party: [0.35, 0.47, 0.18], ideology: [0.36, 0.4, 0.24], vote2024: [0.55, 0.3, 0.04, 0.11] }

/** `perArm` simulated respondents per arm who passed the attention check, plus the screened-out share a
 *  real panel loses (8%). Ballot support starts from a baseline that moves with party and ideology; each
 *  test arm adds its planted lift, in points. */
export function simulate(test: MessageTest, planted: Record<string, number>, seed = 7): Response[] {
  const r = rng(seed)
  const pick = (opts: string[], w?: number[]) => {
    const ws = w ?? opts.map(() => 1 / opts.length)
    let u = r()
    for (let i = 0; i < opts.length; i++) {
      u -= ws[i]
      if (u <= 0) return opts[i]
    }
    return opts[opts.length - 1]
  }
  const out: Response[] = []
  const at = new Date().toISOString()
  let k = 0
  for (const arm of test.arms) {
    const total = Math.round(test.perArm / 0.92)
    for (let i = 0; i < total; i++) {
      const about = Object.fromEntries(ABOUT.map((q) => [q.key, pick(q.options, SHARES[q.key])]))
      const screened = r() < 0.08
      let p = 0.44 + (about.party === "Democrat" ? 0.1 : about.party === "Republican" ? -0.16 : 0) + (about.ideology === "Liberal" ? 0.05 : about.ideology === "Conservative" ? -0.07 : 0)
      if (!arm.placebo) p += (planted[arm.id] ?? 0) / 100
      p = Math.min(0.98, Math.max(0.02, p))
      const yes = r() < p
      const comp = r() < 0.55 + (about.education === "Bachelor's degree or more" ? 0.12 : 0)
      out.push({
        id: `sim-${k++}`,
        testId: test.id,
        step: screened ? "screened" : "done",
        preview: false,
        panel: {},
        startedAt: at,
        completedAt: screened ? null : at,
        attention: screened ? 0 : test.attention.answer,
        passed: !screened,
        about,
        arm: screened ? null : arm.id,
        watched: null,
        check: screened ? null : arm.check,
        vote: screened ? null : yes ? test.vote.yes[0] ?? 0 : test.vote.options.findIndex((_, j) => !test.vote.yes.includes(j)),
        comprehension: screened || !test.comprehension ? null : comp ? test.comprehension.answer : (test.comprehension.answer + 1) % test.comprehension.options.length,
      })
    }
  }
  return out
}
