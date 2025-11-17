// src/pages/orders/MyOrders.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Table, Tag, Typography, Input, DatePicker, Space, Button,
  Dropdown, Menu, Tooltip, message, Drawer, Descriptions,
  Avatar, Tabs, Modal, Card, Row, Col, Divider, Form, Steps, Radio, Checkbox, Alert
} from "antd";
import {
  SearchOutlined, FilterOutlined, EyeOutlined,
  ReloadOutlined, FilePdfOutlined, DownloadOutlined, ExpandOutlined, DollarOutlined, PrinterOutlined
} from "@ant-design/icons";
import { listRentalOrders, getRentalOrderById } from "../../lib/rentalOrdersApi";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getMyContracts, getContractById, normalizeContract, sendPinEmail, signContract as signContractApi } from "../../lib/contractApi";
import { fetchMyCustomerProfile, normalizeCustomer } from "../../lib/customerApi";
import { connectCustomerNotifications } from "../../lib/notificationsSocket";
import { getMyKyc } from "../../lib/kycApi";
import { createPayment, getInvoiceByRentalOrderId } from "../../lib/Payment";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AnimatedEmpty from "../../components/AnimatedEmpty.jsx";
import { useLocation } from "react-router-dom";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/* =========================
 * 0) CONSTS
 * ========================= */
const ORDER_STATUS_MAP = {
  pending:   { label: "Chờ xác nhận", color: "default" },
  pending_kyc: { label: "Chờ xác thực thông tin", color: "orange" },
  confirmed: { label: "Đã xác nhận",  color: "blue"    },
  delivering:{ label: "Đang giao",    color: "cyan"    },
  active:    { label: "Đang thuê",    color: "gold"    },
  in_use:    { label: "Đang sử dụng", color: "geekblue" },
  returned:  { label: "Đã trả",       color: "green"   },
  cancelled: { label: "Đã hủy",       color: "red"     },
  processing:{ label: "Đang xử lý",   color: "purple"  },
  delivery_confirmed: { label: "Đã xác nhận giao hàng", color: "green" },
};
const PAYMENT_STATUS_MAP = {
  unpaid:   { label: "Chưa thanh toán",      color: "volcano"  },
  paid:     { label: "Đã thanh toán",        color: "green"    },
  refunded: { label: "Đã hoàn tiền",         color: "geekblue" },
  partial:  { label: "Chưa thanh toán thành công",  color: "purple"   },
};

// Map invoice status to payment status
const mapInvoiceStatusToPaymentStatus = (invoiceStatus) => {
  if (!invoiceStatus) return "unpaid";
  const status = String(invoiceStatus).toUpperCase();
  if (status === "SUCCEEDED" || status === "PAID" || status === "COMPLETED") {
    return "paid";
  }
  if (status === "FAILED" || status === "CANCELLED" || status === "EXPIRED") {
    return "unpaid";
  }
  if (status === "PENDING" || status === "PROCESSING") {
    return "partial";
  }
  if (status === "REFUNDED") {
    return "refunded";
  }
  return "unpaid";
};
const CONTRACT_STATUS_MAP = {
  draft: { label: "Nháp", color: "default" },
  pending_signature: { label: "Chờ khách hàng ký", color: "gold" },
  pending_admin_signature: { label: "Chờ ký (admin)", color: "orange" },
  signed: { label: "Đã ký", color: "green" },
  active: { label: "2 bên đã ký", color: "green" },
  expired: { label: "Hết hạn", color: "red" },
  cancelled: { label: "Đã hủy", color: "red" },
};
const CONTRACT_TYPE_LABELS = { RENTAL: "Hợp đồng thuê thiết bị" };

/* =========================
 * 1) UTILS
 * ========================= */
function formatVND(n = 0) {
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
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
function formatDateTime(iso) {
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

/* ---------- helpers định dạng tiền & layout cho contentHtml ---------- */

// Chuẩn hoá khoảng trắng HTML (&nbsp;) và dấu ":" lộn xộn
function normalizeHtmlSpaces(html = "") {
  if (!html) return html;
  let out = html.replace(/&nbsp;/gi, " ");
  out = out.replace(/\s*:\s*/g, ": ");
  return out;
}

// chuyển "1,234.56" / "1.234,56" / "1.000" / "1000.00" -> số
function parseAnyNumber(str = "") {
  if (!str) return 0;
  const s = String(str).trim();
  if (!s) return 0;

  if (s.includes(".") && s.includes(",")) {
    const v = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(v) ? v : 0;
  }
  if (!s.includes(".") && s.includes(",")) {
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : 0;
  }
  if (s.includes(".") && !s.includes(",")) {
    const parts = s.split(".");
    if (parts.length > 2) {
      const v = Number(s.replace(/\./g, ""));
      return Number.isFinite(v) ? v : 0;
    } else {
      const afterDot = parts[1] || "";
      if (afterDot.length <= 2) {
        const v = Number(s);
        return Number.isFinite(v) ? v : 0;
      }
      const v = Number(s.replace(/\./g, ""));
      return Number.isFinite(v) ? v : 0;
    }
  }
  const v = Number(s.replace(/,/g, ""));
  return Number.isFinite(v) ? v : 0;
}

/** Format các template tiền trong HTML:
 *  - Bắt được nhãn có thẻ HTML xen kẽ (</b>, <span>...) và khoảng trắng
 *  - Ví dụ: "<b>Tổng tiền thuê</b>: 1000.00&nbsp;VNĐ" -> "Tổng tiền thuê: 1.000 VNĐ"
 */
function formatMoneyInHtml(html = "") {
  if (!html) return html;
  html = normalizeHtmlSpaces(html);

  const SEP = String.raw`(?:\s|<\/?[^>]+>)*`; // cho phép chèn tag/space giữa từ

  const patterns = [
    new RegExp(`(Tổng${SEP}tiền${SEP}thuê)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`, "gi"),
    new RegExp(`(Tổng${SEP}tiền${SEP}cọc)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`, "gi"),
    new RegExp(`(Tiền${SEP}cọc)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`, "gi"),
    new RegExp(`(Giá${SEP}\\/?${SEP}ngày)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`, "gi"),
    new RegExp(`(Tổng${SEP}tiền|Tổng${SEP}cộng)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`, "gi"),
    new RegExp(`(Giá)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`, "gi"),
  ];

  for (const re of patterns) {
    html = html.replace(re, (_, label, num) => {
      const n = Math.round(parseAnyNumber(num));
      return `${label}: ${n.toLocaleString("vi-VN")} VNĐ`;
    });
  }

  // Các số lẻ có kèm đơn vị (không theo nhãn) — cũng cho phép chen thẻ
  const unitPattern = new RegExp(`(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)\\b`, "gi");
  html = html.replace(unitPattern, (_, num) => {
    const n = Math.round(parseAnyNumber(num));
    return `${n.toLocaleString("vi-VN")} VNĐ`;
  });

  return html;
}

// Format layout thiết bị + tổng tiền, và CHÈN "Tổng thanh toán"
function formatEquipmentLayout(html = "") {
  if (!html || typeof html !== "string") return html;

  // 1) Mỗi thiết bị 1 dòng có bullet
  html = html.replace(
    /(?:^|\n|•\s*)?(\d+x\s+[^-]+?)\s*-\s*Giá\/ngày:([^-]+?)\s*-\s*Tiền cọc:([^•\n<]+?)(?=\s*\d+x|$|\n|Tổng)/gim,
    '<div class="equipment-item">$1 - Giá/ngày:$2 - Tiền cọc:$3</div>'
  );

  // 2) Gom "Tổng tiền thuê" & "Tiền cọc" về cùng một dòng (nhiều cặp -> giữ NGUYÊN hết)
  const SEP = String.raw`(?:\s|<\/?[^>]+>)*`;
  // a) Đang ở 2 dòng
  html = html.replace(
    new RegExp(`(Tổng${SEP}tiền${SEP}thuê:[^<\\n]+?)(?:\\s*<br\\s*\\/?>|\\n|\\s+)(Tiền${SEP}cọc:[^<\\n]+?)(?=\\s*<|$|\\n)`, "gi"),
    '<div class="total-summary"><div class="total-rental">$1</div><div>$2</div></div>'
  );
  // b) Cùng dòng nhưng cách bởi space
  html = html.replace(
    new RegExp(`(Tổng${SEP}tiền${SEP}thuê:[^<\\n]+?)\\s+(Tiền${SEP}cọc:[^<\\n]+?)(?=\\s*<|$|\\n)`, "gi"),
    '<div class="total-summary"><div class="total-rental">$1</div><div>$2</div></div>'
  );

  // 3) Tính & chèn "Tổng thanh toán" dựa trên CẶP CUỐI CÙNG
  try {
    // Lấy hết các số của "Tổng tiền thuê" & "Tiền cọc"
    const rentReG = new RegExp(`Tổng${SEP}tiền${SEP}thuê${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(?:VNĐ|VND)`, "gi");
    const depReG  = new RegExp(`Tiền${SEP}cọc${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(?:VNĐ|VND)`, "gi");

    const rentMatches = [...html.matchAll(rentReG)];
    const depMatches  = [...html.matchAll(depReG)];

    if (rentMatches.length && depMatches.length) {
      const lastRent = rentMatches[rentMatches.length - 1];
      const lastDep  = depMatches[depMatches.length - 1];
      const rent = Math.round(parseAnyNumber(lastRent[1]));
      const dep  = Math.round(parseAnyNumber(lastDep[1]));
      const grand = rent + dep;
      const grandHtml = `<div class="grand-total">Tổng thanh toán: ${grand.toLocaleString("vi-VN")} VNĐ</div>`;

      // Nếu đã có nhiều .total-summary ⇒ chèn SAU .total-summary CUỐI CÙNG
      const lastSummaryRe = /<div class="total-summary">([\s\S]*?)<\/div>(?![\s\S]*<div class="total-summary">)/i;
      if (lastSummaryRe.test(html)) {
        html = html.replace(lastSummaryRe, (m) => `${m}\n${grandHtml}`);
      } else {
        // fallback: chèn sau vị trí "Tiền cọc:" CUỐI CÙNG
        const insertPos = lastDep.index + lastDep[0].length;
        html = html.slice(0, insertPos) + grandHtml + html.slice(insertPos);
      }
    }
  } catch {
    // ignore
  }

  return html;
}

function formatDatesInHtml(html = "") {
  if (!html || typeof html !== "string") return html;
  // Format ngày ISO với thời gian thành DD/MM/YYYY
  // Pattern: 2025-11-09T00:00 hoặc 2025-11-10T23:59:59.999
  const datePattern = /(\d{4}-\d{2}-\d{2})T[\d:.]+/g;
  return html.replace(datePattern, (match) => {
    try {
      const d = new Date(match);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch {
      // ignore
    }
    return match;
  });
}

function formatDateLabelsInHtml(html = "") {
  if (!html || typeof html !== "string") return html;
  // Thay thế label "Ngày bắt đầu" thành "Ngày bắt đầu thuê"
  // Thay thế label "Ngày kết thúc" thành "Ngày kết thúc thuê"
  const SEP = String.raw`(?:\s|<\/?[^>]+>)*`;
  html = html.replace(
    new RegExp(`(Ngày${SEP}bắt${SEP}đầu)${SEP}:`, "gi"),
    "Ngày bắt đầu thuê:"
  );
  html = html.replace(
    new RegExp(`(Ngày${SEP}kết${SEP}thúc)${SEP}:`, "gi"),
    "Ngày kết thúc thuê:"
  );
  return html;
}

// sạch noise + format tiền + format layout
function sanitizeContractHtml(html = "") {
  if (!html || typeof html !== "string") return html;
  let out = html.replace(/Brand\([^)]*brandName=([^,)]+)[^)]*\)/g, "$1");
  out = formatDatesInHtml(out); // Format ngày trước
  out = formatDateLabelsInHtml(out); // Format label ngày
  out = formatMoneyInHtml(out);
  out = formatEquipmentLayout(out);
  return out;
}

