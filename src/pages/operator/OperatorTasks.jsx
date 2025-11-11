// src/pages/operator/OperatorTasks.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  DatePicker, Select, Typography, Spin, InputNumber, Popconfirm, Tooltip,
  Card, Avatar, Descriptions, Divider,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
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
import { getRentalOrderById, listRentalOrders, fmtVND } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

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
  const [orderCustomer, setOrderCustomer] = useState(null);
  const [orderDetailModels, setOrderDetailModels] = useState({});
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const describeOrderStatus = (status) => {
    const upper = String(status || "").toUpperCase();
    if (!upper) return { color: "default", label: "—" };
    if (upper.includes("PENDING")) return { color: "orange", label: "Đang chờ" };
    if (upper.includes("READY_FOR_DELIVERY")) return { color: "processing", label: "Sẵn sàng giao" };
    if (upper.includes("DELIVERY_CONFIRMED")) return { color: "blue", label: "Đã xác nhận giao" };
    if (upper.includes("CONFIRM")) return { color: "blue", label: "Đã xác nhận" };
    if (upper.includes("CANCEL")) return { color: "red", label: "Đã hủy" };
    if (upper.includes("DONE") || upper.includes("COMPLETE")) return { color: "green", label: "Hoàn tất" };
    return { color: "default", label: status || "—" };
  };

  const openOrderDetail = async (orderId) => {
    if (!orderId) return;
    setOrderModalOpen(true);
    setOrderDetailLoading(true);
    setOrderViewing(null);
    setOrderCustomer(null);

    try {
      let orderData = orderMap[orderId];
      if (!orderData) {
        orderData = await getRentalOrderById(orderId);
        if (orderData) {
          setOrderMap((prev) => ({ ...prev, [orderId]: orderData }));
        }
      }

      if (!orderData) {
        throw new Error("Không tìm thấy đơn hàng");
      }

      setOrderViewing(orderData);

      if (orderData?.customerId) {
        try {
          const customerRaw = await fetchCustomerById(orderData.customerId);
          setOrderCustomer(normalizeCustomer(customerRaw || {}));
        } catch (err) {
          console.error("Không tải được thông tin khách hàng:", err);
          setOrderCustomer(null);
        }
      }

      if (Array.isArray(orderData?.orderDetails) && orderData.orderDetails.length) {
        const uniqueIds = Array.from(
          new Set(orderData.orderDetails.map((od) => od?.deviceModelId).filter(Boolean))
        );
        const missing = uniqueIds.filter((id) => !orderDetailModels[id]);

        if (missing.length) {
          const entries = await Promise.all(
            missing.map(async (modelId) => {
              try {
                const modelRaw = await getDeviceModelById(modelId);
                return [modelId, normalizeModel(modelRaw || {})];
              } catch (err) {
                console.error(`Không tải được mẫu thiết bị ${modelId}:`, err);
                return [modelId, null];
              }
            })
          );
          setOrderDetailModels((prev) => {
            const next = { ...prev };
            entries.forEach(([id, model]) => {
              if (model) next[id] = model;
            });
            return next;
          });
        }
      }
    } catch (err) {
      console.error("Không thể mở chi tiết đơn hàng:", err);
      toast.error("Không tải được chi tiết đơn hàng");
      setOrderModalOpen(false);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.trim().toLowerCase();
    return data.filter((task) => {
      const taskId = String(task.taskId || task.id || "").toLowerCase();
      const orderId = String(task.orderId || "").toLowerCase();
      return taskId.includes(query) || orderId.includes(query);
    });
  }, [data, searchQuery]);

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
        const { color, label } = describeOrderStatus(st);
        if (!id) return "-";
        return (
          <Space direction="vertical" size="small">
            <Space>
              <span>#{id}</span>
              <Button 
                size="small" 
                type="link"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => openOrderDetail(id)}
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
      width: 180,
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

  const fmtDate = (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "—");

  const orderDays = useMemo(() => {
    if (!orderViewing?.startDate || !orderViewing?.endDate) return 1;
    const start = dayjs(orderViewing.startDate).startOf("day");
    const end = dayjs(orderViewing.endDate).startOf("day");
    const diff = end.diff(start, "day");
    return Math.max(1, diff || 1);
  }, [orderViewing?.startDate, orderViewing?.endDate]);

  const orderDetailRows = useMemo(() => {
    if (!orderViewing || !Array.isArray(orderViewing.orderDetails)) return [];
    return orderViewing.orderDetails.map((od, idx) => {
      const model = orderDetailModels[od?.deviceModelId] || od?.deviceModel || {};
      const image = model?.imageURL || model?.imageUrl || model?.image || od?.deviceModelImage || "";
      const name =
        model?.name ||
        model?.deviceName ||
        od?.deviceModelName ||
        (od?.deviceModelId != null ? `Model #${od.deviceModelId}` : "Không rõ thiết bị");
      const code =
        model?.id ||
        model?.deviceModelId ||
        od?.deviceModelId ||
        model?.code ||
        "—";

      return {
        key: od?.orderDetailId || od?.id || idx,
        orderDetailId: od?.orderDetailId || od?.id || idx,
        quantity: Number(od?.quantity ?? 0),
        pricePerDay: Number(od?.pricePerDay ?? od?.dailyPrice ?? model?.pricePerDay ?? 0),
        depositAmountPerUnit: Number(od?.depositAmountPerUnit ?? model?.depositAmountPerUnit ?? 0),
        modelInfo: {
          name,
          image,
          code,
        },
      };
    });
  }, [orderViewing, orderDetailModels]);

  const orderTotals = useMemo(() => {
    return orderDetailRows.reduce(
      (acc, item) => {
        const qty = Number(item.quantity || 0);
        const deposit = Number(item.depositAmountPerUnit || 0) * qty;
        const rental = Number(item.pricePerDay || 0) * qty * Number(orderDays || 1);
        return {
          deposit: acc.deposit + deposit,
          rental: acc.rental + rental,
        };
      },
      { deposit: 0, rental: 0 }
    );
  }, [orderDetailRows, orderDays]);

  const orderItemColumns = useMemo(() => [
    {
      title: "Chi tiết ID",
      dataIndex: "orderDetailId",
      width: 110,
      render: (value) => (value ? `#${value}` : "—"),
    },
    {
      title: "Thiết bị",
      dataIndex: "modelInfo",
      width: 280,
      render: (_, record) => {
        const model = record?.modelInfo || {};
        const name = model.name || "Không rõ thiết bị";
        return (
          <Space align="start">
            <Avatar
              shape="square"
              size={48}
              src={model.image}
              alt={name}
              style={{ backgroundColor: model.image ? undefined : "#f0f0f0" }}
            >
              {!model.image && typeof name === "string" ? name.charAt(0)?.toUpperCase() : null}
            </Avatar>
            <div>
              <div>
                <Text strong>{name}</Text>
              </div>
              <div style={{ color: "#6B7280", fontSize: 12 }}>Mã mẫu: {model.code || "—"}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 70,
      align: "center",
    },
    {
      title: "Giá/ngày",
      dataIndex: "pricePerDay",
      width: 120,
      align: "right",
      render: (value) => fmtVND(value),
    },
    {
      title: "Cọc/1 SP",
      dataIndex: "depositAmountPerUnit",
      width: 130,
      align: "right",
      render: (value) => fmtVND(value),
    },
    {
      title: "Tổng tiền cọc",
      key: "depositTotal",
      width: 140,
      align: "right",
      render: (_, record) => fmtVND(Number(record.depositAmountPerUnit || 0) * Number(record.quantity || 0)),
    },
    {
      title: "Tổng tiền thuê",
      key: "rentalTotal",
      width: 150,
      align: "right",
      render: (_, record) =>
        fmtVND(Number(record.pricePerDay || 0) * Number(record.quantity || 0) * Number(orderDays || 1)),
    },
  ], [orderDays]);

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Title level={3} style={{ margin: 0 }}>Quản lý nhiệm vụ</Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>Tải lại</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm task
            </Button>
          </Space>
        </div>
      </Card>

      <Card>
        <Space style={{ marginBottom: 16, width: "100%" }} direction="vertical" size="middle">
          <Search
            placeholder="Tìm kiếm theo mã task hoặc mã đơn hàng..."
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={setSearchQuery}
            style={{ width: "100%", maxWidth: 400 }}
            enterButton
          />
        </Space>

        <Spin spinning={loading}>
          <Table
            rowKey="taskId"
            columns={columns}
            dataSource={filteredData}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} task` }}
            scroll={{ x: 1200 }}
          />
        </Spin>
      </Card>

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
        onCancel={() => {
          setOrderModalOpen(false);
          setOrderViewing(null);
          setOrderCustomer(null);
        }}
        footer={[<Button key="close" onClick={() => setOrderModalOpen(false)}>Đóng</Button>]}
        width={840}
      >
        {orderDetailLoading ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spin />
          </div>
        ) : orderViewing ? (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label="Mã đơn">#{orderViewing.orderId ?? orderViewing.id}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={describeOrderStatus(orderViewing.status || orderViewing.orderStatus).color}>
                  {describeOrderStatus(orderViewing.status || orderViewing.orderStatus).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng" span={2}>
                <div>
                  <div><strong>{orderCustomer?.fullName || orderViewing.customerName || "—"}</strong></div>
                  <div style={{ color: "#4B5563" }}>SĐT: {orderCustomer?.phoneNumber || orderViewing.customerPhone || "—"}</div>
                  <div style={{ color: "#4B5563" }}>Email: {orderCustomer?.email || orderViewing.customerEmail || "—"}</div>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày thuê">
                {fmtDate(orderViewing.startDate)} → {fmtDate(orderViewing.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Số ngày thuê">
                {orderDays} ngày
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao hàng" span={2}>
                {orderViewing.shippingAddress || orderViewing.address || orderCustomer?.shippingAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: "12px 0" }} />

            <Table
              rowKey="key"
              columns={orderItemColumns}
              dataSource={orderDetailRows}
              pagination={false}
              scroll={{ x: 760 }}
              size="small"
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Space direction="vertical" align="end" size={4}>
                <div><strong>Tổng tiền cọc:</strong> {fmtVND(orderTotals.deposit)}</div>
                <div><strong>Tổng tiền thuê:</strong> {fmtVND(orderTotals.rental)}</div>
              </Space>
            </div>
          </Space>
        ) : (
          <span>Không có dữ liệu đơn hàng.</span>
        )}
      </Modal>
    </>
  );
}
