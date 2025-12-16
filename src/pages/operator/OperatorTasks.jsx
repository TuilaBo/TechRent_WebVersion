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
import { getActiveTaskRules } from "../../lib/taskRulesApi";
import {
  listTaskCategories,
  normalizeTaskCategory,
} from "../../lib/taskCategoryApi";
import { listActiveStaff, getStaffPerformanceCompletions, getStaffCategoryStats } from "../../lib/staffManage";
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
  const [staffCategoryStats, setStaffCategoryStats] = useState({}); // { staffId -> { taskCount, maxTasksPerDay } }
  const [loadingCategoryStats, setLoadingCategoryStats] = useState(false);

  // Server-side pagination and filters for tasks table
  const [taskPage, setTaskPage] = useState(0);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [taskTotal, setTaskTotal] = useState(0);
  const [filterCategoryId, setFilterCategoryId] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterOrderId, setFilterOrderId] = useState(null);
  const [filterOrderIdInput, setFilterOrderIdInput] = useState(null); // Input value for debounce

  // Debounce filter Order ID - 3 seconds after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filterOrderIdInput !== filterOrderId) {
        setFilterOrderId(filterOrderIdInput);
        setTaskPage(0);
      }
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [filterOrderIdInput]);

  const staffRoleFilterValue = Form.useWatch("staffRoleFilter", form);
  const taskCategoryIdValue = Form.useWatch("taskCategoryId", form);
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

  /**
   * useEffect: Tải danh sách Task Rules khi component mount
   * Task Rules quy định số task tối đa mỗi người/ngày theo từng loại công việc
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // ========== GỌI API LẤY TASK RULES ==========
        // API: GET /api/admin/task-rules/active
        // Trả về: danh sách rules { taskCategoryId, maxTasksPerDay, staffRole }
        const allRules = await getActiveTaskRules();

        if (!cancelled) {
          // Lưu vào state để kiểm tra giới hạn khi gán việc
          setTaskRules(allRules || []);
        }
      } catch (e) {
        console.warn("Không thể tải danh sách task rules:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * useEffect: Tải thống kê category cho từng nhân viên
   * Được trigger khi: Chọn loại công việc (taskCategoryId) và thời gian (plannedStart)
   * Dùng để hiển thị số task đã gán / giới hạn tối đa bên cạnh tên nhân viên
   */
  useEffect(() => {
    console.log('[DEBUG useEffect] taskCategoryIdValue:', taskCategoryIdValue, 'plannedStartValue:', plannedStartValue);

    // Chưa chọn đủ thông tin → clear stats
    if (!taskCategoryIdValue || !plannedStartValue) {
      setStaffCategoryStats({});
      return;
    }

    let cancelled = false;
    const dateStr = dayjs(plannedStartValue).format('YYYY-MM-DD');

    (async () => {
      setLoadingCategoryStats(true);
      const statsMap = {};

      // ========== GỌI API LẤY THỐNG KÊ CHO TỪNG NHÂN VIÊN ==========
      // Chỉ lấy cho TECHNICIAN và CUSTOMER_SUPPORT_STAFF
      const promises = staffs
        .filter(s => ['TECHNICIAN', 'CUSTOMER_SUPPORT_STAFF'].includes(String(s.staffRole || s.role || '').toUpperCase()))
        .map(async (s) => {
          try {
            const id = s.staffId ?? s.id;
            // API: GET /api/admin/staffs/{staffId}/category-stats?date=X&categoryId=Y
            // Trả về: [{ taskCount, maxTasksPerDay, taskCategoryName }]
            const stats = await getStaffCategoryStats({
              staffId: id,
              date: dateStr,
              categoryId: taskCategoryIdValue
            });
            // Xử lý response
            const catStat = Array.isArray(stats) && stats.length > 0 ? stats[0] : null;
            // Nếu empty array → nhân viên chưa có task cho category này (rảnh)
            statsMap[id] = catStat ? {
              taskCount: catStat.taskCount || 0,
              maxTasksPerDay: catStat.maxTasksPerDay || 0,
              taskCategoryName: catStat.taskCategoryName || '',
              isEmpty: false
            } : {
              taskCount: 0,
              maxTasksPerDay: 0,
              isEmpty: true // Chưa được gán việc cho category này
            };
          } catch (e) {
            console.warn(`Failed to load category stats for staff ${s.staffId}:`, e);
          }
        });

      await Promise.all(promises);

      console.log('[DEBUG] Staff Category Stats loaded:', statsMap);

      if (!cancelled) {
        // Lưu vào state để hiển thị trong dropdown chọn nhân viên
        setStaffCategoryStats(statsMap);
        setLoadingCategoryStats(false);
      }
    })();

    return () => { cancelled = true; };
  }, [taskCategoryIdValue, plannedStartValue, staffs]);

  /**
   * Hàm tải dữ liệu chính của trang (tasks, categories, staff, orders)
   * Được gọi khi: Component mount, thay đổi filter, phân trang, reload
   * Sử dụng server-side pagination và filters
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // ========== BƯỚC 1: CHUẨN BỊ PARAMS CHO API TASKS ==========
      const taskParams = {
        page: taskPage,
        size: taskPageSize,
      };
      // Thêm các filter nếu có
      if (filterCategoryId) taskParams.categoryId = filterCategoryId;
      if (filterStatus) taskParams.status = filterStatus;
      if (filterOrderId) taskParams.orderId = filterOrderId;

      // ========== BƯỚC 2: GỌI NHIỀU API SONG SONG ==========
      // Promise.all giúp gọi đồng thời, tăng tốc độ load
      const [tasksRes, catsRes, staffRes, ordersRes] = await Promise.all([
        // API 1: GET /api/tasks?page=X&size=Y&categoryId=Z...
        // Trả về: { content: Task[], totalElements, totalPages... }
        listTasks(taskParams),
        
        // API 2: GET /api/task-categories
        // Trả về: danh sách các loại công việc (Pre rental QC, Delivery...)
        listTaskCategories(),
        
        // API 3: GET /api/admin/staffs/active
        // Trả về: danh sách nhân viên đang hoạt động (để gán việc)
        listActiveStaff().catch(() => []),
        
        // API 4: GET /api/rental-orders
        // Trả về: danh sách đơn hàng (để liên kết task với đơn)
        listRentalOrders().catch(() => []),
      ]);

      // ========== BƯỚC 3: XỬ LÝ DỮ LIỆU TASKS ==========
      // Kiểm tra response có pagination hay không
      if (tasksRes && typeof tasksRes === 'object' && Array.isArray(tasksRes.content)) {
        setData(tasksRes.content);
        setTaskTotal(tasksRes.totalElements || 0);
      } else {
        // Fallback cho response không phân trang
        setData(Array.isArray(tasksRes) ? tasksRes : []);
        setTaskTotal(Array.isArray(tasksRes) ? tasksRes.length : 0);
      }

      // Lưu categories, staffs, orders vào state
      setCategories(catsRes.map(normalizeTaskCategory));
      setStaffs(Array.isArray(staffRes) ? staffRes : []);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);

      // ========== BƯỚC 4: LẤY CHI TIẾT ĐƠN HÀNG CHO MỖI TASK ==========
      // Dùng để hiển thị thông tin đơn trong bảng tasks
      const taskList = tasksRes?.content || tasksRes || [];
      const ids = Array.from(new Set((taskList).map((t) => t.orderId).filter(Boolean)));
      if (ids.length) {
        // API: GET /api/rental-orders/{orderId} cho mỗi orderId
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
  }, [taskPage, taskPageSize, filterCategoryId, filterStatus, filterOrderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Hàm tải dữ liệu bảng xếp hạng nhân viên
   * Được gọi khi: Chuyển sang tab "Leaderboard", thay đổi tháng/năm/role filter
   * Hiển thị số task hoàn thành của từng nhân viên trong tháng
   */
  const loadLeaderboard = useCallback(async () => {
    // Phải có năm và tháng được chọn
    if (!selectedYear || !selectedMonth) return;

    setLeaderboardLoading(true);
    try {
      // ========== GỌI API LẤY THỐNG KÊ HIỆU SUẤT ==========
      // API: GET /api/admin/staffs/performance-completions
      // Params: year, month, page, size, sort, staffRole (optional)
      // Trả về: { content: [{staffId, staffName, completedTaskCount}], totalElements }
      const params = {
        year: selectedYear,
        month: selectedMonth,
        page: leaderboardPage,
        size: leaderboardPageSize,
        sort: "completedTaskCount,desc", // Sắp xếp theo số task hoàn thành giảm dần
      };
      // Thêm filter theo role nếu có
      if (leaderboardRoleFilter) {
        params.staffRole = leaderboardRoleFilter;
      }
      const result = await getStaffPerformanceCompletions(params);
      
      // Xử lý response phân trang
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

    // Manually trigger stats fetch since Form.useWatch may not update immediately
    if (r.taskCategoryId && plannedStart) {
      const dateStr = plannedStart.format('YYYY-MM-DD');
      setLoadingCategoryStats(true);

      (async () => {
        const statsMap = {};
        const promises = staffs
          .filter(s => ['TECHNICIAN', 'CUSTOMER_SUPPORT_STAFF'].includes(String(s.staffRole || s.role || '').toUpperCase()))
          .map(async (s) => {
            try {
              const id = s.staffId ?? s.id;
              const stats = await getStaffCategoryStats({
                staffId: id,
                date: dateStr,
                categoryId: r.taskCategoryId
              });
              const catStat = Array.isArray(stats) && stats.length > 0 ? stats[0] : null;
              statsMap[id] = catStat ? {
                taskCount: catStat.taskCount || 0,
                maxTasksPerDay: catStat.maxTasksPerDay || 0,
                taskCategoryName: catStat.taskCategoryName || '',
                isEmpty: false
              } : {
                taskCount: 0,
                maxTasksPerDay: 0,
                isEmpty: true
              };
            } catch (e) {
              console.warn(`Failed to load category stats for staff ${s.staffId}:`, e);
            }
          });

        await Promise.all(promises);
        console.log('[DEBUG openEdit] Staff Category Stats loaded:', statsMap);
        setStaffCategoryStats(statsMap);
        setLoadingCategoryStats(false);
      })();
    }
  };

  /**
   * Hàm xóa công việc
   * Được gọi khi operator click nút "Xóa" trong cột Thao tác
   * Sử dụng optimistic update: xóa local trước, nếu API lỗi thì rollback
   * @param {Object} r - Đối tượng task cần xóa
   */
  const remove = async (r) => {
    const taskId = r.taskId;
    const prev = data; // Lưu lại dữ liệu cũ để rollback nếu lỗi
    
    // Optimistic update: xóa khỏi UI trước
    setData(prev.filter((x) => x.taskId !== taskId));
    
    try {
      // ========== GỌI API XÓA TASK ==========
      // API: DELETE /api/tasks/{taskId}
      // Trả về: success message hoặc lỗi
      await deleteTask(taskId);
      toast.success("Đã xoá công việc.");
      
      // Reload lại danh sách để đảm bảo đồng bộ
      await loadData();
    } catch (e) {
      // Rollback: khôi phục dữ liệu cũ nếu API lỗi
      setData(prev);
      toast.error(getErrorMessage(e, "Xoá thất bại"));
    }
  };

  /**
   * Hàm tạo mới hoặc cập nhật công việc
   * Được gọi khi operator submit form trong modal
   * @param {Object} vals - Giá trị form từ Ant Design Form
   */
  const submit = async (vals) => {
    try {
      // Lấy tên loại công việc từ categoryId
      const derivedType = resolveTaskType(vals.taskCategoryId);

      if (editing) {
        // ========== TRƯỜNG HỢP CẬP NHẬT (EDIT) ==========
        // Lưu ý: không gửi orderId vì backend không cho phép thay đổi
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
        
        // API: PUT /api/tasks/{taskId}
        // Body: { taskCategoryId, assignedStaffIds, type, description, plannedStart, plannedEnd }
        await updateTask(editing.taskId || editing.id, updatePayload);
        toast.success("Đã cập nhật công việc.");
      } else {
        // ========== TRƯỜNG HỢP TẠO MỚI (CREATE) ==========
        const createPayload = {
          taskCategoryId: vals.taskCategoryId,
          orderId: vals.orderId ? Number(vals.orderId) : undefined, // Có thể gửi orderId khi tạo mới
          assignedStaffIds: Array.isArray(vals.assignedStaffIds) ? vals.assignedStaffIds.map(Number) : [],
          type: derivedType,
          description: vals.description?.trim() || "",
          plannedStart: vals.plannedStart ? dayjs(vals.plannedStart).format("YYYY-MM-DDTHH:mm:ss") : undefined,
          plannedEnd: vals.plannedEnd ? dayjs(vals.plannedEnd).format("YYYY-MM-DDTHH:mm:ss") : undefined,
        };
        
        // API: POST /api/tasks
        // Body: { taskCategoryId, orderId, assignedStaffIds, type, description, plannedStart, plannedEnd }
        await createTask(createPayload);
        toast.success("Đã tạo công việc.");
      }

      // Đóng modal và reset form
      setOpen(false);
      setEditing(null);
      form.resetFields();
      
      // Reload danh sách để hiển thị task mới/cập nhật
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
      const catStat = staffCategoryStats[id];
      const taskCount = catStat?.taskCount ?? tasksPerStaffForSelectedDate[id] ?? 0;

      // Get maxTasksPerDay from taskRules if not from API stats
      const ruleForCategory = taskRules.find(r => r.taskCategoryId === taskCategoryIdValue);
      const maxTasks = catStat?.maxTasksPerDay || ruleForCategory?.maxTasksPerDay || 0;

      let limitLabel = '';
      let limitColor = 'inherit';

      // Check if we have category stats for this staff
      if (catStat) {
        if (catStat.isEmpty) {
          // Empty array = staff is free for this category
          limitLabel = ' • Chưa được gán việc';
          limitColor = '#52c41a'; // green - free
        } else if (maxTasks > 0) {
          if (taskCount >= maxTasks) {
            limitColor = '#ff4d4f'; // red - at limit
          } else {
            limitColor = '#1890ff'; // blue - has tasks but not at limit
          }
          limitLabel = ` • [${taskCount}/${maxTasks}]`;
        } else {
          // Has tasks but no limit set
          limitLabel = ` • ${taskCount} việc`;
          limitColor = '#1890ff'; // blue
        }
      } else if (taskCount > 0) {
        // Fallback to local count
        limitLabel = ` • ${taskCount} việc`;
        limitColor = '#1890ff'; // blue
      } else if (taskCategoryIdValue && !loadingCategoryStats) {
        // Category selected but no stats yet = free for this category
        limitLabel = ' • Chưa được gán việc';
        limitColor = '#52c41a'; // green
      }

      const baseLabel = `${s.username || s.email || "User"} • ${s.staffRole || s.role || ""}${limitLabel}`;

      return {
        label: (
          <span style={{ color: limitColor !== 'inherit' ? limitColor : undefined }}>
            {baseLabel}
            {catStat && maxTasks > 0 && taskCount >= maxTasks && (
              <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}> ⚠️</span>
            )}
          </span>
        ),
        value: id,
        disabled: false, // Operator can still select, just shows warning
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
  }, [staffs, staffRoleFilterValue, assignedStaffIdsKey, tasksPerStaffForSelectedDate, staffCategoryStats]);

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

  // Filter and sort data: PENDING first, COMPLETED last
  const filteredData = useMemo(() => {
    let result = data;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((task) => {
        const taskId = String(task.taskId || task.id || "").toLowerCase();
        const orderId = String(task.orderId || "").toLowerCase();
        return taskId.includes(query) || orderId.includes(query);
      });
    }
    
    // Sort by status: PENDING first, COMPLETED last
    return [...result].sort((a, b) => {
      const statusA = String(a.status || "").toUpperCase();
      const statusB = String(b.status || "").toUpperCase();
      
      // Define priority: PENDING = 1, PROCESSING/IN_PROGRESS = 2, COMPLETED = 3, others = 2
      const getPriority = (status) => {
        if (status === "PENDING") return 1;
        if (status === "COMPLETED") return 3;
        return 2; // PROCESSING, IN_PROGRESS, or other statuses
      };
      
      const priorityA = getPriority(statusA);
      const priorityB = getPriority(statusB);
      
      // Sort by priority, then by taskId (descending for newer first)
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return (b.taskId || 0) - (a.taskId || 0); // Newer tasks first within same status
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
      width: 120,
      render: (_, r) => {
        const id = r.orderId;
        if (!id) return "-";
        return (
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
      render: (_, r) => {
        const isCompleted = String(r.status || "").toUpperCase() === "COMPLETED";
        return (
          <Space size="small">
            <Tooltip title={isCompleted ? "Không thể chỉnh sửa công việc đã hoàn thành" : ""}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(r)}
                disabled={isCompleted}
              />
            </Tooltip>
            <Popconfirm
              title="Xóa công việc này?"
              onConfirm={() => remove(r)}
              disabled={isCompleted}
            >
              <Tooltip title={isCompleted ? "Không thể xóa công việc đã hoàn thành" : ""}>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={isCompleted}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
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

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 12,
              }}>
                {taskRules.map((rule) => {
                  const category = categories.find(
                    (c) => c.taskCategoryId === rule.taskCategoryId
                  );
                  const categoryName = category?.name || `Loại ${rule.taskCategoryId}`;
                  const limit = rule.maxTasksPerDay;
                  const fromDate = rule.effectiveFrom
                    ? dayjs(rule.effectiveFrom).format("DD/MM")
                    : "—";
                  const toDate = rule.effectiveTo
                    ? dayjs(rule.effectiveTo).format("DD/MM")
                    : "∞";

                  // Color based on category
                  const colorMap = {
                    1: { bg: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', label: '📋' },
                    2: { bg: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)', label: '📋' },
                    4: { bg: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', label: '🚚' },
                    6: { bg: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)', label: '📦' },
                  };
                  const config = colorMap[rule.taskCategoryId] || { bg: 'linear-gradient(135deg, #667085 0%, #475467 100%)', label: '📌' };

                  return (
                    <div
                      key={rule.taskRuleId}
                      style={{
                        background: config.bg,
                        borderRadius: 10,
                        padding: '14px',
                        color: '#fff',
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 6 }}>{config.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{categoryName}</div>
                      <div style={{
                        background: 'rgba(255,255,255,0.25)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        marginBottom: 8,
                      }}>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>{limit}</div>
                        <div style={{ fontSize: 10, opacity: 0.9 }}>việc/ngày</div>
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>
                        {fromDate} → {toDate}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            {/* Filter Controls */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col>
                <Space>
                  <span>Loại công việc:</span>
                  <Select
                    style={{ width: 180 }}
                    allowClear
                    placeholder="Tất cả"
                    value={filterCategoryId}
                    onChange={(value) => {
                      setFilterCategoryId(value);
                      setTaskPage(0);
                    }}
                    options={categories.map((c) => ({
                      label: c.name,
                      value: c.taskCategoryId,
                    }))}
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <span>Trạng thái:</span>
                  <Select
                    style={{ width: 160 }}
                    allowClear
                    placeholder="Tất cả"
                    value={filterStatus}
                    onChange={(value) => {
                      setFilterStatus(value);
                      setTaskPage(0);
                    }}
                    options={[
                      { label: "Chờ thực hiện", value: "PENDING" },
                      { label: "Đang thực hiện", value: "IN_PROGRESS" },
                      { label: "Hoàn thành", value: "COMPLETED" },
                      { label: "Đã hủy", value: "CANCELLED" },
                    ]}
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <span>Mã đơn:</span>
                  <InputNumber
                    style={{ width: 120 }}
                    placeholder="Order ID"
                    value={filterOrderIdInput}
                    onChange={(value) => {
                      setFilterOrderIdInput(value);
                    }}
                    min={1}
                  />
                </Space>
              </Col>
              <Col>
                <Button
                  onClick={() => {
                    setFilterCategoryId(null);
                    setFilterStatus(null);
                    setFilterOrderId(null);
                    setFilterOrderIdInput(null);
                    setTaskPage(0);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </Col>
            </Row>

            <Spin spinning={loading}>
              <Table
                rowKey="taskId"
                columns={columns}
                dataSource={filteredData}
                pagination={{
                  current: taskPage + 1,
                  pageSize: taskPageSize,
                  total: taskTotal,
                  showSizeChanger: true,
                  pageSizeOptions: ['5', '10', '20', '50'],
                  showTotal: (total) => `Tổng ${total} công việc`,
                  onChange: (page, pageSize) => {
                    setTaskPage(page - 1);
                    setTaskPageSize(pageSize);
                  },
                  onShowSizeChange: (current, size) => {
                    setTaskPage(0);
                    setTaskPageSize(size);
                  },
                }}
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
        title={editing
          ? `Gán công việc ${categories.find(c => c.taskCategoryId === editing.taskCategoryId)?.name || ''}`
          : "Tạo công việc"
        }
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? "Lưu" : "Tạo"}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          {!editing && (
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
          )}

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
              options={
                // Category 1-2 (Pre rental QC, Post rental QC) - only TECHNICIAN
                // Use editing?.taskCategoryId as fallback since Form.useWatch may not update immediately
                [1, 2].includes(taskCategoryIdValue || editing?.taskCategoryId)
                  ? [{ label: "TECHNICIAN", value: "TECHNICIAN" }]
                  : [
                    { label: "TECHNICIAN", value: "TECHNICIAN" },
                    { label: "CUSTOMER_SUPPORT_STAFF", value: "CUSTOMER_SUPPORT_STAFF" },
                  ]
              }
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
