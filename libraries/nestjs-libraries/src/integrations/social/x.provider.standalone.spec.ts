import { XProvider } from './x.provider';

// #2231: X's v2 API answers an out-of-credits post with an RFC 7807 problem
// response (HTTP 402). Before this test, handleErrors() didn't recognize that
// body, so it fell through to the generic "Unknown Error" bad-body message -
// hiding the real reason the post never reached X from the bell notification
// and the calendar card tooltip.
describe('XProvider.handleErrors', () => {
  const provider = new XProvider();

  it('reports a clear message for the credits-depleted 402 response', () => {
    const body = JSON.stringify({
      detail: 'credits depleted',
      status: 402,
      title: 'Payment Required',
      type: 'https://api.x.com/2/problems/credits-depleted',
    });

    const result = provider.handleErrors(body);

    expect(result).toBeDefined();
    expect(result?.type).toBe('bad-body');
    expect(result?.value).not.toBe('Unknown Error');
    expect(result?.value).toMatch(/out of API credits/i);
  });

  it('still falls back to undefined for an unrecognized body', () => {
    const result = provider.handleErrors('{"some":"other error"}');
    expect(result).toBeUndefined();
  });

  it('does not mislabel an unrelated Payment Required response as credits depleted', () => {
    // Same title as the credits problem, but a different cause - the generic
    // title alone must not be enough to trigger the credits-depleted message.
    const body = JSON.stringify({
      detail: 'some other payment issue',
      status: 402,
      title: 'Payment Required',
      type: 'https://api.x.com/2/problems/some-other-problem',
    });

    const result = provider.handleErrors(body);
    expect(result).toBeUndefined();
  });

  it('still matches existing known error bodies (no regression)', () => {
    const result = provider.handleErrors('Too Many Requests');
    expect(result?.type).toBe('retry');
  });
});
