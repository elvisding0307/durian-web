//! 数据库操作模块
//!
//! 封装 SQLite 数据库的初始化和 CRUD 操作
//!
//! # 功能
//! - 数据库表结构初始化
//! - 缓存数据的 CRUD 操作
//! - 支持全量和增量数据同步

use rusqlite::Connection;
use std::path::Path;
use std::str::FromStr;

use crate::error::{DurianError, DurianResult};
use crate::models::{AccountRecord, CacheData};

/// 支持的数据拉取模式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PullMode {
    /// 全量拉取：删除旧数据后重新写入
    PullAll,
    /// 增量拉取：只更新有变化的数据
    PullUpdated,
    /// 无更新：只更新时间戳
    PullNothing,
}

impl FromStr for PullMode {
    type Err = DurianError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "PULL_ALL" => Ok(PullMode::PullAll),
            "PULL_UPDATED" => Ok(PullMode::PullUpdated),
            "PULL_NOTHING" => Ok(PullMode::PullNothing),
            _ => Err(DurianError::validation(format!("未知的 pull_mode: {}", s))),
        }
    }
}

// ============================================
// 数据库初始化
// ============================================

/// 初始化数据库表结构
///
/// 创建必要的表并设置 SQLite 优化选项（WAL 模式）
///
/// # Arguments
/// * `db_path` - 数据库文件路径
///
/// # Returns
/// 初始化结果
pub fn init_database(db_path: &Path) -> DurianResult<()> {
    let conn = Connection::open(db_path)?;

    // 启用 WAL 模式以提高并发性能
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = 10000;
         PRAGMA temp_store = MEMORY;",
    )?;

    // 创建缓存元数据表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache_metadata (
            username TEXT PRIMARY KEY,
            last_update_time INTEGER NOT NULL
        )",
        [],
    )?;

    // 创建账户表（包含索引以优化查询）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accounts (
            rid INTEGER NOT NULL,
            username TEXT NOT NULL,
            website TEXT NOT NULL,
            account TEXT NOT NULL,
            password TEXT NOT NULL,
            PRIMARY KEY (rid, username)
        )",
        [],
    )?;

    // 创建索引以优化查询性能
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_accounts_website ON accounts(website)",
        [],
    )?;

    Ok(())
}

// ============================================
// 缓存数据操作
// ============================================

/// 保存缓存数据到数据库
///
/// 根据 pull_mode 执行不同的保存策略：
/// - PULL_ALL: 全量更新，先删除旧数据再插入
/// - PULL_UPDATED: 增量更新，使用 INSERT OR REPLACE
/// - PULL_NOTHING: 只更新时间戳
///
/// # Arguments
/// * `db_path` - 数据库文件路径
/// * `username` - 用户名
/// * `data` - 要保存的缓存数据
/// * `pull_mode` - 拉取模式字符串
///
/// # Returns
/// 保存结果
pub fn save_cache_data(
    db_path: &Path,
    username: &str,
    data: &CacheData,
    pull_mode: &str,
) -> DurianResult<()> {
    let mode = pull_mode.parse::<PullMode>()?;
    save_cache_data_with_mode(db_path, username, data, mode)
}

/// 使用类型安全的 PullMode 保存缓存数据
pub fn save_cache_data_with_mode(
    db_path: &Path,
    username: &str,
    data: &CacheData,
    pull_mode: PullMode,
) -> DurianResult<()> {
    let conn = Connection::open(db_path)?;
    let tx = conn.unchecked_transaction()?;

    // 更新或插入最后更新时间
    tx.execute(
        "INSERT OR REPLACE INTO cache_metadata (username, last_update_time) VALUES (?1, ?2)",
        [username, &data.update_time.to_string()],
    )?;

    match pull_mode {
        PullMode::PullAll => {
            // 全量更新：先删除旧数据，再批量插入新数据
            tx.execute("DELETE FROM accounts WHERE username = ?1", [username])?;
            batch_insert_accounts(&tx, username, &data.accounts)?;
        }
        PullMode::PullUpdated => {
            // 增量更新：使用 INSERT OR REPLACE
            batch_upsert_accounts(&tx, username, &data.accounts)?;
        }
        PullMode::PullNothing => {
            // 无更新：只更新时间戳（已在上面完成）
        }
    }

    tx.commit()?;
    Ok(())
}

