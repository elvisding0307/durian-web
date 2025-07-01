import { API_URL } from "../config/url";
import { tauriClient } from "./tauri";

interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}

// 登录
interface LoginRequest {
  username: string;
  password: string;
  core_password: string;
}

interface LoginResponse {
  token: string;
}

class ApiClient {
  private baseUrl = API_URL.trim();

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // 登录
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  // 验证登录状态
  async verify(): Promise<boolean> {
    const token = await tauriClient.getToken();
    // 这里比较特殊，先不走request
    const response = await fetch(`${this.baseUrl}/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: token,
      },
    });
    return response.ok;
  }
}

export const apiClient = new ApiClient();
export type { LoginRequest, LoginResponse, ApiResponse };
