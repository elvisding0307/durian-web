/**
 * 账户插入组件
 */
import { useState, useCallback } from "react";
import { Button, Form, Input, Card, message, Space, Checkbox } from "antd";
import * as api from "../libs/tauri";
import type { InsertAccountFormData } from "../types";

/**
 * 账户插入表单组件
 * 提供用户界面用于添加新的账户信息
 * 密码加密在 Rust 后端完成
 */
function InsertForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordLength, setPasswordLength] = useState(12);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  /**
   * 表单提交处理函数
   */
  const handleSubmit = useCallback(async (values: InsertAccountFormData) => {
    try {
      setLoading(true);

      const { code, msg } = await api.insertAccount(
        values.website,
        values.account || "",
        values.password
      );

      if (code === 0) {
        message.success("插入成功");
        form.resetFields();
      } else {
        message.error(msg || "插入失败");
      }
    } catch (error) {
      message.error("插入失败");
    } finally {
      setLoading(false);
    }
  }, [form]);

  /**
   * 重置表单
   */
  const handleReset = () => {
    form.resetFields();
  };

  /**
   * 生成随机密码
   */
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

/**
 * 账户插入管理器组件
 */
export function InsertManager() {
  return (
    <div className="flex flex-col justify-start items-stretch p-4">
      <InsertForm />
    </div>
  );
}

export default InsertManager;
