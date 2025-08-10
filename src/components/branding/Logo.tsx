import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "mark" | "wordmark";
  className?: string;
  size?: number; // height in px for the mark
}

// Simple, token-driven logo: a primary-colored EM monogram mark + wordmark text
export default function Logo({ variant = "wordmark", className, size = 28 }: LogoProps) {
  const Mark = (
    <svg
      role="img"
      aria-label="EMGurus logo mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("shrink-0 text-primary", className)}
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" className="fill-primary/10 stroke-primary/30" />
      {/* E */}
      <path d="M6 8h5M6 12h5M6 16h5" className="stroke-primary" strokeWidth="1.7" strokeLinecap="round" />
      {/* stylized M */}
      <path d="M13 16V8l3 4 3-4v8" className="stroke-primary" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (variant === "mark") return Mark;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {Mark}
      <span className="font-display font-bold text-lg sm:text-xl text-foreground tracking-tight">
        EMGurus
      </span>
    </span>
  );
}
