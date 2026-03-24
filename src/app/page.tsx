import Link from "next/link"
import { SignedIn, SignedOut } from "@clerk/nextjs"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="font-semibold text-lg tracking-tight">DecayStore</span>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Pricing
          </Link>
          <SignedOut>
            <Link
              href="/auth/sign-in"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Get started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Dashboard
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-xs font-medium px-3 py-1.5 rounded-full mb-8 border border-orange-100">
          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
          Files that forget themselves
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
          Storage with a{" "}
          <span className="relative">
            <span className="text-gray-900">memory.</span>
            <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-orange-400 rounded" />
          </span>
        </h1>

        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Files you ignore slowly decay and delete themselves. Files you care about, you renew.
          No more digital hoarding. No more forgotten clutter.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth/sign-up"
            className="bg-gray-900 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Start for free
          </Link>
          <Link
            href="/pricing"
            className="border border-gray-200 text-gray-700 px-6 py-3 rounded-lg text-sm font-medium hover:border-gray-300 transition-colors"
          >
            See pricing →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-gray-100">
        <h2 className="text-2xl font-semibold text-center mb-16 text-gray-900">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            {
              step: "01",
              title: "Upload your files",
              body: "Drop any file. It starts fresh with a full decay clock — no urgency yet.",
            },
            {
              step: "02",
              title: "Decay starts ticking",
              body: "Every day you don't access a file, its decay score rises. You get email warnings before it's gone.",
            },
            {
              step: "03",
              title: "Renew or lose it",
              body: "Open a file to reset its clock. Ignore it until it's gone. Your call.",
            },
          ].map((item) => (
            <div key={item.step}>
              <p className="text-xs font-mono text-gray-400 mb-3">{item.step}</p>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Decay visualizer */}
      <section className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
          <p className="text-xs text-gray-400 font-mono mb-6">decay preview</p>
          <div className="space-y-4">
            {[
              { name: "project-brief.pdf", score: 0.05, label: "Fresh", days: 28 },
              { name: "old-mockups.fig", score: 0.52, label: "Aging", days: 14 },
              { name: "draft-v1.docx", score: 0.78, label: "Critical", days: 6 },
              { name: "2021-receipts.zip", score: 0.95, label: "Expiring", days: 1 },
            ].map((file) => {
              const color =
                file.score < 0.25
                  ? "#22c55e"
                  : file.score < 0.5
                  ? "#84cc16"
                  : file.score < 0.75
                  ? "#eab308"
                  : file.score < 0.9
                  ? "#f97316"
                  : "#ef4444"
              return (
                <div key={file.name} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <span className="text-xs text-gray-400 ml-4 shrink-0">
                        {file.days}d left
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${file.score * 100}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium shrink-0 w-16 text-right"
                    style={{ color }}
                  >
                    {file.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-medium text-gray-900">DecayStore</span>
          <p className="text-sm text-gray-400">Storage with a memory. Built with Next.js.</p>
        </div>
      </footer>
    </main>
  )
}
