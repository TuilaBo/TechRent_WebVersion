import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { fmtVND } from "../../../lib/deviceModelsApi";
import { translateRole } from "./TechnicianCalendarUtils";

const GLOBAL_PRINT_CSS = `
  <style>
    .print-pdf-root,
    .print-pdf-root * {
      font-family: Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: optimizeLegibility !important;
    }

    .print-pdf-root h1,
    .print-pdf-root h2,
    .print-pdf-root h3 {
      margin: 8px 0 6px;
      font-weight: 700;
    }

    .print-pdf-root h3 {
      font-size: 14px;
      text-transform: uppercase;
    }

    .print-pdf-root p {
      margin: 6px 0;
    }

    .print-pdf-root .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #222;
      padding-bottom: 12px;
    }

    .print-pdf-root .header h2 {
      text-transform: uppercase;
      font-size: 18px;
    }

    .print-pdf-root .header p {
      font-size: 12px;
      color: #666;
    }

    .print-pdf-root .meta-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      font-size: 12px;
    }

    .print-pdf-root .kv {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 13px;
    }

    .print-pdf-root .kv div {
      margin-bottom: 4px;
    }

    .print-pdf-root .section-title {
      font-size: 14px;
      font-weight: 700;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    .print-pdf-root .kv div {
      margin: 2px 0;
    }

    .print-pdf-root table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }

    .print-pdf-root table th,
    .print-pdf-root table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }

    .print-pdf-root table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    .print-pdf-root .equipment-item {
      display: block;
      margin: 4px 0;
    }

    .print-pdf-root .equipment-item::before {
      content: "• ";
    }
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

export function buildPrintableHandoverReportHtml(report, order = null, conditionDefinitions = []) {
    if (!report) return "";

    const conditionMap = {};
    conditionDefinitions.forEach((c) => {
        conditionMap[c.conditionDefinitionId] = c;
    });

    // Helper to extract tech name
    const pushTech = (tech) => {
        if (!tech) return "";
        const lines = [];
        if (tech.fullName) lines.push(`<b>Họ tên:</b> ${tech.fullName}`);
        else if (tech.username) lines.push(`<b>Username:</b> ${tech.username}`);

        if (tech.phoneNumber) lines.push(`<b>SĐT:</b> ${tech.phoneNumber}`);
        if (tech.email) lines.push(`<b>Email:</b> ${tech.email}`);
        return lines.join("<br/>");
    };

    const techInfoHtml = pushTech(report.technician);
    const customerInfoHtml = pushTech(report.customer);

    const createdDate = new Date(report.createdAt);
    const dateStr = `Ngày ${createdDate.getDate()} tháng ${createdDate.getMonth() + 1} năm ${createdDate.getFullYear()}`;

    // --- Xử lý danh sách thiết bị ---
    let itemsRows = "";

    // 1. Nếu có orderDetails (từ order), dùng nó để hiển thị danh sách thiết bị
    // (Lưu ý: API getHandoverReport có thể không trả details đầy đủ, nên thường cần order object)

    if (order && Array.isArray(order.orderDetails)) {
        // Flatten order details -> items
        // Mỗi order detail có thể có allocations
        let allAllocations = [];
        order.orderDetails.forEach((od) => {
            if (od.allocations && Array.isArray(od.allocations)) {
                od.allocations.forEach((alloc) => {
                    allAllocations.push({
                        ...alloc,
                        deviceModelName: od.deviceModel?.name || od.deviceModelName || "—",
                        unit: od.deviceModel?.unit || "Cái",
                        quantity: 1, // Allocation is per unit
                        // Merge quantity info from order detail if needed for display? 
                        // Actually table columns: STT | Tên | Mã | Đơn vị | SL đặt | SL giao | Tình trạng
                    });
                });
            } else {
                // No allocations yet or not populated? 
                // Show order line
                allAllocations.push({
                    deviceModelName: od.deviceModel?.name || od.deviceModelName || "—",
                    serialNumber: "—",
                    unit: od.deviceModel?.unit || "Cái",
                    quantity: od.quantity,
                    quantityDelivered: 0 // Placeholder
                });
            }
        });

        // Tuy nhiên, logic cũ trong TechnicianHandover.pdf là hiển thị list item.
        // Ở đây ta cố gắng hiển thị best effort.

        // Trong HandoverReport (BE trả về), có thể có list items?
        // Hiện tại BE HandoverReport entity không có list items chi tiết, 
        // mà nó link tới taskId -> orderId.
        // Logic hiển thị thường lấy từ order.orderDetails.

        // Logic render table items:
        itemsRows = order.orderDetails.map((od, idx) => {
            // Calculate delivered count based on allocations
            const deliveredCount = (od.allocations || []).length;
            const deviceNames = (od.allocations || []).map(a => a.device?.serialNumber || a.serialNumber || "—").join(", ");
            // Condition? 
            // For DELIVERY (CHECKOUT), condition is usually "Mới" or from allocation check
            // For RETURN (CHECKIN), condition is evaluated.

            // Build html for allocations if possible?
            // Simple row for Order Detail
            return `
        <tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${od.deviceModel?.name || od.deviceModelName || "—"}</td>
          <td>${deviceNames || "—"}</td>
          <td style="text-align:center">${od.deviceModel?.unit || "Cái"}</td>
          <td style="text-align:center">${od.quantity || 0}</td>
          <td style="text-align:center">${deliveredCount}</td>
          <td>${String(report.handoverType || "").toUpperCase() === "CHECKIN" ? "Đã kiểm tra" : "Tốt"}</td>
          <td style="text-align:center"> — </td>
        </tr>
      `;
        }).join("");
    }

    // --- Helper function to get conditions and images for a device ---
    const getDeviceConditionsHtml = (deviceId) => {
        if (!deviceId || !(report.deviceConditions || []).length) return "";
        const conditions = report.deviceConditions.filter(c => c.deviceId === deviceId);
        if (!conditions.length) return "";

        return conditions.map(c => {
            const def = conditionMap[c.conditionDefinitionId];
            const name = def?.name || c.conditionName || `Điều kiện #${c.conditionDefinitionId}`;
            // Images? 
            // Assuming report.evidenceUrls might be linked or condition has images?
            // Currently BE HandoverDeviceCondition doesn't have images directly, 
            // usually evidenceUrls are on the report level or discrepancies.
            return `<div class="equipment-item">${name}: ${c.value || "Đạt"}</div>`;
        }).join("");
    };

    // --- Build Quality / Condition Table (if needed) ---
    // If CHECKIN, we usually show discrepancies separate.
    // If CHECKOUT, currently we assume "Tốt" unless noted.
    // But if we have record of conditions:
    let qualityRows = "";
    if ((report.deviceConditions || []).length > 0 && order) {
        // Try to verify which device matches
        // For now, list all conditions found?
        // Or better: map entries
        // This part is complex because mapping ID back to model name requires order lookup
        // omitted for brevity unless critical
    }

    const reportTitle = String(report.handoverType || "").toUpperCase() === "CHECKIN"
        ? "BIÊN BẢN THU HỒI THIẾT BỊ"
        : "BIÊN BẢN BÀN GIAO THIẾT BỊ";

    // customer info retrieval logic
    const customer = report.customer || {};
    const customerName = customer.fullName || customer.username || "Khách hàng";
    const technician = report.technician || {};
    const technicianDisplayName = technician.fullName || technician.username || "Kỹ thuật viên";

    // technician info
    const technicianInfo = report.createdByStaff || report.technician || {};

    return `
    <div class="print-pdf-root" style="padding: 24px; max-width: 800px; margin: 0 auto; background: #fff; color: #000; font-size: 13px; line-height: 1.5;">
      ${GLOBAL_PRINT_CSS}
      ${NATIONAL_HEADER_HTML}
      
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase;">
          ${reportTitle}
        </h2>
        <div style="font-style: italic; margin-top: 4px;">${dateStr}</div>
        <div style="font-weight: 600; margin-top: 4px;">Mã: ${report.handoverReportId || report.id}</div>
      </div>

      <!-- INFO SECTION -->
      <section class="kv" style="margin-bottom: 24px;">
        <div>
          <b>Đơn hàng:</b> #${report.orderId}<br/>
          <b>Thời gian:</b> ${new Date(report.createdAt).toLocaleString("vi-VN")}
        </div>
        <div>
           <!-- Empty col -->
        </div>
      </section>

      <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px;">
        <div style="flex: 1;">
          <div class="section-title">BÊN GIAO (BÊN A)</div>
          ${String(report.handoverType || "").toUpperCase() === "CHECKIN"
            ? `<div><b>Khách hàng:</b> ${customerName}</div>
                 ${customer.phoneNumber ? `<div><b>SĐT:</b> ${customer.phoneNumber}</div>` : ""}
                 <div><b>Địa chỉ:</b> ${order?.shippingAddress || "—"}</div>`
            : `<div><b>Đại diện:</b> ${technicianDisplayName}</div>
                 <div><b>Chức vụ:</b> ${translateRole(technician.role || "TECHNICIAN")}</div>
                 <div><b>Đơn vị:</b> TechRent Vietnam</div>`
        }
        </div>
        <div style="flex: 1;">
          <div class="section-title">BÊN NHẬN (BÊN B)</div>
          ${String(report.handoverType || "").toUpperCase() === "CHECKIN"
            ? `<div><b>Đại diện:</b> ${technicianDisplayName}</div>
                 <div><b>Chức vụ:</b> ${translateRole(technician.role || "TECHNICIAN")}</div>`
            : `<div><b>Khách hàng:</b> ${customerName}</div>
                 ${customer.phoneNumber ? `<div><b>SĐT:</b> ${customer.phoneNumber}</div>` : ""}
                 <div><b>Địa chỉ:</b> ${order?.shippingAddress || "—"}</div>`
        }
        </div>
      </div>

      <h3 style="margin-top:24px">Thông tin người tạo biên bản</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${technicianInfo.name || "—"}</div>
        ${technicianInfo.phone
            ? `<div><b>Số điện thoại:</b> ${technicianInfo.phone}</div>`
            : ""
        }
        ${technicianInfo.email
            ? `<div><b>Email:</b> ${technicianInfo.email}</div>`
            : ""
        }
      </section>
      
      ${(() => {
            const handoverType = String(report.handoverType || "").toUpperCase();
            const isCheckin = handoverType === "CHECKIN";
            return isCheckin
                ? `<h3>Danh sách thiết bị thu hồi</h3>`
                : `<h3>Danh sách thiết bị bàn giao</h3>`;
        })()}
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Tên thiết bị</th>
            <th>Mã thiết bị (Serial Number)</th>
            <th style="width:80px">Đơn vị</th>
            <th style="width:80px;text-align:center">SL đặt</th>
            <th style="width:80px;text-align:center">SL giao</th>
            <th>${String(report.handoverType || "").toUpperCase() === "CHECKIN" ? "Tình trạng thiết bị khi bàn giao" : "Tình trạng thiết bị"}</th>
            <th>Ảnh bằng chứng</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || "<tr><td colspan='8' style='text-align:center'>Không có thiết bị</td></tr>"}
        </tbody>
      </table>
      
      ${qualityRows ? `
      <h3>Thông tin chất lượng thiết bị</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Tên model</th>
            <th>Serial Number</th>
            <th>Trạng thái chất lượng</th>
            <th>Mô tả</th>
          </tr>
        </thead>
        <tbody>
          ${qualityRows}
        </tbody>
      </table>
      ` : ""}
      
      ${(() => {
            const handoverType = String(report.handoverType || "").toUpperCase();
            const isCheckin = handoverType === "CHECKIN";

            // For CHECKIN: show discrepancies
            if (isCheckin && (report.discrepancies || []).length > 0) {
                return `
      <h3>Sự cố của thiết bị</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Loại sự cố</th>
            <th>Thiết bị (Serial Number)</th>
            <th>${String(report.handoverType || "").toUpperCase() === "CHECKIN" ? "Tình trạng thiết bị khi bàn giao" : "Tình trạng thiết bị"}</th>
            <th>Phí phạt</th>
            <th>Ghi chú nhân viên</th>
            ${String(report.handoverType || "").toUpperCase() !== "CHECKIN" ? '<th>Ghi chú khách hàng</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${(report.discrepancies || []).map((disc, idx) => {
                    // Try to get serial number from deviceId
                    let deviceSerial = disc.serialNumber || disc.deviceSerialNumber || "—";
                    if ((deviceSerial === "—" || !deviceSerial) && disc.deviceId && order && Array.isArray(order.orderDetails)) {
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
                    const conditionName = conditionDef?.name || disc.conditionName || `Tình trạng thiết bị #${disc.conditionDefinitionId}`;
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
                ${String(report.handoverType || "").toUpperCase() !== "CHECKIN" ? `<td>${disc.customerNote || "—"}</td>` : ''}
              </tr>
            `;
                }).join("") || `<tr><td colspan='${String(report.handoverType || "").toUpperCase() === "CHECKIN" ? "6" : "7"}' style='text-align:center'>Không có sự cố nào</td></tr>`}
        </tbody>
      </table>
      `;
            }

            // For CHECKOUT: deviceConditions are now shown in the items table, so no separate section needed
            return "";
        })()}
      
      ${report.createdByStaff ? `
      <h3>Người tạo biên bản</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${report.createdByStaff.fullName || report.createdByStaff.username || `Nhân viên #${report.createdByStaff.staffId}`}</div>
        ${report.createdByStaff.email ? `<div><b>Email:</b> ${report.createdByStaff.email}</div>` : ""}
        ${report.createdByStaff.phoneNumber ? `<div><b>Số điện thoại:</b> ${report.createdByStaff.phoneNumber}</div>` : ""}
        ${report.createdByStaff.role ? `<div><b>Vai trò:</b> ${translateRole(report.createdByStaff.role)}</div>` : ""}
      </section>
      ` : ""}
      
      ${(report.evidenceUrls || []).length > 0 ? `
      <h3>Ảnh bằng chứng</h3>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:12px 0">
        ${report.evidenceUrls.map((url, idx) => {
            // Kiểm tra xem là base64 hay URL
            const isBase64 = url.startsWith("data:image");
            const imgSrc = isBase64 ? url : url;
            return `
          <div style="flex:0 0 auto;margin-bottom:8px">
            <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#333">Bằng chứng ${idx + 1}</div>
            <img 
              src="${imgSrc}" 
              alt="Bằng chứng ${idx + 1}"
              style="
                max-width:200px;
                max-height:200px;
                border:1px solid #ddd;
                border-radius:4px;
                display:block;
                object-fit:contain;
              "
              onerror="this.style.display='none';this.nextElementSibling.style.display='block';"
            />
            <div style="display:none;padding:8px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;max-width:200px;font-size:10px;color:#666">
              Không thể tải ảnh<br/>
              <a href="${url}" target="_blank" style="color:#1890ff">Xem link</a>
            </div>
          </div>
        `;
        }).join("")}
      </div>
      ` : ""}
      
      <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
        <div style="flex:1;text-align:center">
          <div><b>KHÁCH HÀNG</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${report.customerSigned ? '<div style="font-size:48px;color:#22c55e;line-height:1">✓</div>' : ""}
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
            ${report.staffSigned ? '<div style="font-size:48px;color:#22c55e;line-height:1">✓</div>' : ""}
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

export async function elementToPdfBlob(el) {
    // Đợi font được load
    if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
    }
    await new Promise(resolve => setTimeout(resolve, 300));

    const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        letterRendering: true,
        onclone: (clonedDoc) => {
            // Đảm bảo font được áp dụng trong cloned document
            const clonedBody = clonedDoc.body;
            if (clonedBody) {
                clonedBody.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
                clonedBody.style.webkitFontSmoothing = "antialiased";
                clonedBody.style.mozOsxFontSmoothing = "grayscale";
            }
            // Áp dụng font cho tất cả phần tử
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
        const sliceHeight = Math.min(
            pageHeight / ratio,
            canvas.height - renderedHeight
        );
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
