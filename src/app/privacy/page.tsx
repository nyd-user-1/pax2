// The privacy policy the Google Auth Platform's Branding page links to (production mode requires
// one). Every claim here must stay true of the running system; update this page when data handling
// changes, not after.

export const metadata = { title: "Privacy" }

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Privacy</h1>
        <p className="mt-1 text-sm text-slate-500">As of October 19, 2026</p>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-slate-900">What PAX2 keeps</h2>
        <p className="text-slate-700">
          An account is a name and an email address. A recording is the video a volunteer submits, the script and draft behind it, the style it was made
          with, and the scores and findings the system attaches to it. All of it lives in the project&apos;s own Amazon Web Services account.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-slate-900">The connected YouTube channel</h2>
        <p className="text-slate-700">
          Publishing runs on Google&apos;s YouTube Data API with a one-time authorization from the channel&apos;s owner. The grant is stored server-side and
          used for two things only: uploading approved videos to that channel and reading those videos&apos; captions and performance. PAX2 reads nothing
          else from the Google account, and the owner can revoke the grant at any time at{" "}
          <a href="https://myaccount.google.com/permissions" className="text-pax2-light-blue underline underline-offset-2">
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-slate-900">Outside services</h2>
        <p className="text-slate-700">
          A script&apos;s narration is synthesized by Amazon Polly or ElevenLabs, which receive the script&apos;s text and nothing else. An address typed
          into the chat goes to Google&apos;s Places service to be located and is used to look up the district it sits in and how that district&apos;s last
          race went. Questions asked in the chat are answered by a model running on Amazon Bedrock.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-slate-900">What PAX2 does not do</h2>
        <p className="text-slate-700">PAX2 does not sell personal information and does not share it beyond the services named above.</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-slate-900">Questions</h2>
        <p className="text-slate-700">
          Write to{" "}
          <a href="mailto:brendan@nysgpt.com" className="text-pax2-light-blue underline underline-offset-2">
            brendan@nysgpt.com
          </a>
          .
        </p>
      </section>
    </div>
  )
}
