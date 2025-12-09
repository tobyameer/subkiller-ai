import { Outlet, Link } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-6xl justify-between px-6 py-6">
        <Link to="/" className="text-lg font-bold text-sky-300">
          SubKiller
        </Link>
        <Link to="/" className="text-sm text-slate-400 hover:text-sky-100">
          Back to site
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 pb-16">
        <Outlet />
      </div>
    </div>
  );
}
