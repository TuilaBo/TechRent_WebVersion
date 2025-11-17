// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Typography,
  Card,
  Row,
  Col,
  Space,
  Statistic,
  Tag,
  Table,
  Divider,
  List,
  Avatar,
  Progress,
  Segmented,
  Button,
  Spin,
  Alert,
  Empty,
  Drawer,
  Descriptions,
} from "antd";
import {
  ArrowUpOutlined,
  DollarCircleOutlined,
  ShoppingOutlined,
  SecurityScanOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { getTransactions } from "../../lib/Payment";
import { listRentalOrders, getRentalOrderById } from "../../lib/rentalOrdersApi";
import { listAllKycs } from "../../lib/kycApi";

const { Title, Text } = Typography;

const SUCCESS_PAYMENT_STATUSES = new Set([
  "SUCCEEDED",
  "PAID",
  "COMPLETED",
  "SUCCESS",
  "SUCCESSFUL",
]);

const ORDER_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  pending_kyc: "Chờ KYC",
  processing: "Đang xử lý",
  ready_for_delivery: "Sẵn sàng giao",
  delivering: "Đang giao",
  in_use: "Đang sử dụng",
  delivery_confirmed: "Đã giao",
  active: "Đang thuê",
  returned: "Đã trả",
  cancelled: "Đã hủy",
};

const ORDER_STATUS_TAG = {
  pending: "default",
  pending_kyc: "orange",
  processing: "purple",
  ready_for_delivery: "cyan",
  delivering: "geekblue",
  in_use: "blue",
  delivery_confirmed: "green",
  active: "gold",
  returned: "green",
  cancelled: "red",
};

const KYC_PIE_COLORS = ["#22c55e", "#f97316", "#9ca3af"];

const TRANSACTION_STATUS_TAG = {
  SUCCEEDED: "green",
  PAID: "green",
  COMPLETED: "green",
  SUCCESS: "green",
  SUCCESSFUL: "green",
  PENDING: "gold",
  PROCESSING: "blue",
  FAILED: "red",
  CANCELLED: "red",
  CANCELED: "red",
  EXPIRED: "volcano",
};

const ATTENTION_STATUSES = new Set(["pending", "pending_kyc", "processing"]);

function formatVND(value = 0) {
  try {
    return Number(value).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
    });
  } catch {
    return `${value}đ`;
  }
}

function formatAxisCurrency(value = 0) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value;
}

