// src/pages/operator/OperatorShifts.jsx
import React, { useState } from "react";
import { Table, Button, Space, Tag, Modal, Form, Input, TimePicker, DatePicker, Typography, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
const { Title } = Typography;

const INIT = [
  { id: 101, date: "2025-10-02", start: "08:00", end: "16:00", operator: "Tuấn", note: "Ca sáng" },
  { id: 102, date: "2025-10-02", start: "16:00", end: "22:00", operator: "Linh", note: "Ca chiều" },
];

export default function OperatorShifts() {
  const [data, setData] = useState(INIT);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      date: dayjs(r.date),
      start: dayjs(r.start, "HH:mm"),
      end: dayjs(r.end, "HH:mm"),
      operator: r.operator,
      note: r.note,
    });
    setOpen(true);
  };

  const remove = (r) => {
    Modal.confirm({
      title: "Xoá ca làm?",
      onOk: () => {
        setData((prev) => prev.filter((x) => x.id !== r.id));
        message.success("Đã xoá.");
      },
    });
  };

  const submit = (vals) => {
    const payload = {
      date: vals.date?.format("YYYY-MM-DD"),
      start: vals.start?.format("HH:mm"),
      end: vals.end?.format("HH:mm"),
      operator: vals.operator,
      note: vals.note,
    };

    if (editing) {
      setData(prev => prev.map(x => x.id === editing.id ? { ...x, ...payload } : x));
      message.success("Đã cập nhật ca.");
    } else {
      const id = Math.max(0, ...data.map(x => x.id)) + 1;
      setData(prev => [...prev, { id, ...payload }]);
      message.success("Đã tạo ca.");
    }
    setOpen(false);
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Ngày", dataIndex: "date", width: 140 },
    { title: "Bắt đầu", dataIndex: "start", width: 100 },
    { title: "Kết thúc", dataIndex: "end", width: 100 },
    { title: "Nhân sự", dataIndex: "operator", width: 140 },
    { title: "Ghi chú", dataIndex: "note" },
    {
      title: "Trạng thái",
      width: 140,
      render: (_, r) => {
        const now = dayjs();
        const start = dayjs(`${r.date} ${r.start}`);
        const end = dayjs(`${r.date} ${r.end}`);
        return now.isBefore(start) ? <Tag>Chưa bắt đầu</Tag>
          : now.isAfter(end) ? <Tag color="green">Đã kết thúc</Tag>
          : <Tag color="blue">Đang diễn ra</Tag>;
      },
    },
    {
      title: "Thao tác",
      width: 160,
      render: (_, r) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => remove(r)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Title level={3}>Quản lý ca làm</Title>
      <div className="mb-2">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm ca
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} pagination={{ pageSize: 8 }} />

      <Modal
        title={editing ? "Cập nhật ca" : "Tạo ca mới"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="Ngày" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Bắt đầu" name="start" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Kết thúc" name="end" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Nhân sự" name="operator" rules={[{ required: true }]}>
            <Input placeholder="Tên nhân sự" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
