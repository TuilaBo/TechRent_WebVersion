// src/pages/admin/AdminContract.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Table, Tag, Typography, Button, Space, Modal, Form, Input, message,
  Drawer, Divider, Row, Col, Select, DatePicker, Card
} from "antd";
import {
  EyeOutlined, FilePdfOutlined, DownloadOutlined, PrinterOutlined, ExpandOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listAllContracts, normalizeContract, adminSignContract, sendPinEmail, getContractById
} from "../../lib/contractApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getKycByCustomerId } from "../../lib/kycApi";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const { Title, Text } = Typography;
const ADMIN_SIGN_EMAIL = "admin123@yopmail.com";
const { RangePicker } = DatePicker;

const CONTRACT_STATUS_MAP = {
  draft: { label: "Nháp", color: "default" },
  pending_signature: { label: "Chờ khách hàng ký", color: "gold" },
  pending_admin_signature: { label: "Chờ ký (admin)", color: "orange" },
  signed: { label: "Đã ký", color: "green" },
  active: { label: "2 bên đã ký", color: "green" },
  expired: { label: "Hết hạn", color: "red" },
  cancelled: { label: "Đã hủy", color: "red" },
};

/* =========================
 * 1) UTILS - Format HTML & Money (Y HỆT OPERATOR)
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
  } catch (error) {
    console.error("Failed to format money in HTML:", error);
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
    } catch (error) {
      console.error("Failed to format date in HTML:", error);
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

/* =========================
 * 2) CSS inlined cho PDF + Quốc hiệu (Y HỆT OPERATOR)
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
  let base = originalBase;
  
  // Add serial numbers from allocatedDevices to device list items
  if (detail.allocatedDevices && Array.isArray(detail.allocatedDevices) && detail.allocatedDevices.length > 0) {
    const serialNumbers = Array.from(
      new Set(
        detail.allocatedDevices
          .map((device) => device.serialNumber)
          .filter(Boolean)
      )
    );
    
    if (serialNumbers.length > 0) {
      const serialText = ` - Serial: ${serialNumbers.join(", ")}`;
      let modifiedBase = base;
      
      // Pattern 1: Match <div class="equipment-item">... - Giá/ngày:... - Tiền cọc:...</div>
      const equipmentDivPattern = /(<div\s+class=["']equipment-item["']>)([^<]*?)(\s*-\s*Giá\/ngày[^<]*?)(<\/div>)/gi;
      modifiedBase = modifiedBase.replace(
        equipmentDivPattern,
        (match, openTag, deviceInfo, priceInfo, closeTag) => {
          return `${openTag}${deviceInfo}${serialText}${priceInfo}${closeTag}`;
        }
      );
      
      // Pattern 2: Match <li>... - Giá/ngày:...</li> (fallback for unformatted HTML)
      if (modifiedBase === base) {
        const liPattern = /(<li>)([^<]*?)(\s*-\s*Giá\/ngày[^<]*?)(<\/li>)/gi;
        modifiedBase = modifiedBase.replace(
          liPattern,
          (match, openTag, deviceInfo, priceInfo, closeTag) => {
            return `${openTag}${deviceInfo}${serialText}${priceInfo}${closeTag}`;
          }
        );
      }
      
      // Pattern 3: Match any device line with "Giá/ngày" pattern (more flexible)
      if (modifiedBase === base) {
        // Try to match lines that contain device info and "Giá/ngày"
        const flexiblePattern = /(\d+x\s+[^-]+?)(\s*-\s*Giá\/ngày[^<•\n]+?)(\s*-\s*Tiền cọc[^<•\n]+?)/gi;
        modifiedBase = modifiedBase.replace(
          flexiblePattern,
          (match, deviceInfo, priceInfo, depositInfo) => {
            return `${deviceInfo}${serialText}${priceInfo}${depositInfo}`;
          }
        );
      }
      
      // Check if replacement occurred
      if (modifiedBase !== base) {
        base = modifiedBase;
      } else {
        // If no match found, try to append after the device list
        // Try to find the closing </ul> of device list and append serial numbers section
        const ulPattern = /(<\/ul>)(\s*<p>)/i;
        if (ulPattern.test(base)) {
          const serialSection = `
<p><strong>Serial Number thiết bị:</strong> ${serialNumbers.join(", ")}</p>`;
          base = base.replace(ulPattern, `$1${serialSection}$2`);
        } else {
          // Append at the end of device section if pattern not found
          const serialSection = `<p><strong>Serial Number thiết bị:</strong> ${serialNumbers.join(", ")}</p>`;
          base = base.replace(/(<\/ul>)/i, `$1${serialSection}`);
        }
      }
    }
  }
  
  const mergedHtml = base + EXTRA_CONTRACT_HTML;
  return { ...detail, contentHtml: mergedHtml };
}

/* ===== Tags giống operator ===== */
function statusTag(s) {
  const v = String(s || "").toUpperCase();
  if (v === "PENDING_SIGNATURE") return <Tag color="gold">Chờ khách hàng ký</Tag>;
  if (v === "PENDING_ADMIN_SIGNATURE") return <Tag color="orange">Chờ ký (admin)</Tag>;
  if (v === "ACTIVE") return <Tag color="green">Đã ký</Tag>;
  if (v.includes("SIGNED")) return <Tag color="green">Đã ký</Tag>;
  if (v.includes("DRAFT")) return <Tag color="default">Nháp</Tag>;
  if (v.includes("EXPIRED")) return <Tag color="red">Hết hạn</Tag>;
  return <Tag>{v || "—"}</Tag>;
}

