use std::sync::{Arc, Mutex};

use ciftl::crypter::{chacha20, StringCrypter, StringCrypterTrait};

// 全局状态变量，用于管理durian的状态
static mut DURIAN_STATE: Option<Arc<Mutex<DurianState>>> = None;

struct DurianState {
    pub core_password: String,
}

impl DurianState {
    pub const fn new(core_password: String) -> DurianState {
        DurianState { core_password }
    }
}

#[tauri::command]
fn init_state(core_password: String) {
    // println!("init ...");
    // println!("state: {:?}", core_password);
    let durian_state = Arc::new(Mutex::new(DurianState::new(core_password)));
    unsafe {
        DURIAN_STATE = Some(durian_state);
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
    println!("en: {}", encrypted);
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

    let crypter = StringCrypter::<chacha20::ChaCha20CipherAlgorithm>::default();
    let decrypted = crypter
        .decrypt(&message, core_password)
        .map_err(|_| "Decryption Error")?;
    println!("de: {}", decrypted);
    Ok(decrypted)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![encrypt, decrypt, init_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
