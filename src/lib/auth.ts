// Shared password-gate helpers. Used by both the edge middleware and the
// Node route handlers, so this must rely only on Web Crypto (globalThis.crypto),
// which is available in both runtimes.

export const AUTH_COOKIE = 'whai_auth'

// The single shared password. Override in production by setting the
// CRM_ACCESS_PASSWORD environment variable (e.g. in Vercel) — the hard-coded
// value is just a sensible default so the gate works out of the box.
export function getPassword(): string {
  return process.env.CRM_ACCESS_PASSWORD || 'worldhealth2025'
}

// Derive an opaque session token from the password. The cookie stores this
// hash, never the plaintext password, and the middleware compares against it.
export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`whai::${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
