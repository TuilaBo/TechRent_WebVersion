// src/pages/technician/TechnicianMaintenance.jsx
import React, { useState, useEffect, useRef } from "react";
import {
    Card,
    Table,
    Tag,
    Space,
    Button,
    Select,
    DatePicker,
    Alert,
    Typography,
} from "antd";
import {
    ReloadOutlined,
    ToolOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getPriorityMaintenanceSchedules } from "../../lib/maintenanceScheduleApi";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function TechnicianMaintenance() {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [dateRange, setDateRange] = useState(null);
    const hasFetchedRef = useRef(false);

    // Fetch maintenance schedules
    const fetchSchedules = async (showToast = false) => {
        setLoading(true);
        try {
            const response = await getPriorityMaintenanceSchedules();
            const data = response?.data?.data || response?.data || [];
            console.log("Loaded maintenance schedules:", data.length);

            setSchedules(data);

            if (showToast) {
                toast.success(`Tải thành công ${data.length} lịch bảo trì`);
            }
        } catch (error) {
            console.error("Failed to load maintenance schedules:", error);
            toast.error(error?.response?.data?.message || "Không thể tải lịch bảo trì");
            setSchedules([]);
        } finally {
            setLoading(false);
        }
    };

    // Load on mount 
    useEffect(() => {
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchSchedules();
        }
    }, []);

    // Filter schedules
    const filteredSchedules = schedules.filter((schedule) => {
        // Status filter (using priorityReason)
        if (filterStatus !== "ALL" && schedule.priorityReason?.toUpperCase() !== filterStatus) {
            return false;
        }

        // Date filter
        if (dateRange && dateRange[0] && dateRange[1]) {
            const maintenanceDate = dayjs(schedule.nextMaintenanceDate);
            const filterStart = dateRange[0];
            const filterEnd = dateRange[1];

            if (maintenanceDate.isBefore(filterStart, 'day') || maintenanceDate.isAfter(filterEnd, 'day')) {
                return false;
            }
        }

        return true;
    });

    // Table columns matching actual API response
    const columns = [
        {
            title: "Thiết bị",
            key: "device",
            width: 250,
            render: (_, record) => {
                const deviceName = record.deviceModelName || "N/A";
                const serialNumber = record.deviceSerialNumber || "N/A";

                return (
                    <Space direction="vertical" size={0}>
                        <Text strong>{deviceName}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            SN: {serialNumber}
                        </Text>
                    </Space>
                );
            },
        },
        {
            title: "Danh mục",
            key: "category",
            width: 150,
            render: (_, record) => {
                const categoryName = record.deviceCategoryName || "N/A";
                return <Text>{categoryName}</Text>;
            },
        },
        {
            title: "Ngày bảo trì",
            key: "maintenanceDate",
            width: 130,
            render: (_, record) => {
                const date = record.nextMaintenanceDate
                    ? dayjs(record.nextMaintenanceDate).format("DD/MM/YYYY")
                    : "N/A";
                return <Text>{date}</Text>;
            },
            sorter: (a, b) => {
                const aDate = a.nextMaintenanceDate ? dayjs(a.nextMaintenanceDate) : dayjs(0);
                const bDate = b.nextMaintenanceDate ? dayjs(b.nextMaintenanceDate) : dayjs(0);
                return aDate.valueOf() - bDate.valueOf();
            },
        },
        {
            title: "Lý do ưu tiên",
            key: "priorityReason",
            width: 160,
            render: (_, record) => {
                const reason = record.priorityReason || "N/A";
                const color = reason === "SCHEDULED_MAINTENANCE" ? "blue" : "orange";
                const text = reason === "SCHEDULED_MAINTENANCE" ? "Bảo trì định kỳ" : reason;
                return <Tag color={color}>{text}</Tag>;
            },
        },
        {
            title: "Mức độ sử dụng",
            key: "usageCount",
            width: 150,
            render: (_, record) => {
                const current = record.currentUsageCount ?? 0;
                const required = record.requiredUsageCount;
                return (
                    <Text>
                        {current} {required ? `/ ${required}` : ""} lần
                    </Text>
                );
            },
        },
        {
            title: "ID Lịch",
            key: "scheduleId",
            width: 100,
            render: (_, record) => (
                <Text type="secondary">#{record.maintenanceScheduleId}</Text>
            ),
        },
    ];

    return (
        <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <ToolOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                <Title level={3} style={{ margin: 0 }}>
                    Lịch Bảo Trì Thiết Bị
                </Title>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={() => fetchSchedules(true)}
                    loading={loading}
                >
                    Làm mới
                </Button>
            </div>

            {schedules.length > 0 && (
                <Alert
                    message={`Tổng cộng: ${filteredSchedules.length} lịch bảo trì`}
                    type="info"
                    showIcon
                    icon={<CalendarOutlined />}
                    style={{ marginBottom: 16 }}
                />
            )}

            <Space style={{ marginBottom: 16 }} wrap>
                <span>Lọc lý do:</span>
                <Select
                    style={{ width: 200 }}
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                        { label: "Tất cả", value: "ALL" },
                        { label: "Bảo trì định kỳ", value: "SCHEDULED_MAINTENANCE" },
                    ]}
                />

                <span>Lọc thời gian:</span>
                <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    format="DD/MM/YYYY"
                    placeholder={["Từ ngày", "Đến ngày"]}
                    style={{ width: 280 }}
                />

                {(filterStatus !== "ALL" || dateRange) && (
                    <Button
                        onClick={() => {
                            setFilterStatus("ALL");
                            setDateRange(null);
                        }}
                    >
                        Xóa bộ lọc
                    </Button>
                )}
            </Space>

            <Card>
                <Table
                    rowKey={(record) => record.maintenanceScheduleId || record.deviceId}
                    loading={loading}
                    columns={columns}
                    dataSource={filteredSchedules}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} lịch`,
                    }}
                    locale={{
                        emptyText: "Không có lịch bảo trì nào",
                    }}
                />
            </Card>
        </>
    );
}
