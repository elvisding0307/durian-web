"use client";

import { invoke } from "@tauri-apps/api/core";

class TauriClient {
  async encrypt(message: string): Promise<string> {
    return invoke("encrypt", {
      message: message,
    });
  }
  
  async decrypt(message: string): Promise<string> {
    return invoke("decrypt", {
      message: message,
    });
  }

  // 初始化状态
  async initState(username: string, corePassword: string, token: string): Promise<void> {
    return invoke("init_state", {
      username: username,
      corePassword: corePassword,
      token: token,
    });
  }

  // 保存查询缓存
  async saveQueryCache(updateTime: number, accountsJson: string, pullMode: string): Promise<void> {
    return invoke("save_query_cache", {
      update_time: updateTime,
      accounts_json: accountsJson,
      pull_mode: pullMode,
    });
  }

  // 加载查询缓存
  async loadQueryCache(): Promise<string> {
    return invoke("load_query_cache");
  }

  // 获取最后更新时间
  async getLastUpdateTime(): Promise<number> {
    return invoke("get_last_update_time");
  }

  // 获取 token
  async getToken(): Promise<string> {
    return invoke("get_token");
  }

  // 获取用户名
  async getUsername(): Promise<string> {
    return invoke("get_username");
  }
}

export const tauriClient = new TauriClient();
