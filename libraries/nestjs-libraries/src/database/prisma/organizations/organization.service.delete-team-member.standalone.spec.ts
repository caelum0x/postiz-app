// DELETE /settings/team/:id -> OrganizationService.deleteTeamMember() only
// blocked removal when the caller's role level was strictly *below* the
// target's (`myLevel < userLevel`). The team settings UI only ever shows
// the delete action when the caller's level is strictly *above* the
// target's (`+myLevel > +getLevel(p.role)`, teams.component.tsx), i.e. it
// never lets you remove a same-level peer or yourself. The backend was
// looser than the UI it backs: calling the endpoint directly let a
// SUPERADMIN remove another SUPERADMIN, or remove *themselves* - including
// as the organization's only SUPERADMIN, orphaning it with nobody able to
// manage team/billing. The backend check must be at least as strict as the
// UI: block same-level and self removal too.
const getOrgsByUserId = jest.fn();
const deleteTeamMember = jest.fn();

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository',
  () => ({
    OrganizationRepository: class {
      getOrgsByUserId = getOrgsByUserId;
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

function makeOrg(myRole: 'USER' | 'ADMIN' | 'SUPERADMIN', orgId = 'org-1') {
  return {
    id: orgId,
    // @ts-ignore matches the `// @ts-ignore` read of org.users[0].role in
    // deleteTeamMember()
    users: [{ role: myRole }],
  } as any;
}

describe('OrganizationService.deleteTeamMember', () => {
  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationService({} as any, {} as any);
    (service as any)._organizationRepository = {
      getOrgsByUserId,
      deleteTeamMember,
    };
  });

  it('refuses to let the only SUPERADMIN remove themselves', async () => {
    const selfUserId = 'user-superadmin';
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-1', users: [{ role: 'SUPERADMIN' }] },
    ]);

    await expect(
      service.deleteTeamMember(makeOrg('SUPERADMIN'), selfUserId)
    ).rejects.toThrow();

    expect(deleteTeamMember).not.toHaveBeenCalled();
  });

  it('refuses to let a SUPERADMIN remove another SUPERADMIN', async () => {
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-1', users: [{ role: 'SUPERADMIN' }] },
    ]);

    await expect(
      service.deleteTeamMember(makeOrg('SUPERADMIN'), 'other-superadmin')
    ).rejects.toThrow();

    expect(deleteTeamMember).not.toHaveBeenCalled();
  });

  it('still allows a SUPERADMIN to remove a lower-level member', async () => {
    getOrgsByUserId.mockResolvedValue([
      { id: 'org-1', users: [{ role: 'ADMIN' }] },
    ]);
    deleteTeamMember.mockResolvedValue({ id: 'deleted' });

    await expect(
      service.deleteTeamMember(makeOrg('SUPERADMIN'), 'the-admin')
    ).resolves.toEqual({ id: 'deleted' });

    expect(deleteTeamMember).toHaveBeenCalledWith('org-1', 'the-admin');
  });
});
