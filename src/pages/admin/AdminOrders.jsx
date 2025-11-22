// src/pages/admin/AdminOrders.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Tag,
  Space,
  Button,
  Input,
  DatePicker,
  message,
  Typography,
  Popconfirm,
  Tooltip,
  Skeleton,
  Drawer,
  Descriptions,
  Divider,
  Statistic,
} from "antd";
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listRentalOrders,
  getRentalOrderById,
  deleteRentalOrder,
  fmtVND,
} from "../../lib/rentalOrdersApi";
import { fetchCustomerById } from "../../lib/customerApi";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const statusTag = (s) => {
  switch (String(s).toUpperCase()) {
    case "PENDING":
      return <Tag color="gold">Đang chờ</Tag>;
    case "CONFIRMED":
      return <Tag color="green">Đã xác nhận</Tag>;
    case "CANCELLED":
    case "CANCELED":
      return <Tag color="red">Đã hủy</Tag>;
    case "COMPLETED":
      return <Tag color="blue">Hoàn tất</Tag>;
    default:
      return <Tag>{s}</Tag>;
  }
};

const columnsDef = ({ onDelete, onView }) => [
  {
    title: "Mã đơn",
    dataIndex: "orderId",
    width: 110,
    sorter: (a, b) => a.orderId - b.orderId,
    render: (v) => <strong>#{v}</strong>,
  },
  {
    title: "Ngày tạo",
    dataIndex: "createdAt",
    width: 170,
    sorter: (a, b) =>
      dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
    render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm"),
  },
  {
    title: "T/g thuê",
    dataIndex: "range",
    width: 220,
    render: (_, r) =>
      `${dayjs(r.startDate).format("YYYY-MM-DD")} → ${dayjs(r.endDate).format(
        "YYYY-MM-DD"
      )}`,
  },
  {
    title: "Số ngày",
    dataIndex: "days",
    width: 90,
    render: (_, r) => {
      const d =
        dayjs(r.endDate)
          .startOf("day")
          .diff(dayjs(r.startDate).startOf("day"), "day") || 1;
      return Math.max(1, d);
    },
  },
  {
    title: "Tổng tiền",
    dataIndex: "totalPrice",
    width: 140,
    align: "right",
    render: (v) => fmtVND(v),
  },
  {
    title: "Tiền cọc",
    dataIndex: "depositAmount",
    width: 140,
    align: "right",
    render: (v) => fmtVND(v),
  },
  {
    title: "Trạng thái",
    dataIndex: "orderStatus",
    width: 140,
    render: statusTag,
    filters: [
      { text: "Đang chờ", value: "PENDING" },
      { text: "Đã xác nhận", value: "CONFIRMED" },
      { text: "Đã hủy", value: "CANCELLED" },
      { text: "Hoàn tất", value: "COMPLETED" },
    ],
    onFilter: (val, r) =>
      String(r.orderStatus).toUpperCase() === String(val).toUpperCase(),
  },
  {
    title: "Thao tác",
    fixed: "right",
    width: 260,
    render: (_, r) => {
      return (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => onView(r)}>
            Xem
          </Button>

          <Popconfirm
            title="Huỷ đơn?"
            okText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(r)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      );
    },
  },
];

