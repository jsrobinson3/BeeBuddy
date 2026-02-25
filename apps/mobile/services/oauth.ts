/**
 * OAuth helpers for Google and Apple native sign-in.
 *
 * The mobile app gets an ID token from the native SDK, then sends it to the
 * backend for verification and JWT issuance.
 */

import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// ── Google ────────────────────────────────────────────────────────────

export function useGoogleAuth() {
  // Dev builds produce a custom-scheme redirect (beebuddy://) which Google's
  // web client rejects. Route through Expo's auth proxy for an https:// URI.
  return Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri: "https://auth.expo.io/@jsrobinson3/beebuddy",
  });
}

// ── Apple ─────────────────────────────────────────────────────────────

export interface AppleSignInResult {
  idToken: string;
  name: string | null;
  email: string | null;
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In failed: no identity token");
  }

  const name = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(" ") || null
    : null;

  return {
    idToken: credential.identityToken,
    name,
    email: credential.email,
  };
}
