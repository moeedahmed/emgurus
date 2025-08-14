import { useState } from "react";
import { BookOpen, Mail, Twitter, Linkedin, Youtube, Instagram, Link as LinkIcon, PlaySquare } from "lucide-react";
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
    <footer className="bg-primary/90 text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Top Section */}
        <div className="grid gap-y-4 md:gap-y-3 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <div className="text-lg font-semibold">EM Gurus</div>
            <div className="flex flex-wrap items-center gap-3 opacity-90 text-sm">
              <Button asChild aria-label="YouTube" variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary">
                <a href="https://youtube.com/@emgurus" target="_blank" rel="noopener noreferrer">
                  <Youtube className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="Instagram" variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary">
                <a href="https://instagram.com/emgurus" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="X (Twitter)" variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary">
                <a href="https://x.com/emgurus" target="_blank" rel="noopener noreferrer">
                  <Twitter className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="TikTok" variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary">
                <a href="https://tiktok.com/@emgurus" target="_blank" rel="noopener noreferrer">
                  <PlaySquare className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="LinkedIn" variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary">
                <a href="https://linkedin.com/in/emgurus" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="Linktree" variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary">
                <a href="https://linktr.ee/emgurus" target="_blank" rel="noopener noreferrer">
                  <LinkIcon className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="Email" variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary">
                <a href="mailto:emgurus@gmail.com">
                  <Mail className="w-5 h-5" />
                </a>
              </Button>
            </div>
            </div>
          </div>
          
          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-4 col-span-3">
            {/* Each column */}
            <div className="space-y-2">
              <div className="text-sm/6 font-semibold opacity-90">Product</div>
              <ul className="space-y-1.5 text-sm opacity-90">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary rounded"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

            <div className="space-y-2">
              <div className="text-sm/6 font-semibold opacity-90">Company</div>
              <ul className="space-y-1.5 text-sm opacity-90">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary rounded"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

            <div className="space-y-2">
              <div className="text-sm/6 font-semibold opacity-90">Resources</div>
              <ul className="space-y-1.5 text-sm opacity-90">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary rounded"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="hidden md:block border-t border-primary-foreground/20 pt-6 mb-6">
          <div className="max-w-md">
            <h3 className="font-semibold mb-2">Stay Updated</h3>
            <p className="text-primary-foreground/80 mb-4 text-sm">
              Get the latest medical education insights and platform updates.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                aria-label="Email address"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubscribe(); }}
                className="flex-1 px-3 py-2 rounded-md bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary-foreground/50"
              />
              <Button variant="secondary" className="whitespace-nowrap" onClick={handleSubscribe} disabled={loading}>
                {loading ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-primary-foreground/20 pt-4">
          <div className="text-xs opacity-80 flex flex-wrap items-center justify-between gap-3">
            <span>© 2025 EM Gurus. All rights reserved.</span>
            <div className="flex flex-wrap gap-3">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-foreground/50 ring-offset-primary rounded"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;