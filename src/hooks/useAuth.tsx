/**
 * 认证状态管理 Hook
 * 提供用户登录、登出、状态检查等功能
 */
import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../libs/tauri";
import type { User, AuthContextType, LoginFormData } from "../types";

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** 认证提供者组件 Props */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 认证提供者组件
 * 包装应用程序以提供认证状态
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  /** 清除错误 */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 用户登录
   * @returns 登录是否成功
   */
  const login = useCallback(async (data: LoginFormData): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.login(
        data.username,
        data.password,
        data.core_password
      );

      if (response.code === 0 && response.data) {
        setUser({ username: data.username });
        return true;
      } else {
        setError(response.msg || "登录失败");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败";
      setError(message);
      console.error("Login failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** 用户登出 */
  const logout = useCallback(() => {
    setUser(null);
    setError(null);
    navigate("/login");
  }, [navigate]);

  /** 检查认证状态 */
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      // 验证 token 有效性
      const isValid = await api.verify();
      if (!isValid) {
        setUser(null);
        return;
      }

      // 获取用户名
      const username = await api.getUsername();
      if (!username) {
        setUser(null);
        return;
      }

      setUser({ username });
      navigate("/account");
    } catch (err) {
      console.error("Auth check failed:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // 组件加载时检查认证状态
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 使用 useMemo 缓存上下文值，避免不必要的重渲染
  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      error,
      login,
      logout,
      checkAuth,
      clearError,
    }),
    [user, isLoading, error, login, logout, checkAuth, clearError]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 使用认证状态 Hook
 * @returns 认证上下文
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthContext };
