// Centralised PWA install-prompt state.
//
// The `beforeinstallprompt` event fires once per page lifetime and is missed
// if no listener is registered before it is dispatched. We attach the listener
// at module-load time and expose the cached event through a tiny pub/sub API
// so any component (public landing, login, signup, dashboard TopBar) can read
// from the same source of truth.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const SUBSCRIBE_EVENT = "faithbliss:installprompt-changed";

let cached: BeforeInstallPromptEvent | null = null;
let appInstalled = false;

const emit = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SUBSCRIBE_EVENT));
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    cached = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    cached = null;
    appInstalled = true;
    emit();
  });
}

export const getCachedInstallPrompt = (): BeforeInstallPromptEvent | null => cached;

export const isAppInstalled = (): boolean => appInstalled;

export const consumeInstallPrompt = async (): Promise<
  "accepted" | "dismissed" | "unavailable"
> => {
  if (!cached) return "unavailable";
  const event = cached;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    cached = null;
    emit();
    return outcome;
  } catch {
    cached = null;
    emit();
    return "unavailable";
  }
};

export const subscribeInstallPrompt = (handler: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SUBSCRIBE_EVENT, handler);
  return () => window.removeEventListener(SUBSCRIBE_EVENT, handler);
};
