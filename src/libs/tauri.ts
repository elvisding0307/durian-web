
import { invoke } from "@tauri-apps/api/core";

/**
 * 缓存数据类型定义
 * 用于本地SQLite缓存的数据结构
 */
interface CacheDataType {
  username: string; // 用户名
  update_time: number; // 最后更新时间戳
  accounts: {
    // 账户列表
    rid: number;
    website: string;
    account: string;
    password: string; // 加密后的密码
  }[];
}

/**
 * Tauri 客户端类
 * 封装了与 Tauri 后端的所有交互逻辑，提供了加密、解密、状态管理等功能
 */
class TauriClient {
  /**
   * 加密消息
   * @param message 需要加密的明文消息
   * @returns Promise<string> 加密后的密文
   */
  async encrypt(message: string): Promise<string> {
    return invoke("encrypt", {
      message: message,
    });
  }

  /**
   * 解密消息
   * @param message 需要解密的密文消息
   * @returns Promise<string> 解密后的明文
   */
  async decrypt(message: string): Promise<string> {
    return invoke("decrypt", {
      message: message,
    });
  }

  /**
   * 初始化应用状态
   * 设置用户的基本信息，包括用户名、核心密码和认证令牌
   * @param username 用户名
   * @param corePassword 核心密码，用于本地加密
   * @param token 认证令牌，用于服务器验证
   * @returns Promise<void>
   */
  async initState(
    username: string,
    corePassword: string,
    token: string
  ): Promise<void> {
    return invoke("init_state", {
      username: username,
      corePassword: corePassword,
      token: token,
    });
  }

  /**
   * 保存查询缓存到本地SQLite数据库
   * 将从服务器获取的数据保存到本地，用于离线访问和性能优化
   *
   * @param update_time 数据更新时间戳
   * @param accounts 账户数据数组
   * @param pull_mode 拉取模式（增量或全量）
   */
  // 删除这些函数定义（第61-112行）
  // async function saveQueryCache(...)
  // async function loadQueryCache(...)
  // async function getLastUpdateTime(...)
  async saveQueryCache(
    pull_mode: string,
    update_time: number,
    accounts: any[]
  ) {
    try {
      // 调用Tauri后端函数保存缓存
      await invoke("save_query_cache", {
        pullMode: pull_mode,
        updateTime: update_time,
        accountsJson: JSON.stringify(accounts),
      });
      console.log("缓存保存成功");
    } catch (error) {
      console.error("保存缓存失败:", error);
    }
  }

  /**
   * 从本地SQLite数据库加载查询缓存
   * 优先从本地缓存加载数据，提高应用响应速度
   *
   * @returns Promise<CacheData | null> 缓存数据或null（如果无缓存）
   */
  async loadQueryCache(): Promise<CacheDataType | null> {
    try {
      // 调用Tauri后端函数加载缓存
      const result = (await invoke("load_query_cache")) as string;
      if (result === undefined) {
        return null;
      }
      return JSON.parse(result) as CacheDataType;
    } catch (error) {
      console.error("加载缓存失败:", error);
      return null;
    }
  }

  /**
   * 获取最后更新时间
   * 返回缓存数据的最后更新时间戳，用于判断数据是否需要刷新
   * @returns Promise<number> 最后更新时间的时间戳
   */
  async getLastUpdateTime(): Promise<number> {
    return invoke("get_last_update_time");
  }

  /**
   * 获取存储的认证令牌
   * 从本地存储中读取用户的认证令牌
   * @returns Promise<string> 认证令牌
   */
  async getToken(): Promise<string> {
    return invoke("get_token");
  }

  /**
   * 获取存储的用户名
   * 从本地存储中读取当前登录用户的用户名
   * @returns Promise<string | null> 用户名，如果获取失败则返回 null
   */
  async getUsername(): Promise<string | null> {
    try {
      // 调用 Tauri 后端获取用户名
      const username = (await invoke("get_username")) as string;
      return username;
    } catch (error) {
      // 如果获取失败（如用户未登录），返回 null
      return null;
    }
  }
}

// 导出 Tauri 客户端实例（单例模式）
// 整个应用中使用同一个实例，确保状态一致性
export const tauriClient = new TauriClient();
export type CacheData = CacheDataType;
