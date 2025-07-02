// 导入必要的依赖库
use ciftl::crypter::{chacha20, StringCrypter, StringCrypterTrait}; // 加密解密相关
use rusqlite::{Connection, Result as SqlResult}; // SQLite 数据库操作
use serde::{Deserialize, Serialize}; // 序列化和反序列化
use std::path::PathBuf; // 文件路径处理
use std::sync::{Arc, Mutex}; // 线程安全的共享状态

/**
 * 账户记录结构体
 * 用于表示单个账户的完整信息，包括数据库ID、用户名、网站、账号和密码
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountRecord {
    pub rid: i64,        // 记录ID，数据库主键
    pub username: String, // 所属用户名
    pub website: String,  // 网站地址
    pub account: String,  // 账号名
    pub password: String, // 密码（加密存储）
}

/**
 * 缓存数据结构体
 * 用于表示从数据库加载的完整缓存数据，包含用户信息、更新时间和账户列表
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheData {
    pub username: String,           // 用户名
    pub update_time: i64,          // 最后更新时间戳
    pub accounts: Vec<AccountRecord>, // 账户记录列表
}

/**
 * Durian 应用状态结构体
 * 管理应用的核心状态，包括用户认证信息和数据库路径
 */
struct DurianState {
    pub username: String,      // 当前登录用户名
    pub core_password: String, // 核心密码，用于本地加密
    pub token: String,         // 认证令牌，用于服务器验证
    pub db_path: PathBuf,      // SQLite 数据库文件路径
}

// 全局状态变量，用于管理 Durian 应用的状态
// 使用 Arc<Mutex<>> 确保线程安全的共享访问
static mut DURIAN_STATE: Option<Arc<Mutex<DurianState>>> = None;

impl DurianState {
    /**
     * 创建新的 DurianState 实例
     * 初始化用户状态，设置数据库路径并创建必要的数据库表
     * 
     * @param username 用户名
     * @param core_password 核心密码
     * @param token 认证令牌
     * @return Result<DurianState, Box<dyn std::error::Error>> 成功返回状态实例，失败返回错误
     */
    pub fn new(
        username: String,
        core_password: String,
        token: String,
    ) -> Result<DurianState, Box<dyn std::error::Error>> {
        // 获取系统 AppData 目录，用于存储应用数据
        let app_data_dir = dirs::data_dir()
            .ok_or("无法获取AppData目录")?
            .join("durian-web");

        // 确保应用数据目录存在
        std::fs::create_dir_all(&app_data_dir)?;

        // 设置 SQLite 数据库文件路径
        let db_path = app_data_dir.join("cache.db");

        let state = DurianState {
            username,
            core_password,
            token,
            db_path,
        };

        // 初始化数据库表结构
        state.init_database()?;

        Ok(state)
    }

    /**
     * 初始化数据库表结构
     * 创建缓存元数据表和账户表，如果表不存在的话
     * 
     * @return SqlResult<()> 数据库操作结果
     */
    fn init_database(&self) -> SqlResult<()> {
        let conn = Connection::open(&self.db_path)?;

        // 创建缓存元数据表，存储每个用户的最后更新时间
        // username 作为主键，确保每个用户只有一条记录
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cache_metadata (
                username TEXT PRIMARY KEY,
                last_update_time INTEGER NOT NULL
            )",
            [],
        )?;

        // 创建账户表，存储用户的账户信息
        // 使用 (rid, username) 作为复合主键，支持多用户数据隔离
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

