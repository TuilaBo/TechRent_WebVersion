import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Card,
  List,
  Typography,
  Tag,
  Space,
  Button,
  Skeleton,
  Empty,
  message,
} from "antd";
import { BellOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { listRentalOrders, getRentalOrderById } from "../../lib/rentalOrdersApi";
import { fetchMyCustomerProfile } from "../../lib/customerApi";
import { connectCustomerNotifications } from "../../lib/notificationsSocket";
import { getMyContracts, normalizeContract } from "../../lib/contractApi";
import { getSettlementByOrderId } from "../../lib/settlementApi";

const { Title, Text } = Typography;

function normalizeOrderId(value) {
  if (value == null) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num;
}

function extractOrderId(order) {
  if (!order) return undefined;
  const raw =
    order?.orderId ??
    order?.rentalOrderId ??
    order?.id ??
    order?.rentalId ??
    order?.rentalOrderCode ??
    order?.orderCode ??
    order?.referenceId ??
    order?.data?.orderId ??
    order?.detail?.orderId;
  return normalizeOrderId(raw);
}

function extractStatus(order) {
  if (!order) return "";
  const raw =
    order?.orderStatus ??
    order?.status ??
    order?.state ??
    order?.orderState ??
    order?.newStatus ??
    order?.data?.orderStatus ??
    order?.detail?.status;
  return String(raw || "").toUpperCase();
}

function deriveOrderInfo(payload) {
  if (!payload) return { orderId: undefined, status: "" };

  // Handle notification payload with type field
  const notificationType = String(payload?.type || "").toUpperCase();
  if (notificationType === "ORDER_PROCESSING") {
    return {
      orderId: extractOrderId(payload) || payload?.rentalOrderId || payload?.orderId,
      status: "PROCESSING",
    };
  }

  const merged = {
    ...payload,
    ...(payload.order || payload.data || payload.detail || {}),
  };
  return {
    orderId: extractOrderId(merged),
    status: extractStatus(merged),
  };
}

function buildContractsMap(contracts = []) {
  const map = new Map();
  contracts.forEach((contract) => {
    const orderId = normalizeOrderId(
      contract?.orderId ??
      contract?.rentalOrderId ??
      contract?.order?.orderId ??
      contract?.order?.id
    );
    if (orderId != null) {
      map.set(orderId, contract);
    }
  });
  return map;
}

const STATUS_META = {
  PROCESSING: {
    tag: { color: "gold", label: "Đang xử lý" },
  },
  READY_FOR_DELIVERY: {
    tag: { color: "cyan", label: "Chuẩn bị giao hàng" },
    title: (order) => `Đơn #${order.orderId} chuẩn bị giao`,
    description:
      "Đội ngũ đang chuẩn bị giao hàng. Hãy đảm bảo bạn đã ký hợp đồng và thanh toán đầy đủ.",
    actionLabel: "Xem chi tiết",
  },
  DELIVERY_CONFIRMED: {
    tag: { color: "green", label: "Đã xác nhận giao hàng" },
    title: (order) => `Đơn #${order.orderId} đã giao thành công`,
    description:
      "Vui lòng kiểm tra thiết bị và phản hồi nếu có vấn đề phát sinh.",
    actionLabel: "Theo dõi đơn",
  },
};
const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatCurrency(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return "0 ₫";
  return currencyFormatter.format(num);
}

function buildNotificationFromOrder(order, contractsMap) {
  const status = extractStatus(order);
  const meta = STATUS_META[status];
  if (!meta) return null;

  const orderId = extractOrderId(order);
  if (orderId == null) return null;
  const key = `${orderId}-${status}`;
  const baseLink = `/orders?orderId=${orderId}`;
  const hasContract = contractsMap?.get?.(orderId);

  let link = baseLink;
  const displayCode = order?.orderCode || order?.rentalOrderCode || orderId;
  let title = meta.title ? meta.title(order) : `Đơn #${displayCode}`;
  let description = meta.description || "";
  let actionLabel = meta.actionLabel || "Xem đơn";

  if (status === "PROCESSING") {
    title = `Đơn #${displayCode} đã được duyệt`;
    if (hasContract) {
      description =
        "Hợp đồng đã sẵn sàng. Vui lòng ký hợp đồng và thanh toán để chúng tôi chuẩn bị giao hàng.";
      actionLabel = "Ký & thanh toán";
      link = `${baseLink}&tab=contract`;
    } else {
      description = "QC đã hoàn tất. Chúng tôi sẽ gửi hợp đồng để bạn ký trong ít phút.";
      actionLabel = "Xem trạng thái";
    }
  }

  return {
    key,
    orderId,
    status,
    createdAt: order.updatedAt || order.completedAt || order.createdAt,
    title,
    description,
    tag: meta.tag,
    actionLabel,
    link,
  };
}

function buildSettlementNotification(order, settlement) {
  if (!order || !settlement) return null;
  const state = String(settlement.state || "").toUpperCase();
  if (!state || ["ISSUED", "REJECTED", "CANCELLED", "CLOSED"].includes(state)) return null;
  const orderId = extractOrderId(order);
  if (orderId == null) return null;
  const displayCode = order?.orderCode || order?.rentalOrderCode || orderId;
  const amount = settlement.finalAmount ?? settlement.depositUsed ?? settlement.totalRent ?? 0;
  return {
    key: `settlement-${orderId}-${settlement.settlementId || settlement.id || state}`,
    orderId,
    status: "SETTLEMENT",
    createdAt: settlement.updatedAt || settlement.createdAt || order.updatedAt,
    title: `Quyết toán đơn #${displayCode}`,
    description: `Bảng quyết toán hoàn cọc đã sẵn sàng. Số tiền dự kiến: ${formatCurrency(amount)}.`,
    tag: { color: "purple", label: "Quyết toán" },
    actionLabel: "Xem quyết toán",
    link: `/orders?orderId=${orderId}&tab=settlement`,
  };
}

function getDaysRemaining(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();

  // Reset time to start of day for accurate day calculation
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diff = endDay.getTime() - nowDay.getTime();
  // Use Math.floor to ensure accurate day count (don't round up)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days;
}

function buildReturnDueNotification(order) {
  if (!order) return null;
  const orderId = extractOrderId(order);
  if (orderId == null) return null;

  const endDate = order?.endDate || order?.rentalEndDate;
  if (!endDate) return null;

  const daysRemaining = getDaysRemaining(endDate);
  // Chỉ tạo thông báo khi còn <= 1 ngày và chưa quá hạn
  if (daysRemaining === null || daysRemaining < 0 || daysRemaining > 1) return null;

  // Kiểm tra trạng thái đơn - chỉ thông báo cho đơn đang thuê/đang sử dụng
  const status = String(order?.orderStatus || order?.status || "").toLowerCase();
  if (!["active", "in_use", "delivering"].includes(status)) return null;

  const displayCode = order?.orderCode || order?.rentalOrderCode || orderId;
  const daysText = "1 ngày nữa";

  return {
    key: `return-due-${orderId}`,
    orderId,
    status: "RETURN_DUE",
    createdAt: order.updatedAt || order.createdAt,
    title: `Đơn #${displayCode} sắp đến hạn trả hàng`,
    description: `Đơn hàng của bạn sẽ đến hạn trả hàng ${daysText}. Vui lòng chuẩn bị trả hàng hoặc gia hạn đơn hàng.`,
    tag: { color: "orange", label: "Sắp đến hạn" },
    actionLabel: "Xem chi tiết",
    link: `/orders?orderId=${orderId}&tab=return`,
  };
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const connectionRef = useRef(null);
  const contractsMapRef = useRef(new Map());
  const pollingRef = useRef(null);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta; // Mới nhất lên đầu (giảm dần)
    });
  }, [notifications]);

  const upsertNotifications = (items) => {
    setNotifications((prev) => {
      const map = new Map(prev.map((n) => [n.key, n]));
      items.forEach((item) => {
        if (item) map.set(item.key, item);
      });
      // Sắp xếp theo thời gian giảm dần (mới nhất lên đầu) trước khi trả về
      return Array.from(map.values())
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 30);
    });
  };

  const refreshContractsMap = async () => {
    try {
      const contracts = await getMyContracts();
      const normalized = Array.isArray(contracts)
        ? contracts.map((c) => (normalizeContract ? normalizeContract(c) : c))
        : [];
      const map = buildContractsMap(normalized);
      contractsMapRef.current = map;
      return map;
    } catch (error) {
      console.error("Notifications: cannot load contracts", error);
      return contractsMapRef.current;
    }
  };

  const loadOrdersAsNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [orders, contractsMap] = await Promise.all([
        listRentalOrders(),
        refreshContractsMap(),
      ]);
      const orderList = Array.isArray(orders) ? orders : [];
      const settlements = await Promise.all(
        orderList.map(async (order) => {
          const orderId = extractOrderId(order);
          if (!orderId) return null;
          try {
            const settlement = await getSettlementByOrderId(orderId);
            return { order, settlement };
          } catch {
            return null;
          }
        })
      );
      const settlementNotifications = settlements
        .map((entry) => (entry ? buildSettlementNotification(entry.order, entry.settlement) : null))
        .filter(Boolean);
      const returnDueNotifications = orderList
        .map((order) => buildReturnDueNotification(order))
        .filter(Boolean);
      const mapped = orderList
        .map((order) => buildNotificationFromOrder(order, contractsMap))
        .filter(Boolean);
      upsertNotifications([...mapped, ...settlementNotifications, ...returnDueNotifications]);
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không tải được thông báo."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrdersAsNotifications();
    pollingRef.current = setInterval(() => {
      loadOrdersAsNotifications({ silent: true });
    }, 5000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [loadOrdersAsNotifications]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await fetchMyCustomerProfile();
        if (!active) return;
        if (!me?.customerId && !me?.id) return;
        connectionRef.current = connectCustomerNotifications({
          endpoint: "http://160.191.245.242:8080/ws",
          customerId: me.customerId ?? me.id,
          onMessage: async (payload) => {
            console.log("📬 NotificationsPage: Received WebSocket message", payload);
            let { orderId: payloadOrderId, status: payloadStatus } = deriveOrderInfo(payload);

            if (!payloadStatus) {
              console.log("⚠️ NotificationsPage: Message missing status, ignoring", { payloadOrderId, payloadStatus, payload });
              return;
            }

            // If no orderId but we have a PROCESSING status, try to find it from orders
            if (!payloadOrderId && payloadStatus === "PROCESSING") {
              try {
                const orders = await listRentalOrders();
                const processingOrder = (orders || [])
                  .filter(o => {
                    const s = String(o?.status || o?.orderStatus || "").toUpperCase();
                    return s === "PROCESSING";
                  })
                  .sort((a, b) => {
                    const ta = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
                    const tb = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
                    return tb - ta;
                  })[0];
                if (processingOrder) {
                  payloadOrderId = extractOrderId(processingOrder);
                  console.log("🔍 NotificationsPage: Found processing order", { payloadOrderId, processingOrder });
                }
              } catch (err) {
                console.error("NotificationsPage: Failed to load orders for notification", err);
              }
            }

            if (!payloadOrderId) {
              console.log("⚠️ NotificationsPage: Cannot find orderId, skipping notification", { payloadStatus, payload });
              return;
            }

            console.log("✅ NotificationsPage: Processing notification", { payloadOrderId, payloadStatus });
            try {
              const order = await getRentalOrderById(payloadOrderId);
              let contractsMap = contractsMapRef.current;
              if (payloadStatus === "PROCESSING") {
                contractsMap = await refreshContractsMap();
              }
              const noti = buildNotificationFromOrder(
                {
                  ...order,
                  orderStatus: payloadStatus,
                },
                contractsMap
              );
              if (noti) {
                console.log("✅ NotificationsPage: Created notification", noti);
                upsertNotifications([noti]);
              }
            } catch (err) {
              console.error("❌ NotificationsPage: Failed to process notification", err);
            }
          },
          onConnect: () => {
            console.log("✅ NotificationsPage: WebSocket connected successfully");
          },
          onError: (err) => {
            console.error("❌ NotificationsPage: WebSocket error", err);
          },
        });
      } catch (error) {
        console.error("Notifications: cannot init socket", error);
      }
    })();
    return () => {
      active = false;
      connectionRef.current?.disconnect?.();
    };
  }, []);

  const renderItem = (item) => (
    <List.Item
      actions={[
        <Button
          key="action"
          type="primary"
          size="small"
          style={{ borderRadius: 8 }}
          onClick={() => navigate(item.link)}
        >
          {item.actionLabel || "Xem đơn"}
        </Button>,
      ]}
    >
      <List.Item.Meta
        title={
          <Space size={12}>
            {item.tag && <Tag color={item.tag.color}>{item.tag.label}</Tag>}
            <Text strong>{item.title}</Text>
          </Space>
        }
        description={
          <div>
            <Text>{item.description}</Text>
            <div style={{ marginTop: 4, color: "#6B7280", fontSize: 12 }}>
              {item.createdAt
                ? dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")
                : "—"}
            </div>
          </div>
        }
      />
    </List.Item>
  );

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card
          bordered={false}
          style={{
            borderRadius: 16,
            boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
          }}
          title={
            <Space size={12}>
              <BellOutlined />
              <Title level={4} style={{ margin: 0 }}>
                Thông báo
              </Title>
            </Space>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadOrdersAsNotifications()}
              type="text"
            >
              Làm mới
            </Button>
          }
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : sortedNotifications.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có thông báo nào"
              style={{ padding: "32px 0" }}
            />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={sortedNotifications}
              renderItem={renderItem}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
