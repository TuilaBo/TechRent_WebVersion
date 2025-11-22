// src/lib/notificationsSocket.js
// STOMP-over-SockJS client wrapper loaded at runtime via CDN (no build deps)

const STOMP_CDN = "https://cdn.jsdelivr.net/npm/@stomp/stompjs@7.0.0/bundles/stomp.umd.min.js";
const SOCKJS_CDN = "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js";

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    // Already loaded?
    const exists = Array.from(document.scripts || []).some((s) => s.src === src);
    if (exists) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = (e) => reject(e);
    document.head.appendChild(el);
  });
}

async function ensureStompAndSock() {
  // Load SockJS first
  await loadScriptOnce(SOCKJS_CDN);
  await loadScriptOnce(STOMP_CDN);
  const StompJs = window.StompJs || window.Stomp;
  const SockJS = window.SockJS;
  if (!StompJs || !SockJS) {
    throw new Error("STOMP or SockJS global not available after loading CDN scripts.");
  }
  return { StompJs, SockJS };
}

/**
 * Create and connect a STOMP client for a given customerId.
 * - endpoint: BE SockJS endpoint (e.g. '/ws')
 * - subscriptions attempted:
 *   1) `/user/queue/notifications`
 *   2) `/topic/notifications.customer.{customerId}`
 */
