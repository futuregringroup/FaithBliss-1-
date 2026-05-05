/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User,
} from "lucide-react";
import { PopupInstruction } from "@/components/auth/PopupInstruction";
import { SuccessModal } from "@/components/SuccessModal";
import { HeartBeatIcon } from "@/components/HeartBeatIcon";
import AppDropdown from "@/components/AppDropdown";
import { useAuthContext } from "../contexts/AuthContext";

type SignupGender = "MALE" | "FEMALE";

const GENDER_OPTIONS: Array<{ value: SignupGender; label: string }> = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    gender: "MALE" as SignupGender,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPopupInstruction, setShowPopupInstruction] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const {
    directRegister,
    googleSignIn,
    isRegistering,
    isAuthenticated,
    isLoading,
    user,
  } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const target =
        user?.emailVerified === false
          ? "/verify-email"
          : user?.onboardingCompleted
            ? "/dashboard"
            : "/onboarding";
      navigate(target, { replace: true });
    }
  }, [
    isAuthenticated,
    isLoading,
    navigate,
    user?.emailVerified,
    user?.onboardingCompleted,
  ]);

  useEffect(() => {
    const fromSignup =
      typeof window !== "undefined"
        ? sessionStorage.getItem("fromSignup")
        : null;

    if (isAuthenticated && fromSignup) {
      setShowSuccessModal(true);
      sessionStorage.removeItem("fromSignup");
    }

    if (!isLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, isLoading]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError("");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("fromSignup", "true");
      }
      await googleSignIn("signup");
    } catch (err: any) {
      setError(
        err?.message || "Failed to sign up with Google. Please try again.",
      );
      if (typeof window !== "undefined")
        sessionStorage.removeItem("fromSignup");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return setError("Please enter your full name");
    if (!formData.email.trim())
      return setError("Please enter your email address");
    if (!formData.password.trim()) return setError("Please enter a password");
    if (formData.password.length < 6)
      return setError("Password must be at least 6 characters long");
    if (!GENDER_OPTIONS.some((option) => option.value === formData.gender)) {
      return setError("Please select a valid gender");
    }

    setError("");

    try {
      await directRegister({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        gender: formData.gender,
      });
    } catch (registerError: any) {
      setError(
        registerError.message || "An unexpected error occurred during signup.",
      );
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleGenderChange = (nextGender: string) => {
    if (!GENDER_OPTIONS.some((option) => option.value === nextGender)) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      gender: nextGender as SignupGender,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <HeartBeatIcon />
      </div>
    );
  }

  return (
    <div className="max-w-md w-full">
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
        <div className="mb-5 flex justify-start">
          <Link
            to="/"
            aria-label="Back to home"
            title="Back to home"
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
              className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 object-contain rounded-sm"
            />
            <span className="text-2xl font-bold text-white">FaithBliss</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Join FaithBliss
          </h1>
          <p className="text-gray-300 text-sm sm:text-base">
            Your love journey starts here!
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading || isRegistering}
          className="w-full mb-6 flex items-center justify-center gap-3 bg-gray-700/50 border border-gray-600/50 hover:border-gray-500/50 text-white py-3 px-4 sm:px-6 rounded-xl font-medium hover:bg-gray-600/50 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FcGoogle size={20} />
          <span className="text-sm sm:text-base">
            {loading ? "Connecting..." : "Continue with Google"}
          </span>
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-800/50 text-gray-400">
              Or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailSignUp} className="space-y-4 sm:space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600/50 text-white rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500/50 placeholder-gray-400 transition-all"
                placeholder="Enter your full name"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600/50 text-white rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500/50 placeholder-gray-400 transition-all"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 bg-gray-700/50 border border-gray-600/50 text-white rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500/50 placeholder-gray-400 transition-all"
                placeholder="Create a secure password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="gender"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Gender
            </label>
            <AppDropdown
              id="gender"
              value={formData.gender}
              onChange={handleGenderChange}
              options={GENDER_OPTIONS}
              triggerClassName="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 text-white rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500/50 transition-all"
              menuClassName="border-gray-600/70 bg-slate-900/98"
              optionClassName="text-sm"
              ariaLabel="Gender"
              mobileSheetOnSmallScreens
            />
          </div>

          <button
            type="submit"
            disabled={isRegistering || loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="flex items-center justify-center gap-2">
              {isRegistering ? (
                <>
                  <HeartBeatIcon size="md" className="text-white" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Join the Family
                </>
              )}
            </span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-pink-400 hover:text-pink-300 font-semibold transition-colors"
            >
              Sign in here
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>

      <PopupInstruction
        show={showPopupInstruction}
        onDismiss={() => setShowPopupInstruction(false)}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/onboarding");
        }}
        title="Welcome to FaithBliss!"
        message="Your account has been created successfully! Let's complete your profile to find your perfect match."
        autoCloseMs={3000}
      />
    </div>
  );
}
