import { GLOSSARY } from "@/lib/glossary"

export const metadata = { title: "Glossary" }

export default function GlossaryPage() {
  const groups = [...new Set(GLOSSARY.map((t) => t.group))]
  return (
    <div className="flex flex-col gap-10">
      {groups.map((g) => (
        <section key={g} className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-slate-900">{g}</h2>
          <dl className="surface divide-y divide-slate-100">
            {GLOSSARY.filter((t) => t.group === g).map((t) => (
              <div key={t.id} id={t.id} className="grid scroll-mt-24 gap-1 px-5 py-4 target:bg-pax-lavender/50 md:grid-cols-[220px_1fr] md:gap-6">
                <dt>
                  <p className="font-semibold text-slate-900">{t.full}</p>
                  {t.short !== t.full && <p className="text-xs text-slate-400">Shown as “{t.short}”</p>}
                </dt>
                <dd className="text-sm leading-relaxed text-slate-600">{t.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