/* ===== Helpers giống operator ===== */
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

/* =========================
 * 3) HTML → PDF helpers (Y HỆT OPERATOR)
 * ========================= */
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
  
  // Add serial numbers from allocatedDevices after sanitization
  if (detail.allocatedDevices && Array.isArray(detail.allocatedDevices) && detail.allocatedDevices.length > 0) {
    const serialNumbers = detail.allocatedDevices
      .map(device => device.serialNumber)
      .filter(Boolean);
    
    if (serialNumbers.length > 0) {
      const serialText = ` - Serial: ${serialNumbers.join(", ")}`;
      
      // Match <div class="equipment-item">... - Giá/ngày:... - Tiền cọc:...</div>
      // Pattern: match device info before "Giá/ngày" and insert serial number
      const equipmentDivPattern = /(<div\s+class=["']equipment-item["']>)([^<]+?)(\s*-\s*Giá\/ngày[^<]+?)(<\/div>)/gi;
      const originalContentHtml = contentHtml;
      contentHtml = contentHtml.replace(
        equipmentDivPattern,
        (match, openTag, deviceInfo, priceAndDeposit, closeTag) => {
          // Insert serial number after device info, before price info
          return `${openTag}${deviceInfo.trim()}${serialText}${priceAndDeposit}${closeTag}`;
        }
      );
      
      // Debug: log if replacement didn't occur
      if (contentHtml === originalContentHtml) {
        console.warn("Serial number injection failed. HTML pattern:", contentHtml.substring(0, 200));
      }
    }
  }
  
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

export default function AdminContract() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  // Sign
  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [pinSent, setPinSent] = useState(false);
  const [sendingPin, setSendingPin] = useState(false);
  const [form] = Form.useForm();

  // Detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [contractDetail, setContractDetail] = useState(null);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [contractCustomer, setContractCustomer] = useState(null);
  const [contractKyc, setContractKyc] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");

  // Contracts for order
  const [orderContracts, setOrderContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  // HTML→PDF (blob) preview modal + refs
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const printRef = useRef(null);

function revokeBlob(url) {
  try {
    if (url) URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to revoke blob URL:", error);
  }
}
  function clearContractPreviewState() {
    revokeBlob(pdfBlobUrl);
    setPdfBlobUrl("");
    setPdfPreviewUrl("");
    setContractDetail(null);
    setContractCustomer(null);
    setContractKyc(null);
    setOrderContracts([]);
  }

  const loadOrderContracts = async (orderId) => {
    if (!orderId) return;
    try {
      setContractsLoading(true);
      const allContracts = await listAllContracts();
      const normalized = (Array.isArray(allContracts) ? allContracts : []).map(normalizeContract);
      const matches = normalized.filter(c =>
        c.orderId === orderId ||
        c.orderId === Number(orderId) ||
        String(c.orderId) === String(orderId)
      );
      const needDetail = matches.some(c => !c.contractUrl);
      if (needDetail) {
        const detailed = await Promise.all(matches.map(async (c) => {
          if (c.contractUrl) return c;
          try {
            const detail = await getContractById(c.id ?? c.contractId ?? c.contractID);
            return normalizeContract(detail || {});
          } catch (error) {
            console.error("Failed to load contract detail for order:", error);
            return c;
          }
        }));
        setOrderContracts(detailed);
      } else {
        setOrderContracts(matches);
      }
    } catch (e) {
      console.error("Failed to load order contracts:", e);
      setOrderContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const handleDownloadContract = async (record) => {
    try {
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
      setPdfGenerating(true);

      let customer = contractCustomer;
      if (!customer && record?.customerId) {
        try {
          const prof = await fetchCustomerById(record.customerId);
          customer = normalizeCustomer(prof || {});
          setContractCustomer(customer);
        } catch (error) {
          console.error("Failed to fetch customer info:", error);
        }
      }
      let kyc = contractKyc;
      if (!kyc && record?.customerId) {
        try {
          kyc = await getKycByCustomerId(record.customerId);
          setContractKyc(kyc);
        } catch (error) {
          console.error("Failed to fetch KYC info:", error);
        }
      }

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

  const loadContracts = async () => {
    setLoading(true);
    try {
      const list = await listAllContracts();
      const normalized = (Array.isArray(list) ? list : []).map(normalizeContract);
      normalized.sort((a, b) => {
        const ta = new Date(a?.signedAt || a?.createdAt || 0).getTime();
        const tb = new Date(b?.signedAt || b?.createdAt || 0).getTime();
        return tb - ta;
      });
      setRows(normalized);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const openSign = (id) => {
    setCurrentId(id);
    setSignOpen(true);
    setPinSent(false);
    form.resetFields();
    form.setFieldsValue({
      email: ADMIN_SIGN_EMAIL,
      pinCode: undefined,
    });
  };

  const filteredRows = useMemo(() => {
    let data = [...rows];
    
    // Loại bỏ các hợp đồng có trạng thái "nháp" (draft)
    data = data.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return status !== "draft" && status !== "nháp";
    });
    
    if (searchText.trim()) {
      const keyword = searchText.trim().toLowerCase();
      data = data.filter((row) => {
        const haystack = [
          row.number,
          row.id,
          row.orderId,
          row.customerId,
          row.customerName,
        ]
          .map((v) => (v != null ? String(v).toLowerCase() : ""))
          .join(" ");
        return haystack.includes(keyword);
      });
    }
    if (statusFilter) {
      data = data.filter(
        (row) => String(row.status).toLowerCase() === String(statusFilter).toLowerCase()
      );
    }
    if (dateRange?.length === 2) {
      const [start, end] = dateRange;
      data = data.filter((row) => {
        const t = dayjs(row?.createdAt || row?.signedAt);
        return t.isValid() && t.isBetween(start, end, "day", "[]");
      });
    }
    
    // Sắp xếp theo thứ tự ưu tiên: chờ ký (admin) -> chờ khách hàng ký -> đã ký
    data.sort((a, b) => {
      const getPriority = (status) => {
        const s = String(status || "").toUpperCase();
        if (s === "PENDING_ADMIN_SIGNATURE") return 1; // Ưu tiên cao nhất
        if (s === "PENDING_SIGNATURE") return 2;
        if (s === "ACTIVE" || s.includes("SIGNED")) return 3;
        return 4; // Các trạng thái khác
      };
      
      const priorityA = getPriority(a.status);
      const priorityB = getPriority(b.status);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Nếu cùng priority, sắp xếp theo ngày tạo (mới nhất trước)
      const dateA = new Date(a?.createdAt || a?.signedAt || 0).getTime();
      const dateB = new Date(b?.createdAt || b?.signedAt || 0).getTime();
      return dateB - dateA;
    });
    
    return data;
  }, [rows, searchText, statusFilter, dateRange]);

  const doAdminSign = async (values) => {
    if (!currentId) return;
    try {
      setSigning(true);
      const payload = {
        contractId: Number(currentId),
        digitalSignature: "string",
        pinCode: values.pinCode,
        signatureMethod: "EMAIL_OTP",
        deviceInfo: "string",
        ipAddress: "string",
      };
      await adminSignContract(currentId, payload);
      message.success("Đã ký hợp đồng (admin)");
      setSignOpen(false);
      setCurrentId(null);
      setPinSent(false);
      setLoading(true);
      const list = await listAllContracts();
      const normalized = (Array.isArray(list) ? list : []).map(normalizeContract);
      normalized.sort((a, b) => {
        const ta = new Date(a?.signedAt || a?.createdAt || 0).getTime();
        const tb = new Date(b?.signedAt || b?.createdAt || 0).getTime();
        return tb - ta;
      });
      setRows(normalized);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Ký hợp đồng thất bại");
    } finally {
      setSigning(false);
      setLoading(false);
    }
  };

  const doSendPin = async (values) => {
    if (!currentId) return;
    const email = values?.email?.trim();
    if (!email) {
      message.warning("Vui lòng nhập email để gửi mã PIN");
      return;
    }
    try {
      setSendingPin(true);
      await sendPinEmail(currentId, email);
      message.success("Đã gửi mã PIN tới email");
      setPinSent(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Gửi mã PIN thất bại");
    } finally {
      setSendingPin(false);
    }
  };

  const viewContractDetail = async (contractId) => {
    try {
      clearContractPreviewState();
      setLoadingContractDetail(true);

      const contract = await getContractById(contractId);
      const normalized = normalizeContract(contract);
      setContractDetail(normalized);
      if (normalized?.contractUrl) setPdfPreviewUrl(normalized.contractUrl);

      // Local copies để dùng cho auto-generate PDF
      let customerData = null;
      let kycData = null;

      if (normalized?.customerId) {
        try {
          const customer = await fetchCustomerById(normalized.customerId);
          customerData = normalizeCustomer(customer || {});
          setContractCustomer(customerData);
        } catch (error) {
          console.error("Failed to fetch customer for contract detail:", error);
          setContractCustomer(null);
        }
        try {
          const kyc = await getKycByCustomerId(normalized.customerId);
          kycData = kyc || null;
          setContractKyc(kycData);
        } catch (error) {
          console.error("Failed to fetch KYC for contract detail:", error);
          setContractKyc(null);
        }
      } else {
        setContractCustomer(null);
        setContractKyc(null);
      }

      if (normalized?.orderId) {
        await loadOrderContracts(normalized.orderId);
      }

      // Nếu BE không trả về contractUrl, tự động generate PDF để iframe hiển thị luôn
      if (!normalized?.contractUrl && printRef.current) {
        try {
          const detail = augmentContractContent(normalized);
          printRef.current.innerHTML = buildPrintableHtml(
            detail,
            customerData,
            kycData
          );
          const blob = await elementToPdfBlob(printRef.current);
          const url = URL.createObjectURL(blob);
          // Dùng cho iframe trong Drawer + modal xem trước (nếu admin mở thủ công)
          setPdfPreviewUrl(url);
          setPdfBlobUrl(url);
        } catch (error) {
          console.error("Failed to auto-generate contract PDF preview (admin):", error);
        }
      }

      setDetailOpen(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải được chi tiết hợp đồng.");
    } finally {
      setLoadingContractDetail(false);
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 12 }}>Hợp đồng</Title>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ paddingBottom: 8 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="Tìm theo mã hợp đồng, đơn hàng, khách hàng..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              allowClear
              placeholder="Lọc trạng thái"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: "100%" }}
              options={Object.entries(CONTRACT_STATUS_MAP).map(([key, meta]) => ({
                label: meta.label,
                value: key,
              }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <RangePicker
              style={{ width: "100%" }}
              value={dateRange}
              onChange={(range) => setDateRange(range || null)}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} md={4}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={loadContracts} loading={loading}>Tải lại</Button>
              <Button
                onClick={() => {
                  setSearchText("");
                  setStatusFilter(undefined);
                  setDateRange(null);
                }}
              >
                Xóa lọc
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Table
        rowKey={(r) => r.id}
        columns={[
          { title: "ID", dataIndex: "id", width: 90 },
          { title: "Số hợp đồng", dataIndex: "number", width: 160, ellipsis: true },
          { title: "Khách hàng", dataIndex: "customerId", width: 120 },
          { title: "Đơn hàng", dataIndex: "orderId", width: 120 },
          { title: "Trạng thái", dataIndex: "status", width: 140, render: statusTag },
          { title: "Tổng tiền", dataIndex: "totalAmount", width: 140, render: (v) => (v != null ? v.toLocaleString("vi-VN") + " ₫" : "—") },
          { title: "Tiền cọc", dataIndex: "depositAmount", width: 140, render: (v) => (v != null ? v.toLocaleString("vi-VN") + " ₫" : "—") },
          { title: "Ngày tạo", dataIndex: "createdAt", width: 180, render: (v) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—") },
          { title: "Ngày ký", dataIndex: "signedAt", width: 180, render: (v) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—") },
          {
            title: "Thao tác",
            key: "actions",
            width: 220,
            fixed: "right",
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EyeOutlined />} onClick={() => viewContractDetail(r.id)}>Xem</Button>
                {String(r.status || "").toUpperCase() === "PENDING_ADMIN_SIGNATURE" && (
                  <Button type="primary" size="small" onClick={() => openSign(r.id)}>Ký (admin)</Button>
                )}
              </Space>
            ),
          },
        ]}
        dataSource={filteredRows}
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 900 }}
      />

      {/* Modal ký admin */}
      <Modal
        title={currentId ? `Ký hợp đồng #${currentId}` : "Ký hợp đồng"}
        open={signOpen}
        onCancel={() => setSignOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={pinSent ? doAdminSign : doSendPin}>
          {!pinSent ? (
            <>
              <Form.Item
                label="Email nhận mã PIN"
                name="email"
                rules={[{ required: true, message: "Vui lòng nhập email" }]}
              >
                <Input type="email" disabled value={ADMIN_SIGN_EMAIL} />
              </Form.Item>
              <Form.Item style={{ marginTop: -8, marginBottom: 12 }}>
                
              </Form.Item>
              <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
                <Space>
                  <Button onClick={() => setSignOpen(false)}>Hủy</Button>
                  <Button type="primary" htmlType="submit" loading={sendingPin}>Gửi mã PIN</Button>
                </Space>
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                label="Mã PIN"
                name="pinCode"
                rules={[{ required: true, message: "Vui lòng nhập mã PIN" }, { min: 6, message: "Tối thiểu 6 ký tự" }]}
              >
                <Input placeholder="Nhập mã PIN" maxLength={10} />
              </Form.Item>
              <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
                <Space>
                  <Button onClick={() => setPinSent(false)}>Quay lại</Button>
                  <Button type="primary" htmlType="submit" loading={signing}>Ký hợp đồng</Button>
                </Space>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Drawer chi tiết: Hợp đồng */}
      <Drawer
        title={contractDetail ? `Chi tiết hợp đồng #${contractDetail.id}` : "Chi tiết hợp đồng"}
        width={900}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          clearContractPreviewState();
        }}
        styles={{ body: { padding: 0, background: "#fff" } }}
      >
        {loadingContractDetail ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Text type="secondary">Đang tải chi tiết hợp đồng...</Text>
          </div>
        ) : contractDetail ? (
          <div style={{ padding: 24 }}>
            <Title level={4} style={{ marginBottom: 16 }}>Hợp đồng đã tạo</Title>

            {contractsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">Đang tải danh sách hợp đồng...</Text>
              </div>
            ) : orderContracts.length > 0 ? (
              <Table
                rowKey="id"
                columns={[
                  { title: "Mã hợp đồng", dataIndex: "id", width: 100, render: (v) => <Text strong>#{v}</Text> },
                  { title: "Số hợp đồng", dataIndex: "number", width: 140, render: (v) => v || "—" },
                  {
                    title: "Trạng thái", dataIndex: "status", width: 150,
                    render: (status) => {
                      const key = String(status || "").toLowerCase();
                      const info = CONTRACT_STATUS_MAP[key];
                      return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{status}</Tag>;
                    },
                  },
                  { title: "Ngày tạo", dataIndex: "createdAt", width: 170, render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm") },
                  { title: "Tổng tiền", dataIndex: "totalAmount", width: 140, align: "right", render: (v) => (v != null ? v.toLocaleString("vi-VN") + " ₫" : "—") },
                  {
                    title: "Thao tác",
                    key: "actions",
                    width: 260,
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
                        {String(record.status || "").toUpperCase() === "PENDING_ADMIN_SIGNATURE" && (
                          <Button size="small" type="primary" onClick={() => openSign(record.id)}>
                            Ký (admin)
                          </Button>
                        )}
                      </Space>
                    ),
                  }
                ]}
                dataSource={orderContracts}
                pagination={false}
                size="small"
                style={{ marginBottom: 16 }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">Chưa có hợp đồng nào được tạo cho đơn này</Text>
              </div>
            )}

            <Divider />

            <Title level={4} style={{ marginBottom: 16 }}>Hợp đồng PDF đã tạo</Title>
            <Space style={{ marginBottom: 12 }} wrap>
              <Button icon={<ExpandOutlined />} onClick={() => {
                const url = contractDetail.contractUrl || pdfPreviewUrl || pdfBlobUrl;
                return url ? window.open(url, "_blank", "noopener") : message.warning("Không có URL hợp đồng");
              }}>
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
                        onClick={() => {
                          if (contractDetail?.contractUrl) {
                            // Nếu có contractUrl từ BE, tải trực tiếp
                            const a = document.createElement("a");
                            a.href = contractDetail.contractUrl;
                            a.target = "_blank";
                            a.rel = "noopener";
                            a.download = contractDetail.contractFileName || `contract-${contractDetail.id}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          } else if (pdfPreviewUrl || pdfBlobUrl) {
                            // Nếu là blob URL từ FE generate, tải blob
                            const a = document.createElement("a");
                            a.href = pdfPreviewUrl || pdfBlobUrl;
                            a.download = contractDetail?.contractFileName || contractDetail?.number || `contract-${contractDetail.id}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          } else {
                            message.warning("Không có URL hợp đồng để tải");
                          }
                        }}
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
                  <Button
                    onClick={async () => {
                      if (!contractDetail) return message.warning("Chưa có dữ liệu hợp đồng.");
                      try {
                        setPdfGenerating(true);
                        revokeBlob(pdfBlobUrl);

                        let customer = contractCustomer;
                        let kyc = contractKyc;

                        if (contractDetail?.customerId) {
                          if (!customer) {
                            try {
                              const customerData = await fetchCustomerById(contractDetail.customerId);
                              customer = normalizeCustomer(customerData || {});
                              setContractCustomer(customer);
                            } catch (error) {
                              console.error("Failed to fetch customer for PDF preview:", error);
                            }
                          }
                          if (!kyc) {
                            try {
                              const kycData = await getKycByCustomerId(contractDetail.customerId);
                              kyc = kycData || null;
                              setContractKyc(kyc);
                            } catch (error) {
                              console.error("Failed to fetch KYC for PDF preview:", error);
                            }
                          }
                        }

                        if (printRef.current) {
                          const detail = augmentContractContent(contractDetail);
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
                    }}
                    loading={pdfGenerating}
                  >
                    Xem trước hợp đồng PDF
                  </Button>
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!contractDetail) return message.warning("Chưa có dữ liệu hợp đồng.");
                      try {
                        setPdfGenerating(true);
                        revokeBlob(pdfBlobUrl);

                        let customer = contractCustomer;
                        let kyc = contractKyc;

                        if (contractDetail?.customerId) {
                          if (!customer) {
                            try {
                              const customerData = await fetchCustomerById(contractDetail.customerId);
                              customer = normalizeCustomer(customerData || {});
                              setContractCustomer(customer);
                            } catch (error) {
                              console.error("Failed to fetch customer for PDF download:", error);
                            }
                          }
                          if (!kyc) {
                            try {
                              const kycData = await getKycByCustomerId(contractDetail.customerId);
                              kyc = kycData || null;
                              setContractKyc(kyc);
                            } catch (error) {
                              console.error("Failed to fetch KYC for PDF download:", error);
                            }
                          }
                        }

                        if (printRef.current) {
                          const detail = augmentContractContent(contractDetail);
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
                    }}
                    loading={pdfGenerating}
                  >
                    Tạo & tải hợp đồng PDF
                  </Button>
                </>
              )}
            </Space>

            <div
              style={{
                height: 400,
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
                <div className="h-full flex items-center justify-center">
                  <Text type="secondary"><FilePdfOutlined /> Không có URL hợp đồng để hiển thị.</Text>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Text type="secondary">Không có dữ liệu hợp đồng</Text>
          </div>
        )}
      </Drawer>

      {/* Modal xem trước PDF do FE kết xuất (HTML->PDF) */}
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
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={async () => {
              if (!contractDetail) return message.warning("Chưa có dữ liệu hợp đồng.");
              try {
                setPdfGenerating(true);
                revokeBlob(pdfBlobUrl);

                let customer = contractCustomer;
                let kyc = contractKyc;

                if (contractDetail?.customerId) {
                  if (!customer) {
                    try {
                      const customerData = await fetchCustomerById(contractDetail.customerId);
                      customer = normalizeCustomer(customerData || {});
                      setContractCustomer(customer);
                    } catch (error) {
                      console.error("Failed to fetch customer for modal download:", error);
                    }
                  }
                  if (!kyc) {
                    try {
                      const kycData = await getKycByCustomerId(contractDetail.customerId);
                      kyc = kycData || null;
                      setContractKyc(kyc);
                    } catch (error) {
                      console.error("Failed to fetch KYC for modal download:", error);
                    }
                  }
                }

                if (printRef.current) {
                  const detail = augmentContractContent(contractDetail);
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
            }}
            loading={pdfGenerating}
          >
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

      {/* Container ẩn để render A4 rồi chụp */}
      <div style={{ position:"fixed", left:-9999, top:-9999, background:"#fff" }}>
        <div ref={printRef} />
      </div>
    </div>
  );
}
