import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type TagInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  maxTags?: number;
  className?: string;
};

// Simple, dependency-free tag input with suggest dropdown
// - Normalizes tags by trimming and collapsing whitespace
// - Prevents duplicates (case-insensitive)
// - Suggestions dropdown is keyboard navigable
export default function TagInput({ value, onChange, placeholder, suggestions = [], maxTags, className }: TagInputProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  const normalizedSet = useMemo(() => new Set(value.map(v => v.toLowerCase())), [value]);

  const filtered = useMemo(() => {
    const term = input.trim().toLowerCase();
    const base = (suggestions || []).filter(Boolean);
    const list = term ? base.filter(s => s.toLowerCase().includes(term)) : base;
    // remove existing
    return Array.from(new Set(list.filter(s => !normalizedSet.has(s.toLowerCase())))).slice(0, 8);
  }, [suggestions, input, normalizedSet]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const add = (raw: string) => {
    const t = normalize(raw);
    if (!t) return;
    if (normalizedSet.has(t.toLowerCase())) return;
    if (maxTags && value.length >= maxTags) return;
    onChange([...value, t]);
    setInput("");
    setOpen(false);
    setActive(0);
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) add(input);
      return;
    }
    if (e.key === "Backspace" && !input && value.length) {
      remove(value.length - 1);
      return;
    }
    if (open && filtered.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % filtered.length); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + filtered.length) % filtered.length); }
      if (e.key === "Tab") { e.preventDefault(); add(filtered[active]); }
    }
  };

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <div className="min-h-10 w-full rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 ring-primary/30 transition">
        <div className="flex flex-wrap items-center gap-2">
          {value.map((t, i) => (
            <Badge key={`${t}-${i}`} variant="secondary" className="flex items-center gap-1">
              {t}
              <button aria-label={`Remove ${t}`} className="ml-1 hover:text-destructive" onClick={() => remove(i)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Input
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onKeyDown={onKeyDown}
            placeholder={placeholder || "Type and press Enter"}
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 flex-1 min-w-[8ch]"
          />
          {!!input.trim() && (
            <Button type="button" size="sm" variant="ghost" onClick={() => add(input)} className="h-8 px-2">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {open && filtered.length > 0 && (
        <div className="relative">
          <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden">
            {filtered.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent", i === active && "bg-accent")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function normalize(s: string): string {
  return s.replace(/[\s\u00A0]+/g, " ").trim();
}
