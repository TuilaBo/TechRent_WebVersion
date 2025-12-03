// src/pages/admin/AdminTerm.jsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  Typography,
  Divider,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import {
  listDeviceTerms,
  createDeviceTerm,
  updateDeviceTerm,
  deleteDeviceTerm,
} from "../../lib/deviceTerm";
import toast from "react-hot-toast";
import { fetchCategories } from "../../lib/categoryApi";
import { searchDeviceModels } from "../../lib/deviceModelsApi"; // ✅ dùng device models

const { Title, Text } = Typography;

const activeOptions = [
  { label: "Tất cả", value: undefined },
  { label: "Đang kích hoạt", value: true },
  { label: "Ngừng hoạt động", value: false },
];

export default function AdminTerm() {
  const [allTerms, setAllTerms] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    deviceModelId: undefined,
    deviceCategoryId: undefined,
    active: undefined,
  });
  const [categories, setCategories] = useState([]);
  const [deviceModels, setDeviceModels] = useState([]); // ✅ models

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [form] = Form.useForm();
  const modalCategoryId = Form.useWatch("deviceCategoryId", form);
  const modalModelId = Form.useWatch("deviceModelId", form);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await listDeviceTerms();
      const normalized = Array.isArray(data) ? data : [];
      setAllTerms(normalized);
      setTerms(normalized);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải danh sách điều khoản.");
    } finally {
      setLoading(false);
    }
  };

  const loadMetaData = async () => {
    try {
      // ✅ Lấy categories + device models (active)
      const [cats, models] = await Promise.all([
        fetchCategories(),
        searchDeviceModels({ isActive: true, size: 1000 }),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setDeviceModels(Array.isArray(models) ? models : []);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải dữ liệu tham chiếu.");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const applyFilters = () => {
      let rows = Array.isArray(allTerms) ? [...allTerms] : [];
      if (filters.deviceCategoryId != null) {
        rows = rows.filter(
          (item) =>
            Number(item.deviceCategoryId ?? item.categoryId ?? null) ===
            Number(filters.deviceCategoryId)
        );
      }
      if (filters.deviceModelId != null) {
        rows = rows.filter(
          (item) =>
            Number(item.deviceModelId ?? item.modelId ?? null) ===
            Number(filters.deviceModelId)
        );
      }
      if (typeof filters.active === "boolean") {
        rows = rows.filter((item) => Boolean(item.active) === filters.active);
      }
      setTerms(rows);
    };
    applyFilters();
  }, [filters, allTerms]);

  useEffect(() => {
    loadMetaData();
  }, []);

  const resetFilters = () => {
    setFilters({
      deviceModelId: undefined,
      deviceCategoryId: undefined,
      active: undefined,
    });
  };

  const openModal = (term = null) => {
    setEditingTerm(term);
    if (term) {
      form.setFieldsValue({
        title: term.title,
        content: term.content,
        deviceModelId: term.deviceModelId ?? undefined, // ✅
        deviceCategoryId: term.deviceCategoryId ?? undefined,
        active: term.active ?? true,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ active: true });
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const normalizedModelId =
        values.deviceModelId !== undefined && values.deviceModelId !== null
          ? Number(values.deviceModelId)
          : null;

      const normalizedCategoryId =
        values.deviceCategoryId !== undefined && values.deviceCategoryId !== null
          ? Number(values.deviceCategoryId)
          : null;

      const payload = {
        title: values.title,
        content: values.content,
        deviceModelId: normalizedModelId, // ✅ BE mới
        deviceCategoryId: normalizedCategoryId,
        active: values.active ?? true,
      };

      const editingId = editingTerm?.termId;
      const isEditing = editingId !== undefined && editingId !== null;

      if (isEditing) {
        await updateDeviceTerm(Number(editingId), payload);
        toast.success("Đã cập nhật điều khoản.");
      } else {
        await createDeviceTerm(payload);
        toast.success("Đã tạo điều khoản mới.");
      }

      setModalVisible(false);
      setEditingTerm(null);
      fetchData();
    } catch (error) {
      if (!error?.errorFields) {
        console.error(error);
        toast.error(error?.response?.data?.message || "Thao tác thất bại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (term) => {
    try {
      const id = term.termId;
      await deleteDeviceTerm(id);
      toast.success("Đã xoá điều khoản.");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Không thể xoá điều khoản.");
    }
  };

  const columns = [
    {
      title: "Tiêu đề",
      dataIndex: "title",
      key: "title",
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: "Nội dung",
      dataIndex: "content",
      key: "content",
      render: (v) => (
        <Text
          style={{ display: "inline-block", maxWidth: 320 }}
          ellipsis={{ tooltip: v }}
        >
          {v}
        </Text>
      ),
    },
    {
      title: "Mẫu thiết bị",
      key: "deviceModel",
      render: (_, record) => {
        const model = deviceModels.find(
          (m) =>
            (m.deviceModelId ?? m.id) ===
            (record.deviceModelId ?? record.modelId ?? null)
        );

        if (model) {
          const name = model.deviceName ?? model.name ?? `Model #${model.deviceModelId ?? model.id}`;
          const brand =
            model.brand?.brandName ||
            model.brand ||
            model.manufacturer ||
            "";
          const label = brand ? `${name} (${brand})` : name;
          return <Tag color="geekblue">{label}</Tag>;
        }

        if (record.deviceModelName) {
          return <Tag color="geekblue">{record.deviceModelName}</Tag>;
        }

        return record.deviceModelId ? (
          <Tag>{`Model #${record.deviceModelId}`}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: "Danh mục",
      key: "category",
      render: (_, record) => {
        const cat = categories.find(
          (c) =>
            (c.deviceCategoryId ?? c.id) === record.deviceCategoryId
        );
        if (cat) {
          return (
            <Tag color="purple">
              {cat.name ?? cat.categoryName ?? "Danh mục"}
            </Tag>
          );
        }
        if (record.deviceCategoryName) {
          return <Tag color="purple">{record.deviceCategoryName}</Tag>;
        }
        return record.deviceCategoryId ? (
          <Tag>{`Category #${record.deviceCategoryId}`}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "active",
      key: "active",
      align: "center",
      render: (active) => (
        <Tag color={active ? "green" : "red"}>
          {active ? "Đang sử dụng" : "Ngừng áp dụng"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "right",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openModal(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="XOÁ ĐIỀU KHOẢN"
            description="Bạn có chắc muốn xoá điều khoản này?"
            okText="Xoá"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              Xoá
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const mapModelOption = (modelList) =>
    modelList.map((m) => {
      const id = m.deviceModelId ?? m.id;
      const name = m.deviceName ?? m.name ?? `Model #${id}`;
      const brand =
        m.brand?.brandName || m.brand || m.manufacturer || "";
      const label = brand ? `${name} (${brand})` : name;
      const categoryId =
        m.deviceCategoryId ?? m.categoryId ?? m.category?.id;
      return {
        label,
        value: id,
        categoryId,
      };
    });

  const filterModelOptions = mapModelOption(
    deviceModels.filter((m) => {
      if (!filters.deviceCategoryId) return true;
      const catId =
        m.deviceCategoryId ?? m.categoryId ?? m.category?.id;
      return Number(catId) === Number(filters.deviceCategoryId);
    })
  );

  const modalModelOptions = mapModelOption(
    deviceModels.filter((m) => {
      if (!modalCategoryId) return true;
      const catId =
        m.deviceCategoryId ?? m.categoryId ?? m.category?.id;
      return Number(catId) === Number(modalCategoryId);
    })
  );

  // Khi đổi danh mục trong modal, nếu model đang chọn không thuộc danh mục đó -> clear
  useEffect(() => {
    if (!modalCategoryId) return;
    const modelId = form.getFieldValue("deviceModelId");
    if (!modelId) return;

    const model = deviceModels.find(
      (m) => (m.deviceModelId ?? m.id) === modelId
    );
    if (!model) return;

    const catId =
      model.deviceCategoryId ?? model.categoryId ?? model.category?.id;

    if (Number(catId) !== Number(modalCategoryId)) {
      form.setFieldsValue({ deviceModelId: undefined });
    }
  }, [modalCategoryId, deviceModels, form]);

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{ marginBottom: 16, borderRadius: 16 }}
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Quản lý điều khoản thiết bị
            </Title>
            <Text type="secondary">
              Tạo quy định riêng cho từng mẫu thiết bị hoặc danh mục thiết bị.
            </Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              Tải lại
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
            >
              Thêm điều khoản
            </Button>
          </Space>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        <Space size="large" wrap>
          <div>
            <Text style={{ display: "block", marginBottom: 4 }}>Danh mục</Text>
            <Select
              allowClear
              showSearch
              placeholder="Chọn danh mục"
              style={{ minWidth: 220 }}
              value={filters.deviceCategoryId}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  deviceCategoryId:
                    value != null ? Number(value) : undefined,
                }))
              }
              options={categories.map((cat) => ({
                label: cat.name ?? cat.categoryName,
                value: cat.deviceCategoryId ?? cat.id,
              }))}
            />
          </div>
          <div>
            <Text style={{ display: "block", marginBottom: 4 }}>
              Mẫu thiết bị
            </Text>
            <Select
              allowClear
              showSearch
              placeholder="Chọn mẫu thiết bị"
              style={{ minWidth: 220 }}
              value={filters.deviceModelId}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  deviceModelId:
                    value != null ? Number(value) : undefined,
                }))
              }
              options={filterModelOptions}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </div>
          <div>
            <Text style={{ display: "block", marginBottom: 4 }}>
              Trạng thái
            </Text>
            <Select
              allowClear
              placeholder="Lọc theo trạng thái"
              style={{ minWidth: 180 }}
              value={filters.active}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, active: value }))
              }
              options={activeOptions}
            />
          </div>
          <Button icon={<FilterOutlined />} onClick={resetFilters}>
            Reset bộ lọc
          </Button>
        </Space>
      </Card>

      <Card
        bodyStyle={{ padding: 0 }}
        style={{ borderRadius: 16, overflow: "hidden" }}
      >
        <Table
          rowKey={(record) => record.termId}
          columns={columns}
          dataSource={terms}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      <Modal
        title={editingTerm ? "Cập nhật điều khoản" : "Thêm điều khoản"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTerm(null);
        }}
        onOk={handleSubmit}
        okText={editingTerm ? "Lưu thay đổi" : "Tạo mới"}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ active: true }}>
          <Form.Item
            label="Tiêu đề"
            name="title"
            rules={[{ required: true, message: "Nhập tiêu đề điều khoản" }]}
          >
            <Input placeholder="Ví dụ: Quy định bảo quản" />
          </Form.Item>
          <Form.Item
            label="Nội dung điều khoản"
            name="content"
            rules={[
              { required: true, message: "Nhập nội dung điều khoản" },
            ]}
          >
            <Input.TextArea
              rows={5}
              placeholder="Mô tả chi tiết điều khoản áp dụng"
            />
          </Form.Item>
          <Space size="large" align="start" style={{ width: "100%" }} wrap>
            <Form.Item
              label="Mẫu thiết bị"
              name="deviceModelId"
              style={{ flex: 1, minWidth: 220 }}
            >
              <Select
                allowClear
                showSearch
                disabled={!!modalCategoryId}
                placeholder="Chọn mẫu thiết bị áp dụng"
                options={modalModelOptions}
                filterOption={(input, option) =>
                  (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item
              label="Danh mục"
              name="deviceCategoryId"
              style={{ flex: 1, minWidth: 220 }}
            >
              <Select
                allowClear
                disabled={!!modalModelId}
                placeholder="Hoặc chọn theo danh mục"
                options={categories.map((cat) => ({
                  label: cat.name ?? cat.categoryName,
                  value: cat.deviceCategoryId ?? cat.id,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="Trạng thái"
              name="active"
              valuePropName="checked"
              style={{ minWidth: 120 }}
            >
              <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
            </Form.Item>
          </Space>
          <Text type="secondary">
            Chọn một trong hai: mẫu thiết bị cụ thể HOẶC danh mục thiết bị. Để trống cả hai nếu muốn tạo điều khoản chung.
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
