// src/pages/technician/TechnicianCalendar.jsx
import React, { useMemo, useState } from "react";
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
} from "antd";
import {
  PlusOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
const { Dragger } = Upload;

/** ----- Loại task & màu sắc ----- */
const TYPES = {
  QC: { color: "blue", label: "CHECK QC outbound" },
  HANDOVER_CHECK: { color: "geekblue", label: "CHECK BIÊN BẢN" },
  MAINTAIN: { color: "orange", label: "BẢO TRÌ THIẾT BỊ" },
  DELIVERY: { color: "green", label: "ĐI GIAO THIẾT BỊ" },
};

/** ----- Mock task: được GIAO bởi operator/admin ----- */
const INIT = [
  // QC có dữ liệu đơn để sang trang chi tiết
  {
    id: 1,
    type: "QC",
    title: "QC – Meta Quest 3",
    date: "2025-10-03 09:00",
    // Thông tin đơn hàng cho QC
    orderId: "TR-241001-023",
    quantity: 2,
    devices: ["Meta Quest 3 #A12", "Meta Quest 3 #B09"],
    deadline: "2025-10-03 17:00",
    // Hiển thị ngắn trên lịch
    device: "Meta Quest 3",
    category: "VR/AR",
    location: "Kho A",
    assignedBy: "operator",
  },
  {
    id: 2,
    type: "HANDOVER_CHECK",
    title: "Check Handover – TR-241001-023",
    date: "2025-10-03 14:00",
    device: 'PS5 + TV 55" 4K',
    location: "Quận 3",
    orderId: "TR-241001-023",
    assignedBy: "operator",
    handovers: [
      { id: "H1", name: "Biên bản giao 1", status: "đã ký", url: "https://picsum.photos/seed/h1/900/500" },
      { id: "H2", name: "Biên bản giao 2", status: "chờ ký", url: "" },
    ],
  },
  // Admin tạo lịch cố định
  {
    id: 3,
    type: "MAINTAIN",
    title: "Bảo trì – Sony A7 IV",
    date: "2025-10-04 10:00",
    device: "Sony A7 IV",
    category: "Camera",
    location: "Kho B",
    assignedBy: "admin",
    lastMaintainedAt: "2025-09-20 15:00",
    cycleDays: 30,
  },
  // Operator giao nhiệm vụ đi giao
  {
    id: 4,
    type: "DELIVERY",
    title: "Giao thiết bị – Đơn TR-241005-002",
    date: "2025-10-05 09:30",
    device: "DJI Mini 4 Pro",
    orderId: "TR-241005-002",
    customer: "Nguyễn Minh",
    phone: "09xx xxx 789",
    address: "12 Nguyễn Trãi, Q.1, TP.HCM",
    location: "TP.HCM",
    assignedBy: "operator",
    deliveryWindow: { start: "2025-10-05 09:30", end: "2025-10-05 10:30" },
    note: "Gọi khách trước 15 phút",
  },
];

export default function TechnicianCalendar() {
  const [tasks] = useState(INIT);
  const [value, setValue] = useState(dayjs()); // ngày đang xem
  const [detailTask, setDetailTask] = useState(null); // task được click
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

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
            <Badge color={TYPES[t.type]?.color} text={`${dayjs(t.date).format("HH:mm")} ${t.title}`} />
          </li>
        ))}
        {items.length > 3 && <Tag style={{ marginTop: 4 }}>+{items.length - 3}</Tag>}
      </ul>
    );
  };

  // Click item trên lịch hoặc danh sách → luôn mở Drawer
  const onClickTask = (task) => {
    setDetailTask(task);
    setDrawerOpen(true);
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
        <Tag color={TYPES[t.type]?.color}>{TYPES[t.type]?.label}</Tag>
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
        </>
      );
    }

    return null;
  };

  return (
    <>
      {/* Thanh công cụ nhỏ (tuỳ chọn tạo nhanh, chỉ UI) */}
                <Title level={3}>Lịch công việc kỹ thuật</Title>

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
