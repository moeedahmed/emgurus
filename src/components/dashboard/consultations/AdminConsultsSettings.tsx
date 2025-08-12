import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminConsultsSettings() {
  const fields = [
    { label: 'Default slot length (minutes)' },
    { label: 'Buffer time (minutes)' },
    { label: 'Cancellation window (hours)' },
    { label: 'Max bookings/day per guru' },
    { label: 'Currency' },
  ];
  return (
    <div className="p-4 space-y-2">
      {fields.map((f, idx) => (
        <Card key={idx} className="p-4 grid gap-2 opacity-70 pointer-events-none">
          <div className="font-medium">{f.label}</div>
          <Input placeholder="Coming soon" />
        </Card>
      ))}
    </div>
  );
}
