// src/pages/technician/TechnicianCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Badge,
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
  Tabs,
  Select,
} from "antd";
import {
  PlusOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  listTechnicianTasks,
  getTechnicianTaskById,
  updateTechnicianTaskStatus,
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
  id: t.taskId,
  type: t.type || "QC",
  title: t.description || t.type,
  date: t.plannedStart || t.createdAt,
  device: t.deviceName || t.taskCategoryName || "Thiết bị",
  location: t.location || "—",
  orderId: t.orderId,
  status: t.status,
  taskCategoryName: t.taskCategoryName,
});

const fmtStatus = (s) => {
  const v = String(s || "").toUpperCase();
  if (!v) return "";
  if (v.includes("PENDING")) return "PENDING";
  if (v.includes("IN_PROGRESS")) return "IN_PROGRESS";
  if (v.includes("COMPLETED") || v.includes("DONE")) return "COMPLETED";
  return v;
};

export default function TechnicianCalendar() {
  const [tasks, setTasks] = useState([]);
  const [tasksAll, setTasksAll] = useState([]);
  const [value, setValue] = useState(dayjs()); // ngày đang xem
  const [detailTask, setDetailTask] = useState(null); // task được click (đầy đủ từ API detail)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const [orderDetail, setOrderDetail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");

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

  // Load all tasks (pending + in_progress)
  useEffect(() => {
    (async () => {
      try {
        const [p, doing, done, cancelled] = await Promise.all([
          listTechnicianTasks(TECH_TASK_STATUS.PENDING),
          listTechnicianTasks(TECH_TASK_STATUS.IN_PROGRESS),
          listTechnicianTasks(TECH_TASK_STATUS.COMPLETED),
          listTechnicianTasks("CANCELLED"),
        ]);
        const calendarTasks = [...p, ...doing].map(taskToDisplay);
        setTasks(calendarTasks);
        const all = [...p, ...doing, ...done, ...cancelled].map(taskToDisplay);
        setTasksAll(all);
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không tải được nhiệm vụ");
      }
    })();
  }, []);

  // filter theo ngày chọn
  const selectedDate = value.format("YYYY-MM-DD");
  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => dayjs(t.date).format("YYYY-MM-DD") === selectedDate)
        .sort((a, b) => dayjs(a.date) - dayjs(b.date)),
    [tasks, selectedDate]
  );

  /** ---- Render lịch theo ngày ---- */
  const dateCellRender = (date) => {
    const items = tasks.filter((t) => dayjs(t.date).isSame(date, "day"));
    if (!items.length) return null;
    return (
      <ul style={{ paddingLeft: 12 }}>
        {items.slice(0, 3).map((t) => (
          <li key={t.id} style={{ cursor: "pointer" }} onClick={() => onClickTask(t)}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Badge color={TYPES[t.type]?.color} />
              <span style={{ fontWeight: 600 }}>
                {t.taskCategoryName || TYPES[t.type]?.label || t.type}
              </span>
              {t.status && (() => {
                const { bg, text } = getTechnicianStatusColor(t.status);
                return (
                  <Tag style={{ marginLeft: 4, backgroundColor: bg, color: text, border: 'none' }}>
                    {fmtStatus(t.status)}
                  </Tag>
                );
              })()}
            </div>
            <div style={{ marginLeft: 18, color: "#555" }}>
              {dayjs(t.date).format("HH:mm")} – {t.title}
            </div>
          </li>
        ))}
        {items.length > 3 && <Tag style={{ marginTop: 4 }}>+{items.length - 3}</Tag>}
      </ul>
    );
  };

  // Click item trên lịch hoặc danh sách → luôn mở Drawer
  const onClickTask = async (task) => {
    try {
      const full = await getTechnicianTaskById(task.id);
      setDetailTask(full || task);
      // fetch order by ID if exists
      const oid = (full || task)?.orderId;
      setOrderDetail(null);
      if (oid) viewOrderDetail(oid);
      setDrawerOpen(true);
    } catch {
      toast.error("Không tải được chi tiết task");
    }
  };

  const updateStatus = async (status) => {
    if (!detailTask?.taskId && !detailTask?.id) return;
    const id = detailTask.taskId || detailTask.id;
    try {
      const updated = await updateTechnicianTaskStatus(id, status);
      setDetailTask(updated || detailTask);

      const display = taskToDisplay(updated || detailTask);

      // Update calendar list (only PENDING/IN_PROGRESS)
      setTasks((prev) => {
        const keep = [TECH_TASK_STATUS.PENDING, TECH_TASK_STATUS.IN_PROGRESS].includes(
          String(display.status || '').toUpperCase()
        );
        const exists = prev.some((t) => t.id === id);
        if (keep) {
          return exists ? prev.map((t) => (t.id === id ? { ...t, ...display } : t)) : [...prev, display];
        }
        return prev.filter((t) => t.id !== id);
      });

      // Update All list
      setTasksAll((prev) => (prev.some((t) => t.id === id) ? prev.map((t) => (t.id === id ? { ...t, ...display } : t)) : [display, ...prev]));
      toast.success("Đã cập nhật trạng thái");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Cập nhật trạng thái thất bại");
    }
  };

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
          {dayjs(t.date).format("DD/MM/YYYY HH:mm")} • {t.location}
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
            <Descriptions.Item label="Mã đơn hàng">{t.orderId || "—"}</Descriptions.Item>
            <Descriptions.Item label="Số lượng">{t.quantity ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Thiết bị theo đơn">
              {Array.isArray(t.devices) ? t.devices.join(", ") : t.device}
            </Descriptions.Item>
            <Descriptions.Item label="Deadline">
              {t.deadline ? dayjs(t.deadline).format("DD/MM/YYYY HH:mm") : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Category">{t.category || "—"}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{t.location || "—"}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Space>
            <Button
              type="primary"
              onClick={() => navigate(`/technician/tasks/qc/:taskId`, { state: { task: t } })}
            >
              Thực hiện QC
            </Button>
            <Button onClick={() => updateStatus(TECH_TASK_STATUS.IN_PROGRESS)}>Bắt đầu</Button>
            <Button onClick={() => updateStatus(TECH_TASK_STATUS.COMPLETED)} type="dashed">Hoàn thành</Button>
            <Button danger onClick={() => updateStatus('CANCELLED')}>Hủy</Button>
            
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
      const next = dayjs(t.lastMaintainedAt).add(t.cycleDays || 30, "day");
      return (
        <>
          {header}
          <Divider />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Thiết bị">{t.device}</Descriptions.Item>
            <Descriptions.Item label="Category">{t.category}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{t.location}</Descriptions.Item>
            <Descriptions.Item label="Lần bảo trì gần nhất">
              {t.lastMaintainedAt
                ? dayjs(t.lastMaintainedAt).format("DD/MM/YYYY HH:mm")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Chu kỳ">
              {t.cycleDays} ngày
            </Descriptions.Item>
            <Descriptions.Item label="Dự kiến lần kế tiếp">
              {next.format("DD/MM/YYYY")}
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
              {dayjs(t.deliveryWindow?.start).format("DD/MM/YYYY HH:mm")} →{" "}
              {dayjs(t.deliveryWindow?.end).format("HH:mm")}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">{t.note || "—"}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Text type="secondary">
            *Xác nhận đã giao xong bằng app ký nhận/ảnh biên bản nếu cần (tích hợp sau).
          </Text>
          <Divider />
          <Space>
            <Button onClick={() => updateStatus(TECH_TASK_STATUS.IN_PROGRESS)}>Bắt đầu</Button>
            <Button onClick={() => updateStatus(TECH_TASK_STATUS.COMPLETED)} type="primary">Đánh dấu hoàn thành</Button>
            <Button danger onClick={() => updateStatus('CANCELLED')}>Hủy</Button>
      
          </Space>
        </>
      );
    }

    // Fallback generic detail for loại không xác định
    return (
      <>
        {header}
        <Divider />
        <Descriptions bordered size="small" column={1}>
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
                <Descriptions.Item label="Trạng thái">{orderDetail.status || orderDetail.orderStatus || "—"}</Descriptions.Item>
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
                <Descriptions.Item label="Thời gian">{orderDetail.startDate || "—"} → {orderDetail.endDate || "—"}</Descriptions.Item>
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
        <Space>
          <Button onClick={() => updateStatus(TECH_TASK_STATUS.IN_PROGRESS)}>Bắt đầu</Button>
          <Button onClick={() => updateStatus(TECH_TASK_STATUS.COMPLETED)} type="primary">Hoàn thành</Button>
          <Button danger onClick={() => updateStatus('CANCELLED')}>Hủy</Button>
         
        </Space>
      </>
    );
  };

  return (
    <>
      <Title level={3}>Lịch công việc kỹ thuật</Title>

      <Tabs
        defaultActiveKey="calendar"
        items={[
          {
            key: "calendar",
            label: "Lịch",
            children: (
              <>
                <Card>
                  <Calendar
                    value={value}
                    onSelect={setValue}
                    onPanelChange={setValue}
                    dateCellRender={dateCellRender}
                  />
                </Card>

                <Card className="mt-4" title={`Công việc ngày ${value.format("DD/MM/YYYY")}`}>
                  <List
                    dataSource={dayTasks}
                    locale={{ emptyText: "Không có công việc trong ngày" }}
                    renderItem={(t) => (
                      <List.Item onClick={() => onClickTask(t)} style={{ cursor: "pointer" }}>
                        <List.Item.Meta
                          title={
                            <Space>
                              <Tag color={TYPES[t.type]?.color}>{TYPES[t.type]?.label}</Tag>
                              <Text strong>{t.title}</Text>
                            </Space>
                          }
                          description={`${dayjs(t.date).format("HH:mm")} • ${t.device} • ${t.location}`}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </>
            ),
          },
          {
            key: "all",
            label: "Tất cả",
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <span>Lọc trạng thái:</span>
                  <Select
                    style={{ width: 200 }}
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { label: "Tất cả", value: "ALL" },
                      { label: "PENDING", value: TECH_TASK_STATUS.PENDING },
                      { label: "IN_PROGRESS", value: TECH_TASK_STATUS.IN_PROGRESS },
                      { label: "COMPLETED", value: TECH_TASK_STATUS.COMPLETED },
                      { label: "CANCELLED", value: "CANCELLED" },
                    ]}
                  />
                </Space>
                <Card>
                  <List
                    dataSource={tasksAll.filter((t) =>
                      filterStatus === "ALL" ? true : String(t.status).toUpperCase() === String(filterStatus).toUpperCase()
                    ).sort((a, b) => dayjs(b.date) - dayjs(a.date))}
                    renderItem={(t) => (
                      <List.Item onClick={() => onClickTask(t)} style={{ cursor: "pointer" }}>
                        <List.Item.Meta
                          title={
                            <Space>
                              <Tag color={TYPES[t.type]?.color}>{TYPES[t.type]?.label}</Tag>
                              <Text strong>{t.title}</Text>
                              {(() => { const { bg, text } = getTechnicianStatusColor(t.status); return (
                                <Tag style={{ backgroundColor: bg, color: text, border: 'none' }}>{fmtStatus(t.status)}</Tag>
                              ); })()}
                            </Space>
                          }
                          description={`${dayjs(t.date).format("DD/MM/YYYY HH:mm")} • ${t.device} • ${t.location}`}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />

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
