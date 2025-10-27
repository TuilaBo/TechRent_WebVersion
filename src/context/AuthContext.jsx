import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const {
    token,
    user,
    fetchMe,
    login,
    register,
    verifyEmail,
    resendVerification,
    logout,
    loading,
    error,
    clearError,
  } = useAuthStore();

  const [bootstrapped, setBootstrapped] = useState(false);

  // Khi có token -> lấy hồ sơ /me (nếu chưa có user)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (token && !user) {
          await fetchMe().catch(() => {});
        }
      } finally {
        if (mounted) setBootstrapped(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]); // cố ý bỏ user khỏi deps

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role ?? null,            // <-- expose role
      isAuthenticated: !!token && !!user,
      loading,
      error,
      clearError,
      // actions
      login,
      register,
      verifyEmail,
      resendVerification,
      fetchMe,
      logout,
      bootstrapped,
    }),
    [token, user, loading, error, bootstrapped]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
