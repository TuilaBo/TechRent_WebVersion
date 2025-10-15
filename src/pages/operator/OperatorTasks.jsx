// src/pages/operator/OperatorTasks.jsx
import React, { useState } from "react";
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  DatePicker, Select, Typography, message,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title } = Typography;
const { Option } = Select;

// Chỉ có 2 bộ phận như yêu cầu
const DEPARTMENTS = ["CSKH", "Kỹ thuật"];

// Map bộ phận -> danh sách loại công việc cho phép
const ROLE_WORK_TYPES = {
  CSKH: ["Gọi điện", "Tư vấn"],
  "Kỹ thuật": ["Chuẩn bị hàng", "Kiểm tra thiết bị", "Giao hàng", "Thu hồi", "Khác"],
};

// dữ liệu mẫu
const INIT = [
  {
    id: 1,
    title: "Gọi xác nhận đơn TR-241001-023",
    department: "CSKH",
    assignee: "Tuấn",
    deadline: "2025-10-02 10:00",
    status: "todo",
    workType: "Gọi điện",
    createdAt: "2025-10-01 09:20",
  },
  {
    id: 2,
    title: "Chuẩn bị bộ PS5 + TV giao Quận 3",
    department: "Kỹ thuật",
    assignee: "Linh",
    deadline: "2025-10-02 13:00",
    status: "doing",
    workType: "Chuẩn bị hàng",
    createdAt: "2025-10-01 11:00",
  },
];

function fmt(d) {
  return d ? dayjs(d).format("YYYY-MM-DD HH:mm") : "";
}

