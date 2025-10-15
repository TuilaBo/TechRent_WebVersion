import React, { useState } from "react";
import {
  Tabs, Card, Table, Tag, Button, Space, Modal, Form, Input,
  Select, Typography, Popconfirm, message
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;

/** ===== Mock (thay bằng API) ===== */
const ROLE_OPTIONS = [
  { roleID: 1, roleName: "Technician" },
  { roleID: 2, roleName: "Operator" },
  { roleID: 3, roleName: "Admin" },
];

const INIT_STAFF = [
  { staffID: 101, fullName: "Lê Minh", phone: "0901234567", email: "minh@techrent.vn",
    staffType: "Kỹ thuật", status: "active", roles: [1] },
  { staffID: 102, fullName: "Trần Bảo", phone: "0907654321", email: "bao@techrent.vn",
    staffType: "CSKH", status: "inactive", roles: [2] },
];

const INIT_CUSTOMERS = [
  { customerID: 5001, fullName: "Nguyễn Văn A", email: "a@gmail.com", phone: "09xxxxxx01", status: "verified" },
  { customerID: 5002, fullName: "Phạm Lan", email: "lan@gmail.com", phone: "09xxxxxx02", status: "pending" },
];

/** ===== Helpers ===== */
const statusTag = (s) =>
  s === "active" ? <Tag color="green">Đang hoạt động</Tag> :
  s === "inactive" ? <Tag color="default">Tạm khóa</Tag> :
  s === "pending" ? <Tag color="gold">Chờ KYC</Tag> :
  s === "verified" ? <Tag color="blue">Đã KYC</Tag> : <Tag>{s}</Tag>;

export default function AdminAccounts() {
  // Staff state
  const [staff, setStaff] = useState(INIT_STAFF);
  const [openStaff, setOpenStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm] = Form.useForm();

  // Customers (chỉ xem / hành động nhẹ)
  const [customers] = useState(INIT_CUSTOMERS);

  /** ===== Staff handlers ===== */
  const openCreateStaff = () => {
    setEditingStaff(null);
    staffForm.setFieldsValue({
      fullName: "", email: "", phone: "", staffType: "", status: "active", roles: []
    });
    setOpenStaff(true);
  };

  const openEditStaff = (row) => {
    setEditingStaff(row);
    staffForm.setFieldsValue({
      fullName: row.fullName, email: row.email, phone: row.phone,
      staffType: row.staffType, status: row.status, roles: row.roles || []
    });
    setOpenStaff(true);
  };

  const submitStaff = (vals) => {
    const payload = {
      fullName: vals.fullName?.trim(), phone: vals.phone?.trim(),
      email: vals.email?.trim(), staffType: vals.staffType,
      status: vals.status, roles: vals.roles || [],
    };
    if (editingStaff) {
      setStaff(prev => prev.map(s => s.staffID === editingStaff.staffID ? { ...s, ...payload } : s));
      message.success("Đã cập nhật Staff.");
    } else {
      const nextID = Math.max(0, ...staff.map(s => s.staffID)) + 1;
      setStaff(prev => [{ staffID: nextID, ...payload }, ...prev]);
      message.success("Đã tạo Staff.");
    }
    setOpenStaff(false);
  };

  const removeStaff = (row) => {
    setStaff(prev => prev.filter(s => s.staffID !== row.staffID));
    message.success("Đã xóa Staff.");
  };

  /** ===== Columns ===== */
  const staffCols = [
    { title: "ID", dataIndex: "staffID", width: 90, sorter: (a,b)=>a.staffID-b.staffID },
    { title: "Họ tên", dataIndex: "fullName" },
    { title: "Email", dataIndex: "email" },
    { title: "Điện thoại", dataIndex: "phone", width: 130 },
    { title: "Bộ phận", dataIndex: "staffType", width: 120 },
    {
      title: "Vai trò (Role)",
      dataIndex: "roles",
      render: (ids=[]) => (
        <Space wrap>
          {ids.length === 0 ? <Text type="secondary">—</Text> :
            ids.map(id => {
              const r = ROLE_OPTIONS.find(x => x.roleID === id);
              return <Tag key={id} color="geekblue">{r?.roleName || id}</Tag>;
            })}
        </Space>
      )
    },
    { title: "Trạng thái", dataIndex: "status", width: 130, render: statusTag },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 140,
      render: (_, r) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditStaff(r)} />
          <Popconfirm title="Xóa nhân sự?" onConfirm={() => removeStaff(r)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const customerCols = [
    { title: "ID", dataIndex: "customerID", width: 100 },
    { title: "Họ tên", dataIndex: "fullName" },
    { title: "Email", dataIndex: "email" },
    { title: "Điện thoại", dataIndex: "phone", width: 130 },
    { title: "Trạng thái KYC", dataIndex: "status", width: 140, render: statusTag },
    {
      title: "Thao tác",
      key: "actions",
      width: 160,
      render: (_, r) => (
        <Space>
          <Button onClick={()=>message.info(`Xem lịch sử thuê #${r.customerID}`)}>Lịch sử</Button>
          <Button onClick={()=>message.info(`Khóa tài khoản #${r.customerID}`)} danger>Khóa</Button>
        </Space>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Title level={3} style={{ marginBottom: 12 }}>Quản lý tài khoản</Title>

        <Tabs
          defaultActiveKey="staff"
          items={[
            {
              key: "staff",
              label: "Nhân sự (Staff)",
              children: (
                <Card
                  title="Danh sách Staff"
                  extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateStaff}>
                      Thêm Staff
                    </Button>
                  }
                >
                  <Table
                    rowKey="staffID"
                    columns={staffCols}
                    dataSource={staff}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 980 }}
                  />
                </Card>
              ),
            },
            {
              key: "customer",
              label: "Khách hàng (Customer)",
              children: (
                <Card title="Danh sách Khách hàng">
                  <Table
                    rowKey="customerID"
                    columns={customerCols}
                    dataSource={customers}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 980 }}
                  />
                </Card>
              ),
            },
          ]}
        />

        {/* Modal Staff (có Role) */}
        <Modal
          open={openStaff}
          title={editingStaff ? "Cập nhật Staff" : "Tạo Staff"}
          onCancel={() => setOpenStaff(false)}
          onOk={() => staffForm.submit()}
          okText={editingStaff ? "Lưu" : "Tạo"}
        >
          <Form form={staffForm} layout="vertical" onFinish={submitStaff}>
            <Form.Item label="Họ tên" name="fullName" rules={[{ required: true }]}>
              <Input placeholder="VD: Nguyễn Văn B" />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ type: "email", required: true }]}>
              <Input placeholder="name@company.com" />
            </Form.Item>
            <Form.Item label="Điện thoại" name="phone" rules={[{ required: true }]}>
              <Input placeholder="09xxxxxxxx" />
            </Form.Item>

            <Space.Compact style={{ width: "100%" }}>
              <Form.Item style={{ flex: 1 }} label="Bộ phận" name="staffType" rules={[{ required: true }]}>
                <Select
                  placeholder="Chọn bộ phận"
                  options={[
                    { label: "Kỹ thuật", value: "Kỹ thuật" },
                    { label: "CSKH", value: "CSKH" },
                    { label: "Khác", value: "Khác" },
                  ]}
                />
              </Form.Item>
              <Form.Item style={{ flex: 1, marginLeft: 8 }} label="Trạng thái" name="status" initialValue="active">
                <Select
                  options={[
                    { label: "Đang hoạt động", value: "active" },
                    { label: "Tạm khóa", value: "inactive" },
                  ]}
                />
              </Form.Item>
            </Space.Compact>

            {/* CHỈ Staff có Role */}
            <Form.Item label="Vai trò (Role)" name="roles" tooltip="Staff mới có Role; Customer không có role.">
              <Select mode="multiple" placeholder="Chọn role">
                {ROLE_OPTIONS.map((r) => (
                  <Option key={r.roleID} value={r.roleID}>{r.roleName}</Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
