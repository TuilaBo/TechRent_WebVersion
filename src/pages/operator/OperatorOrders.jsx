// src/pages/operator/OperatorOrders.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  DatePicker,
  Skeleton,
  Descriptions,
  Divider,
  Statistic,
  Popconfirm,
  Card,
  Row,
  Col,
  Tabs,
} from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listRentalOrders,
  getRentalOrderById,
  deleteRentalOrder,
  fmtVND,
} from "../../lib/rentalOrdersApi";
import { fetchCustomerById } from "../../lib/customerApi";
import { createContractFromOrder, getMyContracts, normalizeContract, listContractsByCustomer, listContractsByOrder, getContractById, sendContractForSignature } from "../../lib/contractApi";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

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

export default function OperatorOrders() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kw, setKw] = useState("");
  const [range, setRange] = useState(null);

  // Drawer xem chi tiết đơn
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [orderContracts, setOrderContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractDetail, setContractDetail] = useState(null);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [sendingForSignature, setSendingForSignature] = useState(false);

  // Contract preview modal
  const [contractPreviewOpen, setContractPreviewOpen] = useState(false);
  const [contractPreview, setContractPreview] = useState(null);
  const [contracts, setContracts] = useState([]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const list = await listRentalOrders();
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải được danh sách đơn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchContracts();
  }, []);

  // ====== Actions ======

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
      message.error(e?.response?.data?.message || e?.message || "Không huỷ được đơn.");
    }
  };

  const doCreateContract = async (r) => {
    try {
      const response = await createContractFromOrder(r.orderId);
      const contract = response?.data || response;
      message.success(`Đã tạo hợp đồng #${contract?.contractId || contract?.id} từ đơn #${r.orderId}`);
      
      // Show contract preview modal and refresh contracts list
      setContractPreview(contract);
      setContractPreviewOpen(true);
      fetchContracts();
      
      // Refresh order contracts if drawer is open
      if (detail?.orderId) {
        fetchOrderContracts(detail.orderId, detail?.customerId);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tạo được hợp đồng.");
    }
  };

  const fetchContracts = async () => {
    try {
      setContractsLoading(true);
      const list = await getMyContracts();
      const normalized = Array.isArray(list) ? list.map(normalizeContract) : [];
      setContracts(normalized);
    } catch (e) {
      console.error("Failed to fetch contracts:", e);
    } finally {
      setContractsLoading(false);
    }
  };

  const viewDetail = async (orderId) => {
    try {
      setLoadingDetail(true);
      const d = await getRentalOrderById(orderId);
      setDetail(d || null);
      if (d?.customerId) {
        try {
          const c = await fetchCustomerById(d.customerId);
          console.log("Raw customer data:", c);
          setCustomer(c || null);
        } catch (e) {
          console.error("Error fetching customer:", e);
          setCustomer(null);
        }
      } else {
        setCustomer(null);
      }
      
      // Fetch contracts for this order using customer ID
      await fetchOrderContracts(orderId, d?.customerId);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải chi tiết đơn.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchOrderContracts = async (orderId, customerId) => {
    try {
      setContractsLoading(true);
      
      // Try to get contracts by order ID first, fallback to customer ID
      let contracts = [];
      try {
        // First try to get contracts by order ID
        const orderContracts = await listContractsByOrder(orderId);
        contracts = Array.isArray(orderContracts) ? orderContracts.map(normalizeContract) : [];
      } catch (orderError) {
        console.log("Order ID API not available, trying customer ID:", orderError);
        
        // Fallback to customer ID if order ID API doesn't exist
        if (customerId) {
          const customerContracts = await listContractsByCustomer(customerId);
          const normalized = Array.isArray(customerContracts) ? customerContracts.map(normalizeContract) : [];
          // Filter by order ID on the client side
          contracts = normalized.filter(contract => contract.orderId === orderId);
        }
      }
      
      setOrderContracts(contracts);
    } catch (e) {
      console.error("Failed to fetch order contracts:", e);
      setOrderContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const onView = (r) => {
    setOpen(true);
    setDetail(null);
    viewDetail(r.orderId);
  };

  const viewContractDetail = async (contractId) => {
    try {
      setLoadingContractDetail(true);
      const contract = await getContractById(contractId);
      const normalized = normalizeContract(contract);
      setContractDetail(normalized);
      setContractDetailOpen(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải được chi tiết hợp đồng.");
    } finally {
      setLoadingContractDetail(false);
    }
  };

  const doSendForSignature = async (contractId) => {
    try {
      setSendingForSignature(true);
      await sendContractForSignature(contractId);
      message.success("Đã gửi hợp đồng cho khách hàng ký!");
      
      // Refresh contract detail to show updated status
      const updatedContract = await getContractById(contractId);
      const normalized = normalizeContract(updatedContract);
      setContractDetail(normalized);
      
      // Refresh contracts list and order contracts
      fetchContracts();
      if (detail?.orderId) {
        fetchOrderContracts(detail.orderId, detail?.customerId);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không gửi được hợp đồng để ký.");
    } finally {
      setSendingForSignature(false);
    }
  };

  // ====== Filters ======
  const filtered = useMemo(() => {
    let ds = rows;
    if (kw.trim()) {
      const k = kw.trim().toLowerCase();
      ds = ds.filter(
        (r) =>
          String(r.orderId).toLowerCase().includes(k) ||
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
    return ds;
  }, [rows, kw, range]);

  // ====== Columns ======
  const columnsDef = ({ onDelete, onView, onCreateContract }) => [
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
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "T/g thuê",
      dataIndex: "range",
      width: 220,
      render: (_, r) => `${dayjs(r.startDate).format("YYYY-MM-DD")} → ${dayjs(r.endDate).format("YYYY-MM-DD")}`,
    },
    {
      title: "Số ngày",
      dataIndex: "days",
      width: 90,
      render: (_, r) => {
        const d =
          dayjs(r.endDate).startOf("day").diff(dayjs(r.startDate).startOf("day"), "day") || 1;
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
      onFilter: (val, r) => String(r.orderStatus).toUpperCase() === String(val).toUpperCase(),
    },
    {
      title: "Thao tác",
      fixed: "right",
      width: 320,
      render: (_, r) => {
        return (
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => onView(r)}>
              Xem
            </Button>

              <Button
              icon={<FileTextOutlined />} 
              onClick={() => onCreateContract(r)}
              title="Tạo hợp đồng"
            >
              Tạo hợp đồng
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

  // ====== Bảng items trong Drawer ======
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
      render: (_, r) => fmtVND(Number(r.pricePerDay || 0) * Number(r.quantity || 1)),
    },
  ];

  const detailDays = useMemo(() => {
    if (!detail) return 1;
    const d =
      dayjs(detail.endDate).startOf("day").diff(dayjs(detail.startDate).startOf("day"), "day") ||
      1;
    return Math.max(1, d);
  }, [detail]);

  // ====== UI ======
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý đơn hàng</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Tải lại</Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã đơn hoặc mã KH…"
          onSearch={setKw}
          onChange={(e) => setKw(e.target.value)}
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
            onCreateContract: doCreateContract,
          })}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1200 }}
        />
      )}

      {/* Drawer chi tiết đơn (giống AdminOrders) */}
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
              <Descriptions.Item label="Mã đơn">#{detail.orderId}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{statusTag(detail.orderStatus)}</Descriptions.Item>

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

              <Descriptions.Item label="Bắt đầu">{dayjs(detail.startDate).format("YYYY-MM-DD")}</Descriptions.Item>
              <Descriptions.Item label="Kết thúc">{dayjs(detail.endDate).format("YYYY-MM-DD")}</Descriptions.Item>
              <Descriptions.Item label="Số ngày">{detailDays} ngày</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao">{detail.shippingAddress || "—"}</Descriptions.Item>
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

            <Title level={5} style={{ marginBottom: 8 }}>Chi tiết sản phẩm</Title>
            <Table
              rowKey="orderDetailId"
              columns={itemCols}
              dataSource={detail.orderDetails || []}
              pagination={false}
              size="small"
            />

            <Divider />

            <Title level={5} style={{ marginBottom: 8 }}>Hợp đồng đã tạo</Title>
            {contractsLoading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : orderContracts.length > 0 ? (
              <Table
                rowKey="id"
                columns={[
                  {
                    title: "Mã hợp đồng",
                    dataIndex: "id",
                    width: 100,
                    render: (v) => <strong>#{v}</strong>,
                  },
                  {
                    title: "Số hợp đồng",
                    dataIndex: "number",
                    width: 120,
                    render: (v) => v || "—",
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    width: 100,
                    render: (status) => {
                      switch (String(status).toUpperCase()) {
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
                          return <Tag>{status}</Tag>;
                      }
                    },
                  },
                  {
                    title: "Ngày tạo",
                    dataIndex: "createdAt",
                    width: 120,
                    render: (v) => dayjs(v).format("DD/MM/YYYY"),
                  },
                  {
                    title: "Tổng tiền",
                    dataIndex: "totalAmount",
                    width: 100,
                    align: "right",
                    render: (v) => fmtVND(v),
                  },
                  {
                    title: "Thao tác",
                    key: "actions",
                    width: 150,
                    render: (_, record) => (
                      <Space size="small">
                        <Button 
                          size="small" 
                          icon={<EyeOutlined />} 
                          onClick={() => viewContractDetail(record.id)}
                          loading={loadingContractDetail}
                        >
                          Xem
                        </Button>
                        {record.status === "DRAFT" && (
                          <Button 
                            size="small" 
                            type="primary"
                            loading={sendingForSignature}
                            onClick={() => doSendForSignature(record.id)}
                          >
                            Gửi ký
                          </Button>
                        )}
                      </Space>
                    ),
                  },
                ]}
                dataSource={orderContracts}
                pagination={false}
                size="small"
              />
            ) : (
              <Text type="secondary">Chưa có hợp đồng nào được tạo từ đơn này</Text>
            )}

            <Divider />

            <Space>
              <Button 
                icon={<FileTextOutlined />} 
                onClick={() => doCreateContract(detail)}
                title="Tạo hợp đồng"
              >
                Tạo hợp đồng
              </Button>
              
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

      {/* Contract Preview Modal */}
      <Modal
        title="Quản lý hợp đồng"
        open={contractPreviewOpen}
        onCancel={() => setContractPreviewOpen(false)}
        footer={[
          <Button key="close" onClick={() => setContractPreviewOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={1000}
        style={{ top: 20 }}
      >
        <Tabs
          defaultActiveKey="preview"
          items={[
            {
              key: "preview",
              label: "Xem trước hợp đồng",
              children: contractPreview ? (
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <Card 
                    title={
                      <div style={{ textAlign: 'center' }}>
                        <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                          {contractPreview.title}
                        </Title>
                        <Text type="secondary">Số hợp đồng: {contractPreview.contractNumber}</Text>
                      </div>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Card size="small" title="Thông tin cơ bản">
                          <Descriptions size="small" column={1}>
                            <Descriptions.Item label="Mã hợp đồng">#{contractPreview.contractId}</Descriptions.Item>
                            <Descriptions.Item label="Đơn thuê">#{contractPreview.orderId}</Descriptions.Item>
                            <Descriptions.Item label="Khách hàng">#{contractPreview.customerId}</Descriptions.Item>
                            <Descriptions.Item label="Loại hợp đồng">
                              <Tag color="blue">{contractPreview.contractType}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                              <Tag color="gold">{contractPreview.status}</Tag>
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" title="Thời gian">
                          <Descriptions size="small" column={1}>
                            <Descriptions.Item label="Ngày bắt đầu">
                              {dayjs(contractPreview.startDate).format("DD/MM/YYYY HH:mm")}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày kết thúc">
                              {dayjs(contractPreview.endDate).format("DD/MM/YYYY HH:mm")}
                            </Descriptions.Item>
                            <Descriptions.Item label="Số ngày thuê">
                              {contractPreview.rentalPeriodDays} ngày
                            </Descriptions.Item>
                            <Descriptions.Item label="Hết hạn">
                              {dayjs(contractPreview.expiresAt).format("DD/MM/YYYY HH:mm")}
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      </Col>
                    </Row>

                    <Divider />

                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Card size="small" title="Tài chính">
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Text>Tổng tiền thuê:</Text>
                              <Text strong style={{ color: '#52c41a' }}>
                                {fmtVND(contractPreview.totalAmount)}
                              </Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Text>Tiền cọc:</Text>
                              <Text strong style={{ color: '#1890ff' }}>
                                {fmtVND(contractPreview.depositAmount)}
                              </Text>
                            </div>
                          </Space>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" title="Mô tả">
                          <Text>{contractPreview.description}</Text>
                        </Card>
                      </Col>
                    </Row>

                    <Divider />

                    <Card size="small" title="Nội dung hợp đồng">
                      <div 
                        style={{ 
                          border: '1px solid #f0f0f0', 
                          padding: 16, 
                          borderRadius: 6,
                          backgroundColor: '#fafafa',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}
                        dangerouslySetInnerHTML={{ __html: contractPreview.contractContent }}
                      />
                    </Card>

                    <Divider />

                    <Card size="small" title="Điều khoản và điều kiện">
                      <div 
                        style={{ 
                          border: '1px solid #f0f0f0', 
                          padding: 16, 
                          borderRadius: 6,
                          backgroundColor: '#fafafa',
                          maxHeight: '150px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {contractPreview.termsAndConditions}
                      </div>
                    </Card>
                  </Card>
                </div>
              ) : (
                <Text type="secondary">Không có hợp đồng để xem trước</Text>
              )
            },
            {
              key: "list",
              label: "Danh sách hợp đồng",
              children: (
                <div>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>Tất cả hợp đồng</Title>
                    <Button icon={<ReloadOutlined />} onClick={fetchContracts}>
                      Tải lại
                    </Button>
                  </div>
                  
                  {contractsLoading ? (
                    <Skeleton active paragraph={{ rows: 5 }} />
                  ) : (
                    <Table
                      rowKey="id"
                      columns={[
                        {
                          title: "Mã hợp đồng",
                          dataIndex: "id",
                          width: 120,
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
                          render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
                        },
                        {
                          title: "Trạng thái",
                          dataIndex: "status",
                          width: 120,
                          render: (status) => {
                            switch (String(status).toUpperCase()) {
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
                                return <Tag>{status}</Tag>;
                            }
                          },
                        },
                        {
                          title: "Tổng tiền",
                          dataIndex: "totalAmount",
                          width: 120,
                          align: "right",
                          render: (v) => fmtVND(v),
                        },
                        {
                          title: "Thao tác",
                          key: "actions",
                          width: 150,
                          render: (_, record) => (
                            <Space size="small">
                              <Button 
                                size="small" 
                                icon={<EyeOutlined />} 
                                onClick={() => viewContractDetail(record.id)}
                                loading={loadingContractDetail}
                              >
                                Xem
                              </Button>
                              {record.status === "DRAFT" && (
                                <Button 
                                  size="small" 
                                  type="primary"
                                  loading={sendingForSignature}
                                  onClick={() => doSendForSignature(record.id)}
                                >
                                  Gửi ký
                                </Button>
                              )}
                            </Space>
                          ),
                        },
                      ]}
                      dataSource={contracts}
                      pagination={{ pageSize: 5, showSizeChanger: false }}
                      size="small"
                    />
                  )}
                </div>
              )
            }
          ]}
        />
      </Modal>

      {/* Contract Detail Modal */}
      <Modal
        title="Chi tiết hợp đồng"
        open={contractDetailOpen}
        onCancel={() => setContractDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setContractDetailOpen(false)}>
            Đóng
          </Button>,
          contractDetail && contractDetail.status === "DRAFT" && (
            <Button 
              key="send" 
              type="primary" 
              loading={sendingForSignature}
              onClick={() => doSendForSignature(contractDetail.id)}
            >
              Gửi để ký
            </Button>
          ),
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {contractDetail && (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Card 
              title={
                <div style={{ textAlign: 'center' }}>
                  <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                    {contractDetail.title}
                  </Title>
                  <Text type="secondary">Số hợp đồng: {contractDetail.number}</Text>
                </div>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="Thông tin cơ bản">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Mã hợp đồng">#{contractDetail.id}</Descriptions.Item>
                      <Descriptions.Item label="Đơn thuê">#{contractDetail.orderId}</Descriptions.Item>
                      <Descriptions.Item label="Khách hàng">#{contractDetail.customerId}</Descriptions.Item>
                      <Descriptions.Item label="Loại hợp đồng">
                        <Tag color="blue">{contractDetail.type}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Trạng thái">
                        <Tag color="gold">{contractDetail.status}</Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Thời gian">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày bắt đầu">
                        {contractDetail.startDate ? dayjs(contractDetail.startDate).format("DD/MM/YYYY HH:mm") : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày kết thúc">
                        {contractDetail.endDate ? dayjs(contractDetail.endDate).format("DD/MM/YYYY HH:mm") : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Số ngày thuê">
                        {contractDetail.rentalPeriodDays ? `${contractDetail.rentalPeriodDays} ngày` : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Hết hạn">
                        {contractDetail.expiresAt ? dayjs(contractDetail.expiresAt).format("DD/MM/YYYY HH:mm") : "—"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="Tài chính">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Tổng tiền thuê:</Text>
                        <Text strong style={{ color: '#52c41a' }}>
                          {fmtVND(contractDetail.totalAmount)}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Tiền cọc:</Text>
                        <Text strong style={{ color: '#1890ff' }}>
                          {fmtVND(contractDetail.depositAmount)}
                        </Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Mô tả">
                    <Text>{contractDetail.description || "—"}</Text>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Card size="small" title="Nội dung hợp đồng">
                <div 
                  style={{ 
                    border: '1px solid #f0f0f0', 
                    padding: 16, 
                    borderRadius: 6,
                    backgroundColor: '#fafafa',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                  dangerouslySetInnerHTML={{ __html: contractDetail.contentHtml || "—" }}
                />
              </Card>

              <Divider />

              <Card size="small" title="Điều khoản và điều kiện">
                <div 
                  style={{ 
                    border: '1px solid #f0f0f0', 
                    padding: 16, 
                    borderRadius: 6,
                    backgroundColor: '#fafafa',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {contractDetail.terms || "—"}
                </div>
              </Card>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="Thông tin tạo">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày tạo">
                        {contractDetail.createdAt ? dayjs(contractDetail.createdAt).format("DD/MM/YYYY HH:mm:ss") : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Người tạo">
                        {contractDetail.createdBy ? `#${contractDetail.createdBy}` : "—"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Thông tin cập nhật">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày cập nhật">
                        {contractDetail.updatedAt ? dayjs(contractDetail.updatedAt).format("DD/MM/YYYY HH:mm:ss") : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Người cập nhật">
                        {contractDetail.updatedBy ? `#${contractDetail.updatedBy}` : "—"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </Card>
          </div>
        )}
      </Modal>

    </>
  );
}
