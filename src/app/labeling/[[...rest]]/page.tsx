import { redirect } from "next/navigation"

// Teach a Model moved to /learn; old links keep their place in the course.
export default async function Page({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest } = await params
  redirect(`/learn${rest?.length ? `/${rest.join("/")}` : ""}`)
}
