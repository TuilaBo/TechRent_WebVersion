// src/pages/technician/TechnicianCalendar.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Card,
  List,
  Tag,
  Space,
  Button,
  Drawer,
  Descriptions,
  Upload,
  Typography,
  Divider,
  message,
  Select,
  Table,
  Input,
  Modal,
} from "antd";
import {
  EnvironmentOutlined,
  PhoneOutlined,
  InboxOutlined,
  FileTextOutlined,
  ReloadOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  listTasks,
  getTaskById,
  normalizeTask,
  confirmDelivery,
  confirmRetrieval,
} from "../../lib/taskApi";
import { getQcReportsByOrderId } from "../../lib/qcReportApi";
import {
  TECH_TASK_STATUS,
  getTechnicianStatusColor,
} from "../../lib/technicianTaskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel, fmtVND } from "../../lib/deviceModelsApi";
import { 
  getHandoverReportByOrderIdAndTaskId,
  getHandoverReportsByOrderId
} from "../../lib/handoverReportApi";
import { getConditionDefinitions } from "../../lib/condition.js";

const { Title, Text } = Typography;
const { Dragger } = Upload;

/** ----- Loại task & màu sắc ----- */
const TYPES = {
  QC: { color: "blue", label: "CHECK QC outbound" },
  HANDOVER_CHECK: { color: "geekblue", label: "CHECK BIÊN BẢN" },
  MAINTAIN: { color: "orange", label: "BẢO TRÌ THIẾT BỊ" },
  DELIVERY: { color: "green", label: "ĐI GIAO THIẾT BỊ" },
};

// Map BE task to display fields used by the calendar UI
const taskToDisplay = (t) => ({
  id: t.taskId ?? t.id,
  type: t.type || "QC",
  title: t.description || t.type || t.taskCategoryName || "Task",
  description: t.description || "", // Keep description for pickup task detection
  date: t.plannedStart || t.createdAt || null,
  device: t.deviceName || t.taskCategoryName || "Thiết bị",
  location: t.location || "—",
  orderId: t.orderId ?? null,
  status: t.status ?? null,
  taskCategoryName: t.taskCategoryName || "",
  assignedStaffName: t.assignedStaffName || "",
  assignedStaffRole: t.assignedStaffRole || "",
  plannedStart: t.plannedStart || null,
  plannedEnd: t.plannedEnd || null,
  completedAt: t.completedAt || null,
});

const fmtStatus = (s) => {
  const v = String(s || "").toUpperCase();
  if (!v) return "";
  if (v.includes("PENDING")) return "Đang chờ thực hiện";
  if (v.includes("COMPLETED") || v.includes("DONE")) return "Đã hoàn thành";
  if (v.includes("IN_PROGRESS") || v.includes("INPROGRESS")) return "Đang thực hiện";
  if (v.includes("CANCELLED") || v.includes("CANCELED")) return "Đã hủy";
  if (v.includes("FAILED") || v.includes("FAIL")) return "Thất bại";
  return v;
};

// Format thời gian nhất quán
const fmtDateTime = (date) => {
  if (!date) return "—";
  return dayjs(date).format("DD/MM/YYYY HH:mm");
};

const fmtDate = (date) => {
  if (!date) return "—";
  return dayjs(date).format("DD/MM/YYYY");
};

// Dịch status đơn hàng
const fmtOrderStatus = (s) => {
  const v = String(s || "").toUpperCase();
  if (!v) return "—";
  if (v.includes("PENDING")) return "Chờ xử lý";
  if (v.includes("PROCESSING")) return "Đang xử lý";
  if (v.includes("COMPLETED") || v.includes("DONE")) return "Đã hoàn thành";
  if (v.includes("CANCELLED") || v.includes("CANCELED")) return "Đã hủy";
  if (v.includes("DELIVERED")) return "Đã giao";
  if (v.includes("RETURNED")) return "Đã trả";
  return v;
};

/** Kiểm tra xem task có phải là Pre rental QC không */
const isPreRentalQC = (task) => {
  if (!task) return false;
  const categoryName = String(task.taskCategoryName || "").toUpperCase();
  const type = String(task.type || "").toUpperCase();
  
  // Kiểm tra taskCategoryName: "Pre rental QC", "PRE_RENTAL_QC", etc.
  if (categoryName.includes("PRE") && categoryName.includes("RENTAL") && categoryName.includes("QC")) {
    return true;
  }
  
  // Kiểm tra type: "PRE_RENTAL_QC", "Pre rental QC", etc.
  if (type.includes("PRE_RENTAL_QC") || (type.includes("PRE") && type.includes("RENTAL") && type.includes("QC"))) {
    return true;
  }
  
  return false;
};

/** Kiểm tra xem task có phải là PickUp/Retrieval không */
const isPickupTask = (task) => {
  if (!task) return false;
  const categoryName = String(task.taskCategoryName || "").toUpperCase();
  const type = String(task.type || "").toUpperCase();
  const description = String(task.description || "").toUpperCase();
  
  // Kiểm tra type: "PICKUP", "PICK UP", "RETURN", "RETRIEVAL", etc.
  if (type.includes("PICKUP") || type.includes("PICK UP") || type.includes("RETURN") || type.includes("RETRIEVAL")) {
    return true;
  }
  
  // Kiểm tra categoryName: "PICK UP RENTAL ORDER", "PICKUP", etc.
  if (categoryName.includes("PICKUP") || categoryName.includes("PICK UP") || categoryName.includes("RETURN") || categoryName.includes("RETRIEVAL")) {
    return true;
  }
  
  // Kiểm tra description
  if (description.includes("THU HỒI") || description.includes("TRẢ HÀNG") || description.includes("PICKUP") || description.includes("PICK UP")) {
    return true;
  }
  
  return false;
};

// PDF Helpers - Tham khảo từ TechnicianHandover.jsx
// ĐÃ SCOPE STYLE VÀO .print-pdf-root ĐỂ KHÔNG ẢNH HƯỞNG UI BÊN NGOÀI
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

    .print-pdf-root ol,
    .print-pdf-root ul {
      margin: 6px 0 6px 18px;
      padding: 0;
    }

    .print-pdf-root li {
      margin: 3px 0;
    }

    .print-pdf-root .kv {
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

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return dayjs(iso).format("DD/MM/YYYY HH:mm");
  } catch {
    return iso;
  }
}

function parseInfoString(infoStr) {
  if (!infoStr) return { name: "", phone: "", email: "" };
  const parts = infoStr.split("•").map(s => s.trim()).filter(Boolean);
  return {
    name: parts[0] || "",
    phone: parts[1] || "",
    email: parts[2] || "",
  };
}

function translateRole(role) {
  const r = String(role || "").toUpperCase();
  if (r === "TECHNICIAN") return "Kỹ thuật viên";
  return role;
}

function translateHandoverStatus(status) {
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
}

