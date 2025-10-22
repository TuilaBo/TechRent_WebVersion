// src/pages/admin/AdminProducts.jsx
import React, { useMemo, useState } from "react";
import { Tabs, Table, Button, Space, Modal, Form, Input, Select, DatePicker, Tag, Typography, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title } = Typography;

/* ---- Dữ liệu mẫu ---- */
const INIT_CATEGORIES = [
  { deviceCategoryID: 1, name: "VR/AR", description: "Kính VR, AR" },
  { deviceCategoryID: 2, name: "Console", description: "Máy game" },
  { deviceCategoryID: 3, name: "Camera", description: "Máy ảnh, lens" },
];

const INIT_MODELS = [
  { deviceModelID: 1, deviceCategoryID: 1, name: "Meta Quest 3", brand: "Meta", specs_json: 'Qualcomm Snapdragon XR2 Gen 28 GB LPDDR5', isActive: true },
  { deviceModelID: 2, deviceCategoryID: 2, name: "PS5", brand: "Sony", specs_json: 'Qualcomm Snapdragon XR2 Gen 28 GB LPDDR5', isActive: true },
  { deviceModelID: 3, deviceCategoryID: 3, name: "Sony A7 IV", brand: "Sony", specs_json: 'Qualcomm Snapdragon XR2 Gen 28 GB LPDDR5', isActive: true },
];

const INIT_DEVICES = [
  { deviceID: 101, deviceModelID: 1, serialNumber: "MQ3-A12", acquiredAt: "2024-03-01", status: "available", shelfCode: "A-01" },
  { deviceID: 102, deviceModelID: 2, serialNumber: "PS5-0001", acquiredAt: "2023-12-18", status: "rented", shelfCode: "B-02" },
  { deviceID: 103, deviceModelID: 3, serialNumber: "A7IV-1001", acquiredAt: "2024-06-08", status: "maintenance", shelfCode: "C-05" },
];

const INIT_ACCESSORIES = [
  { accessoryID: 1, deviceModelID: 1, name: "Controller strap", description: "Dây đeo tay" },
  { accessoryID: 2, deviceModelID: 3, name: "Battery NP-FZ100", description: "Pin A7 IV" },
];

/* ---- Hàm hỗ trợ ---- */
const statusTag = (s) => {
  switch (s) {
    case "available": return <Tag color="green">Có sẵn</Tag>;
    case "rented": return <Tag color="blue">Đang thuê</Tag>;
    case "maintenance": return <Tag color="orange">Bảo trì</Tag>;
    case "broken": return <Tag color="red">Hỏng</Tag>;
    default: return <Tag>{s}</Tag>;
  }
};

