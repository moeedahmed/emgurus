import { toast } from "sonner";

export function getErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (anyErr.message && typeof anyErr.message === "string") return anyErr.message;
    if (anyErr.error && typeof anyErr.error === "string") return anyErr.error;
    if (anyErr.code && typeof anyErr.code === "string") return `${fallback} (${anyErr.code})`;
  }
  return fallback;
}

export function showErrorToast(err: unknown, fallback = "Request failed") {
  const msg = getErrorMessage(err, fallback);
  toast.error(msg);
}
