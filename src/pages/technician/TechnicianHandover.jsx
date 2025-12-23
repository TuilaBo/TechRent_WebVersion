// src/pages/technician/TechnicianHandover.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  createHandoverReportCheckout,
  getHandoverReportById,
  getHandoverReportByOrderIdAndTaskId,
  sendHandoverReportPin,
  updateHandoverReportSignature,
  getHandoverReportsByOrderId,
  updateHandoverReportCheckout,
} from "../../lib/handoverReportApi";
import {
  getQcReportsByOrderId,
  getPreRentalQcReportById,
} from "../../lib/qcReportApi";
import { getConditionDefinitions, getDeviceConditions } from "../../lib/condition";
import { listDevices } from "../../lib/deviceManage";
import { useAuthStore } from "../../store/authStore";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// =========================
// PRINT / PDF helpers
// =========================

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

/**
 * Chuẩn hoá conditionDefinition từ BE
 * -> luôn có:
 *   - id: number
 *   - deviceModelId: number | null
 *   - conditionSeverity: string
 */
const normalizeConditionDef = (raw = {}) => {
  const idRaw =
    raw.id ??
    raw.conditionDefinitionId ??
    raw.conditionDefinition?.id ??
    null;

  const deviceModelIdRaw =
    raw.deviceModelId ??
    raw.deviceModel?.deviceModelId ??
    raw.deviceModel?.id ??
    null;

  const conditionSeverity =
    raw.conditionSeverity ??
    raw.severity ??
    raw.defaultSeverity ??
    "INFO";

  return {
    ...raw,
    id: idRaw != null ? Number(idRaw) : null,
    deviceModelId:
      deviceModelIdRaw != null ? Number(deviceModelIdRaw) : null,
    conditionSeverity,
  };
};

function convertQcDeviceConditionsToFormEntries(qcReport) {
  if (!qcReport || !Array.isArray(qcReport.deviceConditions)) return [];
  const entries = [];
  const seen = new Set();

  qcReport.deviceConditions.forEach((dc) => {
    const serial =
      (dc.deviceSerial && String(dc.deviceSerial)) ||
      (dc.device?.serialNumber && String(dc.device?.serialNumber)) ||
      (dc.deviceId ? String(dc.deviceId) : "");
    if (!serial) return;

    const snapshots =
      dc.snapshots || dc.baselineSnapshots || dc.finalSnapshots || [];
    const fallbackImages = Array.isArray(dc.images)
      ? dc.images.map(String)
      : Array.isArray(dc.snapshotImages)
      ? dc.snapshotImages.map(String)
      : [];
    const fallbackDetails = dc.conditionDefinitionId
      ? [
          {
            conditionDefinitionId: dc.conditionDefinitionId,
            severity: dc.severity || "NONE",
          },
        ]
      : [];

    const pushEntry = (detail, images = []) => {
      if (!detail?.conditionDefinitionId) return;
      const severity = detail.severity || "NONE";
      const dedupKey = `${serial}__${detail.conditionDefinitionId}__${severity}`;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
      entries.push({
        deviceId: serial,
        conditionDefinitionId: detail.conditionDefinitionId,
        severity,
        images: Array.isArray(images) ? images.map(String) : [],
      });
    };

    if (snapshots.length) {
      snapshots.forEach((snapshot) => {
        const snapshotDetails =
          Array.isArray(snapshot.conditionDetails) &&
          snapshot.conditionDetails.length > 0
            ? snapshot.conditionDetails
            : fallbackDetails;
        if (!snapshotDetails || snapshotDetails.length === 0) return;
        const snapshotImages =
          Array.isArray(snapshot.images) && snapshot.images.length > 0
            ? snapshot.images
            : fallbackImages;
        snapshotDetails.forEach((detail) => pushEntry(detail, snapshotImages));
      });
    } else if (fallbackDetails.length) {
      fallbackDetails.forEach((detail) => pushEntry(detail, fallbackImages));
    }
  });

  return entries;
}

// =========================
// build HTML cho PDF
// =========================

