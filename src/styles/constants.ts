/**
 * 统一样式常量文件
 * 包含所有可复用的样式配置
 */

// ============================================
// 颜色配置
// ============================================

export const colors = {
  primary: '#1890ff',
  primaryHover: '#40a9ff',
  success: '#52c41a',
  error: '#ff4d4f',
  warning: '#faad14',
  textPrimary: '#262626',
  textSecondary: '#666666',
  textDisabled: '#bfbfbf',
  border: '#d9d9d9',
  borderLight: '#e6f7ff',
  background: '#ffffff',
  backgroundGray: '#f5f5f5',
} as const;

// ============================================
// 间距配置
// ============================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// ============================================
// 圆角配置
// ============================================

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

// ============================================
// 卡片样式
// ============================================

export const cardStyles = {
  auth: {
    borderRadius: borderRadius.lg,
    boxShadow: '0 8px 32px rgba(24, 144, 255, 0.15)',
    background: colors.background,
    border: `1px solid ${colors.borderLight}`,
  },
} as const;

// ============================================
// 按钮样式
// ============================================

export const buttonStyles = {
  primary: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    fontSize: 16,
    fontWeight: 500 as const,
  },
} as const;

// ============================================
// 输入框样式
// ============================================

export const inputStyles = {
  default: {
    borderColor: colors.border,
  },
} as const;

// ============================================
// 页面布局样式
// ============================================

export const layoutStyles = {
  fullPage: {
    minHeight: '100vh',
    padding: 20,
  },
  centerContent: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
} as const;

// ============================================
// 标题样式
// ============================================

export const titleStyles = {
  auth: {
    margin: 0,
    color: colors.primary,
    fontWeight: 500 as const,
  },
} as const;

// ============================================
// 链接样式
// ============================================

export const linkStyles = {
  primary: {
    color: colors.primary,
  },
} as const;
