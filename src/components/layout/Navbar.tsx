import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useAppStore } from "../../store/useAppStore";

export function Navbar() {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();
  const isAuthenticated = Boolean(user);
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard", authOnly: true },
    { to: "/subscriptions", label: "Subscriptions", authOnly: true },
    { to: "/suggestions", label: "Suggestions", authOnly: true },
    { to: "/ai", label: "AI Copilot", authOnly: true },
    { to: "/pricing", label: "Pricing" },
  ].filter((link) => !link.authOnly || isAuthenticated);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-10">
          <div
            className="cursor-pointer text-lg font-bold tracking-tight text-sky-300"
            onClick={() => navigate("/")}
          >
            SubKiller
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "transition hover:text-sky-100",
                    isActive ? "text-sky-300" : "text-slate-300",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                className="hidden text-sm font-semibold text-slate-200 hover:text-sky-100 sm:inline-flex"
                onClick={() => navigate("/auth/login")}
              >
                Log in
              </Button>
              <Button size="sm" onClick={() => navigate("/auth/register")}>
                Get Started
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="hidden flex-col text-right text-xs text-slate-300 sm:flex">
                <span className="font-semibold text-slate-100">{user?.name}</span>
                <span className="text-slate-400">{user?.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
