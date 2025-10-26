'use client';

import { LoginForm } from '@/components/auth/login-form';
import { authClient } from '@/lib/auth/client';
import { useEffect, useState } from 'react';

/**
 * Login page with comprehensive debugging
 *
 * @remarks
 * Provides username and password authentication.
 * Only available in production environment.
 */
export default function LoginPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const { data: session, isPending, error } = authClient.useSession();

  useEffect(() => {
    // Test auth endpoint directly
    async function testAuthEndpoint() {
      console.log('[LoginPage] Testing auth endpoint...');
      
      // Use the backend URL directly in development
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      try {
        const response = await fetch(`${backendUrl}/api/auth/get-session`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log('[LoginPage] Auth endpoint response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
        });

        const data = await response.json();
        console.log('[LoginPage] Auth endpoint data:', data);

        setDebugInfo({
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          data,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[LoginPage] Auth endpoint error:', err);
        setDebugInfo({
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        });
      }
    }

    testAuthEndpoint();
  }, []);

  useEffect(() => {
    console.log('[LoginPage] Session state:', {
      isPending,
      hasSession: !!session,
      hasError: !!error,
      session,
      error,
    });
  }, [session, isPending, error]);

  return (
    <div className="min-h-screen flex w-full flex-col items-center justify-center">
      {/* Debug Info Banner */}
      {process.env.NODE_ENV === 'production' && (
        <div className="mb-4 w-full max-w-md rounded-lg border border-blue-500 bg-blue-50 p-4 text-sm">
          <p className="font-semibold text-blue-900">Debug Information:</p>
          <div className="mt-2 space-y-1 text-blue-800">
            <p>• Session Pending: {String(isPending)}</p>
            <p>• Has Session: {String(!!session)}</p>
            <p>• Has Error: {String(!!error)}</p>
            {error && (
              <p className="text-red-600">• Error: {JSON.stringify(error)}</p>
            )}
            {debugInfo && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Auth Endpoint Test</summary>
                <pre className="mt-1 overflow-auto text-xs">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}
          </div>
          <p className="mt-2 text-xs text-blue-600">
            Check browser console (F12) for detailed logs
          </p>
        </div>
      )}

      <LoginForm />
    </div>
  );
}

