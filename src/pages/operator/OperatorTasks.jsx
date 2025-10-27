// src/pages/operator/OperatorTasks.jsx
import React, { useState, useEffect } from "react";
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  DatePicker, Select, Typography, Spin, InputNumber, Popconfirm,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast, { Toaster } from "react-hot-toast";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../../lib/taskApi";
import {
  listTaskCategories,
  normalizeTaskCategory,
} from "../../lib/taskCategoryApi";

const { Title } = Typography;
const { Option } = Select;

export default function OperatorTasks() {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // Load data từ API
  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, catsRes] = await Promise.all([
        listTasks(),
        listTaskCategories(),
      ]);
      setData(tasksRes);
      setCategories(catsRes.map(normalizeTaskCategory));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      taskCategoryId: undefined,
      orderId: undefined,
      assignedStaffId: undefined,
      type: "",
      description: "",
      plannedStart: dayjs(),
      plannedEnd: null,
    });
    setOpen(true);
  };

  const openEdit = (r) => {
    form.setFieldsValue({
      taskCategoryId: r.taskCategoryId,
      orderId: r.orderId,
      assignedStaffId: r.assignedStaffId,
      type: r.type || "",
      description: r.description || "",
      plannedStart: r.plannedStart ? dayjs(r.plannedStart) : null,
      plannedEnd: r.plannedEnd ? dayjs(r.plannedEnd) : null,
    });
    setEditing(r);
    setOpen(true);
  };

  const remove = async (r) => {
    const taskId = r.taskId;
    const prev = data;
    setData(prev.filter((x) => x.taskId !== taskId));
    try {
      await deleteTask(taskId);
      toast.success("Đã xoá task.");
      await loadData();
    } catch (e) {
      setData(prev);
      toast.error(e?.response?.data?.message || e?.message || "Xoá thất bại");
    }
  };

  const submit = async (vals) => {
    try {
      const payload = {
        taskCategoryId: vals.taskCategoryId,
        orderId: vals.orderId ? Number(vals.orderId) : undefined,
        assignedStaffId: vals.assignedStaffId ? Number(vals.assignedStaffId) : undefined,
        type: vals.type?.trim() || "",
        description: vals.description?.trim() || "",
        plannedStart: vals.plannedStart ? dayjs(vals.plannedStart).toISOString() : undefined,
        plannedEnd: vals.plannedEnd ? dayjs(vals.plannedEnd).toISOString() : undefined,
      };

      if (editing) {
        await updateTask(editing.taskId || editing.id, payload);
        toast.success("Đã cập nhật task.");
      } else {
        await createTask(payload);
        toast.success("Đã tạo task.");
      }

      setOpen(false);
      setEditing(null);
      form.resetFields();
      await loadData();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Lưu thất bại");
    }
  };

  const statusTag = (status) => {
    switch (status) {
      case "PENDING":
        return <Tag color="orange">Chờ thực hiện</Tag>;
      case "IN_PROGRESS":
        return <Tag color="blue">Đang thực hiện</Tag>;
      case "COMPLETED":
        return <Tag color="green">Hoàn thành</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    { title: "Task ID", dataIndex: "taskId", width: 80, sorter: (a, b) => a.taskId - b.taskId },
    {
      title: "Loại công việc",
      dataIndex: "taskCategoryName",
      key: "taskCategoryName",
      width: 150,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 120,
    },
    {
      title: "Người phụ trách",
      dataIndex: "assignedStaffName",
      key: "assignedStaffName",
      width: 150,
      render: (name) => name || "-",
    },
    {
      title: "Vai trò",
      dataIndex: "assignedStaffRole",
      key: "assignedStaffRole",
      width: 120,
      render: (role) => <Tag color="geekblue">{role || "-"}</Tag>,
    },
    {
      title: "Mã đơn",
      dataIndex: "orderId",
      key: "orderId",
      width: 120,
      render: (id) => id || "-",
    },
    {
      title: "Bắt đầu",
      dataIndex: "plannedStart",
      key: "plannedStart",
      width: 170,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Kết thúc",
      dataIndex: "plannedEnd",
      key: "plannedEnd",
      width: 170,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      filters: [
        { text: "Chờ thực hiện", value: "PENDING" },
        { text: "Đang thực hiện", value: "IN_PROGRESS" },
        { text: "Hoàn thành", value: "COMPLETED" },
      ],
      onFilter: (value, record) => record.status === value,
      render: statusTag,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 160,
      render: (_, r) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa task này?" onConfirm={() => remove(r)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Toaster position="top-center" />
      <Title level={3}>Quản lý nhiệm vụ</Title>

      <div className="mb-2">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm task
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table
          rowKey="taskId"
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1500 }}
        />
      </Spin>

      <Modal
        title={editing ? "Cập nhật task" : "Tạo task"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? "Lưu" : "Tạo"}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="Loại công việc"
            name="taskCategoryId"
            rules={[{ required: true, message: "Chọn loại công việc" }]}
          >
            <Select
              placeholder="Chọn loại công việc"
              options={categories.map((c) => ({
                label: c.name,
                value: c.taskCategoryId,
              }))}
            />
          </Form.Item>

          <Form.Item label="Mã đơn hàng" name="orderId">
            <InputNumber placeholder="Mã đơn hàng (optional)" style={{ width: "100%" }} min={0} />
          </Form.Item>

          <Form.Item label="ID nhân viên phụ trách" name="assignedStaffId">
            <InputNumber placeholder="ID nhân viên (optional)" style={{ width: "100%" }} min={1} />
          </Form.Item>

          <Form.Item
            label="Loại"
            name="type"
            rules={[{ required: true, message: "Nhập loại" }]}
          >
            <Input placeholder="VD: Rental QC, Setup, etc." />
          </Form.Item>

          <Form.Item
            label="Mô tả"
            name="description"
            rules={[{ required: true, message: "Nhập mô tả" }]}
          >
            <Input.TextArea rows={3} placeholder="Mô tả chi tiết" />
          </Form.Item>

          <Form.Item
            label="Ngày bắt đầu"
            name="plannedStart"
            rules={[{ required: true, message: "Chọn ngày bắt đầu" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
          </Form.Item>

          <Form.Item
            label="Ngày kết thúc"
            name="plannedEnd"
            rules={[{ required: true, message: "Chọn ngày kết thúc" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
