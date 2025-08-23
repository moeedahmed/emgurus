import { ReactNode, useState } from "react";
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

  return (
    <Card className={cn("rounded-2xl shadow-sm", className)}>
      <div 
        className="p-4 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {titleIcon}
            <h3 className="font-medium text-sm">{title}</h3>
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
              className="h-6 w-6 p-0"
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
      
      {isOpen && (
        <div className="px-4 pb-4">
          <div className="border-t pt-3">
            {children}
          </div>
        </div>
      )}
    </Card>
  );
}