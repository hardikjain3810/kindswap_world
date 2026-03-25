/**
 * Phantom Mobile Deep Link Utilities
 *
 * Implements the Phantom deep link protocol for mobile browsers (iOS/Android Chrome)
 * where the Phantom browser extension is not available.
 *
 * Protocol reference: https://docs.phantom.app/phantom-deeplinks/deeplinks-ios-and-android
 *
 * Flow:
 * 1. Generate a nacl box keypair for encrypted communication
 * 2. Redirect to Phantom app via universal link (https://phantom.app/ul/v1/...)
 * 3. User approves in Phantom
 * 4. Phantom redirects back to the app with encrypted response data
 * 5. Decrypt and process the response
 */
import nacl from "tweetnacl";
import bs58 from "bs58";

// ─── Storage Keys ───────────────────────────────────────────────────────────

const KEYPAIR_KEY = "phantom_mobile_dapp_keypair";
const SESSION_KEY = "phantom_mobile_session";
const PENDING_OP_KEY = "phantom_mobile_pending_op";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhantomMobileSession {
  /** User's Solana public key (base58) */
  publicKey: string;
  /** Encrypted session token from Phantom (base58) */
  session: string;
  /** Phantom's encryption public key for this session (base58) */
  phantomEncryptionPublicKey: string;
}

export interface PendingOperation {
  type: "signAndSend" | "signTransaction" | "signMessage";
  /** Page path to return to after callback */
  returnPath: string;
  /** Swap metadata for displaying results */
  meta?: Record<string, unknown>;
  /** Timestamp to detect stale operations */
  timestamp: number;
}

export interface DeepLinkCallbackResult {
  type: "connect" | "signAndSend" | "signTransaction" | "signMessage" | "disconnect" | "error";
  data: Record<string, unknown>;
}

// ─── OS / Device Detection ──────────────────────────────────────────────────

interface DetectedOS {
  name: string;
  version: string;
}

/**
 * Detect the operating system and version from the user-agent string.
 */
export function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") return { name: "Unknown", version: "" };

  const ua = navigator.userAgent;

  const osMap = [
    { name: "Windows 11",  pattern: /Windows NT 10\.0.*Win64/i },
    { name: "Windows 10",  pattern: /Windows NT 10\.0/i },
    { name: "Windows 8.1", pattern: /Windows NT 6\.3/i },
    { name: "Windows 7",   pattern: /Windows NT 6\.1/i },
    { name: "Android",     pattern: /Android (\d+[\.\d]*)/i },
    { name: "iOS",         pattern: /iPhone OS ([\d_]+)/i },
    { name: "macOS",       pattern: /Mac OS X ([\d_]+)/i },
    { name: "Linux",       pattern: /Linux/i },
  ];

  for (const os of osMap) {
    const match = ua.match(os.pattern);
    if (match) {
      const version = match[1]?.replace(/_/g, ".") || "";
      return { name: os.name, version };
    }
  }

  return { name: "Unknown", version: "" };
}

// ─── Mobile Detection ───────────────────────────────────────────────────────

/**
 * Detects if the current browser is a mobile browser without
 * the Phantom injected provider (i.e., not the Phantom in-app browser).
 */
export function isMobileWithoutPhantom(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const hasPhantomInjected = !!(window as any).phantom?.solana?.isPhantom;
  const result = isMobile && !hasPhantomInjected;

  if (result) {
    const os = detectOS();
    console.log(`[PhantomMobile] Mobile detected without Phantom injected — ${os.name} ${os.version}`);
  }

  return result;
}

/**
 * Detects if the device is mobile (regardless of wallet availability).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
}

// ─── Keypair Management ─────────────────────────────────────────────────────

/**
 * Gets or creates a persistent nacl box keypair for dapp↔Phantom encryption.
 * Stored in localStorage so it survives page reloads (required for redirect flow).
 */
