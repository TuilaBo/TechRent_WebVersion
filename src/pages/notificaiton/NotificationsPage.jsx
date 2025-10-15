import React, { useMemo, useState } from "react";
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

const { Title, Text } = Typography;

// ---- MOCK NOTIFICATIONS ----
/**
 * type:
 *  - approved: đơn đã duyệt, cho phép thanh toán
 *  - cancelled: đơn bị hủy
 *  - general: thông báo chung
 * status: unread | read
 */
const MOCK_NOTIFS = [
  {
    id: "NTF-001",
    type: "approved",
    status: "unread",
    createdAt: "2025-10-14 14:15",
    order: {
      id: "TR-241001-023",
      items: [{ name: "DJI Mini 4 Pro", qty: 1, image: "https://images.unsplash.com/photo-1580795478960-2a1c8bafcd2a?q=80&w=600&auto=format&fit=crop" }],
      days: 1,
      total: 800000,
      contractUrl: "https://example.com/contracts/TR-241001-023.pdf",
    },
    message: "Đơn TR-241001-023 đã được duyệt. Vui lòng ký hợp đồng và thanh toán.",
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
    message: "Khuyến mãi tuần này: Giảm 100K với mã GIAM100K khi đặt thuê từ 2 ngày.",
  },
];

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFS);
  const [filter, setFilter] = useState("all");
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const [agreeSign, setAgreeSign] = useState(false);
  const [current, setCurrent] = useState(null);

  const navigate = useNavigate();

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
    setFlowOpen(true);
    // Đánh dấu đã đọc luôn khi mở flow
    markAsRead(notif.id);
  };

  const onCloseFlow = () => {
    setFlowOpen(false);
  };

  const next = () => setFlowStep((s) => s + 1);
  const prev = () => setFlowStep((s) => s - 1);

  const onSignContract = () => {
    // Không kiểm tra validate theo yêu cầu trước đó
    message.success("Đã ký hợp đồng điện tử.");
    next();
  };

  const onPay = () => {
    message.success("Thanh toán thành công (demo).");
    setFlowOpen(false);
    navigate("/orders");
  };

  const tabs = [
    { key: "all", label: "Tất cả" },
    { key: "approved", label: "Đơn đã duyệt" },
    { key: "cancelled", label: "Đơn bị hủy" },
    { key: "general", label: "Khác" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-3">
          <Title level={2} style={{ margin: 0 }}>
            Thông báo
          </Title>
          <Space>
            <Button
              onClick={() =>
                setNotifs((arr) => arr.map((n) => ({ ...n, status: "read" })))
              }
            >
              Đánh dấu tất cả đã đọc
            </Button>
          </Space>
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
                style={{
                  borderBottom: "1px solid #f0f0f0",
                  padding: "16px 0",
                }}
                actions={[
                  n.type === "approved" && (
                    <Button
                      key="pay"
                      type="primary"
                      icon={<CreditCardOutlined />}
                      onClick={() => onOpenFlow(n)}
                    >
                      Thanh toán
                    </Button>
                  ),
                  n.type === "approved" && (
                    <Button
                      key="view"
                      icon={<EyeOutlined />}
                      onClick={() => window.open(n.order.contractUrl, "_blank")}
                    >
                      Xem hợp đồng
                    </Button>
                  ),
                  n.status === "unread" && (
                    <Button
                      key="mark"
                      onClick={() => markAsRead(n.id)}
                      type="link"
                    >
                      Đánh dấu đã đọc
                    </Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    n.type === "approved" ? (
                      <Avatar
                        size={44}
                        style={{ background: "#e6fffb" }}
                        icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
                      />
                    ) : n.type === "cancelled" ? (
                      <Avatar
                        size={44}
                        style={{ background: "#fff1f0" }}
                        icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />}
                      />
                    ) : (
                      <Avatar
                        size={44}
                        style={{ background: "#f0f5ff" }}
                        icon={<InfoCircleTwoTone twoToneColor="#2f54eb" />}
                      />
                    )
                  }
                  title={
                    <Space>
                      <Text strong>
                        {n.type === "approved"
                          ? "Đơn đã được duyệt"
                          : n.type === "cancelled"
                          ? "Đơn đã bị hủy"
                          : "Thông báo"}
                      </Text>
                      {n.status === "unread" && (
                        <Badge color="red" text="Mới" />
                      )}
                      <Tag>{n.createdAt}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <Text>{n.message}</Text>
                      {n.type === "approved" && (
                        <div style={{ marginTop: 8 }}>
                          <Tag color="blue">{n.order.id}</Tag>
                          <Text type="secondary">
                            &nbsp;Tổng tiền:{" "}
                            <strong>
                              {n.order.total.toLocaleString("vi-VN", {
                                style: "currency",
                                currency: "VND",
                              })}
                            </strong>
                          </Text>
                        </div>
                      )}
                      {n.type === "cancelled" && n.reason && (
                        <div style={{ marginTop: 6 }}>
                          <Text type="danger">Lý do: {n.reason}</Text>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      {/* FLOW MODAL: Ký hợp đồng → Xem lại đơn → Thanh toán */}
      <Modal
        title="Ký hợp đồng & Thanh toán"
        open={flowOpen}
        onCancel={onCloseFlow}
        width={800}
        footer={null}
        destroyOnClose
      >
        {!current ? (
          <Result status="info" title="Không có dữ liệu đơn hàng" />
        ) : (
          <>
            <Steps
              current={flowStep}
              items={[
                { title: "Ký hợp đồng", icon: <FileTextOutlined /> },
                { title: "Xem lại đơn" },
                { title: "Thanh toán" },
              ]}
              style={{ marginBottom: 16 }}
            />

            {/* STEP 0: KÝ HỢP ĐỒNG */}
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
                      <FileTextOutlined style={{ fontSize: 34, opacity: 0.6 }} />
                      <div style={{ marginTop: 8 }}>
                        Xem trước hợp đồng (PDF giả lập).<br />
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
                  >
                    Ký hợp đồng
                  </Button>
                </Space>
              </div>
            )}

            {/* STEP 1: XEM LẠI ĐƠN */}
            {flowStep === 1 && (
              <div>
                <Card type="inner" title="Thông tin đơn hàng">
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
                    <Descriptions.Item label="Tổng tiền">
                      <Text strong>
                        {current.order.total.toLocaleString("vi-VN", {
                          style: "currency",
                          currency: "VND",
                        })}
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Space style={{ marginTop: 12 }}>
                  <Button onClick={prev}>Quay lại</Button>
                  <Button type="primary" onClick={next}>
                    Tiếp tục thanh toán
                  </Button>
                </Space>
              </div>
            )}

            {/* STEP 2: THANH TOÁN */}
            {flowStep === 2 && (
              <div>
                <Result
                  status="success"
                  title="Sẵn sàng thanh toán"
                  subTitle={`Đơn ${current.order.id} đã ký hợp đồng thành công.`}
                  extra={
                    <Space>
                      <Button onClick={prev}>Quay lại</Button>
                      <Button type="primary" icon={<CreditCardOutlined />} onClick={onPay}>
                        Thanh toán ngay
                      </Button>
                    </Space>
                  }
                />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
