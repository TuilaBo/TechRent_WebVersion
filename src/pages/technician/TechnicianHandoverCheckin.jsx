// src/pages/technician/TechnicianHandoverCheckin.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Card,
  Descriptions,
  Typography,
  Tag,
  Space,
  Input,
  Button,
  Row,
  Col,
  DatePicker,
  Spin,
  InputNumber,
  Table,
  Modal,
  Divider,
  Upload,
  Select,
  message,
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeftOutlined,
  SendOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ExpandOutlined,
  EyeOutlined,
  InboxOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getTaskById, normalizeTask } from "../../lib/taskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";
import {
  createHandoverReportCheckin,
  getHandoverReportById,
  sendHandoverReportPin,
  updateHandoverReportSignature,
  getHandoverReportsByOrderId,
} from "../../lib/handoverReportApi";
import { getQcReportsByOrderId, getPreRentalQcReportById } from "../../lib/qcReportApi";
import { getConditionDefinitions } from "../../lib/condition";
import { listDevices } from "../../lib/deviceManage";
import { useAuthStore } from "../../store/authStore";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// =========================
// PDF Helpers - Tham khảo từ AdminContract.jsx
// =========================

// ⚠️ ĐÃ SỬA: CSS chỉ áp dụng cho #handover-print-root để không đè AntD Table
const GLOBAL_PRINT_CSS = `
  <style>
    #handover-print-root,
    #handover-print-root * {
      font-family: 'Arial', 'Helvetica', 'Times New Roman', 'DejaVu Sans', sans-serif !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #handover-print-root h1,
    #handover-print-root h2,
    #handover-print-root h3 {
      margin: 8px 0 6px;
      font-weight: 700;
    }
    #handover-print-root h3 {
      font-size: 14px;
      text-transform: uppercase;
    }
    #handover-print-root p {
      margin: 6px 0;
    }
    #handover-print-root ol,
    #handover-print-root ul {
      margin: 6px 0 6px 18px;
      padding: 0;
    }
    #handover-print-root li {
      margin: 3px 0;
    }
    #handover-print-root .kv {
      margin-bottom: 10px;
    }
    #handover-print-root .kv div {
      margin: 2px 0;
    }
    #handover-print-root table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    #handover-print-root table th,
    #handover-print-root table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    #handover-print-root table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    #handover-print-root .equipment-item {
      display: block;
      margin: 4px 0;
    }
    #handover-print-root .equipment-item::before {
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

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return dayjs(iso).format("DD/MM/YYYY");
  } catch {
    return iso;
  }
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

function translateRole(role) {
  const r = String(role || "").toUpperCase();
  if (r === "TECHNICIAN") return "Kỹ thuật viên";
  return role;
}

function translateQualityStatus(status) {
  const s = String(status || "").toUpperCase();
  const map = {
    GOOD: "Tốt",
    FAIR: "Khá",
    POOR: "Kém",
    DAMAGED: "Hư hỏng",
    MISSING: "Thiếu",
  };
  return map[s] || status;
}

// ⚠️ ĐÃ SỬA: thêm id="handover-print-root" + GLOBAL_PRINT_CSS đứng ngoài, scope CSS
function buildHandoverReportHtml(report, order = null, conditionDefinitions = []) {
  if (!report) return "<div>Không có dữ liệu biên bản</div>";

  // Parse customer info
  const customerInfoParts = (report.customerInfo || "")
    .split(" • ")
    .filter(Boolean);
  const customerName = customerInfoParts[0] || "—";
  const customerPhone = customerInfoParts[1] || "—";
  const customerEmail = customerInfoParts[2] || "—";

  // Parse technician info
  const technicianInfoParts = (report.technicianInfo || "")
    .split(" • ")
    .filter(Boolean);
  const technicianName = technicianInfoParts[0] || "—";
  const technicianEmail = technicianInfoParts[1] || "—";

  // Format dates
  const handoverDate = formatDateTime(report.handoverDateTime);
  const staffSignedDate = report.staffSignedAt
    ? formatDateTime(report.staffSignedAt)
    : "—";
  const customerSignedDate = report.customerSignedAt
    ? formatDateTime(report.customerSignedAt)
    : "—";
  const deliveryDate = report.deliveryDateTime
    ? formatDateTime(report.deliveryDateTime)
    : "—";

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

  // Build items table - support both old format (itemName, itemCode) and new format (allocationId)
  const itemsRows = (report.items || [])
    .map((item, idx) => {
      // New format: use allocationId to get device info
      if (item.allocationId) {
        const deviceInfo = allocationMap[item.allocationId];
        if (deviceInfo) {
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>${deviceInfo.deviceModelName}</td>
              <td>${deviceInfo.serialNumber}</td>
              <td style="text-align:center">${deviceInfo.unit}</td>
              <td style="text-align:center">${deviceInfo.quantity}</td>
              <td style="text-align:center">${deviceInfo.quantity}</td>
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
              
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${deviceModelName}</td>
                  <td>${serialNumber}</td>
                  <td style="text-align:center">cái</td>
                  <td style="text-align:center">1</td>
                  <td style="text-align:center">1</td>
                </tr>
              `;
            }
          }
          
          // Fallback: hiển thị allocationId nếu không tìm thấy
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>—</td>
              <td>— (allocationId: ${item.allocationId})</td>
              <td style="text-align:center">cái</td>
              <td style="text-align:center">1</td>
              <td style="text-align:center">1</td>
            </tr>
          `;
        }
      }
      // Old format: use itemName, itemCode
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.itemName || "—"}</td>
          <td>${item.itemCode || "—"}</td>
          <td style="text-align:center">${item.unit || "cái"}</td>
          <td style="text-align:center">${item.orderedQuantity || 0}</td>
          <td style="text-align:center">${item.deliveredQuantity || 0}</td>
        </tr>
      `;
    })
    .join("");

  // Build device quality info table
  const qualityRows = (report.deviceQualityInfos || [])
    .map(
      (info, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${info.deviceModelName || "—"}</td>
      <td>${info.deviceSerialNumber || "—"}</td>
      <td>${translateQualityStatus(info.qualityStatus)}</td>
      <td>${info.qualityDescription || "—"}</td>
    </tr>
  `
    )
    .join("");

  // Build technicians list
  const techniciansList = (report.technicians || [])
    .map((tech) => {
      const name = tech.fullName || tech.username || `Nhân viên #${tech.staffId}`;
      const phone = tech.phoneNumber || "";
      return `
    <li>
      <strong>${name}</strong>
      ${
        phone
          ? `<br/>Số điện thoại: ${phone}`
          : ""
      }
    </li>
  `;
    })
    .join("");

  return `
    ${GLOBAL_PRINT_CSS}
    <div id="handover-print-root" style="
      width:794px;margin:0 auto;background:#fff;color:#111;
      font-family:'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif;font-size:13px;line-height:1.5;
      padding:32px 40px;box-sizing:border-box;">
      
      ${NATIONAL_HEADER_HTML}
      
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:22px;font-weight:700;letter-spacing:.5px">BIÊN BẢN THU HỒI</div>
        <div style="color:#666">Số: #${report.handoverReportId || report.id || "—"}</div>
      </div>
      <hr style="border:none;border-top:1px solid #e8e8e8;margin:12px 0 16px"/>
      
      <section class="kv">
        <div><b>Mã đơn hàng:</b> #${report.orderId || "—"}</div>
        <div><b>Mã Task:</b> #${report.taskId || "—"}</div>
        <div><b>Trạng thái:</b> ${translateHandoverStatus(report.status)}</div>
      </section>
      
      <h3>Thông tin khách hàng</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${customerName}</div>
        <div><b>Số điện thoại:</b> ${customerPhone}</div>
        <div><b>Email:</b> ${customerEmail}</div>
        <div><b>Chữ ký khách hàng:</b> ${report.customerSignature || "—"}</div>
        ${
          report.customerSigned
            ? `<div><b>Đã ký vào:</b> ${customerSignedDate}</div>`
            : ""
        }
      </section>
      
      <h3>Thông tin kỹ thuật viên</h3>
      <section class="kv">
        <div><b>Họ và tên:</b> ${technicianName}</div>
        <div><b>Email:</b> ${technicianEmail}</div>
        <div><b>Chữ ký nhân viên:</b> ${report.staffSignature || "—"}</div>
        ${
          report.staffSigned
            ? `<div><b>Đã ký vào:</b> ${staffSignedDate}</div>`
            : ""
        }
      </section>
      
      <h3>Thông tin thu hồi</h3>
      <section class="kv">
        <div><b>Thời gian thu hồi:</b> ${handoverDate}</div>
        <div><b>Địa điểm thu hồi:</b> ${report.handoverLocation || "—"}</div>
        ${
          deliveryDate !== "—"
            ? `<div><b>Thời gian giao hàng:</b> ${deliveryDate}</div>`
            : ""
        }
      </section>
      
      <h3>Danh sách thiết bị thu hồi</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Tên thiết bị</th>
            <th>Mã thiết bị (Serial Number)</th>
            <th style="width:80px">Đơn vị</th>
            <th style="width:80px;text-align:center">SL đặt</th>
            <th style="width:80px;text-align:center">SL giao</th>
          </tr>
        </thead>
        <tbody>
          ${
            itemsRows ||
            "<tr><td colspan='6' style='text-align:center'>Không có thiết bị</td></tr>"
          }
        </tbody>
      </table>
      
      ${
        qualityRows
          ? `
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
      `
          : ""
      }
      
      ${
        techniciansList
          ? `
      <h3>Kỹ thuật viên tham gia</h3>
      <ul>
        ${techniciansList}
      </ul>
      `
          : ""
      }
      
      ${
        (report.discrepancies || []).length > 0
          ? `
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
            ? `<div><b>Vai trò:</b> ${translateRole(report.createdByStaff.role)}</div>`
            : ""
        }
      </section>
      `
          : ""
      }
      
      ${
        (report.evidenceUrls || []).length > 0
          ? `
      <h3>Ảnh bằng chứng</h3>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:12px 0">
        ${report.evidenceUrls
          .map((url, idx) => {
            const isBase64 = url.startsWith("data:image");
            const imgSrc = isBase64 ? url : url;
            return `
          <div style="flex:0 0 auto;margin-bottom:8px">
            <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#333">Bằng chứng ${
              idx + 1
            }</div>
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
          })
          .join("")}
      </div>
      `
          : ""
      }
      
      <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
        <div style="flex:1;text-align:center">
          <div><b>KHÁCH HÀNG</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${
              report.customerSigned
                ? '<div style="font-size:48px;color:#52c41a;line-height:1">✓</div>'
                : ""
            }
          </div>
          <div>
            ${
              report.customerSigned
                ? `<div style="color:#52c41a;font-weight:600">${customerName} đã ký</div>`
                : "(Ký, ghi rõ họ tên)"
            }
          </div>
        </div>
        <div style="flex:1;text-align:center">
          <div><b>NHÂN VIÊN</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${
              report.staffSigned
                ? '<div style="font-size:48px;color:#52c41a;line-height:1">✓</div>'
                : ""
            }
          </div>
          <div>
            ${
              report.staffSigned
                ? `<div style="color:#52c41a;font-weight:600">${technicianName} đã ký</div>`
                : "(Ký, ghi rõ họ tên)"
            }
          </div>
        </div>
      </section>
    </div>
  `;
}

async function elementToPdfBlob(el) {
  // Đợi một chút để đảm bảo font được load
  await new Promise((resolve) => setTimeout(resolve, 100));

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc) => {
      const clonedBody = clonedDoc.body;
      if (clonedBody) {
        clonedBody.style.fontFamily =
          "'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif";
      }
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

function printPdfUrl(url) {
  if (!url) return toast.error("Không có tài liệu để in.");
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

const translateStatus = (status) => {
  const s = String(status || "").toUpperCase();
  const map = {
    PENDING: "Đang chờ",
    IN_PROGRESS: "Đang xử lý",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
  };
  return map[s] || status;
};

const getStatusColor = (status) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PENDING":
      return "orange";
    case "IN_PROGRESS":
      return "blue";
    case "COMPLETED":
      return "green";
    case "CANCELLED":
      return "red";
    default:
      return "default";
  }
};

export default function TechnicianHandoverCheckin() {
  const nav = useNavigate();
  const { taskId: paramTaskId } = useParams();
  const { state } = useLocation();
  const user = useAuthStore((s) => s.user);

  const actualTaskId = paramTaskId || state?.task?.id || state?.task?.taskId;

  // States
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [order, setOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingPin, setSendingPin] = useState(false);
  const [signing, setSigning] = useState(false);

  // Handover report states
  const [handoverReportId, setHandoverReportId] = useState(null);
  const [handoverReport, setHandoverReport] = useState(null);
  const [showSignatureForm, setShowSignatureForm] = useState(false);
  const [handoverReports, setHandoverReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showReportsList, setShowReportsList] = useState(false);

  // PDF states
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const printRef = useRef(null);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [technicianInfo, setTechnicianInfo] = useState("");
  const [handoverDateTime, setHandoverDateTime] = useState(dayjs());
  const [handoverLocation, setHandoverLocation] = useState("");
  const [customerSignature, setCustomerSignature] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [staffSignature, setStaffSignature] = useState("");
  const [items, setItems] = useState([]);
  const [deviceQualityInfos, setDeviceQualityInfos] = useState([]);
  const [evidenceFiles, setEvidenceFiles] = useState([]); // Array of File objects
  const [evidenceUrls, setEvidenceUrls] = useState([]); // Array of URLs (base64 or server URLs)
  
  // Discrepancies state (for checkin)
  const [discrepancies, setDiscrepancies] = useState([]);
  const [conditionDefinitions, setConditionDefinitions] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [deviceCategoryMap, setDeviceCategoryMap] = useState({}); // deviceModelId -> deviceCategoryId
  const [devicesMap, setDevicesMap] = useState({}); // serialNumber -> deviceId
  const [orderDetailsMap, setOrderDetailsMap] = useState({}); // orderDetailId -> orderDetail

  const preferredTechnicianEmail = useMemo(() => {
    if (user?.email) return user.email;
    const infoParts = (technicianInfo || "")
      .split("•")
      .map((part) => part.trim())
      .filter(Boolean);
    const emailPart = infoParts.find((part) => /\S+@\S+\.\S+/.test(part));
    return emailPart || "";
  }, [user?.email, technicianInfo]);

  // Fetch task and order details
  useEffect(() => {
    const loadData = async () => {
      if (!actualTaskId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch task
        const taskData = await getTaskById(actualTaskId);
        if (!taskData) {
          toast.error("Không tìm thấy công việc");
          nav(-1);
          return;
        }

        const normalizedTask = normalizeTask(taskData);
        setTask(normalizedTask);

        // Fetch order details
        if (normalizedTask.orderId) {
          const orderData = await getRentalOrderById(normalizedTask.orderId);
          setOrder(orderData);

          // Fetch customer info
          if (orderData?.customerId) {
            try {
              const cus = await fetchCustomerById(orderData.customerId);
              const normalizedCus = normalizeCustomer ? normalizeCustomer(cus) : cus;

              // Pre-fill customer info
              const customerNameValue =
                normalizedCus.fullName || normalizedCus.username || "";
              setCustomerName(customerNameValue);
              setCustomerPhone(normalizedCus.phoneNumber || "");
              setCustomerEmail(normalizedCus.email || "");
              // Auto-fill customer signature with customer name
              setCustomerSignature(customerNameValue);
            } catch {
              console.error("Error fetching customer");
            }
          }

          // Pre-fill technician info
          if (user) {
            const techInfoStr = [user.username || user.fullName || "", user.email || ""]
              .filter(Boolean)
              .join(" • ");
            setTechnicianInfo(techInfoStr);
          }

          // Pre-fill location from order
          if (orderData?.shippingAddress) {
            setHandoverLocation(orderData.shippingAddress);
          }

          // Note: For checkin, we don't need to load PRE_RENTAL QC report
          // Devices are already allocated in the order
          let qcReportDevices = [];
          let preRentalQcReport = null;
          try {
            const qcReports = await getQcReportsByOrderId(normalizedTask.orderId);
            if (Array.isArray(qcReports) && qcReports.length > 0) {
              // Tìm PRE_RENTAL QC report
              preRentalQcReport = qcReports.find(
                (r) => String(r.phase || "").toUpperCase() === "PRE_RENTAL"
              );
              
              // Fallback: tìm report matching taskId
              const matchingReport = qcReports.find(
                (r) =>
                  r.taskId === normalizedTask.taskId || r.taskId === normalizedTask.id
              );
              const reportToUse = preRentalQcReport || matchingReport || qcReports[0];
              
              if (reportToUse?.devices && Array.isArray(reportToUse.devices)) {
                qcReportDevices = reportToUse.devices;
              }
              
              // Nếu có preRentalQcReport, load chi tiết để lấy deviceConditions
              if (preRentalQcReport?.qcReportId || preRentalQcReport?.id) {
                try {
                  const qcReportId = preRentalQcReport.qcReportId || preRentalQcReport.id;
                  const fullPreRentalReport = await getPreRentalQcReportById(qcReportId);
                  if (fullPreRentalReport) {
                    preRentalQcReport = fullPreRentalReport;
                    
                    // Parse deviceConditions từ QC report và fill vào form
                    if (Array.isArray(fullPreRentalReport.deviceConditions) && fullPreRentalReport.deviceConditions.length > 0) {
                      const parsedDeviceConditions = [];
                      
                      fullPreRentalReport.deviceConditions.forEach((dc) => {
                        // Mỗi deviceCondition có thể có nhiều snapshots, mỗi snapshot có nhiều conditionDetails
                        if (Array.isArray(dc.snapshots)) {
                          dc.snapshots.forEach((snapshot) => {
                            if (Array.isArray(snapshot.conditionDetails)) {
                              snapshot.conditionDetails.forEach((conditionDetail) => {
                                // Tìm deviceId từ deviceSerial
                                const deviceSerial = dc.deviceSerial || String(dc.deviceId);
                                parsedDeviceConditions.push({
                                  deviceId: deviceSerial, // Use serial number as deviceId (will convert to deviceId later)
                                  conditionDefinitionId: conditionDetail.conditionDefinitionId,
                                  severity: conditionDetail.severity,
                                  images: Array.isArray(snapshot.images) ? snapshot.images : [],
                                });
                              });
                            }
                          });
                        }
                      });
                      
                      console.log("✅ Loaded deviceConditions from PRE_RENTAL QC report:", parsedDeviceConditions);
                      setDeviceConditions(parsedDeviceConditions);
                    }
                  }
                } catch (e) {
                  console.warn("Could not load full PRE_RENTAL QC report:", e);
                }
              }
            }
          } catch (e) {
            console.log("No QC report found or error:", e);
          }

          // Build items from orderDetails
          if (
            Array.isArray(orderData.orderDetails) &&
            orderData.orderDetails.length > 0
          ) {
            const itemsPromises = orderData.orderDetails.map(async (od) => {
              try {
                const model = await getDeviceModelById(od.deviceModelId);
                const normalizedModel = normalizeModel(model);

                const deviceModelId = Number(od.deviceModelId);
                const quantity = Number(od.quantity || 1);
                const matchingDevices = qcReportDevices.filter(
                  (d) =>
                    Number(d.deviceModelId || d.modelId || d.device_model_id) ===
                    deviceModelId
                );
                const serialNumbers = matchingDevices
                  .slice(0, quantity)
                  .map(
                    (d) =>
                      d.serialNumber ||
                      d.serial ||
                      d.serialNo ||
                      d.deviceId ||
                      d.id
                  )
                  .filter(Boolean)
                  .map(String);

                const itemCode =
                  serialNumbers.length > 0
                    ? serialNumbers.join(", ")
                    : normalizedModel.code || normalizedModel.sku || "";

                return {
                  itemName: normalizedModel.name || `Model #${od.deviceModelId}`,
                  itemCode: itemCode,
                  unit: "cái",
                  orderedQuantity: quantity,
                  deliveredQuantity: quantity,
                };
              } catch {
                const deviceModelId = Number(od.deviceModelId);
                const quantity = Number(od.quantity || 1);
                const matchingDevices = qcReportDevices.filter(
                  (d) =>
                    Number(d.deviceModelId || d.modelId || d.device_model_id) ===
                    deviceModelId
                );
                const serialNumbers = matchingDevices
                  .slice(0, quantity)
                  .map(
                    (d) =>
                      d.serialNumber ||
                      d.serial ||
                      d.serialNo ||
                      d.deviceId ||
                      d.id
                  )
                  .filter(Boolean)
                  .map(String);
                const itemCode =
                  serialNumbers.length > 0 ? serialNumbers.join(", ") : "";

                return {
                  itemName: `Model #${od.deviceModelId}`,
                  itemCode: itemCode,
                  unit: "cái",
                  orderedQuantity: quantity,
                  deliveredQuantity: quantity,
                };
              }
            });

            const itemsData = await Promise.all(itemsPromises);
            setItems(itemsData);
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "Không thể tải dữ liệu"
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [actualTaskId, nav, user]);

  // Load condition definitions and device category map when items are ready
  useEffect(() => {
    const loadConditionDefinitions = async () => {
      if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
        setConditionDefinitions([]);
        return;
      }

      try {
        setLoadingConditions(true);
        
        // Build deviceCategoryMap: deviceModelId -> deviceCategoryId
        const categoryMap = {};
        const categoryIds = new Set();
        
        for (const orderDetail of order.orderDetails) {
          if (orderDetail.deviceModelId) {
            try {
              const model = await getDeviceModelById(orderDetail.deviceModelId);
              const categoryId = model?.deviceCategoryId || model?.categoryId;
              if (categoryId) {
                categoryMap[orderDetail.deviceModelId] = categoryId;
                categoryIds.add(categoryId);
              }
            } catch (e) {
              console.warn(`Failed to load model ${orderDetail.deviceModelId}:`, e);
            }
          }
        }
        setDeviceCategoryMap(categoryMap);

        // Load condition definitions for all categories
        const allConditions = [];
        for (const categoryId of categoryIds) {
          try {
            const conditions = await getConditionDefinitions({ deviceCategoryId: categoryId });
            allConditions.push(...conditions);
          } catch (e) {
            console.warn(`Failed to load conditions for category ${categoryId}:`, e);
          }
        }

        // Remove duplicates by id
        const uniqueConditions = Array.from(
          new Map(allConditions.map(c => [c.id, c])).values()
        );
        
        setConditionDefinitions(uniqueConditions);
      } catch (e) {
        console.error("Error loading condition definitions:", e);
        setConditionDefinitions([]);
      } finally {
        setLoadingConditions(false);
      }
    };

    loadConditionDefinitions();
  }, [order]);

  // Load devices map (serialNumber -> deviceId) when items are ready
  useEffect(() => {
    const loadDevicesMap = async () => {
      if (!items || items.length === 0) {
        setDevicesMap({});
        return;
      }

      try {
        // Extract all serial numbers from items
        const serialNumbers = items
          .map(item => {
            // itemCode có thể là "SN-001, SN-002" hoặc single serial
            const codes = (item.itemCode || "").split(",").map(s => s.trim()).filter(Boolean);
            return codes;
          })
          .flat();

        if (serialNumbers.length === 0) {
          setDevicesMap({});
          return;
        }

        // Load all devices and map by serial number
        const allDevices = await listDevices();
        const devicesMapNew = {};
        
        if (Array.isArray(allDevices)) {
          serialNumbers.forEach((serial) => {
            const device = allDevices.find((d) => {
              const deviceSerial = String(d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id || "").toUpperCase();
              return deviceSerial === String(serial).toUpperCase();
            });
            
            if (device) {
              const deviceId = device.deviceId || device.id;
              devicesMapNew[String(serial)] = Number(deviceId);
            }
          });
        }
        
        setDevicesMap(devicesMapNew);
        console.log("✅ Loaded devices map:", devicesMapNew);
      } catch (e) {
        console.error("Error loading devices map:", e);
        setDevicesMap({});
      }
    };

    loadDevicesMap();
  }, [items]);

  // Convert file to base64 URL
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle evidence file upload
  const handleEvidenceUpload = async (info) => {
    const { file } = info;
    const fileObj = file.originFileObj || file;

    if (!fileObj) return;

    if (file.status !== "removed") {
      try {
        const base64Url = await fileToBase64(fileObj);

        const fileExists = evidenceFiles.some(
          (f) => f.name === fileObj.name && f.size === fileObj.size
        );
        if (!fileExists) {
          setEvidenceFiles((prev) => [...prev, fileObj]);
          setEvidenceUrls((prev) => [...prev, base64Url]);
          toast.success(`Đã thêm ảnh bằng chứng: ${fileObj.name}`);
        }
      } catch (e) {
        console.error("Error converting file to base64:", e);
        toast.error("Không thể xử lý file ảnh");
      }
    }
  };

  // Remove evidence file
  const handleRemoveEvidence = (index) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== index));
    toast.success("Đã xóa ảnh bằng chứng");
  };

  // Handle send PIN for handover report
  const handleSendPin = async () => {
    if (!handoverReportId) {
      toast.error("Chưa có handover report để gửi PIN");
      return;
    }

    try {
      setSendingPin(true);
      const recipientEmail =
        preferredTechnicianEmail || customerEmail?.trim() || "";
      await sendHandoverReportPin(
        handoverReportId,
        recipientEmail || undefined
      );
      toast.success(
        recipientEmail
          ? `Đã gửi mã PIN tới ${recipientEmail}!`
          : "Đã gửi mã PIN thành công!"
      );
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e?.message || "Không thể gửi mã PIN"
      );
    } finally {
      setSendingPin(false);
    }
  };

  // Handle submit - Create handover report
  const handleSubmit = async () => {
    if (!task?.taskId && !task?.id) {
      toast.error("Không tìm thấy task");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    if (!customerPhone.trim()) {
      toast.error("Vui lòng nhập số điện thoại khách hàng");
      return;
    }

    if (!technicianInfo.trim()) {
      toast.error("Vui lòng nhập thông tin kỹ thuật viên");
      return;
    }

    if (!handoverLocation.trim()) {
      toast.error("Vui lòng nhập địa điểm thu hồi");
      return;
    }

    if (items.length === 0) {
      toast.error("Không có thiết bị nào trong đơn hàng");
      return;
    }

    try {
      setSaving(true);

      const customerInfoStr = [
        customerName.trim(),
        customerPhone.trim(),
        customerEmail.trim(),
      ]
        .filter(Boolean)
        .join(" • ");

      // Convert items to new format: { deviceId, evidenceUrls[] }
      // Extract deviceIds from items (itemCode contains serial numbers)
      const itemsNew = [];
      for (const item of items) {
        // itemCode có thể là "SN-001, SN-002" hoặc single serial
        const serialNumbers = (item.itemCode || "").split(",").map(s => s.trim()).filter(Boolean);
        
        for (const serial of serialNumbers) {
          // Tìm deviceId từ devicesMap
          const deviceId = devicesMap[serial];
          if (deviceId) {
            // Tìm xem đã có item với deviceId này chưa
            const existingItem = itemsNew.find(i => i.deviceId === deviceId);
            if (existingItem) {
              // Nếu đã có, thêm evidenceUrls vào (nếu có)
              // EvidenceUrls sẽ được gán chung cho tất cả items, hoặc có thể để trống
            } else {
              itemsNew.push({
                deviceId: deviceId,
                evidenceUrls: [], // EvidenceUrls sẽ được gán từ evidenceUrls chung hoặc để trống
              });
            }
          } else {
            console.warn(`Could not find deviceId for serial: ${serial}`);
          }
        }
      }

      // Convert discrepancies: serial number -> deviceId, orderDetailId
      const discrepanciesPayload = [];
      for (const discrepancy of discrepancies) {
        if (!discrepancy.deviceId || !discrepancy.conditionDefinitionId || !discrepancy.discrepancyType) {
          continue; // Skip incomplete discrepancies
        }
        
        // discrepancy.deviceId là serial number, cần convert sang deviceId
        const deviceId = devicesMap[String(discrepancy.deviceId)];
        const orderDetailId = discrepancy.orderDetailId;
        
        if (deviceId && orderDetailId) {
          discrepanciesPayload.push({
            discrepancyType: String(discrepancy.discrepancyType || "DAMAGE"),
            conditionDefinitionId: Number(discrepancy.conditionDefinitionId),
            orderDetailId: Number(orderDetailId),
            deviceId: Number(deviceId),
            staffNote: String(discrepancy.staffNote || ""),
            customerNote: String(discrepancy.customerNote || ""),
          });
        } else {
          console.warn(`Could not find deviceId or orderDetailId for discrepancy:`, discrepancy);
        }
      }

      // Distribute evidenceUrls to items (có thể gán chung hoặc để trống)
      // Tạm thời để evidenceUrls trống trong items, vì API mới có thể yêu cầu format khác
      const itemsWithEvidence = itemsNew.map(item => ({
        ...item,
        evidenceUrls: [], // Có thể để trống hoặc gán từ evidenceUrls chung
      }));

      const payload = {
        taskId: task.taskId || task.id,
        customerInfo: customerInfoStr,
        technicianInfo: technicianInfo.trim(),
        handoverDateTime: handoverDateTime.format("YYYY-MM-DDTHH:mm:ss.SSS[Z]"),
        handoverLocation: handoverLocation.trim(),
        customerSignature: customerSignature.trim(),
        items: itemsWithEvidence,
        discrepancies: discrepanciesPayload,
      };

      console.log("🔍 TechnicianHandoverCheckin - Payload before API call:", {
        ...payload,
        itemsCount: payload.items.length,
        discrepanciesCount: payload.discrepancies.length,
      });

      const result = await createHandoverReportCheckin(payload);
      const reportId =
        result?.handoverReportId ||
        result?.id ||
        result?.data?.handoverReportId ||
        result?.data?.id;

      if (!reportId) {
        toast.error("Không nhận được ID handover report từ server");
        return;
      }

      setHandoverReportId(reportId);
      toast.success("Đã tạo biên bản thu hồi thành công!");

      // Fetch handover report data
      let reportData = null;
      try {
        reportData = await getHandoverReportById(reportId);
        setHandoverReport(reportData);
      } catch (e) {
        console.error("Error fetching handover report:", e);
      }

      // Gửi PIN
      try {
        const recipientEmail =
          preferredTechnicianEmail || customerEmail?.trim() || "";
        await sendHandoverReportPin(
          reportId,
          recipientEmail || undefined
        );
        toast.success(
          recipientEmail
            ? `Đã gửi mã PIN tới ${recipientEmail}!`
            : "Đã gửi mã PIN thành công!"
        );
      } catch (e) {
        console.error("Error sending PIN:", e);
        toast.error("Không thể gửi mã PIN tự động. Vui lòng gửi thủ công.");
      }

      // Hiển thị form ký
      setShowSignatureForm(true);
      setStaffSignature(technicianInfo.trim());

      // Tự động hiển thị PDF preview nếu có reportData
      if (reportData) {
        try {
          await handlePreviewPdf(reportData);
        } catch (e) {
          console.error("Error previewing PDF:", e);
          // Không hiển thị lỗi vì có thể user sẽ xem sau
        }
      }
    } catch (e) {
      console.error("Create handover report error:", e);
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.details ||
          e?.message ||
          "Không thể tạo biên bản thu hồi"
      );
    } finally {
      setSaving(false);
    }
  };

  // Load handover reports by order ID
  const loadHandoverReports = async (orderId) => {
    if (!orderId) return;
    try {
      setLoadingReports(true);
      const reports = await getHandoverReportsByOrderId(orderId);
      setHandoverReports(Array.isArray(reports) ? reports : []);
    } catch (e) {
      console.error("Error loading handover reports:", e);
      toast.error("Không thể tải danh sách biên bản thu hồi");
      setHandoverReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  // Handle sign handover report
  const handleSign = async () => {
    if (!handoverReportId) {
      toast.error("Không tìm thấy handover report");
      return;
    }

    if (!pinCode.trim()) {
      toast.error("Vui lòng nhập mã PIN");
      return;
    }

    if (!staffSignature.trim()) {
      toast.error("Vui lòng nhập chữ ký nhân viên");
      return;
    }

    try {
      setSigning(true);
      await updateHandoverReportSignature(handoverReportId, {
        pinCode: pinCode.trim(),
        staffSignature: staffSignature.trim(),
      });
      toast.success(
        "Đã ký biên bản thu hồi thành công! Trạng thái: STAFF_SIGNED"
      );

      if (order?.orderId || order?.id) {
        await loadHandoverReports(order.orderId || order.id);
        setShowReportsList(true);
      }

      setShowSignatureForm(false);
    } catch (e) {
      console.error("Sign handover report error:", e);
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.details ||
          e?.message ||
          "Không thể ký biên bản thu hồi"
      );
    } finally {
      setSigning(false);
    }
  };

  // Handle preview PDF
  const handlePreviewPdf = async (report) => {
    try {
      setPdfGenerating(true);
      setSelectedReport(report);

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl("");
      }

      // Fetch order and condition definitions
      let orderData = order || null;
      let conditionDefinitions = [];
      
      if (report.orderId) {
        try {
          orderData = await getRentalOrderById(report.orderId);
          // Enrich order with device model info
          if (orderData && Array.isArray(orderData.orderDetails)) {
            const modelIds = Array.from(new Set(orderData.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
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
            orderData = {
              ...orderData,
              orderDetails: orderData.orderDetails.map(od => ({
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
        printRef.current.style.visibility = "visible";
        printRef.current.style.opacity = "1";
        printRef.current.style.left = "-99999px";
        printRef.current.style.top = "-99999px";

        printRef.current.innerHTML = buildHandoverReportHtml(report, orderData, conditionDefinitions);

        const allElements = printRef.current.querySelectorAll("*");
        allElements.forEach((el) => {
          el.style.fontFamily =
            "'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif";
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
        const blob = await elementToPdfBlob(printRef.current);

        // ⚠️ ĐÃ SỬA: clear HTML để remove <style> khỏi DOM
        printRef.current.style.visibility = "hidden";
        printRef.current.style.opacity = "0";
        printRef.current.innerHTML = "";

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
  };

  // Handle download PDF
  const handleDownloadPdf = async (report) => {
    try {
      setPdfGenerating(true);

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl("");
      }

      // Fetch order and condition definitions
      let orderData = order || null;
      let conditionDefinitions = [];
      
      if (report.orderId) {
        try {
          orderData = await getRentalOrderById(report.orderId);
          // Enrich order with device model info
          if (orderData && Array.isArray(orderData.orderDetails)) {
            const modelIds = Array.from(new Set(orderData.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
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
            orderData = {
              ...orderData,
              orderDetails: orderData.orderDetails.map(od => ({
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
        printRef.current.style.visibility = "visible";
        printRef.current.style.opacity = "1";
        printRef.current.style.left = "-99999px";
        printRef.current.style.top = "-99999px";

        printRef.current.innerHTML = buildHandoverReportHtml(report, orderData, conditionDefinitions);

        const allElements = printRef.current.querySelectorAll("*");
        allElements.forEach((el) => {
          el.style.fontFamily =
            "'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif";
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
        const blob = await elementToPdfBlob(printRef.current);

        // ⚠️ ĐÃ SỬA: clear HTML sau khi render
        printRef.current.style.visibility = "hidden";
        printRef.current.style.opacity = "0";
        printRef.current.innerHTML = "";

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `handover-report-${
          report.handoverReportId || report.id || "report"
        }.pdf`;
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
  };

  // Items table columns
  const itemsColumns = [
    {
      title: "Tên thiết bị",
      dataIndex: "itemName",
      key: "itemName",
    },
    {
      title: "Mã thiết bị (Serial Number)",
      dataIndex: "itemCode",
      key: "itemCode",
      render: (text) => text || <Text type="secondary">Chưa có</Text>,
    },
    {
      title: "Đơn vị",
      dataIndex: "unit",
      key: "unit",
      width: 80,
    },
    {
      title: "SL đặt",
      dataIndex: "orderedQuantity",
      key: "orderedQuantity",
      width: 100,
      render: (val) => val || 0,
    },
    {
      title: "SL giao",
      dataIndex: "deliveredQuantity",
      key: "deliveredQuantity",
      width: 120,
      render: (val, record, index) => (
        <InputNumber
          min={0}
          max={record.orderedQuantity}
          value={val}
          onChange={(v) => {
            const newItems = [...items];
            newItems[index].deliveredQuantity = v || 0;
            setItems(newItems);
          }}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen" style={{ padding: 24, textAlign: "center" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Đang tải dữ liệu...</Text>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen" style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>
          Quay lại
        </Button>
        <Card>
          <Text type="danger">Không tìm thấy công việc</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ padding: 24 }}>
      <Space align="center" style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>
          Quay lại
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          Tạo biên bản thu hồi
        </Title>
        <Tag color="orange">HANDOVER CHECKIN</Tag>
      </Space>

      {/* Thông tin task và đơn hàng */}
      <Card title="Thông tin Task" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã Task">
            {task.taskId || task.id}
          </Descriptions.Item>
          <Descriptions.Item label="Mã đơn">
            {task.orderId || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Loại công việc">
            {task.taskCategoryName || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Mô tả">
            {task.description || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái Task">
            <Tag color={getStatusColor(task.status)}>
              {translateStatus(task.status) || "—"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Form tạo handover report */}
      <Card title="Thông tin thu hồi" className="mb-3">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Tên khách hàng *</Text>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên khách hàng"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Số điện thoại *</Text>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Email</Text>
              <Input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Nhập email"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Thông tin kỹ thuật viên *</Text>
              <Input
                value={technicianInfo}
                onChange={(e) => setTechnicianInfo(e.target.value)}
                placeholder="Tên, Email..."
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Thời gian thu hồi *</Text>
              <DatePicker
                showTime
                value={handoverDateTime}
                onChange={(v) => setHandoverDateTime(v || dayjs())}
                format="DD/MM/YYYY HH:mm"
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Địa điểm thu hồi *</Text>
              <Input
                value={handoverLocation}
                onChange={(e) => setHandoverLocation(e.target.value)}
                placeholder="Nhập địa chỉ..."
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Chữ ký khách hàng</Text>
              <Input
                value={customerSignature}
                onChange={(e) => setCustomerSignature(e.target.value)}
                placeholder="Tên khách hàng (tự động điền)"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Danh sách thiết bị */}
      <Card title="Danh sách thiết bị" className="mb-3">
        <Table
          columns={itemsColumns}
          dataSource={items}
          rowKey={(record, index) => index}
          pagination={false}
          size="small"
        />
      </Card>

      {/* Discrepancies Section */}
      <Card title="Sự cố/Chênh lệch (Discrepancies)" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ghi nhận các sự cố hoặc chênh lệch khi thu hồi thiết bị
            </Text>
            <Button
              type="dashed"
              onClick={() => {
                if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
                  message.warning("Vui lòng đợi thông tin đơn hàng được load");
                  return;
                }
                
                setDiscrepancies([
                  ...discrepancies,
                  {
                    discrepancyType: "DAMAGE",
                    deviceId: null,
                    orderDetailId: null,
                    conditionDefinitionId: null,
                    staffNote: "",
                    customerNote: "",
                  },
                ]);
              }}
            >
              + Thêm sự cố
            </Button>
          </div>
          
          {discrepancies.length === 0 ? (
            <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
              Chưa có sự cố nào được ghi nhận. Nhấn nút "Thêm sự cố" để bắt đầu.
            </Text>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              {discrepancies.map((discrepancy, index) => {
                // Get available order details
                const orderDetailOptions = order && Array.isArray(order.orderDetails)
                  ? order.orderDetails.map(od => ({
                      label: `${od.deviceModel?.deviceName || od.deviceModel?.name || `Model #${od.deviceModelId}`} (SL: ${od.quantity})`,
                      value: od.orderDetailId || od.id,
                    }))
                  : [];
                
                // Get available serial numbers from items for selected orderDetail
                const selectedOrderDetail = order && Array.isArray(order.orderDetails)
                  ? order.orderDetails.find(od => (od.orderDetailId || od.id) === discrepancy.orderDetailId)
                  : null;
                
                const availableSerials = selectedOrderDetail
                  ? items
                      .filter(item => {
                        // Find item that matches this orderDetail
                        const itemModelId = order.orderDetails.find(od => {
                          const codes = (item.itemCode || "").split(",").map(s => s.trim()).filter(Boolean);
                          return codes.length > 0;
                        });
                        return itemModelId;
                      })
                      .map(item => {
                        const codes = (item.itemCode || "").split(",").map(s => s.trim()).filter(Boolean);
                        return codes;
                      })
                      .flat()
                  : [];
                
                // Get deviceCategoryId from selected orderDetail
                const deviceModelId = selectedOrderDetail?.deviceModelId;
                const deviceCategoryId = deviceModelId ? deviceCategoryMap[deviceModelId] : null;
                
                // Filter conditions by deviceCategoryId
                const filteredConditions = deviceCategoryId
                  ? conditionDefinitions.filter(c => c.deviceCategoryId === deviceCategoryId)
                  : conditionDefinitions;

                return (
                  <Card
                    key={index}
                    size="small"
                    title={`Sự cố #${index + 1}`}
                    extra={
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => {
                          setDiscrepancies(discrepancies.filter((_, i) => i !== index));
                        }}
                      >
                        Xóa
                      </Button>
                    }
                  >
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ display: "block", marginBottom: 4 }}>
                            Loại sự cố <Text type="danger">*</Text>
                          </Text>
                          <Select
                            style={{ width: "100%" }}
                            placeholder="Chọn loại sự cố"
                            value={discrepancy.discrepancyType}
                            onChange={(value) => {
                              const newDiscrepancies = [...discrepancies];
                              newDiscrepancies[index] = {
                                ...newDiscrepancies[index],
                                discrepancyType: value,
                              };
                              setDiscrepancies(newDiscrepancies);
                            }}
                            options={[
                              { label: "Hư hỏng (DAMAGE)", value: "DAMAGE" },
                              { label: "Mất mát (LOSS)", value: "LOSS" },
                              { label: "Khác (OTHER)", value: "OTHER" },
                            ]}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ display: "block", marginBottom: 4 }}>
                            Chi tiết đơn hàng <Text type="danger">*</Text>
                          </Text>
                          <Select
                            style={{ width: "100%" }}
                            placeholder="Chọn chi tiết đơn hàng"
                            value={discrepancy.orderDetailId}
                            onChange={(value) => {
                              const newDiscrepancies = [...discrepancies];
                              newDiscrepancies[index] = {
                                ...newDiscrepancies[index],
                                orderDetailId: value,
                                deviceId: null, // Reset when orderDetail changes
                              };
                              setDiscrepancies(newDiscrepancies);
                            }}
                            options={orderDetailOptions}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ display: "block", marginBottom: 4 }}>
                            Thiết bị (Serial Number) <Text type="danger">*</Text>
                          </Text>
                          <Select
                            style={{ width: "100%" }}
                            placeholder="Chọn thiết bị"
                            value={discrepancy.deviceId ? String(discrepancy.deviceId) : null}
                            onChange={(value) => {
                              const newDiscrepancies = [...discrepancies];
                              newDiscrepancies[index] = {
                                ...newDiscrepancies[index],
                                deviceId: value,
                              };
                              setDiscrepancies(newDiscrepancies);
                            }}
                            disabled={!discrepancy.orderDetailId}
                            options={availableSerials.map(serial => ({
                              label: serial,
                              value: serial,
                            }))}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ display: "block", marginBottom: 4 }}>
                            Điều kiện (Condition Definition) <Text type="danger">*</Text>
                          </Text>
                          <Select
                            style={{ width: "100%" }}
                            placeholder="Chọn điều kiện"
                            value={discrepancy.conditionDefinitionId}
                            onChange={(value) => {
                              const newDiscrepancies = [...discrepancies];
                              newDiscrepancies[index] = {
                                ...newDiscrepancies[index],
                                conditionDefinitionId: value,
                              };
                              setDiscrepancies(newDiscrepancies);
                            }}
                            loading={loadingConditions}
                            disabled={!discrepancy.deviceId || loadingConditions}
                            options={filteredConditions.map(c => ({
                              label: `${c.name}${c.damage ? " (Gây hư hỏng)" : ""}`,
                              value: c.id,
                            }))}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ display: "block", marginBottom: 4 }}>
                            Ghi chú nhân viên
                          </Text>
                          <Input.TextArea
                            rows={3}
                            placeholder="Nhập ghi chú của nhân viên"
                            value={discrepancy.staffNote}
                            onChange={(e) => {
                              const newDiscrepancies = [...discrepancies];
                              newDiscrepancies[index] = {
                                ...newDiscrepancies[index],
                                staffNote: e.target.value,
                              };
                              setDiscrepancies(newDiscrepancies);
                            }}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ display: "block", marginBottom: 4 }}>
                            Ghi chú khách hàng
                          </Text>
                          <Input.TextArea
                            rows={3}
                            placeholder="Nhập ghi chú của khách hàng"
                            value={discrepancy.customerNote}
                            onChange={(e) => {
                              const newDiscrepancies = [...discrepancies];
                              newDiscrepancies[index] = {
                                ...newDiscrepancies[index],
                                customerNote: e.target.value,
                              };
                              setDiscrepancies(newDiscrepancies);
                            }}
                          />
                        </div>
                      </Col>
                    </Row>
                  </Card>
                );
              })}
            </Space>
          )}
        </Space>
      </Card>

      {/* Ảnh bằng chứng */}
      <Card title="Ảnh bằng chứng" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Dragger
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            beforeUpload={() => false}
            onChange={handleEvidenceUpload}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Kéo thả hoặc bấm để chọn ảnh bằng chứng
            </p>
            <p
              className="ant-upload-hint"
              style={{ color: "#888", fontSize: 12 }}
            >
              Hỗ trợ: JPG, PNG, WEBP, PDF
            </p>
          </Dragger>

          {evidenceUrls.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                Danh sách ảnh bằng chứng ({evidenceUrls.length}):
              </Text>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {evidenceUrls.map((url, index) => (
                  <div
                    key={index}
                    style={{
                      position: "relative",
                      border: "1px solid #d9d9d9",
                      borderRadius: 8,
                      padding: 8,
                      background: "#fafafa",
                    }}
                  >
                    {url.startsWith("data:image") ? (
                      <img
                        src={url}
                        alt={`Bằng chứng ${index + 1}`}
                        style={{
                          maxWidth: 150,
                          maxHeight: 150,
                          borderRadius: 4,
                          display: "block",
                        }}
                      />
                    ) : (
                      <div style={{ padding: 20, textAlign: "center" }}>
                        <FilePdfOutlined
                          style={{ fontSize: 32, color: "#1890ff" }}
                        />
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          {evidenceFiles[index]?.name || `File ${index + 1}`}
                        </div>
                      </div>
                    )}
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveEvidence(index)}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        background: "rgba(255,255,255,0.9)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Space>
      </Card>

      {/* Form ký handover report - Hiển thị sau khi tạo thành công */}
      {showSignatureForm && handoverReportId && (
        <Card
          title="Ký biên bản thu hồi"
          className="mb-3"
          style={{ borderColor: "#52c41a" }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Mã PIN *</Text>
                {user?.email && (
                  <div style={{ marginTop: 4, marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Email nhận mã PIN:{" "}
                      <Text strong style={{ color: "#1890ff" }}>
                        {user.email}
                      </Text>
                    </Text>
                  </div>
                )}
                <Space.Compact style={{ width: "100%", marginTop: 8 }}>
                  <Input
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="Nhập mã PIN"
                  />
                  <Button
                    icon={<SendOutlined />}
                    loading={sendingPin}
                    onClick={handleSendPin}
                    disabled={!handoverReportId}
                  >
                    Gửi lại PIN
                  </Button>
                </Space.Compact>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Chữ ký nhân viên *</Text>
                <Input
                  value={staffSignature}
                  onChange={(e) => setStaffSignature(e.target.value)}
                  placeholder="Nhập chữ ký nhân viên"
                  style={{ marginTop: 8 }}
                />
              </div>
            </Col>
          </Row>
          <Space>
            <Button
              type="primary"
              size="large"
              onClick={handleSign}
              loading={signing}
            >
              Ký và hoàn tất
            </Button>
            <Button onClick={() => nav(-1)}>Hủy</Button>
          </Space>
        </Card>
      )}

      {/* Submit button - Chỉ hiển thị khi chưa tạo handover report */}
      {!showSignatureForm && !showReportsList && (
        <Card>
          <Space>
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={saving}
            >
              Tạo biên bản thu hồi
            </Button>
            <Button onClick={() => nav(-1)}>Hủy</Button>
          </Space>
        </Card>
      )}

      {/* Danh sách handover reports - Hiển thị sau khi ký thành công */}
      {showReportsList && (
        <Card title="Danh sách biên bản thu hồi" className="mb-3">
          {loadingReports ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text>Đang tải danh sách biên bản...</Text>
              </div>
            </div>
          ) : handoverReports.length > 0 ? (
            <Table
              rowKey={(r) => r.handoverReportId || r.id}
              columns={[
                {
                  title: "Mã biên bản",
                  dataIndex: "handoverReportId",
                  key: "handoverReportId",
                  width: 120,
                  render: (v) => <Text strong>#{v || "—"}</Text>,
                },
                {
                  title: "Mã Task",
                  dataIndex: "taskId",
                  key: "taskId",
                  width: 100,
                  render: (v) => (v ? `#${v}` : "—"),
                },
                {
                  title: "Thời gian thu hồi",
                  dataIndex: "handoverDateTime",
                  key: "handoverDateTime",
                  width: 180,
                  render: (v) => formatDateTime(v),
                },
                {
                  title: "Trạng thái",
                  dataIndex: "status",
                  key: "status",
                  width: 150,
                  render: (status) => {
                    const s = String(status || "").toUpperCase();
                    let color = "default";
                    if (s === "STAFF_SIGNED") color = "green";
                    else if (s === "CUSTOMER_SIGNED") color = "blue";
                    else if (s === "COMPLETED") color = "geekblue";
                    else if (s === "PENDING") color = "orange";
                    return (
                      <Tag color={color}>{translateHandoverStatus(status)}</Tag>
                    );
                  },
                },
                {
                  title: "Thao tác",
                  key: "actions",
                  width: 200,
                  render: (_, record) => (
                    <Space>
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handlePreviewPdf(record)}
                        loading={
                          pdfGenerating &&
                          selectedReport?.handoverReportId ===
                            record.handoverReportId
                        }
                      >
                        Xem PDF
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownloadPdf(record)}
                        loading={
                          pdfGenerating &&
                          selectedReport?.handoverReportId ===
                            record.handoverReportId
                        }
                      >
                        Tải PDF
                      </Button>
                    </Space>
                  ),
                },
              ]}
              dataSource={handoverReports}
              pagination={false}
              size="small"
            />
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Text type="secondary">Chưa có biên bản thu hồi nào</Text>
            </div>
          )}
          <Divider />
          <Space>
            <Button
              onClick={() => {
                setShowReportsList(false);
                setShowSignatureForm(false);
              }}
            >
              Quay lại
            </Button>
            <Button onClick={() => nav(-1)}>Đóng</Button>
          </Space>
        </Card>
      )}

      {/* Modal preview PDF */}
      <Modal
        title={`Biên bản thu hồi #${
          selectedReport?.handoverReportId || selectedReport?.id || ""
        }`}
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
            onClick={() =>
              selectedReport && handleDownloadPdf(selectedReport)
            }
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

      {/* Container ẩn để render HTML rồi chụp */}
      <div
        ref={printRef}
        style={{
          position: "fixed",
          left: "-99999px",
          top: "-99999px",
          width: "210mm",
          height: "auto",
          backgroundColor: "#ffffff",
          fontFamily:
            "'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif",
          visibility: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -9999,
          overflow: "hidden",
          border: "none",
          margin: 0,
          padding: 0,
        }}
      />
    </div>
  );
}
