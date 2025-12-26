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
    Dropdown,
    Form,
    DatePicker,
    InputNumber,
    Select,
    Popconfirm,
    Tabs,
    Descriptions,
    Spin,
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
    DeleteOutlined,
} from "@ant-design/icons";
import {
    getActiveMaintenanceSchedules,
    getMaintenanceSchedulesByDevice,
    createMaintenanceScheduleByDevice,
    deleteMaintenanceSchedule
} from "../../lib/maintenanceScheduleApi";
import {
    getInactiveMaintenanceSchedules,
    getMaintenanceScheduleById
} from "../../lib/maintenanceApi";
import { api } from "../../lib/api";
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
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [deviceForm] = Form.useForm();
    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [creatingByDevice, setCreatingByDevice] = useState(false);
    const [activeTab, setActiveTab] = useState("active"); // "active" or "inactive"
    const [inactiveSchedules, setInactiveSchedules] = useState([]);
    const [groupedInactiveSchedules, setGroupedInactiveSchedules] = useState([]);
    const [loadingInactive, setLoadingInactive] = useState(false);
    const [scheduleDetailModalOpen, setScheduleDetailModalOpen] = useState(false);
    const [selectedScheduleDetail, setSelectedScheduleDetail] = useState(null);
    const [loadingScheduleDetail, setLoadingScheduleDetail] = useState(false);
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

    // Fetch inactive schedules
    const fetchInactiveSchedules = async (showToast = false) => {
        setLoadingInactive(true);
        try {
            const response = await getInactiveMaintenanceSchedules();
            const rawSchedules = response.data || response || [];
            setInactiveSchedules(rawSchedules);

            const grouped = groupSchedules(rawSchedules);
            setGroupedInactiveSchedules(grouped);

            if (showToast) {
                toast.success("Tải danh sách lịch không hoạt động thành công");
            }
        } catch (err) {
            const errorMsg =
                err?.response?.data?.message || "Không thể tải danh sách lịch không hoạt động";
            toast.error(errorMsg);
        } finally {
            setLoadingInactive(false);
        }
    };

    // View schedule detail by ID
    const handleViewScheduleDetail = async (scheduleId) => {
        setLoadingScheduleDetail(true);
        setScheduleDetailModalOpen(true);
        setSelectedScheduleDetail(null);
        try {
            const response = await getMaintenanceScheduleById(scheduleId);
            const data = response.data || response || null;
            setSelectedScheduleDetail(data);
        } catch (err) {
            toast.error("Không thể tải chi tiết lịch bảo trì");
            console.error("Load schedule detail error:", err);
        } finally {
            setLoadingScheduleDetail(false);
        }
    };

    // Handle tab change
    const handleTabChange = (key) => {
        setActiveTab(key);
        if (key === "inactive" && inactiveSchedules.length === 0) {
            fetchInactiveSchedules(true);
        }
    };

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
                width: 180,
                render: (_, schedule) => (
                    <Space size="small">
                        <Button
                            size="small"
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewDeviceDetail(schedule.device?.deviceId)}
                            loading={loadingDeviceId === schedule.device?.deviceId}
                        >
                            Chi tiết
                        </Button>
                        <Popconfirm
                            title="Xóa lịch bảo trì"
                            description="Bạn có chắc muốn xóa lịch bảo trì này?"
                            onConfirm={async () => {
                                try {
                                    await deleteMaintenanceSchedule(schedule.maintenanceScheduleId);
                                    toast.success("Xóa lịch bảo trì thành công");
                                    fetchSchedules(true);
                                } catch (err) {
                                    toast.error(err?.response?.data?.message || "Không thể xóa lịch bảo trì");
                                }
                            }}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button
                                size="small"
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                            >
                                Xóa
                            </Button>
                        </Popconfirm>
                    </Space>
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
                            <Dropdown
                                menu={{
                                    items: [
                                        {
                                            key: 'by-category',
                                            label: 'Theo danh mục',
                                            onClick: () => setIsModalOpen(true),
                                        },
                                        {
                                            key: 'by-device',
                                            label: 'Theo thiết bị',
                                            onClick: async () => {
                                                setIsDeviceModalOpen(true);
                                                setLoadingDevices(true);
                                                try {
                                                    const res = await api.get('/api/devices');
                                                    const list = res.data?.data || res.data || [];
                                                    setDevices(list.filter(d => d.status === 'AVAILABLE'));
                                                } catch (e) {
                                                    toast.error('Không thể tải danh sách thiết bị');
                                                } finally {
                                                    setLoadingDevices(false);
                                                }
                                            },
                                        },
                                    ],
                                }}
                            >
                                <Button type="default" icon={<PlusOutlined />}>
                                    Tạo lịch bảo trì <DownOutlined />
                                </Button>
                            </Dropdown>
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

                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={[
                        {
                            key: "active",
                            label: (
                                <Space>
                                    <ToolOutlined />
                                    <span>Đang hoạt động ({schedules.length})</span>
                                </Space>
                            ),
                            children: (
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
                            ),
                        },
                        {
                            key: "inactive",
                            label: (
                                <Space>
                                    <InfoCircleOutlined />
                                    <span>Không hoạt động ({inactiveSchedules.length})</span>
                                </Space>
                            ),
                            children: (
                                <>
                                    <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={() => fetchInactiveSchedules(true)}
                                            loading={loadingInactive}
                                        >
                                            Tải lại
                                        </Button>
                                    </div>
                                    <Table
                                        columns={[
                                            ...groupColumns,
                                            {
                                                title: "Trạng thái",
                                                key: "status",
                                                width: 150,
                                                render: (_, record) => {
                                                    // Get first device's status for display
                                                    const firstDevice = record.devices?.[0];
                                                    const status = firstDevice?.status;
                                                    return (
                                                        <Tag color={getStatusColor(status)}>
                                                            {getStatusText(status)}
                                                        </Tag>
                                                    );
                                                },
                                            },
                                        ]}
                                        dataSource={groupedInactiveSchedules}
                                        rowKey="groupId"
                                        loading={loadingInactive}
                                        expandable={{
                                            expandedRowRender: (record) => {
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
                                                        title: "Trạng thái bảo trì",
                                                        key: "maintenanceStatus",
                                                        render: (_, schedule) => (
                                                            <Tag color={getStatusColor(schedule.status)}>
                                                                {getStatusText(schedule.status)}
                                                            </Tag>
                                                        ),
                                                    },
                                                    {
                                                        title: "Hành động",
                                                        key: "actions",
                                                        align: "center",
                                                        width: 120,
                                                        render: (_, schedule) => (
                                                            <Button
                                                                size="small"
                                                                type="link"
                                                                icon={<EyeOutlined />}
                                                                onClick={() => handleViewScheduleDetail(schedule.maintenanceScheduleId)}
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
                                            },
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
                                            showTotal: (total) => `Tổng ${total} nhóm`,
                                            pageSizeOptions: ["10", "20", "50"],
                                        }}
                                        bordered
                                        style={{
                                            borderRadius: 8,
                                            overflow: "hidden",
                                        }}
                                    />
                                </>
                            ),
                        },
                    ]}
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

            {/* Create By Device Modal */}
            <Modal
                title="Tạo lịch bảo trì theo thiết bị"
                open={isDeviceModalOpen}
                onCancel={() => {
                    setIsDeviceModalOpen(false);
                    deviceForm.resetFields();
                }}
                onOk={async () => {
                    try {
                        const values = await deviceForm.validateFields();
                        setCreatingByDevice(true);
                        await createMaintenanceScheduleByDevice({
                            deviceId: values.deviceId,
                            startDate: values.dateRange[0].format('YYYY-MM-DD'),
                            endDate: values.dateRange[1].format('YYYY-MM-DD'),
                            status: 'STARTED',
                        });
                        toast.success('Tạo lịch bảo trì thành công!');
                        setIsDeviceModalOpen(false);
                        deviceForm.resetFields();
                        fetchSchedules(true);
                    } catch (e) {
                        toast.error(e?.response?.data?.message || 'Không thể tạo lịch bảo trì');
                    } finally {
                        setCreatingByDevice(false);
                    }
                }}
                confirmLoading={creatingByDevice}
                okText="Tạo lịch"
                cancelText="Hủy"
            >
                <Form form={deviceForm} layout="vertical">
                    <Form.Item
                        name="deviceId"
                        label="Chọn thiết bị"
                        rules={[{ required: true, message: 'Vui lòng chọn thiết bị' }]}
                    >
                        <Select
                            placeholder="Chọn thiết bị"
                            loading={loadingDevices}
                            showSearch
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={devices.map(d => ({
                                value: d.deviceId,
                                label: `${d.deviceModel?.deviceName || 'N/A'} - SN: ${d.serialNumber}`,
                            }))}
                        />
                    </Form.Item>
                    <Form.Item
                        name="dateRange"
                        label="Thời gian bảo trì"
                        rules={[{ required: true, message: 'Vui lòng chọn thời gian' }]}
                    >
                        <DatePicker.RangePicker
                            style={{ width: '100%' }}
                            format="DD/MM/YYYY"
                            disabledDate={(current) => current && current < dayjs().startOf('day')}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Schedule Detail Modal */}
            <Modal
                title={
                    <Space>
                        <InfoCircleOutlined style={{ color: "#1890ff" }} />
                        <span>Chi tiết lịch bảo trì #{selectedScheduleDetail?.maintenanceScheduleId || "—"}</span>
                    </Space>
                }
                open={scheduleDetailModalOpen}
                onCancel={() => {
                    setScheduleDetailModalOpen(false);
                    setSelectedScheduleDetail(null);
                }}
                footer={[
                    <Button key="close" type="primary" onClick={() => {
                        setScheduleDetailModalOpen(false);
                        setSelectedScheduleDetail(null);
                    }}>
                        Đóng
                    </Button>,
                ]}
                width={700}
            >
                {loadingScheduleDetail ? (
                    <div style={{ textAlign: "center", padding: 40 }}>
                        <Spin size="large" />
                    </div>
                ) : selectedScheduleDetail ? (
                    <div>
                        <Descriptions bordered column={2} size="small">
                            <Descriptions.Item label="ID lịch bảo trì" span={2}>
                                <Text strong>#{selectedScheduleDetail.maintenanceScheduleId}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thiết bị" span={2}>
                                <Space>
                                    {selectedScheduleDetail.device?.deviceModel?.imageURL && (
                                        <Image
                                            src={selectedScheduleDetail.device.deviceModel.imageURL}
                                            alt={selectedScheduleDetail.device.deviceModel.deviceName}
                                            width={60}
                                            height={60}
                                            style={{ objectFit: "cover", borderRadius: 6 }}
                                            preview
                                        />
                                    )}
                                    <div>
                                        <Text strong style={{ display: "block", fontSize: 14 }}>
                                            {selectedScheduleDetail.device?.deviceModel?.deviceName || "—"}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            SN: {selectedScheduleDetail.device?.serialNumber || "—"}
                                        </Text>
                                        {selectedScheduleDetail.device?.deviceModel?.brand && (
                                            <div>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    Hãng: {selectedScheduleDetail.device.deviceModel.brand.brandName}
                                                </Text>
                                            </div>
                                        )}
                                    </div>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Danh mục">
                                {selectedScheduleDetail.device?.deviceModel?.deviceCategory?.deviceCategoryName || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái thiết bị">
                                <Tag color={getDeviceStatusColor(selectedScheduleDetail.device?.status)}>
                                    {getDeviceStatusText(selectedScheduleDetail.device?.status)}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thời gian bắt đầu">
                                {selectedScheduleDetail.startDate
                                    ? dayjs(selectedScheduleDetail.startDate).format("DD/MM/YYYY")
                                    : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Thời gian kết thúc">
                                {selectedScheduleDetail.endDate
                                    ? dayjs(selectedScheduleDetail.endDate).format("DD/MM/YYYY")
                                    : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Thời lượng">
                                {selectedScheduleDetail.startDate && selectedScheduleDetail.endDate
                                    ? `${dayjs(selectedScheduleDetail.endDate).diff(dayjs(selectedScheduleDetail.startDate), "day")} ngày`
                                    : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái bảo trì">
                                <Tag color={getStatusColor(selectedScheduleDetail.status)}>
                                    {getStatusText(selectedScheduleDetail.status)}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Giá trị thiết bị">
                                <Text strong style={{ color: "#52c41a" }}>
                                    {formatCurrency(selectedScheduleDetail.device?.deviceModel?.deviceValue || 0)}
                                </Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Giá thuê/ngày">
                                <Text strong style={{ color: "#1890ff" }}>
                                    {formatCurrency(selectedScheduleDetail.device?.deviceModel?.pricePerDay || 0)}
                                </Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tỷ lệ đặt cọc">
                                {selectedScheduleDetail.device?.deviceModel?.depositPercent
                                    ? `${(selectedScheduleDetail.device.deviceModel.depositPercent * 100).toFixed(0)}%`
                                    : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày nhập thiết bị">
                                {selectedScheduleDetail.device?.acquireAt
                                    ? dayjs(selectedScheduleDetail.device.acquireAt).format("DD/MM/YYYY HH:mm")
                                    : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo">
                                {selectedScheduleDetail.createdAt
                                    ? dayjs(selectedScheduleDetail.createdAt).format("DD/MM/YYYY HH:mm")
                                    : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày cập nhật">
                                {selectedScheduleDetail.updatedAt
                                    ? dayjs(selectedScheduleDetail.updatedAt).format("DD/MM/YYYY HH:mm")
                                    : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Người cập nhật" span={2}>
                                {selectedScheduleDetail.updatedBy || "—"}
                            </Descriptions.Item>
                        </Descriptions>

                        {/* Evidence Images */}
                        {selectedScheduleDetail.evidenceUrls && selectedScheduleDetail.evidenceUrls.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: "block", marginBottom: 12 }}>
                                    Ảnh bằng chứng bảo trì ({selectedScheduleDetail.evidenceUrls.length} ảnh)
                                </Text>
                                <Image.PreviewGroup>
                                    <Space wrap>
                                        {selectedScheduleDetail.evidenceUrls.map((url, index) => (
                                            <Image
                                                key={index}
                                                src={url}
                                                alt={`Evidence ${index + 1}`}
                                                width={120}
                                                height={120}
                                                style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #e8e8e8" }}
                                            />
                                        ))}
                                    </Space>
                                </Image.PreviewGroup>
                            </div>
                        )}
                    </div>
                ) : (
                    <Alert message="Không tìm thấy thông tin lịch bảo trì" type="warning" showIcon />
                )}
            </Modal>
        </div>
    );
}
