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
import { getDevicesByModelId, getAvailableDevicesByModel, listDevices } from "../../lib/deviceManage";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getConditionDefinitions } from "../../lib/condition";
import dayjs from "dayjs";

const { Title, Text } = Typography;

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
            
            if (Array.isArray(qcReports) && qcReports.length > 0) {
              const taskIdNum = Number(normalizedTask.taskId || normalizedTask.id);
              const taskIdStr = String(normalizedTask.taskId || normalizedTask.id);
              
              let matchingReport = qcReports.find(r => {
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
              
              if (!matchingReport) {
                matchingReport = qcReports.find(r => String(r.phase || "").toUpperCase() === "PRE_RENTAL");
              }
              
              setExistingQcReport(matchingReport || null);
              
              // Track POST_RENTAL discrepancies (nếu có) để cảnh báo khi update
              const postReportSummary = qcReports.find(r => String(r.phase || "").toUpperCase() === "POST_RENTAL");
              if (postReportSummary) {
                if (Array.isArray(postReportSummary.discrepancies) && postReportSummary.discrepancies.length > 0) {
                  setPostRentalDiscrepancyCount(postReportSummary.discrepancies.length);
                } else if (postReportSummary.qcReportId || postReportSummary.id) {
                  try {
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

  // Fetch devices for each orderDetail based on deviceModelId
  useEffect(() => {
    const fetchDevices = async () => {
      if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
        return;
      }

      try {
        setLoadingDevices(true);
        const devicesMap = {};
        const namesMap = {};

        // Normal flow: fetch devices from API (for PRE_RENTAL or if PRE_RENTAL report not found)
        // Lấy startDate và endDate từ order
        const startDate = order.startDate || order.rentalStartDate;
        const endDate = order.endDate || order.rentalEndDate;
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
              start && end
                ? getAvailableDevicesByModel(deviceModelId, start, end).catch(() => [])
                : getDevicesByModelId(deviceModelId).catch(() => []),
              getDeviceModelById(deviceModelId).catch(() => null),
            ]);

            const name = model?.deviceName || model?.name || null;

            const availableDevices = Array.isArray(devices)
              ? (start && end
                  ? devices
                  : devices.filter((device) => {
                      const status = String(
                        device.status || device.deviceStatus || device.state || ""
                      ).toUpperCase();
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
  }, [order]);

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

  // Allowed results (labels in Vietnamese, values giữ nguyên để gửi API)
  const resultOptions = useMemo(
    () => [
      { label: "Đạt - Sẵn sàng giao hàng", value: "READY_FOR_SHIPPING" },
      { label: "Không đạt - QC trước thuê", value: "PRE_RENTAL_FAILED" },
    ],
    []
  );

  // Load existing QC report data into form when it's available (form fields only)
  useEffect(() => {
    if (existingQcReport) {
      console.log("🔄 Loading existing QC report data into form:", existingQcReport);
      
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
        const deviceSerialMap = new Map(); // deviceSerial -> parsed condition
        
        existingQcReport.deviceConditions.forEach((dc) => {
          const deviceSerial = dc.deviceSerial || String(dc.deviceId || "");
          if (!deviceSerial) return;
          
          // Nếu đã có entry cho deviceSerial này, merge images
          if (deviceSerialMap.has(deviceSerial)) {
            const existing = deviceSerialMap.get(deviceSerial);
            // Merge images từ snapshots mới
            if (Array.isArray(dc.snapshots)) {
              dc.snapshots.forEach((snapshot) => {
                if (Array.isArray(snapshot.images)) {
                  existing.images = [...new Set([...existing.images, ...snapshot.images])];
                }
              });
            }
            return;
          }
          
          // Tìm snapshot đầu tiên có conditionDetails
          let selectedConditionDetail = null;
          const allImages = new Set();
          
          if (Array.isArray(dc.snapshots)) {
            // Ưu tiên snapshot có source là QC_BEFORE hoặc BASELINE
            const qcBeforeSnapshot = dc.snapshots.find(
              (s) => String(s.source || "").toUpperCase() === "QC_BEFORE" ||
                    String(s.snapshotType || "").toUpperCase() === "BASELINE"
            );
            const snapshotToUse = qcBeforeSnapshot || dc.snapshots[0];
            
            if (snapshotToUse) {
              // Lấy conditionDetail đầu tiên
              if (Array.isArray(snapshotToUse.conditionDetails) && snapshotToUse.conditionDetails.length > 0) {
                selectedConditionDetail = snapshotToUse.conditionDetails[0];
              }
              
              // Collect images từ snapshot này
              if (Array.isArray(snapshotToUse.images)) {
                snapshotToUse.images.forEach(img => allImages.add(img));
              }
            }
            
            // Cũng collect images từ các snapshots khác
            dc.snapshots.forEach((snapshot) => {
              if (Array.isArray(snapshot.images)) {
                snapshot.images.forEach(img => allImages.add(img));
              }
            });
          }
          
          // Chỉ tạo entry nếu có conditionDetail
          if (selectedConditionDetail) {
            const parsedCondition = {
              deviceId: deviceSerial, // Use serial number as deviceId
              conditionDefinitionId: selectedConditionDetail.conditionDefinitionId,
              severity: selectedConditionDetail.severity || "NONE",
              images: Array.from(allImages),
            };
            deviceSerialMap.set(deviceSerial, parsedCondition);
            parsedDeviceConditions.push(parsedCondition);
          }
        });
        
        console.log("✅ Parsed device conditions (deduplicated):", parsedDeviceConditions);
        setDeviceConditions(parsedDeviceConditions);
      } else {
        // Reset nếu không có deviceConditions
        setDeviceConditions([]);
      }
    }
  }, [existingQcReport]);

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
    }
  }, [existingQcReport, order]);


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
        // Get all unique deviceModelIds from selected devices
        const modelIds = new Set();
        
        // Collect deviceModelIds from orderDetails that have selected devices
        for (const orderDetail of orderDetails) {
          const orderDetailId = String(orderDetail.orderDetailId || orderDetail.id);
          const serials = selectedDevicesByOrderDetail[orderDetailId] || [];
          
          if (serials.length > 0 && orderDetail.deviceModelId) {
            modelIds.add(Number(orderDetail.deviceModelId));
          }
        }


        // Load condition definitions for all device models
        const allConditions = [];
        for (const modelId of modelIds) {
          try {
            const conditions = await getConditionDefinitions({ deviceModelId: modelId });
            allConditions.push(...conditions);
          } catch (e) {
            console.warn(`Failed to load conditions for model ${modelId}:`, e);
          }
        }

        // Remove duplicates by id
        const uniqueConditions = Array.from(
          new Map(allConditions.map(c => [c.id, c])).values()
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
  }, [orderDetails, selectedDevicesByOrderDetail]);

  // Auto-fill device conditions when condition definitions are loaded and devices are selected
  useEffect(() => {
    // Only auto-fill if:
    // 1. Not loading conditions
    // 2. Have condition definitions
    // 3. Have selected devices
    // 4. No existing QC report OR deviceConditions is empty (to avoid overwriting existing data)
    if (loadingConditions || conditionDefinitions.length === 0) {
      return;
    }

    if (!selectedDevicesByOrderDetail || Object.keys(selectedDevicesByOrderDetail).length === 0) {
      return;
    }

    // Don't auto-fill if there's existing QC report with deviceConditions (to preserve user data)
    if (existingQcReport && deviceConditions.length > 0) {
      return;
    }

    // Build map: deviceModelId -> condition definitions
    const conditionsByModel = {};
    conditionDefinitions.forEach(cond => {
      const modelId = cond.deviceModelId;
      if (modelId) {
        const modelIdNum = Number(modelId);
        if (!conditionsByModel[modelIdNum]) {
          conditionsByModel[modelIdNum] = [];
        }
        conditionsByModel[modelIdNum].push(cond);
      }
    });

    // Build device conditions for each selected device
    const newDeviceConditions = [];
    orderDetails.forEach(orderDetail => {
      const orderDetailId = String(orderDetail.orderDetailId || orderDetail.id);
      const serials = selectedDevicesByOrderDetail[orderDetailId] || [];
      const deviceModelId = Number(orderDetail.deviceModelId);

      if (serials.length > 0 && deviceModelId && conditionsByModel[deviceModelId]) {
        // For each serial number, add all condition definitions for this model
        serials.forEach(serial => {
          conditionsByModel[deviceModelId].forEach(cond => {
            // Check if this condition already exists for this device
            const exists = deviceConditions.some(
              dc => dc.deviceId === String(serial) && dc.conditionDefinitionId === cond.id
            );
            
            if (!exists) {
              newDeviceConditions.push({
                deviceId: String(serial),
                conditionDefinitionId: cond.id,
                severity: "NONE", // Default severity
                images: [],
              });
            }
          });
        });
      }
    });

    // Only update if we have new conditions to add
    if (newDeviceConditions.length > 0) {
      console.log("Auto-filling device conditions:", newDeviceConditions);
      setDeviceConditions(prev => {
        // Check if any of the new conditions already exist to avoid duplicates
        const existingKeys = new Set(
          prev.map(dc => `${dc.deviceId}_${dc.conditionDefinitionId}`)
        );
        const toAdd = newDeviceConditions.filter(
          nc => !existingKeys.has(`${nc.deviceId}_${nc.conditionDefinitionId}`)
        );
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionDefinitions, selectedDevicesByOrderDetail, orderDetails, loadingConditions, existingQcReport]);

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
      if (postRentalDiscrepancyCount > 0) {
        message.warning("QC sau thuê đã ghi nhận sự cố. Việc cập nhật QC trước thuê có thể gặp lỗi, vui lòng phối hợp điều phối viên nếu cần.");
      }
      
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

      // Build deviceConditions payload
      // Need to convert serial numbers to deviceIds
      const allDevices = await listDevices();
      
      // First, convert serial numbers to deviceIds and deduplicate
      const deviceConditionsMap = new Map(); // key: "deviceId_conditionDefinitionId_severity" -> { deviceId, conditionDefinitionId, severity, images: Set }
      
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
          const deviceId = Number(device.deviceId || device.id);
          const conditionDefinitionId = Number(condition.conditionDefinitionId);
          const severity = String(condition.severity);
          
          // Create unique key for deduplication
          const key = `${deviceId}_${conditionDefinitionId}_${severity}`;
          
          if (deviceConditionsMap.has(key)) {
            // Merge images if entry already exists
            const existing = deviceConditionsMap.get(key);
            const newImages = Array.isArray(condition.images) ? condition.images.map(String) : [];
            newImages.forEach(img => existing.images.add(img));
          } else {
            // Create new entry
            const images = new Set(Array.isArray(condition.images) ? condition.images.map(String) : []);
            deviceConditionsMap.set(key, {
              deviceId,
              conditionDefinitionId,
              severity,
              images,
            });
          }
        }
      }
      
      // Convert Map to array
      const deviceConditionsPayload = Array.from(deviceConditionsMap.values()).map(entry => ({
        deviceId: entry.deviceId,
        conditionDefinitionId: entry.conditionDefinitionId,
        severity: entry.severity,
        images: Array.from(entry.images),
      }));

      // Base payload cho PRE_RENTAL
      const basePayload = {
        taskId: Number(actualTaskId),
        orderDetailSerialNumbers,
        result: String(result || "READY_FOR_SHIPPING").toUpperCase(),
        findings: findings.trim(),
        deviceConditions: deviceConditionsPayload,
        accessoryFile: accessorySnapshotFile || null,
      };


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
        
        // Build orderDetailSerialNumbers - ưu tiên lấy từ existing report để giữ nguyên allocations
        let finalOrderDetailSerialNumbers = {};
        if (existingQcReport.orderDetailSerialNumbers && typeof existingQcReport.orderDetailSerialNumbers === "object") {
          Object.keys(existingQcReport.orderDetailSerialNumbers).forEach((orderDetailId) => {
            const serials = existingQcReport.orderDetailSerialNumbers[orderDetailId];
            if (Array.isArray(serials)) {
              finalOrderDetailSerialNumbers[orderDetailId] = serials.map(String);
            }
          });
          console.log("✅ PRE_RENTAL: Using orderDetailSerialNumbers from existing report:", finalOrderDetailSerialNumbers);
        } else if (Array.isArray(existingQcReport.devices) && existingQcReport.devices.length > 0) {
          const devicesByModel = {};
          existingQcReport.devices.forEach((d) => {
            const modelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
            const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
            if (modelId && serial) {
              if (!devicesByModel[modelId]) devicesByModel[modelId] = [];
              devicesByModel[modelId].push(String(serial));
            }
          });
          
          orderDetails.forEach((od) => {
            const orderDetailId = od.orderDetailId || od.id;
            const modelId = Number(od.deviceModelId ?? NaN);
            const quantity = Number(od.quantity ?? 1);
            if (orderDetailId != null && modelId && devicesByModel[modelId]) {
              finalOrderDetailSerialNumbers[orderDetailId] = devicesByModel[modelId].slice(0, quantity).map(String);
            }
          });
          console.log("✅ PRE_RENTAL: Built orderDetailSerialNumbers from devices array:", finalOrderDetailSerialNumbers);
        } else {
          orderDetails.forEach((orderDetail) => {
            const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
            const serialNumbers = selectedDevicesByOrderDetail[String(orderDetailId)] ||
                                  selectedDevicesByOrderDetail[orderDetail.orderDetailId] ||
                                  selectedDevicesByOrderDetail[orderDetail.id] ||
                                  [];
            if (serialNumbers.length > 0) {
              finalOrderDetailSerialNumbers[orderDetailId] = serialNumbers.map(String);
            }
          });
          console.log("⚠️ PRE_RENTAL: Using orderDetailSerialNumbers from selectedDevicesByOrderDetail (fallback):", finalOrderDetailSerialNumbers);
        }
        
        // Nếu vẫn không có, dùng từ basePayload
        if (Object.keys(finalOrderDetailSerialNumbers).length === 0) {
          finalOrderDetailSerialNumbers = basePayload.orderDetailSerialNumbers;
          console.log("⚠️ Using orderDetailSerialNumbers from basePayload:", finalOrderDetailSerialNumbers);
        }
        
        console.log("📦 Final orderDetailSerialNumbers for update:", JSON.stringify(finalOrderDetailSerialNumbers, null, 2));
        
        const updatePayload = {
          orderDetailSerialNumbers: finalOrderDetailSerialNumbers,
          result: basePayload.result,
          findings: basePayload.findings,
          accessoryFile: basePayload.accessoryFile,
          deviceConditions: basePayload.deviceConditions,
        };
        console.log("🔁 updatePreRentalQcReport payload:", JSON.stringify({
          ...updatePayload,
          accessoryFile: updatePayload.accessoryFile ? "(binary)" : null,
        }, null, 2));
        
        await updatePreRentalQcReport(qcReportId, updatePayload);
        
        console.log("Update QC report succeeded");
        toast.success("Đã cập nhật QC report thành công!");
      } else {
        console.log("Calling create QC report...");
        
        console.log("🆕 createPreRentalQcReport payload:", JSON.stringify({
          ...basePayload,
          accessoryFile: basePayload.accessoryFile ? "(binary)" : null,
        }, null, 2));
        const createdReport = await createPreRentalQcReport(basePayload);
        
        console.log("Create QC report succeeded, response:", createdReport);
        toast.success("Đã tạo QC report thành công!");
        
        // Sau khi tạo thành công, load lại QC report để fill vào form
        const newQcReportId = createdReport?.qcReportId || createdReport?.id;
        if (newQcReportId) {
          try {
            console.log("Loading created QC report for editing:", newQcReportId);
            const loadedReport = await getPreRentalQcReportById(newQcReportId);
            
            if (loadedReport) {
              console.log("Loaded QC report:", loadedReport);
              
              // Set existingQcReport để form chuyển sang chế độ update
              setExistingQcReport(loadedReport);
              
              // Parse deviceConditions từ response format sang input format
              if (Array.isArray(loadedReport.deviceConditions) && loadedReport.deviceConditions.length > 0) {
                const parsedDeviceConditions = [];
                const deviceSerialMap = new Map(); // deviceSerial -> parsed condition
                
                loadedReport.deviceConditions.forEach((dc) => {
                  const deviceSerial = dc.deviceSerial || String(dc.deviceId || "");
                  if (!deviceSerial) return;
                  
                  // Nếu đã có entry cho deviceSerial này, merge images
                  if (deviceSerialMap.has(deviceSerial)) {
                    const existing = deviceSerialMap.get(deviceSerial);
                    // Merge images từ snapshots mới
                    if (Array.isArray(dc.snapshots)) {
                      dc.snapshots.forEach((snapshot) => {
                        if (Array.isArray(snapshot.images)) {
                          existing.images = [...new Set([...existing.images, ...snapshot.images])];
                        }
                      });
                    }
                    return;
                  }
                  
                  // Tìm snapshot đầu tiên có conditionDetails
                  let selectedConditionDetail = null;
                  const allImages = new Set();
                  
                  if (Array.isArray(dc.snapshots)) {
                    // Ưu tiên snapshot có source là QC_BEFORE hoặc BASELINE
                    const qcBeforeSnapshot = dc.snapshots.find(
                      (s) => String(s.source || "").toUpperCase() === "QC_BEFORE" ||
                            String(s.snapshotType || "").toUpperCase() === "BASELINE"
                    );
                    const snapshotToUse = qcBeforeSnapshot || dc.snapshots[0];
                    
                    if (snapshotToUse) {
                      // Lấy conditionDetail đầu tiên
                      if (Array.isArray(snapshotToUse.conditionDetails) && snapshotToUse.conditionDetails.length > 0) {
                        selectedConditionDetail = snapshotToUse.conditionDetails[0];
                      }
                      
                      // Collect images từ snapshot này
                      if (Array.isArray(snapshotToUse.images)) {
                        snapshotToUse.images.forEach(img => allImages.add(img));
                      }
                    }
                    
                    // Cũng collect images từ các snapshots khác
                    dc.snapshots.forEach((snapshot) => {
                      if (Array.isArray(snapshot.images)) {
                        snapshot.images.forEach(img => allImages.add(img));
                      }
                    });
                  }
                  
                  // Chỉ tạo entry nếu có conditionDetail
                  if (selectedConditionDetail) {
                    const parsedCondition = {
                      deviceId: deviceSerial, // Use serial number as deviceId
                      conditionDefinitionId: selectedConditionDetail.conditionDefinitionId,
                      severity: selectedConditionDetail.severity || "NONE",
                      images: Array.from(allImages),
                    };
                    deviceSerialMap.set(deviceSerial, parsedCondition);
                    parsedDeviceConditions.push(parsedCondition);
                  }
                });
                
                console.log("Parsed device conditions (deduplicated):", parsedDeviceConditions);
                setDeviceConditions(parsedDeviceConditions);
              }
            }
          } catch (e) {
            console.error("Failed to load created QC report:", e);
            // Không block flow nếu load thất bại
          }
        }
        
        // Sau khi tạo thành công, navigate về trang trước sau một delay ngắn
        message.success("QC report đã được tạo thành công!");
        setTimeout(() => {
          nav(-1);
        }, 1500);
      }
      
      // Nếu là POST_RENTAL và result là READY_FOR_RE_STOCK, hiện modal cập nhật status
      if (existingQcReport && qcReportId) {
        setTimeout(() => {
          nav(-1);
        }, 1500);
      }
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
      <Card title="Thông tin công việc" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã công việc">{task.taskId || task.id}</Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{task.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">{task.taskCategoryName || "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái của công việc">
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
              Chọn thiết bị từ kho
              <Button onClick={autoPick}>Gợi ý đủ số lượng</Button>
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
                        Mẫu thiết bị: {modelNameById[deviceModelId] || `#${deviceModelId}`} • Số lượng: {quantity}
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        {loadingDevices ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <Spin size="small" style={{ marginRight: 4 }} /> Đang tải...
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
                  </Card>
                </Col>
              );
            })}
          </Row>
          {!isPickComplete() && (
            <div style={{ marginTop: 8 }}>
              <Text type="warning">*Vui lòng chọn đủ số lượng thiết bị cho mỗi loại sản phẩm.</Text>
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
                Tình trạng của thiết bị
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
                + Thêm tình trạng thiết bị
              </Button>
            </div>
            
            {deviceConditions.length === 0 ? (
              <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                Chưa có tình trạng nào được thêm. Nhấn nút "Thêm tình trạng thiết bị" để bắt đầu.
              </Text>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                {deviceConditions.map((condition, index) => {
                  // Find device info by serial
                  const deviceInfo = availableDevicesForConditions.find(
                    d => d.serial === condition.deviceId || d.serial === String(condition.deviceId)
                  );
                  
                  // Get deviceModelId from deviceInfo
                  const deviceModelId = deviceInfo?.deviceModelId 
                    ? Number(deviceInfo.deviceModelId) 
                    : null;
                  
                  // Filter conditions by deviceModelId
                  const filteredConditions = deviceModelId
                    ? conditionDefinitions.filter(c => Number(c.deviceModelId) === deviceModelId)
                    : conditionDefinitions;

                  return (
                    <Card
                      key={index}
                      size="small"
                      title={`Tình trạng #${index + 1}`}
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
                              Thiết bị <Text type="danger">*</Text>
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
                              Tình trạng thiết bị <Text type="danger">*</Text>
                            </Text>
                            <Select
                              style={{ width: "100%" }}
                              placeholder="Chọn tình trạng thiết bị"
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
                                { label: "Không có ", value: "NONE" },
                              { label: "Nhẹ ", value: "LOW" },
                              { label: "Trung bình ", value: "MEDIUM" },
                              { label: "Nặng ", value: "HIGH" },
                              { label: "Rất nặng", value: "CRITICAL" },
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
                              onChange={async ({ fileList }) => {
                                const newConditions = [...deviceConditions];
                                const imageUrls = await Promise.all(
                                  fileList.map(async (f) => {
                                    if (f.originFileObj) {
                                      // Convert file thành base64 giống TechnicianHandover
                                      return await fileToBase64(f.originFileObj);
                                    }
                                    // Nếu BE trả về sẵn chuỗi ảnh (URL/base64) thì giữ nguyên
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
      </Space>
    </div>
  );
}