function getOrCreateKeypair(): nacl.BoxKeyPair {
  try {
    const stored = localStorage.getItem(KEYPAIR_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        publicKey: bs58.decode(parsed.publicKey),
        secretKey: bs58.decode(parsed.secretKey),
      };
    }
  } catch {
    // Corrupted data, regenerate
    localStorage.removeItem(KEYPAIR_KEY);
  }

  const keypair = nacl.box.keyPair();
  localStorage.setItem(
    KEYPAIR_KEY,
    JSON.stringify({
      publicKey: bs58.encode(keypair.publicKey),
      secretKey: bs58.encode(keypair.secretKey),
    })
  );
  return keypair;
}

function getDappPublicKeyBase58(): string {
  return bs58.encode(getOrCreateKeypair().publicKey);
}

// ─── Encryption ─────────────────────────────────────────────────────────────

function encryptPayload(
  payload: Record<string, unknown>,
  sharedSecret: Uint8Array
): { nonce: string; data: string } {
  const nonce = nacl.randomBytes(24);
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = nacl.box.after(message, nonce, sharedSecret);
  if (!encrypted) throw new Error("Encryption failed");
  return {
    nonce: bs58.encode(nonce),
    data: bs58.encode(encrypted),
  };
}

function decryptPayload(
  data: string,
  nonce: string,
  phantomEncryptionPublicKey: string
): Record<string, unknown> {
  const keypair = getOrCreateKeypair();
  const sharedSecret = nacl.box.before(
    bs58.decode(phantomEncryptionPublicKey),
    keypair.secretKey
  );
  const decrypted = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  );
  if (!decrypted) throw new Error("Failed to decrypt Phantom response");
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function getSharedSecret(phantomEncryptionPublicKey: string): Uint8Array {
  const keypair = getOrCreateKeypair();
  return nacl.box.before(bs58.decode(phantomEncryptionPublicKey), keypair.secretKey);
}

// ─── Session Management ─────────────────────────────────────────────────────

export function getSession(): PhantomMobileSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as PhantomMobileSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSession(session: PhantomMobileSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(KEYPAIR_KEY);
  localStorage.removeItem(PENDING_OP_KEY);
}

// ─── Pending Operation Management ───────────────────────────────────────────

export function setPendingOperation(op: PendingOperation): void {
  localStorage.setItem(PENDING_OP_KEY, JSON.stringify(op));
}

export function getPendingOperation(): PendingOperation | null {
  try {
    const stored = localStorage.getItem(PENDING_OP_KEY);
    if (!stored) return null;
    const op = JSON.parse(stored) as PendingOperation;
    // Expire after 5 minutes
    if (Date.now() - op.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(PENDING_OP_KEY);
      return null;
    }
    return op;
  } catch {
    localStorage.removeItem(PENDING_OP_KEY);
    return null;
  }
}

export function clearPendingOperation(): void {
  localStorage.removeItem(PENDING_OP_KEY);
}

// ─── Deep Link URL Builders ─────────────────────────────────────────────────

/**
 * Build the redirect URL for deep link callbacks.
 * Uses the app's origin + current pathname to return to the same page.
 */
function buildRedirectLink(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Detect if the device is iOS (iPhone/iPad/iPod).
 */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

/**
 * Detect if the device is Android.
 */
function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent || "");
}

/**
 * Open the Phantom app via the best deep link method for the current platform.
 *
 * iOS Chrome does NOT handle universal links (https://phantom.app/ul/...)
 * the same as Safari — it opens the webpage instead of the app.
 *
 * Strategy:
 * - iOS: Use the custom `phantom://` scheme (directly opens app).
 *        For the initial connect (no session yet), add a timeout fallback
 *        to the universal link in case Phantom is not installed.
 *        For subsequent operations (session exists = Phantom IS installed),
 *        use ONLY the app scheme — no fallback. The fallback was racing
 *        against Phantom's processing and redirecting Chrome back prematurely.
 * - Android: Use an intent:// URL which either opens the app or falls back
 *            to the Play Store.
 * - Other: Use the universal link directly.
 */
