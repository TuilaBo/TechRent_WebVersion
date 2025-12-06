// src/pages/Customer/CustomerInvoice.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Image,
  Modal,
  Descriptions,
  Divider,
  Empty,
  Spin,
  Row,
  Col,
  Statistic,
  Select,
} from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import { getInvoices, getInvoiceByRentalOrderId } from "../../lib/Payment";
import { listRentalOrders } from "../../lib/rentalOrdersApi";
import dayjs from "dayjs";

const { Title, Text } = Typography;

// Helper: Format currency VND
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount || 0);
};

// Helper: Translate invoice type
const translateInvoiceType = (type) => {
  const map = {
    RENT_PAYMENT: "Thanh toán đơn thuê",
    DEPOSIT: "Đặt cọc",
    DEPOSIT_REFUND: "Hoàn cọc",
    DAMAGE_FEE: "Phí hư hỏng",
    LATE_FEE: "Phí trễ",
    ACCESSORY_FEE: "Phí phụ kiện",
  };
  return map[type] || type;
};

// Helper: Translate invoice status
const translateInvoiceStatus = (status) => {
  const map = {
    PENDING: { text: "Chờ thanh toán", color: "orange" },
    PROCESSING: { text: "Đang xử lý", color: "blue" },
    SUCCEEDED: { text: "Thành công", color: "green" },
    FAILED: { text: "Thất bại", color: "red" },
    CANCELLED: { text: "Đã hủy", color: "default" },
  };
  return map[status] || { text: status, color: "default" };
};

// Helper: Translate payment method
const translatePaymentMethod = (method) => {
  const map = {
    VNPAY: "VNPay",
    PAYOS: "PayOS",
    BANK_ACCOUNT: "Chuyển khoản",
    CASH: "Tiền mặt",
  };
  return map[method] || method;
};

