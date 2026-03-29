"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { calculateDecayScore, getDaysUntilDeletion, getTimeUntilDeletion, DECAY_THRESHOLDS } from "@/lib/decay-utils"
import { PLAN_STORAGE_LIMITS, PLANS } from "@/lib/plans"
import type { File, User } from "@/lib/db/schema"

export type NotifSeverity = "critical" | "warning" | "info" | "success"

export interface Notification {
  id: string
  severity: NotifSeverity
  title: string
  body: string
  /** Optional action label + handler */
  action?: { label: string; onClick: () => void }
  /** Auto-dismiss after ms (undefined = stays until dismissed) */
  autoDismissMs?: number
  /** Timestamp for sorting */
  createdAt: number
  /** Whether it's been "seen" (panel opened) */
  read: boolean
}

const DISMISSED_KEY = "ds_dismissed_notifs"
const SESSION_KEY   = "ds_session_notifs"

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
function addDismissed(id: string) {
  try {
    const set = getDismissed()
    set.add(id)
    // [B8-N1] Keep the newest 200 entries. slice(-200) on a Set that just had
    // one item added would retain up to 201 entries before this fix — the cap
    // must be applied AFTER add(), so we convert, add, then slice to the limit.
    const arr = Array.from(set)
    const capped = arr.length > 200 ? arr.slice(arr.length - 200) : arr
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(capped))
  } catch { /* noop */ }
}

// Session-scoped ephemeral notifications (toasts) survive page navigation
// but not a hard refresh. We track them in sessionStorage.
function getSessionNotifs(): Notification[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function setSessionNotifs(notifs: Notification[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(notifs))
  } catch { /* noop */ }
}

