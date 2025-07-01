"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { Form, Input, Button, Card, Typography, message, Row, Col } from "antd";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../libs/api";
import { tauriClient } from "../libs/tauri";

interface User {
  username: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
    core_password: string
  ) => Promise<void>;
  // logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const login = async (
    username: string,
    password: string,
    core_password: string
  ) => {
    try {
      setIsLoading(true);
      const response = await apiClient.login({
        username,
        password,
        core_password,
      });
      // 解构赋值
      const { code, msg, data } = response;
      if (code === undefined || msg === undefined || data === undefined) {
        throw new Error("Invalid response format: missing required fields");
      }
      // 登录成功
      if (response.code === 0 && response.data) {
        const { token } = data;
        if (!token) {
          throw new Error("Invalid response format: missing token");
        }
        // 设置用户状态
        setUser({ username });
        await tauriClient.initState(username, core_password, token);
      } else {
        throw new Error(`${response.code}: ${response.msg}` || "登录失败");
      }
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      if (await apiClient.verify()) {
        const username = (await tauriClient.getUsername()) || null;
        // 对 username 非空判断
        if (username !== null) {
          setUser({ username });
        } else {
          // 清空用户状态
          setUser(null);
        }
        return;
      }
      setUser(null);
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // const logout = async () => {
  //   try {
  //     await apiClient.adminLogout();
  //   } catch (error) {
  //     console.error("Logout failed:", error);
  //   } finally {
  //     setUser(null);
  //     router.push("/admin/login");
  //   }
  // };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        // isAuthenticated,
        login,
        // logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
