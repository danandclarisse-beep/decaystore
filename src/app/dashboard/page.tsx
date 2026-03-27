"use client"

import { useEffect, useState, useCallback } from "react"
import { FileUploader } from "@/components/dashboard/FileUploader"
import { FileGrid } from "@/components/dashboard/FileGrid"
import { StorageBar } from "@/components/dashboard/StorageBar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { FolderSidebar } from "@/components/dashboard/FolderSidebar"
import { PLAN_STORAGE_LIMITS, PLANS } from "@/lib/plans"
import { ChevronRightIcon, HomeIcon, ArrowLeftIcon, AlertTriangleIcon, RefreshCwIcon } from "lucide-react"
import type { File, User, Folder } from "@/lib/db/schema"

export default function DashboardPage() {
  const [files, setFiles]           = useState<File[]>([])
  const [folders, setFolders]       = useState<Folder[]>([])
  const [user, setUser]             = useState<User | null>(null)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Folder[]>([])

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

  function openFolder(folder: Folder) {
    setCurrentFolderId(folder.id)
    setFolderPath((prev) => {
      // Avoid duplicates if already in path
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

  // Sidebar navigate keeps breadcrumb in sync
  function handleSidebarNavigate(folderId: string | null) {
    if (folderId === null) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      const folder = folders.find((f) => f.id === folderId)
      if (folder) {
        // Check if already in path
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

  const storageLimit = user ? PLAN_STORAGE_LIMITS[user.plan] : PLAN_STORAGE_LIMITS.free
  const storageUsed  = user?.storageUsedBytes ?? 0
  const fileLimit    = user ? (PLANS[user.plan as keyof typeof PLANS]?.maxFiles ?? 10) : 10

  const visibleFiles   = files.filter((f) => (f.folderId ?? null) === currentFolderId)
  const visibleFolders = folders.filter((f) => (f.parentId ?? null) === currentFolderId)

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <DashboardHeader user={user} />

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <FolderSidebar
          folders={folders}
          currentFolderId={currentFolderId}
          onNavigate={handleSidebarNavigate}
          onRefresh={fetchAll}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Storage */}
          <StorageBar
            used={storageUsed}
            limit={storageLimit}
            plan={user?.plan ?? "free"}
            fileCount={files.length}
            fileLimit={fileLimit}
            loading={loading}
          />

          {/* Breadcrumb with back button */}
          <nav className="flex items-center gap-1.5 text-sm flex-wrap">
            {/* Back button — only show when inside a folder on mobile */}
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
                  className="transition-colors font-medium"
                  style={{ color: i === folderPath.length - 1 ? "var(--text)" : "var(--text-muted)" }}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </nav>

          {/* Fetch error state */}
          {fetchError && !loading && (
            <div
              className="rounded-xl p-5 flex items-center gap-4"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <AlertTriangleIcon className="w-5 h-5 shrink-0" style={{ color: "#ef4444" }} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "#ef4444" }}>Failed to load your files</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fetchError}</p>
              </div>
              <button
                onClick={fetchAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                <RefreshCwIcon className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Uploader */}
          <FileUploader
            onUploadComplete={fetchAll}
            plan={user?.plan ?? "free"}
            currentFolderId={currentFolderId}
          />

          {/* File grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl h-40 animate-pulse"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
              ))}
            </div>
          ) : (
            <FileGrid
              files={visibleFiles}
              folders={visibleFolders}
              allFolders={folders}
              currentFolderId={currentFolderId}
              onRefresh={fetchAll}
              onOpenFolder={openFolder}
            />
          )}
        </main>
      </div>
    </div>
  )
}