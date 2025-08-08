import { useState } from "react";
import { reactToPost, type ReactionKey } from "@/lib/blogsApi";
import { toast } from "sonner";

const emojiMap: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: "thumbs_up", emoji: "👍", label: "Thumbs up" },
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "insightful", emoji: "👏", label: "Clap" },
  { key: "curious", emoji: "🤔", label: "Curious" },
];

export default function ReactionBar({
  postId,
  counts,
  onCountsChange,
  compact = false,
}: {
  postId: string;
  counts: { likes: number; comments?: number; views?: number };
  onCountsChange?: (next: { likes: number; comments?: number; views?: number }) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const onReact = async (key: ReactionKey) => {
    if (busy) return;
    try {
      setBusy(true);
      const prev = counts.likes;
      // Optimistic: for positive reactions (except thumbs_down) bump like count
      const optimistic = key === "thumbs_down" ? prev : prev + 1;
      onCountsChange?.({ ...counts, likes: optimistic });
      const res = await reactToPost(postId, key);
      // Toggle: if un-toggled, revert
      if (!res.toggled && key !== "thumbs_down") onCountsChange?.({ ...counts, likes: Math.max(0, prev) });
    } catch (e: any) {
      toast.error(e.message || "Reaction failed");
      onCountsChange?.({ ...counts });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "opacity-90" : ""}`}>
      {emojiMap.map(({ key, emoji, label }) => (
        <button
          key={key}
          onClick={() => onReact(key)}
          className="text-lg leading-none hover:scale-110 transition-transform"
          aria-label={label}
          disabled={busy}
        >
          {emoji}
        </button>
      ))}
      {!compact && (
        <span className="text-xs text-muted-foreground ml-1">{counts.likes}</span>
      )}
    </div>
  );
}
