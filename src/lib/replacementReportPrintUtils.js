// src/lib/replacementReportPrintUtils.js
import { NATIONAL_HEADER_HTML } from "./contractPrintUtils";
import { formatVND, formatDateTime, parseInfoString, translateRole } from "./handoverReportPrintUtils";

// Re-export for convenience
export { formatVND, formatDateTime, parseInfoString, translateRole };

/**
 * Translate replacement report status to Vietnamese
 */
export function translateReplacementStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "STAFF_SIGNED") return "Nhân viên đã ký";
  if (s === "CUSTOMER_SIGNED") return "Khách hàng đã ký";
  if (s === "BOTH_SIGNED") return "Hai bên đã ký";
  if (s === "PENDING") return "Chờ ký";
  if (s === "COMPLETED") return "Hoàn thành";
  return status || "—";
}

/**
 * Build printable HTML for device replacement report
 * @param {Object} report - Replacement report data from API
 * @returns {string} HTML string for PDF generation
 */
export function buildPrintableReplacementReportHtml(report) {
  if (!report) return "<div>Không có dữ liệu biên bản</div>";

  // Parse customer info (format: "name - phone - email")
  const customerInfoParts = (report.customerInfo || "").split(" - ").filter(Boolean);
  const customerName = customerInfoParts[0] || "—";
  const customerPhone = customerInfoParts[1] || "—";
  const customerEmail = customerInfoParts[2] || "—";

  // Parse technician info (format: "name - email")
  const technicianInfoParts = (report.technicianInfo || "").split(" - ").filter(Boolean);
  const technicianName = technicianInfoParts[0] || "—";
  const technicianEmail = technicianInfoParts[1] || "—";

  // Separate items into old device (thu hồi) and new device (giao mới)
  const oldDevices = (report.items || []).filter(item => item.isOldDevice);
  const newDevices = (report.items || []).filter(item => !item.isOldDevice);

  // Build old device rows
  const oldDeviceRows = oldDevices.length > 0
    ? oldDevices.map((item, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${item.deviceModelName || "—"}</td>
        <td>${item.deviceSerialNumber || "—"}</td>
        <td style="text-align:center">1</td>
        <td>
          ${item.evidenceUrls && item.evidenceUrls.length > 0
        ? `<div style="display:flex;flex-wrap:wrap;gap:4px">
                ${item.evidenceUrls.map((url, imgIdx) => `
                  <img 
                    src="${url}" 
                    alt="Bằng chứng ${imgIdx + 1}"
                    style="max-width:60px;max-height:60px;border:1px solid #ddd;border-radius:4px;object-fit:contain;"
                    onerror="this.style.display='none';"
                  />
                `).join("")}
              </div>`
        : "—"
      }
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" style="text-align:center">Không có thiết bị thu hồi</td></tr>`;

  // Build new device rows
  const newDeviceRows = newDevices.length > 0
    ? newDevices.map((item, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${item.deviceModelName || "—"}</td>
        <td>${item.deviceSerialNumber || "—"}</td>
        <td style="text-align:center">1</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" style="text-align:center">Không có thiết bị thay thế</td></tr>`;

  return `
    <style>
      .print-pdf-root,
      .print-pdf-root * {
        font-family: Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
      }
      .print-pdf-root h1, .print-pdf-root h2, .print-pdf-root h3 { margin: 8px 0 6px; font-weight: 700; }
      .print-pdf-root h3 { font-size: 14px; text-transform: uppercase; }
      .print-pdf-root p { margin: 6px 0; }
      .print-pdf-root .kv { margin-bottom: 10px; }
      .print-pdf-root .kv div { margin: 2px 0; }
      .print-pdf-root table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      .print-pdf-root table th, .print-pdf-root table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      .print-pdf-root table th { background-color: #f5f5f5; font-weight: 600; }
    </style>
    <div class="print-pdf-root"
         style="padding:24px; font-size:12px; line-height:1.6; color:#000;">
      ${NATIONAL_HEADER_HTML}
      
      <h1 style="text-align:center; margin:16px 0">BIÊN BẢN THAY THẾ THIẾT BỊ</h1>
      
      <section class="kv">
        <div><b>Mã biên bản:</b> #${report.replacementReportId || "—"}</div>
        <div><b>Mã task:</b> #${report.taskId || "—"}</div>
        <div><b>Mã đơn hàng:</b> #${report.orderId || "—"}</div>
        <div><b>Thời gian thay thế:</b> ${formatDateTime(report.replacementDateTime)}</div>
        <div><b>Địa điểm:</b> ${report.replacementLocation || "—"}</div>
        <div><b>Trạng thái:</b> ${translateReplacementStatus(report.status)}</div>
      </section>
      
      <h3>Thông tin khách hàng</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${customerName}</div>
        ${customerPhone !== "—" ? `<div><b>Số điện thoại:</b> ${customerPhone}</div>` : ""}
        ${customerEmail !== "—" ? `<div><b>Email:</b> ${customerEmail}</div>` : ""}
      </section>
      
      <h3>Kỹ thuật viên thực hiện</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${technicianName}</div>
        ${technicianEmail !== "—" ? `<div><b>Email:</b> ${technicianEmail}</div>` : ""}
      </section>
      
      ${report.createdByStaff ? `
      <h3>Người tạo biên bản</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${report.createdByStaff.fullName || report.createdByStaff.username || `Nhân viên #${report.createdByStaff.staffId}`}</div>
        ${report.createdByStaff.email ? `<div><b>Email:</b> ${report.createdByStaff.email}</div>` : ""}
        ${report.createdByStaff.phoneNumber ? `<div><b>Số điện thoại:</b> ${report.createdByStaff.phoneNumber}</div>` : ""}
        ${report.createdByStaff.role ? `<div><b>Vai trò:</b> ${translateRole(report.createdByStaff.role)}</div>` : ""}
      </section>
      ` : ""}
      
      <h3>Thiết bị thu hồi (cũ)</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Tên thiết bị</th>
            <th>Serial Number</th>
            <th style="width:60px;text-align:center">SL</th>
            <th>Ảnh bằng chứng</th>
          </tr>
        </thead>
        <tbody>
          ${oldDeviceRows}
        </tbody>
      </table>

      ${(report.discrepancies && report.discrepancies.length > 0) ? `
      <h3>Sự cố / Hư hại (Discrepancies)</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Thiết bị</th>
            <th>Serial Number</th>
            <th>Tên lỗi</th>
            <th>Ghi chú</th>
            <th style="text-align:right">Phí phạt</th>
          </tr>
        </thead>
        <tbody>
          ${report.discrepancies.map((d, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${d.deviceModelName || "—"}</td>
                <td>${d.serialNumber || d.deviceSerialNumber || "—"}</td>
                <td>${d.conditionName || "—"}</td>
                <td>${d.staffNote || "—"}</td>
                <td style="text-align:right">${formatVND(d.penaltyAmount || 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ` : ""}
      
      <h3>Thiết bị thay thế (mới)</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Tên thiết bị</th>
            <th>Serial Number</th>
            <th style="width:60px;text-align:center">SL</th>
          </tr>
        </thead>
        <tbody>
          ${newDeviceRows}
        </tbody>
      </table>
      
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
          ${report.customerSignedAt ? `<div style="font-size:10px;color:#666">Ký lúc: ${formatDateTime(report.customerSignedAt)}</div>` : ""}
        </div>
        <div style="flex:1;text-align:center">
          <div><b>NHÂN VIÊN</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${report.staffSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}
          </div>
          <div>
            ${report.staffSigned
      ? `<div style="color:#000;font-weight:600">${report.staffSignature || technicianName}</div>`
      : "(Ký, ghi rõ họ tên)"}
          </div>
          ${report.staffSignedAt ? `<div style="font-size:10px;color:#666">Ký lúc: ${formatDateTime(report.staffSignedAt)}</div>` : ""}
        </div>
      </section>
    </div>
  `;
}

/**
 * Convert HTML element to PDF blob for replacement reports
 * (Uses same approach as handover reports)
 */
export async function elementToPdfBlobReplacement(el) {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  await new Promise(resolve => setTimeout(resolve, 500));

  const html2canvas = (await import("html2canvas")).default;
  const jsPDF = (await import("jspdf")).default;

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    letterRendering: true,
    onclone: (clonedDoc) => {
      const clonedBody = clonedDoc.body;
      if (clonedBody) {
        clonedBody.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
        clonedBody.style.webkitFontSmoothing = "antialiased";
        clonedBody.style.mozOsxFontSmoothing = "grayscale";
      }
      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach(elem => {
        if (elem.style) {
          elem.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
        }
      });
    },
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
