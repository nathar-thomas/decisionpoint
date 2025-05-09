"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TaskItem } from "./task-item"
import { Loader2 } from "lucide-react"

interface Task {
  task_id: string
  task_name: string
  description: string
  task_type: string
  category: string | null
  seller_id: string
}

interface UploadedFile {
  id: string
  task_id: string
  status: string
}

interface TaskCategory {
  name: string
  tasks: (Task & { isComplete: boolean })[]
  isComplete: boolean
}

export function TasksCategoryView({ businessId }: { businessId: string }) {
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  // Add mock tasks function
  function getMockTasks(businessId: string): Task[] {
    return [
      {
        task_id: "1",
        task_name: "Cash Flow Statement",
        description: "Annual cash flow statement for the past 3 years",
        task_type: "document-upload",
        category: "Financial Documents",
        seller_id: businessId,
      },
      {
        task_id: "2",
        task_name: "Income Statement",
        description: "Income statement for the past 3 years",
        task_type: "document-upload",
        category: "Financial Documents",
        seller_id: businessId,
      },
      {
        task_id: "3",
        task_name: "Balance Sheet",
        description: "Current balance sheet",
        task_type: "document-upload",
        category: "Financial Documents",
        seller_id: businessId,
      },
      {
        task_id: "4",
        task_name: "Business License",
        description: "Current business license and permits",
        task_type: "document-upload",
        category: "Legal Documents",
        seller_id: businessId,
      },
      {
        task_id: "5",
        task_name: "Employee Handbook",
        description: "Current employee handbook and policies",
        task_type: "document-upload",
        category: null, // This will be assigned to "Uncategorized"
        seller_id: businessId,
      },
    ]
  }

  // Update the fetchTasksAndFiles function to include logging
  async function fetchTasksAndFiles() {
    try {
      setIsLoading(true)
      console.log("[fetchTasksAndFiles] ▶️ Start:", businessId)

      // 1. Add UUID validation using the provided regex
      const isValidUUID = (uuid: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)

      // 2. Determine the businessId
      const validatedBusinessId = isValidUUID(businessId) ? businessId : "37add0e6-16d4-4607-b057-7e7a1ede55f1" // fallback UUID

      // 3. Log each step for debugging
      console.log("[fetchTasksAndFiles] Raw businessId param:", businessId)
      console.log("[fetchTasksAndFiles] UUID is valid:", isValidUUID(businessId))
      console.log("[fetchTasksAndFiles] Using businessId for fetch:", validatedBusinessId)

      // 4. Use validatedBusinessId in all Supabase queries
      console.log("[fetchTasksAndFiles] Querying tasks table with seller_id:", validatedBusinessId)
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("seller_id", validatedBusinessId)
        .order("task_name")

      if (tasksError) {
        console.error("[fetchTasksAndFiles] ❌ tasks error:", tasksError)
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`)
      }

      console.log("[fetchTasksAndFiles] ✅ tasks:", tasks)

      // Fetch uploaded files for this business using the validated ID
      console.log("[fetchTasksAndFiles] Querying uploaded_files with business_id:", validatedBusinessId)
      const { data: files, error: filesError } = await supabase
        .from("uploaded_files")
        .select("id, task_id, status")
        .eq("business_id", validatedBusinessId)

      if (filesError) {
        console.error("[fetchTasksAndFiles] ❌ files error:", filesError)
        throw new Error(`Failed to fetch files: ${filesError.message}`)
      }

      console.log("[fetchTasksAndFiles] ✅ files:", files)

      // Fetch survey responses
      console.log("[fetchTasksAndFiles] ▶️ Loading saved responses")
      const { data: responses, error: responsesError } = await supabase
        .from("survey_responses")
        .select("task_id, value")
        .eq("business_id", validatedBusinessId)

      if (responsesError) {
        console.error("[fetchTasksAndFiles] ❌ responses error:", responsesError)
      } else {
        console.log("[fetchTasksAndFiles] ✅ responses:", responses)
      }

      // Process tasks, files, and responses
      console.log("[fetchTasksAndFiles] 🧩 Merging responses into tasks")
      const tasksWithState = tasks.map((t) => {
        const resp = responses?.find((r) => r.task_id === t.task_id)
        return {
          ...t,
          response: resp?.value ?? null,
          isComplete: files?.some((file) => file.task_id === t.task_id && file.status === "processed") || !!resp?.value,
        }
      })
      console.log("[fetchTasksAndFiles] ✅ tasksWithState:", tasksWithState)

      // Process tasks, files, and responses
      const mergedTasks = processTasksAndFiles(tasksWithState || [], files || [], responses || [])
      console.log("[fetchTasksAndFiles] 🔄 Final merged tasks:", mergedTasks)
    } catch (err) {
      console.error("[fetchTasksAndFiles] ❌ Error:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to process tasks and files data
  function processTasksAndFiles(
    tasks: (Task & { response?: string | null; isComplete?: boolean })[],
    files: UploadedFile[],
    responses: any[] = [],
  ) {
    // Add debug log to show how many tasks are being processed
    console.log(
      `[processTasksAndFiles] ▶️ Processing ${tasks.length} tasks, ${files.length} files, and ${responses.length} responses`,
    )

    // Group tasks by category
    const tasksByCategory: Record<string, (Task & { isComplete: boolean })[]> = {}

    // First, ensure all tasks are included regardless of file status
    tasks.forEach((task: Task & { response?: string | null; isComplete?: boolean }) => {
      console.log("[processTasksAndFiles] Processing task:", {
        name: task.task_name,
        id: task.task_id,
        type: task.task_type,
        response: task.response,
        isComplete: task.isComplete,
      })

      // Use the pre-computed isComplete value
      const isComplete = task.isComplete === true

      console.log(`[processTasksAndFiles] Task ${task.task_id} (${task.task_name}) isComplete:`, isComplete)

      // Use "Uncategorized" for null categories
      const category = task.category || "Uncategorized"
      console.log(`[processTasksAndFiles] Assigning task "${task.task_name}" to category "${category}"`)

      if (!tasksByCategory[category]) {
        tasksByCategory[category] = []
      }

      // Include all tasks regardless of type or file status
      tasksByCategory[category].push({
        ...task,
        isComplete,
      })
    })

    console.log("[processTasksAndFiles] Grouped tasks:", tasksByCategory)

    // Log the count of tasks in each category
    Object.entries(tasksByCategory).forEach(([category, categoryTasks]) => {
      console.log(`[processTasksAndFiles] "${category}" has ${categoryTasks.length} tasks`)
    })

    // Convert to array and sort categories
    const categoriesArray = Object.entries(tasksByCategory).map(([name, tasks]) => ({
      name,
      tasks,
      isComplete: tasks.every((task) => task.isComplete),
    }))

    // Sort categories alphabetically, but keep "Uncategorized" at the end
    categoriesArray.sort((a, b) => {
      if (a.name === "Uncategorized") return 1
      if (b.name === "Uncategorized") return -1
      return a.name.localeCompare(b.name)
    })

    console.log(`[processTasksAndFiles] ✅ Final categories: ${categoriesArray.length}`)
    categoriesArray.forEach((category) => {
      console.log(
        `[processTasksAndFiles] Category "${category.name}": ${category.tasks.length} tasks, isComplete: ${category.isComplete}`,
      )
    })

    setCategories(categoriesArray)
    return categoriesArray
  }

  useEffect(() => {
    fetchTasksAndFiles()
  }, [supabase, businessId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading tasks...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 text-red-800 rounded-md">
        <h3 className="font-bold">Error loading tasks</h3>
        <p>{error}</p>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="p-6 text-center border rounded-xl bg-muted/50 shadow-sm">
        <p className="text-muted-foreground">No tasks found for this business.</p>
      </div>
    )
  }

  console.log("[TasksCategoryView] ▶️ Rendering tasks:", categories)
  console.log("[TasksCategoryView] ▶️ Link style applied for input tasks")

  // Add this line near the beginning of the render function, just before the return statement
  console.log("[TasksCategoryView] ▶️ Current tasks:", categories)

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={categories.map((c) => c.name)} className="space-y-4">
        {categories.map((category) => (
          <AccordionItem
            key={category.name}
            value={category.name}
            className="border rounded-xl bg-muted/50 p-4 shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <h3 className="text-lg font-medium text-left">{category.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100/50 text-amber-800">
                  {category.isComplete ? "Complete" : "Incomplete"}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mt-2 space-y-3">
                {category.tasks.map((task) => (
                  <TaskItem key={task.task_id} task={task} businessId={businessId} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
