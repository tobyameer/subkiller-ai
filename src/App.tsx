import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import PricingPage from "./pages/PricingPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import AICopilotPage from "./pages/AICopilotPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import { ShellLayout } from "./components/layout/ShellLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { useAppStore } from "./store/useAppStore";

function ProtectedRoute() {
  const user = useAppStore((state) => state.user);
  const userFetched = useAppStore((state) => state.userFetched);
  const loadingUser = useAppStore((state) => state.loadingUser);
  const loadUser = useAppStore((state) => state.loadUser);
  const location = useLocation();

  useEffect(() => {
    // Only fetch user if we haven't fetched yet and don't have a user
    if (!userFetched && !user) {
      loadUser();
    }
  }, [userFetched, user, loadUser]);

  // Show loading only if we're actively loading and haven't fetched yet
  if (loadingUser && !userFetched) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-300">
        Checking session...
      </div>
    );
  }

  // If we've fetched and there's no user, redirect to login
  if (userFetched && !user) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  // If we have a user, render the protected content
  if (user) {
    return <Outlet />;
  }

  // Fallback: still loading initial state
  return (
    <div className="flex min-h-[200px] items-center justify-center text-slate-300">
      Checking session...
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
      </Route>

      <Route element={<ShellLayout />}>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/ai" element={<AICopilotPage />} />
        </Route>
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}

export default App;
