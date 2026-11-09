import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";

const statement = {
	...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const orgOwner = ac.newRole({
	...ownerAc.statements,
});

export const orgAdmin = ac.newRole({
	...adminAc.statements,
});

export const orgMember = ac.newRole({
	...memberAc.statements,
});
