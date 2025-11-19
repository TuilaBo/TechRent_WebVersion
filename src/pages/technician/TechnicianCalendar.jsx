// src/pages/technician/TechnicianCalendar.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
} from "antd";
import {
  EnvironmentOutlined,
  PhoneOutlined,
  InboxOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
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

export default function TechnicianCalendar() {
  const [tasksAll, setTasksAll] = useState([]);
  const [detailTask, setDetailTask] = useState(null); // task được click (đầy đủ từ API detail)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const [orderDetail, setOrderDetail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [searchTaskId, setSearchTaskId] = useState("");
  // Map: taskId -> hasQcReport (boolean)
  const [hasQcReportMap, setHasQcReportMap] = useState({});
  const [confirmingDelivery, setConfirmingDelivery] = useState({}); // taskId -> loading
  const [confirmingRetrieval, setConfirmingRetrieval] = useState({}); // taskId -> loading
  const [confirmedTasks, setConfirmedTasks] = useState(new Set()); // Set of taskIds that have been confirmed (delivery)
  const [confirmedRetrievalTasks, setConfirmedRetrievalTasks] = useState(new Set()); // Set of taskIds that have been confirmed (retrieval)

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
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không tải được nhiệm vụ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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
        if (oid) viewOrderDetail(oid);
      } else {
        setDetailTask(task);
      }
      setDrawerOpen(true);
    } catch {
      toast.error("Không tải được chi tiết task");
      setDetailTask(task); // Fallback to display task
      setDrawerOpen(true);
    }
  }, []);

  // Xác nhận giao hàng
  const handleConfirmDelivery = useCallback(async (taskId) => {
    try {
      setConfirmingDelivery((prev) => ({ ...prev, [taskId]: true }));
      await confirmDelivery(taskId);
      toast.success("Đã xác nhận giao hàng thành công!");
      // Đánh dấu task đã được xác nhận
      setConfirmedTasks((prev) => new Set([...prev, taskId]));
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
      setConfirmedRetrievalTasks((prev) => new Set([...prev, taskId]));
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
            {r.type === "DELIVERY" && (() => {
              const taskId = r.taskId || r.id;
              const status = String(r.status || "").toUpperCase();
              const isPending = status === "PENDING";
              const isCompleted = status === "COMPLETED";
              const isInProgress = status === "IN_PROGRESS";
              const isConfirmed = confirmedTasks.has(taskId);
              const isLoading = confirmingDelivery[taskId];
              
              return (
                <>
                  {/* Chỉ hiển thị nút "Tạo biên bản" khi không phải PENDING */}
                  {!isPending && (
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
              const isConfirmed = confirmedRetrievalTasks.has(taskId);
              const isLoading = confirmingRetrieval[taskId];
              const hasQcReport = hasQcReportMap[taskId];
              const buttonLabel =
                status === "COMPLETED"
                  ? "Cập nhật QC Report"
                  : hasQcReport
                    ? "Cập nhật QC Report"
                    : "Tạo QC Report";
              
              return (
                <>
                  {!isCompleted && !isInProgress && !isConfirmed && (
                    <Button
                      size="small"
                      type="default"
                      loading={isLoading}
                      onClick={() => handleConfirmRetrieval(taskId)}
                    >
                      Xác nhận đi láy hàng
                    </Button>
                  )}
                  {/* Chỉ hiển thị nút "Tạo/Cập nhật QC Report" khi status là IN_PROGRESS hoặc COMPLETED */}
                  {(isInProgress || isCompleted) && (
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
                  )}
                </>
              );
            })()}
          </Space>
        ),
      },
    ],
    [navigate, onClickTask, hasQcReportMap, confirmingDelivery, handleConfirmDelivery, confirmedTasks, confirmingRetrieval, handleConfirmRetrieval, confirmedRetrievalTasks, isPickupTask]
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

    if (t.type === "DELIVERY") {
      const taskId = t.taskId || t.id;
      const status = String(t.status || "").toUpperCase();
      const isPending = status === "PENDING";
      const isCompleted = status === "COMPLETED";
      const isInProgress = status === "IN_PROGRESS";
      const isConfirmed = confirmedTasks.has(taskId);
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
          <Space wrap>
            {/* Chỉ hiển thị nút "Tạo biên bản bàn giao" khi không phải PENDING */}
            {!isPending && (
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
            {(isCompleted || isConfirmed || isInProgress) && (
              <Text type="success">Đã xác nhận giao hàng</Text>
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
      const isConfirmed = confirmedRetrievalTasks.has(taskId);
      const isLoading = confirmingRetrieval[taskId];
      
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
            {(isCompleted || isConfirmed || isInProgress) && (
              <Text type="success">Đã xác nhận đi trả hàng</Text>
            )}
            {/* Chỉ hiển thị nút "Tạo/Cập nhật QC Report" khi status là IN_PROGRESS hoặc COMPLETED */}
            {(isInProgress || isCompleted) && (() => {
              const hasQcReport = hasQcReportMap[taskId];
              const buttonLabel =
                isCompleted
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
            const isCompleted = status === "COMPLETED";
            
            // Nếu COMPLETED: chỉ hiển thị nút nếu đã có QC report (chỉ cho update)
            // Nếu chưa COMPLETED: hiển thị nút tạo/cập nhật như bình thường
            if (isCompleted && !hasQcReport) {
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
            const isCompleted = status === "COMPLETED";
            const isInProgress = status === "IN_PROGRESS";
            const isConfirmed = confirmedTasks.has(taskId);
            const isLoading = confirmingDelivery[taskId];
            
            return (
              <>
                {/* Chỉ hiển thị nút "Tạo biên bản bàn giao" khi không phải PENDING */}
                {!isPending && (
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
                {(isCompleted || isConfirmed || isInProgress) && (
                  <Text type="success">Đã xác nhận giao hàng</Text>
                )}
              </>
            );
          })()}
          {isPickupTask(t) && (() => {
            const taskId = t.taskId || t.id;
            const status = String(t.status || "").toUpperCase();
            const isCompleted = status === "COMPLETED";
            const isInProgress = status === "IN_PROGRESS";
            const isConfirmed = confirmedRetrievalTasks.has(taskId);
            const isLoading = confirmingRetrieval[taskId];
            const hasQcReport = hasQcReportMap[taskId];
            const buttonLabel =
              isCompleted
                ? "Cập nhật QC Report"
                : hasQcReport
                  ? "Cập nhật QC Report"
                  : "Tạo QC Report";
            
            return (
              <>
                {!isCompleted && !isInProgress && !isConfirmed && (
                  <Button
                    type="default"
                    loading={isLoading}
                    onClick={() => handleConfirmRetrieval(taskId)}
                  >
                    Xác nhận đi trả hàng
                  </Button>
                )}
                {(isCompleted || isConfirmed || isInProgress) && (
                  <Text type="success">Đã xác nhận đi trả hàng</Text>
                )}
                {/* Chỉ hiển thị nút "Tạo/Cập nhật QC Report" khi status là IN_PROGRESS hoặc COMPLETED */}
                {(isInProgress || isCompleted) && (
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
              return statusMatch && taskIdMatch;
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
    </>
  );
}