function diffDays(startIso, endIso) {
  if (!startIso || !endIso) return 1;
  const s = new Date(startIso);
  const e = new Date(endIso);
  const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, days || 1);
}

/* =========================
 * 2) CSS inlined cho PDF + Quốc hiệu
 * ========================= */
const GLOBAL_PRINT_CSS = `
  <style>
    h1,h2,h3 { margin: 8px 0 6px; font-weight: 700; }
    h3 { font-size: 14px; text-transform: uppercase; }
    p { margin: 6px 0; }
    ol, ul { margin: 6px 0 6px 18px; padding: 0; }
    li { margin: 3px 0; }
    .kv { margin-bottom: 10px; }
    .kv div { margin: 2px 0; }
    /* Format thiết bị thuê - mỗi thiết bị 1 dòng */
    .equipment-item { display: block; margin: 4px 0; }
    .equipment-item::before { content: "• "; }
    /* Format tổng tiền trên cùng 1 dòng */
    .total-summary { display: flex; gap: 16px; margin: 8px 0; }
    .total-summary > * { margin: 0; }
    .total-rental { font-weight: 700; }
    /* NEW: Tổng thanh toán */
    .grand-total { margin: 6px 0 12px; font-weight: 700; }
  </style>
`;

const NATIONAL_HEADER_HTML = `
  <div style="text-align:center; margin-bottom:12px">
    <div style="font-weight:700; font-size:14px; letter-spacing:.3px; text-transform:uppercase">
      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
    </div>
    <div style="font-size:13px; margin-top:2px">
      Độc lập – Tự do – Hạnh phúc
    </div>
    <div style="width:220px; height:0; border-top:1px solid #111; margin:6px auto 0"></div>
  </div>
`;

/* =========================
 * 3) Điều khoản mở rộng với list chuẩn
 * ========================= */
const EXTRA_CONTRACT_HTML = `
<section>
  <h3>Điều 1. Các thuật ngữ sử dụng trong hợp đồng</h3>
  <ol>
    <li><b>Bảo dưỡng và sửa chữa nhỏ</b>: Những sửa chữa không nằm trong định kỳ sửa chữa đã dự định theo thoả thuận hai Bên hoặc định kỳ phân bổ kế toán.</li>
    <li><b>Hao mòn tự nhiên</b>: Sự giảm giá trị thiết bị một cách tự nhiên dù sử dụng đúng công suất và bảo quản đúng quy định.</li>
    <li><b>Máy móc, thiết bị</b>: Là các máy móc, thiết bị được quy định tại Điều 2 của hợp đồng này.</li>
    <li><b>QC (Quality Check)</b>: Kiểm tra thiết bị sau khi trả về.</li>
    <li><b>BOM (Bill of Materials)</b>: Danh sách phụ kiện đi kèm.</li>
    <li><b>PBS / QAE</b>: Khoảng thời gian chuẩn bị trước & kiểm tra sau thuê — đã được tính vào lịch thuê.</li>
  </ol>

  <h3>Điều 2. Mục đích, thời hạn thuê</h3>
  <ol>
    <li>Thiết bị chỉ dùng vào mục đích hợp pháp theo quy định pháp luật Việt Nam.</li>
    <li>Gia hạn phải yêu cầu trước 48h; TechRent có quyền từ chối nếu lịch kín.</li>
  </ol>

  <h3>Điều 3. Thời gian, địa điểm chuyển giao máy móc, thiết bị</h3>
  <ol>
    <li>Bên B chuyển giao thiết bị cho Bên A tại địa điểm giao hàng vào thời gian đã xác định theo hợp đồng.</li>
    <li>Bên A hoàn trả thiết bị cho Bên B đúng địa điểm và thời gian đã xác định trong hợp đồng.</li>
    <li>Việc chuyển giao phải lập biên bản bàn giao, có xác nhận của đại diện hợp lệ hai bên.</li>
    <li>Nếu Bên A không có mặt quá 15 phút tại thời điểm nhận hàng theo hợp đồng, Bên B có quyền huỷ đơn.</li>
  </ol>

  <h3>Điều 4. Thời hạn và phương thức thanh toán</h3>
  <ol>
    <li>Bên A thanh toán trong 03 (ba) ngày làm việc kể từ khi nhận hoá đơn của Bên B.</li>
    <li>Phương thức thanh toán: Chuyển khoản ngân hàng.</li>
  </ol>

  <h3>Điều 5. Chậm trả và rủi ro</h3>
  <ol>
    <li>Khi Bên A chậm trả tài sản thuê, Bên B có quyền yêu cầu trả lại, thu tiền thuê thời gian chậm và yêu cầu phạt vi phạm theo chính sách.</li>
    <li>Trong thời gian chậm trả, rủi ro đối với tài sản thuộc về Bên A.</li>
  </ol>

  <h3>Điều 6. Quyền và nghĩa vụ Bên A</h3>
  <ol>
    <li><b>Nghĩa vụ</b>:
      <ul>
        <li>Thanh toán đúng và đủ theo Điều 2 & Điều 5.</li>
        <li>Hoàn trả thiết bị đúng thời gian, số lượng, tình trạng (trừ hao mòn tự nhiên).</li>
        <li>Nếu cố tình làm hư hỏng: cùng khắc phục; nếu không được phải bồi thường chi phí sửa chữa có hoá đơn chứng từ.</li>
        <li>Trường hợp mất mát do lỗi Bên A: bồi thường toàn bộ giá trị còn lại tại thời điểm mất.</li>
        <li>Không cho thuê/mượn lại cho bên thứ ba nếu không có chấp thuận bằng văn bản của Bên B.</li>
      </ul>
    </li>
    <li><b>Quyền</b>:
      <ul>
        <li>Yêu cầu Bên B sửa chữa/bảo dưỡng định kỳ; yêu cầu giảm giá nếu hư hỏng không do lỗi Bên A.</li>
        <li>Đơn phương đình chỉ và yêu cầu bồi thường nếu:
          <ul>
            <li>Quá 03 ngày làm việc gia hạn mà Bên B vẫn chưa giao, trừ bất khả kháng.</li>
            <li>Vi phạm nghiêm trọng quy định an ninh của Bên A khi giao nhận.</li>
            <li>Giao thiết bị nguồn gốc không rõ ràng.</li>
          </ul>
        </li>
        <li>Được ưu tiên tiếp tục thuê nếu sử dụng đúng mục đích, không gây mất mát/hư hại.</li>
      </ul>
    </li>
  </ol>

  <h3>Điều 7. Quyền và nghĩa vụ Bên B</h3>
  <ol>
    <li><b>Nghĩa vụ</b>:
      <ul>
        <li>Giao đúng loại, số lượng, thời gian, địa điểm; bảo đảm thiết bị đạt tiêu chuẩn chất lượng.</li>
        <li>Xuất biên bản bàn giao và hoá đơn theo thoả thuận.</li>
        <li>Thực hiện lắp đặt (nếu có) dưới giám sát của Bên A.</li>
        <li>Chịu trách nhiệm về quyền sở hữu thiết bị.</li>
        <li>Bảo dưỡng định kỳ, sửa chữa hư hỏng không nhỏ.</li>
        <li>Thông báo và phối hợp khắc phục khi phát hiện hư hại khi nhận lại.</li>
        <li>Nếu không thể giao đúng hạn: thông báo bằng văn bản và gia hạn nhưng không quá 03 ngày làm việc.</li>
        <li>Tuân thủ quy định an ninh của Bên A; gây thiệt hại phải bồi thường theo thoả thuận.</li>
        <li>Nhắc nhở bằng văn bản nếu phát hiện Bên A dùng sai mục đích/công dụng.</li>
      </ul>
    </li>
    <li><b>Quyền</b>:
      <ul>
        <li>Nhận đủ tiền thuê theo Điều 2 & Điều 5.</li>
        <li>Nhận lại thiết bị đúng thời gian, số lượng, tình trạng (trừ hao mòn tự nhiên).</li>
        <li>Gia hạn thời hạn giao thiết bị tối đa 03 ngày làm việc (có văn bản thông báo).</li>
        <li>Yêu cầu Bên A sử dụng đúng mục đích và công dụng; yêu cầu bồi thường khi hư hỏng do lỗi Bên A.</li>
      </ul>
    </li>
  </ol>

  <h3>Điều 8. Hiệu lực của hợp đồng</h3>
  <ol>
    <li>Hợp đồng có hiệu lực khi một trong các bên nhận được bản có ký tên & đóng dấu của cả hai bên.</li>
    <li>Hợp đồng hết hiệu lực khi:
      <ul>
        <li>Hai bên hoàn tất nghĩa vụ;</li>
        <li>Hai bên thoả thuận chấm dứt trước hạn;</li>
        <li>Thiết bị thuê không còn.</li>
      </ul>
    </li>
  </ol>

  <h3>Điều 9. Điều khoản chung</h3>
  <ol>
    <li>Hai bên cam kết thực hiện đúng hợp đồng; vướng mắc sẽ thương lượng trên tinh thần hợp tác cùng có lợi.</li>
    <li>Tranh chấp không tự giải quyết được thì yêu cầu Toà án có thẩm quyền giải quyết; phán quyết có hiệu lực buộc thi hành.</li>
    <li>Nếu muốn chấm dứt trước hạn phải thông báo trước 30 ngày; hoàn tất mọi nghĩa vụ thì hợp đồng tự thanh lý.</li>
    <li>Hợp đồng lập 04 bản tiếng Việt, mỗi bên giữ 02 bản có giá trị pháp lý như nhau.</li>
  </ol>
</section>
`;

