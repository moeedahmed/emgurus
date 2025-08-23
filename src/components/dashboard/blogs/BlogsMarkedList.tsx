import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function BlogsMarkedList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const { toast } = useToast();

  const loadFeedback = async () => {
    if (!user) { setRows([]); return; }
    const { data } = await supabase
      .from('blog_post_feedback')
      .select(`
        id, 
        created_at, 
        post_id, 
        message, 
        status, 
        resolution_note,
        user:profiles(full_name),
        post:blog_posts(title, slug)
      `)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data as any[]) || []);
  };

  useEffect(() => {
    loadFeedback();
  }, [user?.id]);

  const handleResolve = async () => {
    if (!selectedFeedback) return;
    
    setResolving(true);
    try {
      const { error } = await supabase
        .from('blog_post_feedback')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user!.id,
          resolution_note: resolutionNote || null,
        })
        .eq('id', selectedFeedback.id);

      if (error) throw error;

      toast({ title: "Feedback resolved successfully" });
      setSelectedFeedback(null);
      setResolutionNote("");
      loadFeedback();
    } catch (error) {
      console.error('Error resolving feedback:', error);
      toast({ title: "Failed to resolve feedback", variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-2 text-sm text-muted-foreground">Unresolved blog feedback from users.</div>
      <TableCard
        title="Marked Blogs"
        columns={[
          { key: 'created_at', header: 'Date', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'user', header: 'User', render: (r: any) => r.user?.full_name || 'Unknown User' },
          { key: 'post', header: 'Blog Post', render: (r: any) => r.post?.title || 'Unknown Post' },
          { key: 'message', header: 'Feedback', render: (r: any) => (r.message || '').slice(0,120) },
          { 
            key: 'actions', 
            header: 'Actions', 
            render: (r: any) => (
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedFeedback(r)}
                  >
                    Resolve
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Resolve Feedback</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">User Feedback:</p>
                      <p className="text-sm text-muted-foreground">{selectedFeedback?.message}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Blog Post:</p>
                      <p className="text-sm text-muted-foreground">{selectedFeedback?.post?.title}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Resolution Note (optional):</label>
                      <Textarea
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Add a note about how this was resolved..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleResolve} disabled={resolving}>
                        {resolving ? "Resolving..." : "Mark as Resolved"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )
          },
        ] as any}
        rows={rows}
        emptyText="No unresolved feedback."
      />
    </div>
  );
}