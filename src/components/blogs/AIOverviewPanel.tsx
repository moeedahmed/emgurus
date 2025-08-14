import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";

interface AIOverviewPanelProps {
  postId: string;
  content: string;
  className?: string;
}

interface AISummary {
  provider: string;
  model: string;
  summary_md: string;
  created_at: string;
}

export default function AIOverviewPanel({ postId, content, className }: AIOverviewPanelProps) {
  const { user } = useAuth();
  const { roles } = useRoles();
  const isAdmin = roles.includes("admin");
  const isReviewer = roles.includes("guru");
  
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_ai_summaries')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setSummary(data);
    } catch (error) {
      console.error('Failed to load AI summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [postId]);

  const generateSummary = async () => {
    if (!user || !content.trim()) return;
    
    try {
      setGenerating(true);
      
      // Call the blogs API to generate AI summary
      const response = await supabase.functions.invoke('blogs-api', {
        body: { 
          action: 'ai-summary',
          post_id: postId,
          content 
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      await loadSummary();
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!summary) {
    // Only show generate button for admins and reviewers
    if (!isAdmin && !isReviewer) {
      return null;
    }
    
    return (
      <Card className={`p-4 bg-muted/30 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium">Article Overview</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateSummary}
            disabled={generating || !content.trim()}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Overview
              </>
            )}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          Generate an AI-powered overview with key learning points
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 bg-muted/30 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium">Article Overview</span>
          <Badge variant="secondary" className="text-xs">
            AI-generated
          </Badge>
        </div>
        
        {(isAdmin || isReviewer) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={generateSummary}
            disabled={generating}
            className="text-xs"
          >
            {generating ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </Button>
        )}
      </div>
      
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div 
          className="whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ 
            __html: summary.summary_md
              .replace(/^-\s+/gm, '• ')
              .replace(/^\*\s+/gm, '• ') 
          }}
        />
      </div>
      
      <div className="text-xs text-muted-foreground mt-3 pt-2 border-t">
        Generated {new Date(summary.created_at).toLocaleDateString()} using {summary.model}
      </div>
    </Card>
  );
}