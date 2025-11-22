// src/lib/chatApi.js
import { api } from "./api";

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? null;
}

// POST /api/chat/conversations/customer/{customerId}
// Get existing conversation or create new one for a customer
export async function getOrCreateConversationByCustomerId(customerId) {
  const res = await api.post(`/api/chat/conversations/customer/${Number(customerId)}`);
  return unwrap(res);
}

// GET /api/chat/conversations/staff/{staffId}?page=&size=
export async function getConversationsByStaffId(staffId, page = 0, size = 20) {
  const res = await api.get(
    `/api/chat/conversations/staff/${Number(staffId)}`,
    { params: { page, size } }
  );
  return unwrap(res);
}

// POST /api/chat/messages
// body: { conversationId, senderType: "CUSTOMER"|"STAFF", senderId, content }
export async function sendChatMessage(payload) {
  const body = {
    conversationId: Number(payload.conversationId),
    senderType: String(payload.senderType || "").toUpperCase(),
    senderId: Number(payload.senderId),
    content: String(payload.content || "").trim(),
  };
  const res = await api.post("/api/chat/messages", body);
  return unwrap(res);
}

// GET /api/chat/messages/conversation/{conversationId}?page=&size=
export async function getMessagesByConversation(conversationId, page = 0, size = 20) {
  const res = await api.get(
    `/api/chat/messages/conversation/${Number(conversationId)}`,
    { params: { page, size } }
  );
  return unwrap(res);
}

// Convenience: get messages by customerId (auto create conversation if not exists)
export async function getMessagesByCustomerId(customerId, page = 0, size = 20) {
  const conv = await getOrCreateConversationByCustomerId(customerId);
  const conversationId = conv?.conversationId || conv?.id;
  if (!conversationId) return { content: [], page, size, totalElements: 0, totalPages: 0, numberOfElements: 0, last: true };
  return getMessagesByConversation(conversationId, page, size);
}

export default {
  getOrCreateConversationByCustomerId,
  getConversationsByStaffId,
  sendChatMessage,
  getMessagesByConversation,
  getMessagesByCustomerId,
};


