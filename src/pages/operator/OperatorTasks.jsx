// src/pages/operator/OperatorTasks.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  DatePicker, Select, Typography, Spin, InputNumber, Popconfirm, Tooltip,
  Card, Avatar, Descriptions, Divider, Alert, Tabs, Statistic, Row, Col,
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
import { listTaskRules } from "../../lib/taskRulesApi";
import {
  listTaskCategories,
  normalizeTaskCategory,
} from "../../lib/taskCategoryApi";
import { listActiveStaff, getStaffPerformanceCompletions } from "../../lib/staffManage";
import { getRentalOrderById, listRentalOrders, fmtVND } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const getErrorMessage = (error, fallback = "Có lỗi xảy ra") => {
  const data = error?.response?.data;
  return data?.details || data?.message || error?.message || fallback;
};

const range = (start, end) =>
  Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);

const buildDisabledTime = (selectedDate, minDateTime, options = {}) => {
  const { blockSameMinute = false, blockSameSecond = false } = options;
  if (!selectedDate || !minDateTime) return {};
  const min = dayjs(minDateTime);
  if (selectedDate.isBefore(min, "day")) {
    return {
      disabledHours: () => range(0, 24),
      disabledMinutes: () => range(0, 60),
      disabledSeconds: () => range(0, 60),
    };
  }
  if (selectedDate.isAfter(min, "day")) {
    return {};
  }
  const disabledHours = range(0, min.hour());
  const minuteCutoff = blockSameMinute ? min.minute() + 1 : min.minute();
  const disabledMinutes =
    selectedDate.hour() === min.hour()
      ? range(0, Math.min(60, minuteCutoff))
      : [];
  const secondCutoff = blockSameSecond ? min.second() + 1 : min.second();
  const disabledSeconds =
    selectedDate.hour() === min.hour() && selectedDate.minute() === min.minute()
      ? range(0, Math.min(60, secondCutoff))
      : [];

  return {
    disabledHours: () => disabledHours,
    disabledMinutes: () => disabledMinutes,
    disabledSeconds: () => disabledSeconds,
  };
};

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
  const [activeTab, setActiveTab] = useState("tasks"); // Tab hiện tại
  const [leaderboardData, setLeaderboardData] = useState([]); // Dữ liệu leaderboard
  const [leaderboardLoading, setLeaderboardLoading] = useState(false); // Loading cho leaderboard
  const [selectedYear, setSelectedYear] = useState(dayjs().year()); // Năm được chọn
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1); // Tháng được chọn (1-12)
  const [leaderboardRoleFilter, setLeaderboardRoleFilter] = useState(null); // Lọc theo role
  const [leaderboardPage, setLeaderboardPage] = useState(0); // Trang hiện tại
  const [leaderboardPageSize, setLeaderboardPageSize] = useState(20); // Kích thước trang
  const [leaderboardTotal, setLeaderboardTotal] = useState(0); // Tổng số records
  const [taskRules, setTaskRules] = useState([]); // Danh sách rules theo category
  const staffRoleFilterValue = Form.useWatch("staffRoleFilter", form);
  const assignedStaffIdsValue = Form.useWatch("assignedStaffIds", form) || [];
  const assignedStaffIdsKey = JSON.stringify(assignedStaffIdsValue);
  const plannedStartValue = Form.useWatch("plannedStart", form);
  const disableStartDate = (current) =>
    current && current < dayjs().startOf("day");
  const disableStartTime = (date) => buildDisabledTime(date, dayjs());
  const disableEndDate = (current) => {
    const min = plannedStartValue
      ? dayjs(plannedStartValue).startOf("day")
      : dayjs().startOf("day");
    return current && current < min;
  };
  const disableEndTime = (date) =>
    buildDisabledTime(
      date,
      plannedStartValue ? dayjs(plannedStartValue) : dayjs(),
      { blockSameMinute: true, blockSameSecond: true }
    );

  // Đếm số task theo từng nhân viên trong ngày được chọn (plannedStart của form)
  const tasksPerStaffForSelectedDate = useMemo(() => {
    const map = {};
    if (!plannedStartValue) return map;
    const target = dayjs(plannedStartValue);

    (data || []).forEach((task) => {
      const time = task.plannedStart || task.createdAt || task.updatedAt || null;
      if (!time || !dayjs(time).isSame(target, "day")) return;

      const staffList = Array.isArray(task.assignedStaff)
        ? task.assignedStaff.map((s) => s.staffId ?? s.id)
        : task.assignedStaffId
        ? [task.assignedStaffId]
        : [];

      staffList.forEach((id) => {
        if (!id) return;
        map[id] = (map[id] || 0) + 1;
      });
    });

    return map;
  }, [data, plannedStartValue]);

  // Load task rules cho tất cả roles (operator assign cho mọi người)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load all active rules
        const allRules = await listTaskRules({ active: true });
        
        if (!cancelled) {
          // Hiển thị tất cả active rules
          setTaskRules(allRules);
        }
      } catch (e) {
        console.warn("Không thể tải danh sách task rules:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
      toast.error(getErrorMessage(e, "Không thể tải dữ liệu"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load leaderboard data
  const loadLeaderboard = useCallback(async () => {
    if (!selectedYear || !selectedMonth) return;
    
    setLeaderboardLoading(true);
    try {
      const params = {
        year: selectedYear,
        month: selectedMonth,
        page: leaderboardPage,
        size: leaderboardPageSize,
        sort: "completedTaskCount,desc",
      };
      if (leaderboardRoleFilter) {
        params.staffRole = leaderboardRoleFilter;
      }
      const result = await getStaffPerformanceCompletions(params);
      // Handle paginated response
      const content = result?.content || [];
      const total = result?.totalElements || 0;
      setLeaderboardData(content);
      setLeaderboardTotal(total);
    } catch (e) {
      console.error("Error loading leaderboard:", e);
      toast.error(getErrorMessage(e, "Không thể tải dữ liệu leaderboard"));
      setLeaderboardData([]);
      setLeaderboardTotal(0);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [selectedYear, selectedMonth, leaderboardRoleFilter, leaderboardPage, leaderboardPageSize]);

  // Load leaderboard when tab changes or filters change
  useEffect(() => {
    if (activeTab === "leaderboard") {
      loadLeaderboard();
    }
  }, [activeTab, loadLeaderboard]);

  const resolveTaskType = useCallback(
    (taskCategoryId) => {
      const category = categories.find(
        (c) => c.taskCategoryId === taskCategoryId
      );
      return category?.name || "";
    },
    [categories]
  );

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      taskCategoryId: undefined,
      orderId: undefined,
      assignedStaffIds: [],
      staffRoleFilter: null,
      description: "",
      plannedStart: dayjs(),
      plannedEnd: dayjs().add(1, "minute"),
    });
    setOpen(true);
    // Tự động search staff rảnh với thời gian mặc định
  };

  const openEdit = (r) => {
    // Chuẩn hoá danh sách staffId từ dữ liệu cũ (1 người) và mới (nhiều người)
    const staffIds = Array.isArray(r.assignedStaff)
      ? r.assignedStaff.map((s) => s.staffId)
      : (r.assignedStaffId ? [r.assignedStaffId] : []);

    const plannedStart = r.plannedStart ? dayjs(r.plannedStart) : null;
    const plannedEnd = r.plannedEnd ? dayjs(r.plannedEnd) : null;

    form.setFieldsValue({
      taskCategoryId: r.taskCategoryId,
      orderId: r.orderId,
      assignedStaffIds: staffIds,
      staffRoleFilter: null,
      description: r.description || "",
      plannedStart,
      plannedEnd,
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
      toast.success("Đã xoá công việc.");
      await loadData();
    } catch (e) {
      setData(prev);
      toast.error(getErrorMessage(e, "Xoá thất bại"));
    }
  };

  const submit = async (vals) => {
    try {
      const derivedType = resolveTaskType(vals.taskCategoryId);

      if (editing) {
        // Khi update: không gửi orderId vì backend không cho phép thay đổi
        const formatLocalDateTime = (value) =>
          value ? dayjs(value).format("YYYY-MM-DDTHH:mm:ss") : undefined;

        const updatePayload = {
          taskCategoryId: vals.taskCategoryId,
          assignedStaffIds: Array.isArray(vals.assignedStaffIds) ? vals.assignedStaffIds.map(Number) : [],
          type: derivedType,
          description: vals.description?.trim() || "",
          plannedStart: formatLocalDateTime(vals.plannedStart),
          plannedEnd: formatLocalDateTime(vals.plannedEnd),
        };
        await updateTask(editing.taskId || editing.id, updatePayload);
        toast.success("Đã cập nhật công việc.");
      } else {
        // Khi tạo mới: có thể gửi orderId
        const createPayload = {
          taskCategoryId: vals.taskCategoryId,
          orderId: vals.orderId ? Number(vals.orderId) : undefined,
          assignedStaffIds: Array.isArray(vals.assignedStaffIds) ? vals.assignedStaffIds.map(Number) : [],
          type: derivedType,
          description: vals.description?.trim() || "",
          plannedStart: vals.plannedStart ? dayjs(vals.plannedStart).format("YYYY-MM-DDTHH:mm:ss") : undefined,
          plannedEnd: vals.plannedEnd ? dayjs(vals.plannedEnd).format("YYYY-MM-DDTHH:mm:ss") : undefined,
        };
        await createTask(createPayload);
        toast.success("Đã tạo công việc.");
      }

      setOpen(false);
      setEditing(null);
      form.resetFields();
      await loadData();
    } catch (e) {
      toast.error(getErrorMessage(e, "Lưu thất bại"));
    }
  };

  const staffOptions = useMemo(() => {
    const roleFilter = staffRoleFilterValue
      ? String(staffRoleFilterValue).toUpperCase()
      : null;

    const selectedIds = JSON.parse(assignedStaffIdsKey || "[]");

    const formatStaff = (s) => {
      const id = s.staffId ?? s.id;
      const baseLabel = `${s.username || s.email || "User"} • ${s.staffRole || s.role || ""} #${id}`;
      const taskCount = tasksPerStaffForSelectedDate[id] || 0;
      const label =
        taskCount > 0
          ? `${baseLabel} • ${taskCount} công việc trong ngày`
          : baseLabel;
      return {
        label,
        value: id,
      };
    };

    const filteredOptions = staffs
      .filter((s) => {
        const role = String(s.staffRole || s.role || "").toUpperCase();
        const allowed =
          role === "TECHNICIAN" || role === "CUSTOMER_SUPPORT_STAFF";
        if (!allowed) return false;
        // Nếu chưa chọn "Lọc theo role" thì không hiển thị danh sách
        if (!roleFilter) return false;
        return role === roleFilter;
      })
      .map(formatStaff);

    const selectedOptions = staffs
      .filter((s) => {
        const id = s.staffId ?? s.id;
        return selectedIds.includes(id);
      })
      .map(formatStaff);

    const merged = [...filteredOptions, ...selectedOptions];
    const uniqueMap = new Map();
    merged.forEach((opt) => {
      if (!uniqueMap.has(opt.value)) {
        uniqueMap.set(opt.value, opt);
      }
    });

    return Array.from(uniqueMap.values());
  }, [staffs, staffRoleFilterValue, assignedStaffIdsKey, tasksPerStaffForSelectedDate]);

  const statusTag = (status) => {
    switch (status) {
      case "PENDING":
        return <Tag color="orange">Chờ thực hiện</Tag>;
      case "PROCESSING":
        return <Tag color="purple">Đang xử lý</Tag>;
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
    if (upper.includes("PROCESSING")) return { color: "purple", label: "Đang xử lý" };
    if (upper.includes("READY_FOR_DELIVERY")) return { color: "processing", label: "Sẵn sàng giao hàng" };
    if (upper.includes("DELIVERING")) return { color: "cyan", label: "Đang giao" };
    if (upper.includes("DELIVERY_CONFIRMED")) return { color: "blue", label: "Chuẩn bị giao hàng" };
    if (upper.includes("IN_USE")) return { color: "geekblue", label: "Đang sử dụng" };
    if (upper.includes("COMPLETED")) return { color: "green", label: "Hoàn tất đơn hàng" };
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
      title: "Mô tả công việc",
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
            <div><strong>Thời gian bắt đầu công việc:</strong> {start}</div>
            <div><strong>Thời gian kết thúc công việc:</strong> {end}</div>
          </div>
        );
      },
    },
    {
      title: "Trạng thái công việc",
      dataIndex: "status",
      key: "status",
      width: 140,
      filters: [
        { text: "Chờ thực hiện", value: "PENDING" },
        { text: "Đang xử lý", value: "PROCESSING" },
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
          <Popconfirm title="Xóa công việc này?" onConfirm={() => remove(r)}>
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

  // Leaderboard columns
  const leaderboardColumns = [
    {
      title: "Hạng",
      key: "rank",
      width: 80,
      align: "center",
      render: (_, __, index) => {
        const rank = index + 1;
        if (rank === 1) return <Tag color="gold" style={{ fontSize: 16, padding: "4px 12px" }}>🥇 {rank}</Tag>;
        if (rank === 2) return <Tag color="default" style={{ fontSize: 16, padding: "4px 12px" }}>🥈 {rank}</Tag>;
        if (rank === 3) return <Tag color="orange" style={{ fontSize: 16, padding: "4px 12px" }}>🥉 {rank}</Tag>;
        return <strong>{rank}</strong>;
      },
    },
    {
      title: "Nhân viên",
      key: "staff",
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar style={{ backgroundColor: "#1890ff" }}>
            {(record.staffName || record.username || "U")[0]?.toUpperCase()}
          </Avatar>
          <div>
            <div><strong>{record.staffName || record.username || "—"}</strong></div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {record.email || "—"}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Vai trò",
      dataIndex: "staffRole",
      key: "staffRole",
      width: 150,
      render: (role) => (
        <Tag color={role === "TECHNICIAN" ? "blue" : role === "CUSTOMER_SUPPORT_STAFF" ? "purple" : "default"}>
          {role || "—"}
        </Tag>
      ),
    },
    {
      title: "Số công việc hoàn thành",
      dataIndex: "completedTaskCount",
      key: "completedTaskCount",
      width: 300,
      render: (count, record) => {
        const completedCount = count || record.completionCount || 0;
        const breakdown = record.taskCompletionsByCategory || [];
        
        return (
          <div>
            <Statistic
              value={completedCount}
              valueStyle={{ color: "#3f8600", fontSize: 20, fontWeight: "bold" }}
              suffix="công việc"
            />
            {breakdown.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: "1.6" }}>
                <Text type="secondary" strong>Chi tiết theo loại:</Text>
                <div style={{ marginTop: 4 }}>
                  {breakdown.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <Text style={{ fontSize: 12 }}>• {item.taskCategoryName || `Category #${item.taskCategoryId}`}</Text>
                      <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{item.completedCount}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  const tabItems = [
    {
      key: "tasks",
      label: "Quản lý công việc",
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <Title level={3} style={{ margin: 0 }}>Quản lý công việc</Title>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadData}>Tải lại</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Thêm công việc
                </Button>
              </Space>
            </div>
          </Card>

          {/* Task Rules Display - Simple Text List */}
          {taskRules && taskRules.length > 0 && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                borderRadius: 8,
                background: "#fafafa",
                border: "1px solid #e0e0e0",
              }}
              bodyStyle={{ padding: "12px 16px" }}
            >
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <Text strong style={{ fontSize: 13 }}>
                  Quy tắc công việc hiện hành: {taskRules[0]?.name || "—"}
                </Text>
              </div>
              
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                {taskRules.map((rule) => {
                  const category = categories.find(
                    (c) => c.taskCategoryId === rule.taskCategoryId
                  );
                  const categoryName = category?.name || `Loại ${rule.taskCategoryId}`;
                  const role = rule.staffRole || "—";
                  const limit = rule.maxTasksPerDay;
                  const fromDate = rule.effectiveFrom 
                    ? dayjs(rule.effectiveFrom).format("DD/MM/YYYY")
                    : "—";
                  const toDate = rule.effectiveTo
                    ? dayjs(rule.effectiveTo).format("DD/MM/YYYY")
                    : "—";
                  
                  return (
                    <div key={rule.taskRuleId} style={{ fontSize: 12, color: "#555" }}>
                      <Text strong>{categoryName}</Text>
                      <Text type="secondary"> ({role}): </Text>
                      <Text>tối đa <strong>{limit}</strong> công việc/ngày</Text>
                      <Text type="secondary"> • Hiệu lực từ {fromDate} đến {toDate}</Text>
                    </div>
                  );
                })}
              </Space>
            </Card>
          )}

          <Card>
            <Space style={{ marginBottom: 16, width: "100%" }} direction="vertical" size="middle">
              <Search
                placeholder="Tìm kiếm theo mã công việc hoặc mã đơn hàng..."
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
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} công việc` }}
                scroll={{ x: 1200 }}
              />
            </Spin>
          </Card>
        </>
      ),
    },
    {
      key: "leaderboard",
      label: "Tần suất hoàn thành công việc trong tháng của nhân viên",
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <Title level={3} style={{ margin: 0 }}>Tần suất hoàn thành công việc trong tháng của nhân viên </Title>
              <Button icon={<ReloadOutlined />} onClick={loadLeaderboard}>Tải lại</Button>
            </div>
          </Card>

          <Card>
            <Space style={{ marginBottom: 16, width: "100%" }} direction="vertical" size="middle">
              <Row gutter={16} align="middle">
                <Col>
                  <Space>
                    <span>Tháng/Năm:</span>
                    <DatePicker
                      picker="month"
                      value={dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`)}
                      onChange={(date) => {
                        if (date) {
                          setSelectedYear(date.year());
                          setSelectedMonth(date.month() + 1);
                        }
                      }}
                      format="MM/YYYY"
                      allowClear={false}
                    />
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <span>Lọc theo role:</span>
                    <Select
                      style={{ width: 250 }}
                      allowClear
                      placeholder="Tất cả role"
                      value={leaderboardRoleFilter}
                      onChange={(value) => {
                        setLeaderboardRoleFilter(value);
                        setLeaderboardPage(0); // Reset về trang đầu khi đổi filter
                      }}
                      options={[
                        { label: "TECHNICIAN", value: "TECHNICIAN" },
                        { label: "CUSTOMER_SUPPORT_STAFF", value: "CUSTOMER_SUPPORT_STAFF" },
                      ]}
                    />
                  </Space>
                </Col>
              </Row>
            </Space>

            <Spin spinning={leaderboardLoading}>
              {leaderboardData.length > 0 ? (
                <Table
                  rowKey={(record) => `${record.staffId || record.id || Math.random()}`}
                  columns={leaderboardColumns}
                  dataSource={leaderboardData}
                  pagination={{
                    current: leaderboardPage + 1, // Ant Design uses 1-based index
                    pageSize: leaderboardPageSize,
                    total: leaderboardTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `Tổng ${total} nhân viên`,
                    onChange: (page, pageSize) => {
                      setLeaderboardPage(page - 1); // Convert to 0-based index
                      setLeaderboardPageSize(pageSize);
                    },
                    onShowSizeChange: (current, size) => {
                      setLeaderboardPage(0); // Reset về trang đầu khi đổi page size
                      setLeaderboardPageSize(size);
                    },
                  }}
                  scroll={{ x: 800 }}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
                  {leaderboardLoading ? "Đang tải..." : "Không có dữ liệu cho tháng/năm đã chọn"}
                </div>
              )}
            </Spin>
          </Card>
        </>
      ),
    },
  ];

  return (
    <>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />

      <Modal
        title={editing ? "Cập nhật công việc" : "Tạo công việc"}
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
            tooltip={editing ? "Không thể thay đổi loại công việc khi chỉnh sửa công việc" : undefined}
          >
            <Select
              placeholder="Chọn loại công việc"
              disabled={!!editing}
              options={categories.map((c) => ({
                label: c.name,
                value: c.taskCategoryId,
              }))}
            />
          </Form.Item>

          <Form.Item 
            label="Mã đơn hàng" 
            name="orderId"
            tooltip={editing ? "Không thể thay đổi mã đơn hàng sau khi tạo công việc" : undefined}
          >
            <Select
              disabled={!!editing}
              allowClear
              placeholder="Chọn mã đơn (tuỳ chọn)"
              showSearch
              optionFilterProp="label"
              options={orders.map((o) => ({
                label: `#${o.orderId ?? o.id}`,
                value: o.orderId ?? o.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Lọc theo role"
            name="staffRoleFilter"
            tooltip="Chọn role để lọc nhân viên rảnh"
          >
            <Select
              allowClear
              placeholder="Tất cả role"
              options={[
                { label: "TECHNICIAN", value: "TECHNICIAN" },
                { label: "CUSTOMER_SUPPORT_STAFF", value: "CUSTOMER_SUPPORT_STAFF" },
              ]}
            />
          </Form.Item>

          <Form.Item 
            label="Nhân viên phụ trách" 
            name="assignedStaffIds"
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Chọn nhân viên"
              showSearch
              optionFilterProp="label"
              options={staffOptions}
            />
          </Form.Item>

          <Form.Item
            label="Mô tả"
            name="description"
            rules={[{ required: true, message: "Nhập mô tả" }]}
          >
            <Input.TextArea rows={3} placeholder="Mô tả chi tiết" />
          </Form.Item>

          <Form.Item
            label="Thời gian bắt đầu công việc (dự kiến)"
            name="plannedStart"
            rules={[{ required: true, message: "Chọn thời gian bắt đầu công việc (dự kiến)" }]}
          >
            <DatePicker
              showTime
              style={{ width: "100%" }}
              format="DD/MM/YYYY HH:mm"
              disabledDate={disableStartDate}
              disabledTime={disableStartTime}
              onChange={(value) => {
                const endTime = form.getFieldValue("plannedEnd");
                if (value) {
                  const minEnd = dayjs(value).add(1, "minute");
                  if (!endTime || !dayjs(endTime).isAfter(value)) {
                    form.setFieldValue("plannedEnd", minEnd);
                  }
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="Thời gian kết thúc công việc (dự kiến)"
            name="plannedEnd"
            rules={[{ required: true, message: "Chọn thời gian kết thúc công việc (dự kiến)" }]}
          >
            <DatePicker
              showTime
              style={{ width: "100%" }}
              format="DD/MM/YYYY HH:mm"
              disabledDate={disableEndDate}
              disabledTime={disableEndTime}
            />
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
                <div style={{ color: "#1890ff", fontWeight: "bold", fontSize: "16px", marginTop: 8 }}>
                  <strong>Tổng thanh toán:</strong> {fmtVND(orderTotals.deposit + orderTotals.rental)}
                </div>
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
