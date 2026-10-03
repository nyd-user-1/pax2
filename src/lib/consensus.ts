// Consensus, the Polis way: people vote agree / disagree / pass on short statements, groups are
// found from the votes themselves, and a statement "bridges" when every group tends to agree with it.

export type V = { voter: string; tid: number; vote: 1 | -1 | 0; at: string }

export type StatementResult = {
  tid: number
  votes: number
  agree: number
  disagree: number
  agreeRate: number
  byGroup: { agree: number; total: number; rate: number }[]
  /** Product of each group's (smoothed) agreement: high only when every group agrees. */
  bridge: number
  /** Gap between the groups' agreement: high when the statement splits them. */
  divide: number
}

export function tally(raw: V[], tids: number[]) {
  // A changed mind is a new vote; the latest counts.
  const latest = new Map<string, V>()
  for (const v of [...raw].sort((a, b) => a.at.localeCompare(b.at))) latest.set(`${v.voter}#${v.tid}`, v)
  const votes = [...latest.values()]
  const voters = [...new Set(votes.map((v) => v.voter))]
  const col = new Map(tids.map((t, i) => [t, i]))
  const M = voters.map((p) => {
    const row = Array(tids.length).fill(0)
    for (const v of votes) if (v.voter === p && col.has(v.tid)) row[col.get(v.tid)!] = v.vote
    return row
  })
  // Two groups from the first principal direction of the vote matrix (power iteration).
  let groupOf = voters.map(() => 0)
  if (voters.length >= 4) {
    const means = tids.map((_, j) => M.reduce((t, r) => t + r[j], 0) / M.length)
    const X = M.map((r) => r.map((x, j) => x - means[j]))
    let w = tids.map((_, j) => Math.sin(j + 1))
    for (let it = 0; it < 50; it++) {
      const s = X.map((r) => r.reduce((t, x, j) => t + x * w[j], 0))
      const nw = tids.map((_, j) => X.reduce((t, r, i) => t + r[j] * s[i], 0))
      const norm = Math.hypot(...nw) || 1
      w = nw.map((x) => x / norm)
    }
    const proj = X.map((r) => r.reduce((t, x, j) => t + x * w[j], 0))
    const med = [...proj].sort((a, b) => a - b)[Math.floor(proj.length / 2)]
    groupOf = proj.map((p) => (p >= med ? 1 : 0))
    if (new Set(groupOf).size < 2) groupOf = voters.map(() => 0)
  }
  const groups = new Set(groupOf).size
  const results: StatementResult[] = tids.map((tid, j) => {
    const cast = M.map((r, i) => ({ v: r[j], g: groupOf[i] })).filter((x, i) => latest.has(`${voters[i]}#${tid}`))
    const agree = cast.filter((x) => x.v === 1).length
    const disagree = cast.filter((x) => x.v === -1).length
    const byGroup = Array.from({ length: groups }, (_, g) => {
      const mine = cast.filter((x) => x.g === g)
      const a = mine.filter((x) => x.v === 1).length
      return { agree: a, total: mine.length, rate: (a + 1) / (mine.length + 2) }
    })
    return {
      tid,
      votes: cast.length,
      agree,
      disagree,
      agreeRate: cast.length ? agree / cast.length : 0,
      byGroup,
      bridge: byGroup.reduce((t, g) => t * g.rate, 1),
      divide: byGroup.length > 1 ? Math.abs(byGroup[0].rate - byGroup[1].rate) : 0,
    }
  })
  return { voters: voters.length, groups, results }
}