export default function AdminProducts() {
  const [categories, setCategories] = useState(INIT_CATEGORIES);
  const [models, setModels] = useState(INIT_MODELS);
  const [devices, setDevices] = useState(INIT_DEVICES);
  const [accs, setAccs] = useState(INIT_ACCESSORIES);

  const catOptions = categories.map(c => ({ label: c.name, value: c.deviceCategoryID }));
  const modelOptions = models.map(m => ({ label: `${m.name} (${m.brand})`, value: m.deviceModelID }));

  /* ---------- LOẠI THIẾT BỊ ---------- */
  const CategoryTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const cols = [
      { title: "ID", dataIndex: "deviceCategoryID", width: 80 },
      { title: "Tên", dataIndex: "name" },
      { title: "Mô tả", dataIndex: "description" },
      {
        title: "Thao tác", width: 150,
        render: (_, r) => (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => {
              setEditing(r); form.setFieldsValue(r); setOpen(true);
            }}/>
            <Button danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({ title: "Xóa loại thiết bị?", onOk: () => setCategories(prev => prev.filter(x => x.deviceCategoryID !== r.deviceCategoryID)) });
            }}/>
          </Space>
        )
      }
    ];

    const submit = (v) => {
      if (editing) {
        setCategories(prev => prev.map(x => x.deviceCategoryID === editing.deviceCategoryID ? { ...editing, ...v } : x));
        message.success("Đã cập nhật loại thiết bị");
      } else {
        const id = Math.max(0, ...categories.map(x => x.deviceCategoryID)) + 1;
        setCategories(prev => [...prev, { deviceCategoryID: id, ...v }]);
        message.success("Đã thêm loại thiết bị");
      }
      setOpen(false); setEditing(null); form.resetFields();
    };

    return (
      <>
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>Thêm loại thiết bị</Button>
        </Space>
        <Table rowKey="deviceCategoryID" columns={cols} dataSource={categories} pagination={{ pageSize: 8 }} />
        <Modal open={open} title={editing ? "Sửa loại thiết bị" : "Thêm loại thiết bị"} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input/></Form.Item>
            <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3}/></Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ---------- MẪU THIẾT BỊ ---------- */
  const ModelTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const cols = [
      { title: "ID", dataIndex: "deviceModelID", width: 80 },
      { title: "Tên mẫu", dataIndex: "name" },
      { title: "Thương hiệu", dataIndex: "brand", width: 120 },
      { title: "Loại", dataIndex: "deviceCategoryID", width: 140, render: id => categories.find(c => c.deviceCategoryID === id)?.name },
      { title: "Thông số", dataIndex: "specs_json", ellipsis: true },
      { title: "Hoạt động", dataIndex: "isActive", width: 90, render: v => v ? <Tag color="green">Có</Tag> : <Tag>Không</Tag> },
      {
        title: "Thao tác", width: 150,
        render: (_, r) => (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
            <Button danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({ title: "Xóa mẫu thiết bị?", onOk: () => setModels(prev => prev.filter(x => x.deviceModelID !== r.deviceModelID)) });
            }} />
          </Space>
        )
      }
    ];

    const submit = (v) => {
      if (editing) {
        setModels(prev => prev.map(x => x.deviceModelID === editing.deviceModelID ? { ...editing, ...v } : x));
        message.success("Đã cập nhật mẫu thiết bị");
      } else {
        const id = Math.max(0, ...models.map(x => x.deviceModelID)) + 1;
        setModels(prev => [...prev, { deviceModelID: id, ...v }]);
        message.success("Đã thêm mẫu thiết bị");
      }
      setOpen(false); setEditing(null); form.resetFields();
    };

    return (
      <>
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>Thêm mẫu thiết bị</Button>
        </Space>
        <Table rowKey="deviceModelID" columns={cols} dataSource={models} pagination={{ pageSize: 8 }} />
        <Modal open={open} title={editing ? "Sửa mẫu thiết bị" : "Thêm mẫu thiết bị"} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item name="name" label="Tên mẫu" rules={[{ required: true }]}><Input/></Form.Item>
            <Form.Item name="brand" label="Thương hiệu" rules={[{ required: true }]}><Input/></Form.Item>
            <Form.Item name="deviceCategoryID" label="Loại" rules={[{ required: true }]}>
              <Select options={catOptions}/>
            </Form.Item>
            <Form.Item name="specs_json" label="Thông số"><Input.TextArea rows={4} placeholder='{"key":"value"}' /></Form.Item>
            <Form.Item name="isActive" label="Hoạt động" initialValue={true}>
              <Select options={[{label:"Có", value:true},{label:"Không", value:false}]}/>
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ---------- THIẾT BỊ ---------- */
  const DeviceTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const cols = [
      { title: "ID", dataIndex: "deviceID", width: 80 },
      { title: "Mẫu", dataIndex: "deviceModelID", render: id => models.find(m => m.deviceModelID === id)?.name },
      { title: "Serial", dataIndex: "serialNumber" },
      { title: "Ngày mua", dataIndex: "acquiredAt", width: 130 },
      { title: "Trạng thái", dataIndex: "status", width: 130, render: statusTag },
      { title: "Vị trí kệ", dataIndex: "shelfCode", width: 100 },
      {
        title: "Thao tác", width: 150,
        render: (_, r) => (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ ...r, acquiredAt: r.acquiredAt ? dayjs(r.acquiredAt) : null }); setOpen(true); }} />
            <Button danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({ title: "Xóa thiết bị?", onOk: () => setDevices(prev => prev.filter(x => x.deviceID !== r.deviceID)) });
            }} />
          </Space>
        )
      }
    ];

    const submit = (v) => {
      const payload = {
        ...v,
        acquiredAt: v.acquiredAt ? v.acquiredAt.format("YYYY-MM-DD") : null,
      };
      if (editing) {
        setDevices(prev => prev.map(x => x.deviceID === editing.deviceID ? { ...editing, ...payload } : x));
        message.success("Đã cập nhật thiết bị");
      } else {
        const id = Math.max(0, ...devices.map(x => x.deviceID)) + 1;
        setDevices(prev => [...prev, { deviceID: id, ...payload }]);
        message.success("Đã thêm thiết bị");
      }
      setOpen(false); setEditing(null); form.resetFields();
    };

    return (
      <>
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>Thêm thiết bị</Button>
        </Space>
        <Table rowKey="deviceID" columns={cols} dataSource={devices} pagination={{ pageSize: 8 }} />
        <Modal open={open} title={editing ? "Sửa thiết bị" : "Thêm thiết bị"} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item name="deviceModelID" label="Mẫu" rules={[{ required: true }]}><Select options={modelOptions}/></Form.Item>
            <Form.Item name="serialNumber" label="Serial" rules={[{ required: true }]}><Input/></Form.Item>
            <Form.Item name="acquiredAt" label="Ngày mua"><DatePicker style={{ width: "100%" }}/></Form.Item>
            <Form.Item name="status" label="Trạng thái" initialValue="available">
              <Select options={[
                {label:"Có sẵn", value:"available"},
                {label:"Đang thuê", value:"rented"},
                {label:"Bảo trì", value:"maintenance"},
                {label:"Hỏng", value:"broken"},
              ]}/>
            </Form.Item>
            <Form.Item name="shelfCode" label="Mã kệ"><Input/></Form.Item>
          </Form>
        </Modal>
      </>
    );
  };

  /* ---------- PHỤ KIỆN ---------- */
  const AccessoryTab = () => {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const cols = [
      { title: "ID", dataIndex: "accessoryID", width: 80 },
      { title: "Mẫu", dataIndex: "deviceModelID", render: id => models.find(m => m.deviceModelID === id)?.name },
      { title: "Tên", dataIndex: "name" },
      { title: "Mô tả", dataIndex: "description", ellipsis: true },
      {
        title: "Thao tác", width: 150,
        render: (_, r) => (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
            <Button danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({ title: "Xóa phụ kiện?", onOk: () => setAccs(prev => prev.filter(x => x.accessoryID !== r.accessoryID)) });
            }} />
          </Space>
        )
      }
    ];

    const submit = (v) => {
      if (editing) {
        setAccs(prev => prev.map(x => x.accessoryID === editing.accessoryID ? { ...editing, ...v } : x));
        message.success("Đã cập nhật phụ kiện");
      } else {
        const id = Math.max(0, ...accs.map(x => x.accessoryID)) + 1;
        setAccs(prev => [...prev, { accessoryID: id, ...v }]);
        message.success("Đã thêm phụ kiện");
      }
      setOpen(false); setEditing(null); form.resetFields();
    };

    return (
      <>
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>Thêm phụ kiện</Button>
        </Space>
        <Table rowKey="accessoryID" columns={cols} dataSource={accs} pagination={{ pageSize: 8 }} />
        <Modal open={open} title={editing ? "Sửa phụ kiện" : "Thêm phụ kiện"} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item name="deviceModelID" label="Mẫu" rules={[{ required: true }]}><Select options={modelOptions}/></Form.Item>
            <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input/></Form.Item>
            <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3}/></Form.Item>
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
          { key: "cat", label: "Loại Thiết Bị", children: <CategoryTab/> },
          { key: "model", label: "Mẫu Thiết Bị", children: <ModelTab/> },
          { key: "device", label: "Thiết Bị", children: <DeviceTab/> },
          { key: "acc", label: "Phụ Kiện", children: <AccessoryTab/> },
        ]}
      />
    </>
  );
}