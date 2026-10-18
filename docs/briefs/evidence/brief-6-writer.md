# Brief 6, A3: the writer before and after "What travels on these channels"

Run 2026-10-18 from the scratchpad, not through the app: the same three answers, the same base script, one call each to `us.anthropic.claude-sonnet-4-6` on Bedrock (PAX2GPT), temperature 0.6 as in `writeScript`. The "before" prompt is the one committed at 7a8c777, rebuilt verbatim from `src/app/actions.ts`; the "after" prompt is `writerPrompt()` in `src/lib/writer-prompt.ts`. No DynamoDB read: a fresh workspace has no scored takes, so `writeScript` builds on `calm`, and so did this run.

Tokens: before 819 in, 141 out; after 1585 in, 153 out. About a cent at Bedrock's list price for the model.

## The answers

- Name: Dana
- Who they are: ER nurse, Worcester
- Why this matters to them: I work nights and I vote every time, but most years the primary is the whole election and I'm not allowed in it because I'm unenrolled.
- A moment they felt they had no real choice: Two years ago my state rep ran unopposed. I stood in the booth looking at one name and filled in the oval anyway.

## Before (99 words)

```
I filled in the oval anyway — one name, no choice.

I'm Dana, I'm an ER nurse in Worcester, and I vote every single time. But most years the primary is the whole election, and I'm not even allowed in it because I'm unenrolled.

Two years ago my state rep ran unopposed. That's not democracy. That's just paperwork.

Question 3 puts every candidate on one primary ballot. Top finishers move on to November. Every voter gets a say — party or no party.

No competition means no accountability. Candidates should have to earn it.

Vote yes on Question 3.
```

## After (108 words)

```
I'm an ER nurse in Worcester, and I vote every single time.

Two years ago I stood in the booth, and there was one name on the ballot. One. I filled in the oval anyway, but that's not really a choice.

More than half of Massachusetts races since 2014 have been completely uncontested. When nobody has to compete, nobody has to answer to you.

Question 3 puts everyone on one primary ballot. Top finishers move to November. Didn't matter what party you're in — or none, like me. You get a say.

Candidates who actually have to earn it. That's all I'm asking.

Vote yes on Question 3.
```

## The editor's sixth check on each (reform channels)

| Trait | Lift, 90% range | Before | After |
|---|---|---|---|
| Combative words in the title | −7.3 (−15.2 to −4.2) | not present | not present |
| 20 seconds or shorter | +6.5 (1 to 13) | about 46 seconds | about 50 seconds |
| Title asks a question | +5.7 (3.1 to 11) | not present | not present |

What changed, on one draw each, so none of it is attributable to the prompt: the after script keeps the reference text's "more than half since 2014" fact, which the before script dropped; it opens on who the volunteer is rather than the before script's hook line; it quotes no figure from the new section. Neither script opens with a question, and neither can reach 20 seconds while the prompt still asks for 80 to 110 words; the length rule was left as it stands.

## Prompt diff

```diff
@@ -8,7 +8,30 @@
 It’s a simple change. More choices on the ballot, and representatives who have to answer to all of us.
 Vote yes on Question 3.
 
-Observed patterns on the reform channels, not rules: weigh them, don't obey them blindly.
+What tested campaign ads found (Swayable's randomized tests against a placebo video):
+- Plain-folks appeal: +0.8 points of vote choice (95% range 0.3 to 1.3), 574 tested ads.
+- Explicit ask to vote for: +0.6 points of vote choice (95% range 0.2 to 1.0), 574 tested ads.
+- Offers a fact the viewer likely hasn't heard: +0.6 points of favorability (95% range 0.2 to 1.0), 432 tested ads.
+- Explains facts: +0.6 points of favorability (95% range 0.1 to 1.1), 432 tested ads.
+
+What travels on these channels
+Measured within each channel, on the reform channels: the share of shorts with a trait that reached 3x their channel's median, against the same channel's shorts without it. Traits named for the title were measured on titles; in a script they matter most in the opening line.
+Lifts:
+- 20 seconds or shorter: +6.5 points in the share of shorts reaching 3x their channel's median (90% range 1 to 13), within 6 reform channels, 56 shorts with it.
+- Title asks a question: +5.7 points in the share of shorts reaching 3x their channel's median (90% range 3.1 to 11), within 9 reform channels, 173 shorts with it.
+Sinks:
+- Combative words in the title (lies, corrupt, slams…): −7.3 points in the share of shorts reaching 3x their channel's median (90% range −15.2 to −4.2), within 3 reform channels, 18 shorts with it.
+How the coded reform shorts that broke out were delivered, against the rest:
+- Cites a source: 8 of the 20 coded reform shorts above the set's median Organic score (40%), 3 of the 19 below (16%).
+- Anger: 5 of the 20 coded reform shorts above the set's median Organic score (25%), 1 of the 19 below (5%).
+- Everyday messenger: 11 of the 20 coded reform shorts above the set's median Organic score (55%), 7 of the 19 below (37%).
+- Opens with a question: 3 of the 20 coded reform shorts above the set's median Organic score (15%), 6 of the 19 below (32%).
+- Explains facts: 17 of the 20 coded reform shorts above the set's median Organic score (85%), 19 of the 19 below (100%).
+- Offers an unfamiliar fact: 14 of the 20 coded reform shorts above the set's median Organic score (70%), 16 of the 19 below (84%).
+- Negative tone: 8 of the 20 coded reform shorts above the set's median Organic score (40%), 5 of the 19 below (26%).
+- Personal story: 3 of the 20 coded reform shorts above the set's median Organic score (15%), 1 of the 19 below (5%).
+- Pace: 171 words a minute in the 20 above the median, 189.1 in the 19 below.
+- Length: 82.6 seconds on average above the median, 66.3 below.
 The titles of the ten reform-channel shorts with the highest iWAR (views against their channel's median):
 - "Make Congress Work Better with the Ranked Choice Voting Act" (FairVote, 53.4x)
 - "Run Down by Runoffs? Try Ranked Choice Voting" (FairVote, 27.2x)
@@ -20,11 +43,9 @@
 - "Just Join A Party To Vote" (Open Primaries, 8.3x)
 - "Wisconsin Picked Its Nominees for Governor. 68,000 Votes Never Counted" (FairVote, 7.0x)
 - "How to Fill Out a Ranked Choice Voting Ballot in 30 Seconds" (FairVote, 6.9x)
-What measurably travels further for a video like this one:
-- post on a weekend (+6.7 points of breakout rate on Reform channels)
-- cut it to 20 seconds or shorter (+6.5 points of breakout rate on Reform channels)
-- ask a question in the title (+5.7 points of breakout rate on Reform channels)
 
+Observed patterns, not rules: weigh them, don't obey them blindly. Where they fit this person's story, favor the traits that lift and avoid the ones that sink. Never quote any of these figures in the script itself.
+
 About the volunteer, in their words:
 - Name: Dana
 - Who they are: ER nurse, Worcester
```
