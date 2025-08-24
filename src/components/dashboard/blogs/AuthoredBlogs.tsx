import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TableCard from "@/components/dashboard/TableCard";
import { Button } from "@/components/ui/button";
import { submitPost } from "@/lib/blogsApi";

type BlogStatus = 'draft' | 'in_review' | 'published' | 'rejected';

interface MyBlogsProps {
  filter?: BlogStatus;
}

export default function AuthoredBlogs({ filter = 'draft' }: MyBlogsProps) {
  const { user } = useAuth();
  const activeFilter = filter;
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

  const getTitle = () => {
    switch (activeFilter) {
      case 'draft': return 'Drafts';
      case 'in_review': return 'Submitted';
      case 'published': return 'Published';
      case 'rejected': return 'Rejected';
      default: return 'Posts';
    }
  };

  const columns = activeFilter === 'rejected'
    ? [
        { key: 'title', header: 'Title' },
        { key: 'updated_at', header: 'Updated', render: (r: any) => new Date(r.updated_at).toLocaleString() },
        { key: 'review_notes', header: 'Feedback', render: (r: any) => (r.review_notes || '').split('\n').slice(-1)[0] || '-' },
        { key: 'actions', header: 'Actions', render: (r: any) => (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/blogs/editor/${r.id}`}>Edit</a>
            </Button>
            <Button
              variant="default"
              size="sm"
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
            >Resubmit</Button>
          </div>
        ) },
      ]
      : [
        { key: 'title', header: 'Title' },
        { key: 'updated_at', header: 'Updated', render: (r: any) => new Date(r.published_at || r.submitted_at || r.updated_at).toLocaleString() },
        { key: 'slug', header: 'Link', render: (r: any) => (r.slug ? <Button asChild variant="link" size="sm"><a href={`/blogs/${r.slug}`}>View</a></Button> : '-') },
      ];

  return (
    <div className="p-4">
      {filter === 'draft' && (
        <div className="mb-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">Create and manage your blog drafts</div>
          <Button asChild variant="default" size="sm">
            <a href="/blogs/editor/new">Write Blog</a>
          </Button>
        </div>
      )}
      <TableCard
        title={getTitle()}
        columns={columns}
        rows={rows}
        emptyText="Nothing here yet."
      />
    </div>
  );
}