// src/pages/operator/OperatorTasks.jsx
import React, { useState, useEffect } from "react";
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  DatePicker, Select, Typography, Spin, InputNumber, Popconfirm, Tooltip,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
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
import { listActiveStaff } from "../../lib/staffManage";
import { getRentalOrderById, listRentalOrders } from "../../lib/rentalOrdersApi";

const { Title } = Typography;
const { Option } = Select;

export default function OperatorTasks() {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [staffs, setStaffs] = useState([]); // for assignedStaffId selection
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [orderMap, setOrderMap] = useState({});
  const [orders, setOrders] = useState([]); // for orderId selection
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderViewing, setOrderViewing] = useState(null);

  // Load data từ API
  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, catsRes, staffRes, ordersRes] = await Promise.all([
        listTasks(),
        listTaskCategories(),
        listActiveStaff().catch(() => []),
        listRentalOrders().catch(() => []),
      ]);
      const sortedTasks = (Array.isArray(tasksRes) ? tasksRes : []).slice().sort((a, b) => {
        const statusA = String(a?.status || "").toUpperCase();
        const statusB = String(b?.status || "").toUpperCase();
        const isPendingA = statusA === "PENDING";
        const isPendingB = statusB === "PENDING";
        
        // Ưu tiên PENDING lên đầu
        if (isPendingA && !isPendingB) return -1;
        if (!isPendingA && isPendingB) return 1;
        
        // Nếu cùng status (hoặc cả hai đều không phải PENDING), sort mới nhất lên đầu
        const ta = new Date(a?.createdAt || a?.updatedAt || a?.plannedStart || 0).getTime();
        const tb = new Date(b?.createdAt || b?.updatedAt || b?.plannedStart || 0).getTime();
        if (tb !== ta) return tb - ta; // newest first
        return (b?.taskId || b?.id || 0) - (a?.taskId || a?.id || 0);
      });
      setData(sortedTasks);
      setCategories(catsRes.map(normalizeTaskCategory));
      setStaffs(Array.isArray(staffRes) ? staffRes : []);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);

      const ids = Array.from(new Set((tasksRes || []).map((t) => t.orderId).filter(Boolean)));
      if (ids.length) {
        const pairs = await Promise.all(ids.map(async (oid) => {
          try { const o = await getRentalOrderById(oid); return [oid, o]; } catch { return [oid, null]; }
        }));
        setOrderMap(Object.fromEntries(pairs));
      } else {
        setOrderMap({});
      }
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
      assignedStaffIds: [],
      type: "",
      description: "",
      plannedStart: dayjs(),
      plannedEnd: null,
    });
    setOpen(true);
  };

  const openEdit = (r) => {
    // Chuẩn hoá danh sách staffId từ dữ liệu cũ (1 người) và mới (nhiều người)
    const staffIds = Array.isArray(r.assignedStaff)
      ? r.assignedStaff.map((s) => s.staffId)
      : (r.assignedStaffId ? [r.assignedStaffId] : []);

    form.setFieldsValue({
      taskCategoryId: r.taskCategoryId,
      orderId: r.orderId,
      assignedStaffIds: staffIds,
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
      if (editing) {
        // Khi update: không gửi orderId vì backend không cho phép thay đổi
        const updatePayload = {
          taskCategoryId: vals.taskCategoryId,
          assignedStaffIds: Array.isArray(vals.assignedStaffIds) ? vals.assignedStaffIds.map(Number) : [],
          type: vals.type?.trim() || "",
          description: vals.description?.trim() || "",
          plannedStart: vals.plannedStart ? dayjs(vals.plannedStart).toISOString() : undefined,
          plannedEnd: vals.plannedEnd ? dayjs(vals.plannedEnd).toISOString() : undefined,
        };
        await updateTask(editing.taskId || editing.id, updatePayload);
        toast.success("Đã cập nhật task.");
      } else {
        // Khi tạo mới: có thể gửi orderId
        const createPayload = {
          taskCategoryId: vals.taskCategoryId,
          orderId: vals.orderId ? Number(vals.orderId) : undefined,
          assignedStaffIds: Array.isArray(vals.assignedStaffIds) ? vals.assignedStaffIds.map(Number) : [],
          type: vals.type?.trim() || "",
          description: vals.description?.trim() || "",
          plannedStart: vals.plannedStart ? dayjs(vals.plannedStart).toISOString() : undefined,
          plannedEnd: vals.plannedEnd ? dayjs(vals.plannedEnd).toISOString() : undefined,
        };
        await createTask(createPayload);
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
    { 
      title: "ID", 
      dataIndex: "taskId", 
      width: 70, 
      sorter: (a, b) => a.taskId - b.taskId,
      render: (v) => <strong>#{v}</strong>,
    },
    {
      title: "Đơn hàng",
      key: "order",
      width: 160,
      render: (_, r) => {
        const id = r.orderId;
        const st = id ? (orderMap[id]?.status || orderMap[id]?.orderStatus || null) : null;
        if (!id) return "-";
        const upper = String(st || "").toUpperCase();
        const color =
          upper.includes("PENDING") ? "orange" :
          upper.includes("CONFIRM") ? "blue" :
          upper.includes("CANCEL") ? "red" :
          (upper.includes("DONE") || upper.includes("COMPLETE")) ? "green" :
          "default";
        const label =
          upper.includes("PENDING") ? "Đang chờ" :
          upper.includes("READY_FOR_DELIVERY") ? "Sẵn sàng giao" :
          upper.includes("DELIVERY_CONFIRMED") ? "Đã xác nhận giao" :
          upper.includes("CONFIRM") ? "Đã xác nhận" :
          upper.includes("CANCEL") ? "Đã hủy" :
          (upper.includes("DONE") || upper.includes("COMPLETE")) ? "Hoàn tất" :
          (st || "-");
        return (
          <Space direction="vertical" size="small">
            <Space>
              <span>#{id}</span>
              <Button 
                size="small" 
                type="link"
                style={{ padding: 0, height: 'auto' }}
                onClick={async () => {
                  if (!orderMap[id]) {
                    try {
                      const o = await getRentalOrderById(id);
                      setOrderMap((m) => ({ ...m, [id]: o }));
                      setOrderViewing(o);
                    } catch {
                      toast.error("Không tải được đơn hàng");
                      return;
                    }
                  } else {
                    setOrderViewing(orderMap[id]);
                  }
                  setOrderModalOpen(true);
                }}
              >
                Xem
              </Button>
            </Space>
            {st && (
              <Tag color={color} style={{ margin: 0 }}>{label}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "Loại công việc",
      dataIndex: "taskCategoryName",
      key: "taskCategoryName",
      width: 150,
      ellipsis: true,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      width: 240,
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip title={text} placement="topLeft">
          <span>{text || "-"}</span>
        </Tooltip>
      ),
    },
    {
      title: "Người phụ trách",
      key: "assignee",
      width: 170,
      render: (_, r) => {
        const staffList = Array.isArray(r.assignedStaff) ? r.assignedStaff : [];
        if (staffList.length === 0) {
          // Fallback dữ liệu cũ 1 người
          const name = r.assignedStaffName;
          const role = r.assignedStaffRole;
          if (!name && !role) return "-";
          return (
            <div>
              <div>{name || "-"}</div>
              {role && <Tag color="geekblue" style={{ marginTop: 4 }}>{role}</Tag>}
            </div>
          );
        }
        return (
          <Space direction="vertical" size="small">
            {staffList.map((staff) => (
              <div key={staff.staffId}>
                <div>{staff.staffName || "-"}</div>
                {staff.staffRole && <Tag color="geekblue" style={{ marginTop: 4 }}>{staff.staffRole}</Tag>}
              </div>
            ))}
          </Space>
        );
      },
    },
    {
      title: "Thời gian",
      key: "timeRange",
      width: 220,
      render: (_, r) => {
        const start = r.plannedStart ? dayjs(r.plannedStart).format("DD/MM/YYYY HH:mm") : "-";
        const end = r.plannedEnd ? dayjs(r.plannedEnd).format("DD/MM/YYYY HH:mm") : "-";
        return (
          <div style={{ fontSize: "12px", lineHeight: "1.5" }}>
            <div><strong>Bắt đầu:</strong> {start}</div>
            <div><strong>Kết thúc:</strong> {end}</div>
          </div>
        );
      },
    },
    {
      title: "Trạng thái task",
      dataIndex: "status",
      key: "status",
      width: 140,
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
      width: 140,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa task này?" onConfirm={() => remove(r)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
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

      <Spin spinning={loading}>
        <Table
          rowKey="taskId"
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
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

          <Form.Item 
            label="Mã đơn hàng" 
            name="orderId"
            tooltip={editing ? "Không thể thay đổi mã đơn hàng sau khi tạo task" : undefined}
          >
            <Select
              disabled={!!editing}
              allowClear
              placeholder="Chọn mã đơn (tuỳ chọn)"
              showSearch
              optionFilterProp="label"
              options={orders.map((o) => ({
                label: `#${o.orderId ?? o.id} • ${(o.status || o.orderStatus || '').toString()}`,
                value: o.orderId ?? o.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="Nhân viên phụ trách" name="assignedStaffIds">
            <Select
              mode="multiple"
              allowClear
              placeholder="Chọn một hoặc nhiều nhân viên (tuỳ chọn)"
              showSearch
              optionFilterProp="label"
              options={staffs
                .filter((s) => {
                  const role = String(s.staffRole || s.role || "").toUpperCase();
                  return role === "TECHNICIAN";
                })
                .map((s) => ({
                  label: `${s.username || s.email || "User"} • ${s.staffRole || s.role || ""} #${s.staffId ?? s.id}`,
                  value: s.staffId ?? s.id,
                }))}
            />
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
      <Modal
        open={orderModalOpen}
        title={`Đơn hàng ${orderViewing?.orderId ?? orderViewing?.id ?? ""}`}
        onCancel={() => { setOrderModalOpen(false); setOrderViewing(null); }}
        footer={[<Button key="close" onClick={() => setOrderModalOpen(false)}>Đóng</Button>]}
        width={700}
      >
        {orderViewing ? (
          <div>
            <p><b>Trạng thái:</b> {orderViewing.status || orderViewing.orderStatus || "—"}</p>
            <p><b>Khách hàng:</b> {orderViewing.customerId ?? "—"}</p>
            <p><b>Ngày bắt đầu:</b> {orderViewing.startDate || "—"}</p>
            <p><b>Ngày kết thúc:</b> {orderViewing.endDate || "—"}</p>
            {Array.isArray(orderViewing.orderDetails) && (
              <div>
                <b>Chi tiết:</b>
                <ul>
                  {orderViewing.orderDetails.map((d, i) => (
                    <li key={i}>Model #{d.deviceModelId} × {d.quantity}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <span>Đang tải…</span>
        )}
      </Modal>
    </>
  );
}
