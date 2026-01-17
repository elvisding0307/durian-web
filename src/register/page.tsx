/**
 * 注册页面
 */
import { useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import * as api from "../libs/tauri";
import { AuthForm } from "../components/AuthForm";
import type { RegisterFormData } from "../types";

export default function RegisterApp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: RegisterFormData) => {
    setLoading(true);
    try {
      const { code, msg } = await api.register(
        values.username,
        values.password,
        values.core_password
      );

      if (code !== 0) {
        console.error(`注册失败: ${code}: ${msg}`);
        message.error(msg || "注册失败");
        return;
      }

      message.success("注册成功！");
      navigate("/login");
    } catch (error) {
      console.error("注册失败:", error);
      message.error("注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      type="register"
      loading={loading}
      onSubmit={handleSubmit}
    />
  );
}
