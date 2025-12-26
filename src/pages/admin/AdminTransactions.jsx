// src/pages/admin/AdminTransactions.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Select,
  DatePicker,
  Input,
  Row,
  Col,
  Statistic,
  Empty,
  Modal,
  Descriptions,
  Divider,
  Image,
  Spin,
} from "antd";
import { ReloadOutlined, EyeOutlined, FileTextOutlined, DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getTransactions, getInvoiceByRentalOrderId } from "../../lib/Payment";
import { getSettlementByOrderId } from "../../lib/settlementApi";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const paymentMethodOptions = [
  { label: "Tất cả", value: "ALL" },
  { label: "VNPay", value: "VNPAY" },
  { label: "PayOS", value: "PAYOS" },
  { label: "Chuyển khoản ngân hàng", value: "BANK_ACCOUNT" },
];

const transactionTypeOptions = [
  { label: "Tất cả", value: "ALL" },
  { label: "Tiền vào", value: "TRANSACTION_IN" },
  { label: "Tiền ra", value: "TRANSACTION_OUT" },
];

const invoiceStatusOptions = [
  { label: "Tất cả", value: "ALL" },
  { label: "Thành công", value: "SUCCEEDED" },
  { label: "Đang xử lý", value: "PENDING" },
  { label: "Thất bại", value: "FAILED" },
];

const transactionTypeColor = {
  TRANSACTION_IN: "green",
  TRANSACTION_OUT: "volcano",
};

const invoiceStatusColor = {
  SUCCEEDED: "green",
  PENDING: "orange",
  FAILED: "red",
  CANCELLED: "red",
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });

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

