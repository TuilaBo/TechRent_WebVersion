/**
 * ============================================
 * ADMIN CONDITION MANAGEMENT PAGE
 * ============================================
 * 
 * Trang quản lý định nghĩa tình trạng thiết bị (Condition Definitions)
 * Cho phép admin tạo, xem, sửa, xóa các định nghĩa về tình trạng thiết bị
 * 
 * Mỗi condition definition bao gồm:
 * - Tên tình trạng (vd: "Trầy xước nhẹ", "Vỡ màn hình")
 * - Loại tình trạng: GOOD/DAMAGED/LOST
 * - Mức độ nghiêm trọng: INFO/LOW/MEDIUM/HIGH/CRITICAL
 * - Mẫu thiết bị áp dụng (deviceModelId)
 * - Chi phí bồi thường mặc định
 */

// src/pages/admin/AdminCondition.jsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Popconfirm,
  Descriptions,
  InputNumber,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import {
  getConditionDefinitions,
  getConditionDefinitionById,
  createConditionDefinition,
  updateConditionDefinition,
  deleteConditionDefinition,
  normalizeConditionDefinition,
} from "../../lib/condition";
import { listDeviceModels } from "../../lib/deviceManage";

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * CONDITION TYPE OPTIONS
 * 3 loại tình trạng chính của thiết bị
 * - GOOD: Thiết bị tốt, không có vấn đề
 * - DAMAGED: Thiết bị hư hỏng (có thể ở nhiều mức độ khác nhau)
 * - LOST: Thiết bị bị mất hoàn toàn
 */
const CONDITION_TYPE_OPTIONS = [
  { label: "Tốt", value: "GOOD", color: "green" },
  { label: "Hư hỏng", value: "DAMAGED", color: "volcano" },
  { label: "Mất", value: "LOST", color: "red" },
];

/**
 * SEVERITY OPTIONS
 * 5 mức độ nghiêm trọng của tình trạng
 * - INFO: Chỉ thông tin, không có vấn đề (dùng cho GOOD)
 * - LOW: Nhẹ - trầy xước nhỏ, không ảnh hưởng chức năng
 * - MEDIUM: Trung bình - hư hỏng nhẹ, ảnh hưởng một phần
 * - HIGH: Nghiêm trọng - hư hỏng nặng, ảnh hưởng nhiều chức năng
 * - CRITICAL: Khẩn cấp - hỏng hoàn toàn hoặc mất thiết bị
 */
const CONDITION_SEVERITY_OPTIONS = [
  { label: "Không có ", value: "INFO", color: "default" },
  { label: "Nhẹ ", value: "LOW", color: "green" },
  { label: "Trung bình ", value: "MEDIUM", color: "gold" },
  { label: "Nghiêm trọng ", value: "HIGH", color: "orange" },
  { label: "Khẩn cấp ", value: "CRITICAL", color: "red" },
];

/**
 * Helper: Lấy metadata (label, color) của condition type
 * @param {string} value - Giá trị conditionType (GOOD/DAMAGED/LOST)
 * @returns {object} - {label, color}
 */
const getTypeMeta = (value) =>
  CONDITION_TYPE_OPTIONS.find((opt) => opt.value === value) || {
    label: value || "—",
    color: "default",
  };

/**
 * Helper: Lấy metadata (label, color) của severity
 * @param {string} value - Giá trị severity (INFO/LOW/MEDIUM/HIGH/CRITICAL)
 * @returns {object} - {label, color}
 */
const getSeverityMeta = (value) =>
  CONDITION_SEVERITY_OPTIONS.find((opt) => opt.value === value) || {
    label: value || "—",
    color: "default",
  };

/**
 * Helper: Lấy danh sách severity options được phép dựa trên conditionType
 * 
 * LOGIC NGHIỆP VỤ:
 * - GOOD: Chỉ cho phép INFO (không có vấn đề)
 * - LOST: Chỉ cho phép CRITICAL (mất thiết bị là nghiêm trọng nhất)
 * - DAMAGED: Cho phép LOW, MEDIUM, HIGH, CRITICAL (không có INFO)
 * 
 * @param {string} conditionType - Loại tình trạng
 * @returns {array} - Danh sách severity options được phép
 */
