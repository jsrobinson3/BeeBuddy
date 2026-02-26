# OAuth Setup Guide — Google & Apple Sign-In

BeeBuddy uses native OAuth: the mobile app obtains an **ID token** from
Google/Apple, sends it to the backend, and the backend verifies it against
the provider's public keys (JWKS). No redirect-based web flow is needed.

---

## Architecture Overview

```
Mobile App                         Backend API
──────────                         ───────────
1. User taps "Sign in with Google"
2. expo-auth-session opens browser ──►
3. Google returns ID token         ◄──
4. POST /auth/oauth/google         ──► 5. Verify ID token via JWKS
   { id_token, name? }                6. Find or create user
                                       7. Return JWT pair
                                   ◄── { access_token, refresh_token }
```

Apple works the same way, except `expo-apple-authentication` uses the
native iOS Sign in with Apple sheet instead of a browser.

---

## 1. Google OAuth Setup

### 1a. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → OAuth consent screen**
4. Choose **External** user type
5. Fill in app name ("BeeBuddy"), support email, developer email
6. Add scopes: `email`, `profile`, `openid`
7. Add your own Google account as a **test user** (required while in
   "Testing" status — only test users can sign in until you publish)

### 1b. Create OAuth Client IDs

Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.

You need **three** client IDs:

| Type | Client ID env var | Notes |
|------|-------------------|-------|
| **Web application** | `GOOGLE_CLIENT_ID` (backend) + `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (mobile) | This is the **audience** value. `expo-auth-session` uses the Expo auth proxy which requires a web client ID. |
| **iOS** | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Bundle ID: `com.beebuddyai.app` |
| **Android** | `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Package name: `com.beebuddyai.app`. Requires your signing certificate SHA-1 (see below). |

#### Getting your Android signing certificate SHA-1

For **development** (Expo dev client):
```bash
# If using EAS Build, get the keystore fingerprint:
eas credentials -p android
# Look for "SHA1 Fingerprint" in the output

# Or if you have a local keystore:
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android \
  | grep SHA1
```

For **production**: use the upload key fingerprint from Google Play Console →
Setup → App signing.

### 1c. Set Environment Variables

**Backend** — add to `apps/api/.env`:
```env
GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

The `GOOGLE_CLIENT_ID` is the **Web** client ID. The backend uses it as the
`audience` parameter when verifying ID tokens. `GOOGLE_CLIENT_SECRET` is not
used in the ID-token flow but is included for completeness.

**Mobile** — add to `apps/mobile/.env`:
```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-yyyyy.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-zzzzz.apps.googleusercontent.com
```

`EXPO_PUBLIC_GOOGLE_CLIENT_ID` is the same Web client ID used on the backend.

---

## 2. Apple Sign-In Setup

### Requirements

- An Apple Developer Program membership ($99/year)
- A real iOS device (Apple Sign-In does not work in Expo Go or simulators
  without a development build)

### 2a. Configure Your App ID

1. Go to [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Find your App ID (`com.beebuddyai.app`) or create one
3. Under **Capabilities**, enable **Sign in with Apple**
4. Save

### 2b. Create a Sign in with Apple Key

1. Go to [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Click **+** to register a new key
3. Name it (e.g., "BeeBuddy Sign in with Apple")
4. Enable **Sign in with Apple**, click Configure, select your App ID
5. Click **Register**
6. **Download the `.p8` file immediately** — Apple only lets you download it once
7. Note the **Key ID** shown on the confirmation page

### 2c. Find Your Team ID

Go to [Apple Developer → Membership](https://developer.apple.com/account#MembershipDetailsCard).
Your **Team ID** is the 10-character alphanumeric string.

### 2d. Set Environment Variables

**Backend** — add to `apps/api/.env`:
```env
APPLE_CLIENT_ID=com.beebuddyai.app
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=YYYYYYYYYY
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAg...your-key-contents...\n-----END PRIVATE KEY-----"
```

`APPLE_CLIENT_ID` is your bundle identifier. The backend uses it as the
`audience` when verifying Apple ID tokens.

`APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` are only needed
if you add server-to-server Apple flows later (e.g., token revocation,
web-based Sign in with Apple). For the native mobile ID-token flow, only
`APPLE_CLIENT_ID` is strictly required.

**Mobile** — no additional env vars needed. Apple Sign-In uses the native
iOS framework configured via `app.json`:
```json
{
  "ios": {
    "usesAppleSignIn": true
  },
  "plugins": ["expo-apple-authentication"]
}
```
These are already set in the project.

---

## 3. Complete Environment Variable Reference

### `apps/api/.env`

```env
# --- Existing vars (already set) ---
SECRET_KEY=local-dev-secret-do-not-use-in-production
# ... database, redis, s3, llm, email ...

