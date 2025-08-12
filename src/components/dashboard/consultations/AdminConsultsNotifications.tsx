import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function AdminConsultsNotifications() {
  const events = [
    { key: 'booking_created', label: 'Booking created' },
    { key: 'booking_confirmed', label: 'Booking confirmed' },
    { key: 'booking_rescheduled', label: 'Booking rescheduled' },
    { key: 'booking_cancelled', label: 'Booking cancelled' },
    { key: 'refund_processed', label: 'Refund processed' },
  ];
  return (
    <div className="p-4 space-y-2">
      {events.map(e => (
        <Card key={e.key} className="p-4 flex items-center justify-between opacity-70">
          <div>
            <div className="font-medium">{e.label}</div>
            <div className="text-sm text-muted-foreground">Edit templates (coming soon)</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm">Enabled</div>
            <Switch disabled defaultChecked />
          </div>
        </Card>
      ))}
    </div>
  );
}
