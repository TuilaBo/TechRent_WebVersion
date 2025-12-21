// src/pages/admin/AdminOrders.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Card,
  Row,
  Col,
  Tabs,
  List,
  Badge,
} from "antd";
import {
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listRentalOrders,
  searchRentalOrders,
  getRentalOrderById,
  deleteRentalOrder,
  fmtVND,
} from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel as normalizeDeviceModel } from "../../lib/deviceModelsApi";
import { getKycByCustomerId, normalizeKycItem } from "../../lib/kycApi";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

// ====== Status Tags ======
const statusTag = (status) => {
  if (!status) return <Tag>—</Tag>;
  const s = String(status).toUpperCase();
  switch (s) {
    case "PENDING":
      return <Tag color="gold">Đang chờ</Tag>;
    case "CONFIRMED":
      return <Tag color="green">Đã xác nhận</Tag>;
    case "PROCESSING":
      return <Tag color="purple">Đang xử lý</Tag>;
    case "DELIVERY_C":
    case "DELIVERY_CONFIRMED":
    case "READY_FOR_DELIVERY":
      return <Tag color="cyan">Chuẩn bị giao hàng</Tag>;
    case "SHIPPED":
      return <Tag color="blue">Đã giao hàng</Tag>;
    case "DELIVERED":
      return <Tag color="green">Đã nhận hàng</Tag>;
    case "RETURNED":
      return <Tag color="geekblue">Đã trả hàng</Tag>;
    case "CANCELLED":
    case "CANCELED":
      return <Tag color="red">Đã hủy</Tag>;
    case "COMPLETED":
      return <Tag color="blue">Hoàn tất đơn hàng</Tag>;
    case "ACTIVE":
      return <Tag color="green">Đang thuê</Tag>;
    case "IN_USE":
      return <Tag color="geekblue">Đang sử dụng</Tag>;
    case "DELIVERING":
      return <Tag color="cyan">Đang giao hàng</Tag>;
    default:
      return <Tag color="default">{status}</Tag>;
  }
};

const kycStatusTag = (status) => {
  if (!status) return <Tag color="default">Chưa có KYC</Tag>;
  const s = String(status).toUpperCase();
  switch (s) {
    case "APPROVED":
    case "VERIFIED":
      return <Tag color="green">Đã duyệt KYC</Tag>;
    case "PENDING":
    case "SUBMITTED":
    case "DOCUMENTS_SUBMITTED":
      return <Tag color="orange">Đang chờ duyệt KYC</Tag>;
    case "REJECTED":
    case "REJECT":
    case "DENIED":
      return <Tag color="red">KYC bị từ chối</Tag>;
    case "INCOMPLETE":
      return <Tag color="gold">KYC chưa hoàn tất</Tag>;
    case "EXPIRED":
      return <Tag color="default">KYC hết hạn</Tag>;
    case "NOT_STARTED":
      return <Tag color="default">Chưa bắt đầu</Tag>;
    default:
      return <Tag color="default">{s}</Tag>;
  }
};

const paymentStatusTag = (paymentStatus, orderStatus) => {
  const oStatus = String(orderStatus).toUpperCase();
  
  let displayPaymentStatus;
  if (["DELIVERY_CONFIRMED", "READY_FOR_DELIVERY", "IN_USE", "ACTIVE", "COMPLETED", "RETURNED", "DELIVERING"].includes(oStatus)) {
    displayPaymentStatus = "paid";
  } else {
    displayPaymentStatus = paymentStatus || "unpaid";
  }

  const s = String(displayPaymentStatus || "unpaid").toUpperCase();
  switch (s) {
    case "PAID":
      return <Tag color="green">Đã thanh toán</Tag>;
    case "UNPAID":
      return <Tag color="volcano">Chưa thanh toán</Tag>;
    case "PARTIAL":
      return <Tag color="purple">Thanh toán một phần</Tag>;
    case "REFUNDED":
      return <Tag color="geekblue">Đã hoàn tiền</Tag>;
    default:
      return <Tag color="volcano">Chưa thanh toán</Tag>;
  }
};

// Helper to normalize inline model data
const normalizeInlineModel = (inlineModel, deviceModelId) => {
  if (!inlineModel) return null;
  return {
    deviceModelId: inlineModel.deviceModelId || inlineModel.id || deviceModelId,
    deviceName: inlineModel.deviceName || inlineModel.name || `Model #${deviceModelId}`,
    brand: inlineModel.brand || "",
    category: inlineModel.category || "",
    imageUrl: inlineModel.imageUrl || inlineModel.image || "",
  };
};

