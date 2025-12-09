import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useAppStore } from "../../store/useAppStore";

export function ShellLayout() {
  const loadUser = useAppStore((state) => state.loadUser);
  const userFetched = useAppStore((state) => state.userFetched);
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    // Only fetch user if we haven't fetched yet and don't have a user
    // This is for public pages - protected routes handle their own session checks
    if (!userFetched && !user) {
      loadUser();
    }
  }, [userFetched, user, loadUser]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
