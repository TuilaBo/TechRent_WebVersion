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
    Tooltip,
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
    UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {

    listTasks,

    getTaskById,

    normalizeTask,

    confirmDelivery,

    confirmRetrieval,

    getDeviceReplacementReportsByTaskId,

    getDeviceReplacementReportById,

    sendDeviceReplacementReportPin,

    signDeviceReplacementReport,

    parseComplaintIdFromDescription,

    uploadDeviceReplacementEvidence,

} from "../../lib/taskApi";

import { getStaffComplaintById, updateComplaintFault, getComplaintByTaskId } from "../../lib/complaints";

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
import { getActiveTaskRules } from "../../lib/taskRulesApi";

import {
    getActiveMaintenanceSchedules,
    getPriorityMaintenanceSchedules,
    getInactiveMaintenanceSchedules,
    getMaintenanceScheduleById,
    updateMaintenanceStatus
} from "../../lib/maintenanceApi";
import {
    buildPrintableReplacementReportHtml,
    elementToPdfBlobReplacement,
} from "../../lib/replacementReportPrintUtils";
import { getDeviceDetail, getConditionDefinitions } from "../../lib/deviceApi";

// Import utilities and PDF generators from extracted component files
import {
    TYPES,
    taskToDisplay,
    fmtStatus,
    fmtDateTime,
    fmtOrderStatus,
    isPreRentalQC,
    isPostRentalQC,
    isPickupTask,
    getMaintenanceBadgeStatus,
    formatDateTime,
    parseInfoString,
    translateRole,
    translateHandoverStatus,
} from "./TechnicianCalendarComponents/TechnicianCalendarUtils";
import {
    elementToPdfBlob,
} from "./TechnicianCalendarComponents/PDFGenerator";
import {
    buildPrintableHandoverReportHtml,
} from "../../lib/handoverReportPrintUtils";
import ReplacementResolveButton from "./TechnicianCalendarComponents/ReplacementResolveButton";
import TechnicianComplaint from "./TechnicianComplaint";


dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { Dragger } = Upload;

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

    const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
    const [selectedMaintenance, setSelectedMaintenance] = useState(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [statusForm] = Form.useForm();
    const [uploadFileList, setUploadFileList] = useState([]);
    const [taskRulesMap, setTaskRulesMap] = useState({}); // { categoryId -> { maxTasksPerDay, name } }
    const [replacementComplaint, setReplacementComplaint] = useState(null); // Complaint data for QC Replace (taskCategoryId === 9)

    // Device Replacement signing states
    const [signingReplacementReport, setSigningReplacementReport] = useState({}); // taskId -> loading
    const [signedReplacementTasks, setSignedReplacementTasks] = useState(new Set()); // Set of taskIds that have been signed

    // Device Replacement PIN Modal states
    const [replacementPinModalOpen, setReplacementPinModalOpen] = useState(false);
    const [replacementPinTask, setReplacementPinTask] = useState(null); // Current task being signed
    const [replacementReportId, setReplacementReportId] = useState(null); // replacementReportId for signing
    const [replacementReportDetails, setReplacementReportDetails] = useState(null); // Full report details for display
    const [replacementPinValue, setReplacementPinValue] = useState(""); // PIN input value
    const [replacementPinSending, setReplacementPinSending] = useState(false); // loading for sending PIN
    const [replacementPinSigning, setReplacementPinSigning] = useState(false); // loading for signing
    const [replacementPinSent, setReplacementPinSent] = useState(false); // PIN has been sent

    // Device Replacement Evidence Upload & Fault Diagnosis states
    const [replacementEvidenceFiles, setReplacementEvidenceFiles] = useState([]); // Selected evidence files
    const [replacementEvidenceUploading, setReplacementEvidenceUploading] = useState(false); // uploading state
    const [replacementEvidenceUploaded, setReplacementEvidenceUploaded] = useState(false); // evidence uploaded to server
    const [replacementFaultSource, setReplacementFaultSource] = useState("UNKNOWN"); // UNKNOWN, RENTAL_DEVICE, CUSTOMER
    const [replacementFaultNote, setReplacementFaultNote] = useState(""); // damage/staff note
    const [replacementFaultUpdating, setReplacementFaultUpdating] = useState(false); // updating fault source
    const [replacementFaultUpdated, setReplacementFaultUpdated] = useState(false); // fault has been updated
    const [replacementComplaintId, setReplacementComplaintId] = useState(null); // complaint ID for fault update
    const [replacementFaultConditionIds, setReplacementFaultConditionIds] = useState([]); // Selected condition definition IDs
    const [replacementDeviceModelId, setReplacementDeviceModelId] = useState(null); // Model ID of the old device
    const [faultConditionOptions, setFaultConditionOptions] = useState([]); // Options for condition definitions

    /** Kiểm tra task có phải là Device Replacement (taskCategoryId = 8) */
    const isDeviceReplacementTask = useCallback((task) => {
        if (!task) return false;
        const categoryId = task.taskCategoryId ?? task.categoryId;
        const categoryName = String(task.taskCategoryName || "").toUpperCase();
        const title = String(task.title || "").toUpperCase();

        // Handle string/number comparison for ID
        // Also check title for keywords as fallback
        return Number(categoryId) === 8 ||
            categoryName.includes("DEVICE REPLACEMENT") ||
            categoryName.includes("THAY THẾ") ||
            title.includes("THAY THẾ") ||
            title.includes("REPLACEMENT");
    }, []);

    /** Kiểm tra task có phải là Delivery thông thường (taskCategoryId = 4, không phải Device Replacement) */
    const isRegularDeliveryTask = useCallback((task) => {
        if (!task) return false;
        const categoryId = task.taskCategoryId ?? task.categoryId;
        const type = String(task.type || "").toUpperCase();
        const categoryName = String(task.taskCategoryName || "").toUpperCase();
        // Phải là Delivery (categoryId=4 hoặc type/name chứa DELIVERY/GIAO) VÀ không phải Device Replacement
        const isDelivery = categoryId === 4 ||
            type === "DELIVERY" ||
            categoryName.includes("DELIVERY") ||
            categoryName.includes("GIAO");
        return isDelivery && !isDeviceReplacementTask(task);
    }, [isDeviceReplacementTask]);

    // Load condition definitions if faultSource is CUSTOMER
    useEffect(() => {
        const fetchConditions = async () => {
            console.log("[STEP1_DEBUG] fetchConditions Triggered", {
                replacementFaultSource,
                hasReport: !!replacementReportDetails,
                currentModelId: replacementDeviceModelId
            });

            if (!replacementReportDetails || !replacementReportDetails.items) {
                console.log("[STEP1_DEBUG] No details or items");
                return;
            }

            // Tìm thiết bị cũ
            const oldItem = replacementReportDetails.items.find(i => i.isOldDevice);
            console.log("[STEP1_DEBUG] Old item found:", oldItem);

            if (!oldItem) {
                console.warn("[STEP1_DEBUG] No old device item found in report");
                return;
            }

            try {
                // 1. Lấy deviceModelId
                let modelId = replacementDeviceModelId;

                // Try from existing state first, then oldItem, then API
                if (!modelId) {
                    modelId = oldItem.deviceModelId; // Check if already in item
                    console.log("[STEP1_DEBUG] Checked oldItem for modelId:", modelId);
                }

                if (!modelId && oldItem.deviceId) {
                    console.log("[STEP1_DEBUG] Fetching detail for deviceId:", oldItem.deviceId);
                    try {
                        const deviceDetail = await getDeviceDetail(oldItem.deviceId);
                        console.log("[STEP1_DEBUG] API deviceDetail:", deviceDetail);

                        // Extract model ID from various possible fields
                        modelId = deviceDetail?.deviceModelId ||
                            deviceDetail?.deviceModel?.id ||
                            deviceDetail?.modelId;

                        console.log("[STEP1_DEBUG] Extracted modelId from API:", modelId);
                    } catch (err) {
                        console.error("[STEP1_DEBUG] API getDeviceDetail failed:", err);
                    }
                }

                if (modelId) {
                    if (modelId !== replacementDeviceModelId) {
                        console.log("[STEP1_DEBUG] Setting replacementDeviceModelId:", modelId);
                        setReplacementDeviceModelId(modelId);
                    }

                    console.log("[STEP1_DEBUG] Fetching conditions for modelId:", modelId);
                    const conditions = await getConditionDefinitions(modelId);
                    console.log("[STEP1_DEBUG] Conditions API response:", conditions);

                    if (Array.isArray(conditions)) {
                        const options = conditions.map(c => ({
                            label: c.name,
                            value: c.conditionDefinitionId
                        }));
                        console.log("[STEP1_DEBUG] Setting options:", options);
                        setFaultConditionOptions(options);
                    } else {
                        console.warn("[STEP1_DEBUG] Conditions data is not an array");
                        setFaultConditionOptions([]);
                    }
                } else {
                    console.warn("[STEP1_DEBUG] Could not determine deviceModelId");
                }
            } catch (error) {
                console.error("[STEP1_DEBUG] General error in fetchConditions:", error);
            }
        };

        if (replacementFaultSource === "CUSTOMER") {
            fetchConditions();
        }
    }, [replacementReportDetails, replacementFaultSource, replacementDeviceModelId]);

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

    /**
     * Hàm xem chi tiết lịch bảo trì
     * Được gọi khi: Click vào 1 maintenance schedule trong danh sách
     * @param {number} id - ID của maintenance schedule
     */
    const viewMaintenanceDetail = async (id) => {
        if (!id) return;
        try {
            // API: GET /api/maintenance/{id}
            // Trả về: { id, deviceId, scheduledDate, priority, status, notes... }
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


    /**
     * Hàm xem chi tiết đơn hàng
     * Được gọi khi: Click vào task có liên kết orderId
     * Luồng: Load order → Enrich với device model info → Load customer
     * @param {number} oid - Order ID
     */
    const viewOrderDetail = async (oid) => {
        if (!oid) return;
        try {
            // ========== BƯỚC 1: LẤY THÔNG TIN ĐƠN HÀNG ==========
            // API: GET /api/rental-orders/{orderId}
            // Trả về: { orderId, orderDetails[], customerId, startDate, endDate... }
            const od = await getRentalOrderById(oid);
            let enriched = od || null;

            // ========== BƯỚC 2: LẤY THÔNG TIN DEVICE MODEL ==========
            // Attach device model info for each order detail
            if (enriched && Array.isArray(enriched.orderDetails) && enriched.orderDetails.length) {
                const ids = Array.from(new Set(enriched.orderDetails.map((d) => d.deviceModelId).filter(Boolean)));
                // API: GET /api/device-models/{modelId} cho mỗi modelId
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

            // ========== BƯỚC 3: LẤY THÔNG TIN KHÁCH HÀNG ==========
            const cid = od?.customerId;
            if (cid) {
                try {
                    // API: GET /api/customers/{customerId}
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

    /**
     * Hàm tải toàn bộ dữ liệu cho calendar (Tasks + Maintenance Schedules + Task Rules)
     * Được gọi khi: Component mount, reload data
     * Luồng phức tạp:
     * 1. Load tasks của technician
     * 2. Load 3 loại maintenance schedules (active, priority, inactive)
     * 3. Load task category stats để hiển thị giới hạn công việc
     */
    const loadTasks = useCallback(async () => {
        setLoading(true);
        let allTasksRaw = [];

        try {
            // ========== BƯỚC 1: LOAD TASKS ==========
            // API: GET /api/staff/tasks?size=1000
            // Backend tự filter theo technician từ JWT token
            // Trả về: paginated response hoặc array
            const tasksRes = await listTasks({ size: 1000 }); // Get all tasks for calendar

            // Handle paginated response
            if (tasksRes && typeof tasksRes === 'object' && Array.isArray(tasksRes.content)) {
                allTasksRaw = tasksRes.content;
            } else {
                allTasksRaw = Array.isArray(tasksRes) ? tasksRes : [];
            }
        } catch (e) {
            console.error("Failed to load tasks:", e);
            toast.error("Không thể tải danh sách công việc");
        }

        // ========== BƯỚC 2: LOAD MAINTENANCE SCHEDULES ==========
        let activeRes = { data: [] };
        let priorityRes = { data: [] };
        let inactiveRes = { data: [] };

        try {
            // Gọi 3 API song song với Promise.allSettled (không fail nếu 1 API lỗi)
            const results = await Promise.allSettled([
                // API: GET /api/maintenance/active
                getActiveMaintenanceSchedules(),
                // API: GET /api/maintenance/priority
                getPriorityMaintenanceSchedules(),
                // API: GET /api/maintenance/inactive
                getInactiveMaintenanceSchedules(),
            ]);

            if (results[0].status === 'fulfilled') activeRes = results[0].value || { data: [] };
            else console.warn("Failed active maintenance:", results[0].reason);

            if (results[1].status === 'fulfilled') priorityRes = results[1].value || { data: [] };
            else console.warn("Failed priority maintenance:", results[1].reason);

            if (results[2].status === 'fulfilled') inactiveRes = results[2].value || { data: [] };
            else console.warn("Failed inactive maintenance:", results[2].reason);

            // ========== BƯỚC 3: LOAD TASK RULES ==========
            // Load giới hạn công việc cho từng category từ API task-rules
            // Giống cách OperatorTasks lấy dữ liệu
            try {
                console.log("DEBUG: Calling getActiveTaskRules API...");

                // API: GET /api/admin/task-rules/active
                // Trả về: Array of { taskRuleId, taskCategoryId, taskCategoryName, maxTasksPerDay, staffRole, ... }
                const allRules = await getActiveTaskRules();
                console.log("DEBUG: All active task rules:", allRules);

                // Lấy rules áp dụng cho TECHNICIAN
                // staffRole === null có nghĩa là áp dụng cho TẤT CẢ roles
                // staffRole === 'TECHNICIAN' chỉ áp dụng cho TECHNICIAN
                const applicableRules = Array.isArray(allRules)
                    ? allRules.filter(r => r.staffRole === null || r.staffRole === 'TECHNICIAN')
                    : [];
                console.log("DEBUG: Applicable rules for TECHNICIAN:", applicableRules);

                const rulesMap = {};

                // Build map: categoryId -> { maxTasksPerDay, name }
                applicableRules.forEach(rule => {
                    const categoryId = rule.taskCategoryId;
                    if (categoryId != null) {
                        rulesMap[categoryId] = {
                            maxTasksPerDay: rule.maxTasksPerDay || 0,
                            name: rule.taskCategoryName || rule.name || `Category ${categoryId}`,
                            taskRuleId: rule.taskRuleId || rule.id
                        };
                    }
                });

                console.log("DEBUG: taskRulesMap built from getActiveTaskRules:", rulesMap);
                setTaskRulesMap(rulesMap);
            } catch (e) {
                console.warn("Failed to load task rules:", e);
                console.warn("Error status:", e?.response?.status);
                console.warn("Error message:", e?.response?.data?.message || e?.message);

                // Fallback: Try getStaffCategoryStats as backup
                console.log("DEBUG: Trying getStaffCategoryStats as fallback...");
                try {
                    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                    const staffId = currentUser.staffId || currentUser.id;

                    if (staffId) {
                        const rulesMap = {};
                        const categoryIds = [1, 2, 4, 6];

                        await Promise.all(categoryIds.map(async (categoryId) => {
                            try {
                                const stats = await getStaffCategoryStats(staffId, categoryId);
                                if (stats && stats.maxTasksPerDay !== undefined) {
                                    rulesMap[categoryId] = {
                                        maxTasksPerDay: stats.maxTasksPerDay,
                                        name: stats.taskCategoryName || `Category ${categoryId}`,
                                    };
                                }
                            } catch (err) {
                                console.warn(`Failed to load stats for category ${categoryId}:`, err);
                            }
                        }));

                        if (Object.keys(rulesMap).length > 0) {
                            console.log("DEBUG: taskRulesMap from getStaffCategoryStats:", rulesMap);
                            setTaskRulesMap(rulesMap);
                            return;
                        }
                    }
                } catch (innerE) {
                    console.warn("getStaffCategoryStats fallback also failed:", innerE);
                }

                // Final fallback: No rules (show no limit cards)
                console.log("DEBUG: No task rules available, showing empty");
                setTaskRulesMap({});
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

            // Check if it is a Replacement Report
            if (report.replacementReportId) {
                if (printRef.current) {
                    printRef.current.style.visibility = "visible";
                    printRef.current.style.opacity = "1";
                    printRef.current.style.left = "-99999px";
                    printRef.current.style.top = "-99999px";
                    printRef.current.style.width = "794px";
                    printRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";

                    printRef.current.innerHTML = buildPrintableReplacementReportHtml(report);

                    // Ensure fonts are applied
                    const allElements = printRef.current.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.style) {
                            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
                            el.style.webkitFontSmoothing = "antialiased";
                            el.style.mozOsxFontSmoothing = "grayscale";
                        }
                    });

                    printRef.current.offsetHeight; // Force reflow

                    if (document.fonts && document.fonts.ready) {
                        await document.fonts.ready;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const blob = await elementToPdfBlobReplacement(printRef.current);

                    printRef.current.style.visibility = "hidden";
                    printRef.current.style.opacity = "0";

                    const url = URL.createObjectURL(blob);
                    setPdfBlobUrl(url);
                    setPdfModalOpen(true);
                }
                setPdfGenerating(false);
                return;
            }

            // EXISTING LOGIC FOR HANDOVER REPORT
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

            // Check if it is a Replacement Report
            if (report.replacementReportId) {
                if (printRef.current) {
                    printRef.current.style.visibility = "visible";
                    printRef.current.style.opacity = "1";
                    printRef.current.style.left = "-99999px";
                    printRef.current.style.top = "-99999px";
                    printRef.current.style.width = "794px";
                    printRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";

                    printRef.current.innerHTML = buildPrintableReplacementReportHtml(report);

                    const allElements = printRef.current.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.style) {
                            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
                            el.style.webkitFontSmoothing = "antialiased";
                            el.style.mozOsxFontSmoothing = "grayscale";
                        }
                    });

                    printRef.current.offsetHeight;

                    if (document.fonts && document.fonts.ready) {
                        await document.fonts.ready;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const blob = await elementToPdfBlobReplacement(printRef.current);

                    printRef.current.style.visibility = "hidden";
                    printRef.current.style.opacity = "0";

                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `replacement-report-${report.replacementReportId || report.id || "report"}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(a.href), 0);
                }
                setPdfGenerating(false);
                return;
            }


            // EXISTING LOGIC FOR HANDOVER REPORT
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

    // Helpers to fetch and act for Replacement Report
    const handleFetchAndPreviewReplacementPdf = useCallback(async (task) => {
        const taskId = task.taskId || task.id;
        try {
            const reports = await getDeviceReplacementReportsByTaskId(taskId);
            if (!reports || reports.length === 0) {
                toast.error("Không tìm thấy biên bản thay thế cho task này");
                return;
            }
            handlePreviewPdf(reports[0]);
        } catch (e) {
            toast.error("Lỗi khi tải biên bản thay thế");
        }
    }, [handlePreviewPdf]);

    const handleFetchAndDownloadReplacementPdf = useCallback(async (task) => {
        const taskId = task.taskId || task.id;
        try {
            const reports = await getDeviceReplacementReportsByTaskId(taskId);
            if (!reports || reports.length === 0) {
                toast.error("Không tìm thấy biên bản thay thế cho task này");
                return;
            }
            handleDownloadPdf(reports[0]);
        } catch (e) {
            toast.error("Lỗi khi tải biên bản thay thế");
        }
    }, [handleDownloadPdf]);

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

                    // Load replacement complaint for QC Replace tasks (taskCategoryId === 9)
                    const taskCategoryId = normalized.taskCategoryId || task.taskCategoryId;
                    if (taskCategoryId === 9) {
                        try {
                            const complaint = await getComplaintByTaskId(taskIdToUse);
                            setReplacementComplaint(complaint);
                            console.log("DEBUG QC Replace: Loaded replacement complaint =", complaint);
                        } catch (e) {
                            console.warn("Could not load replacement complaint for QC Replace task:", e);
                            setReplacementComplaint(null);
                        }
                    } else {
                        setReplacementComplaint(null);
                    }

                    // Load replacement report details for Device Replacement tasks
                    if (isDeviceReplacementTask(normalized)) {
                        try {
                            const reports = await getDeviceReplacementReportsByTaskId(taskIdToUse);
                            if (reports && reports.length > 0) {
                                setReplacementReportDetails(reports[0]);
                                console.log("DEBUG Replacement: Loaded replacement report =", reports[0]);
                            } else {
                                setReplacementReportDetails(null);
                            }
                        } catch (e) {
                            console.warn("Could not load replacement report details:", e);
                            setReplacementReportDetails(null);
                        }
                    } else {
                        setReplacementReportDetails(null);
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

    // Ký biên bản thay thế thiết bị (Device Replacement) - Mở modal
    const handleSignReplacementReport = useCallback(async (task) => {
        const taskId = task.taskId || task.id;

        try {
            setSigningReplacementReport((prev) => ({ ...prev, [taskId]: true }));

            // Fetch replacement reports by taskId directly
            const reports = await getDeviceReplacementReportsByTaskId(taskId);

            if (!reports || reports.length === 0) {
                toast.error("Chưa có biên bản thay thế thiết bị cho task này. Vui lòng đợi hệ thống tạo biên bản.");
                return;
            }

            // Get the first (and usually only) report for this task
            const report = reports[0];
            const reportId = report.replacementReportId;

            if (!reportId) {
                toast.error("Không tìm thấy ID biên bản. Vui lòng liên hệ quản trị viên.");
                return;
            }

            // Check if already signed by staff
            if (report.staffSigned) {
                toast("Biên bản này đã được ký bởi nhân viên.", { icon: "ℹ️" });
                // Still show modal for viewing
            }

            // Fetch complaint ID using taskId directly (new API)
            let complaintId = null;
            try {
                const complaint = await getComplaintByTaskId(taskId);
                if (complaint) {
                    complaintId = complaint.complaintId || complaint.id;
                    console.log("DEBUG: Found complaint via taskId:", taskId, "=>", complaint);
                } else {
                    console.log("DEBUG: No complaint found for taskId:", taskId);
                }
            } catch (complaintError) {
                console.warn("Could not fetch complaint by taskId:", complaintError);
            }

            // Store info and open modal
            setReplacementPinTask(task);
            setReplacementReportId(reportId);
            setReplacementReportDetails(report);
            setReplacementPinValue("");
            setReplacementPinSent(false);

            // Reset evidence and fault states
            setReplacementEvidenceFiles([]);
            setReplacementEvidenceUploaded(false);
            setReplacementFaultSource("UNKNOWN");
            setReplacementFaultNote("");
            setReplacementFaultUpdated(false);
            setReplacementComplaintId(complaintId);

            setReplacementPinModalOpen(true);
        } catch (error) {
            toast.error(error?.response?.data?.message || error?.message || "Không thể tải biên bản thay thế thiết bị");
        } finally {
            setSigningReplacementReport((prev) => ({ ...prev, [taskId]: false }));
        }
    }, [detailTask]);

    // Gửi mã PIN xác nhận cho Device Replacement
    const handleSendReplacementPin = useCallback(async () => {
        if (!replacementReportId) {
            toast.error("Không tìm thấy biên bản để gửi PIN.");
            return;
        }

        try {
            setReplacementPinSending(true);
            await sendDeviceReplacementReportPin(replacementReportId);
            toast.success("Đã gửi mã PIN xác nhận đến email!");
            setReplacementPinSent(true);
        } catch (error) {
            toast.error(error?.response?.data?.message || error?.message || "Không thể gửi mã PIN");
        } finally {
            setReplacementPinSending(false);
        }
    }, [replacementReportId]);

    // Upload bằng chứng cho thiết bị cũ (trước khi ký biên bản)
    const handleUploadReplacementEvidence = useCallback(async () => {
        if (!replacementReportId || !replacementReportDetails) {
            toast.error("Không tìm thấy biên bản để upload bằng chứng.");
            return;
        }

        if (replacementEvidenceFiles.length === 0) {
            toast.error("Vui lòng chọn ít nhất một ảnh bằng chứng.");
            return;
        }

        // Find the old device from report items
        const oldDevice = replacementReportDetails.items?.find(item => item.isOldDevice);
        if (!oldDevice || !oldDevice.deviceId) {
            toast.error("Không tìm thấy thông tin thiết bị cũ trong biên bản.");
            return;
        }

        try {
            setReplacementEvidenceUploading(true);
            await uploadDeviceReplacementEvidence(
                replacementReportId,
                oldDevice.deviceId,
                replacementEvidenceFiles
            );
            toast.success("Đã upload bằng chứng thành công!");
            setReplacementEvidenceUploaded(true);
        } catch (error) {
            toast.error(error?.response?.data?.message || error?.message || "Không thể upload bằng chứng");
        } finally {
            setReplacementEvidenceUploading(false);
        }
    }, [replacementReportId, replacementReportDetails, replacementEvidenceFiles]);

    // Chuẩn đoán nguồn lỗi (RENTAL_DEVICE, CUSTOMER, UNKNOWN)
    const handleUpdateReplacementFault = useCallback(async () => {
        if (!replacementComplaintId) {
            toast.error("Không tìm thấy ID khiếu nại để cập nhật nguồn lỗi.");
            return;
        }

        try {
            setReplacementFaultUpdating(true);
            await updateComplaintFault(replacementComplaintId, {
                faultSource: replacementFaultSource,
                conditionDefinitionIds: replacementFaultSource === "CUSTOMER" ? replacementFaultConditionIds : [],
                staffNote: replacementFaultNote || undefined,
                damageNote: replacementFaultNote || undefined,
            });
            toast.success("Đã cập nhật nguồn lỗi thành công!");
            setReplacementFaultUpdated(true);
        } catch (error) {
            toast.error(error?.response?.data?.message || error?.message || "Không thể cập nhật nguồn lỗi");
        } finally {
            setReplacementFaultUpdating(false);
        }
    }, [replacementComplaintId, replacementFaultSource, replacementFaultNote]);


    // Ký biên bản với mã PIN
    const handleSubmitReplacementSignature = useCallback(async () => {
        if (!replacementReportId) {
            toast.error("Không tìm thấy biên bản để ký.");
            return;
        }

        if (!replacementPinValue.trim()) {
            toast.error("Vui lòng nhập mã PIN.");
            return;
        }

        const taskId = replacementPinTask?.taskId || replacementPinTask?.id;

        try {
            setReplacementPinSigning(true);

            // Get technician signature (username or full name)
            const user = window.localStorage.getItem("auth") ? JSON.parse(window.localStorage.getItem("auth"))?.state?.user : null;
            const signature = user?.fullName || user?.username || user?.name || "Technician";

            await signDeviceReplacementReport(replacementReportId, {
                pin: replacementPinValue.trim(),
                signature: signature,
            });

            toast.success("Đã ký biên bản thay thế thiết bị thành công!");

            // Close modal and reset
            setReplacementPinModalOpen(false);
            setReplacementPinTask(null);
            setReplacementReportId(null);
            setReplacementPinValue("");
            setReplacementPinSent(false);

            // Mark task as signed
            if (taskId) {
                const key = String(taskId);
                setSignedReplacementTasks((prev) => new Set([...prev, key]));
            }

            // Reload tasks
            await loadTasks();

            // Reload detail task if open
            if (detailTask && taskId && (detailTask.taskId === taskId || detailTask.id === taskId)) {
                const full = await getTaskById(taskId);
                if (full) {
                    setDetailTask(normalizeTask(full));
                }
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || error?.message || "Không thể ký biên bản");
        } finally {
            setReplacementPinSigning(false);
        }
    }, [replacementReportId, replacementPinValue, replacementPinTask, loadTasks, detailTask]);

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
                render: (_, r) => {
                    // Ưu tiên: taskCategoryName > title mapping > type mapping > type raw
                    if (r.taskCategoryName) return r.taskCategoryName;

                    // Nếu không có taskCategoryName, thử map từ taskCategoryId
                    const categoryId = r.taskCategoryId ?? r.categoryId;
                    const categoryMap = {
                        1: "Pre rental QC",
                        2: "Post rental QC",
                        4: "Delivery",
                        6: "Pick up Rental Order",
                        8: "Device Replacement",
                        9: "Pre rental QC Replace",
                    };
                    if (categoryId && categoryMap[categoryId]) return categoryMap[categoryId];

                    // Fallback: dùng TYPES mapping hoặc type raw
                    return TYPES[r.type]?.label || r.type || "—";
                },
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
                        {/* Device Replacement task (taskCategoryId = 8) - Hiển thị nút Ký biên bản thay thế thiết bị */}
                        {isDeviceReplacementTask(r) && (() => {
                            const taskId = r.taskId || r.id;
                            const status = String(r.status || "").toUpperCase();
                            const isCompleted = status === "COMPLETED";
                            const isInProgress = status === "IN_PROGRESS";
                            const taskKey = String(taskId);
                            const isSigned = signedReplacementTasks.has(taskKey);
                            const isLoading = signingReplacementReport[taskId];
                            const isConfirmed = confirmedTasks.has(taskKey);
                            const isConfirmLoading = confirmingDelivery[taskId];

                            return (
                                <>
                                    {/* Hiển thị nút Xác nhận giao hàng khi task chưa IN_PROGRESS và chưa COMPLETED */}
                                    {!isCompleted && !isInProgress && !isConfirmed && (
                                        <Button
                                            size="small"
                                            type="default"
                                            loading={isConfirmLoading}
                                            onClick={() => handleConfirmDelivery(taskId)}
                                        >
                                            Xác nhận giao hàng
                                        </Button>
                                    )}
                                    {/* Hiển thị nút Ký biên bản thay thế thiết bị khi task IN_PROGRESS và chưa ký */}
                                    {isInProgress && !isSigned && !isCompleted && (
                                        <Button
                                            size="small"
                                            type="primary"
                                            icon={<FileTextOutlined />}
                                            loading={isLoading}
                                            onClick={() => handleSignReplacementReport(r)}
                                        >
                                            Ký biên bản thay thế thiết bị
                                        </Button>
                                    )}
                                    {isSigned && !isCompleted && (
                                        <Tag color="green">Đã gửi PIN xác nhận</Tag>
                                    )}
                                </>
                            );
                        })()}
                        {/* Regular Delivery task (taskCategoryId = 4) - Hiển thị các nút Tạo biên bản bàn giao, Xác nhận giao hàng */}
                        {isRegularDeliveryTask(r) && (() => {
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
                            const hasCheckoutReportForTask = Boolean(reportForTask);

                            return (
                                <>
                                    {/* Chỉ hiển thị nút "Tạo biên bản bàn giao" khi không phải PENDING, không phải COMPLETED và chưa có handover report */}
                                    {!isPending && !isCompleted && !hasCheckoutReportForTask && (
                                        <Button
                                            size="small"
                                            type="primary"
                                            icon={<FileTextOutlined />}
                                            onClick={() => {
                                                navigate(`/technician/tasks/handover/${taskId}`, { state: { task: r } });
                                            }}
                                        >
                                            Tạo biên bản bàn giao
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
                                    {reportForTask && (
                                        <>
                                            <Button
                                                size="small"
                                                type="primary"
                                                icon={<EditOutlined />}
                                                onClick={() => {
                                                    navigate(`/technician/tasks/handover/${taskId}`, {
                                                        state: { task: r, handoverReport: reportForTask },
                                                    });
                                                }}
                                            >
                                                Cập nhật biên bản
                                            </Button>
                                        </>
                                    )}

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
                                    {hasCheckinReport && (
                                        <>
                                            <Button
                                                size="small"
                                                type="primary"
                                                icon={<EditOutlined />}
                                                onClick={() => {
                                                    navigate(`/technician/tasks/handover-checkin/${taskId}`, {
                                                        state: { task: r, handoverReport: fallbackCheckinReport },
                                                    });
                                                }}
                                            >
                                                Cập nhật biên bản
                                            </Button>
                                        </>
                                    )}
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
            isDeviceReplacementTask,
            isRegularDeliveryTask,
            signingReplacementReport,
            signedReplacementTasks,
            handleSignReplacementReport,
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

        // Check if this is a QC Replace task (taskCategoryId === 9)
        const isQcReplaceTask = t.taskCategoryId === 9 || t.taskCategoryName === 'Pre rental QC Replace';

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

                </Descriptions>

                {/* QC Replace Task: Show replacement device from complaint */}
                {isQcReplaceTask && replacementComplaint ? (
                    <>
                        <Divider />
                        <Title level={5} style={{ marginTop: 0 }}>
                            <Tag color="magenta">🔄 Thiết bị thay thế (QC Replace)</Tag>
                        </Title>
                        <Descriptions bordered size="small" column={1}>
                            <Descriptions.Item label="Mã thiết bị thay thế">
                                #{replacementComplaint.replacementDeviceId || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Serial Number">
                                <Tag color="blue">{replacementComplaint.replacementDeviceSerialNumber || "—"}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Model gốc">
                                {replacementComplaint.deviceModelName || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Thiết bị gốc (hỏng)">
                                #{replacementComplaint.deviceId || "—"} - SN: {replacementComplaint.deviceSerialNumber || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mã khiếu nại">
                                #{replacementComplaint.complaintId || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mô tả khách hàng">
                                {replacementComplaint.customerDescription || "—"}
                            </Descriptions.Item>
                        </Descriptions>
                    </>
                ) : isQcReplaceTask && !replacementComplaint ? (
                    <>
                        <Divider />
                        <Title level={5} style={{ marginTop: 0 }}>
                            <Tag color="magenta">🔄 Thiết bị thay thế (QC Replace)</Tag>
                        </Title>
                        <Tag color="orange">Đang tải thông tin thiết bị thay thế...</Tag>
                    </>
                ) : (
                    /* Regular tasks: Show order devices */
                    Array.isArray(orderDetail.orderDetails) && orderDetail.orderDetails.length > 0 && (
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
                    )
                )}
            </>
        );
    };

    // --- PDF Handlers for Replacement Reports ---
    const handleFetchAndPreviewReplacementPdfById = async (reportId) => {
        try {
            const report = await getDeviceReplacementReportById(reportId);
            const html = buildPrintableReplacementReportHtml(report);
            setPdfPreviewContent(html);
            setPdfPreviewOpen(true);
        } catch (error) {
            console.error("Error fetching replacement report for PDF:", error);
            message.error("Không thể tải biên bản thay thế để xem trước");
        }
    };

    const handleFetchAndDownloadReplacementPdfById = async (reportId) => {
        try {
            message.loading({ content: "Đang tạo PDF...", key: "pdf_gen" });
            const report = await getDeviceReplacementReportById(reportId);
            const html = buildPrintableReplacementReportHtml(report);

            // Create a temporary container
            const container = document.createElement("div");
            container.innerHTML = html;
            container.style.position = "absolute";
            container.style.left = "-9999px";
            container.style.top = "0";
            container.style.width = "800px"; // Fixed width for A4-like
            document.body.appendChild(container);

            const blob = await elementToPdfBlobReplacement(container);
            document.body.removeChild(container);

            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `BienBanThayThe_${reportId}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                message.success({ content: "Tải PDF thành công!", key: "pdf_gen" });
            } else {
                message.error({ content: "Lỗi tạo PDF blob", key: "pdf_gen" });
            }
        } catch (error) {
            console.error("Error downloading replacement PDF:", error);
            message.error({ content: "Lỗi tải PDF biên bản thay thế", key: "pdf_gen" });
        }
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

        if (t.type === "QC" || isPreRentalQC(t) || isPostRentalQC(t)) {
            return (
                <>
                    {header}
                    <Divider />
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Mã đơn hàng">{t.orderId || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                            {t.status ? (() => {
                                const { bg, text } = getTechnicianStatusColor(t.status);
                                return (
                                    <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
                                );
                            })() : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Hạn chót">
                            {fmtDateTime(t.deadline || t.plannedEnd)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.category || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Mô tả">{t.description || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Thời gian bắt đầu nhiệm vụ">
                            {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Thời gian kết thúc nhiệm vụ">
                            {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                        </Descriptions.Item>
                        {isCompletedQC && (
                            <Descriptions.Item label="Thời gian hoàn thành nhiệm vụ">
                                {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                            </Descriptions.Item>
                        )}
                    </Descriptions>

                    {/* Order, Customer, and Device Details Section */}
                    {renderOrderCustomerDeviceDetails(t)}

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
                        {isPostRentalQC(t) && (() => {
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
                                        navigate(`/technician/tasks/post-rental-qc/${taskId}`, { state: { task: t } });
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

        // Check if this is a Device Replacement task (taskCategoryId = 8)
        if (isDeviceReplacementTask(t)) {
            const taskId = t.taskId || t.id;
            const status = String(t.status || "").toUpperCase();
            const isCompleted = status === "COMPLETED";
            const isInProgress = status === "IN_PROGRESS";
            const taskKey = String(taskId);
            const isSigned = signedReplacementTasks.has(taskKey);
            const isLoading = signingReplacementReport[taskId];
            const isConfirmed = confirmedTasks.has(taskKey);
            const isConfirmLoading = confirmingDelivery[taskId];

            return (
                <>
                    {header}
                    <Divider />
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.type || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                            {t.status ? (() => {
                                const { bg, text } = getTechnicianStatusColor(t.status);
                                return (
                                    <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
                                );
                            })() : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Mã đơn">{t.orderId || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Mô tả">{t.title || t.description || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Thời gian bắt đầu nhiệm vụ">
                            {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Thời gian kết thúc nhiệm vụ">
                            {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                        </Descriptions.Item>
                        {isCompleted && (
                            <Descriptions.Item label="Thời gian hoàn thành nhiệm vụ">
                                {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                            </Descriptions.Item>
                        )}
                        <Descriptions.Item label="Trạng thái biên bản">
                            {replacementReportDetails && replacementReportDetails.status === "BOTH_SIGNED" ? (
                                <Tag color="green">Đã hoàn tất ký</Tag>

                            ) : replacementReportDetails && replacementReportDetails.staffSigned ? (
                                <Tag color="cyan">Nhân viên đã ký</Tag>
                            ) : (
                                <Tag color="orange">Chưa hoàn tất</Tag>
                            )}
                        </Descriptions.Item>
                    </Descriptions>

                    {/* PDF Action Buttons for Replacement Task - Show if report exists (e.g. staff signed) */}
                    {replacementReportDetails && replacementReportDetails.staffSigned && (
                        <div style={{ marginTop: 16 }}>
                            <Space>
                                <Button
                                    icon={<EyeOutlined />}
                                    onClick={() => handleFetchAndPreviewReplacementPdfById(replacementReportDetails.replacementReportId)}
                                >
                                    Xem PDF
                                </Button>
                                <Button
                                    icon={<DownloadOutlined />}
                                    onClick={() => handleFetchAndDownloadReplacementPdfById(replacementReportDetails.replacementReportId)}
                                >
                                    Tải PDF
                                </Button>
                            </Space>
                        </div>
                    )}
                    {orderDetail && renderOrderCustomerDeviceDetails(t)
                    }
                    <Divider />
                    <Space wrap>
                        {/* Hiển thị nút Xác nhận giao hàng khi task chưa IN_PROGRESS và chưa COMPLETED */}
                        {!isCompleted && !isInProgress && !isConfirmed && (
                            <Button
                                type="default"
                                loading={isConfirmLoading}
                                onClick={() => handleConfirmDelivery(taskId)}
                            >
                                Xác nhận giao hàng
                            </Button>
                        )}
                        {/* Hiển thị nút Ký biên bản thay thế thiết bị khi task IN_PROGRESS và chưa ký */}
                        {isInProgress && !isSigned && !isCompleted && (
                            <Button
                                type="primary"
                                icon={<FileTextOutlined />}
                                loading={isLoading}
                                onClick={() => handleSignReplacementReport(t)}
                            >
                                Ký biên bản thay thế thiết bị
                            </Button>
                        )}
                        {isSigned && !isCompleted && (
                            <Tag color="green">Đã gửi PIN xác nhận</Tag>
                        )}
                        {(isSigned || isCompleted) && (
                            <>
                                <Button
                                    icon={<EyeOutlined />}
                                    onClick={() => handleFetchAndPreviewReplacementPdf(t)}
                                >
                                    Xem PDF
                                </Button>
                                <Button
                                    icon={<DownloadOutlined />}
                                    onClick={() => handleFetchAndDownloadReplacementPdf(t)}
                                >
                                    Tải PDF
                                </Button>
                            </>
                        )}
                    </Space>
                </>
            );
        }

        // Check if this is a regular DELIVERY task (taskCategoryId = 4, not Device Replacement)
        const taskType = String(t.type || "").toUpperCase();
        const taskCategoryNameCheck = String(t.taskCategoryName || "").toUpperCase();
        const description = String(t.description || t.title || "").toUpperCase();
        const isDeliveryTask = taskType === "DELIVERY" ||
            taskCategoryNameCheck.includes("DELIVERY") ||
            taskCategoryNameCheck.includes("GIAO") ||
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
                        <Descriptions.Item label="Thời gian bắt đầu nhiệm vụ">
                            {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Thời gian kết thúc nhiệm vụ">
                            {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                        </Descriptions.Item>
                        {isCompleted && (
                            <Descriptions.Item label="Thời gian hoàn thành nhiệm vụ">
                                {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                            </Descriptions.Item>
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
                        {!isCompleted && !isInProgress && !isConfirmed && (
                            <Button
                                type="default"
                                loading={isLoading}
                                onClick={() => handleConfirmDelivery(taskId)}
                            >
                                Xác nhận giao hàng
                            </Button>
                        )}
                        {reportForTask && (
                            <>
                                <Tooltip title={reportForTask.status === "BOTH_SIGNED" ? "Không thể cập nhật biên bản khi cả 2 bên đã ký" : ""}>
                                    <Button
                                        type="primary"
                                        icon={<EditOutlined />}
                                        disabled={reportForTask.status === "BOTH_SIGNED"}
                                        onClick={() => {
                                            navigate(`/technician/tasks/handover/${taskId}`, {
                                                state: { task: t, handoverReport: reportForTask },
                                            });
                                        }}
                                    >
                                        Cập nhật biên bản bàn giao
                                    </Button>
                                </Tooltip>
                                <Button
                                    icon={<EyeOutlined />}
                                    onClick={() => handlePreviewPdf(reportForTask)}
                                >
                                    Xem biên bản
                                </Button>
                            </>
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
                        <Descriptions.Item label="Thời gian bắt đầu nhiệm vụ">
                            {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Thời gian kết thúc nhiệm vụ">
                            {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                        </Descriptions.Item>
                        {isCompleted && (
                            <Descriptions.Item label="Thời gian hoàn thành nhiệm vụ">
                                {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                            </Descriptions.Item>
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
                        {hasCheckinReport && primaryCheckinReport && (
                            <>
                                <Tooltip title={primaryCheckinReport.status === "BOTH_SIGNED" ? "Không thể cập nhật biên bản khi cả 2 bên đã ký" : ""}>
                                    <Button
                                        type="primary"
                                        icon={<EditOutlined />}
                                        disabled={primaryCheckinReport.status === "BOTH_SIGNED"}
                                        onClick={() => {
                                            navigate(`/technician/tasks/handover-checkin/${taskId}`, {
                                                state: { task: t, handoverReport: primaryCheckinReport },
                                            });
                                        }}
                                    >
                                        Cập nhật biên bản thu hồi
                                    </Button>
                                </Tooltip>
                                <Button
                                    icon={<EyeOutlined />}
                                    onClick={() => handlePreviewPdf(primaryCheckinReport)}
                                >
                                    Xem biên bản
                                </Button>
                            </>
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
                    </>
                )}

                {/* Hiển thị chi tiết thiết bị thay thế cho task Device Replacement */}
                {isDeviceReplacementTask(t) && replacementReportDetails && (
                    <>
                        <Divider />
                        <Title level={5} style={{ marginTop: 0 }}>Chi tiết thay đổi thiết bị</Title>

                        <Row gutter={[16, 16]}>
                            {/* Thiết bị cũ (thu hồi) */}
                            <Col span={24} md={12}>
                                <Card
                                    size="small"
                                    title={<Text type="danger">Thiết bị thu hồi</Text>}
                                    bordered={true}
                                    style={{ borderColor: '#ffccc7', height: '100%' }}
                                >
                                    {(() => {
                                        const oldItem = replacementReportDetails.items?.find(item => item.isOldDevice);
                                        if (oldItem) {
                                            return (
                                                <Space direction="vertical" style={{ width: '100%' }}>
                                                    <Text strong>{oldItem.deviceModelName}</Text>
                                                    <Text type="secondary">Serial: {oldItem.deviceSerialNumber}</Text>
                                                    {oldItem.deviceId && <Text type="secondary" style={{ fontSize: '12px' }}>ID: {oldItem.deviceId}</Text>}
                                                </Space>
                                            );
                                        }
                                        return <Text disabled>Không có thông tin</Text>;
                                    })()}
                                </Card>
                            </Col>

                            {/* Thiết bị mới (thay thế) */}
                            <Col span={24} md={12}>
                                <Card
                                    size="small"
                                    title={<Text type="success">Thiết bị thay thế</Text>}
                                    bordered={true}
                                    style={{ borderColor: '#b7eb8f', height: '100%' }}
                                >
                                    {(() => {
                                        const newItem = replacementReportDetails.items?.find(item => !item.isOldDevice);
                                        if (newItem) {
                                            return (
                                                <Space direction="vertical" style={{ width: '100%' }}>
                                                    <Text strong>{newItem.deviceModelName}</Text>
                                                    <Text type="secondary">Serial: {newItem.deviceSerialNumber}</Text>
                                                    {newItem.deviceId && <Text type="secondary" style={{ fontSize: '12px' }}>ID: {newItem.deviceId}</Text>}
                                                </Space>
                                            );
                                        }
                                        return <Text disabled>Không có thông tin</Text>;
                                    })()}
                                </Card>
                            </Col>
                        </Row>
                    </>
                )}

                {!isDeviceReplacementTask(t) && Array.isArray(orderDetail?.orderDetails) && orderDetail.orderDetails.length > 0 && (
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

                <Divider />
                <Space wrap>
                    {isPreRentalQC(t) && (() => {
                        const taskId = t.taskId || t.id;
                        const status = String(t.status || "").toUpperCase();
                        const hasQcReport = hasQcReportMap[taskId];
                        const isCompletedInner = status === "COMPLETED";
                        const orderStatus = String(orderDetail?.status || orderDetail?.orderStatus || "").toUpperCase();
                        const isProcessing = orderStatus === "PROCESSING";

                        // Nếu COMPLETED: chỉ hiển thị nút nếu đã có QC report (chỉ cho update)
                        // Nếu chưa COMPLETED: hiển thị nút tạo/cập nhật như bình thường
                        if (isCompletedInner && !hasQcReport) {
                            return null; // Không hiển thị nút khi COMPLETED nhưng chưa có QC report
                        }

                        return (
                            <Tooltip title={!isProcessing ? "Chỉ có thể cập nhật QC khi đơn hàng ở trạng thái PROCESSING" : ""}>
                                <Button
                                    type="primary"
                                    icon={<FileTextOutlined />}
                                    disabled={!isProcessing}
                                    onClick={() => {
                                        navigate(`/technician/tasks/qc/${taskId}`, { state: { task: t } });
                                    }}
                                >
                                    {hasQcReport ? "Cập nhật QC Report" : "Tạo QC Report"}
                                </Button>
                            </Tooltip>
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
                        const orderStatus = String(orderDetail?.status || orderDetail?.orderStatus || "").toUpperCase();
                        const isProcessing = orderStatus === "PROCESSING";

                        return (
                            <>
                                {/* Chỉ cho phép cập nhật QC khi đơn hàng ở trạng thái PROCESSING */}
                                <Tooltip title={!isProcessing ? "Chỉ có thể cập nhật QC khi đơn hàng ở trạng thái PROCESSING" : ""}>
                                    <Button
                                        type="primary"
                                        icon={<FileTextOutlined />}
                                        disabled={!isProcessing}
                                        onClick={() => {
                                            navigate(`/technician/tasks/post-rental-qc/${taskId}`, { state: { task: t } });
                                        }}
                                    >
                                        {buttonLabel}
                                    </Button>
                                </Tooltip>
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
                            const qcTasks = tasksData.filter(t => {
                                // Check by taskCategoryId (Pre rental QC = 1, Post rental QC = 2, Pre rental QC Replace = 9)
                                if (t.taskCategoryId === 1 || t.taskCategoryId === 2 || t.taskCategoryId === 9) {
                                    return true;
                                }

                                // Check by taskCategoryName
                                const categoryName = String(t.taskCategoryName || '');
                                if (categoryName === 'Pre rental QC' || categoryName === 'Post rental QC' || categoryName === 'Pre rental QC Replace') {
                                    return true;
                                }

                                return false;
                            });

                            // Count tasks by category
                            const cat1Tasks = tasksData.filter(t => t.taskCategoryId === 1 || t.taskCategoryName === 'Pre rental QC');
                            const cat2Tasks = tasksData.filter(t => t.taskCategoryId === 2 || t.taskCategoryName === 'Post rental QC');
                            const cat9Tasks = tasksData.filter(t => t.taskCategoryId === 9 || t.taskCategoryName === 'Pre rental QC Replace');

                            const rule1 = taskRulesMap[1];
                            const rule2 = taskRulesMap[2];
                            const rule9 = taskRulesMap[9];

                            // Debug logging
                            console.log("DEBUG Modal: taskRulesMap =", taskRulesMap);
                            console.log("DEBUG Modal: rule1 =", rule1, "rule2 =", rule2, "rule9 =", rule9);
                            console.log("DEBUG Modal: cat1Tasks count =", cat1Tasks.length, "cat2Tasks count =", cat2Tasks.length, "cat9Tasks count =", cat9Tasks.length);

                            // Use rules if available, or show placeholder if not
                            const showRule1 = rule1 || { maxTasksPerDay: '—', name: 'Pre rental QC' };
                            const showRule2 = rule2 || { maxTasksPerDay: '—', name: 'Post rental QC' };
                            const showRule9 = rule9 || { maxTasksPerDay: '—', name: 'Pre rental QC Replace' };
                            const hasAnyRules = rule1 || rule2 || rule9;

                            return (
                                <>
                                    {/* Category Summary Bars - Always show for debugging */}
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                        {/* Pre rental QC card - always show */}
                                        <div style={{
                                            flex: 1,
                                            minWidth: 200,
                                            background: (rule1 && cat1Tasks.length >= rule1.maxTasksPerDay) ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            color: '#fff',
                                        }}>
                                            <div style={{ fontSize: 12, opacity: 0.9 }}>📋 Pre rental QC</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <strong style={{ fontSize: 18 }}>{cat1Tasks.length} / {showRule1.maxTasksPerDay}</strong>
                                                <Tag color={(rule1 && cat1Tasks.length >= rule1.maxTasksPerDay) ? 'red' : 'green'}>
                                                    {(rule1 && cat1Tasks.length >= rule1.maxTasksPerDay) ? 'Đạt giới hạn' : 'Còn slot'}
                                                </Tag>
                                            </div>
                                        </div>
                                        {/* Post rental QC card - always show */}
                                        <div style={{
                                            flex: 1,
                                            minWidth: 200,
                                            background: (rule2 && cat2Tasks.length >= rule2.maxTasksPerDay) ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            color: '#fff',
                                        }}>
                                            <div style={{ fontSize: 12, opacity: 0.9 }}>📋 Post rental QC</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <strong style={{ fontSize: 18 }}>{cat2Tasks.length} / {showRule2.maxTasksPerDay}</strong>
                                                <Tag color={(rule2 && cat2Tasks.length >= rule2.maxTasksPerDay) ? 'red' : 'green'}>
                                                    {(rule2 && cat2Tasks.length >= rule2.maxTasksPerDay) ? 'Đạt giới hạn' : 'Còn slot'}
                                                </Tag>
                                            </div>
                                        </div>
                                        {/* Pre rental QC Replace card - always show */}
                                        <div style={{
                                            flex: 1,
                                            minWidth: 200,
                                            background: (rule9 && cat9Tasks.length >= rule9.maxTasksPerDay) ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #eb2f96 0%, #c41d7f 100%)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            color: '#fff',
                                        }}>
                                            <div style={{ fontSize: 12, opacity: 0.9 }}>🔄 Pre rental QC Replace</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <strong style={{ fontSize: 18 }}>{cat9Tasks.length} / {showRule9.maxTasksPerDay}</strong>
                                                <Tag color={(rule9 && cat9Tasks.length >= rule9.maxTasksPerDay) ? 'red' : 'green'}>
                                                    {(rule9 && cat9Tasks.length >= rule9.maxTasksPerDay) ? 'Đạt giới hạn' : 'Còn slot'}
                                                </Tag>
                                            </div>
                                        </div>
                                    </div>
                                    <Table
                                        dataSource={qcTasks}
                                        rowKey={(r) => r.id || r.taskId}
                                        columns={[
                                            { title: 'Công việc', dataIndex: 'title' },
                                            {
                                                title: 'Loại',
                                                dataIndex: 'taskCategoryName',
                                                key: 'category',
                                                render: (_, r) => {
                                                    // Ưu tiên: taskCategoryName > categoryId mapping > type mapping > type raw
                                                    if (r.taskCategoryName) return r.taskCategoryName;
                                                    const categoryId = r.taskCategoryId ?? r.categoryId;
                                                    const categoryMap = {
                                                        1: 'Pre rental QC',
                                                        2: 'Post rental QC',
                                                        4: 'Delivery',
                                                        6: 'Pick up Rental Order',
                                                        8: 'Device Replacement',
                                                        9: 'Pre rental QC Replace',
                                                    };
                                                    if (categoryId && categoryMap[categoryId]) return categoryMap[categoryId];
                                                    return TYPES[r.type]?.label || r.type || '—';
                                                },
                                            },
                                            {
                                                title: 'Trạng thái',
                                                dataIndex: 'status',
                                                key: 'status',
                                                width: 140,
                                                render: (s) => {
                                                    const { bg, text } = getTechnicianStatusColor(s);
                                                    return <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(s)}</Tag>;
                                                },
                                                filters: [
                                                    { text: 'Đang chờ thực hiện', value: 'PENDING' },
                                                    { text: 'Đã hoàn thành', value: 'COMPLETED' },
                                                ],
                                                onFilter: (value, record) => String(record.status).toUpperCase() === String(value).toUpperCase(),
                                            },
                                            { title: '', render: (r) => <Button onClick={() => onClickTask(r)}>Chi tiết</Button> }
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
                            const deliveryTasks = tasksData.filter(t => ['DELIVERY', 'PICKUP'].includes(t.type) || (t.taskCategoryName || '').includes('Giao') || (t.taskCategoryName || '').includes('Thu') || (t.taskCategoryName === 'Delivery' || t.taskCategoryName === 'Pick up rental order' || t.taskCategoryId === 8 || t.taskCategoryName === 'Device Replacement'));

                            // Count tasks by category
                            const cat4Tasks = tasksData.filter(t => t.taskCategoryId === 4 || t.taskCategoryName === 'Delivery');
                            const cat6Tasks = tasksData.filter(t => t.taskCategoryId === 6 || t.taskCategoryName === 'Pick up rental order');
                            const cat8Tasks = tasksData.filter(t => t.taskCategoryId === 8 || t.taskCategoryName === 'Device Replacement');

                            const rule4 = taskRulesMap[4];
                            const rule6 = taskRulesMap[6];

                            // Fallback values for display
                            const showRule4 = rule4 || { maxTasksPerDay: '—', name: 'Delivery' };
                            const showRule6 = rule6 || { maxTasksPerDay: '—', name: 'Pick up' };
                            const rule8 = taskRulesMap[8];

                            return (
                                <>
                                    {/* Category Summary Bars - Always show */}
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                        {/* Delivery card - always show */}
                                        <div style={{
                                            flex: 1,
                                            minWidth: 200,
                                            background: (rule4 && cat4Tasks.length >= rule4.maxTasksPerDay) ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            color: '#fff',
                                        }}>
                                            <div style={{ fontSize: 12, opacity: 0.9 }}>🚚 Delivery</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <strong style={{ fontSize: 18 }}>{cat4Tasks.length} / {showRule4.maxTasksPerDay}</strong>
                                                <Tag color={(rule4 && cat4Tasks.length >= rule4.maxTasksPerDay) ? 'red' : 'green'}>
                                                    {(rule4 && cat4Tasks.length >= rule4.maxTasksPerDay) ? 'Đạt giới hạn' : 'Còn slot'}
                                                </Tag>
                                            </div>
                                        </div>
                                        {/* Pick up card - always show */}
                                        <div style={{
                                            flex: 1,
                                            minWidth: 200,
                                            background: (rule6 && cat6Tasks.length >= rule6.maxTasksPerDay) ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            color: '#fff',
                                        }}>
                                            <div style={{ fontSize: 12, opacity: 0.9 }}>📦 Pick up</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <strong style={{ fontSize: 18 }}>{cat6Tasks.length} / {showRule6.maxTasksPerDay}</strong>
                                                <Tag color={(rule6 && cat6Tasks.length >= rule6.maxTasksPerDay) ? 'red' : 'green'}>
                                                    {(rule6 && cat6Tasks.length >= rule6.maxTasksPerDay) ? 'Đạt giới hạn' : 'Còn slot'}
                                                </Tag>
                                            </div>
                                        </div>
                                        {rule8 && (
                                            <div style={{
                                                flex: 1,
                                                minWidth: 200,
                                                background: cat8Tasks.length >= rule8.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
                                                borderRadius: 8,
                                                padding: '10px 14px',
                                                color: '#fff',
                                            }}>
                                                <div style={{ fontSize: 12, opacity: 0.9 }}>🔄 Device Replacement</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <strong style={{ fontSize: 18 }}>{cat8Tasks.length} / {rule8.maxTasksPerDay}</strong>
                                                    <Tag color={cat8Tasks.length >= rule8.maxTasksPerDay ? 'red' : 'green'}>
                                                        {cat8Tasks.length >= rule8.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                                    </Tag>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <Table
                                        dataSource={deliveryTasks}
                                        rowKey={(r) => r.id || r.taskId}
                                        columns={[
                                            { title: 'Công việc', dataIndex: 'title' },
                                            {
                                                title: 'Loại',
                                                dataIndex: 'taskCategoryName',
                                                key: 'category',
                                                render: (_, r) => {
                                                    if (r.taskCategoryName) return r.taskCategoryName;
                                                    const categoryId = r.taskCategoryId ?? r.categoryId;
                                                    const categoryMap = {
                                                        1: 'Pre rental QC',
                                                        2: 'Post rental QC',
                                                        4: 'Delivery',
                                                        6: 'Pick up Rental Order',
                                                        8: 'Device Replacement',
                                                        9: 'Pre rental QC Replace',
                                                    };
                                                    if (categoryId && categoryMap[categoryId]) return categoryMap[categoryId];
                                                    return TYPES[r.type]?.label || r.type || '—';
                                                },
                                            },
                                            {
                                                title: 'Trạng thái',
                                                dataIndex: 'status',
                                                key: 'status',
                                                width: 140,
                                                render: (s) => {
                                                    const { bg, text } = getTechnicianStatusColor(s);
                                                    return <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(s)}</Tag>;
                                                },
                                                filters: [
                                                    { text: 'Đang chờ thực hiện', value: 'PENDING' },
                                                    { text: 'Đã hoàn thành', value: 'COMPLETED' },
                                                ],
                                                onFilter: (value, record) => String(record.status).toUpperCase() === String(value).toUpperCase(),
                                            },
                                            { title: '', render: (r) => <Button onClick={() => onClickTask(r)}>Chi tiết</Button> }
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
                                    pagination={{ pageSize: 5, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'], hideOnSinglePage: false }}
                                />
                            );
                        })()
                    },
                    {
                        key: '4',
                        label: 'Khiếu nại',
                        children: <TechnicianComplaint />
                    }
                ]} />
            </Modal >

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

            {/* Device Replacement PIN Signing Modal */}
            <Modal
                title="Ký biên bản thay thế thiết bị"
                open={replacementPinModalOpen}
                onCancel={() => {
                    setReplacementPinModalOpen(false);
                    setReplacementPinTask(null);
                    setReplacementReportId(null);
                    setReplacementReportDetails(null);
                    setReplacementPinValue("");
                    setReplacementPinSent(false);
                }}
                footer={[
                    <Button key="cancel" onClick={() => {
                        setReplacementPinModalOpen(false);
                        setReplacementPinTask(null);
                        setReplacementReportId(null);
                        setReplacementReportDetails(null);
                        setReplacementPinValue("");
                        setReplacementPinSent(false);
                    }}>
                        Đóng
                    </Button>,
                    !replacementReportDetails?.staffSigned && (
                        <Button
                            key="sign"
                            type="primary"
                            disabled={!replacementPinValue.trim() || !replacementPinSent}
                            loading={replacementPinSigning}
                            onClick={handleSubmitReplacementSignature}
                        >
                            Xác nhận ký
                        </Button>
                    ),
                ].filter(Boolean)}
                destroyOnHidden
                width={600}
            >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* Report info */}
                    {replacementReportDetails && (
                        <>
                            <Descriptions bordered size="small" column={1}>
                                <Descriptions.Item label="Mã biên bản">
                                    <Text strong>#{replacementReportDetails.replacementReportId}</Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="Mã đơn hàng">
                                    #{replacementReportDetails.orderId || "—"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Khách hàng">
                                    {replacementReportDetails.customerInfo || "—"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Kỹ thuật viên">
                                    {replacementReportDetails.technicianInfo || "—"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Thời gian">
                                    {replacementReportDetails.replacementDateTime
                                        ? dayjs(replacementReportDetails.replacementDateTime).format("DD/MM/YYYY HH:mm")
                                        : "—"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Địa điểm">
                                    {replacementReportDetails.replacementLocation || "—"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Trạng thái">
                                    <Tag color={
                                        replacementReportDetails.status === "BOTH_SIGNED" ? "green" :
                                            replacementReportDetails.status === "STAFF_SIGNED" ? "blue" :
                                                "orange"
                                    }>
                                        {replacementReportDetails.status === "BOTH_SIGNED" ? "Đã ký 2 bên" :
                                            replacementReportDetails.status === "STAFF_SIGNED" ? "NV đã ký" :
                                                replacementReportDetails.status === "CUSTOMER_SIGNED" ? "KH đã ký" :
                                                    replacementReportDetails.status || "Chờ ký"}
                                    </Tag>
                                </Descriptions.Item>
                            </Descriptions>

                            {/* Device Items */}
                            {replacementReportDetails.items && replacementReportDetails.items.length > 0 && (
                                <>
                                    <Divider style={{ margin: '8px 0' }}>Thiết bị thay thế</Divider>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        {replacementReportDetails.items.map((item, idx) => (
                                            <Card
                                                key={item.itemId || idx}
                                                size="small"
                                                style={{
                                                    width: 260,
                                                    borderColor: item.isOldDevice ? '#ff7875' : '#95de64',
                                                    background: item.isOldDevice ? '#fff2f0' : '#f6ffed'
                                                }}
                                            >
                                                <Tag color={item.isOldDevice ? "red" : "green"} style={{ marginBottom: 8 }}>
                                                    {item.isOldDevice ? "🔄 Thu hồi" : "✅ Giao mới"}
                                                </Tag>
                                                <div><Text strong>{item.deviceModelName || "—"}</Text></div>
                                                <div><Text type="secondary">SN: {item.deviceSerialNumber || "—"}</Text></div>
                                            </Card>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    <Divider style={{ margin: '8px 0' }} />

                    {/* Already signed message */}
                    {replacementReportDetails?.staffSigned ? (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                                ✓ Biên bản đã được ký bởi nhân viên
                            </Tag>
                            {replacementReportDetails.staffSignedAt && (
                                <div style={{ marginTop: 8 }}>
                                    <Text type="secondary">
                                        Ký lúc: {dayjs(replacementReportDetails.staffSignedAt).format("DD/MM/YYYY HH:mm")}
                                    </Text>
                                </div>
                            )}

                            {/* Show resolve button when BOTH_SIGNED */}
                            {replacementReportDetails.status === "BOTH_SIGNED" && (
                                <div style={{ marginTop: 16 }}>
                                    <Divider style={{ margin: '16px 0' }}>Hoàn thành thay thế</Divider>
                                    <ReplacementResolveButton
                                        complaintId={replacementComplaintId}
                                        onResolveSuccess={() => {
                                            setReplacementPinModalOpen(false);
                                            loadTasks();
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Step 1: Fault Diagnosis (MOVED FIRST) */}
                            <div>
                                <Text strong>Bước 1: Chuẩn đoán nguồn lỗi</Text>
                                {!replacementComplaintId ? (
                                    <div style={{ marginTop: 8 }}>
                                        <Text type="secondary">
                                            Không tìm thấy ID khiếu nại. Bước này sẽ được bỏ qua.
                                        </Text>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: 8 }}>
                                        <Radio.Group onChange={(e) => {
                                            setReplacementFaultSource(e.target.value);
                                            // Reset conditions when source changes
                                            if (e.target.value !== "CUSTOMER") {
                                                setReplacementFaultConditionIds([]);
                                            }
                                        }} value={replacementFaultSource}
                                            disabled={replacementFaultUpdated}
                                        >
                                            <Space direction="vertical">
                                                <Radio value="CUSTOMER">Lỗi do khách hàng</Radio>
                                                {/* Show conditions dropdown ONLY if CUSTOMER is selected */}
                                                {replacementFaultSource === "CUSTOMER" && (
                                                    <div style={{ marginLeft: 24, marginBottom: 8, width: 300 }}>
                                                        <Select
                                                            mode="multiple"
                                                            style={{ width: '100%' }}
                                                            placeholder="Chọn tình trạng lỗi..."
                                                            options={faultConditionOptions}
                                                            value={replacementFaultConditionIds}
                                                            onChange={setReplacementFaultConditionIds}
                                                            loading={!faultConditionOptions || faultConditionOptions.length === 0}
                                                        />
                                                    </div>
                                                )}
                                                <Radio value="RENTAL_DEVICE">Lỗi thiết bị (do máy)</Radio>
                                                <Radio value="UNKNOWN">Chưa xác định</Radio>
                                            </Space>
                                        </Radio.Group>
                                        <Input.TextArea
                                            placeholder="Ghi chú (tùy chọn)..."
                                            value={replacementFaultNote}
                                            onChange={(e) => setReplacementFaultNote(e.target.value)}
                                            rows={2}
                                            style={{ marginTop: 8, width: 280 }}
                                            maxLength={500}
                                            disabled={replacementFaultUpdated}
                                        />
                                        {!replacementFaultUpdated ? (
                                            <div style={{ marginTop: 8 }}>
                                                <Button
                                                    type="primary"
                                                    loading={replacementFaultUpdating}
                                                    onClick={handleUpdateReplacementFault}
                                                >
                                                    Xác nhận nguồn lỗi
                                                </Button>
                                            </div>
                                        ) : (
                                            <Text type="success" style={{ display: 'block', marginTop: 8 }}>
                                                ✓ Đã cập nhật nguồn lỗi thành công
                                            </Text>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Upload Evidence (MOVED SECOND) */}
                            <div>
                                <Text strong>Bước 2: Upload ảnh bằng chứng cho quyết định</Text>
                                <div style={{ marginTop: 8 }}>
                                    <Upload
                                        accept="image/*"
                                        multiple
                                        maxCount={5}
                                        beforeUpload={(file) => {
                                            const isImage = file.type.startsWith("image/");
                                            if (!isImage) {
                                                message.error("Chỉ hỗ trợ file ảnh!");
                                                return Upload.LIST_IGNORE;
                                            }
                                            const isLt5M = file.size / 1024 / 1024 < 5;
                                            if (!isLt5M) {
                                                message.error("Ảnh phải nhỏ hơn 5MB!");
                                                return Upload.LIST_IGNORE;
                                            }
                                            setReplacementEvidenceFiles(prev => [...prev, file]);
                                            return false;
                                        }}
                                        onRemove={(file) => {
                                            setReplacementEvidenceFiles(prev =>
                                                prev.filter(f => f.uid !== file.uid)
                                            );
                                        }}
                                        fileList={replacementEvidenceFiles.map((f, idx) => ({
                                            uid: f.uid || `-${idx}`,
                                            name: f.name,
                                            status: 'done',
                                        }))}
                                        listType="picture"
                                        disabled={replacementEvidenceUploaded || (!replacementFaultUpdated && replacementComplaintId)}
                                    >
                                        {!replacementEvidenceUploaded && replacementEvidenceFiles.length < 5 && (
                                            <Button
                                                icon={<UploadOutlined />}
                                                disabled={!replacementFaultUpdated && replacementComplaintId}
                                            >
                                                Chọn ảnh
                                            </Button>
                                        )}
                                    </Upload>
                                    {replacementEvidenceFiles.length > 0 && !replacementEvidenceUploaded && (
                                        <Button
                                            type="primary"
                                            style={{ marginTop: 8 }}
                                            loading={replacementEvidenceUploading}
                                            onClick={handleUploadReplacementEvidence}
                                            disabled={!replacementFaultUpdated && replacementComplaintId}
                                        >
                                            Upload bằng chứng
                                        </Button>
                                    )}
                                    {replacementEvidenceUploaded && (
                                        <Text type="success" style={{ display: 'block', marginTop: 8 }}>
                                            ✓ Đã upload bằng chứng thành công
                                        </Text>
                                    )}
                                    {!replacementFaultUpdated && replacementComplaintId && (
                                        <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                                            Vui lòng hoàn thành Bước 1 trước
                                        </Text>
                                    )}
                                </div>
                            </div>

                            {/* Step 3: Send PIN and Sign */}
                            <div>
                                <Text strong>Bước 3: Gửi mã PIN và ký biên bản</Text>
                                <div style={{ marginTop: 8 }}>
                                    <Button
                                        type="primary"
                                        loading={replacementPinSending}
                                        onClick={handleSendReplacementPin}
                                        disabled={replacementPinSent || !replacementEvidenceUploaded}
                                    >
                                        {replacementPinSent ? "Đã gửi mã PIN" : "Gửi mã PIN đến email"}
                                    </Button>
                                    {replacementPinSent && (
                                        <Text type="success" style={{ marginLeft: 8 }}>
                                            ✓ Mã PIN đã được gửi đến email khách hàng
                                        </Text>
                                    )}
                                    {!replacementEvidenceUploaded && (
                                        <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                                            Vui lòng hoàn thành Bước 1 và Bước 2 trước
                                        </Text>
                                    )}
                                </div>

                                {/* PIN Input */}
                                {replacementPinSent && (
                                    <div style={{ marginTop: 12 }}>
                                        <Input
                                            placeholder="Nhập mã PIN (6 chữ số)"
                                            value={replacementPinValue}
                                            onChange={(e) => setReplacementPinValue(e.target.value)}
                                            maxLength={6}
                                            style={{ width: 200 }}
                                        />
                                        <Text type="secondary" style={{ marginLeft: 8 }}>
                                            Hỏi khách hàng mã PIN nhận được qua email
                                        </Text>
                                    </div>
                                )}
                            </div>

                            {!replacementEvidenceUploaded && (
                                <Text type="warning">
                                    ⚠ Vui lòng hoàn thành các bước trên trước khi ký biên bản
                                </Text>
                            )}
                        </>
                    )}
                </Space>
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
        </div>
    );
}
