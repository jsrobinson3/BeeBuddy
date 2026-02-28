/**
 * @jest-environment jsdom
 */

/**
 * Tests for services/oauth.web.ts -- the web-platform OAuth helpers.
 *
 * We test the public exports (configureGoogleSignIn, isSignInInProgress,
 * signInWithGoogle, signInWithApple) and exercise the internal
 * decodeJwtPayload helper indirectly through the Google sign-in flow.
 */

// ---------- environment setup ----------

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI;
});

afterEach(() => {
  process.env = { ...originalEnv };
  delete (globalThis as any).google;
  delete (globalThis as any).__gisCallback;
});

// ---------- helper: require the module in an isolated registry ----------

function requireOAuth() {
  let mod: any;
  jest.isolateModules(() => {
    mod = require("../../services/oauth.web");
  });
  return mod as typeof import("../../services/oauth.web");
}

// ---------- tests ----------

describe("oauth.web", () => {
  describe("configureGoogleSignIn", () => {
    it("is a no-op and does not throw", () => {
      const oauth = requireOAuth();
      expect(() => oauth.configureGoogleSignIn()).not.toThrow();
    });

    it("returns undefined", () => {
      const oauth = requireOAuth();
      expect(oauth.configureGoogleSignIn()).toBeUndefined();
    });
  });

  describe("isSignInInProgress", () => {
    it("always returns false for any input", () => {
      const oauth = requireOAuth();
      expect(oauth.isSignInInProgress(new Error("test"))).toBe(false);
      expect(oauth.isSignInInProgress(null)).toBe(false);
      expect(oauth.isSignInInProgress(undefined)).toBe(false);
      expect(oauth.isSignInInProgress("string error")).toBe(false);
      expect(oauth.isSignInInProgress({ code: 12501 })).toBe(false);
    });
  });

  describe("signInWithGoogle", () => {
    it("throws when GOOGLE_CLIENT_ID is not set", async () => {
      const oauth = requireOAuth();

      await expect(oauth.signInWithGoogle()).rejects.toThrow(
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID is not set",
      );
    });
  });

  describe("signInWithApple", () => {
    it("throws when APPLE_CLIENT_ID is not set", async () => {
      const oauth = requireOAuth();

      await expect(oauth.signInWithApple()).rejects.toThrow(
        "EXPO_PUBLIC_APPLE_WEB_CLIENT_ID (or EXPO_PUBLIC_APPLE_CLIENT_ID)",
      );
    });
  });

  describe("decodeJwtPayload (via Google sign-in)", () => {
    it("correctly decodes a JWT payload", async () => {
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";

      // Build a fake JWT with a valid base64url payload
      const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
      const payload = btoa(
        JSON.stringify({ sub: "12345", name: "Test Beekeeper", email: "test@bees.com" }),
      );
      const fakeJwt = `${header}.${payload}.fake-signature`;

      setupGoogleGisMock(fakeJwt);
      stubScriptLoading();

      const oauth = requireOAuth();
      const result = await oauth.signInWithGoogle();

      expect(result).not.toBeNull();
      expect(result?.idToken).toBe(fakeJwt);
      expect(result?.name).toBe("Test Beekeeper");
    });

    it("returns null name for malformed JWT payload", async () => {
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";

      const malformedJwt = "header.!!!invalid-base64!!!.signature";

      setupGoogleGisMock(malformedJwt);
      stubScriptLoading();

      const oauth = requireOAuth();
      const result = await oauth.signInWithGoogle();

      expect(result).not.toBeNull();
      expect(result?.idToken).toBe(malformedJwt);
      expect(result?.name).toBeNull();
    });
  });
});

// ---------- shared test helpers ----------

/** Set up a mock GIS SDK on globalThis.google that resolves with the given JWT. */
function setupGoogleGisMock(credential: string): void {
  const mockInitialize = jest.fn();
  const mockPrompt = jest.fn();

  mockInitialize.mockImplementation(
    (config: { callback: (r: { credential: string }) => void }) => {
      (globalThis as any).__gisCallback = config.callback;
    },
  );

  mockPrompt.mockImplementation(() => {
    const cb = (globalThis as any).__gisCallback;
    if (cb) cb({ credential });
  });

  (globalThis as any).google = {
    accounts: {
      id: {
        initialize: mockInitialize,
        prompt: mockPrompt,
        renderButton: jest.fn(),
      },
    },
  };
}

/** Stub document.createElement/head.appendChild so loadScript resolves. */
function stubScriptLoading(): void {
  const origCreate = document.createElement.bind(document);

  jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "script") return {} as HTMLScriptElement;
    return origCreate(tag);
  });

  jest.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
    if ((node as any).onload) (node as any).onload();
    return node;
  });
}
