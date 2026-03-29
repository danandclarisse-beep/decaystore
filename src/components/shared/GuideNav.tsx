"use client"

import { useState, useEffect } from "react"

const SECTIONS = [
  { id: "getting-started", label: "Getting started",       sub: [] },
  { id: "organising",      label: "Organising your files", sub: [] },
  { id: "starter",         label: "Starter features",      sub: [] },
  { id: "pro",             label: "Pro features",          sub: [] },
]

export function GuideNav() {
  const [active, setActive] = useState("getting-started")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <nav className="sticky top-24 hidden lg:block" style={{ width: 200 }}>
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-4"
        style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
      >
        Contents
      </p>
      <ul className="space-y-1">
        {SECTIONS.map(({ id, label }) => {
          const isActive = active === id
          return (
            <li key={id}>
              <button
                onClick={() => scrollTo(id)}
                className="w-full text-left text-sm px-3 py-1.5 rounded-lg transition-all"
                style={{
                  color:      isActive ? "var(--accent)"     : "var(--text-muted)",
                  background: isActive ? "var(--accent-dim)" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  border:     isActive ? "1px solid rgba(245,166,35,0.2)" : "1px solid transparent",
                }}
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>Need help?</p>
        <a
          href="mailto:support@decaystore.com"
          className="text-xs"
          style={{ color: "var(--accent)" }}
        >
          Contact support →
        </a>
      </div>
    </nav>
  )
}
