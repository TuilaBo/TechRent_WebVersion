// src/pages/technician/TechnicianQcDetail.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Card, Descriptions, Typography, Tag, Space, Divider, Progress,
  Checkbox, Select, Input, Upload, Button, message, Row, Col, DatePicker, Spin, Modal
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { InboxOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { getTaskById, normalizeTask } from "../../lib/taskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { 
  createPreRentalQcReport, 
  createPostRentalQcReport,
  updateQcReport,
  getQcReportsByOrderId,
  getPreRentalQcReportById,
  getPostRentalQcReportById
} from "../../lib/qcReportApi";
import { getDevicesByModelId, getAvailableDevicesByModel, updateDevice, listDevices } from "../../lib/deviceManage";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getConditionDefinitions } from "../../lib/condition";
import dayjs from "dayjs";

const { Title, Text } = Typography;

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

/** Kiểm tra xem task có phải là Pre rental QC không */
// eslint-disable-next-line no-unused-vars
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

// --- Tiện ích dịch và tô màu trạng thái ---
const translateStatus = (status) => {
  const s = String(status || "").toUpperCase();
  const map = {
    // Task Status
    "PENDING": "Đang chờ",
    "IN_PROGRESS": "Đang xử lý",
    "COMPLETED": "Hoàn thành",
    "CANCELLED": "Đã hủy",
    // QC Result
    "READY_FOR_SHIPPING": "Sẵn sàng giao",
    "PRE_RENTAL_FAILED": "QC trước thuê thất bại",
    "READY_FOR_RE_STOCK": "Sẵn sàng nhập kho",
    "POST_RENTAL_FAILED": "QC sau thuê thất bại",
    // Order Status
    "PENDING_PAYMENT": "Chờ thanh toán",
    "PENDING_CONFIRMATION": "Chờ xác nhận",
    "CONFIRMED": "Đã xác nhận",
    "SHIPPED": "Đã giao hàng",
    "DELIVERED": "Đã nhận hàng",
    "RETURNED": "Đã trả hàng",
    "AVAILABLE": "Có sẵn",
    "PROCESSING": "Đang xử lý",
    // Device Status
    "PRE_RENTAL_QC": "Kiểm tra trước thuê",
    "RENTING": "Đang thuê",
    "RENTED": "Đang thuê",
    "MAINTENANCE": "Bảo trì",
    "BROKEN": "Hỏng",
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

/** Checklist mẫu theo category */
const QC_CHECKLIST_BY_CATEGORY = {
  "VR/AR": ["Vệ sinh ống kính", "Kiểm tra theo dõi chuyển động (tracking)", "Kiểm tra pin", "Kiểm tra dây cáp", "Cập nhật phần mềm (firmware)"],
  "Console": ["Vệ sinh máy", "Chạy thử game demo", "Kiểm tra tay cầm", "Kiểm tra cổng HDMI", "Cập nhật hệ thống"],
  "Camera": ["Kiểm tra cảm biến", "Kiểm tra màn trập", "Kiểm tra pin & sạc", "Kiểm tra thẻ nhớ", "Vệ sinh ống kính"],
  "Drone": ["Kiểm tra cánh quạt", "Kiểm tra GPS", "Kiểm tra pin", "Hiệu chỉnh la bàn (compass)", "Kiểm tra quay video"],
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
  const [loadingDevices, setLoadingDevices] = useState(false);
  // Map: orderDetailId -> danh sách devices (để lấy serialNumbers)
  const [devicesByOrderDetail, setDevicesByOrderDetail] = useState({});
  // Map: deviceModelId -> device model name
  const [modelNameById, setModelNameById] = useState({});
  // QC Report state
  const [existingQcReport, setExistingQcReport] = useState(null);
  const [loadingQcReport, setLoadingQcReport] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Auto-detect phase based on task type (must be declared before useEffect that uses it)
  const detectedPhase = useMemo(() => {
    if (!task) return "PRE_RENTAL";
    return isPickupTask(task) ? "POST_RENTAL" : "PRE_RENTAL";
  }, [task]);
  const [phase, setPhase] = useState(detectedPhase);
  // Set default result based on phase
  const defaultResult = useMemo(() => {
    return detectedPhase === "POST_RENTAL" ? "READY_FOR_RE_STOCK" : "READY_FOR_SHIPPING";
  }, [detectedPhase]);
  const [result, setResult] = useState(defaultResult);
  const [findings, setFindings] = useState("");
  const [accessorySnapshotFile, setAccessorySnapshotFile] = useState(null);
  const [accessorySnapshotPreview, setAccessorySnapshotPreview] = useState("");
  const [selectedDevicesByOrderDetail, setSelectedDevicesByOrderDetail] = useState({});
  const [checklistDone, setChecklistDone] = useState([]);
  // Device conditions state
  const [deviceConditions, setDeviceConditions] = useState([]);
  const [conditionDefinitions, setConditionDefinitions] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);
  // Map: deviceModelId -> deviceCategoryId
  const [deviceCategoryMap, setDeviceCategoryMap] = useState({});
  // Device status update state (for POST_RENTAL only)
  const [deviceStatusUpdated, setDeviceStatusUpdated] = useState(false);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [updatingDeviceStatus, setUpdatingDeviceStatus] = useState(false);
  const [selectedDeviceStatus, setSelectedDeviceStatus] = useState("AVAILABLE");
  
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

          // Fetch existing QC report by orderId (only for matching phase)
          try {
            setLoadingQcReport(true);
            const qcReports = await getQcReportsByOrderId(normalizedTask.orderId);
            console.log("📋 Loaded QC reports for order:", normalizedTask.orderId, qcReports);
            console.log("📋 Current task:", { taskId: normalizedTask.taskId, id: normalizedTask.id, isPickup: isPickupTask(normalizedTask) });
            
            if (Array.isArray(qcReports) && qcReports.length > 0) {
              // Determine expected phase based on task type
              const expectedPhase = isPickupTask(normalizedTask) ? "POST_RENTAL" : "PRE_RENTAL";
              console.log("🔍 Looking for QC report with phase:", expectedPhase);
              
              // Normalize task IDs for comparison
              const taskIdNum = Number(normalizedTask.taskId || normalizedTask.id);
              const taskIdStr = String(normalizedTask.taskId || normalizedTask.id);
              
              // Tìm QC report có phase matching với task type
              // Ưu tiên match theo taskId (so sánh cả number và string), nếu không có thì lấy report đầu tiên có phase matching
              let matchingReport = qcReports.find(r => {
                const reportPhase = String(r.phase || "").toUpperCase();
                const reportTaskId = r.taskId;
                const reportTaskIdNum = Number(reportTaskId);
                const reportTaskIdStr = String(reportTaskId || "");
                
                // So sánh phase và taskId (cả number và string)
                const phaseMatch = reportPhase === expectedPhase;
                const taskIdMatch = 
                  (!Number.isNaN(reportTaskIdNum) && !Number.isNaN(taskIdNum) && reportTaskIdNum === taskIdNum) || 
                  (reportTaskIdStr && taskIdStr && reportTaskIdStr === taskIdStr);
                
                console.log("🔍 Checking report:", {
                  reportPhase,
                  expectedPhase,
                  phaseMatch,
                  reportTaskId,
                  reportTaskIdNum,
                  reportTaskIdStr,
                  taskIdNum,
                  taskIdStr,
                  taskIdMatch,
                  match: phaseMatch && taskIdMatch
                });
                
                return phaseMatch && taskIdMatch;
              });
              
              // Nếu không tìm thấy theo taskId, lấy report đầu tiên có phase matching
              if (!matchingReport) {
                console.log("⚠️ No report found with matching taskId, trying to find by phase only");
                matchingReport = qcReports.find(r => {
                  const reportPhase = String(r.phase || "").toUpperCase();
                  const match = reportPhase === expectedPhase;
                  console.log("🔍 Checking report by phase only:", { reportPhase, expectedPhase, match, report: r });
                  return match;
                });
              }
              
              if (matchingReport) {
                console.log("✅ Found matching QC report:", matchingReport);
                console.log("✅ Report details:", {
                  qcReportId: matchingReport.qcReportId || matchingReport.id,
                  phase: matchingReport.phase,
                  taskId: matchingReport.taskId,
                  orderId: matchingReport.orderId,
                  hasDevices: Array.isArray(matchingReport.devices),
                  devicesCount: Array.isArray(matchingReport.devices) ? matchingReport.devices.length : 0,
                  hasOrderDetailSerialNumbers: !!matchingReport.orderDetailSerialNumbers,
                  hasFindings: !!matchingReport.findings,
                  hasResult: !!matchingReport.result
                });
                setExistingQcReport(matchingReport);
              } else {
                console.log("⚠️ No matching QC report found for phase:", expectedPhase);
                console.log("📋 Available reports:", qcReports.map(r => ({
                  qcReportId: r.qcReportId || r.id,
                  phase: r.phase,
                  taskId: r.taskId
                })));
                setExistingQcReport(null);
              }
            } else {
              console.log("⚠️ No QC reports found for order:", normalizedTask.orderId);
              setExistingQcReport(null);
            }
          } catch (e) {
            // QC report không tồn tại hoặc lỗi -> không sao, sẽ tạo mới
            console.error("❌ Error loading QC reports:", e);
            setExistingQcReport(null);
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

  // Fetch devices for each orderDetail based on deviceModelId
  // For POST_RENTAL phase, get serial numbers from PRE_RENTAL QC report
  useEffect(() => {
    const fetchDevices = async () => {
      if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
        return;
      }

      try {
        setLoadingDevices(true);
        const devicesMap = {};
        const namesMap = {};

        // If phase is POST_RENTAL, get serial numbers from PRE_RENTAL QC report
        const isPostRental = String(phase || "").toUpperCase() === "POST_RENTAL";
        
        if (isPostRental && order.orderId) {
          try {
            // Fetch all QC reports for this order
            const qcReports = await getQcReportsByOrderId(order.orderId);
            const preRentalReport = Array.isArray(qcReports) 
              ? qcReports.find(r => String(r.phase || "").toUpperCase() === "PRE_RENTAL")
              : null;
            
            if (preRentalReport) {
              // Extract serial numbers from PRE_RENTAL QC report
              if (preRentalReport.orderDetailSerialNumbers) {
                // Use orderDetailSerialNumbers if available
                Object.keys(preRentalReport.orderDetailSerialNumbers).forEach((orderDetailId) => {
                  const serials = preRentalReport.orderDetailSerialNumbers[orderDetailId];
                  if (Array.isArray(serials)) {
                    // Convert serial numbers to device-like objects for compatibility
                    devicesMap[orderDetailId] = serials.map(serial => ({
                      serialNumber: String(serial),
                      serial: String(serial),
                      serialNo: String(serial),
                      id: String(serial),
                      deviceId: String(serial),
                    }));
                  }
                });
              } else if (Array.isArray(preRentalReport.devices)) {
                // Group devices by deviceModelId, then map to orderDetails
                const devicesByModel = {};
                preRentalReport.devices.forEach((d) => {
                  const modelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
                  const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
                  if (modelId && serial) {
                    if (!devicesByModel[modelId]) devicesByModel[modelId] = [];
                    devicesByModel[modelId].push(String(serial));
                  }
                });
                
                // Map to orderDetails
                order.orderDetails.forEach((od) => {
                  const orderDetailId = od.orderDetailId || od.id;
                  const modelId = Number(od.deviceModelId ?? NaN);
                  const quantity = Number(od.quantity ?? 1);
                  if (orderDetailId && modelId && devicesByModel[modelId]) {
                    const serials = devicesByModel[modelId].slice(0, quantity);
                    devicesMap[orderDetailId] = serials.map(serial => ({
                      serialNumber: String(serial),
                      serial: String(serial),
                      serialNo: String(serial),
                      id: String(serial),
                      deviceId: String(serial),
                    }));
                  }
                });
              }
              
              // Fetch model names
              const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
              const modelPromises = modelIds.map(async (modelId) => {
                try {
                  const model = await getDeviceModelById(modelId);
                  return [modelId, model?.deviceName || model?.name || null];
                } catch {
                  return [modelId, null];
                }
              });
              const modelResults = await Promise.all(modelPromises);
              modelResults.forEach(([modelId, name]) => {
                if (modelId != null && name) namesMap[modelId] = name;
              });
              
              setDevicesByOrderDetail(devicesMap);
              setModelNameById((prev) => ({ ...prev, ...namesMap }));
              setLoadingDevices(false);
              return; // Early return for POST_RENTAL
            }
          } catch (e) {
            console.warn("Không thể lấy QC report PRE_RENTAL, sẽ dùng API devices:", e);
            // Fall through to normal device fetching
          }
        }

        // Normal flow: fetch devices from API (for PRE_RENTAL or if PRE_RENTAL report not found)
        // Lấy startDate và endDate từ order
        const startDate = order.startDate || order.rentalStartDate;
        const endDate = order.endDate || order.rentalEndDate;
        
        // Format dates cho API (YYYY-MM-DDTHH:mm:ss)
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

        // Fetch devices for each orderDetail concurrently
        const fetchPromises = order.orderDetails.map(async (orderDetail) => {
          const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
          const deviceModelId = orderDetail.deviceModelId;

          if (!deviceModelId) {
            console.warn(`OrderDetail ${orderDetailId} không có deviceModelId`);
            return { orderDetailId, devices: [] };
          }

          try {
            const [devices, model] = await Promise.all([
              // Sử dụng API mới nếu có start/end, ngược lại dùng API cũ
              start && end
                ? getAvailableDevicesByModel(deviceModelId, start, end).catch(() => [])
                : getDevicesByModelId(deviceModelId).catch(() => []),
              getDeviceModelById(deviceModelId).catch(() => null),
            ]);
            const name = model?.deviceName || model?.name || null;
            
            // API mới đã trả về devices khả dụng, không cần filter nữa
            // Nhưng vẫn giữ filter để đảm bảo tương thích nếu API cũ được dùng
            const availableDevices = Array.isArray(devices) 
              ? (start && end 
                  ? devices // API mới đã filter sẵn
                  : devices.filter(device => {
                      const status = String(device.status || device.deviceStatus || device.state || "").toUpperCase();
                      return status === "AVAILABLE";
                    }))
              : [];
            return { orderDetailId, devices: availableDevices, deviceModelId, name };
          } catch (e) {
            console.error(`Lỗi khi fetch devices cho modelId ${deviceModelId}:`, e);
            toast.error(`Không thể tải devices cho model ${deviceModelId}`);
            return { orderDetailId, devices: [], deviceModelId, name: null };
          }
        });

        const results = await Promise.all(fetchPromises);
        
        // Build devicesMap
        results.forEach(({ orderDetailId, devices, deviceModelId, name }) => {
          devicesMap[orderDetailId] = devices;
          if (deviceModelId != null && name) namesMap[deviceModelId] = name;
        });

        setDevicesByOrderDetail(devicesMap);
        setModelNameById((prev) => ({ ...prev, ...namesMap }));
      } catch (e) {
        console.error("Lỗi khi fetch devices:", e);
        toast.error("Không thể tải danh sách thiết bị từ kho");
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDevices();
  }, [order, phase]);

  /** ---------- MOCK INVENTORY TRONG KHO ----------
   * Map: orderDetailId -> danh sách serial/asset code có sẵn
   * (Sau này thay bằng API: GET /inventory?orderDetailId=...)
   */
  const INVENTORY = useMemo(
    () => ({
      // Mock data - sau này sẽ fetch từ API dựa trên orderDetailId
      default: ["SN-001", "SN-002", "SN-003", "SN-004", "SN-005"],
    }),
    []
  );

  // Update phase and result when task changes or when existing report is loaded
  useEffect(() => {
    // Nếu có existing report, dùng phase từ report
    if (existingQcReport && existingQcReport.phase) {
      const reportPhase = String(existingQcReport.phase || "").toUpperCase();
      console.log("🔄 Setting phase from existing report:", reportPhase);
      setPhase(reportPhase);
    } else {
      // Nếu không có existing report, dùng detectedPhase
      setPhase(detectedPhase);
    }
  }, [detectedPhase, existingQcReport]);
  
  // Reset result to default when phase changes (chỉ khi không có existing report)
  useEffect(() => {
    if (!existingQcReport) {
      const newDefaultResult = detectedPhase === "POST_RENTAL" ? "READY_FOR_RE_STOCK" : "READY_FOR_SHIPPING";
      setResult(newDefaultResult);
    }
  }, [detectedPhase, existingQcReport]);

  // Allowed results per phase (labels in Vietnamese, values giữ nguyên để gửi API)
  const resultOptions = useMemo(() => {
    const p = String(phase || "").toUpperCase();
    if (p === "POST_RENTAL") {
      return [
        { label: "Đạt - Sẵn sàng nhập kho", value: "READY_FOR_RE_STOCK" },
        { label: "Không đạt - QC sau thuê", value: "POST_RENTAL_FAILED" },
      ];
    }
    // default: PRE_RENTAL
    return [
      { label: "Đạt - Sẵn sàng giao hàng", value: "READY_FOR_SHIPPING" },
      { label: "Không đạt - QC trước thuê", value: "PRE_RENTAL_FAILED" },
    ];
  }, [phase]);

  // Ensure current result is valid when phase changes
  useEffect(() => {
    const allowed = new Set(resultOptions.map((o) => o.value));
    if (!allowed.has(String(result))) {
      // set a sensible default for the chosen phase
      setResult(resultOptions[0]?.value || "");
    }
  }, [phase, resultOptions, result]);

  // Load existing QC report data into form when it's available (form fields only)
  // This works for both PRE_RENTAL and POST_RENTAL reports
  useEffect(() => {
    if (existingQcReport) {
      console.log("🔄 Loading existing QC report data into form:", existingQcReport);
      const reportPhase = String(existingQcReport.phase || "").toUpperCase();
      const currentPhase = String(phase || "").toUpperCase();
      
      // Set phase từ report nếu chưa match (quan trọng để đảm bảo phase đúng)
      if (reportPhase && reportPhase !== currentPhase) {
        console.log("🔄 Phase mismatch, updating phase from report:", reportPhase, "current:", currentPhase);
        setPhase(reportPhase);
      }
      
      // Populate form fields with existing QC report data (works for both PRE_RENTAL and POST_RENTAL)
      // Điền result
      if (existingQcReport.result) {
        const resultValue = String(existingQcReport.result).toUpperCase();
        console.log("✅ Setting result:", resultValue);
        setResult(resultValue);
      }
      
      // Điền findings
      if (existingQcReport.findings) {
        const findingsValue = String(existingQcReport.findings);
        console.log("✅ Setting findings:", findingsValue);
        setFindings(findingsValue);
      }
      
      // Điền accessory snapshot
      if (existingQcReport.accessorySnapShotUrl || existingQcReport.accessorySnapshotUrl) {
        const url = existingQcReport.accessorySnapShotUrl || existingQcReport.accessorySnapshotUrl;
        console.log("✅ Setting accessory snapshot URL:", url);
        setAccessorySnapshotPreview(url);
      }
      
      // Parse và load deviceConditions từ existingQcReport
      if (Array.isArray(existingQcReport.deviceConditions) && existingQcReport.deviceConditions.length > 0) {
        console.log("📋 Loading deviceConditions from existing report:", existingQcReport.deviceConditions);
        const parsedDeviceConditions = [];
        
        existingQcReport.deviceConditions.forEach((dc) => {
          // Mỗi deviceCondition có thể có nhiều snapshots, mỗi snapshot có nhiều conditionDetails
          if (Array.isArray(dc.snapshots)) {
            dc.snapshots.forEach((snapshot) => {
              if (Array.isArray(snapshot.conditionDetails)) {
                snapshot.conditionDetails.forEach((conditionDetail) => {
                  parsedDeviceConditions.push({
                    deviceId: dc.deviceSerial || String(dc.deviceId), // Use serial number as deviceId
                    conditionDefinitionId: conditionDetail.conditionDefinitionId,
                    severity: conditionDetail.severity,
                    images: Array.isArray(snapshot.images) ? snapshot.images : [],
                  });
                });
              }
            });
          }
        });
        
        console.log("✅ Parsed device conditions:", parsedDeviceConditions);
        setDeviceConditions(parsedDeviceConditions);
      } else {
        // Reset nếu không có deviceConditions
        setDeviceConditions([]);
      }
    }
  }, [existingQcReport, phase]);

  // Load serial numbers from existing QC report (separate useEffect to ensure order is ready)
  useEffect(() => {
    if (existingQcReport && order && Array.isArray(order.orderDetails) && order.orderDetails.length > 0) {
      console.log("📦 Loading serial numbers from existing QC report");
      console.log("📦 Order details:", order.orderDetails);
      
      // Build selectedDevicesByOrderDetail from existing QC report
      // This logic works for both PRE_RENTAL and POST_RENTAL reports
      const serialMap = {};
      
      // Priority 1: Use orderDetailSerialNumbers if available (most reliable)
      if (existingQcReport.orderDetailSerialNumbers && typeof existingQcReport.orderDetailSerialNumbers === 'object') {
        console.log("📦 Loading devices from orderDetailSerialNumbers:", existingQcReport.orderDetailSerialNumbers);
        Object.keys(existingQcReport.orderDetailSerialNumbers).forEach((orderDetailId) => {
          const serials = existingQcReport.orderDetailSerialNumbers[orderDetailId];
          if (Array.isArray(serials)) {
            serialMap[String(orderDetailId)] = serials.map(String);
          }
        });
      }
      
      // Priority 2: Use orderDetailId (single) + devices array
      else if (existingQcReport.orderDetailId && Array.isArray(existingQcReport.devices) && existingQcReport.devices.length > 0) {
        console.log("📦 Loading devices from orderDetailId + devices array");
        const reportOrderDetailId = Number(existingQcReport.orderDetailId);
        const serials = existingQcReport.devices
          .map(d => d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id)
          .filter(Boolean)
          .map(String);
        
        if (serials.length > 0) {
          // Map serial numbers vào orderDetailId từ report
          serialMap[String(reportOrderDetailId)] = serials;
          
          // Nếu có orderDetails, cũng map vào các orderDetails có cùng deviceModelId
          const ods = Array.isArray(order?.orderDetails) ? order.orderDetails : [];
          if (ods.length > 0) {
            // Lấy deviceModelId từ devices trong report
            const deviceModelIds = new Set(
              existingQcReport.devices
                .map(d => Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN))
                .filter(id => !Number.isNaN(id))
            );
            
            // Map vào các orderDetails có cùng deviceModelId
            ods.forEach((od) => {
              const odId = String(od.orderDetailId || od.id);
              const modelId = Number(od.deviceModelId ?? NaN);
              const quantity = Number(od.quantity ?? 1);
              
              // Nếu orderDetailId khớp hoặc deviceModelId khớp, map serial numbers
              if (odId === String(reportOrderDetailId) || (deviceModelIds.has(modelId) && !serialMap[odId])) {
                // Nếu chưa có serial numbers cho orderDetail này, map từ devices
                if (!serialMap[odId]) {
                  const matchingSerials = existingQcReport.devices
                    .filter(d => {
                      const dModelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
                      return !Number.isNaN(dModelId) && dModelId === modelId;
                    })
                    .map(d => d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id)
                    .filter(Boolean)
                    .map(String)
                    .slice(0, quantity);
                  
                  if (matchingSerials.length > 0) {
                    serialMap[odId] = matchingSerials;
                  }
                }
              }
            });
          }
        }
      }
      
      // Priority 3: Use devices array only (group by deviceModelId)
      else if (Array.isArray(existingQcReport.devices) && existingQcReport.devices.length > 0) {
        console.log("📦 Loading devices from devices array (grouped by model)");
        // 1) Gom nhóm devices theo deviceModelId -> danh sách serial
        const groupByModel = existingQcReport.devices.reduce((acc, d) => {
          const mid = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
          const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
          if (!mid || !serial) return acc;
          if (!acc[mid]) acc[mid] = [];
          acc[mid].push(String(serial));
          return acc;
        }, {});

        // 2) Duyệt toàn bộ orderDetails, gán serial theo deviceModelId tương ứng (giới hạn theo quantity)
        const ods = Array.isArray(order?.orderDetails) ? order.orderDetails : [];
        ods.forEach((od) => {
          const odId = od.orderDetailId || od.id;
          const modelId = Number(od.deviceModelId ?? NaN);
          const quantity = Number(od.quantity ?? 1);
          if (!odId || !modelId) return;
          const pool = groupByModel[modelId] || [];
          if (pool.length > 0) {
            serialMap[String(odId)] = pool.slice(0, Math.max(1, quantity));
          }
        });
      }
      
      // Set selectedDevicesByOrderDetail if we found any serial numbers
      if (Object.keys(serialMap).length > 0) {
        console.log("✅ Setting selectedDevicesByOrderDetail:", serialMap);
        console.log("✅ Serial map details:", Object.keys(serialMap).map(key => ({
          orderDetailId: key,
          serials: serialMap[key],
          count: serialMap[key].length
        })));
        setSelectedDevicesByOrderDetail(serialMap);
      } else {
        console.warn("⚠️ No serial numbers found in existing QC report");
        console.warn("⚠️ Report structure:", {
          hasOrderDetailSerialNumbers: !!existingQcReport.orderDetailSerialNumbers,
          hasOrderDetailId: !!existingQcReport.orderDetailId,
          hasDevices: Array.isArray(existingQcReport.devices),
          devicesCount: Array.isArray(existingQcReport.devices) ? existingQcReport.devices.length : 0
        });
      }
    } else if (String(phase || "").toUpperCase() === "POST_RENTAL" && order?.orderId && !existingQcReport) {
      // For POST_RENTAL phase without existing report, pre-fill serials from PRE_RENTAL report
      // This is only for creating NEW POST_RENTAL reports
      console.log("📋 POST_RENTAL without existing report, loading serials from PRE_RENTAL");
      const loadPreRentalSerials = async () => {
        try {
          const qcReports = await getQcReportsByOrderId(order.orderId);
          const preRentalReport = Array.isArray(qcReports) 
            ? qcReports.find(r => String(r.phase || "").toUpperCase() === "PRE_RENTAL")
            : null;
          
          if (preRentalReport) {
            console.log("✅ Found PRE_RENTAL report, extracting serials:", preRentalReport);
            const serialMap = {};
            
            if (preRentalReport.orderDetailSerialNumbers) {
              // Use orderDetailSerialNumbers if available
              Object.keys(preRentalReport.orderDetailSerialNumbers).forEach((orderDetailId) => {
                const serials = preRentalReport.orderDetailSerialNumbers[orderDetailId];
                if (Array.isArray(serials)) {
                  serialMap[String(orderDetailId)] = serials.map(String);
                }
              });
            } else if (Array.isArray(preRentalReport.devices)) {
              // Group devices by deviceModelId, then map to orderDetails
              const devicesByModel = {};
              preRentalReport.devices.forEach((d) => {
                const modelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
                const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
                if (modelId && serial) {
                  if (!devicesByModel[modelId]) devicesByModel[modelId] = [];
                  devicesByModel[modelId].push(String(serial));
                }
              });
              
              // Map to orderDetails
              const ods = Array.isArray(order?.orderDetails) ? order.orderDetails : [];
              ods.forEach((od) => {
                const orderDetailId = od.orderDetailId || od.id;
                const modelId = Number(od.deviceModelId ?? NaN);
                const quantity = Number(od.quantity ?? 1);
                if (orderDetailId && modelId && devicesByModel[modelId]) {
                  serialMap[String(orderDetailId)] = devicesByModel[modelId].slice(0, quantity).map(String);
                }
              });
            }
            
            if (Object.keys(serialMap).length > 0) {
              console.log("✅ Pre-filled serials from PRE_RENTAL:", serialMap);
              setSelectedDevicesByOrderDetail(serialMap);
            }
          }
        } catch (e) {
          console.warn("Không thể load serial từ PRE_RENTAL report:", e);
        }
      };
      
      loadPreRentalSerials();
    }
  }, [existingQcReport, order, phase]);

  // Kiểm tra device status sau khi selectedDevicesByOrderDetail đã được set (cho POST_RENTAL)
  useEffect(() => {
    const checkDeviceStatusForPostRental = async () => {
      // Chỉ kiểm tra cho POST_RENTAL phase và khi đã có existingQcReport với result READY_FOR_RE_STOCK
      if (String(phase || "").toUpperCase() !== "POST_RENTAL") return;
      if (!existingQcReport) return;
      if (String(existingQcReport.result || "").toUpperCase() !== "READY_FOR_RE_STOCK") return;
      if (deviceStatusUpdated) return; // Đã kiểm tra rồi
      
      // Đợi một chút để đảm bảo selectedDevicesByOrderDetail đã được set
      const serials = Object.values(selectedDevicesByOrderDetail).flat().map(String);
      if (serials.length === 0) return; // Chưa có serial numbers
      
      try {
        const allDevices = await listDevices();
        const devices = Array.isArray(allDevices) 
          ? serials.map(serial => 
              allDevices.find(d => {
                const deviceSerial = String(d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id || "").toUpperCase();
                return deviceSerial === String(serial).toUpperCase();
              })
            ).filter(Boolean)
          : [];
        
        // Kiểm tra xem tất cả devices đã có status AVAILABLE chưa
        const allAvailable = devices.length > 0 && devices.every(d => {
          const status = String(d.status || "").toUpperCase();
          return status === "AVAILABLE";
        });
        
        if (allAvailable) {
          setDeviceStatusUpdated(true);
        }
      } catch (e) {
        console.warn("Không thể kiểm tra status thiết bị:", e);
      }
    };
    
    // Delay một chút để đảm bảo selectedDevicesByOrderDetail đã được set
    const timer = setTimeout(() => {
      checkDeviceStatusForPostRental();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [selectedDevicesByOrderDetail, existingQcReport, phase, deviceStatusUpdated]);

  // Get order details from order
  const orderDetails = useMemo(() => {
    if (!order || !Array.isArray(order.orderDetails)) return [];
    return order.orderDetails;
  }, [order]);

  // Load condition definitions when devices are selected
  useEffect(() => {
    const loadConditionDefinitions = async () => {
      if (!orderDetails.length || !selectedDevicesByOrderDetail || Object.keys(selectedDevicesByOrderDetail).length === 0) {
        setConditionDefinitions([]);
        return;
      }

      try {
        setLoadingConditions(true);
        // Get all unique deviceCategoryIds from selected devices
        const categoryIds = new Set();
        
        // Get deviceCategoryId from each orderDetail's deviceModelId
        for (const orderDetail of orderDetails) {
          const orderDetailId = String(orderDetail.orderDetailId || orderDetail.id);
          const serials = selectedDevicesByOrderDetail[orderDetailId] || [];
          
          if (serials.length > 0 && orderDetail.deviceModelId) {
            try {
              const model = await getDeviceModelById(orderDetail.deviceModelId);
              const categoryId = model?.deviceCategoryId || model?.categoryId;
              if (categoryId) {
                categoryIds.add(categoryId);
              }
            } catch (e) {
              console.warn(`Failed to load model ${orderDetail.deviceModelId}:`, e);
            }
          }
        }

        // Build deviceCategoryMap: deviceModelId -> deviceCategoryId
        const categoryMap = {};
        for (const orderDetail of orderDetails) {
          const orderDetailId = String(orderDetail.orderDetailId || orderDetail.id);
          const serials = selectedDevicesByOrderDetail[orderDetailId] || [];
          
          if (serials.length > 0 && orderDetail.deviceModelId) {
            try {
              const model = await getDeviceModelById(orderDetail.deviceModelId);
              const categoryId = model?.deviceCategoryId || model?.categoryId;
              if (categoryId) {
                categoryMap[orderDetail.deviceModelId] = categoryId;
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
  }, [orderDetails, selectedDevicesByOrderDetail]);

  // Helper: Get available devices list for condition selection
  const availableDevicesForConditions = useMemo(() => {
    const devices = [];
    Object.keys(selectedDevicesByOrderDetail).forEach((orderDetailId) => {
      const serials = selectedDevicesByOrderDetail[orderDetailId] || [];
      const orderDetail = orderDetails.find(od => String(od.orderDetailId || od.id) === orderDetailId);
      
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
    // Có thể lấy từ taskCategoryName hoặc từ category của order
    return QC_CHECKLIST_BY_CATEGORY[task?.taskCategoryName] || [];
  }, [task]);

  const percent = Math.round((checklistDone.length / Math.max(1, checklist.length)) * 100);

  /** Gợi ý auto chọn đủ số lượng đầu tiên trong kho */
  const autoPick = () => {
    const next = { ...selectedDevicesByOrderDetail };
    orderDetails.forEach((orderDetail) => {
      const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
      const quantity = orderDetail.quantity || 1;
      
      // Lấy devices từ API, extract serialNumbers
      const devices = devicesByOrderDetail[orderDetailId] || [];
      const serialNumbers = devices
        .map(device => device.serialNumber || device.serial || device.serialNo || device.id)
        .filter(Boolean);
      
      // Fallback về mock nếu không có devices từ API
      const avail = serialNumbers.length > 0 
        ? serialNumbers 
        : (INVENTORY[orderDetailId] || INVENTORY.default || []);
      
      next[orderDetailId] = avail.slice(0, quantity).map(String);
    });
    setSelectedDevicesByOrderDetail(next);
    message.success("Đã gợi ý đủ số lượng từ kho.");
  };

  /** Khi chọn thay đổi per-orderDetail, giữ không vượt quá số lượng yêu cầu */
  const onChangeOrderDetailPick = (orderDetailId, quantity, values) => {
    if (values.length > quantity) {
      message.warning(`Chỉ cần ${quantity} thiết bị cho order detail này.`);
      values = values.slice(0, quantity);
    }
    setSelectedDevicesByOrderDetail((prev) => ({ ...prev, [orderDetailId]: values }));
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

  /** Cập nhật status thiết bị về AVAILABLE sau POST_RENTAL QC */
  const handleUpdateDeviceStatus = async () => {
    if (!orderDetails.length || !selectedDevicesByOrderDetail) {
      message.error("Không có thông tin thiết bị để cập nhật");
      return;
    }

    try {
      setUpdatingDeviceStatus(true);
      
      // Lấy tất cả serial numbers từ selectedDevicesByOrderDetail
      const allSerialNumbers = [];
      Object.values(selectedDevicesByOrderDetail).forEach((serials) => {
        if (Array.isArray(serials)) {
          allSerialNumbers.push(...serials.map(String));
        }
      });

      if (allSerialNumbers.length === 0) {
        message.error("Không có serial numbers để cập nhật");
        return;
      }

      // Lấy danh sách tất cả devices để tìm theo serial number
      const allDevices = await listDevices();
      const devicesToUpdate = [];

      // Tìm devices theo serial numbers
      allSerialNumbers.forEach((serial) => {
        const device = Array.isArray(allDevices) 
          ? allDevices.find((d) => {
              const deviceSerial = String(d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id || "").toUpperCase();
              return deviceSerial === String(serial).toUpperCase();
            })
          : null;
        
        if (device) {
          const deviceId = device.deviceId || device.id;
          const deviceModelId = device.deviceModelId || device.modelId || device.device_model_id;
          // Lấy serialNumber từ device object để giữ nguyên khi update
          const deviceSerialNumber = device.serialNumber || device.serial || device.serialNo || serial;
          if (deviceId && deviceModelId) {
            devicesToUpdate.push({ deviceId, serial, deviceModelId, serialNumber: deviceSerialNumber });
          } else if (deviceId) {
            console.warn(`Device ${deviceId} (serial: ${serial}) không có deviceModelId, bỏ qua`);
          }
        }
      });

      if (devicesToUpdate.length === 0) {
        message.warning("Không tìm thấy thiết bị nào với serial numbers đã chọn hoặc thiết bị không có deviceModelId");
        return;
      }

      // Cập nhật status của từng device theo status được chọn
      const updatePromises = devicesToUpdate.map(async ({ deviceId, serial, deviceModelId, serialNumber }) => {
        try {
          // Backend yêu cầu deviceModelId không được null
          // Giữ nguyên serialNumber để không bị mất khi update
          await updateDevice(deviceId, { 
            status: String(selectedDeviceStatus || "AVAILABLE").toUpperCase(),
            deviceModelId: Number(deviceModelId),
            serialNumber: String(serialNumber || serial)
          });
          return { success: true, deviceId, serial };
        } catch (e) {
          console.error(`Failed to update device ${deviceId} (serial: ${serial}):`, e);
          return { success: false, deviceId, serial, error: e };
        }
      });

      const results = await Promise.all(updatePromises);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        const statusLabel = translateStatus(selectedDeviceStatus);
        toast.success(`Đã cập nhật status ${successCount} thiết bị về "${statusLabel}"`);
        setDeviceStatusUpdated(true);
        setShowUpdateStatusModal(false);
        
        // Navigate back sau khi cập nhật thành công
        setTimeout(() => {
          nav(-1);
        }, 1500);
      }

      if (failCount > 0) {
        message.warning(`${failCount} thiết bị không thể cập nhật status`);
      }
    } catch (e) {
      console.error("Error updating device status:", e);
      toast.error(e?.response?.data?.message || e?.message || "Không thể cập nhật status thiết bị");
    } finally {
      setUpdatingDeviceStatus(false);
    }
  };

  const onSave = async () => {
    if (saving) return; // 防抖，避免重复提交
    console.log("=== onSave called ===");
    console.log("task:", task);
    console.log("actualTaskId:", actualTaskId);
    console.log("orderDetails:", orderDetails);
    console.log("selectedDevicesByOrderDetail:", selectedDevicesByOrderDetail);
    console.log("selectedDevicesByOrderDetail (detailed):", JSON.stringify(selectedDevicesByOrderDetail, null, 2));
    console.log("findings:", findings);
    console.log("isPickComplete():", isPickComplete());
    
    // Debug chi tiết từng order detail
    if (orderDetails.length > 0) {
      console.log("=== Order Details Analysis ===");
      orderDetails.forEach((od, idx) => {
        const orderDetailId = od.orderDetailId || od.id;
        const quantity = od.quantity || 1;
        const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
        console.log(`OrderDetail #${idx + 1}:`, {
          orderDetailId,
          quantity,
          pickedCount: picked.length,
          pickedItems: picked,
          isComplete: picked.length === quantity
        });
      });
    }
    
    if (!task || !actualTaskId) {
      console.error("Validation failed: missing task or actualTaskId");
      message.error("Không có thông tin task");
      return;
    }

    if (!isPickComplete()) {
      console.error("Validation failed: pick not complete");
      
      // Chi tiết từng order detail để debug
      const incompleteDetails = orderDetails.map(od => {
        const orderDetailId = od.orderDetailId || od.id;
        const quantity = od.quantity || 1;
        const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
        const status = picked.length === quantity ? "✓ OK" : `✗ THIẾU (cần ${quantity}, đã chọn ${picked.length})`;
        return {
          orderDetailId,
          quantity,
          picked: picked.length,
          selected: picked,
          status
        };
      });
      
      console.log("Order details check:", incompleteDetails);
      
      // Tìm các order detail chưa đủ để hiển thị message rõ ràng hơn
      const missingDetails = incompleteDetails.filter(d => d.picked !== d.quantity);
      if (missingDetails.length > 0) {
        const missingList = missingDetails.map(d => `Order Detail #${d.orderDetailId}: cần ${d.quantity}, đã chọn ${d.picked}`);
        console.error("Missing details:", missingList);
        
        // Hiển thị message với danh sách rõ ràng
        const errorMsg = `Vui lòng chọn đủ thiết bị: ${missingList.join("; ")}`;
        message.error(errorMsg, 6); // Hiển thị 6 giây
      } else {
        message.error("Vui lòng chọn đủ số lượng thiết bị cho mỗi mục trong đơn hàng.", 6);
      }
      return;
    }

    if (!findings.trim()) {
      console.error("Validation failed: findings is empty");
      message.error("Vui lòng nhập Ghi chú/Phát hiện");
      return;
    }

    try {
      setSaving(true);
      console.log("Starting to build payload...");
      
      // Map orderDetails thành orderDetailSerialNumbers format
      // Format: { "355": [serialNumbers], "356": [serialNumbers], ... }
      // Backend mong đợi key là orderDetailId (Long), nhưng JSON chỉ hỗ trợ string keys
      // Backend sẽ tự parse string key thành Long
      const orderDetailSerialNumbers = {};
      
      orderDetails.forEach((orderDetail) => {
        const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
        const serialNumbers = selectedDevicesByOrderDetail[orderDetailId] || [];
        
        // Dùng orderDetailId trực tiếp làm key (sẽ được convert thành string trong JSON)
        // Backend sẽ parse lại thành Long
        const key = String(orderDetailId);
        // Đảm bảo serialNumbers là array of strings
        orderDetailSerialNumbers[key] = serialNumbers.map(String);
        
        console.log(`Mapped orderDetailId ${orderDetailId} (key: "${key}"):`, serialNumbers);
      });

      const currentPhase = String(phase || "PRE_RENTAL").toUpperCase();
      const isPostRental = currentPhase === "POST_RENTAL";
      
      // Build deviceConditions payload
      // Need to convert serial numbers to deviceIds
      const allDevices = await listDevices();
      const deviceConditionsPayload = [];
      
      for (const condition of deviceConditions) {
        if (!condition.deviceId || !condition.conditionDefinitionId || !condition.severity) {
          continue; // Skip incomplete conditions
        }
        
        // Find device by serial number
        const device = Array.isArray(allDevices)
          ? allDevices.find(d => {
              const deviceSerial = String(d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id || "").toUpperCase();
              return deviceSerial === String(condition.deviceId).toUpperCase();
            })
          : null;
        
        if (device) {
          const deviceId = device.deviceId || device.id;
          deviceConditionsPayload.push({
            deviceId: Number(deviceId),
            conditionDefinitionId: Number(condition.conditionDefinitionId),
            severity: String(condition.severity),
            images: Array.isArray(condition.images) ? condition.images.map(String) : [],
          });
        }
      }

      // Base payload cho cả PRE và POST rental
      const basePayload = {
        taskId: Number(actualTaskId),
        orderDetailSerialNumbers,
        result: String(result || (isPostRental ? "READY_FOR_RE_STOCK" : "READY_FOR_SHIPPING")).toUpperCase(),
        findings: findings.trim(),
        deviceConditions: deviceConditionsPayload,
        accessoryFile: accessorySnapshotFile || null,
      };
      
      // Thêm discrepancies cho POST-RENTAL
      if (isPostRental) {
        basePayload.discrepancies = []; // TODO: Thêm UI để nhập discrepancies
      }

      console.log("QC report payload:", basePayload);
      
      // Check if updating existing report or creating new one
      const taskStatus = String(task?.status || "").toUpperCase();
      const isCompleted = taskStatus === "COMPLETED";
      const qcReportId = existingQcReport?.qcReportId || existingQcReport?.id;
      
      // Nếu status là COMPLETED nhưng chưa có QC report -> không cho tạo mới
      if (isCompleted && !qcReportId) {
        message.error("Task đã hoàn thành. Chỉ có thể cập nhật QC report đã tồn tại, không thể tạo mới.");
        return;
      }
      
      if (existingQcReport && qcReportId) {
        console.log("Calling update QC report...");
        console.log("Existing QC Report:", existingQcReport);
        console.log("Order Details:", orderDetails);
        console.log("Selected Devices:", selectedDevicesByOrderDetail);
        
        // Remove taskId from update payload (not needed for update)
        // Đảm bảo orderDetailSerialNumbers có đầy đủ orderDetailId từ orderDetails
        const finalOrderDetailSerialNumbers = {};
        orderDetails.forEach((orderDetail) => {
          const orderDetailId = String(orderDetail.orderDetailId || orderDetail.id);
          const serialNumbers = selectedDevicesByOrderDetail[orderDetailId] || 
                                selectedDevicesByOrderDetail[orderDetail.orderDetailId] ||
                                selectedDevicesByOrderDetail[orderDetail.id] ||
                                [];
          if (serialNumbers.length > 0) {
            finalOrderDetailSerialNumbers[orderDetailId] = serialNumbers.map(String);
          }
        });
        
        // Nếu không có serial numbers từ selectedDevicesByOrderDetail, dùng từ basePayload
        const orderDetailSerialNumbersToUse = Object.keys(finalOrderDetailSerialNumbers).length > 0
          ? finalOrderDetailSerialNumbers
          : basePayload.orderDetailSerialNumbers;
        
        const updatePayload = {
          phase: String(phase || "PRE_RENTAL").toUpperCase(),
          orderDetailSerialNumbers: orderDetailSerialNumbersToUse,
          result: basePayload.result,
          findings: basePayload.findings,
          deviceConditions: basePayload.deviceConditions,
          accessoryFile: basePayload.accessoryFile,
        };
        
        // Thêm discrepancies cho POST-RENTAL update (có thể bỏ qua cho PRE_RENTAL)
        if (isPostRental && Array.isArray(basePayload.discrepancies) && basePayload.discrepancies.length > 0) {
          updatePayload.discrepancies = basePayload.discrepancies;
        }
        
        console.log("Update QC Report Payload:", updatePayload);
        
        // Sử dụng updateQcReport cho cả PRE_RENTAL và POST_RENTAL
        await updateQcReport(qcReportId, updatePayload);
        
        console.log("Update QC report succeeded");
        toast.success("Đã cập nhật QC report thành công!");
      } else {
        console.log("Calling create QC report...");
        
        // Gọi API create tương ứng với phase
        let createdReport;
        if (isPostRental) {
          createdReport = await createPostRentalQcReport(basePayload);
        } else {
          createdReport = await createPreRentalQcReport(basePayload);
        }
        
        console.log("Create QC report succeeded, response:", createdReport);
        toast.success("Đã tạo QC report thành công!");
        
        // Sau khi tạo thành công, load lại QC report để fill vào form
        const newQcReportId = createdReport?.qcReportId || createdReport?.id;
        if (newQcReportId) {
          try {
            console.log("Loading created QC report for editing:", newQcReportId);
            const loadedReport = isPostRental
              ? await getPostRentalQcReportById(newQcReportId)
              : await getPreRentalQcReportById(newQcReportId);
            
            if (loadedReport) {
              console.log("Loaded QC report:", loadedReport);
              
              // Set existingQcReport để form chuyển sang chế độ update
              setExistingQcReport(loadedReport);
              
              // Parse deviceConditions từ response format sang input format
              if (Array.isArray(loadedReport.deviceConditions) && loadedReport.deviceConditions.length > 0) {
                const parsedDeviceConditions = [];
                
                loadedReport.deviceConditions.forEach((dc) => {
                  // Mỗi deviceCondition có thể có nhiều snapshots, mỗi snapshot có nhiều conditionDetails
                  if (Array.isArray(dc.snapshots)) {
                    dc.snapshots.forEach((snapshot) => {
                      if (Array.isArray(snapshot.conditionDetails)) {
                        snapshot.conditionDetails.forEach((conditionDetail) => {
                          parsedDeviceConditions.push({
                            deviceId: dc.deviceSerial || String(dc.deviceId), // Use serial number as deviceId
                            conditionDefinitionId: conditionDetail.conditionDefinitionId,
                            severity: conditionDetail.severity,
                            images: Array.isArray(snapshot.images) ? snapshot.images : [],
                          });
                        });
                      }
                    });
                  }
                });
                
                console.log("Parsed device conditions:", parsedDeviceConditions);
                setDeviceConditions(parsedDeviceConditions);
              }
            }
          } catch (e) {
            console.error("Failed to load created QC report:", e);
            // Không block flow nếu load thất bại
          }
        }
        
        // Sau khi tạo thành công và load report, không navigate ngay để user có thể update
        toast.info("QC report đã được tạo. Bạn có thể cập nhật thông tin nếu cần.");
      }
      
      // Nếu là POST_RENTAL và result là READY_FOR_RE_STOCK, hiện modal cập nhật status
      const isReadyForRestock = String(result || "").toUpperCase() === "READY_FOR_RE_STOCK";
      
      // Chỉ navigate nếu đã update (không phải create mới)
      if (existingQcReport && qcReportId) {
        if (isPostRental && isReadyForRestock && !deviceStatusUpdated) {
          // Hiện modal để cập nhật status thiết bị
          setShowUpdateStatusModal(true);
          // Không navigate ngay, đợi user cập nhật status
        } else {
          // Navigate back sau khi update thành công
          setTimeout(() => {
            nav(-1);
          }, 1500);
        }
      }
      // Nếu là create mới, không navigate để user có thể tiếp tục chỉnh sửa
    } catch (e) {
      console.error("Create QC report error:", e);
      console.error("Error details:", {
        message: e?.message,
        response: e?.response?.data,
        stack: e?.stack
      });
      toast.error(e?.response?.data?.message || e?.response?.data?.details || e?.message || "Không thể tạo QC report");
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
      <Card title="Thông tin Nhiệm vụ" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã nhiệm vụ">{task.taskId || task.id}</Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{task.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">{task.taskCategoryName || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{task.description || "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái của nhiệm vụ">
            <Tag color={getStatusColor(task.status)}>
              {translateStatus(task.status) || "—"}
            </Tag>
          </Descriptions.Item>
          {order && (
            <>
              <Descriptions.Item label="Số loại sản phẩm">{orderDetails.length}</Descriptions.Item>
              
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
              {existingQcReport.orderDetailId || (orderDetails.length > 0 ? orderDetails.map(od => od.orderDetailId || od.id).join(", ") : "—")}
            </Descriptions.Item>
            <Descriptions.Item label="Người tạo">
              {existingQcReport.createdBy || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian tạo">
              {existingQcReport.createdAt ? dayjs(existingQcReport.createdAt).format("DD/MM/YYYY HH:mm") : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Giai đoạn">
              {String(existingQcReport.phase || "").toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="Kết quả">
              {String(existingQcReport.result || "").toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="Số serial được chọn" span={2}>
              {Array.isArray(existingQcReport.devices) ? existingQcReport.devices.length : 0}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Chọn thiết bị từ kho theo từng order detail */}
      {orderDetails.length > 0 ? (
        <Card
          title={
            <Space>
              {isPickupTask(task) ? "Thiết bị trong đơn" : "Chọn thiết bị từ kho"}
              {!isPickupTask(task) && (
                <Button onClick={autoPick}>Gợi ý đủ số lượng</Button>
              )}
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
                .map(device => device.serialNumber || device.serial || device.serialNo || device.deviceId || device.id)
                .filter(Boolean)
                .map(String);

              const serialNumbersFromOrder = orderDetail.serialNumbers || orderDetail.serialNumberList || [];
              const mockSerialNumbers = INVENTORY[orderDetailId] || INVENTORY.default || [];

              const availableSerialNumbers = serialNumbersFromDevices.length > 0
                ? serialNumbersFromDevices
                : (serialNumbersFromOrder.length > 0 ? serialNumbersFromOrder : mockSerialNumbers);

              const serialOptions = availableSerialNumbers.map((serial) => ({
                label: String(serial),
                value: String(serial),
              }));

              const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
              const ok = picked.length === quantity;
              const isPickup = isPickupTask(task);

              return (
                <Col xs={24} md={12} key={orderDetailId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <Text strong>{isPickup ? "Thiết bị trong đơn" : "Chọn thiết bị"}</Text>
                        <Tag color={ok ? "green" : "gold"}>
                          {picked.length}/{quantity} thiết bị
                        </Tag>
                      </Space>
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Mẫu thiết bị: {modelNameById[deviceModelId] || `#${deviceModelId}`} • Số lượng: {quantity}
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        {loadingDevices ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <Spin size="small" style={{ marginRight: 4 }} /> Đang tải...
                          </Text>
                        ) : isPickup ? (
                          <Text type="info" style={{ fontSize: 11 }}>
                            ℹ Thiết bị đã được giao trong đơn
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
                    {isPickup ? (
                      <div>
                        {picked.length > 0 ? (
                          <div style={{ 
                            padding: 12, 
                            backgroundColor: '#f5f5f5', 
                            borderRadius: 6,
                            border: '1px solid #d9d9d9'
                          }}>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                              Danh sách thiết bị đã giao:
                            </Text>
                            <Space wrap size={[8, 8]}>
                              {picked.map((serial, idx) => (
                                <Tag 
                                  key={idx} 
                                  color="blue" 
                                  style={{ 
                                    fontSize: 13, 
                                    padding: '4px 12px',
                                    margin: 0
                                  }}
                                >
                                  {serial}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        ) : (
                          <div style={{ 
                            padding: 12, 
                            backgroundColor: '#fffbe6', 
                            borderRadius: 6,
                            border: '1px solid #ffe58f'
                          }}>
                            <Text type="warning" style={{ fontSize: 12 }}>
                              ⚠ Chưa có thông tin serial numbers từ QC report trước thuê
                            </Text>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Select
                        mode="multiple"
                        placeholder={
                          loadingDevices
                            ? "Đang tải..."
                            : `Chọn ${quantity} số serial`
                        }
                        style={{ width: "100%" }}
                        value={picked.map(String)}
                        onChange={(vals) => onChangeOrderDetailPick(orderDetailId, quantity, vals)}
                        options={serialOptions}
                        maxTagCount="responsive"
                        showSearch
                        disabled={loadingDevices}
                        loading={loadingDevices}
                        filterOption={(input, option) =>
                          (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>
          {!isPickupTask(task) && !isPickComplete() && (
            <div style={{ marginTop: 8 }}>
              <Text type="warning">*Vui lòng chọn đủ số lượng thiết bị cho mỗi loại sản phẩm.</Text>
            </div>
          )}
          {isPickupTask(task) && (
            <div style={{ marginTop: 8 }}>
          
            </div>
          )}
        </Card>
      ) : (
        <Card className="mb-3">
          <Text type="secondary">Chưa có order details. Vui lòng kiểm tra lại đơn hàng.</Text>
        </Card>
      )}

      {/* QC Report Form */}
      <Card title="Báo cáo chất lượng của thiết bị (QC)" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Giai đoạn <Text type="danger">*</Text>
                </Text>
                <Select
                  value={phase}
                  onChange={setPhase}
                  style={{ width: "100%" }}
                  options={[
                    { label: "Trước thuê (PRE_RENTAL)", value: "PRE_RENTAL" },
                    { label: "Sau thuê (POST_RENTAL)", value: "POST_RENTAL" },
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

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Ghi chú/Phát hiện <Text type="danger">*</Text>
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="Nhập ghi chú, phát hiện hoặc quan sát trong quá trình QC..."
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              required
            />
          </div>

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Ảnh chụp bằng chứng
            </Text>
            <Upload.Dragger
              multiple={false}
              accept=".jpg,.jpeg,.png,.webp"
              beforeUpload={() => false}
              showUploadList={false}
              onChange={({ file }) => {
                const f = file?.originFileObj || file;
                if (f) {
                  setAccessorySnapshotFile(f);
                  const url = file.thumbUrl || file.url || (f ? URL.createObjectURL(f) : "");
                  setAccessorySnapshotPreview(url);
                } else {
                  setAccessorySnapshotFile(null);
                  setAccessorySnapshotPreview("");
                }
              }}
            >
              {accessorySnapshotPreview ? (
                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img
                    src={accessorySnapshotPreview}
                    alt="accessory"
                    style={{ maxHeight: 170, maxWidth: "100%", borderRadius: 8 }}
                  />
                </div>
              ) : (
                <>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p>Thả hoặc bấm để chọn 1 ảnh phụ kiện</p>
                  <p style={{ color: "#888", fontSize: 12 }}>Hỗ trợ: JPG, PNG, WEBP</p>
                </>
              )}
            </Upload.Dragger>
            {accessorySnapshotPreview && (
              <div style={{ marginTop: 8 }}>
                <Button onClick={() => { setAccessorySnapshotFile(null); setAccessorySnapshotPreview(""); }}>
                  Chọn lại ảnh
                </Button>
              </div>
            )}
          </div>

          {/* Device Conditions Section */}
          <Divider />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text strong style={{ fontSize: 16 }}>
                Điều kiện thiết bị (Device Conditions)
              </Text>
              <Button
                type="dashed"
                onClick={() => {
                  if (availableDevicesForConditions.length === 0) {
                    message.warning("Vui lòng chọn thiết bị trước khi thêm điều kiện");
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
                + Thêm điều kiện
              </Button>
            </div>
            
            {deviceConditions.length === 0 ? (
              <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                Chưa có điều kiện nào được thêm. Nhấn nút "Thêm điều kiện" để bắt đầu.
              </Text>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                {deviceConditions.map((condition, index) => {
                  // Find device info by serial
                  const deviceInfo = availableDevicesForConditions.find(
                    d => d.serial === condition.deviceId || d.serial === String(condition.deviceId)
                  );
                  
                  // Get deviceCategoryId from map
                  const deviceCategoryId = deviceInfo?.deviceModelId 
                    ? deviceCategoryMap[deviceInfo.deviceModelId] 
                    : null;
                  
                  // Filter conditions by deviceCategoryId
                  const filteredConditions = deviceCategoryId
                    ? conditionDefinitions.filter(c => c.deviceCategoryId === deviceCategoryId)
                    : conditionDefinitions;

                  return (
                    <Card
                      key={index}
                      size="small"
                      title={`Điều kiện #${index + 1}`}
                      extra={
                        <Button
                          type="text"
                          danger
                          size="small"
                          onClick={() => {
                            setDeviceConditions(deviceConditions.filter((_, i) => i !== index));
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
                              Thiết bị (Serial Number) <Text type="danger">*</Text>
                            </Text>
                            <Select
                              style={{ width: "100%" }}
                              placeholder="Chọn thiết bị"
                              value={condition.deviceId ? String(condition.deviceId) : null}
                              onChange={(value) => {
                                const newConditions = [...deviceConditions];
                                newConditions[index] = {
                                  ...newConditions[index],
                                  deviceId: value,
                                  conditionDefinitionId: null, // Reset when device changes
                                };
                                setDeviceConditions(newConditions);
                              }}
                              options={availableDevicesForConditions.map(d => ({
                                label: d.serial,
                                value: d.serial,
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
                              value={condition.conditionDefinitionId}
                              onChange={(value) => {
                                const newConditions = [...deviceConditions];
                                newConditions[index] = {
                                  ...newConditions[index],
                                  conditionDefinitionId: value,
                                };
                                setDeviceConditions(newConditions);
                              }}
                              loading={loadingConditions}
                              disabled={!condition.deviceId || loadingConditions}
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
                              Mức độ nghiêm trọng (Severity) <Text type="danger">*</Text>
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
                                { label: "Nhẹ (LOW)", value: "LOW" },
                                { label: "Trung bình (MEDIUM)", value: "MEDIUM" },
                                { label: "Nặng (HIGH)", value: "HIGH" },
                                { label: "Rất nặng (CRITICAL)", value: "CRITICAL" },
                              ]}
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={12}>
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ display: "block", marginBottom: 4 }}>
                              Ảnh bằng chứng
                            </Text>
                            <Upload
                              multiple
                              accept=".jpg,.jpeg,.png,.webp"
                              beforeUpload={() => false}
                              listType="picture-card"
                              fileList={condition.images?.map((img, imgIdx) => ({
                                uid: `img-${index}-${imgIdx}`,
                                name: `image-${imgIdx + 1}.jpg`,
                                status: "done",
                                url: typeof img === "string" ? img : (img?.url || img?.thumbUrl || ""),
                              })) || []}
                              onChange={({ fileList }) => {
                                const newConditions = [...deviceConditions];
                                const imageUrls = fileList
                                  .map(f => f.thumbUrl || f.url || (f.originFileObj ? URL.createObjectURL(f.originFileObj) : ""))
                                  .filter(Boolean);
                                newConditions[index] = {
                                  ...newConditions[index],
                                  images: imageUrls,
                                };
                                setDeviceConditions(newConditions);
                              }}
                            >
                              {((condition.images?.length || 0) < 5) && (
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

      {/* Checklist (optional, for reference) */}
      {checklist.length > 0 && (
        <Card title="Checklist tham khảo" className="mb-3">
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Text strong>Tiến độ</Text>
              <Progress percent={percent} style={{ maxWidth: 360, marginLeft: 12 }} />
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
            console.log("Button clicked!");
            try {
              onSave();
            } catch (error) {
              console.error("Error in button onClick:", error);
              message.error("Có lỗi xảy ra: " + (error?.message || "Unknown error"));
            }
          }}
          disabled={loading || loadingQcReport}
          loading={saving}
        >
          {existingQcReport ? "Cập nhật QC Report" : "Lưu kết quả QC"}
        </Button>
        {/* Hiển thị nút cập nhật status khi POST_RENTAL và chưa cập nhật */}
        {String(phase || "").toUpperCase() === "POST_RENTAL" && 
         existingQcReport && 
         !deviceStatusUpdated && (
          <Button
            type="default"
            onClick={() => setShowUpdateStatusModal(true)}
            disabled={loading || loadingQcReport || saving}
          >
            Cập nhật status thiết bị
          </Button>
        )}
      </Space>

      {/* Modal cập nhật status thiết bị */}
      <Modal
        title="Cập nhật trạng thái thiết bị"
        open={showUpdateStatusModal}
        onOk={handleUpdateDeviceStatus}
        onCancel={() => {
          setShowUpdateStatusModal(false);
          // Nếu đã lưu QC report thành công, cho phép navigate back
          if (existingQcReport || !saving) {
            setTimeout(() => {
              nav(-1);
            }, 500);
          }
        }}
        okText="Cập nhật"
        cancelText="Bỏ qua"
        okButtonProps={{ loading: updatingDeviceStatus }}
        width={600}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text>
              Sau khi QC POST_RENTAL thành công, bạn cần cập nhật trạng thái các thiết bị để có thể cho thuê lại hoặc xử lý tiếp.
            </Text>
          </div>
          
          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Chọn trạng thái thiết bị <Text type="danger">*</Text>
            </Text>
            <Select
              value={selectedDeviceStatus}
              onChange={setSelectedDeviceStatus}
              style={{ width: "100%" }}
              options={[
                { label: "Có sẵn", value: "AVAILABLE" },
                { label: "Kiểm tra trước thuê", value: "PRE_RENTAL_QC" },
                { label: "Đang thuê", value: "RENTED" },
                { label: "Bảo trì", value: "MAINTENANCE" },
                { label: "Hỏng", value: "BROKEN" },
              ]}
            />
          </div>

          <div>
            <Text strong>Danh sách thiết bị sẽ được cập nhật:</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {Object.values(selectedDevicesByOrderDetail).flat().map((serial, idx) => (
                <li key={idx}>
                  <Text code>{serial}</Text>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