export default function OperatorTasks() {
  const [data, setData] = useState(INIT);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // watch để điều khiển field phụ thuộc
  const currentDept = Form.useWatch("department", form);
  const currentType = Form.useWatch("workType", form);
  const currentQcPhase = Form.useWatch("qcPhase", form); // 'pre' | 'post'
  const workTypeOptions = currentDept ? ROLE_WORK_TYPES[currentDept] || [] : [];

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      title: "",
      department: undefined,
      assignee: "",
      deadline: null,
      status: "todo",
      workType: undefined,
      qcPhase: undefined,   // chọn loại kiểm tra
      orderId: undefined,   // mã đơn (xuất hiện theo điều kiện)
      createdAt: dayjs(),
    });
    setOpen(true);
  };

  const openEdit = (r) => {
    const validTypes = ROLE_WORK_TYPES[r.department] || [];
    form.setFieldsValue({
      title: r.title,
      department: r.department,
      assignee: r.assignee,
      deadline: r.deadline ? dayjs(r.deadline) : null,
      status: r.status,
      workType: validTypes.includes(r.workType) ? r.workType : undefined,
      qcPhase: r.workType === "Kiểm tra thiết bị" ? r.qcPhase : undefined,
      // Mã đơn: xuất hiện khi Giao hàng, Thu hồi, hoặc Kiểm tra thiết bị (đã chọn pre/post)
      orderId:
        (r.workType === "Giao hàng" ||
         r.workType === "Thu hồi" ||
         (r.workType === "Kiểm tra thiết bị" && r.qcPhase))
          ? r.orderId
          : undefined,
      createdAt: r.createdAt ? dayjs(r.createdAt) : dayjs(),
    });
    setEditing(r);
    setOpen(true);
  };

  const remove = (r) => {
    Modal.confirm({
      title: "Xoá task?",
      onOk: () => {
        setData((prev) => prev.filter((x) => x.id !== r.id));
        message.success("Đã xoá task.");
      },
    });
  };

  const submit = (vals) => {
    // Cần mã đơn khi:
    // - workType = "Giao hàng" hoặc "Thu hồi"
    // - hoặc workType = "Kiểm tra thiết bị" và đã chọn qcPhase (trước/sau khi giao)
    const needOrderId =
      vals.workType === "Giao hàng" ||
      vals.workType === "Thu hồi" ||
      (vals.workType === "Kiểm tra thiết bị" && !!vals.qcPhase);

    const payload = {
      title: vals.title?.trim(),
      department: vals.department,
      assignee: vals.assignee?.trim(),
      deadline: fmt(vals.deadline),
      status: vals.status,
      workType: vals.workType,
      qcPhase: vals.workType === "Kiểm tra thiết bị" ? vals.qcPhase : undefined,
      orderId: needOrderId ? vals.orderId?.trim() : undefined,
      createdAt: fmt(vals.createdAt || dayjs()),
    };

    if (editing) {
      setData((prev) =>
        prev.map((x) => (x.id === editing.id ? { ...x, ...payload } : x))
      );
      message.success("Đã cập nhật task.");
    } else {
      const id = Math.max(0, ...data.map((x) => x.id)) + 1;
      setData((prev) => [{ id, ...payload }, ...prev]);
      message.success("Đã tạo task.");
    }
    setOpen(false);
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70, sorter: (a, b) => a.id - b.id },
    { title: "Tiêu đề", dataIndex: "title", ellipsis: true },
    {
      title: "Bộ phận phụ trách",
      dataIndex: "department",
      width: 130,
      filters: DEPARTMENTS.map((d) => ({ text: d, value: d })),
      onFilter: (v, r) => r.department === v,
    },
    { title: "Người nào", dataIndex: "assignee", width: 120 },
    { title: "Deadline", dataIndex: "deadline", width: 170 },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 120,
      filters: [
        { text: "Chưa làm", value: "todo" },
        { text: "Đang làm", value: "doing" },
        { text: "Hoàn thành", value: "done" },
      ],
      onFilter: (v, r) => r.status === v,
      render: (s) =>
        s === "done" ? (
          <Tag color="green">Hoàn thành</Tag>
        ) : s === "doing" ? (
          <Tag color="blue">Đang làm</Tag>
        ) : (
          <Tag>Chưa làm</Tag>
        ),
    },
    { title: "Loại công việc", dataIndex: "workType", width: 160 },
    {
      title: "Loại kiểm tra",
      dataIndex: "qcPhase",
      width: 140,
      render: (v, r) =>
        r.workType === "Kiểm tra thiết bị" && v ? (
          <Tag color={v === "pre" ? "gold" : "purple"}>
            {v === "pre" ? "Trước khi giao" : "Sau khi giao"}
          </Tag>
        ) : (
          "-"
        ),
    },
    {
      title: "Mã đơn",
      dataIndex: "orderId",
      width: 180,
      render: (v, r) =>
        (r.workType === "Giao hàng" ||
          r.workType === "Thu hồi" ||
          (r.workType === "Kiểm tra thiết bị" && r.qcPhase)) && v
          ? v
          : "-",
    },
    { title: "Ngày tạo task", dataIndex: "createdAt", width: 170 },
    {
      title: "Thao tác",
      width: 160,
      fixed: "right",
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
      <Title level={3}>Quản lý nhiệm vụ</Title>

      <div className="mb-2">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm task
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editing ? "Cập nhật task" : "Tạo task"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? "Lưu" : "Tạo"}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="Mô tả"
            name="title"
            rules={[{ required: true, message: "Vui lòng nhập Mô tả" }]}
          >
            <Input placeholder="Nhập mô tả ngắn gọn" />
          </Form.Item>

          <Form.Item
            label="Bộ phận phụ trách"
            name="department"
            rules={[{ required: true, message: "Chọn bộ phận" }]}
          >
            <Select
              placeholder="Chọn bộ phận"
              onChange={() =>
                form.setFieldsValue({ workType: undefined, qcPhase: undefined, orderId: undefined })
              }
              options={DEPARTMENTS.map((d) => ({ label: d, value: d }))}
            />
          </Form.Item>

          <Form.Item
            label="Người nào"
            name="assignee"
            rules={[{ required: true, message: "Nhập người phụ trách" }]}
          >
            <Input placeholder="Tên nhân sự" />
          </Form.Item>

          <Form.Item label="Deadline" name="deadline">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Trạng thái" name="status" initialValue="todo">
            <Select
              options={[
                { label: "Chưa làm", value: "todo" },
                { label: "Đang làm", value: "doing" },
                { label: "Hoàn thành", value: "done" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Loại công việc"
            name="workType"
            rules={[{ required: true, message: "Chọn loại công việc" }]}
          >
            <Select
              placeholder={currentDept ? "Chọn loại công việc" : "Chọn bộ phận trước"}
              disabled={!currentDept}
              onChange={() => {
                // reset field phụ thuộc khi đổi loại công việc
                form.setFieldsValue({ orderId: undefined, qcPhase: undefined });
              }}
            >
              {workTypeOptions.map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Nếu là Kiểm tra thiết bị → chọn Loại kiểm tra */}
          {currentType === "Kiểm tra thiết bị" && (
            <Form.Item
              label="Loại kiểm tra"
              name="qcPhase"
              rules={[{ required: true, message: "Chọn loại kiểm tra" }]}
            >
              <Select
                options={[
                  { label: "Trước khi giao", value: "pre" },
                  { label: "Sau khi giao", value: "post" },
                ]}
                placeholder="Chọn loại kiểm tra"
              />
            </Form.Item>
          )}

          {/* MÃ ĐƠN HÀNG:
              - Hiện khi Giao hàng
              - Hiện khi Thu hồi
              - Hoặc khi Kiểm tra thiết bị MÀ đã chọn Loại kiểm tra (pre/post)
          */}
          {(currentType === "Giao hàng" ||
            currentType === "Thu hồi" ||
            (currentType === "Kiểm tra thiết bị" && currentQcPhase)) && (
            <Form.Item
              label="Mã đơn hàng"
              name="orderId"
              rules={[{ required: true, message: "Nhập mã đơn hàng" }]}
            >
              <Input placeholder="VD: TR-241001-023" />
            </Form.Item>
          )}

          <Form.Item label="Ngày tạo task" name="createdAt">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
