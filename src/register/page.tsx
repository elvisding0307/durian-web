import { Form, Input, Button, Card, Typography, message, Row, Col } from "antd";
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, ApiResponse } from "../libs/api";

import {
  hashPassword,
  DURIAN_PASSWORD_SALT,
  DURIAN_CORE_PASSWORD_SALT,
} from "../utils/hash";

const { Title } = Typography;

export async function requestRegister(
  username: string,
  password: string,
  core_password: string
): Promise<ApiResponse<{}>> {
  try {
    const response = await apiClient.register({
      username,
      password,
      core_password,
    });

    // 解构赋值
    const { code, msg, data } = response;
    if (code === undefined || msg === undefined) {
      throw new Error("Invalid response format: missing required fields");
    }

    return {
      code: response.code,
      msg: response.msg,
      data: data || {},
    };
  } catch (error) {
    console.error("Register failed:", error);
    return {
      code: -1,
      msg: error instanceof Error ? error.message : "注册失败",
    };
  }
}

export default function RegisterApp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const { username, password, core_password } = values;
      // 对密码进行加盐哈希
      const { hash: hashedPassword } = await hashPassword(
        password,
        DURIAN_PASSWORD_SALT
      );
      const { hash: hashedCorePassword } = await hashPassword(
        core_password,
        DURIAN_CORE_PASSWORD_SALT
      );

      const { code, msg } = await requestRegister(
        username,
        hashedPassword,
        hashedCorePassword
      );
      if (code !== 0) {
        console.error(`注册失败: ${code}: ${msg}`);
      }
      message.success("注册成功！");
      navigate("/login");
    } catch (error) {
      console.log("注册失败: ", error);
      message.error("注册失败，请重试");
    } finally {
      setLoading(false);
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
                用户注册
              </Title>
            </div>

            <Form
              form={form}
              name="register"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              autoComplete="off"
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={[
                  { required: true, message: "请输入用户名!" },
                  { min: 3, message: "用户名至少3个字符!" },
                ]}
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
                rules={[
                  { required: true, message: "请输入密码!" },
                  { min: 6, message: "密码至少6个字符!" },
                ]}
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
                rules={[
                  { required: true, message: "请输入核心密码!" },
                  { min: 6, message: "核心密码至少6个字符!" },
                ]}
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
                  loading={loading}
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
                  注册
                </Button>
              </Form.Item>

              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <span style={{ color: "#666" }}>已有账户？</span>
                <Button
                  type="link"
                  onClick={() => {
                    navigate("/login");
                  }}
                  style={{ color: "#1890ff" }}
                >
                  立即登录
                </Button>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