        Ok(())
    }

    /**
     * 保存缓存数据到数据库
     * 根据拉取模式（全量/增量/无更新）执行不同的数据同步策略
     * 
     * @param data 要保存的缓存数据
     * @param pull_mode 拉取模式："PULL_ALL"（全量）、"PULL_UPDATED"（增量）、"PULL_NOTHING"（仅更新时间戳）
     * @return SqlResult<()> 数据库操作结果
     */
    fn save_cache_data(&self, data: &CacheData, pull_mode: &str) -> SqlResult<()> {
        let conn = Connection::open(&self.db_path)?;

        // 开始数据库事务，确保数据一致性
        let tx = conn.unchecked_transaction()?;

        // 更新或插入用户的最后更新时间戳
        tx.execute(
            "INSERT OR REPLACE INTO cache_metadata (username, last_update_time) VALUES (?1, ?2)",
            [&self.username, &data.update_time.to_string()],
        )?;

        // 根据拉取模式执行不同的数据同步策略
        match pull_mode {
            "PULL_ALL" => {
                // 全量更新：先清空该用户的所有数据，然后插入全部新数据
                tx.execute("DELETE FROM accounts WHERE username = ?1", [&self.username])?;
                for account in &data.accounts {
                    tx.execute(
                        "INSERT INTO accounts (rid, username, website, account, password) VALUES (?1, ?2, ?3, ?4, ?5)",
                        [
                            &account.rid.to_string(),
                            &self.username,
                            &account.website,
                            &account.account,
                            &account.password,
                        ],
                    )?;
                }
            }
            "PULL_UPDATED" => {
                // 增量更新：根据 rid 和 username 进行插入或替换操作
                for account in &data.accounts {
                    tx.execute(
                        "INSERT OR REPLACE INTO accounts (rid, username, website, account, password) VALUES (?1, ?2, ?3, ?4, ?5)",
                        [
                            &account.rid.to_string(),
                            &self.username,
                            &account.website,
                            &account.account,
                            &account.password,
                        ],
                    )?;
                }
            }
            "PULL_NOTHING" => {
                // 无数据更新：仅更新时间戳，不修改账户数据
            }
            _ => {
                // 未知的拉取模式，返回错误
                return Err(rusqlite::Error::InvalidParameterName(format!(
                    "未知的pull_mode: {}",
                    pull_mode
                )));
            }
        }

        // 提交事务
        tx.commit()?;
        Ok(())
    }

    /**
     * 从数据库加载缓存数据
     * 读取指定用户的所有账户信息和最后更新时间
     * 
     * @return SqlResult<Option<CacheData>> 成功返回缓存数据（如果存在），失败返回错误
     */
    fn load_cache_data(&self) -> SqlResult<Option<CacheData>> {
        let conn = Connection::open(&self.db_path)?;

        // 获取该用户的最后更新时间
        let update_time: i64 = match conn.query_row(
            "SELECT last_update_time FROM cache_metadata WHERE username = ?1",
            [&self.username],
            |row| row.get(0),
        ) {
            Ok(time) => time,
            Err(_) => return Ok(None), // 用户不存在，返回 None
        };

        // 如果没有缓存数据（时间戳为0），返回 None
        if update_time == 0 {
            return Ok(None);
        }

        // 查询该用户的所有账户数据，按网站名称排序
        let mut stmt = conn.prepare(
            "SELECT rid, website, account, password FROM accounts WHERE username = ?1 ORDER BY website"
        )?;

        // 执行查询并映射结果到 AccountRecord 结构体
        let account_iter = stmt.query_map([&self.username], |row| {
            Ok(AccountRecord {
                rid: row.get(0)?,
                website: row.get(1)?,
                account: row.get(2)?,
                password: row.get(3)?,
                username: self.username.clone(),
            })
        })?;

        // 收集所有账户记录
        let mut accounts = Vec::new();
        for account in account_iter {
            accounts.push(account?);
        }

        // 构造并返回缓存数据
        Ok(Some(CacheData {
            update_time,
            accounts,
            username: self.username.clone(),
        }))
    }

    /**
     * 获取用户的最后更新时间
     * 用于判断是否需要从服务器拉取新数据
     * 
     * @return SqlResult<i64> 最后更新时间戳，用户不存在时返回0
     */
    fn get_last_update_time(&self) -> SqlResult<i64> {
        let conn = Connection::open(&self.db_path)?;
        match conn.query_row(
            "SELECT last_update_time FROM cache_metadata WHERE username = ?1",
            [&self.username],
            |row| row.get(0),
        ) {
            Ok(time) => Ok(time),
            Err(_) => Ok(0), // 用户不存在时返回0，表示需要全量拉取
        }
    }
}

/**
 * Tauri 命令：初始化应用状态
 * 创建新的 DurianState 实例并设置为全局状态
 * 
 * @param username 用户名
 * @param core_password 核心密码
 * @param token 认证令牌
 * @return Result<(), String> 初始化结果
 */
#[tauri::command]
fn init_state(username: String, core_password: String, token: String) -> Result<(), String> {
    match DurianState::new(username, core_password, token) {
        Ok(durian_state) => {
            // 将状态包装在 Arc<Mutex<>> 中以支持线程安全的共享访问
            let state = Arc::new(Mutex::new(durian_state));
            unsafe {
                DURIAN_STATE = Some(state);
            }
            Ok(())
        }
        Err(e) => Err(format!("初始化状态失败: {}", e)),
    }
}

/**
 * Tauri 命令：保存查询缓存
 * 将从服务器获取的账户数据保存到本地数据库
 * 
 * @param pull_mode 拉取模式
 * @param update_time 更新时间戳
 * @param accounts_json 账户数据的 JSON 字符串
 * @return Result<(), String> 保存结果
 */
#[tauri::command]
fn save_query_cache(
    pull_mode: String,
    update_time: i64,
    accounts_json: String,
) -> Result<(), String> {
    // 获取全局状态的锁
    let durian_state = unsafe {
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };
        state.lock().map_err(|_| "锁定错误".to_string())?
    };

    // 定义临时结构体用于 JSON 解析（不包含 username 字段）
    #[derive(Deserialize)]
    struct TempAccountRecord {
        rid: i64,
        website: String,
        account: String,
        password: String,
    }

    // 解析 JSON 字符串为临时账户记录数组
    let temp_accounts: Vec<TempAccountRecord> =
        serde_json::from_str(&accounts_json).map_err(|e| format!("解析账户数据失败: {}", e))?;

    // 转换为完整的 AccountRecord，添加当前用户名
    let accounts: Vec<AccountRecord> = temp_accounts
        .into_iter()
        .map(|temp| AccountRecord {
            rid: temp.rid,
            username: durian_state.username.clone(),
            website: temp.website,
            account: temp.account,
            password: temp.password,
        })
        .collect();

    // 构造缓存数据结构
    let cache_data = CacheData {
        username: durian_state.username.clone(),
        update_time,
        accounts,
    };

    // 保存到数据库
    durian_state
        .save_cache_data(&cache_data, &pull_mode)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/**
 * Tauri 命令：加载查询缓存
 * 从本地数据库读取缓存的账户数据
 * 
 * @return Result<String, String> 成功返回 JSON 字符串，失败返回错误信息
 */
