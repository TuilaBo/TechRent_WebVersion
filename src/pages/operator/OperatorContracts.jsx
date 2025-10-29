// src/pages/operator/OperatorContracts.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Tag,
  Button,
  Space,
  Drawer,
  Typography,
  Modal,
  Input,
  message,
  DatePicker,
  Skeleton,
  Descriptions,
  Divider,
  Statistic,
  Popconfirm,
  Select,
  Card,
  Row,
  Col,
} from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
  PlusOutlined,
  FileTextOutlined,
  SendOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listRentalOrders,
  getRentalOrderById,
  fmtVND,
} from "../../lib/rentalOrdersApi";
import {
  createContractFromOrder,
  getMyContracts,
  getContractById,
  sendContractForSignature,
  normalizeContract,
} from "../../lib/contractApi";
import { fetchCustomerById } from "../../lib/customerApi";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const statusTag = (s) => {
  switch (String(s).toUpperCase()) {
    case "DRAFT":
      return <Tag color="default">Nháp</Tag>;
    case "PENDING_SIGNATURE":
      return <Tag color="gold">Chờ ký</Tag>;
    case "SIGNED":
      return <Tag color="green">Đã ký</Tag>;
    case "EXPIRED":
      return <Tag color="red">Hết hạn</Tag>;
    case "CANCELLED":
      return <Tag color="red">Đã hủy</Tag>;
    default:
      return <Tag>{s}</Tag>;
  }
};

