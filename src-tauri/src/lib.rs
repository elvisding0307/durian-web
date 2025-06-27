use ciftl::crypter::{chacha20, StringCrypter, StringCrypterTrait};
use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

// 账户记录结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountRecord {
    pub rid: i64,
    pub username: String,
    pub website: String,
    pub account: String,
    pub password: String,
}

// 缓存数据结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheData {
    pub username: String,
    pub update_time: i64,
    pub accounts: Vec<AccountRecord>,
}

// 全局状态变量，用于管理durian的状态
static mut DURIAN_STATE: Option<Arc<Mutex<DurianState>>> = None;

struct DurianState {
    pub core_password: String,
    pub db_path: PathBuf,
    pub username: String,  // 新增用户名字段
}

impl DurianState {
    pub fn new(core_password: String, username: String) -> Result<DurianState, Box<dyn std::error::Error>> {
        // 获取AppData目录
        let app_data_dir = dirs::data_dir()
            .ok_or("无法获取AppData目录")?
            .join("durian-web");
        
        // 确保目录存在
        std::fs::create_dir_all(&app_data_dir)?;
        
        let db_path = app_data_dir.join("cache.db");
        
        let state = DurianState {
            core_password,
            db_path,
            username,
        };
        
        // 初始化数据库
        state.init_database()?;
        
        Ok(state)
    }
    
    fn init_database(&self) -> SqlResult<()> {
        let conn = Connection::open(&self.db_path)?;
        
        // 创建缓存元数据表（移除id字段）
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cache_metadata (
                username TEXT PRIMARY KEY,
                last_update_time INTEGER NOT NULL
            )",
            [],
        )?;
        
        // 创建账户表（rid为主键，移除id字段和updated_at字段）
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
    
    fn save_cache_data(&self, data: &CacheData, pull_mode: &str) -> SqlResult<()> {
        let conn = Connection::open(&self.db_path)?;
        
        // 开始事务
        let tx = conn.unchecked_transaction()?;
        
        // 更新或插入时间戳（使用当前用户名）
        tx.execute(
            "INSERT OR REPLACE INTO cache_metadata (username, last_update_time) VALUES (?1, ?2)",
            [&self.username, &data.update_time.to_string()],
        )?;
        
        match pull_mode {
            "PULL_ALL" => {
                // 清空该用户的所有数据，然后插入全部数据
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
            },
            "PULL_UPDATED" => {
                // 根据rid和username进行增量更新
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
            },
            "PULL_NOTHING" => {
                // 不做任何数据操作，只更新时间戳
            },
            _ => {
                return Err(rusqlite::Error::InvalidParameterName(format!("未知的pull_mode: {}", pull_mode)));
            }
        }
        
        tx.commit()?;
        Ok(())
    }
    
    fn load_cache_data(&self) -> SqlResult<Option<CacheData>> {
        let conn = Connection::open(&self.db_path)?;
        
        // 获取该用户的最后更新时间
        let update_time: i64 = match conn.query_row(
            "SELECT last_update_time FROM cache_metadata WHERE username = ?1",
            [&self.username],
            |row| row.get(0),
        ) {
            Ok(time) => time,
            Err(_) => return Ok(None), // 用户不存在
        };
        
        // 如果没有缓存数据，返回None
        if update_time == 0 {
            return Ok(None);
        }
        
        // 获取该用户的账户数据
        let mut stmt = conn.prepare(
            "SELECT rid, website, account, password FROM accounts WHERE username = ?1 ORDER BY website"
        )?;
        
        let account_iter = stmt.query_map([&self.username], |row| {
            Ok(AccountRecord {
                rid: row.get(0)?,
                website: row.get(1)?,
                account: row.get(2)?,
                password: row.get(3)?,
                username: self.username.clone(),
            })
        })?;
        
        let mut accounts = Vec::new();
        for account in account_iter {
            accounts.push(account?);
        }
        
        Ok(Some(CacheData {
            update_time,
            accounts,
            username: self.username.clone(),
        }))
    }
    
