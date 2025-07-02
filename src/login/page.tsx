import { useEffect } from "react";
import { tauriClient } from "../libs/tauri"; // 添加这行
import { Form, Input, Button, Card, Typography, message, Row, Col } from "antd";
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
const { Title } = Typography;

export default function LoginApp() {
  const [form] = Form.useForm();
  const { isLoading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {}, []);

  const onFinish = async (values: any) => {
    const { username, password, core_password } = values;

    await login(username, password, core_password);
    if ((await tauriClient.getUsername()) !== null) {
      message.success("登录成功！");
      navigate("/account");
    } else {
      message.error("登录失败！");
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "20px" }}>
      <Row justify="center" align="middle" style={{ minHeight: "100vh" }}>
        <Col xs={22} sm={16} md={12} lg={12} xl={8}>
          <Card
            style={{
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(24, 144, 255, 0.15)",
              background: "#ffffff",
              border: "1px solid #e6f7ff",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <img
                src="/banner/banner.png"
                alt="Banner"
                width={200}
                height={80}
                style={{ marginBottom: "16px" }}
              />
              <Title
                level={4}
                style={{ margin: 0, color: "#1890ff", fontWeight: 500 }}
              >
                用户登录
              </Title>
            </div>

            <Form
              form={form}
              name="login"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              autoComplete="off"
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: "请输入用户名!" }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: "#1890ff" }} />}
                  placeholder="请输入用户名"
                  style={{ borderColor: "#d9d9d9" }}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: "请输入密码!" }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: "#1890ff" }} />}
                  placeholder="请输入密码"
                  style={{ borderColor: "#d9d9d9" }}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                name="core_password"
                label="核心密码"
                rules={[{ required: true, message: "请输入核心密码!" }]}
              >
                <Input.Password
                  prefix={<SafetyOutlined style={{ color: "#1890ff" }} />}
                  placeholder="请输入核心密码"
                  style={{ borderColor: "#d9d9d9" }}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isLoading}
                  block
                  style={{
                    height: "48px",
                    borderRadius: "8px",
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    fontSize: "16px",
                    fontWeight: "500",
                  }}
                >
                  登录
                </Button>
              </Form.Item>

              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <span style={{ color: "#666" }}>还没有账户？</span>
                <Button
                  type="link"
                  onClick={() => navigate("/register")}
                  style={{ color: "#1890ff" }}
                >
                  立即注册
                </Button>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
