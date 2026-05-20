// Email verification is no longer required — all accounts use Google sign-in,
// which guarantees a verified email. This component redirects any user who
// lands on the old /verify-email route to their correct destination.
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { HeartBeatLoader } from '@/components/HeartBeatLoader';

export default function VerifyEmail() {
  const { isLoading, isAuthenticated, user } = useAuthContext();

  if (isLoading) return <HeartBeatLoader />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const target = user?.onboardingCompleted ? '/dashboard' : '/onboarding';
  return <Navigate to={target} replace />;
}
