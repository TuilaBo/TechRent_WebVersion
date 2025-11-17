// src/pages/operator/OperatorOrders.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Table,
  Tag,
  Button,
  Space,
  Drawer,
  Typography,
  Modal,
  Tooltip,
  Input,
  message,
  DatePicker,
  Skeleton,
  Descriptions,
  Divider,
  Statistic,
  Popconfirm,
  Card,
  Row,
  Col,
  Tabs,
  Avatar,
  Image,
} from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ExpandOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listRentalOrders,
  getRentalOrderById,
  deleteRentalOrder,
  fmtVND,
} from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import {
  createContractFromOrder,
  getMyContracts,
  normalizeContract,
  listContractsByCustomer,
  listContractsByOrder,
  getContractById,
  sendContractForSignature,
} from "../../lib/contractApi";
import { getKycByCustomerId, updateKycStatus, normalizeKycItem } from "../../lib/kycApi";
import { getDeviceModelById, normalizeModel as normalizeDeviceModel } from "../../lib/deviceModelsApi";
import { getHandoverReportsByOrderId } from "../../lib/handoverReportApi";
import { getInvoiceByRentalOrderId } from "../../lib/Payment";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/* =========================
 * 1) UTILS - Format HTML & Money
 * ========================= */
function normalizeHtmlSpaces(html = "") {
  if (!html) return html;
  let out = html.replace(/&nbsp;/gi, " ");
  out = out.replace(/\s*:\s*/g, ": ");
  return out;
}

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

function formatMoneyInHtml(html = "") {
  if (!html) return html;
  html = normalizeHtmlSpaces(html);

  const SEP = String.raw`(?:\s|<\/?[^>]+>)*`;

  const patterns = [
    new RegExp(
      `(Tổng${SEP}tiền${SEP}thuê)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`,
      "gi"
    ),
    new RegExp(
      `(Tổng${SEP}tiền${SEP}cọc)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`,
      "gi"
    ),
    new RegExp(
      `(Tiền${SEP}cọc)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`,
      "gi"
    ),
    new RegExp(
      `(Giá${SEP}\\/?${SEP}ngày)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`,
      "gi"
    ),
    new RegExp(
      `(Tổng${SEP}tiền|Tổng${SEP}cộng)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`,
      "gi"
    ),
    new RegExp(`(Giá)${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)?`, "gi"),
  ];

  for (const re of patterns) {
    html = html.replace(re, (_, label, num) => {
      const n = Math.round(parseAnyNumber(num));
      return `${label}: ${n.toLocaleString("vi-VN")} VNĐ`;
    });
  }

  const unitPattern = new RegExp(
    `(\\d[\\d.,]*\\.?\\d*)${SEP}(VNĐ|VND)\\b`,
    "gi"
  );
  html = html.replace(unitPattern, (_, num) => {
    const n = Math.round(parseAnyNumber(num));
    return `${n.toLocaleString("vi-VN")} VNĐ`;
  });

  return html;
}

