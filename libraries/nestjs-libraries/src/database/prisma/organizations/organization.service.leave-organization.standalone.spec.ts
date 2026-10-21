// New feature: self-service "leave organization" (POST /settings/team/leave).
// Before this, the only way for a non-owner team member to get out of an
// org they no longer wanted to be part of was deleting their entire Postiz
// account - deleteTeamMember() never allowed removing yourself (correctly,
// after the fix in the same commit series), and there was no other path.
// leaveOrganization() is the self-service counterpart: it must still block
// the two cases that would break the account -
//   1. leaving your only organization (auth middleware always needs at
//      least one non-disabled org to fall back into), and
//   2. leaving as the organization's only Super Admin (nobody left able to
//      manage the team or billing) -
// but otherwise let a member remove themselves.
const getOrgsByUserId = jest.fn();
const countSuperAdmins = jest.fn();
const deleteTeamMember = jest.fn();

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository',
  () => ({
    OrganizationRepository: class {
      getOrgsByUserId = getOrgsByUserId;
      countSuperAdmins = countSuperAdmins;
      deleteTeamMember = deleteTeamMember;
    },
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  () => ({ NotificationService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service',
  () => ({ AutopostService: class {} })
);
jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: class {},
}));

import { OrganizationService } from './organization.service';

const USER = { id: 'user-1' } as any;
const ORG = { id: 'org-1' } as any;

describe('OrganizationService.leaveOrganization', () => {
  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationService({} as any, {} as any);
    (service as any)._organizationRepository = {
      getOrgsByUserId,
      countSuperAdmins,
      deleteTeamMember,
    };
  });

  it('refuses to leave your only organization', async () => {
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-1', users: [{ role: 'ADMIN' }] },
    ]);

    await expect(service.leaveOrganization(USER, ORG)).rejects.toThrow();
    expect(deleteTeamMember).not.toHaveBeenCalled();
  });

  it('refuses to leave as the only Super Admin, even with other orgs', async () => {
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-1', users: [{ role: 'SUPERADMIN' }] },
      { id: 'org-2', users: [{ role: 'USER' }] },
    ]);
    countSuperAdmins.mockResolvedValue(1);

    await expect(service.leaveOrganization(USER, ORG)).rejects.toThrow();
    expect(deleteTeamMember).not.toHaveBeenCalled();
  });

  it('allows a Super Admin to leave when another Super Admin remains', async () => {
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-1', users: [{ role: 'SUPERADMIN' }] },
      { id: 'org-2', users: [{ role: 'USER' }] },
    ]);
    countSuperAdmins.mockResolvedValue(2);
    deleteTeamMember.mockResolvedValue({ id: 'left' });

    await expect(service.leaveOrganization(USER, ORG)).resolves.toEqual({
      id: 'left',
    });
    expect(deleteTeamMember).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('allows a plain member with other orgs to leave without checking Super Admin count', async () => {
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-1', users: [{ role: 'USER' }] },
      { id: 'org-2', users: [{ role: 'ADMIN' }] },
    ]);
    deleteTeamMember.mockResolvedValue({ id: 'left' });

    await expect(service.leaveOrganization(USER, ORG)).resolves.toEqual({
      id: 'left',
    });
    expect(countSuperAdmins).not.toHaveBeenCalled();
  });

  it('refuses when the user is not actually part of the organization', async () => {
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-2', users: [{ role: 'USER' }] },
      { id: 'org-3', users: [{ role: 'USER' }] },
    ]);

    await expect(service.leaveOrganization(USER, ORG)).rejects.toThrow();
    expect(deleteTeamMember).not.toHaveBeenCalled();
  });
});
