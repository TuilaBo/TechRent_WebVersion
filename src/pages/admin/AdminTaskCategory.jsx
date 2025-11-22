// src/pages/admin/AdminTaskCategory.jsx
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Popconfirm,
  Typography,
  Tag,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import dayjs from "dayjs";

import {
  listTaskCategories,
  createTaskCategory,
  updateTaskCategory,
  deleteTaskCategory,
  normalizeTaskCategory,
} from "../../lib/taskCategoryApi";

const { Title } = Typography;

export default function AdminTaskCategory() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const loadCategories = async () => {
    try {
      setLoading(true);
      const list = await listTaskCategories();
      setCategories(list.map(normalizeTaskCategory));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không tải được danh sách loại công việc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name ?? "",
      description: record.description ?? "",
    });
    setOpen(true);
  };

  const submit = async (values) => {
    try {
      if (editing) {
        const id = editing.taskCategoryId ?? editing.id;
        await updateTaskCategory(id, values);
        toast.success("Cập nhật loại công việc thành công");
      } else {
        await createTaskCategory(values);
        toast.success("Thêm loại công việc thành công");
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      await loadCategories();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Lưu thất bại");
    }
  };

  const handleDelete = async (record) => {
    try {
      const id = record.taskCategoryId ?? record.id;
      const prev = categories;
      setCategories(prev.filter((x) => (x.taskCategoryId ?? x.id) !== id));
      
      await deleteTaskCategory(id);
      toast.success("Đã xoá loại công việc");
      await loadCategories();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Xoá thất bại");
      // Restore state on error
      setCategories(categories);
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "taskCategoryId",
      key: "id",
      width: 80,
      render: (_, record) => record.taskCategoryId ?? record.id,
      sorter: (a, b) => (a.taskCategoryId ?? a.id) - (b.taskCategoryId ?? b.id),
    },
    {
      title: "Tên",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (text) => text || "-",
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xoá loại công việc này?"
            description="Nếu loại này đang được sử dụng, server có thể từ chối xoá."
            onConfirm={() => handleDelete(record)}
            okText="Xoá"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Title level={3} style={{ margin: 0 }}>
            Quản lý loại công việc
          </Title>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadCategories}
              loading={loading}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
            >
              Thêm loại công việc
            </Button>
          </Space>
        </div>

        <Table
          rowKey={(record) => record.taskCategoryId ?? record.id}
          columns={columns}
          dataSource={categories}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} mục`,
          }}
          scroll={{ x: 800 }}
        />

        <Modal
          open={open}
          title={editing ? "Sửa loại công việc" : "Thêm loại công việc"}
          onCancel={() => {
            setOpen(false);
            setEditing(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          okText={editing ? "Lưu" : "Thêm"}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={submit}
            initialValues={{
              name: "",
              description: "",
            }}
          >
            <Form.Item
              name="name"
              label="Tên loại công việc"
              rules={[
                { required: true, message: "Vui lòng nhập tên" },
                { max: 100, message: "Tên không quá 100 ký tự" },
              ]}
            >
              <Input placeholder="VD: Bảo trì, Kiểm định chất lượng, Sửa chữa..." />
            </Form.Item>

            <Form.Item
              name="description"
              label="Mô tả"
              rules={[{ max: 500, message: "Mô tả không quá 500 ký tự" }]}
            >
              <Input.TextArea
                rows={4}
                placeholder="Mô tả chi tiết về loại công việc này..."
                showCount
                maxLength={500}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}

