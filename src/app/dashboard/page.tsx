"use client"

import { useEffect, useState, useCallback, useRef, Suspense } from "react"
import { useRouter } from "next/navigation"
import { FileUploader } from "@/components/dashboard/FileUploader"
import { FileGrid } from "@/components/dashboard/FileGrid"
import { StorageBar } from "@/components/dashboard/StorageBar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { FolderSidebar } from "@/components/dashboard/FolderSidebar"
import { NotificationBell } from "@/components/dashboard/NotificationBell"
import { UpgradeBanner } from "@/components/dashboard/UpgradeBanner"
import { OnboardingBanner, DecayExplainer } from "@/components/dashboard/OnboardingBanner"
import { ActivityPanel } from "@/components/dashboard/ActivityPanel"
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel"
import { useNotifications } from "@/hooks/useNotifications"
import { PLAN_STORAGE_LIMITS, PLANS } from "@/lib/plans"
import {
  ChevronRightIcon, HomeIcon, ArrowLeftIcon,
  AlertTriangleIcon, RefreshCwIcon, HistoryIcon, BarChart2Icon,
} from "lucide-react"
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
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Folder[]>([])
  // [P8-1] Activity panel open/close
  const [activityOpen, setActivityOpen] = useState(false)
  // [P9-3] Analytics panel open/close (Pro)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  const router = useRouter()

  // ─── Renew file handler (called from notification actions) ─────
  const renewFileRef = useRef<((fileId: string) => Promise<void>) | null>(null)
  const handleRenewFile = useCallback(async (fileId: string) => {
    if (renewFileRef.current) await renewFileRef.current(fileId)
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

  const storageLimit   = user ? PLAN_STORAGE_LIMITS[user.plan] : PLAN_STORAGE_LIMITS.free
  const storageUsed    = user?.storageUsedBytes ?? 0
  const fileLimit      = user ? (PLANS[user.plan as keyof typeof PLANS]?.maxFiles ?? 10) : 10
  const visibleFiles   = files.filter((f) => (f.folderId ?? null) === currentFolderId)
  const visibleFolders = folders.filter((f) => (f.parentId ?? null) === currentFolderId)
  // [P8-3] Current folder object — used to pass defaultDecayRateDays to FileUploader
  const currentFolder  = currentFolderId ? folders.find((f) => f.id === currentFolderId) ?? null : null

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
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
        />

        {/* Main content + Activity panel */}
        <div className="flex-1 min-w-0 flex gap-4 sm:gap-6">
        <main className="flex-1 min-w-0 space-y-4 sm:space-y-5 pb-24 lg:pb-0">

          {/* [P6-1] Post-upgrade confirmation — shown once after checkout redirect */}
          <UpgradeBanner user={user} />

          {/* [P6-2] First-use onboarding — shown once to new users */}
          {!loading && files.length === 0 && <OnboardingBanner />}

          {/* Storage */}
          <StorageBar
            used={storageUsed}
            limit={storageLimit}
            plan={user?.plan ?? "free"}
            fileCount={files.length}
            fileLimit={fileLimit}
            loading={loading}
          />

          {/* [P6-2] Decay explainer — collapsible, always available */}
          {!loading && <DecayExplainer plan={user?.plan ?? "free"} />}

          {/* Breadcrumb + Activity toggle */}
          <div className="flex items-center justify-between gap-2">
            <nav className="flex items-center gap-1.5 text-sm flex-wrap flex-1 min-w-0">
              {currentFolderId && (
                <button
                  onClick={() => navigateTo(folderPath.length - 2)}
                  className="lg:hidden flex items-center gap-1 text-xs px-2 py-1 rounded-lg mr-1"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
                </button>
              )}
              <button
                onClick={() => navigateTo(-1)}
                className="flex items-center gap-1.5 transition-colors font-medium"
                style={{ color: currentFolderId ? "var(--text-muted)" : "var(--text)" }}
              >
                <HomeIcon className="w-3.5 h-3.5" />
                My Files
              </button>
              {folderPath.map((folder, i) => (
                <span key={folder.id} className="flex items-center gap-1.5">
                  <ChevronRightIcon className="w-3.5 h-3.5" style={{ color: "var(--text-dim)" }} />
                  <button
                    onClick={() => navigateTo(i)}
                    className="transition-colors font-medium truncate max-w-[120px] sm:max-w-none"
                    style={{
                      color: i === folderPath.length - 1 ? "var(--text)" : "var(--text-muted)",
                    }}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </nav>

            {/* [P8-1] Activity toggle button — Starter + Pro */}
            {(user?.plan === "starter" || user?.plan === "pro") && (
              <button
                onClick={() => { setActivityOpen((o) => !o); setAnalyticsOpen(false) }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                style={{
                  background: activityOpen ? "var(--accent-dim)" : "var(--bg-card)",
                  border: `1px solid ${activityOpen ? "var(--accent)" : "var(--border)"}`,
                  color: activityOpen ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <HistoryIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Activity</span>
              </button>
            )}
            {/* [P9-3] Analytics toggle button — Pro only */}
            {user?.plan === "pro" && (
              <button
                onClick={() => { setAnalyticsOpen((o) => !o); setActivityOpen(false) }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg shrink-0 transition-colors"
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
          </div>

          {/* Fetch error */}
          {fetchError && !loading && (
            <div
              className="rounded-xl p-4 sm:p-5 flex items-center gap-4"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <AlertTriangleIcon className="w-5 h-5 shrink-0" style={{ color: "#ef4444" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
                  Failed to load your files
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {fetchError}
                </p>
              </div>
              <button
                onClick={fetchAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg shrink-0"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                <RefreshCwIcon className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Uploader */}
          <FileUploader
            onUploadComplete={() => {
              fetchAll()
              pushToast({
                id: `upload-done-${Date.now()}`,
                severity: "success",
                title: "Upload complete",
                body: "Your file was uploaded successfully.",
                autoDismissMs: 4000,
              })
            }}
            plan={user?.plan ?? "free"}
            currentFolderId={currentFolderId}
            currentFolder={currentFolder}
          />

          {/* File grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl animate-pulse"
                  style={{
                    height: "160px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              ))}
            </div>
          ) : (
            <FileGrid
              files={visibleFiles}
              folders={visibleFolders}
              allFolders={folders}
              currentFolderId={currentFolderId}
              userPlan={user?.plan ?? "free"}
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
            />
          )}
        </main>

        {/* [P8-1] Activity panel — inline on desktop */}
        {activityOpen && (
          <div className="hidden lg:block w-[420px] shrink-0">
            <ActivityPanel
              plan={user?.plan ?? "free"}
              isOpen={activityOpen}
              onClose={() => setActivityOpen(false)}
            />
          </div>
        )}
        {/* [P9-3] Analytics panel — inline on desktop, Pro only */}
        {analyticsOpen && (
          <div className="hidden lg:block w-[360px] shrink-0">
            <AnalyticsPanel
              plan={user?.plan ?? "free"}
              isOpen={analyticsOpen}
              onClose={() => setAnalyticsOpen(false)}
            />
          </div>
        )}
        </div>
      </div>

      {/* [P8-1] Activity panel mobile drawer */}
      <div className="lg:hidden">
        <ActivityPanel
          plan={user?.plan ?? "free"}
          isOpen={activityOpen}
          onClose={() => setActivityOpen(false)}
        />
      </div>

      {/* [P9-3] Analytics panel mobile drawer — Pro only */}
      <div className="lg:hidden">
        <AnalyticsPanel
          plan={user?.plan ?? "free"}
          isOpen={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
        />
      </div>

      {/* Mobile floating notification FAB */}
      <NotificationBell
        notifications={notifications}
        unreadCount={unreadCount}
        onDismiss={dismissNotif}
        onDismissAll={dismissAllNotifs}
        onMarkAllRead={markAllRead}
        variant="float"
      />
    </div>
  )
}