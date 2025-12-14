import { randomBytes } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

const CSRF_COOKIE = 'cr_csrf_token';
const csrfToken = randomBytes(24).toString('hex');

export function issueCsrfToken(reply: FastifyReply) {
  const cookieValue = `${CSRF_COOKIE}=${csrfToken}; Path=/; SameSite=Lax`;
  reply.header('set-cookie', cookieValue);
  return { token: csrfToken };
}

function parseCookie(cookieHeader?: string) {
  if (!cookieHeader) return {} as Record<string, string>;
  return Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const [k, v] = part.trim().split('=');
      return [k, v];
    })
  );
}

export function verifyCsrf(req: FastifyRequest) {
  const headerToken = (req.headers['x-csrf-token'] as string | undefined) || '';
  const cookies = parseCookie(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  return Boolean(headerToken) && headerToken === csrfToken && cookieToken === csrfToken;
}

const WINDOW_MS = Number(process.env.SHELL_RATE_WINDOW_MS || 60_000);
const LIMIT = Number(process.env.SHELL_RATE_LIMIT || 50);
const bucket = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = bucket.get(key);
  if (!entry || entry.resetAt < now) {
    bucket.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true } as const;
  }
  if (entry.count >= LIMIT) return { allowed: false, resetAt: entry.resetAt } as const;
  entry.count += 1;
  bucket.set(key, entry);
  return { allowed: true } as const;
}

export function isShellApiEnabled() {
  return process.env.ENABLE_SHELL_API === 'true';
}
