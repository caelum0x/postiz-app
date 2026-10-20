// #2245: India-issued cards always fail trial signup because
// checkValidCard() places an off-session $1 verification hold that RBI
// e-mandate rules reject outright (or leave `processing` for ~26h). These
// tests mock the `stripe` SDK so we can exercise checkValidCard() without
// hitting Stripe's network, and assert:
//   1. India-issued cards (`card.country === 'IN'`) skip the hold entirely
//      and pass.
//   2. Non-India cards keep the existing behavior (hold must reach
//      `requires_capture`).
//   3. The failure path detaches `latestMethod`, not `paymentMethods.data[0]`.
const paymentIntentsCreate = jest.fn();
const paymentIntentsCancel = jest.fn();
const paymentMethodsList = jest.fn();
const paymentMethodsDetach = jest.fn();
const subscriptionsCancel = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: paymentIntentsCreate,
      cancel: paymentIntentsCancel,
    },
    paymentMethods: {
      list: paymentMethodsList,
      detach: paymentMethodsDetach,
    },
    subscriptions: {
      cancel: subscriptionsCancel,
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// StripeService's constructor-injected dependencies are real value imports
// (required at runtime by emitDecoratorMetadata, not just types), and
// SubscriptionService alone drags in IntegrationService ->
// IntegrationManager -> every social provider (Bluesky's AuthService/bcrypt
// native binding, Nostr's ESM-only deps, Cloudflare storage's `file-type`,
// ...). None of that is exercised by checkValidCard(), so stub the four
// constructor dependencies at the module level to keep this test isolated
// to the Stripe logic it's actually covering.
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({ SubscriptionService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/track/track.service', () => ({
  TrackService: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/users/users.service',
  () => ({ UsersService: class {} })
);
// stripe.service.ts also imports AuthService directly (unused by
// checkValidCard), which requires the native `bcrypt` binding - not built
// in this environment.
jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: class {},
  decrypt_legacy_using_IV: (v: string) => v,
  encrypt_legacy_using_IV: (v: string) => v,
}));

import { StripeService } from './stripe.service';

function makeEvent(customerId = 'cus_123', subscriptionId = 'sub_123') {
  return {
    data: {
      object: {
        status: 'active',
        customer: customerId,
        id: subscriptionId,
      },
    },
  } as any;
}

describe('StripeService.checkValidCard', () => {
  let organizationService: { getOrgByCustomerId: jest.Mock };
  let service: StripeService;

  beforeEach(() => {
    jest.clearAllMocks();
    organizationService = {
      getOrgByCustomerId: jest.fn().mockResolvedValue({ allowTrial: true }),
    };
    service = new StripeService(
      {} as any,
      organizationService as any,
      {} as any,
      {} as any
    );
  });

  it('skips the off-session hold entirely for India-issued cards and passes', async () => {
    paymentMethodsList.mockResolvedValue({
      data: [
        {
          id: 'pm_india',
          created: 100,
          card: { country: 'IN' },
        },
      ],
    });

    const result = await service.checkValidCard(makeEvent());

    expect(result).toBe(true);
    expect(paymentIntentsCreate).not.toHaveBeenCalled();
    expect(paymentMethodsDetach).not.toHaveBeenCalled();
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  it('still places the verification hold for non-India cards', async () => {
    paymentMethodsList.mockResolvedValue({
      data: [
        {
          id: 'pm_us',
          created: 100,
          card: { country: 'US' },
        },
      ],
    });
    paymentIntentsCreate.mockResolvedValue({
      id: 'pi_123',
      status: 'requires_capture',
    });

    const result = await service.checkValidCard(makeEvent());

    expect(result).toBe(true);
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'pm_us', off_session: true })
    );
    expect(paymentIntentsCancel).toHaveBeenCalledWith('pi_123');
  });

  it('detaches the latest payment method (not paymentMethods.data[0]) when the hold fails', async () => {
    paymentMethodsList.mockResolvedValue({
      data: [
        { id: 'pm_old', created: 50, card: { country: 'US' } },
        { id: 'pm_new', created: 200, card: { country: 'US' } },
      ],
    });
    paymentIntentsCreate.mockResolvedValue({
      id: 'pi_123',
      status: 'processing',
    });

    const result = await service.checkValidCard(makeEvent());

    expect(result).toBe(false);
    expect(paymentMethodsDetach).toHaveBeenCalledWith('pm_new');
    expect(paymentMethodsDetach).not.toHaveBeenCalledWith('pm_old');
    expect(subscriptionsCancel).toHaveBeenCalledWith('sub_123');
  });

  it('returns true without checking cards when the org does not allow trial', async () => {
    organizationService.getOrgByCustomerId.mockResolvedValue({
      allowTrial: false,
    });

    const result = await service.checkValidCard(makeEvent());

    expect(result).toBe(true);
    expect(paymentMethodsList).not.toHaveBeenCalled();
  });
});