const getSeverityOptionsByType = (conditionType) => {
  if (conditionType === "GOOD") {
    // Thiết bị tốt chỉ có severity = INFO
    return CONDITION_SEVERITY_OPTIONS.filter((opt) => opt.value === "INFO");
  }
  if (conditionType === "LOST") {
    // Thiết bị mất chỉ có severity = CRITICAL
    return CONDITION_SEVERITY_OPTIONS.filter((opt) => opt.value === "CRITICAL");
  }
  if (conditionType === "DAMAGED") {
    // Thiết bị hư hỏng có thể có nhiều mức độ (trừ INFO)
    return CONDITION_SEVERITY_OPTIONS.filter((opt) => opt.value !== "INFO");
  }
  return CONDITION_SEVERITY_OPTIONS;
};

/**
 * Helper: Lấy severity mặc định dựa trên conditionType
 * Tự động set severity phù hợp khi user chọn conditionType
 * 
 * @param {string} conditionType - Loại tình trạng
 * @returns {string} - Severity mặc định
 */
const getDefaultSeverityByType = (conditionType) => {
  if (conditionType === "GOOD") return "INFO";
  if (conditionType === "LOST") return "CRITICAL";
  if (conditionType === "DAMAGED") return "LOW";
  return "INFO";
};

/**
 * ============================================
 * MAIN COMPONENT: AdminCondition
 * ============================================
 */
