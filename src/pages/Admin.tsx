import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Category { id: string; name: string; }

const Admin = () => {
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    document.title = "Admin | EMGurus";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", "Admin tools: manage categories and seed test users.");
  }, []);

  const load = async () => {
    const { data } = await supabase.from("blog_categories").select("id,name").order("name");
    setCategories((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("blog_categories").insert({ name, slug });
    if (error) return toast.error("Add failed");
    setName("");
    toast.success("Category added");
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("blog_categories").delete().eq("id", id);
    if (error) return toast.error("Delete failed");
    toast.success("Deleted");
    load();
  };

  const seed = async () => {
    try {
      const res = await fetch(`https://${"cgtvvpzrzwyvsbavboxa"}.supabase.co/functions/v1/seed-test-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Seed failed");
      toast.success("Seeded test users: admin, guru, user (password: Test1234!)");
    } catch (e) {
      toast.error("Seeding failed");
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button onClick={seed}>Seed Test Users</Button>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Categories</h2>
          <div className="flex gap-2">
            <Input placeholder="Add category (e.g., Cardiology)" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={add}>Add</Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((c) => (
              <Card key={c.id} className="p-4 flex items-center justify-between">
                <div>{c.name}</div>
                <Button variant="outline" onClick={() => del(c.id)}>Delete</Button>
              </Card>
            ))}
            {categories.length === 0 && <Card className="p-4">No categories yet.</Card>}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Importer</h2>
          <p className="text-sm text-muted-foreground">Import articles using Firecrawl (requires FIRECRAWL_API_KEY set in Supabase secrets).</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Input id="import-url" defaultValue="https://emgurus.com" placeholder="Site URL to crawl" />
            <Input id="import-limit" defaultValue="20" type="number" placeholder="Max pages" />
            <Button
              onClick={async () => {
                const url = (document.getElementById('import-url') as HTMLInputElement)?.value || 'https://emgurus.com';
                const limit = parseInt((document.getElementById('import-limit') as HTMLInputElement)?.value || '20', 10);
                try {
                  const { data, error } = await supabase.functions.invoke('import-emgurus', { body: { url, limit } });
                  if (error) throw error;
                  toast.success(`Imported ${data?.imported || 0} articles`);
                } catch (e) {
                  console.error(e);
                  toast.error('Import failed');
                }
              }}
            >
              Import Now
            </Button>
          </div>
        </Card>
      </main>
      <Footer />
      <link rel="canonical" href={`${window.location.origin}/admin`} />
    </div>
  );
};

export default Admin;
