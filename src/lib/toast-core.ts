// Internal toast core - centralizes sonner import for the application
// Only this file and src/components/ui/sonner.tsx should import "sonner" directly

import { toast as sonnerToast } from "sonner";

// Re-export only the functions needed by the adapter
export const toast = sonnerToast;
export const success = sonnerToast.success;
export const error = sonnerToast.error;
export const warning = sonnerToast.warning;
export const info = sonnerToast.info;
export const dismiss = sonnerToast.dismiss;