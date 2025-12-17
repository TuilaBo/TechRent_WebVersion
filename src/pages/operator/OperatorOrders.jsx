
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
  Popconfirm,
  Image,
  Divider,
  Upload,
  Steps,
  List,
  Badge,
  Statistic,
  Card,
  Row,
  Col,
  Tabs,
  Avatar,
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
  PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listRentalOrders,
  searchRentalOrders,
  getRentalOrderById,
  deleteRentalOrder,
  fmtVND,
} from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import {
  createContractFromOrder,
  normalizeContract,
  listContractsByCustomer,
  listContractsByOrder,
  getContractById,
  sendContractForSignature,
} from "../../lib/contractApi";
import { getKycByCustomerId, updateKycStatus, normalizeKycItem } from "../../lib/kycApi";
import { getDeviceModelById, normalizeModel as normalizeDeviceModel } from "../../lib/deviceModelsApi";
import { getConditionDefinitions } from "../../lib/condition";
import { getHandoverReportsByOrderId } from "../../lib/handoverReportApi";
import { getInvoiceByRentalOrderId } from "../../lib/Payment";
import { getQcReportsByOrderId } from "../../lib/qcReportApi";
import { createAnnexFromExtension, getAnnexesByContractId, normalizeAnnex } from "../../lib/annexes";
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
  const datePattern = /(\d{4}-\d{2}-\d{2})T[\d:.]+/g;
  return html.replace(datePattern, (match) => {
    try {
      const d = new Date(match);
      if (!Number.isNaN(d.getTime())) {
        const pad = (num) => String(num).padStart(2, "0");
        const day = pad(d.getDate());
        const month = pad(d.getMonth() + 1);
        const year = d.getFullYear();
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      }
    } catch {
      // ignore
    }
    return match;
  });
}

function formatDateLabelsInHtml(html = "") {
  if (!html || typeof html !== "string") return html;
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
  out = formatDatesInHtml(out);
  out = formatDateLabelsInHtml(out);
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
  const originalBase = String(detail.contentHtml || detail.contractContent || "");
  const base = originalBase;
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
      return <Tag color="cyan">Chuẩn bị giao hàng</Tag>;
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
      return <Tag color="blue">Hoàn tất đơn hàng</Tag>;
    case "ACTIVE":
      return <Tag color="green">Đang thuê</Tag>;
    case "IN_USE":
      return <Tag color="geekblue">Đang sử dụng</Tag>;
      case "DELIVERING":
      return <Tag color="cyan">Đang giao hàng</Tag>;
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
  const oStatus = String(orderStatus).toUpperCase();
  
  // Determine payment status from invoice or derive from order status
  let displayPaymentStatus;
  if (invoiceStatus) {
    displayPaymentStatus = mapInvoiceStatusToPaymentStatus(invoiceStatus);
  } else if (["DELIVERY_CONFIRMED", "READY_FOR_DELIVERY", "IN_USE", "ACTIVE", "COMPLETED", "RETURNED", "DELIVERING"].includes(oStatus)) {
    // Orders in these states have been paid (passed payment gate)
    displayPaymentStatus = "paid";
  } else {
    displayPaymentStatus = paymentStatus || "unpaid";
  }

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
      return <Tag color="green">2 bên đã ký</Tag>;
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

/* =========================
 * 2b) Handover report PDF helpers (shared with TechnicianCalendar)
 * ========================= */
const HANDOVER_PRINT_CSS = `
  <style>
    .handover-print-root,
    .handover-print-root * {
      font-family: Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
    }
    .handover-print-root h1,
    .handover-print-root h2,
    .handover-print-root h3 {
      margin: 8px 0 6px;
      font-weight: 700;
    }
    .handover-print-root h3 {
      font-size: 14px;
      text-transform: uppercase;
    }
    .handover-print-root p {
      margin: 6px 0;
    }
    .handover-print-root ol,
    .handover-print-root ul {
      margin: 6px 0 6px 18px;
      padding: 0;
    }
    .handover-print-root li {
      margin: 3px 0;
    }
    .handover-print-root .kv {
      margin-bottom: 10px;
    }
    .handover-print-root .kv div {
      margin: 2px 0;
    }
    .handover-print-root table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    .handover-print-root table th,
    .handover-print-root table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .handover-print-root table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    .handover-print-root .equipment-item {
      display: block;
      margin: 4px 0;
    }
    .handover-print-root .equipment-item::before {
      content: "• ";
    }
  </style>
`;

const formatHandoverDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return dayjs(iso).format("DD/MM/YYYY HH:mm");
  } catch {
    return iso;
  }
};

const parseInfoString = (infoStr) => {
  if (!infoStr) return { name: "", phone: "", email: "" };
  const parts = infoStr.split("•").map((s) => s.trim()).filter(Boolean);
  return {
    name: parts[0] || "",
    phone: parts[1] || "",
    email: parts[2] || "",
  };
};

const translateHandoverStatus = (status) => {
  const s = String(status || "").toUpperCase();
  const map = {
    DRAFT: "Nháp",
    PENDING: "Chờ ký",
    PENDING_STAFF_SIGNATURE: "Chờ nhân viên ký",
    STAFF_SIGNED: "Nhân viên đã ký",
    CUSTOMER_SIGNED: "Đã ký khách hàng",
    BOTH_SIGNED: "2 bên đã ký",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
  };
  return map[s] || status;
};

const translateStaffRole = (role) => {
  const r = String(role || "").toUpperCase();
  if (r === "TECHNICIAN") return "Kỹ thuật viên";
  return role || "—";
};

/**
 * FIXED VERSION – không còn bị bể template string
 */
