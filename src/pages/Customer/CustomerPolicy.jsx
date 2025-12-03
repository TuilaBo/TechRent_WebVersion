// src/pages/Customer/CustomerPolicy.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Typography,
  Descriptions,
  Row,
  Col,
  Empty,
  Spin,
  Divider,
} from "antd";
import {
  FileTextOutlined,
  DownloadOutlined,
  EyeOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { listPolicies, getPolicyById } from "../../lib/policy";
import toast from "react-hot-toast";

const { Title, Text, Paragraph } = Typography;

export default function CustomerPolicy() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingPolicy, setViewingPolicy] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, expired, upcoming

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

  const getStatus = (policy) => {
    const now = dayjs();
    const from = policy.effectiveFrom ? dayjs(policy.effectiveFrom) : null;
    const to = policy.effectiveTo ? dayjs(policy.effectiveTo) : null;

    if (from && now.isBefore(from)) {
      return { label: "Chưa hiệu lực", color: "default", key: "upcoming" };
    }
    if (to && now.isAfter(to)) {
      return { label: "Hết hiệu lực", color: "red", key: "expired" };
    }
    if (from && to && (now.isAfter(from) || now.isSame(from)) && (now.isBefore(to) || now.isSame(to))) {
      return { label: "Đang hiệu lực", color: "green", key: "active" };
    }
    if (from && !to && (now.isAfter(from) || now.isSame(from))) {
      return { label: "Đang hiệu lực", color: "green", key: "active" };
    }
    return { label: "Không xác định", color: "default", key: "unknown" };
  };

  const filteredPolicies = useMemo(() => {
    if (statusFilter === "all") return policies;
    return policies.filter((policy) => {
      const status = getStatus(policy);
      return status.key === statusFilter;
    });
  }, [policies, statusFilter]);

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

  const handleDownload = (policy) => {
    if (policy.fileUrl) {
      window.open(policy.fileUrl, "_blank");
    } else {
      toast.error("Không có file để tải.");
    }
  };

  const statusFilters = [
    { label: "Tất cả", value: "all", color: "default" },
    { label: "Đang hiệu lực", value: "active", color: "green" },
    { label: "Hết hiệu lực", value: "expired", color: "red" },
    { label: "Chưa hiệu lực", value: "upcoming", color: "default" },
  ];

  return (
    <div style={{ padding: "40px 20px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <Title level={1} style={{ marginBottom: 16, fontSize: 36 }}>
          Chính sách & Điều khoản
        </Title>
        <Paragraph style={{ fontSize: 16, color: "#666", maxWidth: 600, margin: "0 auto" }}>
          Tìm hiểu về các chính sách và điều khoản của TechRent. Chúng tôi cam kết minh bạch và bảo vệ quyền lợi của khách hàng.
        </Paragraph>
      </div>

      {/* Filter Section */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <Space size="middle" wrap>
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              type={statusFilter === filter.value ? "primary" : "default"}
              onClick={() => setStatusFilter(filter.value)}
              style={{
                borderRadius: 20,
                height: 40,
                paddingInline: 24,
                fontWeight: 600,
              }}
            >
              {filter.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* Policies List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : filteredPolicies.length === 0 ? (
        <Empty
          description="Không có policy nào"
          style={{ padding: 60 }}
        />
      ) : (
        <Row gutter={[24, 24]}>
          {filteredPolicies.map((policy) => {
            const status = getStatus(policy);
            return (
              <Col xs={24} sm={12} lg={8} key={policy.policyId || policy.id}>
                <Card
                  hoverable
                  style={{
                    height: "100%",
                    borderRadius: 16,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease",
                  }}
                  bodyStyle={{ padding: 24 }}
                  actions={[
                    <Button
                      key="view"
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => handleView(policy)}
                      style={{ width: "100%", border: "none" }}
                    >
                      Xem chi tiết
                    </Button>,
                    policy.fileUrl && (
                      <Button
                        key="download"
                        type="text"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownload(policy)}
                        style={{ width: "100%", border: "none" }}
                      >
                        Tải file
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <div>
                      <Tag color={status.color} style={{ marginBottom: 12, fontSize: 12 }}>
                        {status.label}
                      </Tag>
                      <Title level={4} style={{ margin: 0, fontSize: 18 }}>
                        {policy.title}
                      </Title>
                    </div>
                    
                    {policy.description && (
                      <Paragraph
                        ellipsis={{ rows: 3, expandable: false }}
                        style={{ margin: 0, color: "#666", fontSize: 14 }}
                      >
                        {policy.description}
                      </Paragraph>
                    )}

                    <Divider style={{ margin: "8px 0" }} />

                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      {policy.effectiveFrom && (
                        <Space>
                          <CalendarOutlined style={{ color: "#999" }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Từ: {dayjs(policy.effectiveFrom).format("DD/MM/YYYY")}
                          </Text>
                        </Space>
                      )}
                      {policy.effectiveTo && (
                        <Space>
                          <CalendarOutlined style={{ color: "#999" }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Đến: {dayjs(policy.effectiveTo).format("DD/MM/YYYY")}
                          </Text>
                        </Space>
                      )}
                    </Space>

                    {policy.fileUrl && (
                      <Tag icon={<FileTextOutlined />} color="blue" style={{ marginTop: 8 }}>
                        {policy.fileType || "PDF"}
                      </Tag>
                    )}
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* View Detail Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>Chi tiết Policy</span>
          </Space>
        }
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
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(viewingPolicy)}
            >
              Tải file
            </Button>
          ),
        ]}
        width={700}
      >
        {viewLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : viewingPolicy ? (
          <Descriptions column={1} bordered>
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
            {viewingPolicy.fileUrl && (
              <Descriptions.Item label="File">
                <Space>
                  <Tag icon={<FileTextOutlined />} color="blue">
                    {viewingPolicy.fileType || "PDF"}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {viewingPolicy.fileName}
                  </Text>
                </Space>
              </Descriptions.Item>
            )}
            {viewingPolicy.createdAt && (
              <Descriptions.Item label="Ngày tạo">
                {dayjs(viewingPolicy.createdAt).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
            )}
            {viewingPolicy.updatedAt && (
              <Descriptions.Item label="Cập nhật lần cuối">
                {dayjs(viewingPolicy.updatedAt).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}

