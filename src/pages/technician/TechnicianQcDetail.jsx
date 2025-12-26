// src/pages/technician/TechnicianQcDetail.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Card, Descriptions, Typography, Tag, Space, Divider, Progress,
  Checkbox, Select, Input, Upload, Button, message, Row, Col, DatePicker, Spin, Modal, Alert
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { InboxOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { getTaskById, normalizeTask } from "../../lib/taskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import {
  createPreRentalQcReport,
  updatePreRentalQcReport,
  getQcReportsByOrderId,
  getPreRentalQcReportById,
  getPostRentalQcReportById,
} from "../../lib/qcReportApi";
import { getDevicesByModelId, getAvailableDevicesByModel, listDevices, getDeviceById } from "../../lib/deviceManage";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getConditionDefinitions, getDeviceConditions } from "../../lib/condition";
import { getComplaintByTaskId } from "../../lib/complaints";
import dayjs from "dayjs";

const { Title, Text } = Typography;

// --- Tiện ích dịch và tô màu trạng thái ---
const translateStatus = (status) => {
  const s = String(status || "").toUpperCase();
  const map = {
    // Task Status
    PENDING: "Đang chờ",
    IN_PROGRESS: "Đang xử lý",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    // QC Result
    READY_FOR_SHIPPING: "Sẵn sàng giao",
    PRE_RENTAL_FAILED: "QC trước thuê thất bại",
    READY_FOR_RE_STOCK: "Sẵn sàng nhập kho",
    POST_RENTAL_FAILED: "QC sau thuê thất bại",
    // Order Status
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDING_CONFIRMATION: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    SHIPPED: "Đã giao hàng",
    DELIVERED: "Đã nhận hàng",
    RETURNED: "Đã trả hàng",
    AVAILABLE: "Có sẵn",
    PROCESSING: "Đang xử lý",
    // Device Status
    PRE_RENTAL_QC: "Kiểm tra trước thuê",
    RENTING: "Đang thuê",
    RENTED: "Đang thuê",
    MAINTENANCE: "Bảo trì",
    BROKEN: "Hỏng",
  };
  return map[s] || status;
};

const getStatusColor = (status) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PENDING":
    case "PENDING_PAYMENT":
    case "PENDING_CONFIRMATION":
      return "orange";
    case "IN_PROGRESS":
    case "PROCESSING":
      return "blue";
    case "COMPLETED":
    case "DELIVERED":
    case "RETURNED":
    case "READY_FOR_SHIPPING":
    case "READY_FOR_RE_STOCK":
      return "green";
    case "CANCELLED":
    case "PRE_RENTAL_FAILED":
    case "POST_RENTAL_FAILED":
      return "red";
    default:
      return "default";
  }
};
const { Dragger } = Upload;

// Helper: convert File -> base64 data URL (để lưu chuỗi ảnh, không dùng blob)
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/** Checklist mẫu theo category */
const QC_CHECKLIST_BY_CATEGORY = {
  "VR/AR": ["Vệ sinh ống kính", "Kiểm tra theo dõi chuyển động (tracking)", "Kiểm tra pin", "Kiểm tra dây cáp", "Cập nhật phần mềm (firmware)"],
  Console: ["Vệ sinh máy", "Chạy thử game demo", "Kiểm tra tay cầm", "Kiểm tra cổng HDMI", "Cập nhật hệ thống"],
  Camera: ["Kiểm tra cảm biến", "Kiểm tra màn trập", "Kiểm tra pin & sạc", "Kiểm tra thẻ nhớ", "Vệ sinh ống kính"],
  Drone: ["Kiểm tra cánh quạt", "Kiểm tra GPS", "Kiểm tra pin", "Hiệu chỉnh la bàn (compass)", "Kiểm tra quay video"],
};

/**/

