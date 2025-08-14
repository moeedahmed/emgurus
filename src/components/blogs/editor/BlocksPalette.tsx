import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Type, 
  Image, 
  Video, 
  Volume2, 
  Quote, 
  Minus,
  Plus,
  Blocks
} from "lucide-react";

export interface Block {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'quote' | 'divider';
  content: any;
  order: number;
}

interface BlocksPaletteProps {
  blocks: Block[];
  onAddBlock: (type: Block['type']) => void;
  onUpdateBlock: (id: string, content: any) => void;
  onRemoveBlock: (id: string) => void;
  onReorderBlocks: (dragIndex: number, hoverIndex: number) => void;
}

const blockTypes = [
  { type: 'text' as const, icon: Type, label: 'Text', description: 'Rich text paragraph' },
  { type: 'image' as const, icon: Image, label: 'Image', description: 'Upload or link image' },
  { type: 'video' as const, icon: Video, label: 'Video', description: 'YouTube/Vimeo embed' },
  { type: 'audio' as const, icon: Volume2, label: 'Audio', description: 'Audio file or URL' },
  { type: 'quote' as const, icon: Quote, label: 'Quote', description: 'Blockquote' },
  { type: 'divider' as const, icon: Minus, label: 'Divider', description: 'Horizontal rule' },
];

function PaletteContent({ onAddBlock }: { onAddBlock: BlocksPaletteProps['onAddBlock'] }) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-muted-foreground">Add Blocks</div>
      <div className="space-y-2">
        {blockTypes.map((blockType) => {
          const Icon = blockType.icon;
          return (
            <Button
              key={blockType.type}
              variant="outline"
              className="w-full justify-start h-auto p-3"
              onClick={() => onAddBlock(blockType.type)}
            >
              <Icon className="w-4 h-4 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">{blockType.label}</div>
                <div className="text-xs text-muted-foreground">{blockType.description}</div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default function BlocksPalette(props: BlocksPaletteProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="fixed bottom-4 right-4 z-50">
            <Blocks className="w-4 h-4 mr-2" />
            Blocks
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Content Blocks</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PaletteContent onAddBlock={(type) => { props.onAddBlock(type); setIsOpen(false); }} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Card className="w-80 p-4 h-fit">
      <PaletteContent onAddBlock={props.onAddBlock} />
    </Card>
  );
}