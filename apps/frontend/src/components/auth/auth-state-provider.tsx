"use client";

import * as React from "react";
import type { AuthSessionData, OrganizationData } from "@/lib/auth/types";

export interface AuthState {
	session: AuthSessionData | null;
	role: string | null;
	isActive: boolean;
	activeOrganization: OrganizationData | null;
	memberRole: string | null;
}

const AuthStateContext = React.createContext<AuthState | null>(null);

/**
 * Provide the server-resolved auth session and authorization state to client components.
 */
export function AuthStateProvider({
	value,
	children,
}: {
	value: AuthState;
	children: React.ReactNode;
}) {
	return (
		<AuthStateContext.Provider value={value}>
			{children}
		</AuthStateContext.Provider>
	);
}

/**
 * Access the current server-hydrated auth state in client components.
 */
export function useAuthStateContext() {
	return React.useContext(AuthStateContext);
}
