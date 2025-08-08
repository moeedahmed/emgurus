import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Guru = {
  id: string;
  full_name: string;
  specialty?: string | null;
  country?: string | null;
  price_per_30min?: number | null;
  exams?: string[] | null;
  bio?: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
};

function getFlag(country?: string | null): string {
  const map: Record<string, string> = {
    UK: "🇬🇧",
    GB: "🇬🇧",
    "United Kingdom": "🇬🇧",
    USA: "🇺🇸",
    US: "🇺🇸",
    "United States": "🇺🇸",
    UAE: "🇦🇪",
    "United Arab Emirates": "🇦🇪",
    India: "🇮🇳",
    Pakistan: "🇵🇰",
  };
  return (country && map[country]) || "🌍";
}

export function GuruCard({ guru, onBook, disabled }: {
  guru: Guru;
  onBook: (g: Guru) => void;
  disabled?: boolean;
}) {
  const initials = guru.full_name
    ?.split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={guru.avatar_url || undefined} alt={`${guru.full_name} avatar`} />
          <AvatarFallback>{initials || "GU"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg truncate">{guru.full_name}</h3>
            <span title={guru.country || undefined}>{getFlag(guru.country)}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{guru.specialty || "Emergency Medicine"}</p>
        </div>
      </div>

      {guru.exams && guru.exams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {guru.exams.slice(0, 4).map((e) => (
            <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
          ))}
          {guru.exams.length > 4 && <Badge variant="outline" className="text-xs">+{guru.exams.length - 4}</Badge>}
        </div>
      )}

      {guru.bio && (
        <p className={cn("text-sm text-muted-foreground", "line-clamp-3")}>{guru.bio}</p>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="font-medium">{guru.price_per_30min ? `$${guru.price_per_30min} / 30 min` : "Free"}</span>
        <Button onClick={() => onBook(guru)} disabled={disabled}>
          Book Now
        </Button>
      </div>
    </Card>
  );
}
