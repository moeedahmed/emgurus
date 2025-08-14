import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, GripVertical, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Block } from "./BlocksPalette";

interface BlockEditorProps {
  block: Block;
  onUpdate: (content: any) => void;
  onRemove: () => void;
  isDragging?: boolean;
}

export default function BlockEditor({ block, onUpdate, onRemove, isDragging }: BlockEditorProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File, blockId: string) => {
    if (!user) return;
    
    setUploading(true);
    try {
      const path = `posts/${blockId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('blog-covers')
        .upload(path, file, { upsert: false });
        
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('blog-covers').getPublicUrl(path);
      return data.publicUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const renderEditor = () => {
    switch (block.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Label>Text Content</Label>
            <Textarea
              placeholder="Write your content in Markdown..."
              value={block.content?.text || ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="min-h-[120px]"
            />
            <div className="text-xs text-muted-foreground">
              Supports Markdown: **bold**, *italic*, # headers, etc.
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={block.content?.url || ''}
                onChange={(e) => onUpdate({ ...block.content, url: e.target.value })}
              />
            </div>
            
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">Or upload a file</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleFileUpload(file, block.id);
                    if (url) {
                      onUpdate({ ...block.content, url });
                    }
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Image'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Caption (optional)</Label>
              <Input
                placeholder="Image caption"
                value={block.content?.caption || ''}
                onChange={(e) => onUpdate({ ...block.content, caption: e.target.value })}
              />
            </div>

            {block.content?.url && (
              <img
                src={block.content.url}
                alt={block.content.caption || 'Uploaded image'}
                className="w-full max-h-64 object-cover rounded border"
              />
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input
              placeholder="YouTube or Vimeo URL"
              value={block.content?.url || ''}
              onChange={(e) => onUpdate({ url: e.target.value })}
            />
            <div className="text-xs text-muted-foreground">
              Supports YouTube and Vimeo URLs
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-2">
            <Label>Audio URL</Label>
            <Input
              placeholder="Audio file URL"
              value={block.content?.url || ''}
              onChange={(e) => onUpdate({ url: e.target.value })}
            />
            <div className="text-xs text-muted-foreground">
              Direct link to audio file (MP3, WAV, etc.)
            </div>
          </div>
        );

      case 'quote':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quote Text</Label>
              <Textarea
                placeholder="Enter the quote text..."
                value={block.content?.text || ''}
                onChange={(e) => onUpdate({ ...block.content, text: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Attribution (optional)</Label>
              <Input
                placeholder="Quote author or source"
                value={block.content?.attribution || ''}
                onChange={(e) => onUpdate({ ...block.content, attribution: e.target.value })}
              />
            </div>
          </div>
        );

      case 'divider':
        return (
          <div className="py-4">
            <hr className="border-border" />
            <div className="text-center text-sm text-muted-foreground mt-2">
              Horizontal divider
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={`p-4 ${isDragging ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <span className="text-sm font-medium capitalize">{block.type}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {renderEditor()}
    </Card>
  );
}