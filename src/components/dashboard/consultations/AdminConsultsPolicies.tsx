import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function AdminConsultsPolicies() {
  return (
    <div className="p-4 space-y-4">
      <Card className="p-4 space-y-2 opacity-70 pointer-events-none">
        <div className="font-medium">Public disclaimer (coming soon)</div>
        <Textarea placeholder="Shown on consults booking page" />
      </Card>
      <Card className="p-4 space-y-2 opacity-70 pointer-events-none">
        <div className="font-medium">Guru onboarding notes (coming soon)</div>
        <Textarea placeholder="Shown to gurus in onboarding" />
      </Card>
      <Card className="p-4 space-y-2 opacity-70 pointer-events-none">
        <div className="font-medium">Cancellation policy (coming soon)</div>
        <Textarea placeholder="Shown to learners on booking" />
      </Card>
    </div>
  );
}
