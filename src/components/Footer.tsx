import { useState } from "react";
import { BookOpen, Mail, Twitter, Linkedin, Youtube, Instagram, Link as LinkIcon, PlaySquare } from "lucide-react";
import Logo from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Footer = () => {
  const footerLinks = {
    product: [
      { name: "Features", href: "/#features" },
      { name: "Pricing", href: "/#pricing" },
      { name: "API", href: "/coming-soon" },
      { name: "Integrations", href: "/coming-soon" },
    ],
    company: [
      { name: "About", href: "/about" },
      { name: "Blog", href: "/blogs" },
      { name: "Careers", href: "/coming-soon" },
      { name: "Press", href: "/coming-soon" },
    ],
    resources: [
      { name: "Documentation", href: "/coming-soon" },
      { name: "Help Center", href: "/coming-soon" },
      { name: "Community", href: "/forums" },
      { name: "Status", href: "/coming-soon" },
    ],
    legal: [
      { name: "Privacy", href: "/coming-soon" },
      { name: "Terms", href: "/coming-soon" },
      { name: "Security", href: "/coming-soon" },
      { name: "Compliance", href: "/coming-soon" },
    ],
  };

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    const e = email.trim();
    if (!/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(e)) {
      toast({ title: "Please enter a valid email" });
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.from('newsletter_subscribers').insert({ email: e, source_page: window.location.pathname });
      if (error) {
        if ((error as any).code === '23505') {
          toast({ title: 'You are already subscribed' });
        } else {
          throw error;
        }
      } else {
        // Notify admins via email (non-blocking)
        supabase.functions.invoke('newsletter-notify', { body: { email: e, source_page: window.location.pathname } }).catch(() => {});
        toast({ title: 'Subscribed!', description: "We'll keep you posted." });
        setEmail("");
      }
    } catch (err: any) {
      toast({ title: 'Subscription failed', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Brand & Social */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Logo variant="mark" size={28} />
              <span className="logo-text text-sm">EM Gurus</span>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              AI-powered medical education and mentorship.
            </p>
            <div className="flex flex-wrap gap-1">
              <Button asChild aria-label="YouTube" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <a href="https://youtube.com/@emgurus" target="_blank" rel="noopener noreferrer">
                  <Youtube className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild aria-label="Instagram" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <a href="https://instagram.com/emgurus" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild aria-label="X (Twitter)" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <a href="https://x.com/emgurus" target="_blank" rel="noopener noreferrer">
                  <Twitter className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild aria-label="LinkedIn" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <a href="https://linkedin.com/in/emgurus" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild aria-label="Email" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <a href="mailto:emgurus@gmail.com">
                  <Mail className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            <div>
              <h3 className="font-semibold mb-3 text-sm">Platform</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/#features" className="text-muted-foreground hover:text-foreground">Features</Link></li>
                <li><Link to="/#pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
                <li><Link to="/blogs" className="text-muted-foreground hover:text-foreground">Blog</Link></li>
                <li><Link to="/forums" className="text-muted-foreground hover:text-foreground">Community</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-sm">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
                <li><Link to="/coming-soon" className="text-muted-foreground hover:text-foreground">Privacy</Link></li>
                <li><Link to="/coming-soon" className="text-muted-foreground hover:text-foreground">Terms</Link></li>
                <li><Link to="/coming-soon" className="text-muted-foreground hover:text-foreground">Support</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-muted-foreground text-xs">© {new Date().getFullYear()} EM Gurus. All rights reserved.</p>
          <div className="hidden md:flex gap-4 text-xs">
            <input
              type="email"
              placeholder="Subscribe to updates"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubscribe(); }}
              className="px-2 py-1 rounded bg-input border border-border text-xs w-40"
            />
            <Button size="sm" className="h-6 text-xs" onClick={handleSubscribe} disabled={loading}>
              {loading ? '...' : 'Subscribe'}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;