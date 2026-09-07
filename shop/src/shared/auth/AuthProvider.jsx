import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isTokenValid } from '@cloudgatedevs/cloudgate-client';
import { auth as cloudgateAuth, redirectToLogin } from '@/shared/services/auth';
import { getIdpProfile, PROFILE_REJECTED, getProfilePictureSrc, updateIdpProfile } from './idpProfileApi';

const AuthContext = createContext(null);

// Refresh the access token slightly before it expires (package-managed refresh).
const ACCESS_TOKEN_EXPIRY_BUFFER_SECONDS = 30;
const REFRESH_CHECK_INTERVAL_MS = 5000;

/** @param {ReturnType<typeof normalizeProfile>} profile */
function buildCurrentUser(profile) {
  return {
    user: {
      id: profile.id,
      name: profile.name ?? '',
      surname: profile.surname ?? '',
      emailAddress: profile.email ?? '',
      userName: profile.email ?? '',
      photoUrl: getProfilePictureSrc(profile),
      role: profile.role ?? null,
    },
    tenant: { tenancyName: cloudgateAuth.tenancyName },
  };
}

/** Fallback user from the JWT claims when the profile API is unavailable. */
function buildCurrentUserFromSession(user) {
  if (!user) return null;
  const parts = String(user.displayName || '').trim().split(/\s+/).filter(Boolean);
  return {
    user: {
      id: user.id,
      name: parts[0] ?? user.displayName ?? 'User',
      surname: parts.length > 1 ? parts.slice(1).join(' ') : '',
      emailAddress: user.email ?? '',
      userName: user.email ?? '',
      photoUrl: undefined,
    },
    tenant: { tenancyName: cloudgateAuth.tenancyName },
  };
}

const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(undefined);
  const logoutRef = useRef(() => {});

  const loadProfile = useCallback(async (accessToken) => {
    const profile = await getIdpProfile(accessToken);
    if (profile === PROFILE_REJECTED) {
      // The IdP does not know this token (session from another environment): retrying and
      // refreshing can never succeed, so drop the session and go to the login page.
      logoutRef.current(true);
      return;
    }
    if (profile) {
      setCurrentUser(buildCurrentUser(profile));
      return;
    }
    const fallback = buildCurrentUserFromSession(cloudgateAuth.getUser());
    if (fallback) setCurrentUser(fallback);
  }, []);

  const logout = useCallback((redirect = true) => {
    cloudgateAuth.logout({ redirectToLogin: false });
    setAuth(undefined);
    setCurrentUser(undefined);
    if (redirect && cloudgateAuth.enabled) redirectToLogin();
  }, []);

  logoutRef.current = logout;

  const updateUserProfile = useCallback(async ({ name, surname, email }) => {
    const token = cloudgateAuth.getAccessToken();
    if (!token || !cloudgateAuth.tenancyName) {
      throw new Error('IdP session is not available. Sign in again.');
    }
    const updated = await updateIdpProfile(token, cloudgateAuth.tenancyName, { name, surname, email });
    if (!updated) throw new Error('Profile update failed');
    setCurrentUser(buildCurrentUser(updated));
  }, []);

  // Bootstrap via the package: consume IdP redirect tokens, restore the stored
  // session, or silently refresh an expired one.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await cloudgateAuth.init();
      if (cancelled) return;
      if (!session) {
        setAuth(undefined);
        setCurrentUser(undefined);
        setLoading(false);
        return;
      }
      setAuth({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      await loadProfile(session.accessToken);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  // Proactive refresh shortly before the access token expires.
  useEffect(() => {
    if (!auth?.accessToken || !cloudgateAuth.enabled) return undefined;

    const checkAndRefresh = async () => {
      const token = cloudgateAuth.getAccessToken();
      if (token && isTokenValid(token, ACCESS_TOKEN_EXPIRY_BUFFER_SECONDS)) return;
      const refreshed = await cloudgateAuth.refresh();
      if (refreshed) {
        setAuth({ accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken });
      } else if (!cloudgateAuth.isAuthenticated()) {
        logoutRef.current(true);
      }
    };

    checkAndRefresh();
    const intervalId = setInterval(checkAndRefresh, REFRESH_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [auth?.accessToken]);

  const value = useMemo(
    () => ({
      loading,
      auth,
      currentUser,
      headerUser: currentUser,
      logout,
      updateUser: updateUserProfile,
      refreshLoginDetails: async () => {
        const token = cloudgateAuth.getAccessToken();
        if (token) await loadProfile(token);
      },
    }),
    [loading, auth, currentUser, logout, updateUserProfile, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext, AuthProvider };
