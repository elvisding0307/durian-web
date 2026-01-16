/**
 * 统一类型定义文件
 * 包含所有前端使用的接口和类型
 */

// ============================================
// 用户相关类型
// ============================================

/** 用户信息 */
export interface User {
  username: string;
}

/** 登录表单数据 */
export interface LoginFormData {
  username: string;
  password: string;
  core_password: string;
}

/** 注册表单数据 */
export interface RegisterFormData {
  username: string;
  password: string;
  core_password: string;
}

// ============================================
// 账户相关类型
// ============================================

/** 账户基础信息（从服务器返回） */
export interface AccountItem {
  rid: number;
  website: string;
  account: string;
  password: string;
}

/** 账户数据（用于表格显示） */
export interface AccountDataType extends AccountItem {
  key: string;
}

/** 缓存数据结构 */
export interface CacheData {
  username: string;
  update_time: number;
  accounts: AccountItem[];
}

/** 插入账户表单数据 */
export interface InsertAccountFormData {
  website: string;
  account?: string;
  password: string;
}

/** 更新账户表单数据 */
export interface UpdateAccountFormData {
  rid: number;
  website: string;
  account: string;
  password: string;
}

// ============================================
// API 响应类型
// ============================================

/** API 通用响应 */
export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

/** 登录响应数据 */
export interface LoginResponseData {
  token: string;
}

/** 查询响应数据 */
export interface QueryResponseData {
  pull_mode: string;
  update_time: number;
  accounts: AccountItem[];
}

// ============================================
// 认证上下文类型
// ============================================

/** 认证上下文类型 */
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginFormData) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

// ============================================
// 组件 Props 类型
// ============================================

/** 布局组件 Props */
export interface LayoutProps {
  children: React.ReactNode;
}

/** 认证表单类型 */
export type AuthFormType = 'login' | 'register';

/** 认证表单 Props */
export interface AuthFormProps {
  type: AuthFormType;
  loading?: boolean;
  onSubmit: (values: LoginFormData | RegisterFormData) => Promise<void>;
}

// ============================================
// 可编辑表格类型
// ============================================

/** 可编辑单元格 Props */
export interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean;
  dataIndex: string;
  title: string;
  inputType: 'number' | 'text' | 'password';
  record: AccountDataType;
  index: number;
}

// ============================================
// 工具类型
// ============================================

/** 可选属性 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** 必选属性 */
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };
