/**
 * MyOrderComplaintsTab - Tab khiếu nại trong drawer chi tiết đơn hàng
 */
import React, { useState } from "react";
import {
  Typography,
  Tag,
  Button,
  List,
  Card,
  Form,
  Input,
  Select,
  Space,
  Empty,
  Skeleton,
  Modal,
  Divider,
  message,
} from "antd";
import {
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

// Map complaint status to display
const COMPLAINT_STATUS_MAP = {
  PENDING: { color: "orange", label: "Chờ xử lý" },
  IN_PROGRESS: { color: "blue", label: "Đang xử lý" },
  RESOLVED: { color: "green", label: "Đã giải quyết" },
  REJECTED: { color: "red", label: "Từ chối" },
  CLOSED: { color: "default", label: "Đã đóng" },
};

export default function MyOrderComplaintsTab({
  current,
  complaints,
  complaintsLoading,
  allocatedDevices,
  onCreateComplaint,
  onRefreshComplaints,
  creatingComplaint,
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Lấy danh sách thiết bị đã được gán cho đơn hàng
  const devices = allocatedDevices || [];
  
  // Lấy danh sách items (orderDetails mapped) để tìm tên model
  const orderItems = current?.items || [];

  // Hàm lấy tên mẫu thiết bị từ deviceModelId
  const getDeviceModelName = (deviceModelId) => {
    if (!deviceModelId) return null;
    // Tìm trong items (đã được gắn tên từ orderDetails)
    const matchingItem = orderItems.find(item => 
      item.deviceModelId === deviceModelId || 
      Number(item.deviceModelId) === Number(deviceModelId)
    );
    return matchingItem?.name || null;
  };

  // Tạo danh sách thiết bị kèm tên model
  const devicesWithModelName = devices.map(device => {
    const modelName = getDeviceModelName(device.deviceModelId);
    return {
      ...device,
      modelName,
      displayName: modelName 
        ? `${modelName} (SN: ${device.serialNumber || device.deviceId || device.id})`
        : `Thiết bị #${device.deviceId || device.id}${device.serialNumber ? ` (SN: ${device.serialNumber})` : ''}`
    };
  });

  const handleSubmit = async (values) => {
    try {
      await onCreateComplaint({
        orderId: current.id,
        deviceId: values.deviceId,
        customerDescription: values.customerDescription,
      });
      message.success("Tạo khiếu nại thành công!");
      setCreateModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không thể tạo khiếu nại"
      );
    }
  };

  const formatDateTime = (date) => {
    if (!date) return "—";
    return dayjs(date).format("DD/MM/YYYY HH:mm");
  };

  const getStatusTag = (status) => {
    const s = String(status || "").toUpperCase();
    const config = COMPLAINT_STATUS_MAP[s] || { color: "default", label: status || "—" };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          <ExclamationCircleOutlined style={{ marginRight: 8 }} />
          Khiếu nại của đơn hàng
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefreshComplaints}
            loading={complaintsLoading}
          >
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            disabled={devices.length === 0}
          >
            Tạo khiếu nại
          </Button>
        </Space>
      </div>

      {devices.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Đơn hàng chưa có thiết bị được gán nên không thể tạo khiếu nại.
          </Text>
        </div>
      )}

      {complaintsLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : complaints.length === 0 ? (
        <Empty description="Chưa có khiếu nại nào cho đơn hàng này" />
      ) : (
        <List
          dataSource={complaints}
          renderItem={(complaint) => (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              title={
                <Space>
                  <Text strong>Khiếu nại #{complaint.complaintId || complaint.id}</Text>
                  {getStatusTag(complaint.status)}
                </Space>
              }
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateTime(complaint.createdAt)}
                </Text>
              }
            >
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Thiết bị: </Text>
                <Text>
                  {complaint.deviceName || complaint.device?.name || `Thiết bị #${complaint.deviceId}`}
                </Text>
                {complaint.serialNumber && (
                  <Text type="secondary"> (SN: {complaint.serialNumber})</Text>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Mô tả khách hàng: </Text>
                <Text>{complaint.customerDescription || "—"}</Text>
              </div>
              {complaint.staffResponse && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <div>
                    <Text type="secondary">Phản hồi từ nhân viên: </Text>
                    <Text>{complaint.staffResponse}</Text>
                  </div>
                </>
              )}
              {complaint.resolvedAt && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Giải quyết lúc: </Text>
                  <Text>{formatDateTime(complaint.resolvedAt)}</Text>
                </div>
              )}
            </Card>
          )}
        />
      )}

      {/* Modal tạo khiếu nại mới */}
      <Modal
        title="Tạo khiếu nại mới"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="deviceId"
            label="Chọn thiết bị"
            rules={[{ required: true, message: "Vui lòng chọn thiết bị" }]}
          >
            <Select placeholder="Chọn thiết bị cần khiếu nại">
              {devicesWithModelName.map((device) => (
                <Select.Option key={device.deviceId || device.id} value={device.deviceId || device.id}>
                  {device.displayName}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="customerDescription"
            label="Mô tả vấn đề"
            rules={[
              { required: true, message: "Vui lòng mô tả vấn đề" },
              { min: 10, message: "Mô tả phải có ít nhất 10 ký tự" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Mô tả chi tiết vấn đề bạn gặp phải với thiết bị..."
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => {
                setCreateModalOpen(false);
                form.resetFields();
              }}>
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={creatingComplaint}>
                Gửi khiếu nại
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
