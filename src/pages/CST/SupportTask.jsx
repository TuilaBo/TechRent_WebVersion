// src/pages/CST/SupportTask.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card,
  List,
  Tag,
  Space,
  Button,
  Drawer,
  Descriptions,
  Typography,
  Divider,
  Select,
  Table,
  Input,
  Calendar,
  Badge,
  Modal,
  Tabs,
} from "antd";
import {
  EnvironmentOutlined,
  PhoneOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import {
  listTasks,
  getTaskById,
  normalizeTask,
  confirmDelivery,
  confirmRetrieval,
} from "../../lib/taskApi";
import {
  TECH_TASK_STATUS,
  getTechnicianStatusColor,
} from "../../lib/technicianTaskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel, fmtVND } from "../../lib/deviceModelsApi";
import { getActiveTaskRules } from "../../lib/taskRulesApi";

const { Title, Text } = Typography;

/** ----- Loại task & màu sắc ----- */
const TYPES = {
  DELIVERY: { color: "green", label: "ĐI GIAO THIẾT BỊ" },
};

// Map BE task to display fields used by the calendar UI
const taskToDisplay = (t) => ({
  id: t.taskId ?? t.id,
  type: t.type || "",
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
  if (v.includes("DELIVERY_CONFIRMED") || v === "DELIVERY_CONFIRMED") return "Chuẩn bị giao hàng";
  if (v.includes("IN_USE") || v === "IN_USE") return "Đang sử dụng";
  if (v.includes("PENDING")) return "Chờ xử lý";
  if (v.includes("PROCESSING")) return "Đang xử lý";
  if (v.includes("COMPLETED") || v.includes("DONE")) return "Đã hoàn thành";
  if (v.includes("CANCELLED") || v.includes("CANCELED")) return "Đã hủy";
  if (v.includes("DELIVERED")) return "Đã giao";
  if (v.includes("RETURNED")) return "Đã trả";
  if (v.includes("DELIVERING")) return "Đang giao";
  return v;
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

export default function SupportTask() {
  const [tasksAll, setTasksAll] = useState([]);
  const [detailTask, setDetailTask] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [searchTaskId, setSearchTaskId] = useState("");
  const [confirmingDelivery, setConfirmingDelivery] = useState({}); // taskId -> loading
  const [confirmingRetrieval, setConfirmingRetrieval] = useState({}); // taskId -> loading
  const [confirmedTasks, setConfirmedTasks] = useState(new Set()); // Set of taskIds that have been confirmed (delivery)
  const [confirmedRetrievalTasks, setConfirmedRetrievalTasks] = useState(new Set()); // Set of taskIds that have been confirmed (retrieval)

  // Calendar view states
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [taskRulesMap, setTaskRulesMap] = useState({}); // { categoryId -> { maxTasksPerDay, name } }

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

  // Load all tasks từ /api/staff/tasks (backend tự filter theo customer support staff từ token)
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const allTasksRaw = await listTasks();
      const allTasks = allTasksRaw.map(normalizeTask);
      const display = allTasks.map(taskToDisplay);
      setTasksAll(display);

      // Load task rules for summary bars
      try {
        const allRules = await getActiveTaskRules();
        const rulesMap = {};
        (allRules || []).forEach(rule => {
          if (rule.taskCategoryId && rule.active) {
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
        setTaskRulesMap(rulesMap);
      } catch (e) {
        console.warn("Failed to load task rules:", e);
      }
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
      setDetailTask(task);
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
        title: "Mã công việc",
        dataIndex: "id",
        key: "id",
        render: (v, r) => r.id || r.taskId || "—",
        width: 120,
      },
      {
        title: "Loại công việc",
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
        width: 120,
        render: (_, r) => (
          <Space>
            <Button size="small" onClick={() => onClickTask(r)}>Xem</Button>
          </Space>
        ),
      },
    ],
    [onClickTask, confirmingDelivery, handleConfirmDelivery, confirmedTasks, confirmingRetrieval, handleConfirmRetrieval, confirmedRetrievalTasks]
  );

  /** ---- UI phần chi tiết theo loại ---- */
  const renderDetailBody = (t) => {
    if (!t) return null;

    const header = (
      <Space wrap size={8}>
        <Tag color={TYPES[t.type]?.color || "blue"}>{TYPES[t.type]?.label || t.taskCategoryName || t.type}</Tag>
        <Text type="secondary">
          {fmtDateTime(t.date)} • {t.location || "—"}
        </Text>
      </Space>
    );

    const taskTypeNormalized = String(t.type || t.taskCategoryName || "").toUpperCase();
    const isDeliveryTask =
      taskTypeNormalized.includes("DELIVERY") || taskTypeNormalized.includes("GIAO");
    if (isDeliveryTask) {
      const taskId = t.taskId || t.id;
      const status = String(t.status || "").toUpperCase();
      const isCompleted = status === "COMPLETED";
      const isInProgress = status === "IN_PROGRESS";
      const isConfirmed = confirmedTasks.has(taskId);
      const isLoading = confirmingDelivery[taskId];

      const customerName =
        customerDetail?.fullName ||
        customerDetail?.username ||
        orderDetail?.customerName ||
        "—";
      const customerPhone = customerDetail?.phoneNumber || "";
      const customerEmail = customerDetail?.email || "";
      const address = orderDetail?.shippingAddress || t.address || "—";

      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Mã công việc">{t.taskId || t.id || "—"}</Descriptions.Item>
            <Descriptions.Item label="Loại công việc">{t.taskCategoryName || t.type || "—"}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {t.status ? (() => {
                const { bg, text } = getTechnicianStatusColor(t.status);
                return <Tag style={{ backgroundColor: bg, color: text, border: "none" }}>{fmtStatus(t.status)}</Tag>;
              })() : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đơn">{t.orderId || "—"}</Descriptions.Item>
            <Descriptions.Item label="Thời gian dự kiến">
              {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}{" "}
              {t.plannedEnd ? `→ ${fmtDateTime(t.plannedEnd)}` : ""}
            </Descriptions.Item>
            {isCompleted && (
              <>
                <Descriptions.Item label="Thời gian hoàn thành">
                  {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>

          {orderDetail && (
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
          )}

          <Divider />
          {!isCompleted && !isInProgress && !isConfirmed && (
            <Button type="primary" loading={isLoading} onClick={() => handleConfirmDelivery(taskId)}>
              Xác nhận giao hàng
            </Button>
          )}
          {(isCompleted || isConfirmed || isInProgress) && (
            <Text type="success">Đã xác nhận giao hàng</Text>
          )}
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
                  {orderDetail.startDate ? fmtDate(orderDetail.startDate) : "—"} → {orderDetail.endDate ? fmtDate(orderDetail.endDate) : "—"}
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
              <Text type="success">Đã xác nhận đi lấy hàng</Text>
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
                {orderDetail.startDate ? fmtDate(orderDetail.startDate) : "—"} → {orderDetail.endDate ? fmtDate(orderDetail.endDate) : "—"}
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
          {(String(t.type || "").toUpperCase() === "DELIVERY" || String(t.taskCategoryName || "").toUpperCase().includes("DELIVERY") || String(t.taskCategoryName || "").toUpperCase().includes("GIAO")) && (() => {
            const taskId = t.taskId || t.id;
            const status = String(t.status || "").toUpperCase();
            const isCompleted = status === "COMPLETED";
            const isInProgress = status === "IN_PROGRESS";
            const isConfirmed = confirmedTasks.has(taskId);
            const isLoading = confirmingDelivery[taskId];

            return (
              <>
                {/* Hiển thị nút "Xác nhận giao hàng" cho task DELIVERY */}
                {!isCompleted && !isInProgress && !isConfirmed && (
                  <Button
                    type="primary"
                    loading={isLoading}
                    onClick={() => handleConfirmDelivery(taskId)}
                  >
                    Xác nhận giao hàng
                  </Button>
                )}
                {/* Hiển thị thông báo khi đã xác nhận */}

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
              </>
            );
          })()}
        </Space>
      </>
    );
  };

  // Calendar helpers
  const getTaskBadgeStatus = (status) => {
    const s = String(status || '').toUpperCase();
    if (s.includes('PENDING')) return 'warning';
    if (s.includes('IN_PROGRESS') || s.includes('PROCESSING')) return 'processing';
    if (s.includes('COMPLETED') || s.includes('DONE')) return 'success';
    if (s.includes('CANCELLED') || s.includes('FAILED')) return 'error';
    return 'default';
  };

  const getCalendarData = useCallback((value) => {
    if (!value) return [];
    return tasksAll.filter(t => {
      const date = t.date ? dayjs(t.date) : null;
      return date && date.isSame(value, 'day');
    });
  }, [tasksAll]);

  const dateCellRender = useCallback((value) => {
    const dayTasks = getCalendarData(value);
    if (dayTasks.length === 0) return null;

    const statusCounts = { warning: 0, processing: 0, success: 0, error: 0 };
    dayTasks.forEach(t => {
      const status = getTaskBadgeStatus(t.status);
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return (
      <ul className="events" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {Object.entries(statusCounts)
          .filter(([_, count]) => count > 0)
          .map(([status, count]) => (
            <li key={status}>
              <Badge status={status} text={<span style={{ fontSize: '10px' }}>{count}</span>} />
            </li>
          ))
        }
      </ul>
    );
  }, [getCalendarData]);

  const onSelectDate = useCallback((date) => {
    setSelectedDate(date);
    setIsDailyModalOpen(true);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Lịch làm việc hỗ trợ</Title>
        <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
          Tải lại
        </Button>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '8px 16px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <span style={{ fontWeight: 600 }}>Chú thích:</span>
        <Badge status="warning" text="Cần xử lý" />
        <Badge status="processing" text="Đang thực hiện" />
        <Badge status="success" text="Đã hoàn thành" />
        <Badge status="error" text="Đã hủy" />
      </div>

      <Tabs defaultActiveKey="calendar" items={[
        {
          key: 'calendar',
          label: 'Lịch công việc',
          children: (
            <Card>
              <Calendar
                cellRender={(date, info) => {
                  if (info.type === 'date') return dateCellRender(date);
                  return info.originNode;
                }}
                onSelect={onSelectDate}
              />
            </Card>
          )
        },
        {
          key: 'list',
          label: 'Danh sách',
          children: (
            <>
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
                      // Ưu tiên PENDING lên đầu
                      const aIsPending = String(a.status || "").toUpperCase().includes("PENDING");
                      const bIsPending = String(b.status || "").toUpperCase().includes("PENDING");

                      if (aIsPending && !bIsPending) return -1;
                      if (!aIsPending && bIsPending) return 1;

                      // Nếu cùng trạng thái (cả 2 PENDING hoặc cả 2 không PENDING), sort từ mới nhất đến cũ nhất
                      const aDate = a.date ? dayjs(a.date) : dayjs(0);
                      const bDate = b.date ? dayjs(b.date) : dayjs(0);
                      return bDate.valueOf() - aDate.valueOf(); // Descending: newest first
                    })}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              </Card>
            </>
          )
        }
      ]} />

      {/* Daily Tasks Modal */}
      <Modal
        title={`Công việc ngày ${selectedDate.format('DD/MM/YYYY')}`}
        open={isDailyModalOpen}
        onCancel={() => setIsDailyModalOpen(false)}
        footer={null}
        width={900}
      >
        {(() => {
          const dayTasks = getCalendarData(selectedDate);
          const cat4Tasks = dayTasks.filter(t => t.taskCategoryId === 4 || (t.taskCategoryName || '').includes('Delivery') || (t.taskCategoryName || '').includes('Giao'));
          const cat6Tasks = dayTasks.filter(t => t.taskCategoryId === 6 || (t.taskCategoryName || '').includes('Pick') || (t.taskCategoryName || '').includes('Thu'));
          const rule4 = taskRulesMap[4];
          const rule6 = taskRulesMap[6];

          return (
            <>
              {/* Summary Bars */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {rule4 && (
                  <div style={{
                    flex: 1, minWidth: 200,
                    background: cat4Tasks.length >= rule4.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                    borderRadius: 8, padding: '10px 14px', color: '#fff',
                  }}>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>🚚 Giao hàng</div>
                    <strong style={{ fontSize: 18 }}>{cat4Tasks.length} / {rule4.maxTasksPerDay}</strong>
                  </div>
                )}
                {rule6 && (
                  <div style={{
                    flex: 1, minWidth: 200,
                    background: cat6Tasks.length >= rule6.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                    borderRadius: 8, padding: '10px 14px', color: '#fff',
                  }}>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>📦 Thu hồi</div>
                    <strong style={{ fontSize: 18 }}>{cat6Tasks.length} / {rule6.maxTasksPerDay}</strong>
                  </div>
                )}
              </div>

              <Table
                rowKey={(r) => r.id || r.taskId}
                dataSource={dayTasks}
                columns={columns}
                pagination={false}
              />
            </>
          );
        })()}
      </Modal>

      <Drawer
        title={detailTask ? detailTask.title : "Chi tiết công việc"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
      >
        {renderDetailBody(detailTask)}
      </Drawer>
    </div>
  );
}
