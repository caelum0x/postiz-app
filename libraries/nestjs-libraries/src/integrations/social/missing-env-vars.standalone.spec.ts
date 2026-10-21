// #2238: on a self-hosted instance with no provider credentials set,
// "Add channel" still listed every OAuth provider and sent the user to the
// platform with an empty or literal "undefined" client id - the provider's
// error page gave no hint that a *_CLIENT_ID env var was missing.
// SocialAbstract.missingEnvVars() is the generic check getIntegrationUrl()
// now runs before building the auth URL; each provider only declares which
// env vars it needs (or overrides the check for a non-trivial case like
// GMB's YouTube-credentials fallback).
import { XProvider } from './x.provider';
import { YoutubeProvider } from './youtube.provider';
import { GmbProvider } from './gmb.provider';
import { DiscordProvider } from './discord.provider';
import { VkProvider } from './vk.provider';

describe('SocialAbstract.missingEnvVars', () => {
  const ENV_KEYS = [
    'X_API_KEY',
    'X_API_SECRET',
    'YOUTUBE_CLIENT_ID',
    'YOUTUBE_CLIENT_SECRET',
    'GOOGLE_GMB_CLIENT_ID',
    'GOOGLE_GMB_CLIENT_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'VK_ID',
  ];
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it('reports every declared env var missing when none are set', () => {
    expect(new XProvider().missingEnvVars()).toEqual([
      'X_API_KEY',
      'X_API_SECRET',
    ]);
  });

  it('reports nothing missing once all declared env vars are set', () => {
    process.env.DISCORD_CLIENT_ID = 'id';
    process.env.DISCORD_CLIENT_SECRET = 'secret';
    expect(new DiscordProvider().missingEnvVars()).toEqual([]);
  });

  it('reports only the still-missing var when one of two is set', () => {
    process.env.X_API_KEY = 'key-only';
    expect(new XProvider().missingEnvVars()).toEqual(['X_API_SECRET']);
  });

  it('a provider with a single required var reports configured once it is set', () => {
    expect(new VkProvider().missingEnvVars()).toEqual(['VK_ID']);
    process.env.VK_ID = 'some-id';
    expect(new VkProvider().missingEnvVars()).toEqual([]);
  });

  it('GMB is configured via its own credentials, no YouTube fallback needed', () => {
    process.env.GOOGLE_GMB_CLIENT_ID = 'gmb-id';
    process.env.GOOGLE_GMB_CLIENT_SECRET = 'gmb-secret';
    expect(new GmbProvider().missingEnvVars()).toEqual([]);
  });

  it('GMB falls back to being configured via YOUTUBE_CLIENT_ID/SECRET', () => {
    process.env.YOUTUBE_CLIENT_ID = 'yt-id';
    process.env.YOUTUBE_CLIENT_SECRET = 'yt-secret';
    expect(new GmbProvider().missingEnvVars()).toEqual([]);
  });

  it('GMB reports missing when neither its own nor the YouTube fallback creds are set', () => {
    expect(new GmbProvider().missingEnvVars()).toEqual([
      'GOOGLE_GMB_CLIENT_ID (or YOUTUBE_CLIENT_ID)',
      'GOOGLE_GMB_CLIENT_SECRET (or YOUTUBE_CLIENT_SECRET)',
    ]);
  });

  it('GMB is unaffected by an incomplete fallback pair (only one of the two YouTube vars set)', () => {
    process.env.YOUTUBE_CLIENT_ID = 'yt-id';
    expect(new GmbProvider().missingEnvVars()).not.toEqual([]);
  });

  it('YouTube itself only checks its own two vars, not GMB-specific ones', () => {
    expect(new YoutubeProvider().missingEnvVars()).toEqual([
      'YOUTUBE_CLIENT_ID',
      'YOUTUBE_CLIENT_SECRET',
    ]);
  });
});
