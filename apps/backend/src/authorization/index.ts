/**
 * Authorization Module Exports
 *
 * Provides centralized exports for all authorization-related
 * services, guards, and decorators.
 */

// Services
export { AuditService } from "./audit.service";
// Module
export { AuthorizationModule } from "./authorization.module";
// Decorators
export {
	AppScope,
	PublicRoute,
	RequirePermissions,
	RequireRoles,
} from "./decorators";
// Guards
export {
	ActiveUserGuard,
	AppScopeGuard,
	OwnershipGuard,
	PublicRouteGuard,
	RolePermissionGuard,
} from "./guards";
export type { AuthContext, AuthResult, UserPolicy } from "./policy.service";
export { PolicyService } from "./policy.service";
export { PermissionService, RoleService } from "./role-permission.service";
export { ScopeService } from "./scope.service";
