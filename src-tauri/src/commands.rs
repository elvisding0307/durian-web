//! Tauri 命令模块
//!
//! 定义所有供前端调用的 Tauri 命令
//!
//! # 错误处理
//! 所有命令都返回 `Result<T, String>`，错误信息会自动转换为可读的中文提示
//!
//! # 输入验证
//! 所有命令都会对输入参数进行验证

use crate::api_client;
use crate::crypto::{decrypt_message, encrypt_message};
use crate::error::DurianError;
use crate::models::{AccountRecord, CacheData, TempAccountRecord};
use crate::state::{self, DurianState};

// ============================================
// 认证相关命令
// ============================================

/// 初始化应用状态
///
/// 在登录成功后调用，设置用户状态
#[tauri::command]
pub fn init_state(
    username: String,
    core_password: String,
    token: String,
    api_base_url: String,
) -> Result<(), String> {
    // 输入验证
    validate_not_empty(&username, "用户名")?;
    validate_not_empty(&core_password, "核心密码")?;
    validate_not_empty(&token, "认证令牌")?;
    validate_not_empty(&api_base_url, "API URL")?;

    let durian_state = DurianState::new(username, core_password, token, api_base_url)
        .map_err(|e| e.to_string())?;
    state::set_global_state(durian_state);
    Ok(())
}

/// 用户登录
///
/// 执行登录请求并在成功后初始化状态
#[tauri::command]
pub fn login(
    api_base_url: String,
    username: String,
    password: String,
    core_password: String,
) -> Result<String, String> {
    // 输入验证
    validate_not_empty(&api_base_url, "API URL")?;
    validate_not_empty(&username, "用户名")?;
    validate_not_empty(&password, "密码")?;
    validate_not_empty(&core_password, "核心密码")?;

    let response = api_client::api_login(&api_base_url, &username, &password, &core_password)
        .map_err(|e| e.to_string())?;

    if response.code == 0 {
        if let Some(data) = response.data {
            // 初始化状态
            init_state(
                username,
                core_password,
                data.token.clone(),
                api_base_url,
            )?;
            return Ok(data.token);
        }
    }

    Err(format!("登录失败: {}", response.msg))
}

/// 用户注册
#[tauri::command]
pub fn register(
    api_base_url: String,
    username: String,
    password: String,
    core_password: String,
) -> Result<String, String> {
    // 输入验证
    validate_not_empty(&api_base_url, "API URL")?;
    validate_not_empty(&username, "用户名")?;
    validate_not_empty(&password, "密码")?;
    validate_not_empty(&core_password, "核心密码")?;
    validate_min_length(&password, 6, "密码")?;
    validate_min_length(&core_password, 6, "核心密码")?;

    let response = api_client::api_register(&api_base_url, &username, &password, &core_password)
        .map_err(|e| e.to_string())?;

    if response.code == 0 {
        Ok("注册成功".to_string())
    } else {
        Err(format!("注册失败: {}", response.msg))
    }
}

/// 验证登录状态
#[tauri::command]
pub fn verify() -> Result<bool, String> {
    let state = state::get_state().map_err(|e| e.to_string())?;
    api_client::api_verify(&state.api_base_url, &state.token).map_err(|e| e.to_string())
}

/// 用户登出
#[tauri::command]
pub fn logout() -> Result<(), String> {
    state::clear_state();
    Ok(())
}

// ============================================
// 账户管理命令
// ============================================

