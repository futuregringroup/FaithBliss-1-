import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { HeartBeatLoader } from './HeartBeatLoader';

const ONBOARDING_PAUSE_STORAGE_KEY = 'faithbliss_onboarding_pause_state';

const hasUserRole = (user: { role?: string; roles?: string[] } | null | undefined, role: string) => {
  const normalizedRole = role.trim().toLowerCase();
  const primaryRole = String(user?.role || 'user').trim().toLowerCase();
  const extraRoles = Array.isArray(user?.roles)
    ? user.roles.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : [];

  return primaryRole === normalizedRole || extraRoles.includes(normalizedRole);
};

export const AuthGate: React.FC = () => {
  const { isLoading, isAuthenticated, user } = useAuthContext();
  const location = useLocation();
  const path = location.pathname;

  if (isLoading) {
    return <HeartBeatLoader message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && user.emailVerified !== true) {
    if (!path.startsWith('/verify-email')) {
      return <Navigate to="/verify-email" replace />;
    }

    return <Outlet />;
  }

  if (user && !user.onboardingCompleted) {
    let allowPausedDashboardAccess = false;
    try {
      const rawPauseState = localStorage.getItem(ONBOARDING_PAUSE_STORAGE_KEY);
      if (rawPauseState) {
        const parsed = JSON.parse(rawPauseState) as { uid?: string };
        allowPausedDashboardAccess = parsed.uid === user.id && path.startsWith('/dashboard');
      }
    } catch {
      allowPausedDashboardAccess = false;
    }

    if (allowPausedDashboardAccess) {
      return <Outlet />;
    }

    if (!path.startsWith('/onboarding')) {
      return <Navigate to="/onboarding" replace />;
    }

    return <Outlet />;
  }

  if (user && user.onboardingCompleted) {
    if (path.startsWith('/onboarding')) {
      return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
  }

  return <Outlet />;
};

export const PublicOnlyRoute: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuthContext();

  if (isLoading) return null;

  if (isAuthenticated) {
    const targetPath = user && user.emailVerified !== true
      ? '/verify-email'
      : user && !user.onboardingCompleted
      ? '/onboarding'
      : '/dashboard';
    return <Navigate to={targetPath} replace />;
  }

  return <Outlet />;
};

export const AdminRoute: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuthContext();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasUserRole(user, 'admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export const DeveloperRoute: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuthContext();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasUserRole(user, 'developer')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
