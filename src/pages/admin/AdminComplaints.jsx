// src/pages/admin/AdminComplaints.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Select,
  Input,
  Modal,
  Descriptions,
  Image,
  Empty,
  Spin,
  Divider,
  Alert,
} from "antd";
import {
  ReloadOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getStaffComplaints, getStaffComplaintById } from "../../lib/complaints";
import { getConditionDefinitions } from "../../lib/condition";

const { Title, Text } = Typography;

// Status options for complaints
const COMPLAINT_STATUS_OPTIONS = [
  { label: "Tất cả", value: "" },
  { label: "Chờ xử lý", value: "PENDING" },
  { label: "Đang xử lý", value: "PROCESSING" },
  { label: "Đã giải quyết", value: "RESOLVED" },
  { label: "Đã hủy", value: "CANCELLED" },
];

// Status color mapping
const getStatusColor = (status) => {
  const map = {
    PENDING: "gold",
    PROCESSING: "blue",
    RESOLVED: "green",
    CANCELLED: "red",
  };
  return map[status] || "default";
};

// Status label mapping
const getStatusLabel = (status) => {
  const map = {
    PENDING: "Chờ xử lý",
    PROCESSING: "Đang xử lý",
    RESOLVED: "Đã giải quyết",
    CANCELLED: "Đã hủy",
  };
  return map[status] || status;
};

// Fault source mapping
const getFaultSourceLabel = (source) => {
  const map = {
    RENTAL_DEVICE: "Thiết bị cho thuê",
    CUSTOMER: "Khách hàng",
    OTHER: "Khác",
  };
  return map[source] || source || "—";
};

