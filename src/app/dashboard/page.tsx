// ROUTE: /dashboard
// FILE:  src/app/dashboard/page.tsx

"use client"

import { useEffect, useState, useCallback, useRef, Suspense } from "react"
import { useRouter } from "next/navigation"
import { FileUploader } from "@/components/dashboard/FileUploader"
import { FileGrid } from "@/components/dashboard/FileGrid"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { FolderSidebar } from "@/components/dashboard/FolderSidebar"
import { NotificationBell } from "@/components/dashboard/NotificationBell"
import { UpgradeBanner } from "@/components/dashboard/UpgradeBanner"
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner"
import { ActivityPanel } from "@/components/dashboard/ActivityPanel"
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel"
import { ApiKeysPanel } from "@/components/dashboard/ApiKeysPanel"
import { TrialBanner } from "@/components/dashboard/TrialBanner"
import { TrialExpiredBanner } from "@/components/dashboard/TrialExpiredBanner"
import { TrialRedirectOverlay } from "@/components/dashboard/TrialRedirectOverlay"
import { SubscriptionSuccessModal } from "@/components/dashboard/SubscriptionSuccessModal"
import { useNotifications } from "@/hooks/useNotifications"
import { PLAN_STORAGE_LIMITS, PLANS } from "@/lib/plans"
import {
  ChevronRightIcon, HomeIcon, ArrowLeftIcon,
  AlertTriangleIcon, RefreshCwIcon, HistoryIcon, BarChart2Icon, KeyIcon,
  KeyboardIcon, XIcon, UploadCloudIcon, ListIcon, LayoutGridIcon, ImageIcon,
} from "lucide-react"
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary"
import type { File, User, Folder } from "@/lib/db/schema"

export default function DashboardPageWrapper() {
  return (
    <Suspense>
      <DashboardPage />
    </Suspense>
  )
}

