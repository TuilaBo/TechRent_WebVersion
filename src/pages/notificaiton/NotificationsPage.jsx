// src/pages/notifications/NotificationsPage.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Tabs,
  Card,
  List,
  Badge,
  Tag,
  Space,
  Button,
  Typography,
  Modal,
  Steps,
  Checkbox,
  Descriptions,
  Avatar,
  message,
  Result,
  Radio,
  DatePicker,
  InputNumber,
} from "antd";
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  InfoCircleTwoTone,
  FileTextOutlined,
  CreditCardOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

const { Title, Text } = Typography;

/* ---------------- Mock data ---------------- */
const MOCK_NOTIFS = [
  {
    id: "NTF-001",
    type: "approved",
    status: "unread",
    createdAt: "2025-10-14 14:15",
    order: {
      id: "TR-241001-023",
      items: [
        {
          name: "Iphone 17 pro max",
          qty: 1,
          image:
            "https://lh3.googleusercontent.com/RGhCKugjPU0Lg_DINbPIkLUFpvwn4C6SQxH-5LsNxbMERnVC0hsRwHQg2akzWWgms8wPP1LNuTW-5QvYblGbipab1ds0yF9B=w500-rw",
        },
      ],
      days: 1,
      total: 800000,
      contractUrl: "https://example.com/contracts/TR-241001-023.pdf",
    },
    message:
      "Đơn TR-241001-023 đã được duyệt. Vui lòng ký hợp đồng và thanh toán.",
  },
  {
    id: "NTF-004",
    type: "due",
    status: "unread",
    createdAt: "2025-10-12 10:00",
    order: {
      id: "TR-241010-008",
      items: [
        {
          name: 'PlayStation 5 + TV 55"',
          qty: 1,
          image:
            "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop",
        },
      ],
      days: 3,
      total: 3000000,
      dueAt: "2025-10-15T12:00:00Z",
    },
    message:
      "Đơn TR-241010-008 sắp tới hạn trả. Bạn có thể chọn trả hàng hoặc gia hạn thêm ngày.",
  },
  {
    id: "NTF-002",
    type: "cancelled",
    status: "unread",
    createdAt: "2025-10-10 09:40",
    order: { id: "TR-240927-004" },
    reason: "Thiếu thông tin xác minh KYC.",
    message: "Đơn TR-240927-004 đã bị hủy.",
  },
  {
    id: "NTF-003",
    type: "general",
    status: "read",
    createdAt: "2025-10-08 18:20",
    message:
      "Khuyến mãi tuần này: Giảm 100K với mã GIAM100K khi đặt thuê từ 2 ngày.",
  },
];

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFS);
  const [filter, setFilter] = useState("all");

  // Flow modal dùng chung
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const [current, setCurrent] = useState(null);

  // Step 0: ký hợp đồng
  const [agreeSign, setAgreeSign] = useState(false);

  // Step 1 (OTP)
  const DIGITS = 6;
  const RESEND_SECONDS = 30;
  const [otpValues, setOtpValues] = useState(Array(DIGITS).fill(""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [payMethod, setPayMethod] = useState("momo"); // step 2
  const [acceptTerms, setAcceptTerms] = useState(false);
  const inputsRef = useRef([]);
  useEffect(() => {
    if (!flowOpen) return;
    setSeconds(RESEND_SECONDS);
    setOtpValues(Array(DIGITS).fill(""));
  }, [flowOpen, flowStep]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  // State riêng cho flow due (trả/gia hạn)
  const [dueChoice, setDueChoice] = useState("return");
  const [returnDate, setReturnDate] = useState(null);
  const [extendDays, setExtendDays] = useState(1);

  const navigate = useNavigate();

  const tabs = [
    { key: "all", label: "Tất cả" },
    { key: "approved", label: "Đơn đã duyệt" },
    { key: "due", label: "Tới hạn trả hàng" },
    { key: "cancelled", label: "Đơn bị hủy" },
    { key: "general", label: "Khác" },
  ];

  const filtered = useMemo(() => {
    if (filter === "all") return notifs;
    return notifs.filter((n) => n.type === filter);
  }, [filter, notifs]);

  const markAsRead = (id) => {
    setNotifs((arr) =>
      arr.map((n) => (n.id === id ? { ...n, status: "read" } : n))
    );
  };

  const onOpenFlow = (notif) => {
    setCurrent(notif);
    setFlowStep(0);
    setAgreeSign(false);
    setDueChoice("return");
    setReturnDate(null);
    setExtendDays(1);
    setPayMethod("momo");
    setAcceptTerms(false);
    setFlowOpen(true);
    markAsRead(notif.id);
  };

  const onCloseFlow = () => setFlowOpen(false);
  const next = () => setFlowStep((s) => s + 1);
  const prev = () => setFlowStep((s) => s - 1);

  // ====== Approved flow handlers ======
  const onSignContract = () => {
    message.success("Đã ký hợp đồng điện tử.");
    next();
  };
  const onPay = () => {
    message.success(`Thanh toán qua ${payMethod.toUpperCase()} (demo).`);
    setFlowOpen(false);
    navigate("/orders");
  };

  // ====== Due flow handlers ======
  const onSubmitDueChoice = () => {
    if (dueChoice === "return") message.success("Đã ghi nhận lịch trả hàng.");
    else message.success(`Đã yêu cầu gia hạn thêm ${extendDays} ngày.`);
    next();
  };
  const onFinishDue = () => {
    message.success("Yêu cầu đã được ghi nhận. Cảm ơn bạn!");
    setFlowOpen(false);
  };

  const renderActions = (n) => {
    const arr = [];
    if (n.type === "approved") {
      arr.push(
        <Button
          key="pay"
          type="primary"
          icon={<CreditCardOutlined />}
          onClick={() => onOpenFlow(n)}
          style={{ background: "#000", borderColor: "#000" }}
        >
          Thanh toán
        </Button>
      );
      arr.push(
        <Button
          key="view"
          icon={<EyeOutlined />}
          onClick={() => window.open(n.order.contractUrl, "_blank")}
          style={{ color: "#000", borderColor: "#000" }}
        >
          Xem hợp đồng
        </Button>
      );
    }
    if (n.type === "due") {
      arr.push(
        <Button
          key="handle"
          type="primary"
          onClick={() => onOpenFlow(n)}
          style={{ background: "#000", borderColor: "#000" }}
        >
          Xử lý trả / gia hạn
        </Button>
      );
    }
    if (n.status === "unread") {
      arr.push(
    
      );
    }
    return arr;
  };

  const renderAvatar = (n) => {
    if (n.type === "approved")
      return (
        <Avatar
          size={44}
          style={{ background: "#e6fffb" }}
          icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
        />
      );
    if (n.type === "cancelled")
      return (
        <Avatar
          size={44}
          style={{ background: "#fff1f0" }}
          icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />}
        />
      );
    if (n.type === "due")
      return (
        <Avatar
          size={44}
          style={{ background: "#fffbe6" }}
          icon={<InfoCircleTwoTone twoToneColor="#faad14" />}
        />
      );
    return (
      <Avatar
        size={44}
        style={{ background: "#f0f5ff" }}
        icon={<InfoCircleTwoTone twoToneColor="#2f54eb" />}
      />
    );
  };

  const renderTitle = (n) => {
    const text =
      n.type === "approved"
        ? "Đơn đã được duyệt"
        : n.type === "cancelled"
        ? "Đơn đã bị hủy"
        : n.type === "due"
        ? "Tới hạn trả hàng"
        : "Thông báo";
    return (
      <Space>
        <Text strong>{text}</Text>
        {n.status === "unread" && <Badge color="red" text="Mới" />}
        <Tag>{n.createdAt}</Tag>
      </Space>
    );
  };

  const renderDesc = (n) => (
    <div>
      <Text>{n.message}</Text>
      {n.order?.id && (
        <div style={{ marginTop: 8 }}>
          <Tag color="blue">{n.order.id}</Tag>
          {typeof n.order.total === "number" && (
            <Text type="secondary">
              &nbsp;Tổng tiền:{" "}
              <strong>
                {n.order.total.toLocaleString("vi-VN", {
                  style: "currency",
                  currency: "VND",
                })}
              </strong>
            </Text>
          )}
          {n.type === "due" && n.order.dueAt && (
            <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
              Tới hạn:{" "}
              <strong>{dayjs(n.order.dueAt).format("DD/MM/YYYY HH:mm")}</strong>
            </Text>
          )}
        </div>
      )}
      {n.type === "cancelled" && n.reason && (
        <div style={{ marginTop: 6 }}>
          <Text type="danger">Lý do: {n.reason}</Text>
        </div>
      )}
    </div>
  );

  // ===== helpers for OTP UI =====
  const canSubmitOtp = otpValues.join("").length === DIGITS;
  const focusAt = (i) => inputsRef.current[i]?.focus();
  const onChangeOtp = (i, v) => {
    const c = v.replace(/\D/g, "").slice(-1);
    setOtpValues((prev) => {
      const cp = [...prev];
      cp[i] = c || "";
      return cp;
    });
    if (c && i < DIGITS - 1) focusAt(i + 1);
  };
  const onKeyOtp = (i, e) => {
    if (e.key === "Backspace" && !otpValues[i] && i > 0) focusAt(i - 1);
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    }
    if (e.key === "ArrowRight" && i < DIGITS - 1) {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  // ===== Modal nội dung theo loại thông báo =====
  const isApproved = current?.type === "approved";
  const isDue = current?.type === "due";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-3">
          <Title level={2} style={{ margin: 0 }}>
            Thông báo
          </Title>
         
        </div>

        <Card className="rounded-xl" bodyStyle={{ padding: 16 }}>
          <Tabs
            activeKey={filter}
            onChange={setFilter}
            items={tabs.map((t) => ({ key: t.key, label: t.label }))}
          />
          <List
            itemLayout="vertical"
            dataSource={filtered}
            renderItem={(n) => (
              <List.Item
                key={n.id}
                style={{ borderBottom: "1px solid #f0f0f0", padding: "16px 0" }}
                actions={renderActions(n)}
              >
                <List.Item.Meta
                  avatar={renderAvatar(n)}
                  title={renderTitle(n)}
                  description={renderDesc(n)}
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      {/* FLOW MODAL */}
      <Modal
        title={
          isApproved ? "Ký hợp đồng & Thanh toán" : "Tới hạn trả hàng / Gia hạn"
        }
        open={flowOpen}
        onCancel={onCloseFlow}
        width={820}
        footer={null}
        destroyOnClose
      >
        {!current ? (
          <Result status="info" title="Không có dữ liệu" />
        ) : isApproved ? (
          /* ===== FLOW APPROVED: Step0 ký HĐ → Step1 OTP → Step2 Thanh toán ===== */
          <>
            <Steps
              current={flowStep}
              items={[
                { title: "Ký hợp đồng", icon: <FileTextOutlined /> },
                { title: "OTP email" },
                { title: "Thanh toán" },
              ]}
              style={{ marginBottom: 16 }}
            />

            {flowStep === 0 && (
              <div>
                <Card
                  type="inner"
                  title="Hợp đồng thuê (bản xem trước)"
                  className="mb-3"
                >
                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px dashed #ddd",
                      height: 240,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: 16,
                    }}
                  >
                    <div>
                      <FileTextOutlined
                        style={{ fontSize: 34, opacity: 0.6 }}
                      />
                      <div style={{ marginTop: 8 }}>
                        Xem trước hợp đồng (PDF giả lập).
                        <br />
                        Bạn có thể bấm “Xem hợp đồng” ở ngoài để mở file gốc.
                      </div>
                    </div>
                  </div>

                  <Checkbox
                    checked={agreeSign}
                    onChange={(e) => setAgreeSign(e.target.checked)}
                  >
                    Tôi đã đọc và đồng ý với nội dung hợp đồng điện tử.
                  </Checkbox>
                </Card>

                <Space>
                  <Button
                    type="primary"
                    disabled={!agreeSign}
                    onClick={onSignContract}
                    style={{ background: "#000", borderColor: "#000" }}
                  >
                    Ký hợp đồng
                  </Button>
                </Space>
              </div>
            )}

            {flowStep === 1 && (
              <div>
                <Card type="inner" title="Xác minh email">
                  <Text type="secondary">
                    Nhập mã 6 số đã gửi tới email của bạn.
                  </Text>

                  {/* OTP boxes – fixed width & columns */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 420, // giới hạn bề ngang
                      display: "grid",
                      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    {otpValues.map((v, i) => (
                      <input
                        key={i}
                        ref={(el) => (inputsRef.current[i] = el)}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={v}
                        maxLength={1}
                        onChange={(e) => onChangeOtp(i, e.target.value)}
                        onKeyDown={(e) => onKeyOtp(i, e)}
                        style={{
                          width: "100%", // <— ép full cột
                          minWidth: 0, // <— cho phép co nhỏ
                          height: 44,
                          borderRadius: 8,
                          border: "1px solid #E5E7EB",
                          background: "#fff",
                          textAlign: "center",
                          fontSize: 18,
                          color: "#111827",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "#111827")
                        }
                        onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                      />
                    ))}
                  </div>

                  <div
                    style={{ marginTop: 10, fontSize: 12, color: "#6B7280" }}
                  >
                    Gửi lại mã sau:{" "}
                    <strong style={{ color: "#111827" }}>
                      00:{String(seconds).padStart(2, "0")}
                    </strong>
                    {seconds === 0 ? (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => setSeconds(RESEND_SECONDS)}
                        style={{ paddingLeft: 6 }}
                      >
                        Gửi lại mã
                      </Button>
                    ) : (
                      <span style={{ opacity: 0.6, paddingLeft: 6 }}>
                        Gửi lại mã
                      </span>
                    )}
                  </div>

                  <Space style={{ marginTop: 12 }}>
                    <Button
                      onClick={prev}
                      style={{ color: "#000", borderColor: "#000" }}
                    >
                      Quay lại
                    </Button>
                    <Button
                      type="primary"
                      disabled={otpValues.join("").length !== 6}
                      onClick={next}
                      style={{ background: "#000", borderColor: "#000" }}
                    >
                      Xác minh
                    </Button>
                  </Space>
                </Card>
              </div>
            )}

            {flowStep === 2 && (
              <div>
                {/* Order summary + phương thức thanh toán */}
                <Card type="inner" title="Order Summary" className="mb-3">
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Mã đơn">
                      {current.order.id}
                    </Descriptions.Item>
                    <Descriptions.Item label="Thiết bị">
                      <Space>
                        <Avatar
                          shape="square"
                          size={54}
                          src={current.order.items?.[0]?.image}
                        />
                        <div>
                          <Text strong>{current.order.items?.[0]?.name}</Text>
                          <div>
                            Số lượng: {current.order.items?.[0]?.qty} •{" "}
                            {current.order.days} ngày
                          </div>
                        </div>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổng phải trả">
                      <Text strong>
                        {current.order.total.toLocaleString("vi-VN", {
                          style: "currency",
                          currency: "VND",
                        })}
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card type="inner" title="Phương thức thanh toán">
                  <Radio.Group
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <Space direction="vertical">
                      <Radio value="momo">MoMo</Radio>
                      <Radio value="payos">PayOS</Radio>
                    </Space>
                  </Radio.Group>

                  <div style={{ marginTop: 12 }}>
                    <Checkbox
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                    >
                      Bằng việc thanh toán, bạn chấp nhận các điều khoản thuê.
                    </Checkbox>
                  </div>

                  <Space style={{ marginTop: 12 }}>
                    <Button
                      onClick={prev}
                      style={{ color: "#000", borderColor: "#000" }}
                    >
                      Quay lại
                    </Button>
                    <Button
                      type="primary"
                      icon={<CreditCardOutlined />}
                      disabled={!acceptTerms}
                      onClick={onPay}
                      style={{ background: "#000", borderColor: "#000" }}
                    >
                      Pay now
                    </Button>
                  </Space>
                </Card>
              </div>
            )}
          </>
        ) : (
          /* ===== FLOW DUE: trả / gia hạn ===== */
          <>
            <Steps
              current={flowStep}
              items={[
                { title: "Chọn phương án" },
                { title: "Xác nhận" },
                { title: "Hoàn tất" },
              ]}
              style={{ marginBottom: 16 }}
            />

            {flowStep === 0 && (
              <div>
                <Card type="inner" title="Bạn muốn thực hiện gì?">
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    <Radio.Group
                      value={dueChoice}
                      onChange={(e) => setDueChoice(e.target.value)}
                    >
                      <Space direction="vertical">
                        <Radio value="return">Trả hàng</Radio>
                        <Radio value="extend">Gia hạn thêm ngày</Radio>
                      </Space>
                    </Radio.Group>

                    {dueChoice === "return" ? (
                      <Space direction="vertical" size={6}>
                        <Text type="secondary">Chọn ngày & giờ trả:</Text>
                        <DatePicker
                          style={{ width: 280 }}
                          showTime={{ format: "HH:mm", minuteStep: 5 }}
                          format="DD/MM/YYYY HH:mm"
                          value={returnDate}
                          onChange={(v) => setReturnDate(v)}
                          disabledDate={(current) =>
                            current && current < dayjs().startOf("day")
                          }
                        />
                      </Space>
                    ) : (
                      <Space direction="vertical" size={6}>
                        <Text type="secondary">Số ngày muốn gia hạn:</Text>
                        <InputNumber
                          min={1}
                          value={extendDays}
                          onChange={(v) => setExtendDays(v || 1)}
                        />
                      </Space>
                    )}
                  </Space>
                </Card>

                <Space style={{ marginTop: 12 }}>
                  <Button
                    onClick={() => setFlowOpen(false)}
                    style={{ color: "#000", borderColor: "#000" }}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="primary"
                    onClick={onSubmitDueChoice}
                    style={{ background: "#000", borderColor: "#000" }}
                  >
                    Tiếp tục
                  </Button>
                </Space>
              </div>
            )}

            {flowStep === 1 && (
              <div>
                <Card type="inner" title="Xác nhận yêu cầu">
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Mã đơn">
                      {current.order.id}
                    </Descriptions.Item>
                    {dueChoice === "return" ? (
                      <Descriptions.Item label="Trả hàng vào">
                        {returnDate
                          ? returnDate.format("DD/MM/YYYY HH:mm")
                          : "Chưa chọn"}
                      </Descriptions.Item>
                    ) : (
                      <Descriptions.Item label="Gia hạn thêm">
                        {extendDays} ngày
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>

                <Space style={{ marginTop: 12 }}>
                  <Button
                    onClick={() => setFlowStep(0)}
                    style={{ color: "#000", borderColor: "#000" }}
                  >
                    Quay lại
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => setFlowStep(2)}
                    style={{ background: "#000", borderColor: "#000" }}
                  >
                    Xác nhận
                  </Button>
                </Space>
              </div>
            )}

            {flowStep === 2 && (
              <Result
                status="success"
                title={
                  dueChoice === "return"
                    ? "Đã đặt lịch trả hàng"
                    : "Đã gửi yêu cầu gia hạn"
                }
                subTitle={
                  dueChoice === "return"
                    ? "Cảm ơn bạn! Chúng tôi sẽ liên hệ để xác nhận lịch trả."
                    : "Chúng tôi sẽ cập nhật hợp đồng và thông báo sớm nhất."
                }
                extra={
                  <Button
                    type="primary"
                    onClick={() => setFlowOpen(false)}
                    style={{ background: "#000", borderColor: "#000" }}
                  >
                    Đóng
                  </Button>
                }
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
