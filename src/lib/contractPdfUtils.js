import { sanitizeContractHtml, augmentContractContent, NATIONAL_HEADER_HTML } from "./contractPrintUtils";
import { createPrintSandbox, cleanupPrintSandbox } from "./orderUtils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

/**
 * Build printable HTML for contract
 */
export function buildPrintableHtml(detail, customer, kyc) {
  if (!detail) return "<div>Không có dữ liệu hợp đồng</div>";
  const title = detail.title || "HỢP ĐỒNG";
  const number = detail.number ? `Số: ${detail.number}` : "";
  const customerName = customer?.fullName || customer?.name || `Khách hàng #${detail.customerId}`;
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

/**
 * Convert HTML element to PDF blob
 */
export async function elementToPdfBlob(el) {
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

