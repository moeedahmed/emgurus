import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "mark" | "wordmark";
  className?: string;
  size?: number; // height in px for the mark
}

// Clean, modern logo for EM Gurus - emergency medicine education and mentorship
export default function Logo({ variant = "wordmark", className, size = 32 }: LogoProps) {
  const Mark = (
    <svg
      role="img"
      aria-label="EM Gurus"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="em-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="[stop-color:hsl(var(--primary))]" />
          <stop offset="100%" className="[stop-color:hsl(var(--primary-glow))]" />
        </linearGradient>
      </defs>
      
      {/* Main circle background */}
      <circle 
        cx="16" 
        cy="16" 
        r="15" 
        fill="url(#em-gradient)"
        className="drop-shadow-soft"
      />
      
      {/* Emergency medicine cross symbol */}
      <path 
        d="M16 8v16M8 16h16" 
        className="stroke-white" 
        strokeWidth="3" 
        strokeLinecap="round"
      />
      
      {/* Knowledge/mentorship elements - small dots around center */}
      <circle cx="12" cy="12" r="1.5" className="fill-white/70" />
      <circle cx="20" cy="12" r="1.5" className="fill-white/70" />
      <circle cx="12" cy="20" r="1.5" className="fill-white/70" />
      <circle cx="20" cy="20" r="1.5" className="fill-white/70" />
    </svg>
  );

  if (variant === "mark") return Mark;

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {Mark}
      <span className="logo-text">
        EM Gurus
      </span>
    </div>
  );
}