export function openPhantomDeepLink(universalLinkUrl: string): void {
  // Convert universal link → app scheme
  // "https://phantom.app/ul/v1/connect?..." → "phantom://v1/connect?..."
  const appSchemeUrl = universalLinkUrl.replace(
    "https://phantom.app/ul/",
    "phantom://"
  );

  const os = detectOS();
  console.log(
    `[PhantomMobile] OS: ${os.name} ${os.version} | Deep link URL length: ${universalLinkUrl.length} chars`
  );

  // If we have a stored session, Phantom is definitely installed.
  // No need for a fallback that could race and cause immediate redirect-back.
  const phantomIsInstalled = !!getSession();

  if (isIOS()) {
    console.log(
      `[PhantomMobile] iOS — opening phantom:// scheme (installed=${phantomIsInstalled})`
    );

    // Use window.location.href for the custom scheme.
    // The previous approach (hidden anchor tag + a.click()) gets blocked by
    // iOS Chrome as a programmatic navigation, causing the fallback universal
    // link to open the Phantom download page instead of the app.
    window.location.href = appSchemeUrl;

    // Only add the App Store fallback for the initial connect,
    // when we don't yet know if Phantom is installed.
    if (!phantomIsInstalled) {
      setTimeout(() => {
        if (!document.hidden) {
          console.log("[PhantomMobile] App didn't open — falling back to App Store");
          window.location.href =
            "https://apps.apple.com/app/phantom-crypto-wallet/id1598432977";
        }
      }, 2500);
    }
    return;
  }

  if (isAndroid()) {
    // intent:// opens the app if installed, otherwise opens the Play Store.
    const intentUrl =
      "intent://" +
      appSchemeUrl.replace("phantom://", "") +
      "#Intent;scheme=phantom;package=app.phantom;end";
    console.log("[PhantomMobile] Android — using intent URL");
    window.location.href = intentUrl;
    return;
  }

  // Fallback for other platforms: universal link
  window.location.href = universalLinkUrl;
}

/**
 * Build the Phantom connect deep link URL.
 * Opens Phantom app → user approves → redirects back with encrypted connection data.
 */
export function buildConnectUrl(): string {
  const dappPublicKey = getDappPublicKeyBase58();
  const redirectLink = buildRedirectLink();

  const url = new URL("https://phantom.app/ul/v1/connect");
  url.searchParams.set("app_url", window.location.origin);
  url.searchParams.set("dapp_encryption_public_key", dappPublicKey);
  url.searchParams.set("redirect_link", redirectLink);
  url.searchParams.set("cluster", "mainnet-beta");

  return url.toString();
}

/**
 * Build the Phantom disconnect deep link URL.
 */
export function buildDisconnectUrl(): string {
  const session = getSession();
  if (!session) throw new Error("No active Phantom mobile session");

  const dappPublicKey = getDappPublicKeyBase58();
  const sharedSecret = getSharedSecret(session.phantomEncryptionPublicKey);
  const redirectLink = buildRedirectLink();

  const { nonce, data } = encryptPayload(
    { session: session.session },
    sharedSecret
  );

  const url = new URL("https://phantom.app/ul/v1/disconnect");
  url.searchParams.set("dapp_encryption_public_key", dappPublicKey);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("redirect_link", redirectLink);
  url.searchParams.set("payload", data);

  return url.toString();
}

/**
 * Build the Phantom signAndSendTransaction deep link URL.
 * The transaction is encrypted with the shared secret.
 */
export function buildSignAndSendTransactionUrl(
  serializedTransaction: Uint8Array,
  options?: { sendOptions?: Record<string, unknown> }
): string {
  const session = getSession();
  if (!session) throw new Error("No active Phantom mobile session");

  const dappPublicKey = getDappPublicKeyBase58();
  const sharedSecret = getSharedSecret(session.phantomEncryptionPublicKey);
  const redirectLink = buildRedirectLink();

  const payload: Record<string, unknown> = {
    transaction: bs58.encode(serializedTransaction),
    session: session.session,
  };
  if (options?.sendOptions) {
    payload.sendOptions = options.sendOptions;
  }

  const { nonce, data } = encryptPayload(payload, sharedSecret);

  const url = new URL("https://phantom.app/ul/v1/signAndSendTransaction");
  url.searchParams.set("dapp_encryption_public_key", dappPublicKey);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("redirect_link", redirectLink);
  url.searchParams.set("payload", data);

  return url.toString();
}

