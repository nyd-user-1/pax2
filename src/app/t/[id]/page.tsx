import { Survey } from "@/components/message-tests/survey"

export const metadata = { title: "Survey", robots: { index: false } }

/** A message test's respondent link: /t/<testId>?<the panel's participant ids>. `preview=1` lets an admin
 *  run a draft without being counted. */
export default async function SurveyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  const q = await searchParams
  const panel = Object.fromEntries(Object.entries(q).filter(([k, v]) => k !== "preview" && typeof v === "string") as [string, string][])
  return <Survey testId={id} panel={panel} preview={q.preview === "1"} />
}
