import { Agent } from 'undici';
import axios, { AxiosInstance } from 'axios';
import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { isBlockedIp } from './webhook.url.validator';

// Pins DNS resolution: every resolved IP is checked with `isBlockedIp` and
// the caller connects to that same set. Closes the TOCTOU window
// `isSafePublicHttpsUrl` alone leaves open (see GHSA-f7jj-p389-4w45).
function ssrfSafeLookup(
  hostname: string,
  options: any,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: any,
    family?: number
  ) => void
) {
  if (net.isIP(hostname)) {
    const family = net.isIP(hostname);
    if (isBlockedIp(hostname)) {
      return callback(new Error('Blocked IP'), '', 0);
    }
    return options && (options as any).all
      ? callback(null, [{ address: hostname, family }] as any, family)
      : callback(null, hostname, family);
  }

  dns.lookup(hostname, options, (err, address: any, family: any) => {
    if (err) return callback(err, '', 0);
    if (Array.isArray(address)) {
      for (const entry of address) {
        if (isBlockedIp(entry.address)) {
          return callback(new Error('Blocked IP'), '', 0);
        }
      }
      return callback(null, address as any, 0);
    }
    if (isBlockedIp(address)) {
      return callback(new Error('Blocked IP'), '', 0);
    }
    callback(null, address, family);
  });
}

export const ssrfSafeDispatcher = new Agent({
  connect: {
    lookup: ssrfSafeLookup,
  },
});

// axios can't use an undici dispatcher, but Node's http(s) agents accept the
// same `lookup` hook, so axios requests (providers that need form-data /
// stream uploads) get the identical pinned-DNS guard as `this.fetch`.
const ssrfSafeAxios = axios.create({
  httpAgent: new http.Agent({ lookup: ssrfSafeLookup } as http.AgentOptions),
  httpsAgent: new https.Agent({
    lookup: ssrfSafeLookup,
  } as https.AgentOptions),
});

// A separate plain instance (not the module-level `axios` default) so the
// error-redaction interceptor below is scoped to callers of
// getSsrfSafeAxios(), not every unrelated `axios` import in the codebase.
const plainAxios = axios.create();

// Every provider authenticates these outbound calls with a header
// (Authorization: Bearer <token>, Cookie, X-Api-Key, ...). AxiosError keeps
// the full request config - headers included - on `error.config` and in
// `error.toJSON()`. Any call site that forgets to catch-and-sanitize before
// the error reaches a log, Sentry, or an activity failure record leaks that
// credential in plaintext (see #2220, the Moltbook API key leak). Redacting
// here, on the shared axios instances every provider gets from
// getSsrfSafeAxios(), closes the leak generically instead of relying on each
// provider's call sites to remember to do it themselves.
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-auth-token',
]);

function redactSensitiveHeaders(headers: unknown): void {
  if (!headers || typeof headers !== 'object') return;
  for (const key of Object.keys(headers as Record<string, unknown>)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      (headers as Record<string, unknown>)[key] = '[redacted]';
    }
  }
}

// Mutates error.config.headers in place rather than cloning: nothing in this
// codebase retries a request by reusing a failed call's error.config (every
// retry path - this.fetch, runStreamedUpload - rebuilds its own headers from
// scratch), so this is safe today. If that ever changes, a retry reusing
// error.config would send the literal string '[redacted]' instead of the
// real credential - don't build retry logic on top of a caught error's config.
function redactAxiosError(error: unknown) {
  if (error && typeof error === 'object') {
    redactSensitiveHeaders((error as { config?: { headers?: unknown } }).config?.headers);
  }
  return Promise.reject(error);
}

ssrfSafeAxios.interceptors.response.use(undefined, redactAxiosError);
plainAxios.interceptors.response.use(undefined, redactAxiosError);

// Self-hosters legitimately connect Postiz to WordPress/Mastodon/Lemmy/Listmonk
// instances that live on a private network (e.g. the same Docker network or VPC).
// Setting DISABLE_SSRF_PROTECTION=true opts those deployments out of the IP
// guard. It stays ON by default so the hosted product is protected.
export function getSsrfSafeDispatcher(): Agent | undefined {
  return process.env.DISABLE_SSRF_PROTECTION === 'true'
    ? undefined
    : ssrfSafeDispatcher;
}

export function getSsrfSafeAxios(): AxiosInstance {
  return process.env.DISABLE_SSRF_PROTECTION === 'true'
    ? plainAxios
    : ssrfSafeAxios;
}
