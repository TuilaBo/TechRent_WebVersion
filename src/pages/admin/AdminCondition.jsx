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
  Switch,
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
import { listDeviceCategories } from "../../lib/deviceManage";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AdminCondition() {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceCategories, setDeviceCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Filter
  const [deviceCategoryFilter, setDeviceCategoryFilter] = useState(null);

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

  // Load device categories
  const loadDeviceCategories = async () => {
    try {
      setCategoryLoading(true);
      const categories = await listDeviceCategories();
      setDeviceCategories(Array.isArray(categories) ? categories : []);
    } catch (e) {
      console.error("Failed to load device categories:", e);
      setDeviceCategories([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  // Load conditions
  const loadConditions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (deviceCategoryFilter != null) {
        params.deviceCategoryId = deviceCategoryFilter;
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
    loadDeviceCategories();
  }, []);

  useEffect(() => {
    loadConditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceCategoryFilter]);

  // Create
  const openCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      impactRate: 100,
      damage: false,
      defaultCompensation: 0,
    });
    setOpenCreate(true);
  };

  const submitCreate = async (vals) => {
    try {
      await createConditionDefinition({
        name: vals.name,
        deviceCategoryId: vals.deviceCategoryId,
        description: vals.description || "",
        impactRate: vals.impactRate ?? 100,
        damage: vals.damage ?? false,
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
      deviceCategoryId: current.deviceCategoryId,
      description: current.description,
      impactRate: current.impactRate,
      damage: current.damage,
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
        deviceCategoryId: vals.deviceCategoryId,
        description: vals.description,
        impactRate: vals.impactRate,
        damage: vals.damage,
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

  // Get category name by ID
  const getCategoryName = (categoryId) => {
    if (!categoryId) return "—";
    const category = deviceCategories.find((c) => c.deviceCategoryId === categoryId || c.id === categoryId);
    return category?.deviceCategoryName || category?.name || categoryId;
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
      title: "Tên",
      dataIndex: "name",
      width: 200,
      ellipsis: true,
    },
    {
      title: "Danh mục thiết bị",
      dataIndex: "deviceCategoryId",
      width: 180,
      render: (categoryId) => (
        <Tag color="blue">{getCategoryName(categoryId)}</Tag>
      ),
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      ellipsis: true,
      render: (text) => text || "—",
    },
    {
      title: "Tỷ lệ ảnh hưởng (%)",
      dataIndex: "impactRate",
      width: 150,
      align: "center",
      render: (rate) => `${rate ?? 0}%`,
    },
    {
      title: "Gây hư hỏng",
      dataIndex: "damage",
      width: 120,
      align: "center",
      render: (damage) =>
        damage ? <Tag color="red">Có</Tag> : <Tag color="green">Không</Tag>,
    },
    {
      title: "Bồi thường mặc định",
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
          Quản lý Condition Definitions
        </Title>

        <Card
          title="Danh sách Condition Definitions"
          extra={
            <Space>
              <Select
                value={deviceCategoryFilter}
                allowClear
                placeholder="Lọc theo danh mục"
                style={{ width: 200 }}
                loading={categoryLoading}
                onChange={(v) => setDeviceCategoryFilter(v)}
                options={deviceCategories.map((c) => ({
                  label: c.deviceCategoryName || c.name || `Category #${c.deviceCategoryId || c.id}`,
                  value: c.deviceCategoryId || c.id,
                }))}
              />
              <Button icon={<ReloadOutlined />} onClick={loadConditions} loading={loading}>
                Làm mới
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                Thêm Condition
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
            scroll={{ x: 1400 }}
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
              label="Tên"
              name="name"
              rules={[{ required: true, message: "Nhập tên condition definition" }]}
            >
              <Input placeholder="Ví dụ: Trầy xước nhẹ" />
            </Form.Item>
            <Form.Item
              label="Danh mục thiết bị"
              name="deviceCategoryId"
              rules={[{ required: true, message: "Chọn danh mục thiết bị" }]}
            >
              <Select
                placeholder="Chọn danh mục"
                loading={categoryLoading}
                options={deviceCategories.map((c) => ({
                  label: c.deviceCategoryName || c.name || `Category #${c.deviceCategoryId || c.id}`,
                  value: c.deviceCategoryId || c.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="Mô tả" name="description">
              <TextArea rows={3} placeholder="Mô tả chi tiết về condition..." />
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
                placeholder="0-100"
              />
            </Form.Item>
            <Form.Item
              label="Gây hư hỏng"
              name="damage"
              valuePropName="checked"
              tooltip="Bật nếu condition này gây hư hỏng thiết bị"
            >
              <Switch checkedChildren="Có" unCheckedChildren="Không" />
            </Form.Item>
            <Form.Item
              label="Bồi thường mặc định (VND)"
              name="defaultCompensation"
              rules={[{ required: true, message: "Nhập bồi thường mặc định" }]}
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
              label="Danh mục thiết bị"
              name="deviceCategoryId"
              rules={[{ required: true, message: "Chọn danh mục thiết bị" }]}
            >
              <Select
                placeholder="Chọn danh mục"
                loading={categoryLoading}
                options={deviceCategories.map((c) => ({
                  label: c.deviceCategoryName || c.name || `Category #${c.deviceCategoryId || c.id}`,
                  value: c.deviceCategoryId || c.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="Mô tả" name="description">
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
              label="Gây hư hỏng"
              name="damage"
              valuePropName="checked"
              tooltip="Bật nếu condition này gây hư hỏng thiết bị"
            >
              <Switch checkedChildren="Có" unCheckedChildren="Không" />
            </Form.Item>
            <Form.Item
              label="Bồi thường mặc định (VND)"
              name="defaultCompensation"
              rules={[{ required: true, message: "Nhập bồi thường mặc định" }]}
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
              <Descriptions.Item label="Danh mục thiết bị">
                <Tag color="blue">{getCategoryName(viewingCondition.deviceCategoryId)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả">
                {viewingCondition.description || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Tỷ lệ ảnh hưởng">
                {viewingCondition.impactRate ?? 0}%
              </Descriptions.Item>
              <Descriptions.Item label="Gây hư hỏng">
                {viewingCondition.damage ? (
                  <Tag color="red">Có</Tag>
                ) : (
                  <Tag color="green">Không</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Bồi thường mặc định">
                {Number(viewingCondition.defaultCompensation || 0).toLocaleString("vi-VN", {
                  style: "currency",
                  currency: "VND",
                })}
              </Descriptions.Item>
              <Descriptions.Item label="Tạo lúc">
                {viewingCondition.createdAt
                  ? new Date(viewingCondition.createdAt).toLocaleString("vi-VN")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật">
                {viewingCondition.updatedAt
                  ? new Date(viewingCondition.updatedAt).toLocaleString("vi-VN")
                  : "—"}
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