function buildHandoverReportHtml(
  report,
  order = null,
  conditionDefinitions = []
) {
  if (!report) return "<div>Không có dữ liệu biên bản</div>";

  // Map condition definitions theo id sau khi đã normalize
  const conditionMap = {};
  conditionDefinitions.forEach((cd) => {
    const key =
      cd.id ??
      cd.conditionDefinitionId ??
      (cd.conditionDefinition && cd.conditionDefinition.id);
    if (key != null) {
      conditionMap[Number(key)] = cd;
    }
  });

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
  const technicianPhone = technicianInfoParts[1] || "";
  const technicianEmail = technicianInfoParts[2] || "";
  const technicianContact = {
    name: technicianName,
    phone: technicianPhone,
    email: technicianEmail,
  };

  const technicianEntries = (() => {
    const raw = [];
    const pushTech = (tech) => {
      if (!tech) return;
      const name =
        tech.fullName ||
        tech.username ||
        tech.staffName ||
        tech.name ||
        technicianContact.name ||
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

    if (!raw.length && technicianContact.name && technicianContact.name !== "—") {
      raw.push({
        staffId: null,
        name: technicianContact.name,
        phone: technicianContact.phone,
        email: technicianContact.email,
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
    technicianEntries[0]?.name || technicianContact.name || "—";

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

  // allocationMap, deviceConditionMap, ... (GIỮ NGUYÊN như bạn đang có)
  const allocationMap = {};
  if (order && Array.isArray(order.orderDetails)) {
    order.orderDetails.forEach((od) => {
      if (od.allocations && Array.isArray(od.allocations)) {
        od.allocations.forEach((allocation) => {
          if (allocation.allocationId) {
            allocationMap[allocation.allocationId] = {
              deviceModelName:
                od.deviceModel?.deviceName ||
                od.deviceModel?.name ||
                od.deviceName ||
                "—",
              serialNumber:
                allocation.device?.serialNumber ||
                allocation.serialNumber ||
                "—",
              deviceId: allocation.device?.deviceId || allocation.deviceId || null,
              unit: "cái",
              quantity: od.quantity || 1,
            };
          }
        });
      }
    });
  }

  const deviceConditionMap = {};
  if (Array.isArray(report.deviceConditions)) {
    report.deviceConditions.forEach((dc) => {
      if (dc.allocationId && dc.deviceId) {
        let serialNumber = dc.deviceSerial || "—";
        if (
          !serialNumber &&
          dc.baselineSnapshots &&
          Array.isArray(dc.baselineSnapshots)
        ) {
          const firstSnapshot = dc.baselineSnapshots[0];
          if (firstSnapshot && firstSnapshot.deviceSerial) {
            serialNumber = firstSnapshot.deviceSerial;
          }
        }

        if (!allocationMap[dc.allocationId]) {
          allocationMap[dc.allocationId] = {
            deviceId: dc.deviceId,
            serialNumber,
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
            allocationMap[dc.allocationId].serialNumber = serialNumber;
          }
        }

        deviceConditionMap[dc.deviceId] = {
          allocationId: dc.allocationId,
          serialNumber,
        };
      }
    });
  }

  const deviceInfoFromOrder = {};
  if (order && Array.isArray(order.orderDetails)) {
    order.orderDetails.forEach((od) => {
      const deviceModelName =
        od.deviceModel?.deviceName ||
        od.deviceModel?.name ||
        od.deviceName ||
        "—";
      if (od.allocations && Array.isArray(od.allocations)) {
        od.allocations.forEach((allocation) => {
          const deviceId = allocation.device?.deviceId || allocation.deviceId;
          const serialNumber =
            allocation.device?.serialNumber || allocation.serialNumber;
          if (deviceId) {
            deviceInfoFromOrder[deviceId] = {
              serialNumber: serialNumber || "—",
              deviceModelName,
              allocationId: allocation.allocationId,
            };
          }
        });
      }
    });
  }

  if (Array.isArray(report.deviceConditions)) {
    report.deviceConditions.forEach((dc) => {
      if (dc.allocationId && dc.deviceId) {
        const deviceInfo = deviceInfoFromOrder[dc.deviceId];
        if (deviceInfo && allocationMap[dc.allocationId]) {
          if (
            !allocationMap[dc.allocationId].deviceModelName ||
            allocationMap[dc.allocationId].deviceModelName === "—"
          ) {
            allocationMap[dc.allocationId].deviceModelName =
              deviceInfo.deviceModelName;
          }
          if (
            !allocationMap[dc.allocationId].serialNumber ||
            allocationMap[dc.allocationId].serialNumber === "—"
          ) {
            allocationMap[dc.allocationId].serialNumber = deviceInfo.serialNumber;
          }
        }
      }
    });
  }

  if (Array.isArray(report.items)) {
    report.items.forEach((item) => {
      if (item.allocationId && !allocationMap[item.allocationId]) {
        if (order && Array.isArray(order.orderDetails)) {
          order.orderDetails.forEach((od) => {
            if (od.allocations && Array.isArray(od.allocations)) {
              od.allocations.forEach((allocation) => {
                if (allocation.allocationId === item.allocationId) {
                  const deviceId = allocation.device?.deviceId || allocation.deviceId;
                  const serialNumber =
                    allocation.device?.serialNumber || allocation.serialNumber;
                  const deviceModelName =
                    od.deviceModel?.deviceName ||
                    od.deviceModel?.name ||
                    od.deviceName ||
                    "—";

                  allocationMap[item.allocationId] = {
                    deviceId,
                    serialNumber: serialNumber || "—",
                    deviceModelName,
                    unit: "cái",
                    quantity: od.quantity || 1,
                  };
                }
              });
            }
          });
        }

        if (
          !allocationMap[item.allocationId] &&
          Array.isArray(report.deviceConditions)
        ) {
          const deviceCondition = report.deviceConditions.find(
            (dc) => dc.allocationId === item.allocationId
          );
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
              let serialNumber = deviceCondition.deviceSerial || "—";
              if (
                !serialNumber &&
                deviceCondition.baselineSnapshots &&
                Array.isArray(deviceCondition.baselineSnapshots)
              ) {
                const firstSnapshot = deviceCondition.baselineSnapshots[0];
                if (firstSnapshot && firstSnapshot.deviceSerial) {
                  serialNumber = firstSnapshot.deviceSerial;
                }
              }

              let deviceModelName = "—";
              if (order && Array.isArray(order.orderDetails)) {
                for (const od of order.orderDetails) {
                  if (od.allocations && Array.isArray(od.allocations)) {
                    for (const allocation of od.allocations) {
                      const deviceId =
                        allocation.device?.deviceId || allocation.deviceId;
                      if (deviceId === deviceCondition.deviceId) {
                        deviceModelName =
                          od.deviceModel?.deviceName ||
                          od.deviceModel?.name ||
                          od.deviceName ||
                          "—";
                        if (!serialNumber || serialNumber === "—") {
                          serialNumber =
                            allocation.device?.serialNumber ||
                            allocation.serialNumber ||
                            "—";
                        }
                        break;
                      }
                    }
                    if (deviceModelName !== "—") break;
                  }
                }
              }

              allocationMap[item.allocationId] = {
                deviceId: deviceCondition.deviceId,
                serialNumber,
                deviceModelName,
                unit: "cái",
                quantity: 1,
              };
            }
          }
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

    const uniqueConditionsMap = new Map();
    const uniqueImages = new Set();

    deviceConditions.forEach((dc) => {
      const snapshots = dc.baselineSnapshots || dc.snapshots || [];
      if (snapshots.length === 0) return;

      const handoverOutSnapshot = snapshots.find(
        (s) => String(s.source || "").toUpperCase() === "HANDOVER_OUT"
      );
      const qcBeforeSnapshot = snapshots.find(
        (s) => String(s.source || "").toUpperCase() === "QC_BEFORE"
      );
      const selectedSnapshot =
        handoverOutSnapshot || qcBeforeSnapshot || snapshots[0];

      const conditionDetails = selectedSnapshot.conditionDetails || [];
      conditionDetails.forEach((cd) => {
        const uniqueKey = `${cd.conditionDefinitionId}_${cd.severity}`;
        if (!uniqueConditionsMap.has(uniqueKey)) {
          // Ưu tiên lấy tên từ response trước
          const conditionName =
            cd.conditionDefinitionName ||
            cd.name ||
            conditionMap[Number(cd.conditionDefinitionId)]?.name ||
            conditionMap[cd.conditionDefinitionId]?.name ||
            `Tình trạng #${cd.conditionDefinitionId}`;
          uniqueConditionsMap.set(uniqueKey, conditionName);
        }
      });

      if (Array.isArray(selectedSnapshot.images)) {
        selectedSnapshot.images.forEach((img) => {
          const imgKey = img;
          if (!uniqueImages.has(imgKey)) {
            uniqueImages.add(imgKey);
          }
        });
      }
    });

    const conditionsArray = Array.from(uniqueConditionsMap.values());

    const conditionsHtml =
      conditionsArray.length > 0
        ? conditionsArray.map((c) => `<div>${c}</div>`).join("")
        : "—";

    const imagesArray = Array.from(uniqueImages);
    const imagesHtml =
      imagesArray.length > 0
        ? `<div style="display:flex;flex-wrap:wrap;gap:4px">
          ${imagesArray
            .map((img, imgIdx) => {
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
            })
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
            <td>${idx + 1}</td>
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

      if (item.allocationId) {
        const deviceInfo = allocationMap[item.allocationId];
        if (deviceInfo) {
          let lookupDeviceId = deviceInfo.deviceId;
          if (!lookupDeviceId && Array.isArray(report.deviceConditions)) {
            const dc = report.deviceConditions.find(
              (d) => d.allocationId === item.allocationId
            );
            if (dc) lookupDeviceId = dc.deviceId;
          }
          const { conditions, images } = lookupDeviceId
            ? getDeviceConditionsHtml(lookupDeviceId)
            : { conditions: "—", images: "—" };

          return `
            <tr>
              <td>${idx + 1}</td>
              <td>${deviceInfo.deviceModelName}</td>
              <td>${deviceInfo.serialNumber}</td>
              <td style="text-align:center">${deviceInfo.unit}</td>
              <td style="text-align:center">${deviceInfo.quantity}</td>
              <td style="text-align:center">${deviceInfo.quantity}</td>
              <td>${conditions}</td>
              <td>${images}</td>
            </tr>
          `;
        }

        if (Array.isArray(report.deviceConditions)) {
          const deviceCondition = report.deviceConditions.find(
            (dc) => dc.allocationId === item.allocationId
          );
          if (deviceCondition && deviceCondition.deviceId) {
            let deviceModelName = "—";
            let serialNumber = deviceCondition.deviceSerial || "—";

            if (order && Array.isArray(order.orderDetails)) {
              for (const od of order.orderDetails) {
                if (od.allocations && Array.isArray(od.allocations)) {
                  for (const allocation of od.allocations) {
                    const deviceId =
                      allocation.device?.deviceId || allocation.deviceId;
                    if (deviceId === deviceCondition.deviceId) {
                      deviceModelName =
                        od.deviceModel?.deviceName ||
                        od.deviceModel?.name ||
                        od.deviceName ||
                        "—";
                      if (!serialNumber || serialNumber === "—") {
                        serialNumber =
                          allocation.device?.serialNumber ||
                          allocation.serialNumber ||
                          "—";
                      }
                      break;
                    }
                  }
                  if (deviceModelName !== "—") break;
                }
              }
            }

            const { conditions, images } = deviceCondition.deviceId
              ? getDeviceConditionsHtml(deviceCondition.deviceId)
              : { conditions: "—", images: "—" };

            return `
                <tr>
                  <td>${idx + 1}</td>
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

        return `
            <tr>
              <td>${idx + 1}</td>
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

      return `
        <tr>
          <td>${idx + 1}</td>
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

  return `
    ${GLOBAL_PRINT_CSS}
    <div id="handover-print-root" style="
      width:794px;margin:0 auto;background:#fff;color:#111;
      font-family:'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif;font-size:13px;line-height:1.5;
      padding:32px 40px;box-sizing:border-box;">
      
      ${NATIONAL_HEADER_HTML}
      
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:22px;font-weight:700;letter-spacing:.5px">BIÊN BẢN BÀN GIAO</div>
        <div style="color:#666">Số: #${
          report.handoverReportId || report.id || "—"
        }</div>
      </div>
      <hr style="border:none;border-top:1px solid #e8e8e8;margin:12px 0 16px"/>
      
      <section class="kv">
        <div><b>Mã đơn hàng:</b> #${report.orderId || "—"}</div>
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
            ${tech.email ? `<br/><span>Email: ${tech.email}</span>` : ""}
          </div>
        `
                )
                .join("")
            : `
          <div><b>Họ và tên:</b> ${technicianContact.name || "—"}</div>
          ${
            technicianContact.phone
              ? `<div><b>Số điện thoại:</b> ${technicianContact.phone}</div>`
              : ""
          }
          ${
            technicianContact.email
              ? `<div><b>Email:</b> ${technicianContact.email}</div>`
              : ""
          }
        `
        }
        <div><b>Chữ ký nhân viên:</b> ${report.staffSignature || "—"}</div>
        ${
          report.staffSigned
            ? `<div><b>Đã ký vào:</b> ${staffSignedDate}</div>`
            : ""
        }
      </section>
      
      <h3>Thông tin bàn giao</h3>
      <section class="kv">
        <div><b>Thời gian bàn giao:</b> ${handoverDate}</div>
        <div><b>Địa điểm bàn giao:</b> ${
          report.handoverLocation || "—"
        }</div>
        ${
          deliveryDate !== "—"
            ? `<div><b>Thời gian giao hàng:</b> ${deliveryDate}</div>`
            : ""
        }
      </section>
      
      <h3>Danh sách thiết bị bàn giao</h3>
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
          ${
            itemsRows ||
            "<tr><td colspan='8' style='text-align:center'>Không có thiết bị</td></tr>"
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
            ? `<div><b>Vai trò:</b> ${translateRole(
                report.createdByStaff.role
              )}</div>`
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
                ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>'
                : ""
            }
          </div>
          <div>
            ${
              report.customerSigned
                ? `<div style="color:#000;font-weight:600">${customerName}</div>`
                : "(Ký, ghi rõ họ tên)"
            }
          </div>
        </div>
        <div style="flex:1;text-align:center">
          <div><b>NHÂN VIÊN</b></div>
          <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${
              report.staffSigned
                ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>'
                : ""
            }
          </div>
          <div>
            ${
              report.staffSigned
                ? `<div style="color:#000;font-weight:600">${technicianDisplayName}</div>`
                : "(Ký, ghi rõ họ tên)"
            }
          </div>
        </div>
      </section>
    </div>
  `;
}

async function elementToPdfBlob(el) {
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

export default function TechnicianHandover() {
  const nav = useNavigate();
  const { taskId: paramTaskId } = useParams();
  const { state } = useLocation();
  const user = useAuthStore((s) => s.user);

  const actualTaskId = paramTaskId || state?.task?.id || state?.task?.taskId;
  const initialHandoverReport = state?.handoverReport;

  // States
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [order, setOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingPin, setSendingPin] = useState(false);
  const [signing, setSigning] = useState(false);

  // Handover report states
  const [handoverReportId, setHandoverReportId] = useState(null);
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
  const [_evidenceFiles, setEvidenceFiles] = useState([]);
  const [_evidenceUrls, setEvidenceUrls] = useState([]);

  // Device conditions state
  const [deviceConditions, setDeviceConditions] = useState([]);
  const [conditionDefinitions, setConditionDefinitions] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [devicesMap, setDevicesMap] = useState({}); // serial -> deviceId
  const isUpdateMode = Boolean(handoverReportId);
  const orderRef = useRef(null);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const hydrateReportToForm = useCallback(
    (report, options = {}) => {
      if (!report) return;
      const effectiveOrder = options.orderData || orderRef.current;

      const deviceSerialMap = (() => {
        const map = {};
        if (effectiveOrder && Array.isArray(effectiveOrder.orderDetails)) {
          effectiveOrder.orderDetails.forEach((od) => {
            if (Array.isArray(od.allocations)) {
              od.allocations.forEach((allocation) => {
                const deviceId =
                  allocation.device?.deviceId || allocation.deviceId;
                if (!deviceId) return;
                const serial =
                  allocation.device?.serialNumber ||
                  allocation.serialNumber ||
                  allocation.deviceSerial ||
                  "";
                map[Number(deviceId)] = {
                  serial: serial || "",
                  deviceModelId: od.deviceModelId,
                };
              });
            }
          });
        }

        if (Array.isArray(report.items)) {
          report.items.forEach((item) => {
            const deviceId = item.deviceId || item.device?.deviceId;
            if (!deviceId) return;
            const serial =
              item.deviceSerialNumber ||
              item.deviceSerial ||
              item.itemCode ||
              "";
            const deviceModelId = item.deviceModelId || null;
            if (!map[Number(deviceId)] || !map[Number(deviceId)].serial) {
              map[Number(deviceId)] = {
                serial: serial || map[Number(deviceId)]?.serial || "",
                deviceModelId:
                  deviceModelId || map[Number(deviceId)]?.deviceModelId || null,
              };
            }
          });
        }
        return map;
      })();

      setHandoverReportId(report.handoverReportId || report.id || null);

      const customerParts = (report.customerInfo || "")
        .split("•")
        .map((part) => part.trim())
        .filter(Boolean);
      setCustomerName(customerParts[0] || "");
      setCustomerPhone(customerParts[1] || "");
      setCustomerEmail(customerParts[2] || "");
      setTechnicianInfo(report.technicianInfo || "");
      setHandoverDateTime(
        report.handoverDateTime ? dayjs(report.handoverDateTime) : dayjs()
      );
      setHandoverLocation(report.handoverLocation || "");
      setCustomerSignature(report.customerSignature || "");
      setPinCode("");
      const reportStatus = String(report.status || "").toUpperCase();
      const shouldShowSignature =
        reportStatus === "PENDING_STAFF_SIGNATURE" ||
        reportStatus === "STAFF_PENDING" ||
        reportStatus === "DRAFT";
      setShowSignatureForm(shouldShowSignature);
      setStaffSignature(
        report.staffSignature || user?.fullName || user?.username || ""
      );

      if (Array.isArray(report.items) && report.items.length > 0) {
        const hydratedItems = report.items.map((item, idx) => {
          const serialCandidates = [
            item.deviceSerialNumber,
            item.serialNumber,
            item.itemCode,
          ].filter(Boolean);
          const uniqueSerials = Array.from(new Set(serialCandidates));
          return {
            itemName:
              item.deviceModelName || item.itemName || `Thiết bị #${idx + 1}`,
            itemCode:
              uniqueSerials.length > 0
                ? uniqueSerials.join(", ")
                : item.itemCode || "",
            unit: item.unit || "cái",
            orderedQuantity: item.orderedQuantity || item.quantity || 1,
            deliveredQuantity: item.deliveredQuantity || item.quantity || 1,
          };
        });
        setItems(hydratedItems);
      } else {
        setItems([]);
      }

      if (Array.isArray(report.evidenceUrls)) {
        setEvidenceUrls(report.evidenceUrls.map(String));
      } else {
        setEvidenceUrls([]);
      }
      setEvidenceFiles([]);

      if (
        Array.isArray(report.deviceConditions) &&
        report.deviceConditions.length > 0
      ) {
        // Debug: Log raw deviceConditions from report
        console.log('DEBUG hydrateReportToForm - Raw deviceConditions:', JSON.stringify(report.deviceConditions, null, 2));
        
        const mappedDeviceConditions = report.deviceConditions.map((dc, idx) => {
          // Debug: Log each raw dc
          console.log(`DEBUG hydrateReportToForm - dc[${idx}]:`, dc);
          
          const numericDeviceId = Number(dc.deviceId) || null;
          let serial =
            dc.deviceSerial || dc.device?.serialNumber || "";
          const snapshots = Array.isArray(dc.baselineSnapshots)
            ? dc.baselineSnapshots
            : Array.isArray(dc.snapshots)
            ? dc.snapshots
            : Array.isArray(dc.finalSnapshots)
            ? dc.finalSnapshots
            : [];
          let resolvedConditionDefinitionId =
            dc.conditionDefinitionId || null;
          let resolvedSeverity = dc.severity || "";
          let resolvedImages = Array.isArray(dc.images)
            ? dc.images.map(String)
            : Array.isArray(dc.snapshotImages)
            ? dc.snapshotImages.map(String)
            : [];
          if (
            (!serial || serial === String(numericDeviceId || "")) &&
            numericDeviceId &&
            deviceSerialMap[numericDeviceId]?.serial
          ) {
            serial = deviceSerialMap[numericDeviceId].serial;
          }
          if (!serial && snapshots.length) {
            const snapshotWithSerial = snapshots.find(
              (snap) => snap?.deviceSerial
            );
            if (snapshotWithSerial?.deviceSerial) {
              serial = snapshotWithSerial.deviceSerial;
            }

            const snapshotWithCondition = snapshots.find(
              (snap) =>
                Array.isArray(snap.conditionDetails) &&
                snap.conditionDetails.length > 0
            );
            if (snapshotWithCondition) {
              const detail = snapshotWithCondition.conditionDetails[0];
              if (!resolvedConditionDefinitionId) {
                resolvedConditionDefinitionId =
                  detail.conditionDefinitionId || null;
              }
              if (!resolvedSeverity) {
                resolvedSeverity = detail.severity || "";
              }
            }

            if (!resolvedImages.length) {
              const snapshotWithImages = snapshots.find(
                (snap) =>
                  Array.isArray(snap.images) && snap.images.length > 0
              );
              if (snapshotWithImages) {
                resolvedImages = snapshotWithImages.images.map(String);
              }
            }
          }
          return {
            deviceId:
              serial?.trim() ||
              (numericDeviceId ? String(numericDeviceId) : ""),
            conditionDefinitionId: resolvedConditionDefinitionId,
            severity: resolvedSeverity,
            images: resolvedImages,
          };
        });
        console.debug(
          "✅ Hydrated device conditions from report:",
          mappedDeviceConditions
        );
        setDeviceConditions(mappedDeviceConditions);
      } else if (!options.preserveDeviceConditions) {
        console.debug(
          "⚠️ No deviceConditions in report response, resetting to empty"
        );
        setDeviceConditions([]);
      }
    },
    [user]
  );

  // Fetch task + order
  useEffect(() => {
    const loadData = async () => {
      if (!actualTaskId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const taskData = await getTaskById(actualTaskId);
        if (!taskData) {
          toast.error("Không tìm thấy công việc");
          nav(-1);
          return;
        }

        const normalizedTask = normalizeTask(taskData);
        setTask(normalizedTask);

        if (normalizedTask.orderId) {
          const orderData = await getRentalOrderById(normalizedTask.orderId);
          setOrder(orderData);

          if (orderData?.customerId) {
            try {
              const cus = await fetchCustomerById(orderData.customerId);
              const normalizedCus = normalizeCustomer
                ? normalizeCustomer(cus)
                : cus;
              const customerNameValue =
                normalizedCus.fullName || normalizedCus.username || "";
              setCustomerName(customerNameValue);
              setCustomerPhone(normalizedCus.phoneNumber || "");
              setCustomerEmail(normalizedCus.email || "");
              setCustomerSignature(customerNameValue);
            } catch {
              console.error("Error fetching customer");
            }
          }

          if (user) {
            const techInfoStr = [
              user.username || user.fullName || "",
              user.email || "",
            ]
              .filter(Boolean)
              .join(" • ");
            setTechnicianInfo(techInfoStr);
          }

          if (orderData?.shippingAddress) {
            setHandoverLocation(orderData.shippingAddress);
          }

          let qcReportDevices = [];
          let preRentalQcReport = null;
          try {
            const qcReports = await getQcReportsByOrderId(
              normalizedTask.orderId
            );
            if (Array.isArray(qcReports) && qcReports.length > 0) {
              preRentalQcReport = qcReports.find(
                (r) => String(r.phase || "").toUpperCase() === "PRE_RENTAL"
              );

              const matchingReport = qcReports.find(
                (r) =>
                  r.taskId === normalizedTask.taskId ||
                  r.taskId === normalizedTask.id
              );
              const reportToUse =
                preRentalQcReport || matchingReport || qcReports[0];

              if (reportToUse?.devices && Array.isArray(reportToUse.devices)) {
                qcReportDevices = reportToUse.devices;
              }

              if (preRentalQcReport?.qcReportId || preRentalQcReport?.id) {
                try {
                  const qcReportId =
                    preRentalQcReport.qcReportId || preRentalQcReport.id;
                  const fullPreRentalReport =
                    await getPreRentalQcReportById(qcReportId);
                  if (fullPreRentalReport) {
                    preRentalQcReport = fullPreRentalReport;
                  }
                } catch (e) {
                  console.warn(
                    "Could not load full PRE_RENTAL QC report:",
                    e
                  );
                }
              }
            }
          } catch (e) {
            console.log("No QC report found or error:", e);
          }

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
                
                // Try to get serial numbers from QC report devices first
                let serialNumbers = [];
                const matchingDevices = qcReportDevices.filter(
                  (d) =>
                    Number(
                      d.deviceModelId || d.modelId || d.device_model_id
                    ) === deviceModelId
                );
                
                serialNumbers = matchingDevices
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
                
                // Fallback: Get serial numbers from orderDetail allocations if QC devices not available
                if (serialNumbers.length === 0 && Array.isArray(od.allocations)) {
                  serialNumbers = od.allocations
                    .map((alloc) => 
                      alloc.device?.serialNumber || 
                      alloc.serialNumber || 
                      alloc.deviceSerial || 
                      ""
                    )
                    .filter(Boolean)
                    .map(String);
                }

                const itemCode =
                  serialNumbers.length > 0
                    ? serialNumbers.join(", ")
                    : normalizedModel.code || normalizedModel.sku || "";

                return {
                  itemName:
                    normalizedModel.name || `Model #${od.deviceModelId}`,
                  itemCode,
                  unit: "cái",
                  orderedQuantity: quantity,
                  deliveredQuantity: quantity,
                };
              } catch {
                const deviceModelId = Number(od.deviceModelId);
                const quantity = Number(od.quantity || 1);
                
                // Try to get serial numbers from QC report devices first
                let serialNumbers = [];
                const matchingDevices = qcReportDevices.filter(
                  (d) =>
                    Number(
                      d.deviceModelId || d.modelId || d.device_model_id
                    ) === deviceModelId
                );
                
                serialNumbers = matchingDevices
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
                
                // Fallback: Get serial numbers from orderDetail allocations if QC devices not available
                if (serialNumbers.length === 0 && Array.isArray(od.allocations)) {
                  serialNumbers = od.allocations
                    .map((alloc) => 
                      alloc.device?.serialNumber || 
                      alloc.serialNumber || 
                      alloc.deviceSerial || 
                      ""
                    )
                    .filter(Boolean)
                    .map(String);
                }
                
                const itemCode =
                  serialNumbers.length > 0 ? serialNumbers.join(", ") : "";

                return {
                  itemName: `Model #${od.deviceModelId}`,
                  itemCode,
                  unit: "cái",
                  orderedQuantity: quantity,
                  deliveredQuantity: quantity,
                };
              }
            });

            const itemsData = await Promise.all(itemsPromises);
            setItems(itemsData);
          }

          let existingCheckoutReport = null;
          if (
            initialHandoverReport &&
            String(initialHandoverReport.handoverType || "").toUpperCase() ===
              "CHECKOUT"
          ) {
            existingCheckoutReport = initialHandoverReport;
          }

          if (!existingCheckoutReport) {
            try {
              const fetchedReport =
                await getHandoverReportByOrderIdAndTaskId(
                  normalizedTask.orderId,
                  normalizedTask.taskId || normalizedTask.id
                );
              if (
                fetchedReport &&
                String(fetchedReport.handoverType || "").toUpperCase() ===
                  "CHECKOUT"
              ) {
                existingCheckoutReport = fetchedReport;
              }
            } catch (err) {
              console.warn("Không thể tải biên bản bàn giao hiện có:", err);
            }
          }

          if (existingCheckoutReport) {
            hydrateReportToForm(existingCheckoutReport, { orderData });
          } else if (
            preRentalQcReport &&
            Array.isArray(preRentalQcReport.deviceConditions) &&
            preRentalQcReport.deviceConditions.length > 0
          ) {
            const prefilledDeviceConditions =
              convertQcDeviceConditionsToFormEntries(preRentalQcReport);
            if (prefilledDeviceConditions.length > 0) {
              setDeviceConditions(prefilledDeviceConditions);
            }
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
  }, [actualTaskId, nav, user, hydrateReportToForm, initialHandoverReport]);

  // Load condition definitions theo order (đã normalize)
  useEffect(() => {
    const loadConditionDefinitions = async () => {
      if (
        !order ||
        !Array.isArray(order.orderDetails) ||
        order.orderDetails.length === 0
      ) {
        setConditionDefinitions([]);
        return;
      }

      try {
        setLoadingConditions(true);

        const modelIds = new Set();
        for (const orderDetail of order.orderDetails) {
          if (orderDetail.deviceModelId) {
            modelIds.add(Number(orderDetail.deviceModelId));
          }
        }

        const allConditions = [];
        for (const modelId of modelIds) {
          try {
            const conditions = await getConditionDefinitions({
              deviceModelId: modelId,
            });
            const normalized = (conditions || []).map(normalizeConditionDef);
            allConditions.push(...normalized);
          } catch (e) {
            console.warn(
              `Failed to load conditions for model ${modelId}:`,
              e
            );
          }
        }

        const uniqueConditions = Array.from(
          new Map(
            allConditions
              .filter((c) => c.id != null)
              .map((c) => [c.id, c])
          ).values()
        );

        console.log("Loaded condition definitions:", uniqueConditions);
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

  // Load devices map: serial -> deviceId
  useEffect(() => {
    const loadDevicesMap = async () => {
      if (!items || items.length === 0) {
        setDevicesMap({});
        return;
      }

      try {
        const serialNumbers = items
          .map((item) => {
            const codes = (item.itemCode || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            return codes;
          })
          .flat();

        if (serialNumbers.length === 0) {
          setDevicesMap({});
          return;
        }

        const allDevices = await listDevices();
        const devicesMapNew = {};

        if (Array.isArray(allDevices)) {
          serialNumbers.forEach((serial) => {
            const device = allDevices.find((d) => {
              const deviceSerial = String(
                d.serialNumber ||
                  d.serial ||
                  d.serialNo ||
                  d.deviceId ||
                  d.id ||
                  ""
              ).toUpperCase();
              return deviceSerial === String(serial).toUpperCase();
            });

            if (device) {
              const deviceId = device.deviceId || device.id;
              // Store key as uppercase to match the comparison
              devicesMapNew[String(serial).toUpperCase()] = Number(deviceId);
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

  // Auto-load tình trạng hiện tại của thiết bị
  useEffect(() => {
    const loadCurrentDeviceConditions = async () => {
      if (!items || items.length === 0 || Object.keys(devicesMap).length === 0) {
        return;
      }

      // Chỉ load nếu chưa có device conditions
      if (deviceConditions.length > 0) {
        return;
      }

      try {
        const allDevices = await listDevices();
        const newDeviceConditions = [];

        // Lấy tất cả serial numbers từ items
        const allSerials = items
          .map((item) => {
            const codes = (item.itemCode || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            return codes;
          })
          .flat();

        for (const serial of allSerials) {
          try {
            // Tìm device từ serial
            const device = Array.isArray(allDevices)
              ? allDevices.find((d) => {
                  const deviceSerial = String(
                    d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id || ""
                  ).toUpperCase();
                  return deviceSerial === String(serial).toUpperCase();
                })
              : null;

            if (!device) continue;

            const deviceId = Number(device.deviceId || device.id);

            // Lấy tình trạng hiện tại của thiết bị
            const deviceConditionsData = await getDeviceConditions(deviceId);

            let conditionsArray = [];
            if (Array.isArray(deviceConditionsData)) {
              conditionsArray = deviceConditionsData;
            } else if (deviceConditionsData && Array.isArray(deviceConditionsData.data)) {
              conditionsArray = deviceConditionsData.data;
            }

            if (conditionsArray.length === 0) continue;

            // Lấy condition mới nhất (sort by capturedAt)
            const latestCondition = conditionsArray
              .sort((a, b) => {
                const timeA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
                const timeB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
                return timeB - timeA;
              })[0];

            if (!latestCondition || !latestCondition.conditionDefinitionId) continue;

            // Map severity
            let mappedSeverity = String(latestCondition.severity || "INFO").toUpperCase();
            const validSeverities = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
            if (mappedSeverity === "NONE") mappedSeverity = "INFO";
            if (!validSeverities.includes(mappedSeverity)) {
              mappedSeverity = "INFO";
            }

            newDeviceConditions.push({
              deviceId: String(serial), // Store as serial for form
              conditionDefinitionId: latestCondition.conditionDefinitionId,
              severity: mappedSeverity,
              images: Array.isArray(latestCondition.images)
                ? latestCondition.images.filter(Boolean)
                : [],
            });
          } catch (error) {
            console.warn(`Không thể tải tình trạng cho thiết bị ${serial}:`, error);
          }
        }

        if (newDeviceConditions.length > 0) {
          console.log("✅ Auto-loaded current device conditions:", newDeviceConditions);
          setDeviceConditions(newDeviceConditions);
          message.success(
            `Đã tự động điền tình trạng hiện tại cho ${newDeviceConditions.length} thiết bị`
          );
        }
      } catch (error) {
        console.warn("Không thể tải tình trạng thiết bị:", error);
      }
    };

    loadCurrentDeviceConditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, devicesMap]);

  // Convert file -> base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Evidence upload (giữ nguyên)
  const _handleEvidenceUpload = async (info) => {
    const { file } = info;
    const fileObj = file.originFileObj || file;

    if (!fileObj) return;

    if (file.status !== "removed") {
      try {
        const base64Url = await fileToBase64(fileObj);

        const fileExists = _evidenceFiles.some(
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

  const _handleRemoveEvidence = (index) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== index));
    toast.success("Đã xóa ảnh bằng chứng");
  };

  // Gửi PIN
  const handleSendPin = async () => {
    if (!handoverReportId) {
      toast.error("Chưa có handover report để gửi PIN");
      return;
    }

    try {
      setSendingPin(true);
      await sendHandoverReportPin(handoverReportId);
      toast.success("Đã gửi mã PIN thành công!");
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e?.message || "Không thể gửi mã PIN"
      );
    } finally {
      setSendingPin(false);
    }
  };

  // Submit create / update
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
      toast.error("Vui lòng nhập địa điểm bàn giao");
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

      // DEBUG: Log items and devicesMap to understand the mapping
      console.log("🔍 DEBUG - items:", JSON.stringify(items, null, 2));
      console.log("🔍 DEBUG - devicesMap:", JSON.stringify(devicesMap, null, 2));

      const itemsNew = [];
      for (const item of items) {
        const serialNumbers = (item.itemCode || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        console.log(`🔍 DEBUG - Processing item: ${item.itemName}, itemCode: "${item.itemCode}", serialNumbers:`, serialNumbers);

        for (const serial of serialNumbers) {
          // Use uppercase to match the stored keys
          const deviceId = devicesMap[serial.toUpperCase()];
          console.log(`🔍 DEBUG - Looking up serial "${serial.toUpperCase()}" in devicesMap, found deviceId: ${deviceId}`);
          if (deviceId) {
            const existingItem = itemsNew.find((i) => i.deviceId === deviceId);
            if (!existingItem) {
              itemsNew.push({
                deviceId,
                evidenceUrls: [],
              });
            }
          } else {
            console.warn(`Could not find deviceId for serial: ${serial}`);
          }
        }
      }
      
      console.log("🔍 DEBUG - itemsNew after processing:", JSON.stringify(itemsNew, null, 2));

      const deviceConditionsPayload = [];
      for (const condition of deviceConditions) {
        if (
          !condition.deviceId ||
          !condition.conditionDefinitionId ||
          !condition.severity
        ) {
          continue;
        }

        const deviceId = devicesMap[String(condition.deviceId).toUpperCase()];
        if (deviceId) {
          deviceConditionsPayload.push({
            deviceId: Number(deviceId),
            conditionDefinitionId: Number(condition.conditionDefinitionId),
            severity: String(condition.severity),
            images: Array.isArray(condition.images)
              ? condition.images.map(String)
              : [],
          });
        } else {
          console.warn(
            `Could not find deviceId for serial: ${condition.deviceId}`
          );
        }
      }

      const itemsWithEvidence = itemsNew.map((item) => ({
        ...item,
        evidenceUrls: [],
      }));

      const basePayload = {
        customerInfo: customerInfoStr,
        technicianInfo: technicianInfo.trim(),
        handoverDateTime:
          handoverDateTime.format("YYYY-MM-DDTHH:mm:ss.SSS[Z]"),
        handoverLocation: handoverLocation.trim(),
        customerSignature: customerSignature.trim(),
        items: itemsWithEvidence,
        deviceConditions: deviceConditionsPayload,
      };

      if (handoverReportId) {
        const updatePayload = { ...basePayload };
        console.log(
          "🔁 TechnicianHandover - Update payload:",
          JSON.stringify(updatePayload, null, 2)
        );
        await updateHandoverReportCheckout(handoverReportId, updatePayload);
        toast.success("Đã cập nhật biên bản bàn giao thành công!");
        try {
          const refreshed = await getHandoverReportById(handoverReportId);
          hydrateReportToForm(refreshed, { orderData: order });
        } catch (err) {
          console.error("Error reloading handover report:", err);
        }
        if (order?.orderId || order?.id) {
          await loadHandoverReports(order.orderId || order.id);
        }
        nav("/technician");
        return;
      }

      const payload = {
        ...basePayload,
        taskId: task.taskId || task.id,
      };

      console.log("🔍 TechnicianHandover - Payload before API call:", {
        ...payload,
        itemsCount: payload.items.length,
        deviceConditionsCount: payload.deviceConditions.length,
      });

      const result = await createHandoverReportCheckout(payload);
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
      toast.success("Đã tạo biên bản bàn giao thành công!");

      let reportData = null;
      try {
        reportData = await getHandoverReportById(reportId);
      } catch (e) {
        console.error("Error fetching handover report:", e);
      }

      try {
        await sendHandoverReportPin(reportId);
        toast.success("Đã gửi mã PIN thành công!");
      } catch (e) {
        console.error("Error sending PIN:", e);
        toast.error("Không thể gửi mã PIN tự động. Vui lòng gửi thủ công.");
      }

      if (reportData) {
        try {
          hydrateReportToForm(reportData, {
            orderData: order,
            preserveDeviceConditions: true,
          });
          await handlePreviewPdf(reportData);
        } catch (e) {
          console.error("Error previewing PDF:", e);
        }
      } else {
        let fallbackDeviceConditions = [];

        if (deviceConditions.length > 0) {
          fallbackDeviceConditions = deviceConditions;
        } else if (
          basePayload.deviceConditions &&
          basePayload.deviceConditions.length > 0
        ) {
          const deviceIdToSerialMap = {};
          Object.keys(devicesMap).forEach((serial) => {
            const deviceId = devicesMap[serial];
            if (deviceId) {
              deviceIdToSerialMap[deviceId] = serial;
            }
          });

          fallbackDeviceConditions = basePayload.deviceConditions.map((dc) => {
            const deviceId = Number(dc.deviceId);
            const serial = deviceIdToSerialMap[deviceId] || String(dc.deviceId);

            return {
              deviceId: serial,
              conditionDefinitionId: dc.conditionDefinitionId,
              severity: dc.severity,
              images: Array.isArray(dc.images)
                ? dc.images.map(String)
                : [],
            };
          });
        }

        hydrateReportToForm(
          {
            ...basePayload,
            handoverReportId: reportId,
            id: reportId,
            status: "PENDING_STAFF_SIGNATURE",
            handoverType: "CHECKOUT",
            deviceConditions: fallbackDeviceConditions,
          },
          {
            orderData: order,
            preserveDeviceConditions: true,
          }
        );
      }
    } catch (e) {
      console.error("Create handover report error:", e);
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.details ||
          e?.message ||
          "Không thể tạo biên bản bàn giao"
      );
    } finally {
      setSaving(false);
    }
  };

  const loadHandoverReports = async (orderId) => {
    if (!orderId) return;
    try {
      setLoadingReports(true);
      const reports = await getHandoverReportsByOrderId(orderId);
      setHandoverReports(Array.isArray(reports) ? reports : []);
    } catch (e) {
      console.error("Error loading handover reports:", e);
      toast.error("Không thể tải danh sách biên bản bàn giao");
      setHandoverReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

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
        "Đã ký biên bản bàn giao thành công! Trạng thái: STAFF_SIGNED"
      );

      if (order?.orderId || order?.id) {
        await loadHandoverReports(order.orderId || order.id);
      }

      nav("/technician");
      return;
    } catch (e) {
      console.error("Sign handover report error:", e);
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.details ||
          e?.message ||
          "Không thể ký biên bản bàn giao"
      );
    } finally {
      setSigning(false);
    }
  };

  const handlePreviewPdf = async (report) => {
    try {
      setPdfGenerating(true);
      setSelectedReport(report);

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl("");
      }

      let orderData = order || null;
      let condDefs = [];

      if (report.orderId) {
        try {
          orderData = await getRentalOrderById(report.orderId);
          if (orderData && Array.isArray(orderData.orderDetails)) {
            const modelIds = Array.from(
              new Set(
                orderData.orderDetails
                  .map((od) => od.deviceModelId)
                  .filter(Boolean)
              )
            );
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
              orderDetails: orderData.orderDetails.map((od) => ({
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
        const raw = await getConditionDefinitions();
        condDefs = (Array.isArray(raw) ? raw : []).map(normalizeConditionDef);
      } catch (e) {
        console.warn("Could not fetch condition definitions for PDF:", e);
      }

      if (printRef.current) {
        printRef.current.style.visibility = "visible";
        printRef.current.style.opacity = "1";
        printRef.current.style.left = "-99999px";
        printRef.current.style.top = "-99999px";

        printRef.current.innerHTML = buildHandoverReportHtml(
          report,
          orderData,
          condDefs
        );

        const allElements = printRef.current.querySelectorAll("*");
        allElements.forEach((el) => {
          el.style.fontFamily =
            "'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif";
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
        const blob = await elementToPdfBlob(printRef.current);

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

  const handleDownloadPdf = async (report) => {
    try {
      setPdfGenerating(true);

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl("");
      }

      let orderData = order || null;
      let condDefs = [];

      if (report.orderId) {
        try {
          orderData = await getRentalOrderById(report.orderId);
          if (orderData && Array.isArray(orderData.orderDetails)) {
            const modelIds = Array.from(
              new Set(
                orderData.orderDetails
                  .map((od) => od.deviceModelId)
                  .filter(Boolean)
              )
            );
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
              orderDetails: orderData.orderDetails.map((od) => ({
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
        const raw = await getConditionDefinitions();
        condDefs = (Array.isArray(raw) ? raw : []).map(normalizeConditionDef);
      } catch (e) {
        console.warn("Could not fetch condition definitions for PDF:", e);
      }

      if (printRef.current) {
        printRef.current.style.visibility = "visible";
        printRef.current.style.opacity = "1";
        printRef.current.style.left = "-99999px";
        printRef.current.style.top = "-99999px";

        printRef.current.innerHTML = buildHandoverReportHtml(
          report,
          orderData,
          condDefs
        );

        const allElements = printRef.current.querySelectorAll("*");
        allElements.forEach((el) => {
          el.style.fontFamily =
            "'Arial','Helvetica','Times New Roman','DejaVu Sans',sans-serif";
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
        const blob = await elementToPdfBlob(printRef.current);

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

  // Columns cho bảng items
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
      render: (val) => val || 0,
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
          {isUpdateMode ? "Cập nhật biên bản bàn giao" : "Tạo biên bản bàn giao"}
        </Title>
        <Tag color="blue">HANDOVER REPORT</Tag>
      </Space>

      {/* Thông tin công việc */}
      <Card title="Thông tin công việc" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã công việc">
            {task.taskId || task.id}
          </Descriptions.Item>
          <Descriptions.Item label="Mã đơn">
            {task.orderId || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Loại công việc">
            {task.taskCategoryName || "—"}
          </Descriptions.Item>

          <Descriptions.Item label="Trạng thái công việc">
            <Tag color={getStatusColor(task.status)}>
              {translateStatus(task.status) || "—"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Thông tin bàn giao */}
      <Card title="Thông tin bàn giao" className="mb-3">
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
              <Text strong>Thời gian bàn giao *</Text>
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
              <Text strong>Địa điểm bàn giao *</Text>
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

      {/* Tình trạng thiết bị */}
      <Card title="Tình trạng thiết bị" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Button
              type="dashed"
              onClick={() => {
                const availableSerials = items
                  .map((item) => {
                    const codes = (item.itemCode || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return codes;
                  })
                  .flat();
                if (availableSerials.length === 0) {
                  message.warning(
                    "Vui lòng đợi thiết bị được load trước khi thêm điều kiện"
                  );
                  return;
                }

                setDeviceConditions([
                  ...deviceConditions,
                  {
                    deviceId: null,
                    conditionDefinitionId: null,
                    severity: "",
                    images: [],
                  },
                ]);
              }}
            >
              + Thêm tình trạng thiết bị
            </Button>
          </div>

          {deviceConditions.length === 0 ? (
            <Text
              type="secondary"
              style={{ display: "block", marginTop: 8 }}
            >
              Chưa có tình trạng nào được thêm. Nhấn nút "Thêm tình trạng thiết
              bị" để bắt đầu.
            </Text>
          ) : (
            <Space
              direction="vertical"
              style={{ width: "100%" }}
              size="middle"
            >
              {deviceConditions.map((condition, index) => {
                const availableSerials = items
                  .map((item) => {
                    const codes = (item.itemCode || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return codes;
                  })
                  .flat();

                const selectedSerial = condition.deviceId;
                const normalizedSelectedSerial = selectedSerial
                  ? String(selectedSerial)
                  : "";

                const serialOptions = Array.from(
                  new Set(
                    normalizedSelectedSerial &&
                      !availableSerials.includes(normalizedSelectedSerial)
                      ? [normalizedSelectedSerial, ...availableSerials]
                      : availableSerials
                  )
                );

                // Tìm deviceModelId từ order.orderDetails dựa trên serial
                let deviceModelId = null;
                if (
                  selectedSerial &&
                  order &&
                  Array.isArray(order.orderDetails)
                ) {
                  // Tìm trong allocations của các orderDetails
                  for (const od of order.orderDetails) {
                    if (Array.isArray(od.allocations)) {
                      const matchingAllocation = od.allocations.find((alloc) => {
                        const allocSerial = 
                          alloc.device?.serialNumber || 
                          alloc.serialNumber || 
                          alloc.deviceSerial || 
                          '';
                        return allocSerial === selectedSerial;
                      });
                      if (matchingAllocation) {
                        deviceModelId = Number(od.deviceModelId);
                        break;
                      }
                    }
                  }
                  
                  // Fallback: tìm từ items nếu không tìm thấy trong allocations
                  if (!deviceModelId) {
                    const matchingItem = items.find((item) =>
                      (item.itemCode || '')
                        .split(',')
                        .map((s) => s.trim())
                        .includes(selectedSerial)
                    );
                    if (matchingItem) {
                      // Tìm orderDetail có itemName matching
                      const matchingOd = order.orderDetails.find((od) => {
                        const modelName = od.deviceModel?.name || od.deviceModelName || '';
                        return modelName === matchingItem.itemName;
                      });
                      if (matchingOd) {
                        deviceModelId = Number(matchingOd.deviceModelId);
                      }
                    }
                  }
                }

                console.log('DEBUG: selectedSerial =', selectedSerial, 'deviceModelId =', deviceModelId, 'conditionDefinitions count =', conditionDefinitions.length);

                const filteredConditions = deviceModelId
                  ? conditionDefinitions.filter(
                      (c) => c.deviceModelId === deviceModelId
                    )
                  : conditionDefinitions;

                const currentValue =
                  condition.conditionDefinitionId != null
                    ? Number(condition.conditionDefinitionId)
                    : null;

                // Đảm bảo condition đã chọn luôn có trong options
                let finalConditions = filteredConditions;
                if (
                  currentValue != null &&
                  !filteredConditions.find((c) => c.id === currentValue)
                ) {
                  const selectedCondition = conditionDefinitions.find(
                    (c) => c.id === currentValue
                  );
                  if (selectedCondition) {
                    finalConditions = [selectedCondition, ...filteredConditions];
                  }
                }
                
                // Debug: Log condition info
                console.log('DEBUG Condition #' + (index + 1) + ':', {
                  conditionDefinitionId: condition.conditionDefinitionId,
                  currentValue,
                  severity: condition.severity,
                  filteredConditionsCount: filteredConditions.length,
                  finalConditionsCount: finalConditions.length,
                  finalConditionIds: finalConditions.map(c => c.id)
                });

                // Lấy tên thiết bị từ serial đã chọn
                let deviceModelName = '';
                if (selectedSerial) {
                  const matchingItem = items.find((item) =>
                    (item.itemCode || '')
                      .split(',')
                      .map((s) => s.trim())
                      .includes(selectedSerial)
                  );
                  if (matchingItem?.itemName) {
                    deviceModelName = matchingItem.itemName;
                  }
                }

                return (
                  <Card
                    key={index}
                    size="small"
                    title={`Tình trạng #${index + 1}${deviceModelName ? ` - ${deviceModelName}` : ''}`}
                    extra={
                      <Button
                        type="link"
                        danger
                        size="small"
                        onClick={() => {
                          setDeviceConditions(
                            deviceConditions.filter((_, i) => i !== index)
                          );
                        }}
                      >
                        Xóa
                      </Button>
                    }
                  >
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text
                            strong
                            style={{ display: "block", marginBottom: 4 }}
                          >
                            Thiết bị <Text type="danger">*</Text>
                          </Text>
                          <Select
                            style={{ width: "100%" }}
                            placeholder="Chọn thiết bị"
                            value={condition.deviceId}
                            onChange={(value) => {
                              const newConditions = [...deviceConditions];
                              newConditions[index] = {
                                ...newConditions[index],
                                deviceId: value,
                                conditionDefinitionId: null,
                              };
                              setDeviceConditions(newConditions);
                            }}
                            options={serialOptions.map((serial) => ({
                              label: serial,
                              value: serial,
                            }))}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text
                            strong
                            style={{ display: "block", marginBottom: 4 }}
                          >
                            Tình trạng thiết bị{" "}
                            <Text type="danger">*</Text>
                          </Text>
                          <Select
                            style={{ width: "100%" }}
                            placeholder="Chọn tình trạng thiết bị"
                            value={currentValue}
                            onChange={(value) => {
                              const newConditions = [...deviceConditions];
                              const def = finalConditions.find(
                                (c) => c.id === value
                              );
                              const autoSeverity =
                                def?.conditionSeverity ||
                                newConditions[index].severity ||
                                "INFO";
                              newConditions[index] = {
                                ...newConditions[index],
                                conditionDefinitionId: value,
                                severity: autoSeverity,
                              };
                              setDeviceConditions(newConditions);
                            }}
                            loading={loadingConditions}
                            disabled={!condition.deviceId || loadingConditions}
                            options={finalConditions.map((c) => ({
                              label: c.name,
                              value: c.id,
                            }))}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text
                            strong
                            style={{ display: "block", marginBottom: 4 }}
                          >
                            Mức độ nghiêm trọng (Severity){" "}
                            <Text type="danger">*</Text>
                          </Text>
                          <Select
                            style={{ width: "100%" }}
                            placeholder="Chọn mức độ"
                            value={condition.severity}
                            onChange={(value) => {
                              const newConditions = [...deviceConditions];
                              newConditions[index] = {
                                ...newConditions[index],
                                severity: value,
                              };
                              setDeviceConditions(newConditions);
                            }}
                            options={[
                              { label: "Không có", value: "INFO" },
                              { label: "Nhẹ", value: "LOW" },
                              { label: "Trung bình", value: "MEDIUM" },
                              { label: "Nghiêm trọng", value: "HIGH" },
                              { label: "Khẩn cấp", value: "CRITICAL" },
                            ]}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text
                            strong
                            style={{ display: "block", marginBottom: 4 }}
                          >
                            Ảnh bằng chứng
                          </Text>
                          <Upload
                            multiple
                            accept=".jpg,.jpeg,.png,.webp"
                            beforeUpload={() => false}
                            listType="picture-card"
                            fileList={
                              condition.images?.map((img, imgIdx) => ({
                                uid: `img-${index}-${imgIdx}`,
                                name: `image-${imgIdx + 1}.jpg`,
                                status: "done",
                                url:
                                  typeof img === "string"
                                    ? img
                                    : img?.url || img?.thumbUrl || "",
                              })) || []
                            }
                            onChange={async ({ fileList }) => {
                              const newConditions = [...deviceConditions];
                              const imageUrls = await Promise.all(
                                fileList.map(async (f) => {
                                  if (f.originFileObj) {
                                    return await fileToBase64(
                                      f.originFileObj
                                    );
                                  }
                                  return f.thumbUrl || f.url || "";
                                })
                              );
                              newConditions[index] = {
                                ...newConditions[index],
                                images: imageUrls.filter(Boolean),
                              };
                              setDeviceConditions(newConditions);
                            }}
                          >
                            {(condition.images?.length || 0) < 5 && (
                              <div>
                                <InboxOutlined />
                                <div style={{ marginTop: 8 }}>Tải ảnh</div>
                              </div>
                            )}
                          </Upload>
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

      {/* Ký biên bản */}
      {showSignatureForm && handoverReportId && (
        <Card
          title="Ký biên bản bàn giao"
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

      {/* Nút submit tạo / cập nhật */}
      {!showSignatureForm && !showReportsList && (
        <Card>
          <Space>
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={saving}
            >
              {isUpdateMode
                ? "Cập nhật biên bản bàn giao"
                : "Tạo biên bản bàn giao"}
            </Button>
            <Button onClick={() => nav(-1)}>Hủy</Button>
          </Space>
        </Card>
      )}

      {/* Danh sách handover reports */}
      {showReportsList && (
        <Card title="Danh sách biên bản bàn giao" className="mb-3">
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
                  title: "Thời gian bàn giao",
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
                      <Tag color={color}>
                        {translateHandoverStatus(status)}
                      </Tag>
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
              <Text type="secondary">Chưa có biên bản bàn giao nào</Text>
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
        title={`Biên bản bàn giao #${
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