function DashboardPage() {
  const [files, setFiles]           = useState<File[]>([])
  const [folders, setFolders]       = useState<Folder[]>([])
  const [user, setUser]             = useState<User | null>(null)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [trialRedirecting, setTrialRedirecting] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Folder[]>([])
  // [P8-1] Activity panel open/close
  const [activityOpen, setActivityOpen] = useState(false)
  // [P9-3] Analytics panel open/close (Pro)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  // [P11] API Keys panel open/close (Pro)
  const [apiKeysOpen, setApiKeysOpen] = useState(false)
  // [P12-4] Keyboard shortcut modal
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false)

  // [P12-4] Refs for keyboard-focus targets
  const uploadTriggerRef = useRef<(() => void) | null>(null)
  const searchInputRef   = useRef<HTMLInputElement | null>(null)
  const newFolderBtnRef  = useRef<HTMLButtonElement | null>(null)

  // [P17-8] List vs grid view toggle — persisted to localStorage
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"grid" | "list" | "preview">("grid")

  useEffect(() => {
    const saved = localStorage.getItem("ds-view-mode") as "grid" | "list" | "preview" | null
    if (saved) setViewMode(saved)
  }, [])
  function toggleViewMode() {
    setViewMode((v) => {
      const next = v === "grid" ? "list" : v === "list" ? "preview" : "grid"
      localStorage.setItem("ds-view-mode", next)
      return next
    })
  }

  // ─── Renew file handler (called from notification actions) ─────
  const renewFileRef    = useRef<((fileId: string) => Promise<void>) | null>(null)
  const previewFileRef  = useRef<((file: File) => void) | null>(null)
  const downloadFileRef = useRef<((fileId: string, filename: string) => void) | null>(null)

  const handleRenewFile    = useCallback(async (fileId: string) => {
    if (renewFileRef.current) await renewFileRef.current(fileId)
  }, [])
  const handlePreviewFile  = useCallback((file: File) => {
    if (previewFileRef.current) previewFileRef.current(file)
  }, [])
  const handleDownloadFile = useCallback((fileId: string, filename: string) => {
    if (downloadFileRef.current) downloadFileRef.current(fileId, filename)
  }, [])

  // ─── Notifications ─────────────────────────────────────────────
  const {
    notifications,
    unreadCount,
    dismiss: dismissNotif,
    dismissAll: dismissAllNotifs,
    markAllRead,
    pushToast,
  } = useNotifications(
    files,
    user,
    handleRenewFile,
    () => router.push("/pricing"),
  )

  // ─── Data fetch ────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setFetchError(null)
    try {
      const [filesRes, foldersRes] = await Promise.all([
        fetch("/api/files"),
        fetch("/api/folders"),
      ])
      if (!filesRes.ok || !foldersRes.ok) {
        throw new Error(`Server error (${filesRes.status})`)
      }
      const filesData   = await filesRes.json()
      const foldersData = await foldersRes.json()
      setFiles(filesData.files ?? [])
      setUser(filesData.user ?? null)
      setFolders(foldersData.folders ?? [])
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // [P19] Trial intent redirect — runs once on mount, after account creation.
  // Shows TrialRedirectOverlay so users see a guided transition instead of a
  // blank flash before being sent to LemonSqueezy checkout.
  useEffect(() => {
    try {
      const intent = sessionStorage.getItem("ds_signup_intent")
      if (intent === "trial") {
        sessionStorage.removeItem("ds_signup_intent")
        setTrialRedirecting(true)
        fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: "trial" }),
        })
          .then((res) => res.json())
          .then((data) => { if (data.url) window.location.href = data.url })
          .catch((err) => {
            console.error(err)
            setTrialRedirecting(false)
          })
      }
    } catch {}
  }, [])

  // [P12-4] Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable

      if (e.key === "Escape") {
        setActivityOpen(false)
        setAnalyticsOpen(false)
        setApiKeysOpen(false)
        setShortcutModalOpen(false)
        return
      }

      if (isEditable) return

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault()
        setShortcutModalOpen((o) => !o)
        return
      }

      if (e.key === "u" || e.key === "U") {
        e.preventDefault()
        uploadTriggerRef.current?.()
        return
      }

      if (e.key === "/") {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        newFolderBtnRef.current?.click()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // ─── Folder navigation ─────────────────────────────────────────
  function openFolder(folder: Folder) {
    setCurrentFolderId(folder.id)
    setFolderPath((prev) => {
      const existing = prev.findIndex((f) => f.id === folder.id)
      if (existing !== -1) return prev.slice(0, existing + 1)
      return [...prev, folder]
    })
  }

  function navigateTo(index: number) {
    if (index === -1) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      const target = folderPath[index]
      setCurrentFolderId(target.id)
      setFolderPath(folderPath.slice(0, index + 1))
    }
  }

  function handleSidebarNavigate(folderId: string | null) {
    if (folderId === null) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      const folder = folders.find((f) => f.id === folderId)
      if (folder) {
        const existing = folderPath.findIndex((f) => f.id === folderId)
        if (existing !== -1) {
          setCurrentFolderId(folderId)
          setFolderPath(folderPath.slice(0, existing + 1))
        } else {
          setCurrentFolderId(folderId)
          setFolderPath([folder])
        }
      }
    }
  }

  // [P18] Upgrade handler — routes to pricing page
  function handleUpgrade() {
    router.push("/pricing")
  }

  const storageLimit   = user ? PLAN_STORAGE_LIMITS[user.plan as keyof typeof PLAN_STORAGE_LIMITS] : PLAN_STORAGE_LIMITS.free
  const storageUsed    = user?.storageUsedBytes ?? 0
  const fileLimit      = user ? (PLANS[user.plan as keyof typeof PLANS]?.maxFiles ?? 10) : 10
  const visibleFiles   = files.filter((f) => (f.folderId ?? null) === currentFolderId)
  const visibleFolders = folders.filter((f) => (f.parentId ?? null) === currentFolderId)
  // [P8-3] Current folder object — used to pass defaultDecayRateDays to FileUploader
  const currentFolder  = currentFolderId ? folders.find((f) => f.id === currentFolderId) ?? null : null

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* [P19] Full-screen overlay shown while redirecting new trial users to checkout */}
      <TrialRedirectOverlay visible={trialRedirecting} />

      {/* [P19] Congratulations modal shown once on return from successful checkout */}
      <SubscriptionSuccessModal user={user} />
      <DashboardHeader
        user={user}
        notifications={notifications}
        unreadCount={unreadCount}
        onDismissNotif={dismissNotif}
        onDismissAllNotifs={dismissAllNotifs}
        onMarkAllRead={markAllRead}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex gap-4 sm:gap-6">
        {/* Sidebar — hidden on mobile (drawer handled inside FolderSidebar) */}
        <FolderSidebar
          folders={folders}
          currentFolderId={currentFolderId}
          onNavigate={handleSidebarNavigate}
          onRefresh={fetchAll}
          plan={user?.plan ?? "free"}
          newFolderBtnRef={newFolderBtnRef}
          storageUsed={storageUsed}
          storageLimit={storageLimit}
          fileCount={files.length}
          fileLimit={fileLimit}
          storageLoading={loading}
        />

        {/* Main content + side panels */}
        <div className="flex-1 min-w-0 flex gap-4 sm:gap-6">
        <main className="flex-1 min-w-0 space-y-3 sm:space-y-4 pb-24 lg:pb-0">

          {/* [P6-1] Post-upgrade confirmation */}
          <UpgradeBanner user={user} />

          {/* [P18] Trial banners — shown for trial and trial_expired plans */}
          {user && <TrialBanner user={user} onUpgrade={handleUpgrade} />}
          {user && <TrialExpiredBanner user={user} onUpgrade={handleUpgrade} />}

          {/* [P6-2] First-use onboarding */}
          {!loading && files.length === 0 && <OnboardingBanner />}

          {/* [P17-4] Invisible FileUploader — full-page drop target + progress toasts */}
          <FileUploader
            onUploadComplete={() => {
              fetchAll()
            }}
            plan={user?.plan ?? "free"}
            currentFolderId={currentFolderId}
            currentFolder={currentFolder}
            uploadTriggerRef={uploadTriggerRef}
          />

          {/* ── Toolbar: breadcrumb + upload + decay picker + view toggle + panel toggles ── */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
              {currentFolderId && (
                <button
                  onClick={() => navigateTo(folderPath.length - 2)}
                  className="lg:hidden flex items-center gap-1 text-xs px-2 py-1 rounded-lg mr-1"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
                </button>
              )}
              <button
                onClick={() => navigateTo(-1)}
                className="flex items-center gap-1.5 transition-colors font-medium shrink-0"
                style={{ color: currentFolderId ? "var(--text-muted)" : "var(--text)" }}
              >
                <HomeIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">My Files</span>
              </button>
              {folderPath.map((folder, i) => (
                <span key={folder.id} className="flex items-center gap-1.5 min-w-0">
                  <ChevronRightIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-dim)" }} />
                  <button
                    onClick={() => navigateTo(i)}
                    className="transition-colors font-medium truncate max-w-[100px] sm:max-w-[180px]"
                    style={{ color: i === folderPath.length - 1 ? "var(--text)" : "var(--text-muted)" }}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </nav>

            {/* [P17-5] Upload button — primary action */}
            <button
              onClick={() => uploadTriggerRef.current?.()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              <UploadCloudIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* Divider */}
            <div className="w-px h-5 shrink-0" style={{ background: "var(--border)" }} />

            {/* View toggle — cycles grid → list → preview */}
            <button
              onClick={toggleViewMode}
              className="p-1.5 rounded-lg transition-colors"
              style={{
                background: viewMode === "preview" ? "var(--accent-dim)" : "var(--bg-card)",
                border: `1px solid ${viewMode === "preview" ? "var(--accent)" : "var(--border)"}`,
                color: viewMode === "preview" ? "var(--accent)" : "var(--text-muted)",
              }}
              title={viewMode === "grid" ? "Switch to list view" : viewMode === "list" ? "Switch to preview mode" : "Switch to grid view"}
              aria-label={viewMode === "grid" ? "List view" : viewMode === "list" ? "Preview mode" : "Grid view"}
            >
              {viewMode === "grid"
                ? <ListIcon className="w-3.5 h-3.5" />
                : viewMode === "list"
                ? <ImageIcon className="w-3.5 h-3.5" />
                : <LayoutGridIcon className="w-3.5 h-3.5" />}
            </button>

            {/* [P8-1] Activity toggle — Starter + Pro */}
            {(user?.plan === "starter" || user?.plan === "pro") && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setActivityOpen((o) => !o); setAnalyticsOpen(false) }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg shrink-0 transition-colors"
                  style={{
                    background: activityOpen ? "var(--accent-dim)" : "var(--bg-card)",
                    border: `1px solid ${activityOpen ? "var(--accent)" : "var(--border)"}`,
                    color: activityOpen ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Activity</span>
                </button>
              </div>
            )}

            {/* [P9-3] Analytics toggle — Pro */}
            {user?.plan === "pro" && (
              <button
                onClick={() => { setAnalyticsOpen((o) => !o); setActivityOpen(false) }}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg shrink-0 transition-colors"
                style={{
                  background: analyticsOpen ? "var(--accent-dim)" : "var(--bg-card)",
                  border: `1px solid ${analyticsOpen ? "var(--accent)" : "var(--border)"}`,
                  color: analyticsOpen ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <BarChart2Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
            )}

            {/* [P11] API Keys toggle — Pro */}
            {user?.plan === "pro" && (
              <button
                onClick={() => setApiKeysOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg shrink-0 transition-colors"
                style={{
                  background: apiKeysOpen ? "var(--accent-dim)" : "var(--bg-card)",
                  border: `1px solid ${apiKeysOpen ? "var(--accent)" : "var(--border)"}`,
                  color: apiKeysOpen ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <KeyIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">API Keys</span>
              </button>
            )}
          </div>

          {/* Fetch error */}
          {fetchError && !loading && (
            <div
              className="rounded-xl p-4 sm:p-5 flex items-center gap-4"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <AlertTriangleIcon className="w-5 h-5 shrink-0" style={{ color: "#ef4444" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "#ef4444" }}>Failed to load your files</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{fetchError}</p>
              </div>
              <button
                onClick={fetchAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg shrink-0"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                <RefreshCwIcon className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* File grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl animate-pulse"
                  style={{ height: "160px", background: "var(--bg-card)", border: "1px solid var(--border)", animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          ) : (
            <FileGrid
              files={visibleFiles}
              folders={visibleFolders}
              allFolders={folders}
              currentFolderId={currentFolderId}
              userPlan={(user?.plan === "trial" || user?.plan === "trial_expired" ? "pro" : user?.plan) ?? "free"}
              onRefresh={fetchAll}
              onOpenFolder={openFolder}
              onRenewedToast={(filename) =>
                pushToast({
                  id: `renewed-${filename}-${Date.now()}`,
                  severity: "success",
                  title: "File renewed",
                  body: `"${filename}" — decay reset to 0%.`,
                  autoDismissMs: 3500,
                })
              }
              renewFileRef={renewFileRef}
              previewFileRef={previewFileRef}
              downloadFileRef={downloadFileRef}
              searchInputRef={searchInputRef}
              onTriggerUpload={() => uploadTriggerRef.current?.()}
              viewMode={viewMode as "grid" | "list" | "preview"}
            />
          )}

        </main>
        </div>
      </div>

      {/* [P18] Activity modal */}
      {activityOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={() => setActivityOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ height: "min(640px, 88svh)", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ErrorBoundary>
              <ActivityPanel
                plan={user?.plan ?? "free"}
                isOpen={activityOpen}
                onClose={() => setActivityOpen(false)}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* [P18] Analytics modal */}
      {analyticsOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={() => setAnalyticsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
            style={{ height: "min(600px, 88svh)", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ErrorBoundary>
              <AnalyticsPanel
                plan={(user?.plan === "trial" || user?.plan === "trial_expired" ? "pro" : user?.plan) ?? "free"}
                isOpen={analyticsOpen}
                onClose={() => setAnalyticsOpen(false)}
                files={files}
                onRenew={handleRenewFile}
                onDownload={handleDownloadFile}
                onPreview={(file) => { handlePreviewFile(file); setAnalyticsOpen(false) }}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* [P18] API Keys modal */}
      {apiKeysOpen && user?.plan === "pro" && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={() => setApiKeysOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: "88svh", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>API Keys</p>
              <button onClick={() => setApiKeysOpen(false)} className="action-btn p-1.5 rounded-lg" aria-label="Close">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ErrorBoundary>
                <ApiKeysPanel isPro={true} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* Mobile floating notification FAB */}
      <NotificationBell
        notifications={notifications}
        unreadCount={unreadCount}
        onDismiss={dismissNotif}
        onDismissAll={dismissAllNotifs}
        onMarkAllRead={markAllRead}
        variant="float"
        plan={user?.plan ?? "free"}
        emailDigestEnabled={user?.emailDigestEnabled ?? true}
        decayWarningsEnabled={(user as unknown as Record<string, unknown>)?.decayWarningsEnabled as boolean ?? true}
      />

      {/* [P12-4] Keyboard shortcut reference modal */}
      {shortcutModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShortcutModalOpen(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <KeyboardIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <h2 className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>Keyboard shortcuts</h2>
              </div>
              <button
                onClick={() => setShortcutModalOpen(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                aria-label="Close shortcuts"
              >
                <XIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                { key: "U",   desc: "Open file upload" },
                { key: "N",   desc: "New folder" },
                { key: "/",   desc: "Focus search" },
                { key: "Esc", desc: "Close panels / modals" },
                { key: "?",   desc: "Toggle this reference" },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>{desc}</span>
                  <kbd
                    className="text-xs px-2 py-0.5 rounded-md font-mono"
                    style={{
                      background: "var(--bg-hover)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}