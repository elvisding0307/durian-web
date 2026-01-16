//! API 客户端模块
//!
//! 封装与后端服务器的所有 HTTP 通信

use once_cell::sync::Lazy;
use reqwest::blocking::Client;
use std::time::Duration;

use crate::crypto::{hash_core_password, hash_login_password};
use crate::error::{DurianError, DurianResult};
use crate::models::{ApiResponse, LoginResponseData, QueryResponseData};

// ============================================
// 配置常量
// ============================================

/// HTTP 请求超时时间（秒）
const REQUEST_TIMEOUT_SECS: u64 = 30;

/// HTTP 连接超时时间（秒）
const CONNECT_TIMEOUT_SECS: u64 = 10;

// ============================================
// HTTP 客户端
// ============================================

/// 全局 HTTP 客户端（单例）
pub static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .pool_max_idle_per_host(5)
        .build()
        .expect("创建 HTTP 客户端失败")
});

// ============================================
// 认证相关 API
// ============================================

/// 用户登录请求
///
/// # Arguments
/// * `api_base_url` - API 基础 URL
/// * `username` - 用户名
/// * `password` - 密码（明文，函数内部会进行哈希）
/// * `core_password` - 核心密码（明文，函数内部会进行哈希）
///
/// # Returns
/// 登录响应，包含 token
pub fn api_login(
    api_base_url: &str,
    username: &str,
    password: &str,
    core_password: &str,
) -> DurianResult<ApiResponse<LoginResponseData>> {
    let url = format!("{}/v1/login", api_base_url);

    let body = serde_json::json!({
        "username": username,
        "password": hash_login_password(password),
        "core_password": hash_core_password(core_password)
    });

    let response = HTTP_CLIENT
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()?;

    response
        .json::<ApiResponse<LoginResponseData>>()
        .map_err(|e| DurianError::network(format!("解析响应失败: {}", e)))
}

/// 用户注册请求
///
/// # Arguments
/// * `api_base_url` - API 基础 URL
/// * `username` - 用户名
/// * `password` - 密码（明文，函数内部会进行哈希）
/// * `core_password` - 核心密码（明文，函数内部会进行哈希）
///
/// # Returns
/// 注册响应
pub fn api_register(
    api_base_url: &str,
    username: &str,
    password: &str,
    core_password: &str,
) -> DurianResult<ApiResponse<serde_json::Value>> {
    let url = format!("{}/v1/register", api_base_url);

    let body = serde_json::json!({
        "username": username,
        "password": hash_login_password(password),
        "core_password": hash_core_password(core_password)
    });

    let response = HTTP_CLIENT
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()?;

    response
        .json::<ApiResponse<serde_json::Value>>()
        .map_err(|e| DurianError::network(format!("解析响应失败: {}", e)))
}

/// 验证 Token 有效性
///
/// # Arguments
/// * `api_base_url` - API 基础 URL
/// * `token` - 认证令牌
///
/// # Returns
/// token 是否有效
pub fn api_verify(api_base_url: &str, token: &str) -> DurianResult<bool> {
    let url = format!("{}/v1/auth/verify", api_base_url);

    let response = HTTP_CLIENT
        .get(&url)
        .header("Authorization", token)
        .send()?;

    Ok(response.status().is_success())
}

// ============================================
// 账户管理 API
// ============================================

/// 查询账户列表
///
/// # Arguments
/// * `api_base_url` - API 基础 URL
/// * `token` - 认证令牌
/// * `update_time` - 上次更新时间戳，用于增量查询
///
/// # Returns
/// 账户列表响应
pub fn api_query_accounts(
    api_base_url: &str,
    token: &str,
    update_time: i64,
) -> DurianResult<ApiResponse<QueryResponseData>> {
    let url = format!("{}/v1/account?update_time={}", api_base_url, update_time);

    let response = HTTP_CLIENT
        .get(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", token)
        .send()?;

    response
        .json::<ApiResponse<QueryResponseData>>()
        .map_err(|e| DurianError::network(format!("解析响应失败: {}", e)))
}

/// 插入新账户
///
/// # Arguments
/// * `api_base_url` - API 基础 URL
/// * `token` - 认证令牌
/// * `website` - 网站地址
/// * `account` - 账号名
/// * `password` - 加密后的密码
///
/// # Returns
/// 插入响应
pub fn api_insert_account(
    api_base_url: &str,
    token: &str,
    website: &str,
    account: &str,
    password: &str,
) -> DurianResult<ApiResponse<serde_json::Value>> {
    let url = format!("{}/v1/account", api_base_url);

    let body = serde_json::json!({
        "website": website,
        "account": account,
        "password": password
    });

    let response = HTTP_CLIENT
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", token)
        .json(&body)
        .send()?;

    response
        .json::<ApiResponse<serde_json::Value>>()
        .map_err(|e| DurianError::network(format!("解析响应失败: {}", e)))
}

/// 更新账户信息
///
/// # Arguments
/// * `api_base_url` - API 基础 URL
/// * `token` - 认证令牌
/// * `rid` - 记录 ID
/// * `website` - 网站地址
/// * `account` - 账号名
/// * `password` - 加密后的密码
///
/// # Returns
/// 更新响应
pub fn api_update_account(
    api_base_url: &str,
    token: &str,
    rid: i64,
    website: &str,
    account: &str,
    password: &str,
) -> DurianResult<ApiResponse<serde_json::Value>> {
    let url = format!("{}/v1/account", api_base_url);

    let body = serde_json::json!({
        "rid": rid,
        "website": website,
        "account": account,
        "password": password
    });

    let response = HTTP_CLIENT
        .put(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", token)
        .json(&body)
        .send()?;

    response
        .json::<ApiResponse<serde_json::Value>>()
        .map_err(|e| DurianError::network(format!("解析响应失败: {}", e)))
}

/// 删除账户
///
/// # Arguments
/// * `api_base_url` - API 基础 URL
/// * `token` - 认证令牌
/// * `rid` - 记录 ID
///
/// # Returns
/// 删除响应
pub fn api_delete_account(
    api_base_url: &str,
    token: &str,
    rid: i64,
) -> DurianResult<ApiResponse<serde_json::Value>> {
    let url = format!("{}/v1/account", api_base_url);

    let body = serde_json::json!({
        "rid": rid
    });

    let response = HTTP_CLIENT
        .delete(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", token)
        .json(&body)
        .send()?;

    response
        .json::<ApiResponse<serde_json::Value>>()
        .map_err(|e| DurianError::network(format!("解析响应失败: {}", e)))
}
