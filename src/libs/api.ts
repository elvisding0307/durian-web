import { API_URL } from "../config/url";
import { tauriClient } from "./tauri";

/**
 * API 响应的通用接口
 * @template T 响应数据的类型
 */
interface ApiResponse<T = any> {
  code: number;  // 响应状态码
  msg: string;   // 响应消息
  data?: T;      // 响应数据（可选）
}

// 登录相关接口定义
/**
 * 登录请求参数接口
 */
interface LoginRequest {
  username: string;      // 用户名
  password: string;      // 密码
  core_password: string; // 核心密码
}

/**
 * 登录响应数据接口
 */
interface LoginResponse {
  token: string; // 登录成功后返回的令牌
}

// 注册相关接口定义
/**
 * 注册请求参数接口
 */
interface RegisterRequest {
  username: string;      // 用户名
  password: string;      // 密码
  core_password: string; // 核心密码
}

/**
 * 注册响应数据接口
 */
interface RegisterResponse {
  // 根据实际 API 返回结构定义
  // 这里可以根据后端实际返回的数据结构进行补充
}

/**
 * API 客户端类
 * 封装了与后端 API 的所有交互逻辑
 */
class ApiClient {
  /** API 基础 URL */
  private baseUrl = API_URL.trim();

  /**
   * 通用的 HTTP 请求方法
   * @template T 响应数据的类型
   * @param endpoint API 端点路径
   * @param options 请求选项
   * @returns Promise<ApiResponse<T>> API 响应
   * @throws Error 当请求失败时抛出错误
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // 发送 HTTP 请求
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json", // 设置请求头为 JSON 格式
          ...options.headers, // 合并额外的请求头
        },
      });

      // 解析响应数据
      const data = await response.json();
      
      // 检查响应状态
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error("API request failed:", error);
      throw error; // 重新抛出错误供调用者处理
    }
  }

  /**
   * 用户登录
   * @param credentials 登录凭据（用户名、密码、核心密码）
   * @returns Promise<ApiResponse<LoginResponse>> 登录响应
   */
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>("/login", {
      method: "POST",
      body: JSON.stringify(credentials), // 将登录数据序列化为 JSON
    });
  }

  /**
   * 用户注册
   * @param credentials 注册凭据（用户名、密码、核心密码）
   * @returns Promise<ApiResponse<RegisterResponse>> 注册响应
   */
  async register(credentials: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    return this.request<RegisterResponse>("/register", {
      method: "POST",
      body: JSON.stringify(credentials), // 将注册数据序列化为 JSON
    });
  }

  /**
   * 验证用户登录状态
   * 通过检查存储的 token 是否有效来验证用户是否已登录
   * @returns Promise<boolean> 如果用户已登录且 token 有效则返回 true，否则返回 false
   */
  async verify(): Promise<boolean> {
    // 从 Tauri 客户端获取存储的 token
    const token = await tauriClient.getToken();
    
    // 这里比较特殊，先不走 request 方法
    // 直接使用 fetch 发送验证请求
    const response = await fetch(`${this.baseUrl}/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: token, // 在请求头中携带 token
      },
    });
    
    // 根据响应状态判断 token 是否有效
    return response.ok;
  }
}

// 导出 API 客户端实例（单例模式）
export const apiClient = new ApiClient();

// 导出类型定义，供其他模块使用
export type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, ApiResponse };
