"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { FileUploader } from "@/components/dashboard/FileUploader"
import { FileGrid } from "@/components/dashboard/FileGrid"
import { StorageBar } from "@/components/dashboard/StorageBar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { PLAN_STORAGE_LIMITS } from "@/lib/plans"
import type { File, User } from "@/lib/db/schema"

export default function DashboardPage() {
  const { user: clerkUser } = useUser()
  const [files, setFiles] = useState<File[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchFiles() {
    try {
      const res = await fetch("/api/files")
      const data = await res.json()
      setFiles(data.files ?? [])
      setUser(data.user ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const storageLimit = user ? PLAN_STORAGE_LIMITS[user.plan] : PLAN_STORAGE_LIMITS.free
  const storageUsed = user?.storageUsedBytes ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={user} />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Storage bar */}
        <StorageBar used={storageUsed} limit={storageLimit} plan={user?.plan ?? "free"} />

        {/* Uploader */}
        <FileUploader onUploadComplete={fetchFiles} plan={user?.plan ?? "free"} />

        {/* File grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-40 animate-pulse" />
            ))}
          </div>
        ) : (
          <FileGrid files={files} onRefresh={fetchFiles} />
        )}
      </main>
    </div>
  )
}
