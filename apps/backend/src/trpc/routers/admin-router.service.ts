import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AuditService } from "../../authorization/audit.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PolicyService } from "../../authorization/policy.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import {
	PermissionService,
	RoleService,
} from "../../authorization/role-permission.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { ScopeService } from "../../authorization/scope.service";
import { createAdminRouter } from "./admin.router";

/**
 * AdminRouter service provides the admin TRPC router
 */
@Injectable()
export class AdminRouter {
	constructor(
		private readonly roleService: RoleService,
		private readonly permissionService: PermissionService,
		private readonly scopeService: ScopeService,
		private readonly policyService: PolicyService,
		private readonly auditService: AuditService,
	) {}

	getRouter(): ReturnType<typeof createAdminRouter> {
		return createAdminRouter({
			roleService: this.roleService,
			permissionService: this.permissionService,
			scopeService: this.scopeService,
			policyService: this.policyService,
			auditService: this.auditService,
		});
	}
}
