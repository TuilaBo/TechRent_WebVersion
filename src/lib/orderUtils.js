/**
 * Format VND currency
 */
export function formatVND(n = 0) {
  try {
    const num = Number(n);
    if (Number.isNaN(num)) return "0 VNĐ";
    const rounded = Math.round(num);
    const formatted = rounded.toLocaleString("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return `${formatted} VNĐ`;
  } catch {
    return `${n} VNĐ`;
  }
}

/**
 * Format date time to Vietnamese locale
 */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Calculate difference in days between two dates
 */
export function diffDays(startIso, endIso) {
  if (!startIso || !endIso) return 1;
  const s = new Date(startIso);
  const e = new Date(endIso);
  // Calculate based on date only (ignore time) to get accurate day count
  const startDateOnly = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const endDateOnly = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const diff = endDateOnly - startDateOnly;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Math.max(1, days || 1);
}

/**
 * Create print sandbox element
 */
export function createPrintSandbox() {
  if (typeof document === "undefined") return null;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.background = "#ffffff";
  container.style.width = "794px";
  container.style.minHeight = "10px";
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);
  return container;
}

/**
 * Cleanup print sandbox element
 */
export function cleanupPrintSandbox(node) {
  if (!node) return;
  try {
    node.innerHTML = "";
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  } catch (err) {
    console.warn("Cleanup print sandbox error:", err);
  }
}

/**
 * Print PDF from URL
 */
export function printPdfUrl(url) {
  if (!url) return;
  const w = window.open(url, "_blank", "noopener");
  if (w) {
    const listener = () => {
      try { w.focus(); w.print(); } catch (err) { console.error("Print window error:", err); }
    };
    setTimeout(listener, 800);
  }
}

