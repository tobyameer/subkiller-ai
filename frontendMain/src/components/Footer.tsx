import { Link } from "react-router-dom";
import { Radar } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Subscriptions", href: "/subscriptions" },
    { label: "AI Copilot", href: "/ai-copilot" },
    { label: "Pricing", href: "/pricing" },
  ],
  company: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Radar className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold text-foreground">
                Sub<span className="text-primary">Killer</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your AI Money Radar. See every charge, kill the waste, and take control of your spending.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SubKiller. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with precision for your wallet
          </p>
        </div>
      </div>
    </footer>
  );
}
