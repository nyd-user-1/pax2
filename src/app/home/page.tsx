import { MainBlock } from "@/components/blocks"

// Four empty blocks, each a full viewport less the page margin, waiting for their content.

export const metadata = { title: "Home" }

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 md:gap-9">
      {[1, 2, 3, 4].map((n) => (
        <MainBlock key={n} title="" name={`block-${n}`} id={`block-${n}`} height="h-[calc(100dvh-90px)] md:h-[calc(100dvh-182px)]">
          <div />
        </MainBlock>
      ))}
    </div>
  )
}