// Helper: Translate payment method
const translatePaymentMethod = (method) => {
  const map = {
    VNPAY: "VNPay",
    PAYOS: "PayOS",
    BANK_ACCOUNT: "Chuyển khoản ngân hàng",
    CASH: "Tiền mặt",
  };
  return map[method] || method;
};

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [transactionType, setTransactionType] = useState("ALL");
  const [invoiceStatus, setInvoiceStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState([]);

  // Invoice modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [settlement, setSettlement] = useState(null);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTransactions();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load transactions", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Không thể tải danh sách giao dịch."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const methodMatch =
        paymentMethod === "ALL" ||
        String(t.paymentMethod || "").toUpperCase() === paymentMethod;
      const typeMatch =
        transactionType === "ALL" ||
        String(t.transactionType || "").toUpperCase() === transactionType;
      const statusMatch =
        invoiceStatus === "ALL" ||
        String(t.invoiceStatus || "").toUpperCase() === invoiceStatus;

      let dateMatch = true;
      if (dateRange.length === 2) {
        const created = t.createdAt ? dayjs(t.createdAt) : null;
        const startDate = dateRange[0] ? dayjs(dateRange[0]).startOf("day") : null;
        const endDate = dateRange[1] ? dayjs(dateRange[1]).endOf("day") : null;
        const createdTs = created?.valueOf();
        const startTs = startDate?.valueOf();
        const endTs = endDate?.valueOf();

        dateMatch =
          created &&
          (!startTs || createdTs >= startTs) &&
          (!endTs || createdTs <= endTs);
      }

      const keyword = search.trim().toLowerCase();
      const keywordMatch =
        !keyword ||
        String(t.transactionId || "").toLowerCase().includes(keyword) ||
        String(t.invoiceId || "").toLowerCase().includes(keyword) ||
        String(t.rentalOrderId || "").toLowerCase().includes(keyword) ||
        String(t.paymentMethod || "").toLowerCase().includes(keyword);

      return methodMatch && typeMatch && statusMatch && dateMatch && keywordMatch;
    });
  }, [transactions, paymentMethod, transactionType, invoiceStatus, dateRange, search]);

  const totalAmountIn = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => String(tx.transactionType || "").toUpperCase() === "TRANSACTION_IN")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [filteredTransactions]
  );

  const totalAmountOut = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => String(tx.transactionType || "").toUpperCase() === "TRANSACTION_OUT")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [filteredTransactions]
  );

  const columns = [
    {
      title: "Transaction ID",
      dataIndex: "transactionId",
      key: "transactionId",
      width: 130,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (value) =>
        value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—",
      width: 180,
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      key: "amount",
      render: (value) => <Text strong>{formatCurrency(value)}</Text>,
      width: 140,
    },
    {
      title: "Loại giao dịch",
      dataIndex: "transactionType",
      key: "transactionType",
      render: (value) => {
        const label =
          String(value || "")
            .replace("TRANSACTION_", "")
            .replace("_", " ")
            .toUpperCase() || "—";
        return (
          <Tag color={transactionTypeColor[String(value || "").toUpperCase()]}>
            {label === "IN" ? "TIỀN VÀO" : label === "OUT" ? "TIỀN RA" : label}
          </Tag>
        );
      },
      width: 150,
    },
    {
      title: "Phương thức",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      render: (value) => translatePaymentMethod(value),
      width: 180,
    },
    {
      title: "Trạng thái hóa đơn",
      dataIndex: "invoiceStatus",
      key: "invoiceStatus",
      render: (value) => {
        const status = String(value || "").toUpperCase();
        const color = invoiceStatusColor[status] || "default";
        const label =
          status === "SUCCEEDED"
            ? "THÀNH CÔNG"
            : status === "PENDING"
            ? "ĐANG XỬ LÝ"
            : status === "FAILED"
            ? "THẤT BẠI"
            : status || "—";
        return <Tag color={color}>{label}</Tag>;
      },
      width: 160,
    },
    {
      title: "Mã đơn hàng",
      dataIndex: "rentalOrderId",
      key: "rentalOrderId",
      width: 140,
    },
    {
      title: "Người tạo",
      dataIndex: "createdBy",
      key: "createdBy",
      render: (value) => value || "—",
      width: 140,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_, record) => {
        // Only show "Xem hóa đơn" if transaction has rentalOrderId
        if (!record.rentalOrderId) {
          return <Text type="secondary">—</Text>;
        }
        return (
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewInvoice(record)}
          >
            Xem hóa đơn
          </Button>
        );
      },
    },
  ];

  // Handle view invoice
  const handleViewInvoice = async (transaction) => {
    if (!transaction.rentalOrderId) {
      toast.error("Giao dịch này không có đơn hàng liên quan.");
      return;
    }

    try {
      setLoadingInvoice(true);
      setInvoiceModalOpen(true);
      setSelectedInvoice(null);

      // Fetch invoice details by rentalOrderId
      const invoiceResult = await getInvoiceByRentalOrderId(transaction.rentalOrderId);
      
      // API may return a single invoice object or an array of invoices
      let invoicesArray = [];
      if (Array.isArray(invoiceResult)) {
        invoicesArray = invoiceResult;
      } else if (invoiceResult && (invoiceResult.invoiceId || invoiceResult.id)) {
        invoicesArray = [invoiceResult];
      }

      // If transaction has invoiceId, try to find matching invoice
      if (transaction.invoiceId && invoicesArray.length > 0) {
        const matchedInvoice = invoicesArray.find((inv) => {
          const invId = inv.invoiceId || inv.id;
          const txInvoiceId = transaction.invoiceId;
          return (
            invId === txInvoiceId ||
            String(invId) === String(txInvoiceId) ||
            Number(invId) === Number(txInvoiceId)
          );
        });
        
        if (matchedInvoice) {
          setSelectedInvoice(matchedInvoice);
        } else if (invoicesArray.length > 0) {
          // If no exact match, use the first invoice
          setSelectedInvoice(invoicesArray[0]);
        }
      } else if (invoicesArray.length > 0) {
        // If no invoiceId in transaction, use the first invoice
        setSelectedInvoice(invoicesArray[0]);
      } else {
        toast.warning("Không tìm thấy hóa đơn cho đơn hàng này.");
      }

      // Fetch settlement if this is an outgoing transaction (TRANSACTION_OUT)
      if (String(transaction.transactionType || "").toUpperCase() === "TRANSACTION_OUT" && transaction.rentalOrderId) {
        try {
          const settlementResponse = await getSettlementByOrderId(transaction.rentalOrderId);
          const settlementData = settlementResponse?.data ?? settlementResponse ?? null;
          setSettlement(settlementData);
        } catch (error) {
          console.warn("Could not load settlement:", error);
          setSettlement(null);
        }
      } else {
        setSettlement(null);
      }
    } catch (error) {
      console.error("Error loading invoice:", error);
      toast.error(error?.response?.data?.message || error?.message || "Không thể tải thông tin hóa đơn.");
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Handle download invoice PDF
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

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Title level={3} style={{ margin: 0 }}>
            Quản lý giao dịch thanh toán
          </Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadTransactions} loading={loading}>
              Tải lại
            </Button>
          </Space>
        </Space>

        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Statistic
                title="Tổng giao dịch"
                value={filteredTransactions.length}
              />
            </Col>
            <Col xs={24} md={6}>
              <Statistic
                title="Tổng tiền vào"
                value={formatCurrency(totalAmountIn)}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col xs={24} md={6}>
              <Statistic
                title="Tổng tiền ra"
                value={formatCurrency(totalAmountOut)}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                * Số liệu thống kê dựa trên bộ lọc hiện tại.
              </Text>
            </Col>
          </Row>
        </Card>

        <Card title="Bộ lọc">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8} lg={6}>
              <Text>Tìm kiếm (Giao dịch/Hóa đơn/Đơn thuê)</Text>
              <Input
                placeholder="Nhập mã giao dịch, hóa đơn hoặc đơn thuê..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} md={8} lg={6}>
              <Text>Phương thức</Text>
              <Select
                options={paymentMethodOptions}
                value={paymentMethod}
                onChange={setPaymentMethod}
                style={{ width: "100%" }}
              />
            </Col>
            <Col xs={24} md={8} lg={6}>
              <Text>Loại giao dịch</Text>
              <Select
                options={transactionTypeOptions}
                value={transactionType}
                onChange={setTransactionType}
                style={{ width: "100%" }}
              />
            </Col>
            <Col xs={24} md={8} lg={6}>
              <Text>Trạng thái hóa đơn</Text>
              <Select
                options={invoiceStatusOptions}
                value={invoiceStatus}
                onChange={setInvoiceStatus}
                style={{ width: "100%" }}
              />
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Text>Khoảng thời gian</Text>
              <RangePicker
                style={{ width: "100%" }}
                value={dateRange}
                onChange={(range) => setDateRange(range || [])}
                allowClear
              />
            </Col>
          </Row>
        </Card>

        <Card>
          <Table
            rowKey={(record) => record.transactionId || `${record.invoiceId}-${record.createdAt}`}
            columns={columns}
            dataSource={filteredTransactions}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            locale={{
              emptyText: (
                <Empty description="Không có giao dịch nào phù hợp với bộ lọc." />
              ),
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </Space>

      {/* Invoice Detail Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>Chi tiết hóa đơn #{selectedInvoice?.invoiceId || "—"}</span>
          </Space>
        }
        open={invoiceModalOpen}
        onCancel={() => {
          setInvoiceModalOpen(false);
          setSelectedInvoice(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setInvoiceModalOpen(false);
            setSelectedInvoice(null);
          }}>
            Đóng
          </Button>,
          selectedInvoice && (selectedInvoice.pdfUrl || selectedInvoice.proofUrl) && (
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
                  const status = String(selectedInvoice.invoiceStatus || "").toUpperCase();
                  const color = invoiceStatusColor[status] || "default";
                  const label =
                    status === "SUCCEEDED"
                      ? "THÀNH CÔNG"
                      : status === "PENDING"
                      ? "ĐANG XỬ LÝ"
                      : status === "FAILED"
                      ? "THẤT BẠI"
                      : status === "CANCELLED"
                      ? "ĐÃ HỦY"
                      : status || "—";
                  return <Tag color={color}>{label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Phương thức thanh toán">
                {translatePaymentMethod(selectedInvoice.paymentMethod)}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày thanh toán">
                {selectedInvoice.paymentDate
                  ? dayjs(selectedInvoice.paymentDate).format("DD/MM/YYYY HH:mm")
                  : "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions bordered column={1} size="small">
              {/* Hiển thị khác nhau tùy theo loại hóa đơn */}
              {String(selectedInvoice.invoiceType || "").toUpperCase() === "DEPOSIT_REFUND" ? (
                <>
                  {/* Cho hóa đơn hoàn cọc */}
                  <Descriptions.Item label="Tổng tiền cọc">
                    {formatCurrency(selectedInvoice.depositApplied || 0)}
                  </Descriptions.Item>
                  {(selectedInvoice.subTotal > 0) && (
                    <Descriptions.Item label="Phí khấu trừ (hư hỏng)">
                      <Text type="danger">{formatCurrency(selectedInvoice.subTotal || 0)}</Text>
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="Số tiền đã hoàn cho khách">
                    <Text strong style={{ fontSize: 18, color: "#1890ff" }}>
                      {formatCurrency(selectedInvoice.totalAmount || 0)}
                    </Text>
                  </Descriptions.Item>
                </>
              ) : (
                <>
                  {/* Cho các loại hóa đơn khác */}
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
                </>
              )}
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

            {/* Hiển thị thông tin quyết toán cho giao dịch TIỀN RA */}
            {settlement && (
              <>
                <Divider />
                <Title level={5}>Quyết toán hiện có</Title>
                {(() => {
                  const totalDeposit = settlement.totalDeposit || 0;
                  const damageFee = settlement.damageFee || 0;
                  const lateFee = settlement.lateFee || 0;
                  const accessoryFee = settlement.accessoryFee || 0;
                  const finalReturnAmount = settlement.finalReturnAmount ?? settlement.finalAmount ?? 0;
                  const refundAmount = finalReturnAmount > 0 ? finalReturnAmount : 0;
                  const customerDueAmount = finalReturnAmount < 0 ? Math.abs(finalReturnAmount) : 0;

                  return (
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="Tổng tiền cọc">
                        {formatCurrency(totalDeposit)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phí hư hỏng">
                        {formatCurrency(damageFee)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phí trễ">
                        {formatCurrency(lateFee)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phí phụ kiện">
                        {formatCurrency(accessoryFee)}
                      </Descriptions.Item>

                      {refundAmount > 0 && (
                        <Descriptions.Item label="Số tiền cần hoàn cho khách">
                          <Text strong style={{ color: "#1d4ed8" }}>
                            {formatCurrency(refundAmount)}
                          </Text>
                        </Descriptions.Item>
                      )}

                      {customerDueAmount > 0 && (
                        <Descriptions.Item label="Số tiền đền bù khách cần thanh toán thêm">
                          <Text strong style={{ color: "#dc2626" }}>
                            {formatCurrency(customerDueAmount)}
                          </Text>
                        </Descriptions.Item>
                      )}

                      <Descriptions.Item label="Trạng thái">
                        {(() => {
                          const stateMap = {
                            draft: { label: "Nháp", color: "default" },
                            pending: { label: "Chờ xử lý", color: "gold" },
                            approved: { label: "Đã duyệt", color: "cyan" },
                            submitted: { label: "Đã gửi", color: "blue" },
                            issued: { label: "Đã chấp nhận", color: "green" },
                            closed: { label: "Đã tất toán", color: "geekblue" },
                            rejected: { label: "Đã từ chối", color: "red" },
                          };
                          const key = String(settlement.state || "").toLowerCase();
                          const info = stateMap[key] || {
                            label: settlement.state || "—",
                            color: "default",
                          };
                          return <Tag color={info.color}>{info.label}</Tag>;
                        })()}
                      </Descriptions.Item>
                    </Descriptions>
                  );
                })()}

                {/* Hiển thị chi tiết thiết bị hư hỏng */}
                {settlement?.damageDetails && settlement.damageDetails.length > 0 && (
                  <>
                    <Divider />
                    <Title level={5}>Chi tiết thiết bị hư hỏng</Title>
                    <Table
                      size="small"
                      dataSource={settlement.damageDetails}
                      pagination={false}
                      rowKey={(record) => record.discrepancyReportId || record.refId}
                      columns={[
                        {
                          title: "Thiết bị",
                          key: "device",
                          render: (_, record) => (
                            <div>
                              <div style={{ fontWeight: 500 }}>{record.deviceModelName || "—"}</div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                SN: {record.serialNumber || "—"}
                              </Text>
                            </div>
                          ),
                        },
                        {
                          title: "Loại sự cố",
                          dataIndex: "discrepancyType",
                          key: "discrepancyType",
                          width: 120,
                          render: (type) => {
                            const typeMap = {
                              DAMAGE: { label: "Hư hỏng", color: "orange" },
                              LOSS: { label: "Mất mát", color: "red" },
                              OTHER: { label: "Khác", color: "default" },
                            };
                            const info = typeMap[type] || { label: type || "—", color: "default" };
                            return <Tag color={info.color}>{info.label}</Tag>;
                          },
                        },
                        {
                          title: "Tình trạng",
                          dataIndex: "conditionName",
                          key: "conditionName",
                          width: 180,
                        },
                        {
                          title: "Phí phạt",
                          dataIndex: "penaltyAmount",
                          key: "penaltyAmount",
                          width: 120,
                          align: "right",
                          render: (amount) => (
                            <Text strong style={{ color: "#dc2626" }}>
                              {formatCurrency(amount || 0)}
                            </Text>
                          ),
                        },
                        {
                          title: "Nguồn",
                          dataIndex: "createdFrom",
                          key: "createdFrom",
                          width: 120,
                          render: (source) => {
                            const sourceMap = {
                              HANDOVER_REPORT: { label: "Biên bản", color: "blue" },
                              QC_REPORT: { label: "QC Report", color: "green" },
                            };
                            const info = sourceMap[source] || { label: source || "—", color: "default" };
                            return <Tag color={info.color}>{info.label}</Tag>;
                          },
                        },
                      ]}
                      summary={(pageData) => {
                        const total = pageData.reduce((sum, record) => sum + (record.penaltyAmount || 0), 0);
                        return (
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={3} align="right">
                                <Text strong>Tổng phí hư hỏng:</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={1} align="right">
                                <Text strong style={{ color: "#dc2626", fontSize: 14 }}>
                                  {formatCurrency(total)}
                                </Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={2} />
                            </Table.Summary.Row>
                          </Table.Summary>
                        );
                      }}
                    />
                  </>
                )}
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

