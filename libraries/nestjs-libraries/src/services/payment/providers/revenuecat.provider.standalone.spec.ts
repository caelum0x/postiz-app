// A RevenueCat TRANSFER event (and ordinary purchase events with both
// app_user_id and original_app_user_id set) can carry up to 4 distinct
// organization ids: app_user_id, original_app_user_id, transferred_from,
// transferred_to. processWebhook() looped over all of them and called
// syncSubscription() for each with a bare `await`, inside a plain `for`
// loop and no try/catch. If syncSubscription() threw for one organization
// (e.g. a transient RevenueCat API 500, or an org whose active product id
// doesn't match the <tier>.<period> convention anymore), every later
// organization in that same webhook silently never got synced - exactly
// the "webhook throws -> billing state half-applied" failure CLAUDE.md
// calls out for Stripe/RevenueCat webhook code paths.
const getOrgById = jest.fn();
const deleteSubscriptionByOrgId = jest.fn();
const createOrUpdateSubscriptionByOrg = jest.fn();

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({
    SubscriptionService: class {
      deleteSubscriptionByOrgId = deleteSubscriptionByOrgId;
      createOrUpdateSubscriptionByOrg = createOrUpdateSubscriptionByOrg;
    },
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({
    OrganizationService: class {
      getOrgById = getOrgById;
    },
  })
);

import { RevenueCatProvider } from './revenuecat.provider';

describe('RevenueCatProvider.processWebhook', () => {
  let provider: RevenueCatProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new RevenueCatProvider({} as any, {} as any);
  });

  it('still syncs every remaining organization when an earlier one throws', async () => {
    const syncSubscription = jest
      .spyOn(provider, 'syncSubscription')
      .mockImplementation(async (organizationId: string) => {
        if (organizationId === 'org-bad') {
          throw new Error('RevenueCat subscriber request failed (500)');
        }
        return { active: true };
      });

    await expect(
      provider.processWebhook({
        event: {
          type: 'TRANSFER',
          app_user_id: 'org-bad',
          original_app_user_id: 'org-good-1',
          transferred_from: ['org-good-2'],
          transferred_to: ['org-good-3'],
        },
      })
    ).resolves.toEqual({ ok: true });

    expect(syncSubscription).toHaveBeenCalledWith('org-bad');
    expect(syncSubscription).toHaveBeenCalledWith('org-good-1');
    expect(syncSubscription).toHaveBeenCalledWith('org-good-2');
    expect(syncSubscription).toHaveBeenCalledWith('org-good-3');
  });

  it('does not throw out of processWebhook when every organization fails', async () => {
    jest
      .spyOn(provider, 'syncSubscription')
      .mockRejectedValue(new Error('boom'));

    await expect(
      provider.processWebhook({
        event: { type: 'INITIAL_PURCHASE', app_user_id: 'org-1' },
      })
    ).resolves.toEqual({ ok: true });
  });
});
