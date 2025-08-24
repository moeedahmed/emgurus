import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User } from "lucide-react";
import { generateAuthorBio } from "@/lib/markdownRenderer";
import { cn } from "@/lib/utils";

interface AuthorCardProps {
  id: string;
  name: string;
  avatar?: string | null;
  title?: string;
  bio?: string;
  specialty?: string;
  role?: string; // "author" or "reviewer"
  onClick?: (id: string) => void;
  className?: string;
}

export default function AuthorCard({
  id,
  name,
  avatar,
  title,
  bio,
  specialty,
  role = "author",
  onClick,
  className
}: AuthorCardProps) {
  const handleClick = () => {
    onClick?.(id);
  };

  const displayBio = bio || generateAuthorBio(name, specialty);

  return (
    <Card 
      className={cn(
        "p-6 rounded-2xl cursor-pointer motion-safe:transition-all motion-safe:duration-200 hover-scale",
        "hover:shadow-lg hover:border-primary/20",
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 border-2 border-muted">
          <AvatarImage src={avatar || undefined} />
          <AvatarFallback className="bg-muted/50 text-lg">
            {name ? name.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {role === "reviewer" && (
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Reviewed by
                </div>
              )}
              <h3 className="font-semibold text-lg leading-tight mb-1 group-hover:text-primary motion-safe:transition-colors">
                {name}
              </h3>
              {title && (
                <div className="text-sm text-muted-foreground mb-2 font-medium">
                  {title}
                </div>
              )}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {displayBio}
          </p>
        </div>
      </div>
    </Card>
  );
}