function formatEquipmentLayout(html = "") {
  if (!html || typeof html !== "string") return html;

  html = html.replace(
    /(?:^|\n|•\s*)?(\d+x\s+[^-]+?)\s*-\s*Giá\/ngày:([^-]+?)\s*-\s*Tiền cọc:([^•\n<]+?)(?=\s*\d+x|$|\n|Tổng)/gim,
    '<div class="equipment-item">$1 - Giá/ngày:$2 - Tiền cọc:$3</div>'
  );

  const SEP = String.raw`(?:\s|<\/?[^>]+>)*`;
  html = html.replace(
    new RegExp(
      `(Tổng${SEP}tiền${SEP}thuê:[^<\\n]+?)(?:\\s*<br\\s*\\/?>|\\n|\\s+)(Tiền${SEP}cọc:[^<\\n]+?)(?=\\s*<|$|\\n)`,
      "gi"
    ),
    '<div class="total-summary"><div class="total-rental">$1</div><div>$2</div></div>'
  );
  html = html.replace(
    new RegExp(
      `(Tổng${SEP}tiền${SEP}thuê:[^<\\n]+?)\\s+(Tiền${SEP}cọc:[^<\\n]+?)(?=\\s*<|$|\\n)`,
      "gi"
    ),
    '<div class="total-summary"><div class="total-rental">$1</div><div>$2</div></div>'
  );

  try {
    const rentReG = new RegExp(
      `Tổng${SEP}tiền${SEP}thuê${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(?:VNĐ|VND)`,
      "gi"
    );
    const depReG = new RegExp(
      `Tiền${SEP}cọc${SEP}:${SEP}(\\d[\\d.,]*\\.?\\d*)${SEP}(?:VNĐ|VND)`,
      "gi"
    );

    const rentMatches = [...html.matchAll(rentReG)];
    const depMatches = [...html.matchAll(depReG)];

    if (rentMatches.length && depMatches.length) {
      const lastRent = rentMatches[rentMatches.length - 1];
      const lastDep = depMatches[depMatches.length - 1];
      const rent = Math.round(parseAnyNumber(lastRent[1]));
      const dep = Math.round(parseAnyNumber(lastDep[1]));
      const grand = rent + dep;
      const grandHtml = `<div class="grand-total">Tổng thanh toán: ${grand.toLocaleString(
        "vi-VN"
      )} VNĐ</div>`;

      const lastSummaryRe =
        /<div class="total-summary">([\s\S]*?)<\/div>(?![\s\S]*<div class="total-summary">)/i;
      if (lastSummaryRe.test(html)) {
        html = html.replace(lastSummaryRe, (m) => `${m}\n${grandHtml}`);
      } else {
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

function sanitizeContractHtml(html = "") {
  if (!html || typeof html !== "string") return html;
  let out = html.replace(
    /Brand\([^)]*brandName=([^,)]+)[^)]*\)/g,
    "$1"
  );
  out = formatDatesInHtml(out); // Format ngày trước
  out = formatDateLabelsInHtml(out); // Format label ngày
  out = formatMoneyInHtml(out);
  out = formatEquipmentLayout(out);
  return out;
}

function normalizeInlineModel(modelLike, fallbackId) {
  if (!modelLike) return null;
  try {
    const normalized = normalizeDeviceModel(modelLike);
    if (normalized && (normalized.name || normalized.image)) {
      return normalized;
    }
  } catch (err) {
    console.error("Failed to normalize inline model:", err);
  }

  const id =
    modelLike?.deviceModelId ??
    modelLike?.id ??
    fallbackId ??
    null;
  const name =
    modelLike?.deviceName ??
    modelLike?.name ??
    (typeof modelLike === "string" ? modelLike : null);
  const image =
    modelLike?.imageURL ??
    modelLike?.imageUrl ??
    modelLike?.image ??
    "";

  if (!id && !name && !image) {
    return fallbackId
      ? { id: fallbackId, name: `Model #${fallbackId}`, image: "" }
      : null;
  }

  return {
    id: id ?? fallbackId ?? null,
    name: name || (fallbackId ? `Model #${fallbackId}` : ""),
    image,
  };
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
    .equipment-item { display: block; margin: 4px 0; }
    .equipment-item::before { content: "• "; }
    .total-summary { display: flex; gap: 16px; margin: 8px 0; }
    .total-summary > * { margin: 0; }
    .total-rental { font-weight: 700; }
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

const statusTag = (s) => {
  if (!s) return <Tag color="default">—</Tag>;
  const status = String(s).toUpperCase();
  switch (status) {
    case "PENDING":
      return <Tag color="gold">Đang chờ</Tag>;
    case "PENDING_KYC":
      return <Tag color="orange">Chờ xác thực thông tin</Tag>;
    case "CONFIRMED":
      return <Tag color="green">Đã xác nhận</Tag>;
    case "PROCESSING":
      return <Tag color="purple">Đang xử lý</Tag>;
    case "DELIVERY_C":
    case "DELIVERY_CONFIRMED":
    case "READY_FOR_DELIVERY":
      return <Tag color="cyan">Sẵn sàng giao hàng</Tag>;
    case "SHIPPED":
      return <Tag color="blue">Đã giao hàng</Tag>;
    case "DELIVERED":
      return <Tag color="green">Đã nhận hàng</Tag>;
    case "RETURNED":
      return <Tag color="geekblue">Đã trả hàng</Tag>;
    case "CANCELLED":
    case "CANCELED":
      return <Tag color="red">Đã hủy</Tag>;
    case "COMPLETED":
      return <Tag color="blue">Hoàn tất</Tag>;
    case "ACTIVE":
      return <Tag color="green">Đang thuê</Tag>;
    case "IN_USE":
      return <Tag color="geekblue">Đang sử dụng</Tag>;
    default:
      return <Tag color="default">{status}</Tag>;
  }
};

const kycStatusTag = (status) => {
  if (!status) return <Tag color="default">Chưa có KYC</Tag>;

  const s = String(status).toUpperCase();
  switch (s) {
    case "APPROVED":
    case "VERIFIED":
      return <Tag color="green">Đã duyệt KYC</Tag>;
    case "PENDING":
    case "SUBMITTED":
    case "DOCUMENTS_SUBMITTED":
      return <Tag color="orange">Đang chờ duyệt KYC</Tag>;
    case "REJECTED":
    case "REJECT":
    case "DENIED":
      return <Tag color="red">KYC bị từ chối</Tag>;
    case "INCOMPLETE":
      return <Tag color="gold">KYC chưa hoàn tất</Tag>;
    case "EXPIRED":
      return <Tag color="default">KYC hết hạn</Tag>;
    case "NOT_STARTED":
      return <Tag color="default">Chưa bắt đầu</Tag>;
    default:
      return <Tag color="default">{s}</Tag>;
  }
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

const paymentStatusTag = (paymentStatus, orderStatus, invoiceInfo = null) => {
  // Use invoice status if available, otherwise fallback to order paymentStatus
  const invoiceStatus = invoiceInfo?.invoiceStatus;
  const displayPaymentStatus = invoiceStatus
    ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
    : (String(orderStatus).toUpperCase() === "DELIVERY_CONFIRMED"
        ? "paid"
        : paymentStatus || "unpaid");

  const s = String(displayPaymentStatus || "unpaid").toUpperCase();
  switch (s) {
    case "PAID":
      return <Tag color="green">Đã thanh toán</Tag>;
    case "UNPAID":
      return <Tag color="volcano">Chưa thanh toán</Tag>;
    case "PARTIAL":
      return <Tag color="purple">Thanh toán một phần</Tag>;
    case "REFUNDED":
      return <Tag color="geekblue">Đã hoàn tiền</Tag>;
    default:
      return <Tag color="volcano">Chưa thanh toán</Tag>;
  }
};

const contractStatusTag = (status) => {
  if (!status) return <Tag color="default">—</Tag>;
  const s = String(status).toUpperCase();
  switch (s) {
    case "DRAFT":
      return <Tag color="default">Nháp</Tag>;
    case "PENDING_SIGNATURE":
      return <Tag color="gold">Chờ khách hàng ký</Tag>;
    case "PENDING_ADMIN_SIGNATURE":
      return <Tag color="orange">Chờ ký (admin)</Tag>;
    case "SIGNED":
      return <Tag color="green">Đã ký</Tag>;
    case "ACTIVE":
      return <Tag color="green">2 bên đã ký</Tag>;
    case "EXPIRED":
      return <Tag color="red">Hết hạn</Tag>;
    case "CANCELLED":
    case "CANCELED":
      return <Tag color="red">Đã hủy</Tag>;
    default:
      return <Tag color="default">{s}</Tag>;
  }
};

export default function OperatorOrders() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kw, setKw] = useState("");
  const [range, setRange] = useState(null);

  // Drawer xem chi tiết đơn
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [kycInfo, setKycInfo] = useState(null);
  const [orderContracts, setOrderContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [handoverReports, setHandoverReports] = useState([]);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState(null); // Invoice info from API

  // KYC review modal state
  const [kycReviewOpen, setKycReviewOpen] = useState(false);
  const [kycUpdating, setKycUpdating] = useState(false);
  const [kycRejectReason, setKycRejectReason] = useState("");

  // Contract detail
  const [contractDetail, setContractDetail] = useState(null);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [sendingForSignature, setSendingForSignature] = useState(false);
  const [contractCustomer, setContractCustomer] = useState(null);
  const [contractKyc, setContractKyc] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");

  // PDF (FE render)
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const printRef = useRef(null);

  const [orderDetailModels, setOrderDetailModels] = useState({});
  const [orderDetailMetaLoading, setOrderDetailMetaLoading] = useState(false);

  const shouldLoadOrderItemMeta = useMemo(() => {
    const status = String(detail?.orderStatus || "").toUpperCase();
    return (
      status === "PROCESSING" ||
      status === "READY_FOR_DELIVERY" ||
      status === "DELIVERY_CONFIRMED" ||
      status === "DELIVERY_C"
    );
  }, [detail?.orderStatus]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const list = await listRentalOrders();
      const arr = Array.isArray(list) ? list : [];
      arr.sort((a, b) => {
        const ta = new Date(a?.createdAt || 0).getTime();
        const tb = new Date(b?.createdAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (b?.orderId || 0) - (a?.orderId || 0);
      });
      setRows(arr);
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không tải được danh sách đơn."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!detail || !Array.isArray(detail.orderDetails) || detail.orderDetails.length === 0) {
      setOrderDetailModels({});
      setOrderDetailMetaLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!shouldLoadOrderItemMeta) {
      setOrderDetailModels({});
      setOrderDetailMetaLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const uniqueModelIds = Array.from(
      new Set(
        detail.orderDetails
          .map(
            (od) =>
              od?.deviceModelId ??
              od?.deviceModel?.deviceModelId ??
              od?.deviceModel?.id ??
              null
          )
          .filter((id) => id != null)
      )
    );

    if (uniqueModelIds.length === 0) {
      setOrderDetailModels({});
      setOrderDetailMetaLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setOrderDetailMetaLoading(true);
    Promise.all(
      uniqueModelIds.map(async (modelId) => {
        try {
          const raw = await getDeviceModelById(modelId);
          return [modelId, normalizeDeviceModel(raw || {})];
        } catch (err) {
          console.error("Failed to load device model", modelId, err);
          return [modelId, null];
        }
      })
    )
      .then((entries) => {
        if (cancelled) return;
        const map = {};
        entries.forEach(([id, info]) => {
          if (info) {
            map[id] = info;
          }
        });
        setOrderDetailModels(map);
      })
      .finally(() => {
        if (!cancelled) {
          setOrderDetailMetaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detail, shouldLoadOrderItemMeta]);

  // ====== Actions ======
  const doDelete = async (r) => {
    try {
      await deleteRentalOrder(r.orderId);
      message.success(`Đã huỷ đơn #${r.orderId}`);
      setRows((prev) => prev.filter((x) => x.orderId !== r.orderId));
      if (detail?.orderId === r.orderId) {
        setOpen(false);
        setDetail(null);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không huỷ được đơn.");
    }
  };

  const doCreateContract = async (r) => {
    const orderStatus = String(r.orderStatus || r.order?.orderStatus || "").toUpperCase();
    if (orderStatus !== "PROCESSING") {
      message.error(
        `Chỉ có thể tạo hợp đồng khi đơn hàng ở trạng thái "Đang xử lý" (PROCESSING). Trạng thái hiện tại: ${
          r.orderStatus || "—"
        }`
      );
      return;
    }

    try {
      const response = await createContractFromOrder(r.orderId);
      const contract = response?.data || response;
      message.success(
        `Đã tạo hợp đồng #${contract?.contractId || contract?.id} từ đơn #${r.orderId}`
      );
      if (detail?.orderId) {
        fetchOrderContracts(detail.orderId, detail?.customerId);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tạo được hợp đồng.");
    }
  };

  const fetchContracts = async () => {
    try {
      setContractsLoading(true);
      const list = await getMyContracts();
      const normalized = Array.isArray(list) ? list.map(normalizeContract) : [];
      setContracts(normalized);
    } catch (e) {
      console.error("Failed to fetch contracts:", e);
    } finally {
      setContractsLoading(false);
    }
  };

  const viewDetail = async (orderId) => {
    try {
      setLoadingDetail(true);
      setInvoiceInfo(null); // Reset invoice info
      const d = await getRentalOrderById(orderId);
      setDetail(d || null);
      
      // Load invoice info
      try {
        const invoice = await getInvoiceByRentalOrderId(orderId);
        setInvoiceInfo(invoice || null);
      } catch (invoiceErr) {
        // Invoice might not exist yet, that's okay
        console.log("No invoice found for order:", orderId);
        setInvoiceInfo(null);
      }
      
      if (d?.customerId) {
        try {
          const c = await fetchCustomerById(d.customerId);
          setCustomer(c || null);
          try {
            const kyc = await getKycByCustomerId(d.customerId);
            const normalized = normalizeKycItem(kyc || {});
            console.log("KYC raw:", kyc);
            console.log("KYC normalized:", normalized);
            console.log("Front URL:", normalized.frontUrl);
            console.log("Back URL:", normalized.backUrl);
            console.log("Selfie URL:", normalized.selfieUrl);
            setKycInfo(normalized);
            // Auto open review if documents submitted
            const st = String(normalized?.kycStatus || normalized?.status || "").toUpperCase();
            if (st === "DOCUMENTS_SUBMITTED" || st === "SUBMITTED") {
              setKycReviewOpen(true);
            }
          } catch (e) {
            console.error("Error fetching KYC:", e);
            setKycInfo(null);
          }
        } catch (e) {
          console.error("Error fetching customer:", e);
          setCustomer(null);
          setKycInfo(null);
        }
      } else {
        setCustomer(null);
        setKycInfo(null);
      }
      await fetchOrderContracts(orderId, d?.customerId);
      await fetchHandoverReports(orderId);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải chi tiết đơn.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchOrderContracts = async (orderId, customerId) => {
    try {
      setContractsLoading(true);
      let contracts = [];
      try {
        const orderContracts = await listContractsByOrder(orderId);
        contracts = Array.isArray(orderContracts)
          ? orderContracts.map(normalizeContract)
          : [];
      } catch {
        if (customerId) {
          const customerContracts = await listContractsByCustomer(customerId);
          const normalized = Array.isArray(customerContracts)
            ? customerContracts.map(normalizeContract)
            : [];
          contracts = normalized.filter((contract) => contract.orderId === orderId);
        }
      }
      setOrderContracts(contracts);
    } catch (e) {
      console.error("Failed to fetch order contracts:", e);
      setOrderContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const fetchHandoverReports = async (orderId) => {
    if (!orderId) {
      setHandoverReports([]);
      return;
    }
    try {
      setHandoverLoading(true);
      const reports = await getHandoverReportsByOrderId(orderId);
      setHandoverReports(Array.isArray(reports) ? reports : []);
    } catch (e) {
      console.error("Failed to fetch handover reports:", e);
      setHandoverReports([]);
    } finally {
      setHandoverLoading(false);
    }
  };

  const onView = (r) => {
    setOpen(true);
    setDetail(null);
    setKycInfo(null);
    setHandoverReports([]);
    viewDetail(r.orderId);
  };

  // ====== Helpers for PDF ======
  function revokeBlob(url) {
    try {
      url && URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error revoking blob:", e);
    }
  }
  function clearContractPreviewState() {
    revokeBlob(pdfBlobUrl);
    setPdfBlobUrl("");
    setPdfPreviewUrl("");
    setContractKyc(null);
  }

  function buildPrintableHtml(detail, customer, kyc) {
    if (!detail) return "<div>Không có dữ liệu hợp đồng</div>";
    const title = detail.title || "HỢP ĐỒNG";
    const number = detail.number ? `Số: ${detail.number}` : "";
    const customerName =
      customer?.fullName || customer?.name || `Khách hàng #${detail.customerId}`;
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
      const sliceHeight = Math.min(
        pageHeight / ratio,
        canvas.height - renderedHeight
      );
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        renderedHeight,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );
      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (renderedHeight > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, sliceHeight * ratio);
      renderedHeight += sliceHeight;
    }
    return pdf.output("blob");
  }

  async function previewContractAsPdf() {
    if (!contractDetail) return message.warning("Chưa có dữ liệu hợp đồng.");
    try {
      setPdfGenerating(true);
      revokeBlob(pdfBlobUrl);

      let customerData = contractCustomer;
      let kycData = contractKyc;

      if (contractDetail?.customerId) {
        if (!customerData) {
          try {
            const c = await fetchCustomerById(contractDetail.customerId);
            customerData = normalizeCustomer(c || {});
            setContractCustomer(customerData);
          } catch (e) {
            console.error("Failed to fetch customer profile:", e);
          }
        }

        if (!kycData) {
          try {
            kycData = await getKycByCustomerId(contractDetail.customerId);
            setContractKyc(kycData);
          } catch (e) {
            console.error("Failed to fetch KYC data:", e);
          }
        }
      }

      if (printRef.current) {
        const augmented = augmentContractContent(contractDetail);
        printRef.current.innerHTML = buildPrintableHtml(
          augmented,
          customerData,
          kycData
        );
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
    if (!contractDetail) return message.warning("Chưa có dữ liệu hợp đồng.");
    try {
      setPdfGenerating(true);
      revokeBlob(pdfBlobUrl);

      let customerData = contractCustomer;
      let kycData = contractKyc;

      if (contractDetail?.customerId) {
        if (!customerData) {
          try {
            const c = await fetchCustomerById(contractDetail.customerId);
            customerData = normalizeCustomer(c || {});
            setContractCustomer(customerData);
          } catch (e) {
            console.error("Failed to fetch customer profile:", e);
          }
        }

        if (!kycData) {
          try {
            kycData = await getKycByCustomerId(contractDetail.customerId);
            setContractKyc(kycData);
          } catch (e) {
            console.error("Failed to fetch KYC data:", e);
          }
        }
      }

      if (printRef.current) {
        const augmented = augmentContractContent(contractDetail);
        printRef.current.innerHTML = buildPrintableHtml(
          augmented,
          customerData,
          kycData
        );
        const blob = await elementToPdfBlob(printRef.current);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const name =
          contractDetail.contractFileName ||
          contractDetail.number ||
          `contract-${contractDetail.id}.pdf`;
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

  function printPdfUrl(url) {
    if (!url) return message.warning("Không có tài liệu để in.");
    const w = window.open(url, "_blank", "noopener");
    if (w) {
      const listener = () => {
        try {
          w.focus();
          w.print();
        } catch (err) {
          console.error("Print window error:", err);
        }
      };
      setTimeout(listener, 800);
    }
  }

  const viewContractDetail = async (contractId) => {
    try {
      setLoadingContractDetail(true);
      clearContractPreviewState();
      const contract = await getContractById(contractId);
      const normalized = normalizeContract(contract);
      setContractDetail(normalized);
      if (normalized?.contractUrl) setPdfPreviewUrl(normalized.contractUrl);

      if (normalized?.customerId) {
        try {
          const c = await fetchCustomerById(normalized.customerId);
          setContractCustomer(normalizeCustomer(c || {}));
        } catch (e) {
          console.error("Error fetching customer:", e);
          setContractCustomer(null);
        }

        try {
          const kyc = await getKycByCustomerId(normalized.customerId);
          setContractKyc(kyc || null);
        } catch (e) {
          console.error("Error fetching KYC:", e);
          setContractKyc(null);
        }
      } else {
        setContractCustomer(null);
        setContractKyc(null);
      }
      setContractDetailOpen(true);
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không tải được chi tiết hợp đồng."
      );
    } finally {
      setLoadingContractDetail(false);
    }
  };

  const doSendForSignature = async (contractId) => {
    try {
      setSendingForSignature(true);
      await sendContractForSignature(contractId);
      message.success("Đã gửi hợp đồng cho khách hàng ký!");

      const updatedContract = await getContractById(contractId);
      const normalized = normalizeContract(updatedContract);
      setContractDetail(normalized);

      await fetchContracts();
      if (detail?.orderId) {
        await fetchOrderContracts(detail.orderId, detail?.customerId);
      }
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không gửi được hợp đồng để ký."
      );
    } finally {
      setSendingForSignature(false);
    }
  };

  // ====== Filters ======
  const filtered = useMemo(() => {
    let ds = rows;
    if (kw.trim()) {
      const k = kw.trim().toLowerCase();
      ds = ds.filter(
        (r) =>
          String(r.orderId).toLowerCase().includes(k) ||
          String(r.customerId ?? "").toLowerCase().includes(k)
      );
    }
    if (range?.length === 2) {
      const [s, e] = range;
      const sMs = s.startOf("day").valueOf();
      const eMs = e.endOf("day").valueOf();
      ds = ds.filter((r) => {
        const t = dayjs(r.createdAt).valueOf();
        return t >= sMs && t <= eMs;
      });
    }
    return ds;
  }, [rows, kw, range]);

  // ====== Columns ======
  const columnsDef = ({ onDelete, onView }) => [
    {
      title: "Mã đơn",
      dataIndex: "orderId",
      width: 110,
      sorter: (a, b) => a.orderId - b.orderId,
      render: (v) => <strong>#{v}</strong>,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      width: 170,
      sorter: (a, b) =>
        dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "T/g thuê",
      dataIndex: "range",
      width: 220,
      render: (_, r) =>
        `${dayjs(r.startDate).format("YYYY-MM-DD")} → ${dayjs(r.endDate).format(
          "YYYY-MM-DD"
        )}`,
    },
    {
      title: "Số ngày",
      dataIndex: "days",
      width: 90,
      render: (_, r) => {
        const d =
          dayjs(r.endDate)
            .startOf("day")
            .diff(dayjs(r.startDate).startOf("day"), "day") || 1;
        return Math.max(1, d);
      },
    },
    {
      title: "Tổng tiền thuê",
      dataIndex: "totalPrice",
      width: 140,
      align: "right",
      render: (v) => fmtVND(v),
    },
    {
      title: "Tổng tiền cọc",
      dataIndex: "depositAmount",
      width: 140,
      align: "right",
      render: (v) => fmtVND(v),
    },
    {
      title: "Trạng thái đơn hàng",
      dataIndex: "orderStatus",
      width: 140,
      render: statusTag,
      filters: [
        { text: "Đang chờ", value: "PENDING" },
        { text: "Đã xác nhận", value: "CONFIRMED" },
        { text: "Đang xử lý", value: "PROCESSING" },
        { text: "Sẵn sàng giao hàng", value: "DELIVERY_C" },
        { text: "Đang sử dụng", value: "IN_USE" },
        { text: "Đã hủy", value: "CANCELLED" },
        { text: "Hoàn tất", value: "COMPLETED" },
      ],
      onFilter: (val, r) => {
        const orderStatus = String(r.orderStatus).toUpperCase();
        const filterVal = String(val).toUpperCase();
        if (filterVal === "DELIVERY_C") {
          return (
            orderStatus === "DELIVERY_C" ||
            orderStatus === "DELIVERY_CONFIRMED" ||
            orderStatus === "READY_FOR_DELIVERY"
          );
        }
        return orderStatus === filterVal;
      },
    },
    {
      title: "Thao tác",
      fixed: "right",
      width: 150,
      render: (_, r) => {
        return (
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => onView(r)}>
              Xem
            </Button>

            <Popconfirm
              title="Huỷ đơn?"
              okText="Huỷ"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(r)}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // ====== Bảng items trong Drawer ======
  const orderDetailRows = useMemo(() => {
    if (!detail || !Array.isArray(detail.orderDetails)) return [];
    return detail.orderDetails.map((od) => {
      const orderDetailId = od?.orderDetailId ?? od?.id;
      const model =
        orderDetailModels[od?.deviceModelId] ||
        normalizeInlineModel(od?.deviceModel, od?.deviceModelId);
      return {
        ...od,
        _orderDetailId: orderDetailId,
        _model: model,
      };
    });
  }, [detail, orderDetailModels]);

  const detailDays = useMemo(() => {
    if (!detail) return 1;
    const d =
      dayjs(detail.endDate)
        .startOf("day")
        .diff(dayjs(detail.startDate).startOf("day"), "day") || 1;
    return Math.max(1, d);
  }, [detail]);

  // Tính Tổng tiền thuê theo logic MyOrders: Σ(pricePerDay × quantity × số ngày)
  const rentalTotal = useMemo(() => {
    if (!detail || !Array.isArray(detail.orderDetails)) return 0;
    try {
      return detail.orderDetails.reduce((sum, od) => {
        const unit = Number(od?.pricePerDay || 0);
        return sum + unit * Number(detailDays || 1);
      }, 0);
    } catch {
      return 0;
    }
  }, [detail, detailDays]);

  const itemCols = useMemo(() => {
    const columns = [
      {
        title: "Chi tiết ID",
        dataIndex: "orderDetailId",
        width: 110,
        render: (value, record) =>
          record?._orderDetailId ?? value ?? "—",
      },
      {
        title: "Thiết bị",
        dataIndex: "deviceModelId",
        width: 280,
        render: (_, record) => {
          const model = record?._model;
          const name =
            model?.name ||
            record?.deviceModelName ||
            (record?.deviceModelId != null
              ? `Model #${record.deviceModelId}`
              : "Không xác định");
          const image = model?.image;
          const code =
            model?.id ??
            record?.deviceModelId ??
            record?.deviceModelCode ??
            "—";
          return (
            <Space align="start">
              <Avatar
                shape="square"
                size={48}
                src={image}
                alt={name}
                style={{ backgroundColor: image ? undefined : "#f0f0f0" }}
              >
                {!image && typeof name === "string"
                  ? name.charAt(0)?.toUpperCase()
                  : null}
              </Avatar>
              <div>
                <div>
                  <Text strong>{name}</Text>
                </div>
                <div style={{ color: "#6B7280", fontSize: 12 }}>
                  Mã mẫu: {code}
                </div>
              </div>
            </Space>
          );
        },
      },
    ];

    // Reordered: Đơn giá/ngày -> Số ngày -> Tổng tiền thuê -> Cọc/1 SP -> Số lượng -> Tổng cọc -> Tổng thanh toán
    columns.push(
      {
        title: "Đơn giá SP/ngày",
        dataIndex: "pricePerDay",
        width: 120,
        align: "right",
        render: (v) => fmtVND(v),
      },
      {
        title: "Số ngày thuê",
        key: "days",
        width: 90,
        align: "center",
        render: () => detailDays,
      },
      {
        title: "Tổng tiền thuê",
        key: "subtotal",
        width: 150,
        align: "right",
        render: (_, r) => fmtVND(Number(r.pricePerDay || 0) * Number(detailDays || 1)),
      },
      {
        title: "Cọc/1 SP",
        dataIndex: "depositAmountPerUnit",
        width: 130,
        align: "right",
        render: (v) => fmtVND(v),
      },
      {
        title: "SL",
        dataIndex: "quantity",
        width: 70,
        align: "center",
      },
      {
        title: "Tổng tiền cọc/loại sản phẩm",
        key: "depositTotal",
        width: 140,
        align: "right",
        render: (_, r) =>
          fmtVND(Number(r.depositAmountPerUnit || 0) * Number(r.quantity || 1)),
      }
    );

    return columns;
  }, [detailDays]);

  // Inline approve/reject actions (refer OperatorKYC)
  const approveKycInline = async () => {
    if (!detail?.customerId) return;
    try {
      setKycUpdating(true);
      await updateKycStatus(detail.customerId, {
        status: "VERIFIED",
        verifiedAt: dayjs().toISOString(),
        verifiedBy: undefined,
      });
      message.success("Đã duyệt KYC");
      setKycReviewOpen(false);
      const kyc = await getKycByCustomerId(detail.customerId);
      const normalized = normalizeKycItem(kyc || {});
      setKycInfo(normalized);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Duyệt KYC thất bại");
    } finally {
      setKycUpdating(false);
    }
  };

  const rejectKycInline = async () => {
    if (!detail?.customerId) return;
    try {
      if (!kycRejectReason.trim()) {
        return message.warning("Vui lòng nhập lý do từ chối");
      }
      setKycUpdating(true);
      await updateKycStatus(detail.customerId, {
        status: "REJECTED",
        rejectionReason: kycRejectReason.trim(),
        verifiedAt: dayjs().toISOString(),
        verifiedBy: undefined,
      });
      message.success("Đã từ chối KYC");
      setKycReviewOpen(false);
      setKycRejectReason("");
      const kyc = await getKycByCustomerId(detail.customerId);
      const normalized = normalizeKycItem(kyc || {});
      setKycInfo(normalized);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Từ chối KYC thất bại");
    } finally {
      setKycUpdating(false);
    }
  };

  // ====== UI ======
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý đơn hàng</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Tải lại</Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã đơn hoặc mã KH…"
          onSearch={setKw}
          onChange={(e) => setKw(e.target.value)}
          style={{ width: 300 }}
        />
        <RangePicker value={range} onChange={setRange} />
      </Space>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Table
          rowKey="orderId"
          columns={columnsDef({
            onDelete: doDelete,
            onView,
          })}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1200 }}
        />
      )}

      {/* Drawer chi tiết đơn */}
      <Drawer
        title={detail ? `Đơn thuê #${detail.orderId}` : "Chi tiết đơn"}
        open={open}
        width={800}
        onClose={() => {
          setOpen(false);
          setKycInfo(null);
          setHandoverReports([]);
          setInvoiceInfo(null);
        }}
        extra={detail && <Space></Space>}
      >
        {loadingDetail ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : detail ? (
          <>
            <Descriptions bordered size="middle" column={2}>
              <Descriptions.Item label="Mã đơn hàng">#{detail.orderId}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái đơn hàng">{statusTag(detail.orderStatus)}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái thanh toán">
                {paymentStatusTag(detail.paymentStatus, detail.orderStatus, invoiceInfo)}
              </Descriptions.Item>

              <Descriptions.Item label="Thông tin khách hàng">
                {detail.customerId ? (
                  <div>
                    <div><strong>#{detail.customerId}</strong></div>
                    <div>{customer?.fullName || customer?.name || "—"}</div>
                    <div style={{ color: "#6B7280" }}>{customer?.email || "—"}</div>
                    {customer?.phoneNumber && (
                      <div style={{ color: "#6B7280" }}>{customer.phoneNumber}</div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Text strong style={{ marginRight: 8 }}>KYC Status:</Text>
                      {kycStatusTag(kycInfo?.kycStatus || kycInfo?.status)}
                      {(() => {
                        const st = String(kycInfo?.kycStatus || kycInfo?.status || "").toUpperCase();
                        if (st === "DOCUMENTS_SUBMITTED" || st === "SUBMITTED") {
                          return (
                            <Button style={{ marginLeft: 8 }} type="primary" onClick={() => setKycReviewOpen(true)}>
                              Xem & xét duyệt KYC
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                ) : "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Ngày tạo đơn">
                {dayjs(detail.createdAt).format("YYYY-MM-DD HH:mm")}
              </Descriptions.Item>

              <Descriptions.Item label="Ngày bắt đầu thuê">{dayjs(detail.startDate).format("YYYY-MM-DD")}</Descriptions.Item>
              <Descriptions.Item label="Ngày kết thúc thuê">{dayjs(detail.endDate).format("YYYY-MM-DD")}</Descriptions.Item>
              <Descriptions.Item label="Số ngày">{detailDays} ngày</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao">{detail.shippingAddress || "—"}</Descriptions.Item>
            </Descriptions>

            <Divider />

            <Space size={24} wrap>
              <Statistic title="Tổng tiền thuê " value={fmtVND(rentalTotal)} />
              <Statistic title="Tổng tiền cọc" value={fmtVND(detail.depositAmount)} />
              <Statistic
                title="Tổng thanh toán"
                value={fmtVND((detail.totalPrice || 0) + (detail.depositAmount || 0))}
                valueStyle={{ color: "#1890ff", fontWeight: "bold" }}
              />
              <Statistic title="Cọc đã hoàn lại" value={fmtVND(detail.depositAmountRefunded)} />
              
            </Space>

            <Divider />

            <Title level={5} style={{ marginBottom: 8 }}>Chi tiết sản phẩm</Title>
            <Table
              rowKey={(record) =>
                record?._orderDetailId ??
                record?.orderDetailId ??
                `${record?.deviceModelId ?? "model"}-${record?.quantity ?? 0}`
              }
              columns={itemCols}
              dataSource={orderDetailRows}
              pagination={false}
              size="small"
              loading={orderDetailMetaLoading && shouldLoadOrderItemMeta}
              scroll={{ x: 1000 }}
            />

            <Divider />

            <Title level={5} style={{ marginBottom: 8 }}>Hợp đồng đã tạo</Title>
            {contractsLoading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : orderContracts.length > 0 ? (
              <Table
                rowKey="id"
                columns={[
                  {
                    title: "Mã hợp đồng",
                    dataIndex: "id",
                    width: 100,
                    render: (v) => <strong>#{v}</strong>,
                  },
                  { title: "Số hợp đồng", dataIndex: "number", width: 120, render: (v) => v || "—" },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    width: 100,
                    render: (status) => contractStatusTag(status),
                  },
                  {
                    title: "Ngày tạo",
                    dataIndex: "createdAt",
                    width: 120,
                    render: (v) => dayjs(v).format("DD/MM/YYYY"),
                  },
                  {
                    title: "Tổng thanh toán",
                    key: "totalPayment",
                    width: 130,
                    align: "right",
                    render: (_, record) =>
                      fmtVND(
                        Number(record.totalAmount || 0) +
                          Number(record.depositAmount || 0)
                      ),
                  },
                  {
                    title: "Thao tác",
                    key: "actions",
                    width: 150,
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => viewContractDetail(record.id)}
                          loading={loadingContractDetail}
                        >
                          Xem
                        </Button>
                        {record.status === "DRAFT" && (
                          <Button
                            size="small"
                            type="primary"
                            loading={sendingForSignature}
                            onClick={() => doSendForSignature(record.id)}
                          >
                            Gửi Admin ký
                          </Button>
                        )}
                      </Space>
                    ),
                  },
                ]}
                dataSource={orderContracts}
                pagination={false}
                size="small"
              />
            ) : (
              <Text type="secondary">Chưa có hợp đồng nào được tạo từ đơn này</Text>
            )}

            <Divider />

            <Title level={5} style={{ marginBottom: 8 }}>Biên bản bàn giao</Title>
            {handoverLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : handoverReports.length > 0 ? (
              handoverReports.map((report) => (
                <Card
                  key={report.handoverReportId}
                  type="inner"
                  title={`Biên bản #${report.handoverReportId} • Task #${report.taskId ?? "—"}`}
                  style={{ marginBottom: 16 }}
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Ngày bàn giao">
                      {report.handoverDateTime
                        ? dayjs(report.handoverDateTime).format("DD/MM/YYYY HH:mm")
                        : "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Địa điểm">
                      {report.handoverLocation || "—"}
                    </Descriptions.Item>
                    {(() => {
                      // Parse customerInfo string: "Tên • SĐT • Email"
                      const customerInfoStr = report.customerInfo || "";
                      const parts = customerInfoStr.split(" • ").filter(Boolean);
                      const customerName = parts[0] || "—";
                      const customerPhone = parts[1] || "—";
                      const customerEmail = parts[2] || "—";
                      
                      return (
                        <>
                          <Descriptions.Item label="Tên khách hàng">
                            {customerName}
                          </Descriptions.Item>
                          <Descriptions.Item label="Số điện thoại">
                            {customerPhone}
                          </Descriptions.Item>
                          <Descriptions.Item label="Email">
                            {customerEmail}
                          </Descriptions.Item>
                        </>
                      );
                    })()}
                    <Descriptions.Item label="Thông tin nhân sự thực hiện">
                      {report.technicianInfo || "—"}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider dashed />

                  <Title level={5} style={{ fontSize: 14 }}>Thiết bị bàn giao</Title>
                  <Table
                    rowKey={(record, idx) => `${report.handoverReportId}-${idx}`}
                    dataSource={report.items || []}
                    pagination={false}
                    size="small"
                    columns={[
                      { title: "Tên thiết bị", dataIndex: "itemName", key: "itemName" },
                      {
                        title: "Mã thiết bị/Serial",
                        dataIndex: "itemCode",
                        key: "itemCode",
                        render: (val) => val || "—",
                      },
                      { title: "Đơn vị", dataIndex: "unit", key: "unit", width: 90 },
                      {
                        title: "SL đặt",
                        dataIndex: "orderedQuantity",
                        key: "orderedQuantity",
                        width: 100,
                        align: "center",
                      },
                      {
                        title: "SL giao",
                        dataIndex: "deliveredQuantity",
                        key: "deliveredQuantity",
                        width: 100,
                        align: "center",
                      },
                    ]}
                  />

                  <Divider dashed />

                  <Title level={5} style={{ fontSize: 14 }}>Kỹ thuật viên tham gia</Title>
                  <Space direction="vertical" size={6} style={{ width: "100%" }}>
                    {(report.technicians || []).map((tech) => (
                      <Card key={`${report.handoverReportId}-tech-${tech.staffId ?? tech.username ?? tech.fullName ?? ""}`} size="small">
                        <Space direction="vertical" size={0}>
                          <Text strong>
                            {tech.fullName || tech.username || `Nhân sự #${tech.staffId ?? "?"}`}
                          </Text>
                          <Text type="secondary">Role: {tech.role || "—"}</Text>
                          {tech.email && <Text type="secondary">Email: {tech.email}</Text>}
                          {tech.phoneNumber && <Text type="secondary">Phone: {tech.phoneNumber}</Text>}
                        </Space>
                      </Card>
                    ))}
                    {(!report.technicians || report.technicians.length === 0) && (
                      <Text type="secondary">Không có thông tin nhân sự.</Text>
                    )}
                  </Space>

                  <Divider dashed />

                  <Title level={5} style={{ fontSize: 14 }}>Bằng chứng</Title>
                  <Space wrap>
                    {(report.evidenceUrls || []).map((url, idx) => (
                      <Image
                        key={`${report.handoverReportId}-evidence-${idx}`}
                        src={url}
                        alt={`Evidence ${idx + 1}`}
                        width={180}
                        style={{ borderRadius: 8 }}
                        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='120'%3E%3Crect width='180' height='120' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E"
                      />
                    ))}
                    {(!report.evidenceUrls || report.evidenceUrls.length === 0) && (
                      <Text type="secondary">Không có bằng chứng hình ảnh.</Text>
                    )}
                  </Space>
                </Card>
              ))
            ) : (
              <Text type="secondary">Chưa có biên bản bàn giao nào cho đơn này.</Text>
            )}

            <Divider />

            <Space>
              {/* Chỉ cho phép tạo hợp đồng khi trạng thái đơn là "processing" và chưa có hợp đồng nào không ở trạng thái DRAFT */}
              {String(detail.orderStatus).toUpperCase() === "PROCESSING" && (() => {
                // Kiểm tra xem có hợp đồng nào không ở trạng thái DRAFT không
                const hasNonDraftContract = orderContracts.some(contract => {
                  const status = String(contract.status || "").toUpperCase();
                  return status !== "DRAFT" && status !== "";
                });
                // Chỉ hiển thị nút nếu chưa có hợp đồng hoặc tất cả hợp đồng đều ở trạng thái DRAFT
                return !hasNonDraftContract;
              })() && (
                <Button icon={<FileTextOutlined />} onClick={() => doCreateContract(detail)} title="Tạo hợp đồng">
                  Tạo hợp đồng
                </Button>
              )}

              <Popconfirm
                title="Huỷ đơn?"
                okText="Huỷ"
                okButtonProps={{ danger: true }}
                onConfirm={() => doDelete(detail)}
              >
                <Button danger icon={<DeleteOutlined />}>Huỷ đơn</Button>
              </Popconfirm>
            </Space>
          </>
        ) : (
          <Text type="secondary">Không có dữ liệu.</Text>
        )}
      </Drawer>

      {/* Contract Detail Modal - CHỈ GIỮ PHẦN HỢP ĐỒNG PDF */}
      <Modal
        title="Chi tiết hợp đồng"
        open={contractDetailOpen}
        onCancel={() => setContractDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setContractDetailOpen(false)}>
            Đóng
          </Button>,
          contractDetail &&
            contractDetail.status === "DRAFT" && (
              <Button
                key="send"
                type="primary"
                loading={sendingForSignature}
                onClick={() => doSendForSignature(contractDetail.id)}
              >
                Gửi để ký
              </Button>
            ),
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {contractDetail ? (
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <Title level={5} style={{ marginBottom: 16 }}>Hợp đồng PDF</Title>

            <Space style={{ marginBottom: 12 }} wrap>
              <Button
                icon={<ExpandOutlined />}
                onClick={() => {
                  const url = contractDetail.contractUrl || pdfPreviewUrl || pdfBlobUrl;
                  return url
                    ? window.open(url, "_blank", "noopener")
                    : message.warning("Không có URL hợp đồng");
                }}
              >
                Xem toàn màn hình
              </Button>

              {(() => {
                const href = contractDetail.contractUrl || pdfPreviewUrl;
                if (href) {
                  return (
                    <>
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        href={href}
                        target="_blank"
                        rel="noopener"
                      >
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
              {!(contractDetail.contractUrl || pdfPreviewUrl) && (
                <>
                  <Button onClick={previewContractAsPdf} loading={pdfGenerating}>
                    Xem trước hợp đồng PDF
                  </Button>
                  <Button
                    type="primary"
                    onClick={downloadContractAsPdf}
                    loading={pdfGenerating}
                  >
                    Tạo & tải hợp đồng PDF
                  </Button>
                </>
              )}
            </Space>

            <div
              style={{
                height: 500,
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fafafa",
              }}
            >
              {contractDetail.contractUrl || pdfPreviewUrl ? (
                <iframe
                  key={contractDetail.contractUrl || pdfPreviewUrl}
                  title="ContractPreview"
                  src={contractDetail.contractUrl || pdfPreviewUrl}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text type="secondary">
                    <FilePdfOutlined /> Không có URL hợp đồng để hiển thị.
                  </Text>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Text type="secondary">Không có dữ liệu.</Text>
        )}
      </Modal>

      {/* Modal xem trước PDF do FE kết xuất */}
      <Modal
        title="Xem trước PDF hợp đồng (HTML→PDF)"
        open={pdfModalOpen}
        onCancel={() => {
          setPdfModalOpen(false);
          if (pdfBlobUrl) {
            URL.revokeObjectURL(pdfBlobUrl);
            setPdfBlobUrl("");
          }
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setPdfModalOpen(false);
              if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl);
                setPdfBlobUrl("");
              }
            }}
          >
            Đóng
          </Button>,
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => printPdfUrl(pdfBlobUrl)}
            disabled={!pdfBlobUrl}
          >
            In
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadContractAsPdf}
            loading={pdfGenerating}
          >
            Tải PDF
          </Button>,
        ]}
        width={900}
        style={{ top: 24 }}
      >
        {pdfBlobUrl ? (
          <iframe
            title="PDFPreview"
            src={pdfBlobUrl}
            style={{ width: "100%", height: "70vh", border: "none" }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Text type="secondary">Đang tạo bản xem trước…</Text>
          </div>
        )}
      </Modal>

      {/* Container ẩn để render A4 rồi chụp */}
      <div style={{ position: "fixed", left: -9999, top: -9999, background: "#fff" }}>
        <div ref={printRef} />
      </div>

      {/* KYC Review Modal inside Orders */}
      <Modal
        title={detail ? `Xem xét KYC • KH #${detail.customerId}` : "Xem xét KYC"}
        open={kycReviewOpen}
        onCancel={() => setKycReviewOpen(false)}
        footer={[
          <Button key="reject" danger onClick={rejectKycInline} loading={kycUpdating}>
            Từ chối
          </Button>,
          <Button key="approve" type="primary" onClick={approveKycInline} loading={kycUpdating}>
            Duyệt
          </Button>,
        ]}
        width={900}
        destroyOnClose
      >
        {kycInfo ? (
          <>
            {/* Khối 1: Thông tin cơ bản */}
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Khách hàng" span={1}>
                {customer?.fullName || customer?.name || kycInfo?.fullName || `#${detail?.customerId}`}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={1}>
                {kycStatusTag(kycInfo?.kycStatus || kycInfo?.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{customer?.email || kycInfo?.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Customer ID">{detail?.customerId || kycInfo?.customerId || "—"}</Descriptions.Item>
              <Descriptions.Item label="Ngày xác thực">{kycInfo?.verifiedAt || "—"}</Descriptions.Item>
              {kycInfo?.rejectionReason && (
                <Descriptions.Item label="Lý do từ chối" span={2}>
                  {kycInfo.rejectionReason}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            {/* Khối 2: Thông tin giấy tờ KYC chi tiết */}
            <Title level={5} style={{ marginTop: 0 }}>Thông tin giấy tờ</Title>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Họ và tên" span={2}>
                {kycInfo?.fullName || customer?.fullName || customer?.name || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Số định danh">
                {kycInfo?.identificationCode || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Loại giấy tờ">
                {(() => {
                  const t = String(kycInfo?.typeOfIdentification || "").toUpperCase();
                  if (t === "CCCD") return "CCCD";
                  if (t === "CMND") return "CMND";
                  if (t === "PASSPORT") return "Hộ chiếu";
                  return kycInfo?.typeOfIdentification || "—";
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {kycInfo?.birthday ? dayjs(kycInfo.birthday).format("DD/MM/YYYY") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày hết hạn">
                {kycInfo?.expirationDate ? dayjs(kycInfo.expirationDate).format("DD/MM/YYYY") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ thường trú" span={2}>
                {kycInfo?.permanentAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            {/* Khối 3: Ảnh đã tải lên */}
            <Title level={5} style={{ marginTop: 0 }}>
              Ảnh giấy tờ & selfie
            </Title>
            <Space wrap size={12}>
              {kycInfo?.frontUrl ? (
                <Image
                  src={kycInfo.frontUrl}
                  width={260}
                  style={{ borderRadius: 8 }}
                  alt="Mặt trước"
                  fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='200'%3E%3Crect width='260' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='14'%3EKhông có ảnh mặt trước%3C/text%3E%3C/svg%3E"
                />
              ) : (
                <div style={{ width: 260, height: 200, border: "1px dashed #d9d9d9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
                  <Text type="secondary">Không có ảnh mặt trước</Text>
                </div>
              )}
              {kycInfo?.backUrl ? (
                <Image
                  src={kycInfo.backUrl}
                  width={260}
                  style={{ borderRadius: 8 }}
                  alt="Mặt sau"
                  fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='200'%3E%3Crect width='260' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='14'%3EKhông có ảnh mặt sau%3C/text%3E%3C/svg%3E"
                />
              ) : (
                <div style={{ width: 260, height: 200, border: "1px dashed #d9d9d9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
                  <Text type="secondary">Không có ảnh mặt sau</Text>
                </div>
              )}
              {kycInfo?.selfieUrl ? (
                <Image
                  src={kycInfo.selfieUrl}
                  width={260}
                  style={{ borderRadius: 8 }}
                  alt="Selfie"
                  fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='200'%3E%3Crect width='260' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='14'%3EKhông có ảnh selfie%3C/text%3E%3C/svg%3E"
                />
              ) : (
                <div style={{ width: 260, height: 200, border: "1px dashed #d9d9d9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
                  <Text type="secondary">Không có ảnh selfie</Text>
                </div>
              )}
            </Space>

            <Divider />
            <Title level={5} style={{ marginTop: 0 }}>Lý do từ chối (nếu có)</Title>
            <Input.TextArea
              rows={3}
              placeholder="Nhập lý do từ chối KYC (nếu muốn từ chối)"
              value={kycRejectReason}
              onChange={(e) => setKycRejectReason(e.target.value)}
            />
          </>
        ) : (
          <Text type="secondary">Không có dữ liệu KYC.</Text>
        )}
      </Modal>
    </>
  );
}