function buildPrintableHandoverReportHtml(report, order = null, conditionDefinitions = []) {
  if (!report) return "<div>Không có dữ liệu biên bản</div>";

  const customerInfo = parseInfoString(report.customerInfo);
  const technicianInfo = parseInfoString(report.technicianInfo || report.staffSignature);
  const customerName = customerInfo.name || "—";

  const technicianEntries = (() => {
    const raw = [];
    const pushTech = (tech) => {
      if (!tech) return;
      const name =
        tech.fullName ||
        tech.username ||
        tech.staffName ||
        tech.name ||
        technicianInfo.name ||
        "";
      const phone =
        tech.phoneNumber ||
        tech.phone ||
        tech.contactNumber ||
        tech.contact ||
        "";
      const email = tech.email || "";

      if (!name && !phone && !email) return;
      raw.push({
        staffId: tech.staffId || tech.id || null,
        name,
        phone,
        email,
      });
    };

    if (Array.isArray(report.deliveryStaff)) {
      report.deliveryStaff.forEach(pushTech);
    }

    if (Array.isArray(report.technicians)) {
      report.technicians.forEach(pushTech);
    }

    if (!raw.length && (technicianInfo.name || technicianInfo.phone || technicianInfo.email)) {
      raw.push({
        staffId: null,
        name: technicianInfo.name || "—",
        phone: technicianInfo.phone || "",
        email: technicianInfo.email || "",
      });
    }

    const deduped = [];
    const seen = new Set();
    raw.forEach((tech, idx) => {
      const key = tech.staffId || tech.email || tech.phone || `${tech.name}-${idx}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(tech);
    });

    return deduped;
  })();

  const technicianDisplayName =
    technicianEntries[0]?.name || technicianInfo.name || "—";

  const conditionMap = {};
  conditionDefinitions.forEach((cd) => {
    conditionMap[cd.id || cd.conditionDefinitionId] = cd;
  });

  const allocationMap = {};
  if (order && Array.isArray(order.orderDetails)) {
    order.orderDetails.forEach((od) => {
      if (od.allocations && Array.isArray(od.allocations)) {
        od.allocations.forEach((allocation) => {
          if (allocation.allocationId) {
            allocationMap[allocation.allocationId] = {
              deviceModelName:
                od.deviceModel?.deviceName || od.deviceModel?.name || od.deviceName || "—",
              serialNumber:
                allocation.device?.serialNumber || allocation.serialNumber || "—",
              deviceId: allocation.device?.deviceId || allocation.deviceId || null,
              unit: "cái",
              quantity: od.quantity || 1,
            };
          }
        });
      }
    });
  }

  if (Array.isArray(report.deviceConditions)) {
    report.deviceConditions.forEach((dc) => {
      if (!dc.allocationId) return;
      if (!allocationMap[dc.allocationId]) {
        allocationMap[dc.allocationId] = {
          deviceId: dc.deviceId,
          serialNumber: dc.deviceSerial || "—",
          deviceModelName: "—",
          unit: "cái",
          quantity: 1,
        };
      } else {
        if (!allocationMap[dc.allocationId].deviceId) {
          allocationMap[dc.allocationId].deviceId = dc.deviceId;
        }
        if (
          !allocationMap[dc.allocationId].serialNumber ||
          allocationMap[dc.allocationId].serialNumber === "—"
        ) {
          allocationMap[dc.allocationId].serialNumber = dc.deviceSerial || "—";
        }
      }
    });
  }

  const deviceConditionsByDeviceId = {};
  if (Array.isArray(report.deviceConditions)) {
    report.deviceConditions.forEach((dc) => {
      if (dc.deviceId) {
        if (!deviceConditionsByDeviceId[dc.deviceId]) {
          deviceConditionsByDeviceId[dc.deviceId] = [];
        }
        deviceConditionsByDeviceId[dc.deviceId].push(dc);
      }
    });
  }

  const getDeviceConditionsHtml = (deviceId) => {
    const deviceConditions = deviceConditionsByDeviceId[deviceId] || [];
    if (deviceConditions.length === 0) {
      return { conditions: "—", images: "—" };
    }

    const uniqueConditions = new Set();
    const uniqueImages = new Set();

    deviceConditions.forEach((dc) => {
      const snapshots = dc.baselineSnapshots || dc.snapshots || [];
      const selectedSnapshot =
        snapshots.find((s) => String(s.source || "").toUpperCase() === "HANDOVER_OUT") ||
        snapshots.find((s) => String(s.source || "").toUpperCase() === "QC_BEFORE") ||
        snapshots[0];

      if (selectedSnapshot?.conditionDetails) {
        selectedSnapshot.conditionDetails.forEach((detail) => {
          uniqueConditions.add(`${detail.conditionDefinitionId}_${detail.severity}`);
        });
      }

      if (Array.isArray(selectedSnapshot?.images)) {
        selectedSnapshot.images.forEach((img) => uniqueImages.add(img));
      }
    });

    const conditionsHtml = uniqueConditions.size
      ? Array.from(uniqueConditions)
          .map((key) => {
            const [conditionDefId] = key.split("_");
            const conditionDef = conditionMap[conditionDefId];
            return `<div>${conditionDef?.name || `Điều kiện #${conditionDefId}`}</div>`;
          })
          .join("")
      : "—";

    const imagesHtml = uniqueImages.size
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px">
          ${Array.from(uniqueImages)
            .map(
              (img, idx) => `
              <img
                src="${img}"
                alt="Ảnh ${idx + 1}"
                style="max-width:80px;max-height:80px;border:1px solid #ddd;border-radius:4px;object-fit:contain"
                onerror="this.style.display='none';"
              />
            `
            )
            .join("")}
        </div>`
      : "—";

    return { conditions: conditionsHtml, images: imagesHtml };
  };

  const itemsRows = (report.items || [])
    .map((item, idx) => {
      const deviceId = item.deviceId;
      const { conditions, images } = deviceId
        ? getDeviceConditionsHtml(deviceId)
        : { conditions: "—", images: "—" };

      if (item.deviceSerialNumber && item.deviceModelName) {
        return `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${item.deviceModelName}</td>
            <td>${item.deviceSerialNumber}</td>
            <td style="text-align:center">cái</td>
            <td style="text-align:center">1</td>
            <td style="text-align:center">1</td>
            <td>${conditions}</td>
            <td>${images}</td>
          </tr>
        `;
      }

      if (item.allocationId && allocationMap[item.allocationId]) {
        const info = allocationMap[item.allocationId];
        const lookupDeviceId =
          info.deviceId ||
          report.deviceConditions?.find((d) => d.allocationId === item.allocationId)?.deviceId;
        const conditionHtml = lookupDeviceId
          ? getDeviceConditionsHtml(lookupDeviceId)
          : { conditions: "—", images: "—" };
        return `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${info.deviceModelName}</td>
            <td>${info.serialNumber}</td>
            <td style="text-align:center">${info.unit}</td>
            <td style="text-align:center">${info.quantity}</td>
            <td style="text-align:center">${info.quantity}</td>
            <td>${conditionHtml.conditions}</td>
            <td>${conditionHtml.images}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${item.itemName || "—"}</td>
          <td>${item.itemCode || "—"}</td>
          <td style="text-align:center">${item.unit || "cái"}</td>
          <td style="text-align:center">${item.orderedQuantity || 0}</td>
          <td style="text-align:center">${item.deliveredQuantity || 0}</td>
          <td>—</td>
          <td>—</td>
        </tr>
      `;
    })
    .join("");

  const handoverType = String(report.handoverType || "").toUpperCase();
  const isCheckin = handoverType === "CHECKIN";

  return `
    ${HANDOVER_PRINT_CSS}
    <div class="handover-print-root" style="width:794px;margin:0 auto;background:#fff;color:#111;padding:32px 40px;box-sizing:border-box;">
      ${NATIONAL_HEADER_HTML}
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:22px;font-weight:700;letter-spacing:.5px">
          ${isCheckin ? "BIÊN BẢN THU HỒI THIẾT BỊ" : "BIÊN BẢN BÀN GIAO THIẾT BỊ"}
        </div>
        <div style="color:#666">Số: #${report.handoverReportId || report.id || "—"}</div>
      </div>
      <hr style="border:none;border-top:1px solid #e8e8e8;margin:12px 0 16px"/>

      <section class="kv">
        <div><b>Mã đơn hàng:</b> #${report.orderId || "—"}</div>
        <div><b>Trạng thái:</b> ${translateHandoverStatus(report.status)}</div>
        ${
          isCheckin
            ? `<div><b>Thời gian thu hồi:</b> ${formatHandoverDateTime(report.handoverDateTime)}</div>
               <div><b>Địa điểm thu hồi:</b> ${report.handoverLocation || "—"}</div>`
            : `<div><b>Thời gian bàn giao:</b> ${formatHandoverDateTime(report.handoverDateTime)}</div>
               <div><b>Địa điểm bàn giao:</b> ${report.handoverLocation || "—"}</div>`
        }
      </section>

      <h3>Thông tin khách hàng</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${customerName}</div>
        ${customerInfo.phone ? `<div><b>Số điện thoại:</b> ${customerInfo.phone}</div>` : ""}
        ${customerInfo.email ? `<div><b>Email:</b> ${customerInfo.email}</div>` : ""}
      </section>

      <h3>Kỹ thuật viên tham gia</h3>
      <section class="kv">
        ${
          technicianEntries.length
            ? technicianEntries
                .map(
                  (tech) => `
      <div style="margin-bottom:6px">
        <b>${tech.name || "—"}</b>
        ${
          tech.phone
            ? `<br/><span>Số điện thoại: ${tech.phone}</span>`
            : ""
        }
        ${
          tech.email
            ? `<br/><span>Email: ${tech.email}</span>`
            : ""
        }
      </div>
    `
                )
                .join("")
            : `
      <div><b>Họ và tên:</b> ${technicianInfo.name || "—"}</div>
      ${
        technicianInfo.phone
          ? `<div><b>Số điện thoại:</b> ${technicianInfo.phone}</div>`
          : ""
      }
      ${
        technicianInfo.email
          ? `<div><b>Email:</b> ${technicianInfo.email}</div>`
          : ""
      }
    `
        }
      </section>

      <h3>Danh sách thiết bị ${isCheckin ? "thu hồi" : "bàn giao"}</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Tên thiết bị</th>
            <th>Mã thiết bị (Serial Number)</th>
            <th style="width:80px">Đơn vị</th>
            <th style="width:80px;text-align:center">SL đặt</th>
            <th style="width:80px;text-align:center">SL giao</th>
            <th>Điều kiện</th>
            <th>Ảnh bằng chứng</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || "<tr><td colspan='8' style='text-align:center'>Không có thiết bị</td></tr>"}
        </tbody>
      </table>

      ${
        isCheckin && (report.discrepancies || []).length > 0
          ? `
      <h3>Sự cố/Chênh lệch (Discrepancies)</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Loại sự cố</th>
            <th>Thiết bị (Serial Number)</th>
            <th>Điều kiện</th>
            <th>Phí phạt</th>
            <th>Ghi chú nhân viên</th>
            <th>Ghi chú khách hàng</th>
          </tr>
        </thead>
        <tbody>
          ${(report.discrepancies || []).map((disc, idx) => {
            // Try to get serial number from deviceId
            let deviceSerial = "—";
            if (disc.deviceId && order && Array.isArray(order.orderDetails)) {
              for (const od of order.orderDetails) {
                if (od.allocations && Array.isArray(od.allocations)) {
                  for (const allocation of od.allocations) {
                    const deviceId = allocation.device?.deviceId || allocation.deviceId;
                    if (deviceId === disc.deviceId) {
                      deviceSerial = allocation.device?.serialNumber || allocation.serialNumber || "—";
                      break;
                    }
                  }
                  if (deviceSerial && deviceSerial !== "—") break;
                }
              }
            }
            
            const conditionDef = conditionMap[disc.conditionDefinitionId];
            const conditionName = conditionDef?.name || disc.conditionName || `Điều kiện #${disc.conditionDefinitionId}`;
            const discrepancyType = disc.discrepancyType === "DAMAGE" ? "Hư hỏng" : 
                                   disc.discrepancyType === "LOSS" ? "Mất mát" : 
                                   disc.discrepancyType === "OTHER" ? "Khác" : disc.discrepancyType || "—";
            const penaltyAmount = disc.penaltyAmount != null ? fmtVND(disc.penaltyAmount) : "—";
            
            return `
              <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${discrepancyType}</td>
                <td>${deviceSerial}</td>
                <td>${conditionName}</td>
                <td style="text-align:right;font-weight:600">${penaltyAmount}</td>
                <td>${disc.staffNote || "—"}</td>
                <td>${disc.customerNote || "—"}</td>
              </tr>
            `;
          }).join("") || "<tr><td colspan='7' style='text-align:center'>Không có sự cố nào</td></tr>"}
        </tbody>
      </table>
      `
          : ""
      }

      ${
        report.createdByStaff
          ? `
      <h3>Người tạo biên bản</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${
          report.createdByStaff.fullName ||
          report.createdByStaff.username ||
          `Nhân viên #${report.createdByStaff.staffId}`
        }</div>
        ${
          report.createdByStaff.email
            ? `<div><b>Email:</b> ${report.createdByStaff.email}</div>`
            : ""
        }
        ${
          report.createdByStaff.phoneNumber
            ? `<div><b>Số điện thoại:</b> ${report.createdByStaff.phoneNumber}</div>`
            : ""
        }
        ${
          report.createdByStaff.role
            ? `<div><b>Vai trò:</b> ${translateStaffRole(report.createdByStaff.role)}</div>`
            : ""
        }
      </section>`
          : ""
      }

      ${
        (report.evidenceUrls || []).length
          ? `
      <h3>Ảnh bằng chứng</h3>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:12px 0">
        ${report.evidenceUrls
          .map(
            (url, idx) => `
            <div style="flex:0 0 auto;margin-bottom:8px">
              <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#333">
                Bằng chứng ${idx + 1}
              </div>
              <img
                src="${url}"
                alt="Bằng chứng ${idx + 1}"
                style="max-width:180px;max-height:120px;border:1px solid #ddd;border-radius:4px;object-fit:contain"
                onerror="this.style.display='none';"
              />
            </div>
          `
          )
          .join("")}
      </div>
      `
          : ""
      }
      
      <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
        <div style="flex:1;text-align:center">
          <div><b>KHÁCH HÀNG</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${report.customerSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}
          </div>
          <div>
            ${report.customerSigned 
              ? `<div style="color:#000;font-weight:600">${customerName}</div>` 
              : "(Ký, ghi rõ họ tên)"}
          </div>
        </div>
        <div style="flex:1;text-align:center">
          <div><b>NHÂN VIÊN</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${report.staffSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}
          </div>
          <div>
            ${report.staffSigned 
              ? `<div style="color:#000;font-weight:600">${technicianDisplayName}</div>` 
              : "(Ký, ghi rõ họ tên)"}
          </div>
        </div>
      </section>
    </div>
  `;
}

export default function OperatorOrders() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kw, setKw] = useState("");
  const [range, setRange] = useState(null);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

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
  const [handoverPdfModalOpen, setHandoverPdfModalOpen] = useState(false);
  const [handoverPdfBlobUrl, setHandoverPdfBlobUrl] = useState("");
  const [handoverPdfGenerating, setHandoverPdfGenerating] = useState(false);
  const [selectedHandoverReport, setSelectedHandoverReport] = useState(null);
  const handoverPrintRef = useRef(null);

  // Handover report detail (tương tự contract detail)
  const [handoverReportDetail, setHandoverReportDetail] = useState(null);
  const [handoverReportDetailOpen, setHandoverReportDetailOpen] = useState(false);
  const [loadingHandoverReportDetail, setLoadingHandoverReportDetail] = useState(false);
  const [handoverReportPdfPreviewUrl, setHandoverReportPdfPreviewUrl] = useState("");

  const [orderDetailModels, setOrderDetailModels] = useState({});
  const [orderDetailMetaLoading, setOrderDetailMetaLoading] = useState(false);
  const [detailHasPreRentalQc, setDetailHasPreRentalQc] = useState(null); // PRE_RENTAL QC tồn tại?
  const [creatingAnnex, setCreatingAnnex] = useState(false); // Loading state for creating annex
  const [orderAnnexes, setOrderAnnexes] = useState([]); // List of annexes
  const [annexesLoading, setAnnexesLoading] = useState(false);
  const [annexDetail, setAnnexDetail] = useState(null); // Selected annex for detail view
  const [annexDetailOpen, setAnnexDetailOpen] = useState(false);
  const [annexPdfBlobUrl, setAnnexPdfBlobUrl] = useState(""); // Annex PDF blob URL
  const [annexPdfGenerating, setAnnexPdfGenerating] = useState(false);
  const annexPrintRef = useRef(null);

  // Always load device model metadata for all order statuses
  const shouldLoadOrderItemMeta = useMemo(() => {
    return detail != null; // Load metadata whenever we have order details
  }, [detail]);

  // Khi chọn 1 đơn trong drawer, kiểm tra xem đã có QC PRE_RENTAL chưa để quyết định hiển thị nút Tạo hợp đồng
  useEffect(() => {
    const orderId = detail?.orderId;
    if (!orderId) {
      setDetailHasPreRentalQc(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const qcReports = await getQcReportsByOrderId(orderId);
        const hasPreRental =
          Array.isArray(qcReports) &&
          qcReports.some(
            (rep) => String(rep.phase || "").toUpperCase() === "PRE_RENTAL"
          );
        if (!cancelled) {
          setDetailHasPreRentalQc(hasPreRental);
        }
      } catch (e) {
        console.warn("Không thể kiểm tra QC PRE_RENTAL cho đơn", orderId, e);
        if (!cancelled) {
          setDetailHasPreRentalQc(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detail?.orderId]);

  /**
   * Hàm tải danh sách đơn hàng với phân trang
   * Được gọi khi: Component mount, chuyển trang, thay đổi pageSize, tìm kiếm
   * @param {number} page - Số trang (1-indexed, mặc định 1)
   * @param {number} pageSize - Số đơn mỗi trang (mặc định 10)
   * @param {number} [orderId] - Mã đơn hàng để filter (optional)
   */
  const fetchAll = async (page = 1, pageSize = 10, orderId = null) => {
    // Đảm bảo giá trị page và pageSize là số nguyên hợp lệ
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeSize = Math.max(1, parseInt(pageSize, 10) || 10);
    
    try {
      // Bật loading spinner cho Table
      setLoading(true);
      
      // ========== GỌI API TÌM KIẾM ĐƠN HÀNG ==========
      // API: GET /api/rental-orders/search?page=X&size=Y&sort=createdAt,desc&orderId=Z
      // Trả về: { content: [], totalElements, totalPages, number, size }
      const result = await searchRentalOrders({
        page: safePage - 1, // API dùng 0-indexed (page 0 = trang 1)
        size: safeSize,
        sort: ["createdAt,desc"], // Sắp xếp mới nhất lên đầu
        orderId: orderId != null ? Number(orderId) : undefined,
      });
      
      // Lưu danh sách đơn vào state để hiển thị
      setRows(result.content);
      
      // Cập nhật thông tin phân trang cho Table
      setPagination({
        current: safePage,
        pageSize: safeSize,
        total: result.totalElements, // Tổng số đơn (dùng để tính số trang)
      });
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không tải được danh sách đơn."
      );
    } finally {
      // Tắt loading spinner
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(1, 10);
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

  // ====== ACTIONS (CÁC HÀNH ĐỘNG CHÍNH) ======
  
  /**
   * Hàm xóa/hủy đơn hàng
   * Được gọi khi operator click nút "Xóa" trong cột Thao tác
   * @param {Object} r - Đối tượng đơn hàng cần xóa
   */
  const doDelete = async (r) => {
    try {
      // ========== GỌI API XÓA ĐƠN ==========
      // API: DELETE /api/rental-orders/{orderId}
      // Trả về: success message hoặc lỗi
      await deleteRentalOrder(r.orderId);
      
      message.success(`Đã huỷ đơn #${r.orderId}`);
      
      // Xóa đơn khỏi danh sách local (không cần fetch lại)
      setRows((prev) => prev.filter((x) => x.orderId !== r.orderId));
      
      // Nếu đang xem chi tiết đơn này → đóng Drawer
      if (detail?.orderId === r.orderId) {
        setOpen(false);
        setDetail(null);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không huỷ được đơn.");
    }
  };

  /**
   * Hàm tạo hợp đồng từ đơn hàng
   * Được gọi khi operator click nút "Tạo hợp đồng" trong Drawer
   * Điều kiện: Đơn phải ở trạng thái PROCESSING và đã có QC report PRE_RENTAL
   * @param {Object} r - Đối tượng đơn hàng
   */
  const doCreateContract = async (r) => {
    // Kiểm tra trạng thái đơn hàng
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
      // ========== BƯỚC 1: KIỂM TRA QC REPORT ==========
      // API: GET /api/qc-reports/order/{orderId}
      // Phải có ít nhất 1 report với phase = PRE_RENTAL
      let hasPreRentalQc = false;
      try {
        const qcReports = await getQcReportsByOrderId(r.orderId);
        if (Array.isArray(qcReports) && qcReports.length > 0) {
          hasPreRentalQc = qcReports.some(
            (rep) => String(rep.phase || "").toUpperCase() === "PRE_RENTAL"
          );
        }
      } catch (qcError) {
        // Nếu gọi API lỗi, coi như chưa có QC
        console.error("Không thể kiểm tra QC report cho đơn", r.orderId, qcError);
        hasPreRentalQc = false;
      }

      if (!hasPreRentalQc) {
        message.error(
          "Chưa có báo cáo QC trước thuê (PRE_RENTAL) cho đơn này. Vui lòng hoàn tất Pre rental QC trước khi tạo hợp đồng."
        );
        return;
      }

      // ========== BƯỚC 2: TẠO HỢP ĐỒNG ==========
      // API: POST /api/contracts/from-order/{orderId}
      // Trả về: contractId, contractContent, status...
      const response = await createContractFromOrder(r.orderId);
      const contract = response?.data || response;
      message.success(
        `Đã tạo hợp đồng #${contract?.contractId || contract?.id} từ đơn #${r.orderId}`
      );
      
      // Reload danh sách hợp đồng để hiển thị hợp đồng mới
      if (detail?.orderId) {
        fetchOrderContracts(detail.orderId, detail?.customerId);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tạo được hợp đồng.");
    }
  };

  /**
   * Hàm xem chi tiết đơn hàng
   * Được gọi khi operator click nút "Xem" trên 1 đơn trong bảng
   * Luồng: Load đơn → Load invoice → Load khách hàng → Load KYC → Load hợp đồng → Load biên bản
   * @param {number} orderId - ID của đơn hàng cần xem
   */
  const viewDetail = async (orderId) => {
    try {
      // ========== BƯỚC 1: KHỞI TẠO ==========
      // Bật loading spinner trong Drawer
      setLoadingDetail(true);
      // Reset invoice cũ để tránh hiển thị dữ liệu cũ
      setInvoiceInfo(null);
      
      // ========== BƯỚC 2: LẤY CHI TIẾT ĐƠN HÀNG ==========
      // API: GET /api/rental-orders/{orderId}
      // Trả về: orderId, orderStatus, startDate, endDate, orderDetails[], customerId...
      const d = await getRentalOrderById(orderId);
      // Lưu vào state để hiển thị trong Drawer
      setDetail(d || null);
      
      // ========== BƯỚC 3: LẤY THÔNG TIN HÓA ĐƠN/THANH TOÁN ==========
      // API: GET /api/invoices/rental-order/{orderId}
      // Trả về: invoiceId, invoiceStatus (PENDING/SUCCEEDED/FAILED), amount...
      // Dùng để xác định "Đã thanh toán" hay "Chưa thanh toán"
      try {
        const invoice = await getInvoiceByRentalOrderId(orderId);
        setInvoiceInfo(invoice || null);
      } catch {
        // Đơn chưa thanh toán sẽ không có invoice → bỏ qua lỗi
        console.log("No invoice found for order:", orderId);
        setInvoiceInfo(null);
      }
      
      // ========== BƯỚC 4: LẤY THÔNG TIN KHÁCH HÀNG ==========
      // Chỉ load nếu đơn có liên kết với khách hàng
      if (d?.customerId) {
        try {
          // API: GET /api/customers/{customerId}
          // Trả về: fullName, email, phoneNumber, address...
          const c = await fetchCustomerById(d.customerId);
          setCustomer(c || null);
          
          // ========== BƯỚC 5: LẤY THÔNG TIN KYC ==========
          try {
            // API: GET /api/kyc/customer/{customerId}
            // Trả về: kycId, kycStatus, frontUrl (CCCD mặt trước), backUrl, selfieUrl...
            const kyc = await getKycByCustomerId(d.customerId);
            // Chuẩn hóa dữ liệu KYC để format đồng nhất
            const normalized = normalizeKycItem(kyc || {});
            console.log("KYC raw:", kyc);
            console.log("KYC normalized:", normalized);
            console.log("Front URL:", normalized.frontUrl);
            console.log("Back URL:", normalized.backUrl);
            console.log("Selfie URL:", normalized.selfieUrl);
            setKycInfo(normalized);
            
            // Kiểm tra nếu khách vừa submit KYC → tự động mở modal duyệt
            const st = String(normalized?.kycStatus || normalized?.status || "").toUpperCase();
            if (st === "DOCUMENTS_SUBMITTED" || st === "SUBMITTED") {
              // Mở modal để operator duyệt KYC ngay
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
        // Đơn không có customerId → clear state
        setCustomer(null);
        setKycInfo(null);
      }
      
      // ========== BƯỚC 6: LẤY DANH SÁCH HỢP ĐỒNG ==========
      // Gọi hàm riêng để load contracts của đơn này
      // API: GET /api/contracts/order/{orderId}
      await fetchOrderContracts(orderId, d?.customerId);
      
      // ========== BƯỚC 7: LẤY BIÊN BẢN BÀN GIAO ==========
      // Gọi hàm riêng để load handover reports
      // API: GET /api/handover-reports/order/{orderId}
      await fetchHandoverReports(orderId);
      
    } catch (e) {
      // Lỗi chính (load đơn thất bại) → hiển thị thông báo
      message.error(e?.response?.data?.message || e?.message || "Không tải chi tiết đơn.");
    } finally {
      // Tắt loading spinner dù thành công hay thất bại
      setLoadingDetail(false);
    }
  };

  /**
   * Hàm tải danh sách hợp đồng của đơn hàng
   * Được gọi trong viewDetail và sau khi tạo/cập nhật hợp đồng
   * @param {number} orderId - ID đơn hàng
   * @param {number} customerId - ID khách hàng (dùng làm fallback)
   */
  const fetchOrderContracts = async (orderId, customerId) => {
    try {
      setContractsLoading(true);
      let contracts = [];
      
      try {
        // ========== CÁCH 1: LẤY HỢP ĐỒNG THEO ĐƠN HÀNG ==========
        // API: GET /api/contracts/order/{orderId}
        // Trả về: danh sách contracts của đơn này
        const orderContracts = await listContractsByOrder(orderId);
        contracts = Array.isArray(orderContracts)
          ? orderContracts.map(normalizeContract) // Chuẩn hóa dữ liệu
          : [];
      } catch {
        // ========== FALLBACK: LẤY THEO KHÁCH HÀNG ==========
        // Nếu API trên lỗi, thử lấy theo customerId rồi filter
        if (customerId) {
          // API: GET /api/contracts/customer/{customerId}
          const customerContracts = await listContractsByCustomer(customerId);
          const normalized = Array.isArray(customerContracts)
            ? customerContracts.map(normalizeContract)
            : [];
          // Lọc chỉ lấy hợp đồng của đơn này
          contracts = normalized.filter((contract) => contract.orderId === orderId);
        }
      }
      
      // Lưu vào state để hiển thị trong tab Hợp đồng
      setOrderContracts(contracts);
    } catch (e) {
      console.error("Failed to fetch order contracts:", e);
      setOrderContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  /**
   * Hàm tải danh sách biên bản bàn giao/thu hồi của đơn
   * Được gọi trong viewDetail
   * @param {number} orderId - ID đơn hàng
   */
  const fetchHandoverReports = async (orderId) => {
    // Không có orderId → không làm gì
    if (!orderId) {
      setHandoverReports([]);
      return;
    }
    try {
      setHandoverLoading(true);
      
      // ========== GỌI API LẤY BIÊN BẢN BÀN GIAO ==========
      // API: GET /api/handover-reports/order/{orderId}
      // Trả về: danh sách handover reports (có thể bao gồm CHECKOUT và CHECKIN)
      const reports = await getHandoverReportsByOrderId(orderId);
      
      // Lưu vào state để hiển thị trong tab Biên bản
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

  /**
   * Hàm tạo phụ lục gia hạn từ extension
   * @param {number} extensionId - ID của extension (gia hạn)
   */
  const handleCreateAnnexFromExtension = async (extensionId) => {
    // Tìm contractId từ orderContracts (lấy contract ACTIVE hoặc SIGNED đầu tiên)
    const activeContract = orderContracts.find((c) => {
      const status = String(c.status || "").toUpperCase();
      return status === "ACTIVE" || status === "SIGNED";
    });
    
    if (!activeContract) {
      message.warning("Không tìm thấy hợp đồng đang hoạt động để tạo phụ lục. Vui lòng đảm bảo hợp đồng đã được ký.");
      return;
    }
    
    const contractId = activeContract.id || activeContract.contractId;
    
    try {
      setCreatingAnnex(true);
      const annex = await createAnnexFromExtension(contractId, extensionId);
      message.success(`Đã tạo phụ lục gia hạn #${annex?.annexId || annex?.id} thành công!`);
      
      // Reload contracts list
      if (detail?.orderId && detail?.customerId) {
        try {
          const contracts = await listContractsByOrder(detail.orderId);
          const normalized = Array.isArray(contracts) ? contracts.map(normalizeContract) : [];
          setOrderContracts(normalized);
        } catch (e) {
          console.error("Failed to reload contracts:", e);
        }
      }
      
      // Reload annexes list
      await fetchOrderAnnexes(contractId);
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không thể tạo phụ lục gia hạn"
      );
    } finally {
      setCreatingAnnex(false);
    }
  };

  /**
   * Hàm lấy danh sách phụ lục của hợp đồng
   * @param {number} contractId - ID của hợp đồng
   */
  const fetchOrderAnnexes = async (contractId) => {
    if (!contractId) {
      setOrderAnnexes([]);
      return;
    }
    try {
      setAnnexesLoading(true);
      const annexes = await getAnnexesByContractId(contractId);
      setOrderAnnexes(Array.isArray(annexes) ? annexes : []);
    } catch (e) {
      console.error("Failed to fetch annexes:", e);
      setOrderAnnexes([]);
    } finally {
      setAnnexesLoading(false);
    }
  };

  // Auto-fetch annexes when orderContracts changes
  useEffect(() => {
    const activeContract = orderContracts.find((c) => {
      const status = String(c.status || "").toUpperCase();
      return status === "ACTIVE" || status === "SIGNED";
    });
    if (activeContract) {
      const contractId = activeContract.id || activeContract.contractId;
      fetchOrderAnnexes(contractId);
    } else {
      setOrderAnnexes([]);
    }
  }, [orderContracts]);

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
    let contentHtml = sanitizeContractHtml(detail.contentHtml || "");
    
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
            <div><b>ĐẠI DIỆN BÊN B</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "ACTIVE") {
                  return '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>';
                }
                return "";
              })()}
            </div>
            <div>
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "ACTIVE") {
                  return `<div style="color:#000;font-weight:600">${customerName}</div>`;
                }
                return "(Ký, ghi rõ họ tên)";
              })()}
            </div>
          </div>
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN A</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "PENDING_SIGNATURE" || status === "ACTIVE") {
                  return '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>';
                }
                return "";
              })()}
            </div>
            <div>
              ${(() => {
                const status = String(detail.status || "").toUpperCase();
                if (status === "PENDING_SIGNATURE" || status === "ACTIVE") {
                  return '<div style="color:#000;font-weight:600">CÔNG TY TECHRENT</div>';
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

  async function previewContractAsPdf(detailOverride = null, options = {}) {
    const { openModal = true } = options || {};
    const detailToUse = detailOverride || contractDetail;
    if (!detailToUse) return message.warning("Chưa có dữ liệu hợp đồng.");
    try {
      setPdfGenerating(true);
      revokeBlob(pdfBlobUrl);

      let customerData = contractCustomer;
      let kycData = contractKyc;

      if (detailToUse?.customerId) {
        if (!customerData) {
          try {
            const c = await fetchCustomerById(detailToUse.customerId);
            customerData = normalizeCustomer(c || {});
            setContractCustomer(customerData);
          } catch (e) {
            console.error("Failed to fetch customer profile:", e);
          }
        }

        if (!kycData) {
          try {
            kycData = await getKycByCustomerId(detailToUse.customerId);
            setContractKyc(kycData);
          } catch (e) {
            console.error("Failed to fetch KYC data:", e);
          }
        }
      }

      if (printRef.current) {
        const augmented = augmentContractContent(detailToUse);
        printRef.current.innerHTML = buildPrintableHtml(
          augmented,
          customerData,
          kycData
        );
        const blob = await elementToPdfBlob(printRef.current);
        const url = URL.createObjectURL(blob);
        // Lưu URL blob cho cả modal xem trước và iframe trong modal chi tiết
        setPdfBlobUrl(url);
        setPdfPreviewUrl(url);
        if (openModal) {
          setPdfModalOpen(true);
        }
      }
    } catch (e) {
      console.error(e);
      message.error("Không tạo được bản xem trước PDF.");
    } finally {
      setPdfGenerating(false);
    }
  }

  /**
   * Format annexContent text - convert ISO dates and money values
   */
  function formatAnnexContent(content) {
    if (!content) return "";
    
    let formatted = content;
    
    // Format ISO datetime strings (e.g., 2025-12-15T22:44:33.727913 -> 15/12/2025 22:44)
    formatted = formatted.replace(
      /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?/g,
      (match, year, month, day, hour, minute) => `${day}/${month}/${year} ${hour}:${minute}`
    );
    
    // Format money values (e.g., 250000.00 VND -> 250.000 VNĐ)
    formatted = formatted.replace(
      /(\d+)(\.\d{2})?\s*VND/g,
      (match, amount) => {
        const num = parseInt(amount, 10);
        return num.toLocaleString("vi-VN") + " VNĐ";
      }
    );
    
    return formatted;
  }

  /**
   * Build printable HTML for Annex (Phụ lục gia hạn)
   */
  function buildPrintableAnnexHtml(annex, customer = null) {
    if (!annex) return "<div>Không có dữ liệu phụ lục</div>";
    
    const title = annex.title || "PHỤ LỤC GIA HẠN HỢP ĐỒNG THUÊ THIẾT BỊ";
    const annexNumber = annex.annexNumber || "";
    const contractNumber = annex.contractNumber || "";
    const customerName = customer?.fullName || customer?.name || `Khách hàng #${annex.originalOrderId || ""}`;
    
    // Format dates
    const fmtDate = (d) => d ? dayjs(d).format("DD/MM/YYYY HH:mm") : "—";
    const fmtMoney = (v) => fmtVND(v || 0);
    
    // Signature sections
    const adminSigned = !!annex.adminSignedAt;
    const customerSigned = !!annex.customerSignedAt;
    
    return `
      <div style="
        width:794px;margin:0 auto;background:#fff;color:#111;
        font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;
        padding:32px 40px;box-sizing:border-box;">
        ${GLOBAL_PRINT_CSS}
        ${NATIONAL_HEADER_HTML}

        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:20px;font-weight:700;letter-spacing:.5px">${title}</div>
          <div style="color:#666;margin-top:4px">Số: ${annexNumber}</div>
        </div>
        <hr style="border:none;border-top:1px solid #e8e8e8;margin:12px 0 16px"/>

        <section class="kv">
          <div><b>Căn cứ hợp đồng số:</b> ${contractNumber}</div>
          <div><b>Đơn hàng:</b> #${annex.originalOrderId || "—"}</div>
          <div><b>Bên A (Bên cho thuê):</b> CÔNG TY TECHRENT</div>
          <div><b>Bên B (Khách hàng):</b> ${customerName}</div>
        </section>

        <section style="margin:16px 0">
          <h3 style="font-size:14px;margin:12px 0 8px;text-transform:uppercase">Nội dung gia hạn</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr>
              <td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5;width:40%"><b>Thời gian gia hạn</b></td>
              <td style="padding:6px 8px;border:1px solid #ddd">${fmtDate(annex.extensionStartDate)} → ${fmtDate(annex.extensionEndDate)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5"><b>Số ngày gia hạn</b></td>
              <td style="padding:6px 8px;border:1px solid #ddd">${annex.extensionDays || 0} ngày</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5"><b>Phí gia hạn</b></td>
              <td style="padding:6px 8px;border:1px solid #ddd">${fmtMoney(annex.extensionFee)}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5"><b>Tổng thanh toán</b></td>
              <td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;color:#1890ff">${fmtMoney(annex.extensionFee)}</td>
            </tr>
          </table>
        </section>

        ${annex.annexContent ? `
        <section style="margin:16px 0">
          <h3 style="font-size:14px;margin:12px 0 8px;text-transform:uppercase">Điều khoản phụ lục</h3>
          <div style="background:#fafafa;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:12px;line-height:1.7">
            ${formatAnnexContent(annex.annexContent)}
          </div>
        </section>
        ` : ""}

        ${annex.legalReference ? `
        <div style="margin-top:12px;font-size:11px;color:#666;font-style:italic">
          ${annex.legalReference}
        </div>
        ` : ""}

        <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN B</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
              ${customerSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}
            </div>
            <div>
              ${customerSigned ? `<div style="color:#000;font-weight:600">${customerName}</div>` : "(Ký, ghi rõ họ tên)"}
            </div>

          </div>
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN A</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
              ${adminSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}
            </div>
            <div>
              ${adminSigned ? '<div style="color:#000;font-weight:600">CÔNG TY TECHRENT</div>' : "(Ký, ghi rõ họ tên)"}
            </div>

          </div>
        </section>

      </div>
    `;
  }

  /**
   * Preview Annex as PDF
   */
  async function previewAnnexAsPdf(annex) {
    if (!annex) return message.warning("Chưa có dữ liệu phụ lục.");
    try {
      setAnnexPdfGenerating(true);
      revokeBlob(annexPdfBlobUrl);

      // Try to get customer data if available
      let customerData = customer;
      
      // Create temporary visible element for html2canvas
      const tempContainer = document.createElement("div");
      tempContainer.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;";
      tempContainer.innerHTML = buildPrintableAnnexHtml(annex, customerData);
      document.body.appendChild(tempContainer);
      
      try {
        const blob = await elementToPdfBlob(tempContainer);
        const url = URL.createObjectURL(blob);
        setAnnexPdfBlobUrl(url);
      } finally {
        document.body.removeChild(tempContainer);
      }
    } catch (e) {
      console.error(e);
      message.error("Không tạo được bản xem trước PDF phụ lục.");
    } finally {
      setAnnexPdfGenerating(false);
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

  const buildOrderWithModels = async (orderId) => {
    if (!orderId) return null;
    try {
      let orderData = await getRentalOrderById(orderId);
      if (orderData && Array.isArray(orderData.orderDetails) && orderData.orderDetails.length) {
        const modelIds = Array.from(
          new Set(orderData.orderDetails.map((od) => od.deviceModelId).filter(Boolean))
        );
        const modelPairs = await Promise.all(
          modelIds.map(async (id) => {
            try {
              const m = await getDeviceModelById(id);
              return [id, normalizeDeviceModel(m)];
            } catch {
              return [id, null];
            }
          })
        );
        const modelMap = Object.fromEntries(modelPairs);
        orderData = {
          ...orderData,
          orderDetails: orderData.orderDetails.map((od) => ({
            ...od,
            deviceModel: modelMap[od.deviceModelId] || null,
          })),
        };
      }
      return orderData;
    } catch {
      return null;
    }
  };

  const previewHandoverReportAsPdf = async (report, options = {}) => {
    const { openModal = true } = options || {};
    if (!report) return message.warning("Không có biên bản để xem.");
    try {
      setHandoverPdfGenerating(true);
      setSelectedHandoverReport(report);
      revokeBlob(handoverPdfBlobUrl);

      const orderData = report.orderId ? await buildOrderWithModels(report.orderId) : null;
      let conditionDefinitions = [];
      try {
        conditionDefinitions = await getConditionDefinitions();
      } catch {
        conditionDefinitions = [];
      }

      if (handoverPrintRef.current) {
        handoverPrintRef.current.style.visibility = "visible";
        handoverPrintRef.current.style.opacity = "1";
        handoverPrintRef.current.innerHTML = buildPrintableHandoverReportHtml(
          report,
          orderData,
          conditionDefinitions
        );

        await new Promise((resolve) => setTimeout(resolve, 200));
        const blob = await elementToPdfBlob(handoverPrintRef.current);

        handoverPrintRef.current.style.visibility = "hidden";
        handoverPrintRef.current.style.opacity = "0";
        handoverPrintRef.current.innerHTML = "";

        const url = URL.createObjectURL(blob);
        setHandoverPdfBlobUrl(url);
        // Lưu URL cho cả modal xem trước và iframe trong modal chi tiết
        setHandoverReportPdfPreviewUrl(url);
        if (openModal) {
          setHandoverPdfModalOpen(true);
        }
      }
    } catch (e) {
      console.error("Preview handover PDF error:", e);
      message.error("Không thể tạo bản xem trước biên bản.");
    } finally {
      setHandoverPdfGenerating(false);
    }
  };

  const downloadHandoverReportAsPdf = async (report) => {
    if (!report) return;
    try {
      setHandoverPdfGenerating(true);
      revokeBlob(handoverPdfBlobUrl);

      const orderData = report.orderId ? await buildOrderWithModels(report.orderId) : null;
      let conditionDefinitions = [];
      try {
        conditionDefinitions = await getConditionDefinitions();
      } catch {
        conditionDefinitions = [];
      }

      if (handoverPrintRef.current) {
        handoverPrintRef.current.style.visibility = "visible";
        handoverPrintRef.current.style.opacity = "1";
        handoverPrintRef.current.innerHTML = buildPrintableHandoverReportHtml(
          report,
          orderData,
          conditionDefinitions
        );

        await new Promise((resolve) => setTimeout(resolve, 200));
        const blob = await elementToPdfBlob(handoverPrintRef.current);

        handoverPrintRef.current.style.visibility = "hidden";
        handoverPrintRef.current.style.opacity = "0";
        handoverPrintRef.current.innerHTML = "";

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `handover-report-${report.handoverReportId || report.id || "report"}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
      }
    } catch (e) {
      console.error("Download handover PDF error:", e);
      message.error("Không thể tải biên bản.");
    } finally {
      setHandoverPdfGenerating(false);
    }
  };

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

      // Nếu BE không trả về contractUrl, tự động generate PDF cho phần xem hợp đồng
      if (!normalized?.contractUrl) {
        // Không mở thêm modal "Xem trước", chỉ render để iframe trong modal chi tiết hiển thị
        await previewContractAsPdf(normalized, { openModal: false });
      }
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không tải được chi tiết hợp đồng."
      );
    } finally {
      setLoadingContractDetail(false);
    }
  };

  const viewHandoverReportDetail = async (report) => {
    try {
      setLoadingHandoverReportDetail(true);
      // Clear previous state
      setHandoverReportPdfPreviewUrl("");
      revokeBlob(handoverPdfBlobUrl);
      setHandoverPdfBlobUrl("");

      // Set report detail
      setHandoverReportDetail(report);
      
      // Nếu report có URL từ BE, set vào preview URL
      if (report?.reportUrl || report?.pdfUrl || report?.url) {
        setHandoverReportPdfPreviewUrl(report.reportUrl || report.pdfUrl || report.url);
      }

      setHandoverReportDetailOpen(true);

      // Nếu BE không trả về URL, tự động generate PDF cho phần xem biên bản
      if (!(report?.reportUrl || report?.pdfUrl || report?.url)) {
        // Không mở thêm modal "Xem trước", chỉ render để iframe trong modal chi tiết hiển thị
        await previewHandoverReportAsPdf(report, { openModal: false });
      }
    } catch (e) {
      message.error(
        e?.response?.data?.message || e?.message || "Không tải được chi tiết biên bản."
      );
    } finally {
      setLoadingHandoverReportDetail(false);
    }
  };

  /**
   * Hàm gửi hợp đồng cho khách hàng ký
   * Được gọi khi operator click nút "Gửi cho khách ký" trong modal chi tiết HĐ
   * @param {number} contractId - ID hợp đồng cần gửi
   */
  const doSendForSignature = async (contractId) => {
    try {
      setSendingForSignature(true);
      
      // ========== BƯỚC 1: GỬI YÊU CẦU KÝ HĐ ==========
      // API: POST /api/contracts/{contractId}/send-for-signature
      // Gửi email/notification cho khách hàng để ký
      await sendContractForSignature(contractId);
      message.success("Đã gửi hợp đồng cho khách hàng ký!");

      // ========== BƯỚC 2: LOAD LẠI CHI TIẾT HĐ ==========
      // API: GET /api/contracts/{contractId}
      // Để cập nhật status mới (PENDING_SIGNATURE)
      const updatedContract = await getContractById(contractId);
      const normalized = normalizeContract(updatedContract);
      setContractDetail(normalized);

      // Reload danh sách hợp đồng trong Drawer
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
  // Khi search bằng orderId (số hợp lệ), kết quả đã được filter từ API
  // nên chỉ cần filter frontend cho các trường hợp khác (date range)
  const filtered = useMemo(() => {
    let ds = rows;
    
    // Nếu kw là số (orderId), API đã filter rồi -> không filter frontend theo kw
    const isOrderIdSearch = kw.trim() && !isNaN(Number(kw.trim()));
    
    if (!isOrderIdSearch && kw.trim()) {
      // Filter theo text (customerId) nếu không phải search orderId
      const k = kw.trim().toLowerCase();
      ds = ds.filter(
        (r) =>
          String(r.orderId).toLowerCase().includes(k) ||
          String(r.customerId ?? "").toLowerCase().includes(k)
      );
    }
    
    // Filter theo date range (frontend)
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
        `${dayjs(r.planStartDate || r.startDate).format("YYYY-MM-DD")} → ${dayjs(r.planEndDate || r.endDate).format(
          "YYYY-MM-DD"
        )}`,
    },
    {
      title: "Số ngày",
      dataIndex: "days",
      width: 90,
      render: (_, r) => {
        const d =
          dayjs(r.planEndDate || r.endDate)
            .startOf("day")
            .diff(dayjs(r.planStartDate || r.startDate).startOf("day"), "day") || 1;
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

  const checkoutReports = useMemo(
    () =>
      handoverReports.filter(
        (report) => String(report.handoverType || "").toUpperCase() !== "CHECKIN"
      ),
    [handoverReports]
  );

  const checkinReports = useMemo(
    () =>
      handoverReports.filter(
        (report) => String(report.handoverType || "").toUpperCase() === "CHECKIN"
      ),
    [handoverReports]
  );

  const detailDays = useMemo(() => {
    if (!detail) return 1;
    // Sử dụng planStartDate/planEndDate để tính số ngày thuê
    const startDate = detail.planStartDate || detail.startDate;
    const endDate = detail.planEndDate || detail.endDate;
    if (!startDate || !endDate) return detail.durationDays || 1;
    const d =
      dayjs(endDate)
        .startOf("day")
        .diff(dayjs(startDate).startOf("day"), "day") || 1;
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

    // Reordered: Đơn giá/ngày -> Số ngày -> Tổng tiền thuê -> Cọc/1 SP -> Số lượng -> Tổng cọc
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

  // ========== KYC APPROVAL/REJECTION ==========
  
  /**
   * Hàm duyệt KYC của khách hàng
   * Được gọi khi operator click nút "Duyệt" trong modal KYC Review
   */
  const approveKycInline = async () => {
    if (!detail?.customerId) return;
    try {
      setKycUpdating(true);
      
      // ========== GỌI API CẬP NHẬT KYC STATUS ==========
      // API: PUT /api/kyc/customer/{customerId}/status
      // Body: { status: "VERIFIED", verifiedAt, verifiedBy }
      await updateKycStatus(detail.customerId, {
        status: "VERIFIED",
        verifiedAt: dayjs().toISOString(),
        verifiedBy: undefined, // Backend tự lấy từ token
      });
      message.success("Đã duyệt KYC");
      setKycReviewOpen(false);
      
      // Reload KYC info để cập nhật UI
      // API: GET /api/kyc/customer/{customerId}
      const kyc = await getKycByCustomerId(detail.customerId);
      const normalized = normalizeKycItem(kyc || {});
      setKycInfo(normalized);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Duyệt KYC thất bại");
    } finally {
      setKycUpdating(false);
    }
  };

  /**
   * Hàm từ chối KYC của khách hàng
   * Được gọi khi operator click nút "Từ chối" trong modal KYC Review
   * Bắt buộc phải nhập lý do từ chối
   */
  const rejectKycInline = async () => {
    if (!detail?.customerId) return;
    try {
      // Validate: phải có lý do từ chối
      if (!kycRejectReason.trim()) {
        return message.warning("Vui lòng nhập lý do từ chối");
      }
      setKycUpdating(true);
      
      // ========== GỌI API CẬP NHẬT KYC STATUS ==========
      // API: PUT /api/kyc/customer/{customerId}/status
      // Body: { status: "REJECTED", rejectionReason, verifiedAt, verifiedBy }
      await updateKycStatus(detail.customerId, {
        status: "REJECTED",
        rejectionReason: kycRejectReason.trim(),
        verifiedAt: dayjs().toISOString(),
        verifiedBy: undefined, // Backend tự lấy từ token
      });
      message.success("Đã từ chối KYC");
      setKycReviewOpen(false);
      setKycRejectReason(""); // Clear lý do sau khi xong
      
      // Reload KYC info để cập nhật UI
      // API: GET /api/kyc/customer/{customerId}
      const kyc = await getKycByCustomerId(detail.customerId);
      const normalized = normalizeKycItem(kyc || {});
      setKycInfo(normalized);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Từ chối KYC thất bại");
    } finally {
      setKycUpdating(false);
    }
  };

  const renderHandoverReportCards = (reports, isCheckin) => {
    if (!reports || reports.length === 0) {
      return (
        <Text type="secondary">
          Chưa có biên bản {isCheckin ? "thu hồi" : "bàn giao"} nào cho đơn này.
        </Text>
      );
    }

    const columns = [
      {
        title: "Mã biên bản",
        dataIndex: "handoverReportId",
        key: "handoverReportId",
        width: 100,
        render: (v, record) => <strong>#{v || record.id}</strong>,
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status) => {
          const color =
            status === "STAFF_SIGNED" || status === "BOTH_SIGNED"
              ? "green"
              : status === "CUSTOMER_SIGNED"
              ? "blue"
              : status === "PENDING_STAFF_SIGNATURE"
              ? "orange"
              : "orange";
          return (
            <Tag color={color}>{translateHandoverStatus(status)}</Tag>
          );
        },
      },
      {
        title: "Thời gian",
        dataIndex: "handoverDateTime",
        key: "handoverDateTime",
        width: 150,
        render: (v) => (v ? formatHandoverDateTime(v) : "—"),
      },
      {
        title: "Địa điểm",
        dataIndex: "handoverLocation",
        key: "handoverLocation",
        width: 200,
        render: (v) => v || "—",
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 200,
        render: (_, record) => {
          const loadingCurrent =
            (handoverPdfGenerating || loadingHandoverReportDetail) &&
            (selectedHandoverReport?.handoverReportId === record.handoverReportId ||
              selectedHandoverReport?.id === record.id ||
              handoverReportDetail?.handoverReportId === record.handoverReportId ||
              handoverReportDetail?.id === record.id);
          
          return (
            <Space size="small">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => viewHandoverReportDetail(record)}
                loading={loadingCurrent}
              >
                Xem
              </Button>
            </Space>
          );
        },
      },
    ];

    return (
      <Table
        rowKey={(record) => record.handoverReportId || record.id}
        columns={columns}
        dataSource={reports}
        pagination={false}
        size="small"
      />
    );
  };

  // ====== UI ======
  return (
    <>
      {/* Hidden print containers for PDF generation */}
      <div
        ref={printRef}
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          width: 794,
          visibility: "hidden",
        }}
      />
      <div
        ref={handoverPrintRef}
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          width: 794,
          visibility: "hidden",
        }}
      />
      <div
        ref={annexPrintRef}
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          width: 794,
          visibility: "hidden",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý đơn hàng</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Tải lại</Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã đơn hàng..."
          onSearch={(value) => {
            const trimmed = value.trim();
            // Nếu nhập số (mã đơn hàng), gọi API search với orderId
            if (trimmed && !isNaN(Number(trimmed))) {
              fetchAll(1, pagination.pageSize, Number(trimmed));
            } else if (!trimmed) {
              // Nếu xóa hết, tải lại toàn bộ
              fetchAll(1, pagination.pageSize);
            }
            setKw(trimmed);
          }}
          onChange={(e) => {
            const value = e.target.value;
            setKw(value);
            // Khi xóa hết input, tải lại toàn bộ
            if (!value.trim()) {
              fetchAll(1, pagination.pageSize);
            }
          }}
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
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} đơn`,
            onChange: (page, pageSize) => fetchAll(page, pageSize),
            onShowSizeChange: (current, size) => fetchAll(1, size),
          }}
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
                {dayjs(detail.createdAt).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>

              {/* Ngày bắt đầu thuê: ưu tiên chính thức, nếu không có thì hiện dự kiến */}
              {detail.startDate ? (
                <Descriptions.Item label="Ngày bắt đầu thuê (Chính thức)">
                  <Text strong style={{ color: "#52c41a" }}>
                    {dayjs(detail.startDate).format("DD/MM/YYYY HH:mm")}
                  </Text>
                </Descriptions.Item>
              ) : (
                <Descriptions.Item label="Ngày bắt đầu thuê (Dự kiến)">
                  {detail.planStartDate ? dayjs(detail.planStartDate).format("DD/MM/YYYY HH:mm") : "—"}
                </Descriptions.Item>
              )}
              {/* Ngày kết thúc thuê: ưu tiên chính thức, nếu không có thì hiện dự kiến */}
              {detail.endDate ? (
                <Descriptions.Item label="Ngày kết thúc thuê (Chính thức)">
                  <Text strong style={{ color: "#52c41a" }}>
                    {dayjs(detail.endDate).format("DD/MM/YYYY HH:mm")}
                  </Text>
                </Descriptions.Item>
              ) : (
                <Descriptions.Item label="Ngày kết thúc thuê (Dự kiến)">
                  {detail.planEndDate ? dayjs(detail.planEndDate).format("DD/MM/YYYY HH:mm") : "—"}
                </Descriptions.Item>
              )}
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

            {/* Extensions Section - Hiển thị danh sách gia hạn */}
            {Array.isArray(detail.extensions) && detail.extensions.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 8 }}>Gia hạn đơn thuê</Title>
                <Table
                  rowKey="extensionId"
                  columns={[
                    {
                      title: "ID",
                      dataIndex: "extensionId",
                      width: 60,
                      render: (v) => <strong>#{v}</strong>,
                    },
                    {
                      title: "Thời gian gia hạn",
                      key: "extensionPeriod",
                      width: 200,
                      render: (_, record) => (
                        <span>
                          {record.extensionStart ? dayjs(record.extensionStart).format("DD/MM/YYYY HH:mm") : "—"}
                          {" → "}
                          {record.extensionEnd ? dayjs(record.extensionEnd).format("DD/MM/YYYY HH:mm") : "—"}
                        </span>
                      ),
                    },
                    {
                      title: "Số ngày",
                      dataIndex: "durationDays",
                      width: 80,
                      align: "center",
                      render: (v) => `${v || 0} ngày`,
                    },
                    {
                      title: "Phí gia hạn",
                      dataIndex: "additionalPrice",
                      width: 120,
                      align: "right",
                      render: (v) => fmtVND(v || 0),
                    },
                    {
                      title: "Ngày tạo",
                      dataIndex: "createdAt",
                      width: 130,
                      render: (v) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      width: 120,
                      render: (v) => {
                        const s = String(v || "").toUpperCase();
                        if (s === "PROCESSING") return <Tag color="blue">Đang xử lý</Tag>;
                        if (s === "COMPLETED" || s === "DONE") return <Tag color="green">Hoàn thành</Tag>;
                        if (s === "PENDING") return <Tag color="orange">Chờ xử lý</Tag>;
                        if (s === "CANCELLED") return <Tag color="red">Đã hủy</Tag>;
                        if (s === "IN_USE") return <Tag color="green">Có hiệu lực</Tag>;
                        if (s === "DRAFT") return <Tag color="default">Đang chờ xử lý</Tag>;
                        if (s === "PAID") return <Tag color="cyan">Đã thanh toán</Tag>;
                        return <Tag>{v || "—"}</Tag>;
                      },
                    },
                    {
                      title: "Thao tác",
                      key: "actions",
                      width: 140,
                      render: (_, record) => {
                        // Check if annex already exists for this extension
                        const annexExists = orderAnnexes.some(
                          (a) => a.extensionId === record.extensionId
                        );
                        
                        if (annexExists) {
                          return <Tag color="green">Đã tạo phụ lục</Tag>;
                        }
                        
                        return (
                          <Tooltip title="Tạo phụ lục gia hạn hợp đồng từ gia hạn này">
                            <Button
                              type="primary"
                              size="small"
                              icon={<PlusOutlined />}
                              loading={creatingAnnex}
                              onClick={() => handleCreateAnnexFromExtension(record.extensionId)}
                              disabled={orderContracts.length === 0 || !orderContracts.some((c) => {
                                const status = String(c.status || "").toUpperCase();
                                return status === "ACTIVE" || status === "SIGNED";
                              })}
                            >
                              Tạo phụ lục
                            </Button>
                          </Tooltip>
                        );
                      },
                    },
                  ]}
                  dataSource={detail.extensions}
                  pagination={false}
                  size="small"
                />
                <Divider />
              </>
            )}

            {/* Annexes Section - Hiển thị danh sách phụ lục gia hạn */}
            {orderAnnexes.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 8 }}>Phụ lục gia hạn hợp đồng</Title>
                {annexesLoading ? (
                  <Skeleton active paragraph={{ rows: 2 }} />
                ) : (
                  <Table
                    rowKey="annexId"
                    columns={[
                      {
                        title: "ID",
                        dataIndex: "annexId",
                        width: 80,
                        render: (v) => <strong>#{v || "—"}</strong>,
                      },
                      {
                        title: "Thời gian gia hạn",
                        key: "extensionPeriod",
                        width: 180,
                        render: (_, record) => (
                          <span>
                            {record.extensionStartDate ? dayjs(record.extensionStartDate).format("DD/MM/YYYY") : "—"}
                            {" → "}
                            {record.extensionEndDate ? dayjs(record.extensionEndDate).format("DD/MM/YYYY") : "—"}
                          </span>
                        ),
                      },
                      {
                        title: "Phí gia hạn",
                        dataIndex: "extensionFee",
                        width: 120,
                        align: "right",
                        render: (v) => fmtVND(v || 0),
                      },
                      {
                        title: "Trạng thái",
                        dataIndex: "status",
                        width: 140,
                        render: (status) => contractStatusTag(status), // Reuse contract status tag
                      },
                      {
                        title: "Thao tác",
                        key: "actions",
                        width: 100,
                        render: (_, record) => (
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => {
                              setAnnexDetail(record);
                              setAnnexDetailOpen(true);
                            }}
                          >
                            Xem
                          </Button>
                        ),
                      },
                    ]}
                    dataSource={orderAnnexes}
                    pagination={false}
                    size="small"
                  />
                )}
                <Divider />
              </>
            )}

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
            ) : (
              <>
                {renderHandoverReportCards(checkoutReports, false)}
                <Divider />
                <Title level={5} style={{ marginBottom: 8 }}>Biên bản thu hồi</Title>
                {renderHandoverReportCards(checkinReports, true)}
              </>
            )}

            <Divider />

            <Space>
              {/* Chỉ cho phép tạo hợp đồng khi:
                  - Đơn đang ở trạng thái PROCESSING
                  - Đã có QC report PRE_RENTAL
                  - Chưa có hợp đồng nào khác ngoài DRAFT */}
              {String(detail.orderStatus).toUpperCase() === "PROCESSING" &&
                detailHasPreRentalQc &&
                (() => {
                  const hasNonDraftContract = orderContracts.some((contract) => {
                    const status = String(contract.status || "").toUpperCase();
                    return status !== "DRAFT" && status !== "";
                  });
                  return !hasNonDraftContract;
                })() && (
                  <Button
                    icon={<FileTextOutlined />}
                    onClick={() => doCreateContract(detail)}
                    title="Tạo hợp đồng"
                  >
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
                    </>
                  );
                }
                return null;
              })()}

              {/* HTML → PDF nếu không có contractUrl từ BE */}
              {!(contractDetail.contractUrl || pdfPreviewUrl) && (
                <>
                  {/* Giữ lại nút để operator có thể mở modal xem trước nếu muốn */}
                  <Button onClick={() => previewContractAsPdf()} loading={pdfGenerating}>
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

      {/* Annex Detail Modal - Chi tiết phụ lục gia hạn với PDF View */}
      <Modal
        title={`Chi tiết phụ lục: ${annexDetail?.annexNumber || ""}`}
        open={annexDetailOpen}
        onCancel={() => {
          setAnnexDetailOpen(false);
          revokeBlob(annexPdfBlobUrl);
          setAnnexPdfBlobUrl("");
        }}
        footer={[
          <Button key="close" onClick={() => {
            setAnnexDetailOpen(false);
            revokeBlob(annexPdfBlobUrl);
            setAnnexPdfBlobUrl("");
          }}>
            Đóng
          </Button>,
        ]}
        width={900}
        style={{ top: 20 }}
        afterOpenChange={(open) => {
          if (open && annexDetail && !annexPdfBlobUrl) {
            previewAnnexAsPdf(annexDetail);
          }
        }}
      >
        {annexDetail ? (
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <Title level={5} style={{ marginBottom: 16 }}>Phụ lục PDF</Title>

            <Space style={{ marginBottom: 12 }} wrap>
              <Button
                icon={<ExpandOutlined />}
                onClick={() => {
                  return annexPdfBlobUrl
                    ? window.open(annexPdfBlobUrl, "_blank", "noopener")
                    : message.warning("Đang tạo PDF, vui lòng chờ...");
                }}
              >
                Xem toàn màn hình
              </Button>

              {annexPdfBlobUrl && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = annexPdfBlobUrl;
                    link.download = `Phu-luc-${annexDetail.annexNumber || annexDetail.annexId}.pdf`;
                    link.click();
                  }}
                >
                  Tải phụ lục
                </Button>
              )}

              <Button
                icon={<ReloadOutlined />}
                onClick={() => previewAnnexAsPdf(annexDetail)}
                loading={annexPdfGenerating}
              >
                Tạo lại PDF
              </Button>
            </Space>
            

            {/* PDF Preview */}
            <div
              style={{
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                overflow: "hidden",
                height: 500,
              }}
            >
              {annexPdfGenerating ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <Skeleton.Button active style={{ width: 200, height: 20 }} />
                  <Text type="secondary">Đang tạo PDF phụ lục...</Text>
                </div>
              ) : annexPdfBlobUrl ? (
                <iframe
                  src={annexPdfBlobUrl}
                  title="Annex PDF Preview"
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
                    <FilePdfOutlined /> Nhấn "Tạo lại PDF" để xem phụ lục.
                  </Text>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Text type="secondary">Không có dữ liệu.</Text>
        )}
      </Modal>

      <Modal
        title={`Biên bản ${
          selectedHandoverReport &&
          String(selectedHandoverReport.handoverType || "").toUpperCase() === "CHECKIN"
            ? "thu hồi"
            : "bàn giao"
        } #${selectedHandoverReport?.handoverReportId || selectedHandoverReport?.id || ""}`}
        open={handoverPdfModalOpen}
        onCancel={() => {
          setHandoverPdfModalOpen(false);
          revokeBlob(handoverPdfBlobUrl);
          setHandoverPdfBlobUrl("");
          setSelectedHandoverReport(null);
        }}
        footer={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={() => selectedHandoverReport && downloadHandoverReportAsPdf(selectedHandoverReport)}
            loading={handoverPdfGenerating}
          >
            Tải PDF
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setHandoverPdfModalOpen(false);
              revokeBlob(handoverPdfBlobUrl);
              setHandoverPdfBlobUrl("");
              setSelectedHandoverReport(null);
            }}
          >
            Đóng
          </Button>,
        ]}
        width="90%"
        style={{ top: 24 }}
      >
        {handoverPdfBlobUrl ? (
          <iframe
            title="HandoverPDFPreview"
            src={handoverPdfBlobUrl}
            style={{ width: "100%", height: "80vh", border: "none" }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Text>Đang tạo PDF...</Text>
          </div>
        )}
      </Modal>

      {/* Handover Report Detail Modal - tương tự Contract Detail Modal */}
      <Modal
        title={`Chi tiết biên bản ${
          handoverReportDetail &&
          String(handoverReportDetail.handoverType || "").toUpperCase() === "CHECKIN"
            ? "thu hồi"
            : "bàn giao"
        } #${handoverReportDetail?.handoverReportId || handoverReportDetail?.id || ""}`}
        open={handoverReportDetailOpen}
        onCancel={() => {
          setHandoverReportDetailOpen(false);
          setHandoverReportDetail(null);
          revokeBlob(handoverPdfBlobUrl);
          setHandoverPdfBlobUrl("");
          setHandoverReportPdfPreviewUrl("");
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setHandoverReportDetailOpen(false);
              setHandoverReportDetail(null);
              revokeBlob(handoverPdfBlobUrl);
              setHandoverPdfBlobUrl("");
              setHandoverReportPdfPreviewUrl("");
            }}
          >
            Đóng
          </Button>,
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {loadingHandoverReportDetail ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : handoverReportDetail ? (
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              Biên bản PDF
            </Title>

            <Space style={{ marginBottom: 12 }} wrap>
              <Button
                icon={<ExpandOutlined />}
                onClick={() => {
                  const url = handoverReportPdfPreviewUrl || handoverPdfBlobUrl;
                  return url
                    ? window.open(url, "_blank", "noopener")
                    : message.warning("Không có URL biên bản");
                }}
              >
                Xem toàn màn hình
              </Button>

              {(() => {
                const href = handoverReportPdfPreviewUrl || handoverPdfBlobUrl;
                if (href) {
                  return (
                    <>
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => {
                          if (handoverReportDetail) {
                            downloadHandoverReportAsPdf(handoverReportDetail);
                          }
                        }}
                        loading={handoverPdfGenerating}
                      >
                        Tải biên bản
                      </Button>
                    </>
                  );
                }
                return null;
              })()}

              {/* HTML → PDF nếu không có URL từ BE */}
              {!(handoverReportPdfPreviewUrl || handoverPdfBlobUrl) && (
                <>
                  <Button
                    onClick={() => previewHandoverReportAsPdf(handoverReportDetail)}
                    loading={handoverPdfGenerating}
                  >
                    Xem trước biên bản PDF
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      if (handoverReportDetail) {
                        downloadHandoverReportAsPdf(handoverReportDetail);
                      }
                    }}
                    loading={handoverPdfGenerating}
                  >
                    Tạo & tải biên bản PDF
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
              {handoverReportPdfPreviewUrl || handoverPdfBlobUrl ? (
                <iframe
                  key={handoverReportPdfPreviewUrl || handoverPdfBlobUrl}
                  title="HandoverReportPreview"
                  src={handoverReportPdfPreviewUrl || handoverPdfBlobUrl}
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
                    <FilePdfOutlined /> Không có URL biên bản để hiển thị.
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
      <div
        ref={handoverPrintRef}
        style={{
          position: "fixed",
          left: "-99999px",
          top: "-99999px",
          width: "794px",
          background: "#fff",
          visibility: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -9999,
        }}
      />

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
