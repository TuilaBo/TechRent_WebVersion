// src/pages/checkout/CheckoutPage.jsx
import React, { useMemo, useState } from "react";
import {
  Row,
  Col,
  Typography,
  Breadcrumb,
  Card,
  Form,
  Input,
  Select,
  Button,
  Divider,
  List,
  Avatar,
  Badge,
  DatePicker,
  message,
} from "antd";
import { Link, useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

// --- MOCK giỏ hàng ---
const CART = [
  {
    id: "mbp-2020-m1",
    name: "MacBook Pro M1 2020",
    note: "16GB RAM, 512GB SSD, 13 inch",
    image:
      "https://macone.vn/wp-content/uploads/2020/11/HAN00152-Lo%CC%9B%CC%81n-1024x682.jpeg",
    dailyPrice: 2_500_000,
    days: 1,
    qty: 1,
  },
];

// --- Địa lý mock ---
const PROVINCES = [
  { value: "HCM", label: "TP. Hồ Chí Minh" },
  { value: "HN", label: "Hà Nội" },
  { value: "DN", label: "Đà Nẵng" },
];
const DISTRICTS = {
  HCM: [
    { value: "Q1", label: "Quận 1" },
    { value: "Q3", label: "Quận 3" },
    { value: "BT", label: "Bình Thạnh" },
  ],
  HN: [
    { value: "HK", label: "Hoàn Kiếm" },
    { value: "CG", label: "Cầu Giấy" },
  ],
  DN: [
    { value: "HC", label: "Hải Châu" },
    { value: "ST", label: "Sơn Trà" },
  ],
};
const WARDS = {
  Q1: [
    { value: "PBenNghe", label: "Phường Bến Nghé" },
    { value: "PBenThanh", label: "Phường Bến Thành" },
  ],
  Q3: [
    { value: "PWard6", label: "Phường 6" },
    { value: "PWard7", label: "Phường 7" },
  ],
  BT: [
    { value: "P22", label: "Phường 22" },
    { value: "PWard1", label: "Phường 1" },
  ],
  HK: [
    { value: "PHangTrong", label: "Phường Hàng Trống" },
    { value: "PTrangTien", label: "Phường Tràng Tiền" },
  ],
  CG: [
    { value: "PDichVong", label: "Phường Dịch Vọng" },
    { value: "PDichVongHau", label: "Phường Dịch Vọng Hậu" },
  ],
  HC: [
    { value: "PThachThang", label: "Phường Thạch Thang" },
    { value: "PHaiChauI", label: "Phường Hải Châu I" },
  ],
  ST: [
    { value: "PAnHaiBac", label: "Phường An Hải Bắc" },
    { value: "PAnHaiDong", label: "Phường An Hải Đông" },
  ],
};

function formatVND(n) {
  return n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

// TỶ LỆ CỌC (mock): 30% tạm tính
const DEPOSIT_RATE = 0.3;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [shippingMethod] = useState("delivery"); // mặc định giao tận nơi
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(null); // {code, amount}

  // Tính tiền
  const totals = useMemo(() => {
    const subtotal = CART.reduce(
      (sum, it) => sum + it.dailyPrice * it.days * it.qty,
      0
    );
    const shipping = 0;
    const discount = couponApplied?.amount || 0;
    const deposit = Math.round(subtotal * DEPOSIT_RATE);
    const grand = Math.max(0, subtotal + deposit - discount);
    return { subtotal, shipping, discount, deposit, grand };
  }, [couponApplied]);

  const applyCoupon = () => {
    if (!coupon) return;
    if (coupon.trim().toUpperCase() === "GIAM100K") {
      setCouponApplied({ code: "GIAM100K", amount: 100000 });
      message.success("Áp dụng mã giảm giá thành công.");
    } else {
      setCouponApplied(null);
      message.warning("Mã giảm giá không hợp lệ.");
    }
  };

  const onFinish = (values) => {
    const payload = {
      contact: {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
      },
      shipping: {
        method: shippingMethod,
        receiveAt: values.receiveAt?.toISOString(),
        address:
          shippingMethod === "delivery"
            ? {
                addressLine: values.address,
                province: values.province,
                district: values.district,
                ward: values.ward,
              }
            : null,
      },
      cart: CART,
      totals,
      coupon: couponApplied,
    };

    console.log("Checkout payload:", payload);
    message.success("Đã lưu thông tin. Chuyển tới bước ký hợp đồng…");
    navigate("/contract", { state: payload });
  };

  const provinceValue = Form.useWatch("province", form);
  const districtValue = Form.useWatch("district", form);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { title: <Link to="/cart">Giỏ hàng</Link> },
            { title: "Thanh toán" },
          ]}
          className="mb-2"
        />

        <Title level={2} style={{ margin: "0 0 16px 0", color: "#111827" }}>
          Thanh toán
        </Title>

        <Row gutter={[24, 24]}>
          {/* LEFT: Form giao hàng */}
          <Col xs={24} lg={14}>
            <Card bordered className="rounded-xl" bodyStyle={{ padding: 20 }}>
              <Title level={4} style={{ marginTop: 0, color: "#111827" }}>
                Thông tin giao hàng
              </Title>

              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{ fullName: "", email: "", phone: "" }}
                requiredMark={false}
              >
                <Form.Item
                  label="Họ và tên"
                  name="fullName"
                  rules={[{ required: true, message: "Vui lòng nhập họ và tên" }]}
                >
                  <Input placeholder="Nguyễn Văn A" />
                </Form.Item>

                <Row gutter={12}>
                  <Col xs={24} md={14}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: "Vui lòng nhập email" },
                        { type: "email", message: "Email không hợp lệ" },
                      ]}
                    >
                      <Input placeholder="you@example.com" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={10}>
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
                      <Input placeholder="09xx xxx xxx" />
                    </Form.Item>
                  </Col>
                </Row>

                <Card type="inner" className="rounded-lg" bodyStyle={{ paddingTop: 12 }}>
                  {shippingMethod === "delivery" ? (
                    <>
                      <Form.Item
                        label="Địa chỉ"
                        name="address"
                        rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
                      >
                        <Input placeholder="Số nhà, đường..." />
                      </Form.Item>

                      <Row gutter={12}>
                        <Col xs={24} md={8}>
                          <Form.Item
                            label="Tỉnh / thành"
                            name="province"
                            rules={[{ required: true, message: "Chọn tỉnh / thành" }]}
                          >
                            <Select
                              placeholder="Chọn tỉnh / thành"
                              options={PROVINCES}
                              allowClear
                              onChange={() =>
                                form.setFieldsValue({ district: undefined, ward: undefined })
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            label="Quận / huyện"
                            name="district"
                            rules={[{ required: true, message: "Chọn quận / huyện" }]}
                          >
                            <Select
                              placeholder="Chọn quận / huyện"
                              options={DISTRICTS[provinceValue] || []}
                              disabled={!provinceValue}
                              allowClear
                              onChange={() => form.setFieldsValue({ ward: undefined })}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            label="Phường / xã"
                            name="ward"
                            rules={[{ required: true, message: "Chọn phường / xã" }]}
                          >
                            <Select
                              placeholder="Chọn phường / xã"
                              options={WARDS[districtValue] || []}
                              disabled={!districtValue}
                              allowClear
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  ) : (
                    <div>
                      <Text type="secondary">
                        Vui lòng đến cửa hàng TechRent (Quận 1, TP.HCM) để nhận thiết bị.
                        Chúng tôi sẽ liên hệ xác nhận thời gian.
                      </Text>
                    </div>
                  )}

                  {/* THỜI GIAN NHẬN HÀNG */}
                  <Form.Item
                    label="Thời gian nhận hàng"
                    name="receiveAt"
                    rules={[{ required: true, message: "Chọn thời gian nhận hàng" }]}
                  >
                    <DatePicker showTime style={{ width: "100%" }} />
                  </Form.Item>
                </Card>

                {/* (ĐÃ GỠ) Nút tạo đơn ở trái – chuyển sang card phải */}
              </Form>
            </Card>
          </Col>

          {/* RIGHT: Tóm tắt đơn hàng (sticky) */}
          <Col xs={24} lg={10}>
            <div className="checkout-sticky">
              <Card
                bordered
                className="rounded-xl"
                bodyStyle={{ padding: 16, height: "100%", overflow: "auto" }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={CART}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Badge count={item.qty} size="small">
                            <Avatar shape="square" size={56} src={item.image} alt={item.name} />
                          </Badge>
                        }
                        title={
                          <div className="flex justify-between gap-2">
                            <span style={{ fontWeight: 500, color: "#111827" }}>{item.name}</span>
                            <span style={{ color: "#111827" }}>
                              {formatVND(item.dailyPrice * item.days * item.qty)}
                            </span>
                          </div>
                        }
                        description={<Text type="secondary">{item.note}</Text>}
                      />
                    </List.Item>
                  )}
                />

                <Divider />

                {/* (Tùy chọn) ô mã giảm giá — vẫn giữ logic */}

                <Divider />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Text>Tạm tính</Text>
                    <Text strong>{formatVND(totals.subtotal)}</Text>
                  </div>

                  {totals.discount > 0 && (
                    <div className="flex justify-between">
                      <Text>Giảm giá ({couponApplied?.code})</Text>
                      <Text strong>-{formatVND(totals.discount)}</Text>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Text>Tiền cọc</Text>
                    <Text strong>{formatVND(totals.deposit)}</Text>
                  </div>
                </div>

                <Divider />

                <div className="flex justify-between items-center">
                  <Title level={4} style={{ margin: 0, color: "#111827" }}>
                    Tổng cộng
                  </Title>
                  <Title level={3} style={{ margin: 0, color: "#111827" }}>
                    {formatVND(totals.grand)}
                  </Title>
                </div>

                {/* Nút tạo đơn hàng – trắng đen, đặt dưới Tổng cộng */}
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={() => form.submit()}
                  style={{
                    marginTop: 12,
                    background: "#111827",
                    borderColor: "#111827",
                  }}
                >
                  Tạo đơn hàng
                </Button>

                <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  *Tiền cọc sẽ được hoàn lại sau khi trả thiết bị đúng điều kiện.
                </Text>
              </Card>
            </div>
          </Col>
        </Row>
      </div>

      {/* Sticky styles */}
      <style>{`
        .checkout-sticky {
          position: sticky;
          top: calc(var(--stacked-header, 0px) + 16px);
          align-self: flex-start;
          height: calc(100vh - var(--stacked-header, 0px) - 32px);
        }
        @media (max-width: 991px) {
          .checkout-sticky {
            position: static;
            height: auto;
          }
        }
      `}</style>
    </div>
  );
}
