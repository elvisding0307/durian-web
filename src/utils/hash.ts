export const DURIAN_PASSWORD_SALT = "durian.password";
export const DURIAN_CORE_PASSWORD_SALT = "durian.core.password";

// 生成随机盐值
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 使用 PBKDF2 进行加盐哈希
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const usedSalt = salt || generateSalt();
  
  // 将密码和盐值转换为 ArrayBuffer
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(usedSalt);
  
  // 导入密码作为密钥
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // 使用 PBKDF2 进行哈希
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000, // 迭代次数
      hash: 'SHA-256'
    },
    key,
    256 // 输出长度（位）
  );
  
  // 转换为十六进制字符串
  const hashArray = new Uint8Array(hashBuffer);
  const hash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
  
  return { hash, salt: usedSalt };
}

// 验证密码
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { hash: newHash } = await hashPassword(password, salt);
  return newHash === hash;
}