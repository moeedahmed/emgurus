import { toast as sonnerToast } from "sonner"

// Compatibility adapter for existing use-toast API
// Routes object-style toasts to Sonner while preserving the same interface

type ToastVariant = "success" | "error" | "warning" | "destructive" | "info" | "default"

interface ToastProps {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: {
    label: string
    onClick?: () => void
  }
}

function toast({ title, description, variant = "default", duration, action }: ToastProps) {
  const message = title || description || ""
  const details = title && description ? description : undefined
  const options = { description: details, duration }

  // Map variants to Sonner methods
  switch (variant) {
    case "success":
      return sonnerToast.success(message, options)
    case "error":
    case "destructive":
      return sonnerToast.error(message, options)
    case "warning":
      return sonnerToast.warning(message, options)
    case "info":
      return sonnerToast.info(message, options)
    default:
      return sonnerToast(message, options)
  }
}

// Legacy hook interface for compatibility
function useToast() {
  return {
    toast,
    dismiss: (id?: string) => {
      if (id) {
        sonnerToast.dismiss(id)
      } else {
        sonnerToast.dismiss()
      }
    },
    toasts: [] // Legacy property - not used with Sonner
  }
}

export { useToast, toast }