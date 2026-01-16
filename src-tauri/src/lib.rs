//! Durian Web - 密码管理工具
//!
//! 这是一个基于 Tauri 的桌面密码管理应用，
//! 提供安全的密码存储和管理功能。
//!
//! # 模块结构
//!
//! - `models` - 数据模型定义
//! - `crypto` - 加密和密码哈希功能
//! - `api_client` - HTTP API 客户端
//! - `database` - SQLite 数据库操作
//! - `state` - 应用状态管理
//! - `commands` - Tauri 命令定义

// ============================================
// 模块声明
// ============================================

/// 统一错误处理
pub mod error;

/// 数据模型定义
pub mod models;

/// 加密和密码哈希功能
pub mod crypto;

/// HTTP API 客户端
pub mod api_client;

/// SQLite 数据库操作
pub mod database;

/// 应用状态管理
pub mod state;

/// Tauri 命令定义
pub mod commands;

// ============================================
// 应用入口
// ============================================

/// Tauri 应用程序入口点
///
/// 配置并启动 Tauri 应用，注册所有可用的命令处理器
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // 认证相关
            commands::init_state,
            commands::login,
            commands::register,
            commands::verify,
            commands::logout,
            commands::is_logged_in,
            // 账户管理
            commands::query_accounts,
            commands::insert_account,
            commands::update_account,
            commands::delete_account,
            // 加密解密
            commands::encrypt,
            commands::decrypt,
            commands::decrypt_batch,
            // 缓存管理
            commands::save_query_cache,
            commands::load_query_cache,
            commands::get_last_update_time,
            commands::clear_cache,
            // 状态获取
            commands::get_username,
            commands::get_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
