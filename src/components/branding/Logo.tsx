import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "mark" | "wordmark";
  className?: string;
  size?: number; // height in px for the mark
}

// Modern logo combining book/learning with digital mentorship symbolism
export default function Logo({ variant = "wordmark", className, size = 32 }: LogoProps) {
  const Mark = (
    <svg
      role="img"
      aria-label="EM Gurus - Medical Education & Mentorship Platform"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
    >
      {/* Background circle with gradient */}
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="[stop-color:hsl(var(--primary))]" />
          <stop offset="100%" className="[stop-color:hsl(var(--primary-glow))]" />
        </linearGradient>
      </defs>
      
      {/* Main container circle */}
      <circle 
        cx="16" 
        cy="16" 
        r="15" 
        fill="url(#logo-gradient)"
        className="drop-shadow-sm"
      />
      
      {/* Book/Knowledge symbol - stylized open book */}
      <path 
        d="M8 12c0-1 1-2 2-2h4c1 0 2 1 2 2M18 12c0-1 1-2 2-2h2c1 0 2 1 2 2"
        className="stroke-white/90"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M8 12v8c0 1 1 2 2 2h4c1 0 2-1 2-2v-8M18 12v8c0 1 1 2 2 2h2c1 0 2-1 2-2v-8"
        className="stroke-white/90"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Digital/Mentorship element - connection dots */}
      <circle cx="11" cy="16" r="1" className="fill-white/80" />
      <circle cx="16" cy="16" r="1.5" className="fill-white" />
      <circle cx="21" cy="16" r="1" className="fill-white/80" />
      
      {/* Connection lines for mentorship */}
      <path 
        d="M12 16h3M17.5 16h2.5"
        className="stroke-white/60"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === "mark") return Mark;

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {Mark}
      <div className="flex flex-col">
        <span className="font-display font-bold text-xl text-foreground tracking-tight leading-none">
          EM Gurus
        </span>
        <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase leading-none mt-0.5">
          Medical Education
        </span>
      </div>
    </div>
  );
}
