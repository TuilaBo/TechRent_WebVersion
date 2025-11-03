// src/pages/Customer/CustomerLiveChat.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card, Typography, Input, Button, List, Avatar, Space, Spin, Empty } from "antd";
import { SendOutlined, UserOutlined, CustomerServiceOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import Lottie from "lottie-react";

import { fetchMyCustomerProfile } from "../../lib/customerApi";
import {
  getOrCreateConversationByCustomerId,
  getMessagesByConversation,
  sendChatMessage,
} from "../../lib/chatApi";

const { Title, Text } = Typography;

export default function CustomerLiveChat() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 0, size: 50, last: true });
  const [input, setInput] = useState("");
  const pollRef = useRef(null);
  const [emptyAnim, setEmptyAnim] = useState(null);

  // === Auto-scroll refs & helpers ===
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const firstPaintDoneRef = useRef(false);

  const conversationId = conversation?.conversationId || conversation?.id;
  const customerId = customer?.customerId || customer?.id;

  // Helper: luôn kéo xuống cuối
  const scrollToBottom = (behavior = "auto") => {
    // dùng sentinel ở cuối để đảm bảo chính xác với List/virtual DOM
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: "end" });
    } else if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  };

  // Initial load: profile -> conversation -> messages
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // fetch lottie animation lazily (non-blocking)
        try {
          const res = await fetch("https://assets9.lottiefiles.com/private_files/lf30_editor_tifnq2.json");
          if (res.ok) {
            const json = await res.json();
            setEmptyAnim(json);
          }
        } catch {
          // ignore lottie fetch error
        }
        const me = await fetchMyCustomerProfile();
        setCustomer(me || null);
        if (!me?.id && !me?.customerId) throw new Error("Không lấy được thông tin khách hàng");
        const conv = await getOrCreateConversationByCustomerId(me.customerId ?? me.id);
        setConversation(conv || null);
        if (conv?.conversationId || conv?.id) {
          const res = await getMessagesByConversation(conv.conversationId ?? conv.id, 0, 50);
          const content = res?.content ?? res ?? [];
          const sorted = Array.isArray(content)
            ? [...content].sort(
                (a, b) =>
                  new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0)
              )
            : [];
          setMessages(sorted);
          setPageInfo({
            page: res?.page ?? 0,
            size: res?.size ?? 50,
            last: Boolean(res?.last ?? true),
          });
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không tải được chat");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll messages every 8s
  useEffect(() => {
    if (!conversationId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await getMessagesByConversation(conversationId, 0, pageInfo.size || 50);
        const content = res?.content ?? res ?? [];
        const sorted = Array.isArray(content)
          ? [...content].sort(
              (a, b) =>
                new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0)
            )
          : [];
        setMessages(sorted);
      } catch {
        /* ignore polling error */
      }
    }, 8000);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [conversationId, pageInfo.size]);

  const onManualRefresh = async () => {
    if (!conversationId) return;
    try {
      const res = await getMessagesByConversation(conversationId, 0, pageInfo.size || 50);
      const content = res?.content ?? res ?? [];
      const sorted = Array.isArray(content)
        ? [...content].sort(
            (a, b) =>
              new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0)
          )
        : [];
      setMessages(sorted);
      // sẽ auto-scroll nhờ useLayoutEffect bên dưới
    } catch {
      toast.error("Không tải được tin nhắn");
    }
  };

  const onSend = async () => {
    const content = input.trim();
    if (!content) return;
    if (!conversationId || !customerId) return;
    try {
      setSending(true);
      await sendChatMessage({
        conversationId,
        senderType: "CUSTOMER",
        senderId: customerId,
        content,
      });
      setInput("");
      await onManualRefresh();
      // đảm bảo cuộn mượt sau khi render tin mới
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Gửi tin nhắn thất bại");
    } finally {
      setSending(false);
    }
  };

  const rows = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    return messages.map((m) => ({
      id: m.messageId || m.id,
      side: String(m.senderType || "").toUpperCase() === "CUSTOMER" ? "me" : "them",
      content: m.content || "",
      at: m.createdAt || m.sentAt || null,
      senderId: m.senderId,
      senderType: m.senderType,
    }));
  }, [messages]);

  // === Auto-scroll effect ===
  useLayoutEffect(() => {
    if (rows.length === 0) return;

    const latestId = rows[rows.length - 1]?.id;
    const isFirstPaint = !firstPaintDoneRef.current;

    // Lần đầu: cuộn "auto" (nhảy thẳng)
    if (isFirstPaint) {
      firstPaintDoneRef.current = true;
      requestAnimationFrame(() => scrollToBottom("auto"));
      lastMsgIdRef.current = latestId;
      return;
    }

    // Nếu có tin mới (last id thay đổi) -> cuộn mượt xuống cuối
    if (latestId && latestId !== lastMsgIdRef.current) {
      lastMsgIdRef.current = latestId;
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  }, [rows]);

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: 16 }}>
      <Space align="center" style={{ marginBottom: 12 }}>
        <CustomerServiceOutlined />
        <Title level={4} style={{ margin: 0 }}>Hỗ trợ trực tuyến</Title>
        <Button icon={<ReloadOutlined />} onClick={onManualRefresh} size="small">Làm mới</Button>
      </Space>

      <Card bodyStyle={{ padding: 0 }}>
        <div style={{ height: 520, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
            <Text type="secondary">
              {customer?.fullName || customer?.name || "Khách hàng"}
              {conversationId ? ` • Conversation #${conversationId}` : ""}
            </Text>
          </div>

          <div
            ref={scrollContainerRef}
            style={{ flex: 1, overflow: "auto", padding: 12 }}
          >
            {loading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                <Spin />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", flexDirection: 'column' }}>
                {emptyAnim ? (
                  <div style={{ width: 240, opacity: 0.95 }}>
                    <Lottie animationData={emptyAnim} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : null}
                <div style={{ marginTop: 8 }}>
                  <Empty description="Chưa có tin nhắn" />
                </div>
              </div>
            ) : (
              <>
                <List
                  dataSource={rows}
                  renderItem={(m) => (
                    <List.Item style={{ border: "none", padding: 0, marginBottom: 10 }}>
                      <div style={{ width: "100%", display: "flex", justifyContent: m.side === "me" ? "flex-end" : "flex-start" }}>
                        <Space>
                          {m.side === "them" && <Avatar icon={<UserOutlined />} />}
                          <div
                            style={{
                              background: m.side === "me" ? "#101828" : "#f2f4f7",
                              color: m.side === "me" ? "#fff" : "#101828",
                              padding: "8px 12px",
                              borderRadius: 12,
                              maxWidth: 520,
                              wordBreak: "break-word",
                            }}
                          >
                            <div style={{ fontSize: 14 }}>{m.content}</div>
                            {m.at && (
                              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                                {dayjs(m.at).format("DD/MM/YYYY HH:mm")}
                              </div>
                            )}
                          </div>
                          {m.side === "me" && <Avatar style={{ backgroundColor: "#101828" }} icon={<UserOutlined />} />}
                        </Space>
                      </div>
                    </List.Item>
                  )}
                />
                {/* Sentinel để cuộn xuống cuối */}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          <div style={{ padding: 12, borderTop: "1px solid #f0f0f0", display: "flex", gap: 8 }}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập tin nhắn..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={onSend} loading={sending} disabled={!input.trim()}>
              Gửi
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
