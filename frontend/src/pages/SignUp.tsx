import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { ArrowLeft } from 'lucide-react';
import { HeartBeatLoader } from '@/components/HeartBeatLoader';
import InstallAppButton from '@/components/InstallAppButton';
import { useAuthContext } from '../contexts/AuthContext';

export default function Signup() {
  const { googleSignIn, isRegistering, isAuthenticated, isLoading, user } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const target = user?.onboardingCompleted ? '/dashboard' : '/onboarding';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, user?.onboardingCompleted]);

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      await googleSignIn('signup');
    } catch {
      setError('Failed to sign up with Google. Please try again.');
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center">
      <HeartBeatLoader />
    </div>
  );

  return (
    <div className="max-w-md w-full">
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
        <div className="mb-5 flex justify-start">
          <Link
            to="/"
            aria-label="Back to home"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-600/50 bg-gray-700/40 text-gray-200 transition-all hover:border-pink-500/40 hover:bg-gray-700/70 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img
              src="/favicon.svg"
              alt="FaithBliss logo"
              className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-sm"
            />
            <span className="text-2xl font-bold text-white">FaithBliss</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Join FaithBliss
          </h1>
          <p className="text-gray-300 text-sm sm:text-base">
            Your faith journey starts here
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={isRegistering}
          className="w-full flex items-center justify-center gap-3 bg-gray-700/50 border border-gray-600/50 hover:border-gray-500/50 text-white py-3.5 px-6 rounded-xl font-medium hover:bg-gray-600/50 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FcGoogle size={22} />
          <span className="text-sm sm:text-base">
            {isRegistering ? 'Creating account...' : 'Continue with Google'}
          </span>
        </button>

        <p className="mt-5 text-center text-xs text-gray-500 leading-5">
          Your account is created automatically the first time you sign in with Google.
          By continuing, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-gray-400 transition-colors">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" className="underline hover:text-gray-400 transition-colors">Privacy Policy</Link>.
        </p>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-pink-400 hover:text-pink-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-5 flex justify-center">
          <InstallAppButton variant="subtle" />
        </div>
      </div>
    </div>
  );
}
