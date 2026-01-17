//! 数据模型定义模块
//!
//! 定义了应用中使用的所有数据结构和类型

use serde::{Deserialize, Serialize};
use std::fmt;

// ============================================
// API 响应结构
// ============================================

/// API 响应的通用结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub code: i32,
    pub msg: String,
    #[serde(default)]
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    /// 检查响应是否成功
    #[inline]
    pub fn is_success(&self) -> bool {
        self.code == 0
    }

    /// 获取数据，如果响应失败则返回错误
    pub fn into_result(self) -> Result<T, String> {
        if self.is_success() {
            self.data.ok_or_else(|| self.msg.clone())
        } else {
            Err(self.msg)
        }
    }
}

impl<T: fmt::Debug> fmt::Display for ApiResponse<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "ApiResponse {{ code: {}, msg: {} }}", self.code, self.msg)
    }
}

/// 登录响应数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoginResponseData {
    #[serde(default)]
    pub token: String,
}

/// 查询响应数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QueryResponseData {
    #[serde(default)]
    pub pull_mode: String,
    #[serde(default)]
    pub update_time: i64,
    #[serde(default)]
    pub accounts: Vec<AccountItem>,
}

// ============================================
// 账户相关结构
// ============================================

/// 账户项（API返回的格式）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccountItem {
    #[serde(default)]
    pub rid: i64,
    #[serde(default)]
    pub website: String,
    #[serde(default)]
    pub account: String,
    #[serde(default)]
    pub password: String,
}

impl AccountItem {
    /// 创建新的账户项
    pub fn new(rid: i64, website: String, account: String, password: String) -> Self {
        Self { rid, website, account, password }
    }
}

impl fmt::Display for AccountItem {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Account {{ rid: {}, website: {}, account: {} }}", 
               self.rid, self.website, self.account)
    }
}

/// 账户记录（本地存储格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountRecord {
    pub rid: i64,
    pub username: String,
    pub website: String,
    pub account: String,
    pub password: String,
}

impl AccountRecord {
    /// 创建新的账户记录
    pub fn new(
        rid: i64,
        username: String,
        website: String,
        account: String,
        password: String,
    ) -> Self {
        Self { rid, username, website, account, password }
    }

    /// 从 AccountItem 转换
    pub fn from_item(item: &AccountItem, username: &str) -> Self {
        Self {
            rid: item.rid,
            username: username.to_string(),
            website: item.website.clone(),
            account: item.account.clone(),
            password: item.password.clone(),
        }
    }
}

impl fmt::Display for AccountRecord {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "AccountRecord {{ rid: {}, user: {}, website: {} }}", 
               self.rid, self.username, self.website)
    }
}

/// 缓存数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheData {
    pub username: String,
    pub update_time: i64,
    pub accounts: Vec<AccountRecord>,
}

impl CacheData {
    /// 创建新的缓存数据
    pub fn new(username: String, update_time: i64, accounts: Vec<AccountRecord>) -> Self {
        Self { username, update_time, accounts }
    }

    /// 创建空缓存
    pub fn empty(username: &str) -> Self {
        Self {
            username: username.to_string(),
            update_time: 0,
            accounts: Vec::new(),
        }
    }

    /// 检查缓存是否为空
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.accounts.is_empty()
    }

    /// 获取账户数量
    #[inline]
    pub fn len(&self) -> usize {
        self.accounts.len()
    }
}

impl fmt::Display for CacheData {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "CacheData {{ user: {}, accounts: {}, updated: {} }}", 
               self.username, self.accounts.len(), self.update_time)
    }
}

// ============================================
// 临时数据结构（用于 JSON 解析）
// ============================================

/// 临时账户记录（用于保存缓存时的 JSON 解析）
#[derive(Debug, Clone, Deserialize)]
pub struct TempAccountRecord {
    pub rid: i64,
    pub website: String,
    pub account: String,
    pub password: String,
}
