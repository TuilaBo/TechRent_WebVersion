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
import { listDevices } from "../../lib/deviceManage";

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
    deviceId: undefined,
    deviceCategoryId: undefined,
    active: undefined,
  });
  const [categories, setCategories] = useState([]);
  const [devices, setDevices] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [form] = Form.useForm();
  const modalCategoryId = Form.useWatch("deviceCategoryId", form);
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
      const [cats, devs] = await Promise.all([fetchCategories(), listDevices()]);
      setCategories(Array.isArray(cats) ? cats : []);
      setDevices(Array.isArray(devs) ? devs : []);
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
      if (filters.deviceId != null) {
        rows = rows.filter(
          (item) => Number(item.deviceId ?? item.id ?? null) === Number(filters.deviceId)
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
      deviceId: undefined,
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
        deviceId: term.deviceId ?? undefined,
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

      const normalizedDeviceId =
        values.deviceId !== undefined && values.deviceId !== null
          ? Number(values.deviceId)
          : null;

      const normalizedCategoryId =
        values.deviceCategoryId !== undefined && values.deviceCategoryId !== null
          ? Number(values.deviceCategoryId)
          : null;

      const payload = {
        title: values.title,
        content: values.content,
        deviceId: normalizedDeviceId,
        deviceCategoryId: normalizedCategoryId,
        active: values.active ?? true,
      };

      // 🔥 FE giờ chỉ dùng term.termId (đã normalize từ deviceContractTermId)
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
      // Lỗi validate của form (error.errorFields) thì bỏ qua, không show toast đỏ
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
      title: "Thiết bị",
      key: "device",
      render: (_, record) => {
        const dev = devices.find(
          (d) => (d.deviceId ?? d.id) === record.deviceId
        );
        if (dev) {
          const label =
            dev.deviceName ||
            dev.name ||
            dev.deviceCode ||
            dev.serialNumber ||
            `Device #${dev.deviceId ?? dev.id}`;
          return <Tag color="geekblue">{label}</Tag>;
        }
        return record.deviceId ? (
          <Tag>{`Device #${record.deviceId}`}</Tag>
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

  const mapDeviceOption = (deviceList) =>
    deviceList.map((dev) => {
      const id = dev.deviceId ?? dev.id;
      const code =
        dev.serialNumber ||
        dev.deviceCode ||
        dev.deviceName ||
        dev.name ||
        `Device #${id}`;
      const modelName =
        dev.deviceModel?.deviceName || dev.deviceModelName || dev.name;
      const label = modelName ? `${code} - ${modelName}` : code;
      return {
        label,
        value: id,
        categoryId:
          dev.deviceCategoryId ??
          dev.categoryId ??
          dev.deviceModel?.deviceCategoryId ??
          dev.category?.id,
      };
    });

  const filterDeviceOptions = mapDeviceOption(
    devices.filter((dev) => {
      if (!filters.deviceCategoryId) return true;
      const catId =
        dev.deviceCategoryId ??
        dev.categoryId ??
        dev.category?.id ??
        dev.deviceModel?.deviceCategoryId;
      return catId === filters.deviceCategoryId;
    })
  );

  const modalDeviceOptions = mapDeviceOption(
    devices.filter((dev) => {
      if (!modalCategoryId) return true;
      const catId =
        dev.deviceCategoryId ??
        dev.categoryId ??
        dev.category?.id ??
        dev.deviceModel?.deviceCategoryId;
      return catId === modalCategoryId;
    })
  );

  // Khi đổi danh mục trong modal, nếu thiết bị đang chọn không thuộc danh mục đó -> clear
  useEffect(() => {
    if (!modalCategoryId) return;
    const deviceId = form.getFieldValue("deviceId");
    if (!deviceId) return;

    const device = devices.find(
      (dev) => (dev.deviceId ?? dev.id) === deviceId
    );
    if (!device) return;

    const catId =
      device.deviceCategoryId ??
      device.categoryId ??
      device.category?.id ??
      device.deviceModel?.deviceCategoryId;

    if (catId !== modalCategoryId) {
      form.setFieldsValue({ deviceId: undefined });
    }
  }, [modalCategoryId, devices, form]);

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
              Tạo quy định riêng cho từng thiết bị hoặc danh mục thiết bị.
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
            <Text style={{ display: "block", marginBottom: 4 }}>Thiết bị</Text>
            <Select
              allowClear
              showSearch
              placeholder="Chọn thiết bị"
              style={{ minWidth: 220 }}
              value={filters.deviceId}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  deviceId: value != null ? Number(value) : undefined,
                }))
              }
              options={filterDeviceOptions}
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
              label="Thiết bị"
              name="deviceId"
              style={{ flex: 1, minWidth: 220 }}
            >
              <Select
                allowClear
                showSearch
                placeholder="Chọn thiết bị áp dụng"
                options={modalDeviceOptions}
              />
            </Form.Item>
            <Form.Item
              label="Danh mục"
              name="deviceCategoryId"
              style={{ flex: 1, minWidth: 220 }}
            >
              <Select
                allowClear
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
            Bạn có thể chỉ định cụ thể cho một thiết bị, một danh mục, hoặc để
            trống cả hai để dùng làm điều khoản chung.
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
