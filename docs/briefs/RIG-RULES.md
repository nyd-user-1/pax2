# Rig rules for PAX2, distilled from NSR, CSHL and 44b

Required reading for every brief that launches a box, scrapes, or trains. Each rule cost a project time or correctness once. Sources, read them when a rule is unclear: `/Users/brendanstanton/Code/cshl/docs/RIG-DOCTRINE.md`, `/Users/brendanstanton/Code/cshl/docs/ORCHESTRATION-DOCTRINE.md`, `/Users/brendanstanton/Code/44b/docs/WORKER-BOX.md`, `/Users/brendanstanton/Code/nsr/scripts/train-nsr/README.md`, `/Users/brendanstanton/Code/nsr/docs/NSR-CPT-REPORT.md`, `/Users/brendanstanton/Code/nsr/scripts/enrich-s2-batch.mjs` (header).

## Where work runs

1. Nothing heavy runs on the Mac. No Python, no torch, no image sets, no bulk downloads. The Mac runs Node scripts, the AWS CLI, and `git`. Everything else runs on a box that terminates itself.
2. Every box job is scripted end to end before launch: user-data or a `run-all.sh` that installs, pulls code from S3, runs, uploads outputs and the log after every job, and shuts down. A box is never driven by hand except to read a shell when a launch fails.
3. A watchdog `shutdown -h +N` is the first line of every box script, sized to the job plus half. `--instance-initiated-shutdown-behavior terminate` on every launch. Last job out turns off the lights.
4. Every AWS CLI call carries `--region us-east-1` explicitly. The laptop's default region has bitten before.
5. Secrets travel through SSM SecureString, read on the box with `--with-decryption`. Never in user-data, never echoed, never in a log. Turn `set -x` off around anything that reads one.

## Before a launch

6. Price time and money together before launching: how long on the cheap box, how long on the next rung, and the dollars for each. Write both in the launcher's output.
7. Check the real quota and the real instance menu; absence of a quota error is not headroom. The on-demand G quota in this account is 64 vCPUs as of 2026-10-17.
8. The launcher walks a menu, not a list: instance types in order across availability zones, so one unavailable family does not stall the run. `InsufficientInstanceCapacity` is not a quota problem and a quota raise will not fix it.
9. Rehearse on about one percent first, one box, and measure throughput before projecting the full run. Four blind boots cost NSR half a dollar; one SSM shell found the facts. Reuse the box facts written in `train-nsr/README.md` rather than rediscovering them.
10. Dump the installed tool's `--help` to a file before trusting any pinned flag, and use its flags, not remembered ones.

## During the run

11. Long jobs checkpoint to S3 every N steps and resume from the latest; no checkpointing is reckless on Spot and merely lucky on demand.
12. Batch size is a quality parameter in contrastive training. If the OOM guard would halve the batch, stop and move to a bigger box; never let it silently pick the batch.
13. Completion is an event, not something noticed. The window that launched a box never ends its turn while the box is in flight: it polls instance state on a timer, not log activity, and reports state changes. Name the step and its expected duration before going heads-down.
14. Record the real exit code of every job as the last line of its log, and upload the log after every job, not only at the end. A run that reports `ALL DONE` with zero rows is the failure mode to design against.
15. One definition, imported. Text recipes, feature extractors and label rules live in one file; a box script that cannot import it asserts against that file's output rather than re-implementing it.

## Scraping and APIs

16. Dry run by default; `--apply` writes. The dry run prints the census and a sample.
17. Cache every raw response to disk or S3 before parsing it, keyed so a rerun skips what it has; a crash never re-spends a request.
18. Pace politely, back off gradually on 429, and judge credit or quota exhaustion from 2xx responses only; 429 rate-limit headers lie.
19. Every spending script carries a ceiling flag with a default, and stops at it. 44b wrote 51,956 unratified rows once because a flag fell through; the ceiling caught it.
20. Never proxy a third party's PDF or page through our servers; hand the URL to a viewer or fetch from a box.

## Verification

21. Coverage needs a second, independent count from the source, not the loader's own numbers. The Mac re-derives counts from the uploaded outputs and compares them with the log.
22. A completeness claim carries its timestamp and the corpus size it ran against, and the final check runs again immediately before publish.
23. Report per segment. A blended number hid a 34% gap once.
24. A verifier states exactly what it spans. One that advertises more than it proves is worse than none.
25. Split scoring from the dataset where it is cheap: a second, tiny implementation of the metric on the Mac that reads the box's outputs. Where the two agree you have validated both; where they disagree you have found a bug for free.
26. After an upload to Hugging Face, list the repository's files and sizes and compare with the source; a 2.27 GB upload once died at 96% and left a repository holding only `.gitattributes`.
27. NUL-check every generated file before committing it.

## Git

28. Stage by explicit pathspec, never `git add -A` or `commit -a`; other windows commit to the same tree. `git diff --cached --stat` before every commit.
29. Never quote a number that was not measured. Never claim a check that was not watched.
