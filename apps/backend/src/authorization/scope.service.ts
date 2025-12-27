import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * ScopeService - Ownership and team-based access control
 *
 * Responsibilities:
 * - Check ownership of records (created_by, owner_id)
 * - Check team membership and manager relationships
 * - Validate app supervisor capabilities
 * - Hierarchical team access (managers see reports' data)
 *
 * @see AUTHORIZATION_SPEC.md - Scope hierarchy section
 */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaClient) { }

  /**
   * Check if user is an active supervisor for the specified app
   *
   * @param userId - User ID to check
   * @param appKey - Application key
   * @returns true if user is supervisor for the app
   */
  async isSupervisorOf(userId: string, appKey: string): Promise<boolean> {
    const supervisor = await this.prisma.appSupervisor.findFirst({
      where: {
        supervisorUserId: userId,
        appKey,
      },
    });

    return !!supervisor;
  }

  /**
   * Check if user is a member of the specified team
   *
   * @param userId - User ID to check
   * @param teamId - Team ID
   * @returns true if user is a team member
   */
  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    const member = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
      },
    });

    return !!member;
  }

  /**
   * Check if user is a manager of the specified team
   *
   * @param userId - User ID to check
   * @param teamId - Team ID
   * @returns true if user is the team manager
   */
  async isTeamManager(userId: string, teamId: string): Promise<boolean> {
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        managerUserId: userId,
      },
    });

    return !!team;
  }

  /**
   * Get all teams a user is a member of
   *
   * @param userId - User ID
   * @param appKey - Optional app filter
   * @returns Array of team IDs
   */
  async getUserTeams(userId: string, appKey?: string): Promise<string[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        ...(appKey && {
          team: {
            appKey,
          },
        }),
      },
      select: {
        teamId: true,
      },
    });

    return memberships.map((m) => m.teamId);
  }

  /**
   * Get all teams a user manages
   *
   * @param userId - User ID
   * @param appKey - Optional app filter
   * @returns Array of team IDs
   */
  async getManagedTeams(userId: string, appKey?: string): Promise<string[]> {
    const teams = await this.prisma.team.findMany({
      where: {
        managerUserId: userId,
        ...(appKey && { appKey }),
      },
      select: {
        id: true,
      },
    });

    return teams.map((t) => t.id);
  }

  /**
   * Check if user is in the management hierarchy above target user
   *
   * @param managerId - Potential manager user ID
   * @param subordinateId - Potential subordinate user ID
   * @returns true if managerId is in the hierarchy above subordinateId
   */
  async isInManagementHierarchy(
    managerId: string,
    subordinateId: string,
  ): Promise<boolean> {
    // Recursive check up the management chain (max 10 levels to prevent infinite loops)
    let currentUserId: string | null = subordinateId;
    let depth = 0;
    const MAX_DEPTH = 10;

    while (currentUserId && depth < MAX_DEPTH) {
      const user: { managerId: string | null } | null =
        await this.prisma.user.findUnique({
          where: { id: currentUserId },
          select: { managerId: true },
        });

      if (!user || !user.managerId) {
        return false;
      }

      if (user.managerId === managerId) {
        return true;
      }

      currentUserId = user.managerId;
      depth++;
    }

    return false;
  }

  /**
   * Get all subordinates for a manager (direct and indirect)
   *
   * @param managerId - Manager user ID
   * @param includeIndirect - Include indirect reports (reports of reports)
   * @returns Array of subordinate user IDs
   */
  async getSubordinates(
    managerId: string,
    includeIndirect: boolean = false,
  ): Promise<string[]> {
    if (!includeIndirect) {
      // Direct reports only
      const directReports = await this.prisma.user.findMany({
        where: { managerId },
        select: { id: true },
      });
      return directReports.map((u) => u.id);
    }

    // Get all subordinates recursively
    const allSubordinates = new Set<string>();
    const toProcess = [managerId];
    let depth = 0;
    const MAX_DEPTH = 10;

    while (toProcess.length > 0 && depth < MAX_DEPTH) {
      const currentManagerId = toProcess.shift()!;
      const directReports = await this.prisma.user.findMany({
        where: { managerId: currentManagerId },
        select: { id: true },
      });

      for (const report of directReports) {
        if (!allSubordinates.has(report.id)) {
          allSubordinates.add(report.id);
          toProcess.push(report.id);
        }
      }

      depth++;
    }

    return Array.from(allSubordinates);
  }

  /**
   * Check if user can create users in the specified app
   * Only supervisors of that app (with manager role) can create users
   *
   * @param userId - User ID attempting to create user
   * @param appKey - Application key
   * @returns true if user can create users for this app
   */
  async canCreateUsersInApp(userId: string, appKey: string): Promise<boolean> {
    // Must be a supervisor of the app
    const isSupervisor = await this.isSupervisorOf(userId, appKey);
    if (!isSupervisor) {
      return false;
    }

    // Must have manager role (will be checked separately by policy service)
    return true;
  }

  /**
   * Get all apps a user supervises
   *
   * @param userId - User ID
   * @returns Array of app keys
   */
  async getSupervisedApps(userId: string): Promise<string[]> {
    const supervisions = await this.prisma.appSupervisor.findMany({
      where: { supervisorUserId: userId },
      select: { appKey: true },
    });

    return supervisions.map((s) => s.appKey);
  }

  /**
   * Check team scope access for a given resource
   * Used for filtering queries based on team membership
   *
   * @param userId - User ID
   * @param appKey - Application key
   * @returns Object with team IDs and whether user has manager access
   */
  async getTeamScopeForApp(
    userId: string,
    appKey: string,
  ): Promise<{
    teamIds: string[];
    managedTeamIds: string[];
    isManager: boolean;
  }> {
    const [teamIds, managedTeamIds] = await Promise.all([
      this.getUserTeams(userId, appKey),
      this.getManagedTeams(userId, appKey),
    ]);

    return {
      teamIds,
      managedTeamIds,
      isManager: managedTeamIds.length > 0,
    };
  }
}
