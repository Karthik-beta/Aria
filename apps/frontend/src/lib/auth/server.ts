import { cache } from "react";
import {
	type AuthorizationData,
	EMPTY_AUTHORIZATION_DATA,
	isAuthorizationData,
} from "@/lib/auth/authorization";
import { tryFetchServerTrpcQuery } from "@/lib/trpc/server";

export const getAuthorizationData = cache(
	async (): Promise<AuthorizationData> => {
		const response = await tryFetchServerTrpcQuery<unknown>(
			"authorization.getUserAuthorization",
		);

		return isAuthorizationData(response) ? response : EMPTY_AUTHORIZATION_DATA;
	},
);
