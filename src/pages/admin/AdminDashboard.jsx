// src/pages/admin/AdminDashboard.jsx
import React, { useMemo, useState } from "react";
import {
  Typography, Card, Row, Col, Space, Statistic, Tag, Table, Divider, List, Avatar, Progress, Segmented, Button
} from "antd";
import {
  ArrowUpOutlined, DollarCircleOutlined, ShoppingOutlined, SecurityScanOutlined, DatabaseOutlined
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

// MOCK (giữ nguyên như bạn)
const RECENT_ORDERS = [
  { id: "TR-241001-023", customer: "Nguyễn Văn A", total: 800000, days: 1, status: "paid", createdAt: "2025-10-01 11:45" },
  { id: "TR-240927-004", customer: "Lê Minh", total: 1600000, days: 2, status: "refunded", createdAt: "2025-09-27 16:00" },
  { id: "TR-240920-017", customer: "Phạm Lan", total: 4900000, days: 7, status: "unpaid", createdAt: "2025-09-20 21:10" },
  { id: "TR-240918-001", customer: "Trần Bảo", total: 3000000, days: 3, status: "paid", createdAt: "2025-09-18 17:25" },
];
const BEST_RENTED = [
  { name: "Playstation 5 + TV 55” 4K", count: 42 },
  { name: "Meta Quest 3", count: 35 },
  { name: "Sony A7 IV", count: 29 },
  { name: "DJI Mini 4 Pro", count: 22 },
];
const ACTIVITIES = [
  { text: "KYC duyệt: Trần Bảo", time: "5 phút trước" },
  { text: "Hoàn tiền đơn TR-240927-004", time: "20 phút trước" },
  { text: "Thêm sản phẩm: Apple Vision Pro", time: "1 giờ trước" },
  { text: "Cập nhật giá Meta Quest 3", time: "3 giờ trước" },
];

function formatVND(n) {
  return n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

export default function AdminDashboard() {
  const [orderFilter, setOrderFilter] = useState("all");
  const orders = useMemo(() => {
    if (orderFilter === "all") return RECENT_ORDERS;
    return RECENT_ORDERS.filter((o) => o.status === orderFilter);
  }, [orderFilter]);

  const columns = [
    { title: "Mã đơn", dataIndex: "id", render: (v) => <Link to={`/orders/${v}`}>{v}</Link>, sorter: (a, b) => a.id.localeCompare(b.id) },
    { title: "Khách", dataIndex: "customer" },
    { title: "Tổng tiền", dataIndex: "total", align: "right", render: (v) => formatVND(v), sorter: (a, b) => a.total - b.total },
    { title: "Số ngày", dataIndex: "days", align: "center" },
    {
      title: "Trạng thái", dataIndex: "status",
      filters: [{ text: "Đã thanh toán", value: "paid" }, { text: "Chưa thanh toán", value: "unpaid" }, { text: "Đã hoàn tiền", value: "refunded" }],
      onFilter: (v, r) => r.status === v,
      render: (s) => s === "paid" ? <Tag color="green">Đã thanh toán</Tag> : s === "unpaid" ? <Tag color="volcano">Chưa thanh toán</Tag> : <Tag color="geekblue">Đã hoàn tiền</Tag>,
    },
    { title: "Ngày tạo", dataIndex: "createdAt" },
  ];

  return (
    <>
      {/* KPI cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Space>
              <DollarCircleOutlined style={{ fontSize: 24, color: "#52c41a" }} />
              <Statistic
                title="Doanh thu hôm nay"
                value={12500000}
                valueRender={() => <Text strong>{formatVND(12500000)}</Text>}
                prefix={<ArrowUpOutlined style={{ color: "#52c41a" }} />}
                suffix={<Text type="secondary">+12%</Text>}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Space>
              <ShoppingOutlined style={{ fontSize: 24, color: "#1677ff" }} />
              <Statistic title="Đơn mới" value={28} suffix={<Text type="secondary">/ ngày</Text>} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Space>
              <SecurityScanOutlined style={{ fontSize: 24, color: "#faad14" }} />
              <Statistic title="Tỷ lệ KYC đậu" value={92} suffix="%" />
            </Space>
            <Progress percent={92} size="small" className="mt-2" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Space>
              <DatabaseOutlined style={{ fontSize: 24, color: "#eb2f96" }} />
              <Statistic title="Tồn kho thấp" value={7} />
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>7 sản phẩm dưới 5 đơn vị</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                Đơn hàng gần đây
                <Segmented
                  options={[
                    { label: "Tất cả", value: "all" },
                    { label: "Đã TT", value: "paid" },
                    { label: "Chưa TT", value: "unpaid" },
                    { label: "Hoàn tiền", value: "refunded" },
                  ]}
                  value={orderFilter}
                  onChange={setOrderFilter}
                />
              </Space>
            }
            extra={<Button type="link"><Link to="/myoder">Xem tất cả</Link></Button>}
          >
            <Table rowKey="id" columns={columns} dataSource={orders} size="middle" pagination={{ pageSize: 5 }} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Sản phẩm thuê nhiều">
            <List
              dataSource={BEST_RENTED}
              renderItem={(it, idx) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar style={{ background: "#1677ff" }}>{idx + 1}</Avatar>}
                    title={<Text strong>{it.name}</Text>}
                    description={<Text type="secondary">{it.count} lượt thuê</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Divider />

          <Card title="Hoạt động gần đây">
            <List
              dataSource={ACTIVITIES}
              renderItem={(a) => (
                <List.Item>
                  <List.Item.Meta title={a.text} description={<Text type="secondary">{a.time}</Text>} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
