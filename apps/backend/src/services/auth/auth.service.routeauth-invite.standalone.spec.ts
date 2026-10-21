// #2199: registering with a pending org invite link always created a brand
// new (junk) organization for the invited user - routeAuth() called
// createOrgAndUser() unconditionally, then only afterwards tried to also
// join the invite via addUserToOrg(). Even when the invite succeeded, the
// user ended up SUPERADMIN of a throwaway org with the invite as a bonus
// membership instead of the intended destination.
//
// This exercises the LOCAL-provider registration branch of routeAuth():
// a user registering with a valid invite in the `org` cookie should join
// the inviting organization without ever creating a new one, and should
// only fall back to a standalone org if the invite can no longer be
// redeemed (already used, or the org hit its seat limit).
process.env.JWT_SECRET = 'test-secret-for-routeauth-invite-spec';

// AuthService's constructor params pull in UsersService -> UsersRepository
// -> helpers/auth's AuthService, which needs the native bcrypt binding.
// emitDecoratorMetadata keeps that import live at runtime even though this
// spec only ever passes plain mocks for those constructor params, so stub
// it out the same way the integration.repository standalone spec stubs
// UploadFactory to dodge its own unrelated native/ESM-only dependency.
jest.mock('bcrypt', () => ({
  hashSync: jest.fn(() => 'hashed'),
  compareSync: jest.fn(() => true),
}));

// Same chain also drags in UploadFactory -> CloudflareStorage -> `file-type`,
// which is ESM-only and isn't transformable under this standalone Jest
// config (see integration.repository.standalone.spec.ts for precedent).
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => ({ uploadSimple: jest.fn() }),
  },
}));

// AuthService's `_emailService: EmailService` constructor param also keeps
// EmailService's real import alive (emitDecoratorMetadata), which pulls in
// the email provider implementations - unrelated code this spec never
// exercises (a mock EmailService is passed below) and that doesn't compile
// cleanly under this config's relaxed-but-not-identical tsconfig overrides.
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class {},
}));

import { AuthService } from './auth.service';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { Provider } from '@prisma/client';

describe('AuthService.routeAuth - registration with a pending org invite', () => {
  function makeBody(): CreateOrgUserDto {
    const body = new CreateOrgUserDto();
    body.email = 'invited@example.com';
    body.password = 'super-secret-password';
    body.provider = Provider.LOCAL;
    body.company = 'Whatever Inc';
    body.datafast_visitor_id = '';
    return body;
  }

  function makeService(overrides: {
    addUserToOrgResult: any;
  }) {
    const createdUser = {
      id: 'new-user-id',
      email: 'invited@example.com',
      password: 'hashed',
    };

    const organizationService = {
      getCount: jest.fn().mockResolvedValue(1),
      createOrgAndUser: jest.fn(),
      createUser: jest.fn().mockResolvedValue(createdUser),
      createOrgForExistingUser: jest.fn().mockResolvedValue({ id: 'fallback-org-id' }),
      addUserToOrg: jest.fn().mockResolvedValue(overrides.addUserToOrgResult),
    };

    const userService = {
      getUserByEmail: jest.fn().mockResolvedValue(null),
    };

    const emailService = {
      sendEmailSync: jest.fn().mockResolvedValue(undefined),
      hasProvider: jest.fn().mockReturnValue(false),
    };

    const service = new AuthService(
      userService as any,
      organizationService as any,
      emailService as any,
      {} as any
    );

    return { service, organizationService, userService, createdUser };
  }

  it('joins the inviting org and never creates a new organization when the invite is redeemable', async () => {
    const { service, organizationService, createdUser } = makeService({
      addUserToOrgResult: { id: 'membership-id', organizationId: 'inviting-org-id' },
    });

    const result = await service.routeAuth(
      Provider.LOCAL,
      makeBody(),
      '127.0.0.1',
      'test-agent',
      { orgId: 'inviting-org-id', role: 'USER', id: 'invite-id' }
    );

    expect(organizationService.createOrgAndUser).not.toHaveBeenCalled();
    expect(organizationService.createUser).toHaveBeenCalledTimes(1);
    expect(organizationService.addUserToOrg).toHaveBeenCalledWith(
      createdUser.id,
      'invite-id',
      'inviting-org-id',
      'USER'
    );
    expect(organizationService.createOrgForExistingUser).not.toHaveBeenCalled();
    expect(result.addedOrg).toEqual({
      id: 'membership-id',
      organizationId: 'inviting-org-id',
    });
  });

  it('falls back to a standalone org only when the invite can no longer be redeemed', async () => {
    const { service, organizationService, createdUser } = makeService({
      addUserToOrgResult: false,
    });

    await service.routeAuth(
      Provider.LOCAL,
      makeBody(),
      '127.0.0.1',
      'test-agent',
      { orgId: 'inviting-org-id', role: 'USER', id: 'invite-id' }
    );

    expect(organizationService.createOrgAndUser).not.toHaveBeenCalled();
    expect(organizationService.createUser).toHaveBeenCalledTimes(1);
    expect(organizationService.createOrgForExistingUser).toHaveBeenCalledWith(
      createdUser.id,
      'Whatever Inc'
    );
  });

  it('still creates a normal organization when there is no invite', async () => {
    const organizationService = {
      getCount: jest.fn().mockResolvedValue(1),
      createOrgAndUser: jest.fn().mockResolvedValue({
        id: 'org-id',
        users: [{ user: { id: 'owner-id', email: 'owner@example.com' } }],
      }),
      createUser: jest.fn(),
      createOrgForExistingUser: jest.fn(),
      addUserToOrg: jest.fn(),
    };
    const userService = { getUserByEmail: jest.fn().mockResolvedValue(null) };
    const emailService = {
      sendEmailSync: jest.fn().mockResolvedValue(undefined),
      hasProvider: jest.fn().mockReturnValue(false),
    };
    const service = new AuthService(
      userService as any,
      organizationService as any,
      emailService as any,
      {} as any
    );

    const result = await service.routeAuth(
      Provider.LOCAL,
      makeBody(),
      '127.0.0.1',
      'test-agent',
      undefined
    );

    expect(organizationService.createOrgAndUser).toHaveBeenCalledTimes(1);
    expect(organizationService.createUser).not.toHaveBeenCalled();
    expect(result.addedOrg).toBe(false);
  });
});
