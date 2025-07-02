import { useState } from "react";
import { Button, Form, Input, Card, message, Space, Checkbox } from "antd";
import { tauriClient } from "../libs/tauri";
import { apiClient, InsertRequest, ApiResponse } from "../libs/api";

/**
 * 账户插入表单组件
 * 提供用户界面用于添加新的账户信息
 * 包含网站、账号、密码输入以及密码生成功能
 */
function InsertForm() {
  // 表单实例，用于控制表单的提交、重置等操作
  const [form] = Form.useForm();

  // 加载状态，用于控制按钮和输入框的禁用状态
  const [loading, setLoading] = useState(false);

  // 生成密码的长度设置，默认12位
  const [passwordLength, setPasswordLength] = useState(12);

  // 是否在生成密码时包含特殊符号
  const [includeSymbols, setIncludeSymbols] = useState(true);

  /**
   * 账户插入请求函数
   * 参考 register/page.tsx 的 requestRegister 函数实现
   * 该函数负责处理账户信息的插入操作，包括密码加密和API调用
   *
   * @param website 网站地址 - 要保存账户信息的网站URL
   * @param account 账号 - 用户在该网站的账号名
   * @param password 密码 - 用户在该网站的密码（明文）
   * @returns Promise<ApiResponse<{}>> 插入响应 - 包含操作结果的响应对象
   */
  async function requestInsert(
    website: string,
    account: string,
    password: string
  ): Promise<ApiResponse<{}>> {
    try {
      // 使用 Tauri 客户端加密密码
      // 在存储前对密码进行加密处理，确保数据安全
      const encryptedPassword = await tauriClient.encrypt(password);

      // 调用 API 客户端的 insertAccount 方法
      // 将加密后的密码和其他信息发送到后端进行存储
      const response = await apiClient.insertAccount({
        website,
        account,
        password: encryptedPassword,
      });

      // 解构赋值获取响应数据
      const { code, msg, data } = response;

      // 验证响应格式的完整性
      if (code === undefined || msg === undefined) {
        throw new Error("Invalid response format: missing required fields");
      }

      // 返回标准化的响应格式
      return {
        code: response.code,
        msg: response.msg,
        data: data || {}, // 如果data为空，则返回空对象
      };
    } catch (error) {
      // 错误处理：记录错误日志并返回错误响应
      console.error("Insert failed:", error);
      return {
        code: -1,
        msg: error instanceof Error ? error.message : "插入失败",
      };
    }
  }

  /**
   * 表单提交处理函数
   * 当用户点击"添加账户"按钮时触发
   *
   * @param values 表单数据，符合InsertRequest接口
   */
  const handleSubmit = async (values: InsertRequest) => {
    try {
      // 设置加载状态，禁用表单控件
      setLoading(true);

      // 使用新的 requestInsert 函数处理插入请求
      const { code, msg } = await requestInsert(
        values.website,
        values.account,
        values.password
      );

      // 根据返回的状态码判断操作结果
      if (code === 0) {
        // 插入成功：显示成功消息并清空表单
        message.success("插入成功");
        form.resetFields();
      } else {
        // 插入失败：显示错误消息
        message.error(msg || "插入失败");
      }
    } catch (error) {
      // 异常处理：显示通用错误消息
      message.error("插入失败");
    } finally {
      // 无论成功失败都要重置加载状态
      setLoading(false);
    }
  };

  /**
   * 重置表单处理函数
   * 清空所有表单字段的值
   */
  const handleReset = () => {
    form.resetFields();
  };

  /**
   * 生成随机密码函数
   * 根据用户设置的长度和字符类型生成随机密码
   */
  const generatePassword = () => {
    // 定义可用的字符集
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*.";

    // 基础字符集包含字母和数字
    let chars = letters + numbers;

    // 根据用户选择决定是否包含特殊符号
    if (includeSymbols) {
      chars += symbols;
    }

    // 生成指定长度的随机密码
    let password = "";
    for (let i = 0; i < passwordLength; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 将生成的密码设置到表单的密码字段
    form.setFieldsValue({ password });
  };

  return (
    <Card title="添加新账户" style={{ maxWidth: 700, margin: "0 auto" }}>
      <Form
        form={form}
        style={{ minWidth: 600 }}
        layout="vertical" // 垂直布局，标签在输入框上方
        onFinish={handleSubmit} // 表单提交时的处理函数
        autoComplete="off" // 禁用浏览器自动完成
      >
        {/* 网站地址输入框 - 必填字段 */}
        <Form.Item
          label="网站"
          name="website"
          rules={[{ required: true, message: "请输入网站地址!" }]}
        >
          <Input placeholder="请输入网站地址" disabled={loading} />
        </Form.Item>

        {/* 账号输入框 - 可选字段 */}
        <Form.Item label="账号" name="account">
          <Input placeholder="请输入账号（可选）" disabled={loading} />
        </Form.Item>

        {/* 密码输入框 - 必填字段，带密码生成功能 */}
        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: "请输入密码!" }]}
        >
          <Input.Password
            placeholder="请输入密码"
            disabled={loading}
            addonAfter={
              // 密码生成控件：长度设置 + 生成按钮
              <Space.Compact>
                {/* 密码长度输入框 */}
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
                {/* 生成密码按钮 */}
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

        {/* 密码生成选项：是否包含特殊符号 */}
        <Form.Item>
          <Checkbox
            checked={includeSymbols}
            onChange={(e) => setIncludeSymbols(e.target.checked)}
            disabled={loading}
          >
            包含符号 (!@#$%^&*.)
          </Checkbox>
        </Form.Item>

        {/* 操作按钮组：提交和重置 */}
        <Form.Item style={{ textAlign: "center" }}>
          <Space>
            {/* 提交按钮 */}
            <Button type="primary" htmlType="submit" loading={loading}>
              {loading ? "添加中..." : "添加账户"}
            </Button>
            {/* 重置按钮 */}
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
 * 作为插入功能的主要容器组件
 * 提供适当的布局和样式
 */
export function InsertManager() {
  return (
    <div className="flex flex-col justify-start items-stretch p-4">
      <InsertForm />
    </div>
  );
}

// 默认导出插入管理器组件
export default InsertManager;