export default function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kw, setKw] = useState("");
  const [range, setRange] = useState(null);

  // Drawer state
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [customer, setCustomer] = useState(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const list = await listRentalOrders();
      const arr = Array.isArray(list) ? list.slice() : [];
      // newest -> oldest by createdAt then orderId
      arr.sort((a, b) => {
        const ta = new Date(a?.createdAt || 0).getTime();
        const tb = new Date(b?.createdAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (b?.orderId || 0) - (a?.orderId || 0);
      });
      setRows(arr);
    } catch (e) {
      message.error(
        e?.response?.data?.message ||
          e?.message ||
          "Không tải được danh sách đơn."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);


  const doDelete = async (r) => {
    try {
      await deleteRentalOrder(r.orderId);
      message.success(`Đã huỷ đơn #${r.orderId}`);
      setRows((prev) => prev.filter((x) => x.orderId !== r.orderId));
      if (detail?.orderId === r.orderId) {
        setOpen(false);
        setDetail(null);
      }
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không huỷ được đơn."
      );
    }
  };

  const viewDetail = async (orderId) => {
    try {
      setLoadingDetail(true);
      const d = await getRentalOrderById(orderId);
      setDetail(d);
      // Lấy thông tin KH (nếu có customerId)
      if (d?.customerId) {
        try {
          const c = await fetchCustomerById(d.customerId);
          setCustomer(c || null);
        } catch {
          setCustomer(null);
        }
      } else {
        setCustomer(null);
      }
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không tải chi tiết đơn."
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const onView = (r) => {
    setOpen(true);
    setDetail(null);
    viewDetail(r.orderId);
  };

  const filtered = useMemo(() => {
    let ds = rows;
    if (kw.trim()) {
      const k = kw.trim().toLowerCase();
      ds = ds.filter(
        (r) =>
          String(r.orderId).toLowerCase().includes(k) ||
          String(r.customerId ?? "")
            .toLowerCase()
            .includes(k)
      );
    }
    if (range?.length === 2) {
      const [s, e] = range;
      const sMs = s.startOf("day").valueOf();
      const eMs = e.endOf("day").valueOf();
      ds = ds.filter((r) => {
        const t = dayjs(r.createdAt).valueOf();
        return t >= sMs && t <= eMs;
      });
    }
    return ds;
  }, [rows, kw, range]);

  // columns cho bảng items trong Drawer
  const itemCols = [
    { title: "Chi tiết ID", dataIndex: "orderDetailId", width: 110 },
    { title: "Model ID", dataIndex: "deviceModelId", width: 110 },
    { title: "SL", dataIndex: "quantity", width: 70 },
    {
      title: "Giá/ngày",
      dataIndex: "pricePerDay",
      width: 130,
      align: "right",
      render: (v) => fmtVND(v),
    },
    {
      title: "Cọc/1 SP",
      dataIndex: "depositAmountPerUnit",
      width: 140,
      align: "right",
      render: (v) => fmtVND(v),
    },
    {
      title: "Thành tiền (ước tính)",
      key: "subtotal",
      align: "right",
      render: (_, r) =>
        fmtVND(Number(r.pricePerDay || 0) * Number(r.quantity || 1)),
    },
  ];

  const detailDays = useMemo(() => {
    if (!detail) return 1;
    const d =
      dayjs(detail.endDate)
        .startOf("day")
        .diff(dayjs(detail.startDate).startOf("day"), "day") || 1;
    return Math.max(1, d);
  }, [detail]);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Quản lý đơn hàng
        </Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>
          Tải lại
        </Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          placeholder="Tìm mã đơn hoặc mã KH…"
          onSearch={setKw}
          allowClear
          style={{ width: 300 }}
        />
        <RangePicker value={range} onChange={setRange} />
      </Space>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Table
          rowKey="orderId"
          columns={columnsDef({
            onDelete: doDelete,
            onView,
          })}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1200 }}
        />
      )}

      {/* Drawer chi tiết */}
      <Drawer
        title={detail ? `Đơn thuê #${detail.orderId}` : "Chi tiết đơn"}
        open={open}
        width={800}
        onClose={() => setOpen(false)}
        extra={detail && <Space></Space>}
      >
        {loadingDetail ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : detail ? (
          <>
            <Descriptions bordered size="middle" column={2}>
              <Descriptions.Item label="Mã đơn">
                #{detail.orderId}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {statusTag(detail.orderStatus)}
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {detail.customerId ? (
                  <div>
                    <div>
                      <strong>#{detail.customerId}</strong>
                    </div>
                    <div>{customer?.fullName || customer?.name || "—"}</div>
                    <div style={{ color: "#6B7280" }}>
                      {customer?.email || "—"}
                    </div>
                    {customer?.phoneNumber && (
                      <div style={{ color: "#6B7280" }}>
                        {customer.phoneNumber}
                      </div>
                    )}
                  </div>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {dayjs(detail.createdAt).format("YYYY-MM-DD HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Bắt đầu">
                {dayjs(detail.startDate).format("YYYY-MM-DD")}
              </Descriptions.Item>
              <Descriptions.Item label="Kết thúc">
                {dayjs(detail.endDate).format("YYYY-MM-DD")}
              </Descriptions.Item>
              <Descriptions.Item label="Số ngày">
                {detailDays} ngày
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao">
                {detail.shippingAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Space size={24} wrap>
              <Statistic title="Tiền hàng" value={fmtVND(detail.totalPrice)} />
              <Statistic
                title="Tiền cọc giữ"
                value={fmtVND(detail.depositAmount)}
              />
              <Statistic
                title="Cọc đã giữ"
                value={fmtVND(detail.depositAmountHeld)}
              />
              <Statistic
                title="Cọc đã dùng"
                value={fmtVND(detail.depositAmountUsed)}
              />
              <Statistic
                title="Cọc hoàn lại"
                value={fmtVND(detail.depositAmountRefunded)}
              />
              <Statistic
                title="Giá/ngày (TB)"
                value={fmtVND(detail.pricePerDay)}
              />
            </Space>

            <Divider />

            <Title level={5} style={{ marginBottom: 8 }}>
              Chi tiết sản phẩm
            </Title>
            <Table
              rowKey="orderDetailId"
              columns={itemCols}
              dataSource={detail.orderDetails || []}
              pagination={false}
              size="small"
            />

            <Divider />

            <Space>
              <Popconfirm
                title="Huỷ đơn?"
                okText="Huỷ"
                okButtonProps={{ danger: true }}
                onConfirm={() => doDelete(detail)}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Huỷ đơn
                </Button>
              </Popconfirm>
            </Space>
          </>
        ) : (
          <Text type="secondary">Không có dữ liệu.</Text>
        )}
      </Drawer>
    </>
  );
}
