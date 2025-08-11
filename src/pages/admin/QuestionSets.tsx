import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface QuestionSet {
  id: string;
  title: string;
  description?: string | null;
  tags: string[];
  currency: 'USD' | 'GBP' | 'PKR';
  price_cents: number;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export default function QuestionSetsAdmin() {
  const { toast } = useToast();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [currency, setCurrency] = useState<'USD'|'GBP'|'PKR'>('USD');
  const [price, setPrice] = useState<string>("0");
  const [isFree, setIsFree] = useState<boolean>(true);
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');

  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);
  const [newQuestionId, setNewQuestionId] = useState("");

  const visibleSets = useMemo(() => {
    if (priceFilter === 'free') return sets.filter((s) => (s.price_cents ?? 0) === 0);
    if (priceFilter === 'paid') return sets.filter((s) => (s.price_cents ?? 0) > 0);
    return sets;
  }, [sets, priceFilter]);

  useEffect(() => {
    document.title = "Question Sets | Admin | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Create and publish question sets for the reviewed bank.");
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('question_sets').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      setSets((data as any) || []);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createSet = async () => {
    if (!title.trim()) return;
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const { error } = await supabase.from('question_sets').insert({
        title: title.trim(),
        description: description.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        currency,
        price_cents: isFree ? 0 : Math.round(parseFloat(price || '0') * 100) || 0,
        created_by: uid,
      });
      if (error) throw error;
      setTitle(""); setDescription(""); setTags(""); setCurrency('USD'); setPrice("0"); setIsFree(true);
      toast({ title: 'Created', description: 'Question set created.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    }
  };

  const publish = async (id: string, publish: boolean) => {
    try {
      const { error } = await supabase.from('question_sets').update({ status: publish ? 'published' : 'draft' }).eq('id', id);
      if (error) throw error;
      toast({ title: publish ? 'Published' : 'Unpublished' });
      await load();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  const addQuestion = async () => {
    if (!activeSet || !newQuestionId.trim()) return;
    try {
      const { error } = await supabase.from('question_set_items').insert({ set_id: activeSet.id, question_id: newQuestionId.trim() });
      if (error) throw error;
      toast({ title: 'Added', description: 'Question added to set.' });
      setNewQuestionId("");
    } catch (e: any) {
      toast({ title: 'Add failed', description: e.message, variant: 'destructive' });
    }
  };

  const removeQuestion = async (qid: string) => {
    if (!activeSet) return;
    try {
      const { error } = await supabase.from('question_set_items').delete().match({ set_id: activeSet.id, question_id: qid });
      if (error) throw error;
      toast({ title: 'Removed', description: 'Question removed from set.' });
    } catch (e: any) {
      toast({ title: 'Remove failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Question Sets</h1>
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Create new set</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
              <SelectTrigger disabled={isFree}>
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="PKR">PKR</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" step="0.01" min="0" placeholder="Price" value={isFree ? "0" : price} onChange={(e) => setPrice(e.target.value)} disabled={isFree} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="free-set" checked={isFree} onCheckedChange={(v) => { const c = Boolean(v); setIsFree(c); if (c) setPrice("0"); }} />
            <Label htmlFor="free-set">Free set</Label>
          </div>
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <div>
            <Button onClick={createSet}>Create</Button>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="text-sm font-medium">Sets</div>
            <div className="flex gap-2">
              <Button size="sm" variant={priceFilter==='all' ? 'secondary' : 'outline'} onClick={() => setPriceFilter('all')}>All</Button>
              <Button size="sm" variant={priceFilter==='free' ? 'secondary' : 'outline'} onClick={() => setPriceFilter('free')}>Free</Button>
              <Button size="sm" variant={priceFilter==='paid' ? 'secondary' : 'outline'} onClick={() => setPriceFilter('paid')}>Paid</Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSets.map((s) => (
                <TableRow key={s.id} className={activeSet?.id === s.id ? 'bg-accent/30' : ''}>
                  <TableCell>
                    <button className="text-left hover:underline" onClick={() => setActiveSet(s)}>{s.title}</button>
                  </TableCell>
                  <TableCell>{s.price_cents === 0 ? (<Badge variant="secondary">Free</Badge>) : (<span>{s.currency} {(s.price_cents / 100).toFixed(2)}</span>)}</TableCell>
                  <TableCell className="max-w-[360px] truncate" title={(s.tags || []).join(', ')}>{(s.tags || []).join(', ') || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'published' ? 'default' : 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {s.status === 'published' ? (
                      <Button variant="outline" size="sm" onClick={() => publish(s.id, false)}>Unpublish</Button>
                    ) : (
                      <Button size="sm" onClick={() => publish(s.id, true)}>Publish</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {visibleSets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No sets found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {activeSet && (
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Manage set: {activeSet.title}</h3>
            <div className="flex items-center gap-2">
              <Input placeholder="Add question by ID" value={newQuestionId} onChange={(e) => setNewQuestionId(e.target.value)} className="max-w-sm" />
              <Button onClick={addQuestion}>Add</Button>
            </div>
            {/* In a future pass, we can fetch and list the actual items with join data */}
            <p className="text-sm text-muted-foreground">Tip: Paste a question ID from the Reviewed Question Bank to add it to this set.</p>
          </Card>
        )}
      </main>
      <Footer />
      <link rel="canonical" href={`${window.location.origin}/admin/question-sets`} />
    </div>
  );
}
