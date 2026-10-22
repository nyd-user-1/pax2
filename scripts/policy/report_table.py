"""Print a loop's registered numbers as the Report's markdown (scripts/policy/learn.py output)."""
import json, sys
m = json.load(open(f"data/generated/model/learning/{sys.argv[1]}.json"))
e = m["eval"]
c = e["modelCheck"]
print(f"**Ran.** {e['rows']:,} rows; train {e['train']:,} (through {e['trainEndsAt']}), test {e['test']:,}; base rate {e['baseRate']}, test logged rate {e['testBaseRate']}. "
      f"Progressive validation, log loss (AUC): full {c['full']['logLoss']} ({c['full']['auc']}), context-only {c['contextOnly']['logLoss']} ({c['contextOnly']['auc']}).\n")
print("| Policy | Matched | ESS | SNIPS − logged (95%) | DR − logged (95%) | Rule |\n|---|---|---|---|---|---|")
f = lambda x: f"{x:+.3f}"
for k, o in e["ope"].items():
    rule = "reported only" if k == "joint" and len(e["ope"]) > 1 else ("pass" if o["pass"] else "fail")
    print(f"| {k} | {o['matched']:,} | {o['ess']} | {f(o['SNIPSminusLogged'])} ({f(o['SNIPSdiffCI95'][0])}, {f(o['SNIPSdiffCI95'][1])}) | {f(o['DRminusLogged'])} ({f(o['DRdiffCI95'][0])}, {f(o['DRdiffCI95'][1])}) | {rule} |")
em = m["epochMarker"]
print(f"\nEpoch marker: replayRows = {em['replayRows']:,}, last replayed `{em['lastReplayedId']}` ({em['lastReplayedPublished']}).\n")
print(f"**Verdict by the registered rule: {'PASS' if e['pass'] else 'FAIL'}.**")
