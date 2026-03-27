"use client"

import { useEffect, useRef } from "react"
import {
  BellIcon, XIcon, CheckCheckIcon,
  AlertTriangleIcon, AlertCircleIcon, InfoIcon, CheckCircleIcon,
} from "lucide-react"
import type { Notification, NotifSeverity } from "@/hooks/useNotifications"

interface Props {
  notifications: Notification[]
  onDismiss: (id: string) => void
  onDismissAll: () => void
  onMarkAllRead: () => void
  onClose: () => void
  mobileSheet?: boolean
}

const SEVERITY_ICON: Record<NotifSeverity, React.ReactNode> = {
  critical: <AlertCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />,
  warning:  <AlertTriangleIcon className="w-4 h-4 shrink-0" style={{ color: "#f97316" }} />,
  info:     <InfoIcon className="w-4 h-4 shrink-0" style={{ color: "#60a5fa" }} />,
  success:  <CheckCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} />,
}

const SEVERITY_BORDER: Record<NotifSeverity, string> = {
  critical: "rgba(239,68,68,0.25)",
  warning:  "rgba(249,115,22,0.25)",
  info:     "rgba(96,165,250,0.2)",
  success:  "rgba(52,211,153,0.2)",
}

const SEVERITY_BG: Record<NotifSeverity, string> = {
  critical: "rgba(239,68,68,0.06)",
  warning:  "rgba(249,115,22,0.06)",
  info:     "rgba(96,165,250,0.05)",
  success:  "rgba(52,211,153,0.05)",
}

export function NotificationPanel({
  notifications,
  onDismiss,
  onDismissAll,
  onMarkAllRead,
  onClose,
  mobileSheet = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click (desktop dropdown only)
  useEffect(() => {
    if (mobileSheet) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [onClose, mobileSheet])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [onClose])

  // Mark all read when panel opens
  useEffect(() => {
    onMarkAllRead()
  }, [onMarkAllRead])

  return (
    <div
      ref={panelRef}
      className={mobileSheet ? "w-full flex flex-col" : "absolute right-0 mt-2 z-[110] flex flex-col"}
      style={{
        width: mobileSheet ? "100%" : "min(360px, calc(100vw - 2rem))",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: mobileSheet ? "1.25rem 1.25rem 0 0" : "var(--radius-lg)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
        maxHeight: mobileSheet ? "80vh" : "min(480px, 80vh)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <BellIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>
            Notifications
          </span>
          {notifications.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--accent-dim)",
                color: "var(--accent)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              {notifications.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              onClick={onDismissAll}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              title="Clear all"
            >
              <CheckCheckIcon className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="action-btn p-1.5 rounded-lg"
            aria-label="Close notifications"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: "var(--bg-hover)" }}
            >
              <BellIcon className="w-5 h-5" style={{ color: "var(--text-dim)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>All clear</p>
            <p className="text-xs mt-1 text-center" style={{ color: "var(--text-dim)" }}>
              No notifications right now. Files and storage look healthy.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="rounded-xl p-3 flex items-start gap-3 group"
                style={{
                  background: SEVERITY_BG[notif.severity],
                  border: `1px solid ${SEVERITY_BORDER[notif.severity]}`,
                  transition: "opacity 0.15s",
                }}
              >
                <div className="mt-0.5">{SEVERITY_ICON[notif.severity]}</div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold leading-tight"
                    style={{ color: "var(--text)" }}
                  >
                    {notif.title}
                  </p>
                  <p
                    className="text-xs mt-0.5 leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {notif.body}
                  </p>
                  {notif.action && (
                    <button
                      onClick={() => {
                        notif.action!.onClick()
                        onDismiss(notif.id)
                        onClose()
                      }}
                      className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg transition-opacity"
                      style={{
                        background: notif.severity === "critical" ? "rgba(239,68,68,0.15)" : "var(--accent-dim)",
                        color: notif.severity === "critical" ? "#ef4444" : "var(--accent)",
                        border: `1px solid ${notif.severity === "critical" ? "rgba(239,68,68,0.3)" : "rgba(245,166,35,0.3)"}`,
                      }}
                    >
                      {notif.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onDismiss(notif.id)}
                  className="action-btn p-1 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Dismiss"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}