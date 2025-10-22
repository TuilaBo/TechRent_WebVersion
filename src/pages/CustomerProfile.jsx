// src/pages/profile/CustomerProfile.jsx
import React, { useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Descriptions,
  Button,
  Space,
  Form,
  Input,
  message,
  Progress,
  Tabs,
} from "antd";
import { Link } from "react-router-dom";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  CheckCircleTwoTone,
  ExclamationCircleTwoTone,
  IdcardOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  EditOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

/** Mock customer – sau nối API thay ở đây */
const MOCK_CUSTOMER = {
  customerID: "CUS-000123",
  email: "tronglhse161154@example.com",
  phone: "0912345678",
  fullName: "Lê Hoàng Trọng",
  createdAt: "2025-09-20 10:30",
  status: "active",
  shippingAddress: "12 Nguyễn Trãi, P.Bến Thành, Q.1, TP.HCM",
  // KYC status: unverified | pending | verified
  kycStatus: "unverified",
};

export default function CustomerProfile() {
  const [customer, setCustomer] = useState(MOCK_CUSTOMER);
  const [infoForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [submittingPw, setSubmittingPw] = useState(false);

  // Lưu thông tin liên hệ
  const onSaveInfo = (vals) => {
    const payload = {
      ...customer,
      fullName: vals.fullName?.trim(),
      phone: vals.phone?.trim(),
      shippingAddress: vals.shippingAddress?.trim(),
    };
    setCustomer(payload);
    message.success("Đã lưu thông tin hồ sơ (UI).");
  };

  // Strength (đơn giản để hiển thị)
  const calcStrength = (v = "") => {
    let score = 0;
    if (v.length >= 8) score += 25;
    if (/[A-Z]/.test(v)) score += 25;
    if (/[a-z]/.test(v)) score += 20;
    if (/\d/.test(v)) score += 15;
    if (/[^A-Za-z0-9]/.test(v)) score += 15;
    return Math.min(score, 100);
  };

  // Đổi mật khẩu (mock)
  const onChangePassword = async (vals) => {
    try {
      setSubmittingPw(true);
      await new Promise((r) => setTimeout(r, 700));
      pwForm.resetFields();
      message.success("Đổi mật khẩu thành công (UI).");
    } catch (e) {
      message.error("Đổi mật khẩu thất bại.");
    } finally {
      setSubmittingPw(false);
    }
  };

  // KYC banners (trắng–đen)
  const KycBanner = ({ tone, icon, title, desc, cta }) => (
    <div
      style={{
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <Space align="start">
        {icon}
        <div>
          <Text strong style={{ color: "#111827" }}>{title}</Text>
          <Paragraph style={{ margin: "4px 0 0 0", color: "#6B7280" }}>
            {desc}
          </Paragraph>
          {cta}
        </div>
      </Space>
    </div>
  );

  const kycBlock = (() => {
    switch (customer.kycStatus) {
      case "verified":
        return (
          <KycBanner
            tone="success"
            icon={<CheckCircleTwoTone twoToneColor="#111827" style={{ fontSize: 20 }} />}
            title="Đã xác thực KYC"
            desc="Tài khoản của bạn đã được xác minh, có thể thuê thiết bị không giới hạn theo chính sách."
          />
        );
      case "pending":
        return (
          <KycBanner
            tone="info"
            icon={<SafetyCertificateOutlined style={{ fontSize: 20, color: "#111827" }} />}
            title="Yêu cầu KYC đang được duyệt"
            desc="Chúng tôi sẽ phản hồi sớm nhất trong giờ làm việc."
          />
        );
      default:
        return (
          <KycBanner
            tone="warning"
            icon={<ExclamationCircleTwoTone twoToneColor="#faad14" style={{ fontSize: 20 }} />}
            title="Chưa xác thực KYC"
            desc="Bạn cần hoàn tất xác minh danh tính để tiếp tục thuê thiết bị có giá trị cao."
            cta={
              <div style={{ marginTop: 10 }}>
                <Button
                  type="primary"
                  icon={<IdcardOutlined />}
                  style={{ background: "#111827", borderColor: "#111827" }}
                >
                  <Link to="/kyc" style={{ color: "#fff" }}>
                    Xác thực ngay
                  </Link>
                </Button>
              </div>
            }
          />
        );
    }
  })();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Row gutter={[16, 16]}>
          {/* Cột trái: Thông tin cơ bản + Tabs (Chỉnh sửa / Đổi mật khẩu) */}
          <Col xs={24} lg={14}>
            <Card
              className="rounded-xl"
              title={
                <Space>
                  <UserOutlined />
                  <span style={{ color: "#111827", fontWeight: 600 }}>Hồ sơ của bạn</span>
                </Space>
              }
              bodyStyle={{ padding: 18 }}
            >
              <Descriptions
                column={1}
                size="middle"
                colon
                labelStyle={{ width: 160, color: "#6B7280" }}
                contentStyle={{ color: "#111827" }}
                items={[
                  {
                    key: "email",
                    label: "Email",
                    children: (
                      <Space>
                        <MailOutlined />
                        <Text>{customer.email}</Text>
                      </Space>
                    ),
                  },
                  {
                    key: "created",
                    label: "Ngày tạo",
                    children: <Text>{customer.createdAt}</Text>,
                  },
                ]}
              />
            </Card>

            <Card className="rounded-xl mt-3" bodyStyle={{ padding: 0 }}>
              <Tabs
                className="profile-tabs"
                defaultActiveKey="info"
                items={[
                  {
                    key: "info",
                    label: (
                      <Space>
                        <EditOutlined />
                        <span>Chỉnh sửa thông tin</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ padding: 18 }}>
                        <Form
                          form={infoForm}
                          layout="vertical"
                          onFinish={onSaveInfo}
                          initialValues={{
                            fullName: customer.fullName,
                            phone: customer.phone,
                            shippingAddress: customer.shippingAddress,
                          }}
                          requiredMark={false}
                        >
                          <Form.Item
                            label="Họ và tên"
                            name="fullName"
                            rules={[{ required: true, message: "Vui lòng nhập họ và tên" }]}
                          >
                            <Input prefix={<UserOutlined />} placeholder="Họ và tên" />
                          </Form.Item>

                          <Form.Item
                            label="Số điện thoại"
                            name="phone"
                            rules={[
                              { required: true, message: "Vui lòng nhập số điện thoại" },
                              {
                                pattern: /^(0|\+84)\d{9,10}$/,
                                message: "Số điện thoại không hợp lệ",
                              },
                            ]}
                          >
                            <Input prefix={<PhoneOutlined />} placeholder="09xx xxx xxx" />
                          </Form.Item>

                          <Form.Item
                            label="Địa chỉ giao hàng"
                            name="shippingAddress"
                            rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
                          >
                            <Input.TextArea
                              autoSize={{ minRows: 2, maxRows: 4 }}
                              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                              prefix={<HomeOutlined />}
                            />
                          </Form.Item>

                          <Space>
                            <Button
                              type="primary"
                              htmlType="submit"
                              style={{ background: "#111827", borderColor: "#111827" }}
                            >
                              Lưu thay đổi
                            </Button>
                            <Button htmlType="button" onClick={() => infoForm.resetFields()}>
                              Hủy
                            </Button>
                          </Space>
                        </Form>
                      </div>
                    ),
                  },
                  {
                    key: "password",
                    label: (
                      <Space>
                        <LockOutlined />
                        <span>Đổi mật khẩu</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ padding: 18 }}>
                        <Form
                          form={pwForm}
                          layout="vertical"
                          requiredMark={false}
                          onFinish={onChangePassword}
                        >
                          <Form.Item
                            label="Mật khẩu hiện tại"
                            name="currentPassword"
                            rules={[{ required: true, message: "Vui lòng nhập mật khẩu hiện tại" }]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Mật khẩu hiện tại"
                              iconRender={(visible) =>
                                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                              }
                            />
                          </Form.Item>

                          <Form.Item
                            label="Mật khẩu mới"
                            name="newPassword"
                            rules={[
                              { required: true, message: "Vui lòng nhập mật khẩu mới" },
                              { min: 8, message: "Tối thiểu 8 ký tự" },
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Mật khẩu mới"
                              iconRender={(visible) =>
                                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                              }
                              onChange={(e) => {
                                const strength = calcStrength(e.target.value);
                                pwForm.setFields([{ name: "_pwStrength", value: strength }]);
                              }}
                            />
                          </Form.Item>

                          {/* Strength */}
                          <Form.Item name="_pwStrength" noStyle>
                            <Input type="hidden" />
                          </Form.Item>
                          <Form.Item shouldUpdate noStyle>
                            {() => {
                              const strength = pwForm.getFieldValue("_pwStrength") || 0;
                              const text =
                                strength >= 80 ? "Mạnh" :
                                strength >= 50 ? "Khá" : "Yếu";
                              return (
                                <div style={{ marginTop: -8, marginBottom: 12 }}>
                                  <Progress
                                    percent={strength}
                                    size="small"
                                    showInfo={false}
                                    strokeColor="#111827"
                                    trailColor="#E5E7EB"
                                  />
                                  <Text type="secondary">Độ mạnh mật khẩu: {text}</Text>
                                </div>
                              );
                            }}
                          </Form.Item>

                          <Form.Item
                            label="Xác nhận mật khẩu mới"
                            name="confirmPassword"
                            dependencies={["newPassword"]}
                            rules={[
                              { required: true, message: "Vui lòng nhập lại mật khẩu mới" },
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  if (!value || getFieldValue("newPassword") === value) {
                                    return Promise.resolve();
                                  }
                                  return Promise.reject(new Error("Mật khẩu xác nhận không khớp"));
                                },
                              }),
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Nhập lại mật khẩu mới"
                              iconRender={(visible) =>
                                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                              }
                            />
                          </Form.Item>

                          <Space>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={submittingPw}
                              style={{ background: "#111827", borderColor: "#111827" }}
                            >
                              Cập nhật mật khẩu
                            </Button>
                            <Button onClick={() => pwForm.resetFields()}>Làm mới</Button>
                          </Space>
                        </Form>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          {/* Cột phải: KYC + Ghi chú */}
          <Col xs={24} lg={10}>
            <Card
              className="rounded-xl"
              title={
                <Space>
                  <SafetyCertificateOutlined />
                  <span style={{ color: "#111827", fontWeight: 600 }}>Trạng thái KYC</span>
                </Space>
              }
              bodyStyle={{ padding: 18 }}
            >
              {kycBlock}
            </Card>

            <Card className="rounded-xl mt-3" bodyStyle={{ padding: 18 }}>
              <Title level={5} style={{ marginTop: 0, color: "#111827" }}>
                Ghi chú
              </Title>
              <Paragraph style={{ color: "#6B7280", marginBottom: 0 }}>
                • Thông tin hồ sơ dùng để xuất hợp đồng và giao/thu hồi thiết bị.
                <br />• Nếu bạn thay đổi địa chỉ nhận hàng, vui lòng cập nhật trước
                khi đặt đơn mới.
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </div>

      {/* override nhỏ cho Tabs màu đen */}
      <style>{`
        .profile-tabs .ant-tabs-ink-bar { background: #111827; }
        .profile-tabs .ant-tabs-tab-btn { color: #6B7280; }
        .profile-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: #111827; }
      `}</style>
    </div>
  );
}