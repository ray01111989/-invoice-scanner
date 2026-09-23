// Shared access check for the API routes.
//
// If the APP_ACCESS_KEY environment variable is set, every request must send the same value
// in an "x-access-key" header. If it is not set, the check is skipped (open access), and a
// warning is written to the logs so the owner knows the site is unprotected.
import { timingSafeEqual } from 'node:crypto';

// Remember whether we already warned, so the log is not flooded on every request.
let warned = false;

// Returns true when the request may continue. Returns false after sending a 401 response.
export function requireAccess(req, res) {
  // The secret the owner configured in Vercel.
  const expected = process.env.APP_ACCESS_KEY;

  // No key configured: allow the request, but warn once.
  if (!expected) {
    if (!warned) {
      console.warn('APP_ACCESS_KEY is not set: this deployment is open to anyone with the link.');
      warned = true;
    }
    return true;
  }

  // Read the key the browser sent (an empty string if the header is missing).
  const provided = String(req.headers['x-access-key'] || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // timingSafeEqual needs equal lengths; comparing in constant time stops attackers
  // from guessing the key one character at a time by measuring response speed.
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    res.status(401).json({ error: 'Access key required' });
    return false;
  }
  return true;
}
