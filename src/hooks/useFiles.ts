'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileEntry, FileType } from '@/types'

export function useFiles(type: FileType) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/files?type=${type}`)
      if (res.ok) setFiles(await res.json())
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => { refresh() }, [refresh])

  const createFile = async (title: string) => {
    const res = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type }),
    })
    if (res.ok) {
      const { filename } = await res.json()
      await refresh()
      return filename as string
    }
    return null
  }

  const deleteFile = async (filename: string) => {
    await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, { method: 'DELETE' })
    await refresh()
  }

  const renameFile = async (filename: string, newTitle: string) => {
    const res = await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTitle }),
    })
    if (res.ok) {
      const { filename: newFilename } = await res.json()
      await refresh()
      return newFilename as string
    }
    return null
  }

  return { files, loading, refresh, createFile, deleteFile, renameFile }
}
