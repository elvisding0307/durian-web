//! 应用状态管理模块
//!
//! 管理应用的全局状态，包括用户信息、认证令牌和数据库路径
//!
//! # 线程安全
//! 使用 `LazyLock<RwLock<Option<DurianState>>>` 实现：
//! - LazyLock: 首次访问时懒加载初始化
//! - RwLock: 允许多个读者或单个写者，优化读取性能
//! - Option: 允许状态被设置和清除

use std::path::PathBuf;
use std::sync::{LazyLock, RwLock, RwLockReadGuard, RwLockWriteGuard};

use crate::database;
use crate::error::{DurianError, DurianResult};
use crate::models::CacheData;

// ============================================
// 状态结构定义
// ============================================

/// Durian 应用状态
///
/// 保存当前登录用户的所有状态信息
pub struct DurianState {
    /// 当前登录用户名
    pub username: String,
    /// 核心密码（用于本地加密）
    pub core_password: String,
    /// 认证令牌
    pub token: String,
    /// SQLite 数据库文件路径
    pub db_path: PathBuf,
    /// API 基础 URL
    pub api_base_url: String,
}

// ============================================
// 全局状态变量
// ============================================

/// 全局状态变量
///
/// 使用 LazyLock + RwLock<Option<>> 实现线程安全的可变状态
/// - LazyLock: 首次访问时懒加载初始化，线程安全
/// - RwLock: 提供多读单写的并发访问
/// - Option: 允许状态被设置（登录）和清除（登出）
static DURIAN_STATE: LazyLock<RwLock<Option<DurianState>>> = LazyLock::new(|| RwLock::new(None));

// ============================================
// DurianState 实现
// ============================================

impl DurianState {
    /// 创建新的应用状态
    ///
    /// # Arguments
    /// * `username` - 用户名
    /// * `core_password` - 核心密码
    /// * `token` - 认证令牌
    /// * `api_base_url` - API 基础 URL
    ///
    /// # Returns
    /// 新的 DurianState 实例，或错误
    pub fn new(
        username: String,
        core_password: String,
        token: String,
        api_base_url: String,
    ) -> DurianResult<DurianState> {
        // 输入验证
        if username.is_empty() {
            return Err(DurianError::validation("用户名不能为空"));
        }
        if core_password.is_empty() {
            return Err(DurianError::validation("核心密码不能为空"));
        }
        if token.is_empty() {
            return Err(DurianError::validation("认证令牌不能为空"));
        }
        if api_base_url.is_empty() {
            return Err(DurianError::validation("API URL 不能为空"));
        }

        // 获取应用数据目录
        let app_data_dir = dirs::data_dir()
            .ok_or_else(|| DurianError::config("无法获取 AppData 目录"))?
            .join("durian-web");

        // 确保目录存在
        std::fs::create_dir_all(&app_data_dir)?;
        let db_path = app_data_dir.join("cache.db");

        let state = DurianState {
            username,
            core_password,
            token,
            db_path,
            api_base_url,
        };

        // 初始化数据库
        database::init_database(&state.db_path)?;

        Ok(state)
    }

    // ============================================
    // 数据库操作代理方法
    // ============================================

    /// 保存缓存数据
    pub fn save_cache_data(&self, data: &CacheData, pull_mode: &str) -> DurianResult<()> {
        database::save_cache_data(&self.db_path, &self.username, data, pull_mode)
    }

    /// 加载缓存数据
    pub fn load_cache_data(&self) -> DurianResult<Option<CacheData>> {
        database::load_cache_data(&self.db_path, &self.username)
    }

    /// 获取最后更新时间
    pub fn get_last_update_time(&self) -> DurianResult<i64> {
        database::get_last_update_time(&self.db_path, &self.username)
    }

    /// 清除用户缓存
    pub fn clear_cache(&self) -> DurianResult<()> {
        database::clear_user_cache(&self.db_path, &self.username)
    }
}

// ============================================
// 全局状态管理函数
// ============================================

/// 初始化全局状态
///
/// # Arguments
/// * `state` - DurianState 实例
pub fn set_global_state(state: DurianState) {
    let mut guard = DURIAN_STATE.write().expect("写锁定失败");
    *guard = Some(state);
}

/// 获取全局状态的只读引用
///
/// 使用 RwLock 的读锁，允许多个读者同时访问
///
/// # Returns
/// 状态的只读守卫，或错误信息
pub fn get_state() -> DurianResult<StateReadGuard<'static>> {
    let guard = DURIAN_STATE.read().map_err(|_| DurianError::StateLockError)?;
    
    if guard.is_none() {
        return Err(DurianError::StateNotInitialized);
    }
    
    Ok(StateReadGuard { guard })
}

/// 获取全局状态的可写引用
///
/// 使用 RwLock 的写锁，独占访问
///
/// # Returns
/// 状态的可写守卫，或错误信息
#[allow(dead_code)]
pub fn get_state_mut() -> DurianResult<StateWriteGuard<'static>> {
    let guard = DURIAN_STATE.write().map_err(|_| DurianError::StateLockError)?;
    
    if guard.is_none() {
        return Err(DurianError::StateNotInitialized);
    }
    
    Ok(StateWriteGuard { guard })
}

/// 检查全局状态是否已初始化
pub fn is_state_initialized() -> bool {
    DURIAN_STATE.read().map(|g| g.is_some()).unwrap_or(false)
}

/// 清除全局状态（用于测试或登出）
pub fn clear_state() {
    let mut guard = DURIAN_STATE.write().expect("写锁定失败");
    *guard = None;
}

// ============================================
// 状态守卫类型
// ============================================

/// 只读状态守卫，提供对 DurianState 的安全读取访问
pub struct StateReadGuard<'a> {
    guard: RwLockReadGuard<'a, Option<DurianState>>,
}

impl<'a> std::ops::Deref for StateReadGuard<'a> {
    type Target = DurianState;
    
    fn deref(&self) -> &Self::Target {
        // 安全：我们在 get_state() 中已经检查了 is_some()
        self.guard.as_ref().unwrap()
    }
}

/// 可写状态守卫，提供对 DurianState 的安全写入访问
#[allow(dead_code)]
pub struct StateWriteGuard<'a> {
    guard: RwLockWriteGuard<'a, Option<DurianState>>,
}

impl<'a> std::ops::Deref for StateWriteGuard<'a> {
    type Target = DurianState;
    
    fn deref(&self) -> &Self::Target {
        self.guard.as_ref().unwrap()
    }
}

impl<'a> std::ops::DerefMut for StateWriteGuard<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.guard.as_mut().unwrap()
    }
}

// ============================================
// 便捷访问函数
// ============================================

/// 获取当前用户名
pub fn get_username() -> DurianResult<String> {
    let state = get_state()?;
    Ok(state.username.clone())
}

/// 获取当前认证令牌
pub fn get_token() -> DurianResult<String> {
    let state = get_state()?;
    Ok(state.token.clone())
}

/// 获取核心密码
pub fn get_core_password() -> DurianResult<String> {
    let state = get_state()?;
    Ok(state.core_password.clone())
}

/// 获取 API 基础 URL
pub fn get_api_base_url() -> DurianResult<String> {
    let state = get_state()?;
    Ok(state.api_base_url.clone())
}

// ============================================
// 单元测试
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_not_initialized() {
        clear_state();
        let result = get_state();
        assert!(result.is_err());
    }

    #[test]
    fn test_is_state_initialized() {
        clear_state();
        assert!(!is_state_initialized());
    }
}
