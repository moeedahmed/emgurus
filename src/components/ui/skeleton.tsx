import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "shimmer" | "text" | "avatar" | "button"
}

function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  const baseClasses = "rounded-md bg-muted"
  
  const variantClasses = {
    default: "animate-pulse",
    shimmer: "relative overflow-hidden bg-gradient-to-r from-muted via-muted/70 to-muted animate-shimmer bg-[length:200px_100%]",
    text: "animate-pulse h-4",
    avatar: "animate-pulse rounded-full",
    button: "animate-pulse h-10"
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
