import { NATIONAL_HEADER_HTML } from "./contractPrintUtils";
import { formatVND, formatDateTime } from "./orderUtils";

// Re-export for convenience
export { formatVND, formatDateTime };

/**
 * Parse info string (format: "name • phone • email")
 */
export function parseInfoString(infoStr) {
  if (!infoStr) return { name: "", phone: "", email: "" };
  const parts = infoStr.split("•").map(s => s.trim()).filter(Boolean);
  return {
    name: parts[0] || "",
    phone: parts[1] || "",
    email: parts[2] || "",
  };
}

/**
 * Translate role to Vietnamese
 */
export function translateRole(role) {
  const r = String(role || "").toUpperCase();
  if (r === "TECHNICIAN") return "Kỹ thuật viên";
  return role;
}

/**
 * Translate handover status to Vietnamese
 */
export function translateHandoverStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "STAFF_SIGNED") return "Nhân viên đã ký";
  if (s === "CUSTOMER_SIGNED") return "Đã ký khách hàng";
  if (s === "BOTH_SIGNED") return "2 bên đã ký";
  if (s === "PENDING_STAFF_SIGNATURE") return "Chờ nhân viên ký";
  if (s === "COMPLETED") return "Hoàn thành";
  return status || "—";
}

/**
 * Build printable HTML for handover report
 */
