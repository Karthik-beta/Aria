import * as Sentry from "@sentry/nextjs";
import { assertValidDevelopmentAuthBypassConfiguration } from "@/lib/auth/development-bypass";

export async function register() {
	assertValidDevelopmentAuthBypassConfiguration();

	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
	}
}

export const onRequestError = Sentry.captureRequestError;
