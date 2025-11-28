// src/pages/admin/AdminMaintenanceSchedule.jsx
import React, { useState, useEffect, useRef } from "react";
import {
    Card,
    Table,
    Tag,
    Space,
    Typography,
    Image,
    Button,
    Alert,
    Modal,
} from "antd";
import {
    ReloadOutlined,
    CalendarOutlined,
    ToolOutlined,
    InfoCircleOutlined,
    PlusOutlined,
    EyeOutlined,
    RightOutlined,
    DownOutlined,
} from "@ant-design/icons";
import {
    getActiveMaintenanceSchedules,
    getMaintenanceSchedulesByDevice
} from "../../lib/maintenanceScheduleApi";
import CreateScheduleByCategoryModal from "../../components/CreateScheduleByCategoryModal";
import toast from "react-hot-toast";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function AdminMaintenanceSchedule() {
    const [schedules, setSchedules] = useState([]);
    const [groupedSchedules, setGroupedSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deviceDetailModalOpen, setDeviceDetailModalOpen] = useState(false);
    const [selectedDeviceSchedules, setSelectedDeviceSchedules] = useState([]);
    const [loadingDeviceId, setLoadingDeviceId] = useState(null); // Track which device is loading
    const hasFetched = useRef(false);

    // Group schedules by categoryId + startDate + endDate
    const groupSchedules = (schedules) => {
        const groups = {};

        schedules.forEach(schedule => {
            const categoryId = schedule.device?.deviceModel?.deviceCategory?.deviceCategoryId;
            const categoryName = schedule.device?.deviceModel?.deviceCategory?.deviceCategoryName;
            const key = `${categoryId}_${schedule.startDate}_${schedule.endDate}`;

            if (!groups[key]) {
                groups[key] = {
                    groupId: key,
                    categoryId,
                    categoryName: categoryName || "N/A",
                    startDate: schedule.startDate,
                    endDate: schedule.endDate,
                    devices: [],
                    deviceCount: 0,
                };
            }

            groups[key].devices.push(schedule);
            groups[key].deviceCount++;
        });

        return Object.values(groups);
    };

    const fetchSchedules = async (showToast = false) => {
        setLoading(true);
        setError(null);
        try {
            const response = await getActiveMaintenanceSchedules();
            const rawSchedules = response.data || [];
            setSchedules(rawSchedules);

            const grouped = groupSchedules(rawSchedules);
            setGroupedSchedules(grouped);

            if (showToast) {
                toast.success(response.message || "Tải danh sách bảo trì thành công");
            }
        } catch (err) {
            const errorMsg =
                err?.response?.data?.message || "Không thể tải danh sách bảo trì";
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchSchedules(true);
        }
    }, []);

    const handleViewDeviceDetail = async (deviceId) => {
        setLoadingDeviceId(deviceId); // Set specific device ID as loading
        try {
            const response = await getMaintenanceSchedulesByDevice(deviceId);
            setSelectedDeviceSchedules(response.data || []);
            setDeviceDetailModalOpen(true);
        } catch (err) {
            toast.error("Không thể tải lịch bảo trì của thiết bị");
            console.error("Load device schedules error:", err);
        } finally {
            setLoadingDeviceId(null); // Clear loading state
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "SCHEDULED":
                return "blue";
            case "IN_PROGRESS":
                return "orange";
            case "COMPLETED":
                return "green";
            case "CANCELLED":
                return "red";
            default:
                return "default";
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case "SCHEDULED":
                return "Đã lên lịch";
            case "IN_PROGRESS":
                return "Đang bảo trì";
            case "COMPLETED":
                return "Hoàn thành";
            case "CANCELLED":
                return "Đã hủy";
            default:
                return status;
        }
    };

    const getDeviceStatusColor = (status) => {
        switch (status) {
            case "AVAILABLE":
                return "green";
            case "RENTED":
                return "orange";
            case "MAINTENANCE":
                return "red";
            case "PRE_RENTAL_QC":
                return "blue";
            case "POST_RENTAL_QC":
                return "purple";
            default:
                return "default";
        }
    };

    const getDeviceStatusText = (status) => {
        switch (status) {
            case "AVAILABLE":
                return "Sẵn sàng";
            case "RENTED":
                return "Đang cho thuê";
            case "MAINTENANCE":
                return "Bảo trì";
            case "PRE_RENTAL_QC":
                return "QC trước thuê";
            case "POST_RENTAL_QC":
                return "QC sau thuê";
            default:
                return status;
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(amount);
    };

    // Expanded row: nested device table
    const expandedRowRender = (record) => {
        const deviceColumns = [
            {
                title: "Thiết bị",
                key: "device",
                render: (_, schedule) => {
                    const device = schedule.device;
                    const model = device?.deviceModel;
                    return (
                        <Space>
                            {model?.imageURL && (
                                <Image
                                    src={model.imageURL}
                                    alt={model.deviceName}
                                    width={40}
                                    height={40}
                                    style={{ objectFit: "cover", borderRadius: 6 }}
                                    preview
                                />
                            )}
                            <div>
                                <Text strong style={{ display: "block" }}>
                                    {model?.deviceName}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    SN: {device?.serialNumber}
                                </Text>
                            </div>
                        </Space>
                    );
                },
            },
            {
                title: "Trạng thái thiết bị",
                key: "deviceStatus",
                render: (_, schedule) => (
                    <Tag color={getDeviceStatusColor(schedule.device?.status)}>
                        {getDeviceStatusText(schedule.device?.status)}
                    </Tag>
                ),
            },
            {
                title: "Trạng thái bảo trì",
                key: "maintenanceStatus",
                render: (_, schedule) => (
                    <Tag color={getStatusColor(schedule.status)}>
                        {getStatusText(schedule.status)}
                    </Tag>
                ),
            },
            {
                title: "Giá trị",
                key: "value",
                align: "right",
                render: (_, schedule) => (
                    <Text strong style={{ color: "#52c41a" }}>
                        {formatCurrency(schedule.device?.deviceModel?.deviceValue || 0)}
                    </Text>
                ),
            },
            {
                title: "Hành động",
                key: "actions",
                align: "center",
                render: (_, schedule) => (
                    <Button
                        size="small"
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDeviceDetail(schedule.device?.deviceId)}
                        loading={loadingDeviceId === schedule.device?.deviceId} // Only show loading for this specific device
                    >
                        Chi tiết
                    </Button>
                ),
            },
        ];

        return (
            <Table
                columns={deviceColumns}
                dataSource={record.devices}
                pagination={false}
                size="small"
                rowKey="maintenanceScheduleId"
                bordered
                style={{ margin: "8px 0" }}
            />
        );
    };

    // Main table columns (grouped view)
    const groupColumns = [
        {
            title: "Danh mục thiết bị",
            dataIndex: "categoryName",
            key: "categoryName",
            render: (name) => (
                <Space>
                    <ToolOutlined style={{ color: "#1890ff" }} />
                    <Text strong style={{ fontSize: 14 }}>{name}</Text>
                </Space>
            ),
        },
        {
            title: "Thời gian bảo trì",
            key: "dateRange",
            render: (_, record) => (
                <Space direction="vertical" size="small">
                    <Space>
                        <CalendarOutlined style={{ color: "#1890ff" }} />
                        <Text strong>Bắt đầu:</Text>
                        <Text>{dayjs(record.startDate).format("DD/MM/YYYY")}</Text>
                    </Space>
                    <Space>
                        <CalendarOutlined style={{ color: "#f5222d" }} />
                        <Text strong>Kết thúc:</Text>
                        <Text>{dayjs(record.endDate).format("DD/MM/YYYY")}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Thời gian: {dayjs(record.endDate).diff(dayjs(record.startDate), "day")} ngày
                    </Text>
                </Space>
            ),
        },
        {
            title: "Số thiết bị",
            dataIndex: "deviceCount",
            key: "deviceCount",
            align: "center",
            render: (count) => (
                <Tag color="blue" style={{ fontSize: 14, padding: "4px 12px" }}>
                    {count} thiết bị
                </Tag>
            ),
        },
    ];

    // Device detail modal columns
    const deviceDetailColumns = [
        {
            title: "ID",
            dataIndex: "maintenanceScheduleId",
            key: "id",
            width: 80,
            render: (id) => <Text strong>#{id}</Text>,
        },
        {
            title: "Thời gian",
            key: "dates",
            render: (_, record) => (
                <Space direction="vertical" size="small">
                    <Text>{dayjs(record.startDate).format("DD/MM/YYYY")} - {dayjs(record.endDate).format("DD/MM/YYYY")}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(record.endDate).diff(dayjs(record.startDate), "day")} ngày
                    </Text>
                </Space>
            ),
        },
        {
            title: "Trạng thái",
            dataIndex: "status",
            key: "status",
            render: (status) => (
                <Tag color={getStatusColor(status)} style={{ fontSize: 13 }}>
                    {getStatusText(status)}
                </Tag>
            ),
        },
        {
            title: "Ngày tạo",
            dataIndex: "createdAt",
            key: "createdAt",
            render: (date) => (
                <Text type="secondary">
                    {dayjs(date).format("DD/MM/YYYY HH:mm")}
                </Text>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card
                bordered={false}
                style={{
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
            >
                <Space
                    direction="vertical"
                    size="large"
                    style={{ width: "100%", marginBottom: 24 }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <Space>
                            <ToolOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                            <Title level={3} style={{ margin: 0 }}>
                                Lịch Bảo Trì Thiết Bị
                            </Title>
                        </Space>
                        <Space>
                            <Button
                                type="default"
                                icon={<PlusOutlined />}
                                onClick={() => setIsModalOpen(true)}
                            >
                                Tạo lịch theo Category
                            </Button>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => fetchSchedules(true)}
                                loading={loading}
                            >
                                Làm mới
                            </Button>
                        </Space>
                    </div>

                    {!loading && schedules.length > 0 && (
                        <Alert
                            message={
                                <Space>
                                    <InfoCircleOutlined />
                                    <Text>
                                        Hiện có <Text strong>{schedules.length}</Text> thiết bị trong
                                        lịch bảo trì, được nhóm thành <Text strong>{groupedSchedules.length}</Text> nhóm
                                    </Text>
                                </Space>
                            }
                            type="info"
                            showIcon={false}
                            style={{ borderRadius: 8 }}
                        />
                    )}
                </Space>

                {error && (
                    <Alert
                        message="Lỗi"
                        description={error}
                        type="error"
                        showIcon
                        closable
                        onClose={() => setError(null)}
                        style={{ marginBottom: 16, borderRadius: 8 }}
                    />
                )}

                <Table
                    columns={groupColumns}
                    dataSource={groupedSchedules}
                    rowKey="groupId"
                    loading={loading}
                    expandable={{
                        expandedRowRender,
                        expandIcon: ({ expanded, onExpand, record }) =>
                            expanded ? (
                                <DownOutlined
                                    onClick={(e) => onExpand(record, e)}
                                    style={{ color: "#1890ff", cursor: "pointer" }}
                                />
                            ) : (
                                <RightOutlined
                                    onClick={(e) => onExpand(record, e)}
                                    style={{ color: "#1890ff", cursor: "pointer" }}
                                />
                            ),
                    }}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} nhóm bảo trì`,
                        pageSizeOptions: ["10", "20", "50"],
                    }}
                    bordered
                    style={{
                        borderRadius: 8,
                        overflow: "hidden",
                    }}
                />
            </Card>

            {/* Create Schedule Modal */}
            <CreateScheduleByCategoryModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchSchedules(true);
                }}
            />

            {/* Device Detail Modal */}
            <Modal
                title={
                    <Space>
                        <CalendarOutlined style={{ color: "#1890ff" }} />
                        <span>Lịch Bảo Trì Thiết Bị</span>
                    </Space>
                }
                open={deviceDetailModalOpen}
                onCancel={() => setDeviceDetailModalOpen(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setDeviceDetailModalOpen(false)}>
                        Đóng
                    </Button>,
                ]}
                width={800}
            >
                {selectedDeviceSchedules.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <Space direction="vertical" size="small">
                            <Text strong>Thiết bị: {selectedDeviceSchedules[0]?.device?.deviceModel?.deviceName}</Text>
                            <Text type="secondary">Serial Number: {selectedDeviceSchedules[0]?.device?.serialNumber}</Text>
                        </Space>
                    </div>
                )}

                <Table
                    columns={deviceDetailColumns}
                    dataSource={selectedDeviceSchedules}
                    rowKey="maintenanceScheduleId"
                    pagination={false}
                    size="middle"
                    bordered
                />
            </Modal>
        </div>
    );
}
