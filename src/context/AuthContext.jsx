import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { token, user, fetchMe, login, register, verifyEmail, resendVerification, logout, loading, error, clearError } =
    useAuthStore();
  const [bootstrapped, setBootstrapped] = useState(false);

  // khi có token -> gọi /me 1 lần để lấy hồ sơ
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (token && !user) {
        await fetchMe().catch(() => {});
      }
      if (mounted) setBootstrapped(true);
    })();
    return () => {
      mounted = false;
    };
  }, [token]); // intentionally ignore user

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: !!token && !!user,
      loading,
      error,
      clearError,
      // expose actions
      login,
      register,
      verifyEmail,
      resendVerification,
      fetchMe,
      logout,
      bootstrapped, // để chặn flash khi SSR/refresh
    }),
    [token, user, loading, error, bootstrapped]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
