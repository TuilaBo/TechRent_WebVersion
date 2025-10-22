// src/pages/auth/RegisterForm.jsx
import { Form, Input, Button, Checkbox, Typography, Card } from "antd";
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";

export default function RegisterForm() {
  const navigate = useNavigate();

  const onFinish = (values) => {
    console.log("Register:", values);
    // TODO: call API đăng ký
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-32 md:pt-40">
      <section className="px-4 pb-10">
        <div className="mx-auto w-full" style={{ maxWidth: 420 }}>
          <Card
            bordered={false}
            className="shadow-md"
            bodyStyle={{ padding: 24 }}
            style={{ width: "100%", margin: "0 auto" }}
          >
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Đăng ký
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              Tạo tài khoản để bắt đầu thuê thiết bị.
            </Typography.Paragraph>

            <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item
                label="Họ và tên"
                name="name"
                rules={[{ required: true, message: "Vui lòng nhập họ và tên!" }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" />
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
                label="Mật khẩu"
                name="password"
                rules={[
                  { required: true, message: "Vui lòng nhập mật khẩu!" },
                  { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
              </Form.Item>

              <Form.Item
                label="Xác nhận mật khẩu"
                name="confirm"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "Vui lòng xác nhận mật khẩu!" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
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
                  <Link to="/terms" className="text-sky-600">
                    Điều khoản & Chính sách
                  </Link>
                </Checkbox>
              </Form.Item>

              <Button  htmlType="submit"
                block
                size="large"
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "500",
                  transition: "background 0.3s ease",
                }}
                onMouseEnter={(e) => (e.target.style.background = "#333")}
                onMouseLeave={(e) => (e.target.style.background = "#000")}>
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
