import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { User } from "lucide-react";

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
    <Link 
      to={`/profile/${id}`} 
      onClick={() => onClick?.(id)} 
      className={`flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:bg-accent/60 rounded-full p-1 -m-1 ${className || ""}`} 
      aria-label={`Open profile of ${name}`}
    >
      <Avatar className="h-6 w-6">
        <AvatarImage src={avatar || undefined} alt={name} />
        <AvatarFallback className="bg-muted">
          {avatar ? initials : <User className="h-3 w-3" />}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-foreground font-medium">{name}</span>
    </Link>
  );
}
