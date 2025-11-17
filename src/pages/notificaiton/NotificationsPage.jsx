import React, { useEffect, useMemo, useState, useRef } from "react";
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
    tag: { color: "cyan", label: "Sẵn sàng giao hàng" },
    title: (order) => `Đơn #${order.orderId} sẵn sàng giao`,
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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);
  const connectionRef = useRef(null);
  const contractsMapRef = useRef(new Map());
  const pollingRef = useRef(null);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [notifications]);

  const upsertNotifications = (items) => {
    setNotifications((prev) => {
      const map = new Map(prev.map((n) => [n.key, n]));
      items.forEach((item) => {
        if (item) map.set(item.key, item);
      });
      return Array.from(map.values()).slice(0, 30);
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

  const loadOrdersAsNotifications = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [orders, contractsMap] = await Promise.all([
        listRentalOrders(),
        refreshContractsMap(),
      ]);
      const mapped = (orders || [])
        .map((order) => buildNotificationFromOrder(order, contractsMap))
        .filter(Boolean);
      upsertNotifications(mapped);
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không tải được thông báo."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

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
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await fetchMyCustomerProfile();
        if (!active) return;
        setProfile(me);
        if (!me?.customerId && !me?.id) return;
        connectionRef.current = connectCustomerNotifications({
          endpoint: "/ws",
          customerId: me.customerId ?? me.id,
          onMessage: async (payload) => {
            const { orderId: payloadOrderId, status: payloadStatus } = deriveOrderInfo(payload);
            if (!payloadOrderId || !payloadStatus) return;
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
              if (noti) upsertNotifications([noti]);
            } catch {
              // silent
            }
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
