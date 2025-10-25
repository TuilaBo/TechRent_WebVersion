// src/pages/auth/RegisterForm.jsx
import { Form, Input, Button, Checkbox, Typography, Card, Alert, message } from "antd";
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
export default function RegisterForm() {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuth();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    try {
      clearError();
      await register({
        username: values.username,
        password: values.password,
        email: values.email,
        phoneNumber: values.phoneNumber,
      });
      toast.success("Đăng ký thành công! Kiểm tra email để nhận mã OTP.");
      navigate("/verify-otp", { state: { email: values.email } });
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Đăng ký thất bại");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-32 md:pt-40">
      <section className="px-4 pb-10">
        <div className="mx-auto w-full" style={{ maxWidth: 420 }}>
          <Card bordered={false} className="shadow-md" bodyStyle={{ padding: 24 }}>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Đăng ký
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
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
                <Input prefix={<UserOutlined />} placeholder="Vui lập nhập tên đăng nhập" />
              </Form.Item>

              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: "Vui lòng nhập email!" },
                  { type: "email", message: "Email không hợp lệ!" },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="you@example.com" />
              </Form.Item>

              <Form.Item
                label="Số điện thoại"
                name="phoneNumber"
                rules={[
                  { required: true, message: "Vui lòng nhập số điện thoại!" },
                  { pattern: /^[0-9+\-\s]{8,15}$/, message: "SĐT không hợp lệ" },
                ]}
              >
                <Input prefix={<PhoneOutlined />} placeholder="0901234567" />
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
                <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
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
                <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
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
                style={{ background: "#000", color: "#fff", border: "none", borderRadius: 4, fontWeight: 500 }}
              >
                Đăng ký
              </Button>

              <div className="mt-4 text-sm text-center">
                Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
              </div>
            </Form>
          </Card>
        </div>
      </section>
    </div>
  );
}
