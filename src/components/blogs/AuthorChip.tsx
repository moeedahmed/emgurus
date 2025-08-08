import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  id: string;
  name: string;
  avatar?: string | null;
  onClick?: (id: string) => void;
  className?: string;
}

export default function AuthorChip({ id, name, avatar, onClick, className }: Props) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  return (
    <button onClick={() => onClick?.(id)} className={`flex items-center gap-2 hover-scale ${className || ""}`} aria-label={`Open profile of ${name}`}>
      <Avatar className="h-6 w-6">
        <AvatarImage src={avatar || undefined} alt={name} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm text-foreground">{name}</span>
    </button>
  );
}
