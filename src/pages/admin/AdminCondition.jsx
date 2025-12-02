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

const CONDITION_TYPE_OPTIONS = [
  { label: "Tốt (GOOD)", value: "GOOD", color: "green" },
  { label: "Hư hỏng (DAMAGED)", value: "DAMAGED", color: "volcano" },
  { label: "Mất (LOST)", value: "LOST", color: "red" },
];

const CONDITION_SEVERITY_OPTIONS = [
  { label: "Không có (INFO)", value: "INFO", color: "default" },
  { label: "Nhẹ (LOW)", value: "LOW", color: "green" },
  { label: "Trung bình (MEDIUM)", value: "MEDIUM", color: "gold" },
  { label: "Nghiêm trọng (HIGH)", value: "HIGH", color: "orange" },
  { label: "Khẩn cấp (CRITICAL)", value: "CRITICAL", color: "red" },
];

const getTypeMeta = (value) =>
  CONDITION_TYPE_OPTIONS.find((opt) => opt.value === value) || {
    label: value || "—",
    color: "default",
  };

const getSeverityMeta = (value) =>
  CONDITION_SEVERITY_OPTIONS.find((opt) => opt.value === value) || {
    label: value || "—",
    color: "default",
  };

export default function AdminCondition() {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceModels, setDeviceModels] = useState([]);
  const [modelLoading, setModelLoading] = useState(false);

  // Filter
  const [deviceModelFilter, setDeviceModelFilter] = useState(null);

  // Create
  const [createForm] = Form.useForm();
  const [openCreate, setOpenCreate] = useState(false);

  // View
  const [openView, setOpenView] = useState(false);
  const [viewingCondition, setViewingCondition] = useState(null);

  // Edit
  const [openEdit, setOpenEdit] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [editForm] = Form.useForm();

  // Load device models
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

  // Load conditions
  const loadConditions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (deviceModelFilter != null) {
        params.deviceModelId = deviceModelFilter;
      }
      const list = await getConditionDefinitions(params);
      const mapped = list.map(normalizeConditionDefinition);
      // Sort mới nhất trước
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

  useEffect(() => {
    loadDeviceModels();
  }, []);

  useEffect(() => {
    loadConditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceModelFilter]);

  // Create
  const openCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      impactRate: 100,
      defaultCompensation: 0,
      conditionType: "GOOD",
      conditionSeverity: "INFO",
    });
    setOpenCreate(true);
  };

  const submitCreate = async (vals) => {
    try {
      await createConditionDefinition({
        name: vals.name,
        deviceModelId: vals.deviceModelId,
        description: vals.description || "",
        impactRate: vals.impactRate ?? 100,
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

  // View
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

  // Edit
  const openEditModal = (row) => {
    const current = normalizeConditionDefinition(row);
    setEditingCondition(current);
    editForm.setFieldsValue({
      name: current.name,
      deviceModelId: current.deviceModelId,
      description: current.description,
      impactRate: current.impactRate,
      conditionType: current.conditionType || "GOOD",
      conditionSeverity: current.conditionSeverity || "INFO",
      defaultCompensation: current.defaultCompensation,
    });
    setOpenEdit(true);
  };

  const submitEdit = async (vals) => {
    if (!editingCondition) return;
    const id = editingCondition.id;

    try {
      await updateConditionDefinition(id, {
        name: vals.name,
        deviceModelId: vals.deviceModelId,
        description: vals.description,
        impactRate: vals.impactRate,
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

  // Delete
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

  // Get model name by ID
  const getModelName = (modelId) => {
    if (!modelId) return "—";
    const model = deviceModels.find((m) => m.deviceModelId === modelId || m.id === modelId);
    return model?.deviceName || model?.name || modelId;
  };

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
      title: "Tỷ lệ ảnh hưởng (%)",
      dataIndex: "impactRate",
      width: 150,
      align: "center",
      render: (rate) => `${rate ?? 0}%`,
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
              label="Tỷ lệ ảnh hưởng đến thiết bị(%)"
              name="impactRate"
              rules={[{ required: true, message: "Nhập tỷ lệ ảnh hưởng" }]}
            >
              <InputNumber
                min={0}
                max={100}
                style={{ width: "100%" }}
                placeholder="0-100"
              />
            </Form.Item>
            <Form.Item
              label="Loại tình trạng"
              name="conditionType"
              rules={[{ required: true, message: "Chọn loại tình trạng" }]}
            >
              <Select
                placeholder="Chọn loại tình trạng"
                options={CONDITION_TYPE_OPTIONS}
              />
            </Form.Item>
            <Form.Item
              label="Mức độ nghiêm trọng"
              name="conditionSeverity"
              rules={[{ required: true, message: "Chọn mức độ nghiêm trọng" }]}
            >
              <Select
                placeholder="Chọn mức độ"
                options={CONDITION_SEVERITY_OPTIONS}
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
              label="Tỷ lệ ảnh hưởng (%)"
              name="impactRate"
              rules={[{ required: true, message: "Nhập tỷ lệ ảnh hưởng" }]}
            >
              <InputNumber
                min={0}
                max={100}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              label="Loại tình trạng"
              name="conditionType"
              rules={[{ required: true, message: "Chọn loại tình trạng" }]}
            >
              <Select
                placeholder="Chọn loại tình trạng"
                options={CONDITION_TYPE_OPTIONS}
              />
            </Form.Item>
            <Form.Item
              label="Mức độ nghiêm trọng"
              name="conditionSeverity"
              rules={[{ required: true, message: "Chọn mức độ nghiêm trọng" }]}
            >
              <Select
                placeholder="Chọn mức độ"
                options={CONDITION_SEVERITY_OPTIONS}
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
              <Descriptions.Item label="Tỷ lệ ảnh hưởng đến thiết bị">
                {viewingCondition.impactRate ?? 0}%
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