function resolveEndpoint(endpointOpt) {
  // Priority 1: explicit argument
  if (endpointOpt) {
    if (/^https?:\/\//i.test(endpointOpt)) return endpointOpt;
    if (endpointOpt.startsWith("/")) return `${window.location.origin}${endpointOpt}`;
    return endpointOpt;
  }
  // Priority 2: env overrides
  const envWsEndpoint = (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_WS_ENDPOINT || import.meta.env.VITE_WS_BASE_URL)) || "";
  if (envWsEndpoint) {
    if (/^https?:\/\//i.test(envWsEndpoint)) return envWsEndpoint;
    return `${window.location.origin}${envWsEndpoint.startsWith("/") ? "" : "/"}${envWsEndpoint}`;
  }
  // Priority 3: derive from API base
  const apiBase = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";
  if (apiBase) {
    if (/^https?:\/\//i.test(apiBase)) {
      // If API base is absolute, attach /ws
      return `${apiBase.replace(/\/+$/,"")}/ws`;
    }
    // API is proxied (e.g. '/api') -> assume '/api/ws'
    return `${window.location.origin}${apiBase.replace(/\/+$/,"")}/ws`;
  }
  // Fallback: same-origin '/api/ws', then devs can override if needed
  return `${window.location.origin}/api/ws`;
}

export function connectCustomerNotifications({ endpoint, customerId, onMessage, onConnect, onError }) {
  if (!customerId || typeof window === "undefined" || !document?.head) {
    return { disconnect: () => {} };
  }
  const resolvedEndpoint = resolveEndpoint(endpoint);

  let client = null;
  let subscriptions = [];
  let active = true;

  (async () => {
    try {
      const { StompJs, SockJS } = await ensureStompAndSock();
      if (!active) return;
      client = new StompJs.Client({
        webSocketFactory: () => {
          console.log("🔌 WebSocket: Creating SockJS connection to:", resolvedEndpoint);
          return new SockJS(resolvedEndpoint);
        },
        reconnectDelay: 3000,
        debug: (str) => {
          // Log STOMP debug messages
          if (str && typeof str === "string") {
            if (str.includes("CONNECTED") || str.includes("Connected")) {
              console.log("✅ WebSocket: STOMP Connected", str);
            } else if (str.includes("ERROR") || str.includes("Error")) {
              console.error("❌ WebSocket: STOMP Error", str);
            } else {
              console.log("🔍 WebSocket: STOMP Debug", str);
            }
          }
        },
      });

      client.onConnect = (frame) => {
        console.log("✅ WebSocket: Connected successfully!", frame);
        try {
          // Generic broadcast topic(s)
          const sub1 = client.subscribe("/topic/notifications", (msg) => {
            console.log("📨 WebSocket: Received message from /topic/notifications", msg.body);
            try {
              const body = JSON.parse(msg.body || "{}");
              onMessage && onMessage(body);
            } catch (e) {
              console.warn("⚠️ WebSocket: Failed to parse message from /topic/notifications", e);
              onMessage && onMessage({ raw: msg.body });
            }
          });
          subscriptions.push(sub1);
          console.log("✅ WebSocket: Subscribed to /topic/notifications");
        } catch (e) {
          console.error("❌ WebSocket: Failed to subscribe to /topic/notifications", e);
        }
        try {
          const sub2 = client.subscribe("/topic/orders.status", (msg) => {
            console.log("📨 WebSocket: Received message from /topic/orders.status", msg.body);
            try {
              const body = JSON.parse(msg.body || "{}");
              onMessage && onMessage(body);
            } catch (e) {
              console.warn("⚠️ WebSocket: Failed to parse message from /topic/orders.status", e);
              onMessage && onMessage({ raw: msg.body });
            }
          });
          subscriptions.push(sub2);
          console.log("✅ WebSocket: Subscribed to /topic/orders.status");
        } catch (e) {
          console.error("❌ WebSocket: Failed to subscribe to /topic/orders.status", e);
        }
        try {
          const sub3 = client.subscribe("/user/queue/notifications", (msg) => {
            console.log("📨 WebSocket: Received message from /user/queue/notifications", msg.body);
            try {
              const body = JSON.parse(msg.body || "{}");
              onMessage && onMessage(body);
            } catch (e) {
              console.warn("⚠️ WebSocket: Failed to parse message from /user/queue/notifications", e);
              onMessage && onMessage({ raw: msg.body });
            }
          });
          subscriptions.push(sub3);
          console.log("✅ WebSocket: Subscribed to /user/queue/notifications");
        } catch (e) {
          console.error("❌ WebSocket: Failed to subscribe to /user/queue/notifications", e);
        }
        // Spring WebSocket thường dùng user-specific queue với pattern /user/{username}/queue/...
        try {
          const userQueue = `/user/${customerId}/queue/notifications`;
          const sub3b = client.subscribe(userQueue, (msg) => {
            console.log(`📨 WebSocket: Received message from ${userQueue}`, msg.body);
            try {
              const body = JSON.parse(msg.body || "{}");
              onMessage && onMessage(body);
            } catch (e) {
              console.warn(`⚠️ WebSocket: Failed to parse message from ${userQueue}`, e);
              onMessage && onMessage({ raw: msg.body });
            }
          });
          subscriptions.push(sub3b);
          console.log(`✅ WebSocket: Subscribed to ${userQueue}`);
        } catch (e) {
          console.error(`❌ WebSocket: Failed to subscribe to /user/${customerId}/queue/notifications`, e);
        }

        try {
          // Backend sử dụng pattern: /topic/customers/{customerId}/notifications
          const backendTopic = `/topic/customers/${customerId}/notifications`;
          const sub4 = client.subscribe(backendTopic, (msg) => {
            console.log(`📨 WebSocket: Received message from ${backendTopic}`, msg.body);
            try {
              const body = JSON.parse(msg.body || "{}");
              onMessage && onMessage(body);
            } catch (e) {
              console.warn(`⚠️ WebSocket: Failed to parse message from ${backendTopic}`, e);
              onMessage && onMessage({ raw: msg.body });
            }
          });
          subscriptions.push(sub4);
          console.log(`✅ WebSocket: Subscribed to ${backendTopic}`);
        } catch (e) {
          console.error(`❌ WebSocket: Failed to subscribe to ${backendTopic}`, e);
        }
        try {
          const topic = `/topic/notifications.customer.${customerId}`;
          const sub5 = client.subscribe(topic, (msg) => {
            console.log(`📨 WebSocket: Received message from ${topic}`, msg.body);
            try {
              const body = JSON.parse(msg.body || "{}");
              onMessage && onMessage(body);
            } catch (e) {
              console.warn(`⚠️ WebSocket: Failed to parse message from ${topic}`, e);
              onMessage && onMessage({ raw: msg.body });
            }
          });
          subscriptions.push(sub5);
          console.log(`✅ WebSocket: Subscribed to ${topic}`);
          // Some systems may use an orders-specific per-customer topic
          const topic2 = `/topic/orders.customer.${customerId}`;
          const sub6 = client.subscribe(topic2, (msg) => {
            console.log(`📨 WebSocket: Received message from ${topic2}`, msg.body);
            try {
              const body = JSON.parse(msg.body || "{}");
              onMessage && onMessage(body);
            } catch (e) {
              console.warn(`⚠️ WebSocket: Failed to parse message from ${topic2}`, e);
              onMessage && onMessage({ raw: msg.body });
            }
          });
          subscriptions.push(sub6);
          console.log(`✅ WebSocket: Subscribed to ${topic2}`);
        } catch (e) {
          console.error(`❌ WebSocket: Failed to subscribe to customer topics for ${customerId}`, e);
        }

        onConnect && onConnect();
      };

      client.onStompError = (err) => {
        console.error("❌ WebSocket: STOMP Error", err);
        onError && onError(err);
      };
      client.onWebSocketError = (err) => {
        console.error("❌ WebSocket: WebSocket Error", err);
        onError && onError(err);
      };

      console.log("🚀 WebSocket: Activating STOMP client...");
      client.activate();
    } catch (e) {
      console.error("❌ WebSocket: Failed to initialize", e, "Endpoint:", resolvedEndpoint);
      onError && onError({ error: e, endpoint: resolvedEndpoint });
    }
  })();

  return {
    disconnect: () => {
      active = false;
      try {
        subscriptions.forEach((s) => s && s.unsubscribe && s.unsubscribe());
        subscriptions = [];
      } catch {}
      try {
        client && client.deactivate && client.deactivate();
      } catch {}
    },
  };
}


