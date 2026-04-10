export const INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE =
	"DISABLE_AUTH can only be enabled in development.";

type DevelopmentAuthBypassState = {
	enabled: boolean;
	error?: string;
};

function isDevelopmentAuthBypassRequested(): boolean {
	return process.env.DISABLE_AUTH === "true";
}

export function getDevelopmentAuthBypassState(): DevelopmentAuthBypassState {
	if (!isDevelopmentAuthBypassRequested()) {
		return { enabled: false };
	}

	if (process.env.NODE_ENV !== "development") {
		return {
			enabled: false,
			error: INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE,
		};
	}

	return { enabled: true };
}

export function assertValidDevelopmentAuthBypassConfiguration(): void {
	const bypassState = getDevelopmentAuthBypassState();

	if (bypassState.error) {
		throw new Error(bypassState.error);
	}
}

export function isDevelopmentAuthBypassEnabled(): boolean {
	return getDevelopmentAuthBypassState().enabled;
}
