import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ConsultationsFilterPanel({
  search,
  country,
  specialty,
  exam,
  countries,
  specialties,
  exams,
  onChange,
  onReset,
}: {
  search: string;
  country: string;
  specialty: string;
  exam: string;
  countries: string[];
  specialties: string[];
  exams: string[];
  onChange: (k: 'search' | 'country' | 'specialty' | 'exam', v: string) => void;
  onReset: () => void;
}) {
  return (
    <Card className="p-4 space-y-4">
      <div>
        <label className="text-sm text-muted-foreground">Search</label>
        <Input
          placeholder="Search by name or specialty"
          className="mt-1"
          value={search}
          onChange={(e) => onChange('search', e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm text-muted-foreground">Country</label>
        <Select value={country} onValueChange={(v) => onChange('country', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent className="z-50">
            {countries.map((c) => (
              <SelectItem key={c} value={c}>{c === 'all' ? 'All Countries' : c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm text-muted-foreground">Specialty</label>
        <Select value={specialty} onValueChange={(v) => onChange('specialty', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Specialty" /></SelectTrigger>
          <SelectContent className="z-50">
            {specialties.map((s) => (
              <SelectItem key={s} value={s}>{s === 'all' ? 'All Specialties' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm text-muted-foreground">Exam</label>
        <Select value={exam} onValueChange={(v) => onChange('exam', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Exam" /></SelectTrigger>
          <SelectContent className="z-50">
            {exams.map((e) => (
              <SelectItem key={e} value={e}>{e === 'all' ? 'All Exams' : e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={onReset}>Reset</Button>
      </div>
    </Card>
  );
}
