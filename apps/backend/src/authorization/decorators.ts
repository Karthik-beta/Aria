import { SetMetadata } from "@nestjs/common";

/**
 * Authorization Decorators for NestJS
 *
 * These decorators attach metadata to route handlers and controllers
 * for use by authorization guards.
 *
 * @see AUTHORIZATION_SPEC.md - Backend Architecture section
 */

// Metadata keys
export const REQUIRE_PERMISSIONS_KEY = "require_permissions";
export const REQUIRE_ROLES_KEY = "require_roles";
export const APP_SCOPE_KEY = "app_scope";
export const PUBLIC_ROUTE_KEY = "public_route";

/**
 * @RequirePermissions - Require specific permissions for route access
 *
 * Usage:
 * ```ts
 * @RequirePermissions('entity:crm:lead.create')
 * @Post('leads')
 * createLead() { }
 *
 * @RequirePermissions('entity:crm:lead.read', 'entity:crm:lead.update')
 * @Put('leads/:id')
 * updateLead() { }
 * ```
 */
export const RequirePermissions = (...permissions: string[]) =>
	SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

/**
 * @RequireRoles - Require specific roles for route access
 *
 * Usage:
 * ```ts
 * @RequireRoles('admin')
 * @Post('users')
 * createUser() { }
 *
 * @RequireRoles('manager', 'admin')
 * @Get('reports')
 * getReports() { }
 * ```
 */
export const RequireRoles = (...roles: string[]) =>
	SetMetadata(REQUIRE_ROLES_KEY, roles);

/**
 * @AppScope - Specify the app context for this route
 *
 * This decorator enforces that the user has appropriate permissions
 * scoped to the specified application.
 *
 * Usage:
 * ```ts
 * @AppScope('crm')
 * @Controller('crm/leads')
 * export class LeadsController { }
 *
 * @AppScope('inventory')
 * @Get('items')
 * getItems() { }
 * ```
 */
export const AppScope = (appKey: string) => SetMetadata(APP_SCOPE_KEY, appKey);

/**
 * @PublicRoute - Mark a route as publicly accessible (skip all auth guards)
 *
 * Usage:
 * ```ts
 * @PublicRoute()
 * @Get('health')
 * healthCheck() { }
 * ```
 */
export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
