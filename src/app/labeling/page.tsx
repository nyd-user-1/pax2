import Link from "next/link"

export const metadata = { title: "Teach a Model" }

// Teach a Model: courses by model type, in the order of the model inventory on /ml. The Classifier
// is the one course built (/labeling/classifier); the rest are named so the shape of the whole is
// visible.

const CLASSIFIER = "A course on how a particular model learns, the multi-label classifier. The course defines a model by type and function and explains what is needed to train that kind of model and why. A classifier has its own requirements: labeled examples, features, agreement between labelers, and a held-out test, that other models do not. As part of the course you assist in the training of a classifier; in doing so you learn to recognize the conditions of its training, the rationale behind each one, and how to conduct your own training of a classifier."

const COMING = [
  { title: "Ranker", line: "Puts a set of items in order, the best fit for a goal first." },
  { title: "Encoder", line: "Turns an example into a list of numbers, so that similar examples sit close together." },
  { title: "Regressor", line: "Predicts a quantity, such as how many views a video gets or how long people watch." },
  { title: "Simulator", line: "Plays out how a system responds to an action, such as a platform deciding who is shown a video." },
  { title: "Language model", line: "Predicts the next word, and from that writes, summarizes and answers in text." },
]

export default function TeachAModelPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-slate-900">Teach a Model</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-e1 sm:col-span-2 lg:col-span-3">
          <h2 className="font-display text-2xl text-pax2-blue">The Classifier</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{CLASSIFIER}</p>
          <Link href="/labeling/classifier" className="press w-fit rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">
            Start
          </Link>
        </article>
        {COMING.map((c) => (
          <article key={c.title} className="flex flex-col gap-2 rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-slate-900">{c.title}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Coming</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{c.line}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
