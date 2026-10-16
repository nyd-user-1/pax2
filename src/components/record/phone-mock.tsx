import { X, Zap } from "lucide-react"

/** A production iPhone around a real short: titanium frame, side keys, dynamic
 *  island, and the camera chrome over an autoplaying video. */
export function PhoneMock({ videoId, timer = "00:00" }: { videoId: string; timer?: string }) {
  return (
    <div className="relative mx-auto w-64 rotate-[4deg] md:w-72">
      <div className="relative rounded-[3.1rem] bg-gradient-to-b from-slate-500 via-slate-800 to-slate-500 p-[3px] shadow-[0_30px_60px_-18px_rgb(15_23_42/0.45),0_12px_24px_-12px_rgb(15_23_42/0.35)]">
        <span aria-hidden className="absolute -left-[2px] top-24 h-7 w-[3px] rounded-l-md bg-slate-500" />
        <span aria-hidden className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-md bg-slate-500" />
        <span aria-hidden className="absolute -left-[2px] top-[12.5rem] h-12 w-[3px] rounded-l-md bg-slate-500" />
        <span aria-hidden className="absolute -right-[2px] top-36 h-16 w-[3px] rounded-r-md bg-slate-500" />
        <div className="rounded-[2.95rem] bg-black p-[7px]">
          <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.5rem] bg-slate-950">
            <video src={`/api/video/${videoId}`} poster={`/api/video/${videoId}?poster`} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />
            <span aria-hidden className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/60 to-transparent" />
            <span aria-hidden className="absolute left-1/2 top-2.5 h-[22px] w-24 -translate-x-1/2 rounded-full bg-black" />
            <div className="absolute inset-x-0 top-10 flex items-center justify-between px-5 text-white/90">
              <X className="size-4" />
              <span className="flex items-center gap-1.5 font-mono text-xs tracking-widest">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-pax2-red" />
                {timer}
              </span>
              <Zap className="size-4" />
            </div>
            <div className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-3">
              <span className="flex size-[4.2rem] items-center justify-center rounded-full border-[3.5px] border-white/95">
                <span className="size-[3.3rem] rounded-full bg-pax2-red" />
              </span>
              <span className="flex items-center gap-4 text-[10px] font-semibold tracking-[0.18em] text-white/90">
                <span className="border-b-2 border-white pb-0.5">VIDEO</span>
                <span className="text-white/50">PHOTO</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <span aria-hidden className="absolute -inset-x-6 bottom-[-26px] h-10 rounded-[100%] bg-pax2-blue/20 blur-2xl" />
    </div>
  )
}
