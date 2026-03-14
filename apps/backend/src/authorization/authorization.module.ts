import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import {
	ActiveUserGuard,
	AppScopeGuard,
	OwnershipGuard,
	PublicRouteGuard,
	RolePermissionGuard,
} from "./guards";
import { PolicyService } from "./policy.service";
import { PermissionService, RoleService } from "./role-permission.service";
import { ScopeService } from "./scope.service";

/**
 * AuthorizationModule - Centralized authorization services and guards
 *
 * Provides:
 * - PolicyService - Core RBAC + ABAC evaluation
 * - RoleService - Role management
 * - PermissionService - Permission management
 * - ScopeService - Team and ownership checks
 * - AuditService - Authorization change logging
 * - Guards - Route protection (PublicRoute, ActiveUser, AppScope, RolePermission, Ownership)
 *
 * This module is marked as @Global so authorization services
 * are available throughout the application without explicit imports.
 *
 * @see AUTHORIZATION_SPEC.md
 */
@Global()
@Module({
	providers: [
		// Core services
		AuditService,
		ScopeService,
		RoleService,
		PermissionService,
		PolicyService,

		// Guards
		PublicRouteGuard,
		ActiveUserGuard,
		AppScopeGuard,
		RolePermissionGuard,
		OwnershipGuard,
	],
	exports: [
		// Export services for use in other modules
		AuditService,
		ScopeService,
		RoleService,
		PermissionService,
		PolicyService,

		// Export guards for use in controllers
		PublicRouteGuard,
		ActiveUserGuard,
		AppScopeGuard,
		RolePermissionGuard,
		OwnershipGuard,
	],
})
export class AuthorizationModule {}