    fn get_last_update_time(&self) -> SqlResult<i64> {
        let conn = Connection::open(&self.db_path)?;
        match conn.query_row(
            "SELECT last_update_time FROM cache_metadata WHERE username = ?1",
            [&self.username],
            |row| row.get(0),
        ) {
            Ok(time) => Ok(time),
            Err(_) => Ok(0), // 用户不存在时返回0
        }
    }
}

#[tauri::command]
fn init_state(core_password: String, username: String) -> Result<(), String> {
    match DurianState::new(core_password, username) {
        Ok(durian_state) => {
            let state = Arc::new(Mutex::new(durian_state));
            unsafe {
                DURIAN_STATE = Some(state);
            }
            Ok(())
        }
        Err(e) => Err(format!("初始化状态失败: {}", e))
    }
}

#[tauri::command]
fn save_query_cache(
    update_time: i64,
    accounts_json: String,
    pull_mode: String,
) -> Result<(), String> {
    let durian_state = unsafe {
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };
        state.lock().map_err(|_| "锁定错误".to_string())?
    };
    
    // 解析 JSON 为临时结构体（不包含 username）
    #[derive(Deserialize)]
    struct TempAccountRecord {
        rid: i64,
        website: String,
        account: String,
        password: String,
    }
    
    let temp_accounts: Vec<TempAccountRecord> = serde_json::from_str(&accounts_json)
        .map_err(|e| format!("解析账户数据失败: {}", e))?;
    
    // 转换为完整的 AccountRecord，添加用户名
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
    
    let cache_data = CacheData {
        username: durian_state.username.clone(),
        update_time,
        accounts,
    };
    
    durian_state
        .save_cache_data(&cache_data, &pull_mode)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn load_query_cache() -> Result<String, String> {
    unsafe {
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };
        
        match state.lock()
            .map_err(|_| "锁定错误".to_string())?
            .load_cache_data()
            .map_err(|e| format!("加载缓存失败: {}", e))? {
            Some(cache_data) => Ok(serde_json::to_string(&cache_data).unwrap()),
            None => Ok("null".to_string()),
        }
    }
}

#[tauri::command]
fn get_last_update_time() -> Result<i64, String> {
    unsafe {
        let state = match DURIAN_STATE {
            None => return Err("DurianState未初始化".to_string()),
            Some(ref s) => s,
        };
        
        state.lock()
            .map_err(|_| "锁定错误".to_string())?
            .get_last_update_time()
            .map_err(|e| format!("获取最后更新时间失败: {}", e))
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn encrypt(message: String) -> Result<String, &'static str> {
    let core_password = unsafe {
        let state = match DURIAN_STATE {
            None => {
                return Err("DurianState not initialized");
            }
            Some(ref s) => s,
        };
        &state.lock().map_err(|_| "Lock Error")?.core_password
    };

    let crypter = StringCrypter::<chacha20::ChaCha20CipherAlgorithm>::default();
    let encrypted = crypter
        .encrypt(&message, core_password)
        .map_err(|_| "Encryption Error")?;
    Ok(encrypted)
}

#[tauri::command]
fn decrypt(message: String) -> Result<String, &'static str> {
    let core_password = unsafe {
        let state = match DURIAN_STATE {
            None => {
                return Err("DurianState not initialized");
            }
            Some(ref s) => s,
        };
        &state.lock().map_err(|_| "Lock Error")?.core_password
    };
    // println!("core password: {:?}", core_password);
    // println!("message: {:?}", message);
    let crypter = StringCrypter::<chacha20::ChaCha20CipherAlgorithm>::default();
    let decrypted = crypter
        .decrypt(&message, core_password)
        .map_err(|_|  "Decryption Error")?;
    // println!("decrypted: {:?}", decrypted);
    Ok(decrypted)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            encrypt, 
            decrypt, 
            init_state,
            save_query_cache,
            load_query_cache,
            get_last_update_time
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
