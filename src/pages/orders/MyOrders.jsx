// src/pages/orders/MyOrders.jsx
import React, { useMemo, useState } from "react";
import {
  Table, Tag, Typography, Input, DatePicker, Space, Button,
  Dropdown, Menu, Tooltip, message, Drawer, List, Descriptions, Avatar, Empty, Divider
} from "antd";
import {
  SearchOutlined, FilterOutlined, EyeOutlined,
  CreditCardOutlined, StopOutlined, ReloadOutlined
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ---- Mock data (thay bằng API thật) ----
const MOCK = [
  {
    id: "TR-241001-023",
    createdAt: "2025-10-01T11:45:00Z",
    items: [
      {
        name: "iPhone 15 Pro",
        qty: 1,
        image:
          "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop",
      },
    ],
    days: 1,
    total: 800000,
    orderStatus: "active",
    paymentStatus: "paid",
    contractUrl: "https://example.com/contracts/TR-241001-023.pdf",
  },
  {
    id: "TR-240927-004",
    createdAt: "2025-09-27T09:00:00Z",
    items: [
      {
        name: "iPhone 14 Pro Max",
        qty: 1,
        image:
          "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?q=80&w=600&auto=format&fit=crop",
      },
    ],
    days: 2,
    total: 1600000,
    orderStatus: "cancelled",
    paymentStatus: "refunded",
    cancelReason: "Khách yêu cầu hủy do thay đổi lịch.",
    contractUrl: "https://example.com/contracts/TR-240927-004.pdf",
  },
  {
    id: "TR-240920-017",
    createdAt: "2025-09-20T14:10:00Z",
    items: [
      {
        name: "iPhone 13",
        qty: 1,
        image:
          "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?q=80&w=600&auto=format&fit=crop",
      },
    ],
    days: 7,
    total: 4900000,
    orderStatus: "pending",
    paymentStatus: "unpaid",
    contractUrl: "https://example.com/contracts/TR-240920-017.pdf",
  },
  {
    id: "TR-240918-001",
    createdAt: "2025-09-18T10:25:00Z",
    items: [
      {
        name: "iPhone 12 + Phụ kiện",
        qty: 1,
        image:
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&auto=format&fit=crop",
      },
      {
        name: "Ốp lưng MagSafe",
        qty: 1,
        image:
          "https://images.unsplash.com/photo-1503602642458-232111445657?q=80&w=600&auto=format&fit=crop",
      },
    ],
    days: 3,
    total: 3000000,
    orderStatus: "confirmed",
    paymentStatus: "paid",
    contractUrl: "https://example.com/contracts/TR-240918-001.pdf",
  },
];

const ORDER_STATUS_MAP = {
  pending:   { label: "Chờ xác nhận", color: "default" },
  confirmed: { label: "Đã xác nhận",  color: "blue"    },
  delivering:{ label: "Đang giao",    color: "cyan"    },
  active:    { label: "Đang thuê",    color: "gold"    },
  returned:  { label: "Đã trả",       color: "green"   },
  cancelled: { label: "Đã hủy",       color: "red"     },
};

const PAYMENT_STATUS_MAP = {
  unpaid:   { label: "Chưa thanh toán",      color: "volcano"  },
  paid:     { label: "Đã thanh toán",        color: "green"    },
  refunded: { label: "Đã hoàn tiền",         color: "geekblue" },
  partial:  { label: "Thanh toán một phần",  color: "purple"   },
};

function formatVND(n) {
  return n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function calcEndDate(startIso, days) {
  const start = new Date(startIso);
  const end = new Date(start);
  end.setDate(end.getDate() + (days || 0));
  return end;
}

export default function MyOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState();
  const [dateRange, setDateRange] = useState(null);
  const [loading, setLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  const data = useMemo(() => {
    let rows = [...MOCK];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.items.some((it) => it.name.toLowerCase().includes(q))
      );
    }
    if (statusFilter) rows = rows.filter((r) => r.orderStatus === statusFilter);
    if (dateRange?.length === 2) {
      const [s, e] = dateRange;
      const start = s.startOf("day").toDate().getTime();
      const end = e.endOf("day").toDate().getTime();
      rows = rows.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return t >= start && t <= end;
      });
    }
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [search, statusFilter, dateRange]);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success("Đã tải lại danh sách đơn.");
    }, 600);
  };

  const showDetail = (record) => {
    setCurrent(record);
    setDetailOpen(true);
  };

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      key: "id",
      width: 140, // Narrowed
      render: (v) => <Text strong>{v}</Text>,
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    {
      title: "Sản phẩm",
      key: "items",
      width: 300, // Narrowed
      render: (_, r) => {
        const first = r.items[0];
        const extra = r.items.length > 1 ? ` +${r.items.length - 1} mục` : "";
        return (
          <Space size="middle">
            <Avatar shape="square" size={64} src={first?.image} style={{ borderRadius: 8 }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>{first?.name}</Text>
              <br />
              <Text type="secondary">SL: {first?.qty}{extra}</Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150, // Narrowed
      render: (v) => formatDateTime(v),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      defaultSortOrder: "descend",
    },
    {
      title: "Số ngày",
      dataIndex: "days",
      key: "days",
      align: "center",
      width: 80, // Narrowed
      sorter: (a, b) => a.days - b.days,
    },
    {
      title: "Tổng tiền",
      dataIndex: "total",
      key: "total",
      align: "right",
      width: 120, // Narrowed
      render: (v) => <Text strong>{formatVND(v)}</Text>,
      sorter: (a, b) => a.total - b.total,
    },
    {
      title: "Trạng thái",
      dataIndex: "orderStatus",
      key: "orderStatus",
      width: 120, // Narrowed
      render: (s) => <Tag color={ORDER_STATUS_MAP[s].color} style={{ borderRadius: 20, padding: '0 12px' }}>{ORDER_STATUS_MAP[s].label}</Tag>,
      filters: Object.entries(ORDER_STATUS_MAP).map(([value, { label }]) => ({ text: label, value })),
      onFilter: (v, r) => r.orderStatus === v,
    },
    {
      title: "Thanh toán",
      dataIndex: "paymentStatus",
      key: "paymentStatus",
      width: 140, // Narrowed
      render: (s) => <Tag color={PAYMENT_STATUS_MAP[s].color} style={{ borderRadius: 20, padding: '0 12px' }}>{PAYMENT_STATUS_MAP[s].label}</Tag>,
      filters: Object.entries(PAYMENT_STATUS_MAP).map(([value, { label }]) => ({ text: label, value })),
      onFilter: (v, r) => r.paymentStatus === v,
    },
    // {
    //   title: "",
    //   key: "actions",
    //   fixed: "right",
    //   width: 200, // Narrowed
    //   render: (_, r) => {
    //     const canPay = r.paymentStatus === "unpaid" && r.orderStatus !== "cancelled";
    //     const canCancel = ["pending", "confirmed"].includes(r.orderStatus);
    //     return (
    //       <Space size="small">
    //         <Button shape="round" onClick={() => showDetail(r)} icon={<EyeOutlined />} type="text" style={{ color: '#1890ff' }}>
    //           Xem
    //         </Button>
    //         <Button
    //           shape="round"
    //           type="primary"
    //           disabled={!canPay}
    //           icon={<CreditCardOutlined />}
    //           onClick={() => message.info(`Thanh toán đơn ${r.id}`)}
    //           style={{ background: 'linear-gradient(to right, #4da6ff, #1677ff)', border: 'none' }}
    //         >
    //           Thanh toán
    //         </Button>
    //         <Button
    //           shape="round"
    //           danger
    //           disabled={!canCancel}
    //           icon={<StopOutlined />}
    //           onClick={() => message.warn(`Yêu cầu hủy đơn ${r.id}`)}
    //         />
    //       </Space>
    //     );
    //   },
    // },
  ];

  return (
    <>
      <div
        style={{
          height: "calc(100vh - var(--stacked-header,128px))",
          marginTop: "-24px",
          marginBottom: "-24px",
          background: "#f0f2f5", // Softer background for modern feel
        }}
      >
        <div className="h-full flex flex-col max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 bg-white rounded-xl shadow-lg overflow-hidden"> {/* Changed to max-w-5xl for narrower width */}
          <div className="py-6 border-b border-gray-200">
            <Title level={3} style={{ margin: 0, fontFamily: "'Inter', sans-serif" }}>Đơn thuê của tôi</Title>
            <Text type="secondary">Theo dõi trạng thái đơn, thanh toán và tải hợp đồng.</Text>
          </div>

          <div className="flex items-center justify-between py-4">
            <Space wrap size="middle">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Tìm theo mã đơn, tên thiết bị…"
                style={{ width: 320, borderRadius: 999, padding: '8px 16px' }} // Pill shape for modern input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <RangePicker onChange={setDateRange} style={{ borderRadius: 8 }} />
              <Dropdown
                trigger={["click"]}
                overlay={
                  <Menu
                    onClick={({ key }) => setStatusFilter(key === "all" ? undefined : key)}
                    items={[
                      { key: "all", label: "Tất cả trạng thái" },
                      ...Object.entries(ORDER_STATUS_MAP).map(([k, v]) => ({ key: k, label: v.label })),
                    ]}
                  />
                }
              >
                <Button shape="round" icon={<FilterOutlined />} style={{ borderRadius: 999 }}>
                  {statusFilter ? `Lọc: ${ORDER_STATUS_MAP[statusFilter].label}` : "Lọc trạng thái"}
                </Button>
              </Dropdown>
              <Button shape="round" icon={<ReloadOutlined />} onClick={refresh} loading={loading} style={{ borderRadius: 999 }}>
                Tải lại
              </Button>
            </Space>
          </div>

          <div className="flex-1 min-h-0 overflow-auto pb-3">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <Empty description="Chưa có đơn nào" />
              </div>
            ) : (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={data}
                loading={loading}
                size="middle"
                bordered={false}
                className="modern-table"
                sticky
                pagination={{ pageSize: 8, showSizeChanger: true, position: ["bottomRight"] }}
                scroll={{ x: 900 }} // Reduced scroll width to match narrower layout
              />
            )}
          </div>
        </div>
      </div>

      {/* Drawer chi tiết đơn */}
      <Drawer
        title={current ? `Chi tiết đơn ${current.id}` : "Chi tiết đơn"}
        width={600} // Narrowed Drawer width
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        styles={{ body: { padding: 24, background: '#f9fafb' } }} // Softer background
      >
        {current && (
          <>
            <Descriptions bordered column={1} size="middle" className="mb-4">
              <Descriptions.Item label="Trạng thái đơn">
                <Tag color={ORDER_STATUS_MAP[current.orderStatus].color} style={{ borderRadius: 20, padding: '0 12px' }}>
                  {ORDER_STATUS_MAP[current.orderStatus].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái thanh toán">
                <Tag color={PAYMENT_STATUS_MAP[current.paymentStatus].color} style={{ borderRadius: 20, padding: '0 12px' }}>
                  {PAYMENT_STATUS_MAP[current.paymentStatus].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {formatDateTime(current.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian thuê">
                {(() => {
                  const end = calcEndDate(current.createdAt, current.days);
                  return `${formatDateTime(current.createdAt)}  →  ${end.toLocaleString("vi-VN", {
                    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })} (${current.days} ngày)`;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền thuê">
                <Text strong>{formatVND(current.total)}</Text>
              </Descriptions.Item>
              {current.orderStatus === "cancelled" && (
                <Descriptions.Item label="Lý do hủy">
                  <Text type="danger">{current.cancelReason || "—"}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <Title level={4} style={{ marginTop: 0, fontFamily: "'Inter', sans-serif" }}>Thiết bị thuê</Title>
            <List
              itemLayout="horizontal"
              dataSource={current.items}
              renderItem={(it) => (
                <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <List.Item.Meta
                    avatar={<Avatar shape="square" size={72} src={it.image} style={{ borderRadius: 8 }} />}
                    title={<Text strong style={{ fontSize: 16 }}>{it.name}</Text>}
                    description={<Text type="secondary">Số lượng: {it.qty}</Text>}
                  />
                </List.Item>
              )}
            />

            <Space style={{ marginTop: 24 }}>
              <Button
                type="primary"
                size="large"
                onClick={() => {
                  if (current.contractUrl) window.open(current.contractUrl, "_blank");
                  else message.info("Chưa có hợp đồng cho đơn này.");
                }}
                style={{ borderRadius: 8, padding: '0 24px' }}
              >
                Tải hợp đồng thuê
              </Button>
            </Space>
          </>
        )}
      </Drawer>

      <style>{`
        .modern-table .ant-table-thead > tr > th {
          background: #fafafa;
          font-weight: 600;
          color: #333;
          border-bottom: 2px solid #f0f0f0;
        }
        .modern-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.3s;
        }
        .modern-table .ant-table-tbody > tr:hover > td {
          background: #f6faff !important;
        }
        .ant-drawer-content {
          border-radius: 12px 0 0 12px;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}