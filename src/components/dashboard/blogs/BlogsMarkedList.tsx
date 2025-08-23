import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/functionsUrl";
import BlogStatusBadge from "./BlogStatusBadge";

export default function BlogsMarkedList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ unresolved: 0, resolved: 0, total: 0 });
  const { toast } = useToast();

  const loadFeedback = async () => {
    if (!user) { 
      setRows([]);
      setLoading(false);
      return; 
    }
    
    try {
      setLoading(true);
      const response = await callFunction('blogs-api/api/admin/feedback', {}, true, 'GET');
      const items = response.items || [];
      setRows(items);
      
      // Calculate summary
      const unresolved = items.filter((item: any) => item.status === 'new').length;
      const resolved = items.filter((item: any) => item.status === 'resolved').length;
      setSummary({ unresolved, resolved, total: items.length });
    } catch (error) {
      console.error('Error loading feedback:', error);
      setRows([]);
      setSummary({ unresolved: 0, resolved: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [user?.id]);

  const handleResolve = async () => {
    if (!selectedFeedback) return;
    
    setResolving(true);
    try {
      await callFunction(`blogs-api/api/blogs/feedback/${selectedFeedback.id}/resolve`, {
        resolution_note: resolutionNote
      });
      
      toast({ title: "Feedback resolved", description: "The user has been notified." });
      setSelectedFeedback(null);
      setResolutionNote("");
      loadFeedback(); // Refresh the list
    } catch (error) {
      console.error('Error resolving feedback:', error);
      toast({ title: "Failed to resolve feedback", variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="p-0">
      {/* Feedback Summary */}
      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex gap-6 text-sm">
          <span><strong>{summary.unresolved}</strong> unresolved</span>
          <span><strong>{summary.resolved}</strong> resolved</span>
          <span><strong>{summary.total}</strong> total feedback</span>
        </div>
      </div>
      
      <TableCard
        title="Marked"
        columns={[
          { key: 'created_at', header: 'Date', render: (r: any) => new Date(r.created_at).toLocaleString() },
          { key: 'user', header: 'User', render: (r: any) => r.user?.full_name || 'Unknown User' },
          { key: 'post', header: 'Blog Post', render: (r: any) => r.post?.title || 'Unknown Post' },
          { key: 'message', header: 'Feedback', render: (r: any) => (r.message || '').slice(0,120) },
          { key: 'status', header: 'Status', render: (r: any) => <BlogStatusBadge status={r.status} /> },
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
        isLoading={loading}
        emptyText="No unresolved feedback."
      />
    </div>
  );
}