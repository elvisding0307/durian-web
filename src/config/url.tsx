// 读取环境变量，提供默认值
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7224/api';
export const IS_DEBUG = import.meta.env.VITE_DEBUG === 'true';

// 原有的 BASE_URL 可以改为使用环境变量
export const API_URL = API_BASE_URL + '/v1';