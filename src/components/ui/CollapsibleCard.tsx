import { ReactNode, useState, KeyboardEvent, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleCardProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleIcon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}

export default function CollapsibleCard({
  title,
  children,
  defaultOpen = false,
  className,
  titleIcon,
  badge,
  actions
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [maxHeight, setMaxHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    // Measure content height dynamically
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setMaxHeight(isOpen ? 0 : height + 32); // Add padding
    }
  };

  useEffect(() => {
    // Set initial height after mount
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setMaxHeight(defaultOpen ? height + 32 : 0);
    }
  }, [defaultOpen, children]); // Include children to recalculate when content changes

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleOpen();
    }
  };

  return (
    <Card className={cn("rounded-2xl shadow-md", className)}>
      <div 
        className="p-4 sm:p-6 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {titleIcon}
            <h2 className="font-semibold text-base">{title}</h2>
            {badge}
          </div>
          <div className="flex items-center gap-2">
            {actions && (
              <div onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={isOpen ? "Collapse section" : "Expand section"}
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      <div 
        className="overflow-hidden motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out"
        style={{ 
          maxHeight: `${maxHeight}px`,
          opacity: isOpen ? 1 : 0
        }}
        id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div ref={contentRef} className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="border-t pt-4">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}