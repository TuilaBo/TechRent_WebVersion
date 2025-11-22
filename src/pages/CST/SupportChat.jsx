// src/pages/CST/SupportChat.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Layout, List, Card, Input, Button, Typography, Avatar, Space, Spin, Empty } from "antd";
import { MessageOutlined, SendOutlined, UserOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";

import { useAuthStore } from "../../store/authStore";
import { listActiveStaff } from "../../lib/staffManage";
import {
  getConversationsByStaffId,
  getMessagesByConversation,
  sendChatMessage,
} from "../../lib/chatApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function SupportChat() {
  const user = useAuthStore((s) => s.user);
  const staffId = user?.staffId ?? user?.id;

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null); // conversation object
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const pollRef = useRef(null);

  // ==== Auto-scroll refs & helpers ====
  const scrollContainerRef = useRef(null);
  const endRef = useRef(null); // sentinel ở đáy
  const lastMsgIdRef = useRef(null);
  const firstPaintDoneRef = useRef(false);

  const [effectiveStaffId, setEffectiveStaffId] = useState(null);
  const [customerMap, setCustomerMap] = useState({}); // { [customerId]: normalized customer }

  const conversationId = selected?.conversationId || selected?.id;

  const scrollToBottom = (behavior = "auto") => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior, block: "end" });
    } else if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  };

  const loadConversations = useCallback(async () => {
    // Resolve effective staffId from auth (avoid falling back to account/user id as staffId)
    let effId = user?.staffId ?? user?.staff?.staffId ?? staffId;

    if (!effId && (user?.accountId || user?.id)) {
      try {
        const actives = await listActiveStaff();
        const me = (actives || []).find((s) => Number(s.accountId) === Number(user?.accountId ?? user?.id));
        if (me?.staffId) effId = me.staffId;
      } catch {
        /* ignore */
      }
    }
    if (!effId) {
      setLoadingConvs(false);
      return;
    }
    setEffectiveStaffId(Number(effId));
    try {
      setLoadingConvs(true);
      const res = await getConversationsByStaffId(effId, 0, 20);
      const rows = res?.content ?? res ?? [];
      try { console.debug("SupportChat conversations:", { effId, res }); } catch { /* ignore */ }
      setConversations(Array.isArray(rows) ? rows : []);
      // Preload customer info for listing
      const ids = Array.from(new Set((rows || []).map((r) => r.customerId).filter(Boolean)));
      ids.forEach(async (cid) => {
        if (!customerMap[cid]) {
          try {
            const raw = await fetchCustomerById(cid);
            setCustomerMap((m) => ({ ...m, [cid]: normalizeCustomer ? normalizeCustomer(raw) : raw }));
          } catch { /* ignore */ }
        }
      });
      if (!selected && rows?.length) setSelected(rows[0]);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không tải được hội thoại");
    } finally {
      setLoadingConvs(false);
    }
  }, [staffId, user, selected, customerMap]);

  useEffect(() => {
    loadConversations();
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [loadConversations]);

  const loadMessages = useCallback(async (cid) => {
    if (!cid) return;
    try {
      setLoadingMsgs(true);
      const res = await getMessagesByConversation(cid, 0, 100);
      const content = res?.content ?? res ?? [];
      const sorted = Array.isArray(content)
        ? [...content].sort((a, b) => new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0))
        : [];
      setMessages(sorted);
      // Preload customer info by senderId for CUSTOMER messages
      const customerIds = Array.from(new Set((content || [])
        .filter((m) => String(m.senderType || "").toUpperCase() === "CUSTOMER")
        .map((m) => m.senderId)
        .filter(Boolean)));
      customerIds.forEach(async (cid2) => {
        if (!customerMap[cid2]) {
          try {
            const r = await fetchCustomerById(cid2);
            setCustomerMap((m) => ({ ...m, [cid2]: normalizeCustomer ? normalizeCustomer(r) : r }));
          } catch { /* ignore */ }
        }
      });
      // Không cuộn ở đây; để useLayoutEffect xử lý để mượt hơn
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không tải được tin nhắn");
    } finally {
      setLoadingMsgs(false);
    }
  }, [customerMap]);

  // Load msgs khi đổi selection
  useEffect(() => {
    if (conversationId) {
      // reset cờ để lần hiển thị đầu cuộn “nhảy thẳng”
      firstPaintDoneRef.current = false;
      lastMsgIdRef.current = null;
      loadMessages(conversationId);
    }
  }, [conversationId, loadMessages]);

  // Poll messages cho hội thoại đang chọn
  useEffect(() => {
    if (!conversationId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await getMessagesByConversation(conversationId, 0, 100);
        const content = res?.content ?? res ?? [];
        const sorted = Array.isArray(content)
          ? [...content].sort((a, b) => new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0))
          : [];
        setMessages(sorted);
      } catch {
        /* ignore */
      }
    }, 6000);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [conversationId]);

  const onSend = async () => {
    const content = input.trim();
    if (!conversationId) {
      toast.error("Chọn một hội thoại trước khi gửi.");
      return;
    }
    if (!effectiveStaffId) {
      toast.error("Không xác định được staffId.");
      return;
    }
    if (!content) return;
    try {
      setSending(true);
      await sendChatMessage({
        conversationId,
        senderType: "STAFF",
        senderId: Number(effectiveStaffId),
        content,
      });
      setInput("");
      await loadMessages(conversationId);
      // đảm bảo cuộn mượt sau khi tin mới render
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Gửi tin nhắn thất bại");
    } finally {
      setSending(false);
    }
  };

  const rows = useMemo(() => {
    return (Array.isArray(messages) ? messages : []).map((m) => ({
      id: m.messageId || m.id,
      side: String(m.senderType || "").toUpperCase() === "STAFF" ? "me" : "them",
      content: m.content || "",
      at: m.createdAt || m.sentAt || null,
    }));
  }, [messages]);

  // ==== Auto-scroll effect ====
  useLayoutEffect(() => {
    if (rows.length === 0) return;

    const latestId = rows[rows.length - 1]?.id;
    const isFirstPaint = !firstPaintDoneRef.current;

    if (isFirstPaint) {
      firstPaintDoneRef.current = true;
      requestAnimationFrame(() => scrollToBottom("auto")); // nhảy thẳng lần đầu
      lastMsgIdRef.current = latestId;
      return;
    }

    if (latestId && latestId !== lastMsgIdRef.current) {
      lastMsgIdRef.current = latestId;
      requestAnimationFrame(() => scrollToBottom("smooth")); // có tin mới -> cuộn mượt
    }
  }, [rows, conversationId]);

  return (
    <Layout style={{ background: "transparent", gap: 12 }}>
      <Sider width={320} theme="light" style={{ background: "#fff", padding: 12, borderRadius: 12 }}>
        <Space align="center" style={{ marginBottom: 12 }}>
          <MessageOutlined />
          <Title level={5} style={{ margin: 0 }}>Hội thoại</Title>
          <Button icon={<ReloadOutlined />} size="small" onClick={loadConversations} />
        </Space>
        {loadingConvs ? (
          <div style={{ display: "flex", height: 200, alignItems: "center", justifyContent: "center" }}>
            <Spin />
          </div>
        ) : conversations.length === 0 ? (
          <Empty description="Chưa có hội thoại" />
        ) : (
          <List
            dataSource={conversations}
            renderItem={(c) => (
              <List.Item
                key={c.conversationId || c.id}
                onClick={() => setSelected(c)}
                style={{ cursor: "pointer", background: (c.conversationId||c.id)===conversationId?"#f5f5f5":"transparent", borderRadius: 8, padding: 8 }}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={(
                    <div>
                      #{c.conversationId || c.id}
                      <div style={{ fontSize: 12, color: '#667085' }}>
                        {customerMap[c.customerId]?.fullName || `Khách hàng #${c.customerId}`}
                      </div>
                    </div>
                  )}
                  description={(
                    <div style={{ fontSize: 12, color: '#98A2B3' }}>
                      {customerMap[c.customerId]?.email || ''}
                      {customerMap[c.customerId]?.phoneNumber ? ` • ${customerMap[c.customerId]?.phoneNumber}` : ''}
                    </div>
                  )}
                />
              </List.Item>
            )}
          />
        )}
      </Sider>

      <Content>
        <Card bodyStyle={{ padding: 0 }}>
          <div style={{ height: 560, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
              <Text type="secondary">Conversation #{conversationId || "—"}</Text>
            </div>

            <div
              ref={scrollContainerRef}
              style={{ flex: 1, overflow: "auto", padding: 12 }}
            >
              {loadingMsgs ? (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Spin />
                </div>
              ) : rows.length === 0 ? (
                <Empty description="Chưa có tin nhắn" />
              ) : (
                <>
                  <List
                    dataSource={rows}
                    renderItem={(m) => (
                      <List.Item style={{ border: "none", padding: 0, marginBottom: 10 }}>
                        <div style={{ width: "100%", display: "flex", justifyContent: m.side === "me" ? "flex-end" : "flex-start" }}>
                          <Space>
                            {m.side === "them" && <Avatar icon={<UserOutlined />} />}
                            <div style={{ background: m.side === "me" ? "#101828" : "#f2f4f7", color: m.side === "me" ? "#fff" : "#101828", padding: "8px 12px", borderRadius: 12, maxWidth: 560, wordBreak: "break-word" }}>
                              <div style={{ fontSize: 14 }}>{m.content}</div>
                              {m.at && <div style={{ fontSize: 11, opacity: .65, marginTop: 2 }}>{dayjs(m.at).format("DD/MM/YYYY HH:mm")}</div>}
                            </div>
                            {m.side === "me" && <Avatar style={{ backgroundColor: "#101828" }} icon={<UserOutlined />} />}
                          </Space>
                        </div>
                      </List.Item>
                    )}
                  />
                  {/* Sentinel đáy để auto-scroll */}
                  <div ref={endRef} />
                </>
              )}
            </div>

            <div style={{ padding: 12, borderTop: "1px solid #f0f0f0", display: "flex", gap: 8 }}>
              <Input.TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập phản hồi..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); onSend(); } }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={onSend}
                loading={sending}
                disabled={!input.trim() || !conversationId || !effectiveStaffId}
              >
                Gửi
              </Button>
            </div>
          </div>
        </Card>
      </Content>
    </Layout>
  );
}