function buildPrintableHandoverReportHtml(report, order = null, conditionDefinitions = []) {
  const customerInfo = parseInfoString(report.customerInfo);
  const technicianInfo = parseInfoString(report.technicianInfo || report.staffSignature);
  const customerName = customerInfo.name || "—";
  const technicianName = technicianInfo.name || "—";
  
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
  
  // Debug: Log allocationMap để kiểm tra
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 AllocationMap:', allocationMap);
    console.log('🔍 Report items:', report.items);
    console.log('🔍 Order data:', order);
    console.log('🔍 DeviceConditions:', report.deviceConditions);
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
        const conditionDef = conditionMap[cd.conditionDefinitionId];
        const conditionName = conditionDef?.name || `Điều kiện #${cd.conditionDefinitionId}`;
        const severity = cd.severity === "LOW" ? "Thấp" : cd.severity === "MEDIUM" ? "Trung bình" : cd.severity === "HIGH" ? "Cao" : cd.severity === "CRITICAL" ? "Rất nặng" : cd.severity || "—";
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
      const [conditionDefId, severity] = key.split("_");
      const conditionDef = conditionMap[conditionDefId];
      const conditionName = conditionDef?.name || `Điều kiện #${conditionDefId}`;
      const severityText = severity === "LOW" ? "Thấp" : severity === "MEDIUM" ? "Trung bình" : severity === "HIGH" ? "Cao" : severity === "CRITICAL" ? "Rất nặng" : severity || "—";
      return `${conditionName} (${severityText})`;
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
  
  const techniciansList = (report.technicians || []).map(t => {
    const name = t.fullName || t.username || `Nhân viên #${t.staffId}`;
    const phone = t.phoneNumber || "";
    return `<li><strong>${name}</strong>${phone ? `<br/>Số điện thoại: ${phone}` : ""}</li>`;
  }).join("");
  
  return `
    ${GLOBAL_PRINT_CSS}
    <div class="print-pdf-root"
         style="padding:24px; font-size:12px; line-height:1.6; color:#000;">
      ${NATIONAL_HEADER_HTML}
      
      ${(() => {
        const handoverType = String(report.handoverType || "").toUpperCase();
        const isCheckin = handoverType === "CHECKIN";
        return isCheckin 
          ? `<h1 style="text-align:center; margin:16px 0">BIÊN BẢN THU HỒI THIẾT BỊ</h1>`
          : `<h1 style="text-align:center; margin:16px 0">BIÊN BẢN BÀN GIAO THIẾT BỊ</h1>`;
      })()}
      
      <section class="kv">
        <div><b>Mã biên bản:</b> #${report.handoverReportId || report.id || "—"}</div>
        <div><b>Mã đơn hàng:</b> #${report.orderId || "—"}</div>
        <div><b>Mã task:</b> #${report.taskId || "—"}</div>
        ${(() => {
          const handoverType = String(report.handoverType || "").toUpperCase();
          const isCheckin = handoverType === "CHECKIN";
          return isCheckin
            ? `<div><b>Thời gian thu hồi:</b> ${formatDateTime(report.handoverDateTime)}</div>
               <div><b>Địa điểm thu hồi:</b> ${report.handoverLocation || "—"}</div>`
            : `<div><b>Thời gian bàn giao:</b> ${formatDateTime(report.handoverDateTime)}</div>
               <div><b>Địa điểm bàn giao:</b> ${report.handoverLocation || "—"}</div>`;
        })()}
        <div><b>Trạng thái:</b> ${translateHandoverStatus(report.status)}</div>
      </section>
      
      <h3>Thông tin khách hàng</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${customerName}</div>
        ${customerInfo.phone ? `<div><b>Số điện thoại:</b> ${customerInfo.phone}</div>` : ""}
        ${customerInfo.email ? `<div><b>Email:</b> ${customerInfo.email}</div>` : ""}
      </section>
      
      <h3>Thông tin kỹ thuật viên</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${technicianName}</div>
        ${technicianInfo.phone ? `<div><b>Số điện thoại:</b> ${technicianInfo.phone}</div>` : ""}
        ${technicianInfo.email ? `<div><b>Email:</b> ${technicianInfo.email}</div>` : ""}
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
            <th>Điều kiện</th>
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
      
      ${techniciansList ? `
      <h3>Kỹ thuật viên tham gia</h3>
      <ul>
        ${techniciansList}
      </ul>
      ` : ""}
      
      ${(() => {
        const handoverType = String(report.handoverType || "").toUpperCase();
        const isCheckin = handoverType === "CHECKIN";
        
        // For CHECKIN: show discrepancies
        if (isCheckin && (report.discrepancies || []).length > 0) {
          return `
      <h3>Sự cố/Chênh lệch (Discrepancies)</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Loại sự cố</th>
            <th>Thiết bị (Serial Number)</th>
            <th>Điều kiện</th>
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
            const conditionName = conditionDef?.name || `Điều kiện #${disc.conditionDefinitionId}`;
            const discrepancyType = disc.discrepancyType === "DAMAGE" ? "Hư hỏng" : 
                                   disc.discrepancyType === "LOSS" ? "Mất mát" : 
                                   disc.discrepancyType === "OTHER" ? "Khác" : disc.discrepancyType || "—";
            
            return `
              <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${discrepancyType}</td>
                <td>${deviceSerial}</td>
                <td>${conditionName}</td>
                <td>${disc.staffNote || "—"}</td>
                <td>${disc.customerNote || "—"}</td>
              </tr>
            `;
          }).join("") || "<tr><td colspan='6' style='text-align:center'>Không có sự cố nào</td></tr>"}
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
            ${report.customerSigned ? '<div style="font-size:48px;color:#52c41a;line-height:1">✓</div>' : ""}
          </div>
          <div>
            ${report.customerSigned 
              ? `<div style="color:#52c41a;font-weight:600">${customerName} đã ký</div>` 
              : "(Ký, ghi rõ họ tên)"}
          </div>
        </div>
        <div style="flex:1;text-align:center">
          <div><b>NHÂN VIÊN</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${report.staffSigned ? '<div style="font-size:48px;color:#52c41a;line-height:1">✓</div>' : ""}
          </div>
          <div>
            ${report.staffSigned 
              ? `<div style="color:#52c41a;font-weight:600">${technicianName} đã ký</div>` 
              : "(Ký, ghi rõ họ tên)"}
          </div>
        </div>
      </section>
    </div>
  `;
}

async function elementToPdfBlob(el) {
  // Đảm bảo font được load bằng cách kiểm tra font availability
  const checkFont = () => {
    if (document.fonts && document.fonts.check) {
      // Kiểm tra các font có sẵn
      const fonts = [
        '12px Arial',
        '12px Helvetica',
        '12px "Times New Roman"',
        '12px "DejaVu Sans"'
      ];
      return fonts.some(font => document.fonts.check(font));
    }
    return true; // Nếu không hỗ trợ font checking, giả định font có sẵn
  };
  
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

export default function TechnicianCalendar() {
  const [tasksAll, setTasksAll] = useState([]);
  const [detailTask, setDetailTask] = useState(null); // task được click (đầy đủ từ API detail)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const [orderDetail, setOrderDetail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterOrderId, setFilterOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTaskId, setSearchTaskId] = useState("");
  // Map: taskId -> hasQcReport (boolean)
  const [hasQcReportMap, setHasQcReportMap] = useState({});
  // Map: taskId -> handoverReport (object or null)
  const [handoverReportMap, setHandoverReportMap] = useState({});
  // Map: orderId -> handoverReports (array)
  const [handoverReportsByOrder, setHandoverReportsByOrder] = useState({});
  const [confirmingDelivery, setConfirmingDelivery] = useState({}); // taskId -> loading
  const [confirmingRetrieval, setConfirmingRetrieval] = useState({}); // taskId -> loading
  const [confirmedTasks, setConfirmedTasks] = useState(new Set()); // Set of taskIds (string) that have been confirmed (delivery)
  const [confirmedRetrievalTasks, setConfirmedRetrievalTasks] = useState(new Set()); // Set of taskIds (string) that have been confirmed (retrieval)
  // PDF states
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const printRef = useRef(null);

  const viewOrderDetail = async (oid) => {
    if (!oid) return;
    try {
      const od = await getRentalOrderById(oid);
      let enriched = od || null;
      // attach device model info for each order detail
      if (enriched && Array.isArray(enriched.orderDetails) && enriched.orderDetails.length) {
        const ids = Array.from(new Set(enriched.orderDetails.map((d) => d.deviceModelId).filter(Boolean)));
        const pairs = await Promise.all(
          ids.map(async (id) => {
            try { const m = await getDeviceModelById(id); return [id, normalizeModel(m)]; }
            catch { return [id, null]; }
          })
        );
        const modelMap = Object.fromEntries(pairs);
        enriched = {
          ...enriched,
          orderDetails: enriched.orderDetails.map((d) => ({ ...d, deviceModel: modelMap[d.deviceModelId] || null })),
        };
      }
      setOrderDetail(enriched);
      // fetch customer info if available
      const cid = od?.customerId;
      if (cid) {
        try {
          const cus = await fetchCustomerById(cid);
          setCustomerDetail(normalizeCustomer ? normalizeCustomer(cus) : cus);
        } catch {
          setCustomerDetail(null);
        }
      } else {
        setCustomerDetail(null);
      }
      if (!od) toast.error("Không tìm thấy đơn hàng");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không tải được đơn hàng");
    }
  };

  // Load all tasks từ /api/staff/tasks (backend tự filter theo technician từ token)
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const allTasksRaw = await listTasks();
      const allTasks = allTasksRaw.map(normalizeTask);
      const display = allTasks.map(taskToDisplay);
      setTasksAll(display);

      // Check which tasks have QC reports (for both Pre Rental QC and PickUp tasks)
      // Lấy theo orderId thay vì taskId
      const qcReportMap = {};
      const preRentalQcTasks = allTasks.filter((task) => isPreRentalQC(task));
      const pickupTasks = allTasks.filter((task) => isPickupTask(task));
      
      // Combine both types of tasks that need QC reports
      const tasksNeedingQc = [...preRentalQcTasks, ...pickupTasks];
      
      // Group tasks by orderId to avoid duplicate API calls
      const tasksByOrderId = {};
      tasksNeedingQc.forEach((task) => {
        const orderId = task.orderId;
        const taskId = task.taskId || task.id;
        if (orderId && taskId) {
          if (!tasksByOrderId[orderId]) {
            tasksByOrderId[orderId] = [];
          }
          tasksByOrderId[orderId].push({ taskId, isPickup: isPickupTask(task) });
        }
      });
      
      // Check QC reports by orderId in parallel
      const qcReportChecks = Object.keys(tasksByOrderId).map(async (orderId) => {
        try {
          const qcReports = await getQcReportsByOrderId(orderId);
          const reports = Array.isArray(qcReports) ? qcReports : [];

          tasksByOrderId[orderId].forEach(({ taskId, isPickup }) => {
            // For PickUp tasks, check for POST_RENTAL reports
            // For Pre Rental QC tasks, check for PRE_RENTAL reports
            const phaseToCheck = isPickup ? "POST_RENTAL" : "PRE_RENTAL";
            const hasReportForTask = reports.some(
              (r) => Number(r.taskId) === Number(taskId) && 
                     String(r.phase || "").toUpperCase() === phaseToCheck
            );

            if (hasReportForTask) {
              qcReportMap[taskId] = true;
            } else if (qcReportMap[taskId] === undefined) {
              qcReportMap[taskId] = false;
            }
          });
        } catch {
          // No QC report exists or error - that's fine
          tasksByOrderId[orderId].forEach(({ taskId }) => {
            qcReportMap[taskId] = false;
          });
        }
      });
      
      await Promise.all(qcReportChecks);
      setHasQcReportMap(qcReportMap);

      // Check which DELIVERY tasks have handover reports
      const deliveryTasks = allTasks.filter((task) => {
        const type = String(task.type || "").toUpperCase();
        const category = String(task.taskCategoryName || "").toUpperCase();
        return (
          type === "DELIVERY" ||
          category.includes("DELIVERY") ||
          category.includes("GIAO")
        );
      });

      const pickupTasksList = allTasks.filter((task) => isPickupTask(task));

      const handoverTasks = [];
      const seenHandoverTaskIds = new Set();
      [...deliveryTasks, ...pickupTasksList].forEach((task) => {
        const taskId = task.taskId || task.id;
        if (!taskId || seenHandoverTaskIds.has(taskId)) return;
        seenHandoverTaskIds.add(taskId);
        handoverTasks.push(task);
      });

      const handoverReportMapNew = {};
      const handoverChecks = handoverTasks.map(async (task) => {
        const taskId = task.taskId || task.id;
        const orderId = task.orderId;
        if (taskId && orderId) {
          try {
            const report = await getHandoverReportByOrderIdAndTaskId(orderId, taskId);
            if (report) {
              handoverReportMapNew[taskId] = report;
            }
          } catch {
            // No handover report exists - that's fine
            handoverReportMapNew[taskId] = null;
          }
        }
      });
      await Promise.all(handoverChecks);
      setHandoverReportMap((prev) => ({ ...prev, ...handoverReportMapNew }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không tải được nhiệm vụ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load handover report for a specific task
  const loadHandoverReport = useCallback(async (taskId, orderId) => {
    if (!taskId || !orderId) return;
    try {
      const report = await getHandoverReportByOrderIdAndTaskId(orderId, taskId);
      if (report) {
        setHandoverReportMap((prev) => ({ ...prev, [taskId]: report }));
      }
    } catch (e) {
      // No handover report exists - that's fine
      setHandoverReportMap((prev) => ({ ...prev, [taskId]: null }));
    }
  }, []);

  // Load all handover reports for an order
  const loadHandoverReportsByOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const reports = await getHandoverReportsByOrderId(orderId);
      setHandoverReportsByOrder((prev) => ({ ...prev, [orderId]: Array.isArray(reports) ? reports : [] }));
    } catch (e) {
      setHandoverReportsByOrder((prev) => ({ ...prev, [orderId]: [] }));
    }
  }, []);

  // Reload handover reports when drawer opens for a delivery or pickup task
  useEffect(() => {
    if (drawerOpen && detailTask) {
      const taskType = String(detailTask.type || "").toUpperCase();
      const taskCategoryName = String(detailTask.taskCategoryName || "").toUpperCase();
      const description = String(detailTask.description || detailTask.title || "").toUpperCase();
      const isDeliveryTask = taskType === "DELIVERY" || 
                             taskCategoryName.includes("DELIVERY") || 
                             taskCategoryName.includes("GIAO") ||
                             description.includes("GIAO");
      const isPickupTaskType = isPickupTask(detailTask);
      
      if ((isDeliveryTask || isPickupTaskType) && detailTask.orderId) {
        const taskId = detailTask.taskId || detailTask.id;
        const orderId = detailTask.orderId;
        
        // Load handover reports for the order (includes both CHECKOUT and CHECKIN)
        loadHandoverReportsByOrder(orderId);
        
        // Load handover report for this specific task
        if (taskId && orderId) {
          loadHandoverReport(taskId, orderId);
        }
      }
    }
  }, [drawerOpen, detailTask, loadHandoverReport, loadHandoverReportsByOrder]);

  // Handle preview PDF
  const handlePreviewPdf = useCallback(async (report) => {
    try {
      setPdfGenerating(true);
      setSelectedReport(report);
      
      // Revoke old blob URL
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl("");
      }
      
      // Fetch order and condition definitions
      let order = null;
      let conditionDefinitions = [];
      
      if (report.orderId) {
        try {
          order = await getRentalOrderById(report.orderId);
          // Enrich order with device model info
          if (order && Array.isArray(order.orderDetails)) {
            const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
            const modelPairs = await Promise.all(
              modelIds.map(async (id) => {
                try {
                  const m = await getDeviceModelById(id);
                  return [id, normalizeModel(m)];
                } catch {
                  return [id, null];
                }
              })
            );
            const modelMap = Object.fromEntries(modelPairs);
            order = {
              ...order,
              orderDetails: order.orderDetails.map(od => ({
                ...od,
                deviceModel: modelMap[od.deviceModelId] || null,
              })),
            };
          }
        } catch (e) {
          console.warn("Could not fetch order for PDF:", e);
        }
      }
      
      try {
        conditionDefinitions = await getConditionDefinitions();
      } catch (e) {
        console.warn("Could not fetch condition definitions for PDF:", e);
      }
      
      if (printRef.current) {
        // Tạm thời hiển thị container để render
        printRef.current.style.visibility = "visible";
        printRef.current.style.opacity = "1";
        printRef.current.style.left = "-99999px";
        printRef.current.style.top = "-99999px";
        printRef.current.style.width = "794px";
        printRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
        
        printRef.current.innerHTML = buildPrintableHandoverReportHtml(report, order, conditionDefinitions);
        
        // Đảm bảo font được áp dụng cho tất cả phần tử và đợi render
        const allElements = printRef.current.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.style) {
            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
            el.style.webkitFontSmoothing = "antialiased";
            el.style.mozOsxFontSmoothing = "grayscale";
          }
        });
        
        // Force reflow để đảm bảo style được áp dụng
        printRef.current.offsetHeight;
        
        // Đợi font được load và render
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const blob = await elementToPdfBlob(printRef.current);
        
        // Ẩn lại container sau khi render xong
        printRef.current.style.visibility = "hidden";
        printRef.current.style.opacity = "0";
        
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setPdfModalOpen(true);
      }
    } catch (e) {
      console.error("Error generating PDF:", e);
      toast.error("Không thể tạo bản xem trước PDF");
    } finally {
      setPdfGenerating(false);
    }
  }, [pdfBlobUrl]);

  // Handle download PDF
  const handleDownloadPdf = useCallback(async (report) => {
    try {
      setPdfGenerating(true);
      
      // Revoke old blob URL
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl("");
      }
      
      // Fetch order and condition definitions
      let order = null;
      let conditionDefinitions = [];
      
      if (report.orderId) {
        try {
          order = await getRentalOrderById(report.orderId);
          // Enrich order with device model info
          if (order && Array.isArray(order.orderDetails)) {
            const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
            const modelPairs = await Promise.all(
              modelIds.map(async (id) => {
                try {
                  const m = await getDeviceModelById(id);
                  return [id, normalizeModel(m)];
                } catch {
                  return [id, null];
                }
              })
            );
            const modelMap = Object.fromEntries(modelPairs);
            order = {
              ...order,
              orderDetails: order.orderDetails.map(od => ({
                ...od,
                deviceModel: modelMap[od.deviceModelId] || null,
              })),
            };
          }
        } catch (e) {
          console.warn("Could not fetch order for PDF:", e);
        }
      }
      
      try {
        conditionDefinitions = await getConditionDefinitions();
      } catch (e) {
        console.warn("Could not fetch condition definitions for PDF:", e);
      }
      
      if (printRef.current) {
        // Tạm thời hiển thị container để render
        printRef.current.style.visibility = "visible";
        printRef.current.style.opacity = "1";
        printRef.current.style.left = "-99999px";
        printRef.current.style.top = "-99999px";
        printRef.current.style.width = "794px";
        printRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
        
        printRef.current.innerHTML = buildPrintableHandoverReportHtml(report, order, conditionDefinitions);
        
        // Đảm bảo font được áp dụng cho tất cả phần tử và đợi render
        const allElements = printRef.current.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.style) {
            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
            el.style.webkitFontSmoothing = "antialiased";
            el.style.mozOsxFontSmoothing = "grayscale";
          }
        });
        
        // Force reflow để đảm bảo style được áp dụng
        printRef.current.offsetHeight;
        
        // Đợi font được load và render
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const blob = await elementToPdfBlob(printRef.current);
        
        // Ẩn lại container sau khi render xong
        printRef.current.style.visibility = "hidden";
        printRef.current.style.opacity = "0";
        
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `handover-report-${report.handoverReportId || report.id || "report"}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
      }
    } catch (e) {
      console.error("Error downloading PDF:", e);
      toast.error("Không thể tải PDF");
    } finally {
      setPdfGenerating(false);
    }
  }, [pdfBlobUrl]);

  // Click item trên bảng → mở Drawer
  const onClickTask = useCallback(async (task) => {
    try {
      const full = await getTaskById(task.id);
      if (full) {
        const normalized = normalizeTask(full);
        setDetailTask(normalized);
        // fetch order by ID if exists
        const oid = normalized?.orderId;
        setOrderDetail(null);
        if (oid) {
          viewOrderDetail(oid);
          // Luôn load handover reports for this order (cho tất cả tasks có orderId)
          await loadHandoverReportsByOrder(oid);
          
          // Load handover report for this specific task if it's a DELIVERY task
          // Check both type and taskCategoryName for delivery tasks
          const taskType = String(normalized.type || task.type || "").toUpperCase();
          const taskCategoryName = String(normalized.taskCategoryName || task.taskCategoryName || "").toUpperCase();
          const description = String(normalized.description || task.description || "").toUpperCase();
          const isDeliveryTask = taskType === "DELIVERY" || 
                                 taskCategoryName.includes("DELIVERY") || 
                                 taskCategoryName.includes("GIAO") ||
                                 description.includes("GIAO");
          
          // Load handover report cho task cụ thể nếu là delivery task
          const taskIdToUse = normalized.taskId || normalized.id || task.taskId || task.id;
          if (isDeliveryTask && taskIdToUse && oid) {
            try {
              await loadHandoverReport(taskIdToUse, oid);
            } catch (e) {
              console.warn("Could not load handover report for task:", e);
              // Không hiển thị lỗi vì có thể chưa có report
            }
          }
        }
      } else {
        setDetailTask(task);
        // Nếu không có full task, vẫn thử load handover reports nếu có orderId
        const oid = task?.orderId;
        if (oid) {
          try {
            await loadHandoverReportsByOrder(oid);
          } catch (e) {
            console.warn("Could not load handover reports for order:", e);
          }
        }
      }
      setDrawerOpen(true);
    } catch {
      toast.error("Không tải được chi tiết task");
      setDetailTask(task); // Fallback to display task
      // Vẫn thử load handover reports nếu có orderId
      const oid = task?.orderId;
      if (oid) {
        try {
          await loadHandoverReportsByOrder(oid);
        } catch (e) {
          console.warn("Could not load handover reports for order:", e);
        }
      }
      setDrawerOpen(true);
    }
  }, [loadHandoverReport, loadHandoverReportsByOrder]);

  // Xác nhận giao hàng
  const handleConfirmDelivery = useCallback(async (taskId) => {
    try {
      setConfirmingDelivery((prev) => ({ ...prev, [taskId]: true }));
      await confirmDelivery(taskId);
      toast.success("Đã xác nhận giao hàng thành công!");
      // Đánh dấu task đã được xác nhận
      const key = String(taskId);
      setConfirmedTasks((prev) => new Set([...prev, key]));
      // Reload tasks để cập nhật trạng thái
      await loadTasks();
      // Reload detail task nếu đang mở
      if (detailTask && (detailTask.taskId === taskId || detailTask.id === taskId)) {
        const full = await getTaskById(taskId);
        if (full) {
          setDetailTask(normalizeTask(full));
        }
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Không thể xác nhận giao hàng");
    } finally {
      setConfirmingDelivery((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [loadTasks, detailTask]);

  // Xác nhận đi trả hàng
  const handleConfirmRetrieval = useCallback(async (taskId) => {
    try {
      setConfirmingRetrieval((prev) => ({ ...prev, [taskId]: true }));
      await confirmRetrieval(taskId);
      toast.success("Đã xác nhận đi lấy hàng thành công!");
      // Đánh dấu task đã được xác nhận
      const key = String(taskId);
      setConfirmedRetrievalTasks((prev) => new Set([...prev, key]));
      // Reload tasks để cập nhật trạng thái
      await loadTasks();
      // Reload detail task nếu đang mở
      if (detailTask && (detailTask.taskId === taskId || detailTask.id === taskId)) {
        const full = await getTaskById(taskId);
        if (full) {
          setDetailTask(normalizeTask(full));
        }
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Không thể xác nhận đi trả hàng");
    } finally {
      setConfirmingRetrieval((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [loadTasks, detailTask]);

  // Table columns
  const columns = useMemo(
    () => [
      {
        title: "Mã nhiệm vụ",
        dataIndex: "id",
        key: "id",
        render: (v, r) => r.id || r.taskId || "—",
        width: 120,
      },
      {
        title: "Loại",
        dataIndex: "taskCategoryName",
        key: "category",
        render: (_, r) => r.taskCategoryName || TYPES[r.type]?.label || r.type,
      },
      {
        title: "Mô tả",
        dataIndex: "title",
        key: "title",
        ellipsis: true,
      },
      {
        title: "Mã đơn hàng",
        dataIndex: "orderId",
        key: "orderId",
        width: 130,
      },
      {
        title: "Deadline",
        dataIndex: "plannedEnd",
        key: "deadline",
        render: (_, r) => {
          const deadline = r.plannedEnd || r.plannedEndDate;
          return deadline ? dayjs(deadline).format("DD/MM/YYYY HH:mm") : "—";
        },
        width: 180,
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (s) => {
          const { bg, text } = getTechnicianStatusColor(s);
          return <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(s)}</Tag>;
        },
        filters: [
          { text: "Đang chờ thực hiện", value: "PENDING" },
          { text: "Đã hoàn thành", value: "COMPLETED" },
        ],
        onFilter: (value, record) => String(record.status).toUpperCase() === String(value).toUpperCase(),
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 350,
        render: (_, r) => (
          <Space>
            <Button size="small" onClick={() => onClickTask(r)}>Xem</Button>
            {isPreRentalQC(r) && (() => {
              const taskId = r.taskId || r.id;
              const hasQcReport = hasQcReportMap[taskId];
              const status = String(r.status || "").toUpperCase();
              const buttonLabel =
                status === "COMPLETED"
                  ? "Cập nhật QC Report"
                  : hasQcReport
                    ? "Cập nhật QC Report"
                    : "Tạo QC Report";

              return (
                <Button
                  size="small"
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={() => {
                    navigate(`/technician/tasks/qc/${taskId}`, { state: { task: r } });
                  }}
                >
                  {buttonLabel}
                </Button>
              );
            })()}
            {(String(r.type || "").toUpperCase() === "DELIVERY" || String(r.taskCategoryName || "").toUpperCase().includes("DELIVERY") || String(r.taskCategoryName || "").toUpperCase().includes("GIAO")) && (() => {
              const taskId = r.taskId || r.id;
              const status = String(r.status || "").toUpperCase();
              const isPending = status === "PENDING";
              const isCompleted = status === "COMPLETED";
              const isInProgress = status === "IN_PROGRESS";
              const taskKey = String(taskId);
              const isConfirmed = confirmedTasks.has(taskKey);
              const isLoading = confirmingDelivery[taskId];
              const handoverReport = handoverReportMap[taskId];
              const hasHandoverReport = !!handoverReport;
              
              return (
                <>
                  {/* Chỉ hiển thị nút "Tạo biên bản" khi không phải PENDING, không phải COMPLETED và chưa có handover report */}
                  {!isPending && !isCompleted && !hasHandoverReport && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={() => {
                        navigate(`/technician/tasks/handover/${taskId}`, { state: { task: r } });
                      }}
                    >
                      Tạo biên bản
                    </Button>
                  )}
                  {/* Hiển thị nút "Xem biên bản" nếu đã có handover report */}
                  {hasHandoverReport && (
                    <Button
                      size="small"
                      type="default"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        handlePreviewPdf(handoverReport);
                      }}
                    >
                      Xem biên bản
                    </Button>
                  )}
                  {/* Hiển thị nút "Xác nhận giao hàng" cho task DELIVERY */}
                  {!isCompleted && !isInProgress && !isConfirmed && (
                    <Button
                      size="small"
                      type="default"
                      loading={isLoading}
                      onClick={() => handleConfirmDelivery(taskId)}
                    >
                      Xác nhận giao hàng
                    </Button>
                  )}
            
                </>
              );
            })()}
            {isPickupTask(r) && (() => {
              const taskId = r.taskId || r.id;
              const status = String(r.status || "").toUpperCase();
              const isCompleted = status === "COMPLETED";
              const isInProgress = status === "IN_PROGRESS";
              const taskKey = String(taskId);
              const isConfirmed = confirmedRetrievalTasks.has(taskKey);
              const isLoading = confirmingRetrieval[taskId];
              const handoverReport = handoverReportMap[taskId];
              const hasCheckinReport =
                handoverReport &&
                String(handoverReport.handoverType || "").toUpperCase() ===
                  "CHECKIN";
              
              return (
                <>
                  {!isCompleted && !isInProgress && !isConfirmed && (
                    <Button
                      size="small"
                      type="default"
                      loading={isLoading}
                      onClick={() => handleConfirmRetrieval(taskId)}
                    >
                      Xác nhận đi lấy hàng
                    </Button>
                  )}
                  {/* Chỉ hiển thị nút "Tạo biên bản thu hồi" khi task đang xử lý và chưa có biên bản */}
                  {isInProgress && !hasCheckinReport && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={() => {
                        navigate(`/technician/tasks/handover-checkin/${taskId}`, { state: { task: r } });
                      }}
                    >
                      Tạo biên bản thu hồi
                    </Button>
                  )}
                  {/* Hiển thị nút xem nếu đã có biên bản */}
                  {hasCheckinReport && (
                    <Button
                      size="small"
                      type="default"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        handlePreviewPdf(handoverReport);
                      }}
                    >
                      Xem biên bản
                    </Button>
                  )}
                </>
              );
            })()}
          </Space>
        ),
      },
    ],
    [navigate, onClickTask, hasQcReportMap, confirmingDelivery, handleConfirmDelivery, confirmedTasks, confirmingRetrieval, handleConfirmRetrieval, confirmedRetrievalTasks, isPickupTask, handoverReportMap, handlePreviewPdf]
  );

  

  // HANDOVER_CHECK: upload ảnh bằng chứng (UI only)
  const evidenceProps = {
    beforeUpload: () => false,
    multiple: true,
    accept: ".jpg,.jpeg,.png,.webp,.pdf",
    onChange: () => message.success("Đã thêm bằng chứng (UI)."),
  };

  /** ---- UI phần chi tiết theo loại ---- */
  const renderDetailBody = (t) => {
    if (!t) return null;

    const header = (
      <Space wrap size={8}>
        <Tag color={TYPES[t.type]?.color || "blue"}>{TYPES[t.type]?.label || t.taskCategoryName || t.type}</Tag>
        <Text type="secondary">
          {fmtDateTime(t.date)} • {t.location || "—"}
        </Text>
        <Tag>{t.assignedBy === "admin" ? "Lịch Admin" : "Operator giao"}</Tag>
      </Space>
    );

    // === QC: chỉ hiển thị thông tin cơ bản + nút Thực hiện QC ===
    const isCompletedQC = String(t.status || "").toUpperCase() === "COMPLETED";
    
    if (t.type === "QC") {
      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
            <Descriptions.Item label="Mã đơn hàng">{t.orderId || "—"}</Descriptions.Item>
            <Descriptions.Item label="Số lượng">{t.quantity ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Thiết bị theo đơn">
              {Array.isArray(t.devices) ? t.devices.join(", ") : t.device}
            </Descriptions.Item>
            <Descriptions.Item label="Hạn chót">
              {fmtDateTime(t.deadline || t.plannedEnd)}
            </Descriptions.Item>
            <Descriptions.Item label="Category">{t.category || "—"}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{t.location || "—"}</Descriptions.Item>
            {isCompletedQC && (
              <>
                <Descriptions.Item label="Thời gian bắt đầu">
                  {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian kết thúc">
                  {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian hoàn thành">
                  {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
          <Divider />
          <Space wrap>
            {isPreRentalQC(t) && (() => {
              const taskId = t.taskId || t.id;
              const hasQcReport = hasQcReportMap[taskId];
              const status = String(t.status || "").toUpperCase();
              const buttonLabel =
                status === "COMPLETED"
                  ? "Cập nhật QC Report"
                  : hasQcReport
                    ? "Cập nhật QC Report"
                    : "Tạo QC Report";

              return (
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={() => {
                    navigate(`/technician/tasks/qc/${taskId}`, { state: { task: t } });
                  }}
                >
                  {buttonLabel}
                </Button>
              );
            })()}
          </Space>
        </>
      );
    }

    if (t.type === "HANDOVER_CHECK") {
      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
            <Descriptions.Item label="Mã đơn">{t.orderId}</Descriptions.Item>
            <Descriptions.Item label="Thiết bị">{t.device}</Descriptions.Item>
            <Descriptions.Item label="Khu vực">{t.location}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Title level={5} style={{ marginTop: 0 }}>
            Biên bản bàn giao
          </Title>
          <List
            dataSource={t.handovers || []}
            renderItem={(h) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{h.name}</Text>
                      <Tag color={h.status === "đã ký" ? "green" : "gold"}>
                        {h.status.toUpperCase()}
                      </Tag>
                    </Space>
                  }
                  description={
                    h.url ? (
                      <a href={h.url} target="_blank" rel="noreferrer">
                        Xem chi tiết
                      </a>
                    ) : (
                      <Text type="secondary">Chưa có tệp đính kèm</Text>
                    )
                  }
                />
              </List.Item>
            )}
          />
          <Divider />
          <Title level={5} style={{ marginTop: 0 }}>
            Thêm ảnh/biên bản chứng minh (UI)
          </Title>
          <Dragger {...evidenceProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>Kéo thả hoặc bấm để chọn</p>
          </Dragger>
        </>
      );
    }

    if (t.type === "MAINTAIN") {
      const next = t.lastMaintainedAt ? dayjs(t.lastMaintainedAt).add(t.cycleDays || 30, "day") : null;
      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
            <Descriptions.Item label="Thiết bị">{t.device}</Descriptions.Item>
            <Descriptions.Item label="Category">{t.category}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{t.location}</Descriptions.Item>
            <Descriptions.Item label="Lần bảo trì gần nhất">
              {fmtDateTime(t.lastMaintainedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Chu kỳ">
              {t.cycleDays ? `${t.cycleDays} ngày` : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Dự kiến lần kế tiếp">
              {next ? fmtDateTime(next) : "—"}
            </Descriptions.Item>
          </Descriptions>
          <Divider />
          <Text type="secondary">
            *Lịch bảo trì do Admin lập theo category. Kỹ thuật viên cập nhật kết quả sau khi hoàn tất.
          </Text>
        </>
      );
    }

    // Check if this is a DELIVERY task (check both type and taskCategoryName)
    const taskType = String(t.type || "").toUpperCase();
    const taskCategoryName = String(t.taskCategoryName || "").toUpperCase();
    const description = String(t.description || t.title || "").toUpperCase();
    const isDeliveryTask = taskType === "DELIVERY" || 
                           taskCategoryName.includes("DELIVERY") || 
                           taskCategoryName.includes("GIAO") ||
                           description.includes("GIAO");
    
    if (isDeliveryTask || t.type === "DELIVERY") {
      const taskId = t.taskId || t.id;
      const status = String(t.status || "").toUpperCase();
      const isPending = status === "PENDING";
      const isCompleted = status === "COMPLETED";
      const isInProgress = status === "IN_PROGRESS";
      const taskKey = String(taskId);
      const isConfirmed = confirmedTasks.has(taskKey);
      const isLoading = confirmingDelivery[taskId];
      
      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
            <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.type || "—"}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {t.status ? (() => { const { bg, text } = getTechnicianStatusColor(t.status); return (
                <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
              ); })() : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đơn">{t.orderId || "—"}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{t.title || t.description || "—"}</Descriptions.Item>
            {isCompleted && (
              <>
                <Descriptions.Item label="Thời gian bắt đầu nhiệm vụ">
                  {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian kết thúc nhiệm vụ">
                  {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian hoàn thành nhiệm vụ">
                  {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
          {orderDetail && (
            <>
              <Divider />
              <Title level={5} style={{ marginTop: 0 }}>Chi tiết đơn #{orderDetail.orderId || orderDetail.id}</Title>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Trạng thái">
                  {fmtOrderStatus(orderDetail.status || orderDetail.orderStatus)}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  {customerDetail ? (
                    <>
                      {customerDetail.fullName || customerDetail.username || "Khách hàng"}
                      {customerDetail.phoneNumber ? ` • ${customerDetail.phoneNumber}` : ""}
                      {customerDetail.email ? ` • ${customerDetail.email}` : ""}
                    </>
                  ) : (
                    orderDetail.customerId ?? "—"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian">
                  {orderDetail.startDate ? fmtDateTime(orderDetail.startDate) : "—"} → {orderDetail.endDate ? fmtDateTime(orderDetail.endDate) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ giao">{orderDetail.shippingAddress || "—"}</Descriptions.Item>
              </Descriptions>
              {Array.isArray(orderDetail.orderDetails) && orderDetail.orderDetails.length > 0 && (
                <>
                  <Divider />
                  <Title level={5} style={{ marginTop: 0 }}>Thiết bị trong đơn</Title>
                  <List
                    size="small"
                    dataSource={orderDetail.orderDetails}
                    renderItem={(d) => (
                      <List.Item>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {d.deviceModel?.image ? (
                            <img src={d.deviceModel.image} alt={d.deviceModel.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                          ) : null}
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {d.deviceModel?.name || `Model #${d.deviceModelId}`} {`× ${d.quantity}`}
                            </div>
                            {d.deviceModel && (
                              <div style={{ color: '#667085' }}>
                                {d.deviceModel.brand ? `${d.deviceModel.brand} • ` : ''}
                                Cọc: {fmtVND((d.deviceModel.deviceValue || 0) * (d.deviceModel.depositPercent || 0))}
                              </div>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </>
              )}
            </>
          )}
          <Divider />
          {/* Hiển thị handover report */}
          <Title level={5} style={{ marginTop: 0 }}>Biên bản bàn giao</Title>
          {(() => {
            const handoverReport = handoverReportMap[taskId];
            const orderReports = orderDetail ? handoverReportsByOrder[orderDetail.orderId || orderDetail.id] : null;
            // Filter chỉ lấy CHECKOUT reports cho DELIVERY tasks
            const checkoutReports = orderReports ? orderReports.filter(r => {
              const handoverType = String(r.handoverType || "").toUpperCase();
              return handoverType === "CHECKOUT" || !handoverType; // Include reports without handoverType for backward compatibility
            }) : [];
            const reportsToShow = handoverReport ? [handoverReport] : checkoutReports;
            
            if (reportsToShow.length > 0) {
              return (
                <List
                  dataSource={reportsToShow}
                  renderItem={(report) => (
                    <List.Item
                      actions={[
                        <Button
                          key="preview"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => handlePreviewPdf(report)}
                        >
                          Xem PDF
                        </Button>,
                        <Button
                          key="download"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownloadPdf(report)}
                          loading={pdfGenerating && selectedReport?.handoverReportId === report.handoverReportId}
                        >
                          Tải PDF
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>Biên bản #{report.handoverReportId || report.id}</Text>
                            <Tag color={report.status === "STAFF_SIGNED" || report.status === "BOTH_SIGNED" ? "green" : report.status === "CUSTOMER_SIGNED" ? "blue" : report.status === "PENDING_STAFF_SIGNATURE" ? "orange" : "orange"}>
                              {translateHandoverStatus(report.status)}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">
                              Thời gian: {formatDateTime(report.handoverDateTime)}
                            </Text>
                            <Text type="secondary">
                              Địa điểm: {report.handoverLocation || "—"}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              );
            }
            return (
              <Text type="secondary">Chưa có biên bản bàn giao</Text>
            );
          })()}
          <Divider />
          <Space wrap>
            {/* Chỉ hiển thị nút "Tạo biên bản bàn giao" khi không phải PENDING, không phải COMPLETED và chưa có handover report */}
            {!isPending && !isCompleted && !handoverReportMap[taskId] && (
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => {
                  navigate(`/technician/tasks/handover/${taskId}`, { state: { task: t } });
                }}
              >
                Tạo biên bản bàn giao
              </Button>
            )}
            {!isCompleted && !isInProgress && !isConfirmed && (
              <Button
                type="default"
                loading={isLoading}
                onClick={() => handleConfirmDelivery(taskId)}
              >
                Xác nhận giao hàng
              </Button>
            )}
          </Space>
        </>
      );
    }

    if (isPickupTask(t)) {
      const taskId = t.taskId || t.id;
      const status = String(t.status || "").toUpperCase();
      const isCompleted = status === "COMPLETED";
      const isInProgress = status === "IN_PROGRESS";
      const taskKey = String(taskId);
      const isConfirmed = confirmedRetrievalTasks.has(taskKey);
      const isLoading = confirmingRetrieval[taskId];
      const orderReports = orderDetail
        ? handoverReportsByOrder[orderDetail.orderId || orderDetail.id]
        : null;
      const checkinReports = orderReports
        ? orderReports.filter((r) => {
            const handoverType = String(r.handoverType || "").toUpperCase();
            return handoverType === "CHECKIN";
          })
        : [];
      const hasCheckinReport = checkinReports.length > 0;
      
      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
            <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.type || "—"}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {t.status ? (() => { const { bg, text } = getTechnicianStatusColor(t.status); return (
                <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
              ); })() : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đơn">{t.orderId || "—"}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{t.title || t.description || "—"}</Descriptions.Item>
            {isCompleted && (
              <>
                <Descriptions.Item label="Thời gian bắt đầu nhiệm vụ">
                  {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian kết thúc nhiệm vụ">
                  {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian hoàn thành nhiệm vụ">
                  {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
          {orderDetail && (
            <>
              <Divider />
              <Title level={5} style={{ marginTop: 0 }}>Chi tiết đơn #{orderDetail.orderId || orderDetail.id}</Title>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Trạng thái">
                  {fmtOrderStatus(orderDetail.status || orderDetail.orderStatus)}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  {customerDetail ? (
                    <>
                      {customerDetail.fullName || customerDetail.username || "Khách hàng"}
                      {customerDetail.phoneNumber ? ` • ${customerDetail.phoneNumber}` : ""}
                      {customerDetail.email ? ` • ${customerDetail.email}` : ""}
                    </>
                  ) : (
                    orderDetail.customerId ?? "—"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian">
                  {orderDetail.startDate ? fmtDateTime(orderDetail.startDate) : "—"} → {orderDetail.endDate ? fmtDateTime(orderDetail.endDate) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">{orderDetail.shippingAddress || "—"}</Descriptions.Item>
              </Descriptions>
              {Array.isArray(orderDetail.orderDetails) && orderDetail.orderDetails.length > 0 && (
                <>
                  <Divider />
                  <Title level={5} style={{ marginTop: 0 }}>Thiết bị trong đơn</Title>
                  <List
                    size="small"
                    dataSource={orderDetail.orderDetails}
                    renderItem={(d) => (
                      <List.Item>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {d.deviceModel?.image ? (
                            <img src={d.deviceModel.image} alt={d.deviceModel.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                          ) : null}
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {d.deviceModel?.name || `Model #${d.deviceModelId}`} {`× ${d.quantity}`}
                            </div>
                            {d.deviceModel && (
                              <div style={{ color: '#667085' }}>
                                {d.deviceModel.brand ? `${d.deviceModel.brand} • ` : ''}
                                Cọc: {fmtVND((d.deviceModel.deviceValue || 0) * (d.deviceModel.depositPercent || 0))}
                              </div>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </>
              )}
            </>
          )}
          <Divider />
          {/* Hiển thị biên bản thu hồi */}
          <Title level={5} style={{ marginTop: 0 }}>Biên bản thu hồi</Title>
          {hasCheckinReport ? (
            <List
              dataSource={checkinReports}
              renderItem={(report) => (
                <List.Item
                  actions={[
                    <Button
                      key="preview"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreviewPdf(report)}
                    >
                      Xem PDF
                    </Button>,
                    <Button
                      key="download"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownloadPdf(report)}
                      loading={pdfGenerating && selectedReport?.handoverReportId === report.handoverReportId}
                    >
                      Tải PDF
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>Biên bản #{report.handoverReportId || report.id}</Text>
                        <Tag color={report.status === "STAFF_SIGNED" || report.status === "BOTH_SIGNED" ? "green" : report.status === "CUSTOMER_SIGNED" ? "blue" : report.status === "PENDING_STAFF_SIGNATURE" ? "orange" : "orange"}>
                          {translateHandoverStatus(report.status)}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">
                          Thời gian: {formatDateTime(report.handoverDateTime)}
                        </Text>
                        <Text type="secondary">
                          Địa điểm: {report.handoverLocation || "—"}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary">Chưa có biên bản thu hồi</Text>
          )}
          <Divider />
          <Space wrap>
            {!isCompleted && !isInProgress && !isConfirmed && (
              <Button
                type="default"
                loading={isLoading}
                onClick={() => handleConfirmRetrieval(taskId)}
              >
                Xác nhận đi trả hàng
              </Button>
            )}
            {/* Chỉ hiển thị nút "Tạo biên bản thu hồi" khi task đang xử lý và chưa có biên bản */}
            {isInProgress && !hasCheckinReport && (
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => {
                  navigate(`/technician/tasks/handover-checkin/${taskId}`, { state: { task: t } });
                }}
              >
                Tạo biên bản thu hồi
              </Button>
            )}
          </Space>
        </>
      );
    }

    // Fallback generic detail for loại không xác định
    const isCompleted = String(t.status || "").toUpperCase() === "COMPLETED";
    
    return (
      <>
        {header}
        <Divider />
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.type || "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            {t.status ? (() => { const { bg, text } = getTechnicianStatusColor(t.status); return (
              <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
            ); })() : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{t.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{t.title || t.description || "—"}</Descriptions.Item>
          {isCompleted && (
            <>
              <Descriptions.Item label="Thời gian bắt đầu Task">
                {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian kết thúc Task">
                {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian hoàn thành Task">
                {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
          {orderDetail && (
            <>
              <Divider />
              <Title level={5} style={{ marginTop: 0 }}>Chi tiết đơn #{orderDetail.orderId || orderDetail.id}</Title>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Trạng thái">
                  {fmtOrderStatus(orderDetail.status || orderDetail.orderStatus)}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  {customerDetail ? (
                    <>
                      {customerDetail.fullName || customerDetail.username || "Khách hàng"}
                      {customerDetail.phoneNumber ? ` • ${customerDetail.phoneNumber}` : ""}
                      {customerDetail.email ? ` • ${customerDetail.email}` : ""}
                    </>
                  ) : (
                    orderDetail.customerId ?? "—"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian">
                  {orderDetail.startDate ? fmtDateTime(orderDetail.startDate) : "—"} → {orderDetail.endDate ? fmtDateTime(orderDetail.endDate) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ giao">{orderDetail.shippingAddress || "—"}</Descriptions.Item>
              </Descriptions>
              {Array.isArray(orderDetail.orderDetails) && orderDetail.orderDetails.length > 0 && (
                <>
                  <Divider />
                  <Title level={5} style={{ marginTop: 0 }}>Thiết bị trong đơn</Title>
                  <List
                    size="small"
                    dataSource={orderDetail.orderDetails}
                    renderItem={(d) => (
                      <List.Item>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {d.deviceModel?.image ? (
                            <img src={d.deviceModel.image} alt={d.deviceModel.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                          ) : null}
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {d.deviceModel?.name || `Model #${d.deviceModelId}`} {`× ${d.quantity}`}
                            </div>
                            {d.deviceModel && (
                              <div style={{ color: '#667085' }}>
                                {d.deviceModel.brand ? `${d.deviceModel.brand} • ` : ''}
                                Cọc: {fmtVND((d.deviceModel.deviceValue || 0) * (d.deviceModel.depositPercent || 0))}
                              </div>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </>
              )}
            </>
          )}
        {/* duplicate order detail block removed */}
        <Divider />
        <Space wrap>
          {isPreRentalQC(t) && (() => {
            const taskId = t.taskId || t.id;
            const status = String(t.status || "").toUpperCase();
            const hasQcReport = hasQcReportMap[taskId];
            const isCompletedInner = status === "COMPLETED";
            
            // Nếu COMPLETED: chỉ hiển thị nút nếu đã có QC report (chỉ cho update)
            // Nếu chưa COMPLETED: hiển thị nút tạo/cập nhật như bình thường
            if (isCompletedInner && !hasQcReport) {
              return null; // Không hiển thị nút khi COMPLETED nhưng chưa có QC report
            }
            
            return (
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => {
                  navigate(`/technician/tasks/qc/${taskId}`, { state: { task: t } });
                }}
              >
                {hasQcReport ? "Cập nhật QC Report" : "Tạo QC Report"}
              </Button>
            );
          })()}
          {t.type === "DELIVERY" && (() => {
            const taskId = t.taskId || t.id;
            const status = String(t.status || "").toUpperCase();
            const isPending = status === "PENDING";
            const isCompletedInner = status === "COMPLETED";
            const isInProgress = status === "IN_PROGRESS";
            const taskKey = String(taskId);
            const isConfirmed = confirmedTasks.has(taskKey);
            const isLoading = confirmingDelivery[taskId];
            
            return (
              <>
                {/* Chỉ hiển thị nút "Tạo biên bản bàn giao" khi không phải PENDING và không phải COMPLETED */}
                {!isPending && !isCompletedInner && (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      navigate(`/technician/tasks/handover/${taskId}`, { state: { task: t } });
                    }}
                  >
                    Tạo biên bản bàn giao
                  </Button>
                )}
                {!isCompletedInner && !isInProgress && !isConfirmed && (
                  <Button
                    type="default"
                    loading={isLoading}
                    onClick={() => handleConfirmDelivery(taskId)}
                  >
                    Xác nhận giao hàng
                  </Button>
                )}
                
              </>
            );
          })()}
          {isPickupTask(t) && (() => {
            const taskId = t.taskId || t.id;
            const status = String(t.status || "").toUpperCase();
            const isCompletedInner = status === "COMPLETED";
            const isInProgress = status === "IN_PROGRESS";
            const taskKey = String(taskId);
            const isConfirmed = confirmedRetrievalTasks.has(taskKey);
            const isLoading = confirmingRetrieval[taskId];
            const hasQcReport = hasQcReportMap[taskId];
            const handoverReport = handoverReportMap[taskId];
            const hasCheckinReport =
              handoverReport &&
              String(handoverReport.handoverType || "").toUpperCase() ===
                "CHECKIN";
            const buttonLabel =
              isCompletedInner
                ? "Cập nhật QC Report"
                : hasQcReport
                  ? "Cập nhật QC Report"
                  : "Tạo QC Report";
            
            return (
              <>
                {!isCompletedInner && !isInProgress && !isConfirmed && (
                  <Button
                    type="default"
                    loading={isLoading}
                    onClick={() => handleConfirmRetrieval(taskId)}
                  >
                    Xác nhận đi trả hàng
                  </Button>
                )}
                {/* Chỉ hiển thị nút "Tạo/Cập nhật QC Report" khi status là IN_PROGRESS hoặc COMPLETED */}
                {(isInProgress || isCompletedInner) && (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      navigate(`/technician/tasks/qc/${taskId}`, { state: { task: t } });
                    }}
                  >
                    {buttonLabel}
                  </Button>
                )}
                {isInProgress && hasCheckinReport && (
                  <Button
                    type="default"
                    icon={<EyeOutlined />}
                    onClick={() => handlePreviewPdf(handoverReport)}
                  >
                    Xem biên bản thu hồi
                  </Button>
                )}
                {isInProgress && !hasCheckinReport && (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      navigate(`/technician/tasks/handover-checkin/${taskId}`, { state: { task: t } });
                    }}
                  >
                    Tạo biên bản thu hồi
                  </Button>
                )}
              </>
            );
          })()}
        </Space>
      </>
    );
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Danh sách công việc kỹ thuật</Title>
        <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
          Tải lại
        </Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          placeholder="Tìm theo mã task"
          allowClear
          value={searchTaskId}
          onChange={(e) => setSearchTaskId(e.target.value)}
          onSearch={setSearchTaskId}
          style={{ width: 200 }}
        />
        <span>Lọc trạng thái:</span>
        <Select
          style={{ width: 200 }}
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { label: "Tất cả", value: "ALL" },
            { label: "Đang chờ thực hiện", value: TECH_TASK_STATUS.PENDING },
            { label: "Đã hoàn thành", value: TECH_TASK_STATUS.COMPLETED },
          ]}
        />
        <span>Lọc loại:</span>
        <Select
          style={{ width: 250 }}
          value={filterType}
          onChange={setFilterType}
          options={[
            { label: "Tất cả", value: "ALL" },
            { label: "Pre rental QC (check QC trước giao)", value: "PRE_RENTAL_QC" },
            { label: "Pick up rental order (Thu hồi thiết bị)", value: "PICKUP" },
            { label: "CHECK QC outbound", value: "QC" },
            { label: "CHECK BIÊN BẢN", value: "HANDOVER_CHECK" },
            { label: "BẢO TRÌ THIẾT BỊ", value: "MAINTAIN" },
            { label: "ĐI GIAO THIẾT BỊ", value: "DELIVERY" },
          ]}
        />
        <Input.Search
          placeholder="Tìm theo mã đơn hàng"
          allowClear
          value={filterOrderId}
          onChange={(e) => setFilterOrderId(e.target.value)}
          onSearch={setFilterOrderId}
          style={{ width: 200 }}
        />
      </Space>

      <Card>
        <Table
          rowKey={(r) => r.id || r.taskId}
          loading={loading}
          columns={columns}
          dataSource={tasksAll
            .filter((t) => {
              // Filter by status
              const statusMatch = filterStatus === "ALL" ? true : String(t.status).toUpperCase() === String(filterStatus).toUpperCase();
              // Filter by task ID
              const taskIdMatch = !searchTaskId.trim() || 
                String(t.id || t.taskId || "").includes(String(searchTaskId.trim()));
              // Filter by type
              let typeMatch = true;
              if (filterType !== "ALL") {
                if (filterType === "PRE_RENTAL_QC") {
                  typeMatch = isPreRentalQC(t);
                } else if (filterType === "PICKUP") {
                  typeMatch = isPickupTask(t);
                } else {
                  typeMatch = String(t.type || "").toUpperCase() === String(filterType).toUpperCase();
                }
              }
              // Filter by order ID
              const orderIdMatch = !filterOrderId.trim() || 
                String(t.orderId || "").includes(String(filterOrderId.trim()));
              return statusMatch && taskIdMatch && typeMatch && orderIdMatch;
            })
            .sort((a, b) => {
              const aStatus = String(a.status || "").toUpperCase();
              const bStatus = String(b.status || "").toUpperCase();
              
              // Ưu tiên: IN_PROGRESS > PENDING > các status khác
              const getPriority = (status) => {
                if (status.includes("IN_PROGRESS") || status.includes("INPROGRESS")) return 1;
                if (status.includes("PENDING")) return 2;
                return 3;
              };
              
              const aPriority = getPriority(aStatus);
              const bPriority = getPriority(bStatus);
              
              // Nếu priority khác nhau, sort theo priority
              if (aPriority !== bPriority) {
                return aPriority - bPriority;
              }
              
              // Nếu cùng priority (cùng nhóm status), sort từ mới nhất đến cũ nhất
              const aDate = a.date ? dayjs(a.date) : dayjs(0);
              const bDate = b.date ? dayjs(b.date) : dayjs(0);
              return bDate.valueOf() - aDate.valueOf(); // Descending: newest first
            })}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Drawer
        title={detailTask ? detailTask.title : "Chi tiết công việc"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
      >
        {renderDetailBody(detailTask)}
      </Drawer>

      {/* PDF Preview Modal */}
      <Modal
        title="Xem trước biên bản bàn giao"
        open={pdfModalOpen}
        onCancel={() => {
          setPdfModalOpen(false);
          if (pdfBlobUrl) {
            URL.revokeObjectURL(pdfBlobUrl);
            setPdfBlobUrl("");
          }
          setSelectedReport(null);
        }}
        width="90%"
        style={{ top: 20 }}
        footer={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (selectedReport) {
                handleDownloadPdf(selectedReport);
              }
            }}
            loading={pdfGenerating}
          >
            Tải PDF
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setPdfModalOpen(false);
              if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl);
                setPdfBlobUrl("");
              }
              setSelectedReport(null);
            }}
          >
            Đóng
          </Button>,
        ]}
      >
        {pdfBlobUrl ? (
          <iframe
            src={pdfBlobUrl}
            style={{ width: "100%", height: "80vh", border: "none" }}
            title="PDF Preview"
          />
        ) : (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Text>Đang tạo PDF...</Text>
          </div>
        )}
      </Modal>

      {/* Hidden div for PDF generation */}
      <div
        ref={printRef}
        style={{
          position: "fixed",
          left: "-99999px",
          top: "-99999px",
          width: "794px",
          height: "auto",
          backgroundColor: "#ffffff",
          fontFamily: "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif",
          visibility: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -9999,
          overflow: "hidden",
          border: "none",
          margin: 0,
          padding: 0,
          webkitFontSmoothing: "antialiased",
          mozOsxFontSmoothing: "grayscale"
        }}
      />
    </>
  );
}
