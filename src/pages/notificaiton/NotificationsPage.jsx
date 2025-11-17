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

const { Title, Text } = Typography;

const STATUS_META = {
  PROCESSING: {
    tag: { color: "gold", label: "Đang xử lý" },
    title: (order) => `Đơn #${order.orderId} đã được xác nhận`,
    description:
      "Vui lòng ký hợp đồng và thanh toán để chúng tôi chuẩn bị thiết bị cho bạn.",
    actionLabel: "Ký & thanh toán",
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

function buildNotificationFromOrder(order) {
  const status = String(order?.orderStatus || "").toUpperCase();
  const meta = STATUS_META[status];
  if (!meta) return null;

  const key = `${order.orderId || order.id}-${status}`;
  const baseLink = `/orders?orderId=${order.orderId || order.id}`;
  const link =
    status === "PROCESSING"
      ? `${baseLink}&tab=contract`
      : baseLink;
  return {
    key,
    orderId: order.orderId || order.id,
    status,
    createdAt: order.updatedAt || order.completedAt || order.createdAt,
    title: meta.title(order),
    description: meta.description,
    tag: meta.tag,
    actionLabel: meta.actionLabel,
    link,
  };
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);
  const connectionRef = useRef(null);

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

  const loadOrdersAsNotifications = async () => {
    try {
      setLoading(true);
      const orders = await listRentalOrders();
      const mapped = (orders || []).map(buildNotificationFromOrder).filter(Boolean);
      upsertNotifications(mapped);
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không tải được thông báo."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrdersAsNotifications();
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
            if (!payload?.orderId || !payload?.orderStatus) return;
            try {
              const order = await getRentalOrderById(payload.orderId);
              const noti = buildNotificationFromOrder({
                ...order,
                orderStatus: payload.orderStatus,
              });
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
              onClick={loadOrdersAsNotifications}
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