/// 批量插入账户（用于全量更新）
fn batch_insert_accounts(
    conn: &Connection,
    username: &str,
    accounts: &[AccountRecord],
) -> DurianResult<()> {
    let mut stmt = conn.prepare_cached(
        "INSERT INTO accounts (rid, username, website, account, password) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;

    for account in accounts {
        stmt.execute([
            &account.rid.to_string(),
            username,
            &account.website,
            &account.account,
            &account.password,
        ])?;
    }

    Ok(())
}

/// 批量更新/插入账户（用于增量更新）
fn batch_upsert_accounts(
    conn: &Connection,
    username: &str,
    accounts: &[AccountRecord],
) -> DurianResult<()> {
    let mut stmt = conn.prepare_cached(
        "INSERT OR REPLACE INTO accounts (rid, username, website, account, password) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;

    for account in accounts {
        stmt.execute([
            &account.rid.to_string(),
            username,
            &account.website,
            &account.account,
            &account.password,
        ])?;
    }

    Ok(())
}

/// 从数据库加载缓存数据
///
/// # Arguments
/// * `db_path` - 数据库文件路径
/// * `username` - 用户名
///
/// # Returns
/// 缓存数据（如果存在且有效）
pub fn load_cache_data(db_path: &Path, username: &str) -> DurianResult<Option<CacheData>> {
    let conn = Connection::open(db_path)?;

    // 获取最后更新时间
    let update_time: i64 = match conn.query_row(
        "SELECT last_update_time FROM cache_metadata WHERE username = ?1",
        [username],
        |row| row.get(0),
    ) {
        Ok(time) => time,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e.into()),
    };

    // 如果时间戳为 0，表示没有有效缓存
    if update_time == 0 {
        return Ok(None);
    }

    // 查询账户数据
    let mut stmt = conn.prepare_cached(
        "SELECT rid, website, account, password FROM accounts WHERE username = ?1 ORDER BY website",
    )?;

    let accounts: Vec<AccountRecord> = stmt
        .query_map([username], |row| {
            Ok(AccountRecord {
                rid: row.get(0)?,
                website: row.get(1)?,
                account: row.get(2)?,
                password: row.get(3)?,
                username: username.to_string(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Some(CacheData {
        update_time,
        accounts,
        username: username.to_string(),
    }))
}

/// 获取最后更新时间
///
/// # Arguments
/// * `db_path` - 数据库文件路径
/// * `username` - 用户名
///
/// # Returns
/// 最后更新时间戳（如果用户不存在则返回 0）
pub fn get_last_update_time(db_path: &Path, username: &str) -> DurianResult<i64> {
    let conn = Connection::open(db_path)?;
    match conn.query_row(
        "SELECT last_update_time FROM cache_metadata WHERE username = ?1",
        [username],
        |row| row.get(0),
    ) {
        Ok(time) => Ok(time),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
        Err(e) => Err(e.into()),
    }
}

/// 删除用户的所有缓存数据
///
/// # Arguments
/// * `db_path` - 数据库文件路径
/// * `username` - 用户名
pub fn clear_user_cache(db_path: &Path, username: &str) -> DurianResult<()> {
    let conn = Connection::open(db_path)?;
    let tx = conn.unchecked_transaction()?;

    tx.execute("DELETE FROM accounts WHERE username = ?1", [username])?;
    tx.execute("DELETE FROM cache_metadata WHERE username = ?1", [username])?;

    tx.commit()?;
    Ok(())
}

/// 获取账户数量
///
/// # Arguments
/// * `db_path` - 数据库文件路径
/// * `username` - 用户名
pub fn get_account_count(db_path: &Path, username: &str) -> DurianResult<i64> {
    let conn = Connection::open(db_path)?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM accounts WHERE username = ?1",
        [username],
        |row| row.get(0),
    )?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn create_test_db() -> NamedTempFile {
        let file = NamedTempFile::new().unwrap();
        init_database(file.path()).unwrap();
        file
    }

    #[test]
    fn test_init_database() {
        let file = NamedTempFile::new().unwrap();
        let result = init_database(file.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_pull_mode_parsing() {
        assert_eq!(PullMode::from_str("PULL_ALL").unwrap(), PullMode::PullAll);
        assert_eq!(PullMode::from_str("PULL_UPDATED").unwrap(), PullMode::PullUpdated);
        assert_eq!(PullMode::from_str("PULL_NOTHING").unwrap(), PullMode::PullNothing);
        assert!(PullMode::from_str("INVALID").is_err());
    }

    #[test]
    fn test_save_and_load_cache_data() {
        let file = create_test_db();
        let username = "test_user";

        let cache_data = CacheData {
            username: username.to_string(),
            update_time: 1234567890,
            accounts: vec![AccountRecord {
                rid: 1,
                username: username.to_string(),
                website: "example.com".to_string(),
                account: "user@example.com".to_string(),
                password: "encrypted_password".to_string(),
            }],
        };

        // 保存数据
        save_cache_data(file.path(), username, &cache_data, "PULL_ALL").unwrap();

        // 加载数据
        let loaded = load_cache_data(file.path(), username).unwrap();
        assert!(loaded.is_some());

        let loaded = loaded.unwrap();
        assert_eq!(loaded.update_time, 1234567890);
        assert_eq!(loaded.accounts.len(), 1);
        assert_eq!(loaded.accounts[0].website, "example.com");
    }

    #[test]
    fn test_incremental_update() {
        let file = create_test_db();
        let username = "test_user";

        // 初始数据
        let cache_data = CacheData {
            username: username.to_string(),
            update_time: 1000,
            accounts: vec![AccountRecord {
                rid: 1,
                username: username.to_string(),
                website: "site1.com".to_string(),
                account: "user1".to_string(),
                password: "pass1".to_string(),
            }],
        };
        save_cache_data(file.path(), username, &cache_data, "PULL_ALL").unwrap();

        // 增量更新
        let update_data = CacheData {
            username: username.to_string(),
            update_time: 2000,
            accounts: vec![AccountRecord {
                rid: 2,
                username: username.to_string(),
                website: "site2.com".to_string(),
                account: "user2".to_string(),
                password: "pass2".to_string(),
            }],
        };
        save_cache_data(file.path(), username, &update_data, "PULL_UPDATED").unwrap();

        // 验证：应该有两条记录
        let count = get_account_count(file.path(), username).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_get_last_update_time() {
        let file = create_test_db();
        let username = "test_user";

        // 初始状态应返回 0
        let time = get_last_update_time(file.path(), username).unwrap();
        assert_eq!(time, 0);

        // 保存数据后应返回正确时间
        let cache_data = CacheData {
            username: username.to_string(),
            update_time: 9999999,
            accounts: vec![],
        };
        save_cache_data(file.path(), username, &cache_data, "PULL_ALL").unwrap();

        let time = get_last_update_time(file.path(), username).unwrap();
        assert_eq!(time, 9999999);
    }

    #[test]
    fn test_clear_user_cache() {
        let file = create_test_db();
        let username = "test_user";

        // 保存一些数据
        let cache_data = CacheData {
            username: username.to_string(),
            update_time: 1234567890,
            accounts: vec![AccountRecord {
                rid: 1,
                username: username.to_string(),
                website: "example.com".to_string(),
                account: "user@example.com".to_string(),
                password: "encrypted_password".to_string(),
            }],
        };
        save_cache_data(file.path(), username, &cache_data, "PULL_ALL").unwrap();

        // 清除缓存
        clear_user_cache(file.path(), username).unwrap();

        // 验证缓存已清除
        let loaded = load_cache_data(file.path(), username).unwrap();
        assert!(loaded.is_none());
    }
}
