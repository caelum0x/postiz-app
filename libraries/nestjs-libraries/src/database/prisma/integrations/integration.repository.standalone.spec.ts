// #2233: reconnecting an existing YouTube (or any OAuth) channel via
// "Add Channel" creates a temporary integration holding the fresh
// refreshToken/tokenExpiration, but saveProviderPage() only forwards
// picture/internalId/name/token/profile to updateIntegration(). The old
// pre-existing record survives the reconnect and the temp record (with the
// only copy of the new refresh token) gets soft-deleted, so the refresh
// token is silently dropped and the channel breaks ~1h later when the
// access token expires. updateIntegration() must carry the temp record's
// refreshToken/tokenExpiration onto the surviving record when the caller
// didn't explicitly provide one.
// Avoid pulling in the real UploadFactory -> CloudflareStorage -> `file-type`
// chain, which is ESM-only and isn't transformable under this repo's
// standalone Jest config. IntegrationRepository only needs `.uploadSimple`
// from it, and this test never sets `picture`, so it's never called.
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => ({ uploadSimple: jest.fn() }),
  },
}));

import { IntegrationRepository } from './integration.repository';

describe('IntegrationRepository.updateIntegration', () => {
  function makeRepository(overrides: {
    existing: any;
    tempRecord: any;
  }) {
    const findUnique = jest
      .fn()
      // 1st call: look up the pre-existing record by (org, internalId)
      .mockResolvedValueOnce(overrides.existing)
      // 2nd call (only made when `existing` is found): fetch the temp
      // record's refreshToken/tokenExpiration
      .mockResolvedValueOnce(overrides.tempRecord);

    const update = jest.fn().mockImplementation(({ data }) => ({ data }));
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });

    const integrationRepo = {
      model: {
        integration: { findUnique, update },
      },
    } as any;
    const postsRepo = {
      model: { post: { updateMany } },
    } as any;

    const repository = new IntegrationRepository(
      integrationRepo,
      postsRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    return { repository, findUnique, update, updateMany };
  }

  it('carries the refresh token and expiration from the temp record onto the surviving record', async () => {
    const tokenExpiration = new Date('2026-10-20T00:00:00.000Z');
    const { repository, update } = makeRepository({
      existing: { id: 'existing-id' },
      tempRecord: {
        refreshToken: 'fresh-refresh-token',
        tokenExpiration,
      },
    });

    await repository.updateIntegration('temp-id', {
      picture: undefined,
      internalId: 'channel-123',
      organizationId: 'org-1',
      name: 'My Channel',
      inBetweenSteps: false,
      token: 'new-access-token',
      profile: 'my-channel',
    });

    // Final update call is the last one made (after the soft-delete update)
    const finalUpdateCall = update.mock.calls[update.mock.calls.length - 1][0];
    expect(finalUpdateCall.where).toEqual({ id: 'existing-id' });
    expect(finalUpdateCall.data.refreshToken).toBe('fresh-refresh-token');
    expect(finalUpdateCall.data.tokenExpiration).toBe(tokenExpiration);
  });

  it('does not overwrite an explicitly provided refreshToken', async () => {
    const { repository, update } = makeRepository({
      existing: { id: 'existing-id' },
      tempRecord: {
        refreshToken: 'fresh-refresh-token',
        tokenExpiration: new Date(),
      },
    });

    await repository.updateIntegration('temp-id', {
      internalId: 'channel-123',
      organizationId: 'org-1',
      refreshToken: 'explicitly-passed-token',
    });

    const finalUpdateCall = update.mock.calls[update.mock.calls.length - 1][0];
    expect(finalUpdateCall.data.refreshToken).toBe('explicitly-passed-token');
  });

  it('does nothing extra for a brand-new channel with no existing record', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce(null);
    const update = jest.fn().mockImplementation(({ data }) => ({ data }));
    const updateMany = jest.fn();

    const integrationRepo = {
      model: { integration: { findUnique, update } },
    } as any;
    const postsRepo = { model: { post: { updateMany } } } as any;

    const repository = new IntegrationRepository(
      integrationRepo,
      postsRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    await repository.updateIntegration('temp-id', {
      internalId: 'channel-123',
      organizationId: 'org-1',
      token: 'new-access-token',
    });

    // Only the single lookup for `existing` - no second lookup for a temp
    // record, since there's nothing to carry over.
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('skips the carry-over when the temp record has no refresh token', async () => {
    const { repository, update } = makeRepository({
      existing: { id: 'existing-id' },
      tempRecord: { refreshToken: null, tokenExpiration: null },
    });

    await repository.updateIntegration('temp-id', {
      internalId: 'channel-123',
      organizationId: 'org-1',
    });

    const finalUpdateCall = update.mock.calls[update.mock.calls.length - 1][0];
    expect(finalUpdateCall.data.refreshToken).toBeUndefined();
  });
});
