"use client";

import * as React from "react";
import type { AuthorizationData } from "@/lib/auth/authorization";

const AuthorizationContext = React.createContext<AuthorizationData | null>(
	null,
);

export function AuthorizationProvider({
	value,
	children,
}: {
	value: AuthorizationData;
	children: React.ReactNode;
}) {
	return (
		<AuthorizationContext.Provider value={value}>
			{children}
		</AuthorizationContext.Provider>
	);
}

export function useAuthorizationContext() {
	return React.useContext(AuthorizationContext);
}
