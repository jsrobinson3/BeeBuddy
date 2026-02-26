/**
 * OAuth helpers for Google and Apple native sign-in.
 *
 * The mobile app gets an ID token from the native SDK, then sends it to the
 * backend for verification and JWT issuance.
 */

import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// ── Google ────────────────────────────────────────────────────────────

export interface GoogleSignInResult {
  idToken: string;
  name: string | null;
}

/**
 * Configure the native Google Sign-In SDK. Call once at app startup
 * (e.g. in _layout.tsx) before any sign-in attempt.
 */
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
}

/**
 * Trigger the native Google account picker and return the ID token.
 * Returns null if the user cancels.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) {
    return null; // user cancelled
  }

  const { idToken, user } = response.data;
  if (!idToken) {
    throw new Error("Google sign-in succeeded but no ID token was returned");
  }

  return { idToken, name: user.name ?? null };
}

/**
 * Check whether a caught error is a Google Sign-In "in progress" duplicate.
 */
export function isSignInInProgress(error: unknown): boolean {
  return isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS;
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
