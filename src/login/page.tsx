/**
 * 登录页面
 */
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuthForm } from "../components/AuthForm";
import type { LoginFormData } from "../types";

export default function LoginApp() {
  const { isLoading, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: LoginFormData) => {
    const success = await login(values);
    if (success) {
      message.success("登录成功！");
      navigate("/account");
    } else {
      message.error("登录失败！");
    }
  };

  return (
    <AuthForm
      type="login"
      loading={isLoading}
      onSubmit={handleSubmit}
    />
  );
}
