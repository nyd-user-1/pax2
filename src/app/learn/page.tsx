import Link from "next/link"
import { Award, BarChart3, Clock, ListChecks, MessageSquareText, Sparkles } from "lucide-react"

import { CardBlock } from "@/components/blocks"
import { COURSES } from "@/lib/courses"

export const metadata = { title: "Teach a Model" }

// Teach a Model: the Classifier's course hero on top, in the shape of a course catalog's landing,
// then the other courses by model type, in the order of the model inventory on /ml.

const CLASSIFIER = "A course on how a particular model learns, the multi-label classifier. The course defines a model by type and function and explains what is needed to train that kind of model and why. A classifier has its own requirements: labeled examples, features, agreement between labelers, and a held-out test, that other models do not. As part of the course you assist in the training of a classifier; in doing so you learn to recognize the conditions of its training, the rationale behind each one, and how to conduct your own training of a classifier."

const INCLUDES = [
  { icon: Sparkles, text: "One real campaign short to label" },
  { icon: ListChecks, text: "Four chapters of seven traits each" },
  { icon: MessageSquareText, text: "Your read beside the model's, trait by trait" },
]

const FACTS = [
  { icon: BarChart3, label: "Skill level", value: "Beginner" },
  { icon: Clock, label: "Time to complete", value: "About 15 minutes" },
  { icon: Award, label: "Prerequisites", value: "None" },
]

export default function TeachAModelPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="surface flex flex-col gap-8 p-8 md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2">
              <span className="rounded-full bg-pax2-blue px-3 py-0.5 text-xs font-semibold text-white">Free</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Course</span>
            </p>
            <h2 className="font-display text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">The Classifier</h2>
            <p className="max-w-2xl leading-relaxed text-slate-700">{CLASSIFIER}</p>
            <Link href="/learn/classifier" className="press mt-2 w-fit rounded-full bg-pax2-blue px-8 py-3.5 font-medium text-white shadow-md">
              Start
            </Link>
          </div>
          <div className="h-fit rounded-2xl border border-slate-300 p-6">
            <p className="font-display text-lg font-semibold text-slate-900">This course includes</p>
            <ul className="mt-4 flex flex-col divide-y divide-slate-200">
              {INCLUDES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 py-3 text-sm text-slate-700">
                  <Icon className="size-5 shrink-0 text-pax2-blue" /> {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid gap-6 rounded-2xl border border-slate-300 p-6 sm:grid-cols-3">
          {FACTS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="size-6 shrink-0 text-slate-500" />
              <span className="flex flex-col">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="font-semibold text-slate-900">{value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <CardBlock title="Courses" height="auto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COURSES.map((c) => (
            <article key={c.id} data-find={c.title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <h2 className="font-display text-xl text-slate-900">{c.title}</h2>
              <p className="flex-1 text-sm leading-relaxed text-slate-600">{c.line}</p>
              <Link href={`/learn/${c.id}`} className="w-fit rounded-full border px-5 py-2 text-sm font-medium text-pax2-blue">
                Start
              </Link>
            </article>
          ))}
        </div>
      </CardBlock>
    </div>
  )
}
