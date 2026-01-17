//! 统一错误处理模块
//!
//! 定义应用中所有可能的错误类型，提供结构化的错误处理

use std::fmt;

// ============================================
// 错误类型定义
// ============================================

/// 应用错误类型
///
/// 统一封装所有可能的错误情况
#[derive(Debug)]
pub enum DurianError {
    /// 状态未初始化
    StateNotInitialized,
    /// 状态锁定失败
    StateLockError,
    /// 网络请求错误
    NetworkError(String),
    /// API 响应错误
    ApiError { code: i32, message: String },
    /// 数据库错误
    DatabaseError(String),
    /// 加密/解密错误
    CryptoError(String),
    /// JSON 序列化/反序列化错误
    SerializationError(String),
    /// IO 错误
    IoError(String),
    /// 配置错误
    ConfigError(String),
    /// 输入验证错误
    ValidationError(String),
    /// 未知错误
    Unknown(String),
}

// ============================================
// Display 实现
// ============================================

impl fmt::Display for DurianError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DurianError::StateNotInitialized => {
                write!(f, "应用状态未初始化，请先登录")
            }
            DurianError::StateLockError => {
                write!(f, "状态锁定失败")
            }
            DurianError::NetworkError(msg) => {
                write!(f, "网络请求失败: {}", msg)
            }
            DurianError::ApiError { code, message } => {
                write!(f, "API 错误 [{}]: {}", code, message)
            }
            DurianError::DatabaseError(msg) => {
                write!(f, "数据库错误: {}", msg)
            }
            DurianError::CryptoError(msg) => {
                write!(f, "加密/解密错误: {}", msg)
            }
            DurianError::SerializationError(msg) => {
                write!(f, "数据序列化错误: {}", msg)
            }
            DurianError::IoError(msg) => {
                write!(f, "IO 错误: {}", msg)
            }
            DurianError::ConfigError(msg) => {
                write!(f, "配置错误: {}", msg)
            }
            DurianError::ValidationError(msg) => {
                write!(f, "输入验证错误: {}", msg)
            }
            DurianError::Unknown(msg) => {
                write!(f, "未知错误: {}", msg)
            }
        }
    }
}

// ============================================
// 标准库错误转换
// ============================================

impl std::error::Error for DurianError {}

impl From<std::io::Error> for DurianError {
    fn from(err: std::io::Error) -> Self {
        DurianError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for DurianError {
    fn from(err: serde_json::Error) -> Self {
        DurianError::SerializationError(err.to_string())
    }
}

impl From<rusqlite::Error> for DurianError {
    fn from(err: rusqlite::Error) -> Self {
        DurianError::DatabaseError(err.to_string())
    }
}

impl From<reqwest::Error> for DurianError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            DurianError::NetworkError("请求超时".to_string())
        } else if err.is_connect() {
            DurianError::NetworkError("连接失败，请检查网络".to_string())
        } else {
            DurianError::NetworkError(err.to_string())
        }
    }
}

impl From<Box<dyn std::error::Error>> for DurianError {
    fn from(err: Box<dyn std::error::Error>) -> Self {
        DurianError::Unknown(err.to_string())
    }
}

// ============================================
// 转换为 String（用于 Tauri 命令）
// ============================================

impl From<DurianError> for String {
    fn from(err: DurianError) -> Self {
        err.to_string()
    }
}

// ============================================
// 结果类型别名
// ============================================

/// 应用统一结果类型
pub type DurianResult<T> = Result<T, DurianError>;

// ============================================
// 便捷构造函数
// ============================================

impl DurianError {
    /// 创建网络错误
    pub fn network<S: Into<String>>(msg: S) -> Self {
        DurianError::NetworkError(msg.into())
    }

    /// 创建 API 错误
    pub fn api(code: i32, message: impl Into<String>) -> Self {
        DurianError::ApiError {
            code,
            message: message.into(),
        }
    }

    /// 创建数据库错误
    pub fn database<S: Into<String>>(msg: S) -> Self {
        DurianError::DatabaseError(msg.into())
    }

    /// 创建加密错误
    pub fn crypto<S: Into<String>>(msg: S) -> Self {
        DurianError::CryptoError(msg.into())
    }

    /// 创建验证错误
    pub fn validation<S: Into<String>>(msg: S) -> Self {
        DurianError::ValidationError(msg.into())
    }

    /// 创建配置错误
    pub fn config<S: Into<String>>(msg: S) -> Self {
        DurianError::ConfigError(msg.into())
    }
}

// ============================================
// 单元测试
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = DurianError::StateNotInitialized;
        assert!(err.to_string().contains("未初始化"));

        let err = DurianError::api(401, "未授权");
        assert!(err.to_string().contains("401"));
        assert!(err.to_string().contains("未授权"));
    }

    #[test]
    fn test_error_conversion() {
        let err = DurianError::network("连接超时");
        let s: String = err.into();
        assert!(s.contains("连接超时"));
    }
}