export default function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kw, setKw] = useState("");
  const [range, setRange] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);

  // Drawer state
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [orderDetailModels, setOrderDetailModels] = useState({});

  const fetchAll = useCallback(async (page = 0, size = 10, searchOrderId = null) => {
    try {
      setLoading(true);
      
      let result;
      if (searchOrderId && !isNaN(Number(searchOrderId))) {
        // Search by orderId
        result = await searchRentalOrders({
          orderId: Number(searchOrderId),
          page: 0,
          size: 1,
        });
      } else {
        // Get all with pagination
        result = await listRentalOrders({ page, size });
      }

      // Handle paginated response
      if (result && typeof result === "object" && "content" in result) {
        const arr = Array.isArray(result.content) ? result.content.slice() : [];
        arr.sort((a, b) => {
          const ta = new Date(a?.createdAt || 0).getTime();
          const tb = new Date(b?.createdAt || 0).getTime();
          if (tb !== ta) return tb - ta;
          return (b?.orderId || 0) - (a?.orderId || 0);
        });
        setRows(arr);
        setTotalElements(result.totalElements || arr.length);
        setCurrentPage(result.number || page);
        setPageSize(result.size || size);
      } else {
        // Fallback for non-paginated response
        const arr = Array.isArray(result) ? result.slice() : [];
        arr.sort((a, b) => {
          const ta = new Date(a?.createdAt || 0).getTime();
          const tb = new Date(b?.createdAt || 0).getTime();
          if (tb !== ta) return tb - ta;
          return (b?.orderId || 0) - (a?.orderId || 0);
        });
        setRows(arr);
        setTotalElements(arr.length);
      }
    } catch (e) {
      message.error(
        e?.response?.data?.message ||
          e?.message ||
          "Không tải được danh sách đơn."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(0, pageSize);
  }, [fetchAll, pageSize]);

  const handleSearch = useCallback((value) => {
    setKw(value);
    if (value.trim() && !isNaN(Number(value.trim()))) {
      fetchAll(0, pageSize, value.trim());
    } else {
      fetchAll(0, pageSize);
    }
  }, [fetchAll, pageSize]);

  const handleTableChange = useCallback((pagination) => {
    const newPage = pagination.current - 1;
    const newSize = pagination.pageSize;
    setCurrentPage(newPage);
    setPageSize(newSize);
    fetchAll(newPage, newSize, kw.trim() && !isNaN(Number(kw.trim())) ? kw.trim() : null);
  }, [fetchAll, kw]);

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
      setCustomer(null);
      setKyc(null);
      setOrderDetailModels({});
      
      const d = await getRentalOrderById(orderId);
      setDetail(d);
      
      // Load customer info
      if (d?.customerId) {
        try {
          const c = await fetchCustomerById(d.customerId);
          setCustomer(normalizeCustomer(c) || c || null);
          
          // Load KYC info
          try {
            const kycData = await getKycByCustomerId(d.customerId);
            setKyc(normalizeKycItem(kycData) || kycData || null);
          } catch {
            setKyc(null);
          }
        } catch {
          setCustomer(null);
        }
      }

      // Load device models for order details
      if (d?.orderDetails && Array.isArray(d.orderDetails)) {
        const modelIds = [...new Set(
          d.orderDetails
            .map((od) => od?.deviceModelId)
            .filter(Boolean)
        )];
        
        const models = {};
        for (const modelId of modelIds) {
          try {
            const model = await getDeviceModelById(modelId);
            if (model) {
              models[modelId] = normalizeDeviceModel(model) || model;
            }
          } catch {
            // ignore
          }
        }
        setOrderDetailModels(models);
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

  // ====== Filters ======
  const filtered = useMemo(() => {
    let ds = rows;
    
    const isOrderIdSearch = kw.trim() && !isNaN(Number(kw.trim()));
    
    if (!isOrderIdSearch && kw.trim()) {
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
      render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "T/g thuê",
      dataIndex: "range",
      width: 220,
      render: (_, r) =>
        `${dayjs(r.planStartDate || r.startDate).format("DD/MM/YYYY")} → ${dayjs(r.planEndDate || r.endDate).format(
          "DD/MM/YYYY"
        )}`,
    },
    {
      title: "Số ngày",
      dataIndex: "days",
      width: 90,
      render: (_, r) => {
        const d =
          dayjs(r.planEndDate || r.endDate)
            .startOf("day")
            .diff(dayjs(r.planStartDate || r.startDate).startOf("day"), "day") || 1;
        return Math.max(1, d);
      },
    },
    {
      title: "Tổng tiền thuê",
      dataIndex: "totalPrice",
      width: 140,
      align: "right",
      render: (v) => fmtVND(v),
    },
    {
      title: "Tổng tiền cọc",
      dataIndex: "depositAmount",
      width: 140,
      align: "right",
      render: (v) => fmtVND(v),
    },
    {
      title: "Trạng thái",
      dataIndex: "orderStatus",
      width: 160,
      render: statusTag,
      filters: [
        { text: "Đang chờ", value: "PENDING" },
        { text: "Đã xác nhận", value: "CONFIRMED" },
        { text: "Đang xử lý", value: "PROCESSING" },
        { text: "Sẵn sàng giao hàng", value: "DELIVERY_C" },
        { text: "Đang sử dụng", value: "IN_USE" },
        { text: "Đã hủy", value: "CANCELLED" },
        { text: "Hoàn tất", value: "COMPLETED" },
      ],
      onFilter: (val, r) => {
        const orderStatus = String(r.orderStatus).toUpperCase();
        const filterVal = String(val).toUpperCase();
        if (filterVal === "DELIVERY_C") {
          return (
            orderStatus === "DELIVERY_C" ||
            orderStatus === "DELIVERY_CONFIRMED" ||
            orderStatus === "READY_FOR_DELIVERY"
          );
        }
        return orderStatus === filterVal;
      },
    },
    {
      title: "Thao tác",
      fixed: "right",
      width: 150,
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

  // ====== Order Detail Rows ======
  const orderDetailRows = useMemo(() => {
    if (!detail || !Array.isArray(detail.orderDetails)) return [];
    return detail.orderDetails.map((od) => {
      const orderDetailId = od?.orderDetailId ?? od?.id;
      const model =
        orderDetailModels[od?.deviceModelId] ||
        normalizeInlineModel(od?.deviceModel, od?.deviceModelId);
      return {
        ...od,
        _orderDetailId: orderDetailId,
        _model: model,
      };
    });
  }, [detail, orderDetailModels]);

  const detailDays = useMemo(() => {
    if (!detail) return 1;
    const startDate = detail.planStartDate || detail.startDate;
    const endDate = detail.planEndDate || detail.endDate;
    if (!startDate || !endDate) return detail.durationDays || 1;
    const d =
      dayjs(endDate)
        .startOf("day")
        .diff(dayjs(startDate).startOf("day"), "day") || 1;
    return Math.max(1, d);
  }, [detail]);

  // ====== Item Columns for Drawer ======
  const itemCols = [
    {
      title: "Chi tiết ID",
      dataIndex: "_orderDetailId",
      width: 100,
      render: (v) => v || "—",
    },
    {
      title: "Thiết bị",
      key: "product",
      render: (_, r) => {
        const model = r._model;
        const imageUrl = model?.imageUrl || model?.image || r?.deviceModel?.imageUrl || r?.deviceModel?.image;
        const deviceName = model?.deviceName || model?.name || r?.deviceModel?.deviceName || r?.deviceModel?.name || `Model #${r.deviceModelId}`;
        const modelId = model?.deviceModelId || r.deviceModelId;
        
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={deviceName}
                style={{ 
                  width: 48, 
                  height: 48, 
                  objectFit: "cover", 
                  borderRadius: 8,
                  border: "1px solid #f0f0f0"
                }}
              />
            ) : (
              <div style={{ 
                width: 48, 
                height: 48, 
                background: "#f5f5f5", 
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: 10
              }}>
                No img
              </div>
            )}
            <div>
              <div><strong>{deviceName}</strong></div>
              <Text type="secondary" style={{ fontSize: 12 }}>Mã mẫu: {modelId}</Text>
            </div>
          </div>
        );
      },
    },
    { 
      title: "Đơn giá SP/ngày", 
      dataIndex: "pricePerDay",
      width: 120,
      align: "right",
      render: (v) => fmtVND(v),
    },
    { 
      title: "Số ngày thuê", 
      key: "days",
      width: 100,
      align: "center",
      render: () => detailDays,
    },
    {
      title: "Tổng tiền thuê",
      key: "subtotal",
      width: 130,
      align: "right",
      render: (_, r) => {
        const subtotal = Number(r.pricePerDay || 0) * Number(r.quantity || 1) * detailDays;
        return <strong>{fmtVND(subtotal)}</strong>;
      },
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16, borderRadius: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Quản lý đơn hàng
            </Title>
            <Text type="secondary">
              Xem và quản lý tất cả đơn thuê thiết bị
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => fetchAll(currentPage, pageSize)}>
            Tải lại
          </Button>
        </div>
      </Card>

      <Card style={{ marginBottom: 16, borderRadius: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="Tìm mã đơn hoặc mã KH…"
            onSearch={handleSearch}
            allowClear
            style={{ width: 300 }}
          />
          <RangePicker value={range} onChange={setRange} format="DD/MM/YYYY" />
        </Space>
      </Card>

      <Card style={{ borderRadius: 16 }} bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            <Skeleton active paragraph={{ rows: 10 }} />
          </div>
        ) : (
          <Table
            rowKey="orderId"
            columns={columnsDef({
              onDelete: doDelete,
              onView,
            })}
            dataSource={filtered}
            pagination={{
              current: currentPage + 1,
              pageSize: pageSize,
              total: totalElements,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} đơn hàng`,
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* Drawer chi tiết */}
      <Drawer
        title={detail ? `Đơn thuê #${detail.orderId}` : "Chi tiết đơn"}
        open={open}
        width={900}
        onClose={() => setOpen(false)}
      >
        {loadingDetail ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : detail ? (
          <>
            <Tabs
              items={[
                {
                  key: "info",
                  label: "Thông tin đơn hàng",
                  children: (
                    <>
                      <Descriptions bordered size="small" column={2}>
                        <Descriptions.Item label="Mã đơn">
                          <strong>#{detail.orderId}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái đơn">
                          {statusTag(detail.orderStatus)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Thanh toán">
                          {paymentStatusTag(detail.paymentStatus, detail.orderStatus)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Ngày tạo">
                          {dayjs(detail.createdAt).format("DD/MM/YYYY HH:mm")}
                        </Descriptions.Item>
                        <Descriptions.Item label="Bắt đầu thuê">
                          {dayjs(detail.planStartDate || detail.startDate).format("DD/MM/YYYY")}
                        </Descriptions.Item>
                        <Descriptions.Item label="Kết thúc thuê">
                          {dayjs(detail.planEndDate || detail.endDate).format("DD/MM/YYYY")}
                        </Descriptions.Item>
                        <Descriptions.Item label="Số ngày thuê">
                          {detailDays} ngày
                        </Descriptions.Item>
                        <Descriptions.Item label="Địa chỉ giao">
                          {detail.shippingAddress || "—"}
                        </Descriptions.Item>
                      </Descriptions>

                      <Divider />

                      <Row gutter={16}>
                        <Col span={4}>
                          <Statistic title="Tiền thuê" value={fmtVND(detail.totalPrice)} />
                        </Col>
                        <Col span={4}>
                          <Statistic title="Tiền cọc" value={fmtVND(detail.depositAmount)} />
                        </Col>
                        <Col span={4}>
                          <Statistic 
                            title="Tổng thanh toán" 
                            value={fmtVND(Number(detail.totalPrice || 0) + Number(detail.depositAmount || 0))} 
                            valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                          />
                        </Col>
                        <Col span={4}>
                          <Statistic title="Cọc đã giữ" value={fmtVND(detail.depositAmountHeld)} />
                        </Col>
                        <Col span={4}>
                          <Statistic title="Cọc hoàn lại" value={fmtVND(detail.depositAmountRefunded)} />
                        </Col>
                      </Row>

                      <Divider />

                      <Title level={5}>Chi tiết sản phẩm</Title>
                      <Table
                        rowKey="_orderDetailId"
                        columns={itemCols}
                        dataSource={orderDetailRows}
                        pagination={false}
                        size="small"
                      />
                    </>
                  ),
                },
                {
                  key: "customer",
                  label: "Thông tin khách hàng",
                  children: (
                    <>
                      {customer ? (
                        <Descriptions bordered size="small" column={2}>
                          <Descriptions.Item label="Mã KH">
                            #{detail.customerId}
                          </Descriptions.Item>
                          <Descriptions.Item label="Họ tên">
                            {customer.fullName || customer.name || "—"}
                          </Descriptions.Item>
                          <Descriptions.Item label="Email">
                            {customer.email || "—"}
                          </Descriptions.Item>
                          <Descriptions.Item label="SĐT">
                            {customer.phoneNumber || customer.phone || "—"}
                          </Descriptions.Item>
                          <Descriptions.Item label="Địa chỉ" span={2}>
                            {customer.address || "—"}
                          </Descriptions.Item>
                          <Descriptions.Item label="KYC">
                            {kycStatusTag(kyc?.status || kyc?.kycStatus)}
                          </Descriptions.Item>
                        </Descriptions>
                      ) : (
                        <Text type="secondary">Không có thông tin khách hàng</Text>
                      )}
                    </>
                  ),
                },
              ]}
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
