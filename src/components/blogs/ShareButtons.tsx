import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Share2, Copy, Mail, Twitter, Linkedin, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";
export default function ShareButtons({
  title,
  url,
  text,
  size = "default",
  variant = "secondary",
}: {
  title: string;
  url: string;
  text?: string;
  size?: "default" | "sm";
  variant?: "default" | "secondary" | "outline" | "ghost";
}) {
  const shareText = text || "";

  const open = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const sysShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} aria-label="Share this post">
          <Share2 className="h-4 w-4 mr-2" /> Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50">
        <DropdownMenuItem onClick={sysShare}>
          <Share2 className="h-4 w-4 mr-2" /> System Share / Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.whatsapp)}>
          <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.x)}>
          <Twitter className="h-4 w-4 mr-2" /> X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.linkedin)}>
          <Linkedin className="h-4 w-4 mr-2" /> LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.facebook)}>
          <Facebook className="h-4 w-4 mr-2" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(links.email)}>
          <Mail className="h-4 w-4 mr-2" /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>
          <Copy className="h-4 w-4 mr-2" /> Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
