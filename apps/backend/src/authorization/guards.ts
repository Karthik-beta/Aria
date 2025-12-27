import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PolicyService } from './policy.service';
import { ScopeService } from './scope.service';
import {
  REQUIRE_PERMISSIONS_KEY,
  REQUIRE_ROLES_KEY,
  APP_SCOPE_KEY,
  PUBLIC_ROUTE_KEY,
} from './decorators';

/**
 * Authorization Guards for NestJS
 *
 * Guard execution order (configured in providers):
 * 1. PublicRouteGuard - Skip auth for public routes
 * 2. ActiveUserGuard - Ensure user account is active
 * 3. AppScopeGuard - Validate app context
 * 4. RolePermissionGuard - Check roles and permissions
 *
 * @see AUTHORIZATION_SPEC.md - Guards & Decorators section
 */

/**
 * PublicRouteGuard - Allow public routes to bypass all authorization
 *
 * Should be the first guard in the chain
 */
@Injectable()
export class PublicRouteGuard implements CanActivate {
  private readonly logger = new Logger(PublicRouteGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      isPublic ||
      (process.env.NODE_ENV === 'development' &&
        process.env.DISABLE_AUTH === 'true')
    ) {
      this.logger.debug(
        'Skipping authorization check (Public route or Dev bypass)',
      );
      return true;
    }

    // Not public, let other guards handle authorization
    return true;
  }
}

/**
 * ActiveUserGuard - Ensure authenticated user's account is active
 *
 * Depends on better-auth session being available on request.user
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  private readonly logger = new Logger(ActiveUserGuard.name);

  constructor(private policyService: PolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Development bypass
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DISABLE_AUTH === 'true'
    ) {
      return true;
    }

    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('No authenticated user found');
    }

    // Check if user account is active
    const policy = await this.policyService.resolveUserPolicy(String(user.id));

    if (!policy.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    // Attach policy to request for later use
    request.userPolicy = policy;

    return true;
  }
}

/**
 * AppScopeGuard - Validate user has access to the specified app
 *
 * Checks @AppScope decorator on controller or handler
 */
@Injectable()
export class AppScopeGuard implements CanActivate {
  private readonly logger = new Logger(AppScopeGuard.name);

  constructor(
    private reflector: Reflector,
    private policyService: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const appKey = this.reflector.getAllAndOverride<string>(APP_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!appKey) {
      // No app scope required
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Development bypass
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DISABLE_AUTH === 'true'
    ) {
      return true;
    }

    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('No authenticated user found');
    }

    const policy = await this.policyService.resolveUserPolicy(
      String(user.id),
      appKey,
    );

    // Super admins have access to all apps
    if (policy.roles.some((r) => r.roleKey === 'super_admin')) {
      return true;
    }

    // Check if user has any role in this app or supervises it
    const hasAppAccess =
      policy.apps.includes(appKey) || policy.supervisedApps.includes(appKey);

    if (!hasAppAccess) {
      throw new ForbiddenException(`No access to application: ${appKey}`);
    }

    // Attach app context to request
    request.appContext = { appKey };

    return true;
  }
}

/**
 * RolePermissionGuard - Check required roles and permissions
 *
 * Checks @RequireRoles and @RequirePermissions decorators
 * Uses PolicyService for RBAC evaluation
 */
@Injectable()
export class RolePermissionGuard implements CanActivate {
  private readonly logger = new Logger(RolePermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private policyService: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles or permissions required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Development bypass
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DISABLE_AUTH === 'true'
    ) {
      return true;
    }

    const user = request.user;

    const rawAppKey: unknown = request.appContext?.appKey;
    const appKey = typeof rawAppKey === 'string' ? rawAppKey : undefined;

    if (!user || !user.id) {
      throw new UnauthorizedException('No authenticated user found');
    }

    const teamId = this.extractFirstString(request, ['teamId', 'team_id']);
    const resourceOwnerId = this.extractFirstString(request, [
      'ownerId',
      'owner_id',
      'userId',
      'user_id',
    ]);
    const resourceTeamId =
      this.extractFirstString(request, [
        'resourceTeamId',
        'resource_team_id',
      ]) || teamId;

    // Check required roles
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = await this.policyService.hasAnyRole(
        String(user.id),
        requiredRoles,
        appKey,
      );

      if (!hasRole) {
        throw new ForbiddenException(
          `Requires one of the following roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // Check required permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      for (const permission of requiredPermissions) {
        const result = await this.policyService.can(
          String(user.id),
          permission,
          {
            userId: String(user.id),
            appKey,
            ...(teamId && { teamId }),
            ...(resourceOwnerId && { resourceOwnerId }),
            ...(resourceTeamId && { resourceTeamId }),
          },
        );

        if (!result.allowed) {
          throw new ForbiddenException(
            result.reason || `Missing required permission: ${permission}`,
          );
        }
      }
    }

    return true;
  }

  private extractFirstString(request: any, keys: string[]): string | undefined {
    const sources = [request.params, request.body, request.query];
    for (const source of sources) {
      if (!source) {
        continue;
      }

      for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
      }
    }

    return undefined;
  }
}

/**
 * OwnershipGuard - Check resource ownership (for entity-level guards)
 *
 * This guard should be used on specific routes that need ownership validation
 * Pass resourceOwnerId via route params or body
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(
    private policyService: PolicyService,
    private scopeService: ScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Development bypass
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DISABLE_AUTH === 'true'
    ) {
      return true;
    }

    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('No authenticated user found');
    }

    // Extract resource owner from params or body
    const resourceOwnerId =
      request.params?.ownerId ||
      request.body?.ownerId ||
      request.query?.ownerId;

    if (!resourceOwnerId) {
      // If no owner specified, can't validate ownership
      this.logger.warn('No resource owner ID provided for ownership check');
      return true;
    }

    const policy = await this.policyService.resolveUserPolicy(String(user.id));

    // Super admins bypass ownership
    if (policy.roles.some((r) => r.roleKey === 'super_admin')) {
      return true;
    }

    // Check if user is the owner or in management hierarchy
    const isOwner = String(user.id) === String(resourceOwnerId);
    if (isOwner) {
      return true;
    }

    const isManager = await this.scopeService.isInManagementHierarchy(
      String(user.id),
      String(resourceOwnerId),
    );

    if (isManager) {
      return true;
    }

    throw new ForbiddenException('You do not own this resource');
  }
}
