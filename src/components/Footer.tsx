import { useState } from "react";
import { BookOpen, Mail, Twitter, Linkedin, Youtube, Instagram, Link as LinkIcon, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
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
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Top Section */}
        <div className="grid lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary-foreground rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-bold">EM Gurus</span>
            </div>
            <p className="text-primary-foreground/80 mb-6 max-w-md">
              Empowering medical professionals with AI-powered learning, 
              expert mentorship, and collaborative education.
            </p>
            <div className="flex flex-wrap gap-2">
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
            {/* Trustpilot widget */}
            <div className="mt-6">
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
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
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

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
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

          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-3">
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
        <div className="border-t border-primary-foreground/20 pt-12 mb-12">
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
        <div className="border-t border-primary-foreground/20 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-primary-foreground/80 text-sm">
              © 2024 EM Gurus. All rights reserved.
            </p>
            <div className="flex space-x-6">
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