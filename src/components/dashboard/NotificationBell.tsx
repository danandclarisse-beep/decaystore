"use client"

import { useState, useRef, useEffect } from "react"
import { BellIcon } from "lucide-react"
import { NotificationPanel } from "./NotificationPanel"
import type { Notification } from "@/hooks/useNotifications"

interface Props {
  notifications: Notification[]
  unreadCount: number
  onDismiss: (id: string) => void
  onDismissAll: () => void
  onMarkAllRead: () => void
  /** "header" = inline in header, "float" = fixed bottom-right FAB */
  variant?: "header" | "float"
}

export function NotificationBell({
  notifications,
  unreadCount,
  onDismiss,
  onDismissAll,
  onMarkAllRead,
  variant = "header",
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef    = useRef<HTMLDivElement>(null)

  const hasCritical = notifications.some((n) => n.severity === "critical" && !n.read)

  // Update document title
  useEffect(() => {
    const base = "DecayStore — Dashboard"
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base
  }, [unreadCount])

  if (variant === "float") {
    return (
      <div
        ref={containerRef}
        className="fixed bottom-6 right-6 z-50 lg:hidden"
        style={{ isolation: "isolate" }}
      >
        {/* FAB button */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          className="relative flex items-center justify-center rounded-full shadow-xl transition-transform active:scale-95"
          style={{
            width: 52,
            height: 52,
            background: hasCritical ? "#ef4444" : open ? "var(--accent)" : "var(--bg-elevated)",
            border: `1px solid ${hasCritical ? "rgba(239,68,68,0.5)" : open ? "var(--accent)" : "var(--border)"}`,
            boxShadow: hasCritical
              ? "0 0 24px rgba(239,68,68,0.4)"
              : open
              ? "0 0 24px rgba(245,166,35,0.3)"
              : "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <BellIcon
            className={`w-5 h-5 ${hasCritical && !open ? "animate-[wiggle_0.6s_ease-in-out_infinite]" : ""}`}
            style={{ color: hasCritical || open ? (hasCritical ? "#fff" : "#000") : "var(--text)" }}
          />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full"
              style={{
                background: hasCritical ? "#fff" : "var(--accent)",
                color: hasCritical ? "#ef4444" : "#000",
                fontFamily: "DM Mono, monospace",
                padding: "0 4px",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Panel — anchored to bottom-right */}
        {open && (
          <div className="absolute bottom-14 right-0">
            <NotificationPanel
              notifications={notifications}
              onDismiss={onDismiss}
              onDismissAll={onDismissAll}
              onMarkAllRead={onMarkAllRead}
              onClose={() => setOpen(false)}
            />
          </div>
        )}
      </div>
    )
  }

  // Header variant — inline relative positioning
  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
        style={{
          background: open ? "var(--bg-hover)" : "transparent",
          border: `1px solid ${open ? "var(--border)" : "transparent"}`,
          color: "var(--text-muted)",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--bg-hover)" }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent" }}
      >
        <BellIcon
          className={`w-4 h-4 ${hasCritical && !open ? "animate-[wiggle_0.6s_ease-in-out_infinite]" : ""}`}
          style={{ color: hasCritical ? "#ef4444" : open ? "var(--text)" : "var(--text-muted)" }}
        />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold rounded-full"
            style={{
              background: hasCritical ? "#ef4444" : "var(--accent)",
              color: hasCritical ? "#fff" : "#000",
              fontFamily: "DM Mono, monospace",
              padding: "0 3px",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          onDismissAll={onDismissAll}
          onMarkAllRead={onMarkAllRead}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
