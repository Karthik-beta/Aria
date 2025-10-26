'use client';

import { useEffect, useState } from 'react';

/**
 * Test page to debug fetch issues
 * 
 * This page tests if the browser can fetch from /api/auth/get-session
 * and displays detailed error information if it fails.
 */
export default function TestFetchPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchInfo, setFetchInfo] = useState<string>('');

  useEffect(() => {
    const testFetch = async () => {
      try {
        setFetchInfo(`Fetching from: ${window.location.origin}/api/auth/get-session`);
        
        const response = await fetch('/api/auth/get-session', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        setFetchInfo(prev => `${prev}\n\nResponse status: ${response.status} ${response.statusText}`);
        setFetchInfo(prev => `${prev}\nHeaders: ${JSON.stringify([...response.headers.entries()], null, 2)}`);
        
        const data = await response.json();
        setResult(data);
        setFetchInfo(prev => `${prev}\n\nData received: ${JSON.stringify(data, null, 2)}`);
      } catch (err: any) {
        setError(err.message || String(err));
        setFetchInfo(prev => `${prev}\n\nERROR: ${err.message}\nStack: ${err.stack}`);
        console.error('[TestFetch] Error:', err);
      }
    };

    testFetch();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold">Fetch Test Page</h1>
        
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">Fetch Info</h2>
          <pre className="whitespace-pre-wrap text-sm">{fetchInfo || 'Loading...'}</pre>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500 bg-red-50 p-6 dark:bg-red-950">
            <h2 className="mb-4 text-xl font-semibold text-red-700 dark:text-red-300">Error</h2>
            <pre className="whitespace-pre-wrap text-sm text-red-600 dark:text-red-400">{error}</pre>
          </div>
        )}

        {result !== null && (
          <div className="rounded-lg border border-green-500 bg-green-50 p-6 dark:bg-green-950">
            <h2 className="mb-4 text-xl font-semibold text-green-700 dark:text-green-300">Success</h2>
            <pre className="whitespace-pre-wrap text-sm text-green-600 dark:text-green-400">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">Environment</h2>
          <ul className="space-y-2 text-sm">
            <li><strong>window.location.origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</li>
            <li><strong>window.location.href:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</li>
            <li><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
