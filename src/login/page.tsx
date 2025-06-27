"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { invoke } from "@tauri-apps/api/core";
import { API_BASE_URL } from "../config/url";
import { requestAuthVerify } from "../auth/verify";
import { Response } from "../types/response";
import { Form, Input, Button, Card, Typography, message, Row, Col } from "antd";
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  hashPassword,
  DURIAN_PASSWORD_SALT,
  DURIAN_CORE_PASSWORD_SALT,
} from "../utils/hash"; // 导入哈希函数和盐值

const { Title } = Typography;

interface LoginResponse {
  token: string;
}

export async function requestLogin(
  username: string,
  password: string,
  core_password: string
): Promise<Response<LoginResponse>> {
  try {
    // 创建axios实例
    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });
    const response = await apiClient.post("/login", {
      username,
      password,
      core_password,
    });

    const { code, msg } = response.data;
    if (code === undefined || msg === undefined) {
      throw new Error("Invalid response format: missing required fields");
    }

    return {
      code: response.data.code,
      msg: response.data.msg,
      data: { token: response.data.data.token },
    };
  } catch (e: any) {
    return { code: -1, msg: e.toString() };
  }
}

export default function LoginApp() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    const func = async () => {
      if ((await requestAuthVerify()) === true) {
        navigate("/account");
      }
    };
    func();
  }, []);

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

      // console.log('Password hash:', hashedPassword);
      // console.log('Password salt:', passwordSalt);
      // console.log('Core password hash:', hashedCorePassword);
      // console.log('Core password salt:', corePasswordSalt);

      // 使用哈希后的密码进行登录
      const { code, msg, data } = await requestLogin(
        username,
        hashedPassword, // 使用哈希后的密码
        hashedCorePassword // 使用哈希后的核心密码
      );

      if (data === undefined) {
        throw new Error("Invalid response format: missing required fields");
      }

      const { token } = data;
      if (code === 0) {
        // 写入cookie
        document.cookie = `token=${token}; path=/`;

        // 初始化 Durian 状态（传入用户名）
        try {
          await invoke("init_state", {
            corePassword: core_password,
            username: username, // 传入用户名
          });
        } catch (error) {
          console.error("Failed to initialize Durian state:", error);
        }

        message.success("登录成功！");
        navigate("/account");
      } else {
        message.error(msg);
      }
    } catch (error) {
      message.error("登录失败，请重试");
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
                用户登录
              </Title>
            </div>

            <Form
              form={form}
              name="login"
              onFinish={onFinish}
              layout="vertical"
              size="large"
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
