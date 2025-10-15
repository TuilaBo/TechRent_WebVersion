// src/pages/technician/TechnicianQcDetail.jsx
import React, { useMemo, useState } from "react";
import {
  Card, Descriptions, Typography, Tag, Space, Divider, Progress,
  Checkbox, Select, Input, Upload, Button, message, Row, Col, DatePicker
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { InboxOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Dragger } = Upload;

/** Checklist mẫu theo category */
const QC_CHECKLIST_BY_CATEGORY = {
  "VR/AR": ["Vệ sinh ống kính", "Test tracking", "Kiểm tra pin", "Kiểm tra dây cáp", "Update firmware"],
  "Console": ["Vệ sinh máy", "Test game demo", "Kiểm tra tay cầm", "Kiểm tra cổng HDMI", "Update hệ thống"],
  "Camera": ["Kiểm tra cảm biến", "Test màn trập", "Kiểm tra pin + sạc", "Kiểm tra thẻ nhớ", "Vệ sinh ống kính"],
  "Drone": ["Kiểm tra cánh quạt", "Test GPS", "Kiểm tra pin", "Hiệu chỉnh compa", "Test quay video"],
};

/** Fallback mock nếu vào trực tiếp */
function mockFromId(id) {
  return {
    id,
    type: "QC",
    title: "QC – Meta Quest 3",
    orderId: "TR-241001-023",
    quantity: 2,
    devices: ["Meta Quest 3 #A12", "Meta Quest 3 #B09"],
    category: "VR/AR",
    deadline: "2025-10-03 17:00",
    location: "Kho A",
    // Danh mục yêu cầu theo đơn (model + số lượng)
    orderItems: [
      { model: "Meta Quest 3", quantity: 2 },
      { model: "Controller Touch Plus (L/R)", quantity: 2 },
    ],
  };
}

export default function TechnicianQcDetail() {
  const nav = useNavigate();
  const { taskId } = useParams();
  const { state } = useLocation();

  // Lấy dữ liệu từ Calendar (state) hoặc mock
  const task = useMemo(() => {
    if (state?.task) {
      return {
        id: state.task.id,
        orderId: state.task.orderId || "TR-241001-023",
        quantity: state.task.quantity || 1,
        devices: state.task.devices || [state.task.device],
        category: state.task.category || "VR/AR",
        deadline: state.task.deadline || state.task.date,
        location: state.task.location,
        title: state.task.title,
        // Nếu operator/admin có trả kèm yêu cầu theo đơn thì dùng; nếu không tạo mặc định dựa trên device
        orderItems:
          state.task.orderItems ||
          [
            { model: state.task.device || "Meta Quest 3", quantity: state.task.quantity || 1 },
          ],
      };
    }
    return mockFromId(taskId);
  }, [state, taskId]);

  /** ---------- MOCK INVENTORY TRONG KHO ----------
   * Map: model -> danh sách serial/asset code có sẵn
   * (Sau này thay bằng API: GET /inventory?models=...)
   */
  const INVENTORY = useMemo(
    () => ({
      "Meta Quest 3": ["MQ3-A12", "MQ3-B09", "MQ3-C33", "MQ3-D07"],
      "Controller Touch Plus (L/R)": ["CTP-L01", "CTP-R01", "CTP-L02", "CTP-R02", "CTP-BK1"],
      "PS5": ["PS5-001", "PS5-002"],
      "Sony A7 IV": ["A7IV-1001", "A7IV-1002"],
    }),
    []
  );

  // ----- STATES -----
  const [checklistDone, setChecklistDone] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState("available");
  const [conclusion, setConclusion] = useState("pass");
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState(task.deadline ? dayjs(task.deadline) : null);

  // Chọn thiết bị từ kho theo từng model:
  // selectedDevicesByModel = { "Meta Quest 3": ["MQ3-A12", "MQ3-B09"], ... }
  const [selectedDevicesByModel, setSelectedDevicesByModel] = useState({});

  const checklist = QC_CHECKLIST_BY_CATEGORY[task.category] || [];
  const percent = Math.round((checklistDone.length / Math.max(1, checklist.length)) * 100);

  /** Gợi ý auto chọn đủ số lượng đầu tiên trong kho */
  const autoPick = () => {
    const next = { ...selectedDevicesByModel };
    task.orderItems.forEach(({ model, quantity }) => {
      const avail = INVENTORY[model] || [];
      next[model] = avail.slice(0, quantity);
    });
    setSelectedDevicesByModel(next);
    message.success("Đã gợi ý đủ số lượng từ kho (UI).");
  };

  /** Khi chọn thay đổi per-model, giữ không vượt quá số lượng yêu cầu */
  const onChangeModelPick = (model, quantity, values) => {
    if (values.length > quantity) {
      message.warning(`Chỉ cần ${quantity} thiết bị cho "${model}".`);
      values = values.slice(0, quantity);
    }
    setSelectedDevicesByModel((prev) => ({ ...prev, [model]: values }));
  };

  /** Validate số lượng chọn đủ chưa */
  const isPickComplete = () => {
    return task.orderItems.every(({ model, quantity }) => {
      const picked = selectedDevicesByModel[model] || [];
      return picked.length === quantity;
    });
  };

  const onSave = () => {
    if (!isPickComplete()) {
      message.error("Bạn chưa chọn đủ thiết bị từ kho theo từng loại trong đơn.");
      return;
    }

    const payload = {
      taskId,
      orderId: task.orderId,
      orderItems: task.orderItems,
      selectedDevicesByModel, // chọn cụ thể từ kho
      category: task.category,
      deadline: deadline?.toISOString(),
      checklistDone,
      conclusion,
      deviceStatus,
      note: note?.trim(),
    };

    console.log("QC submit payload:", payload);
    message.success("Đã lưu kết quả QC (UI)");
  };

  return (
    <div className="min-h-screen">
      <Space align="center" style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>
          Quay lại
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          Chi tiết QC
        </Title>
        <Tag color="blue">CHECK QC</Tag>
      </Space>

      {/* Thông tin đơn hàng */}
      <Card title="Thông tin đơn & thiết bị" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã đơn">{task.orderId}</Descriptions.Item>
          <Descriptions.Item label="Số lượng">{task.quantity}</Descriptions.Item>
          <Descriptions.Item label="Thiết bị theo đơn" span={2}>
            {Array.isArray(task.devices) ? task.devices.join(", ") : task.devices}
          </Descriptions.Item>
          <Descriptions.Item label="Category">{task.category}</Descriptions.Item>
          <Descriptions.Item label="Địa điểm">{task.location || "—"}</Descriptions.Item>
          <Descriptions.Item label="Deadline" span={2}>
            <DatePicker
              showTime
              value={deadline}
              onChange={setDeadline}
              style={{ width: "100%" }}
            />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Chọn thiết bị từ kho theo từng loại trong đơn */}
      <Card
        title={
          <Space>
            Chọn thiết bị từ kho theo đơn
            <Button onClick={autoPick}>Gợi ý đủ số lượng</Button>
          </Space>
        }
        className="mb-3"
      >
        <Row gutter={[16, 16]}>
          {task.orderItems.map(({ model, quantity }) => {
            const options = (INVENTORY[model] || []).map((serial) => ({
              label: serial,
              value: serial,
            }));
            const picked = selectedDevicesByModel[model] || [];
            const ok = picked.length === quantity;

            return (
              <Col xs={24} md={12} key={model}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <Text strong>{model}</Text>
                      <Tag color={ok ? "green" : "gold"}>
                        {picked.length}/{quantity} đã chọn
                      </Tag>
                    </Space>
                  }
                >
                  <Select
                    mode="multiple"
                    placeholder={`Chọn ${quantity} thiết bị từ kho`}
                    style={{ width: "100%" }}
                    value={picked}
                    onChange={(vals) => onChangeModelPick(model, quantity, vals)}
                    options={options}
                    maxTagCount="responsive"
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
        {!isPickComplete() && (
          <div style={{ marginTop: 8 }}>
            <Text type="warning">*Vui lòng chọn đủ số lượng cho từng loại.</Text>
          </div>
        )}
      </Card>

      {/* Checklist + Kết luận */}
      <Card title="Checklist & Kết luận" className="mb-3">
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
              {checklist.length ? (
                checklist.map((item) => (
                  <Checkbox key={item} value={item}>
                    {item}
                  </Checkbox>
                ))
              ) : (
                <Text type="secondary">Chưa có checklist cho category này.</Text>
              )}
            </Space>
          </Checkbox.Group>

          <Divider />

          <Space size="large" wrap>
            <div>
              <Text strong>Kết luận QC</Text>
              <div>
                <Select
                  value={conclusion}
                  onChange={setConclusion}
                  options={[
                    { label: "Đạt", value: "pass" },
                    { label: "Không đạt", value: "fail" },
                    { label: "Cần theo dõi", value: "watch" },
                  ]}
                  style={{ width: 200 }}
                />
              </div>
            </div>

            <div>
              <Text strong>Trạng thái thiết bị</Text>
              <div>
                <Select
                  value={deviceStatus}
                  onChange={setDeviceStatus}
                  options={[
                    { label: "Available", value: "available" },
                    { label: "In maintenance", value: "maintenance" },
                    { label: "Broken", value: "broken" },
                    { label: "Rented", value: "rented" },
                  ]}
                  style={{ width: 220 }}
                />
              </div>
            </div>
          </Space>

          <div style={{ marginTop: 12, width: "100%" }}>
            <Text strong>Ghi chú</Text>
            <Input.TextArea
              rows={3}
              placeholder="Ghi chú bổ sung…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </Space>
      </Card>

      {/* Media bằng chứng */}
      <Card title="Ảnh/Video bằng chứng (UI)" className="mb-3">
        <Dragger
          beforeUpload={() => false}
          multiple
          accept=".jpg,.jpeg,.png,.webp,.mp4,.pdf"
          onChange={() => message.success("Đã thêm file (UI).")}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p>Kéo thả hoặc bấm để chọn</p>
        </Dragger>
      </Card>

      <Space>
        <Button onClick={() => nav(-1)}>Hủy</Button>
        <Button type="primary" onClick={onSave}>
          Lưu kết quả QC
        </Button>
      </Space>
    </div>
  );
}