export function buildPrintableHandoverReportHtml(report, order = null, conditionDefinitions = []) {
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
  
  // Map condition definitions by ID for quick lookup
  const conditionMap = {};
  conditionDefinitions.forEach(cd => {
    conditionMap[cd.id || cd.conditionDefinitionId] = cd;
  });
  
  // Build allocation map from order if available
  const allocationMap = {};
  if (order && Array.isArray(order.orderDetails)) {
    order.orderDetails.forEach(od => {
      if (od.allocations && Array.isArray(od.allocations)) {
        od.allocations.forEach(allocation => {
          if (allocation.allocationId) {
            allocationMap[allocation.allocationId] = {
              deviceModelName: od.deviceModel?.deviceName || od.deviceModel?.name || od.deviceName || "—",
              serialNumber: allocation.device?.serialNumber || allocation.serialNumber || "—",
              deviceId: allocation.device?.deviceId || allocation.deviceId || null,
              unit: "cái",
              quantity: od.quantity || 1,
            };
          }
        });
      }
    });
  }
  
  // Build device map from deviceConditions to supplement allocationMap
  const deviceConditionMap = {};
  if (Array.isArray(report.deviceConditions)) {
    report.deviceConditions.forEach(dc => {
      if (dc.allocationId && dc.deviceId) {
        // Try to get serial number from baselineSnapshots or deviceSerial
        let serialNumber = dc.deviceSerial || "—";
        if (!serialNumber && dc.baselineSnapshots && Array.isArray(dc.baselineSnapshots)) {
          // Try to find serial number in snapshots (if available)
          const firstSnapshot = dc.baselineSnapshots[0];
          if (firstSnapshot && firstSnapshot.deviceSerial) {
            serialNumber = firstSnapshot.deviceSerial;
          }
        }
        
        // If allocationId not in allocationMap, add it from deviceConditions
        if (!allocationMap[dc.allocationId]) {
          allocationMap[dc.allocationId] = {
            deviceId: dc.deviceId,
            serialNumber: serialNumber,
            deviceModelName: "—", // Will try to get from order if available
            unit: "cái",
            quantity: 1,
          };
        } else {
          // Update existing entry with deviceId and serialNumber if missing
          if (!allocationMap[dc.allocationId].deviceId) {
            allocationMap[dc.allocationId].deviceId = dc.deviceId;
          }
          if (!allocationMap[dc.allocationId].serialNumber || allocationMap[dc.allocationId].serialNumber === "—") {
            allocationMap[dc.allocationId].serialNumber = serialNumber;
          }
        }
        
        // Also create a deviceId -> allocationId map for lookup
        deviceConditionMap[dc.deviceId] = {
          allocationId: dc.allocationId,
          serialNumber: serialNumber,
        };
      }
    });
  }
  
  // Try to enrich allocationMap with device info from order allocations by deviceId
  // First, create a deviceId -> device info map from order allocations
  const deviceInfoFromOrder = {};
  if (order && Array.isArray(order.orderDetails)) {
    order.orderDetails.forEach(od => {
      const deviceModelName = od.deviceModel?.deviceName || od.deviceModel?.name || od.deviceName || "—";
      if (od.allocations && Array.isArray(od.allocations)) {
        od.allocations.forEach(allocation => {
          const deviceId = allocation.device?.deviceId || allocation.deviceId;
          const serialNumber = allocation.device?.serialNumber || allocation.serialNumber;
          if (deviceId) {
            deviceInfoFromOrder[deviceId] = {
              serialNumber: serialNumber || "—",
              deviceModelName: deviceModelName,
              allocationId: allocation.allocationId,
            };
          }
        });
      }
    });
  }
  
  // Now enrich allocationMap using deviceId from deviceConditions
  if (Array.isArray(report.deviceConditions)) {
    report.deviceConditions.forEach(dc => {
      if (dc.allocationId && dc.deviceId) {
        const deviceInfo = deviceInfoFromOrder[dc.deviceId];
        if (deviceInfo && allocationMap[dc.allocationId]) {
          // Update with device info from order
          if (!allocationMap[dc.allocationId].deviceModelName || allocationMap[dc.allocationId].deviceModelName === "—") {
            allocationMap[dc.allocationId].deviceModelName = deviceInfo.deviceModelName;
          }
          if (!allocationMap[dc.allocationId].serialNumber || allocationMap[dc.allocationId].serialNumber === "—") {
            allocationMap[dc.allocationId].serialNumber = deviceInfo.serialNumber;
          }
        }
      }
    });
  }
  
  // Also try to find device info for items that have allocationId but not in allocationMap yet
  if (Array.isArray(report.items)) {
    report.items.forEach(item => {
      if (item.allocationId && !allocationMap[item.allocationId]) {
        // Try to find by allocationId in order
        if (order && Array.isArray(order.orderDetails)) {
          order.orderDetails.forEach(od => {
            if (od.allocations && Array.isArray(od.allocations)) {
              od.allocations.forEach(allocation => {
                if (allocation.allocationId === item.allocationId) {
                  const deviceId = allocation.device?.deviceId || allocation.deviceId;
                  const serialNumber = allocation.device?.serialNumber || allocation.serialNumber;
                  const deviceModelName = od.deviceModel?.deviceName || od.deviceModel?.name || od.deviceName || "—";
                  
                  allocationMap[item.allocationId] = {
                    deviceId: deviceId,
                    serialNumber: serialNumber || "—",
                    deviceModelName: deviceModelName,
                    unit: "cái",
                    quantity: od.quantity || 1,
                  };
                }
              });
            }
          });
        }
        
        // If still not found, try to find from deviceConditions by allocationId
        if (!allocationMap[item.allocationId] && Array.isArray(report.deviceConditions)) {
          const deviceCondition = report.deviceConditions.find(dc => dc.allocationId === item.allocationId);
          if (deviceCondition && deviceCondition.deviceId) {
            const deviceInfo = deviceInfoFromOrder[deviceCondition.deviceId];
            if (deviceInfo) {
              allocationMap[item.allocationId] = {
                deviceId: deviceCondition.deviceId,
                serialNumber: deviceInfo.serialNumber,
                deviceModelName: deviceInfo.deviceModelName,
                unit: "cái",
                quantity: 1,
              };
            } else {
              // Fallback: use deviceCondition data
              let serialNumber = deviceCondition.deviceSerial || "—";
              if (!serialNumber && deviceCondition.baselineSnapshots && Array.isArray(deviceCondition.baselineSnapshots)) {
                const firstSnapshot = deviceCondition.baselineSnapshots[0];
                if (firstSnapshot && firstSnapshot.deviceSerial) {
                  serialNumber = firstSnapshot.deviceSerial;
                }
              }
              
              // Try to find device model name from order details by deviceId
              let deviceModelName = "—";
              if (order && Array.isArray(order.orderDetails)) {
                for (const od of order.orderDetails) {
                  if (od.allocations && Array.isArray(od.allocations)) {
                    for (const allocation of od.allocations) {
                      const deviceId = allocation.device?.deviceId || allocation.deviceId;
                      if (deviceId === deviceCondition.deviceId) {
                        deviceModelName = od.deviceModel?.deviceName || od.deviceModel?.name || od.deviceName || "—";
                        break;
                      }
                    }
                    if (deviceModelName !== "—") break;
                  }
                }
              }
              
              allocationMap[item.allocationId] = {
                deviceId: deviceCondition.deviceId,
                serialNumber: serialNumber,
                deviceModelName: deviceModelName,
                unit: "cái",
                quantity: 1,
              };
            }
          }
        }
      }
    });
  }
  
  // Build deviceConditions map by deviceId for quick lookup
  const deviceConditionsByDeviceId = {};
  if (Array.isArray(report.deviceConditions)) {
    report.deviceConditions.forEach(dc => {
      if (dc.deviceId) {
        if (!deviceConditionsByDeviceId[dc.deviceId]) {
          deviceConditionsByDeviceId[dc.deviceId] = [];
        }
        deviceConditionsByDeviceId[dc.deviceId].push(dc);
      }
    });
  }

  // Helper function to get conditions and images for a device
  const getDeviceConditionsHtml = (deviceId) => {
    const deviceConditions = deviceConditionsByDeviceId[deviceId] || [];
    if (deviceConditions.length === 0) {
      return { conditions: "—", images: "—" };
    }

    // Use Set to track unique conditions and images to avoid duplicates
    const uniqueConditions = new Set();
    const uniqueImages = new Set();
    
    deviceConditions.forEach(dc => {
      const snapshots = dc.baselineSnapshots || dc.snapshots || [];
      if (snapshots.length === 0) return;
      
      // Prioritize HANDOVER_OUT snapshot, fallback to QC_BEFORE, then others
      const handoverOutSnapshot = snapshots.find(s => String(s.source || "").toUpperCase() === "HANDOVER_OUT");
      const qcBeforeSnapshot = snapshots.find(s => String(s.source || "").toUpperCase() === "QC_BEFORE");
      const selectedSnapshot = handoverOutSnapshot || qcBeforeSnapshot || snapshots[0];
      
      // Collect conditions from selected snapshot
      const conditionDetails = selectedSnapshot.conditionDetails || [];
      conditionDetails.forEach(cd => {
        // Use conditionDefinitionId + severity as unique key
        const uniqueKey = `${cd.conditionDefinitionId}_${cd.severity}`;
        if (!uniqueConditions.has(uniqueKey)) {
          uniqueConditions.add(uniqueKey);
        }
      });
      
      // Collect images from selected snapshot
      if (Array.isArray(selectedSnapshot.images)) {
        selectedSnapshot.images.forEach(img => {
          // Use image URL as unique key
          const imgKey = img;
          if (!uniqueImages.has(imgKey)) {
            uniqueImages.add(imgKey);
          }
        });
      }
    });

    // Convert Set to Array and build HTML
    const conditionsArray = Array.from(uniqueConditions).map(key => {
      const [conditionDefId] = key.split("_");
      const conditionDef = conditionMap[conditionDefId];
      const conditionName = conditionDef?.name || `Tình trạng #${conditionDefId}`;
      return `${conditionName}`;
    });
    
    const conditionsHtml = conditionsArray.length > 0 
      ? conditionsArray.map(c => `<div>${c}</div>`).join("")
      : "—";
    
    const imagesArray = Array.from(uniqueImages);
    const imagesHtml = imagesArray.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px">
          ${imagesArray.map((img, imgIdx) => {
            const imgSrc = img.startsWith("data:image") ? img : img;
            return `
              <img 
                src="${imgSrc}" 
                alt="Ảnh ${imgIdx + 1}"
                style="
                  max-width:80px;
                  max-height:80px;
                  border:1px solid #ddd;
                  border-radius:4px;
                  object-fit:contain;
                "
                onerror="this.style.display='none';"
              />
            `;
          }).join("")}
        </div>`
      : "—";

    return { conditions: conditionsHtml, images: imagesHtml };
  };

  // Build items rows - prioritize new format with deviceSerialNumber and deviceModelName
  const itemsRows = (report.items || []).map((item, idx) => {
    // Get device conditions and images by deviceId
    const deviceId = item.deviceId;
    const { conditions, images } = deviceId ? getDeviceConditionsHtml(deviceId) : { conditions: "—", images: "—" };

    // Newest format: use deviceSerialNumber and deviceModelName directly from items
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
    
    // New format: use allocationId to get device info
    if (item.allocationId) {
      const deviceInfo = allocationMap[item.allocationId];
      if (deviceInfo) {
        // Try to get deviceId from deviceInfo or find by allocationId
        let lookupDeviceId = deviceInfo.deviceId;
        if (!lookupDeviceId && Array.isArray(report.deviceConditions)) {
          const dc = report.deviceConditions.find(d => d.allocationId === item.allocationId);
          if (dc) lookupDeviceId = dc.deviceId;
        }
        const { conditions, images } = lookupDeviceId ? getDeviceConditionsHtml(lookupDeviceId) : { conditions: "—", images: "—" };
        
        return `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${deviceInfo.deviceModelName}</td>
            <td>${deviceInfo.serialNumber}</td>
            <td style="text-align:center">${deviceInfo.unit}</td>
            <td style="text-align:center">${deviceInfo.quantity}</td>
            <td style="text-align:center">${deviceInfo.quantity}</td>
            <td>${conditions}</td>
            <td>${images}</td>
          </tr>
        `;
      } else {
        // Nếu không tìm thấy trong allocationMap, thử lấy từ deviceConditions
        if (Array.isArray(report.deviceConditions)) {
          const deviceCondition = report.deviceConditions.find(dc => dc.allocationId === item.allocationId);
          if (deviceCondition && deviceCondition.deviceId) {
            // Thử tìm device model name từ order details
            let deviceModelName = "—";
            let serialNumber = deviceCondition.deviceSerial || "—";
            
            if (order && Array.isArray(order.orderDetails)) {
              for (const od of order.orderDetails) {
                if (od.allocations && Array.isArray(od.allocations)) {
                  for (const allocation of od.allocations) {
                    const deviceId = allocation.device?.deviceId || allocation.deviceId;
                    if (deviceId === deviceCondition.deviceId) {
                      deviceModelName = od.deviceModel?.deviceName || od.deviceModel?.name || od.deviceName || "—";
                      if (!serialNumber || serialNumber === "—") {
                        serialNumber = allocation.device?.serialNumber || allocation.serialNumber || "—";
                      }
                      break;
                    }
                  }
                  if (deviceModelName !== "—") break;
                }
              }
            }
            
            const { conditions, images } = deviceCondition.deviceId ? getDeviceConditionsHtml(deviceCondition.deviceId) : { conditions: "—", images: "—" };
            
            return `
              <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${deviceModelName}</td>
                <td>${serialNumber}</td>
                <td style="text-align:center">cái</td>
                <td style="text-align:center">1</td>
                <td style="text-align:center">1</td>
                <td>${conditions}</td>
                <td>${images}</td>
              </tr>
            `;
          }
        }
        
        // Fallback: hiển thị allocationId nếu không tìm thấy
        return `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>—</td>
            <td>— (allocationId: ${item.allocationId})</td>
            <td style="text-align:center">cái</td>
            <td style="text-align:center">1</td>
            <td style="text-align:center">1</td>
            <td>—</td>
            <td>—</td>
          </tr>
        `;
      }
    }
    // Old format: use itemName, itemCode
    return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${item.itemName || "—"}</td>
        <td>${item.itemCode || "—"}</td>
        <td style="text-align:center">${item.unit || "—"}</td>
        <td style="text-align:center">${item.orderedQuantity || 0}</td>
        <td style="text-align:center">${item.deliveredQuantity || 0}</td>
        <td>—</td>
        <td>—</td>
      </tr>
    `;
  }).join("");
  
  const qualityRows = (report.deviceQualityInfos || []).map((q, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${q.deviceModelName || "—"}</td>
      <td>${q.deviceSerialNumber || "—"}</td>
      <td>${q.qualityStatus === "GOOD" ? "Tốt" : q.qualityStatus === "FAIR" ? "Khá" : q.qualityStatus === "POOR" ? "Kém" : q.qualityStatus || "—"}</td>
      <td>${q.qualityDescription || "—"}</td>
    </tr>
  `).join("");
  
  // Determine handover type
  const handoverType = String(report.handoverType || "").toUpperCase();
  const isCheckin = handoverType === "CHECKIN";
  const conditionColumnLabel = isCheckin ? "Tình trạng thiết bị khi bàn giao" : "Tình trạng thiết bị";
  
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
      .print-pdf-root ol, .print-pdf-root ul { margin: 6px 0 6px 18px; padding: 0; }
      .print-pdf-root li { margin: 3px 0; }
      .print-pdf-root .kv { margin-bottom: 10px; }
      .print-pdf-root .kv div { margin: 2px 0; }
      .print-pdf-root table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      .print-pdf-root table th, .print-pdf-root table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      .print-pdf-root table th { background-color: #f5f5f5; font-weight: 600; }
    </style>
    <div class="print-pdf-root"
         style="padding:24px; font-size:12px; line-height:1.6; color:#000;">
      ${NATIONAL_HEADER_HTML}
      
      <h1 style="text-align:center; margin:16px 0">${isCheckin ? "BIÊN BẢN THU HỒI THIẾT BỊ" : "BIÊN BẢN BÀN GIAO THIẾT BỊ"}</h1>
      
      <section class="kv">
        <div><b>Mã biên bản:</b> #${report.handoverReportId || report.id || "—"}</div>
        <div><b>Mã đơn hàng:</b> #${report.orderId || "—"}</div>
        ${isCheckin 
          ? `<div><b>Thời gian thu hồi:</b> ${formatDateTime(report.handoverDateTime)}</div>
             <div><b>Địa điểm thu hồi:</b> ${report.handoverLocation || "—"}</div>`
          : `<div><b>Thời gian bàn giao:</b> ${formatDateTime(report.handoverDateTime)}</div>
             <div><b>Địa điểm bàn giao:</b> ${report.handoverLocation || "—"}</div>`}
        <div><b>Trạng thái:</b> ${translateHandoverStatus(report.status)}</div>
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
      
      <h3>${isCheckin ? "Danh sách thiết bị thu hồi" : "Danh sách thiết bị bàn giao"}</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Tên thiết bị</th>
            <th>Mã thiết bị (Serial Number)</th>
            <th style="width:80px">Đơn vị</th>
            <th style="width:80px;text-align:center">SL đặt</th>
            <th style="width:80px;text-align:center">SL giao</th>
            <th>${conditionColumnLabel}</th>
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
        // For CHECKIN: show discrepancies
        if (isCheckin && (report.discrepancies || []).length > 0) {
          return `
      <h3>Sự cố thiết bị khi thu hồi</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Loại sự cố</th>
            <th>Thiết bị (Serial Number)</th>
            <th>Tình trang thiết bị</th>
            <th>Phí phạt</th>
            <th>Ghi chú nhân viên</th>
           
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
            const conditionName = conditionDef?.name || `Tình trạng  #${disc.conditionDefinitionId}`;
            const discrepancyType = disc.discrepancyType === "DAMAGE" ? "Hư hỏng" : 
                                   disc.discrepancyType === "LOSS" ? "Mất mát" : 
                                   disc.discrepancyType === "OTHER" ? "Khác" : disc.discrepancyType || "—";
            
            // Format penalty amount
            const penaltyAmount = disc.penaltyAmount != null && disc.penaltyAmount !== undefined 
              ? formatVND(Number(disc.penaltyAmount))
              : "—";
            
            return `
              <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${discrepancyType}</td>
                <td>${deviceSerial}</td>
                <td>${conditionName}</td>
                <td style="text-align:right">${penaltyAmount}</td>
                <td>${disc.staffNote || "—"}</td>
                
              </tr>
            `;
          }).join("") || "<tr><td colspan='7' style='text-align:center'>Không có sự cố nào</td></tr>"}
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

/**
 * Convert HTML element to PDF blob for handover reports
 */
export async function elementToPdfBlobHandover(el) {
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

