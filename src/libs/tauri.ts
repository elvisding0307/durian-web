"use client";

import { invoke } from "@tauri-apps/api/core";

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
   * 保存查询缓存
   * 将账户查询结果缓存到本地，提高后续查询性能
   * @param updateTime 更新时间戳
   * @param accountsJson 账户数据的 JSON 字符串
   * @param pullMode 拉取模式（如增量、全量等）
   * @returns Promise<void>
   */
  async saveQueryCache(
    updateTime: number,
    accountsJson: string,
    pullMode: string
  ): Promise<void> {
    return invoke("save_query_cache", {
      update_time: updateTime,      // 注意：Rust 后端使用 snake_case
      accounts_json: accountsJson,  // 注意：Rust 后端使用 snake_case
      pull_mode: pullMode,          // 注意：Rust 后端使用 snake_case
    });
  }

  /**
   * 加载查询缓存
   * 从本地缓存中读取之前保存的账户查询结果
   * @returns Promise<string> 缓存的账户数据 JSON 字符串
   */
  async loadQueryCache(): Promise<string> {
    return invoke("load_query_cache");
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