/// 查询账户列表
///
/// 支持从缓存加载和强制刷新
#[tauri::command]
pub fn query_accounts(force_refresh: bool) -> Result<String, String> {
    let state = state::get_state().map_err(|e| e.to_string())?;

    // 如果不是强制刷新，先尝试从缓存加载
    if !force_refresh {
        if let Some(cache_data) = state.load_cache_data().map_err(|e| e.to_string())? {
            if !cache_data.accounts.is_empty() {
                return serde_json::to_string(&cache_data)
                    .map_err(|e| format!("序列化失败: {}", e));
            }
        }
    }

    // 获取最后更新时间
    let last_update_time = state.get_last_update_time().map_err(|e| e.to_string())?;

    // 从服务器查询
    let response = api_client::api_query_accounts(&state.api_base_url, &state.token, last_update_time)
        .map_err(|e| e.to_string())?;

    if response.code == 0 {
        if let Some(data) = response.data {
            // 转换为 AccountRecord 格式
            let accounts: Vec<AccountRecord> = data
                .accounts
                .iter()
                .map(|item| AccountRecord::new(
                    item.rid,
                    state.username.clone(),
                    item.website.clone(),
                    item.account.clone(),
                    item.password.clone(),
                ))
                .collect();

            let cache_data = CacheData::new(
                state.username.clone(),
                data.update_time,
                accounts,
            );

            // 保存到缓存
            state
                .save_cache_data(&cache_data, &data.pull_mode)
                .map_err(|e| e.to_string())?;

            // 重新从缓存加载（确保数据一致性）
            if let Some(loaded_data) = state.load_cache_data().map_err(|e| e.to_string())? {
                return serde_json::to_string(&loaded_data)
                    .map_err(|e| format!("序列化失败: {}", e));
            }
        }
    }

    Err(format!("查询失败: {}", response.msg))
}

/// 插入账户
///
/// 自动加密密码后发送到服务器
#[tauri::command]
pub fn insert_account(
    website: String,
    account: String,
    password: String,
) -> Result<String, String> {
    // 输入验证（账户可以为空）
    validate_not_empty(&website, "网站")?;
    validate_not_empty(&password, "密码")?;

    let state = state::get_state().map_err(|e| e.to_string())?;

    // 加密密码
    let encrypted_password = encrypt_message(&password, &state.core_password)
        .map_err(|e| e.to_string())?;

    let response = api_client::api_insert_account(
        &state.api_base_url,
        &state.token,
        &website,
        &account,
        &encrypted_password,
    ).map_err(|e| e.to_string())?;

    if response.code == 0 {
        Ok("插入成功".to_string())
    } else {
        Err(format!("插入失败: {}", response.msg))
    }
}

/// 更新账户
///
/// 自动加密密码后发送到服务器
#[tauri::command]
pub fn update_account(
    rid: i64,
    website: String,
    account: String,
    password: String,
) -> Result<String, String> {
    // 输入验证
    if rid <= 0 {
        return Err(DurianError::validation("无效的记录 ID").to_string());
    }
    validate_not_empty(&website, "网站")?;
    validate_not_empty(&account, "账户")?;
    validate_not_empty(&password, "密码")?;

    let state = state::get_state().map_err(|e| e.to_string())?;

    // 加密密码
    let encrypted_password = encrypt_message(&password, &state.core_password)
        .map_err(|e| e.to_string())?;

    let response = api_client::api_update_account(
        &state.api_base_url,
        &state.token,
        rid,
        &website,
        &account,
        &encrypted_password,
    ).map_err(|e| e.to_string())?;

    if response.code == 0 {
        Ok("更新成功".to_string())
    } else {
        Err(format!("更新失败: {}", response.msg))
    }
}

/// 删除账户
#[tauri::command]
pub fn delete_account(rid: i64) -> Result<String, String> {
    // 输入验证
    if rid <= 0 {
        return Err(DurianError::validation("无效的记录 ID").to_string());
    }

    let state = state::get_state().map_err(|e| e.to_string())?;

    let response = api_client::api_delete_account(&state.api_base_url, &state.token, rid)
        .map_err(|e| e.to_string())?;

    if response.code == 0 {
        Ok("删除成功".to_string())
    } else {
        Err(format!("删除失败: {}", response.msg))
    }
}

// ============================================
// 加密解密命令
// ============================================

/// 加密消息
#[tauri::command]
pub fn encrypt(message: String) -> Result<String, String> {
    if message.is_empty() {
        return Err(DurianError::validation("加密内容不能为空").to_string());
    }
    let state = state::get_state().map_err(|e| e.to_string())?;
    encrypt_message(&message, &state.core_password).map_err(|e| e.to_string())
}

