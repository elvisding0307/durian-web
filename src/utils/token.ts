export const getTokenFromCookie = async () => {
    try {
      // 检查cookie中是否有token
      const tokenCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="));
      const token = tokenCookie ? tokenCookie.substring(6) : undefined;
  
      if (token) {
        return token;
      }
    } catch (error) {
      return undefined;
    }
    return undefined;
  };
  