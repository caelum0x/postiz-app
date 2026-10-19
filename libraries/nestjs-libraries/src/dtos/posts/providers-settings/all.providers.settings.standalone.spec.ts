import {
  providerNeedsSettings,
  simpleTextProviders,
} from './all.providers.settings';

describe('providerNeedsSettings', () => {
  it('returns false for providers backed by EmptySettings (no extra config)', () => {
    expect(providerNeedsSettings('threads')).toBe(false);
    expect(providerNeedsSettings('mastodon')).toBe(false);
    expect(providerNeedsSettings('bluesky')).toBe(false);
    expect(providerNeedsSettings('telegram')).toBe(false);
    expect(providerNeedsSettings('nostr')).toBe(false);
    expect(providerNeedsSettings('vk')).toBe(false);
  });

  it('returns true for providers with a real settings DTO', () => {
    expect(providerNeedsSettings('reddit')).toBe(true);
    expect(providerNeedsSettings('pinterest')).toBe(true);
    expect(providerNeedsSettings('youtube')).toBe(true);
    expect(providerNeedsSettings('facebook')).toBe(true);
  });

  it('returns false for an unknown provider identifier', () => {
    expect(providerNeedsSettings('not-a-real-provider')).toBe(false);
  });
});

describe('simpleTextProviders', () => {
  it('lists exactly the providers that need no extra settings', () => {
    const list = simpleTextProviders();
    expect(list.sort()).toEqual(
      ['threads', 'mastodon', 'bluesky', 'telegram', 'nostr', 'vk'].sort()
    );
  });

  it('never includes a provider that needs real settings', () => {
    const list = simpleTextProviders();
    expect(list).not.toContain('reddit');
    expect(list).not.toContain('pinterest');
    expect(list).not.toContain('facebook');
  });
});
