import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
// Register the beforeinstallprompt listener at the earliest possible moment.
import './lib/installPrompt';
import { AdminRoute, AuthGate, DeveloperRoute, PublicOnlyRoute } from './components/AuthGate.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ToastProvider } from './contexts/ToastContext.tsx';
import PublicSiteLayout from './layouts/PublicSiteLayout.tsx';
import About from './pages/About.tsx';
import Admin from './pages/Admin.tsx';
import Community from './pages/Community.tsx';
import Contact from './pages/Contact.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Deactivate from './pages/Deactivate.tsx';
import DeveloperHub from './pages/DeveloperHub.tsx';
import Explore from './pages/Explore.tsx';
import HelpRoute from './pages/HelpRoute.tsx';
import Home from './pages/Home.tsx';
import InAppPurchases from './pages/InAppPurchases.tsx';
import Login from './pages/Login.tsx';
import MatchPage from './pages/MatchesPage.tsx';
import Messages from './pages/Messages.tsx';
import Notifications from './pages/Notifications.tsx';
import OnboardingDebug from './pages/OnboardingDebug.tsx';
import OnboardingRouteWrapper from './pages/OnboardingPage.tsx';
import PaymentSuccess from './pages/PaymentSuccess.tsx';
import PremiumRoute from './pages/PremiumRoute.tsx';
import Privacy from './pages/Privacy.tsx';
import Profile from './pages/Profile.tsx';
import Report from './pages/Report.tsx';
import ResetPassword from './pages/ResetPassword.tsx';
import SafetyNote from './pages/SafetyNote.tsx';
import Settings from './pages/Settings.tsx';
import SignUp from './pages/SignUp.tsx';
import Terms from './pages/Terms.tsx';
import ProfilePage from './pages/UserProfileView.tsx';
import VerifyEmail from './pages/VerifyEmail.tsx';

const isFirebaseNetworkFailure = (reason: unknown): boolean => {
  const candidates = [
    reason,
    (reason as { reason?: unknown })?.reason,
    (reason as { error?: unknown })?.error,
  ];

  return candidates.some((candidate) => {
    const code = (candidate as { code?: unknown })?.code;
    const message = (candidate as { message?: unknown })?.message;
    return (
      (typeof code === 'string' && code === 'auth/network-request-failed')
      || (typeof message === 'string' && (
        message.includes('auth/network-request-failed')
        || message.toLowerCase().includes('network request failed')
      ))
    );
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isFirebaseNetworkFailure(event.reason)) return;
    event.preventDefault();
    console.warn('Suppressed unhandled Firebase network-request-failed rejection at bootstrap.');
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      void (async () => {
        try {
          const response = await fetch('/sw.js', {
            cache: 'no-store',
            headers: {
              Accept: 'application/javascript,text/javascript,*/*',
            },
          });

          const contentType = response.headers.get('content-type') || '';
          const looksLikeScript =
            response.ok
            && !contentType.toLowerCase().includes('text/html');

          if (!looksLikeScript) {
            console.warn('Skipping service worker registration because /sw.js did not resolve to a JavaScript file.');
            return;
          }

          await navigator.serviceWorker.register('/sw.js');
        } catch (error) {
          console.warn('Service worker registration failed:', error);
        }
      })();
    });
  }
}

const rootElement = document.getElementById('root')!;
const normalizePathname = (pathname: string) => {
  if (!pathname) return '/';
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};
const prerenderedRoute = normalizePathname(rootElement.dataset.seoRoute || '/');
const currentPathname = normalizePathname(window.location.pathname);
const shouldHydratePrerenderedMarkup =
  rootElement.dataset.seoPrerendered === 'true' && prerenderedRoute === currentPathname;

const app = (
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<PublicSiteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="contact" element={<Contact />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="help" element={<HelpRoute />} />
              <Route path="premium" element={<PremiumRoute />} />
            </Route>

            <Route element={<App />}>
              <Route path="reset-password" element={<ResetPassword />} />
            </Route>

            <Route element={<PublicOnlyRoute />}>
              <Route element={<App />}>
                <Route path="login" element={<Login />} />
                <Route path="signup" element={<SignUp />} />
              </Route>
            </Route>

            <Route element={<AuthGate />}>
              <Route element={<App />}>
                <Route path="verify-email" element={<VerifyEmail />} />
                <Route path="onboarding" element={<OnboardingRouteWrapper />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="community" element={<Community />} />
                <Route path="explore" element={<Explore />} />
                <Route path="messages" element={<Messages />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="purchases" element={<InAppPurchases />} />
                <Route path="payment-success" element={<PaymentSuccess />} />
                <Route path="settings" element={<Settings />} />
                <Route path="report" element={<Report />} />
                <Route path="safety-note" element={<SafetyNote />} />
                <Route path="deactivate" element={<Deactivate />} />
                <Route path="debug/onboarding" element={<OnboardingDebug />} />
                <Route path="profile/:id" element={<ProfilePage />} />
                <Route path="profile" element={<Profile />} />
                <Route path="matches" element={<MatchPage />} />
                <Route element={<AdminRoute />}>
                  <Route path="admin" element={<Admin />} />
                </Route>
                <Route element={<DeveloperRoute />}>
                  <Route path="developer" element={<DeveloperHub />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<div>404 Not Found</div>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);

if (shouldHydratePrerenderedMarkup) {
  hydrateRoot(rootElement, app);
} else {
  rootElement.innerHTML = '';
  createRoot(rootElement).render(app);
}
