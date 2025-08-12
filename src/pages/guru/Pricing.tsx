import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [baseRate, setBaseRate] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("usd");
  const [durations, setDurations] = useState<number[]>([30]);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [note, setNote] = useState<string>("");

  const currencies = ["usd","eur","gbp","inr","aed","sar"];
  const durationOptions = [15, 30, 45, 60, 90];

  useEffect(() => {
    document.title = "Consultation Pricing | EMGurus";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("consult_pricing")
        .select("base_rate,currency,session_durations,is_public,note")
        .eq("guru_id", user.id)
        .maybeSingle();
      if (!cancelled && data) {
        setBaseRate((data as any).base_rate ?? 0);
        setCurrency((data as any).currency ?? "usd");
        setDurations(((data as any).session_durations as number[]) || [30]);
        setIsPublic(!!(data as any).is_public);
        setNote((data as any).note ?? "");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const toggleDuration = (d: number) => {
    setDurations((arr) => arr.includes(d) ? arr.filter(x => x !== d) : [...arr, d].sort((a,b)=>a-b));
  };

  const save = async () => {
    if (!user) return;
    if (baseRate < 0) { toast({ title: "Rate must be positive" }); return; }
    if (durations.length === 0) { toast({ title: "Select at least one session duration" }); return; }
    try {
      setLoading(true);
      const payload = {
        guru_id: user.id,
        base_rate: baseRate,
        currency,
        session_durations: durations,
        is_public: isPublic,
        note: note.trim() || null,
      } as any;
      const { error } = await supabase
        .from("consult_pricing")
        .upsert(payload, { onConflict: "guru_id" });
      if (error) throw error;
      toast({ title: "Saved" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Save failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const hourlyPreview = useMemo(() => {
    const hr = baseRate; // already hourly base
    return durations.map((d) => ({ d, price: Math.round((hr * d / 60) * 100) / 100 }));
  }, [baseRate, durations]);

  return (
    <div className="p-4 space-y-4">
      <Card className="p-4 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="rate">Base hourly rate</Label>
            <div className="mt-2 flex gap-2 items-center">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (<SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>))}
                </SelectContent>
              </Select>
              <Input id="rate" type="number" min={0} step="1" value={baseRate} onChange={(e)=>setBaseRate(Number(e.target.value))} className="w-40" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Charged pro‑rata for selected durations.</p>
          </div>
          <div>
            <Label>Session durations (min)</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {durationOptions.map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer select-none">
                  <Checkbox checked={durations.includes(d)} onCheckedChange={()=>toggleDuration(d)} />
                  <span>{d}m</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Visibility</Label>
            <div className="flex items-center gap-2 mt-2">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <span className="text-sm">Show pricing on my public profile</span>
            </div>
            <Label className="mt-4 block">Note (optional)</Label>
            <Textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="e.g., First 15 minutes free for new learners" className="mt-2" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={loading}>{loading ? "Saving…" : "Save Pricing"}</Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-medium mb-3">Preview</h3>
        <div className="flex flex-wrap gap-3">
          {hourlyPreview.map(({ d, price }) => (
            <div key={d} className="rounded-md border px-3 py-2 text-sm">
              {d} min · {currency.toUpperCase()} {price}
            </div>
          ))}
        </div>
      </Card>
      <link rel="canonical" href={`${window.location.origin}/guru/pricing`} />
    </div>
  );
}