export default function CustomerInvoice() {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  
  // Filters
  const [filterOrderId, setFilterOrderId] = useState(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState(null);
  const [filterInvoiceType, setFilterInvoiceType] = useState(null);

  // Load invoices and orders
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [invoicesData, ordersData] = await Promise.all([
          getInvoices(),
          listRentalOrders(),
        ]);
        
        // Handle response format
        const invoicesArray = Array.isArray(invoicesData)
          ? invoicesData
          : Array.isArray(invoicesData?.data)
          ? invoicesData.data
          : [];
        
        const ordersArray = Array.isArray(ordersData)
          ? ordersData
          : Array.isArray(ordersData?.data)
          ? ordersData.data
          : [];
        
        console.log("📊 CustomerInvoice - Loaded data:", {
          invoicesCount: invoicesArray.length,
          ordersCount: ordersArray.length,
          invoices: invoicesArray,
          orders: ordersArray,
        });
        
        setInvoices(invoicesArray);
        setOrders(ordersArray);
      } catch (error) {
        console.error("Error loading invoices:", error);
        toast.error(error?.message || "Không thể tải lịch sử giao dịch");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Group invoices by rental order
  const invoicesByOrder = useMemo(() => {
    const grouped = {};
    invoices.forEach((invoice) => {
      const orderId = invoice.rentalOrderId || invoice.orderId;
      if (orderId) {
        if (!grouped[orderId]) {
          grouped[orderId] = [];
        }
        grouped[orderId].push(invoice);
      }
    });
    return grouped;
  }, [invoices]);

  // Get order info helper
  const getOrderInfo = useCallback((orderId) => {
    return orders.find(
      (o) =>
        o.orderId === orderId ||
        o.rentalOrderId === orderId ||
        o.id === orderId
    );
  }, [orders]);

  // Handle view invoice details
  const handleViewInvoice = async (invoice) => {
    // Set invoice immediately to show data we already have
    setSelectedInvoice(invoice);
    setViewModalOpen(true);
    
    // Load full invoice details to get complete data (like proofUrl, etc.)
    // Only reload if we have rentalOrderId
    if (invoice.rentalOrderId) {
      try {
        setLoadingInvoice(true);
        const invoiceResult = await getInvoiceByRentalOrderId(invoice.rentalOrderId);
        
        console.log("📄 CustomerInvoice - Loaded invoice details:", {
          invoiceId: invoice.invoiceId || invoice.id,
          rentalOrderId: invoice.rentalOrderId,
          result: invoiceResult,
        });
        
        // API may return a single invoice object or an array of invoices
        let invoicesArray = [];
        if (Array.isArray(invoiceResult)) {
          invoicesArray = invoiceResult;
        } else if (invoiceResult && (invoiceResult.invoiceId || invoiceResult.id)) {
          invoicesArray = [invoiceResult];
        }
        
        // Find the invoice that matches the current invoiceId
        // Compare as both string and number to handle type mismatches
        const currentInvoiceId = invoice.invoiceId || invoice.id;
        const matchedInvoice = invoicesArray.find((inv) => {
          const invId = inv.invoiceId || inv.id;
          return (
            invId === currentInvoiceId ||
            String(invId) === String(currentInvoiceId) ||
            Number(invId) === Number(currentInvoiceId)
          );
        });
        
        // Use matched invoice if found, otherwise keep current invoice
        if (matchedInvoice) {
          console.log("✅ CustomerInvoice - Found matching invoice:", matchedInvoice);
          setSelectedInvoice(matchedInvoice);
        } else {
          console.warn("⚠️ CustomerInvoice - No matching invoice found, keeping current:", {
            currentInvoiceId,
            availableIds: invoicesArray.map((inv) => inv.invoiceId || inv.id),
          });
          // Keep the current invoice (it already has data from tableData)
        }
      } catch (error) {
        console.error("❌ CustomerInvoice - Error loading invoice details:", error);
        // Keep the current invoice even if loading fails
      } finally {
        setLoadingInvoice(false);
      }
    }
  };

  // Handle download invoice (if PDF URL available)
  const handleDownloadInvoice = (invoice) => {
    const pdfUrl = invoice.pdfUrl || invoice.proofUrl;
    if (pdfUrl) {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `invoice-${invoice.invoiceId || invoice.id}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.error("Không có file PDF để tải");
    }
  };

  // Table columns
  const columns = [
    {
      title: "Mã hóa đơn",
      dataIndex: "invoiceId",
      width: 120,
      render: (_, record) => `#${record.invoiceId || record.id || "—"}`,
    },
    {
      title: "Mã đơn hàng",
      dataIndex: "rentalOrderId",
      width: 120,
      render: (orderId) => (orderId ? `#${orderId}` : "—"),
    },
    {
      title: "Loại hóa đơn",
      dataIndex: "invoiceType",
      width: 150,
      render: (type) => (
        <Tag color="blue">{translateInvoiceType(type) || type}</Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "invoiceStatus",
      width: 130,
      render: (status) => {
        const mapped = translateInvoiceStatus(status);
        return <Tag color={mapped.color}>{mapped.text}</Tag>;
      },
    },
    {
      title: "Phương thức",
      dataIndex: "paymentMethod",
      width: 120,
      render: (method) => translatePaymentMethod(method) || "—",
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      width: 150,
      align: "right",
      render: (amount) => (
        <Text strong style={{ color: amount > 0 ? "#52c41a" : "#ff4d4f" }}>
          {formatCurrency(amount)}
        </Text>
      ),
    },
    {
      title: "Ngày thanh toán",
      dataIndex: "paymentDate",
      width: 150,
      render: (date) =>
        date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "—",
    },
    {
      title: "Thao tác",
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewInvoice(record)}
          >
            Xem
          </Button>
          {(record.pdfUrl || record.proofUrl) && (
            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownloadInvoice(record)}
            >
              Tải
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const orderIds = new Set();
    const paymentMethods = new Set();
    const invoiceTypes = new Set();
    
    invoices.forEach((invoice) => {
      const orderId = invoice.rentalOrderId || invoice.orderId;
      if (orderId) orderIds.add(orderId);
      if (invoice.paymentMethod) paymentMethods.add(invoice.paymentMethod);
      if (invoice.invoiceType) invoiceTypes.add(invoice.invoiceType);
    });
    
    return {
      orderIds: Array.from(orderIds).sort((a, b) => Number(b) - Number(a)),
      paymentMethods: Array.from(paymentMethods).sort(),
      invoiceTypes: Array.from(invoiceTypes).sort(),
    };
  }, [invoices]);

  // Prepare table data - group by order
  const allTableData = useMemo(() => {
    const result = [];
    Object.keys(invoicesByOrder).forEach((orderId) => {
      const orderInvoices = invoicesByOrder[orderId];
      const order = getOrderInfo(Number(orderId));
      
      orderInvoices.forEach((invoice, index) => {
        result.push({
          ...invoice,
          key: `order-${orderId}-invoice-${invoice.invoiceId || index}`,
          orderInfo: order,
        });
      });
    });
    
    // Sort by payment date (newest first)
    return result.sort((a, b) => {
      const dateA = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
      const dateB = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [invoicesByOrder, getOrderInfo]);

  // Filter table data based on selected filters
  const tableData = useMemo(() => {
    let filtered = allTableData;
    
    // Filter by order ID
    if (filterOrderId) {
      filtered = filtered.filter((item) => {
        const orderId = item.rentalOrderId || item.orderId;
        return orderId === filterOrderId || String(orderId) === String(filterOrderId);
      });
    }
    
    // Filter by payment method
    if (filterPaymentMethod) {
      filtered = filtered.filter((item) => item.paymentMethod === filterPaymentMethod);
    }
    
    // Filter by invoice type
    if (filterInvoiceType) {
      filtered = filtered.filter((item) => item.invoiceType === filterInvoiceType);
    }
    
    return filtered;
  }, [allTableData, filterOrderId, filterPaymentMethod, filterInvoiceType]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = invoices.length;
    const succeeded = invoices.filter(
      (inv) => String(inv.invoiceStatus || "").toUpperCase() === "SUCCEEDED"
    ).length;
    const totalAmount = invoices.reduce(
      (sum, inv) => sum + (Number(inv.totalAmount) || 0),
      0
    );
    return { total, succeeded, totalAmount };
  }, [invoices]);

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "#f5f5f5" }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          Lịch sử giao dịch
        </Title>
        <Text type="secondary">
          Xem tất cả hóa đơn và giao dịch của bạn
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng hóa đơn"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Đã thanh toán"
              value={stats.succeeded}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng tiền"
              value={formatCurrency(stats.totalAmount)}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Invoices Table */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>Danh sách hóa đơn</span>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={async () => {
              try {
                setLoading(true);
                const invoicesData = await getInvoices();
                const invoicesArray = Array.isArray(invoicesData)
                  ? invoicesData
                  : Array.isArray(invoicesData?.data)
                  ? invoicesData.data
                  : [];
                setInvoices(invoicesArray);
                toast.success("Đã tải lại danh sách hóa đơn");
              } catch (error) {
                toast.error(error?.message || "Không thể tải lại");
              } finally {
                setLoading(false);
              }
            }}
          >
            Tải lại
          </Button>
        }
      >
        {/* Filters */}
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Select
            placeholder="Lọc theo đơn hàng"
            allowClear
            style={{ minWidth: 180 }}
            value={filterOrderId}
            onChange={setFilterOrderId}
            showSearch
            filterOption={(input, option) =>
              String(option?.label || "").toLowerCase().includes(input.toLowerCase())
            }
          >
            {filterOptions.orderIds.map((orderId) => {
              const order = getOrderInfo(Number(orderId));
              const displayId = order?.rentalOrderCode || order?.orderCode || order?.displayId || orderId;
              return (
                <Select.Option key={orderId} value={orderId} label={`Đơn #${displayId}`}>
                  Đơn #{displayId}
                </Select.Option>
              );
            })}
          </Select>

          <Select
            placeholder="Lọc theo phương thức thanh toán"
            allowClear
            style={{ minWidth: 200 }}
            value={filterPaymentMethod}
            onChange={setFilterPaymentMethod}
          >
            {filterOptions.paymentMethods.map((method) => (
              <Select.Option key={method} value={method}>
                {translatePaymentMethod(method)}
              </Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Lọc theo loại hóa đơn"
            allowClear
            style={{ minWidth: 200 }}
            value={filterInvoiceType}
            onChange={setFilterInvoiceType}
          >
            {filterOptions.invoiceTypes.map((type) => (
              <Select.Option key={type} value={type}>
                {translateInvoiceType(type)}
              </Select.Option>
            ))}
          </Select>

          {(filterOrderId || filterPaymentMethod || filterInvoiceType) && (
            <Button
              onClick={() => {
                setFilterOrderId(null);
                setFilterPaymentMethod(null);
                setFilterInvoiceType(null);
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {tableData.length === 0 ? (
          <Empty
            description="Chưa có hóa đơn nào"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tableData}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* Invoice Detail Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>Chi tiết hóa đơn #{selectedInvoice?.invoiceId || "—"}</span>
          </Space>
        }
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setSelectedInvoice(null);
        }}
        footer={[
          <Button key="close" onClick={() => setViewModalOpen(false)}>
            Đóng
          </Button>,
          (selectedInvoice?.pdfUrl || selectedInvoice?.proofUrl) && (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadInvoice(selectedInvoice)}
            >
              Tải hóa đơn
            </Button>
          ),
        ]}
        width={800}
      >
        {loadingInvoice ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : selectedInvoice ? (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Mã hóa đơn" span={2}>
                <Text strong>#{selectedInvoice.invoiceId || selectedInvoice.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Mã đơn hàng">
                {selectedInvoice.rentalOrderId
                  ? `#${selectedInvoice.rentalOrderId}`
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Loại hóa đơn">
                <Tag color="blue">
                  {translateInvoiceType(selectedInvoice.invoiceType)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {(() => {
                  const mapped = translateInvoiceStatus(
                    selectedInvoice.invoiceStatus
                  );
                  return <Tag color={mapped.color}>{mapped.text}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Phương thức thanh toán">
                {translatePaymentMethod(selectedInvoice.paymentMethod)}
              </Descriptions.Item>
              {/* <Descriptions.Item label="Ngày phát hành">
                {selectedInvoice.issueDate
                  ? dayjs(selectedInvoice.issueDate).format("DD/MM/YYYY HH:mm")
                  : "—"}
              </Descriptions.Item> */}
              <Descriptions.Item label="Ngày thanh toán">
                {selectedInvoice.paymentDate
                  ? dayjs(selectedInvoice.paymentDate).format("DD/MM/YYYY HH:mm")
                  : "—"}
              </Descriptions.Item>
              {/* <Descriptions.Item label="Hạn thanh toán">
                {selectedInvoice.dueDate
                  ? dayjs(selectedInvoice.dueDate).format("DD/MM/YYYY HH:mm")
                  : "—"}
              </Descriptions.Item> */}
            </Descriptions>

            <Divider />

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Tổng tiền">
                <Text strong>{formatCurrency(selectedInvoice.subTotal || 0)}</Text>
              </Descriptions.Item>
              {selectedInvoice.depositApplied && (
                <Descriptions.Item label="Cọc đã áp dụng">
                  {formatCurrency(selectedInvoice.depositApplied)}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Tổng thanh toán">
                <Text strong style={{ fontSize: 18, color: "#1890ff" }}>
                  {formatCurrency(selectedInvoice.totalAmount || 0)}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            {selectedInvoice.proofUrl && (
              <>
                <Divider />
                <div>
                  <Text strong style={{ display: "block", marginBottom: 12 }}>
                    Ảnh bằng chứng thanh toán
                  </Text>
                  <Image
                    src={selectedInvoice.proofUrl}
                    alt="Proof"
                    style={{ maxWidth: "100%", borderRadius: 8 }}
                    preview={{
                      mask: "Xem ảnh",
                    }}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <Empty description="Không có thông tin hóa đơn" />
        )}
      </Modal>
    </div>
  );
}

