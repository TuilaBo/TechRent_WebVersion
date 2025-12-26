/**
 * TechnicianComplaint - Trang quản lý khiếu nại cho Technician
 */
import React, { useState, useEffect } from "react";
import {
    Typography,
    Table,
    Tag,
    Button,
    Space,
    Drawer,
    Descriptions,
    message,
    Skeleton,
    Select,
    Card,
    Divider,
    Empty,
    Image,
    Modal,
    Form,
    Input,
    Upload,
} from "antd";
import {
    ReloadOutlined,
    EyeOutlined,
    ExclamationCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
    getStaffComplaints,
    getStaffComplaintById,
    resolveComplaint,
} from "../../lib/complaints";

const { Title, Text } = Typography;
const { TextArea } = Input;

// Map status to display
const COMPLAINT_STATUS_MAP = {
    PENDING: { color: "orange", label: "Chờ xử lý" },
    PROCESSING: { color: "blue", label: "Đang xử lý" },
    RESOLVED: { color: "green", label: "Đã giải quyết" },
    CANCELLED: { color: "red", label: "Đã hủy" },
};

// Map fault source to display
const FAULT_SOURCE_MAP = {
    UNKNOWN: { color: "default", label: "Chưa xác định" },
    RENTAL_DEVICE: { color: "red", label: "Lỗi do thiết bị/nhà cung cấp" },
    CUSTOMER: { color: "orange", label: "Lỗi do khách hàng sử dụng" },
};