export default function AdminCondition() {
  // ==================== STATE QUẢN LÝ DỮ LIỆU ====================
  
  /**
   * conditions: Danh sách tất cả condition definitions
   * Mỗi item gồm: id, name, deviceModelId, description, conditionType, conditionSeverity, defaultCompensation
   */
  const [conditions, setConditions] = useState([]);
  
  /**
   * loading: Trạng thái đang tải danh sách conditions
   */
  const [loading, setLoading] = useState(false);
  
  /**
   * deviceModels: Danh sách các mẫu thiết bị (để filter và select)
   * Dùng cho dropdown chọn mẫu thiết bị khi tạo/sửa condition
   */
  const [deviceModels, setDeviceModels] = useState([]);
  
  /**
   * modelLoading: Trạng thái đang tải danh sách device models
   */
  const [modelLoading, setModelLoading] = useState(false);

  // ==================== STATE FILTER ====================
  
  /**
   * deviceModelFilter: ID của device model để lọc danh sách conditions
   * null = hiển thị tất cả, có giá trị = chỉ hiển thị conditions của model đó
   */
  const [deviceModelFilter, setDeviceModelFilter] = useState(null);

  // ==================== STATE MODAL TẠO MỚI ====================
  
  /**
   * createForm: Form instance của Ant Design cho modal tạo mới
   */
  const [createForm] = Form.useForm();
  
  /**
   * openCreate: Trạng thái hiển thị modal tạo mới
   */
  const [openCreate, setOpenCreate] = useState(false);
  
  /**
   * createConditionType: Watch giá trị conditionType trong form tạo
   * Dùng để auto-update severity options khi user chọn conditionType
   * Ví dụ: conditionType = "GOOD" => severity options chỉ có "INFO"
   */
  const createConditionType = Form.useWatch("conditionType", createForm);

  // ==================== STATE MODAL XEM CHI TIẾT ====================
  
  /**
   * openView: Trạng thái hiển thị modal xem chi tiết
   */
  const [openView, setOpenView] = useState(false);
  
  /**
   * viewingCondition: Data của condition đang được xem
   */
  const [viewingCondition, setViewingCondition] = useState(null);

  // ==================== STATE MODAL CHỈNH SỬA ====================
  
  /**
   * openEdit: Trạng thái hiển thị modal chỉnh sửa
   */
  const [openEdit, setOpenEdit] = useState(false);
  
  /**
   * editingCondition: Data của condition đang được sửa
   */
  const [editingCondition, setEditingCondition] = useState(null);
  
  /**
   * editForm: Form instance của Ant Design cho modal sửa
   */
  const [editForm] = Form.useForm();
  
  /**
   * editConditionType: Watch giá trị conditionType trong form sửa
   * Tương tự createConditionType, dùng để auto-update severity options
   */
  const editConditionType = Form.useWatch("conditionType", editForm);

  // ==================== API FUNCTIONS ====================

  /**
   * loadDeviceModels: Load danh sách device models từ API
   * Gọi 1 lần khi component mount
   * Dùng cho dropdown chọn device model
   */
  const loadDeviceModels = async () => {
    try {
      setModelLoading(true);
      const models = await listDeviceModels();
      setDeviceModels(Array.isArray(models) ? models : []);
    } catch (e) {
      console.error("Failed to load device models:", e);
      setDeviceModels([]);
    } finally {
      setModelLoading(false);
    }
  };

  /**
   * loadConditions: Load danh sách condition definitions từ API
   * 
   * LOGIC:
   * 1. Nếu có deviceModelFilter, chỉ load conditions của model đó
   * 2. Normalize dữ liệu từ API
   * 3. Sort theo thời gian tạo (mới nhất trước)
   * 
   * @async
   */
  const loadConditions = async () => {
    try {
      setLoading(true);
      
      // Tạo params cho API request
      const params = {};
      if (deviceModelFilter != null) {
        params.deviceModelId = deviceModelFilter;
      }
      
      // Gọi API lấy danh sách conditions
      const list = await getConditionDefinitions(params);
      
      // Normalize dữ liệu
      const mapped = list.map(normalizeConditionDefinition);
      
      // Sort mới nhất trước (theo createdAt hoặc updatedAt)
      mapped.sort((a, b) => {
        const ta = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
        const tb = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (b?.id || 0) - (a?.id || 0);
      });
      
      setConditions(mapped);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e?.message || "Không tải được danh sách condition definitions"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================== LIFECYCLE HOOKS ====================

  /**
   * useEffect: Load device models khi component mount
   * Chỉ chạy 1 lần
   */
  useEffect(() => {
    loadDeviceModels();
  }, []);

  /**
   * useEffect: Reload conditions khi filter thay đổi
   * Phụ thuộc vào deviceModelFilter
   */
  useEffect(() => {
    loadConditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceModelFilter]);

  // ==================== MODAL TẠO MỚI - HANDLERS ====================

  /**
   * openCreateModal: Mở modal tạo condition mới
   * 
   * LOGIC:
   * 1. Reset form về trạng thái rỗng
   * 2. Set giá trị mặc định:
   *    - defaultCompensation = 0
   *    - conditionType = "GOOD"
   *    - conditionSeverity = "INFO"
   * 3. Hiển thị modal
   */
  const openCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      defaultCompensation: 0,
      conditionType: "GOOD",
      conditionSeverity: "INFO",
    });
    setOpenCreate(true);
  };

  /**
   * submitCreate: Xử lý submit form tạo mới
   * 
   * FLOW:
   * 1. Gọi API createConditionDefinition với dữ liệu từ form
   * 2. Hiển thị thông báo thành công
   * 3. Đóng modal
   * 4. Reload danh sách conditions
   * 
   * @param {object} vals - Form values
   * @async
   */
  const submitCreate = async (vals) => {
    try {
      await createConditionDefinition({
        name: vals.name,
        deviceModelId: vals.deviceModelId,
        description: vals.description || "",
        conditionType: vals.conditionType || "GOOD",
        conditionSeverity: vals.conditionSeverity || "INFO",
        defaultCompensation: vals.defaultCompensation ?? 0,
      });
      toast.success("Tạo condition definition thành công");
      setOpenCreate(false);
      await loadConditions();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Tạo condition definition thất bại");
    }
  };

  // ==================== MODAL XEM CHI TIẾT - HANDLERS ====================

  /**
   * onView: Xem chi tiết 1 condition definition
   * 
   * FLOW:
   * 1. Gọi API getConditionDefinitionById để lấy đầy đủ thông tin
   * 2. Normalize dữ liệu
   * 3. Lưu vào state viewingCondition
   * 4. Hiển thị modal xem
   * 
   * @param {object} row - Row data từ table
   * @async
   */
  const onView = async (row) => {
    const id = row.id;
    try {
      const detail = await getConditionDefinitionById(id);
      setViewingCondition(normalizeConditionDefinition(detail));
      setOpenView(true);
    } catch {
      toast.error("Không tải được chi tiết condition definition");
    }
  };

  // ==================== MODAL CHỈNH SỬA - HANDLERS ====================

  /**
   * openEditModal: Mở modal sửa condition
   * 
   * FLOW:
   * 1. Normalize dữ liệu row hiện tại
   * 2. Lưu vào state editingCondition
   * 3. Populate form với dữ liệu hiện tại
   * 4. Hiển thị modal sửa
   * 
   * @param {object} row - Row data từ table
   */
  const openEditModal = (row) => {
    const current = normalizeConditionDefinition(row);
    setEditingCondition(current);
    editForm.setFieldsValue({
      name: current.name,
      deviceModelId: current.deviceModelId,
      description: current.description,
      conditionType: current.conditionType || "GOOD",
      conditionSeverity: current.conditionSeverity || "INFO",
      defaultCompensation: current.defaultCompensation,
    });
    setOpenEdit(true);
  };

  /**
   * submitEdit: Xử lý submit form chỉnh sửa
   * 
   * FLOW:
   * 1. Kiểm tra có đang edit condition nào không
   * 2. Gọi API updateConditionDefinition với ID và dữ liệu mới
   * 3. Hiển thị thông báo thành công
   * 4. Đóng modal và clear state
   * 5. Reload danh sách conditions
   * 
   * @param {object} vals - Form values
   * @async
   */
  const submitEdit = async (vals) => {
    if (!editingCondition) return;
    const id = editingCondition.id;

    try {
      await updateConditionDefinition(id, {
        name: vals.name,
        deviceModelId: vals.deviceModelId,
        description: vals.description,
        conditionType: vals.conditionType,
        conditionSeverity: vals.conditionSeverity,
        defaultCompensation: vals.defaultCompensation,
      });
      toast.success("Cập nhật condition definition thành công");
      setOpenEdit(false);
      setEditingCondition(null);
      await loadConditions();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Cập nhật thất bại");
    }
  };

  // ==================== XÓA CONDITION ====================

  /**
   * onDelete: Xóa 1 condition definition
   * 
   * FLOW:
   * 1. Gọi API deleteConditionDefinition với ID
   * 2. Hiển thị thông báo
   * 3. Reload danh sách
   * 
   * NOTE: Nếu condition đang được sử dụng, server sẽ từ chối xóa
   * 
   * @param {object} row - Row data từ table
   * @async
   */
  const onDelete = async (row) => {
    const id = row.id;
    try {
      await deleteConditionDefinition(id);
      toast.success("Đã xóa condition definition");
      await loadConditions();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Xóa thất bại");
    }
  };

  // ==================== HELPER FUNCTIONS ====================

  /**
   * getModelName: Lấy tên device model theo ID
   * Tìm trong danh sách deviceModels đã load
   * 
   * @param {number} modelId - Device model ID
   * @returns {string} - Tên device model hoặc modelId nếu không tìm thấy
   */
  const getModelName = (modelId) => {
    if (!modelId) return "—";
    const model = deviceModels.find((m) => m.deviceModelId === modelId || m.id === modelId);
    return model?.deviceName || model?.name || modelId;
  };

  // ==================== TABLE COLUMNS CONFIGURATION ====================

  /**
   * columns: Cấu hình các cột của bảng
   * 
   * Các cột bao gồm:
   * 1. ID - Có sort, mặc định sort descend
   * 2. Tên tình trạng - Text thường
   * 3. Mẫu thiết bị - Tag màu xanh với tooltip
   * 4. Mô tả - Text hoặc "—"
   * 5. Loại tình trạng - Tag với màu theo CONDITION_TYPE_OPTIONS
   * 6. Mức độ nghiêm trọng - Tag với màu theo CONDITION_SEVERITY_OPTIONS
   * 7. Chi phí bồi thường - Format VND currency
   * 8. Thao tác - Buttons: Xem, Sửa, Xóa (với Popconfirm)
   */
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 80,
      sorter: (a, b) => (a.id || 0) - (b.id || 0),
      defaultSortOrder: "descend",
      sortDirections: ["descend", "ascend"],
    },
    {
      title: "Tên tình trạng", 
      dataIndex: "name",
      width: 180,
      ellipsis: true,
    },
    {
      title: "Mẫu thiết bị",
      dataIndex: "deviceModelId",
      width: 180,
      ellipsis: true,
      render: (modelId) => {
        const modelName = getModelName(modelId);
        return (
          <Tooltip title={modelName}>
            <Tag color="blue">{modelName}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      width: 220,
      ellipsis: true,
      render: (text) => text || "—",
    },
    {
      title: "Loại tình trạng",
      dataIndex: "conditionType",
      width: 140,
      render: (type) => {
        const meta = getTypeMeta(type);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Mức độ nghiêm trọng",
      dataIndex: "conditionSeverity",
      width: 160,
      render: (sev) => {
        const meta = getSeverityMeta(sev);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Chi phí bồi thường mặc định",
      dataIndex: "defaultCompensation",
      width: 180,
      align: "right",
      render: (comp) => {
        const formatted = Number(comp || 0).toLocaleString("vi-VN", {
          style: "currency",
          currency: "VND",
        });
        return <Text>{formatted}</Text>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 200,
      render: (_, r) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => onView(r)}>
            Xem
          </Button>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(r)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa condition definition này?"
            onConfirm={() => onDelete(r)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== RENDER UI ====================

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Title level={3} style={{ marginBottom: 12 }}>
          Quản lý Tình trạng thiết bị
        </Title>

        <Card
          title="Danh sách tình trạng thiết bị"
          extra={
            <Space>
              <Select
                value={deviceModelFilter}
                allowClear
                placeholder="Lọc theo mẫu thiết bị"
                style={{ width: 200 }}
                loading={modelLoading}
                onChange={(v) => setDeviceModelFilter(v)}
                options={deviceModels.map((m) => ({
                  label: m.deviceName || m.name || `Model #${m.deviceModelId || m.id}`,
                  value: m.deviceModelId || m.id,
                }))}
              />
              <Button icon={<ReloadOutlined />} onClick={loadConditions} loading={loading}>
                Làm mới
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                Thêm tình trạng
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={conditions}
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1600 }}
          />
        </Card>

        {/* ========== Modal TẠO ========== */}
        <Modal
          open={openCreate}
          title="Tạo Condition Definition"
          onCancel={() => setOpenCreate(false)}
          onOk={() => createForm.submit()}
          okText="Tạo"
          width={600}
        >
          <Form form={createForm} layout="vertical" onFinish={submitCreate}>
            <Form.Item
              label="Tên tình trạng thiết bị"
              name="name"
              rules={[{ required: true, message: "Nhập tên condition definition" }]}
            >
              <Input placeholder="Ví dụ: Trầy xước nhẹ" />
            </Form.Item>
            <Form.Item
              label="Mẫu thiết bị"
              name="deviceModelId"
              rules={[{ required: true, message: "Chọn mẫu thiết bị" }]}
            >
              <Select
                placeholder="Chọn mẫu thiết bị"
                loading={modelLoading}
                options={deviceModels.map((m) => ({
                  label: m.deviceName || m.name || `Model #${m.deviceModelId || m.id}`,
                  value: m.deviceModelId || m.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="Mô tả tình trạng thiết bị" name="description">
              <TextArea rows={3} placeholder="Mô tả chi tiết về condition..." />
            </Form.Item>
            <Form.Item
              label="Loại tình trạng"
              name="conditionType"
              rules={[{ required: true, message: "Chọn loại tình trạng" }]}
            >
              <Select
                placeholder="Chọn loại tình trạng"
                options={CONDITION_TYPE_OPTIONS}
                onChange={(value) => {
                  const defaultSeverity = getDefaultSeverityByType(value);
                  createForm.setFieldsValue({ conditionSeverity: defaultSeverity });
                }}
              />
            </Form.Item>
            <Form.Item
              label="Mức độ nghiêm trọng"
              name="conditionSeverity"
              dependencies={["conditionType"]}
              rules={[{ required: true, message: "Chọn mức độ nghiêm trọng" }]}
            >
              <Select
                placeholder="Chọn mức độ"
                options={getSeverityOptionsByType(createConditionType)}
                disabled={createConditionType === "GOOD" || createConditionType === "LOST"}
              />
            </Form.Item>
            <Form.Item
              label="Chi phí bồi thường (VND)"
              name="defaultCompensation"
              rules={[{ required: true, message: "Nhập chi phí bồi thường mặc định" }]}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                placeholder="0"
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* ========== Modal SỬA ========== */}
        <Modal
          open={openEdit}
          title={`Cập nhật Condition Definition #${editingCondition?.id ?? ""}`}
          onCancel={() => {
            setOpenEdit(false);
            setEditingCondition(null);
          }}
          onOk={() => editForm.submit()}
          okText="Lưu"
          width={600}
        >
          <Form form={editForm} layout="vertical" onFinish={submitEdit}>
            <Form.Item
              label="Tên"
              name="name"
              rules={[{ required: true, message: "Nhập tên condition definition" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Mẫu thiết bị"
              name="deviceModelId"
              rules={[{ required: true, message: "Chọn mẫu thiết bị" }]}
            >
              <Select
                placeholder="Chọn mẫu thiết bị"
                loading={modelLoading}
                options={deviceModels.map((m) => ({
                  label: m.deviceName || m.name || `Model #${m.deviceModelId || m.id}`,
                  value: m.deviceModelId || m.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="Mô tả tình trạng thiết bị" name="description">
              <TextArea rows={3} />
            </Form.Item>
            <Form.Item
              label="Loại tình trạng"
              name="conditionType"
              rules={[{ required: true, message: "Chọn loại tình trạng" }]}
            >
              <Select
                placeholder="Chọn loại tình trạng"
                options={CONDITION_TYPE_OPTIONS}
                onChange={(value) => {
                  const defaultSeverity = getDefaultSeverityByType(value);
                  editForm.setFieldsValue({ conditionSeverity: defaultSeverity });
                }}
              />
            </Form.Item>
            <Form.Item
              label="Mức độ nghiêm trọng"
              name="conditionSeverity"
              dependencies={["conditionType"]}
              rules={[{ required: true, message: "Chọn mức độ nghiêm trọng" }]}
            >
              <Select
                placeholder="Chọn mức độ"
                options={getSeverityOptionsByType(editConditionType)}
                disabled={editConditionType === "GOOD" || editConditionType === "LOST"}
              />
            </Form.Item>
            <Form.Item
              label="Chi phí bồi thường mặc định (VND)"
              name="defaultCompensation"
              rules={[{ required: true, message: "Nhập chi phí bồi thường mặc định" }]}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* ========== Modal XEM chi tiết ========== */}
        <Modal
          open={openView}
          title="Chi tiết Condition Definition"
          footer={null}
          onCancel={() => setOpenView(false)}
          width={600}
        >
          {viewingCondition ? (
            <Descriptions bordered column={1} size="middle">
              <Descriptions.Item label="ID">{viewingCondition.id}</Descriptions.Item>
              <Descriptions.Item label="Tên">{viewingCondition.name || "—"}</Descriptions.Item>
              <Descriptions.Item label="Mẫu thiết bị">
                <Tag color="blue">{getModelName(viewingCondition.deviceModelId)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả tình trạng thiết bị">
                {viewingCondition.description || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Loại tình trạng">
                {(() => {
                  const meta = getTypeMeta(viewingCondition.conditionType);
                  return <Tag color={meta.color}>{meta.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Mức độ nghiêm trọng">
                {(() => {
                  const meta = getSeverityMeta(viewingCondition.conditionSeverity);
                  return <Tag color={meta.color}>{meta.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="chi phí bồi thường mặc định">
                {Number(viewingCondition.defaultCompensation || 0).toLocaleString("vi-VN", {
                  style: "currency",
                  currency: "VND",
                })}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">Đang tải…</Text>
          )}
        </Modal>
      </div>
    </div>
  );
}