export default function OperatorContracts() {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [kw, setKw] = useState("");
  const [range, setRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  // Modal tạo hợp đồng
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [creating, setCreating] = useState(false);

  // Drawer xem chi tiết hợp đồng
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [customer, setCustomer] = useState(null);

  // ====== Fetch data ======
  const fetchContracts = async () => {
    try {
      setLoading(true);
      const list = await getMyContracts();
      const normalized = Array.isArray(list) ? list.map(normalizeContract) : [];
      setContracts(normalized);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải được danh sách hợp đồng.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const list = await listRentalOrders();
      setOrders(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Failed to fetch orders:", e);
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchOrders();
  }, []);

  // ====== Actions ======

  const doCreateContract = async () => {
    if (!selectedOrderId) {
      message.warning("Vui lòng chọn đơn hàng");
      return;
    }

    try {
      setCreating(true);
      const contract = await createContractFromOrder(selectedOrderId);
      message.success(`Đã tạo hợp đồng #${contract?.id || contract?.contractId}`);
      setCreateModalOpen(false);
      setSelectedOrderId(null);
      fetchContracts();
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tạo được hợp đồng.");
    } finally {
      setCreating(false);
    }
  };

  const doSendForSignature = async (contractId) => {
    try {
      await sendContractForSignature(contractId);
      message.success("Đã gửi hợp đồng để ký");
      fetchContracts();
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không gửi được hợp đồng.");
    }
  };

  const viewDetail = async (contractId) => {
    try {
      setLoadingDetail(true);
      const d = await getContractById(contractId);
      const normalized = normalizeContract(d);
      setDetail(normalized);
      
      if (normalized?.customerId) {
        try {
          const c = await fetchCustomerById(normalized.customerId);
          setCustomer(c || null);
        } catch (e) {
          console.error("Error fetching customer:", e);
          setCustomer(null);
        }
      } else {
        setCustomer(null);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải chi tiết hợp đồng.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const onView = (r) => {
    setOpen(true);
    setDetail(null);
    viewDetail(r.id);
  };

  // ====== Filters ======
  const filtered = useMemo(() => {
    let ds = contracts;
    if (kw.trim()) {
      const k = kw.trim().toLowerCase();
      ds = ds.filter(
        (r) =>
          String(r.id).toLowerCase().includes(k) ||
          String(r.number || "").toLowerCase().includes(k) ||
          String(r.customerId ?? "").toLowerCase().includes(k)
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
    if (statusFilter) {
      ds = ds.filter((r) => String(r.status).toUpperCase() === String(statusFilter).toUpperCase());
    }
    return ds;
  }, [contracts, kw, range, statusFilter]);

  // ====== Columns ======
  const columnsDef = ({ onView, onSendForSignature }) => [
    {
      title: "Mã hợp đồng",
      dataIndex: "id",
      width: 120,
      sorter: (a, b) => a.id - b.id,
      render: (v) => <strong>#{v}</strong>,
    },
    {
      title: "Số hợp đồng",
      dataIndex: "number",
      width: 150,
      render: (v) => v || "—",
    },
    {
      title: "Đơn hàng",
      dataIndex: "orderId",
      width: 100,
      render: (v) => v ? `#${v}` : "—",
    },
    {
      title: "Khách hàng",
      dataIndex: "customerId",
      width: 100,
      render: (v) => v ? `#${v}` : "—",
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      width: 150,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: statusTag,
      filters: [
        { text: "Nháp", value: "DRAFT" },
        { text: "Chờ ký", value: "PENDING_SIGNATURE" },
        { text: "Đã ký", value: "SIGNED" },
        { text: "Hết hạn", value: "EXPIRED" },
        { text: "Đã hủy", value: "CANCELLED" },
      ],
      onFilter: (val, r) => String(r.status).toUpperCase() === String(val).toUpperCase(),
    },
    {
      title: "Thao tác",
      fixed: "right",
      width: 200,
      render: (_, r) => {
        return (
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => onView(r)}>
              Xem
            </Button>
            {r.status === "DRAFT" && (
              <Button 
                type="primary" 
                icon={<SendOutlined />} 
                onClick={() => onSendForSignature(r.id)}
              >
                Gửi ký
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  // ====== UI ======
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý hợp đồng</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchContracts}>Tải lại</Button>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setCreateModalOpen(true)}
        >
          Tạo hợp đồng
        </Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã hợp đồng, số hợp đồng hoặc mã KH…"
          onSearch={setKw}
          onChange={(e) => setKw(e.target.value)}
          style={{ width: 300 }}
        />
        <RangePicker value={range} onChange={setRange} />
        <Select
          placeholder="Trạng thái"
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 150 }}
        >
          <Select.Option value="DRAFT">Nháp</Select.Option>
          <Select.Option value="PENDING_SIGNATURE">Chờ ký</Select.Option>
          <Select.Option value="SIGNED">Đã ký</Select.Option>
          <Select.Option value="EXPIRED">Hết hạn</Select.Option>
          <Select.Option value="CANCELLED">Đã hủy</Select.Option>
        </Select>
      </Space>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Table
          rowKey="id"
          columns={columnsDef({
            onView,
            onSendForSignature: doSendForSignature,
          })}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1000 }}
        />
      )}

      {/* Modal tạo hợp đồng */}
      <Modal
        title="Tạo hợp đồng từ đơn hàng"
        open={createModalOpen}
        onOk={doCreateContract}
        onCancel={() => {
          setCreateModalOpen(false);
          setSelectedOrderId(null);
        }}
        confirmLoading={creating}
        okText="Tạo hợp đồng"
        cancelText="Hủy"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text>Chọn đơn hàng để tạo hợp đồng:</Text>
          <Select
            placeholder="Chọn đơn hàng"
            value={selectedOrderId}
            onChange={setSelectedOrderId}
            style={{ width: "100%" }}
            showSearch
            filterOption={(input, option) =>
              option?.children?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {orders.map((order) => (
              <Select.Option key={order.orderId} value={order.orderId}>
                #{order.orderId} - {dayjs(order.createdAt).format("YYYY-MM-DD")} - {fmtVND(order.totalPrice)}
              </Select.Option>
            ))}
          </Select>
        </Space>
      </Modal>

      {/* Drawer chi tiết hợp đồng */}
      <Drawer
        title={detail ? `Hợp đồng #${detail.id}` : "Chi tiết hợp đồng"}
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
              <Descriptions.Item label="Mã hợp đồng">#{detail.id}</Descriptions.Item>
              <Descriptions.Item label="Số hợp đồng">{detail.number || "—"}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{statusTag(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="Loại hợp đồng">{detail.type || "—"}</Descriptions.Item>

              <Descriptions.Item label="Đơn hàng">
                {detail.orderId ? `#${detail.orderId}` : "—"}
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
              <Descriptions.Item label="Ngày ký">
                {detail.signedAt ? dayjs(detail.signedAt).format("YYYY-MM-DD HH:mm") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu">
                {detail.startDate ? dayjs(detail.startDate).format("YYYY-MM-DD") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày kết thúc">
                {detail.endDate ? dayjs(detail.endDate).format("YYYY-MM-DD") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Số ngày thuê" span={2}>
                {detail.rentalPeriodDays ? `${detail.rentalPeriodDays} ngày` : "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Space size={24} wrap>
              <Statistic title="Tổng tiền" value={fmtVND(detail.totalAmount)} />
              <Statistic title="Tiền cọc" value={fmtVND(detail.depositAmount)} />
            </Space>

            <Divider />

            <Title level={5} style={{ marginBottom: 8 }}>Mô tả</Title>
            <Text>{detail.description || "—"}</Text>

            {detail.contentHtml && (
              <>
                <Divider />
                <Title level={5} style={{ marginBottom: 8 }}>Nội dung hợp đồng</Title>
                <div dangerouslySetInnerHTML={{ __html: detail.contentHtml }} />
              </>
            )}

            <Divider />

            <Space>
              {detail.status === "DRAFT" && (
                <Button 
                  type="primary" 
                  icon={<SendOutlined />} 
                  onClick={() => doSendForSignature(detail.id)}
                >
                  Gửi để ký
                </Button>
              )}
            </Space>
          </>
        ) : (
          <Text type="secondary">Không có dữ liệu.</Text>
        )}
      </Drawer>
    </>
  );
}
