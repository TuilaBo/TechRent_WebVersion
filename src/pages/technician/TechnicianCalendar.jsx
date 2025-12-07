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
    Calendar,
    Badge,
    Tabs,
    Form,
    Radio,
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
    EditOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
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
import { listTaskRules } from "../../lib/taskRulesApi";
import { getQcReportsByOrderId } from "../../lib/qcReportApi";
import {
    TECH_TASK_STATUS,
    getTechnicianStatusColor,
    getTaskBadgeStatus,
} from "../../lib/technicianTaskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel, fmtVND } from "../../lib/deviceModelsApi";
import {
    getHandoverReportByOrderIdAndTaskId,
    getHandoverReportsByOrderId
} from "../../lib/handoverReportApi";
import { getStaffCategoryStats } from "../../lib/staffManage";
import { getConditionDefinitions } from "../../lib/condition.js";
import {
    getActiveMaintenanceSchedules,
    getPriorityMaintenanceSchedules,
    getInactiveMaintenanceSchedules,
    getMaintenanceScheduleById,
    updateMaintenanceStatus
} from "../../lib/maintenanceApi";

dayjs.extend(isBetween);

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

/** Kiểm tra xem task có phải là Post rental QC không */
const isPostRentalQC = (task) => {
    if (!task) return false;
    const categoryName = String(task.taskCategoryName || task.categoryName || "").toUpperCase();
    const type = String(task.type || "").toUpperCase();
    const description = String(task.description || task.title || "").toUpperCase();

    // Kiểm tra taskCategoryName: "Post rental QC", "POST_RENTAL_QC", etc.
    if (categoryName.includes("POST") && categoryName.includes("RENTAL") && categoryName.includes("QC")) {
        return true;
    }

    // Kiểm tra type: "POST_RENTAL_QC", "Post rental QC", etc.
    if (type.includes("POST_RENTAL_QC") || (type.includes("POST") && type.includes("RENTAL") && type.includes("QC"))) {
        return true;
    }

    // Kiểm tra description: "Post rental QC", "QC sau thuê", etc.
    if (description.includes("POST") && description.includes("RENTAL") && description.includes("QC")) {
        return true;
    }
    if (description.includes("QC SAU THUÊ") || description.includes("QC SAU THUE")) {
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

// Helper để map maintenance status từ API sang Badge status
const getMaintenanceBadgeStatus = (schedule, isInactive = false) => {
    const status = String(schedule.status || "").toUpperCase();

    // COMPLETED hoặc FAILED luôn là success (dù active hay inactive)
    if (status === "COMPLETED" || status === "FAILED") {
        return "success";
    }

    // Inactive schedules (không phải COMPLETED/FAILED) là error
    if (isInactive || schedule.isInactive) {
        return "error";
    }

    // Active schedules mapping
    switch (status) {
        case "STARTED":
            return "warning";    // Cần xử lý
        case "DELAYED":
            return "processing"; // Đang thực hiện
        default:
            return "warning";    // Default cho active schedules
    }
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
            }
        });
    }

    // Debug: Log allocationMap để kiểm tra
    const isDev =
        typeof globalThis !== "undefined" &&
        globalThis.process &&
        globalThis.process.env &&
        globalThis.process.env.NODE_ENV === "development";

    if (isDev) {
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
            const conditionName = conditionDef?.name || `Tình trạng thiết bị #${conditionDefId}`;
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
      
      <h3>Kỹ thuật viên tham gia</h3>
      <section class="kv">
        ${technicianEntries.length
            ? technicianEntries
                .map(
                    (tech) => `
      <div style="margin-bottom:6px">
        <b>${tech.name || "—"}</b>
        ${tech.phone
                            ? `<br/><span>Số điện thoại: ${tech.phone}</span>`
                            : ""
                        }
        ${tech.email
                            ? `<br/><span>Email: ${tech.email}</span>`
                            : ""
                        }
      </div>
    `
                )
                .join("")
            : `
      <div><b>Họ và tên:</b> ${technicianInfo.name || "—"}</div>
      ${technicianInfo.phone
                ? `<div><b>Số điện thoại:</b> ${technicianInfo.phone}</div>`
                : ""
            }
      ${technicianInfo.email
                ? `<div><b>Email:</b> ${technicianInfo.email}</div>`
                : ""
            }
    `
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
            <th>Tình trạng thiết bị</th>
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
            <th>Tình trạng thiết bị</th>
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

async function elementToPdfBlob(el) {
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
    const [activeSchedules, setActiveSchedules] = useState([]);
    const [prioritySchedules, setPrioritySchedules] = useState([]);
    const [inactiveSchedules, setInactiveSchedules] = useState([]);
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);

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
    const hasFetchedRef = useRef(false); // Prevent double-fetch in StrictMode

    // Maintenance Detail State
    const [maintenanceDetail, setMaintenanceDetail] = useState(null);
    const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);

    // Maintenance Status Update Modal State
    const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
    const [selectedMaintenance, setSelectedMaintenance] = useState(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [statusForm] = Form.useForm();
    const [uploadFileList, setUploadFileList] = useState([]);
    const [taskRulesMap, setTaskRulesMap] = useState({}); // { categoryId -> { maxTasksPerDay, name } }

    const openUpdateStatusModal = (record) => {
        setSelectedMaintenance(record);
        statusForm.resetFields();
        setUploadFileList([]);
        setUpdateStatusModalOpen(true);
    };

    const handleUpdateStatus = async () => {
        try {
            const values = await statusForm.validateFields();
            setUpdatingStatus(true);

            const files = uploadFileList.map(f => f.originFileObj);
            await updateMaintenanceStatus(
                selectedMaintenance.maintenanceScheduleId,
                values.status,
                files
            );

            toast.success("Cập nhật trạng thái thành công!");
            setUpdateStatusModalOpen(false);
            setSelectedMaintenance(null);
            loadTasks(); // Reload data
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.message || "Không thể cập nhật trạng thái");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const canUpdateMaintenanceStatus = (record) => {
        const status = String(record.status || "").toUpperCase();
        // Only allow update if NOT COMPLETED or FAILED
        return status !== "COMPLETED" && status !== "FAILED";
    };

    const viewMaintenanceDetail = async (id) => {
        if (!id) return;
        try {
            const res = await getMaintenanceScheduleById(id);
            if (res && res.data) {
                setMaintenanceDetail(res.data);
                setMaintenanceDrawerOpen(true);
            } else {
                toast.error("Không tìm thấy chi tiết bảo trì");
            }
        } catch (e) {
            console.error(e);
            toast.error("Lỗi khi tải chi tiết bảo trì");
        }
    };


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
        setLoading(true);
        let allTasksRaw = [];
        try {
            allTasksRaw = await listTasks();
        } catch (e) {
            console.error("Failed to load tasks:", e);
            toast.error("Không thể tải danh sách công việc");
        }

        let activeRes = { data: [] };
        let priorityRes = { data: [] };
        let inactiveRes = { data: [] };

        try {
            const results = await Promise.allSettled([
                getActiveMaintenanceSchedules(),
                getPriorityMaintenanceSchedules(),
                getInactiveMaintenanceSchedules(),
            ]);

            if (results[0].status === 'fulfilled') activeRes = results[0].value || { data: [] };
            else console.warn("Failed active maintenance:", results[0].reason);

            if (results[1].status === 'fulfilled') priorityRes = results[1].value || { data: [] };
            else console.warn("Failed priority maintenance:", results[1].reason);

            if (results[2].status === 'fulfilled') inactiveRes = results[2].value || { data: [] };
            else console.warn("Failed inactive maintenance:", results[2].reason);

            // Load all task rules and create category map
            try {
                console.log("DEBUG: Calling listTaskRules API...");
                const allRules = await listTaskRules({ active: true });
                console.log("DEBUG: listTaskRules response:", allRules);

                const rulesMap = {};
                (allRules || []).forEach(rule => {
                    if (rule.taskCategoryId && rule.active) {
                        // If multiple rules for same category, use the one with latest effectiveFrom
                        if (!rulesMap[rule.taskCategoryId] ||
                            new Date(rule.effectiveFrom) > new Date(rulesMap[rule.taskCategoryId].effectiveFrom)) {
                            rulesMap[rule.taskCategoryId] = {
                                maxTasksPerDay: rule.maxTasksPerDay,
                                name: rule.name,
                                description: rule.description,
                                effectiveFrom: rule.effectiveFrom
                            };
                        }
                    }
                });
                console.log("DEBUG: taskRulesMap built:", rulesMap);
                setTaskRulesMap(rulesMap);
            } catch (e) {
                console.warn("Failed to load task rules:", e);
                console.warn("Error status:", e?.response?.status);
                console.warn("Error message:", e?.response?.data?.message || e?.message);

                // TEMPORARY: Mock data for testing UI when API returns 403 (unauthorized)
                // Remove this block after backend grants permission to technician
                if (e?.response?.status === 403) {
                    console.log("DEBUG: Using mock data for taskRulesMap (API 403)");
                    const mockRulesMap = {
                        1: { maxTasksPerDay: 2, name: "Pre rental QC" },
                        2: { maxTasksPerDay: 5, name: "Post rental QC" },
                        4: { maxTasksPerDay: 4, name: "Delivery" },
                        6: { maxTasksPerDay: 4, name: "Pick up" }
                    };
                    setTaskRulesMap(mockRulesMap);
                }
            }
        } catch (err) {
            console.error("Error loading maintenance data:", err);
        }

        try {
            console.log("DEBUG: activeRes", activeRes);
            console.log("DEBUG: priorityRes", priorityRes);

            // Normalize Priority Items (Type A - Flat)
            const rawPriority = (priorityRes?.data?.data || priorityRes?.data || []).map(item => ({
                ...item,
                type: 'PRIORITY',
                maintenanceScheduleId: item.maintenanceScheduleId,
                deviceSerialNumber: item.deviceSerialNumber,
                deviceModelName: item.deviceModelName,
                deviceCategoryName: item.deviceCategoryName,
                nextMaintenanceDate: item.nextMaintenanceDate,
                nextMaintenanceEndDate: item.nextMaintenanceEndDate,
                priorityReason: item.priorityReason || 'SCHEDULED_MAINTENANCE'
            }));

            // Normalize Active Items (Type B - Nested)
            const rawActive = (activeRes?.data?.data || activeRes?.data || []).map(item => ({
                ...item,
                type: 'ACTIVE',
                maintenanceScheduleId: item.maintenanceScheduleId,
                deviceSerialNumber: item.device?.serialNumber,
                deviceModelName: item.device?.deviceModel?.deviceName,
                deviceImageUrl: item.device?.deviceModel?.imageURL,
                deviceCategoryName: item.device?.deviceModel?.deviceCategory?.deviceCategoryName,
                nextMaintenanceDate: item.startDate,
                nextMaintenanceEndDate: item.endDate,
                // Don't set priorityReason here, will be inherited from priority if exists
            }));

            // Create a map of priorityReason by maintenanceScheduleId from priority API
            const priorityReasonMap = new Map();
            rawPriority.forEach(item => {
                if (item.maintenanceScheduleId && item.priorityReason) {
                    priorityReasonMap.set(item.maintenanceScheduleId, item.priorityReason);
                }
            });

            // Combine: priority items first, then active items (with priorityReason inherited)
            const combinedMaintenance = [
                ...rawPriority,
                ...rawActive.map(item => ({
                    ...item,
                    // Inherit priorityReason from priority API if available
                    priorityReason: priorityReasonMap.get(item.maintenanceScheduleId) || item.priorityReason || null
                }))
            ];

            // Deduplicate by maintenanceScheduleId - PREFER PRIORITY items (they come first)
            const uniqueMaintenanceMap = new Map();
            combinedMaintenance.forEach(item => {
                if (item.maintenanceScheduleId && !uniqueMaintenanceMap.has(item.maintenanceScheduleId)) {
                    uniqueMaintenanceMap.set(item.maintenanceScheduleId, item);
                }
            });
            const uniqueMaintenance = Array.from(uniqueMaintenanceMap.values());

            // Lấy Set các maintenanceScheduleId đã có trong active/priority
            const activeScheduleIds = new Set([
                ...rawActive.map(item => item.maintenanceScheduleId),
                ...rawPriority.map(item => item.maintenanceScheduleId)
            ].filter(Boolean));

            // Lọc inactive schedules - loại bỏ những item đã có trong active/priority
            const rawInactive = (inactiveRes?.data?.data || inactiveRes?.data || [])
                .filter(item => !activeScheduleIds.has(item.maintenanceScheduleId))
                .map(item => ({
                    ...item,
                    type: 'INACTIVE',
                    isInactive: true,  // Flag để dùng cho getMaintenanceBadgeStatus
                    maintenanceScheduleId: item.maintenanceScheduleId,
                    deviceSerialNumber: item.device?.serialNumber || item.deviceSerialNumber,
                    deviceModelName: item.device?.deviceModel?.deviceName || item.deviceModelName,
                    deviceCategoryName: item.device?.deviceModel?.deviceCategory?.deviceCategoryName || item.deviceCategoryName,
                    nextMaintenanceDate: item.startDate,
                    nextMaintenanceEndDate: item.endDate,
                }));

            setInactiveSchedules(rawInactive);

            const priorityOrder = {
                "UNDER_MAINTENANCE": 0,
                "RENTAL_CONFLICT": 1,
                "SCHEDULED_MAINTENANCE": 2,
                "USAGE_THRESHOLD": 3
            };

            const sortedMaintenance = uniqueMaintenance.sort((a, b) => {
                const pA = priorityOrder[a.priorityReason] !== undefined ? priorityOrder[a.priorityReason] : 99;
                const pB = priorityOrder[b.priorityReason] !== undefined ? priorityOrder[b.priorityReason] : 99;
                return pA - pB;
            });

            setActiveSchedules(rawActive);
            setPrioritySchedules(sortedMaintenance);

            const allTasks = (Array.isArray(allTasksRaw) ? allTasksRaw : []).map(normalizeTask);
            const display = allTasks.map(taskToDisplay);
            setTasksAll(display);
            const preRentalQcTasks = allTasks.filter((task) => isPreRentalQC(task));
            const postRentalQcTasks = allTasks.filter((task) => isPostRentalQC(task));
            const pickupTasks = allTasks.filter((task) => isPickupTask(task));

            // Combine all types of tasks that need QC reports
            const tasksNeedingQc = [...preRentalQcTasks, ...postRentalQcTasks, ...pickupTasks];

            // Group tasks by orderId to avoid duplicate API calls
            const tasksByOrderId = {};
            tasksNeedingQc.forEach((task) => {
                const orderId = task.orderId;
                const taskId = task.taskId || task.id;
                if (orderId && taskId) {
                    if (!tasksByOrderId[orderId]) {
                        tasksByOrderId[orderId] = [];
                    }
                    // Determine task type: isPostRentalQC, isPickup, or isPreRentalQC
                    const isPostRental = isPostRentalQC(task);
                    const isPickup = isPickupTask(task);
                    tasksByOrderId[orderId].push({ taskId, isPostRental, isPickup });
                }
            });

            // Check QC reports by orderId in parallel
            const qcReportMap = {};
            const qcReportChecks = Object.keys(tasksByOrderId).map(async (orderId) => {
                try {
                    const qcReports = await getQcReportsByOrderId(orderId);
                    const reports = Array.isArray(qcReports) ? qcReports : [];

                    tasksByOrderId[orderId].forEach(({ taskId, isPostRental, isPickup }) => {
                        // For Post Rental QC tasks, check for POST_RENTAL reports
                        // For PickUp tasks, check for POST_RENTAL reports (legacy)
                        // For Pre Rental QC tasks, check for PRE_RENTAL reports
                        const phaseToCheck = (isPostRental || isPickup) ? "POST_RENTAL" : "PRE_RENTAL";
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

            // Preload all handover reports by order for pickup/delivery tasks
            const handoverOrderIds = Array.from(
                new Set(
                    handoverTasks
                        .map((task) => task.orderId)
                        .filter((orderId) => orderId)
                )
            );
            if (handoverOrderIds.length) {
                await Promise.all(
                    handoverOrderIds.map(async (orderId) => {
                        try {
                            const reports = await getHandoverReportsByOrderId(orderId);
                            setHandoverReportsByOrder((prev) => ({
                                ...prev,
                                [orderId]: Array.isArray(reports) ? reports : [],
                            }));
                        } catch (err) {
                            setHandoverReportsByOrder((prev) => ({
                                ...prev,
                                [orderId]: [],
                            }));
                            console.warn("Không thể preload handover reports cho order", orderId, err);
                        }
                    })
                );
            }
        } catch (e) {
            toast.error(e?.response?.data?.message || e?.message || "Không tải được nhiệm vụ");
        } finally {
            setLoading(false);
        }
    }, []);

    // Load tasks on mount (with useRef to prevent double-fetch in React 18 StrictMode)
    useEffect(() => {
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            loadTasks();
        }
    }, []); // ✅ Empty deps - only run once on mount


    // Load handover report for a specific task
    const loadHandoverReport = useCallback(async (taskId, orderId) => {
        if (!taskId || !orderId) return;
        try {
            const report = await getHandoverReportByOrderIdAndTaskId(orderId, taskId);
            if (report) {
                setHandoverReportMap((prev) => ({ ...prev, [taskId]: report }));
            }
        } catch (e) {
            console.warn("Không tìm thấy handover report cho task", taskId, e);
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
            console.warn("Không thể tải danh sách handover reports cho order", orderId, e);
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
                            const orderReports = handoverReportsByOrder[r.orderId] || [];
                            const checkoutReports = orderReports.filter(
                                (report) =>
                                    String(report.handoverType || "").toUpperCase() === "CHECKOUT"
                            );
                            const reportForTask =
                                handoverReport &&
                                    String(handoverReport.handoverType || "").toUpperCase() === "CHECKOUT"
                                    ? handoverReport
                                    : checkoutReports.find(
                                        (report) => Number(report.taskId) === Number(taskId)
                                    ) || null;
                            const previewCheckoutReport = reportForTask || checkoutReports[0] || null;
                            const hasCheckoutReportForTask = Boolean(reportForTask);

                            return (
                                <>
                                    {/* Chỉ hiển thị nút "Tạo biên bản" khi không phải PENDING, không phải COMPLETED và chưa có handover report */}
                                    {!isPending && !isCompleted && !hasCheckoutReportForTask && (
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
                                    {reportForTask && (() => {
                                        // Kiểm tra status của biên bản
                                        const reportStatus = String(reportForTask.status || reportForTask.signatureStatus || "").toUpperCase();
                                        const bothSigned = reportStatus === "BOTH_SIGNED" || 
                                                         reportStatus === "2 BÊN ĐÃ KÝ" ||
                                                         reportStatus.includes("BOTH") ||
                                                         reportStatus.includes("ĐÃ KÝ");

                                        return (
                                            <>
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<EditOutlined />}
                                                    disabled={bothSigned}
                                                    onClick={() => {
                                                        navigate(`/technician/tasks/handover/${taskId}`, {
                                                            state: { task: r, handoverReport: reportForTask },
                                                        });
                                                    }}
                                                    title={bothSigned ? "Không thể cập nhật - Cả 2 bên đã ký biên bản" : ""}
                                                >
                                                    Cập nhật biên bản
                                                </Button>
                                            </>
                                        );
                                    })()}

                                </>
                            );
                        })()}
                        {isPostRentalQC(r) && (() => {
                            const taskId = r.taskId || r.id;
                            const hasQcReport = hasQcReportMap[taskId];

                            // Hiển thị nút cho tất cả status, luôn enable
                            return (
                                <>
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<FileTextOutlined />}
                                        onClick={() => {
                                            navigate(`/technician/tasks/post-rental-qc/${taskId}`, { state: { task: r } });
                                        }}
                                    >
                                        {hasQcReport ? "Cập nhật QC Report" : "Tạo QC Report"}
                                    </Button>
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
                            const orderReports = handoverReportsByOrder[r.orderId] || [];
                            const checkinReports = orderReports.filter(
                                (report) =>
                                    String(report.handoverType || "").toUpperCase() === "CHECKIN"
                            );
                            const fallbackCheckinReport =
                                handoverReport &&
                                    String(handoverReport.handoverType || "").toUpperCase() ===
                                    "CHECKIN"
                                    ? handoverReport
                                    : checkinReports.find(
                                        (report) => Number(report.taskId) === Number(taskId)
                                    ) || checkinReports[0] || null;
                            const hasCheckinReport = Boolean(fallbackCheckinReport);

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
                                    {hasCheckinReport && (() => {
                                        // Kiểm tra status của biên bản
                                        const reportStatus = String(fallbackCheckinReport.status || fallbackCheckinReport.signatureStatus || "").toUpperCase();
                                        const bothSigned = reportStatus === "BOTH_SIGNED" || 
                                                         reportStatus === "2 BÊN ĐÃ KÝ" ||
                                                         reportStatus.includes("BOTH") ||
                                                         reportStatus.includes("ĐÃ KÝ");

                                        return (
                                            <>
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<EditOutlined />}
                                                    disabled={bothSigned}
                                                    onClick={() => {
                                                        navigate(`/technician/tasks/handover-checkin/${taskId}`, {
                                                            state: { task: r, handoverReport: fallbackCheckinReport },
                                                        });
                                                    }}
                                                    title={bothSigned ? "Không thể cập nhật - Cả 2 bên đã ký biên bản" : ""}
                                                >
                                                    Cập nhật biên bản
                                                </Button>
                                            </>
                                        );
                                    })()}
                                </>
                            );
                        })()}
                    </Space>
                ),
            },
        ],
        [
            navigate,
            onClickTask,
            hasQcReportMap,
            confirmingDelivery,
            handleConfirmDelivery,
            confirmedTasks,
            confirmingRetrieval,
            handleConfirmRetrieval,
            confirmedRetrievalTasks,
            handoverReportMap,
            handoverReportsByOrder,
            handlePreviewPdf,
        ]
    );



    // HANDOVER_CHECK: upload ảnh bằng chứng (UI only)
    const evidenceProps = {
        beforeUpload: () => false,
        multiple: true,
        accept: ".jpg,.jpeg,.png,.webp,.pdf",
        onChange: () => message.success("Đã thêm bằng chứng (UI)."),
    };

    /** ---- Helper function to render order, customer, and device details ---- */
    const renderOrderCustomerDeviceDetails = (t) => {
        if (!orderDetail) return null;

        const customerName = customerDetail?.fullName || customerDetail?.username || orderDetail.customerName || "—";
        const customerPhone = customerDetail?.phoneNumber || "";
        const customerEmail = customerDetail?.email || "";
        const address = orderDetail.shippingAddress || t.address || "—";

        return (
            <>
                <Divider />
                <Title level={5} style={{ marginTop: 0 }}>
                    Chi tiết đơn #{orderDetail.orderId || orderDetail.id}
                </Title>
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Trạng thái đơn">
                        {fmtOrderStatus(orderDetail.status || orderDetail.orderStatus)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Khách hàng">
                        <Space direction="vertical" size={0}>
                            <span>{customerName}</span>
                            {customerPhone && (
                                <span>
                                    <PhoneOutlined /> {customerPhone}
                                </span>
                            )}
                            {customerEmail && <span>{customerEmail}</span>}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Địa chỉ giao">
                        <Space>
                            <EnvironmentOutlined />
                            {address}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời gian thuê">
                        {orderDetail.startDate ? fmtDateTime(orderDetail.startDate) : "—"} →{" "}
                        {orderDetail.endDate ? fmtDateTime(orderDetail.endDate) : "—"}
                    </Descriptions.Item>
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
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        {d.deviceModel?.image ? (
                                            <img
                                                src={d.deviceModel.image}
                                                alt={d.deviceModel.name}
                                                style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
                                            />
                                        ) : null}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>
                                                {d.deviceModel?.name || `Model #${d.deviceModelId}`} × {d.quantity}
                                            </div>
                                            {Array.isArray(orderDetail.allocatedDevices) && orderDetail.allocatedDevices.length > 0 && (
                                                <div style={{ marginTop: 4, fontSize: 12, color: "#888" }}>
                                                    {orderDetail.allocatedDevices
                                                        .filter(ad => ad.deviceModelId === d.deviceModelId)
                                                        .map((ad, idx) => (
                                                            <div key={idx}>SN: {ad.serialNumber || "—"}</div>
                                                        ))}
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
        );
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

                    {/* Order, Customer, and Device Details Section */}
                    {renderOrderCustomerDeviceDetails(t)}
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

                    {/* Order, Customer, and Device Details Section */}
                    {renderOrderCustomerDeviceDetails(t)}
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
            const handoverReport = handoverReportMap[taskId];
            const orderReports = orderDetail
                ? handoverReportsByOrder[orderDetail.orderId || orderDetail.id]
                : null;
            const checkoutReports = orderReports
                ? orderReports.filter((report) => {
                    const handoverType = String(report.handoverType || "").toUpperCase();
                    return handoverType === "CHECKOUT" || !handoverType;
                })
                : [];
            const reportForTask =
                handoverReport &&
                    String(handoverReport.handoverType || "").toUpperCase() === "CHECKOUT"
                    ? handoverReport
                    : checkoutReports.find(
                        (report) => Number(report.taskId) === Number(taskId)
                    ) || null;

            return (
                <>
                    {header}
                    <Divider />
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.type || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                            {t.status ? (() => {
                                const { bg, text } = getTechnicianStatusColor(t.status); return (
                                    <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
                                );
                            })() : "—"}
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
                        const reportForTask =
                            handoverReport &&
                                String(handoverReport.handoverType || "").toUpperCase() === "CHECKOUT"
                                ? handoverReport
                                : checkoutReports.find(
                                    (report) => Number(report.taskId) === Number(taskId)
                                ) || null;
                        const reportsToShow = reportForTask ? [reportForTask] : checkoutReports;

                        if (reportsToShow.length > 0) {
                            return (
                                <>
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
                                                        loading={
                                                            pdfGenerating &&
                                                            selectedReport?.handoverReportId === report.handoverReportId
                                                        }
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
                                </>
                            );
                        }
                        return (
                            <Text type="secondary">Chưa có biên bản bàn giao</Text>
                        );
                    })()}
                    <Divider />
                    <Space wrap>
                        {/* Chỉ hiển thị nút "Tạo biên bản bàn giao" khi không phải PENDING, không phải COMPLETED và chưa có biên bản cho task này */}
                        {!isPending && !isCompleted && !reportForTask && (
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
                        {/* Button cập nhật biên bản - giống như pickup */}
                        {reportForTask && (() => {
                            // Kiểm tra status của biên bản
                            const reportStatus = String(reportForTask.status || "").toUpperCase();
                            const bothSigned = reportStatus === "BOTH_SIGNED";
                            
                            return (
                                <Button
                                    type="primary"
                                    icon={<EditOutlined />}
                                    disabled={bothSigned}
                                    onClick={() => {
                                        navigate(`/technician/tasks/handover/${taskId}`, {
                                            state: { task: t, handoverReport: reportForTask },
                                        });
                                    }}
                                    title={bothSigned ? "Không thể cập nhật - Cả 2 bên đã ký biên bản" : ""}
                                >
                                    Cập nhật biên bản
                                </Button>
                            );
                        })()}
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
            const primaryCheckinReport =
                checkinReports.find(
                    (report) => Number(report.taskId) === Number(taskId)
                ) || checkinReports[0] || null;

            return (
                <>
                    {header}
                    <Divider />
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.type || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                            {t.status ? (() => {
                                const { bg, text } = getTechnicianStatusColor(t.status); return (
                                    <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
                                );
                            })() : "—"}
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
                        {hasCheckinReport && primaryCheckinReport && (() => {
                            // Kiểm tra status của biên bản
                            const reportStatus = String(primaryCheckinReport.status || "").toUpperCase();
                            const bothSigned = reportStatus === "BOTH_SIGNED";
                            
                            return (
                                <>
                                    <Button
                                        type="primary"
                                        icon={<EditOutlined />}
                                        disabled={bothSigned}
                                        onClick={() => {
                                            navigate(`/technician/tasks/handover-checkin/${taskId}`, {
                                                state: { task: t, handoverReport: primaryCheckinReport },
                                            });
                                        }}
                                        title={bothSigned ? "Không thể cập nhật - Cả 2 bên đã ký biên bản" : ""}
                                    >
                                        Cập nhật biên bản thu hồi
                                    </Button>
                                    <Button
                                        icon={<EyeOutlined />}
                                        onClick={() => handlePreviewPdf(primaryCheckinReport)}
                                    >
                                        Xem biên bản
                                    </Button>
                                </>
                            );
                        })()}
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
                        {t.status ? (() => {
                            const { bg, text } = getTechnicianStatusColor(t.status); return (
                                <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
                            );
                        })() : "—"}
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
                    {isPostRentalQC(t) && (() => {
                        const taskId = t.taskId || t.id;
                        const hasQcReport = hasQcReportMap[taskId];
                        const buttonLabel = hasQcReport ? "Cập nhật QC Report" : "Tạo QC Report";

                        return (
                            <>
                                {/* Hiển thị nút cho tất cả status, luôn enable */}
                                <Button
                                    type="primary"
                                    icon={<FileTextOutlined />}
                                    onClick={() => {
                                        navigate(`/technician/tasks/post-rental-qc/${taskId}`, { state: { task: t } });
                                    }}
                                >
                                    {buttonLabel}
                                </Button>
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
                        const handoverReport = handoverReportMap[taskId];
                        const hasCheckinReport =
                            handoverReport &&
                            String(handoverReport.handoverType || "").toUpperCase() ===
                            "CHECKIN";

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

    // --- Calendar Logic ---
    const getCalendarData = (value) => {
        if (!value) return { tasks: [], maintenance: [], inactive: [] };

        // Filter tasks
        const dayTasks = tasksAll.filter(t => {
            const start = t.plannedStart ? dayjs(t.plannedStart) : dayjs(t.date);
            return start.isSame(value, 'day');
        });

        // Filter Active/Priority Maintenance
        const dayMaintenance = prioritySchedules.filter(s => {
            const startStr = s.nextMaintenanceDate || s.startDate;
            const endStr = s.nextMaintenanceEndDate || s.endDate;

            if (!startStr) return false;

            const start = dayjs(startStr);
            const end = endStr ? dayjs(endStr) : start;
            return value.isBetween(start, end, 'day', '[]');
        });

        // Filter Inactive Maintenance
        const dayInactive = inactiveSchedules.filter(s => {
            const startStr = s.nextMaintenanceDate || s.startDate;
            const endStr = s.nextMaintenanceEndDate || s.endDate;

            if (!startStr) return false;

            const start = dayjs(startStr);
            const end = endStr ? dayjs(endStr) : start;
            return value.isBetween(start, end, 'day', '[]');
        });

        console.log(`[getCalendarData] Date: ${value.format('DD/MM/YYYY')} - Found ${dayMaintenance.length} active, ${dayInactive.length} inactive maintenance items`);

        return { tasks: dayTasks, maintenance: dayMaintenance, inactive: dayInactive };
    };

    const dateCellRender = (value) => {
        const { tasks, maintenance, inactive } = getCalendarData(value);
        if (tasks.length === 0 && maintenance.length === 0 && inactive.length === 0) return null;

        // Group all items by badge status
        const statusCounts = {
            warning: 0,
            processing: 0,
            success: 0,
            error: 0,
            default: 0
        };

        // Count tasks by status
        tasks.forEach(item => {
            const status = getTaskBadgeStatus(item.status);
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        // Count active maintenance by status
        maintenance.forEach(item => {
            const status = getMaintenanceBadgeStatus(item);
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        // Count inactive maintenance by status
        inactive.forEach(item => {
            const status = getMaintenanceBadgeStatus(item);
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        // Only show statuses that have items
        const statusLabels = {
            warning: 'Cần xử lý',
            processing: 'Đang thực hiện',
            success: 'Hoàn thành',
            error: 'Quá hạn'
        };

        return (
            <ul className="events" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {Object.entries(statusCounts)
                    .filter(([status, count]) => count > 0 && status !== 'default')
                    .map(([status, count]) => (
                        <li key={status}>
                            <Badge
                                status={status}
                                text={<span style={{ fontSize: '10px' }}>{count}</span>}
                            />
                        </li>
                    ))
                }
            </ul>
        );
    };

    const onSelectDate = (value, selectInfo) => {
        setSelectedDate(value);
        setIsDailyModalOpen(true);
    };

    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Title level={3} style={{ margin: 0 }}>Lịch làm việc kỹ thuật</Title>
                <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
                    Tải lại
                </Button>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '8px 16px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <span style={{ fontWeight: 600 }}>Chú thích:</span>
                <Badge status="warning" text="Cần xử lý" />
                <Badge status="processing" text="Đang thực hiện" />
                <Badge status="success" text="Đã hoàn thành" />
                <Badge status="error" text="Quá hạn/Không hoạt động" />
            </div>

            <Card>
                <Calendar
                    cellRender={(value, info) => {
                        if (info.type === 'date') return dateCellRender(value);
                        return info.originNode;
                    }}
                    onSelect={onSelectDate}
                />
            </Card>

            <Modal
                title={`Công việc ngày ${selectedDate.format('DD/MM/YYYY')}`}
                open={isDailyModalOpen}
                onCancel={() => setIsDailyModalOpen(false)}
                footer={null}
                width={900}
            >
                <Tabs defaultActiveKey="1" items={[
                    {
                        key: '1',
                        label: 'QC / Kiểm tra',
                        children: (() => {
                            const tasksData = getCalendarData(selectedDate).tasks;
                            const qcTasks = tasksData.filter(t => ['QC', 'PRE_RENTAL_QC', 'HANDOVER_CHECK'].includes(t.type) || (t.type || '').includes('QC') || (t.taskCategoryName === 'Pre rental QC' || t.taskCategoryName === 'Post rental QC'));

                            // Count tasks by category
                            const cat1Tasks = tasksData.filter(t => t.taskCategoryId === 1 || t.taskCategoryName === 'Pre rental QC');
                            const cat2Tasks = tasksData.filter(t => t.taskCategoryId === 2 || t.taskCategoryName === 'Post rental QC');

                            const rule1 = taskRulesMap[1];
                            const rule2 = taskRulesMap[2];

                            return (
                                <>
                                    {/* Category Summary Bars */}
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                        {rule1 && (
                                            <div style={{
                                                flex: 1,
                                                minWidth: 200,
                                                background: cat1Tasks.length >= rule1.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                                                borderRadius: 8,
                                                padding: '10px 14px',
                                                color: '#fff',
                                            }}>
                                                <div style={{ fontSize: 12, opacity: 0.9 }}>📋 Pre rental QC</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <strong style={{ fontSize: 18 }}>{cat1Tasks.length} / {rule1.maxTasksPerDay}</strong>
                                                    <Tag color={cat1Tasks.length >= rule1.maxTasksPerDay ? 'red' : 'green'}>
                                                        {cat1Tasks.length >= rule1.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                                    </Tag>
                                                </div>
                                            </div>
                                        )}
                                        {rule2 && (
                                            <div style={{
                                                flex: 1,
                                                minWidth: 200,
                                                background: cat2Tasks.length >= rule2.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                                                borderRadius: 8,
                                                padding: '10px 14px',
                                                color: '#fff',
                                            }}>
                                                <div style={{ fontSize: 12, opacity: 0.9 }}>📋 Post rental QC</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <strong style={{ fontSize: 18 }}>{cat2Tasks.length} / {rule2.maxTasksPerDay}</strong>
                                                    <Tag color={cat2Tasks.length >= rule2.maxTasksPerDay ? 'red' : 'green'}>
                                                        {cat2Tasks.length >= rule2.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                                    </Tag>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <Table
                                        dataSource={qcTasks}
                                        rowKey={(r) => r.id || r.taskId}
                                        columns={[
                                            { title: 'Task', dataIndex: 'title' },
                                            { title: 'Loại', dataIndex: 'type', render: (t, r) => <Tag color={TYPES[t]?.color || 'blue'}>{r.taskCategoryName || TYPES[t]?.label || t}</Tag> },
                                            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={getTaskBadgeStatus(s)}>{fmtStatus(s)}</Tag> },
                                            { title: '', render: (r) => <Button onClick={() => { setDetailTask(r); setDrawerOpen(true); }}>Chi tiết</Button> }
                                        ]}
                                        pagination={false}
                                    />
                                </>
                            );
                        })()
                    },
                    {
                        key: '2',
                        label: 'Giao hàng / Thu hồi',
                        children: (() => {
                            const tasksData = getCalendarData(selectedDate).tasks;
                            const deliveryTasks = tasksData.filter(t => ['DELIVERY', 'PICKUP'].includes(t.type) || (t.taskCategoryName || '').includes('Giao') || (t.taskCategoryName || '').includes('Thu') || (t.taskCategoryName === 'Delivery' || t.taskCategoryName === 'Pick up rental order'));

                            // Count tasks by category
                            const cat4Tasks = tasksData.filter(t => t.taskCategoryId === 4 || t.taskCategoryName === 'Delivery');
                            const cat6Tasks = tasksData.filter(t => t.taskCategoryId === 6 || t.taskCategoryName === 'Pick up rental order');

                            const rule4 = taskRulesMap[4];
                            const rule6 = taskRulesMap[6];

                            return (
                                <>
                                    {/* Category Summary Bars */}
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                        {rule4 && (
                                            <div style={{
                                                flex: 1,
                                                minWidth: 200,
                                                background: cat4Tasks.length >= rule4.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                                                borderRadius: 8,
                                                padding: '10px 14px',
                                                color: '#fff',
                                            }}>
                                                <div style={{ fontSize: 12, opacity: 0.9 }}>🚚 Delivery</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <strong style={{ fontSize: 18 }}>{cat4Tasks.length} / {rule4.maxTasksPerDay}</strong>
                                                    <Tag color={cat4Tasks.length >= rule4.maxTasksPerDay ? 'red' : 'green'}>
                                                        {cat4Tasks.length >= rule4.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                                    </Tag>
                                                </div>
                                            </div>
                                        )}
                                        {rule6 && (
                                            <div style={{
                                                flex: 1,
                                                minWidth: 200,
                                                background: cat6Tasks.length >= rule6.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
                                                borderRadius: 8,
                                                padding: '10px 14px',
                                                color: '#fff',
                                            }}>
                                                <div style={{ fontSize: 12, opacity: 0.9 }}>📦 Pick up</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <strong style={{ fontSize: 18 }}>{cat6Tasks.length} / {rule6.maxTasksPerDay}</strong>
                                                    <Tag color={cat6Tasks.length >= rule6.maxTasksPerDay ? 'red' : 'green'}>
                                                        {cat6Tasks.length >= rule6.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                                    </Tag>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <Table
                                        dataSource={deliveryTasks}
                                        rowKey={(r) => r.id || r.taskId}
                                        columns={[
                                            { title: 'Task', dataIndex: 'title' },
                                            { title: 'Thiết bị', dataIndex: 'device' },
                                            { title: 'Địa điểm', dataIndex: 'location' },
                                            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={getTaskBadgeStatus(s)}>{fmtStatus(s)}</Tag> },
                                            { title: '', render: (r) => <Button onClick={() => { setDetailTask(r); setDrawerOpen(true); }}>Chi tiết</Button> }
                                        ]}
                                        pagination={false}
                                    />
                                </>
                            );
                        })()
                    },
                    {
                        key: '3',
                        label: 'Bảo trì',
                        children: (() => {
                            const { maintenance, inactive } = getCalendarData(selectedDate);

                            // Get priority IDs from prioritySchedules for matching
                            const priorityIds = new Set(prioritySchedules.map(p => p.maintenanceScheduleId));

                            // Combine and sort: priority items first, then by priorityReason
                            const priorityOrder = { 'RENTAL_CONFLICT': 1, 'SCHEDULED_MAINTENANCE': 2, 'USAGE_THRESHOLD': 3 };
                            const allMaintenance = [...maintenance, ...inactive].sort((a, b) => {
                                // Priority schedules first
                                const aPriority = priorityIds.has(a.maintenanceScheduleId) ? 0 : 1;
                                const bPriority = priorityIds.has(b.maintenanceScheduleId) ? 0 : 1;
                                if (aPriority !== bPriority) return aPriority - bPriority;

                                // Then by priorityReason
                                const pa = priorityOrder[a.priorityReason] || 99;
                                const pb = priorityOrder[b.priorityReason] || 99;
                                return pa - pb;
                            });

                            // DEBUG: Console log for priority schedules
                            console.log("DEBUG [Bảo trì Tab] prioritySchedules:", prioritySchedules);
                            console.log("DEBUG [Bảo trì Tab] priorityIds (maintenanceScheduleId):", [...priorityIds]);
                            console.log("DEBUG [Bảo trì Tab] allMaintenance after sorting:", allMaintenance.map(m => ({
                                id: m.maintenanceScheduleId,
                                name: m.deviceModelName,
                                priorityReason: m.priorityReason,
                                isPriority: priorityIds.has(m.maintenanceScheduleId)
                            })));

                            const getPriorityTag = (item) => {
                                const reason = item.priorityReason;
                                const config = {
                                    'RENTAL_CONFLICT': { color: 'red', label: 'Ưu tiên' },
                                    'SCHEDULED_MAINTENANCE': { color: 'orange', label: 'Bình thường' },
                                    'USAGE_THRESHOLD': { color: 'blue', label: 'Thấp' },
                                };
                                const c = config[reason];
                                if (c) {
                                    return <Tag color={c.color}>{c.label}</Tag>;
                                }
                                return <Tag color="default">—</Tag>;
                            };

                            return (
                                <Table
                                    dataSource={allMaintenance}
                                    rowKey="maintenanceScheduleId"
                                    scroll={{ x: 950 }}
                                    size="small"
                                    columns={[
                                        {
                                            title: 'Thiết bị',
                                            width: 200,
                                            render: (r) => (
                                                <Space>
                                                    {r.deviceImageUrl && (
                                                        <img
                                                            src={r.deviceImageUrl}
                                                            alt={r.deviceModelName}
                                                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                                                        />
                                                    )}
                                                    <div>
                                                        <div style={{ fontWeight: 'bold' }}>{r.deviceModelName || '—'}</div>
                                                        <div style={{ fontSize: 11, color: '#888' }}>SN: {r.deviceSerialNumber || '—'}</div>
                                                    </div>
                                                </Space>
                                            )
                                        },
                                        {
                                            title: 'Ưu tiên', width: 130, render: (r) => getPriorityTag(r)
                                        },
                                        {
                                            title: 'Trạng thái', width: 100, render: (r) => {
                                                const status = getMaintenanceBadgeStatus(r);
                                                const statusText = {
                                                    'warning': 'Cần xử lý',
                                                    'processing': 'Đang thực hiện',
                                                    'success': 'Đã hoàn thành',
                                                    'error': 'Quá hạn'
                                                };
                                                return <Tag color={status}>{statusText[status] || r.status}</Tag>;
                                            }
                                        },
                                        { title: 'Thời gian', width: 100, render: (r) => `${dayjs(r.nextMaintenanceDate).format('DD/MM')} - ${r.nextMaintenanceEndDate ? dayjs(r.nextMaintenanceEndDate).format('DD/MM') : '...'}` },
                                        {
                                            title: 'Hành động',
                                            width: 160,
                                            fixed: 'right',
                                            render: (r) => (
                                                <Space size="small">
                                                    <Button size="small" onClick={() => viewMaintenanceDetail(r.maintenanceScheduleId)}>Chi tiết</Button>
                                                    <Button
                                                        size="small"
                                                        type="primary"
                                                        onClick={() => openUpdateStatusModal(r)}
                                                        disabled={!canUpdateMaintenanceStatus(r)}
                                                    >
                                                        Bảo trì
                                                    </Button>
                                                </Space>
                                            )
                                        }
                                    ]}
                                    pagination={false}
                                />
                            );
                        })()
                    }
                ]} />
            </Modal>

            <Drawer
                title={detailTask ? detailTask.title : "Chi tiết công việc"}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={720}
            >
                {renderDetailBody(detailTask)}
            </Drawer>

            <Drawer
                title="Chi tiết lịch bảo trì"
                open={maintenanceDrawerOpen}
                onClose={() => setMaintenanceDrawerOpen(false)}
                width={720}
            >
                {maintenanceDetail ? (
                    <Descriptions title="Thông tin bảo trì" bordered column={1}>
                        <Descriptions.Item label="Thiết bị">{maintenanceDetail.device?.deviceModel?.deviceName}</Descriptions.Item>
                        <Descriptions.Item label="Serial Number">{maintenanceDetail.device?.serialNumber}</Descriptions.Item>
                        <Descriptions.Item label="Danh mục">{maintenanceDetail.device?.deviceModel?.deviceCategory?.deviceCategoryName}</Descriptions.Item>
                        <Descriptions.Item label="Thời gian">
                            {dayjs(maintenanceDetail.startDate || maintenanceDetail.nextMaintenanceDate).format('DD/MM/YYYY')} - {maintenanceDetail.endDate ? dayjs(maintenanceDetail.endDate).format('DD/MM/YYYY') : '...'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                            <Tag color={getTechnicianStatusColor(maintenanceDetail.status)}>{maintenanceDetail.status}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Mô tả">
                            {maintenanceDetail.description || maintenanceDetail.details || "Không có mô tả"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Thông số kỹ thuật">
                            {maintenanceDetail.device?.deviceModel?.specifications || "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Hình ảnh thiết bị">
                            {maintenanceDetail.device?.deviceModel?.imageURL ? (
                                <img src={maintenanceDetail.device?.deviceModel?.imageURL} alt="Device" style={{ maxWidth: '200px' }} />
                            ) : "Không có hình ảnh"}
                        </Descriptions.Item>
                    </Descriptions>
                ) : <Text>Đang tải...</Text>}
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

            {/* Maintenance Status Update Modal */}
            <Modal
                title={`Cập nhật trạng thái bảo trì - ${selectedMaintenance?.deviceSerialNumber || ''}`}
                open={updateStatusModalOpen}
                onCancel={() => {
                    setUpdateStatusModalOpen(false);
                    setSelectedMaintenance(null);
                }}
                onOk={handleUpdateStatus}
                okText="Cập nhật"
                cancelText="Hủy"
                confirmLoading={updatingStatus}
            >
                <Form form={statusForm} layout="vertical">
                    <Form.Item
                        name="status"
                        label="Trạng thái"
                        rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
                    >
                        <Radio.Group>
                            <Space direction="vertical">
                                <Radio value="DELAYED">Tạm hoãn (DELAYED)</Radio>
                                <Radio value="COMPLETED">Hoàn thành (COMPLETED)</Radio>
                                <Radio value="FAILED">Thất bại (FAILED)</Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item label="Ảnh bằng chứng (tùy chọn)">
                        <Upload
                            listType="picture-card"
                            fileList={uploadFileList}
                            onChange={({ fileList }) => setUploadFileList(fileList)}
                            beforeUpload={() => false}
                            multiple
                            accept="image/*"
                        >
                            {uploadFileList.length < 5 && (
                                <div>
                                    <InboxOutlined />
                                    <div style={{ marginTop: 8 }}>Chọn ảnh</div>
                                </div>
                            )}
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Task Detail Drawer */}
            <Drawer
                title={detailTask ? detailTask.title || detailTask.taskCategoryName || "Chi tiết công việc" : "Chi tiết công việc"}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={720}
            >
                {renderDetailBody(detailTask)}
            </Drawer>
        </div >
    );
}

