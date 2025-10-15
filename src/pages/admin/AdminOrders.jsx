// src/pages/admin/AdminOrders.jsx
import React, { useState } from "react";
import { Table, Tag, Space, Button, Input, DatePicker, message, Typography } from "antd";
import { EyeOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";


const { RangePicker } = DatePicker;
const { Title } = Typography;

const INIT = [
  { id: "TR-241001-023", createdAt: "2025-10-01 18:45", days: 1, total: 800000, status: "pending", payment: "paid" },
  { id: "TR-240927-004", createdAt: "2025-09-27 16:00", days: 2, total: 1600000, status: "cancelled", payment: "refunded" },
  { id: "TR-240920-017", createdAt: "2025-09-20 21:10", days: 7, total: 4900000, status: "awaiting", payment: "unpaid" },
  { id: "TR-240918-001", createdAt: "2025-09-18 17:25", days: 3, total: 3000000, status: "confirmed", payment: "paid" },
];

const statusTag = (s) => {
  switch (s) {
    case "pending": return <Tag color="gold">Đang chờ</Tag>;
    case "awaiting": return <Tag color="orange">Chờ xác nhận</Tag>;
    case "confirmed": return <Tag color="green">Đã xác nhận</Tag>;
    case "cancelled": return <Tag color="red">Đã hủy</Tag>;
    default: return <Tag>{s}</Tag>;
  }
};
const payTag = (s) => {
  switch (s) {
    case "paid": return <Tag color="green">Đã thanh toán</Tag>;
    case "unpaid": return <Tag color="gold">Chưa thanh toán</Tag>;
    case "refunded": return <Tag>Đã hoàn tiền</Tag>;
    default: return <Tag>{s}</Tag>;
  }
};

export default function AdminOrders() {
  const [data, setData] = useState(INIT);
  const [kw, setKw] = useState("");

  const approve = (r) => {
    setData((prev) => prev.map((x) => x.id === r.id ? { ...x, status: "confirmed" } : x));
    message.success(`Đã xác nhận đơn ${r.id}`);
  };
  const reject = (r) => {
    setData((prev) => prev.map((x) => x.id === r.id ? { ...x, status: "cancelled" } : x));
    message.success(`Đã hủy đơn ${r.id}`);
  };

  const columns = [
    { title: "Mã đơn", dataIndex: "id", width: 170 },
    { title: "Ngày tạo", dataIndex: "createdAt", width: 170 },
    { title: "Số ngày", dataIndex: "days", width: 90 },
    { title: "Tổng tiền", dataIndex: "total", width: 130, render: v => v.toLocaleString("vi-VN") + " đ" },
    { title: "Trạng thái đơn", dataIndex: "status", width: 140, render: statusTag },
    { title: "Thanh toán", dataIndex: "payment", width: 140, render: payTag },
    {
      title: "Thao tác", fixed: "right", width: 220,
      render: (_, r) => (
        <Space>
          <Button icon={<EyeOutlined />}>Xem</Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => approve(r)}>Duyệt</Button>
          <Button danger icon={<CloseOutlined />} onClick={() => reject(r)}>Hủy</Button>
        </Space>
      ),
    },
  ];

  const filtered = data.filter(d => d.id.toLowerCase().includes(kw.toLowerCase()));

  return (
    <>
      <Title level={3}>Quản lý đơn hàng</Title>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="Tìm mã đơn…" onSearch={setKw} allowClear style={{ width: 280 }} />
        <RangePicker onChange={() => {}} />
      </Space>
      <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 8 }} scroll={{ x: 1000 }} />
    </>
  );
}