# --- Add these for OAuth ---
GOOGLE_CLIENT_ID=           # Web OAuth client ID (from Google Cloud Console)
GOOGLE_CLIENT_SECRET=       # Web OAuth client secret (optional for ID-token flow)
APPLE_CLIENT_ID=com.beebuddyai.app   # Your iOS bundle identifier
APPLE_TEAM_ID=              # 10-char Apple Developer Team ID
APPLE_KEY_ID=               # Key ID from your Sign in with Apple key
APPLE_PRIVATE_KEY=          # Contents of the .p8 file (for future server-to-server use)
```

### `apps/mobile/.env`

```env
# --- Existing vars (already set) ---
EXPO_PUBLIC_API_URL=http://192.168.25.52:8000
EXPO_PUBLIC_SENTRY_DSN=...

# --- Add these for OAuth ---
EXPO_PUBLIC_GOOGLE_CLIENT_ID=           # Same Web client ID as GOOGLE_CLIENT_ID above
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=       # iOS-type OAuth client ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=   # Android-type OAuth client ID
```

### `apps/mobile/eas.json` (for EAS Build)

For preview/production builds, add the Google client IDs to the `env` blocks
so they are baked in at build time:

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.beebuddyai.com",
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "...",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "...",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "..."
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.beebuddyai.com",
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "...",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "...",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "..."
      }
    }
  }
}
```

Or use [EAS Secrets](https://docs.expo.dev/build-reference/variables/) to
avoid committing client IDs to the repo.

---

## 4. Testing

### Local Development

1. Add the secrets to both `.env` files
2. Restart the API (`docker compose up` or `uv run uvicorn`)
3. Restart the Expo dev server (`npm run start:wsl`)
4. **Google**: Tap the "G" button on the login screen. A browser opens for
   Google consent. After consent, the ID token is sent to your backend.
5. **Apple**: Only available on iOS. Requires a development build
   (`eas build --profile development --platform ios`), not Expo Go.

### Verifying the Backend Independently

```bash
# Test Google token verification (replace with a real ID token):
curl -X POST http://localhost:8000/api/v1/auth/oauth/google \
  -H "Content-Type: application/json" \
  -d '{"id_token": "eyJhbGci..."}'

# Expected success: { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
# Expected failure: { "detail": "Google ID token verification failed: ..." }
```

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| "Google OAuth is not configured" | `GOOGLE_CLIENT_ID` not set in backend `.env` | Add the Web client ID to `apps/api/.env` |
| "Audience mismatch" | Mobile and backend using different client IDs | Ensure `EXPO_PUBLIC_GOOGLE_CLIENT_ID` = `GOOGLE_CLIENT_ID` (both the Web client ID) |
| Google button does nothing | `request` is null (client IDs not loaded) | Check that `EXPO_PUBLIC_GOOGLE_*` vars are set and Expo restarted with `--clear` |
| Apple button not showing | Expected on Android | Apple Sign-In is iOS only; the button is hidden on Android via `Platform.OS === "ios"` check |
| "Apple Sign-In failed: no identity token" | Running in Expo Go | Apple auth requires a native development build |
| "Email already associated with google login" | User has an existing Google-linked account and is trying Apple | Current design: one OAuth provider per account. User should sign in with Google. |

---

## 5. Security Notes

- **Never commit real secrets to git.** The `.env` files are in `.gitignore`.
- ID tokens are verified server-side using the provider's JWKS (public keys
  fetched from Google/Apple). The backend never trusts the client's claims
  without cryptographic verification.
- The JWKS response is cached for 1 hour with automatic refresh on key
  rotation.
- OAuth users are created with `password_hash=None` and `email_verified=True`.
  They cannot log in via email/password unless they set a password later.
