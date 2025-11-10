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
        webSocketFactory: () => new SockJS(resolvedEndpoint),
        reconnectDelay: 3000,
        debug: () => {},
      });

      client.onConnect = () => {
        try {
          // Generic broadcast topic(s)
          subscriptions.push(
            client.subscribe("/topic/notifications", (msg) => {
              try {
                const body = JSON.parse(msg.body || "{}");
                onMessage && onMessage(body);
              } catch {
                onMessage && onMessage({ raw: msg.body });
              }
            })
          );
        } catch {}
        try {
          subscriptions.push(
            client.subscribe("/topic/orders.status", (msg) => {
              try {
                const body = JSON.parse(msg.body || "{}");
                onMessage && onMessage(body);
              } catch {
                onMessage && onMessage({ raw: msg.body });
              }
            })
          );
        } catch {}
        try {
          subscriptions.push(
            client.subscribe("/user/queue/notifications", (msg) => {
              try {
                const body = JSON.parse(msg.body || "{}");
                onMessage && onMessage(body);
              } catch {
                onMessage && onMessage({ raw: msg.body });
              }
            })
          );
        } catch {}

        try {
          const topic = `/topic/notifications.customer.${customerId}`;
          subscriptions.push(
            client.subscribe(topic, (msg) => {
              try {
                const body = JSON.parse(msg.body || "{}");
                onMessage && onMessage(body);
              } catch {
                onMessage && onMessage({ raw: msg.body });
              }
            })
          );
          // Some systems may use an orders-specific per-customer topic
          const topic2 = `/topic/orders.customer.${customerId}`;
          subscriptions.push(
            client.subscribe(topic2, (msg) => {
              try {
                const body = JSON.parse(msg.body || "{}");
                onMessage && onMessage(body);
              } catch {
                onMessage && onMessage({ raw: msg.body });
              }
            })
          );
        } catch {}

        onConnect && onConnect();
      };

      client.onStompError = (err) => onError && onError(err);
      client.onWebSocketError = (err) => onError && onError(err);

      client.activate();
    } catch (e) {
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


