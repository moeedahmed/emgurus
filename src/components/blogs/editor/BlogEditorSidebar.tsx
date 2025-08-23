import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Layers, Type, Image, Video, Volume2, Quote, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRoles } from "@/hooks/useRoles";
import { Block } from "./BlocksPalette";
import BlogCategoryPanel from "../BlogCategoryPanel";

// Block types
const blockTypes = [
  { type: 'text' as const, icon: Type, label: 'Text', description: 'Rich text paragraph' },
  { type: 'image' as const, icon: Image, label: 'Image', description: 'Upload or link image' },
  { type: 'video' as const, icon: Video, label: 'Video', description: 'YouTube/Vimeo embed' },
  { type: 'audio' as const, icon: Volume2, label: 'Audio', description: 'Audio file or URL' },
  { type: 'quote' as const, icon: Quote, label: 'Quote', description: 'Blockquote' },
  { type: 'divider' as const, icon: Minus, label: 'Divider', description: 'Horizontal rule' },
];

interface BlogEditorSidebarProps {
  // Add Blocks props
  onAddBlock: (type: Block['type']) => void;
  
  // Blog Organization props
  selectedCategoryId?: string;
  onCategoryChange: (categoryId: string | undefined) => void;
}

function useCollapsibleState(key: string, defaultOpen = true) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(`blogSidebar:${key}`);
    return stored !== null ? JSON.parse(stored) : defaultOpen;
  });

  const toggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    localStorage.setItem(`blogSidebar:${key}`, JSON.stringify(newState));
  };

  return [isOpen, toggle] as const;
}

export default function BlogEditorSidebar({ onAddBlock, selectedCategoryId, onCategoryChange }: BlogEditorSidebarProps) {
  const { roles } = useRoles();
  const isUser = !roles.includes("admin") && !roles.includes("guru");
  
  const [addBlocksOpen, toggleAddBlocks] = useCollapsibleState("addBlocks", true);
  const [organizationOpen, toggleOrganization] = useCollapsibleState("organization", true);

  return (
    <div className="w-80 space-y-4">
      {/* Add Blocks Section */}
      <Card className="p-4">
        <Collapsible open={addBlocksOpen} onOpenChange={toggleAddBlocks}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-3">
                <Plus className="w-5 h-5 text-primary" />
                <span className="text-lg font-semibold">Add Blocks</span>
              </div>
              {addBlocksOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-4">
            {blockTypes.map((blockType) => (
              <Button
                key={blockType.type}
                variant="outline"
                className="w-full justify-start h-auto p-4 hover:bg-accent/50 transition-colors border-dashed hover:border-solid"
                onClick={() => onAddBlock(blockType.type)}
              >
                <blockType.icon className="w-5 h-5 mr-4 shrink-0 text-primary" />
                <div className="text-left">
                  <div className="font-medium text-sm">{blockType.label}</div>
                  <div className="text-xs text-muted-foreground">{blockType.description}</div>
                </div>
              </Button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Blog Organization Section - Only show for Gurus and Admins */}
      {!isUser && (
        <Card className="p-4">
          <Collapsible open={organizationOpen} onOpenChange={toggleOrganization}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold">Blog Organization</span>
                </div>
                {organizationOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="max-h-[60vh] overflow-y-auto">
                <BlogCategoryPanel
                  selectedCategoryId={selectedCategoryId}
                  onCategoryChange={onCategoryChange}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}