/// 解密消息
#[tauri::command]
pub fn decrypt(message: String) -> Result<String, String> {
    if message.is_empty() {
        return Err(DurianError::validation("解密内容不能为空").to_string());
    }
    let state = state::get_state().map_err(|e| e.to_string())?;
    decrypt_message(&message, &state.core_password).map_err(|e| e.to_string())
}

/// 批量解密消息
///
/// 提高多个密码解密的效率
#[tauri::command]
pub fn decrypt_batch(messages: Vec<String>) -> Result<Vec<String>, String> {
    let state = state::get_state().map_err(|e| e.to_string())?;
    
    messages
        .iter()
        .map(|msg| {
            if msg.is_empty() {
                Ok(String::new())
            } else {
                decrypt_message(msg, &state.core_password).map_err(|e| e.to_string())
            }
        })
        .collect()
}

// ============================================
// 缓存管理命令
// ============================================

/// 保存查询缓存
#[tauri::command]
pub fn save_query_cache(
    pull_mode: String,
    update_time: i64,
    accounts_json: String,
) -> Result<(), String> {
    // 输入验证
    validate_not_empty(&pull_mode, "pull_mode")?;
    if update_time < 0 {
        return Err(DurianError::validation("无效的更新时间").to_string());
    }

    let state = state::get_state().map_err(|e| e.to_string())?;

    let temp_accounts: Vec<TempAccountRecord> = serde_json::from_str(&accounts_json)
        .map_err(|e| format!("解析账户数据失败: {}", e))?;

    let accounts: Vec<AccountRecord> = temp_accounts
        .into_iter()
        .map(|temp| AccountRecord::new(
            temp.rid,
            state.username.clone(),
            temp.website,
            temp.account,
            temp.password,
        ))
        .collect();

    let cache_data = CacheData::new(
        state.username.clone(),
        update_time,
        accounts,
    );

    state
        .save_cache_data(&cache_data, &pull_mode)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 加载查询缓存
#[tauri::command]
pub fn load_query_cache() -> Result<String, String> {
    let state = state::get_state().map_err(|e| e.to_string())?;

    match state.load_cache_data().map_err(|e| e.to_string())? {
        Some(cache_data) => serde_json::to_string(&cache_data)
            .map_err(|e| format!("序列化失败: {}", e)),
        None => Ok("{}".to_string()),
    }
}

/// 获取最后更新时间
#[tauri::command]
pub fn get_last_update_time() -> Result<i64, String> {
    let state = state::get_state().map_err(|e| e.to_string())?;
    state.get_last_update_time().map_err(|e| e.to_string())
}

/// 清除用户缓存
#[tauri::command]
pub fn clear_cache() -> Result<(), String> {
    let state = state::get_state().map_err(|e| e.to_string())?;
    state.clear_cache().map_err(|e| e.to_string())
}

// ============================================
// 状态查询命令
// ============================================

/// 获取当前用户名
#[tauri::command]
pub fn get_username() -> Result<String, String> {
    state::get_username().map_err(|e| e.to_string())
}

/// 获取认证令牌
#[tauri::command]
pub fn get_token() -> Result<String, String> {
    state::get_token().map_err(|e| e.to_string())
}

/// 检查状态是否已初始化
#[tauri::command]
pub fn is_logged_in() -> bool {
    state::is_state_initialized()
}

// ============================================
// 输入验证辅助函数
// ============================================

/// 验证字符串不为空
fn validate_not_empty(value: &str, field_name: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(DurianError::validation(format!("{}不能为空", field_name)).to_string())
    } else {
        Ok(())
    }
}

/// 验证字符串最小长度
fn validate_min_length(value: &str, min_len: usize, field_name: &str) -> Result<(), String> {
    if value.len() < min_len {
        Err(DurianError::validation(format!("{}长度不能少于{}个字符", field_name, min_len)).to_string())
    } else {
        Ok(())
    }
}
