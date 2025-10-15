// src/pages/admin/AdminMaintenancePlanner.jsx
import React, { useState } from "react";
import { Card, Table, Button, Space, Modal, Form, Select, DatePicker, Input, Tag, Typography, message } from "antd";
import { PlusOutlined, CheckOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title } = Typography;

const DEVICES = [
  { value: 101, label: "Meta Quest 3 • MQ3-A12" },
  { value: 102, label: "PS5 • PS5-0001" },
  { value: 103, label: "Sony A7 IV • A7IV-1001" },
];

const statusTag = (s) => {
  switch (s) {
    case "planned": return <Tag>Planned</Tag>;
    case "in_progress": return <Tag color="blue">In Progress</Tag>;
    case "done": return <Tag color="green">Done</Tag>;
    case "cancelled": return <Tag color="red">Cancelled</Tag>;
    default: return <Tag>{s}</Tag>;
  }
};

export default function AdminMaintenancePlanner() {
  const [items, setItems] = useState([
    {
      maintenanceItemID: 1, deviceID: 103, reason: "Bảo trì định kỳ 30 ngày",
      plannedStart: "2025-10-04 10:00", plannedEnd: "2025-10-04 11:30",
      status: "planned", createdAt: "2025-09-20 08:00",
    },
  ]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const cols = [
    { title: "ID", dataIndex: "maintenanceItemID", width: 70 },
    { title: "Thiết bị", dataIndex: "deviceID", render: id => DEVICES.find(d => d.value === id)?.label },
    { title: "Lý do", dataIndex: "reason" },
    { title: "Bắt đầu", dataIndex: "plannedStart", width: 160 },
    { title: "Kết thúc", dataIndex: "plannedEnd", width: 160 },
    { title: "Trạng thái", dataIndex: "status", width: 130, render: statusTag },
    { title: "Tạo lúc", dataIndex: "createdAt", width: 160 },
    { title: "Kết quả", dataIndex: "outcomeNote", ellipsis: true },
    {
      title: "Thao tác", width: 160, fixed: "right",
      render: (_, r) => (
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => {
            setEditing(r);
            form.setFieldsValue({
              deviceID: r.deviceID,
              reason: r.reason,
              plannedStart: r.plannedStart ? dayjs(r.plannedStart) : null,
              plannedEnd: r.plannedEnd ? dayjs(r.plannedEnd) : null,
              status: r.status,
              outcomeNote: r.outcomeNote,
              completedAt: r.completedAt ? dayjs(r.completedAt) : null,
            });
            setOpen(true);
          }}>Sửa</Button>
          {r.status !== "done" && (
            <Button type="primary" icon={<CheckOutlined />} onClick={() => {
              setItems(prev => prev.map(x => x.maintenanceItemID === r.maintenanceItemID
                ? { ...x, status: "done", completedAt: dayjs().format("YYYY-MM-DD HH:mm") }
                : x
              ));
              message.success("Đã đánh dấu hoàn tất.");
            }}>Hoàn tất</Button>
          )}
        </Space>
      )
    }
  ];

  const submit = (v) => {
    const payload = {
      deviceID: v.deviceID,
      reason: v.reason?.trim(),
      plannedStart: v.plannedStart?.format("YYYY-MM-DD HH:mm"),
      plannedEnd: v.plannedEnd?.format("YYYY-MM-DD HH:mm"),
      status: v.status,
      outcomeNote: v.outcomeNote?.trim(),
      createdAt: dayjs().format("YYYY-MM-DD HH:mm"),
      completedAt: v.completedAt ? v.completedAt.format("YYYY-MM-DD HH:mm") : undefined,
    };

    if (editing) {
      setItems(prev => prev.map(x => x.maintenanceItemID === editing.maintenanceItemID
        ? { ...editing, ...payload }
        : x
      ));
      message.success("Đã cập nhật lịch bảo trì");
    } else {
      const id = Math.max(0, ...items.map(x => x.maintenanceItemID)) + 1;
      setItems(prev => [{ maintenanceItemID: id, ...payload }, ...prev]);
      message.success("Đã tạo lịch bảo trì");
    }
    setOpen(false); setEditing(null); form.resetFields();
  };

  return (
    <>
      <Title level={3}>Tạo & quản lý lịch bảo trì</Title>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
          Tạo lịch bảo trì
        </Button>
      </Space>

      <Card>
        <Table rowKey="maintenanceItemID" columns={cols} dataSource={items} pagination={{ pageSize: 8 }} scroll={{ x: 1100 }} />
      </Card>

      <Modal
        open={open}
        title={editing ? "Cập nhật Maintenance Item" : "Tạo Maintenance Item"}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="deviceID" label="Thiết bị" rules={[{ required: true }]}><Select options={DEVICES} showSearch optionFilterProp="label"/></Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input/></Form.Item>
          <Form.Item name="plannedStart" label="Bắt đầu" rules={[{ required: true }]}><DatePicker showTime style={{ width:"100%" }}/></Form.Item>
          <Form.Item name="plannedEnd" label="Kết thúc" rules={[{ required: true }]}><DatePicker showTime style={{ width:"100%" }}/></Form.Item>
          <Form.Item name="status" label="Trạng thái" initialValue="planned">
            <Select options={[
              { label: "Planned", value: "planned" },
              { label: "In Progress", value: "in_progress" },
              { label: "Done", value: "done" },
              { label: "Cancelled", value: "cancelled" },
            ]}/>
          </Form.Item>
          <Form.Item name="outcomeNote" label="Ghi chú kết quả"><Input.TextArea rows={3}/></Form.Item>
          <Form.Item name="completedAt" label="Hoàn tất lúc"><DatePicker showTime style={{ width:"100%" }}/></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