export default function TechnicianComplaint() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState(null);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Resolve modal state
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [resolvingAction, setResolvingAction] = useState(false);
    const [resolveForm] = Form.useForm();
    const [evidenceFiles, setEvidenceFiles] = useState([]);

    // Format datetime
    const formatDateTime = (date) => {
        if (!date) return "—";
        return dayjs(date).format("DD/MM/YYYY HH:mm");
    };

    // Load complaints
    const fetchComplaints = async (status = null) => {
        try {
            setLoading(true);
            const data = await getStaffComplaints({ status });
            setComplaints(data);
        } catch (error) {
            message.error(
                error?.response?.data?.message || error?.message || "Không thể tải danh sách khiếu nại"
            );
        } finally {
            setLoading(false);
        }
    };

    // Load complaint detail
    const handleViewDetail = async (record) => {
        try {
            setSelectedComplaint(record);
            setDrawerOpen(true);
            setLoadingDetail(true);

            const detail = await getStaffComplaintById(record.complaintId);
            setSelectedComplaint(detail);
        } catch (error) {
            message.error(
                error?.response?.data?.message || error?.message || "Không thể tải chi tiết khiếu nại"
            );
        } finally {
            setLoadingDetail(false);
        }
    };

    // Reload selected complaint detail
    const reloadSelectedComplaint = async () => {
        if (selectedComplaint?.complaintId) {
            try {
                const detail = await getStaffComplaintById(selectedComplaint.complaintId);
                setSelectedComplaint(detail);
            } catch (error) {
                console.error("Failed to reload complaint:", error);
            }
        }
    };

    // Handle resolve complaint
    const handleResolveComplaint = async (values) => {
        if (!selectedComplaint?.complaintId) return;

        try {
            setResolvingAction(true);
            await resolveComplaint(selectedComplaint.complaintId, {
                staffNote: values.staffNote,
                evidenceFiles: evidenceFiles,
            });
            message.success("Đánh dấu giải quyết thành công!");
            setResolveModalOpen(false);
            resolveForm.resetFields();
            setEvidenceFiles([]);
            await reloadSelectedComplaint();
            await fetchComplaints(statusFilter);
        } catch (error) {
            message.error(
                error?.response?.data?.message || error?.message || "Không thể giải quyết khiếu nại"
            );
        } finally {
            setResolvingAction(false);
        }
    };

    useEffect(() => {
        fetchComplaints(statusFilter);
    }, [statusFilter]);

    // Get status tag
    const getStatusTag = (status) => {
        const s = String(status || "").toUpperCase();
        const config = COMPLAINT_STATUS_MAP[s] || { color: "default", label: status || "—" };
        return <Tag color={config.color}>{config.label}</Tag>;
    };

    // Get fault source tag
    const getFaultSourceTag = (source) => {
        const s = String(source || "").toUpperCase();
        const config = FAULT_SOURCE_MAP[s] || { color: "default", label: source || "—" };
        return <Tag color={config.color}>{config.label}</Tag>;
    };

    // Table columns
    const columns = [
        {
            title: "Mã KN",
            dataIndex: "complaintId",
            key: "complaintId",
            width: 80,
            render: (v) => <Text strong>#{v}</Text>,
        },
        {
            title: "Mã đơn",
            dataIndex: "orderId",
            key: "orderId",
            width: 90,
            render: (v) => <Text>#{v}</Text>,
        },
        {
            title: "Thiết bị",
            key: "device",
            width: 200,
            render: (_, record) => (
                <div>
                    <div><Text strong>{record.deviceModelName || "—"}</Text></div>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>SN: {record.deviceSerialNumber || "—"}</Text></div>
                </div>
            ),
        },
        {
            title: "Trạng thái",
            dataIndex: "status",
            key: "status",
            width: 120,
            render: (status) => getStatusTag(status),
        },
        {
            title: "Mô tả",
            dataIndex: "customerDescription",
            key: "customerDescription",
            ellipsis: true,
            width: 250,
            render: (text) => (
                <Text ellipsis={{ tooltip: text }} style={{ maxWidth: 230 }}>
                    {text || "—"}
                </Text>
            ),
        },
        {
            title: "Ngày tạo",
            dataIndex: "createdAt",
            key: "createdAt",
            width: 140,
            render: (date) => formatDateTime(date),
            sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
            defaultSortOrder: "descend",
        },
        {
            title: "Thao tác",
            key: "action",
            width: 100,
            fixed: "right",
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewDetail(record)}
                >
                    Chi tiết
                </Button>
            ),
        },
    ];

    return (
        <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                    <ExclamationCircleOutlined style={{ marginRight: 8 }} />
                    Danh sách khiếu nại
                </Title>
                <Space>
                    <Select
                        placeholder="Lọc theo trạng thái"
                        allowClear
                        style={{ width: 180 }}
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        options={[
                            { value: "PENDING", label: "Chờ xử lý" },
                            { value: "PROCESSING", label: "Đang xử lý" },
                            { value: "RESOLVED", label: "Đã giải quyết" },
                            { value: "CANCELLED", label: "Đã hủy" },
                        ]}
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => fetchComplaints(statusFilter)}
                    >
                        Tải lại
                    </Button>
                </Space>
            </div>

            {/* Table */}
            <Table
                rowKey="complaintId"
                columns={columns}
                dataSource={complaints}
                loading={loading}
                pagination={{
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50"],
                    showTotal: (total) => `Tổng ${total} khiếu nại`,
                }}
                scroll={{ x: 1000 }}
                locale={{
                    emptyText: <Empty description="Không có khiếu nại nào" />,
                }}
            />

            {/* Detail Drawer */}
            <Drawer
                title={selectedComplaint ? `Chi tiết khiếu nại #${selectedComplaint.complaintId}` : "Chi tiết khiếu nại"}
                open={drawerOpen}
                onClose={() => {
                    setDrawerOpen(false);
                    setSelectedComplaint(null);
                }}
                width={600}
            >
                {loadingDetail ? (
                    <Skeleton active paragraph={{ rows: 10 }} />
                ) : selectedComplaint ? (
                    <div>
                        {/* Status Card */}
                        <Card size="small" style={{ marginBottom: 16, background: "#fafafa" }}>
                            <Space size="large">
                                <div>
                                    <Text type="secondary">Trạng thái:</Text>
                                    <div style={{ marginTop: 4 }}>{getStatusTag(selectedComplaint.status)}</div>
                                </div>
                                <div>
                                    <Text type="secondary">Nguồn lỗi:</Text>
                                    <div style={{ marginTop: 4 }}>{getFaultSourceTag(selectedComplaint.faultSource)}</div>
                                </div>
                            </Space>
                        </Card>

                        {/* Thông tin cơ bản */}
                        <Descriptions title="Thông tin khiếu nại" column={1} bordered size="small">
                            <Descriptions.Item label="Mã khiếu nại">
                                <Text strong>#{selectedComplaint.complaintId}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Mã đơn hàng">
                                <Text strong>#{selectedComplaint.orderId}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo">
                                {formatDateTime(selectedComplaint.createdAt)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mô tả khách hàng">
                                {selectedComplaint.customerDescription || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ghi chú nhân viên">
                                {selectedComplaint.staffNote || "—"}
                            </Descriptions.Item>
                        </Descriptions>

                        <Divider />

                        {/* Thông tin thiết bị */}
                        <Descriptions title="Thông tin thiết bị" column={1} bordered size="small">
                            <Descriptions.Item label="Mã thiết bị">
                                #{selectedComplaint.deviceId}
                            </Descriptions.Item>
                            <Descriptions.Item label="Tên model">
                                {selectedComplaint.deviceModelName || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Serial Number">
                                {selectedComplaint.deviceSerialNumber || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mã allocation">
                                #{selectedComplaint.allocationId || "—"}
                            </Descriptions.Item>
                        </Descriptions>

                        {/* Thông tin thay thế (nếu có) */}
                        {(selectedComplaint.replacementDeviceId || selectedComplaint.replacementTaskId) && (
                            <>
                                <Divider />
                                <Descriptions title="Thông tin thay thế" column={1} bordered size="small">
                                    {selectedComplaint.replacementDeviceId && (
                                        <Descriptions.Item label="Thiết bị thay thế">
                                            #{selectedComplaint.replacementDeviceId} - {selectedComplaint.replacementDeviceSerialNumber || ""}
                                        </Descriptions.Item>
                                    )}
                                    {selectedComplaint.replacementTaskId && (
                                        <Descriptions.Item label="Task đổi máy">
                                            #{selectedComplaint.replacementTaskId}
                                        </Descriptions.Item>
                                    )}
                                    {selectedComplaint.replacementAllocationId && (
                                        <Descriptions.Item label="Allocation mới">
                                            #{selectedComplaint.replacementAllocationId}
                                        </Descriptions.Item>
                                    )}
                                    {selectedComplaint.replacementReportId && (
                                        <Descriptions.Item label="Biên bản đổi máy">
                                            #{selectedComplaint.replacementReportId}
                                        </Descriptions.Item>
                                    )}
                                </Descriptions>
                            </>
                        )}

                        {/* Thời gian xử lý */}
                        {(selectedComplaint.processedAt || selectedComplaint.resolvedAt) && (
                            <>
                                <Divider />
                                <Descriptions title="Thời gian xử lý" column={1} bordered size="small">
                                    {selectedComplaint.processedAt && (
                                        <Descriptions.Item label="Thời gian xử lý">
                                            {formatDateTime(selectedComplaint.processedAt)}
                                        </Descriptions.Item>
                                    )}
                                    {selectedComplaint.resolvedAt && (
                                        <Descriptions.Item label="Thời gian giải quyết">
                                            {formatDateTime(selectedComplaint.resolvedAt)}
                                        </Descriptions.Item>
                                    )}
                                    {selectedComplaint.resolvedByStaffName && (
                                        <Descriptions.Item label="Nhân viên giải quyết">
                                            {selectedComplaint.resolvedByStaffName}
                                        </Descriptions.Item>
                                    )}
                                </Descriptions>
                            </>
                        )}

                        {/* Ảnh bằng chứng */}
                        {selectedComplaint.evidenceUrls && selectedComplaint.evidenceUrls.length > 0 && (
                            <>
                                <Divider />
                                <Title level={5}>Ảnh bằng chứng</Title>
                                <Image.PreviewGroup>
                                    <Space wrap>
                                        {selectedComplaint.evidenceUrls.map((url, index) => (
                                            <Image
                                                key={index}
                                                src={url}
                                                width={120}
                                                height={120}
                                                style={{ objectFit: "cover", borderRadius: 8 }}
                                                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                                            />
                                        ))}
                                    </Space>
                                </Image.PreviewGroup>
                            </>
                        )}

                        {/* Action buttons */}
                        <Divider />
                        <Space>
                            {selectedComplaint.status === "PROCESSING" && (
                                <Button
                                    type="primary"
                                    style={{ background: "#52c41a" }}
                                    icon={<CheckCircleOutlined />}
                                    onClick={() => setResolveModalOpen(true)}
                                >
                                    Đánh dấu đã giải quyết
                                </Button>
                            )}
                            <Button onClick={() => setDrawerOpen(false)}>Đóng</Button>
                        </Space>
                    </div>
                ) : (
                    <Empty description="Không có dữ liệu" />
                )}
            </Drawer>

            {/* Resolve Modal */}
            <Modal
                title="Đánh dấu đã giải quyết"
                open={resolveModalOpen}
                onCancel={() => {
                    setResolveModalOpen(false);
                    resolveForm.resetFields();
                    setEvidenceFiles([]);
                }}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={resolveForm}
                    layout="vertical"
                    onFinish={handleResolveComplaint}
                >
                    <Form.Item
                        name="staffNote"
                        label="Ghi chú giải quyết"
                        rules={[{ required: true, message: "Vui lòng nhập ghi chú giải quyết" }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Nhập ghi chú về cách giải quyết khiếu nại..."
                            maxLength={500}
                            showCount
                        />
                    </Form.Item>

                    {/* Evidence Upload in Resolve Modal */}
                    <Form.Item label="Ảnh bằng chứng (tùy chọn)">
                        <Upload
                            accept="image/*"
                            multiple
                            beforeUpload={(file) => {
                                const isImage = file.type.startsWith('image/');
                                if (!isImage) {
                                    message.error('Chỉ hỗ trợ file ảnh!');
                                    return Upload.LIST_IGNORE;
                                }
                                setEvidenceFiles((prev) => [...prev, file]);
                                return false;
                            }}
                            onRemove={(file) => {
                                setEvidenceFiles((prev) => prev.filter((f) => f.uid !== file.uid));
                            }}
                            fileList={evidenceFiles}
                        >
                            <Button icon={<UploadOutlined />}>Tải ảnh lên</Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                        <Space>
                            <Button onClick={() => {
                                setResolveModalOpen(false);
                                resolveForm.resetFields();
                                setEvidenceFiles([]);
                            }}>
                                Hủy
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={resolvingAction}
                                style={{ background: "#52c41a" }}
                            >
                                Xác nhận giải quyết
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
