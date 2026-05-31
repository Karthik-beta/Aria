import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
	release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
	integrations: [Sentry.replayIntegration()],
	sendDefaultPii: true,
	tracesSampleRate: Number(
		process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
	),
	replaysSessionSampleRate: Number(
		process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0.1",
	),
	replaysOnErrorSampleRate: Number(
		process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? "1.0",
	),
	enabled:
		process.env.NODE_ENV === "production" &&
		!process.env.NEXT_PUBLIC_SENTRY_DISABLED,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
