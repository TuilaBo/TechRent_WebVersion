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
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getTransactions } from "../../lib/Payment";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const paymentMethodOptions = [
  { label: "Tất cả", value: "ALL" },
  { label: "VNPay", value: "VNPAY" },
  { label: "PayOS", value: "PAYOS" },
];

const transactionTypeOptions = [
  { label: "Tất cả", value: "ALL" },
  { label: "Tiền vào", value: "TRANSACTION_IN" },
  { label: "Tiền ra", value: "TRANSACTION_OUT" },
];

const invoiceStatusOptions = [
  { label: "Tất cả", value: "ALL" },
  { label: "Succeeded", value: "SUCCEEDED" },
  { label: "Pending", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
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

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [transactionType, setTransactionType] = useState("ALL");
  const [invoiceStatus, setInvoiceStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState([]);

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
      render: (value) => (value ? value.toUpperCase() : "—"),
      width: 120,
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
  ];

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
              <Text>Tìm kiếm (Transaction/Invoice/Order)</Text>
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
            scroll={{ x: 1000 }}
          />
        </Card>
      </Space>
    </div>
  );
}

