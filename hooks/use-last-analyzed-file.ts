"use client"

import { useState, useEffect, useCallback } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"

interface FileInfo {
  id: string
  filename: string
  created_at: string
  processed_at: string | null
  is_deleted?: boolean | null
}

export function useLastAnalyzedFile(businessId: string) {
  const [lastFileId, setLastFileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [recentFiles, setRecentFiles] = useState<FileInfo[]>([])
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Load the last analyzed file from localStorage
  const getLastFileFromStorage = useCallback(() => {
    if (typeof window === "undefined") return null

    try {
      const storedData = localStorage.getItem(`last-analyzed-file-${businessId}`)
      if (storedData) {
        const { fileId, timestamp } = JSON.parse(storedData)
        // Check if the stored data is less than 30 days old
        if (Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000) {
          return fileId
        }
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error)
    }
    return null
  }, [businessId])

  // Save the last analyzed file to localStorage
  const saveLastFile = useCallback(
    (fileId: string) => {
      if (typeof window === "undefined") return

      try {
        localStorage.setItem(`last-analyzed-file-${businessId}`, JSON.stringify({ fileId, timestamp: Date.now() }))
        setLastFileId(fileId)
      } catch (error) {
        console.error("Error saving to localStorage:", error)
      }
    },
    [businessId],
  )

  // Fetch recent processed files from Supabase
  const fetchRecentFiles = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) return null

      console.log("[Supabase] Fetching recent files for user:", userData.user.id)

      // Step 1: Basic query without complex filters
      const { data, error } = await supabase
        .from("uploaded_files")
        .select("id, filename, created_at, processed_at, is_deleted")
        .eq("user_id", userData.user.id)
        .eq("status", "processed")
        .order("processed_at", { ascending: false })

      if (error) {
        console.error("[Supabase] Error fetching recent files:", error)
        throw error
      }

      console.log(`[Supabase] Retrieved ${data?.length || 0} processed files`)

      // Step 2: Apply client-side filtering for is_deleted
      const filteredData = data?.filter((file) => file.is_deleted === false || file.is_deleted === null)

      console.log(`[Supabase] After filtering: ${filteredData?.length || 0} non-deleted processed files`)

      setRecentFiles(filteredData || [])
      return filteredData && filteredData.length > 0 ? filteredData[0].id : null
    } catch (error) {
      console.error("[Supabase] Error in fetchRecentFiles:", error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  // Check if a file exists and is not deleted
  const checkFileExists = useCallback(
    async (fileId: string) => {
      if (!fileId) return false

      try {
        console.log(`[Supabase] Checking if file ${fileId} exists and is not deleted`)
        const { data, error } = await supabase
          .from("uploaded_files")
          .select("id")
          .eq("id", fileId)
          .or("(is_deleted.is.null,is_deleted.eq.false)")
          .single()

        if (error || !data) {
          console.log(`[Supabase] File ${fileId} does not exist or is deleted`)
          return false
        }

        console.log(`[Supabase] File ${fileId} exists and is not deleted`)
        return true
      } catch (error) {
        console.error("Error checking file existence:", error)
        return false
      }
    },
    [supabase],
  )

  // Initialize: check localStorage, then fallback to Supabase
  useEffect(() => {
    const initialize = async () => {
      // First try localStorage
      const storedFileId = getLastFileFromStorage()

      if (storedFileId) {
        // Verify the stored file still exists and is not deleted
        const fileExists = await checkFileExists(storedFileId)

        if (fileExists) {
          setLastFileId(storedFileId)
          setIsLoading(false)
          // Still fetch recent files in the background for the dropdown
          fetchRecentFiles()
        } else {
          // Fallback to most recent file from Supabase if stored file is deleted
          console.log("Stored file is deleted or doesn't exist, falling back to recent files")
          const recentFileId = await fetchRecentFiles()
          setLastFileId(recentFileId)
        }
      } else {
        // Fallback to most recent file from Supabase
        const recentFileId = await fetchRecentFiles()
        setLastFileId(recentFileId)
      }
    }

    initialize()
  }, [getLastFileFromStorage, fetchRecentFiles, checkFileExists])

  // Navigate to analysis with the specified fileId
  const navigateToAnalysis = useCallback(
    (fileId: string) => {
      if (!fileId) return

      saveLastFile(fileId)
      router.push(`/business/${businessId}/analysis/${fileId}`)
    },
    [businessId, router, saveLastFile],
  )

  return {
    lastFileId,
    isLoading,
    recentFiles,
    navigateToAnalysis,
    saveLastFile,
    refreshFiles: fetchRecentFiles,
  }
}