function normalizeOrderId(order = {}) {
  return (
    order?.displayId ||
    order?.orderCode ||
    order?.rentalOrderCode ||
    order?.code ||
    `#${order?.orderId ?? order?.id ?? "—"}`
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  return dayjs(value).format("DD/MM/YYYY HH:mm");
}

export default function AdminDashboard() {
  const [orderFilter, setOrderFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [ordersRaw, setOrdersRaw] = useState([]);
  const [kycRecords, setKycRecords] = useState([]);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const [tx, orders, kycs] = await Promise.all([
          getTransactions().catch(() => []),
          listRentalOrders().catch(() => []),
          listAllKycs().catch(() => []),
        ]);
        if (cancelled) return;
        setTransactions(Array.isArray(tx) ? tx : []);
        setOrdersRaw(Array.isArray(orders) ? orders : []);
        setKycRecords(Array.isArray(kycs) ? kycs : []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Không thể tải dữ liệu dashboard."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const successfulTransactions = useMemo(
    () =>
      transactions.filter((tx) =>
        SUCCESS_PAYMENT_STATUSES.has(
          String(tx?.invoiceStatus || tx?.status || "").toUpperCase()
        )
      ),
    [transactions]
  );

  const revenueChartData = useMemo(() => {
    if (!successfulTransactions.length) return [];
    const today = dayjs().endOf("day");
    const start = today.subtract(6, "day");
    const buckets = new Map();
    for (let i = 0; i < 7; i += 1) {
      const date = start.add(i, "day");
      const key = date.format("YYYY-MM-DD");
      buckets.set(key, { label: date.format("DD/MM"), amount: 0 });
    }
    successfulTransactions.forEach((tx) => {
      const dateKey = dayjs(tx.createdAt || tx.paymentDate).format("YYYY-MM-DD");
      if (buckets.has(dateKey)) {
        const current = buckets.get(dateKey);
        current.amount += Number(tx.amount || 0);
        buckets.set(dateKey, current);
      }
    });
    return Array.from(buckets.values());
  }, [successfulTransactions]);

  const totalRevenue = useMemo(
    () => successfulTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [successfulTransactions]
  );

  const ordersTrendData = useMemo(() => {
    if (!ordersRaw.length) return [];
    const today = dayjs().endOf("day");
    const start = today.subtract(6, "day");
    const buckets = new Map();
    for (let i = 0; i < 7; i += 1) {
      const date = start.add(i, "day");
      buckets.set(date.format("YYYY-MM-DD"), {
        label: date.format("DD/MM"),
        count: 0,
      });
    }
    ordersRaw.forEach((order) => {
      const key = dayjs(order?.createdAt).format("YYYY-MM-DD");
      if (buckets.has(key)) {
        const current = buckets.get(key);
        current.count += 1;
        buckets.set(key, current);
      }
    });
    return Array.from(buckets.values());
  }, [ordersRaw]);

  const latestOrders = useMemo(() => {
    const sorted = [...ordersRaw].sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      return tb - ta;
    });
    return sorted.slice(0, 10).map((order) => {
      const total =
        Number(order?.totalPrice ?? order?.total ?? 0) +
        Number(order?.depositAmount ?? order?.deposit ?? 0);
      return {
        key: order?.id ?? order?.orderId,
        id: normalizeOrderId(order),
        customer:
          order?.customerName ||
          order?.customer?.fullName ||
          order?.customer?.name ||
          "—",
        total,
        days: order?.days ?? order?.rentalDays ?? "—",
        status: String(order?.orderStatus || "").toLowerCase(),
        createdAt: order?.createdAt
          ? dayjs(order.createdAt).format("DD/MM/YYYY HH:mm")
          : "—",
        raw: order,
      };
    });
  }, [ordersRaw]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return latestOrders;
    return latestOrders.filter((o) => o.status === orderFilter);
  }, [latestOrders, orderFilter]);

  const newOrdersToday = useMemo(
    () =>
      ordersRaw.filter((order) =>
        dayjs(order?.createdAt).isSame(dayjs(), "day")
      ).length,
    [ordersRaw]
  );

  const kycSummary = useMemo(() => {
    const summary = { passed: 0, failed: 0, pending: 0 };
    kycRecords.forEach((record) => {
      const status = String(record?.kycStatus || record?.status || "")
        .toUpperCase()
        .trim();
      if (["VERIFIED", "APPROVED"].includes(status)) summary.passed += 1;
      else if (["REJECTED", "DENIED"].includes(status)) summary.failed += 1;
      else summary.pending += 1;
    });
    const total = summary.passed + summary.failed + summary.pending;
    const passRate = total ? Math.round((summary.passed / total) * 100) : 0;
    const pieData = [
      { name: "Đã duyệt", value: summary.passed, color: KYC_PIE_COLORS[0] },
      { name: "Từ chối", value: summary.failed, color: KYC_PIE_COLORS[1] },
      { name: "Đang chờ", value: summary.pending, color: KYC_PIE_COLORS[2] },
    ];
    return { summary, passRate, total, pieData };
  }, [kycRecords]);

  const orderStatusOptions = useMemo(() => {
    const statuses = new Set(latestOrders.map((o) => o.status).filter(Boolean));
    return [
      { label: "Tất cả", value: "all" },
      ...Array.from(statuses).map((status) => ({
        label: ORDER_STATUS_LABELS[status] || status,
        value: status,
      })),
    ];
  }, [latestOrders]);

  const attentionOrders = useMemo(() => {
    const items = ordersRaw
      .filter((o) => ATTENTION_STATUSES.has(String(o?.orderStatus || "").toLowerCase()))
      .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
      .slice(0, 6)
      .map((order) => ({
        id: normalizeOrderId(order),
        status: String(order?.orderStatus || "").toLowerCase(),
        customer:
          order?.customerName ||
          order?.customer?.fullName ||
          order?.customer?.name ||
          "—",
        createdAt: formatDateTime(order?.createdAt),
        link: `/orders?orderId=${order?.orderId ?? order?.id}`,
      }));
    return items;
  }, [ordersRaw]);

  const recentTransactions = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(b?.createdAt || b?.paymentDate || 0).getTime() -
        new Date(a?.createdAt || a?.paymentDate || 0).getTime()
    );
    return sorted.slice(0, 6).map((tx) => {
      const status = String(tx?.invoiceStatus || tx?.status || "").toUpperCase();
      return {
        id: tx?.invoiceId || tx?.transactionId || tx?.id,
        amount: Number(tx?.amount || tx?.totalAmount || 0),
        method: String(tx?.paymentMethod || tx?.method || "N/A").toUpperCase(),
        status,
        time: formatDateTime(tx?.paymentDate || tx?.createdAt),
      };
    });
  }, [transactions]);

  const pendingKycList = useMemo(() => {
    const pendingStatuses = new Set(["PENDING", "SUBMITTED", "WAITING", "REVIEWING"]);
    return kycRecords
      .filter((record) =>
        pendingStatuses.has(String(record?.kycStatus || record?.status || "").toUpperCase())
      )
      .sort(
        (a, b) =>
          new Date(b?.updatedAt || b?.createdAt || 0).getTime() -
          new Date(a?.updatedAt || a?.createdAt || 0).getTime()
      )
      .slice(0, 6)
      .map((record) => ({
        id: record?.kycId || record?.id,
        fullName: record?.fullName || record?.customerName || `Khách #${record?.customerId}`,
        submittedAt: formatDateTime(record?.createdAt || record?.submittedAt),
        customerId: record?.customerId,
      }));
  }, [kycRecords]);

  const orderColumns = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    { title: "Khách hàng", dataIndex: "customer" },
    {
      title: "Tổng thanh toán",
      dataIndex: "total",
      align: "right",
      render: (value) => formatVND(value || 0),
      sorter: (a, b) => (a.total || 0) - (b.total || 0),
    },
    { title: "Số ngày", dataIndex: "days", align: "center" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status) => (
        <Tag color={ORDER_STATUS_TAG[status] || "default"}>
          {ORDER_STATUS_LABELS[status] || status || "—"}
        </Tag>
      ),
    },
    { title: "Ngày tạo", dataIndex: "createdAt" },
    {
      title: "",
      key: "actions",
      render: (_, record) => (
        <Button type="link" onClick={() => handleOpenOrderDetail(record.raw)}>
          Xem chi tiết
        </Button>
      ),
    },
  ];

  const handleOpenOrderDetail = async (order) => {
    if (!order) return;
    setOrderDetailOpen(true);
    setOrderDetailLoading(true);
    try {
      const id = order?.orderId ?? order?.id;
      if (id == null) {
        setOrderDetail(order);
      } else {
        const detail = await getRentalOrderById(id);
        setOrderDetail(detail || order);
      }
    } catch (err) {
      setOrderDetail(order);
      console.error("Failed to fetch order detail:", err);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  return (
    <>
    <Spin spinning={loading}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {error && (
          <Alert
            type="error"
            showIcon
            message="Không tải được dữ liệu"
            description={error}
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Space>
                <DollarCircleOutlined style={{ fontSize: 24, color: "#52c41a" }} />
                <Statistic
                  title="Doanh thu"
                  value={totalRevenue}
                  valueRender={() => <Text strong>{formatVND(totalRevenue)}</Text>}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Space>
                <ShoppingOutlined style={{ fontSize: 24, color: "#1677ff" }} />
                <Statistic
                  title="Đơn mới hôm nay"
                  value={newOrdersToday}
                  suffix={<Text type="secondary">đơn</Text>}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Space>
                <SecurityScanOutlined style={{ fontSize: 24, color: "#faad14" }} />
                <Statistic
                  title="Tỷ lệ KYC đậu"
                  value={kycSummary.passRate}
                  suffix="%"
                />
              </Space>
              <Progress
                percent={kycSummary.passRate}
                size="small"
                style={{ marginTop: 8 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Space>
                <DatabaseOutlined style={{ fontSize: 24, color: "#eb2f96" }} />
                <Statistic
                  title="Hồ sơ KYC đang chờ"
                  value={kycSummary.summary.pending}
                  suffix={<Text type="secondary">hồ sơ</Text>}
                />
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card title="Doanh thu 7 ngày gần nhất">
              {revenueChartData.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={formatAxisCurrency} />
                    <ChartTooltip formatter={(value) => formatVND(value)} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#1677ff"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="Chưa có giao dịch" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Tỷ lệ KYC">
              {kycSummary.summary.passed +
              kycSummary.summary.failed +
              kycSummary.summary.pending ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={kycSummary.pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {kycSummary.pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color || KYC_PIE_COLORS[index]} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={(value, name) => [`${value} hồ sơ`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="Chưa có dữ liệu KYC" />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card title="Số đơn mới 7 ngày gần nhất">
              {ordersTrendData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ordersTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="Chưa có đơn nào" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Giao dịch gần đây">
              {recentTransactions.length ? (
                <List
                  itemLayout="horizontal"
                  dataSource={recentTransactions}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{formatVND(item.amount)}</Text>
                            <Tag color={TRANSACTION_STATUS_TAG[item.status] || "default"}>
                              {item.status}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary">Phương thức: {item.method}</Text>
                            <Text type="secondary">{item.time}</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="Chưa có giao dịch" />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Đơn cần xử lý">
              {attentionOrders.length ? (
                <List
                  itemLayout="horizontal"
                  dataSource={attentionOrders}
                  renderItem={(item) => (
                    <List.Item actions={[<Link to={item.link}>Xem</Link>]}>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{item.id}</Text>
                            <Tag color={ORDER_STATUS_TAG[item.status] || "default"}>
                              {ORDER_STATUS_LABELS[item.status] || item.status || "—"}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text>{item.customer}</Text>
                            <Text type="secondary">{item.createdAt}</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="Không có đơn cần xử lý" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="KYC chờ duyệt">
              {pendingKycList.length ? (
                <List
                  dataSource={pendingKycList}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        item.customerId ? (
                          <Link to={`/admin/customers/${item.customerId}`}>Hồ sơ</Link>
                        ) : null,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<SecurityScanOutlined />} />}
                        title={<Text strong>{item.fullName}</Text>}
                        description={<Text type="secondary">{item.submittedAt}</Text>}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="Không có hồ sơ chờ" />
              )}
            </Card>
          </Col>
        </Row>

        <Card
          title={
            <Space>
              Đơn hàng gần đây
              <Segmented
                options={orderStatusOptions}
                value={orderFilter}
                onChange={setOrderFilter}
              />
            </Space>
          }
          extra={
            <Button type="link">
              <Link to="/orders">Xem tất cả</Link>
            </Button>
          }
        >
          <Table
            rowKey="key"
            columns={orderColumns}
            dataSource={filteredOrders}
            size="middle"
            pagination={{ pageSize: 6 }}
            locale={{
              emptyText: loading ? "Đang tải..." : "Không có đơn nào",
            }}
          />
        </Card>
      </Space>
    </Spin>

    <Drawer
      title={
        orderDetail
          ? `Đơn ${normalizeOrderId(orderDetail)}`
          : "Chi tiết đơn"
      }
      width={800}
      open={orderDetailOpen}
      onClose={() => {
        setOrderDetailOpen(false);
        setOrderDetail(null);
      }}
      destroyOnClose
    >
      <Spin spinning={orderDetailLoading}>
        {orderDetail ? (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Descriptions
              bordered
              column={2}
              size="small"
              items={[
                { label: "Khách hàng", children: orderDetail.customerName || "—" },
                {
                  label: "Trạng thái",
                  children: (
                    <Tag color={ORDER_STATUS_TAG[String(orderDetail.orderStatus).toLowerCase()] || "default"}>
                      {ORDER_STATUS_LABELS[String(orderDetail.orderStatus).toLowerCase()] ||
                        orderDetail.orderStatus ||
                        "—"}
                    </Tag>
                  ),
                },
                {
                  label: "Ngày tạo",
                  children: formatDateTime(orderDetail.createdAt),
                },
                {
                  label: "Ngày bắt đầu",
                  children: formatDateTime(orderDetail.startDate),
                },
                {
                  label: "Ngày kết thúc",
                  children: formatDateTime(orderDetail.endDate),
                },
                {
                  label: "Tổng thanh toán",
                  children: formatVND(
                    Number(orderDetail.totalPrice || orderDetail.total || 0) +
                      Number(orderDetail.depositAmount || orderDetail.deposit || 0)
                  ),
                },
              ]}
            />

            <Card title="Sản phẩm">
              {(orderDetail.orderDetails || orderDetail.items || []).length ? (
                <Table
                  rowKey={(item, idx) => `${item?.deviceModelId || item?.itemId || idx}`}
                  dataSource={orderDetail.orderDetails || orderDetail.items}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: "Thiết bị",
                      dataIndex: "deviceName",
                      render: (value, record) =>
                        value ||
                        record?.name ||
                        `Model ${record?.deviceModelId || record?.deviceId || ""}`,
                    },
                    {
                      title: "Số lượng",
                      dataIndex: "quantity",
                      align: "center",
                      render: (value, record) => value ?? record?.qty ?? 1,
                    },
                    {
                      title: "Giá / ngày",
                      dataIndex: "pricePerDay",
                      align: "right",
                      render: (value) => formatVND(value || 0),
                    },
                    {
                      title: "Tiền cọc",
                      dataIndex: "depositAmountPerUnit",
                      align: "right",
                      render: (value, record) =>
                        formatVND(value ?? record?.depositAmount ?? record?.depositAmountPerUnit ?? 0),
                    },
                  ]}
                />
              ) : (
                <Empty description="Không có sản phẩm" />
              )}
            </Card>

            {orderDetail.notes && (
              <Card title="Ghi chú">
                <Text>{orderDetail.notes}</Text>
              </Card>
            )}
          </Space>
        ) : (
          <Empty description="Không có dữ liệu đơn hàng" />
        )}
      </Spin>
    </Drawer>
    </>
  );
}
