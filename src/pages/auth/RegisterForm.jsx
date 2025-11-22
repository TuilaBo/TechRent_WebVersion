// src/pages/auth/RegisterForm.jsx
import { Form, Input, Button, Checkbox, Typography, Card, Alert } from "antd";
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { useState } from "react";

export default function RegisterForm() {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuth();
  const [form] = Form.useForm();
  const [capsLockOn, setCapsLockOn] = useState(false);

  const onFinish = async (values) => {
    try {
      clearError();
      // Chuẩn hoá 9 số sau +84
      const local9 = String(values.phoneNumber ?? "")
        .replace(/\D/g, "")     // chỉ giữ số
        .replace(/^0/, "")      // bỏ 0 đầu nếu có
        .slice(0, 9);           // giới hạn 9 số

      const fullPhone = `+84${local9}`;

      await register({
        username: values.username,
        password: values.password,
        email: values.email,
        phoneNumber: fullPhone, // gửi dạng +84XXXXXXXXX
      });

      toast.success("Đăng ký thành công! Kiểm tra email để nhận mã OTP.");
      navigate("/verify-otp", { state: { email: values.email } });
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Đăng ký thất bại");
    }
  };

  // Chuẩn hoá input: chỉ cho nhập số, bỏ 0 đầu, max 9 số
  const sanitizePhone = (e) => {
    const v = e?.target?.value ?? "";
    return v.replace(/\D/g, "").replace(/^0/, "").slice(0, 9);
  };

  // Detect Caps Lock
  const handleKeyPress = (e) => {
    const capsLock = e.getModifierState && e.getModifierState("CapsLock");
    setCapsLockOn(capsLock);
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #fafafa 0%, #e5e7eb 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <style>{`
        .login-card { 
          border-radius: 24px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15) !important;
          border: none !important;
          overflow: hidden;
          backdrop-filter: blur(10px);
          max-width: 360px; width: 100%;
        }
        .login-input { 
          border-radius: 12px !important;
          border: 2px solid #e5e7eb !important;
          padding: 9px 12px !important;
          font-size: 13px !important;
        }
        .login-btn { height: 44px !important; border-radius: 12px !important; font-weight: 600 !important; font-size: 14px !important; }
        .login-btn-primary { background: linear-gradient(135deg, #111111 0%, #374151 100%) !important; border: 1px solid #111111 !important; color: #ffffff !important; }
        .login-link { color: #111111; font-weight: 600; }
      `}</style>
      <Card bordered={false} className="login-card" bodyStyle={{ padding: "28px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ color: "#111", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>TECHRENT</div>
          <Typography.Title level={3} style={{ marginBottom: 4, fontSize: 22 }}>
            Đăng ký
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0, color: "#6b7280", fontSize: 14 }}>
            Tạo tài khoản để bắt đầu thuê thiết bị.
          </Typography.Paragraph>

          {error && <Alert type="error" message={error} showIcon className="mb-3" />}

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
              onChange={clearError}
            >
              <Form.Item
                label="Tên đăng nhập"
                name="username"
                rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập!" }]}
              >
                <Input className="login-input" prefix={<UserOutlined style={{ color: '#9ca3af' }} />} placeholder="Vui lòng nhập tên đăng nhập" />
              </Form.Item>

              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: "Vui lòng nhập email!" },
                  { type: "email", message: "Email không hợp lệ!" },
                ]}
              >
                <Input className="login-input" prefix={<MailOutlined style={{ color: '#9ca3af' }} />} placeholder="you@example.com" />
              </Form.Item>

              <Form.Item
                label="Số điện thoại"
                name="phoneNumber"
                // Nhận giá trị đã sanitize
                getValueFromEvent={sanitizePhone}
                rules={[
                  { required: true, message: "Vui lòng nhập số điện thoại!" },
                  {
                    validator: (_, value) => {
                      const v = String(value ?? "");
                      return /^\d{9}$/.test(v)
                        ? Promise.resolve()
                        : Promise.reject(new Error("Nhập đủ 9 số sau +84"));
                    },
                  },
                ]}
              >
                <Input
                  className="login-input"
                  prefix={<PhoneOutlined style={{ color: '#9ca3af' }} />}
                  addonBefore={<span style={{ width: 44, display: "inline-block", textAlign: "center" }}>+84</span>}
                  placeholder="9 số (vd: 912345678)"
                  inputMode="numeric"
                  maxLength={9}
                />
              </Form.Item>

              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[
                  { required: true, message: "Vui lòng nhập mật khẩu!" },
                  { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
                ]}
                hasFeedback
              >
                <Input.Password 
                  className="login-input" 
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
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

              <Form.Item
                label="Xác nhận mật khẩu"
                name="confirm"
                dependencies={["password"]}
                hasFeedback
                rules={[
                  { required: true, message: "Vui lòng xác nhận mật khẩu!" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) return Promise.resolve();
                      return Promise.reject(new Error("Mật khẩu xác nhận không khớp"));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  className="login-input" 
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
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

              <Form.Item
                name="agree"
                valuePropName="checked"
                initialValue
                rules={[
                  {
                    validator: (_, v) =>
                      v ? Promise.resolve() : Promise.reject(new Error("Bạn cần đồng ý điều khoản")),
                  },
                ]}
              >
                <Checkbox>
                  Tôi đồng ý với{" "}
                  <Link to="/terms" className="text-sky-600">Điều khoản & Chính sách</Link>
                </Checkbox>
              </Form.Item>

              <Button
                htmlType="submit"
                block
                size="large"
                loading={loading}
                className="login-btn login-btn-primary"
              >
                Đăng ký
              </Button>

              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
                Đã có tài khoản? <Link to="/login" className="login-link">Đăng nhập</Link>
              </div>
            </Form>
        </div>
      </Card>
    </div>
  );
}