export default function TechnicianQcDetail() {
  const nav = useNavigate();
  const { taskId: paramTaskId } = useParams();
  const { state } = useLocation();

  const actualTaskId = paramTaskId || state?.task?.id || state?.task?.taskId;

  // States
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [order, setOrder] = useState(null);
  const [postRentalDiscrepancyCount, setPostRentalDiscrepancyCount] = useState(0);
  const [loadingDevices, setLoadingDevices] = useState(false);
  // Map: orderDetailId -> danh sách devices (để lấy serialNumbers)
  const [devicesByOrderDetail, setDevicesByOrderDetail] = useState({});
  // Map: deviceModelId -> device model name
  const [modelNameById, setModelNameById] = useState({});
  // QC Report state
  const [existingQcReport, setExistingQcReport] = useState(null);
  const [loadingQcReport, setLoadingQcReport] = useState(false);
  const [saving, setSaving] = useState(false);

  const [result, setResult] = useState("READY_FOR_SHIPPING");
  const [findings, setFindings] = useState("");
  const [accessorySnapshotFile, setAccessorySnapshotFile] = useState(null);
  const [accessorySnapshotPreview, setAccessorySnapshotPreview] = useState("");
  const [selectedDevicesByOrderDetail, setSelectedDevicesByOrderDetail] = useState({});
  const [checklistDone, setChecklistDone] = useState([]);
  // Device conditions state
  const [deviceConditions, setDeviceConditions] = useState([]);
  const [conditionDefinitions, setConditionDefinitions] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);

  // QC Replace (taskCategoryId === 9) states
  const [replacementComplaint, setReplacementComplaint] = useState(null);
  const [isQcReplaceTask, setIsQcReplaceTask] = useState(false);
  const [replacementDeviceData, setReplacementDeviceData] = useState(null); // Device data including currentConditions

  /**
   * useEffect: Tải dữ liệu chính (Task, Order, QC Reports)
   * Được gọi khi: Component mount hoặc taskId thay đổi
   * Luồng: Load task → Load order (nếu có orderId) → Load QC reports cũ
   */
  useEffect(() => {
    const loadData = async () => {
      if (!actualTaskId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // ========== BƯỚC 1: LẤY THÔNG TIN TASK ==========
        // API: GET /api/tasks/{taskId}
        // Trả về: { taskId, orderId, status, type, description... }
        const taskData = await getTaskById(actualTaskId);
        if (!taskData) {
          toast.error("Không tìm thấy công việc");
          nav(-1);
          return;
        }

        const normalizedTask = normalizeTask(taskData);
        setTask(normalizedTask);

        // ========== BƯỚC 1.5: KIỂM TRA QC REPLACE TASK ==========
        // Nếu taskCategoryId === 9, load complaint để lấy replacement device info
        const taskCategoryId = normalizedTask.taskCategoryId || taskData.taskCategoryId;
        const taskCategoryName = normalizedTask.taskCategoryName || taskData.taskCategoryName;
        const isQcReplace = taskCategoryId === 9 || taskCategoryName === 'Pre rental QC Replace';
        setIsQcReplaceTask(isQcReplace);

        if (isQcReplace) {
          try {
            const taskIdForComplaint = normalizedTask.taskId || normalizedTask.id || actualTaskId;
            const complaint = await getComplaintByTaskId(taskIdForComplaint);
            setReplacementComplaint(complaint);
            console.log("🔄 [DEBUG] QC Replace: Loaded replacement complaint =", complaint);

            // ========== FETCH REPLACEMENT DEVICE DETAILS FOR AUTO-FILL ==========
            // API: GET /api/devices/{replacementDeviceId}
            // Returns: { deviceId, serialNumber, currentConditions[], ... }
            if (complaint?.replacementDeviceId) {
              try {
                const deviceData = await getDeviceById(complaint.replacementDeviceId);
                setReplacementDeviceData(deviceData);
                console.log("🔄 [DEBUG] QC Replace: Loaded replacement device data =", deviceData);

                // Auto-fill deviceConditions from currentConditions
                if (deviceData && Array.isArray(deviceData.currentConditions) && deviceData.currentConditions.length > 0) {
                  const autoFilledConditions = deviceData.currentConditions.map((condition) => {
                    // Map severity: nếu NONE thì đổi thành INFO
                    let mappedSeverity = String(condition.severity || "INFO").toUpperCase();
                    const validSeverities = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
                    if (mappedSeverity === "NONE") mappedSeverity = "INFO";
                    if (!validSeverities.includes(mappedSeverity)) {
                      mappedSeverity = "INFO";
                    }

                    return {
                      deviceId: String(deviceData.serialNumber || complaint.replacementDeviceSerialNumber),
                      conditionDefinitionId: condition.conditionDefinitionId,
                      severity: mappedSeverity,
                      images: Array.isArray(condition.images) ? condition.images : [],
                    };
                  });

                  console.log("🔄 [DEBUG] QC Replace: Auto-filled device conditions =", autoFilledConditions);
                  setDeviceConditions(autoFilledConditions);
                  message.success(`Đã tự động điền tình trạng thiết bị thay thế từ hệ thống`);
                }
              } catch (deviceErr) {
                console.warn("Could not load replacement device details:", deviceErr);
                setReplacementDeviceData(null);
              }
            }
          } catch (e) {
            console.warn("Could not load replacement complaint for QC Replace task:", e);
            setReplacementComplaint(null);
          }
        }

        // ========== BƯỚC 2: LẤY THÔNG TIN ĐƠN HÀNG ==========
        if (normalizedTask.orderId) {
          // API: GET /api/rental-orders/{orderId}
          // Trả về: { orderId, orderDetails[], startDate, endDate... }
          const orderData = await getRentalOrderById(normalizedTask.orderId);
          console.log("📦 [DEBUG] Order Data from API:", orderData);
          console.log("📦 [DEBUG] Order Details:", orderData?.orderDetails);
          setOrder(orderData);

          // ========== BƯỚC 3: LẤY QC REPORTS CŨ (NẾU CÓ) ==========
          try {
            setLoadingQcReport(true);
            // API: GET /api/qc-reports/order/{orderId}
            // Trả về: danh sách QC reports của đơn (PRE_RENTAL, POST_RENTAL)
            const qcReports = await getQcReportsByOrderId(normalizedTask.orderId);

            if (Array.isArray(qcReports) && qcReports.length > 0) {
              const taskIdNum = Number(normalizedTask.taskId || normalizedTask.id);
              const taskIdStr = String(normalizedTask.taskId || normalizedTask.id);

              // Tìm QC report PRE_RENTAL khớp với task này
              let matchingReport = qcReports.find((r) => {
                const reportPhase = String(r.phase || "").toUpperCase();
                if (reportPhase !== "PRE_RENTAL") return false;
                const reportTaskId = r.taskId;
                const reportTaskIdNum = Number(reportTaskId);
                const reportTaskIdStr = String(reportTaskId || "");
                return (
                  (!Number.isNaN(reportTaskIdNum) && !Number.isNaN(taskIdNum) && reportTaskIdNum === taskIdNum) ||
                  (reportTaskIdStr && taskIdStr && reportTaskIdStr === taskIdStr)
                );
              });

              // Không fallback sang report khác để tránh cập nhật nhầm report của task khác
              // Nếu không tìm thấy report match taskId → matchingReport = null → sẽ tạo mới

              console.log("📋 [DEBUG] Existing QC Report:", matchingReport);
              console.log("📋 [DEBUG] QC Report devices:", matchingReport?.devices);
              console.log("📋 [DEBUG] QC Report orderDetailSerialNumbers:", matchingReport?.orderDetailSerialNumbers);
              console.log("📋 [DEBUG] QC Report orderDetailId:", matchingReport?.orderDetailId);
              setExistingQcReport(matchingReport || null);

              // Kiểm tra POST_RENTAL discrepancies (để cảnh báo khi update)
              const postReportSummary = qcReports.find((r) => String(r.phase || "").toUpperCase() === "POST_RENTAL");
              if (postReportSummary) {
                if (Array.isArray(postReportSummary.discrepancies) && postReportSummary.discrepancies.length > 0) {
                  setPostRentalDiscrepancyCount(postReportSummary.discrepancies.length);
                } else if (postReportSummary.qcReportId || postReportSummary.id) {
                  try {
                    // API: GET /api/qc-reports/post-rental/{qcReportId}
                    // Lấy chi tiết discrepancies
                    const detail = await getPostRentalQcReportById(postReportSummary.qcReportId || postReportSummary.id);
                    const count = Array.isArray(detail?.discrepancies) ? detail.discrepancies.length : 0;
                    setPostRentalDiscrepancyCount(count);
                  } catch (error) {
                    console.warn("Không thể tải chi tiết QC POST_RENTAL:", error);
                    setPostRentalDiscrepancyCount(0);
                  }
                } else {
                  setPostRentalDiscrepancyCount(0);
                }
              } else {
                setPostRentalDiscrepancyCount(0);
              }
            } else {
              setExistingQcReport(null);
              setPostRentalDiscrepancyCount(0);
            }
          } catch (e) {
            // QC report không tồn tại hoặc lỗi -> không sao, sẽ tạo mới
            console.error("❌ Error loading QC reports:", e);
            setExistingQcReport(null);
            setPostRentalDiscrepancyCount(0);
          } finally {
            setLoadingQcReport(false);
          }
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không tải được dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [actualTaskId, nav]);

  /**
   * useEffect: Tải danh sách thiết bị có sẵn cho từng orderDetail
   * Được gọi khi: Order được load xong
   * Mục đích: Lấy danh sách thiết bị trong kho để technician chọn cho QC
   */
  useEffect(() => {
    const fetchDevices = async () => {
      if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
        return;
      }

      try {
        setLoadingDevices(true);
        const devicesMap = {};
        const namesMap = {};

        // ========== CHUẨN BỊ KHOẢNG THỜI GIAN THUÊ ==========
        // Lấy planStartDate và planEndDate từ order để filter thiết bị available
        const startDate = order.planStartDate || order.startDate || order.rentalStartDate;
        const endDate = order.planEndDate || order.endDate || order.rentalEndDate;
        let start = null;
        let end = null;

        if (startDate && endDate) {
          try {
            const startDayjs = dayjs(startDate);
            const endDayjs = dayjs(endDate);
            start = startDayjs.format("YYYY-MM-DD[T]HH:mm:ss");
            end = endDayjs.format("YYYY-MM-DD[T]HH:mm:ss");
          } catch (e) {
            console.warn("Không thể parse dates từ order:", e);
          }
        }

        // ========== GỌI API CHO TỪNG ORDER DETAIL SONG SONG ==========
        const fetchPromises = order.orderDetails.map(async (orderDetail) => {
          const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
          const deviceModelId = orderDetail.deviceModelId;

          if (!deviceModelId) {
            console.warn(`OrderDetail ${orderDetailId} không có deviceModelId`);
            return { orderDetailId, devices: [] };
          }

          try {
            // Gọi 2 API song song:
            // 1. Lấy devices available cho model này
            // 2. Lấy thông tin model name
            const [devices, model] = await Promise.all([
              // API: GET /api/devices/model/{modelId}/available?start=X&end=Y
              // hoặc GET /api/devices/model/{modelId}
              start && end
                ? getAvailableDevicesByModel(deviceModelId, start, end).catch(() => [])
                : getDevicesByModelId(deviceModelId).catch(() => []),
              // API: GET /api/device-models/{modelId}
              getDeviceModelById(deviceModelId).catch(() => null),
            ]);

            const name = model?.deviceName || model?.name || null;

            // Filter chỉ lấy devices AVAILABLE (nếu không dùng API available)
            const availableDevices = Array.isArray(devices)
              ? start && end
                ? devices // API đã filter rồi
                : devices.filter((device) => {
                  const status = String(
                    device.status || device.deviceStatus || device.state || ""
                  ).toUpperCase();
                  return status === "AVAILABLE";
                })
              : [];

            return { orderDetailId, devices: availableDevices, deviceModelId, name };
          } catch (e) {
            console.error(`Lỗi khi fetch devices cho modelId ${deviceModelId}:`, e);
            console.log("DeviceModelId:", deviceModelId);
            toast.error(`Không thể tải devices cho model ${deviceModelId}`);
            return { orderDetailId, devices: [], deviceModelId, name: null };
          }
        });

        const results = await Promise.all(fetchPromises);

        // Build devicesMap và namesMap
        results.forEach(({ orderDetailId, devices, deviceModelId, name }) => {
          devicesMap[orderDetailId] = devices;
          if (deviceModelId != null && name) namesMap[deviceModelId] = name;
        });

        console.log("🔧 [DEBUG] Fetched Devices Map (by OrderDetail):", devicesMap);
        console.log("🔧 [DEBUG] Model Names Map:", namesMap);
        setDevicesByOrderDetail(devicesMap);
        setModelNameById((prev) => ({ ...prev, ...namesMap }));
      } catch (e) {
        console.error("Lỗi khi fetch devices:", e);
        console.log("device", e?.response?.data);
        toast.error("Không thể tải danh sách thiết bị từ kho");
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDevices();
  }, [order]);

  /** ---------- MOCK INVENTORY TRONG KHO ---------- */
  const INVENTORY = useMemo(
    () => ({
      // Mock data - sau này sẽ fetch từ API dựa trên orderDetailId
      default: ["SN-001", "SN-002", "SN-003", "SN-004", "SN-005"],
    }),
    []
  );

  // Allowed results (labels in Vietnamese, values giữ nguyên để gửi API)
  const resultOptions = useMemo(
    () => [
      { label: "Đạt - Sẵn sàng giao hàng", value: "READY_FOR_SHIPPING" },
      { label: "Không đạt - QC trước thuê", value: "PRE_RENTAL_FAILED" },
    ],
    []
  );

  // Load existing QC report data into form when it's available
  useEffect(() => {
    if (existingQcReport) {
      console.log("🔄 Loading existing QC report data into form:", existingQcReport);

      if (existingQcReport.result) {
        const resultValue = String(existingQcReport.result).toUpperCase();
        setResult(resultValue);
      }

      if (existingQcReport.findings) {
        setFindings(String(existingQcReport.findings));
      }

      if (existingQcReport.accessorySnapShotUrl || existingQcReport.accessorySnapshotUrl) {
        const url = existingQcReport.accessorySnapShotUrl || existingQcReport.accessorySnapshotUrl;
        setAccessorySnapshotPreview(url);
      }

      // Parse deviceConditions
      if (Array.isArray(existingQcReport.deviceConditions) && existingQcReport.deviceConditions.length > 0) {
        const parsedDeviceConditions = [];
        const deviceSerialMap = new Map();

        existingQcReport.deviceConditions.forEach((dc) => {
          const deviceSerial = dc.deviceSerial || String(dc.deviceId || "");
          if (!deviceSerial) return;

          if (deviceSerialMap.has(deviceSerial)) {
            const existing = deviceSerialMap.get(deviceSerial);
            if (Array.isArray(dc.snapshots)) {
              dc.snapshots.forEach((snapshot) => {
                if (Array.isArray(snapshot.images)) {
                  existing.images = [...new Set([...existing.images, ...snapshot.images])];
                }
              });
            }
            return;
          }

          let selectedConditionDetail = null;
          const allImages = new Set();

          if (Array.isArray(dc.snapshots)) {
            const qcBeforeSnapshot = dc.snapshots.find(
              (s) =>
                String(s.source || "").toUpperCase() === "QC_BEFORE" ||
                String(s.snapshotType || "").toUpperCase() === "BASELINE"
            );
            const snapshotToUse = qcBeforeSnapshot || dc.snapshots[0];

            if (snapshotToUse) {
              if (Array.isArray(snapshotToUse.conditionDetails) && snapshotToUse.conditionDetails.length > 0) {
                selectedConditionDetail = snapshotToUse.conditionDetails[0];
              }

              if (Array.isArray(snapshotToUse.images)) {
                snapshotToUse.images.forEach((img) => allImages.add(img));
              }
            }

            dc.snapshots.forEach((snapshot) => {
              if (Array.isArray(snapshot.images)) {
                snapshot.images.forEach((img) => allImages.add(img));
              }
            });
          }

          if (selectedConditionDetail) {
            const parsedCondition = {
              deviceId: deviceSerial,
              conditionDefinitionId: selectedConditionDetail.conditionDefinitionId,
              severity: selectedConditionDetail.severity || "NONE",
              images: Array.from(allImages),
            };
            deviceSerialMap.set(deviceSerial, parsedCondition);
            parsedDeviceConditions.push(parsedCondition);
          }
        });

        setDeviceConditions(parsedDeviceConditions);
      } else {
        setDeviceConditions([]);
      }
    }
  }, [existingQcReport]);

  // Load serial numbers from existing QC report
  useEffect(() => {
    if (existingQcReport && order && Array.isArray(order.orderDetails) && order.orderDetails.length > 0) {
      console.log("🔄 [DEBUG] Loading serial numbers from existing QC report...");
      console.log("🔄 [DEBUG] Order Details:", order.orderDetails);
      const serialMap = {};

      if (existingQcReport.orderDetailSerialNumbers && typeof existingQcReport.orderDetailSerialNumbers === "object") {
        Object.keys(existingQcReport.orderDetailSerialNumbers).forEach((orderDetailId) => {
          const serials = existingQcReport.orderDetailSerialNumbers[orderDetailId];
          if (Array.isArray(serials)) {
            serialMap[String(orderDetailId)] = serials.map(String);
          }
        });
      } else if (existingQcReport.orderDetailId && Array.isArray(existingQcReport.devices) && existingQcReport.devices.length > 0) {
        const reportOrderDetailId = Number(existingQcReport.orderDetailId);
        const allSerials = existingQcReport.devices
          .map((d) => d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id)
          .filter(Boolean)
          .map(String);

        if (allSerials.length > 0) {
          const ods = Array.isArray(order?.orderDetails) ? order.orderDetails : [];

          // Track used serials to avoid duplicates - start empty
          const usedSerials = new Set();

          // First, find and assign serials to the reportOrderDetailId
          const reportOd = ods.find(od => String(od.orderDetailId || od.id) === String(reportOrderDetailId));
          if (reportOd) {
            const quantity = Number(reportOd.quantity ?? 1);
            const assignedToReport = allSerials.slice(0, quantity);
            serialMap[String(reportOrderDetailId)] = assignedToReport;
            assignedToReport.forEach(serial => usedSerials.add(serial));
          } else {
            // If reportOrderDetailId not found in current order, assign all serials to it
            serialMap[String(reportOrderDetailId)] = allSerials;
            allSerials.forEach(serial => usedSerials.add(serial));
          }

          // Then, for other orderDetails with matching device models, assign remaining serials
          if (ods.length > 0) {
            const deviceModelIds = new Set(
              existingQcReport.devices
                .map((d) => Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN))
                .filter((id) => !Number.isNaN(id))
            );

            ods.forEach((od) => {
              const odId = String(od.orderDetailId || od.id);
              const modelId = Number(od.deviceModelId ?? NaN);
              const quantity = Number(od.quantity ?? 1);

              // Skip if already assigned or not matching model
              if (serialMap[odId] || !deviceModelIds.has(modelId)) {
                return;
              }

              const matchingSerials = existingQcReport.devices
                .filter((d) => {
                  const dModelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
                  const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
                  // Only include if model matches and serial hasn't been used yet
                  return !Number.isNaN(dModelId) && dModelId === modelId && !usedSerials.has(String(serial));
                })
                .map((d) => d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id)
                .filter(Boolean)
                .map(String)
                .slice(0, quantity);

              if (matchingSerials.length > 0) {
                serialMap[odId] = matchingSerials;
                // Mark these serials as used
                matchingSerials.forEach(serial => usedSerials.add(serial));
              }
            });
          }
        }
      } else if (Array.isArray(existingQcReport.devices) && existingQcReport.devices.length > 0) {
        const groupByModel = existingQcReport.devices.reduce((acc, d) => {
          const mid = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
          const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
          if (!mid || !serial) return acc;
          if (!acc[mid]) acc[mid] = [];
          acc[mid].push(String(serial));
          return acc;
        }, {});

        // Track used serials to avoid duplicates across orderDetails
        const usedSerials = new Set();

        const ods = Array.isArray(order?.orderDetails) ? order.orderDetails : [];
        ods.forEach((od) => {
          const odId = od.orderDetailId || od.id;
          const modelId = Number(od.deviceModelId ?? NaN);
          const quantity = Number(od.quantity ?? 1);
          if (!odId || !modelId) return;

          const pool = groupByModel[modelId] || [];
          // Filter out already used serials
          const availablePool = pool.filter(serial => !usedSerials.has(serial));

          if (availablePool.length > 0) {
            const assignedSerials = availablePool.slice(0, Math.max(1, quantity));
            serialMap[String(odId)] = assignedSerials;
            // Mark these serials as used
            assignedSerials.forEach(serial => usedSerials.add(serial));
          }
        });
      }

      console.log("✅ [DEBUG] Final Serial Map to be set:", serialMap);
      if (Object.keys(serialMap).length > 0) {
        setSelectedDevicesByOrderDetail(serialMap);
      }
    }
  }, [existingQcReport, order]);

  // Get order details from order - for QC Replace, filter to only show replacement device's model
  const orderDetails = useMemo(() => {
    if (!order || !Array.isArray(order.orderDetails)) return [];

    // For QC Replace tasks, only show the orderDetail matching the replacement device's model
    // AND override quantity to 1 (since device replacement is 1-to-1, not based on original order quantity)
    if (isQcReplaceTask && replacementDeviceData?.deviceModelId) {
      const replacementModelId = Number(replacementDeviceData.deviceModelId);
      const filtered = order.orderDetails.filter(od =>
        Number(od.deviceModelId) === replacementModelId
      );
      console.log("🔄 [DEBUG] QC Replace: Filtered orderDetails to match replacement model", replacementModelId, "->", filtered);

      // For QC Replace: Override quantity to 1 (only the replacement device needs QC)
      if (filtered.length > 0) {
        return filtered.map(od => ({
          ...od,
          quantity: 1, // Device replacement is 1-to-1
        }));
      }
      return order.orderDetails;
    }

    return order.orderDetails;
  }, [order, isQcReplaceTask, replacementDeviceData]);

  /**
   * useEffect: Auto-fill selectedDevicesByOrderDetail for QC Replace tasks
   * When we have replacementComplaint with replacementDeviceSerialNumber,
   * automatically set up the device selection with the replacement serial number
   */
  useEffect(() => {
    if (!isQcReplaceTask || !replacementComplaint || !orderDetails.length) {
      return;
    }

    // Skip if we already have serial numbers selected from existing QC report
    if (Object.keys(selectedDevicesByOrderDetail).length > 0) {
      return;
    }

    const replacementSerial = replacementComplaint.replacementDeviceSerialNumber;
    const replacementModelId = replacementDeviceData?.deviceModelId;

    if (!replacementSerial) {
      console.warn("🔄 [DEBUG] QC Replace: No replacement serial number found in complaint");
      return;
    }

    console.log("🔄 [DEBUG] QC Replace: Auto-filling selectedDevicesByOrderDetail");
    console.log("🔄 [DEBUG] QC Replace: Replacement serial:", replacementSerial);
    console.log("🔄 [DEBUG] QC Replace: Replacement modelId:", replacementModelId);

    // For QC Replace, find the orderDetail matching the replacement device's model
    const newSelectedMap = {};

    for (const od of orderDetails) {
      const odId = String(od.orderDetailId || od.id);
      const odModelId = Number(od.deviceModelId);

      // If we have replacement model info, only fill the matching orderDetail
      if (replacementModelId) {
        if (odModelId === Number(replacementModelId)) {
          newSelectedMap[odId] = [String(replacementSerial)];
          console.log("🔄 [DEBUG] QC Replace: Matched orderDetail", odId, "with modelId", odModelId);
          break; // Only need one for QC Replace
        }
      } else {
        // Fallback: fill the first orderDetail if no model info available
        if (Object.keys(newSelectedMap).length === 0) {
          newSelectedMap[odId] = [String(replacementSerial)];
          break;
        }
      }
    }

    if (Object.keys(newSelectedMap).length > 0) {
      console.log("🔄 [DEBUG] QC Replace: Setting selectedDevicesByOrderDetail =", newSelectedMap);
      setSelectedDevicesByOrderDetail(newSelectedMap);
      message.info(`Đã tự động chọn thiết bị thay thế: ${replacementSerial}`);
    }
  }, [isQcReplaceTask, replacementComplaint, replacementDeviceData, orderDetails, selectedDevicesByOrderDetail]);

  /**
   * useEffect: Tải danh sách condition definitions khi devices được chọn
   * Được gọi khi: Technician chọn thiết bị cho QC
   * Mục đích: Load các loại tình trạng có thể chọn (vết xước, rạn màn hình...)
   */
  useEffect(() => {
    const loadConditionDefinitions = async () => {
      // Chưa chọn device nào → không load
      if (!orderDetails.length || !selectedDevicesByOrderDetail || Object.keys(selectedDevicesByOrderDetail).length === 0) {
        setConditionDefinitions([]);
        return;
      }

      try {
        setLoadingConditions(true);
        const modelIds = new Set();

        // Thu thập tất cả modelIds từ các orderDetail đã chọn device
        for (const orderDetail of orderDetails) {
          const orderDetailId = String(orderDetail.orderDetailId || orderDetail.id);
          const serials = selectedDevicesByOrderDetail[orderDetailId] || [];

          if (serials.length > 0 && orderDetail.deviceModelId) {
            modelIds.add(Number(orderDetail.deviceModelId));
          }
        }

        // ========== GỌI API LẤY CONDITION DEFINITIONS ==========
        const allConditions = [];
        for (const modelId of modelIds) {
          try {
            // API: GET /api/conditions/definitions?deviceModelId=X
            // Trả về: [{ id, name, severity, description... }]
            const conditions = await getConditionDefinitions({ deviceModelId: modelId });
            allConditions.push(...conditions);
          } catch (e) {
            console.warn(`Failed to load conditions for model ${modelId}:`, e);
          }
        }

        // Loại bỏ duplicate conditions (dựa vào id)
        const uniqueConditions = Array.from(new Map(allConditions.map((c) => [c.id, c])).values());

        // Lưu vào state để hiển thị trong dropdown chọn tình trạng
        setConditionDefinitions(uniqueConditions);
      } catch (e) {
        console.error("Error loading condition definitions:", e);
        setConditionDefinitions([]);
      } finally {
        setLoadingConditions(false);
      }
    };

    loadConditionDefinitions();
  }, [orderDetails, selectedDevicesByOrderDetail]);

  // Helper: Get available devices list for condition selection
  const availableDevicesForConditions = useMemo(() => {
    const devices = [];
    Object.keys(selectedDevicesByOrderDetail).forEach((orderDetailId) => {
      const serials = selectedDevicesByOrderDetail[orderDetailId] || [];
      const orderDetail = orderDetails.find((od) => String(od.orderDetailId || od.id) === orderDetailId);

      serials.forEach((serial) => {
        devices.push({
          serial: String(serial),
          orderDetailId,
          deviceModelId: orderDetail?.deviceModelId,
        });
      });
    });
    return devices;
  }, [selectedDevicesByOrderDetail, orderDetails]);

  const checklist = useMemo(() => {
    return QC_CHECKLIST_BY_CATEGORY[task?.taskCategoryName] || [];
  }, [task]);

  const percent = Math.round((checklistDone.length / Math.max(1, checklist.length)) * 100);

  /** Gợi ý auto chọn đủ số lượng đầu tiên trong kho */
  const autoPick = () => {
    const next = { ...selectedDevicesByOrderDetail };
    orderDetails.forEach((orderDetail) => {
      const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
      const quantity = orderDetail.quantity || 1;

      const devices = devicesByOrderDetail[orderDetailId] || [];
      const serialNumbers = devices
        .map((device) => device.serialNumber || device.serial || device.serialNo || device.id)
        .filter(Boolean);

      const avail =
        serialNumbers.length > 0 ? serialNumbers : INVENTORY[orderDetailId] || INVENTORY.default || [];

      next[orderDetailId] = avail.slice(0, quantity).map(String);
    });
    setSelectedDevicesByOrderDetail(next);
    message.success("Đã gợi ý đủ số lượng từ kho.");
  };

  /** Khi chọn thay đổi per-orderDetail, giữ không vượt quá số lượng yêu cầu
   *  và XÓA các tình trạng của serial đã bị bỏ chọn
   */
  const onChangeOrderDetailPick = async (orderDetailId, quantity, values) => {
    // Giới hạn số lượng theo quantity
    if (values.length > quantity) {
      message.warning(`Chỉ cần ${quantity} thiết bị cho order detail này.`);
      values = values.slice(0, quantity);
    }

    // Chuẩn hóa về string
    const normalizedValues = values.map(String);
    const prevSerials = (selectedDevicesByOrderDetail[orderDetailId] || []).map(String);

    // Serial mới được thêm
    const newSerials = normalizedValues.filter((serial) => !prevSerials.includes(serial));

    // Build map chọn mới nhất cho toàn bộ orderDetails
    const newSelectedMap = {
      ...selectedDevicesByOrderDetail,
      [orderDetailId]: normalizedValues,
    };

    // Tập tất cả serial còn đang được chọn trên toàn đơn
    const allowedSerials = new Set(
      Object.values(newSelectedMap)
        .flat()
        .map((s) => String(s))
    );

    // Cập nhật state chọn serial
    setSelectedDevicesByOrderDetail(newSelectedMap);

    // XÓA hết các deviceConditions của những serial không còn được chọn
    setDeviceConditions((prev) =>
      prev.filter((dc) => allowedSerials.has(String(dc.deviceId)))
    );

    // ------------------------------------------------------------------
    // Tự động load tình trạng cho các serial mới được chọn
    // ------------------------------------------------------------------
    if (newSerials.length > 0) {
      try {
        const allDevices = await listDevices();
        const newDeviceConditions = [];

        for (const serial of newSerials) {
          try {
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

            const deviceConditionsData = await getDeviceConditions(deviceId);

            let conditionsArray = [];
            if (Array.isArray(deviceConditionsData)) {
              conditionsArray = deviceConditionsData;
            } else if (deviceConditionsData && Array.isArray(deviceConditionsData.data)) {
              conditionsArray = deviceConditionsData.data;
            }

            if (conditionsArray.length === 0) continue;

            const latestCondition = conditionsArray
              .sort((a, b) => {
                const timeA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
                const timeB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
                return timeB - timeA;
              })[0];

            if (!latestCondition || !latestCondition.conditionDefinitionId) continue;

            let mappedSeverity = String(latestCondition.severity || "INFO").toUpperCase();
            const validSeverities = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
            if (mappedSeverity === "NONE") mappedSeverity = "INFO";
            if (!validSeverities.includes(mappedSeverity)) {
              mappedSeverity = "INFO";
            }

            newDeviceConditions.push({
              deviceId: String(serial),
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
          setDeviceConditions((prev) => {
            const filteredPrev = prev.filter((dc) =>
              allowedSerials.has(String(dc.deviceId))
            );
            return [...filteredPrev, ...newDeviceConditions];
          });
          message.success(
            `Đã tự động điền tình trạng cho ${newDeviceConditions.length} thiết bị`
          );
        }
      } catch (error) {
        console.warn("Không thể tải tình trạng thiết bị:", error);
      }
    }
  };

  /** Validate số lượng chọn đủ chưa */
  const isPickComplete = () => {
    if (!orderDetails.length) return false;
    return orderDetails.every((orderDetail) => {
      const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
      const quantity = orderDetail.quantity || 1;
      const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
      return picked.length === quantity;
    });
  };

  /**
   * Hàm lưu QC Report (Tạo mới hoặc Cập nhật)
   * Được gọi khi: Technician click nút "Lưu QC Report"
   * Luồng phức tạp:
   * 1. Validate: đủ thiết bị chọn, có findings, có ảnh phụ kiện
   * 2. Build payload: orderDetailSerialNumbers, deviceConditions, accessoryFile
   * 3. Tạo mới hoặc Update dựa vào existingQcReport
   * 4. Reload data sau khi thành công
   */
  const onSave = async () => {
    console.log("🚀 [DEBUG] onSave() called");
    console.log("🚀 [DEBUG] actualTaskId:", actualTaskId);
    console.log("🚀 [DEBUG] existingQcReport:", existingQcReport);
    console.log("🚀 [DEBUG] saving state:", saving);

    if (saving) {
      console.log("❌ [DEBUG] Blocked: saving is true");
      return;
    }
    if (!task || !actualTaskId) {
      console.log("❌ [DEBUG] Blocked: no task or actualTaskId");
      message.error("Không có thông tin task");
      return;
    }

    // ========== BƯỚC 1: VALIDATE SỐ LƯỢNG THIẾT BỊ ==========
    console.log("🚀 [DEBUG] isPickComplete():", isPickComplete());
    console.log("🚀 [DEBUG] selectedDevicesByOrderDetail:", selectedDevicesByOrderDetail);
    if (!isPickComplete()) {
      const incompleteDetails = orderDetails.map((od) => {
        const orderDetailId = od.orderDetailId || od.id;
        const quantity = od.quantity || 1;
        const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
        const status =
          picked.length === quantity ? "✓ OK" : `✗ THIẾU (cần ${quantity}, đã chọn ${picked.length})`;
        return {
          orderDetailId,
          quantity,
          picked: picked.length,
          selected: picked,
          status,
        };
      });

      const missingDetails = incompleteDetails.filter((d) => d.picked !== d.quantity);
      if (missingDetails.length > 0) {
        const missingList = missingDetails.map(
          (d) => `Order Detail #${d.orderDetailId}: cần ${d.quantity}, đã chọn ${d.picked}`
        );
        const errorMsg = `Vui lòng chọn đủ thiết bị: ${missingList.join("; ")}`;
        message.error(errorMsg, 6);
      } else {
        message.error(
          "Vui lòng chọn đủ số lượng thiết bị cho mỗi mục trong đơn hàng.",
          6
        );
      }
      return;
    }



    try {
      // Cảnh báo nếu có POST_RENTAL discrepancy
      if (postRentalDiscrepancyCount > 0) {
        message.warning(
          "QC sau thuê đã ghi nhận sự cố. Việc cập nhật QC trước thuê có thể gặp lỗi, vui lòng phối hợp điều phối viên nếu cần."
        );
      }

      setSaving(true);

      // ========== BƯỚC 3: XÂY DỰNG orderDetailSerialNumbers ==========
      // Map mỗi orderDetailId → danh sách serial numbers đã chọn
      const orderDetailSerialNumbers = {};

      // Sử dụng selectedDevicesByOrderDetail từ UI (cả QC Replace và normal QC)
      orderDetails.forEach((orderDetail) => {
        const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
        const serialNumbers = selectedDevicesByOrderDetail[orderDetailId] || [];
        const key = String(orderDetailId);
        orderDetailSerialNumbers[key] = serialNumbers.map(String);
      });

      // ========== BƯỚC 4: XÂY DỰNG deviceConditions PAYLOAD ==========
      // Fetch toàn bộ devices để map serialNumber → deviceId thật
      // API: GET /api/devices
      const allDevices = await listDevices();
      const deviceConditionsMap = new Map();

      // Duyệt qua từng condition đã chọn để build payload
      for (const condition of deviceConditions) {
        if (!condition.deviceId || !condition.conditionDefinitionId || !condition.severity) {
          continue;
        }

        // Tìm device thật dựa vào serialNumber
        const device = Array.isArray(allDevices)
          ? allDevices.find((d) => {
            const deviceSerial = String(
              d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id || ""
            ).toUpperCase();
            return deviceSerial === String(condition.deviceId).toUpperCase();
          })
          : null;

        if (device) {
          const deviceId = Number(device.deviceId || device.id);
          const conditionDefinitionId = Number(condition.conditionDefinitionId);
          const severity = String(condition.severity);

          // Key để merge duplicates (cùng device + condition + severity)
          const key = `${deviceId}_${conditionDefinitionId}_${severity}`;

          if (deviceConditionsMap.has(key)) {
            // Đã tồn tại → merge images
            const existing = deviceConditionsMap.get(key);
            const newImages = Array.isArray(condition.images)
              ? condition.images.map(String)
              : [];
            newImages.forEach((img) => existing.images.add(img));
          } else {
            // Tạo mới entry
            const images = new Set(
              Array.isArray(condition.images) ? condition.images.map(String) : []
            );
            deviceConditionsMap.set(key, {
              deviceId,
              conditionDefinitionId,
              severity,
              images,
            });
          }
        }
      }

      // Convert Map to Array payload
      const deviceConditionsPayload = Array.from(deviceConditionsMap.values()).map(
        (entry) => ({
          deviceId: entry.deviceId,
          conditionDefinitionId: entry.conditionDefinitionId,
          severity: entry.severity,
          images: Array.from(entry.images),
        })
      );

      // ========== BƯỚC 5: XÂY DỰNG BASE PAYLOAD ==========
      const basePayload = {
        taskId: Number(actualTaskId),
        orderDetailSerialNumbers,
        result: String(result || "READY_FOR_SHIPPING").toUpperCase(),
        findings: "Không có ghi chú",
        deviceConditions: deviceConditionsPayload,
        accessoryFile: null,
      };

      const taskStatus = String(task?.status || "").toUpperCase();
      const isCompleted = taskStatus === "COMPLETED";
      const qcReportId = existingQcReport?.qcReportId || existingQcReport?.id;

      console.log("🚀 [DEBUG] taskStatus:", taskStatus);
      console.log("🚀 [DEBUG] isCompleted:", isCompleted);
      console.log("🚀 [DEBUG] qcReportId:", qcReportId);

      // Kiểm tra: task đã COMPLETED nhưng chưa có QC report → không cho tạo mới
      if (isCompleted && !qcReportId) {
        console.log("❌ [DEBUG] Blocked: task COMPLETED but no qcReportId");
        message.error(
          "Task đã hoàn thành. Chỉ có thể cập nhật QC report đã tồn tại, không thể tạo mới."
        );
        return;
      }

      // ========== BƯỚC 6A: CẬP NHẬT QC REPORT CŨ ==========
      console.log("🚀 [DEBUG] Checking branch: existingQcReport=", !!existingQcReport, "qcReportId=", qcReportId);
      if (existingQcReport && qcReportId) {
        console.log("🔄 [DEBUG] Going to UPDATE branch with qcReportId:", qcReportId);
        // Xây dựng finalOrderDetailSerialNumbers từ existing report (phức tạp vì nhiều format)
        let finalOrderDetailSerialNumbers = {};

        // TH1: existingQcReport đã có orderDetailSerialNumbers
        if (
          existingQcReport.orderDetailSerialNumbers &&
          typeof existingQcReport.orderDetailSerialNumbers === "object"
        ) {
          Object.keys(existingQcReport.orderDetailSerialNumbers).forEach(
            (orderDetailId) => {
              const serials = existingQcReport.orderDetailSerialNumbers[orderDetailId];
              if (Array.isArray(serials)) {
                finalOrderDetailSerialNumbers[orderDetailId] = serials.map(String);
              }
            }
          );
        }
        // TH2: existingQcReport có devices[] → map về orderDetailId
        else if (
          Array.isArray(existingQcReport.devices) &&
          existingQcReport.devices.length > 0
        ) {
          const devicesByModel = {};
          existingQcReport.devices.forEach((d) => {
            const modelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
            const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
            if (modelId && serial) {
              if (!devicesByModel[modelId]) devicesByModel[modelId] = [];
              devicesByModel[modelId].push(String(serial));
            }
          });

          // Map devices về orderDetailId dựa vào modelId
          orderDetails.forEach((od) => {
            const orderDetailId = od.orderDetailId || od.id;
            const modelId = Number(od.deviceModelId ?? NaN);
            const quantity = Number(od.quantity ?? 1);
            if (orderDetailId != null && modelId && devicesByModel[modelId]) {
              finalOrderDetailSerialNumbers[orderDetailId] = devicesByModel[modelId]
                .slice(0, quantity)
                .map(String);
            }
          });
        }
        // TH3: Fallback - dùng selectedDevicesByOrderDetail hiện tại
        else {
          orderDetails.forEach((orderDetail) => {
            const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
            const serialNumbers =
              selectedDevicesByOrderDetail[String(orderDetailId)] ||
              selectedDevicesByOrderDetail[orderDetail.orderDetailId] ||
              selectedDevicesByOrderDetail[orderDetail.id] ||
              [];
            if (serialNumbers.length > 0) {
              finalOrderDetailSerialNumbers[orderDetailId] = serialNumbers.map(String);
            }
          });
        }

        // Nếu vẫn rỗng → dùng basePayload
        if (Object.keys(finalOrderDetailSerialNumbers).length === 0) {
          finalOrderDetailSerialNumbers = basePayload.orderDetailSerialNumbers;
        }

        const updatePayload = {
          orderDetailSerialNumbers: finalOrderDetailSerialNumbers,
          result: basePayload.result,
          findings: basePayload.findings,
          accessoryFile: basePayload.accessoryFile,
          deviceConditions: basePayload.deviceConditions,
        };

        // API: PUT /api/qc-reports/pre-rental/{qcReportId}
        // Body: { orderDetailSerialNumbers, result, findings, accessoryFile, deviceConditions }
        await updatePreRentalQcReport(qcReportId, updatePayload);
        toast.success("Đã cập nhật QC report thành công!");
      }
      // ========== BƯỚC 6B: TẠO MỚI QC REPORT ==========
      else {
        console.log("✅ [DEBUG] Going to CREATE branch with basePayload:", basePayload);
        // API: POST /api/qc-reports/pre-rental
        // Body: { taskId, orderDetailSerialNumbers, result, findings, deviceConditions, accessoryFile }
        const createdReport = await createPreRentalQcReport(basePayload);
        toast.success("Đã tạo QC report thành công!");

        const newQcReportId = createdReport?.qcReportId || createdReport?.id;
        if (newQcReportId) {
          try {
            const loadedReport = await getPreRentalQcReportById(newQcReportId);

            if (loadedReport) {
              setExistingQcReport(loadedReport);

              if (
                Array.isArray(loadedReport.deviceConditions) &&
                loadedReport.deviceConditions.length > 0
              ) {
                const parsedDeviceConditions = [];
                const deviceSerialMap = new Map();

                loadedReport.deviceConditions.forEach((dc) => {
                  const deviceSerial = dc.deviceSerial || String(dc.deviceId || "");
                  if (!deviceSerial) return;

                  if (deviceSerialMap.has(deviceSerial)) {
                    const existing = deviceSerialMap.get(deviceSerial);
                    if (Array.isArray(dc.snapshots)) {
                      dc.snapshots.forEach((snapshot) => {
                        if (Array.isArray(snapshot.images)) {
                          existing.images = [
                            ...new Set([...existing.images, ...snapshot.images]),
                          ];
                        }
                      });
                    }
                    return;
                  }

                  let selectedConditionDetail = null;
                  const allImages = new Set();

                  if (Array.isArray(dc.snapshots)) {
                    const qcBeforeSnapshot = dc.snapshots.find(
                      (s) =>
                        String(s.source || "").toUpperCase() === "QC_BEFORE" ||
                        String(s.snapshotType || "").toUpperCase() === "BASELINE"
                    );
                    const snapshotToUse = qcBeforeSnapshot || dc.snapshots[0];

                    if (snapshotToUse) {
                      if (
                        Array.isArray(snapshotToUse.conditionDetails) &&
                        snapshotToUse.conditionDetails.length > 0
                      ) {
                        selectedConditionDetail = snapshotToUse.conditionDetails[0];
                      }

                      if (Array.isArray(snapshotToUse.images)) {
                        snapshotToUse.images.forEach((img) => allImages.add(img));
                      }
                    }

                    dc.snapshots.forEach((snapshot) => {
                      if (Array.isArray(snapshot.images)) {
                        snapshot.images.forEach((img) => allImages.add(img));
                      }
                    });
                  }

                  if (selectedConditionDetail) {
                    const parsedCondition = {
                      deviceId: deviceSerial,
                      conditionDefinitionId: selectedConditionDetail.conditionDefinitionId,
                      severity: selectedConditionDetail.severity || "NONE",
                      images: Array.from(allImages),
                    };
                    deviceSerialMap.set(deviceSerial, parsedCondition);
                    parsedDeviceConditions.push(parsedCondition);
                  }
                });

                setDeviceConditions(parsedDeviceConditions);
              }
            }
          } catch (e) {
            console.error("Failed to load created QC report:", e);
          }
        }

        message.success("QC report đã được tạo thành công!");
        setTimeout(() => {
          nav(-1);
        }, 1500);
      }

      if (existingQcReport && (existingQcReport.qcReportId || existingQcReport.id)) {
        setTimeout(() => {
          nav(-1);
        }, 1500);
      }
    } catch (e) {
      console.error("Create QC report error:", e);
      toast.error(
        e?.response?.data?.message ||
        e?.response?.data?.details ||
        e?.message ||
        "Không thể tạo QC report"
      );
    } finally {
      setSaving(false);
    }
  };

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
          {existingQcReport ? "Cập nhật QC Report" : "Chi tiết QC"}
        </Title>
        <Tag color={existingQcReport ? "orange" : "blue"}>
          {existingQcReport ? "CẬP NHẬT QC" : "KIỂM TRA QC"}
        </Tag>
      </Space>

      {/* Thông tin task và đơn hàng */}
      <Card title="Thông tin công việc" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã công việc">
            {task.taskId || task.id}
          </Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{task.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">
            {task.taskCategoryName || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái của công việc">
            <Tag color={getStatusColor(task.status)}>
              {translateStatus(task.status) || "—"}
            </Tag>
          </Descriptions.Item>
          {order && (
            <>
              <Descriptions.Item label="Số loại sản phẩm">
                {orderDetails.length}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Thông tin báo cáo hiện có (nếu có) */}
      {existingQcReport && (
        <Card className="mb-3" title="Báo cáo QC hiện có">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Mã QC Report">
              {existingQcReport.qcReportId || existingQcReport.id || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đơn hàng">
              {existingQcReport.orderId || order?.orderId || order?.id || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Mã chi tiết đơn">
              {existingQcReport.orderDetailId ||
                (orderDetails.length > 0
                  ? orderDetails.map((od) => od.orderDetailId || od.id).join(", ")
                  : "—")}
            </Descriptions.Item>
            <Descriptions.Item label="Người tạo">
              {existingQcReport.createdBy || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian tạo">
              {existingQcReport.createdAt
                ? dayjs(existingQcReport.createdAt).format("DD/MM/YYYY HH:mm")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Giai đoạn">
              {String(existingQcReport.phase || "").toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="Kết quả">
              {String(existingQcReport.result || "").toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="Số serial được chọn" span={2}>
              {Array.isArray(existingQcReport.devices)
                ? existingQcReport.devices.length
                : 0}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* QC Replace: Hiển thị thông tin thiết bị thay thế từ complaint */}
      {isQcReplaceTask && (
        <Card
          title={<><Tag color="magenta">🔄 QC Replace</Tag> Thiết bị thay thế</>}
          className="mb-3"
          style={{ borderColor: '#eb2f96' }}
        >
          {replacementComplaint ? (
            <>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Mã thiết bị thay thế">
                  <Tag color="blue">#{replacementComplaint.replacementDeviceId || "—"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Serial Number thay thế">
                  <Tag color="green" style={{ fontWeight: 'bold' }}>
                    {replacementComplaint.replacementDeviceSerialNumber || "—"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Model gốc">
                  {replacementComplaint.deviceModelName || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Mã khiếu nại">
                  #{replacementComplaint.complaintId || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thiết bị gốc (hỏng)" span={2}>
                  #{replacementComplaint.deviceId || "—"} - SN: {replacementComplaint.deviceSerialNumber || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Mô tả khách hàng" span={2}>
                  {replacementComplaint.customerDescription || "—"}
                </Descriptions.Item>
                {/* Display device status from replacementDeviceData */}
                {replacementDeviceData && (
                  <>
                    <Descriptions.Item label="Trạng thái thiết bị thay thế">
                      <Tag color={getStatusColor(replacementDeviceData.status)}>
                        {translateStatus(replacementDeviceData.status) || replacementDeviceData.status || "—"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Tình trạng hiện tại">
                      {Array.isArray(replacementDeviceData.currentConditions) && replacementDeviceData.currentConditions.length > 0 ? (
                        <Space direction="vertical" size={4}>
                          {replacementDeviceData.currentConditions.map((cond, idx) => {
                            const severityColor = {
                              'INFO': 'green',
                              'LOW': 'blue',
                              'MEDIUM': 'orange',
                              'HIGH': 'red',
                              'CRITICAL': 'magenta',
                            }[String(cond.severity || 'INFO').toUpperCase()] || 'default';
                            return (
                              <Tag key={idx} color={severityColor}>
                                {cond.conditionDefinitionName || `Condition #${cond.conditionDefinitionId}`} ({cond.severity || 'INFO'})
                              </Tag>
                            );
                          })}
                        </Space>
                      ) : (
                        <Text type="secondary">Không có tình trạng</Text>
                      )}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
              {replacementDeviceData && Array.isArray(replacementDeviceData.currentConditions) && replacementDeviceData.currentConditions.length > 0 && (
                <Alert
                  type="success"
                  message="Đã tự động điền tình trạng thiết bị"
                  description="Tình trạng thiết bị thay thế đã được tự động lấy từ hệ thống và điền vào form QC."
                  showIcon
                  style={{ marginTop: 12 }}
                />
              )}
            </>
          ) : (
            <Alert
              type="warning"
              message="Đang tải thông tin thiết bị thay thế..."
              description="Vui lòng đợi hoặc kiểm tra lại nếu không tìm thấy complaint tương ứng."
            />
          )}
        </Card>
      )}

      {/* Chọn thiết bị từ kho theo từng order detail */}
      {orderDetails.length > 0 ? (
        <Card
          title={
            <Space>
              {isQcReplaceTask ? (
                <>
                  <Tag color="magenta">🔄 QC Replace</Tag>
                  Xác nhận thiết bị thay thế
                </>
              ) : (
                "Chọn thiết bị từ kho"
              )}
              {/* <Button onClick={autoPick}>Gợi ý đủ số lượng</Button> */}
            </Space>
          }
          className="mb-3"
        >
          <Row gutter={[16, 16]}>
            {orderDetails.map((orderDetail) => {
              const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
              const quantity = orderDetail.quantity || 1;
              const deviceModelId = orderDetail.deviceModelId;

              const devices = devicesByOrderDetail[orderDetailId] || [];
              const serialNumbersFromDevices = devices
                .map(
                  (device) =>
                    device.serialNumber ||
                    device.serial ||
                    device.serialNo ||
                    device.deviceId ||
                    device.id
                )
                .filter(Boolean)
                .map(String);

              const serialNumbersFromOrder =
                orderDetail.serialNumbers || orderDetail.serialNumberList || [];

              // Generate mock serial numbers if no real data available
              const mockSerialNumbers = Array.from({ length: Math.max(quantity, 5) }, (_, i) => `SN-${String(i + 1).padStart(3, '0')}`);

              const availableSerialNumbers =
                serialNumbersFromDevices.length > 0
                  ? serialNumbersFromDevices
                  : serialNumbersFromOrder.length > 0
                    ? serialNumbersFromOrder
                    : mockSerialNumbers;

              const serialOptions = availableSerialNumbers.map((serial) => ({
                label: String(serial),
                value: String(serial),
              }));

              const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
              const ok = picked.length === quantity;

              return (
                <Col xs={24} md={12} key={orderDetailId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <Text strong>Chọn thiết bị</Text>
                        <Tag color={ok ? "green" : "gold"}>
                          {picked.length}/{quantity} thiết bị
                        </Tag>
                      </Space>
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Mẫu thiết bị:{" "}
                        {modelNameById[deviceModelId] || `#${deviceModelId}`} • Số
                        lượng: {quantity}
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        {loadingDevices ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <Spin size="small" style={{ marginRight: 4 }} /> Đang
                            tải...
                          </Text>
                        ) : serialNumbersFromDevices.length > 0 ? (
                          <Text type="success" style={{ fontSize: 11 }}>
                            ✓ {serialNumbersFromDevices.length} thiết bị có sẵn
                          </Text>
                        ) : serialNumbersFromOrder.length > 0 ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            (Số serial từ đơn hàng)
                          </Text>
                        ) : (
                          <Text type="warning" style={{ fontSize: 11 }}>
                            ⚠ Không có thiết bị trong kho cho model này
                          </Text>
                        )}
                      </div>
                    </div>
                    <Select
                      mode="multiple"
                      placeholder={
                        loadingDevices
                          ? "Đang tải..."
                          : `Chọn ${quantity} số serial`
                      }
                      style={{ width: "100%" }}
                      value={picked.map(String)}
                      onChange={(vals) =>
                        onChangeOrderDetailPick(orderDetailId, quantity, vals)
                      }
                      options={serialOptions}
                      maxTagCount="responsive"
                      showSearch
                      disabled={loadingDevices}
                      loading={loadingDevices}
                      filterOption={(input, option) =>
                        (option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>
          {!isPickComplete() && (
            <div style={{ marginTop: 8 }}>
              <Text type="warning">
                *Vui lòng chọn đủ số lượng thiết bị cho mỗi loại sản phẩm.
              </Text>
            </div>
          )}
        </Card>
      ) : (
        <Card className="mb-3">
          <Text type="secondary">
            Chưa có order details. Vui lòng kiểm tra lại đơn hàng.
          </Text>
        </Card>
      )}

      {/* QC Report Form */}
      <Card title="Báo cáo chất lượng của thiết bị (QC)" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {postRentalDiscrepancyCount > 0 && (
            <Alert
              type="warning"
              showIcon
              message="QC sau thuê đã ghi nhận sự cố"
              description="Có báo cáo QC sau thuê chứa discrepancies. Nếu bạn vẫn cần chỉnh sửa QC trước thuê, vui lòng phối hợp với điều phối/CS để xử lý tiếp trên hệ thống."
            />
          )}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Giai đoạn <Text type="danger">*</Text>
                </Text>
                <Select
                  value="PRE_RENTAL"
                  style={{ width: "100%" }}
                  options={[
                    { label: "Trước thuê (PRE_RENTAL)", value: "PRE_RENTAL" },
                  ]}
                  disabled
                />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Kết quả <Text type="danger">*</Text>
                </Text>
                <Select
                  value={result}
                  onChange={setResult}
                  style={{ width: "100%" }}
                  options={resultOptions}
                />
              </div>
            </Col>
          </Row>



          {/* Device Conditions Section */}
          <Divider />
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text strong style={{ fontSize: 16 }}>
                Tình trạng của thiết bị
              </Text>
            </div>

            {deviceConditions.length === 0 ? (
              <Text
                type="secondary"
                style={{ display: "block", marginTop: 8 }}
              >
                Chưa có tình trạng nào được thêm. Nhấn nút "Thêm tình trạng
                thiết bị" để bắt đầu.
              </Text>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                {deviceConditions.map((condition, index) => {
                  const deviceInfo = availableDevicesForConditions.find(
                    (d) =>
                      d.serial === condition.deviceId ||
                      d.serial === String(condition.deviceId)
                  );

                  const deviceModelId = deviceInfo?.deviceModelId
                    ? Number(deviceInfo.deviceModelId)
                    : null;

                  // Lấy tên model từ modelNameById hoặc từ deviceInfo
                  const deviceModelName = deviceModelId
                    ? (modelNameById[deviceModelId] || deviceInfo?.deviceModelName || null)
                    : null;

                  const filteredConditions = deviceModelId
                    ? conditionDefinitions.filter(
                      (c) => Number(c.deviceModelId) === deviceModelId
                    )
                    : conditionDefinitions;

                  // Tạo title với serial và tên model nếu có
                  const cardTitle = deviceModelName
                    ? `Tình trạng #${index + 1} - ${deviceModelName}`
                    : `Tình trạng #${index + 1}`;

                  return (
                    <Card
                      key={index}
                      size="small"
                      title={cardTitle}
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
                              value={
                                condition.deviceId ? String(condition.deviceId) : null
                              }
                              onChange={async (value) => {
                                const newConditions = [...deviceConditions];
                                newConditions[index] = {
                                  ...newConditions[index],
                                  deviceId: value,
                                  conditionDefinitionId: null,
                                  severity: "",
                                  images: [],
                                };
                                setDeviceConditions(newConditions);

                                if (value) {
                                  try {
                                    const allDevices = await listDevices();
                                    const device = Array.isArray(allDevices)
                                      ? allDevices.find((d) => {
                                        const deviceSerial = String(
                                          d.serialNumber ||
                                          d.serial ||
                                          d.serialNo ||
                                          d.deviceId ||
                                          d.id ||
                                          ""
                                        ).toUpperCase();
                                        return (
                                          deviceSerial ===
                                          String(value).toUpperCase()
                                        );
                                      })
                                      : null;

                                    if (device) {
                                      const deviceId = Number(
                                        device.deviceId || device.id
                                      );

                                      const deviceConditionsData =
                                        await getDeviceConditions(deviceId);

                                      let conditionsArray = [];
                                      if (Array.isArray(deviceConditionsData)) {
                                        conditionsArray = deviceConditionsData;
                                      } else if (
                                        deviceConditionsData &&
                                        Array.isArray(deviceConditionsData.data)
                                      ) {
                                        conditionsArray =
                                          deviceConditionsData.data;
                                      }

                                      if (conditionsArray.length > 0) {
                                        const latestCondition = conditionsArray
                                          .sort((a, b) => {
                                            const timeA = a.capturedAt
                                              ? new Date(
                                                a.capturedAt
                                              ).getTime()
                                              : 0;
                                            const timeB = b.capturedAt
                                              ? new Date(
                                                b.capturedAt
                                              ).getTime()
                                              : 0;
                                            return timeB - timeA;
                                          })[0];

                                        if (
                                          latestCondition &&
                                          latestCondition.conditionDefinitionId
                                        ) {
                                          let mappedSeverity = String(
                                            latestCondition.severity || "INFO"
                                          ).toUpperCase();
                                          const validSeverities = [
                                            "INFO",
                                            "LOW",
                                            "MEDIUM",
                                            "HIGH",
                                            "CRITICAL",
                                          ];
                                          if (mappedSeverity === "NONE")
                                            mappedSeverity = "INFO";
                                          if (
                                            !validSeverities.includes(
                                              mappedSeverity
                                            )
                                          ) {
                                            mappedSeverity = "INFO";
                                          }

                                          const updatedConditions = [
                                            ...deviceConditions,
                                          ];
                                          updatedConditions[index] = {
                                            ...updatedConditions[index],
                                            deviceId: value,
                                            conditionDefinitionId:
                                              latestCondition.conditionDefinitionId ||
                                              null,
                                            severity: mappedSeverity,
                                            images: Array.isArray(
                                              latestCondition.images
                                            )
                                              ? latestCondition.images.filter(
                                                Boolean
                                              )
                                              : [],
                                          };
                                          setDeviceConditions(updatedConditions);
                                          message.success(
                                            "Đã tự động điền tình trạng mới nhất của thiết bị"
                                          );
                                        }
                                      }
                                    } else {
                                      console.warn(
                                        `Không tìm thấy device với serial number: ${value}`
                                      );
                                    }
                                  } catch (error) {
                                    console.warn(
                                      "Không thể tải tình trạng thiết bị:",
                                      error
                                    );
                                  }
                                }
                              }}
                              options={availableDevicesForConditions.map((d) => ({
                                label: d.serial,
                                value: d.serial,
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
                              Tình trạng thiết bị <Text type="danger">*</Text>
                            </Text>
                            <Select
                              style={{ width: "100%" }}
                              placeholder="Chọn tình trạng thiết bị"
                              value={condition.conditionDefinitionId}
                              onChange={(value) => {
                                const newConditions = [...deviceConditions];
                                const def = filteredConditions.find(
                                  (c) => c.id === value
                                );
                                const autoSeverity =
                                  def?.conditionSeverity ||
                                  newConditions[index].severity ||
                                  "NONE";
                                newConditions[index] = {
                                  ...newConditions[index],
                                  conditionDefinitionId: value,
                                  severity: autoSeverity,
                                };
                                setDeviceConditions(newConditions);
                              }}
                              loading={loadingConditions}
                              disabled
                              options={filteredConditions.map((c) => ({
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
                              disabled
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
                                      return await fileToBase64(f.originFileObj);
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
          </div>
        </Space>
      </Card>

      {/* Checklist (optional) */}
      {checklist.length > 0 && (
        <Card title="Checklist tham khảo" className="mb-3">
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Text strong>Tiến độ</Text>
              <Progress
                percent={percent}
                style={{ maxWidth: 360, marginLeft: 12 }}
              />
            </div>

            <Checkbox.Group
              value={checklistDone}
              onChange={setChecklistDone}
              style={{ width: "100%" }}
            >
              <Space direction="vertical">
                {checklist.map((item) => (
                  <Checkbox key={item} value={item}>
                    {item}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Space>
        </Card>
      )}

      <Space>
        <Button onClick={() => nav(-1)}>Hủy</Button>
        <Button
          type="primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              onSave();
            } catch (error) {
              console.error("Error in button onClick:", error);
              message.error(
                "Có lỗi xảy ra: " + (error?.message || "Unknown error")
              );
            }
          }}
          disabled={loading || loadingQcReport}
          loading={saving}
        >
          {existingQcReport ? "Cập nhật QC Report" : "Lưu kết quả QC"}
        </Button>
      </Space>
    </div>
  );
}
