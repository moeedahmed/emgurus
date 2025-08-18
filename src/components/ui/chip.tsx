import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import React from "react";

export type ChipProps = {
  name: string;
  value: string;
  selected?: boolean;
  onSelect?: (value: string) => void;
  as?: "button" | "a";
  href?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode; // label override
} & VariantProps<typeof chipVariants>;

const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-full border transition-interactive focus-ring select-none disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        solid: "bg-primary text-primary-foreground border-transparent hover:bg-primary/80",
        outline: "border-input bg-background text-foreground hover:bg-accent/60",
        ghost: "border-transparent text-foreground hover:bg-accent/60",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "sm",
    },
  }
);

export function Chip({
  name,
  value,
  selected,
  onSelect,
  as = "button",
  href,
  iconLeft,
  iconRight,
  disabled,
  variant,
  size,
  children,
}: ChipProps) {
  const className = cn(
    chipVariants({ variant, size }),
    selected && variant === "outline" ? "bg-secondary text-secondary-foreground" : undefined,
    // Better cursor and internal padding harmony
    "cursor-pointer"
  );

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    // Prevent parent Link navigation when used inside cards
    if ("preventDefault" in e) (e as any).preventDefault?.();
    if (disabled) return;
    onSelect?.(value);
  };

  const commonProps = {
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": selected ? true : false,
    className,
    onClick: handleActivate,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        handleActivate(e);
      }
    },
    "data-selected": selected ? "true" : undefined,
    "data-name": name,
  };

  if (as === "a") {
    return (
      <a href={href} {...(commonProps as any)} aria-disabled={disabled}>
        {iconLeft}
        <span className="truncate max-w-[14rem]">{children ?? value}</span>
        {iconRight}
      </a>
    );
  }

  return (
    <button type="button" {...(commonProps as any)} disabled={disabled}>
      {iconLeft}
      <span className="truncate max-w-[14rem]">{children ?? value}</span>
      {iconRight}
    </button>
  );
}

export default Chip;
