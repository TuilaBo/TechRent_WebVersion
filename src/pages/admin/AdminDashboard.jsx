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
  Select,
  DatePicker,
  Tabs,
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  ComposedChart,
} from "recharts";
import { getTransactions } from "../../lib/Payment";
import { listRentalOrders, getRentalOrderById, searchRentalOrders } from "../../lib/rentalOrdersApi";
import { listAllKycs } from "../../lib/kycApi";
import { listCustomers } from "../../lib/customerApi";
import {
  getOrdersStatus,
  getNewCustomers,
  getDeviceIncidents,
  getDeviceImportsByCategory,
  getDamages,
  getRevenue,
} from "../../lib/dashBoard";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Color palette - professional and consistent
const COLORS = {
  primary: "#1677ff",
  success: "#52c41a",
  warning: "#faad14",
  danger: "#ff4d4f",
  info: "#13c2c2",
  purple: "#722ed1",
  gray: "#8c8c8c",
  lightGray: "#f5f5f5",
};

const CHART_COLORS = ["#1677ff", "#52c41a", "#faad14", "#ff4d4f", "#13c2c2", "#722ed1"];

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
  completed: "Hoàn tất đơn hàng",
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

function formatShortVND(value = 0) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${value}đ`;
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

// Stat Card Component - Clean design
function StatCard({ title, value, suffix, icon, color = COLORS.primary, trend, trendValue, loading }) {
  return (
    <Card 
      bordered={false}
      style={{ 
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ marginTop: 8 }}>
            {loading ? (
              <Spin size="small" />
            ) : (
              <Text strong style={{ fontSize: 28, color }}>{value}</Text>
            )}
            {suffix && <Text type="secondary" style={{ marginLeft: 4, fontSize: 14 }}>{suffix}</Text>}
          </div>
          {trend && trendValue && (
            <div style={{ marginTop: 4 }}>
              {trend === "up" ? (
                <Text style={{ color: COLORS.success, fontSize: 12 }}>
                  <ArrowUpOutlined /> {trendValue}
                </Text>
              ) : (
                <Text style={{ color: COLORS.danger, fontSize: 12 }}>
                  <ArrowDownOutlined /> {trendValue}
                </Text>
              )}
            </div>
          )}
        </div>
        <div 
          style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            backgroundColor: `${color}10`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {React.cloneElement(icon, { style: { fontSize: 24, color } })}
        </div>
      </div>
    </Card>
  );
}

// Revenue Card - Highlight design
function RevenueCard({ title, value, subtitle, icon, bgColor, loading }) {
  return (
    <Card 
      bordered={false}
      style={{ 
        borderRadius: 12,
        background: bgColor,
        minHeight: 140,
      }}
    >
      <div style={{ color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{title}</Text>
          {icon}
        </div>
        {loading ? (
          <Spin size="small" style={{ marginTop: 16 }} />
        ) : (
          <div style={{ marginTop: 12 }}>
            <Text strong style={{ fontSize: 26, color: "#fff" }}>{formatVND(value)}</Text>
          </div>
        )}
        {subtitle && (
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 8, display: "block" }}>
            {subtitle}
          </Text>
        )}
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [ordersRaw, setOrdersRaw] = useState([]);
  const [customersRaw, setCustomersRaw] = useState([]);
  const [kycRecords, setKycRecords] = useState([]);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  // ===== FILTER 1: Doanh thu (4 ô revenue + cơ cấu doanh thu) =====
  const [revenueFilterType, setRevenueFilterType] = useState("month");
  const [revenueSelectedDate, setRevenueSelectedDate] = useState(dayjs());
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueData, setRevenueData] = useState(null);
  
  // ===== FILTER 2: Thống kê (các mục còn lại) =====
  const [statsFilterType, setStatsFilterType] = useState("month");
  const [statsSelectedDate, setStatsSelectedDate] = useState(dayjs());
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Dashboard API states
  const [ordersStatusData, setOrdersStatusData] = useState(null);
  const [newCustomersData, setNewCustomersData] = useState(null);
  const [deviceIncidentsData, setDeviceIncidentsData] = useState(null);
  const [deviceImportsData, setDeviceImportsData] = useState(null);
  const [damagesData, setDamagesData] = useState(null);
  const [last7DaysRevenue, setLast7DaysRevenue] = useState([]);
  const [loading7Days, setLoading7Days] = useState(false);
  
  // ===== FILTER 3: Trạng thái đơn hàng (bảng đơn hàng gần đây) =====
  const [orderStatusFilter, setOrderStatusFilter] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Get filter params for Revenue
  const getRevenueFilterParams = () => {
    const params = { year: revenueSelectedDate.year() };
    if (revenueFilterType === "month" || revenueFilterType === "day") {
      params.month = revenueSelectedDate.month() + 1;
    }
    if (revenueFilterType === "day") {
      params.day = revenueSelectedDate.date();
    }
    return params;
  };

  // Get filter params for Stats
  const getStatsFilterParams = () => {
    const params = { year: statsSelectedDate.year() };
    if (statsFilterType === "month" || statsFilterType === "day") {
      params.month = statsSelectedDate.month() + 1;
    }
    if (statsFilterType === "day") {
      params.day = statsSelectedDate.date();
    }
    return params;
  };

  const revenueFilterLabel = useMemo(() => {
    if (revenueFilterType === "day") return revenueSelectedDate.format("DD/MM/YYYY");
    if (revenueFilterType === "month") return revenueSelectedDate.format("MM/YYYY");
    return revenueSelectedDate.format("YYYY");
  }, [revenueFilterType, revenueSelectedDate]);

  const statsFilterLabel = useMemo(() => {
    if (statsFilterType === "day") return statsSelectedDate.format("DD/MM/YYYY");
    if (statsFilterType === "month") return statsSelectedDate.format("MM/YYYY");
    return statsSelectedDate.format("YYYY");
  }, [statsFilterType, statsSelectedDate]);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const [tx, orders, kycs, customers] = await Promise.all([
          getTransactions().catch(() => []),
          listRentalOrders().catch(() => []),
          listAllKycs().catch(() => []),
          listCustomers().catch(() => []),
        ]);
        if (cancelled) return;
        setTransactions(Array.isArray(tx) ? tx : []);
        setOrdersRaw(Array.isArray(orders) ? orders : []);
        setKycRecords(Array.isArray(kycs) ? kycs : []);
        setCustomersRaw(Array.isArray(customers) ? customers : []);
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

  // Fetch orders with orderStatus filter
  const fetchOrdersByStatus = async (orderStatus = null) => {
    try {
      setOrdersLoading(true);
      const params = {
        page: 0,
        size: 20,
        sort: ["createdAt,desc"],
      };
      if (orderStatus) {
        params.orderStatus = orderStatus;
      }
      const result = await searchRentalOrders(params);
      setOrdersRaw(result.content || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Load orders when orderStatusFilter changes
  useEffect(() => {
    if (orderStatusFilter !== null) {
      fetchOrdersByStatus(orderStatusFilter);
    }
  }, [orderStatusFilter]);

  // Load Revenue data when revenue filter changes
  useEffect(() => {
    let cancelled = false;
    async function loadRevenueData() {
      try {
        setRevenueLoading(true);
        const params = getRevenueFilterParams();
        const revenue = await getRevenue(params).catch(() => null);
        if (cancelled) return;
        setRevenueData(revenue);
      } catch (err) {
        console.error("Error loading revenue data:", err);
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    }
    loadRevenueData();
    return () => {
      cancelled = true;
    };
  }, [revenueFilterType, revenueSelectedDate]);

  // Load Stats data when stats filter changes
  useEffect(() => {
    let cancelled = false;
    async function loadStatsData() {
      try {
        setStatsLoading(true);
        const params = getStatsFilterParams();
        const [
          ordersStatus,
          newCustomers,
          deviceIncidents,
          deviceImports,
          damages,
        ] = await Promise.all([
          getOrdersStatus(params).catch(() => null),
          getNewCustomers(params).catch(() => null),
          getDeviceIncidents(params).catch(() => null),
          getDeviceImportsByCategory(params).catch(() => null),
          getDamages(params).catch(() => null),
        ]);
        if (cancelled) return;
        setOrdersStatusData(ordersStatus);
        setNewCustomersData(newCustomers);
        setDeviceIncidentsData(deviceIncidents);
        setDeviceImportsData(deviceImports);
        setDamagesData(damages);
      } catch (err) {
        console.error("Error loading stats data:", err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }
    loadStatsData();
    return () => {
      cancelled = true;
    };
  }, [statsFilterType, statsSelectedDate]);

  // Load revenue for last 7 days from Dashboard API
  useEffect(() => {
    let cancelled = false;
    async function loadLast7DaysRevenue() {
      try {
        setLoading7Days(true);
        const today = dayjs();
        const promises = [];
        
        for (let i = 6; i >= 0; i--) {
          const date = today.subtract(i, "day");
          const params = {
            year: date.year(),
            month: date.month() + 1,
            day: date.date(),
          };
          promises.push(
            getRevenue(params)
              .then((res) => ({
                label: date.format("DD/MM"),
                date: date.format("YYYY-MM-DD"),
                amount: res?.data?.totalRevenue ?? res?.totalRevenue ?? 0,
              }))
              .catch(() => ({
                label: date.format("DD/MM"),
                date: date.format("YYYY-MM-DD"),
                amount: 0,
              }))
          );
        }
        
        const results = await Promise.all(promises);
        if (cancelled) return;
        setLast7DaysRevenue(results);
      } catch (err) {
        console.error("Error loading 7 days revenue:", err);
      } finally {
        if (!cancelled) setLoading7Days(false);
      }
    }
    loadLast7DaysRevenue();
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

  // Revenue data for chart - use Dashboard API data
  const revenueChartData = useMemo(() => {
    return last7DaysRevenue;
  }, [last7DaysRevenue]);

  // Orders trend for chart
  const ordersTrendData = useMemo(() => {
    if (!ordersRaw.length) return [];
    const today = dayjs().endOf("day");
    const start = today.subtract(6, "day");
    const buckets = new Map();
    for (let i = 0; i < 7; i += 1) {
      const date = start.add(i, "day");
      buckets.set(date.format("YYYY-MM-DD"), {
        label: date.format("DD/MM"),
        orders: 0,
        completed: 0,
        cancelled: 0,
      });
    }
    ordersRaw.forEach((order) => {
      const key = dayjs(order?.createdAt).format("YYYY-MM-DD");
      if (buckets.has(key)) {
        const current = buckets.get(key);
        current.orders += 1;
        const status = String(order?.orderStatus || "").toLowerCase();
        if (status === "returned" || status === "completed") current.completed += 1;
        if (status === "cancelled") current.cancelled += 1;
        buckets.set(key, current);
      }
    });
    return Array.from(buckets.values());
  }, [ordersRaw]);

  const totalRevenue = useMemo(
    () => successfulTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [successfulTransactions]
  );

  const latestOrders = useMemo(() => {
    // Create a map of customerId -> customer info for quick lookup
    const customerMap = new Map();
    customersRaw.forEach((c) => {
      const id = c?.customerId ?? c?.id;
      if (id) {
        customerMap.set(Number(id), c);
      }
    });

    const sorted = [...ordersRaw].sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      return tb - ta;
    });
    return sorted.slice(0, 8).map((order) => {
      const total =
        Number(order?.totalPrice ?? order?.total ?? 0) +
        Number(order?.depositAmount ?? order?.deposit ?? 0);
      
      // Try to get customer name from order first, then from customerMap
      let customerName = order?.customerName || order?.customer?.fullName || order?.customer?.name;
      if (!customerName && order?.customerId) {
        const customer = customerMap.get(Number(order.customerId));
        customerName = customer?.fullName || customer?.username || customer?.name || customer?.email;
      }
      
      return {
        key: order?.id ?? order?.orderId,
        id: normalizeOrderId(order),
        customer: customerName || `Khách #${order?.customerId || "—"}`,
        total,
        status: String(order?.orderStatus || "").toLowerCase(),
        createdAt: order?.createdAt
          ? dayjs(order.createdAt).format("DD/MM/YYYY HH:mm")
          : "—",
        raw: order,
      };
    });
  }, [ordersRaw, customersRaw]);

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
    return { summary, passRate, total };
  }, [kycRecords]);

  // Device imports chart data
  const deviceImportsChartData = useMemo(() => {
    const categories = deviceImportsData?.data?.categories ?? deviceImportsData?.categories;
    if (!categories || !Array.isArray(categories)) return [];
    return categories.map((item, index) => ({
      name: item.categoryName || `Category ${index + 1}`,
      value: item.deviceCount || item.count || 0,
    }));
  }, [deviceImportsData]);

  // Calculate local stats from existing data (fallback)
  const localMonthlyStats = useMemo(() => {
    const year = statsSelectedDate.year();
    const month = statsSelectedDate.month();
    const startOfMonth = dayjs().year(year).month(month).startOf("month");
    const endOfMonth = startOfMonth.endOf("month");

    const newCustomersCount = customersRaw.filter((c) => {
      const created = dayjs(c?.createdAt);
      return created.isValid() && created.isAfter(startOfMonth) && created.isBefore(endOfMonth);
    }).length;

    const ordersThisMonth = ordersRaw.filter((o) => {
      const created = dayjs(o?.createdAt);
      return created.isValid() && created.isAfter(startOfMonth) && created.isBefore(endOfMonth);
    });

    const completedCount = ordersThisMonth.filter((o) => {
      const status = String(o?.orderStatus || "").toLowerCase();
      return status === "returned" || status === "completed";
    }).length;

    const cancelledCount = ordersThisMonth.filter((o) => {
      const status = String(o?.orderStatus || "").toLowerCase();
      return status === "cancelled" || status === "canceled";
    }).length;

    return {
      newCustomersCount,
      completedCount,
      cancelledCount,
      totalOrdersThisMonth: ordersThisMonth.length,
    };
  }, [customersRaw, ordersRaw, statsSelectedDate]);

  const orderColumns = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      width: 120,
    },
    { 
      title: "Khách hàng", 
      dataIndex: "customer",
      ellipsis: true,
    },
    {
      title: "Tổng tiền",
      dataIndex: "total",
      align: "right",
      width: 140,
      render: (value) => <Text strong>{formatVND(value || 0)}</Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 130,
      render: (status) => (
        <Tag color={ORDER_STATUS_TAG[status] || "default"}>
          {ORDER_STATUS_LABELS[status] || status || "—"}
        </Tag>
      ),
    },
    { 
      title: "Ngày tạo", 
      dataIndex: "createdAt",
      width: 150,
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

  // Get revenue values from API
  const totalRevenueAPI = revenueData?.data?.totalRevenue ?? revenueData?.totalRevenue ?? 0;
  const rentalRevenue = revenueData?.data?.rentalRevenue ?? revenueData?.rentalRevenue ?? 0;
  const lateFeeRevenue = revenueData?.data?.lateFeeRevenue ?? revenueData?.lateFeeRevenue ?? 0;
  const damageFeeRevenue = revenueData?.data?.damageFeeRevenue ?? revenueData?.damageFeeRevenue ?? 0;

  // Revenue breakdown for pie chart
  const revenueBreakdownData = useMemo(() => {
    if (!rentalRevenue && !lateFeeRevenue && !damageFeeRevenue) return [];
    return [
      { name: "Tiền thuê", value: rentalRevenue, color: COLORS.primary },
      { name: "Phí trả muộn", value: lateFeeRevenue, color: COLORS.warning },
      { name: "Bồi thường", value: damageFeeRevenue, color: COLORS.danger },
    ].filter(item => item.value > 0);
  }, [rentalRevenue, lateFeeRevenue, damageFeeRevenue]);

  return (
    <>
      <Spin spinning={loading}>
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          {error && (
            <Alert
              type="error"
              showIcon
              message="Không tải được dữ liệu"
              description={error}
            />
          )}

          {/* Header */}
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Title level={4} style={{ margin: 0 }}>
              <CalendarOutlined style={{ marginRight: 8 }} />
              Tổng quan Dashboard
            </Title>
          </Card>

          {/* ===== SECTION 1: DOANH THU ===== */}
          <Card 
            bordered={false} 
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <DollarOutlined style={{ color: COLORS.primary }} />
                <span>Thống kê Doanh thu</span>
              </Space>
            }
            extra={
              <Space size={12}>
                <Segmented
                  value={revenueFilterType}
                  onChange={setRevenueFilterType}
                  options={[
                    { label: "Theo ngày", value: "day" },
                    { label: "Theo tháng", value: "month" },
                    { label: "Theo năm", value: "year" },
                  ]}
                  size="small"
                />
                <DatePicker
                  value={revenueSelectedDate}
                  onChange={(date) => date && setRevenueSelectedDate(date)}
                  picker={revenueFilterType === "day" ? "date" : revenueFilterType === "month" ? "month" : "year"}
                  format={revenueFilterType === "day" ? "DD/MM/YYYY" : revenueFilterType === "month" ? "MM/YYYY" : "YYYY"}
                  allowClear={false}
                  size="small"
                  style={{ width: revenueFilterType === "day" ? 130 : 100 }}
                />
                {revenueLoading && <Spin size="small" />}
              </Space>
            }
          >
            {/* Revenue Overview Cards */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <RevenueCard
                  title="Tổng doanh thu"
                  value={totalRevenueAPI}
                  subtitle={`Kỳ: ${revenueFilterLabel}`}
                  icon={<DollarOutlined style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }} />}
                  bgColor="linear-gradient(135deg, #1677ff 0%, #4096ff 100%)"
                  loading={revenueLoading}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <RevenueCard
                  title="Tiền thuê"
                  value={rentalRevenue}
                  icon={<ShoppingCartOutlined style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }} />}
                  bgColor="linear-gradient(135deg, #52c41a 0%, #73d13d 100%)"
                  loading={revenueLoading}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <RevenueCard
                  title="Phí trả muộn"
                  value={lateFeeRevenue}
                  icon={<ExclamationCircleOutlined style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }} />}
                  bgColor="linear-gradient(135deg, #faad14 0%, #ffc53d 100%)"
                  loading={revenueLoading}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <RevenueCard
                  title="Bồi thường thiệt hại"
                  value={damageFeeRevenue}
                  icon={<ToolOutlined style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }} />}
                  bgColor="linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)"
                  loading={revenueLoading}
                />
              </Col>
            </Row>
          </Card>

          {/* ===== SECTION 2: THỐNG KÊ ===== */}
          <Card 
            bordered={false} 
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <UserOutlined style={{ color: COLORS.purple }} />
                <span>Thống kê hoạt động</span>
              </Space>
            }
            extra={
              <Space size={12}>
                <Segmented
                  value={statsFilterType}
                  onChange={setStatsFilterType}
                  options={[
                    { label: "Theo tháng", value: "month" },
                    { label: "Theo năm", value: "year" },
                  ]}
                  size="small"
                />
                <DatePicker
                  value={statsSelectedDate}
                  onChange={(date) => date && setStatsSelectedDate(date)}
                  picker={statsFilterType === "day" ? "date" : statsFilterType === "month" ? "month" : "year"}
                  format={statsFilterType === "day" ? "DD/MM/YYYY" : statsFilterType === "month" ? "MM/YYYY" : "YYYY"}
                  allowClear={false}
                  size="small"
                  style={{ width: statsFilterType === "day" ? 130 : 100 }}
                />
                {statsLoading && <Spin size="small" />}
              </Space>
            }
          >
            {/* Stats Cards Row */}
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} lg={4}>
                <StatCard
                  title="Khách hàng mới"
                  value={newCustomersData?.data?.newCustomerCount ?? newCustomersData?.newCustomerCount ?? localMonthlyStats.newCustomersCount ?? 0}
                  suffix="người"
                  icon={<UserOutlined />}
                  color={COLORS.purple}
                  loading={statsLoading}
                />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard
                  title="Đơn hoàn thành"
                  value={ordersStatusData?.data?.completedCount ?? ordersStatusData?.completedCount ?? localMonthlyStats.completedCount ?? 0}
                  suffix="đơn"
                  icon={<CheckCircleOutlined />}
                  color={COLORS.success}
                  loading={statsLoading}
                />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard
                  title="Đơn bị hủy"
                  value={ordersStatusData?.data?.cancelledCount ?? ordersStatusData?.cancelledCount ?? localMonthlyStats.cancelledCount ?? 0}
                  suffix="đơn"
                  icon={<CloseCircleOutlined />}
                  color={COLORS.danger}
                  loading={statsLoading}
                />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard
                  title="Thiết bị sự cố"
                  value={deviceIncidentsData?.data?.totalIncidents ?? deviceIncidentsData?.totalIncidents ?? 0}
                  suffix="thiết bị"
                  icon={<ToolOutlined />}
                  color={COLORS.warning}
                  loading={statsLoading}
                />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard
                  title="Thiệt hại"
                  value={formatShortVND(damagesData?.data?.totalDamage ?? damagesData?.totalDamage ?? 0)}
                  icon={<ExclamationCircleOutlined />}
                  color={COLORS.danger}
                  loading={statsLoading}
                />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <StatCard
                  title="TB nhập kho"
                  value={(() => {
                    const categories = deviceImportsData?.data?.categories ?? deviceImportsData?.categories;
                    if (!categories) return 0;
                    if (Array.isArray(categories)) {
                      return categories.reduce((sum, item) => sum + (item.deviceCount || item.count || 0), 0);
                    }
                    return 0;
                  })()}
                  suffix="thiết bị"
                  icon={<InboxOutlined />}
                  color={COLORS.info}
                  loading={statsLoading}
                />
              </Col>
            </Row>
          </Card>


          {/* Charts Row */}
          <Row gutter={[16, 16]}>
            {/* Revenue Trend Chart */}
            <Col xs={24} lg={16}>
              <Card 
                title="Doanh thu 7 ngày gần nhất" 
                bordered={false}
                style={{ borderRadius: 12 }}
                extra={loading7Days ? <Spin size="small" /> : null}
              >
                {loading7Days ? (
                  <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Spin tip="Đang tải dữ liệu..." />
                  </div>
                ) : revenueChartData.length ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={revenueChartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatAxisCurrency} axisLine={false} tickLine={false} />
                      <ChartTooltip 
                        formatter={(value) => formatVND(value)}
                        contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="Doanh thu"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Chưa có dữ liệu doanh thu" style={{ padding: "60px 0" }} />
                )}
              </Card>
            </Col>

            {/* Revenue Breakdown Pie Chart */}
            <Col xs={24} lg={8}>
              <Card 
                title="Cơ cấu doanh thu" 
                bordered={false}
                style={{ borderRadius: 12 }}
              >
                {revenueBreakdownData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={revenueBreakdownData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {revenueBreakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        formatter={(value) => formatVND(value)}
                        contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0" }}
                      />
                      <Legend 
                        verticalAlign="bottom"
                        formatter={(value, entry) => (
                          <span style={{ color: "#666" }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Chưa có dữ liệu" style={{ padding: "60px 0" }} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Orders Trend and Device Imports Charts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card 
                title="Xu hướng đơn hàng 7 ngày" 
                bordered={false}
                style={{ borderRadius: 12 }}
              >
                {ordersTrendData.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={ordersTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                      <ChartTooltip 
                        contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0" }}
                      />
                      <Legend />
                      <Bar dataKey="orders" fill={COLORS.primary} name="Tổng đơn" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="completed" stroke={COLORS.success} strokeWidth={2} name="Hoàn thành" />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Chưa có đơn hàng" style={{ padding: "60px 0" }} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card 
                title={`Thiết bị nhập theo danh mục - Tháng ${statsSelectedDate.month() + 1}/${statsSelectedDate.year()}`}
                bordered={false}
                style={{ borderRadius: 12 }}
              >
                {deviceImportsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={deviceImportsChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={120}
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <ChartTooltip 
                        contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0" }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill={COLORS.info} 
                        radius={[0, 4, 4, 0]}
                        name="Số lượng"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Chưa có dữ liệu" style={{ padding: "60px 0" }} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Quick Stats Row */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Space>
                  <ShoppingCartOutlined style={{ fontSize: 24, color: COLORS.primary }} />
                  <Statistic
                    title="Đơn mới hôm nay"
                    value={newOrdersToday}
                    suffix={<Text type="secondary">đơn</Text>}
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space>
                    <UserOutlined style={{ fontSize: 24, color: COLORS.success }} />
                    <Statistic
                      title="Tỷ lệ KYC đậu"
                      value={kycSummary.passRate}
                      suffix="%"
                    />
                  </Space>
                  <Progress
                    percent={kycSummary.passRate}
                    size="small"
                    strokeColor={COLORS.success}
                    showInfo={false}
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Space>
                  <ExclamationCircleOutlined style={{ fontSize: 24, color: COLORS.warning }} />
                  <Statistic
                    title="KYC đang chờ duyệt"
                    value={kycSummary.summary.pending}
                    suffix={<Text type="secondary">hồ sơ</Text>}
                  />
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Recent Orders Table */}
          <Card 
            title="Đơn hàng gần đây" 
            bordered={false}
            style={{ borderRadius: 12 }}
            extra={
              <Space size={12}>
                <Select
                  placeholder="Trạng thái đơn hàng"
                  allowClear
                  value={orderStatusFilter}
                  style={{ width: 180 }}
                  options={[
                    { label: "Đang chờ", value: "PENDING" },
                    { label: "Chờ KYC", value: "PENDING_KYC" },
                    { label: "Đã xác nhận", value: "CONFIRMED" },
                    { label: "Đang xử lý", value: "PROCESSING" },
                    { label: "Chuẩn bị giao hàng", value: "DELIVERY_CONFIRMED" },
                    { label: "Đang giao hàng", value: "DELIVERING" },
                    { label: "Đang sử dụng", value: "IN_USE" },
                    { label: "Hoàn tất đơn hàng", value: "COMPLETED" },
                  ]}
                  onChange={(value) => {
                    setOrderStatusFilter(value);
                    if (!value) {
                      // Reset - load lại tất cả đơn hàng
                      fetchOrdersByStatus(null);
                    }
                  }}
                />
                <Link to="/admin/orders">Xem tất cả</Link>
              </Space>
            }
          >
            <Table
              columns={orderColumns}
              dataSource={latestOrders}
              loading={ordersLoading}
              pagination={false}
              size="middle"
              onRow={(record) => ({
                onClick: () => handleOpenOrderDetail(record.raw),
                style: { cursor: "pointer" },
              })}
            />
          </Card>
        </Space>
      </Spin>

      {/* Order Detail Drawer */}
      <Drawer
        title={`Chi tiết đơn hàng ${orderDetail ? normalizeOrderId(orderDetail) : ""}`}
        open={orderDetailOpen}
        onClose={() => setOrderDetailOpen(false)}
        width={600}
      >
        <Spin spinning={orderDetailLoading}>
          {orderDetail && (() => {
            // Get customer info from customerMap
            const customerMap = new Map();
            customersRaw.forEach((c) => {
              const id = c?.customerId ?? c?.id;
              if (id) customerMap.set(Number(id), c);
            });
            const customer = orderDetail?.customerId 
              ? customerMap.get(Number(orderDetail.customerId)) 
              : null;
            const customerName = orderDetail?.customerName || 
              orderDetail?.customer?.fullName || 
              orderDetail?.customer?.name || 
              customer?.fullName || 
              customer?.username || 
              customer?.name;
            
            // Get KYC info
            const customerKyc = kycRecords.find(
              (k) => Number(k?.customerId) === Number(orderDetail?.customerId)
            );
            const kycStatus = customerKyc?.kycStatus || customerKyc?.status || "—";
            const kycStatusColor = {
              VERIFIED: "green",
              APPROVED: "green", 
              PENDING: "gold",
              SUBMITTED: "blue",
              REJECTED: "red",
              DENIED: "red",
            }[String(kycStatus).toUpperCase()] || "default";
            const kycStatusLabel = {
              VERIFIED: "Đã xác minh",
              APPROVED: "Đã duyệt",
              PENDING: "Đang chờ",
              SUBMITTED: "Đã gửi",
              REJECTED: "Từ chối",
              DENIED: "Từ chối",
            }[String(kycStatus).toUpperCase()] || kycStatus;

            return (
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Mã đơn">
                  {normalizeOrderId(orderDetail)}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  {customerName || `Khách #${orderDetail?.customerId || "—"}`}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {customer?.phoneNumber || customer?.phone || orderDetail?.customer?.phoneNumber || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {customer?.email || orderDetail?.customer?.email || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái KYC">
                  <Tag color={kycStatusColor}>{kycStatusLabel}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái đơn">
                  <Tag color={ORDER_STATUS_TAG[String(orderDetail?.orderStatus || "").toLowerCase()] || "default"}>
                    {ORDER_STATUS_LABELS[String(orderDetail?.orderStatus || "").toLowerCase()] || orderDetail?.orderStatus || "—"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày bắt đầu thuê">
                  {orderDetail?.startDate || orderDetail?.planStartDate 
                    ? dayjs(orderDetail?.startDate || orderDetail?.planStartDate).format("DD/MM/YYYY")
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày kết thúc thuê">
                  {orderDetail?.endDate || orderDetail?.planEndDate 
                    ? dayjs(orderDetail?.endDate || orderDetail?.planEndDate).format("DD/MM/YYYY")
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Số ngày thuê">
                  {(() => {
                    const start = orderDetail?.startDate || orderDetail?.planStartDate;
                    const end = orderDetail?.endDate || orderDetail?.planEndDate;
                    if (start && end) {
                      const days = dayjs(end).diff(dayjs(start), "day") + 1;
                      return `${days} ngày`;
                    }
                    return orderDetail?.days ?? orderDetail?.rentalDays ?? "—";
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Tổng thanh toán">
                  <Text strong style={{ color: COLORS.primary }}>
                    {formatVND(
                      Number(orderDetail?.totalPrice ?? orderDetail?.total ?? 0) +
                        Number(orderDetail?.depositAmount ?? orderDetail?.deposit ?? 0)
                    )}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Tiền cọc">
                  {formatVND(orderDetail?.depositAmount ?? orderDetail?.deposit ?? 0)}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày tạo đơn">
                  {formatDateTime(orderDetail?.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ giao hàng">
                  {orderDetail?.shippingAddress || "—"}
                </Descriptions.Item>
              </Descriptions>
            );
          })()}
        </Spin>
      </Drawer>
    </>
  );
}
