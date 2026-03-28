import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"

function Code({ children }: { children: string }) {
  return (
    <pre
      className="rounded-xl p-4 overflow-x-auto text-xs leading-relaxed"
      style={{
        background:  "var(--bg-elevated)",
        border:      "1px solid var(--border)",
        color:       "var(--text)",
        fontFamily:  "DM Mono, monospace",
        whiteSpace:  "pre",
      }}
    >
      {children}
    </pre>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2
        className="text-xl font-bold mb-4"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Endpoint({
  method, path, description,
}: { method: string; path: string; description: string }) {
  const methodColors: Record<string, string> = {
    GET:    "#34d399",
    POST:   "#60a5fa",
    PATCH:  "#f97316",
    DELETE: "#ef4444",
  }
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-3"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      <span
        className="text-xs font-bold shrink-0 mt-0.5 w-14 text-center py-0.5 rounded"
        style={{
          background: `${methodColors[method]}15`,
          color:      methodColors[method],
          fontFamily: "DM Mono, monospace",
        }}
      >
        {method}
      </span>
      <div>
        <code className="text-sm" style={{ fontFamily: "DM Mono, monospace", color: "var(--text)" }}>
          {path}
        </code>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      <div className="max-w-3xl mx-auto px-6 pt-20 pb-28">
        {/* Header */}
        <div className="mb-14">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
          >
            Developer
          </p>
          <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: "Syne, sans-serif" }}>
            API Reference
          </h1>
          <p className="text-lg" style={{ color: "var(--text-muted)" }}>
            The DecayStore REST API lets you manage files programmatically.
            Available on the <strong style={{ color: "var(--text)" }}>Pro plan</strong>.
          </p>
        </div>

        {/* Authentication */}
        <Section title="Authentication">
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Generate an API key in your{" "}
            <a href="/dashboard" style={{ color: "var(--accent)" }}>dashboard</a>.
            Pass it as a Bearer token on every request. Keys begin with{" "}
            <code style={{ fontFamily: "DM Mono, monospace", color: "var(--text)" }}>dsk_</code>.
          </p>
          <Code>{`curl https://decaystore.com/api/files \\
  -H "Authorization: Bearer dsk_your_key_here"`}</Code>
          <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
            Keys are hashed (SHA-256) before storage. A lost key cannot be recovered — revoke it and create a new one.
          </p>
        </Section>

        {/* Base URL */}
        <Section title="Base URL">
          <Code>{`https://decaystore.com`}</Code>
          <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
            All endpoints return <code style={{ fontFamily: "DM Mono, monospace" }}>application/json</code>.
            Errors include an <code style={{ fontFamily: "DM Mono, monospace" }}>error</code> string.
          </p>
        </Section>

        {/* Endpoints */}
        <Section title="Endpoints">
          <Endpoint method="GET"    path="/api/files"                   description="List all your files" />
          <Endpoint method="POST"   path="/api/files"                   description="Initiate a file upload — returns a presigned R2 URL" />
          <Endpoint method="GET"    path="/api/files/:id"               description="Get a presigned download URL for a file" />
          <Endpoint method="PATCH"  path="/api/files/:id"               description="Renew a file (reset decay clock)" />
          <Endpoint method="DELETE" path="/api/files/:id"               description="Permanently delete a file" />
          <Endpoint method="PATCH"  path="/api/files/:id/decay-rate"    description="Update the decay rate for a file (Pro)" />
          <Endpoint method="GET"    path="/api/files/:id/versions"      description="List all versions of a file" />
          <Endpoint method="GET"    path="/api/folders"                 description="List all folders" />
          <Endpoint method="POST"   path="/api/folders"                 description="Create a folder" />
          <Endpoint method="DELETE" path="/api/folders/:id"             description="Delete a folder" />
          <Endpoint method="GET"    path="/api/keys"                    description="List your API keys" />
          <Endpoint method="POST"   path="/api/keys"                    description="Create a new API key" />
          <Endpoint method="DELETE" path="/api/keys?id=:id"             description="Revoke an API key" />
        </Section>

        {/* Examples */}
        <Section title="Examples">
          <h3 className="text-sm font-semibold mb-2">List files</h3>
          <Code>{`curl https://decaystore.com/api/files \\
  -H "Authorization: Bearer dsk_your_key_here"`}</Code>

          <h3 className="text-sm font-semibold mt-6 mb-2">Upload a file</h3>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            Step 1 — request a presigned upload URL:
          </p>
          <Code>{`curl -X POST https://decaystore.com/api/files \\
  -H "Authorization: Bearer dsk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename":      "report.pdf",
    "contentType":   "application/pdf",
    "sizeBytes":     204800,
    "decayRateDays": 30
  }'

# Response: { "uploadUrl": "https://…r2.cloudflarestorage.com/…", "file": { … } }`}</Code>

          <p className="text-xs mt-4 mb-2" style={{ color: "var(--text-muted)" }}>
            Step 2 — PUT the file directly to R2 using the presigned URL:
          </p>
          <Code>{`curl -X PUT "<uploadUrl from step 1>" \\
  -H "Content-Type: application/pdf" \\
  --data-binary @report.pdf`}</Code>

          <h3 className="text-sm font-semibold mt-6 mb-2">Renew a file</h3>
          <Code>{`curl -X PATCH https://decaystore.com/api/files/<file-id> \\
  -H "Authorization: Bearer dsk_your_key_here"`}</Code>

          <h3 className="text-sm font-semibold mt-6 mb-2">Set a custom decay rate (Pro)</h3>
          <Code>{`curl -X PATCH https://decaystore.com/api/files/<file-id>/decay-rate \\
  -H "Authorization: Bearer dsk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "decayRateDays": 7 }'

# Allowed values: 7, 14, 30, 60, 90, 180, 365`}</Code>

          <h3 className="text-sm font-semibold mt-6 mb-2">Delete a file</h3>
          <Code>{`curl -X DELETE https://decaystore.com/api/files/<file-id> \\
  -H "Authorization: Bearer dsk_your_key_here"`}</Code>
        </Section>

        {/* Rate limits */}
        <Section title="Rate limits">
          <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Upload initiation is limited to <strong style={{ color: "var(--text)" }}>20 requests per minute</strong>{" "}
            per API key. Other endpoints are limited to{" "}
            <strong style={{ color: "var(--text)" }}>120 requests per minute</strong>. Exceeded requests
            return <code style={{ fontFamily: "DM Mono, monospace" }}>429 Too Many Requests</code> with
            a <code style={{ fontFamily: "DM Mono, monospace" }}>Retry-After</code> header.
          </p>
        </Section>

        {/* Errors */}
        <Section title="Error codes">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            {[
              ["400", "Bad Request",        "Invalid request body or parameters"],
              ["401", "Unauthorized",       "Missing or invalid API key"],
              ["402", "Payment Required",   "Storage or file limit exceeded"],
              ["403", "Forbidden",          "Feature not available on your plan"],
              ["404", "Not Found",          "File, folder, or resource not found"],
              ["409", "Conflict",           "A file with that name already exists"],
              ["410", "Gone",               "File has been deleted"],
              ["415", "Unsupported Media",  "File type not permitted"],
              ["429", "Too Many Requests",  "Rate limit exceeded"],
              ["500", "Server Error",       "Internal error — try again"],
            ].map(([code, name, desc], i) => (
              <div
                key={code}
                className="flex items-center gap-4 px-4 py-3 text-xs"
                style={{
                  background:  i % 2 === 0 ? "var(--bg-elevated)" : "transparent",
                  borderTop:   i === 0 ? "none" : "1px solid var(--border-subtle)",
                }}
              >
                <code
                  className="w-10 shrink-0 font-bold"
                  style={{ fontFamily: "DM Mono, monospace", color: parseInt(code) >= 500 ? "#ef4444" : parseInt(code) >= 400 ? "#f97316" : "var(--text)" }}
                >
                  {code}
                </code>
                <span className="w-36 shrink-0" style={{ color: "var(--text)" }}>{name}</span>
                <span style={{ color: "var(--text-muted)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Footer />
    </div>
  )
}