#[tauri::command]
fn load_query_cache() -> Result<String, String> {
    unsafe {
        // 获取全局状态
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };

        // 加载缓存数据并序列化为 JSON
        match state
            .lock()
            .map_err(|_| "锁定错误".to_string())?
            .load_cache_data()
            .map_err(|e| format!("加载缓存失败: {}", e))?
        {
            Some(cache_data) => Ok(serde_json::to_string(&cache_data).unwrap()),
            None => Ok("{}".to_string()), // 无缓存数据时返回 "null" 字符串
        }
    }
}

/**
 * Tauri 命令：获取最后更新时间
 * 返回当前用户的数据最后更新时间戳
 * 
 * @return Result<i64, String> 成功返回时间戳，失败返回错误信息
 */
#[tauri::command]
fn get_last_update_time() -> Result<i64, String> {
    unsafe {
        // 获取全局状态
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };

        // 获取最后更新时间
        state
            .lock()
            .map_err(|_| "锁定错误".to_string())?
            .get_last_update_time()
            .map_err(|e| format!("获取最后更新时间失败: {}", e))
    }
}

/**
 * Tauri 命令：获取当前用户名
 * 返回当前登录用户的用户名
 * 
 * @return Result<String, String> 成功返回用户名，失败返回错误信息
 */
#[tauri::command]
fn get_username() -> Result<String, String> {
    unsafe {
        // 获取全局状态
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };

        // 返回用户名的克隆
        Ok(state
            .lock()
            .map_err(|_| "锁定错误".to_string())?
            .username
            .clone())
    }
}

/**
 * Tauri 命令：获取认证令牌
 * 返回当前用户的认证令牌，用于服务器 API 调用
 * 
 * @return Result<String, String> 成功返回令牌，失败返回错误信息
 */
#[tauri::command]
fn get_token() -> Result<String, String> {
    unsafe {
        // 获取全局状态
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };
        // 获取状态锁并返回令牌的克隆
        let state = state.lock().map_err(|_| "锁定错误".to_string())?;
        Ok(state.token.clone())
    }
}

/**
 * Tauri 命令：加密消息
 * 使用用户的核心密码和 ChaCha20 算法加密指定消息
 * 
 * @param message 要加密的明文消息
 * @return Result<String, &'static str> 成功返回加密后的密文，失败返回错误信息
 */
#[tauri::command]
fn encrypt(message: String) -> Result<String, &'static str> {
    // 获取核心密码
    let core_password = unsafe {
        let state = match DURIAN_STATE {
            None => {
                return Err("DurianState not initialized");
            }
            Some(ref s) => s,
        };
        &state.lock().map_err(|_| "Lock Error")?.core_password
    };

    // 使用 ChaCha20 算法进行加密
    let crypter = StringCrypter::<chacha20::ChaCha20CipherAlgorithm>::default();
    let encrypted = crypter
        .encrypt(&message, core_password)
        .map_err(|_| "Encryption Error")?;
    Ok(encrypted)
}

/**
 * Tauri 命令：解密消息
 * 使用用户的核心密码和 ChaCha20 算法解密指定密文
 * 
 * @param message 要解密的密文消息
 * @return Result<String, &'static str> 成功返回解密后的明文，失败返回错误信息
 */
#[tauri::command]
fn decrypt(message: String) -> Result<String, &'static str> {
    // 获取核心密码
    let core_password = unsafe {
        let state = match DURIAN_STATE {
            None => {
                return Err("DurianState not initialized");
            }
            Some(ref s) => s,
        };
        &state.lock().map_err(|_| "Lock Error")?.core_password
    };
    
    // 使用 ChaCha20 算法进行解密
    let crypter = StringCrypter::<chacha20::ChaCha20CipherAlgorithm>::default();
    let decrypted = crypter
        .decrypt(&message, core_password)
        .map_err(|_| "Decryption Error")?;
    Ok(decrypted)
}

/**
 * Tauri 应用程序入口点
 * 配置并启动 Tauri 应用，注册所有可用的命令处理器
 */
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init()) // 启用文件打开插件
        .invoke_handler(tauri::generate_handler![
            // 注册所有 Tauri 命令处理器
            init_state,           // 初始化应用状态
            encrypt,              // 加密消息
            decrypt,              // 解密消息
            save_query_cache,     // 保存查询缓存
            load_query_cache,     // 加载查询缓存
            get_last_update_time, // 获取最后更新时间
            get_username,         // 获取用户名
            get_token             // 获取认证令牌
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