export function useNotifications(
  files: File[],
  user: User | null,
  onRenewFile?: (fileId: string) => void,
  onNavigatePricing?: () => void,
) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const dismissedRef = useRef<Set<string>>(getDismissed())

  // ✅ Stable refs for callbacks — never stale, never cause re-renders
  const onRenewFileRef = useRef(onRenewFile)
  const onNavigatePricingRef = useRef(onNavigatePricing)
  useEffect(() => { onRenewFileRef.current = onRenewFile }, [onRenewFile])
  useEffect(() => { onNavigatePricingRef.current = onNavigatePricing }, [onNavigatePricing])

  const deriveFromData = useCallback(() => {
    if (!user) return []
    const dismissed = dismissedRef.current
    const derived: Notification[] = []

    for (const file of files) {
      const score = calculateDecayScore(
        new Date(file.lastAccessedAt),
        file.decayRateDays,
      )

      if (score >= DECAY_THRESHOLDS.CRITICAL) {
        const id = `decay-critical-${file.id}`
        if (!dismissed.has(id)) {
          derived.push({
            id, severity: "critical", title: "File expiring soon",
            body: `"${file.originalFilename}" deletes in ${getTimeUntilDeletion(new Date(file.lastAccessedAt), file.decayRateDays)}`,
            action: onRenewFileRef.current  // ✅ use ref
              ? { label: "Renew now", onClick: () => onRenewFileRef.current!(file.id) }
              : undefined,
            createdAt: Date.now(), read: false,
          })
        }
      } else if (score >= DECAY_THRESHOLDS.WARN) {
        const id = `decay-warn-${file.id}`
        if (!dismissed.has(id)) {
          derived.push({
            id, severity: "warning", title: "File decaying",
            body: `"${file.originalFilename}" — ${getDaysUntilDeletion(new Date(file.lastAccessedAt), file.decayRateDays)}d left before deletion`,
            action: onRenewFileRef.current  // ✅ use ref
              ? { label: "Renew", onClick: () => onRenewFileRef.current!(file.id) }
              : undefined,
            createdAt: Date.now(), read: false,
          })
        }
      }
    }

    // storage + file limit sections — replace onNavigatePricing with onNavigatePricingRef.current
    // (same pattern — just swap every onNavigatePricing reference)
    const storageLimit = PLAN_STORAGE_LIMITS[user.plan as keyof typeof PLAN_STORAGE_LIMITS]
    const storagePct   = storageLimit > 0 ? (user.storageUsedBytes / storageLimit) * 100 : 0

    if (storagePct >= 95) {
      const id = "storage-critical"
      if (!dismissed.has(id)) {
        derived.push({
          id, severity: "critical", title: "Storage almost full",
          body: `${storagePct.toFixed(0)}% used — uploads will fail when full`,
          action: onNavigatePricingRef.current  // ✅
            ? { label: "Upgrade", onClick: onNavigatePricingRef.current }
            : undefined,
          createdAt: Date.now(), read: false,
        })
      }
    } else if (storagePct >= 80) {
      const id = "storage-warning"
      if (!dismissed.has(id)) {
        derived.push({
          id, severity: "warning", title: "Storage running low",
          body: `${storagePct.toFixed(0)}% of your ${user.plan} storage used`,
          action: onNavigatePricingRef.current  // ✅
            ? { label: "Upgrade", onClick: onNavigatePricingRef.current }
            : undefined,
          createdAt: Date.now(), read: false,
        })
      }
    }

    const plan      = PLANS[user.plan as keyof typeof PLANS]
    const fileLimit = plan?.maxFiles ?? 10
    const filePct   = files.length / fileLimit

    if (filePct >= 0.95) {
      const id = "filelimit-critical"
      if (!dismissed.has(id)) {
        derived.push({
          id, severity: "critical", title: "File limit almost reached",
          body: `${files.length} / ${fileLimit} files used on ${plan?.name ?? user.plan} plan`,
          action: onNavigatePricingRef.current  // ✅
            ? { label: "Upgrade", onClick: onNavigatePricingRef.current }
            : undefined,
          createdAt: Date.now(), read: false,
        })
      }
    } else if (filePct >= 0.8) {
      const id = "filelimit-warning"
      if (!dismissed.has(id)) {
        derived.push({
          id, severity: "warning", title: "Approaching file limit",
          body: `${files.length} / ${fileLimit} files used`,
          createdAt: Date.now(), read: false,
        })
      }
    }

    return derived
  }, [files, user])  // ✅ callbacks removed from deps — they're stable via refs now

  // ─── Merge derived + session (toast) notifications ────────────
  useEffect(() => {
    const derived  = deriveFromData()
    const session  = getSessionNotifs().filter(
      (n) => !dismissedRef.current.has(n.id)
    )

    // Merge: prefer session entries by id if overlap
    const sessionIds = new Set(session.map((n) => n.id))
    const merged = [
      ...session,
      ...derived.filter((n) => !sessionIds.has(n.id)),
    ].sort((a, b) => {
      // Critical first, then by createdAt desc
      const sevOrder = { critical: 0, warning: 1, info: 2, success: 3 }
      const sevDiff  = sevOrder[a.severity] - sevOrder[b.severity]
      return sevDiff !== 0 ? sevDiff : b.createdAt - a.createdAt
    })

    setNotifications(merged)
  }, [deriveFromData])

  // ─── Public API ───────────────────────────────────────────────
  const dismiss = useCallback((id: string) => {
    addDismissed(id)
    dismissedRef.current.add(id)
    setSessionNotifs(getSessionNotifs().filter((n) => n.id !== id))
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => {
        addDismissed(n.id)
        dismissedRef.current.add(n.id)
      })
      setSessionNotifs([])
      return []
    })
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  /** Push a transient toast (upload done, rename success, etc.) */
  const pushToast = useCallback((
    notif: Omit<Notification, "createdAt" | "read">,
  ) => {
    const full: Notification = { ...notif, createdAt: Date.now(), read: false }

    // Persist to session so it survives soft navigations
    if (notif.severity !== "success" || !notif.autoDismissMs) {
      const existing = getSessionNotifs().filter((n) => n.id !== notif.id)
      setSessionNotifs([...existing, full])
    }

    setNotifications((prev) => {
      const without = prev.filter((n) => n.id !== notif.id)
      return [full, ...without].sort((a, b) => {
        const sevOrder = { critical: 0, warning: 1, info: 2, success: 3 }
        return sevOrder[a.severity] - sevOrder[b.severity] || b.createdAt - a.createdAt
      })
    })

    if (notif.autoDismissMs) {
      setTimeout(() => dismiss(notif.id), notif.autoDismissMs)
    }
  }, [dismiss])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, dismiss, dismissAll, markAllRead, pushToast }
}