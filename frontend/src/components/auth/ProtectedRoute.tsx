/* eslint-disable no-irregular-whitespace */
// src/components/auth/ProtectedRoute.tsx (STABLE FIX)

import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { useAuthContext } from "../../contexts/AuthContext";
import { HeartBeatLoader } from "../HeartBeatLoader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  // This prop determines if the current route IS the onboarding route
  requireOnboarding?: boolean;
}

export default function ProtectedRoute({
  children,
  requireOnboarding = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    // --- 1. NOT AUTHENTICATED: Redirect to Login (Keep this essential check) ---
    if (!isAuthenticated) {
      console.log(
        "🔒 PROTECTED_ROUTE: User not authenticated. Redirecting to /login.",
      );
      navigate("/login", { state: { from: location }, replace: true });
      return;
    }

    // 🛑 REMOVE REDUNDANT ONBOARDING REDIRECTS 🛑
    // The navigation logic for /onboarding <-> /dashboard is now handled
    // exclusively by the central useEffect in useAuth.tsx.
    // If we are authenticated, we don't need to check user.onboardingCompleted here
    // unless you want to show a flash of content while useAuth redirects.
  }, [isAuthenticated, isLoading, navigate, location]);

  // --- Rendering Loaders (Show loading state while checks are running) ---

  if (isLoading || !isAuthenticated || !user) {
    // This ensures that if auth is in flux, we show the loader.
    return <HeartBeatLoader message="Checking access..." />;
  }

  // --- Block rendering if useAuth is about to redirect ---
  const hasCompletedOnboarding = user.onboardingCompleted === true;

  // If we are currently trying to access /dashboard but need /onboarding (or vice-versa),
  // show the loader until the useAuth useEffect finishes its redirect.
  if (
    (!hasCompletedOnboarding && !requireOnboarding) ||
    (hasCompletedOnboarding && requireOnboarding)
  ) {
    return <HeartBeatLoader message="Routing..." />;
  }

  // If authenticated and passed the *current page* access check, render children
  return <>{children}</>;
}
