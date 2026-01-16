/**
 * 认证表单组件
 * 可复用的登录/注册表单
 */
import { Form, Input, Button, Card, Typography, Row, Col } from "antd";
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { AuthFormType, LoginFormData, RegisterFormData } from "../types";
import { cardStyles, buttonStyles, inputStyles, colors, titleStyles, layoutStyles } from "../styles/constants";

const { Title } = Typography;

/** 表单配置 */
const formConfig: Record<AuthFormType, {
  title: string;
  submitText: string;
  alternateText: string;
  alternateLinkText: string;
  alternatePath: string;
  usernameRules: { required?: boolean; min?: number; message: string }[];
  passwordRules: { required?: boolean; min?: number; message: string }[];
  corePasswordRules: { required?: boolean; min?: number; message: string }[];
}> = {
  login: {
    title: "用户登录",
    submitText: "登录",
    alternateText: "还没有账户？",
    alternateLinkText: "立即注册",
    alternatePath: "/register",
    usernameRules: [{ required: true, message: "请输入用户名!" }],
    passwordRules: [{ required: true, message: "请输入密码!" }],
    corePasswordRules: [{ required: true, message: "请输入核心密码!" }],
  },
  register: {
    title: "用户注册",
    submitText: "注册",
    alternateText: "已有账户？",
    alternateLinkText: "立即登录",
    alternatePath: "/login",
    usernameRules: [
      { required: true, message: "请输入用户名!" },
      { min: 3, message: "用户名至少3个字符!" },
    ],
    passwordRules: [
      { required: true, message: "请输入密码!" },
      { min: 6, message: "密码至少6个字符!" },
    ],
    corePasswordRules: [
      { required: true, message: "请输入核心密码!" },
      { min: 6, message: "核心密码至少6个字符!" },
    ],
  },
};

/** AuthForm Props */
interface AuthFormProps {
  type: AuthFormType;
  loading?: boolean;
  onSubmit: (values: LoginFormData | RegisterFormData) => Promise<void>;
}

/**
 * 认证表单组件
 */
export function AuthForm({ type, loading = false, onSubmit }: AuthFormProps) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const config = formConfig[type];

  const handleFinish = async (values: LoginFormData | RegisterFormData) => {
    await onSubmit(values);
  };

  return (
    <div style={layoutStyles.fullPage}>
      <Row justify="center" align="middle" style={layoutStyles.centerContent}>
        <Col xs={22} sm={16} md={12} lg={12} xl={8}>
          <Card style={cardStyles.auth}>
            {/* 头部 */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <img
                src="/banner/banner.png"
                alt="Banner"
                width={200}
                height={80}
                style={{ marginBottom: 16 }}
              />
              <Title level={4} style={titleStyles.auth}>
                {config.title}
              </Title>
            </div>

            {/* 表单 */}
            <Form
              form={form}
              name={type}
              onFinish={handleFinish}
              layout="vertical"
              size="large"
              autoComplete="off"
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={config.usernameRules}
              >
                <Input
                  prefix={<UserOutlined style={{ color: colors.primary }} />}
                  placeholder="请输入用户名"
                  style={inputStyles.default}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={config.passwordRules}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: colors.primary }} />}
                  placeholder="请输入密码"
                  style={inputStyles.default}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item
                name="core_password"
                label="核心密码"
                rules={config.corePasswordRules}
              >
                <Input.Password
                  prefix={<SafetyOutlined style={{ color: colors.primary }} />}
                  placeholder="请输入核心密码"
                  style={inputStyles.default}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={buttonStyles.primary}
                >
                  {config.submitText}
                </Button>
              </Form.Item>

              {/* 切换链接 */}
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <span style={{ color: colors.textSecondary }}>
                  {config.alternateText}
                </span>
                <Button
                  type="link"
                  onClick={() => navigate(config.alternatePath)}
                  style={{ color: colors.primary }}
                  disabled={loading}
                >
                  {config.alternateLinkText}
                </Button>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default AuthForm;
