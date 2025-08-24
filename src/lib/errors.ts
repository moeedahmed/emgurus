import { toast } from "sonner";

export interface FieldError {
  field: string;
  message: string;
}

export interface StructuredError {
  success: false;
  errors: FieldError[];
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    
    // Handle structured errors
    if (anyErr.errors && Array.isArray(anyErr.errors)) {
      return anyErr.errors.map((e: FieldError) => `${e.field}: ${e.message}`).join(', ');
    }
    
    if (anyErr.message && typeof anyErr.message === "string") return anyErr.message;
    if (anyErr.error && typeof anyErr.error === "string") return anyErr.error;
    if (anyErr.code && typeof anyErr.code === "string") return `${fallback} (${anyErr.code})`;
  }
  return fallback;
}

export function getFieldErrors(err: unknown): FieldError[] {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (anyErr.errors && Array.isArray(anyErr.errors)) {
      return anyErr.errors;
    }
  }
  return [];
}

export function showErrorToast(err: unknown, fallback = "Request failed") {
  const msg = getErrorMessage(err, fallback);
  toast.error(msg);
}

export function createStructuredError(errors: FieldError[]): StructuredError {
  return { success: false, errors };
}
