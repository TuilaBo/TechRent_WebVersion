// src/pages/admin/AdminPolicy.jsx
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
  DatePicker,
  Upload,
  Popconfirm,
  Typography,
  Descriptions,
  message,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UploadOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from "../../lib/policy";
import toast from "react-hot-toast";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AdminPolicy() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create/Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState([]);

  // View Modal
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingPolicy, setViewingPolicy] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await listPolicies();
      const normalized = Array.isArray(data) ? data : [];
      setPolicies(normalized);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải danh sách policy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = async (policy = null) => {
    setEditingPolicy(policy);
    setFileList([]);
    
    if (policy) {
      form.setFieldsValue({
        title: policy.title,
        description: policy.description,
        effectiveFrom: policy.effectiveFrom ? dayjs(policy.effectiveFrom) : null,
        effectiveTo: policy.effectiveTo ? dayjs(policy.effectiveTo) : null,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // Lấy file từ fileList (có thể là originFileObj hoặc file object trực tiếp)
      const selectedFile = fileList.length > 0 
        ? (fileList[0].originFileObj || fileList[0]) 
        : null;

      const payload = {
        title: values.title,
        description: values.description || "",
        effectiveFrom: values.effectiveFrom
          ? values.effectiveFrom.format("YYYY-MM-DD")
          : "",
        effectiveTo: values.effectiveTo
          ? values.effectiveTo.format("YYYY-MM-DD")
          : "",
        file: selectedFile,
      };

      if (editingPolicy) {
        await updatePolicy(editingPolicy.policyId || editingPolicy.id, payload);
        toast.success("Đã cập nhật policy.");
      } else {
        await createPolicy(payload);
        toast.success("Đã tạo policy mới.");
      }

      setModalVisible(false);
      setEditingPolicy(null);
      setFileList([]);
      form.resetFields();
      fetchData();
    } catch (error) {
      if (!error?.errorFields) {
        console.error(error);
        toast.error(
          error?.response?.data?.message || "Thao tác thất bại."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (policy) => {
    try {
      const id = policy.policyId || policy.id;
      await deletePolicy(id);
      toast.success("Đã xoá policy.");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Không thể xoá policy.");
    }
  };

  const handleView = async (policy) => {
    try {
      setViewLoading(true);
      const id = policy.policyId || policy.id;
      const detail = await getPolicyById(id);
      setViewingPolicy(detail);
      setViewModalVisible(true);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải chi tiết policy.");
    } finally {
      setViewLoading(false);
    }
  };

  const getStatus = (policy) => {
    const now = dayjs();
    const from = policy.effectiveFrom ? dayjs(policy.effectiveFrom) : null;
    const to = policy.effectiveTo ? dayjs(policy.effectiveTo) : null;

    if (from && now.isBefore(from)) {
      return { label: "Chưa hiệu lực", color: "default" };
    }
    if (to && now.isAfter(to)) {
      return { label: "Hết hiệu lực", color: "red" };
    }
    // Check if now is between from and to (inclusive)
    if (from && to && (now.isAfter(from) || now.isSame(from)) && (now.isBefore(to) || now.isSame(to))) {
      return { label: "Đang hiệu lực", color: "green" };
    }
    if (from && !to && (now.isAfter(from) || now.isSame(from))) {
      return { label: "Đang hiệu lực", color: "green" };
    }
    return { label: "Không xác định", color: "default" };
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "policyId",
      key: "policyId",
      width: 80,
      render: (id, record) => id || record.id,
    },
    {
      title: "Tiêu đề",
      dataIndex: "title",
      key: "title",
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      render: (v) => (
        <Text
          style={{ display: "inline-block", maxWidth: 300 }}
          ellipsis={{ tooltip: v }}
        >
          {v || "—"}
        </Text>
      ),
    },
    {
      title: "Ngày bắt đầu",
      dataIndex: "effectiveFrom",
      key: "effectiveFrom",
      width: 140,
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
    },
    {
      title: "Ngày kết thúc",
      dataIndex: "effectiveTo",
      key: "effectiveTo",
      width: 140,
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 140,
      render: (_, record) => {
        const status = getStatus(record);
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    {
      title: "File",
      key: "file",
      width: 100,
      align: "center",
      render: (_, record) => {
        if (record.fileUrl || record.file) {
          return (
            <Tag icon={<FileTextOutlined />} color="blue">
              Có file
            </Tag>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "right",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleView(record)}
          >
            Xem
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openModal(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="XOÁ POLICY"
            description="Bạn có chắc muốn xoá policy này?"
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

  const uploadProps = {
    beforeUpload: (file) => {
      const isPdf = file.type === "application/pdf";
      const isWord =
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword";
      
      if (!isPdf && !isWord) {
        message.error("Chỉ chấp nhận file PDF hoặc Word!");
        return Upload.LIST_IGNORE;
      }
      
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error("File phải nhỏ hơn 10MB!");
        return Upload.LIST_IGNORE;
      }
      
      return false; // Prevent auto upload
    },
    fileList,
    onChange: (info) => {
      // Chỉ lấy file hợp lệ (status !== 'error')
      const validFiles = info.fileList.filter(file => file.status !== 'error');
      setFileList(validFiles);
    },
    onRemove: () => {
      setFileList([]);
    },
    maxCount: 1,
  };

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
              Quản lý Policy
            </Title>
            <Text type="secondary">
              Tạo và quản lý các policy với file PDF hoặc Word.
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
              Thêm Policy
            </Button>
          </Space>
        </div>
      </Card>

      <Card
        bodyStyle={{ padding: 0 }}
        style={{ borderRadius: 16, overflow: "hidden" }}
      >
        <Table
          rowKey={(record) => record.policyId || record.id}
          columns={columns}
          dataSource={policies}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingPolicy ? "Cập nhật Policy" : "Thêm Policy mới"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingPolicy(null);
          setFileList([]);
          form.resetFields();
        }}
        onOk={handleSubmit}
        okText={editingPolicy ? "Lưu thay đổi" : "Tạo mới"}
        confirmLoading={submitting}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Tiêu đề"
            name="title"
            rules={[{ required: true, message: "Nhập tiêu đề policy" }]}
          >
            <Input placeholder="Ví dụ: Chính sách bảo hành 2025" />
          </Form.Item>
          
          <Form.Item
            label="Mô tả"
            name="description"
          >
            <TextArea
              rows={4}
              placeholder="Mô tả chi tiết về policy"
            />
          </Form.Item>

          <Form.Item
            label="Ngày bắt đầu hiệu lực"
            name="effectiveFrom"
            rules={[{ required: true, message: "Chọn ngày bắt đầu" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder="Chọn ngày bắt đầu"
            />
          </Form.Item>

          <Form.Item
            label="Ngày kết thúc hiệu lực"
            name="effectiveTo"
          >
            <DatePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder="Chọn ngày kết thúc (tùy chọn)"
            />
          </Form.Item>

          <Form.Item
            label="File Policy (PDF hoặc Word)"
            help="Chỉ chấp nhận file PDF hoặc Word, tối đa 10MB"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Chọn file</Button>
            </Upload>
            {editingPolicy && !fileList.length && (
              <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                Để trống nếu không muốn thay đổi file hiện tại
              </Text>
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title="Chi tiết Policy"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setViewingPolicy(null);
        }}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Đóng
          </Button>,
          viewingPolicy?.fileUrl && (
            <Button
              key="download"
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => {
                window.open(viewingPolicy.fileUrl, "_blank");
              }}
            >
              Xem/Tải file
            </Button>
          ),
        ]}
        width={700}
      >
        {viewLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Text>Đang tải...</Text>
          </div>
        ) : viewingPolicy ? (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">
              {viewingPolicy.policyId || viewingPolicy.id}
            </Descriptions.Item>
            <Descriptions.Item label="Tiêu đề">
              <Text strong>{viewingPolicy.title}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả">
              {viewingPolicy.description || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu hiệu lực">
              {viewingPolicy.effectiveFrom
                ? dayjs(viewingPolicy.effectiveFrom).format("DD/MM/YYYY")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc hiệu lực">
              {viewingPolicy.effectiveTo
                ? dayjs(viewingPolicy.effectiveTo).format("DD/MM/YYYY")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={getStatus(viewingPolicy).color}>
                {getStatus(viewingPolicy).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="File">
              {viewingPolicy.fileUrl || viewingPolicy.file ? (
                <Button
                  type="link"
                  icon={<FileTextOutlined />}
                  onClick={() => {
                    window.open(
                      viewingPolicy.fileUrl || viewingPolicy.file,
                      "_blank"
                    );
                  }}
                >
                  Xem file
                </Button>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            {viewingPolicy.createdAt && (
              <Descriptions.Item label="Ngày tạo">
                {dayjs(viewingPolicy.createdAt).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
            )}
            {viewingPolicy.updatedAt && (
              <Descriptions.Item label="Ngày cập nhật">
                {dayjs(viewingPolicy.updatedAt).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}

