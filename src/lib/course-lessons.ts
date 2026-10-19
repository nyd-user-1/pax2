import varModel from "../../data/generated/model/var-model.json"
import { TRAIT_RELIABILITY } from "@/lib/trait-definitions"

// The four lessons of the Classifier course (src/lib/course.ts), one paragraph per entry, plain
// words, third person. Numbers are read from the data they describe, never typed in.
const rel = (key: string, year: number) => TRAIT_RELIABILITY[key]?.find((r) => r.year === year)?.icc.toFixed(2) ?? "unmeasured"
const LOCO = (varModel as { metadata: { metrics: { leaveOneChannelOut: { withinChannelAuc: number } } } }).metadata.metrics.leaveOneChannelOut
const AUC = LOCO.withinChannelAuc
const IN100 = Math.round(AUC * 100)

export const LESSONS: Record<number, string[]> = {
  1: [
    "A label is one answer about one example: does this video have this trait, yes or no. A classifier learns from many such answers, each tied to the example it describes.",
    "Ground truth comes from people, not from the model. A model checked against its own answers can only agree with itself; the standard it is measured against has to be what careful people see when they watch.",
    "The archive this classifier leans on got its labels that way. Research assistants watched each campaign ad, three to a video in 2018 and two in 2020, answered the same questions, and their answers were adjusted for each rater's habits and averaged.",
    "The learner is now one of those people. The video beside this lesson is the example, and each question that follows is one label.",
    "Pass is a valid answer. When the video does not make a trait clear, a guess adds noise that looks like signal. A pass leaves the question to the next labeler and tells the classifier nothing false.",
  ],
  2: [
    "The classifier does not watch the video. It reads the transcript, with a short written description of what is on screen: the setting, who appears, the text overlays, the music and the pace.",
    "Those inputs are its features: what it is given about an example. A label is what it is asked to produce. The transcript is a feature; whether the video tells a personal story is a label.",
    "From one input the classifier answers twenty-eight questions, and any number of them can be yes. That makes it a multi-label classifier, as opposed to one that sorts each example into a single category.",
    "Today a language model plays the classifier. It is given the transcript, the description and the list of traits, and answers each trait with a number from 0 to 1. The course reads 0.5 or above as present.",
    "A trained classifier would answer another way: from thousands of labeled examples it learns which features go with which labels, with no list of instructions. Those examples do not exist yet. The learner's labels are what make them.",
  ],
  3: [
    "Two careful people can watch the same ad and disagree on whether it works to make the viewer angry. Who the messenger is can be seen; what an ad is trying to make someone feel has to be judged.",
    "Agreement rate is the share of examples on which two labelers gave the same answer. Cohen's kappa is that agreement with the share expected by chance taken out, so 1 is perfect and 0 is no better than chance.",
    `The archive measured its raters' agreement trait by trait, on a scale where 1 is perfect. Whether the messenger is a politician reached ${rel("messenger_politician", 2018)} in 2018. Anger reached ${rel("emotion_anger", 2018)} that year. Plain-folks appeal reached ${rel("technique_plain_folks", 2020)} in 2020.`,
    "A classifier cannot learn a trait more reliably than people can label it. Where raters split, the labels carry noise, and the classifier learns the noise along with the trait.",
    "So the course asks several people per video and takes the majority. One labeler's slip is outvoted, and a trait on which people keep splitting shows itself as one to define better or to drop.",
  ],
  4: [
    "A classifier is scored on examples it never saw in training. Scored on its own training examples, it can look perfect by remembering them and still say nothing about the next video.",
    "Those unseen examples are held out: set aside before training and opened once, at the end.",
    "Which examples are held out matters. Videos from one channel share a voice, an audience and a look, so a random split lets a classifier recognize the channel instead of the trait. Holding out whole channels asks the harder question: does it work on a channel it has never seen.",
    `Another classifier on this site, one that predicts whether a short will be an outlier on its channel, was tested that way, each channel held out in turn. Within one channel its AUC is ${AUC.toFixed(2)}: given an outlier and a non-outlier from the same channel, it ranks the outlier higher ${IN100} times in 100, where 50 is chance. That says it learned something, and not much. It does not say how likely any one video is to break out.`,
    "The learner's labels go two places next. Now, they are the test for this classifier: its answers set beside people's, trait by trait. Later, when there are enough of them, they are the training examples for a classifier that learns from labeled videos instead of a list of instructions.",
  ],
}
