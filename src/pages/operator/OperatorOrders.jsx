// src/pages/operator/OperatorOrders.jsx
import React, { useMemo, useState } from "react";
import {
  Table,
  Tag,
  Button,
  Space,
  Drawer,
  Typography,
  Modal,
  Tooltip,
  Input,
  message,
} from "antd";
import {
  EyeOutlined,
  CheckOutlined,
  StopOutlined,
  FileTextOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

/** Mock data – thay bằng API thật khi tích hợp */
const MOCK = [
  {
    id: "TR-241001-023",
    customer: "Nguyễn Văn A",
    phone: "09xx xxx 111",
    device: 'PS5 + TV 55" 4K',
    days: 1,
    total: 800000,
    status: "pending",
    createdAt: "2025-10-01 11:45",
    docs: [
      {
        type: "biên bản bàn giao",
        url: "https://picsum.photos/seed/bb1/800/500",
      },
      { type: "hợp đồng", url: "https://picsum.photos/seed/hd1/800/500" },
    ],
  },
  {
    id: "TR-240927-004",
    customer: "Lê Minh",
    phone: "09xx xxx 222",
    device: 'MacBook Pro M3 14"',
    days: 2,
    total: 1600000,
    status: "approved",
    createdAt: "2025-09-27 16:00",
    docs: [
      {
        type: "biên bản bàn giao",
        url: "https://picsum.photos/seed/bb2/800/500",
      },
      { type: "hợp đồng", url: "https://picsum.photos/seed/hd2/800/500" },
    ],
  },
  {
    id: "TR-240920-017",
    customer: "Phạm Lan",
    phone: "09xx xxx 333",
    device: "Sony A7 IV",
    days: 7,
    total: 4900000,
    status: "pending",
    createdAt: "2025-09-20 21:10",
    docs: [{ type: "biên bản bàn giao", url: "https://picsum.photos/seed/bb3/800/500" }],
  },
];

export default function OperatorOrders() {
  const navigate = useNavigate();

  const [data, setData] = useState(MOCK);
  const [filter, setFilter] = useState("");

  // Drawer xem chứng từ
  const [docsOpen, setDocsOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [docUrl, setDocUrl] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return data;
    return data.filter((d) =>
      [d.id, d.customer, d.device].some((x) =>
        (x || "").toLowerCase().includes(q)
      )
    );
  }, [data, filter]);

  const approve = (r) => {
    Modal.confirm({
      title: `Duyệt đơn ${r.id}?`,
      onOk: () => {
        setData((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, status: "approved" } : x))
        );
        message.success("Đã duyệt đơn.");
      },
    });
  };

  const cancel = (r) => {
    Modal.confirm({
      title: `Huỷ đơn ${r.id}?`,
      okButtonProps: { danger: true },
      onOk: () => {
        setData((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, status: "canceled" } : x))
        );
        message.success("Đã huỷ đơn.");
      },
    });
  };

  const gotoDetail = (record) => {
    // Điều hướng sang page chi tiết; đính kèm record để page có thể dùng ngay
    navigate(`/operator/ordersdetail`, { state: record });
  };

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      key: "id",
      render: (v, r) => (
        <Button type="link" onClick={() => gotoDetail(r)}>
          {v}
        </Button>
      ),
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    { title: "Khách hàng", dataIndex: "customer", key: "customer" },
    { title: "Thiết bị", dataIndex: "device", key: "device" },
    { title: "Số ngày", dataIndex: "days", key: "days", align: "center" },
    {
      title: "Tổng tiền",
      dataIndex: "total",
      key: "total",
      align: "right",
      render: (v) =>
        v.toLocaleString("vi-VN", { style: "currency", currency: "VND" }),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Chờ duyệt", value: "pending" },
        { text: "Đã duyệt", value: "approved" },
        { text: "Đã huỷ", value: "canceled" },
      ],
      onFilter: (val, rec) => rec.status === val,
      render: (s) =>
        s === "approved" ? (
          <Tag color="green">Đã duyệt</Tag>
        ) : s === "canceled" ? (
          <Tag color="volcano">Đã huỷ</Tag>
        ) : (
          <Tag color="blue">Chờ duyệt</Tag>
        ),
    },
    { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt" },
    {
      title: "Thao tác",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button icon={<EyeOutlined />} onClick={() => gotoDetail(r)} />
          </Tooltip>

          <Tooltip title="Xem chứng từ">
            <Button
              icon={<FileTextOutlined />}
              onClick={() => {
                setCurrentRecord(r);
                setDocsOpen(true);
                setDocUrl(r.docs?.[0]?.url || "");
              }}
            />
          </Tooltip>

          <Tooltip title="Duyệt đơn">
            <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled={r.status !== "pending"}
              onClick={() => approve(r)}
            />
          </Tooltip>

          <Tooltip title="Huỷ đơn">
            <Button
              danger
              icon={<StopOutlined />}
              disabled={r.status === "canceled"}
              onClick={() => cancel(r)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Title level={3} style={{ marginBottom: 12 }}>
        Quản lý đơn hàng
      </Title>

      <div style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          placeholder="Tìm mã đơn, khách hàng, thiết bị…"
          onSearch={setFilter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 420 }}
        />
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 6 }}
      />

      {/* Drawer: xem chứng từ (biên bản giao hàng / hợp đồng) */}
      <Drawer
        title={`Chứng từ đơn ${currentRecord?.id || ""}`}
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        width={820}
        extra={
          <Space>
            {currentRecord?.docs?.map((d, i) => (
              <Button
                key={i}
                icon={<FilePdfOutlined />}
                onClick={() => setDocUrl(d.url)}
              >
                {d.type}
              </Button>
            ))}
          </Space>
        }
      >
        {!docUrl ? (
          <Text type="secondary">Chưa có tệp đính kèm.</Text>
        ) : (
          // preview ảnh; nếu file PDF thực sự có thể đổi sang iframe/React-PDF
          <img
            src={docUrl}
            alt="evidence"
            style={{ width: "100%", borderRadius: 8 }}
          />
        )}
      </Drawer>
    </>
  );
}
