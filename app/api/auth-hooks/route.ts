import crypto from 'node:crypto';
import { sendOperatorOtp } from '@/lib/email/mailer';

// Neon Auth outbound webhook (Managed Better Auth). Subscribing to `send.otp`
// makes Neon SKIP its own default email and call this endpoint instead, so this
// handler is the SOLE deliverer of the operator sign-in code — it renders and
// sends JeloCare's own branded OTP mail. `send.otp` is a BLOCKING event: the
// auth flow pauses until we return 2xx (or the timeout expires), so we await the
// send and only 2xx on success; a non-2xx makes Neon retry (up to 3 attempts).
//
// Requests are authenticated by an EdDSA (Ed25519) detached-JWS signature — the
// asymmetric signature IS the auth (only Neon holds the private key), verified
// against Neon's public JWKS, so no shared secret is needed.
// Docs: neon.com/docs/auth/guides/webhooks, neon.com/docs/auth/guides/customize-emails
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const JWKS_TTL_MS = 10 * 60 * 1000;

type Jwk = crypto.JsonWebKey & { kid?: string };
let jwksCache: { fetchedAt: number; keys: Map<string, crypto.KeyObject> } | null = null;

// Fetch and cache Neon's Ed25519 signing keys by `kid`. On an unknown kid we
// refetch once, so key rotation needs no redeploy.
async function publicKeyForKid(kid: string): Promise<crypto.KeyObject | null> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    const cached = jwksCache.keys.get(kid);
    if (cached) return cached;
  }
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) return null;

  const res = await fetch(`${base}/.well-known/jwks.json`, { cache: 'no-store' });
  if (!res.ok) return null;
  const jwks = (await res.json()) as { keys?: Jwk[] };

  const keys = new Map<string, crypto.KeyObject>();
  for (const jwk of jwks.keys ?? []) {
    if (!jwk.kid) continue;
    try {
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      // Skip keys this runtime can't import (e.g. a non-OKP key in the set).
    }
  }
  jwksCache = { fetchedAt: Date.now(), keys };
  return keys.get(kid) ?? null;
}

// Detached JWS (RFC 7515): `X-Neon-Signature` is `header..signature` (empty
// middle). The signed payload rebinds the timestamp: the verifier reconstructs
// `header . base64url(timestamp + "." + base64url(body))` and checks it.
function verifySignature(rawBody: string, signatureHeader: string, timestamp: string, publicKey: crypto.KeyObject): boolean {
  const [headerB64, , signatureB64] = signatureHeader.split('.');
  if (!headerB64 || !signatureB64) return false;
  const payloadB64 = Buffer.from(rawBody, 'utf8').toString('base64url');
  const signaturePayloadB64 = Buffer.from(`${timestamp}.${payloadB64}`, 'utf8').toString('base64url');
  const signingInput = `${headerB64}.${signaturePayloadB64}`;
  try {
    return crypto.verify(null, Buffer.from(signingInput), publicKey, Buffer.from(signatureB64, 'base64url'));
  } catch {
    return false;
  }
}

type OtpPayload = {
  event_type?: string;
  user?: { email?: string };
  event_data?: { otp_code?: string; otp_type?: string };
};

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('x-neon-signature');
  const kid = request.headers.get('x-neon-signature-kid');
  const timestamp = request.headers.get('x-neon-timestamp');
  const headerEventType = request.headers.get('x-neon-event-type');
  const rawBody = await request.text();

  if (!signature || !kid || !timestamp) {
    return Response.json({ error: 'missing_signature' }, { status: 401 });
  }
  // Replay guard: reject stale timestamps (Unix milliseconds).
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SIGNATURE_MAX_AGE_MS) {
    return Response.json({ error: 'stale_timestamp' }, { status: 401 });
  }
  const publicKey = await publicKeyForKid(kid);
  if (!publicKey) return Response.json({ error: 'unknown_key' }, { status: 401 });
  if (!verifySignature(rawBody, signature, timestamp, publicKey)) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: OtpPayload;
  try {
    payload = JSON.parse(rawBody) as OtpPayload;
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400 });
  }

  // We only subscribe to `send.otp`. Acknowledge anything else without acting.
  const eventType = headerEventType ?? payload.event_type;
  if (eventType !== 'send.otp') {
    return Response.json({ acknowledged: eventType ?? 'unknown' });
  }

  const email = payload.user?.email;
  const code = payload.event_data?.otp_code;
  const otpType = payload.event_data?.otp_type;
  if (!email || !code) {
    return Response.json({ error: 'missing_otp_fields' }, { status: 400 });
  }

  try {
    await sendOperatorOtp({ to: email, code, type: otpType });
  } catch (error) {
    // Non-2xx so Neon retries; on final failure the user sees an auth error
    // rather than silently receiving no code.
    console.error('auth-hook send.otp delivery failed', error);
    return Response.json({ error: 'send_failed' }, { status: 502 });
  }
  return Response.json({ success: true });
}

// Health probe so the deployed route can be confirmed before registering the
// webhook. Never returns anything sensitive.
export function GET(): Response {
  return Response.json({ ok: true, hook: 'neon-auth', configured: Boolean(process.env.NEON_AUTH_BASE_URL) });
}
