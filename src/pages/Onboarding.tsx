import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ExperienceSelect } from "@/components/forms/ExperienceSelect";

const countries = ["United Kingdom","United States","United Arab Emirates","India","Pakistan","Canada","Australia"];
const specialties = ["Emergency Medicine","Internal Medicine","Surgery","Pediatrics","Radiology"];
const exams = ["MRCEM (UK)","FRCEM (UK)","FCPS (Pakistan)","MRCS (EM)","FCEM (India)","ABEM (US)","FACEM (Australia)","PLAB","USMLE","Other"];
const timezones = ["UTC","Europe/London","America/New_York","Asia/Dubai","Asia/Kolkata","Asia/Karachi","Australia/Sydney"];

export default function Onboarding() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [tz, setTz] = useState("");
  const [examsSel, setExamsSel] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [position, setPosition] = useState("");
  const [hospital, setHospital] = useState("");
  const [years, setYears] = useState<number | "">("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [otherExam, setOtherExam] = useState("");
  const [otherLanguage, setOtherLanguage] = useState("");

  useEffect(() => {
    document.title = "Complete your profile | EMGurus";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','description'); document.head.appendChild(meta); }
    meta.setAttribute('content','Finish onboarding to access EMGurus.');
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.href;
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
        setCountry(data.country || "");
        setSpecialty(data.specialty || "");
        setTz(data.timezone || "");
        setExamsSel(data.exams || []);
        setBio(data.bio || "");
        setPosition(data.position || "");
        setHospital((data as any).hospital || "");
        setYears((data.years_experience as any) || "");
        setLanguages((data.languages as any) || []);
        setLinkedin(data.linkedin || "");
        setTwitter(data.twitter || "");
        setWebsite(data.website || "");
      }
    })();
  }, [user]);

  const toggleExam = (ex: string) => {
    setExamsSel((prev) => prev.includes(ex) ? prev.filter(x => x !== ex) : [...prev, ex]);
  };
  const toggleLang = (lng: string) => {
    setLanguages((prev) => prev.includes(lng) ? prev.filter(x => x !== lng) : [...prev, lng]);
  };

  const requiredOk = fullName && country && specialty && tz && examsSel.length > 0;

  const onSave = async () => {
    if (!user) return;
    if (!requiredOk) {
      toast({ title: 'Please complete all required fields.' });
      return;
    }
    try {
      setSaving(true);
      const finalExams = examsSel.filter(e => e !== 'Other').concat(otherExam.trim() ? [otherExam.trim()] : []);
      const finalLanguages = languages.filter(l => l !== 'Other').concat(otherLanguage.trim() ? [otherLanguage.trim()] : []);
      if (finalExams.length === 0) { toast({ title: 'Please add at least one exam.' }); setSaving(false); return; }
      const payload: any = {
        full_name: fullName,
        country,
        specialty,
        timezone: tz,
        exams: finalExams,
        bio,
        position,
        hospital,
        years_experience: years === "" ? null : Number(years),
        languages: finalLanguages,
        linkedin,
        twitter,
        website,
      };
      const { error } = await supabase.from('profiles').update(payload).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Profile saved' });
      window.location.href = '/';
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 min-h-[calc(100vh-4rem)] pb-[env(safe-area-inset-bottom)]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Complete your profile</h1>
        <p className="text-muted-foreground">We need a few details to personalize your experience.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid gap-1">
            <Label>Full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Country *</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {countries.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Specialty *</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger><SelectValue placeholder="Select specialty" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {specialties.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Timezone *</Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {timezones.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Exams *</Label>
            <div className="flex flex-wrap gap-2">
              {exams.map(e => (
                <Badge key={e} variant={examsSel.includes(e) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleExam(e)}>
                  {e}
                </Badge>
              ))}
            </div>
            {examsSel.includes('Other') && (
              <div className="grid gap-1 pt-2">
                <Label>Other exam</Label>
                <Input value={otherExam} onChange={(e) => setOtherExam(e.target.value)} placeholder="Enter other exam" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-1">
            <Label>Position</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Hospital</Label>
            <Input value={hospital} onChange={(e) => setHospital(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Years of Experience</Label>
            <ExperienceSelect value={years} onChange={setYears} />
          </div>
          <div className="grid gap-1">
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-2">
              {["English","Arabic","Hindi","Urdu","French","Spanish","Other"].map(l => (
                <Badge key={l} variant={languages.includes(l) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleLang(l)}>
                  {l}
                </Badge>
              ))}
            </div>
            {languages.includes('Other') && (
              <div className="grid gap-1 pt-2">
                <Label>Other language</Label>
                <Input value={otherLanguage} onChange={(e) => setOtherLanguage(e.target.value)} placeholder="Enter other language" />
              </div>
            )}
          </div>
          <div className="grid gap-1">
            <Label>LinkedIn</Label>
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/username" />
          </div>
          <div className="grid gap-1">
            <Label>X (Twitter)</Label>
            <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/username" />
          </div>
          <div className="grid gap-1">
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://your-site.com" />
          </div>
          <div className="grid gap-1">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} />
          </div>
        </div>
      </section>

      <div className="mt-6">
        <Button onClick={onSave} disabled={saving || !requiredOk}>Save & Continue</Button>
      </div>
    </main>
  );
}
