import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { auth as cloudgateAuth, redirectToLogin } from '@/shared/services/auth';
import { useAuthContext } from './useAuthContext';
import { ScreenLoader } from '@/shared/ui/ScreenLoader';

const RequireAuth = () => {
  const { auth, loading } = useAuthContext();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!auth?.accessToken && cloudgateAuth.enabled) {
      setRedirecting(true);
      redirectToLogin();
    }
  }, [loading, auth?.accessToken]);

  if (loading || redirecting) {
    return <ScreenLoader />;
  }

  if (!auth?.accessToken) {
    return (
      <div className="flex min-h-[60vh] grow flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-medium text-mist">Sign-in not configured</p>
        <p className="mt-2 max-w-md text-sm text-mist-muted">
          Set <code className="rounded bg-ink-800 px-1">VITE_IDP_BASE_URL</code> and{' '}
          <code className="rounded bg-ink-800 px-1">VITE_IDP_TENANCY_NAME</code> in your{' '}
          <code className="rounded bg-ink-800 px-1">.env</code> to enable the IdP login flow.
        </p>
      </div>
    );
  }

  return <Outlet />;
};

export { RequireAuth };
