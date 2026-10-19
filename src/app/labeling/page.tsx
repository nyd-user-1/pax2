import Link from "next/link"

import { CardBlock } from "@/components/blocks"
import { COURSES } from "@/lib/courses"

export const metadata = { title: "Teach a Model" }

// Teach a Model: courses by model type, in the order of the model inventory on /ml. The Classifier
// (/labeling/classifier) has its own page; the rest run on /labeling/<course> from src/lib/courses.ts.

const CLASSIFIER = "A course on how a particular model learns, the multi-label classifier. The course defines a model by type and function and explains what is needed to train that kind of model and why. A classifier has its own requirements: labeled examples, features, agreement between labelers, and a held-out test, that other models do not. As part of the course you assist in the training of a classifier; in doing so you learn to recognize the conditions of its training, the rationale behind each one, and how to conduct your own training of a classifier."

export default function TeachAModelPage() {
  return (
    <div className="flex flex-col gap-6">
      <CardBlock title="The Classifier" height="auto">
        <div className="flex flex-col gap-4">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{CLASSIFIER}</p>
          <Link href="/labeling/classifier" className="press w-fit rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">
            Start
          </Link>
        </div>
      </CardBlock>
      <CardBlock title="Courses" height="auto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COURSES.map((c) => (
            <article key={c.id} data-find={c.title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <h2 className="font-display text-xl text-slate-900">{c.title}</h2>
              <p className="flex-1 text-sm leading-relaxed text-slate-600">{c.line}</p>
              <Link href={`/labeling/${c.id}`} className="w-fit rounded-full border px-5 py-2 text-sm font-medium text-pax2-blue">
                Start
              </Link>
            </article>
          ))}
        </div>
      </CardBlock>
    </div>
  )
}
