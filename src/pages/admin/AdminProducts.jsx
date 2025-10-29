// src/pages/admin/AdminProducts.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Tabs,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";

import {
  // Device Categories
  listDeviceCategories,
  createDeviceCategory,
  updateDeviceCategory,
  deleteDeviceCategory,
  // Device Models
  listDeviceModels,
  createDeviceModel,
  updateDeviceModel,
  deleteDeviceModel,
  // Devices
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  // Accessories
  listAccessories,
  createAccessory,
  updateAccessory,
  deleteAccessory,
  // Brands (NEW)
  listBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  // Accessory Categories  <-- NEW
  listAccessoryCategories,
  createAccessoryCategory,
  updateAccessoryCategory,
  deleteAccessoryCategory,
} from "../../lib/deviceManage";

const { Title } = Typography;

/* Helpers */
const ActiveTag = ({ v }) =>
  v ? <Tag color="green">Đang hoạt động</Tag> : <Tag>Ngưng</Tag>;
const statusTag = (s) => {
  switch (String(s).toUpperCase()) {
    case "AVAILABLE":
      return <Tag color="green">Có sẵn</Tag>;
    case "RENTED":
      return <Tag color="blue">Đang thuê</Tag>;
    case "MAINTENANCE":
      return <Tag color="orange">Bảo trì</Tag>;
    case "BROKEN":
      return <Tag color="red">Hỏng</Tag>;
    default:
      return <Tag>{s}</Tag>;
  }
};

