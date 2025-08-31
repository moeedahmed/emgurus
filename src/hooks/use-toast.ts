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

// Overloaded function signatures
function toast(props: ToastProps): string | number;
function toast(message: string): string | number;
function toast(propsOrMessage: ToastProps | string): string | number {
  if (typeof propsOrMessage === "string") {
    return sonnerToast(propsOrMessage);
  }
  
  const { title, description, variant = "default", duration, action } = propsOrMessage;
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

// Add convenience methods for backward compatibility
toast.success = (message: string, options?: any) => sonnerToast.success(message, options)
toast.error = (message: string, options?: any) => sonnerToast.error(message, options)
toast.warning = (message: string, options?: any) => sonnerToast.warning(message, options)
toast.info = (message: string, options?: any) => sonnerToast.info(message, options)
toast.message = (message: string, options?: any) => sonnerToast(message, options)

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