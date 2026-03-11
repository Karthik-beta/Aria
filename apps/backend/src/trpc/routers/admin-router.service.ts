import { Injectable } from "@nestjs/common";
import type { AuditService } from "../../authorization/audit.service";
import type { PolicyService } from "../../authorization/policy.service";
import type {
	PermissionService,
	RoleService,
} from "../../authorization/role-permission.service";
import type { ScopeService } from "../../authorization/scope.service";
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
