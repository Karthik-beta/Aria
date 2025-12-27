import { authorizationRouter } from '../authorization.router';
import { auth } from '../../../auth/auth.config';
import type { TrpcContextType } from '../../trpc.context';

const prismaMock = {
  userRole: { findMany: jest.fn() },
  rolePermission: { findMany: jest.fn() },
  teamMember: { findMany: jest.fn() },
  appSupervisor: { findMany: jest.fn() },
};

jest.mock('../../../generated/prisma/client.js', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

jest.mock('../../../auth/auth.config', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

const createCaller = () => {
  const ctx: TrpcContextType = {
    req: { headers: {} } as any,
    res: {} as any,
    prisma: prismaMock as any,
  };

  return authorizationRouter.createCaller(ctx);
};

const getSessionMock = jest.mocked(auth.api.getSession);

describe('authorizationRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSessionMock.mockReset();
  });

  it('returns aggregated authorization data for active session', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1' },
      session: { id: 'session-1' },
    } as any);

    prismaMock.userRole.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        appKey: 'crm',
        role: {
          id: 'role-1',
          key: 'admin',
          rolePermissions: [],
        },
      },
    ]);

    prismaMock.rolePermission.findMany.mockResolvedValue([
      {
        roleId: 'role-1',
        permission: { key: 'system:user.manage' },
      },
    ]);

    prismaMock.teamMember.findMany.mockResolvedValue([
      { team: { appKey: 'crm' } },
    ]);

    prismaMock.appSupervisor.findMany.mockResolvedValue([
      { app: { appKey: 'inventory' } },
    ]);

    const caller = createCaller();
    const result = await caller.getUserAuthorization();

    expect(result.roles).toEqual(['admin']);
    expect(result.permissions).toEqual(['system:user.manage']);
    expect(result.apps).toEqual({ crm: { roles: ['admin'] } });
    expect(result.supervisedApps).toEqual(['inventory']);
    expect(result.isActive).toBe(true);
  });

  it('throws UNAUTHORIZED when no session available', async () => {
    getSessionMock.mockResolvedValue(null);

    const caller = createCaller();

    await expect(caller.getUserAuthorization()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('returns safe fallback when prisma throws', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1' },
      session: { id: 'session-1' },
    } as any);

    prismaMock.userRole.findMany.mockRejectedValue(new Error('db unavailable'));

    const caller = createCaller();
    const result = await caller.getUserAuthorization();

    expect(result).toEqual({
      roles: [],
      permissions: [],
      apps: {},
      supervisedApps: [],
      isActive: false,
    });
  });
});
