// src/pages/admin/AdminTaskRule.jsx
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Popconfirm,
  Typography,
  Tag,
  DatePicker,
  Card,
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
  listTaskRules,
  createTaskRule,
  updateTaskRule,
  deleteTaskRule,
  getActiveTaskRule,
  normalizeTaskRule,
} from "../../lib/taskRulesApi";

const { Title } = Typography;
const { TextArea } = Input;

export default function AdminTaskRule() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [activeRule, setActiveRule] = useState(null);

  const loadRules = async () => {
    try {
      setLoading(true);
      const list = await listTaskRules();
      setRules(list.map(normalizeTaskRule));
      
      // Load active rule
      try {
        const active = await getActiveTaskRule();
        setActiveRule(active ? normalizeTaskRule(active) : null);
      } catch {
        // Ignore if no active rule
        setActiveRule(null);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không tải được danh sách rule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    // Set default values
    form.setFieldsValue({
      active: true,
      maxTasksPerDay: 0,
    });
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name ?? "",
      description: record.description ?? "",
      maxTasksPerDay: record.maxTasksPerDay ?? 0,
      active: record.active ?? false,
      effectiveFrom: record.effectiveFrom ? dayjs(record.effectiveFrom) : null,
      effectiveTo: record.effectiveTo ? dayjs(record.effectiveTo) : null,
    });
    setOpen(true);
  };

  const submit = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description ?? "",
        maxTasksPerDay: Number(values.maxTasksPerDay ?? 0),
        active: Boolean(values.active ?? false),
        effectiveFrom: values.effectiveFrom ? values.effectiveFrom.toISOString() : null,
        effectiveTo: values.effectiveTo ? values.effectiveTo.toISOString() : null,
      };

      if (editing) {
        const id = editing.taskRuleId ?? editing.id;
        await updateTaskRule(id, payload);
        toast.success("Cập nhật rule thành công");
      } else {
        await createTaskRule(payload);
        toast.success("Thêm rule thành công");
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      await loadRules();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Lưu thất bại");
    }
  };

  const handleDelete = async (record) => {
    try {
      const id = record.taskRuleId ?? record.id;
      const prev = rules;
      setRules(prev.filter((x) => (x.taskRuleId ?? x.id) !== id));
      
      await deleteTaskRule(id);
      toast.success("Đã xoá rule");
      await loadRules();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Xoá thất bại");
      // Restore state on error
      setRules(rules);
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "taskRuleId",
      key: "id",
      width: 80,
      render: (_, record) => record.taskRuleId ?? record.id,
      sorter: (a, b) => (a.taskRuleId ?? a.id) - (b.taskRuleId ?? b.id),
    },
    {
      title: "Tên rule",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (text, record) => {
        const isActive = activeRule && (activeRule.taskRuleId ?? activeRule.id) === (record.taskRuleId ?? record.id);
        return (
          <Space>
            <span>{text || "-"}</span>
            {isActive && <Tag color="green">Đang áp dụng</Tag>}
          </Space>
        );
      },
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (text) => text || "-",
    },
    {
      title: "Số task/ngày",
      dataIndex: "maxTasksPerDay",
      key: "maxTasksPerDay",
      width: 120,
      align: "center",
      render: (value) => value ?? 0,
    },
    {
      title: "Trạng thái",
      dataIndex: "active",
      key: "active",
      width: 100,
      align: "center",
      render: (active) => (
        <Tag color={active ? "green" : "default"}>
          {active ? "Kích hoạt" : "Tắt"}
        </Tag>
      ),
    },
    {
      title: "Từ ngày",
      dataIndex: "effectiveFrom",
      key: "effectiveFrom",
      width: 180,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Đến ngày",
      dataIndex: "effectiveTo",
      key: "effectiveTo",
      width: 180,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
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
            size="small"
            onClick={() => openEdit(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xác nhận xóa"
            description="Bạn có chắc chắn muốn xóa rule này?"
            onConfirm={() => handleDelete(record)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Title level={3} style={{ margin: 0 }}>
            Quản lý Quy tắc Công việc 
          </Title>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadRules}
              loading={loading}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
            >
              Thêm rule mới
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={rules}
          rowKey={(record) => record.taskRuleId ?? record.id}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} rule`,
          }}
        />
      </Card>

      <Modal
        title={editing ? "Cập nhật rule" : "Thêm rule mới"}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={editing ? "Cập nhật" : "Thêm"}
        cancelText="Hủy"
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
        >
          <Form.Item
            label="Tên rule"
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên rule" }]}
          >
            <Input placeholder="Nhập tên rule" />
          </Form.Item>

          <Form.Item
            label="Mô tả"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="Nhập mô tả rule"
            />
          </Form.Item>

          <Form.Item
            label="Số công việc tối đa mỗi ngày"
            name="maxTasksPerDay"
            rules={[
              { required: true, message: "Vui lòng nhập số task tối đa" },
              { type: "number", min: 0, message: "Số task phải >= 0" },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Nhập số task tối đa"
              min={0}
            />
          </Form.Item>

          <Form.Item
            label="Kích hoạt"
            name="active"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Ngày bắt đầu hiệu lực"
            name="effectiveFrom"
          >
            <DatePicker
              style={{ width: "100%" }}
              showTime
              format="DD/MM/YYYY HH:mm"
              placeholder="Chọn ngày bắt đầu"
            />
          </Form.Item>

          <Form.Item
            label="Ngày kết thúc hiệu lực"
            name="effectiveTo"
            dependencies={["effectiveFrom"]}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const fromDate = getFieldValue("effectiveFrom");
                  if (!value || !fromDate) {
                    return Promise.resolve();
                  }
                  if (value.isBefore(fromDate)) {
                    return Promise.reject(new Error("Ngày kết thúc phải sau ngày bắt đầu"));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker
              style={{ width: "100%" }}
              showTime
              format="DD/MM/YYYY HH:mm"
              placeholder="Chọn ngày kết thúc"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

