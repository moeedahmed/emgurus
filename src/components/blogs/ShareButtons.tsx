import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Share2, Copy, Mail, Twitter, Linkedin, Facebook, MessageCircle, MoreHorizontal } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ShareButtonsProps {
  title: string;
  url: string;
  text?: string;
  postId?: string;
  shareCount?: number;
  onShare?: (platform: string) => void;
  variant?: "dropdown" | "inline";
  size?: "default" | "sm";
  buttonVariant?: "default" | "secondary" | "outline" | "ghost";
}

export default function ShareButtons({
  title,
  url,
  text,
  postId,
  shareCount = 0,
  onShare,
  variant = "dropdown",
  size = "default",
  buttonVariant = "secondary",
}: ShareButtonsProps) {
  const shareText = text || "";

  const trackShare = async (platform: string) => {
    if (postId && onShare) {
      try {
        await onShare(platform);
      } catch (error) {
        console.error("Failed to track share:", error);
      }
    }
  };

  const open = (href: string, platform: string) => {
    trackShare(platform);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      await trackShare("copy");
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const sysShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
        await trackShare("system");
        return;
      } catch {}
    }
    await copy();
  };

  const links = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} ${url}`)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`,
  };

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => open(links.x, "twitter")}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Share on Twitter"
        >
          <Twitter className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => open(links.linkedin, "linkedin")}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => open(links.whatsapp, "whatsapp")}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Share on WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => open(links.facebook, "facebook")}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Share on Facebook"
        >
          <Facebook className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={copy}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Copy link"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={buttonVariant} aria-label="Share this post">
          <Share2 className="h-4 w-4 mr-2" />
          Share
          {shareCount > 0 && <span className="ml-2 text-xs">({shareCount})</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50">
        <DropdownMenuItem onClick={sysShare}>
          <Share2 className="h-4 w-4 mr-2" /> System Share / Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.whatsapp, "whatsapp")}>
          <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.x, "twitter")}>
          <Twitter className="h-4 w-4 mr-2" /> X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.linkedin, "linkedin")}>
          <Linkedin className="h-4 w-4 mr-2" /> LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.facebook, "facebook")}>
          <Facebook className="h-4 w-4 mr-2" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.email, "email")}>
          <Mail className="h-4 w-4 mr-2" /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>
          <Copy className="h-4 w-4 mr-2" /> Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
