"use client";
import { useState } from "react";
import { Button, Form, Input, Card, message, Space, Checkbox } from "antd";
import { invoke } from "@tauri-apps/api/core";
import axios from "axios";
import { API_BASE_URL } from "../config/url";
import { Response } from "../types/response";
import { getTokenFromCookie } from "../utils/auth";

// 插入请求数据类型
interface InsertRequest {
  website: string;
  account: string;
  password: string;
}

// 插入接口函数
export async function requestInsert(
  insertData: InsertRequest
): Promise<Response<{}>> {
  try {
    // 创建axios实例
    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: (await getTokenFromCookie()) ?? "",
      },
    });

    const response = await apiClient.post("/account", insertData);

    const { code, msg } = response.data;
    if (code === undefined || msg === undefined) {
      throw new Error("Invalid response format: missing required fields");
    }

    return {
      code: response.data.code,
      msg: response.data.msg,
    };
  } catch (e: any) {
    return { code: -1, msg: e.toString() };
  }
}

function InsertForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordLength, setPasswordLength] = useState(12);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  // 提交表单
  const handleSubmit = async (values: InsertRequest) => {
    try {
      setLoading(true);

      console.log("Insert Data:", values);

      values.password = await invoke("encrypt", {
        message: values.password,
      });

      const { code, msg } = await requestInsert(values);

      if (code === 0) {
        message.success("插入成功");
        // 清空表单
        form.resetFields();
      } else {
        message.error(msg || "插入失败");
      }
    } catch (error) {
      console.log("Insert Failed:", error);
      message.error("插入失败");
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    form.resetFields();
  };

  // 生成随机密码
  const generatePassword = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*.";

    let chars = letters + numbers;
    if (includeSymbols) {
      chars += symbols;
    }

    let password = "";
    for (let i = 0; i < passwordLength; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setFieldsValue({ password });
  };

  return (
    <Card title="添加新账户" style={{ maxWidth: 700, margin: "0 auto" }}>
      <Form
        form={form}
        style={{ minWidth: 600 }}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          label="网站"
          name="website"
          rules={[{ required: true, message: "请输入网站地址!" }]}
        >
          <Input placeholder="请输入网站地址" disabled={loading} />
        </Form.Item>

        <Form.Item label="账号" name="account">
          <Input placeholder="请输入账号（可选）" disabled={loading} />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: "请输入密码!" }]}
        >
          <Input.Password
            placeholder="请输入密码"
            disabled={loading}
            addonAfter={
              <Space.Compact>
                <Input
                  type="number"
                  value={passwordLength}
                  onChange={(e) =>
                    setPasswordLength(Number(e.target.value) || 12)
                  }
                  min={1}
                  max={50}
                  style={{ width: 60 }}
                  disabled={loading}
                />
                <Button
                  type="link"
                  size="small"
                  onClick={generatePassword}
                  disabled={loading}
                >
                  生成
                </Button>
              </Space.Compact>
            }
          />
        </Form.Item>

        <Form.Item>
          <Checkbox
            checked={includeSymbols}
            onChange={(e) => setIncludeSymbols(e.target.checked)}
            disabled={loading}
          >
            包含符号 (!@#$%^&*.)
          </Checkbox>
        </Form.Item>

        <Form.Item style={{ textAlign: "center" }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {loading ? "添加中..." : "添加账户"}
            </Button>
            <Button onClick={handleReset} disabled={loading}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}

export function InsertManager() {
  return (
    <div className="flex flex-col justify-start items-stretch p-4">
      <InsertForm />
    </div>
  );
}

export default InsertManager;
