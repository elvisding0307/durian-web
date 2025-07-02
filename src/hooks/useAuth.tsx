import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  hashPassword,
  DURIAN_PASSWORD_SALT,
  DURIAN_CORE_PASSWORD_SALT,
} from "../utils/hash";
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
  const navigate = useNavigate(); // Move useNavigate to the top level

  const login = async (
    username: string,
    password: string,
    core_password: string
  ) => {
    try {
      setIsLoading(true);
      // 对密码进行加盐哈希
      const { hash: hashedPassword } = await hashPassword(
        password,
        DURIAN_PASSWORD_SALT
      );
      const { hash: hashedCorePassword } = await hashPassword(
        core_password,
        DURIAN_CORE_PASSWORD_SALT
      );
      const response = await apiClient.login({
        username,
        password: hashedPassword,
        core_password: hashedCorePassword,
      });
      // 解构赋值
      const { code, msg, data } = response;
      if (code === undefined || msg === undefined) {
        throw new Error("Invalid response format: missing required fields");
      }
      // 登录成功
      if (response.code === 0 && response.data) {
        if (!data) {
          throw new Error("Invalid response format: missing data");
        }
        const { token } = data;
        if (!token) {
          throw new Error("Invalid response format: missing token");
        }
        // 设置用户状态
        await tauriClient.initState(username, core_password, token);
        setUser({ username });
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
      if (!(await apiClient.verify())) {
        setUser(null);
        return;
      }
      const username = (await tauriClient.getUsername()) || null;
      if (username === null) {
        setUser(null);
        return;
      }
      setUser({ username });
      navigate("/account"); // Use the navigate from the top level
    } catch (error) {
      console.error("Auth check failed:", error);
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
