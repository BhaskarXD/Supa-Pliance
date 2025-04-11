import { toast as sonnerToast } from "sonner"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  return {
    toast: ({ title, description, variant = "default", ...props }: ToastProps) => {
      sonnerToast(title, {
        description,
        ...props,
      })
    },
    dismiss: sonnerToast.dismiss,
  }
} 