/**
 * Build the Phantom signTransaction deep link URL.
 */
export function buildSignTransactionUrl(
  serializedTransaction: Uint8Array
): string {
  const session = getSession();
  if (!session) throw new Error("No active Phantom mobile session");

  const dappPublicKey = getDappPublicKeyBase58();
  const sharedSecret = getSharedSecret(session.phantomEncryptionPublicKey);
  const redirectLink = buildRedirectLink();

  const { nonce, data } = encryptPayload(
    {
      transaction: bs58.encode(serializedTransaction),
      session: session.session,
    },
    sharedSecret
  );

  const url = new URL("https://phantom.app/ul/v1/signTransaction");
  url.searchParams.set("dapp_encryption_public_key", dappPublicKey);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("redirect_link", redirectLink);
  url.searchParams.set("payload", data);

  return url.toString();
}

/**
 * Build the Phantom signMessage deep link URL.
 */
export function buildSignMessageUrl(message: Uint8Array): string {
  const session = getSession();
  if (!session) throw new Error("No active Phantom mobile session");

  const dappPublicKey = getDappPublicKeyBase58();
  const sharedSecret = getSharedSecret(session.phantomEncryptionPublicKey);
  const redirectLink = buildRedirectLink();

  const { nonce, data } = encryptPayload(
    {
      message: bs58.encode(message),
      session: session.session,
    },
    sharedSecret
  );

  const url = new URL("https://phantom.app/ul/v1/signMessage");
  url.searchParams.set("dapp_encryption_public_key", dappPublicKey);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("redirect_link", redirectLink);
  url.searchParams.set("payload", data);

  return url.toString();
}

// ─── Callback Processing ────────────────────────────────────────────────────

/**
 * Process URL parameters from a Phantom deep link callback.
 * Returns null if the current URL is not a Phantom callback.
 */
export function processDeepLinkCallback(
  searchParams: URLSearchParams
): DeepLinkCallbackResult | null {
  // Error callback
  if (searchParams.has("errorCode")) {
    return {
      type: "error",
      data: {
        errorCode: searchParams.get("errorCode"),
        errorMessage: searchParams.get("errorMessage") || "Unknown error",
      },
    };
  }

  // Connect callback - has phantom_encryption_public_key
  if (searchParams.has("phantom_encryption_public_key")) {
    try {
      const phantomEncryptionPublicKey = searchParams.get("phantom_encryption_public_key")!;
      const nonce = searchParams.get("nonce")!;
      const data = searchParams.get("data")!;

      const decrypted = decryptPayload(data, nonce, phantomEncryptionPublicKey);

      const session: PhantomMobileSession = {
        publicKey: decrypted.public_key as string,
        session: decrypted.session as string,
        phantomEncryptionPublicKey,
      };

      // Persist the session
      setSession(session);

      return { type: "connect", data: { ...session } };
    } catch (error) {
      console.error("[PhantomMobile] Failed to process connect callback:", error);
      return {
        type: "error",
        data: { errorCode: "DECRYPT_FAILED", errorMessage: "Failed to decrypt connect response" },
      };
    }
  }

  // Sign/Send callback - has nonce + data but NOT phantom_encryption_public_key
  if (searchParams.has("nonce") && searchParams.has("data")) {
    const session = getSession();
    if (!session) {
      return {
        type: "error",
        data: { errorCode: "NO_SESSION", errorMessage: "No active session for decryption" },
      };
    }

    try {
      const nonce = searchParams.get("nonce")!;
      const data = searchParams.get("data")!;

      const decrypted = decryptPayload(data, nonce, session.phantomEncryptionPublicKey);

      // Determine the type based on pending operation
      const pending = getPendingOperation();
      const type = pending?.type || "signAndSend";

      return { type, data: decrypted };
    } catch (error) {
      console.error("[PhantomMobile] Failed to process sign callback:", error);
      return {
        type: "error",
        data: { errorCode: "DECRYPT_FAILED", errorMessage: "Failed to decrypt sign response" },
      };
    }
  }

  return null;
}