export default function AdminProducts() {
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [devices, setDevices] = useState([]);
  const [accs, setAccs] = useState([]);
  const [brands, setBrands] = useState([]); // NEW

  // NEW: accessory categories
  const [accCats, setAccCats] = useState([]);

  const catOptions = useMemo(
    () =>
      categories.map((c) => ({
        label: c.deviceCategoryName ?? c.name,
        value: c.deviceCategoryId ?? c.id,
      })),
    [categories]
  );

  const modelOptions = useMemo(
    () =>
      models.map((m) => ({
        label: `${m.deviceName ?? m.name} (${m.brand ?? ""})`,
        value: m.deviceModelId ?? m.id,
      })),
    [models]
  );

  // NEW: accessory category options
  const accCatOptions = useMemo(
    () =>
      accCats.map((c) => ({
        label: c.accessoryCategoryName ?? c.name,
        value: c.accessoryCategoryId ?? c.id,
      })),
    [accCats]
  );

  // NEW: brand options for device model form
  const brandOptions = useMemo(
    () =>
      (brands || []).map((b) => ({
        label: b.brandName ?? b.name,
        value: b.brandId ?? b.id, // lưu theo brandId
      })),
    [brands]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, mods, devs, acs, aCats, brs] = await Promise.all([
        listDeviceCategories(),
        listDeviceModels(),
        listDevices(),
        listAccessories(),
        listAccessoryCategories(), // NEW
        listBrands(),
      ]);
      setCategories(cats);
      setModels(mods);
      setDevices(devs);
      setAccs(acs);
      setAccCats(aCats); // NEW
      setBrands(brs); // NEW
    } catch (e) {
      toast.error(e?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ================= DEVICE CATEGORY TAB ================= */
  const CategoryTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();

    const cols = [
      {
        title: "ID",
        dataIndex: "deviceCategoryId",
        width: 90,
        render: (_, r) => r.deviceCategoryId ?? r.id,
      },
      {
        title: "Tên",
        dataIndex: "deviceCategoryName",
        render: (_, r) => r.deviceCategoryName ?? r.name,
      },
      { title: "Mô tả", dataIndex: "description" },
      // NEW status
      {
        title: "Trạng thái",
        dataIndex: "active",
        width: 150,
        render: (v) => <ActiveTag v={!!v} />,
      },
      {
        title: "Thao tác",
        width: 170,
        render: (_, r) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r);
                form.setFieldsValue({
                  deviceCategoryName: r.deviceCategoryName ?? r.name,
                  description: r.description ?? "",
                  active: r.active ?? true,
                });
                setOpen(true);
              }}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: "Xoá loại thiết bị?",
                  content:
                    "Nếu loại này đang được tham chiếu, server có thể từ chối xoá.",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    const id = r.deviceCategoryId ?? r.id;
                    const prev = categories;
                    setCategories(
                      prev.filter((x) => (x.deviceCategoryId ?? x.id) !== id)
                    );
                    try {
                      await deleteDeviceCategory(id);
                      toast.success("Đã xoá loại thiết bị");
                    } catch (e) {
                      setCategories(prev);
                      toast.error(e?.message || "Xoá thất bại");
                      throw e;
                    }
                  },
                })
              }
            />
          </Space>
        ),
      },
    ];

    const submit = async (v) => {
      try {
        if (editing) {
          const id = editing.deviceCategoryId ?? editing.id;
          await updateDeviceCategory(id, {
            deviceCategoryName: v.deviceCategoryName,
            description: v.description ?? "",
            active: !!v.active,
          });
          toast.success("Cập nhật loại thiết bị thành công");
        } else {
          await createDeviceCategory({
            deviceCategoryName: v.deviceCategoryName,
            description: v.description ?? "",
            active: !!v.active,
          });
          toast.success("Thêm loại thiết bị thành công");
        }
        setOpen(false);
        setEditing(null);
        form.resetFields();
        loadAll();
      } catch (e) {
        toast.error(e?.message || "Lưu thất bại");
      }
    };

    return (
      <>
        {contextHolder}
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Thêm loại thiết bị
          </Button>
        </Space>
        <Table
          rowKey={(r) => r.deviceCategoryId ?? r.id}
          columns={cols}
          dataSource={categories}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
        <Modal
          open={open}
          title={editing ? "Sửa loại thiết bị" : "Thêm loại thiết bị"}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item
              name="deviceCategoryName"
              label="Tên"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="active" label="Trạng thái" initialValue={true}>
              <Select
                options={[
                  { label: "Đang hoạt động", value: true },
                  { label: "Ngưng", value: false },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ================= DEVICE MODEL TAB ================= */
  const ModelTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();

    const cols = [
      {
        title: "ID",
        dataIndex: "deviceModelId",
        width: 90,
        render: (_, r) => r.deviceModelId ?? r.id,
      },
      {
        title: "Tên mẫu",
        dataIndex: "deviceName",
        render: (_, r) => r.deviceName ?? r.name,
      },
      {
        title: "Thương hiệu",
        dataIndex: "brandId",
        width: 140,
        render: (_, r) => {
          const id = r.brandId ?? r.brand?.id ?? null;
          if (id != null) {
            const b = brands.find((x) => (x.brandId ?? x.id) === id);
            return b ? b.brandName ?? b.name : id;
          }
          // fallback nếu BE vẫn trả brand string cũ
          return r.brand ?? "-";
        },
      },
      {
        title: "Loại",
        dataIndex: "deviceCategoryId",
        width: 160,
        render: (id) => {
          const c = categories.find(
            (x) => (x.deviceCategoryId ?? x.id) === (id ?? 0)
          );
          return c ? c.deviceCategoryName ?? c.name : id;
        },
      },
      {
        title: "Thông số",
        dataIndex: "specifications",
        ellipsis: true,
        render: (v) => {
          if (!v) return "-";
          
          try {
            // Try to parse as JSON
            const parsed = typeof v === 'string' ? JSON.parse(v) : v;
            if (typeof parsed === 'object' && parsed !== null) {
              // Format as key-value pairs
              return Object.entries(parsed)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            }
            return v;
          } catch {
            // If not valid JSON, return as is
            return v;
          }
        },
      },
      {
        title: "Hoạt động",
        dataIndex: "active",
        width: 150,
        render: (v) => <ActiveTag v={!!v} />,
      },
      {
        title: "Thao tác",
        width: 170,
        render: (_, r) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r);
                form.setFieldsValue({
                  deviceName: r.deviceName ?? r.name,
                  brandId: r.brandId ?? (function () {
                    const match = (brands || []).find((b) => (b.brandName ?? b.name) === r.brand);
                    return match ? (match.brandId ?? match.id) : undefined;
                  })(),
                  deviceCategoryId: r.deviceCategoryId,
                  specifications: r.specifications ?? r.specs_json,
                  imageURL: r.imageURL ?? r.imageUrl ?? r.image,
                  pricePerDay: r.pricePerDay,
                  deviceValue: r.deviceValue,
                  depositPercent: r.depositPercent,
                  active: r.active ?? true,
                });
                setOpen(true);
              }}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: "Xoá mẫu thiết bị?",
                  content:
                    "Nếu còn thiết bị tham chiếu mẫu này, cần xử lý trước.",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    const id = r.deviceModelId ?? r.id;

                    const prev = models;
                    setModels(
                      prev.filter((x) => (x.deviceModelId ?? x.id) !== id)
                    );
                    try {
                      await deleteDeviceModel(id);
                      toast.success("Đã xoá mẫu thiết bị");
                    } catch (e) {
                      setModels(prev);
                      toast.error(e?.message || "Xoá thất bại");
                      throw e;
                    }
                  },
                })
              }
            />
          </Space>
        ),
      },
    ];

    const submit = async (v) => {
      try {
        const payload = {
          deviceName: v.deviceName,
          brandId: v.brandId,
          imageURL: v.imageURL ?? "",
          specifications: v.specifications ?? "",
          deviceCategoryId: v.deviceCategoryId,
          deviceValue: Number(v.deviceValue ?? 0),
          pricePerDay: Number(v.pricePerDay ?? 0),
          depositPercent: Number(v.depositPercent ?? 0),
          active: !!v.active,
        };
        if (editing) {
          const id = editing.deviceModelId ?? editing.id;
          await updateDeviceModel(id, payload);
          toast.success("Cập nhật mẫu thiết bị thành công");
        } else {
          await createDeviceModel(payload);
          toast.success("Thêm mẫu thiết bị thành công");
        }
        setOpen(false);
        setEditing(null);
        form.resetFields();
        loadAll();
      } catch (e) {
        toast.error(e?.message || "Lưu thất bại");
      }
    };

    return (
      <>
        {contextHolder}
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Thêm mẫu thiết bị
          </Button>
        </Space>
        <Table
          rowKey={(r) => r.deviceModelId ?? r.id}
          columns={cols}
          dataSource={models}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
        <Modal
          open={open}
          title={editing ? "Sửa mẫu thiết bị" : "Thêm mẫu thiết bị"}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item
              name="deviceName"
              label="Tên mẫu"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="brandId"
              label="Thương hiệu"
              rules={[{ required: true }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn thương hiệu"
                options={brandOptions}
              />
            </Form.Item>
            <Form.Item
              name="deviceCategoryId"
              label="Loại"
              rules={[{ required: true }]}
            >
              <Select options={catOptions} />
            </Form.Item>
            <Form.Item name="specifications" label="Thông số">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="imageURL" label="Ảnh (URL)">
              <Input />
            </Form.Item>
            <Form.Item name="pricePerDay" label="Giá/ngày">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="deviceValue" label="Giá trị thiết bị">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="depositPercent" label="Tỉ lệ cọc (0 → 1)">
              <Input type="number" step="0.01" />
            </Form.Item>
            <Form.Item name="active" label="Trạng thái" initialValue={true}>
              <Select
                options={[
                  { label: "Đang hoạt động", value: true },
                  { label: "Ngưng", value: false },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ================= DEVICE TAB ================= */
  const DeviceTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();

    const cols = [
      {
        title: "ID",
        dataIndex: "deviceId",
        width: 90,
        render: (_, r) => r.deviceId ?? r.id,
      },
      {
        title: "Mẫu",
        dataIndex: "deviceModelId",
        render: (id) => {
          const m = models.find((x) => (x.deviceModelId ?? x.id) === (id ?? 0));
          return m ? m.deviceName ?? m.name : id;
        },
      },
      { title: "Serial", dataIndex: "serialNumber" },
      {
        title: "Ngày mua",
        dataIndex: "acquireAt",
        width: 160,
        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD") : "-"),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 140,
        render: statusTag,
      },
      { title: "Vị trí kệ", dataIndex: "shelfCode", width: 110 },
      {
        title: "Thao tác",
        width: 170,
        render: (_, r) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r);
                form.setFieldsValue({
                  deviceModelId: r.deviceModelId,
                  serialNumber: r.serialNumber,
                  acquireAt: r.acquireAt ? dayjs(r.acquireAt) : null,
                  status: r.status ?? "AVAILABLE",
                  shelfCode: r.shelfCode ?? "",
                });
                setOpen(true);
              }}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: "Xoá thiết bị?",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    const id = r.deviceId ?? r.id;
                    const prev = devices;
                    setDevices(prev.filter((x) => (x.deviceId ?? x.id) !== id));
                    try {
                      await deleteDevice(id);
                      toast.success("Đã xoá thiết bị");
                    } catch (e) {
                      setDevices(prev);
                      toast.error(e?.message || "Xoá thất bại");
                      throw e;
                    }
                  },
                })
              }
            />
          </Space>
        ),
      },
    ];

    const submit = async (v) => {
      try {
        const payload = {
          deviceModelId: v.deviceModelId,
          serialNumber: v.serialNumber,
          acquireAt: v.acquireAt ? v.acquireAt.toDate().toISOString() : null,
          status: v.status ?? "AVAILABLE",
          shelfCode: v.shelfCode ?? null,
        };
        if (editing) {
          const id = editing.deviceId ?? editing.id;
          await updateDevice(id, payload);
          toast.success("Cập nhật thiết bị thành công");
        } else {
          await createDevice(payload);
          toast.success("Thêm thiết bị thành công");
        }
        setOpen(false);
        setEditing(null);
        form.resetFields();
        loadAll();
      } catch (e) {
        toast.error(e?.message || "Lưu thất bại");
      }
    };

    return (
      <>
        {contextHolder}
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Thêm thiết bị
          </Button>
        </Space>
        <Table
          rowKey={(r) => r.deviceId ?? r.id}
          columns={cols}
          dataSource={devices}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
        <Modal
          open={open}
          title={editing ? "Sửa thiết bị" : "Thêm thiết bị"}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item
              name="deviceModelId"
              label="Mẫu"
              rules={[{ required: true }]}
            >
              <Select options={modelOptions} />
            </Form.Item>
            <Form.Item
              name="serialNumber"
              label="Serial"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="acquireAt" label="Ngày mua">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="status"
              label="Trạng thái"
              initialValue="AVAILABLE"
            >
              <Select
                options={[
                  { label: "Có sẵn", value: "AVAILABLE" },
                  { label: "Đang thuê", value: "RENTED" },
                  { label: "Bảo trì", value: "MAINTENANCE" },
                  { label: "Hỏng", value: "BROKEN" },
                ]}
              />
            </Form.Item>
            <Form.Item name="shelfCode" label="Mã kệ">
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ================= ACCESSORY CATEGORY TAB (NEW) ================= */
  const AccessoryCategoryTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();

    const cols = [
      {
        title: "ID",
        dataIndex: "accessoryCategoryId",
        width: 90,
        render: (_, r) => r.accessoryCategoryId ?? r.id,
      },
      {
        title: "Tên",
        dataIndex: "accessoryCategoryName",
        render: (_, r) => r.accessoryCategoryName ?? r.name,
      },
      { title: "Mô tả", dataIndex: "description" },
      {
        title: "Trạng thái",
        dataIndex: "active",
        width: 150,
        render: (v) => <ActiveTag v={!!v} />,
      },
      {
        title: "Thao tác",
        width: 170,
        render: (_, r) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r);
                form.setFieldsValue({
                  accessoryCategoryName: r.accessoryCategoryName ?? r.name,
                  description: r.description ?? "",
                  active: r.active ?? true,
                });
                setOpen(true);
              }}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: "Xoá danh mục phụ kiện?",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    const id = r.accessoryCategoryId ?? r.id;
                    const prev = accCats;
                    setAccCats(
                      prev.filter((x) => (x.accessoryCategoryId ?? x.id) !== id)
                    );
                    try {
                      await deleteAccessoryCategory(id);
                      toast.success("Đã xoá danh mục phụ kiện");
                    } catch (e) {
                      setAccCats(prev);
                      toast.error(e?.message || "Xoá thất bại");
                      throw e;
                    }
                  },
                })
              }
            />
          </Space>
        ),
      },
    ];

    const submit = async (v) => {
      try {
        const payload = {
          accessoryCategoryName: v.accessoryCategoryName,
          description: v.description ?? "",
          active: !!v.active,
        };
        if (editing) {
          const id = editing.accessoryCategoryId ?? editing.id;
          await updateAccessoryCategory(id, payload);
          toast.success("Cập nhật danh mục phụ kiện thành công");
        } else {
          await createAccessoryCategory(payload);
          toast.success("Thêm danh mục phụ kiện thành công");
        }
        setOpen(false);
        setEditing(null);
        form.resetFields();
        loadAll();
      } catch (e) {
        toast.error(e?.message || "Lưu thất bại");
      }
    };

    return (
      <>
        {contextHolder}
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Thêm danh mục phụ kiện
          </Button>
        </Space>
        <Table
          rowKey={(r) => r.accessoryCategoryId ?? r.id}
          columns={cols}
          dataSource={accCats}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
        <Modal
          open={open}
          title={editing ? "Sửa danh mục phụ kiện" : "Thêm danh mục phụ kiện"}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item
              name="accessoryCategoryName"
              label="Tên"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="active" label="Trạng thái" initialValue={true}>
              <Select
                options={[
                  { label: "Đang hoạt động", value: true },
                  { label: "Ngưng", value: false },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ================= ACCESSORY TAB ================= */
  const AccessoryTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();

    const cols = [
      {
        title: "ID",
        dataIndex: "accessoryId",
        width: 90,
        render: (_, r) => r.accessoryId ?? r.id,
      },
      {
        title: "Mẫu",
        dataIndex: "deviceModelId",
        render: (id) => {
          const m = models.find((x) => (x.deviceModelId ?? x.id) === (id ?? 0));
          return m ? m.deviceName ?? m.name : id;
        },
      },
      {
        title: "Danh mục",
        dataIndex: "accessoryCategoryId",
        render: (id) => {
          const c = accCats.find(
            (x) => (x.accessoryCategoryId ?? x.id) === (id ?? 0)
          );
          return c ? c.accessoryCategoryName ?? c.name : "-";
        },
      },
      {
        title: "Tên",
        dataIndex: "accessoryName",
        render: (_, r) => r.accessoryName ?? r.name,
      },
      { title: "Mô tả", dataIndex: "description", ellipsis: true },
      {
        title: "Trạng thái",
        dataIndex: "active",
        width: 150,
        render: (v) => <ActiveTag v={!!v} />,
      },
      {
        title: "Thao tác",
        width: 170,
        render: (_, r) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r);
                form.setFieldsValue({
                  deviceModelId: r.deviceModelId,
                  accessoryCategoryId: r.accessoryCategoryId ?? null,
                  accessoryName: r.accessoryName ?? r.name,
                  description: r.description ?? "",
                  imageUrl: r.imageUrl ?? r.imageURL ?? "",
                  active: r.active ?? true,
                });
                setOpen(true);
              }}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: "Xoá phụ kiện?",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    const id = r.accessoryId ?? r.id;
                    const prev = accs;
                    setAccs(prev.filter((x) => (x.accessoryId ?? x.id) !== id));
                    try {
                      await deleteAccessory(id);
                      toast.success("Đã xoá phụ kiện");
                    } catch (e) {
                      setAccs(prev);
                      toast.error(e?.message || "Xoá thất bại");
                      throw e;
                    }
                  },
                })
              }
            />
          </Space>
        ),
      },
    ];

    const submit = async (v) => {
      try {
        const payload = {
          deviceModelId: v.deviceModelId,
          accessoryCategoryId: v.accessoryCategoryId ?? null,
          accessoryName: v.accessoryName,
          description: v.description ?? "",
          imageUrl: v.imageUrl ?? "",
          active: !!v.active,
        };
        if (editing) {
          const id = editing.accessoryId ?? editing.id;
          await updateAccessory(id, payload);
          toast.success("Cập nhật phụ kiện thành công");
        } else {
          await createAccessory(payload);
          toast.success("Thêm phụ kiện thành công");
        }
        setOpen(false);
        setEditing(null);
        form.resetFields();
        loadAll();
      } catch (e) {
        toast.error(e?.message || "Lưu thất bại");
      }
    };

    return (
      <>
        {contextHolder}
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Thêm phụ kiện
          </Button>
        </Space>
        <Table
          rowKey={(r) => r.accessoryId ?? r.id}
          columns={cols}
          dataSource={accs}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
        <Modal
          open={open}
          title={editing ? "Sửa phụ kiện" : "Thêm phụ kiện"}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item
              name="deviceModelId"
              label="Mẫu"
              rules={[{ required: true }]}
            >
              <Select options={modelOptions} />
            </Form.Item>
            <Form.Item name="accessoryCategoryId" label="Danh mục (tuỳ chọn)">
              <Select allowClear options={accCatOptions} />
            </Form.Item>
            <Form.Item
              name="accessoryName"
              label="Tên"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="imageUrl" label="Ảnh (URL)">
              <Input />
            </Form.Item>
            <Form.Item name="active" label="Trạng thái" initialValue={true}>
              <Select
                options={[
                  { label: "Đang hoạt động", value: true },
                  { label: "Ngưng", value: false },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ================= BRAND TAB (NEW) ================= */
  const BrandTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();

    const cols = [
      { title: "ID", dataIndex: "brandId", width: 90, render: (_, r) => r.brandId ?? r.id },
      { title: "Tên thương hiệu", dataIndex: "brandName", render: (v, r) => v ?? r.name },
      { title: "Mô tả", dataIndex: "description", ellipsis: true },
      { title: "Trạng thái", dataIndex: "active", width: 150, render: (v) => <ActiveTag v={!!v} /> },
      {
        title: "Thao tác",
        width: 170,
        render: (_, r) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r);
                form.setFieldsValue({
                  brandName: r.brandName ?? r.name,
                  description: r.description ?? "",
                  active: r.active ?? true,
                });
                setOpen(true);
              }}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: "Xoá thương hiệu?",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    const id = r.brandId ?? r.id;
                    const prev = brands;
                    setBrands(prev.filter((x) => (x.brandId ?? x.id) !== id));
                    try {
                      await deleteBrand(id);
                      toast.success("Đã xoá thương hiệu");
                    } catch (e) {
                      setBrands(prev);
                      toast.error(e?.message || "Xoá thất bại");
                      throw e;
                    }
                  },
                })
              }
            />
          </Space>
        ),
      },
    ];

    const submit = async (v) => {
      try {
        const payload = {
          brandName: v.brandName,
          description: v.description ?? "",
          active: !!v.active,
        };
        if (editing) {
          const id = editing.brandId ?? editing.id;
          await updateBrand(id, payload);
          toast.success("Cập nhật thương hiệu thành công");
        } else {
          await createBrand(payload);
          toast.success("Thêm thương hiệu thành công");
        }
        setOpen(false);
        setEditing(null);
        form.resetFields();
        loadAll();
      } catch (e) {
        toast.error(e?.message || "Lưu thất bại");
      }
    };

    return (
      <>
        {contextHolder}
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            Thêm thương hiệu
          </Button>
        </Space>
        <Table
          rowKey={(r) => r.brandId ?? r.id}
          columns={cols}
          dataSource={brands}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
        <Modal
          open={open}
          title={editing ? "Sửa thương hiệu" : "Thêm thương hiệu"}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item name="brandName" label="Tên thương hiệu" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="active" label="Trạng thái" initialValue={true}>
              <Select
                options={[
                  { label: "Đang hoạt động", value: true },
                  { label: "Ngưng", value: false },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  return (
    <>
      <Title level={3}>Quản lý sản phẩm</Title>
      <Tabs
        items={[
          { key: "brand", label: "Thương hiệu", children: <BrandTab /> },
          { key: "cat", label: "Loại Thiết Bị", children: <CategoryTab /> },
          { key: "model", label: "Mẫu Thiết Bị", children: <ModelTab /> },
          { key: "device", label: "Thiết Bị", children: <DeviceTab /> },
          {
            key: "acc-cat",
            label: "Danh mục Phụ kiện",
            children: <AccessoryCategoryTab />,
          }, // NEW
          { key: "acc", label: "Phụ Kiện", children: <AccessoryTab /> },
        ]}
      />
    </>
  );
}
