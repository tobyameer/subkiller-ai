import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Radar,
  Menu,
  X,
  User,
  LogOut,
  LayoutDashboard,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser, useAuthMutations } from "@/hooks/useAuth";
import { isPro } from "@/lib/utils";
import { toast } from "sonner";

interface NavbarProps {
  isLoggedIn?: boolean;
  userName?: string;
  onLogout?: () => void;
}

export function Navbar({ isLoggedIn, userName, onLogout }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { data: fetchedUser, isLoading } = useUser();
  const { logout } = useAuthMutations();

  // While loading, show public navbar (don't wait for auth)
  // Only show authenticated navbar if explicitly logged in or user data is confirmed
  const effectiveLoggedIn =
    isLoggedIn ?? (isLoading ? false : Boolean(fetchedUser));
  const effectiveName = userName ?? fetchedUser?.email ?? "User";
  const userIsPro = isPro(fetchedUser);

  const baseNavLinks = effectiveLoggedIn
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/subscriptions", label: "Subscriptions" },
        { href: "/pricing", label: "Pricing" },
      ]
    : [{ href: "/pricing", label: "Pricing" }];

  // Add AI Copilot only for Pro users
  const navLinks =
    effectiveLoggedIn && userIsPro
      ? [
          ...baseNavLinks.slice(0, 2),
          { href: "/ai-copilot", label: "AI Copilot" },
          ...baseNavLinks.slice(2),
        ]
      : baseNavLinks;

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch (err) {
      // ignore
    } finally {
      onLogout?.();
      navigate("/login");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Radar className="w-8 h-8 text-primary transition-transform group-hover:rotate-45 duration-500" />
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Sub<span className="text-primary">Killer</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.href
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex items-center gap-3">
            {effectiveLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm">{effectiveName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-destructive"
                    onSelect={() => handleLogout()}
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button variant="hero" asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === link.href
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                {effectiveLoggedIn ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleLogout()}
                  >
                    Log out
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="flex-1" asChild>
                      <Link to="/login">Log in</Link>
                    </Button>
                    <Button variant="hero" className="flex-1" asChild>
                      <Link to="/auth">Get started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
