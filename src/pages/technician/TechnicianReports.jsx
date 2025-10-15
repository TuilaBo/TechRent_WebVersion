// src/pages/technician/TechnicianReports.jsx
import React from "react";
import {
  Card,
  Form,
  Input,
  DatePicker,
  Select,
  Upload,
  Button,
  message,
  Space,
  Typography,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Dragger } = Upload;
const { Title } = Typography;

/** Nguồn xuất phát */
const SOURCE_OPTIONS = [
  { label: "Handover", value: "handover" },
  { label: "QC", value: "qc" },
  { label: "Settlement", value: "settlement" },
];

/** Map nguồn -> loại thiết bị (mock; sau này thay bằng API) */
const DEVICE_BY_SOURCE = {
  handover: [
    "PS5 + TV 55\" 4K",
    "Meta Quest 3",
    "Bộ Micro không dây",
    "Màn hình 27\" 144Hz",
  ],
  qc: ["Meta Quest 3", "Sony A7 IV", "DJI Mini 4 Pro", "PS5"],
  settlement: ["Sony A7 IV", "DJI Mini 4 Pro", "GoPro Hero 12", "Lens 24-70"],
};

export default function TechnicianReports() {
  const [form] = Form.useForm();
  const source = Form.useWatch("source", form);

  const deviceOptionsBySource = (DEVICE_BY_SOURCE[source] || []).map((d) => ({
    label: d,
    value: d,
  }));

  const onSubmit = (v) => {
    const payload = {
      source: v.source, // handover | qc | settlement
      deviceType: v.deviceType,
      serial: v.serial?.trim(),
      content: v.content?.trim(),
      reportDate: v.reportDate?.toISOString(),
      // UI-only: lưu tên file; khi triển khai thật hãy upload trước & gửi URL
      attachments: (v.attachments || []).map((f) => f.name),
    };
    console.log("Error report payload:", payload);
    message.success("Đã gửi Biên bản sai sót (UI)");
    form.resetFields();
    form.setFieldsValue({ reportDate: dayjs() });
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 12 }}>
        Biên bản sai sót
      </Title>

      <Card>
        <Form
          layout="vertical"
          form={form}
          onFinish={onSubmit}
          initialValues={{ reportDate: dayjs() }}
        >
          {/* Nguồn xuất phát */}
          <Form.Item
            label="Nguồn xuất phát"
            name="source"
            rules={[{ required: true, message: "Chọn nguồn xuất phát" }]}
          >
            <Select placeholder="Chọn nguồn" options={SOURCE_OPTIONS} />
          </Form.Item>

          {/* Loại thiết bị theo nguồn */}
          <Form.Item
            label="Loại thiết bị"
            name="deviceType"
            dependencies={["source"]}
            rules={[{ required: true, message: "Chọn loại thiết bị" }]}
          >
            <Select
              placeholder={source ? "Chọn loại thiết bị" : "Hãy chọn nguồn trước"}
              disabled={!source}
              options={deviceOptionsBySource}
            />
          </Form.Item>

          {/* Serial number */}
          <Form.Item
            label="Serial number"
            name="serial"
            rules={[{ required: true, message: "Nhập serial number" }]}
          >
            <Input placeholder="VD: MQ3-A12 / A7IV-1001 / PS5-001..." />
          </Form.Item>

          {/* Nội dung sai sót */}
          <Form.Item
            label="Nội dung sai sót"
            name="content"
            rules={[{ required: true, message: "Nhập nội dung sai sót" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Mô tả chi tiết lỗi/sai sót, mức độ ảnh hưởng, đề xuất xử lý…"
            />
          </Form.Item>

          {/* Ảnh/Video bằng chứng */}
          <Form.Item
            label="Ảnh/Video bằng chứng (UI)"
            name="attachments"
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
          >
            <Dragger
              beforeUpload={() => false}
              multiple
              accept=".jpg,.jpeg,.png,.webp,.mp4,.pdf"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p>Kéo thả hoặc bấm để chọn</p>
            </Dragger>
          </Form.Item>

          {/* Ngày tạo */}
          <Form.Item
            label="Ngày tạo"
            name="reportDate"
            rules={[{ required: true, message: "Chọn ngày tạo" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Space>
            <Button type="primary" onClick={() => form.submit()}>
              Gửi
            </Button>
            <Button onClick={() => form.resetFields()}>Làm mới</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
