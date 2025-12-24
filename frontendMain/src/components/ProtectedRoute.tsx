import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/hooks/useAuth";
import { isPro } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { data: user, isLoading, error } = useUser();
  const location = useLocation();

  // If there's an error or request failed, treat as not authenticated
  if (error || (!isLoading && !user)) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Show loading state briefly, but don't hang forever
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Checking session...</div>
      </div>
    );
  }

  return <>{children}</>;
}

interface PublicProps {
  children: ReactNode;
}

export function PublicRoute({ children }: PublicProps) {
  const { data: user, isLoading, error } = useUser();

  // If there's an error, treat as not authenticated and show public route
  if (error) {
    return <>{children}</>;
  }

  // If loading, show public content (don't block on auth check)
  if (isLoading) {
    return <>{children}</>;
  }

  // If authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

interface ProOnlyProps {
  children: ReactNode;
}

export function ProOnlyRoute({ children }: ProOnlyProps) {
  const { data: user, isLoading, error } = useUser();
  const location = useLocation();
  const hasShownToast = useRef(false);

  // Show toast once when user is not Pro (must be called unconditionally)
  useEffect(() => {
    if (!isLoading && user && !isPro(user) && !hasShownToast.current) {
      toast.info("Upgrade to Pro to unlock AI Copilot");
      hasShownToast.current = true;
    }
  }, [user, isLoading]);

  // If there's an error or request failed, treat as not authenticated
  if (error || (!isLoading && !user)) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Checking session...</div>
      </div>
    );
  }

  // Check if user is Pro
  if (!isPro(user)) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}
