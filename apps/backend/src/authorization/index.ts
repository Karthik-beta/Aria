/**
 * Authorization Module Exports
 *
 * Provides centralized exports for all authorization-related
 * services, guards, and decorators.
 */

// Module
export { AuthorizationModule } from './authorization.module';

// Services
export { AuditService } from './audit.service';
export { ScopeService } from './scope.service';
export { RoleService, PermissionService } from './role-permission.service';
export { PolicyService } from './policy.service';
export type { UserPolicy, AuthContext, AuthResult } from './policy.service';

// Guards
export {
  PublicRouteGuard,
  ActiveUserGuard,
  AppScopeGuard,
  RolePermissionGuard,
  OwnershipGuard,
} from './guards';

// Decorators
export {
  RequirePermissions,
  RequireRoles,
  AppScope,
  PublicRoute,
} from './decorators';
