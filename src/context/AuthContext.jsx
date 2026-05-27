import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUser,
  normalizeAuthUser,
  setTokenRefreshHandler,
  setUnauthorizedHandler,
} from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredAccessToken());
  const [refreshToken, setRefreshToken] = useState(() => getStoredRefreshToken());
  const [user, setUser] = useState(() => getStoredUser());

  const logout = useCallback(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh_token");
    localStorage.removeItem("tm_user");
    setToken("");
    setRefreshToken("");
    setUser(null);
  }, []);

  const login = useCallback((newToken, newUser, newRefreshToken) => {
    const normalized = normalizeAuthUser(newUser);
    if (!newToken || !normalized) {
      throw new Error("Invalid login response");
    }
    setToken(newToken);
    setUser(normalized);
    localStorage.setItem("tm_token", newToken);
    localStorage.setItem("tm_user", JSON.stringify(normalized));
    if (newRefreshToken) {
      setRefreshToken(newRefreshToken);
      localStorage.setItem("tm_refresh_token", newRefreshToken);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    setTokenRefreshHandler(({ accessToken, refreshToken: nextRefreshToken, user: nextUser }) => {
      setToken(accessToken);
      if (nextRefreshToken) {
        setRefreshToken(nextRefreshToken);
      }
      if (nextUser) {
        setUser(nextUser);
      }
    });
    return () => setTokenRefreshHandler(null);
  }, []);

  useEffect(() => {
    if (token && !user) {
      logout();
    }
  }, [token, user, logout]);

  const updateUser = (partial) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      localStorage.setItem("tm_user", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ token, refreshToken, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
