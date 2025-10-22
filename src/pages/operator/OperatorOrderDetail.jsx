// src/pages/operator/OperatorOrderDetail.jsx
import React, { useMemo } from "react";
import {
  Card,
  Typography,
  Tag,
  Descriptions,
  Table,
  Button,
  Space,
  message,
} from "antd";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { EyeOutlined, DownloadOutlined, ArrowLeftOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const MOCK = {
  "TR-241001-023": {
    id: "TR-241001-023",
    status: "pending",
    customer: {
      name: "Trần Khánh Vinh",
      email: "vinh***@gmail.com",
      phone: "0123456789",
      kyc: true,
    },
    rental: { start: "2025-03-15", end: "2025-03-22", days: 7 },
    createdAt: "2025-03-10 14:30",
    items: [
      {
        model: "Canon EOS R5",
        qty: 2,
        pricePerDay: 85,
        deposit: 500,
        subtotal: 1190,
      },
      {
        model: "Sony FX3 Cinema Camera",
        qty: 1,
        pricePerDay: 120,
        deposit: 800,
        subtotal: 840,
      },
    ],
    subtotal: 2030,
    depositTotal: 1300,
    contractUrl: "https://example.com/contract/TR-241001-023.pdf",
  },
};

const fmtUSD = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function OperatorOrderDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  // Ưu tiên dữ liệu đầy đủ từ MOCK; nếu có state thì chỉ ghi đè một vài field đơn giản
  const order = useMemo(() => {
    const base = MOCK[id];
    if (base && state) {
      return {
        ...base,
        id: state.id ?? base.id,
        status: state.status ?? base.status,
        createdAt: state.createdAt ?? base.createdAt,
        // Giữ nguyên các trường phức tạp từ base: customer, rental, items, subtotal, depositTotal, contractUrl
      };
    }
    return base || state || null;
  }, [id, state]);

  if (!order) {
    return (
      <div className="p-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 12 }}
        >
          Back
        </Button>
        <Card>
          <Text>Không tìm thấy đơn hàng.</Text>
        </Card>
      </div>
    );
  }

  const columns = [
    { title: "Model Name", dataIndex: "model" },
    { title: "Quantity", dataIndex: "qty", align: "center" },
    { title: "Price / Day", dataIndex: "pricePerDay", align: "right", render: (v) => fmtUSD(v) },
    { title: "Deposit / Unit", dataIndex: "deposit", align: "right", render: (v) => fmtUSD(v) },
    { title: "Subtotal", dataIndex: "subtotal", align: "right", render: (v) => fmtUSD(v) },
  ];

  const total = (order.subtotal || 0) + (order.depositTotal || 0);

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <Space align="center" size={12} style={{ marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
          <Title level={4} style={{ margin: 0 }}>
            Order {order.id} — Details
          </Title>
          <Tag
            color={
              order.status === "pending"
                ? "blue"
                : order.status === "approved"
                ? "green"
                : "volcano"
            }
          >
            {order.status === "pending"
              ? "Pending"
              : order.status === "approved"
              ? "Approved"
              : "Canceled"}
          </Tag>
        </Space>

        {/* Top 3 info cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <Title level={5} style={{ marginTop: 0 }}>
              Customer
            </Title>
            <Text strong>{order.customer?.name}</Text>
            <div>{order.customer?.email}</div>
            <div>{order.customer?.phone}</div>
            <div style={{ marginTop: 6 }}>
              {order.customer?.kyc ? (
                <Tag color="green">KYC Verified</Tag>
              ) : (
                <Tag color="red">KYC Unverified</Tag>
              )}
            </div>
          </Card>

          <Card>
            <Title level={5} style={{ marginTop: 0 }}>
              Rental Period
            </Title>
            <Descriptions column={1} colon={false} size="small">
              <Descriptions.Item label="Start">
                {order.rental?.start || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="End">
                {order.rental?.end || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {order.rental?.days != null ? `${order.rental.days} days` : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card>
            <Title level={5} style={{ marginTop: 0 }}>
              Order Information
            </Title>
            <Descriptions column={1} colon={false} size="small">
              <Descriptions.Item label="Order ID">
                {order.id}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {order.createdAt}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>

        {/* Items + Summary */}
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <Card className="md:col-span-2">
            <Title level={5} style={{ marginTop: 0 }}>
              Items
            </Title>
            <Table
              rowKey={(r, i) => i}
              columns={columns}
              dataSource={order.items || []}
              pagination={false}
              size="small"
            />
            <div style={{ textAlign: "right", marginTop: 8, color: "#6B7280" }}>
              <div>
                Subtotal:{" "}
                <Text strong style={{ color: "#111827" }}>
                  {fmtUSD(order.subtotal || 0)}
                </Text>
              </div>
              <div>
                Total Deposit:{" "}
                <Text strong style={{ color: "#111827" }}>
                  {fmtUSD(order.depositTotal || 0)}
                </Text>
              </div>
            </div>

            {/* Actions */}
            <Space style={{ marginTop: 12 }}>
              <Button onClick={() => message.info("Rejected (demo).")}>
                Reject
              </Button>
              <Button
                type="primary"
                style={{ background: "#111827", borderColor: "#111827" }}
                onClick={() => message.success("Approved (demo).")}
              >
                Approve
              </Button>
            </Space>
          </Card>

          {/* Payment Summary */}
          <Card>
            <Title level={5} style={{ marginTop: 0 }}>
              Payment Summary
            </Title>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Subtotal">
                {fmtUSD(order.subtotal || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Deposit">
                {fmtUSD(order.depositTotal || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong>{fmtUSD(total)}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                background: "#F3F4F6",
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: 10,
              }}
            >
              Payment required before rental start date
            </div>
          </Card>
        </div>

        {/* Contract block */}
        <Card className="mt-4">
          <Title level={5} style={{ marginTop: 0 }}>
            Contract
          </Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            Rental agreement and terms for this order. Review all conditions
            before proceeding.
          </Text>
          <Space>
            <Button
              icon={<EyeOutlined />}
              onClick={() => window.open(order.contractUrl, "_blank")}
            >
              View contract
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => message.success("Downloading (demo)...")}
            >
              Download
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
}