const getFaultSourceColor = (source) => {
  const map = {
    RENTAL_DEVICE: "orange",
    CUSTOMER: "red",
    OTHER: "default",
  };
  return map[source] || "default";
};

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchText, setSearchText] = useState("");

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Condition definitions map for lookup
  const [conditionMap, setConditionMap] = useState({});

  const hasFetched = useRef(false);

  // Fetch complaints
  const fetchComplaints = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const data = await getStaffComplaints({ status: filterStatus || undefined });
      setComplaints(data);
      if (showToast) {
        toast.success("Tải danh sách khiếu nại thành công");
      }
    } catch (error) {
      console.error("Failed to load complaints:", error);
      toast.error(error?.response?.data?.message || "Không thể tải danh sách khiếu nại");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchComplaints(true);

      // Fetch condition definitions for name lookup
      getConditionDefinitions()
        .then((conditions) => {
          const map = {};
          conditions.forEach((c) => {
            map[c.id] = c.name;
          });
          setConditionMap(map);
        })
        .catch((err) => {
          console.error("Failed to load condition definitions:", err);
        });
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) {
      fetchComplaints();
    }
  }, [filterStatus, fetchComplaints]);

  // View complaint detail
  const handleViewDetail = async (complaintId) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    setSelectedComplaint(null);
    try {
      const data = await getStaffComplaintById(complaintId);
      setSelectedComplaint(data);
    } catch (error) {
      console.error("Failed to load complaint detail:", error);
      toast.error("Không thể tải chi tiết khiếu nại");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Filter complaints by search text
  const filteredComplaints = complaints.filter((c) => {
    if (!searchText.trim()) return true;
    const keyword = searchText.toLowerCase();
    return (
      String(c.complaintId || "").toLowerCase().includes(keyword) ||
      String(c.orderId || "").toLowerCase().includes(keyword) ||
      String(c.customerDescription || "").toLowerCase().includes(keyword) ||
      String(c.customerName || "").toLowerCase().includes(keyword)
    );
  });

  // Table columns
  const columns = [
    {
      title: "ID",
      dataIndex: "complaintId",
      key: "complaintId",
      width: 80,
      render: (id) => <Text strong>#{id}</Text>,
    },
    {
      title: "Đơn hàng",
      dataIndex: "orderId",
      key: "orderId",
      width: 100,
      render: (id) => <Text>#{id}</Text>,
    },
    {
      title: "Thiết bị",
      key: "device",
      width: 220,
      render: (_, record) => (
        <div>
          <Text strong style={{ display: "block" }}>
            {record.deviceModelName || "—"}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            SN: {record.deviceSerialNumber || "—"}
          </Text>
        </div>
      ),
    },
    {
      title: "Mô tả",
      dataIndex: "customerDescription",
      key: "customerDescription",
      width: 250,
      ellipsis: true,
      render: (text) => (
        <Text style={{ fontSize: 13 }}>{text || "—"}</Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: "Nguồn lỗi",
      dataIndex: "faultSource",
      key: "faultSource",
      width: 130,
      render: (source) =>
        source ? (
          <Tag color={getFaultSourceColor(source)}>{getFaultSourceLabel(source)}</Tag>
        ) : (
          <Text type="secondary">Chưa xác định</Text>
        ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date) =>
        date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "—",
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      defaultSortOrder: "descend",
    },
    {
      title: "Hành động",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.complaintId)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        {/* Header */}
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <ExclamationCircleOutlined style={{ fontSize: 24, color: "#faad14" }} />
            <Title level={3} style={{ margin: 0 }}>
              Quản lý Khiếu Nại
            </Title>
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchComplaints(true)}
            loading={loading}
          >
            Tải lại
          </Button>
        </Space>

        {/* Filters */}
        <Card>
          <Space wrap size={16}>
            <div>
              <Text style={{ display: "block", marginBottom: 4 }}>Trạng thái</Text>
              <Select
                style={{ width: 180 }}
                value={filterStatus}
                onChange={setFilterStatus}
                options={COMPLAINT_STATUS_OPTIONS}
              />
            </div>
            <div>
              <Text style={{ display: "block", marginBottom: 4 }}>Tìm kiếm</Text>
              <Input
                placeholder="ID, đơn hàng, mô tả..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
            </div>
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            rowKey="complaintId"
            columns={columns}
            dataSource={filteredComplaints}
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} khiếu nại`,
            }}
            scroll={{ x: 1300 }}
            locale={{
              emptyText: <Empty description="Không có khiếu nại nào" />,
            }}
          />
        </Card>
      </Space>

      {/* Detail Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: "#faad14" }} />
            <span>Chi tiết khiếu nại #{selectedComplaint?.complaintId || "—"}</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedComplaint(null);
        }}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setDetailModalOpen(false);
              setSelectedComplaint(null);
            }}
          >
            Đóng
          </Button>,
        ]}
        width={800}
      >
        {loadingDetail ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : selectedComplaint ? (
          <div>
            {/* Basic Info */}
            <Descriptions bordered column={2} size="small" title="Thông tin cơ bản">
              <Descriptions.Item label="ID khiếu nại" span={1}>
                <Text strong>#{selectedComplaint.complaintId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={1}>
                <Tag color={getStatusColor(selectedComplaint.status)}>
                  {getStatusLabel(selectedComplaint.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đơn hàng" span={1}>
                #{selectedComplaint.orderId}
              </Descriptions.Item>
              <Descriptions.Item label="Allocation ID" span={1}>
                {selectedComplaint.allocationId ? `#${selectedComplaint.allocationId}` : "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: "16px 0" }} />

            {/* Device Info */}
            <Descriptions bordered column={2} size="small" title="Thông tin thiết bị gốc">
              <Descriptions.Item label="Thiết bị ID" span={1}>
                #{selectedComplaint.deviceId}
              </Descriptions.Item>
              <Descriptions.Item label="Serial Number" span={1}>
                {selectedComplaint.deviceSerialNumber || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Model thiết bị" span={2}>
                {selectedComplaint.deviceModelName || "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: "16px 0" }} />

            {/* Complaint Details */}
            <Descriptions bordered column={2} size="small" title="Chi tiết khiếu nại">
              <Descriptions.Item label="Mô tả của khách" span={2}>
                <Text>{selectedComplaint.customerDescription || "—"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Nguồn lỗi" span={1}>
                {selectedComplaint.faultSource ? (
                  <Tag color={getFaultSourceColor(selectedComplaint.faultSource)}>
                    {getFaultSourceLabel(selectedComplaint.faultSource)}
                  </Tag>
                ) : (
                  <Text type="secondary">Chưa xác định</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú hư hỏng" span={1}>
                {selectedComplaint.damageNote || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú nhân viên" span={2}>
                {selectedComplaint.staffNote || "—"}
              </Descriptions.Item>
            </Descriptions>

            {/* Replacement Device Info - Only show if there's replacement info */}
            {(selectedComplaint.replacementDeviceId || selectedComplaint.replacementTaskId) && (
              <>
                <Divider style={{ margin: "16px 0" }} />
                <Descriptions bordered column={2} size="small" title="Thông tin thay thế">
                  <Descriptions.Item label="Thiết bị thay thế ID" span={1}>
                    {selectedComplaint.replacementDeviceId
                      ? `#${selectedComplaint.replacementDeviceId}`
                      : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="SN thay thế" span={1}>
                    {selectedComplaint.replacementDeviceSerialNumber || "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Task thay thế" span={1}>
                    {selectedComplaint.replacementTaskId
                      ? `#${selectedComplaint.replacementTaskId}`
                      : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Allocation thay thế" span={1}>
                    {selectedComplaint.replacementAllocationId
                      ? `#${selectedComplaint.replacementAllocationId}`
                      : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Biên bản thay thế" span={2}>
                    {selectedComplaint.replacementReportId
                      ? `#${selectedComplaint.replacementReportId}`
                      : "—"}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}

            <Divider style={{ margin: "16px 0" }} />

            {/* Timestamps */}
            <Descriptions bordered column={2} size="small" title="Thời gian">
              <Descriptions.Item label="Ngày tạo" span={1}>
                {selectedComplaint.createdAt
                  ? dayjs(selectedComplaint.createdAt).format("DD/MM/YYYY HH:mm")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày xử lý" span={1}>
                {selectedComplaint.processedAt
                  ? dayjs(selectedComplaint.processedAt).format("DD/MM/YYYY HH:mm")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày giải quyết" span={1}>
                {selectedComplaint.resolvedAt
                  ? dayjs(selectedComplaint.resolvedAt).format("DD/MM/YYYY HH:mm")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Người giải quyết" span={1}>
                {selectedComplaint.resolvedByStaffName
                  ? `${selectedComplaint.resolvedByStaffName} (#${selectedComplaint.resolvedByStaffId})`
                  : "—"}
              </Descriptions.Item>
            </Descriptions>

            {/* Evidence Images */}
            {selectedComplaint.evidenceUrls && selectedComplaint.evidenceUrls.length > 0 && (
              <>
                <Divider style={{ margin: "16px 0" }} />
                <div>
                  <Text strong style={{ display: "block", marginBottom: 12 }}>
                    Ảnh bằng chứng ({selectedComplaint.evidenceUrls.length} ảnh)
                  </Text>
                  <Image.PreviewGroup>
                    <Space wrap>
                      {selectedComplaint.evidenceUrls.map((url, index) => (
                        <Image
                          key={index}
                          src={url}
                          alt={`Evidence ${index + 1}`}
                          width={120}
                          height={120}
                          style={{
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid #e8e8e8",
                          }}
                        />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                </div>
              </>
            )}

            {/* Condition Definitions - Get names from conditionMap or discrepancies */}
            {selectedComplaint.conditionDefinitionIds &&
              selectedComplaint.conditionDefinitionIds.length > 0 && (
                <>
                  <Divider style={{ margin: "16px 0" }} />
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 12 }}>
                      Các tình trạng hư hỏng
                    </Text>
                    <Space wrap>
                      {selectedComplaint.conditionDefinitionIds.map((id, index) => {
                        // 1. Try to find from conditionMap (fetched from API)
                        let condName = conditionMap[id];
                        // 2. Fallback: try to find from discrepancies
                        if (!condName) {
                          const disc = selectedComplaint.discrepancies?.find(
                            (d) => d.conditionDefinitionId === id
                          );
                          condName = disc?.conditionName;
                        }
                        return (
                          <Tag key={index} color="orange">
                            {condName || `Condition #${id}`}
                          </Tag>
                        );
                      })}
                    </Space>
                  </div>
                </>
              )}

            {/* Discrepancies */}
            {selectedComplaint.discrepancies &&
              selectedComplaint.discrepancies.length > 0 && (
                <>
                  <Divider style={{ margin: "16px 0" }} />
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 12, fontSize: 14 }}>
                      Sự cố ({selectedComplaint.discrepancies.length})
                    </Text>
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      {selectedComplaint.discrepancies.map((disc, index) => (
                        <Card
                          key={disc.discrepancyReportId || index}
                          size="small"
                          style={{
                            background: "#fafafa",
                            borderRadius: 8,
                            border: "1px solid #f0f0f0",
                          }}
                        >
                          <Descriptions column={2} size="small">
                            <Descriptions.Item label="ID báo cáo" span={1}>
                              <Text strong>#{disc.discrepancyReportId}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Loại" span={1}>
                              <Tag color={disc.discrepancyType === "DAMAGE" ? "red" : "orange"}>
                                {disc.discrepancyType === "DAMAGE" ? "Hư hỏng" : disc.discrepancyType}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Nguồn" span={1}>
                              <Tag color="blue">
                                {disc.createdFrom === "CUSTOMER_COMPLAINT"
                                  ? "Khiếu nại KH"
                                  : disc.createdFrom}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ref ID" span={1}>
                              #{disc.refId}
                            </Descriptions.Item>
                            <Descriptions.Item label="Tình trạng" span={2}>
                              <Tag color="orange">
                                {disc.conditionName} (#{disc.conditionDefinitionId})
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thiết bị" span={2}>
                              <div>
                                <Text>{disc.deviceModelName}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  SN: {disc.serialNumber} | ID: #{disc.deviceId}
                                </Text>
                              </div>
                            </Descriptions.Item>
                            <Descriptions.Item label="Phí phạt" span={1}>
                              <Text
                                strong
                                style={{
                                  color: disc.penaltyAmount > 0 ? "#f5222d" : "#52c41a",
                                }}
                              >
                                {new Intl.NumberFormat("vi-VN", {
                                  style: "currency",
                                  currency: "VND",
                                }).format(disc.penaltyAmount || 0)}
                              </Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo" span={1}>
                              {disc.createdAt
                                ? dayjs(disc.createdAt).format("DD/MM/YYYY HH:mm")
                                : "—"}
                            </Descriptions.Item>
                            {disc.staffNote && (
                              <Descriptions.Item label="Ghi chú NV" span={2}>
                                {disc.staffNote}
                              </Descriptions.Item>
                            )}
                          </Descriptions>
                        </Card>
                      ))}
                    </Space>
                  </div>
                </>
              )}
          </div>
        ) : (
          <Alert message="Không tìm thấy thông tin khiếu nại" type="warning" showIcon />
        )}
      </Modal>
    </div>
  );
}
