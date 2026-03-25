"use client"

import { useEffect, useState, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { FileUploader } from "@/components/dashboard/FileUploader"
import { FileGrid } from "@/components/dashboard/FileGrid"
import { StorageBar } from "@/components/dashboard/StorageBar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { FolderSidebar } from "@/components/dashboard/FolderSidebar"
import { PLAN_STORAGE_LIMITS } from "@/lib/plans"
import type { File, User, Folder } from "@/lib/db/schema"

export default function DashboardPage() {
  const [files, setFiles]           = useState<File[]>([])
  const [folders, setFolders]       = useState<Folder[]>([])
  const [user, setUser]             = useState<User | null>(null)
  const [loading, setLoading]       = useState(true)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Folder[]>([]) // breadcrumb trail

  const fetchAll = useCallback(async () => {
    try {
      const [filesRes, foldersRes] = await Promise.all([
        fetch("/api/files"),
        fetch("/api/folders"),
      ])
      const filesData   = await filesRes.json()
      const foldersData = await foldersRes.json()
      setFiles(filesData.files ?? [])
      setUser(filesData.user ?? null)
      setFolders(foldersData.folders ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Navigate into a folder
  function openFolder(folder: Folder) {
    setCurrentFolderId(folder.id)
    setFolderPath((prev) => [...prev, folder])
  }

  // Navigate via breadcrumb
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

  const storageLimit = user ? PLAN_STORAGE_LIMITS[user.plan] : PLAN_STORAGE_LIMITS.free
  const storageUsed  = user?.storageUsedBytes ?? 0

  // Filter files and folders to current folder
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
          onNavigate={(folderId) => {
            if (folderId === null) {
              setCurrentFolderId(null)
              setFolderPath([])
            } else {
              const folder = folders.find((f) => f.id === folderId)
              if (folder) openFolder(folder)
            }
          }}
          onRefresh={fetchAll}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Storage */}
          <StorageBar used={storageUsed} limit={storageLimit} plan={user?.plan ?? "free"} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm flex-wrap">
            <button
              onClick={() => navigateTo(-1)}
              className="transition-colors font-medium"
              style={{ color: currentFolderId ? "var(--text-muted)" : "var(--text)" }}
            >
              My Files
            </button>
            {folderPath.map((folder, i) => (
              <span key={folder.id} className="flex items-center gap-1.5">
                <span style={{ color: "var(--text-dim)" }}>/</span>
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
                <div
                  key={i}
                  className="rounded-xl h-40 animate-pulse"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                />
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