"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FileText, BarChart2, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react"
import { EmptyTableState } from "@/components/empty-table-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DocumentActionsMenu } from "@/components/document-actions-menu"
import { useToast } from "@/hooks/use-toast"

type UploadedFile = {
  id: string
  filename: string
  status: string
  created_at: string
  processed_at: string | null
}

interface DocumentsListProps {
  businessId: string
}

export function DocumentsList({ businessId }: DocumentsListProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Fetch uploaded files
  useEffect(() => {
    fetchFiles()
  }, [supabase])

  const fetchFiles = async () => {
    try {
      setIsLoading(true)
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) return

      console.log("[Supabase] Fetching files for user:", userData.user.id)

      // Step 1: Baseline query - minimal select to confirm table access
      const { data, error } = await supabase
        .from("uploaded_files")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[Supabase] Error fetching uploaded files:", error)
        throw error
      }

      console.log(`[Supabase] Retrieved ${data?.length || 0} total documents for user`)

      // Log detailed information about is_deleted values
      if (data && data.length > 0) {
        console.log("[Supabase] Document is_deleted values:")
        data.forEach((file) => {
          console.log(`Document ID: ${file.id}, is_deleted: ${file.is_deleted}, type: ${typeof file.is_deleted}`)
        })

        // Log a few sample documents for inspection
        console.log("[Supabase] Sample documents (first 5):", data.slice(0, 5))
      }

      // No filtering - return all documents
      setUploadedFiles(data || [])
    } catch (err) {
      console.error("[Supabase] Error in fetchFiles:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Navigate to analysis for a specific file
  const handleViewAnalysis = (fileId: string) => {
    router.push(`/business/${businessId}/analysis/${fileId}`)
  }

  // Navigate to tasks page
  const handleUploadAction = () => {
    router.push(`/business/${businessId}/tasks`)
  }

  // Soft delete a document
  const handleDeleteDocument = async (fileId: string) => {
    try {
      console.log(`Soft deleting document: ${fileId}`)

      // Add detailed logging to track the update operation
      console.log("[Supabase] Attempting to update document with is_deleted=true")

      // Update the document with is_deleted=true
      // Adding .select() and .single() to get proper error handling
      const { data, error } = await supabase
        .from("uploaded_files")
        .update({ is_deleted: true })
        .eq("id", fileId)
        .select()
        .single()

      if (error) {
        console.error("[Supabase] Error updating document:", error)
        throw error
      }

      console.log("[Supabase] Document updated successfully:", data)

      // Update local state to remove the document
      setUploadedFiles(uploadedFiles.filter((file) => file.id !== fileId))

      // Show success toast
      toast({
        variant: "success",
        title: "Document deleted",
        description: "The document has been removed from your profile.",
      })

      console.log("Document soft deleted successfully")
    } catch (err) {
      console.error("Error deleting document:", err)
      toast({
        variant: "destructive",
        title: "Error deleting document",
        description: "There was a problem deleting the document. Please try again.",
      })
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Get status badge based on file status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Processed
          </span>
        )
      case "uploading":
      case "parsing":
        return (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </span>
        )
      case "error":
        return (
          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </span>
        )
      default:
        return (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading documents...</span>
      </div>
    )
  }

  if (uploadedFiles.length === 0) {
    return (
      <EmptyTableState
        message="No documents uploaded yet"
        actionLabel="Upload Document"
        onAction={handleUploadAction}
      />
    )
  }

  return (
    <div className="border rounded-md divide-y">
      {uploadedFiles.map((file) => (
        <div key={file.id} className="p-4 flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-3 text-blue-500" />
            <div>
              <p className="font-medium">{file.filename}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded on {formatDate(file.created_at)}
                {file.processed_at && ` • Processed on ${formatDate(file.processed_at)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(file.status)}

            {file.status === "processed" ? (
              <Button size="sm" variant="outline" onClick={() => handleViewAnalysis(file.id)}>
                <BarChart2 className="h-4 w-4 mr-2" />
                View Analysis
              </Button>
            ) : file.status === "error" ? (
              <Button size="sm" variant="outline" className="text-red-600" onClick={handleUploadAction}>
                <AlertCircle className="h-4 w-4 mr-2" />
                Retry Upload
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button size="sm" variant="outline" disabled>
                        <BarChart2 className="h-4 w-4 mr-2" />
                        View Analysis
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>File is still being processed</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Document Actions Menu */}
            <DocumentActionsMenu documentId={file.id} documentName={file.filename} onDelete={handleDeleteDocument} />
          </div>
        </div>
      ))}
    </div>
  )
}
