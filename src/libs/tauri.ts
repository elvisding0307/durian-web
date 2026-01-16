/**
 * Tauri 客户端模块
 * 封装与 Tauri 后端的所有交互逻辑
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  CacheData,
  ApiResponse,
  LoginResponseData,
  QueryResponseData,
  AccountItem,
} from "../types";

// API 基础 URL（从环境变量获取）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7224/api';

// ============================================
// 认证相关 API
// ============================================

/** 用户登录 */
export async function login(
  username: string,
  password: string,
  corePassword: string
): Promise<ApiResponse<LoginResponseData>> {
  try {
    const token = await invoke<string>("login", {
      apiBaseUrl: API_BASE_URL,
      username,
      password,
      corePassword,
    });
    return { code: 0, msg: "登录成功", data: { token } };
  } catch (error) {
    return { code: -1, msg: getErrorMessage(error) };
  }
}

/** 用户注册 */
export async function register(
  username: string,
  password: string,
  corePassword: string
): Promise<ApiResponse<void>> {
  try {
    await invoke("register", {
      apiBaseUrl: API_BASE_URL,
      username,
      password,
      corePassword,
    });
    return { code: 0, msg: "注册成功" };
  } catch (error) {
    return { code: -1, msg: getErrorMessage(error) };
  }
}

/** 验证登录状态 */
export async function verify(): Promise<boolean> {
  try {
    return await invoke<boolean>("verify");
  } catch {
    return false;
  }
}

/** 获取当前用户名 */
export async function getUsername(): Promise<string | null> {
  try {
    return await invoke<string>("get_username");
  } catch {
    return null;
  }
}

/** 获取认证令牌 */
export async function getToken(): Promise<string | null> {
  try {
    return await invoke<string>("get_token");
  } catch {
    return null;
  }
}

// ============================================
// 账户管理 API
// ============================================

/** 查询账户列表 */
export async function queryAccounts(
  forceRefresh: boolean = false
): Promise<ApiResponse<QueryResponseData>> {
  try {
    const result = await invoke<string>("query_accounts", { forceRefresh });
    if (!result || result === "{}") {
      return {
        code: 0,
        msg: "无数据",
        data: { pull_mode: "PULL_NOTHING", update_time: 0, accounts: [] },
      };
    }
    const data = JSON.parse(result) as CacheData;
    return {
      code: 0,
      msg: "查询成功",
      data: {
        pull_mode: "PULL_ALL",
        update_time: data.update_time,
        accounts: data.accounts,
      },
    };
  } catch (error) {
    return { code: -1, msg: getErrorMessage(error) };
  }
}

/** 插入账户 */
export async function insertAccount(
  website: string,
  account: string,
  password: string
): Promise<ApiResponse<void>> {
  try {
    await invoke("insert_account", { website, account, password });
    return { code: 0, msg: "插入成功" };
  } catch (error) {
    return { code: -1, msg: getErrorMessage(error) };
  }
}

/** 更新账户 */
export async function updateAccount(
  rid: number,
  website: string,
  account: string,
  password: string
): Promise<ApiResponse<void>> {
  try {
    await invoke("update_account", { rid, website, account, password });
    return { code: 0, msg: "更新成功" };
  } catch (error) {
    return { code: -1, msg: getErrorMessage(error) };
  }
}

/** 删除账户 */
export async function deleteAccount(rid: number): Promise<ApiResponse<void>> {
  try {
    await invoke("delete_account", { rid });
    return { code: 0, msg: "删除成功" };
  } catch (error) {
    return { code: -1, msg: getErrorMessage(error) };
  }
}

// ============================================
// 加密解密 API
// ============================================

/** 加密消息 */
export async function encrypt(message: string): Promise<string> {
  return invoke<string>("encrypt", { message });
}

/** 解密消息 */
export async function decrypt(message: string): Promise<string> {
  return invoke<string>("decrypt", { message });
}

/** 批量解密消息 */
export async function decryptBatch(messages: string[]): Promise<string[]> {
  return invoke<string[]>("decrypt_batch", { messages });
}

/** 批量解密账户密码（使用后端批量解密命令提高性能） */
export async function decryptAccounts(
  accounts: AccountItem[]
): Promise<AccountItem[]> {
  if (accounts.length === 0) return [];
  
  // 提取所有密码进行批量解密
  const passwords = accounts.map(acc => acc.password);
  const decryptedPasswords = await decryptBatch(passwords);
  
  // 将解密后的密码分配回各账户
  return accounts.map((acc, index) => ({
    ...acc,
    password: decryptedPasswords[index] || acc.password,
  }));
}

// ============================================
// 缓存 API
// ============================================

/** 保存查询缓存 */
export async function saveQueryCache(
  pullMode: string,
  updateTime: number,
  accounts: AccountItem[]
): Promise<void> {
  try {
    await invoke("save_query_cache", {
      pullMode,
      updateTime,
      accountsJson: JSON.stringify(accounts),
    });
  } catch (error) {
    console.error("保存缓存失败:", error);
  }
}

/** 加载查询缓存 */
export async function loadQueryCache(): Promise<CacheData | null> {
  try {
    const result = await invoke<string>("load_query_cache");
    if (!result || result === "{}") return null;
    return JSON.parse(result) as CacheData;
  } catch (error) {
    console.error("加载缓存失败:", error);
    return null;
  }
}

/** 获取最后更新时间 */
export async function getLastUpdateTime(): Promise<number> {
  return invoke<number>("get_last_update_time");
}

// ============================================
// 工具函数
// ============================================

/** 获取错误消息 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '未知错误';
}
