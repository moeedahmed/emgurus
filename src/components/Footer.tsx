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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        {/* Top Section */}
        <div className="grid lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Logo variant="mark" size={32} />
              <span className="logo-text">EM Gurus</span>
            </div>
            <p className="hidden sm:block text-muted-foreground mb-6 max-w-md">
              Empowering medical professionals with AI-powered learning, 
              expert mentorship, and collaborative education.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild aria-label="YouTube" variant="ghost" size="icon" className="hover:bg-accent transition-interactive focus-ring">
                <a href="https://youtube.com/@emgurus" target="_blank" rel="noopener noreferrer">
                  <Youtube className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="Instagram" variant="ghost" size="icon" className="hover:bg-accent transition-interactive focus-ring">
                <a href="https://instagram.com/emgurus" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="X (Twitter)" variant="ghost" size="icon" className="hover:bg-accent transition-interactive focus-ring">
                <a href="https://x.com/emgurus" target="_blank" rel="noopener noreferrer">
                  <Twitter className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="TikTok" variant="ghost" size="icon" className="hover:bg-accent transition-interactive focus-ring">
                <a href="https://tiktok.com/@emgurus" target="_blank" rel="noopener noreferrer">
                  <PlaySquare className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="LinkedIn" variant="ghost" size="icon" className="hover:bg-accent transition-interactive focus-ring">
                <a href="https://linkedin.com/in/emgurus" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="Linktree" variant="ghost" size="icon" className="hover:bg-accent transition-interactive focus-ring">
                <a href="https://linktr.ee/emgurus" target="_blank" rel="noopener noreferrer">
                  <LinkIcon className="w-5 h-5" />
                </a>
              </Button>
              <Button asChild aria-label="Email" variant="ghost" size="icon" className="hover:bg-accent transition-interactive focus-ring">
                <a href="mailto:emgurus@gmail.com">
                  <Mail className="w-5 h-5" />
                </a>
              </Button>
            </div>
            {/* Trustpilot widget */}
            <div className="mt-6 hidden sm:block">
              <div
                className="trustpilot-widget"
                data-locale="en-GB"
                data-template-id="53aa8807dec7e10d38f59f32"
                data-businessunit-id=""
                data-style-height="150px"
                data-style-width="100%"
                data-theme="light"
              >
                <a href="https://uk.trustpilot.com/review/emgurus.com" rel="noopener noreferrer" target="_blank">Trustpilot</a>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-muted-foreground hover:text-foreground transition-interactive focus-ring rounded-md"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-foreground">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-muted-foreground hover:text-foreground transition-interactive focus-ring rounded-md"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-foreground">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-muted-foreground hover:text-foreground transition-interactive focus-ring rounded-md"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="hidden md:block border-t border-border pt-8 mb-8">
          <div className="max-w-md">
            <h3 className="font-semibold mb-2 text-foreground">Stay Updated</h3>
            <p className="text-muted-foreground mb-4 text-sm">
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
                className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background transition-interactive"
              />
              <Button variant="default" className="whitespace-nowrap" onClick={handleSubscribe} disabled={loading}>
                {loading ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-border pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} EM Gurus. All rights reserved.</p>
            <div className="flex space-x-6">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-muted-foreground hover:text-foreground transition-interactive text-sm focus-ring rounded-md"
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