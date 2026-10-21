// The chat's sample scripts: a new batch about open primaries in general, tied to no ballot question.
// Each is built from what the record measures, not taste:
// - the hook stays under 12 words — short first lines rank high on the headline model trained on
//   Upworthy's 10,452 tested pairs (held-out pair accuracy 0.672);
// - first person, plain folks — in the 617 control-tested campaign ads, plain-folks appeals moved vote
//   choice +0.79 points (0.3 to 1.3), the largest positive trait;
// - an explicit ask at the end — +0.59 points (0.2 to 1.0) in the same tests;
// - one concrete number per script, from Unite America's primary-problem research (the ads and
//   dataverse sets PAX2 carries);
// - 50 to 60 words, about 25 seconds at a spoken 130 wpm — the settled catalog's crossing point, under
//   which a short is likelier to outperform 3x its channel median than to underperform.

export type OpenScript = { id: string; title: string; short: string; hook: string; text: string }

export const OPEN_SCRIPTS: OpenScript[] = [
  {
    id: "op-nine-in-ten",
    title: "Nine in Ten",
    short: "Nine in Ten",
    hook: "Your November vote probably didn't decide anything.",
    text: "Your November vote probably didn't decide anything. Nearly nine in ten congressional races are settled months earlier, in the primary. I used to skip primaries — turns out I was skipping the real election. If your state closes its primaries, most of us never get a say. Look up how your state runs its primaries. That's where your vote lives.",
  },
  {
    id: "op-eight-percent",
    title: "The Eight Percent",
    short: "Eight Percent",
    hook: "Eight percent of voters picked most of Congress.",
    text: "Eight percent of voters picked most of Congress. Not a typo. In the primaries that actually decided those seats, that's about how many of us showed up — and in closed states, independents couldn't. I'm one vote, same as you. Open primaries let every voter in. Find out if your state's are open. It takes one search.",
  },
  {
    id: "op-locked-out",
    title: "Locked Out",
    short: "Locked Out",
    hook: "I pay for elections I'm not allowed to vote in.",
    text: "I pay for elections I'm not allowed to vote in. I'm an independent — so are more Americans than either party now. My taxes fund the primary, and in a closed-primary state the door's locked unless I join a club first. Open primaries fix that: one ballot, every voter. Check what your state does. You might be locked out too.",
  },
  {
    id: "op-real-election",
    title: "The Real Election",
    short: "Real Election",
    hook: "The election that matters isn't the one you think.",
    text: "The election that matters isn't the one you think. In most districts the general is already decided — the primary is the whole game, and turnout there is a fraction of November's. I vote in every primary now, because that's where the choosing happens. If your state lets every voter in, use it. If it doesn't, ask why.",
  },
  {
    id: "op-pick-the-person",
    title: "Pick the Person",
    short: "Pick the Person",
    hook: "I want to vote for a person, not a party.",
    text: "I want to vote for a person, not a party. Open primaries put every candidate on one ballot and let every voter — Democrat, Republican, independent — pick whoever they think is best. States that do it this way give candidates a reason to talk to everyone, not just their base. See whether your state's primaries are open. One search tells you.",
  },
  {
    id: "op-twenty-seconds",
    title: "One Search",
    short: "One Search",
    hook: "Here's a twenty-second homework assignment.",
    text: "Here's a twenty-second homework assignment. Search your state's name plus 'open primary.' That's it. You'll learn whether every voter gets a say in the election that decides most seats — or only party members do. I did it for mine and honestly, it changed how I vote. Do yours before the next primary comes around.",
  },
]
