//! 加密和密码哈希模块
//!
//! 提供密码哈希（PBKDF2）和消息加解密（ChaCha20）功能

use ciftl::crypter::{chacha20, StringCrypter, StringCrypterTrait};
use ring::pbkdf2;
use std::num::NonZeroU32;

use crate::error::{DurianError, DurianResult};

// ============================================
// 常量定义
// ============================================

/// 登录密码哈希盐值
const DURIAN_PASSWORD_SALT: &str = "durian.password";

/// 核心密码哈希盐值
const DURIAN_CORE_PASSWORD_SALT: &str = "durian.core.password";

/// PBKDF2 迭代次数
const PBKDF2_ITERATIONS: u32 = 100000;

// ============================================
// 密码哈希功能
// ============================================

/// 使用 PBKDF2 进行密码哈希
///
/// # Arguments
/// * `password` - 要哈希的密码
/// * `salt` - 盐值
///
/// # Returns
/// 十六进制编码的哈希字符串
fn hash_password_pbkdf2(password: &str, salt: &str) -> String {
    let iterations = NonZeroU32::new(PBKDF2_ITERATIONS).unwrap();
    let mut hash = [0u8; 32]; // SHA-256 输出 32 字节

    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        iterations,
        salt.as_bytes(),
        password.as_bytes(),
        &mut hash,
    );

    // 转换为十六进制字符串
    hex::encode(hash)
}

/// 对登录密码进行哈希
///
/// # Arguments
/// * `password` - 原始密码
///
/// # Returns
/// 哈希后的密码字符串
pub fn hash_login_password(password: &str) -> String {
    hash_password_pbkdf2(password, DURIAN_PASSWORD_SALT)
}

/// 对核心密码进行哈希
///
/// # Arguments
/// * `password` - 原始核心密码
///
/// # Returns
/// 哈希后的核心密码字符串
pub fn hash_core_password(password: &str) -> String {
    hash_password_pbkdf2(password, DURIAN_CORE_PASSWORD_SALT)
}

// ============================================
// 消息加解密功能
// ============================================

/// 使用 ChaCha20 加密消息
///
/// # Arguments
/// * `message` - 要加密的明文消息
/// * `key` - 加密密钥（核心密码）
///
/// # Returns
/// 加密后的密文，或错误信息
pub fn encrypt_message(message: &str, key: &str) -> DurianResult<String> {
    if message.is_empty() {
        return Err(DurianError::validation("加密内容不能为空"));
    }
    if key.is_empty() {
        return Err(DurianError::validation("加密密钥不能为空"));
    }
    
    let crypter = StringCrypter::<chacha20::ChaCha20CipherAlgorithm>::default();
    crypter
        .encrypt(message, key)
        .map_err(|e| DurianError::crypto(format!("加密失败: {:?}", e)))
}

/// 使用 ChaCha20 解密消息
///
/// # Arguments
/// * `ciphertext` - 要解密的密文
/// * `key` - 解密密钥（核心密码）
///
/// # Returns
/// 解密后的明文，或错误信息
pub fn decrypt_message(ciphertext: &str, key: &str) -> DurianResult<String> {
    if ciphertext.is_empty() {
        return Err(DurianError::validation("解密内容不能为空"));
    }
    if key.is_empty() {
        return Err(DurianError::validation("解密密钥不能为空"));
    }
    
    let crypter = StringCrypter::<chacha20::ChaCha20CipherAlgorithm>::default();
    crypter
        .decrypt(ciphertext, key)
        .map_err(|e| DurianError::crypto(format!("解密失败: {:?}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_login_password() {
        let password = "test_password";
        let hash1 = hash_login_password(password);
        let hash2 = hash_login_password(password);
        
        // 相同密码应产生相同哈希
        assert_eq!(hash1, hash2);
        // 哈希长度应为 64（32 字节的十六进制表示）
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_hash_core_password() {
        let password = "test_core_password";
        let hash1 = hash_core_password(password);
        let hash2 = hash_core_password(password);
        
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_different_salts_produce_different_hashes() {
        let password = "same_password";
        let login_hash = hash_login_password(password);
        let core_hash = hash_core_password(password);
        
        // 不同盐值应产生不同哈希
        assert_ne!(login_hash, core_hash);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let message = "Hello, World!";
        let key = "test_key_12345";
        
        let encrypted = encrypt_message(message, key).unwrap();
        let decrypted = decrypt_message(&encrypted, key).unwrap();
        
        assert_eq!(message, decrypted);
    }
}
