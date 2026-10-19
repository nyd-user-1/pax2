---
license: cc0-1.0
pipeline_tag: tabular-regression
tags:
- persuasion
- meta-regression
- political-ads
- swayable
---

# PAX2 Persuasion Reference

How much a political ad's coded traits (plain-folks appeal, a veteran messenger, an explicit ask to vote, and 25 others) moved favorability and vote choice in Swayable's randomized ad tests, in percentage points against each study's control group. Built 2026-10-03 from the replication archive of Hewitt, Broockman, Coppock, Tappin, Slezak, Coffman, Lubin and Hamidian, "How Experiments Help Campaigns Persuade Voters," APSR 2024 (Dataverse doi:10.7910/DVN/LBPSSV, CC0).

PAX2 cites the per-trait differences beside a video's findings. The predictive model in the same file does not predict; PAX2 shows its R² and scores nothing with it.

## Contents

`reference-model.json`, per outcome (`favorability`, `votechoice`, `votechoice_dichotomized`):

- `features[]`: each trait's difference in effect, ads with it against ads without, from a random-effects meta-regression, with standard error, 95% interval, prevalence and the number of ads
- `meanEffect`, `tau`: the average ad effect and the spread of true effects
- `prediction`: ridge regression (lambda 5) of an ad's effect on all 28 traits, inverse-variance weighted, scored leave one study out; `intercept` and `coefficients`

Also `authors.rows`: the paper's own meta-regression estimates for the same traits, 600 rows, for comparison.

## Data

146 studies from 2018 and 2020 (58 presidential, 28 congressional, 11 runoffs, 10 state legislative, 6 other); 433 favorability estimates and 575 vote-choice estimates (`worker/model.py`).

## Benchmark

| Outcome | Mean ad effect, points | Spread of true effects (tau) | Leave-one-study-out R² |
|---|---:|---:|---:|
| Favorability | 1.38 | 1.09 | -0.021 |
| Vote choice | 1.05 | 0.79 | -0.001 |
| Vote choice, dichotomized | 1.41 | 1.11 | 0.003 |

An ad's coded traits do not predict its effect in a study it was not fit on; the paper reaches the same conclusion. Single traits do carry measured differences: on vote choice, plain-folks appeal +0.79 points (95% interval 0.32 to 1.25) and an explicit ask to vote for the candidate +0.59 (0.19 to 0.99).

## Caveats

- Traits were coded by the archive's authors, not by PAX2.
- Differences are associations across ads, not randomized contrasts of the trait itself.
- 2018 and 2020 ads, mostly presidential; the transfer to 2026 shorts is untested.
