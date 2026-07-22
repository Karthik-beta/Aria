// biome-ignore-all lint/suspicious/noConfusingVoidType: tRPC no-input procedure declarations intentionally use void in this shared contract surface.
import { Company } from "@aria/types";
import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
	TRPCMutationProcedure,
	TRPCQueryProcedure,
} from "@trpc/server";
import type { LegacyObservableSubscriptionProcedure } from "@trpc/server/unstable-core-do-not-import";
import type { accountRouter } from "../../../trpc/routers/account.router";

type CompaniesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Company.CompanyItem | { id: string };
};

type CompanyRouterInput = {
	// ── Company CRUD ────────────────────────────────────────────────────────
	listCompanies: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					isGroup?: boolean | undefined;
			  }
			| undefined;
		output: Company.CompanyListResult;
		meta: object;
	}>;
	getCompanyById: TRPCQueryProcedure<{
		input: { id: string };
		output: Company.CompanyItem | null;
		meta: object;
	}>;
	createCompany: TRPCMutationProcedure<{
		input: {
			name: string;
			abbreviation?: string | null | undefined;
			country?: string | null | undefined;
			currency?: string | null | undefined;
			taxId?: string | null | undefined;
			domain?: string | null | undefined;
			isGroup?: boolean | undefined;
			parentCompanyId?: string | null | undefined;
		};
		output: Company.CompanyItem;
		meta: object;
	}>;
	updateCompany: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			abbreviation?: string | null | undefined;
			country?: string | null | undefined;
			currency?: string | null | undefined;
			taxId?: string | null | undefined;
			domain?: string | null | undefined;
			isGroup?: boolean | undefined;
			parentCompanyId?: string | null | undefined;
			disabled?: boolean | undefined;
		};
		output: Company.CompanyItem;
		meta: object;
	}>;
	deleteCompany: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	deleteManyCompanies: TRPCMutationProcedure<{
		input: { ids: string[] };
		output: { count: number };
		meta: object;
	}>;

	// ── Subscriptions ────────────────────────────────────────────────────────
	onCompaniesChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: CompaniesChangedEvent;
		meta: object;
	}>;
};

type CompanyRouterRoot = (typeof accountRouter)["_def"]["_config"]["$types"];
type CompanyRouterRecord = TRPCDecorateCreateRouterOptions<CompanyRouterInput>;

export declare const companyRouter: TRPCBuiltRouter<
	CompanyRouterRoot,
	CompanyRouterRecord
>;
