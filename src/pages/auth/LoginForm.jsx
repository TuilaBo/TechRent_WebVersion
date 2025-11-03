import { Form, Input, Button, Typography, Card, Alert } from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { useEffect } from "react";

export default function LoginForm() {
  const navigate = useNavigate();
  const { login, fetchMe, user, role, loading, error, clearError, bootstrapped } = useAuth();

  // Nếu đã đăng nhập sẵn → tự điều hướng theo role
  useEffect(() => {
    if (!bootstrapped) return;       // đợi boot xong để khỏi nháy
    if (!user) return;
    redirectByRole(role);
  }, [bootstrapped, user, role]);

  const redirectByRole = (r) => {
    switch (r) {
      case "ADMIN":
        navigate("/admin", { replace: true });
        break;
      case "OPERATOR":
        navigate("/operator", { replace: true });
        break;
      case "TECHNICIAN":
        navigate("/technician", { replace: true });
        break;
      case "CUSTOMER_SUPPORT_STAFF":
        navigate("/support", { replace: true });
        break;
      default:
        navigate("/", { replace: true });
    }
  };

  const onFinish = async (values) => {
    try {
      clearError();
      await login({
        usernameOrEmail: values.email,
        password: values.password,
      });
      // đảm bảo đã có user/role mới điều hướng
      const me = await fetchMe();
      toast.success("Đăng nhập thành công!");
      redirectByRole(me?.role || role);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Đăng nhập thất bại");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-32 md:pt-40">
      <section className="px-4 pb-10">
        <div className="mx-auto w-full" style={{ maxWidth: 420 }}>
          <Card bordered={false} className="shadow-md" bodyStyle={{ padding: 24 }}>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Đăng nhập
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              Tiếp tục thuê thiết bị một cách nhanh chóng.
            </Typography.Paragraph>

            {error && (
              <Alert type="error" message={error} showIcon className="mb-3" />
            )}

            <Form
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
              onChange={clearError}
            >
              <Form.Item label="Email hoặc tên đăng nhập" name="email">
                <Input prefix={<MailOutlined />} placeholder="you@example.com" />
              </Form.Item>

              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
              </Form.Item>

              <div className="flex items-center justify-between mb-2">
                <Form.Item name="remember" valuePropName="checked" noStyle initialValue />
                <Link to="/forgot-password">Quên mật khẩu?</Link>
              </div>

              <Button
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: 500,
                  transition: "background 0.3s ease",
                }}
                onMouseEnter={(e) => (e.target.style.background = "#333")}
                onMouseLeave={(e) => (e.target.style.background = "#000")}
              >
                Đăng nhập
              </Button>

              <div className="my-4 text-center text-xs text-slate-400">HOẶC</div>

              <Button
                block
                size="large"
                className="flex items-center justify-center gap-2 !h-11 border-slate-300 hover:border-sky-400 hover:text-sky-600 transition"
                onClick={() => alert("Implement Google OAuth")}
                disabled={loading}
              >
                <FcGoogle size={20} /> Tiếp tục với Google
              </Button>

              <div className="mt-4 text-sm text-center">
                Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
              </div>
            </Form>
          </Card>
        </div>
      </section>
    </div>
  );
}
