import { useCallback, useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import {
  consumeInstallPrompt,
  getCachedInstallPrompt,
  subscribeInstallPrompt,
} from "@/lib/installPrompt";

type Variant = "primary" | "subtle";

interface InstallAppButtonProps {
  variant?: Variant;
  className?: string;
}

interface PlatformInfo {
  kind: "ios" | "samsung" | "android" | "other";
  isIOSSafari: boolean;
}

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  const navAny = navigator as unknown as { standalone?: boolean };
  return (
    navAny.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
};

const detectPlatform = (): PlatformInfo => {
  if (typeof navigator === "undefined") {
    return { kind: "other", isIOSSafari: false };
  }
  const ua = navigator.userAgent;
  const navAny = navigator as unknown as { maxTouchPoints?: number };
  const isIPadOS =
    navigator.platform === "MacIntel" && (navAny.maxTouchPoints || 0) > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPadOS;
  if (isIOS) {
    const isOtherIOSBrowser = /FxiOS|CriOS|EdgiOS|OPiOS/.test(ua);
    return { kind: "ios", isIOSSafari: !isOtherIOSBrowser };
  }
  if (/SamsungBrowser/i.test(ua)) return { kind: "samsung", isIOSSafari: false };
  if (/Android/i.test(ua)) return { kind: "android", isIOSSafari: false };
  return { kind: "other", isIOSSafari: false };
};

const primaryClass =
  "inline-flex items-center gap-2 rounded-full bg-pink-500/90 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-pink-500 disabled:opacity-70";
const subtleClass =
  "inline-flex items-center gap-2 rounded-full border border-pink-300/30 bg-pink-500/15 px-3 py-1.5 text-xs font-semibold text-pink-100 transition hover:bg-pink-500/25 disabled:opacity-70";

export default function InstallAppButton({
  variant = "primary",
  className,
}: InstallAppButtonProps) {
  const [promptAvailable, setPromptAvailable] = useState<boolean>(
    !!getCachedInstallPrompt(),
  );
  const [installed, setInstalled] = useState<boolean>(isStandalone());
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const platform = detectPlatform();

  useEffect(() => {
    const unsub = subscribeInstallPrompt(() => {
      setPromptAvailable(!!getCachedInstallPrompt());
      setInstalled(isStandalone());
    });
    const mql = window.matchMedia("(display-mode: standalone)");
    const onModeChange = () => setInstalled(isStandalone());
    if (mql.addEventListener) {
      mql.addEventListener("change", onModeChange);
    }
    return () => {
      unsub();
      if (mql.removeEventListener) {
        mql.removeEventListener("change", onModeChange);
      }
    };
  }, []);

  const handleInstall = useCallback(async () => {
    setBusy(true);
    await consumeInstallPrompt();
    setBusy(false);
  }, []);

  if (installed) return null;

  // 1. Native install prompt captured — Chrome, Edge, Android Chrome,
  //    Samsung Internet (when it fires beforeinstallprompt).
  if (promptAvailable) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        disabled={busy}
        aria-label="Install FaithBliss app"
        className={`${variant === "primary" ? primaryClass : subtleClass}${className ? ` ${className}` : ""}`}
      >
        <Download className="h-4 w-4" />
        {busy ? "Installing…" : "Install app"}
      </button>
    );
  }

  // 2 & 3. Any iOS browser — show the same step-by-step instructions.
  //    All iOS browsers (Safari, Chrome, Firefox, Edge) use WebKit and have
  //    the native share sheet with "Add to Home Screen".
  if (platform.kind === "ios") {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSSheet(true)}
          aria-label="Install FaithBliss app"
          className={`${variant === "primary" ? primaryClass : subtleClass}${className ? ` ${className}` : ""}`}
        >
          <Download className="h-4 w-4" />
          Install app
        </button>

        {showIOSSheet && (
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-ios-title"
            onClick={() => setShowIOSSheet(false)}
          >
            <div
              className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-6 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowIOSSheet(false)}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 id="install-ios-title" className="text-lg font-semibold">
                Install FaithBliss
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Add it to your home screen for the full-screen, native-app experience.
              </p>
              <ol className="mt-4 space-y-3 text-sm text-gray-100">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-200">
                    1
                  </span>
                  <span>
                    Tap the{" "}
                    <Share className="-mt-0.5 inline h-4 w-4 align-middle text-blue-400" />{" "}
                    <strong>Share</strong> button in your browser.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-200">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-200">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> to confirm.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSSheet(false)}
                className="mt-6 w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-600"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 4. Android without a native prompt — show manual install instructions.
  if (platform.kind === "android" || platform.kind === "samsung") {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSSheet(true)}
          aria-label="Install FaithBliss app"
          className={`${variant === "primary" ? primaryClass : subtleClass}${className ? ` ${className}` : ""}`}
        >
          <Download className="h-4 w-4" />
          Install App
        </button>

        {showIOSSheet && (
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-android-title"
            onClick={() => setShowIOSSheet(false)}
          >
            <div
              className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-6 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowIOSSheet(false)}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 id="install-android-title" className="text-lg font-semibold">
                Install FaithBliss
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Add it to your home screen for the full app experience.
              </p>
              <ol className="mt-4 space-y-3 text-sm text-gray-100">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-200">
                    1
                  </span>
                  <span>
                    Tap the <strong>⋮ menu</strong> in your browser (top-right corner).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-200">
                    2
                  </span>
                  <span>
                    Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-200">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> to confirm.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSSheet(false)}
                className="mt-6 w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-600"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 5. Browsers that simply can't install PWAs — render nothing.
  return null;
}
