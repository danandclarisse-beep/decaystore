"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"

interface Props {
  /** 1–2 sentence explanation shown in the tooltip */
  content: string
  /** Optional anchor on /guide to link to for "Learn more →" */
  guideAnchor?: string
  /** Preferred tooltip position relative to the trigger icon */
  position?: "top" | "bottom" | "left" | "right"
}

const TOOLTIP_WIDTH  = 220
const TOOLTIP_OFFSET = 8   // gap between trigger and tooltip edge
const SCREEN_MARGIN  = 8   // min distance from viewport edge

export function HelpTooltip({ content, guideAnchor, position = "top" }: Props) {
  const [open, setOpen]       = useState(false)
  const [coords, setCoords]   = useState<{ top: number; left: number } | null>(null)
  const triggerRef            = useRef<HTMLButtonElement>(null)
  const tooltipRef            = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Compute fixed coordinates from trigger's bounding rect
  const computeCoords = useCallback(() => {
    if (!triggerRef.current) return
    const r   = triggerRef.current.getBoundingClientRect()
    const vw  = window.innerWidth
    const vh  = window.innerHeight
    const estH = 80 // estimated tooltip height before actual render

    let top  = 0
    let left = 0

    if (position === "top" || position === "bottom") {
      left = r.left + r.width / 2 - TOOLTIP_WIDTH / 2
      left = Math.max(SCREEN_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - SCREEN_MARGIN))

      if (position === "top") {
        top = r.top - TOOLTIP_OFFSET - estH
        if (top < SCREEN_MARGIN) top = r.bottom + TOOLTIP_OFFSET
      } else {
        top = r.bottom + TOOLTIP_OFFSET
        if (top + estH > vh - SCREEN_MARGIN) top = r.top - TOOLTIP_OFFSET - estH
      }
    } else {
      top = r.top + r.height / 2 - estH / 2
      top = Math.max(SCREEN_MARGIN, Math.min(top, vh - estH - SCREEN_MARGIN))

      if (position === "left") {
        left = r.left - TOOLTIP_OFFSET - TOOLTIP_WIDTH
        if (left < SCREEN_MARGIN) left = r.right + TOOLTIP_OFFSET
      } else {
        left = r.right + TOOLTIP_OFFSET
        if (left + TOOLTIP_WIDTH > vw - SCREEN_MARGIN) left = r.left - TOOLTIP_OFFSET - TOOLTIP_WIDTH
      }
    }

    setCoords({ top, left })
  }, [position])

  function handleOpen() {
    computeCoords()
    setOpen(true)
  }

  // Recompute on scroll/resize while open
  useEffect(() => {
    if (!open) return
    window.addEventListener("scroll", computeCoords, true)
    window.addEventListener("resize", computeCoords)
    return () => {
      window.removeEventListener("scroll", computeCoords, true)
      window.removeEventListener("resize", computeCoords)
    }
  }, [open, computeCoords])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (tooltipRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const tooltip = open && coords && (
    <div
      ref={tooltipRef}
      role="tooltip"
      className="animate-fade-in"
      style={{
        position:     "fixed",
        top:          coords.top,
        left:         coords.left,
        width:        TOOLTIP_WIDTH,
        zIndex:       9999,
        background:   "var(--bg-elevated)",
        border:       "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow:    "var(--shadow-card)",
        padding:      "10px 12px",
        pointerEvents: "auto",
      }}
    >
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {content}
      </p>
      {guideAnchor && (
        <Link
          href={`/guide#${guideAnchor}`}
          className="text-xs mt-2 inline-block"
          style={{ color: "var(--accent)" }}
          onClick={() => setOpen(false)}
        >
          Learn more →
        </Link>
      )}
    </div>
  )

  return (
    <div className="relative inline-flex items-center" style={{ verticalAlign: "middle" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label="Help"
        aria-expanded={open}
        className="flex items-center justify-center rounded-full transition-colors"
        style={{
          width:      16,
          height:     16,
          fontSize:   9,
          fontWeight: 600,
          fontFamily: "DM Mono, monospace",
          background: open ? "var(--accent-dim)" : "var(--bg-hover)",
          border:     open ? "1px solid rgba(245,166,35,0.3)" : "1px solid var(--border)",
          color:      open ? "var(--accent)" : "var(--text-dim)",
          cursor:     "pointer",
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {/* Portal — escapes all parent overflow:hidden constraints */}
      {mounted && createPortal(tooltip, document.body)}
    </div>
  )
}