import * as Sentry from '@sentry/nextjs';

const isDev = process.env.NODE_ENV === 'development';

const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  // Sentry DSN
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable Spotlight in development
  spotlight: isDev,

  // Adds request headers and IP for users, for more info visit
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: isDev ? 0 : 1, // Disable tracing in development

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Disable in development for better performance
  enabled: !isDev,
};

export async function register() {
  // Skip Sentry initialization in development for faster startup
  if (isDev) {
    return;
  }

  if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      // Node.js Sentry configuration
      Sentry.init(sentryOptions);
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      // Edge Sentry configuration
      Sentry.init(sentryOptions);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
