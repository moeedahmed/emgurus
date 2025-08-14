import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";
import { submitPost } from "@/lib/blogsApi";

type BlogStatus = 'draft' | 'in_review' | 'published' | 'rejected';

export default function MyBlogs() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<BlogStatus>('draft');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setRows([]); return; }
      
      if (activeFilter === 'rejected') {
        // Show drafts that have review notes (i.e., rejected/requested changes) for resubmission
        const { data } = await supabase
          .from('blog_posts')
          .select('id,title,slug,updated_at,review_notes')
          .eq('author_id', user.id)
          .eq('status', 'draft')
          .not('review_notes', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(50);
        if (!cancelled) setRows((data as any) || []);
        return;
      }
      
      const orderCol = activeFilter === 'published' ? 'published_at' : (activeFilter === 'in_review' ? 'submitted_at' : 'updated_at');
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,slug,updated_at,submitted_at,published_at')
        .eq('author_id', user.id)
        .eq('status', activeFilter)
        .order(orderCol as any, { ascending: false })
        .limit(50);
      if (!cancelled) setRows((data as any) || []);
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeFilter]);

  const filterChips = [
    { id: 'draft' as BlogStatus, label: 'Draft', desc: 'Private posts you\'re still working on.' },
    { id: 'in_review' as BlogStatus, label: 'Submitted', desc: 'Posts awaiting review by the team.' },
    { id: 'published' as BlogStatus, label: 'Published', desc: 'Your posts that are live on EMGurus.' },
    { id: 'rejected' as BlogStatus, label: 'Rejected', desc: 'Changes requested. Edit and resubmit when ready.' },
  ];

  const columns = activeFilter === 'rejected'
    ? [
        { key: 'title', header: 'Title' },
        { key: 'updated_at', header: 'Updated', render: (r: any) => new Date(r.updated_at).toLocaleString() },
        { key: 'review_notes', header: 'Note', render: (r: any) => (r.review_notes || '').split('\n').slice(-1)[0] || '-' },
        { key: 'actions', header: 'Actions', render: (r: any) => (
          <div className="flex gap-2">
            <a className="underline" href={`/blogs/editor/${r.id}`}>Edit</a>
            <button
              className="underline"
              onClick={async () => {
                try {
                  await submitPost(r.id);
                  // Notify admins (in-app + email if configured)
                  const title = r.title || 'A blog';
                  const body = `<p>Blog resubmitted: <strong>${title}</strong></p>`;
                  try {
                    const { notifyAdmins } = await import("@/lib/notifications");
                    await notifyAdmins({
                      subject: "Blog resubmitted",
                      html: body,
                      inApp: { type: 'blog_resubmitted', title: 'Blog resubmitted', body: `Resubmitted: ${title}`, data: { post_id: r.id } },
                    });
                  } catch (e) { console.warn('notifyAdmins failed', e); }
                  // Optimistic remove
                  setRows(prev => prev.filter(x => x.id !== r.id));
                } catch (e: any) {}
              }}
            >Resubmit</button>
          </div>
        ) },
      ]
    : [
        { key: 'title', header: 'Title' },
        { key: 'updated_at', header: 'Updated', render: (r: any) => new Date(r.published_at || r.submitted_at || r.updated_at).toLocaleString() },
        { key: 'slug', header: 'Link', render: (r: any) => (r.slug ? <a className="underline" href={`/blogs/${r.slug}`}>Open</a> : '-') },
      ];

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">
        Create and track your blog posts.
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {filterChips.map(chip => (
          <Button
            key={chip.id}
            size="sm"
            variant={activeFilter === chip.id ? "default" : "outline"}
            onClick={() => setActiveFilter(chip.id)}
            aria-pressed={activeFilter === chip.id}
          >
            {chip.label}
          </Button>
        ))}
      </div>
      
      <div className="mb-2 text-sm text-muted-foreground">
        {filterChips.find(c => c.id === activeFilter)?.desc}
      </div>
      
      <TableCard
        title={filterChips.find(c => c.id === activeFilter)?.label || 'Posts'}
        columns={columns}
        rows={rows}
        emptyText="Nothing here yet."
      />
    </div>
  );
}