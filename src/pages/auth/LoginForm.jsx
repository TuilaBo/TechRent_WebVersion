import { Form, Input, Button, Typography, Card, Alert, Checkbox } from "antd";
import { MailOutlined, LockOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";

export default function LoginForm() {
  const navigate = useNavigate();
  const { login, fetchMe, user, role, loading, error, clearError, bootstrapped } = useAuth();
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user) return;
    redirectByRole(role);
  }, [bootstrapped, user, role]);

  // Detect Caps Lock
  const handleKeyPress = (e) => {
    const capsLock = e.getModifierState && e.getModifierState("CapsLock");
    setCapsLockOn(capsLock);
  };

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
      const me = await fetchMe();
      toast.success("Đăng nhập thành công!");
      redirectByRole(me?.role || role);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Đăng nhập thất bại");
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #fafafa 0%, #e5e7eb 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <style>{`
        .login-card {
          border-radius: 24px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15) !important;
          border: none !important;
          overflow: hidden;
          backdrop-filter: blur(10px);
          max-width: 360px;
          width: 100%;
        }

        .login-input {
          border-radius: 12px !important;
          border: 2px solid #e5e7eb !important;
          padding: 9px 12px !important;
          font-size: 13px !important;
          transition: all 0.3s ease !important;
        }

        .login-input:hover {
          border-color: #9ca3af !important;
        }

        .login-input:focus {
          border-color: #111111 !important;
          box-shadow: 0 0 0 3px rgba(17,17,17,0.08) !important;
        }

        .login-btn {
          height: 44px !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .login-btn-primary {
          background: linear-gradient(135deg, #111111 0%, #374151 100%) !important;
          border: 1px solid #111111 !important;
          color: #ffffff !important;
        }

        .login-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(17,17,17,0.25) !important;
        }

        .login-btn-google {
          border: 2px solid #e5e7eb !important;
          color: #111827 !important;
          background: #ffffff !important;
        }

        .login-btn-google:hover {
          border-color: #111111 !important;
          color: #111111 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        }

        .login-link {
          color: #111111;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .login-link:hover {
          color: #374151;
          text-decoration: underline;
        }

        .logo-text {
          color: #111111;
          font-weight: 800;
          font-size: 22px;
          text-align: center;
          margin-bottom: 8px;
        }
      `}</style>

      <Card className="login-card" bodyStyle={{ padding: "28px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="logo-text">TECHRENT</div>
          <Typography.Title level={3} style={{ marginBottom: 8, fontWeight: 700, fontSize: 22 }}>
            Chào mừng trở lại
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 14, color: "#6b7280" }}>
            Đăng nhập để tiếp tục thuê thiết bị
          </Typography.Text>
        </div>

        {error && (
          <Alert 
            type="error" 
            message={error} 
            showIcon 
            style={{ marginBottom: 24, borderRadius: 12 }}
          />
        )}

        <Form
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          onChange={clearError}
        >
          <Form.Item 
            label={<span style={{ fontWeight: 600, color: "#374151" }}>Email hoặc tên đăng nhập</span>}
            name="email"
            rules={[{ required: true, message: "Vui lòng nhập email hoặc tên đăng nhập!" }]}
          >
            <Input 
              className="login-input"
              prefix={<MailOutlined style={{ color: "#9ca3af" }} />} 
              placeholder="you@example.com" 
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600, color: "#374151" }}>Mật khẩu</span>}
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
          >
            <Input.Password 
              className="login-input"
              prefix={<LockOutlined style={{ color: "#9ca3af" }} />}
              suffix={
                capsLockOn ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ExclamationCircleOutlined style={{ color: "#f59e0b", fontSize: 16 }} />
                    <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 500 }}>Caps Lock</span>
                  </div>
                ) : null
              }
              placeholder="••••••••"
              onKeyPress={handleKeyPress}
              onKeyUp={handleKeyPress}
            />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox style={{ fontWeight: 500 }}>Ghi nhớ đăng nhập</Checkbox>
            </Form.Item>
            <Link to="/forgot-password" className="login-link" style={{ fontSize: 14 }}>
              Quên mật khẩu?
            </Link>
          </div>

          <Button
            htmlType="submit"
            block
            className="login-btn login-btn-primary"
            loading={loading}
          >
            Đăng nhập
          </Button>

          <div style={{ 
            margin: "24px 0", 
            textAlign: "center", 
            position: "relative",
            color: "#9ca3af",
            fontWeight: 600,
            fontSize: 13,
          }}>
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 1,
              background: "#e5e7eb",
              zIndex: 0,
            }}></div>
            <span style={{ 
              background: "#fff", 
              padding: "0 16px", 
              position: "relative", 
              zIndex: 1 
            }}>
              HOẶC
            </span>
          </div>

          <Button
            block
            className="login-btn login-btn-google"
            onClick={() => alert("Implement Google OAuth")}
            disabled={loading}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <FcGoogle size={22} />
              <span style={{ fontWeight: 600 }}>Tiếp tục với Google</span>
            </div>
          </Button>

          <div style={{ marginTop: 24, textAlign: "center", fontSize: 15, color: "#6b7280" }}>
            Chưa có tài khoản?{" "}
            <Link to="/register" className="login-link">
              Đăng ký ngay
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}