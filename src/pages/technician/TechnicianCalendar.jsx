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
} from "../../lib/taskApi";
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
  date: t.plannedStart || t.createdAt || null,
  device: t.deviceName || t.taskCategoryName || "Thiết bị",
  location: t.location || "—",
  orderId: t.orderId ?? null,
  status: t.status ?? null,
  taskCategoryName: t.taskCategoryName || "",
  assignedStaffName: t.assignedStaffName || "",
  assignedStaffRole: t.assignedStaffRole || "",
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

export default function TechnicianCalendar() {
  const [tasksAll, setTasksAll] = useState([]);
  const [detailTask, setDetailTask] = useState(null); // task được click (đầy đủ từ API detail)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const [orderDetail, setOrderDetail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);

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
        title: "Tiêu đề",
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
        title: "Bắt đầu",
        dataIndex: "date",
        key: "start",
        render: (d) => (d ? dayjs(d).format("DD/MM/YYYY HH:mm") : "—"),
        width: 180,
        sorter: (a, b) => dayjs(a.date) - dayjs(b.date),
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
        width: 220,
        render: (_, r) => (
          <Space>
            <Button size="small" onClick={() => onClickTask(r)}>Xem</Button>
            {isPreRentalQC(r) && String(r.status || "").toUpperCase() !== "COMPLETED" && (
              <Button
                size="small"
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => {
                  const taskId = r.taskId || r.id;
                  navigate(`/technician/tasks/qc/${taskId}`, { state: { task: r } });
                }}
              >
                Tạo QC Report
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [navigate, onClickTask]
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
              {fmtDateTime(t.deadline)}
            </Descriptions.Item>
            <Descriptions.Item label="Category">{t.category || "—"}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{t.location || "—"}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Space wrap>
            {isPreRentalQC(t) && String(t.status || "").toUpperCase() !== "COMPLETED" && (
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => {
                  const taskId = t.taskId || t.id;
                  navigate(`/technician/tasks/qc/${taskId}`, { state: { task: t } });
                }}
              >
                Tạo QC Report
              </Button>
            )}
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
              {next ? fmtDate(next) : "—"}
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
      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
            <Descriptions.Item label="Mã đơn">{t.orderId}</Descriptions.Item>
            <Descriptions.Item label="Thiết bị">{t.device}</Descriptions.Item>
            <Descriptions.Item label="Khách hàng">
              {t.customer} &nbsp; <PhoneOutlined /> {t.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">
              <Space>
                <EnvironmentOutlined />
                {t.address}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian giao">
              {t.deliveryWindow?.start ? (
                <>
                  {fmtDateTime(t.deliveryWindow.start)} →{" "}
                  {t.deliveryWindow?.end ? dayjs(t.deliveryWindow.end).format("HH:mm") : "—"}
                </>
              ) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">{t.note || "—"}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Text type="secondary">
            *Xác nhận đã giao xong bằng app ký nhận/ảnh biên bản nếu cần (tích hợp sau).
          </Text>
        </>
      );
    }

    // Fallback generic detail for loại không xác định
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
        {/* duplicate order detail block removed */}
        <Divider />
        <Space wrap>
          {isPreRentalQC(t) && String(t.status || "").toUpperCase() !== "COMPLETED" && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => {
                const taskId = t.taskId || t.id;
                navigate(`/technician/tasks/qc/${taskId}`, { state: { task: t } });
              }}
            >
              Tạo QC Report
            </Button>
          )}
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

      <Space style={{ marginBottom: 12 }}>
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
            .filter((t) => (filterStatus === "ALL" ? true : String(t.status).toUpperCase() === String(filterStatus).toUpperCase()))
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
