'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

/**
 * Login form component with username and password authentication
 *
 * @remarks
 * Uses better-auth with username plugin for authentication.
 * Only functional in production environment.
 */
export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // track mounted state to prevent state updates after unmount (avoids console error)
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await authClient.signIn.username({
        username,
        password,
      });

      if (error) {
        toast.error(error.message || 'Failed to sign in. Please try again.');
        return;
      }

      if (data) {
        toast.success('Successfully signed in!');
        // Redirect to dashboard or home page
        router.push('/');
        router.refresh();
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <Card className="w-full max-w-md border border-muted/40 shadow-sm backdrop-blur-sm bg-card/90">
      <CardHeader className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 ring-1 ring-primary/20">
            <Icons.login className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Sign In</CardTitle>
            <CardDescription>Secure access to your Aria workspace</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              placeholder="Enter your username"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              disabled={isLoading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                placeholder="Enter your password"
                type={showPassword ? 'text' : 'password'}
                autoCapitalize="none"
                autoComplete="current-password"
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <Icons.eyeOff className="h-4 w-4" />
                ) : (
                  <Icons.eye className="h-4 w-4" />
                )}
                <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>
        <div className="space-y-2 pt-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <button
              type="button"
              className="underline underline-offset-4 hover:text-primary"
              onClick={() => toast.info('Password reset flow coming soon.')}
              disabled={isLoading}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="underline underline-offset-4 hover:text-primary"
              onClick={() => toast.info('Contact support at support@aria.example')}
              disabled={isLoading}
            >
              Need help?
            </button>
          </div>
          <p className="text-[10px] leading-relaxed">
            By signing in you agree to our security & usage policies. Unauthorized access will be
            investigated.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
