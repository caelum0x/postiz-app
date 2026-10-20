import http from 'node:http';
import { getSsrfSafeAxios } from './ssrf.safe.dispatcher';

// #2220: AxiosError carries the full request config - including
// Authorization/Cookie/etc headers - on error.config and in
// error.toJSON(). getSsrfSafeAxios() is the shared instance every social
// provider uses for outbound calls (Moltbook and friends), so a generic
// redaction there protects every provider, not just the one that happened
// to get reported. These tests hit a closed local port (no real network)
// and assert the thrown AxiosError never carries the secret header value.
describe('getSsrfSafeAxios error redaction', () => {
  async function findClosedPort(): Promise<number> {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return port; // now closed - connecting to it fails fast with ECONNREFUSED
  }

  it('redacts the Authorization header on a request failure', async () => {
    expect.assertions(2);
    const port = await findClosedPort();
    const axiosInstance = getSsrfSafeAxios();

    try {
      await axiosInstance.get(`http://127.0.0.1:${port}/posts`, {
        headers: { Authorization: 'Bearer super-secret-moltbook-key' },
      });
    } catch (err: any) {
      expect(err.config?.headers?.Authorization).toBe('[redacted]');
      // AxiosError#toJSON() is the standard shape error loggers/Sentry/activity
      // failure records serialize - its `config.headers` must be redacted too.
      const asJson = err.toJSON ? err.toJSON() : err;
      expect(asJson.config?.headers?.Authorization).toBe('[redacted]');
    }
  });

  it('redacts Cookie and X-Api-Key headers too, case-insensitively', async () => {
    expect.assertions(2);
    const port = await findClosedPort();
    const axiosInstance = getSsrfSafeAxios();

    try {
      await axiosInstance.get(`http://127.0.0.1:${port}/posts`, {
        headers: {
          cookie: 'session=super-secret-session',
          'X-Api-Key': 'super-secret-api-key',
        },
      });
    } catch (err: any) {
      expect(err.config?.headers?.cookie).toBe('[redacted]');
      expect(err.config?.headers?.['X-Api-Key']).toBe('[redacted]');
    }
  });

  it('leaves non-sensitive headers untouched', async () => {
    expect.assertions(1);
    const port = await findClosedPort();
    const axiosInstance = getSsrfSafeAxios();

    try {
      await axiosInstance.get(`http://127.0.0.1:${port}/posts`, {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      expect(err.config?.headers?.['Content-Type']).toBe('application/json');
    }
  });

  describe('with DISABLE_SSRF_PROTECTION=true (self-hosted private-network opt-out)', () => {
    const original = process.env.DISABLE_SSRF_PROTECTION;

    beforeEach(() => {
      process.env.DISABLE_SSRF_PROTECTION = 'true';
    });

    afterEach(() => {
      process.env.DISABLE_SSRF_PROTECTION = original;
    });

    it('still redacts the Authorization header on the plain axios fallback', async () => {
      expect.assertions(1);
      const port = await findClosedPort();
      const axiosInstance = getSsrfSafeAxios();

      try {
        await axiosInstance.get(`http://127.0.0.1:${port}/posts`, {
          headers: { Authorization: 'Bearer super-secret-moltbook-key' },
        });
      } catch (err: any) {
        expect(err.config?.headers?.Authorization).toBe('[redacted]');
      }
    });
  });
});
