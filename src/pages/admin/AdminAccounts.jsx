// src/pages/admin/AdminAccounts.jsx
import React, { useEffect, useState } from "react";
import {
  Tabs,
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

// ---- CUSTOMER APIs (giữ nguyên) ----
import {
  listCustomers,
  fetchCustomerById,
  updateCustomerById,
  deleteCustomerById,
  normalizeCustomer,
} from "../../lib/customerApi";

// ---- STAFF APIs (mới) ----
import {
  listStaff,
  getStaffById,
  createStaff,
  deleteStaff,
  updateStaffStatus,
  updateStaffRole,
  listStaffByRole,
  STAFF_ROLES,
  normalizeStaff,
} from "../../lib/staffManage";

const { Title, Text } = Typography;

/* ===== Helpers ===== */
const statusTag = (s) =>
  s === "active" ? (
    <Tag color="green">Đang hoạt động</Tag>
  ) : s === "inactive" ? (
    <Tag color="default">Tạm khóa</Tag>
  ) : s === "pending" ? (
    <Tag color="gold">Chờ KYC</Tag>
  ) : s === "verified" ? (
    <Tag color="blue">Đã KYC</Tag>
  ) : (
    <Tag>{String(s)}</Tag>
  );

export default function AdminAccounts() {
  /* ======================= STAFF (API) ======================= */
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Create staff
  const [staffForm] = Form.useForm();
  const [openStaffCreate, setOpenStaffCreate] = useState(false);

  // View staff
  const [openStaffView, setOpenStaffView] = useState(false);
  const [viewingStaff, setViewingStaff] = useState(null);

  // Edit staff (gộp đổi role + active)
  const [openStaffEdit, setOpenStaffEdit] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm] = Form.useForm();

  // Filter
  const [roleFilter, setRoleFilter] = useState("");

  const loadStaff = async () => {
    try {
      setStaffLoading(true);
      const rows = roleFilter ? await listStaffByRole(roleFilter) : await listStaff();
      // bảo đảm có đủ các field qua normalize
      setStaff(rows.map(normalizeStaff));
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e?.message || "Không tải được danh sách staff"
      );
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const openCreateStaff = () => {
    staffForm.resetFields();
    staffForm.setFieldsValue({ staffRole: STAFF_ROLES.OPERATOR });
    setOpenStaffCreate(true);
  };

  const submitCreateStaff = async (vals) => {
    try {
      await createStaff({
        username: vals.username,
        email: vals.email,
        password: vals.password,
        phoneNumber: vals.phoneNumber,
        staffRole: vals.staffRole,
      });
      toast.success("Tạo staff thành công");
      setOpenStaffCreate(false);
      await loadStaff();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Tạo staff thất bại");
    }
  };

  const onDeleteStaff = async (row) => {
    const id = row.staffId ?? row.id;
    try {
      await deleteStaff(id);
      toast.success("Đã xoá staff");
      await loadStaff();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Xoá thất bại");
    }
  };

  const onViewStaff = async (row) => {
    const id = row.staffId ?? row.id;
    try {
      const detail = await getStaffById(id);
      setViewingStaff(normalizeStaff(detail));
      setOpenStaffView(true);
    } catch {
      toast.error("Không tải được chi tiết staff");
    }
  };

  const openEditStaff = (row) => {
    const current = normalizeStaff(row);
    setEditingStaff(current);
    editForm.setFieldsValue({
      staffRole: current.staffRole,
      isActive: current.isActive,
    });
    setOpenStaffEdit(true);
  };

  const submitEditStaff = async (vals) => {
    if (!editingStaff) return;
    const id = editingStaff.staffId ?? editingStaff.id;

    const tasks = [];
    if (vals.staffRole !== editingStaff.staffRole) {
      tasks.push(updateStaffRole(id, vals.staffRole));
    }
    if (Boolean(vals.isActive) !== Boolean(editingStaff.isActive)) {
      tasks.push(updateStaffStatus(id, Boolean(vals.isActive)));
    }

    if (!tasks.length) {
      toast("Không có thay đổi nào.");
      setOpenStaffEdit(false);
      setEditingStaff(null);
      return;
    }

    try {
      await Promise.all(tasks);
      toast.success("Cập nhật staff thành công");
      setOpenStaffEdit(false);
      setEditingStaff(null);
      await loadStaff();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Cập nhật thất bại");
    }
  };

  const staffCols = [
    { 
      title: "ID", 
      dataIndex: "staffId", 
      width: 80, 
      sorter: (a, b) => a.staffId - b.staffId,
      defaultSortOrder: 'ascend',
      sortDirections: ['ascend', 'descend']
    },
    { title: "Username", dataIndex: "username", width: 160, ellipsis: true },
    { title: "Email", dataIndex: "email", width: 240, ellipsis: true },
    { title: "Số điện thoại", dataIndex: "phoneNumber", width: 140, ellipsis: true },
    { title: "Vai trò", dataIndex: "staffRole", width: 130, render: (v) => <Tag color="geekblue">{v}</Tag> },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      width: 140,
      render: (v) => (v ? <Tag color="green">Đang hoạt động</Tag> : <Tag>Không hoạt động</Tag>),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 220,
      render: (_, r) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => onViewStaff(r)}>Xem</Button>
          <Button icon={<EditOutlined />} onClick={() => openEditStaff(r)}>Sửa</Button>
          <Popconfirm title="Xóa staff này?" onConfirm={() => onDeleteStaff(r)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ======================= CUSTOMERS (GIỮ NGUYÊN) ======================= */
  const [customers, setCustomers] = useState([]);
  const [custLoading, setCustLoading] = useState(false);
  const [custForm] = Form.useForm();
  const [openCustEdit, setOpenCustEdit] = useState(false);
  const [editingCustId, setEditingCustId] = useState(null);
  const [openCustView, setOpenCustView] = useState(false);
  const [viewing, setViewing] = useState(null);

  const loadCustomers = async () => {
    try {
      setCustLoading(true);
      const list = await listCustomers();
      setCustomers(list.map(normalizeCustomer));
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e?.message || "Không tải được danh sách khách hàng"
      );
    } finally {
      setCustLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const onView = async (row) => {
    try {
      setCustLoading(true);
      const detail = await fetchCustomerById(row.id);
      setViewing(normalizeCustomer(detail));
      setOpenCustView(true);
    } catch {
      toast.error("Không tải được chi tiết khách hàng");
    } finally {
      setCustLoading(false);
    }
  };

  const onEdit = (row) => {
    setEditingCustId(row.id);
    custForm.setFieldsValue({
      fullName: row.fullName,
      email: row.email,
      phoneNumber: row.phoneNumber,
      shippingAddress: row.shippingAddress,
      bankAccountNumber: row.bankAccountNumber,
      bankName: row.bankName,
      bankAccountHolder: row.bankAccountHolder,
    });
    setOpenCustEdit(true);
  };

  const submitCustomer = async (vals) => {
    try {
      await updateCustomerById(editingCustId, vals);
      toast.success("Cập nhật khách hàng thành công");
      setOpenCustEdit(false);
      setEditingCustId(null);
      await loadCustomers();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Cập nhật thất bại");
    }
  };

  const onDelete = async (row) => {
    try {
      await deleteCustomerById(row.id);
      toast.success("Đã xoá khách hàng");
      await loadCustomers();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Xoá thất bại");
    }
  };

  const customerCols = [
    { 
      title: "ID", 
      dataIndex: "id", 
      width: 100, 
      sorter: (a, b) => a.id - b.id,
      defaultSortOrder: 'ascend',
      sortDirections: ['ascend', 'descend']
    },
    { title: "Họ tên", dataIndex: "fullName" },
    { title: "Email", dataIndex: "email" },
    { title: "Điện thoại", dataIndex: "phoneNumber", width: 130 },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      width: 130,
      render: (v) => statusTag(v ? "active" : "inactive"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 200,
      render: (_, r) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => onView(r)}>Xem</Button>
          <Button icon={<EditOutlined />} onClick={() => onEdit(r)}>Sửa</Button>
          <Popconfirm title="Xoá khách hàng?" onConfirm={() => onDelete(r)}>
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
          Quản lý tài khoản
        </Title>

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
                    <Space>
                      <Select
                        value={roleFilter || undefined}
                        allowClear
                        placeholder="Lọc theo vai trò"
                        style={{ width: 200 }}
                        onChange={(v) => setRoleFilter(v || "")}
                        options={Object.values(STAFF_ROLES).map((x) => ({
                          label: x,
                          value: x,
                        }))}
                      />
                      <Button icon={<ReloadOutlined />} onClick={loadStaff} loading={staffLoading}>
                        Làm mới
                      </Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateStaff}>
                        Thêm Staff
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    rowKey={(r) => r.staffId ?? r.id}
                    columns={staffCols}
                    dataSource={staff}
                    loading={staffLoading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1000 }}
                  />
                </Card>
              ),
            },
            {
              key: "customer",
              label: "Khách hàng (Customer)",
              children: (
                <Card
                  title="Danh sách Khách hàng"
                  extra={
                    <Button icon={<ReloadOutlined />} onClick={loadCustomers} loading={custLoading}>
                      Làm mới
                    </Button>
                  }
                >
                  <Table
                    rowKey="id"
                    columns={customerCols}
                    dataSource={customers}
                    loading={custLoading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 980 }}
                  />
                </Card>
              ),
            },
          ]}
        />

        {/* ========== Modal TẠO staff ========== */}
        <Modal
          open={openStaffCreate}
          title="Tạo Staff"
          onCancel={() => setOpenStaffCreate(false)}
          onOk={() => staffForm.submit()}
          okText="Tạo"
        >
          <Form form={staffForm} layout="vertical" onFinish={submitCreateStaff}>
            <Form.Item label="Username" name="username" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ type: "email", required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item label="Số điện thoại" name="phoneNumber" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label="Vai trò (Role)"
              name="staffRole"
              rules={[{ required: true }]}
              initialValue={STAFF_ROLES.OPERATOR}
            >
              <Select
                options={Object.values(STAFF_ROLES).map((x) => ({
                  label: x,
                  value: x,
                }))}
              />
            </Form.Item>
            <Text type="secondary">
              * Sau khi tạo, bạn có thể bật/tắt hoạt động hoặc đổi role trong phần Sửa.
            </Text>
          </Form>
        </Modal>

        {/* ========== Modal SỬA staff (gộp role + active) ========== */}
        <Modal
          open={openStaffEdit}
          title={`Cập nhật Staff #${editingStaff?.staffId ?? ""}`}
          onCancel={() => {
            setOpenStaffEdit(false);
            setEditingStaff(null);
          }}
          onOk={() => editForm.submit()}
          okText="Lưu"
        >
          <Form form={editForm} layout="vertical" onFinish={submitEditStaff}>
            <Form.Item label="Vai trò (Role)" name="staffRole" rules={[{ required: true }]}>
              <Select
                options={Object.values(STAFF_ROLES).map((x) => ({
                  label: x,
                  value: x,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="Trạng thái hoạt động"
              name="isActive"
              valuePropName="checked"
              tooltip="Bật để kích hoạt, tắt để tạm khóa"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>

            {editingStaff && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  Username: <b>{editingStaff.username || "—"}</b> • Email:{" "}
                  <b>{editingStaff.email || "—"}</b> • SĐT:{" "}
                  <b>{editingStaff.phoneNumber || "—"}</b>
                </Text>
              </div>
            )}
          </Form>
        </Modal>

        {/* ========== Modal XEM chi tiết staff ========== */}
        <Modal
          open={openStaffView}
          title="Chi tiết Staff"
          footer={null}
          onCancel={() => setOpenStaffView(false)}
          width={600}
        >
          {viewingStaff ? (
            <Descriptions bordered column={1} size="middle">
              <Descriptions.Item label="Staff ID">{viewingStaff.staffId}</Descriptions.Item>
              <Descriptions.Item label="Account ID">{viewingStaff.accountId}</Descriptions.Item>
              <Descriptions.Item label="Username">{viewingStaff.username || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{viewingStaff.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{viewingStaff.phoneNumber || "—"}</Descriptions.Item>
              <Descriptions.Item label="Vai trò">{viewingStaff.staffRole}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {viewingStaff.isActive ? "Đang hoạt động" : "Tạm khóa"}
              </Descriptions.Item>
              <Descriptions.Item label="Tạo lúc">{viewingStaff.createdAt || "—"}</Descriptions.Item>
              <Descriptions.Item label="Cập nhật">{viewingStaff.updatedAt || "—"}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">Đang tải…</Text>
          )}
        </Modal>

        {/* ========== Modal XEM chi tiết customer ========== */}
        <Modal
          open={openCustView}
          title="Chi tiết khách hàng"
          footer={null}
          onCancel={() => setOpenCustView(false)}
          width={640}
        >
          {viewing ? (
            <Descriptions bordered column={1} size="middle">
              <Descriptions.Item label="ID">{viewing.id}</Descriptions.Item>
              <Descriptions.Item label="Họ tên">{viewing.fullName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{viewing.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{viewing.phoneNumber || "—"}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao">{viewing.shippingAddress || "—"}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {statusTag(viewing.isActive ? "active" : "inactive")}
              </Descriptions.Item>
              <Descriptions.Item label="Ngân hàng">{viewing.bankName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Số TK">{viewing.bankAccountNumber || "—"}</Descriptions.Item>
              <Descriptions.Item label="Chủ TK">{viewing.bankAccountHolder || "—"}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">Đang tải…</Text>
          )}
        </Modal>

        {/* ========== Modal SỬA customer ========== */}
        <Modal
          open={openCustEdit}
          title="Cập nhật khách hàng"
          onCancel={() => {
            setOpenCustEdit(false);
            setEditingCustId(null);
          }}
          onOk={() => custForm.submit()}
          okText="Lưu"
        >
          <Form form={custForm} layout="vertical" onFinish={submitCustomer}>
            <Form.Item
              label="Họ tên"
              name="fullName"
              rules={[{ required: true, message: "Nhập họ tên" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ type: "email", message: "Email không hợp lệ" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Điện thoại" name="phoneNumber">
              <Input />
            </Form.Item>
            <Form.Item label="Địa chỉ giao" name="shippingAddress">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Title level={5} style={{ marginTop: 12 }}>
              Thông tin ngân hàng
            </Title>
            <Form.Item label="Tên ngân hàng" name="bankName">
              <Input />
            </Form.Item>
            <Form.Item label="Số tài khoản" name="bankAccountNumber">
              <Input />
            </Form.Item>
            <Form.Item label="Chủ tài khoản" name="bankAccountHolder">
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
