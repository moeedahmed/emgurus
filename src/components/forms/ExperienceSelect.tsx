import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import React from "react";

export type ExperienceRangeOption = {
  label: string;
  // numeric value we persist (e.g., upper bound or representative value)
  value: number;
};

export const EXPERIENCE_RANGES: ExperienceRangeOption[] = [
  { label: "< 1 year", value: 0 },
  { label: "1 – 2 years", value: 2 },
  { label: "3 – 5 years", value: 5 },
  { label: "6 – 10 years", value: 10 },
  { label: "11 – 15 years", value: 15 },
  { label: "> 15 years", value: 20 },
];

interface ExperienceSelectProps {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  className?: string;
}

export function ExperienceSelect({ value, onChange, placeholder = "Select experience", className }: ExperienceSelectProps) {
  const current = value === "" ? undefined : String(value);
  return (
    <Select value={current} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={cn(className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-50 bg-popover">
        {EXPERIENCE_RANGES.map((opt) => (
          <SelectItem key={opt.value} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
