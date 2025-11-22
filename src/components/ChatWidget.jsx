// src/components/ChatWidget.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { List, Avatar, Space, Spin, Empty, Input, Button, Typography } from "antd";
import { UserOutlined, SendOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";

import { fetchMyCustomerProfile } from "../lib/customerApi";
import {
  getOrCreateConversationByCustomerId,
  getMessagesByConversation,
  sendChatMessage,
} from "../lib/chatApi";

const { Text } = Typography;

export default function ChatWidget() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const pollRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  // NEW: đo chiều cao composer để chèn padding dưới cho vùng list
  const composerRef = useRef(null);
  const [composerH, setComposerH] = useState(0);

  const conversationId = conversation?.conversationId || conversation?.id;
  const customerId = customer?.customerId || customer?.id;

  const scrollToBottom = (behavior = "auto") => {
    if (bottomRef.current) {
      try {
        bottomRef.current.scrollIntoView({ behavior, block: "end" });
        return;
      } catch {}
    }
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // đo composer height theo thời gian thực
  useEffect(() => {
    if (!composerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0;
      setComposerH(h);
    });
    ro.observe(composerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const me = await fetchMyCustomerProfile();
        setCustomer(me || null);

        const conv = await getOrCreateConversationByCustomerId(me?.customerId ?? me?.id);
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
          const last = sorted.at(-1);
          lastMsgIdRef.current = last ? last.messageId || last.id : null;
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không tải được chat");
      } finally {
        setLoading(false);
        setTimeout(() => scrollToBottom("auto"), 0);
      }
    })();
    return () => pollRef.current && clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await getMessagesByConversation(conversationId, 0, 50);
        const content = res?.content ?? res ?? [];
        const sorted = Array.isArray(content)
          ? [...content].sort(
              (a, b) =>
                new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0)
            )
          : [];
        setMessages(sorted);
      } catch {}
    }, 8000);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [conversationId]);

  const refresh = async () => {
    if (!conversationId) return;
    try {
      const res = await getMessagesByConversation(conversationId, 0, 50);
      const content = res?.content ?? res ?? [];
      const sorted = Array.isArray(content)
        ? [...content].sort(
            (a, b) =>
              new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0)
          )
        : [];
      setMessages(sorted);
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
      await sendChatMessage({ conversationId, senderType: "CUSTOMER", senderId: customerId, content });
      setInput("");
      await refresh();
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
    }));
  }, [messages]);

  // Auto scroll khi có message mới thực sự
  useEffect(() => {
    if (!rows.length) return;
    const last = rows[rows.length - 1];
    const lastId = last?.id ?? null;
    if (lastId && lastId !== lastMsgIdRef.current) {
      lastMsgIdRef.current = lastId;
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  }, [rows]);

  // Nếu composer đổi cao → cập nhật padding + giữ đáy
  useEffect(() => {
    // khi chiều cao composer thay đổi, đảm bảo không che tin cuối
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [composerH]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Text type="secondary">
          {customer?.fullName || customer?.name || "Khách hàng"}
          {conversationId ? ` • Conversation #${conversationId}` : ""}
        </Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>
          Làm mới
        </Button>
      </div>

      {/* Vùng danh sách — thêm paddingBottom theo composerH để không bị che */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: 12,
          paddingBottom: 12 + Math.ceil(composerH), // quan trọng
          minHeight: 0,
        }}
      >
        {loading ? (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
            <Spin />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
            <Empty description="Chưa có tin nhắn" />
          </div>
        ) : (
          <List
            dataSource={rows}
            renderItem={(m) => (
              <List.Item style={{ border: "none", padding: 0, marginBottom: 10 }}>
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: m.side === "me" ? "flex-end" : "flex-start",
                  }}
                >
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
        )}
        {/* Sentinel — có scroll-margin-bottom để nhảy tới còn chừa khoảng trống */}
        <div ref={bottomRef} style={{ height: 1, scrollMarginBottom: Math.ceil(composerH) + 8 }} />
      </div>

      {/* Composer */}
      <div
        ref={composerRef}
        style={{
          padding: 12,
          borderTop: "1px solid #f0f0f0",
          display: "flex",
          gap: 8,
          background: "#fff",
        }}
      >
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
  );
}
