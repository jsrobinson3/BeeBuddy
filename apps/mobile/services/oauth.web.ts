/**
 * OAuth helpers for Google and Apple sign-in on web.
 *
 * This is the web-platform override of oauth.ts. It uses the Google Identity
 * Services (GIS) SDK and Sign In with Apple JS SDK instead of the native
 * libraries that are unavailable in browsers.
 *
 * The backend contract is identical: we obtain an ID token from the provider
 * and send it to the API for verification and JWT issuance.
 */

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

const APPLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID ||
  process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
const APPLE_REDIRECT_URI = process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI;

// ── Shared types (must match oauth.ts) ──────────────────────────────

export interface GoogleSignInResult {
  idToken: string;
  name: string | null;
}

export interface AppleSignInResult {
  idToken: string;
  name: string | null;
  email: string | null;
}

// ── Script loaders ──────────────────────────────────────────────────

/**
 * Dynamically inject a <script> tag and resolve once it has loaded.
 * If the script is already present, resolves immediately.
 */
function loadScript(src: string, globalKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const exists =
      typeof window !== "undefined" &&
      globalKey.split(".").reduce<any>((o, k) => o?.[k], window);
    if (exists) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function loadGoogleScript(): Promise<void> {
  return loadScript(
    "https://accounts.google.com/gsi/client",
    "google.accounts",
  );
}

function loadAppleScript(): Promise<void> {
  return loadScript(
    "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
    "AppleID",
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Decode the payload section of a JWT without verification.
 * Used only to extract display-name claims from provider ID tokens.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const base64Url = jwt.split(".")[1];
  if (!base64Url) return {};
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

/**
 * Build a GoogleSignInResult from a GIS credential string, or null if
 * the credential is missing.
 */
function parseGoogleCredential(
  credential: string | undefined,
): GoogleSignInResult | null {
  if (!credential) return null;
  const payload = decodeJwtPayload(credential);
  return { idToken: credential, name: (payload.name as string) ?? null };
}

// ── Google fallback overlay ─────────────────────────────────────────

/**
 * Create a dismissible overlay containing a rendered Google sign-in
 * button. Used when One Tap is unavailable (browser cooldown, blocked,
 * etc.).
 */
function showGoogleButtonOverlay(
  google: any,
  onSettle: (result: GoogleSignInResult | null) => void,
): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;display:flex;align-items:center;" +
    "justify-content:center;background:rgba(0,0,0,0.4);z-index:10000";

  const card = document.createElement("div");
  card.style.cssText =
    "background:#fff;border-radius:12px;padding:24px;" +
    "box-shadow:0 4px 24px rgba(0,0,0,0.15)";

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const cleanup = () => {
    if (overlay.parentNode) overlay.remove();
  };

  // Dismiss when clicking the backdrop (outside the card).
  overlay.addEventListener("click", (e) => {
    if (e.target !== overlay) return;
    cleanup();
    onSettle(null);
  });

  google.accounts.id.renderButton(card, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
  });

  // Safety net: remove overlay after 2 minutes of inactivity.
  setTimeout(cleanup, 120_000);
}

// ── Google Sign-In (GIS) ────────────────────────────────────────────

interface GisPromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
}

/**
 * Handle the GIS prompt notification. Extracted to keep nesting depth
 * within the max-4 limit.
 */
function handleGisPromptNotification(
  notification: GisPromptNotification,
  google: any,
  settle: (result: GoogleSignInResult | null) => void,
): void {
  if (notification.isDismissedMoment()) {
    settle(null);
    return;
  }
  if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
    showGoogleButtonOverlay(google, settle);
  }
}

/**
 * Configure Google Sign-In. On web this is a no-op because initialisation
 * happens lazily inside `signInWithGoogle()` (the GIS SDK must be loaded
 * first, which is async).
 */
export function configureGoogleSignIn(): void {
  // No-op on web — initialisation is deferred to signInWithGoogle.
}

/**
 * Wire up the GIS SDK and return a promise that settles when the user
 * completes or dismisses Google sign-in. Extracted from signInWithGoogle
 * to keep nesting depth within limits.
 */
function initiateGoogleSignIn(
  google: any,
): Promise<GoogleSignInResult | null> {
  return new Promise<GoogleSignInResult | null>((resolve) => {
    let settled = false;
    const settle = (r: GoogleSignInResult | null) => {
      if (!settled) { settled = true; resolve(r); }
    };

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential?: string }) => {
        settle(parseGoogleCredential(response.credential));
      },
      cancel_on_tap_outside: true,
    });

    google.accounts.id.prompt((n: GisPromptNotification) => {
      handleGisPromptNotification(n, google, settle);
    });
  });
}

/**
 * Trigger Google One Tap or the rendered sign-in button and return the
 * resulting ID token plus the user's display name.
 *
 * Returns `null` if the user dismisses the prompt without signing in.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "EXPO_PUBLIC_GOOGLE_CLIENT_ID is not set — cannot sign in with Google on web",
    );
  }

  await loadGoogleScript();

  return initiateGoogleSignIn((window as any).google);
}

/**
 * Check whether a caught error represents a duplicate sign-in attempt.
 * On web there is no native "in progress" status code, so this always
 * returns false.
 */
export function isSignInInProgress(_error: unknown): boolean {
  return false;
}

// ── Apple Sign-In (Sign In with Apple JS) ───────────────────────────

/**
 * Trigger Sign In with Apple via the Apple JS SDK popup flow.
 *
 * Returns the ID token, and the user's name/email when Apple provides them
 * (only on the very first sign-in for a given Apple ID + relying party).
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  if (!APPLE_CLIENT_ID) {
    throw new Error(
      "EXPO_PUBLIC_APPLE_WEB_CLIENT_ID (or EXPO_PUBLIC_APPLE_CLIENT_ID) " +
        "is not set — cannot sign in with Apple on web",
    );
  }

  await loadAppleScript();

  const AppleID = (window as any).AppleID;

  AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: "name email",
    redirectURI: APPLE_REDIRECT_URI || window.location.origin,
    usePopup: true,
  });

  const response = await requestAppleSignIn(AppleID);

  const idToken: string | undefined = response?.authorization?.id_token;
  if (!idToken) {
    throw new Error("Apple Sign-In succeeded but no ID token was returned");
  }

  // Apple only sends user info on the very first authorisation.
  const name = response.user
    ? [response.user.name?.firstName, response.user.name?.lastName]
        .filter(Boolean)
        .join(" ") || null
    : null;

  const email: string | null = response.user?.email ?? null;

  return { idToken, name, email };
}

/**
 * Call AppleID.auth.signIn() and translate SDK errors into friendlier
 * Error instances.
 */
async function requestAppleSignIn(AppleID: any): Promise<any> {
  try {
    return await AppleID.auth.signIn();
  } catch (err: any) {
    if (err?.error === "popup_closed_by_user") {
      throw new Error("Apple Sign-In was cancelled by the user");
    }
    throw new Error(
      `Apple Sign-In failed: ${err?.error || err?.message || "unknown error"}`,
    );
  }
}
