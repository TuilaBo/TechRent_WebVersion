// src/pages/admin/AdminTaskCategory.jsx
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Typography,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import dayjs from "dayjs";

import {
  listTaskCategories,
  normalizeTaskCategory,
} from "../../lib/taskCategoryApi";

const { Title } = Typography;

export default function AdminTaskCategory() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);

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
  ];

  return (
    <div className="min-h-screen bg-white">
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Title level={3} style={{ margin: 0 }}>
            Quản lý loại công việc
          </Title>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadCategories}
            loading={loading}
          >
            Làm mới
          </Button>
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
      </div>
    </div>
  );
}
