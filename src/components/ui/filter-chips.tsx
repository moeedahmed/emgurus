import React from "react";
import { Chip, type ChipProps } from "@/components/ui/chip";

export type FilterItem = {
  label: string;
  value: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export function FilterChips({
  items,
  mode = "single",
  selected,
  onChange,
  variant = "outline",
  size = "sm",
  name = "filter",
}: {
  items: FilterItem[];
  mode?: "single" | "multi";
  selected?: string | string[];
  onChange: (next: string | string[]) => void;
  variant?: ChipProps["variant"];
  size?: ChipProps["size"];
  name?: string;
}) {
  const isSelected = (v: string) =>
    Array.isArray(selected) ? selected.includes(v) : selected === v;

  const toggle = (v: string) => {
    if (mode === "multi") {
      const curr = Array.isArray(selected) ? selected : [];
      const next = curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v];
      onChange(next);
    } else {
      onChange(v === selected ? "" : v);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Chip
          key={it.value}
          name={name}
          value={it.value}
          selected={isSelected(it.value)}
          onSelect={() => toggle(it.value)}
          variant={variant}
          size={size}
          iconLeft={it.iconLeft}
          iconRight={it.iconRight}
        >
          {it.label}
        </Chip>
      ))}
    </div>
  );
}

export default FilterChips;
