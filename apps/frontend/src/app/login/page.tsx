import { LoginForm } from '@/components/auth/login-form';

/**
 * Login page
 *
 * @remarks
 * Provides username and password authentication.
 * Only available in production environment.
 */
export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <LoginForm />
    </div>
  );
}
