import { cn } from "@/lib/utils";

interface SkipLinkProps {
  className?: string;
}

export function SkipLink({ className }: SkipLinkProps) {
  return (
    <a
      href="#main-content"
      className={cn(
        "skip-link",
        "absolute -top-10 left-4 z-50",
        "bg-primary text-primary-foreground",
        "px-4 py-2 rounded-md font-medium text-sm",
        "transition-all duration-200",
        "focus:top-4 focus-visible:top-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      Skip to main content
    </a>
  );
}