function augmentContractContent(detail) {
  if (!detail) return detail;
  const base = String(detail.contentHtml || "");
  const mergedHtml = base + EXTRA_CONTRACT_HTML;
  return { ...detail, contentHtml: mergedHtml };
}

/* =========================
 * 4) MAP ORDER (chuẩn hoá từ BE)
 * ========================= */
async function mapOrderFromApi(order) {
  const backendId =
    order?.id || order?.rentalOrderId || order?.orderId || order?.rentalId || null;

  const displayId =
    order?.rentalOrderCode || order?.orderCode || order?.code ||
    (backendId != null ? String(backendId) : "—");

  const items = await Promise.all(
    (order?.orderDetails || []).map(async (detail) => {
      try {
        const model = detail?.deviceModelId
          ? await getDeviceModelById(detail.deviceModelId)
          : null;

        const deviceValue = Number(detail?.deviceValue ?? model?.deviceValue ?? 0);
        const depositPercent = Number(detail?.depositPercent ?? model?.depositPercent ?? 0);
        const depositAmountPerUnit = Number(
          detail?.depositAmountPerUnit ?? deviceValue * depositPercent
        );

        return {
          name:
            model?.deviceName ||
            model?.name ||
            detail?.deviceName ||
            `Model ${detail?.deviceModelId ?? ""}`,
          qty: detail?.quantity ?? 1,
          image: model?.imageURL || model?.imageUrl || detail?.imageUrl || "",
          pricePerDay: Number(detail?.pricePerDay ?? model?.pricePerDay ?? 0),
          depositAmountPerUnit,
          deviceValue,
          depositPercent,
          deviceModelId: detail?.deviceModelId ?? model?.id ?? null,
        };
      } catch {
        const deviceValue = Number(detail?.deviceValue ?? 0);
        const depositPercent = Number(detail?.depositPercent ?? 0);
        const depositAmountPerUnit = Number(
          detail?.depositAmountPerUnit ?? deviceValue * depositPercent
        );

        return {
          name: detail?.deviceName || `Model ${detail?.deviceModelId ?? ""}`,
          qty: detail?.quantity ?? 1,
          image: "",
          pricePerDay: Number(detail?.pricePerDay ?? 0),
          depositAmountPerUnit,
          deviceValue,
          depositPercent,
          deviceModelId: detail?.deviceModelId ?? null,
        };
      }
    })
  );

  const startDate = order?.startDate ?? order?.rentalStartDate ?? null;
  const endDate   = order?.endDate   ?? order?.rentalEndDate   ?? null;

  const rawTotal = Number(order?.totalPrice ?? order?.total ?? 0);
  const rawDailyFromBE = Number(order?.pricePerDay ?? 0);
  const dailyFromItems = items.reduce(
    (s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0
  );
  const dailyTotal = rawDailyFromBE > 0 ? rawDailyFromBE : dailyFromItems;
  const daysFromMoney = dailyTotal > 0 ? Math.max(1, Math.round(rawTotal / dailyTotal)) : 0;
  const daysByRange = diffDays(startDate, endDate);
  const normalizedDays = daysFromMoney || daysByRange || 1;

  return {
    id: backendId,
    displayId,

    createdAt: order?.createdAt ?? order?.created_date ?? null,
    startDate, endDate, days: normalizedDays,

    items,
    total: order?.totalPrice ?? order?.total ?? 0,

    orderStatus: String(order?.orderStatus ?? "pending").toLowerCase(),
    paymentStatus: String(order?.paymentStatus ?? "unpaid").toLowerCase(),

    depositAmountHeld: order?.depositAmount ?? order?.depositAmountHeld ?? 0,
    depositAmountReleased: order?.depositAmountReleased ?? 0,
    depositAmountUsed: order?.depositAmountUsed ?? 0,
    cancelReason: order?.cancelReason ?? null,
    contractUrl: order?.contractUrl ?? "",
    contractFileName: order?.contractFileName ?? `${displayId}.pdf`,
  };
}

/* =========================
 * 5) COMPONENT
 * ========================= */
export default function MyOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  const [allContracts, setAllContracts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  const [contractDetail, setContractDetail] = useState(null);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [contractCustomer, setContractCustomer] = useState(null);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");

  // PDF (FE render)
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const printRef = useRef(null);
  const notifSocketRef = useRef(null);
  const pollingRef = useRef(null);
  const wsConnectedRef = useRef(false);

  // Signing
  const [signingContract, setSigningContract] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [currentContractId, setCurrentContractId] = useState(null);
  const [pinSent, setPinSent] = useState(false);
  const [signing, setSigning] = useState(false);

  const [customerProfile, setCustomerProfile] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("PAYOS");
  const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [invoiceInfo, setInvoiceInfo] = useState(null); // Invoice info from API
  const [detailTab, setDetailTab] = useState("overview");
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const deeplinkOrderId = queryParams.get("orderId");
  const deeplinkTab = queryParams.get("tab");
  const deepLinkHandledRef = useRef(false);

  // Layout: Table tự cuộn theo viewport
  const TABLE_TOP_BLOCK = 40 + 40 + 16;
  const TABLE_BOTTOM_BLOCK = 56;
  const tableScrollY = `calc(100vh - ${TABLE_TOP_BLOCK + TABLE_BOTTOM_BLOCK}px)`;

  function revokeBlob(url) { try { if (url) URL.revokeObjectURL(url); } catch (e) { console.error("Error revoking blob:", e); } }
  function clearContractPreviewState() {
    revokeBlob(pdfBlobUrl);
    setPdfBlobUrl("");
    setPdfPreviewUrl("");
    setContractDetail(null);
    setContractCustomer(null);
  }

  useEffect(() => {
    loadOrders();
    loadAllContracts();
    loadCustomerProfile();
  }, []);

  const loadCustomerProfile = async () => {
    try {
      const profile = await fetchMyCustomerProfile();
      const normalized = normalizeCustomer(profile || {});
      setCustomerProfile(normalized);
      // Connect WS after profile ready
      try { notifSocketRef.current?.disconnect(); } catch {}
      try { clearInterval(pollingRef.current); } catch {}
      pollingRef.current = null;
      if (normalized?.id) {
        notifSocketRef.current = connectCustomerNotifications({
          endpoint: "/ws",
          customerId: normalized.id,
          onMessage: async (payload) => {
            const lower = String(payload?.message || payload?.title || "").toLowerCase();
            const typeRaw = String(payload?.type || payload?.notificationType || "").toLowerCase();
            const isProcessing =
              lower.includes("xử lý") ||
              lower.includes("processing") ||
              typeRaw === "approved";
            if (isProcessing) {
              const orderCode = payload?.orderCode || payload?.orderId || "";
              message.success(
                orderCode
                  ? `Đơn ${orderCode} đã được xử lý. Vui lòng ký hợp đồng và thanh toán.`
                  : "Đơn của bạn đã được xử lý. Vui lòng ký hợp đồng và thanh toán."
              );
              // Refresh list to reflect new status
              try { await loadOrders(); } catch {}
              try { await loadAllContracts(); } catch {}
            }
          },
          onConnect: () => {
            wsConnectedRef.current = true;
            // stop polling if any
            try { clearInterval(pollingRef.current); } catch {}
            pollingRef.current = null;
          },
          onError: () => {
            if (!pollingRef.current) startPollingProcessing();
          },
        });
        // If WS not connected within 3s, start polling
        setTimeout(() => {
          if (!wsConnectedRef.current && !pollingRef.current) {
            startPollingProcessing();
          }
        }, 3000);
      }
    } catch (e) {
      console.error("Failed to load customer profile:", e);
    }
  };

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await listRentalOrders();
      const mapped = await Promise.all((res || []).map(mapOrderFromApi));
      setOrders(mapped.filter(o => o && o.id != null));
    } catch (err) {
      console.error(err);
      message.error("Không thể tải danh sách đơn hàng.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const data = useMemo(() => {
    let rows = [...orders];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.displayId).toLowerCase().includes(q) ||
          r.items.some((it) => (it.name || "").toLowerCase().includes(q))
      );
    }
    if (statusFilter) rows = rows.filter((r) => r.orderStatus === statusFilter);
    if (dateRange?.length === 2) {
      const [s, e] = dateRange;
      const start = s.startOf("day").toDate().getTime();
      const end = e.endOf("day").toDate().getTime();
      rows = rows.filter((r) => {
        const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return t >= start && t <= end;
      });
    }
    return rows.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
  }, [search, statusFilter, dateRange, orders]);

  const needsContractAction = useMemo(() => {
    const status = String(current?.orderStatus || current?.status || "").toUpperCase();
    return status === "PROCESSING";
  }, [current?.orderStatus, current?.status]);

  const hasContracts = useMemo(() => (contracts || []).length > 0, [contracts]);

  const refresh = async () => {
    setLoading(true);
    await loadOrders();
    await loadAllContracts();
    setLoading(false);
    message.success("Đã tải lại danh sách đơn và hợp đồng.");
  };

  // ---------- Tracking bar helpers ----------
  function computeOrderTracking(order, contracts, invoiceInfo = null) {
    const status = String(order?.orderStatus || order?.status || "").toLowerCase();
    // Use invoice status if available, otherwise use order paymentStatus
    const invoiceStatus = invoiceInfo?.invoiceStatus;
    const paymentStatus = invoiceStatus 
      ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
      : String(order?.paymentStatus || "unpaid").toLowerCase();
    const contract = (contracts || [])[0];
    const contractStatus = String(contract?.status || "").toLowerCase();

    const isCreated = true;
    const isQcDone =
      ["processing", "ready_for_delivery", "delivery_confirmed", "delivering", "active", "returned"].includes(status) ||
      !!contract;
    const isContractPending = contractStatus === "pending_signature";
    const isPaid = paymentStatus === "paid";
    const isReady =
      ["ready_for_delivery", "delivery_confirmed"].includes(status) ||
      (isPaid && (status === "processing" || status === "active" || status === "delivering"));
    const isDelivered = status === "in_use";

    let current = 0;
    if (isDelivered) current = 4; // Giao hàng thành công
    else if (isReady) current = 3; // Sẵn sàng giao hàng
    else if (isContractPending || (!isPaid && (isQcDone || contract))) current = 2; // Ký hợp đồng & Thanh toán
    else if (isQcDone) current = 1; // QC,KYC trước thuê thành công
    else current = 0; // Tạo đơn hàng thành công

    const steps = [
      { title: "Tạo đơn hàng thành công" },
      { title: "QC,KYC trước thuê thành công" },
      { title: "Ký hợp đồng & Thanh toán" },
      { title: "Sẵn sàng giao hàng" },
      { title: "Giao hàng thành công" },
    ];

    steps[0].description = formatDateTime(order?.createdAt) || "";

    return { current, steps };
  }

  const hasSignedContract = (orderId) => {
    if (!orderId || !allContracts.length) return false;
    const orderContracts = allContracts.filter(c =>
      (c.orderId === orderId) ||
      (c.orderId === Number(orderId)) ||
      (String(c.orderId) === String(orderId))
    );
    return orderContracts.some(c => {
      const status = String(c.status).toUpperCase();
      return status === "SIGNED" || status === "ACTIVE";
    });
  };
  const handleDownloadContract = async (record) => {
    try {
      // 1) Có URL -> tải thẳng
      if (record?.contractUrl) {
        const a = document.createElement("a");
        a.href = record.contractUrl;
        a.target = "_blank";
        a.rel = "noopener";
        a.download = record.contractFileName || `contract-${record.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
  
      // 2) Không có URL -> fallback HTML→PDF
      setPdfGenerating(true);
  
      // chuẩn bị dữ liệu KH & KYC
      let customer = contractCustomer || customerProfile;
      if (!customer) {
        try {
          const prof = await fetchMyCustomerProfile();
          customer = normalizeCustomer(prof || {});
          setCustomerProfile(customer);
        } catch {}
      }
      let kyc = null;
      try { kyc = await getMyKyc(); } catch {}
  
      // gộp điều khoản mở rộng rồi render HTML -> PDF
      const detail = augmentContractContent(record);
      if (printRef.current) {
        printRef.current.innerHTML = buildPrintableHtml(detail, customer, kyc);
        const blob = await elementToPdfBlob(printRef.current);
  
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = detail.contractFileName || detail.number || `contract-${detail.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (e) {
      console.error("Download contract error:", e);
      message.error("Không thể tạo/tải PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };
  

  const showDetail = async (record) => {
    const idNum = Number(record?.id);
    if (!record || record.id == null || Number.isNaN(idNum)) {
      message.error("ID đơn hàng không hợp lệ để xem chi tiết.");
      return;
    }
    clearContractPreviewState();
    setCurrent(record);
    setDetailOpen(true);
    setDetailTab("overview");
    setInvoiceInfo(null); // Reset invoice info

    try {
      const fullOrder = await getRentalOrderById(idNum);
      if (fullOrder) {
        const mapped = await Promise.all([mapOrderFromApi(fullOrder)]);
        const merged = mapped[0];
        setCurrent(prev => ({
          ...prev,
          ...merged,
          items: (merged?.items?.length ? merged.items : prev.items) ?? [],
        }));
      }
      // Load invoice info
      try {
        const invoice = await getInvoiceByRentalOrderId(idNum);
        setInvoiceInfo(invoice || null);
      } catch (invoiceErr) {
        // Invoice might not exist yet, that's okay
        console.log("No invoice found for order:", idNum);
        setInvoiceInfo(null);
      }
      await loadOrderContracts(idNum);
    } catch (err) {
      console.error("Error loading order details:", err);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!deeplinkOrderId) return;
    if (!orders || orders.length === 0) return;
    const target = orders.find((o) => {
      const id = o?.id ?? o?.orderId;
      return (
        String(id) === String(deeplinkOrderId) ||
        String(o?.displayId) === String(deeplinkOrderId)
      );
    });
    if (!target) return;
    deepLinkHandledRef.current = true;
    showDetail(target);
    if (deeplinkTab === "contract") {
      setDetailTab("contract");
    }
  }, [orders, deeplinkOrderId, deeplinkTab]);

  const loadAllContracts = async () => {
    try {
      const allContracts = await getMyContracts();
      const normalized = Array.isArray(allContracts) ? allContracts.map(normalizeContract) : [];
      setAllContracts(normalized);
    } catch (e) {
      console.error("Failed to fetch all contracts:", e);
      setAllContracts([]);
    }
  };

  const loadOrderContracts = async (orderId, contractsToFilter = null) => {
    try {
      setContractsLoading(true);
      let inScope = contractsToFilter;
      if (!inScope) {
        if (allContracts.length === 0) await loadAllContracts();
        inScope = allContracts;
      }
      let orderContracts = (inScope || []).filter(c =>
        c.orderId === orderId ||
        c.orderId === Number(orderId) ||
        String(c.orderId) === String(orderId)
      );

      const needDetail = orderContracts.some(c => !c.contractUrl);
      if (needDetail) {
        orderContracts = await Promise.all(orderContracts.map(async (c) => {
          if (c.contractUrl) return c;
          try {
            const detail = await getContractById(c.id ?? c.contractId ?? c.contractID);
            const normalizedDetail = normalizeContract(detail || {});
            return { ...c, ...normalizedDetail };
          } catch (err) {
            console.error("Failed to fetch contract detail for preview:", err);
            return c;
          }
        }));
        setAllContracts(prev => {
          const map = new Map((prev || []).map(x => [x.id, x]));
          orderContracts.forEach(x => { if (x?.id != null) map.set(x.id, x); });
          return Array.from(map.values());
        });
      }

      setContracts(orderContracts);

      const primary = orderContracts[0];
      const contractUrl = primary?.contractUrl || "";

      setCurrent(prev => ({
        ...(prev || {}),
        contractUrl: contractUrl || "",
        contractFileName: primary?.contractFileName || prev?.contractFileName,
      }));

      if (contractUrl) setPdfPreviewUrl(contractUrl);
      else setPdfPreviewUrl("");
    } catch (e) {
      console.error("Failed to filter order contracts:", e);
      setContracts([]);
      setPdfPreviewUrl("");
    } finally {
      setContractsLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const viewContractDetail = async (contractId) => {
    try {
      setLoadingContractDetail(true);
      const contract = await getContractById(contractId);
      const normalized = normalizeContract(contract);
      setContractDetail(normalized);
      if (normalized?.contractUrl) setPdfPreviewUrl(normalized.contractUrl);

      if (customerProfile) setContractCustomer(customerProfile);
      else {
        try {
          const profile = await fetchMyCustomerProfile();
          const normalizedProfile = normalizeCustomer(profile || {});
          setCustomerProfile(normalizedProfile);
          setContractCustomer(normalizedProfile);
        } catch (e) {
          console.error("Failed to fetch customer profile:", e);
          setContractCustomer(null);
        }
      }
      setContractDetailOpen(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải được chi tiết hợp đồng.");
    } finally {
      setLoadingContractDetail(false);
    }
  };

  const handleSignContract = async (contractId) => {
    if (!contractId) { message.error("ID hợp đồng không hợp lệ"); return; }
    let profile = customerProfile;
    if (!profile) {
      try {
        const loaded = await fetchMyCustomerProfile();
        profile = normalizeCustomer(loaded || {});
        setCustomerProfile(profile);
      } catch {
        message.error("Không thể tải thông tin khách hàng.");
        return;
      }
    }
    if (!profile?.email) {
      message.error("Không tìm thấy email trong tài khoản. Vui lòng cập nhật thông tin cá nhân.");
      return;
    }
    setCurrentContractId(contractId);
    setSignModalOpen(true);
    setPinSent(false);
  };

  const sendPin = async () => {
    if (!currentContractId || !customerProfile?.email) {
      message.error("Không tìm thấy email để gửi mã PIN.");
      return;
    }
    try {
      setSigningContract(true);
      await sendPinEmail(currentContractId, customerProfile.email);
      message.success("Đã gửi mã PIN đến email của bạn!");
      setPinSent(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không gửi được mã PIN.");
    } finally {
      setSigningContract(false);
    }
  };

  const handleSign = async (values) => {
    if (!currentContractId) {
      message.error("Không tìm thấy hợp đồng để ký.");
      return;
    }
    try {
      setSigning(true);
      await signContractApi(currentContractId, {
        pinCode: values.pinCode,
        signatureMethod: "EMAIL_OTP",
      });
      message.success("Ký hợp đồng thành công!");
      message.success("Bạn đã ký hợp đồng thành công. Vui lòng thanh toán để hoàn tất đơn.");
      setSignModalOpen(false);
      setCurrentContractId(null);
      setPinSent(false);
      await loadOrderContracts(current?.id);
      await loadAllContracts();
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không thể ký hợp đồng.");
    } finally {
      setSigning(false);
    }
  };

  const handlePayment = async (order) => {
    if (!order || !order.id) { message.error("Không có thông tin đơn hàng để thanh toán."); return; }
    setPaymentOrder(order);
    setPaymentMethod("VNPAY");
    setPaymentTermsAccepted(false);
    setPaymentModalOpen(true);
  };

  const confirmCreatePayment = async () => {
    const order = paymentOrder || current;
    if (!order || !order.id) { message.error("Không có thông tin đơn hàng để thanh toán."); return; }
    if (!paymentTermsAccepted) { message.warning("Vui lòng chấp nhận điều khoản trước khi thanh toán."); return; }
    try {
      setProcessingPayment(true);
      const items = order.items || [];
      const days = Number(order.days || 1);
      const rentalTotalRecalc = items.reduce((s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0) * days;
      const totalPriceFromBE = Number(order.total ?? rentalTotalRecalc);
      const depositTotal = items.reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
      const totalAmount = totalPriceFromBE + depositTotal;
      if (totalAmount <= 0) { message.error("Số tiền thanh toán không hợp lệ."); return; }

      const baseUrl = window.location.origin;
      const orderIdParam = Number(order.id);
      const orderCodeParam = order.displayId || order.id;
      const returnUrl = `${baseUrl}/payment/return?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
      const cancelUrl = `${baseUrl}/payment/cancel?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
      // VNPay sẽ redirect về các URL này với query params từ backend
      const frontendSuccessUrl = `${baseUrl}/success?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
      const frontendFailureUrl = `${baseUrl}/failure?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;

      const payload = {
        orderId: orderIdParam,
        invoiceType: "RENT_PAYMENT",
        paymentMethod: String(paymentMethod || "VNPAY").toUpperCase(),
        amount: totalAmount,
        description: `Thanh toán đơn hàng #${orderCodeParam}`,
        returnUrl, 
        cancelUrl,
        frontendSuccessUrl,
        frontendFailureUrl,
      };

      const result = await createPayment(payload);
      const redirectUrl = result?.checkoutUrl || result?.payUrl || result?.deeplink || result?.qrUrl;
      if (redirectUrl) {
        localStorage.setItem("pendingPaymentOrderId", String(orderIdParam));
        localStorage.setItem("pendingPaymentOrderCode", String(orderCodeParam));
        window.location.href = redirectUrl;
      } else {
        message.error("Không nhận được link thanh toán từ hệ thống.");
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      message.error(error?.response?.data?.message || error?.message || "Không thể tạo thanh toán.");
    } finally {
      setProcessingPayment(false);
    }
  };

  /* =========================
   * 6) HTML → PDF
   * ========================= */
  function buildPrintableHtml(detail, customer, kyc) {
    if (!detail) return "<div>Không có dữ liệu hợp đồng</div>";
    const title = detail.title || "HỢP ĐỒNG";
    const number = detail.number ? `Số: ${detail.number}` : "";
    const customerName = customer?.fullName || customer?.name || `Khách hàng #${detail.customerId}`;
    const customerEmail = customer?.email || "";
    const customerPhone = customer?.phoneNumber || "";
    const identificationCode = kyc?.identificationCode || "";
    const contentHtml = sanitizeContractHtml(detail.contentHtml || "");
    const termsBlock = detail.terms
      ? `<pre style="white-space:pre-wrap;margin:0">${detail.terms}</pre>`
      : "";

    return `
      <div style="
        width:794px;margin:0 auto;background:#fff;color:#111;
        font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;
        padding:32px 40px;box-sizing:border-box;">
        ${GLOBAL_PRINT_CSS}
        ${NATIONAL_HEADER_HTML}

        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:22px;font-weight:700;letter-spacing:.5px">${title}</div>
          <div style="color:#666">${number}</div>
        </div>
        <hr style="border:none;border-top:1px solid #e8e8e8;margin:12px 0 16px"/>

        <section class="kv">
          <div><b>Bên A (Bên cho thuê):</b> CÔNG TY TECHRENT</div>
          <div><b>Bên B (Khách hàng):</b> ${customerName}</div>
          ${identificationCode ? `<div><b>Số căn cước công dân:</b> ${identificationCode}</div>` : ""}
          ${customerEmail ? `<div><b>Email:</b> ${customerEmail}</div>` : ""}
          ${customerPhone ? `<div><b>Điện thoại:</b> ${customerPhone}</div>` : ""}
          ${(() => {
            const bankInfo = customer?.bankInformationDtos || customer?.bankInformations || [];
            if (bankInfo.length > 0) {
              return bankInfo.map((bank, idx) => {
                const bankName = bank?.bankName || "";
                const bankHolder = bank?.bankHolder || "";
                const cardNumber = bank?.cardNumber || "";
                if (!bankName && !bankHolder && !cardNumber) return "";
                return `<div><b>Tài khoản ngân hàng${bankInfo.length > 1 ? ` ${idx + 1}` : ""}:</b> ${bankName ? `${bankName}` : ""}${bankHolder ? ` - Chủ tài khoản: ${bankHolder}` : ""}${cardNumber ? ` - Số tài khoản: ${cardNumber}` : ""}</div>`;
              }).filter(Boolean).join("");
            }
            return "";
          })()}
        </section>

        <section style="page-break-inside:avoid;margin:10px 0 16px">${contentHtml}</section>

        ${termsBlock ? `
        <section style="page-break-inside:avoid;margin:10px 0 16px">
          <h3>Điều khoản &amp; Điều kiện</h3>
          ${termsBlock}
        </section>` : ""}

        <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN A</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "PENDING_SIGNATURE" || status === "ACTIVE") {
                  return '<div style="font-size:48px;color:#52c41a;line-height:1">✓</div>';
                }
                return "";
              })()}
            </div>
            <div>
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "PENDING_SIGNATURE" || status === "ACTIVE") {
                  return '<div style="color:#52c41a;font-weight:600">CÔNG TY TECHRENT đã ký</div>';
                }
                return "(Ký, ghi rõ họ tên)";
              })()}
            </div>
          </div>
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN B</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "ACTIVE") {
                  return '<div style="font-size:48px;color:#52c41a;line-height:1">✓</div>';
                }
                return "";
              })()}
            </div>
            <div>
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "ACTIVE") {
                  return `<div style="color:#52c41a;font-weight:600">${customerName} đã ký</div>`;
                }
                return "(Ký, ghi rõ họ tên)";
              })()}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  async function elementToPdfBlob(el) {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = pageWidth / canvas.width;

    const pageCanvas = document.createElement("canvas");
    const ctx = pageCanvas.getContext("2d");

    let renderedHeight = 0;
    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageHeight / ratio, canvas.height - renderedHeight);
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0, renderedHeight, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight
      );
      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (renderedHeight > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, sliceHeight * ratio);
      renderedHeight += sliceHeight;
    }
    return pdf.output("blob");
  }

  async function previewContractAsPdf() {
    if (!current?.id) return message.warning("Chưa chọn đơn.");
    const rawDetail = contractDetail || (contracts[0] ? { ...contracts[0] } : null);
    if (!rawDetail) return message.warning("Đơn này chưa có dữ liệu hợp đồng.");

    try {
      setPdfGenerating(true);
      revokeBlob(pdfBlobUrl);

      const detail = augmentContractContent(rawDetail);

      let customer = contractCustomer || customerProfile;
      let kyc = null;

      try {
        if (!customer) {
          const customerData = await fetchMyCustomerProfile();
          customer = normalizeCustomer(customerData || {});
        }
      } catch (e) {
        console.error("Failed to fetch customer profile:", e);
      }

      try {
        const kycData = await getMyKyc();
        kyc = kycData || null;
      } catch (e) {
        console.error("Failed to fetch KYC data:", e);
      }

      if (printRef.current) {
        printRef.current.innerHTML = buildPrintableHtml(detail, customer, kyc);
        const blob = await elementToPdfBlob(printRef.current);
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setPdfModalOpen(true);
      }
    } catch (e) {
      console.error(e);
      message.error("Không tạo được bản xem trước PDF.");
    } finally {
      setPdfGenerating(false);
    }
  }

  async function downloadContractAsPdf() {
    if (!current?.id) return message.warning("Chưa chọn đơn.");
    const rawDetail = contractDetail || (contracts[0] ? { ...contracts[0] } : null);
    if (!rawDetail) return message.warning("Đơn này chưa có dữ liệu hợp đồng.");

    try {
      setPdfGenerating(true);
      revokeBlob(pdfBlobUrl);

      const detail = augmentContractContent(rawDetail);

      let customer = contractCustomer || customerProfile;
      let kyc = null;

      try {
        if (!customer) {
          const customerData = await fetchMyCustomerProfile();
          customer = normalizeCustomer(customerData || {});
        }
      } catch (e) {
        console.error("Failed to fetch customer profile:", e);
      }

      try {
        const kycData = await getMyKyc();
        kyc = kycData || null;
      } catch (e) {
        console.error("Failed to fetch KYC data:", e);
      }

      if (printRef.current) {
        printRef.current.innerHTML = buildPrintableHtml(detail, customer, kyc);
        const blob = await elementToPdfBlob(printRef.current);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const name = detail.contractFileName || detail.number || `contract-${detail.id}.pdf`;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error(e);
      message.error("Không thể tạo/tải PDF.");
    } finally {
      setPdfGenerating(false);
    }
  }

  // Polling fallback: detect orders entering 'processing'
  const seenProcessingRef = useRef(new Set());
  const startPollingProcessing = () => {
    const run = async () => {
      try {
        const res = await listRentalOrders();
        const processing = (Array.isArray(res) ? res : []).filter((o) =>
          String(o?.orderStatus || o?.status || "").toLowerCase() === "processing"
        );
        for (const o of processing) {
          const id = o.orderId ?? o.id;
          if (id == null) continue;
          if (!seenProcessingRef.current.has(id)) {
            seenProcessingRef.current.add(id);
            message.success(`Đơn ${id} đã được xử lý. Vui lòng ký hợp đồng và thanh toán.`);
            try { await loadOrders(); } catch {}
            try { await loadAllContracts(); } catch {}
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Polling] Load orders failed:", e?.message || e);
      }
    };
    run();
    pollingRef.current = setInterval(run, 20000);
  };

  function printPdfUrl(url) {
    if (!url) return message.warning("Không có tài liệu để in.");
    const w = window.open(url, "_blank", "noopener");
    if (w) {
      const listener = () => {
        try { w.focus(); w.print(); } catch (err) { console.error("Print window error:", err); }
      };
      setTimeout(listener, 800);
    }
  }

  /* =========================
   * 7) COLUMNS
   * ========================= */
  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "displayId",
      key: "displayId",
      width: 90,
      fixed: "left",
      render: (v) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
      sorter: (a, b) => String(a.displayId).localeCompare(String(b.displayId)),
    },
    {
      title: "Sản phẩm",
      key: "items",
      width: 220,
      render: (_, r) => {
        const first = r.items?.[0] || {};
        const extra = (r.items?.length ?? 0) > 1 ? ` +${r.items.length - 1} mục` : "";
        return (
          <Space size="middle">
            <Avatar shape="square" size={40} src={first.image} style={{ borderRadius: 6 }} />
            <div style={{ maxWidth: 150 }}>
              <Text strong style={{ display: "block", fontSize: 13 }} ellipsis={{ tooltip: first.name }}>
                {first.name || "—"}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>SL: {first.qty ?? 1}{extra}</Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 130,
      render: (v) => formatDateTime(v),
      sorter: (a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0),
      defaultSortOrder: "descend",
    },
    { title: "Số ngày", dataIndex: "days", key: "days", align: "center", width: 80, sorter: (a, b) => (a.days ?? 0) - (b.days ?? 0) },
    {
      title: "Tổng tiền thuê",
      key: "rentalTotal",
      align: "right",
      width: 120,
      render: (_, r) => <Text strong>{formatVND(Number(r.total || 0))}</Text>,
      sorter: (a, b) => Number(a.total || 0) - Number(b.total || 0),
    },
    {
      title: "Tổng tiền cọc",
      key: "depositTotal",
      align: "right",
      width: 120,
      render: (_, r) => {
        const depositTotal = (r.items || []).reduce(
          (sum, it) => sum + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0
        );
        return <Text>{formatVND(depositTotal)}</Text>;
      },
      sorter: (a, b) => {
        const aDep = (a.items || []).reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
        const bDep = (b.items || []).reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
        return aDep - bDep;
      },
    },
    {
      title: "Tổng thanh toán",
      key: "grandTotal",
      align: "right",
      width: 140,
      render: (_, r) => {
        const dep = (r.items || []).reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
        return <Text strong>{formatVND(Number(r.total || 0) + dep)}</Text>;
      },
      sorter: (a, b) => {
        const depA = (a.items || []).reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
        const depB = (b.items || []).reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
        return (Number(a.total || 0) + depA) - (Number(b.total || 0) + depB);
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "orderStatus",
      key: "orderStatus",
      width: 140,
      render: (s) => {
        const key = String(s || "").toLowerCase();
        const m = ORDER_STATUS_MAP[key] || { label: s || "—", color: "default" };
        return <Tag color={m.color} style={{ borderRadius: 20, padding: "0 12px" }}>{m.label}</Tag>;
      },
      filters: Object.entries(ORDER_STATUS_MAP).map(([value, { label }]) => ({ text: label, value })),
      onFilter: (v, r) => String(r.orderStatus).toLowerCase() === String(v).toLowerCase(),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, r) => (
        <Tooltip title="Chi tiết đơn">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)} />
        </Tooltip>
      ),
    },
  ];

  /* =========================
   * 8) RENDER
   * ========================= */
  return (
    <>
      <div
        style={{
          minHeight: "calc(100vh - var(--stacked-header,128px))",
          marginTop: "-24px",
          marginBottom: "-24px",
          background: "#f0f2f5",
          padding: "24px",
        }}
      >
        <div className="h-full flex flex-col max-w-7xl mx-auto">
          {/* Header Section */}
          <Card
            style={{
              marginBottom: 16,
              borderRadius: 12,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              border: "1px solid #eee",
              background: "#ffffff",
            }}
            bodyStyle={{ padding: "16px 20px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <Title level={3} style={{ margin: 0, color: "#1a1a1a", fontWeight: 700, fontSize: 22 }}>
                   Đơn thuê của tôi
                 </Title>
                <Text type="secondary" style={{ fontSize: 13, marginTop: 6, display: "block", color: "#666" }}>
                   Theo dõi trạng thái đơn, thanh toán và tải hợp đồng
                 </Text>
              </div>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={refresh}
                loading={loading}
                size="middle"
                style={{
                  borderRadius: 8,
                  height: 36,
                  padding: "0 16px",
                  fontWeight: 600,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                }}
              >
                Tải lại
              </Button>
            </div>

            {/* Filters Section */}
            <Space wrap size="small" style={{ width: "100%" }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Tìm theo mã đơn, tên thiết bị…"
                size="middle"
                style={{
                  width: 300,
                  borderRadius: 8,
                  height: 36,
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <RangePicker
                onChange={setDateRange}
                size="middle"
                style={{
                  borderRadius: 8,
                  height: 36,
                }}
              />
              <Dropdown
                trigger={["click"]}
                overlay={
                  <Menu
                    onClick={({ key }) => setStatusFilter(key === "all" ? undefined : key)}
                    items={[
                      { key: "all", label: "Tất cả trạng thái" },
                      ...Object.entries(ORDER_STATUS_MAP).map(([k, v]) => ({ key: k, label: v.label })),
                    ]}
                  />
                }
              >
                <Button
                  size="middle"
                  icon={<FilterOutlined />}
                  style={{
                    borderRadius: 8,
                    height: 36,
                    padding: "0 14px",
                    borderColor: "#d9d9d9",
                  }}
                >
                  {statusFilter ? `Lọc: ${ORDER_STATUS_MAP[statusFilter].label}` : "Lọc trạng thái"}
                </Button>
              </Dropdown>
            </Space>
          </Card>

          {/* Table Section */}
          <Card
            style={{
              borderRadius: 12,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              border: "none",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
            bodyStyle={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            {data.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
                <AnimatedEmpty description="Chưa có đơn nào" />
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0 }}>
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={data}
                  loading={loading || loadingOrders}
                  size="small"
                  bordered={false}
                  className="modern-table"
                  sticky
                  scroll={{ x: 900, y: tableScrollY }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    position: ["bottomRight"],
                    showTotal: (total) => `Tổng ${total} đơn`,
                    style: { marginTop: 16 },
                  }}
                />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Drawer chi tiết đơn */}
      <Drawer
        title={
          <div>
            <Title level={4} style={{ margin: 0, color: "#1a1a1a" }}>
              {current ? `Chi tiết đơn ${current.displayId ?? current.id}` : "Chi tiết đơn"}
            </Title>
          </div>
        }
        width={900}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          clearContractPreviewState();
          setDetailTab("overview");
        }}
        styles={{
          body: { padding: 0, background: "#f5f7fa" },
          header: { background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "14px 18px" },
        }}
      >
        {current && (
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e8e8e8",
              background: "#ffffff",
            }}
          >
            {(() => {
              const tracking = computeOrderTracking(current, contracts, invoiceInfo);
              return (
                <Steps
                  current={tracking.current}
                  size="small"
                  responsive
                  style={{ background: "transparent" }}
                >
                  {tracking.steps.map((s, idx) => (
                    <Steps.Step key={idx} title={s.title} description={s.description} />
                  ))}
                </Steps>
              );
            })()}
          </div>
        )}
        {current && needsContractAction && (
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #e8e8e8",
              background: "#fff",
            }}
          >
            <Alert
              type="info"
              showIcon
                message={`Đơn #${current.displayId ?? current.id} đã được xác nhận`}
                description={
                  hasContracts
                    ? "Vui lòng ký hợp đồng và thanh toán để chúng tôi chuẩn bị giao hàng."
                    : "Chúng tôi đang tạo hợp đồng cho đơn này. Bạn sẽ nhận được thông báo khi hợp đồng sẵn sàng."
                }
                action={
                  hasContracts && (
                    <Button type="link" onClick={() => setDetailTab("contract")} style={{ padding: 0 }}>
                      Xem hợp đồng
                    </Button>
                  )
                }
            />
          </div>
        )}
        {current && (
          <Tabs
            key={current.id}
            activeKey={detailTab}
            onChange={setDetailTab}
            items={[
              {
                key: "overview",
                label: "Tổng quan",
                children: (
                  <div style={{ padding: 24 }}>
                    {(() => {
                      const days = Number(current?.days || 1);
                      const items = Array.isArray(current?.items) ? current.items : [];
                      const rentalPerDay = items.reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
                      const rentalTotal = rentalPerDay * days;
                      const depositTotal = items.reduce((sum, it) => sum + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);

                      // Check payment status from invoice if available, otherwise use order paymentStatus
                      const invoiceStatus = invoiceInfo?.invoiceStatus;
                      const paymentStatus = invoiceStatus 
                        ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
                        : String(current.paymentStatus || "unpaid").toLowerCase();
                      
                      const canPay =
                        ["unpaid", "partial"].includes(paymentStatus) &&
                        String(current.orderStatus).toLowerCase() === "processing" &&
                        hasSignedContract(current.id);
                      const totalAmount = Number(current?.total ?? rentalTotal) + depositTotal;

                      return (
                        <>
                          <Card
                            style={{
                              marginBottom: 24,
                              borderRadius: 12,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border: "1px solid #e8e8e8",
                            }}
                          >
                            <Descriptions bordered column={2} size="middle">
                            <Descriptions.Item label="Mã đơn"><Text strong>{current.displayId ?? current.id}</Text></Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo">{formatDateTime(current.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="Ngày bắt đầu thuê">
                              {current.startDate ? formatDate(current.startDate) : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày kết thúc thuê">
                              {current.endDate ? formatDate(current.endDate) : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái đơn">
                              <Tag color={(ORDER_STATUS_MAP[current.orderStatus] || {}).color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                {(ORDER_STATUS_MAP[current.orderStatus] || {}).label ?? current.orderStatus ?? "—"}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thanh toán">
                              {(() => {
                                // Use invoice status if available, otherwise fallback to order paymentStatus
                                const invoiceStatus = invoiceInfo?.invoiceStatus;
                                const displayPaymentStatus = invoiceStatus 
                                  ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
                                  : (String(current.orderStatus).toLowerCase() === "delivery_confirmed" ? "paid" : current.paymentStatus);
                                const paymentInfo = PAYMENT_STATUS_MAP[displayPaymentStatus] || {};
                                return (
                                  <Tag color={paymentInfo.color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                    {paymentInfo.label ?? displayPaymentStatus ?? "—"}
                                  </Tag>
                                );
                              })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="Tổng tiền thuê">
                              <Space direction="vertical" size={0}>
                                <Text strong>{formatVND(Number(current?.total ?? rentalTotal))}</Text>
                              </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tổng tiền cọc">
                              <Space direction="vertical" size={0}>
                                <Text strong>{formatVND(depositTotal)}</Text>
                              </Space>
                            </Descriptions.Item>
                          </Descriptions>
                          </Card>

                          {/* Products Section */}
                          <Card
                            style={{
                              marginBottom: 24,
                              borderRadius: 12,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border: "1px solid #e8e8e8",
                            }}
                            title={
                              <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
                                Sản phẩm trong đơn
                              </Title>
                            }
                          >
                            <Table
                            rowKey={(r, idx) => `${r.deviceModelId || r.name}-${idx}`}
                            dataSource={items}
                            pagination={false}
                            size="small"
                            scroll={{ x: 860 }}
                            columns={[
                              {
                                title: "Sản phẩm",
                                dataIndex: "name",
                                width: 240,
                                render: (v, r) => (
                                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <Avatar shape="square" size={40} src={r.image} style={{ borderRadius: 6 }} />
                                    <div style={{ minWidth: 0 }}>
                                      <Text strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13 }}>{v}</Text>
                                    </div>
                                  </div>
                                ),
                              },
                              { title: "SL", dataIndex: "qty", width: 60, align: "center" },
                              { title: "Đơn giá SP/ngày", dataIndex: "pricePerDay", width: 120, align: "right", render: (v) => formatVND(v) },
                              { title: "Số ngày thuê", key: "days", width: 80, align: "center", render: () => days },
                              { title: "Tổng tiền thuê", key: "subtotal", width: 130, align: "right", render: (_, r) => formatVND(Number(r.pricePerDay || 0) * Number(days || 1)) },
                              { title: "Cọc/1 SP", dataIndex: "depositAmountPerUnit", width: 120, align: "right", render: (v) => formatVND(v) },
                              { title: "Tổng cọc", key: "depositSubtotal", width: 120, align: "right", render: (_, r) => formatVND(Number(r.depositAmountPerUnit || 0) * Number(r.qty || 1)) },
                            ]}
                            />
                          </Card>

                          {/* Payment Summary */}
                          <Card
                            style={{
                              borderRadius: 12,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border: "1px solid #e8e8e8",
                              background: canPay ? "#fafafa" : "#fff",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <Space direction="vertical" align="end" size="middle" style={{ width: "100%" }}>
                                <div style={{ width: "100%", maxWidth: 360 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                    <Text>Tổng tiền thuê ({days} ngày):</Text>
                                    <Text strong style={{ fontSize: 15 }}>{formatVND(Number(current?.total ?? rentalTotal))}</Text>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <Text>Tổng tiền cọc:</Text>
                                    <Text strong style={{ fontSize: 15 }}>{formatVND(depositTotal)}</Text>
                                  </div>
                                  <Divider style={{ margin: "12px 0" }} />
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text style={{ fontSize: 16, fontWeight: 600 }}>Tổng thanh toán:</Text>
                                    <Text strong style={{ color: "#1a1a1a", fontSize: 18, fontWeight: 700 }}>
                                      {formatVND(totalAmount)}
                                    </Text>
                                  </div>
                                </div>


                              </Space>
                            </div>
                          </Card>
                        </>
                      );
                    })()}
                  </div>
                ),
              },
              {
                key: "contract",
                label: "Hợp đồng",
                children: (
                  <div style={{ padding: 24 }}>
                    <Card
                      style={{
                        marginBottom: 24,
                        borderRadius: 12,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        border: "1px solid #e8e8e8",
                      }}
                      title={
                        <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
                          Hợp đồng đã tạo
                        </Title>
                      }
                    >
                      {contractsLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                          <Text type="secondary">Đang tải danh sách hợp đồng...</Text>
                        </div>
                      ) : contracts.length > 0 ? (
                        <Table
                          rowKey="id"
                          columns={[
                            { title: "Mã hợp đồng", dataIndex: "id", width: 100, render: (v) => <Text strong>#{v}</Text> },
                            { title: "Số hợp đồng", dataIndex: "number", width: 120, render: (v) => v || "—" },
                            {
                              title: "Trạng thái", dataIndex: "status", width: 140,
                              render: (status) => {
                                const key = String(status || "").toLowerCase();
                                const info = CONTRACT_STATUS_MAP[key];
                                return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{status}</Tag>;
                              },
                            },
                            { title: "Ngày tạo", dataIndex: "createdAt", width: 150, render: (v) => formatDateTime(v) },
                            { 
                              title: "Tổng thanh toán", 
                              key: "totalPayment", 
                              width: 140, 
                              align: "right", 
                              render: (_, record) => {
                                const totalAmount = Number(record.totalAmount || 0);
                                const depositAmount = Number(record.depositAmount || 0);
                                return formatVND(totalAmount + depositAmount);
                              }
                            },
                            {
                              title: "Thao tác",
                              key: "actions",
                              width: 220,
                              render: (_, record) => (
                                <Space size="small">
                                  <Button
                                    size="small"
                                    icon={<FilePdfOutlined />}
                                    onClick={() => handleDownloadContract(record)}
                                    loading={pdfGenerating}
                                  >
                                    Tải PDF
                                  </Button>
                            
                                  {String(record.status || "").toUpperCase() === "PENDING_SIGNATURE" && (
                                    <Button size="small" type="primary" onClick={() => handleSignContract(record.id)}>
                                      Ký
                                    </Button>
                                  )}
                                </Space>
                              ),
                            }
                          ]}
                          dataSource={contracts}
                          pagination={false}
                          size="small"
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                          <Text type="secondary">Chưa có hợp đồng nào được tạo cho đơn này</Text>
                          {needsContractAction && (
                            <div style={{ marginTop: 12, color: "#6B7280" }}>
                              Hệ thống sẽ tự động tạo hợp đồng sau khi đơn được chuẩn bị.
                            </div>
                          )}
                        </div>
                      )}

                      {(() => {
                        const items = Array.isArray(current?.items) ? current.items : [];
                        const days = Number(current?.days || 1);
                        const rentalTotal = items.reduce((s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0) * days;
                        const depositTotal = items.reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
                        
                        // Check payment status from invoice if available, otherwise use order paymentStatus
                        const invoiceStatus = invoiceInfo?.invoiceStatus;
                        const paymentStatus = invoiceStatus 
                          ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
                          : String(current.paymentStatus || "unpaid").toLowerCase();
                        
                        const canPayCurrent =
                          ["unpaid", "partial"].includes(paymentStatus) &&
                          String(current.orderStatus).toLowerCase() === "processing" &&
                          hasSignedContract(current.id) &&
                          Number((current?.total ?? rentalTotal) + depositTotal) > 0;

                        if (!canPayCurrent) return null;

                        return (
                          <div style={{ padding: '16px', textAlign: 'right', borderTop: '1px solid #f0f0f0', marginTop: 16 }}>
                            <Button
                              type="primary"
                              size="middle"
                              icon={<DollarOutlined />}
                              onClick={() => handlePayment(current)}
                              loading={processingPayment}
                              style={{
                                borderRadius: 8,
                                fontWeight: 500,
                              }}
                            >
                              Thanh toán
                            </Button>
                          </div>
                        );
                      })()}
                    </Card>

                    <Card
                      style={{
                        borderRadius: 12,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        border: "1px solid #e8e8e8",
                      }}
                      title={
                        <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
                          Hợp đồng PDF
                        </Title>
                      }
                    >
                      <Space style={{ marginBottom: 16 }} wrap>
                      <Button icon={<ExpandOutlined />} onClick={() => {
                        const url = current.contractUrl || pdfPreviewUrl;
                        return url ? window.open(url, "_blank", "noopener") : message.warning("Không có URL hợp đồng");
                      }}>
                        Xem toàn màn hình
                      </Button>

                      {(() => {
                        const href = current.contractUrl || pdfPreviewUrl;
                        if (href) {
                          return (
                            <>
                              <Button type="primary" icon={<DownloadOutlined />} href={href} target="_blank" rel="noopener">
                                Tải hợp đồng
                              </Button>
                              <Button icon={<PrinterOutlined />} onClick={() => printPdfUrl(href)}>
                                In hợp đồng (PDF)
                              </Button>
                            </>
                          );
                        }
                        return null;
                      })()}

                      {/* HTML → PDF nếu không có contractUrl từ BE */}
                      {!(current.contractUrl || pdfPreviewUrl) && (
                        <>
                          <Button onClick={previewContractAsPdf} loading={pdfGenerating}>
                            Xem trước hợp đồng PDF 
                          </Button>
                          <Button type="primary" onClick={downloadContractAsPdf} loading={pdfGenerating}>
                            Tạo & tải hợp đồng PDF 
                          </Button>
                        </>
                      )}


                      </Space>

                      <div
                        style={{
                          height: 460,
                          border: "1px solid #e8e8e8",
                          borderRadius: 10,
                          overflow: "hidden",
                          background: "#fafafa",
                          marginTop: 12,
                          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.06)",
                        }}
                      >
                      {current.contractUrl || pdfPreviewUrl ? (
                        <iframe
                          key={current.contractUrl || pdfPreviewUrl}
                          title="ContractPreview"
                          src={current.contractUrl || pdfPreviewUrl}
                          style={{ width: "100%", height: "100%", border: "none" }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Text type="secondary"><FilePdfOutlined /> Không có URL hợp đồng để hiển thị.</Text>
                        </div>
                      )}
                      </div>
                    </Card>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Modal chi tiết hợp đồng */}
      <Modal
        title="Chi tiết hợp đồng"
        open={contractDetailOpen}
        onCancel={() => setContractDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setContractDetailOpen(false)}>Đóng</Button>,
          contractDetail && (() => {
            const href = contractDetail.contractUrl || pdfPreviewUrl;
            if (!href) return null;
            return (
              <>
                <Button key="print" icon={<PrinterOutlined />} onClick={() => printPdfUrl(href)}>
                  In
                </Button>
                <Button key="download-pdf" icon={<FilePdfOutlined />} href={href} target="_blank" rel="noopener">
                  Tải PDF
                </Button>
              </>
            );
          })(),
          contractDetail && String(contractDetail.status).toUpperCase() === "PENDING_SIGNATURE" && (
            <Button key="sign" type="primary" onClick={() => handleSignContract(contractDetail.id)}>
              Ký hợp đồng
            </Button>
          ),
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {loadingContractDetail ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Text type="secondary">Đang tải…</Text>
          </div>
        ) : contractDetail ? (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Card
              title={
                <div style={{ textAlign: 'center' }}>
                  <Title level={2} style={{ margin: 0, color: '#1a1a1a' }}>
                    {contractDetail.title}
                  </Title>
                  <Text type="secondary">Số hợp đồng: {contractDetail.number}</Text>
                </div>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="Thông tin cơ bản">
                    {(() => {
                      const statusKey = String(contractDetail.status || "").toLowerCase();
                      const statusInfo = CONTRACT_STATUS_MAP[statusKey] || { label: contractDetail.status || "—", color: "default" };
                      const typeKey = String(contractDetail.type || "").toUpperCase();
                      const contractType = CONTRACT_TYPE_LABELS[typeKey] || contractDetail.type || "—";
                      const customerName = contractCustomer?.fullName || contractCustomer?.name || `Khách hàng #${contractDetail.customerId}`;
                      const customerEmail = contractCustomer?.email;
                      const customerPhone = contractCustomer?.phoneNumber;
                      return (
                        <Descriptions size="small" column={1}>
                          <Descriptions.Item label="Mã hợp đồng">#{contractDetail.id}</Descriptions.Item>
                          <Descriptions.Item label="Đơn thuê">#{contractDetail.orderId}</Descriptions.Item>
                          <Descriptions.Item label="Bên khách hàng">
                            <div>
                              <div><strong>{customerName}</strong></div>
                              <div style={{ color: "#999", fontSize: 11 }}>ID: #{contractDetail.customerId}</div>
                              {customerEmail && (<div style={{ color: "#666", fontSize: 12 }}>{customerEmail}</div>)}
                              {customerPhone && (<div style={{ color: "#666", fontSize: 12 }}>{customerPhone}</div>)}
                            </div>
                          </Descriptions.Item>
                          <Descriptions.Item label="Bên cho thuê">
                            <strong>CÔNG TY TECHRENT</strong>
                          </Descriptions.Item>
                          <Descriptions.Item label="Loại hợp đồng">
                            <Tag color="blue">{contractType}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Trạng thái">
                            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                          </Descriptions.Item>
                        </Descriptions>
                      );
                    })()}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Thời gian">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày bắt đầu">{contractDetail.startDate ? formatDate(contractDetail.startDate) : "—"}</Descriptions.Item>
                      <Descriptions.Item label="Ngày kết thúc">{contractDetail.endDate ? formatDate(contractDetail.endDate) : "—"}</Descriptions.Item>
                      <Descriptions.Item label="Số ngày thuê">{contractDetail.rentalPeriodDays ? `${contractDetail.rentalPeriodDays} ngày` : "—"}</Descriptions.Item>
                      <Descriptions.Item label="Hết hạn">{contractDetail.expiresAt ? formatDateTime(contractDetail.expiresAt) : "—"}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Card size="small" title="Nội dung hợp đồng">
                <div
                  style={{
                    border: '1px solid #f0f0f0',
                    padding: 16,
                    borderRadius: 6,
                    backgroundColor: '#fafafa',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(contractDetail.contentHtml || "—") }}
                />
              </Card>

              <Divider />

              <Card size="small" title="Điều khoản và điều kiện">
                <div
                  style={{
                    border: '1px solid #f0f0f0',
                    padding: 16,
                    borderRadius: 6,
                    backgroundColor: '#fafafa',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {contractDetail.terms || "—"}
                </div>
              </Card>
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">Không có dữ liệu hợp đồng</Text>
          </div>
        )}
      </Modal>

      {/* Modal xem trước PDF do FE kết xuất */}
      <Modal
        title="Xem trước PDF hợp đồng (HTML→PDF)"
        open={pdfModalOpen}
        onCancel={() => {
          setPdfModalOpen(false);
          if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(""); }
        }}
        footer={[
          <Button key="close" onClick={() => {
            setPdfModalOpen(false);
            if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(""); }
          }}>
            Đóng
          </Button>,
          <Button key="print" icon={<PrinterOutlined />} onClick={() => printPdfUrl(pdfBlobUrl)} disabled={!pdfBlobUrl}>
            In
          </Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={downloadContractAsPdf} loading={pdfGenerating}>
            Tải PDF
          </Button>
        ]}
        width={900}
        style={{ top: 24 }}
      >
        {pdfBlobUrl ? (
          <iframe title="PDFPreview" src={pdfBlobUrl} style={{ width:"100%", height: "70vh", border:"none" }} />
        ) : (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <Text type="secondary">Đang tạo bản xem trước…</Text>
          </div>
        )}
      </Modal>

      {/* Modal ký hợp đồng */}
      <Modal
        title="Ký hợp đồng"
        open={signModalOpen}
        onCancel={() => {
          setSignModalOpen(false);
          setCurrentContractId(null);
          setPinSent(false);
        }}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={pinSent ? handleSign : sendPin}>
          {!pinSent ? (
            <>
              <Text>Email nhận mã PIN: <strong>{customerProfile?.email || "Chưa cập nhật"}</strong></Text>
              <Divider />
              <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                <Button
                  onClick={() => {
                    setSignModalOpen(false);
                    setCurrentContractId(null);
                    setPinSent(false);
                  }}
                >
                  Hủy
                </Button>
                <Button type="primary" htmlType="submit" loading={signingContract} disabled={!customerProfile?.email}>
                  Gửi mã PIN
                </Button>
              </Space>
            </>
          ) : (
            <>
              <Form.Item
                label="Mã PIN"
                name="pinCode"
                rules={[{ required: true, message: "Vui lòng nhập mã PIN" }, { min: 6, message: "Ít nhất 6 ký tự" }]}
              >
                <Input placeholder="Nhập mã PIN" maxLength={10} />
              </Form.Item>
              <Space style={{ justifyContent: "space-between", width: "100%" }}>
                <Button onClick={() => setPinSent(false)}>Quay lại</Button>
                <Button type="primary" htmlType="submit" loading={signing}>
                  Ký hợp đồng
                </Button>
              </Space>
            </>
          )}
        </Form>
      </Modal>

      {/* Modal chọn phương thức thanh toán */}
      <Modal
        title="Thanh toán đơn hàng"
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        onOk={confirmCreatePayment}
        okText="Thanh toán"
        okButtonProps={{ disabled: !paymentTermsAccepted, loading: processingPayment }}
        destroyOnClose
      >
        {(() => {
          const order = paymentOrder || current;
          const items = order?.items || [];
          const days = Number(order?.days || 1);
          const rentalTotalRecalc = items.reduce((s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0) * days;
          const totalPriceFromBE = Number(order?.total ?? rentalTotalRecalc);
          const depositTotal = items.reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
          const totalAmount = totalPriceFromBE + depositTotal;
          return (
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>Tổng tiền thuê:</Text>
                <Text strong>{formatVND(totalPriceFromBE)}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>Tổng tiền cọc:</Text>
                <Text strong>{formatVND(depositTotal)}</Text>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 15, fontWeight: 600 }}>Tổng thanh toán</Text>
                <Text strong style={{ fontSize: 18 }}>{formatVND(totalAmount)}</Text>
              </div>

              <div>
                <Text style={{ display: "block", marginBottom: 8 }}>Phương thức thanh toán</Text>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="VNPAY">VNPay</Radio.Button>
                  <Radio.Button value="PAYOS">PayOS</Radio.Button>
                </Radio.Group>
              </div>

              <Checkbox
                checked={paymentTermsAccepted}
                onChange={(e) => setPaymentTermsAccepted(e.target.checked)}
              >
                Tôi đồng ý với các{" "}
                <a
                  href="https://docs.google.com/document/d/1GtAaYcQcSuvX8f-al_v_Q0mYYOWZMj-To8zHAKa0OnA/edit?tab=t.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  điều khoản thanh toán
                </a>
              </Checkbox>
            </Space>
          );
        })()}
      </Modal>

      {/* Container ẩn để render A4 rồi chụp */}
      <div style={{ position:"fixed", left:-9999, top:-9999, background:"#fff" }}>
        <div ref={printRef} />
      </div>

      <style>{`
        .modern-table .ant-table-thead > tr > th {
          background: #fafafa;
          font-weight: 600;
          color: #1a1a1a;
          border-bottom: 1px solid #e8e8e8;
          padding: 12px;
          font-size: 13px;
        }
        .modern-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f0f0f0;
          transition: all 0.3s ease;
          padding: 12px;
        }
        .modern-table .ant-table-tbody > tr:hover > td {
          background: #f5f5f5 !important;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .modern-table .ant-table-tbody > tr {
          transition: all 0.3s ease;
        }
        .modern-table .ant-table-container {
          overflow: auto hidden;
          border-radius: 12px;
        }
        .modern-table .ant-table {
          border-radius: 12px;
          overflow: hidden;
        }
        .ant-drawer-content {
          border-radius: 0;
          overflow: hidden;
        }
        .ant-drawer-header {
          border-bottom: 1px solid #e8e8e8;
        }
        .ant-tabs-tab {
          font-weight: 500;
          font-size: 15px;
        }
        .ant-tabs-tab-active {
          font-weight: 600;
        }
        .ant-card {
          transition: all 0.3s ease;
        }
        .ant-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
        }
      `}</style>
    </>
  );
}
