
import React, { useMemo } from 'react';
import { Drawer, Descriptions, Divider, Typography, Space, Tag, List, Button, Upload, message } from 'antd';
import {
    InboxOutlined,
    FileTextOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
} from "@ant-design/icons";
import { fmtDateTime, fmtOrderStatus, isPreRentalQC, isPostRentalQC } from './TechnicianCalendarUtils';
import { fmtVND } from '../../../lib/deviceModelsApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Dragger: AntDragger } = Upload;

const TYPES = {
    QC: { color: "blue", label: "CHECK QC outbound" },
    HANDOVER_CHECK: { color: "geekblue", label: "CHECK BIÊN BẢN" },
    MAINTAIN: { color: "orange", label: "BẢO TRÌ THIẾT BỊ" },
    DELIVERY: { color: "green", label: "ĐI GIAO THIẾT BỊ" },
};

const TaskDetailDrawer = ({
    open,
    onClose,
    task,
    orderDetail,
    customerDetail,
    navigate,
    hasQcReportMap,
}) => {
    // HANDOVER_CHECK: upload ảnh bằng chứng (UI only)
    const evidenceProps = {
        beforeUpload: () => false,
        multiple: true,
        accept: ".jpg,.jpeg,.png,.webp,.pdf",
        onChange: () => message.success("Đã thêm bằng chứng (UI)."),
    };

    /** ---- Helper function to render order, customer, and device details ---- */
    const renderOrderCustomerDeviceDetails = (t) => {
        // If orderDetail is not loaded yet, show loading or nothing?
        // Parent ensures orderDetail is fetched before showing drawer typically, or it loads async.
        if (!orderDetail) return null;

        const customerName = customerDetail?.fullName || customerDetail?.username || orderDetail.customerName || "—";
        const customerPhone = customerDetail?.phoneNumber || "";
        const customerEmail = customerDetail?.email || "";
        const address = orderDetail.shippingAddress || t.address || "—";

        return (
            <>
                <Divider />
                <Title level={5} style={{ marginTop: 0 }}>
                    Chi tiết đơn #{orderDetail.orderId || orderDetail.id}
                </Title>
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Trạng thái đơn">
                        {fmtOrderStatus(orderDetail.status || orderDetail.orderStatus)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Khách hàng">
                        <Space direction="vertical" size={0}>
                            <span>{customerName}</span>
                            {customerPhone && (
                                <span>
                                    <PhoneOutlined /> {customerPhone}
                                </span>
                            )}
                            {customerEmail && <span>{customerEmail}</span>}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Địa chỉ giao">
                        <Space>
                            <EnvironmentOutlined />
                            {address}
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời gian thuê">
                        {orderDetail.startDate ? fmtDateTime(orderDetail.startDate) : "—"} →{" "}
                        {orderDetail.endDate ? fmtDateTime(orderDetail.endDate) : "—"}
                    </Descriptions.Item>
                </Descriptions>
                {Array.isArray(orderDetail.orderDetails) && orderDetail.orderDetails.length > 0 && (
                    <>
                        <Divider />
                        <Title level={5} style={{ marginTop: 0 }}>Thiết bị trong đơn</Title>
                        <List
                            size="small"
                            dataSource={orderDetail.orderDetails}
                            renderItem={(d) => (
                                <List.Item>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        {d.deviceModel?.image ? (
                                            <img
                                                src={d.deviceModel.image}
                                                alt={d.deviceModel.name}
                                                style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
                                            />
                                        ) : null}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>
                                                {d.deviceModel?.name || `Model #${d.deviceModelId}`} × {d.quantity}
                                            </div>
                                            {d.deviceModel && (
                                                <div style={{ color: '#667085' }}>
                                                    {d.deviceModel.brand ? `${d.deviceModel.brand} • ` : ''}
                                                    Cọc: {fmtVND((d.deviceModel.deviceValue || 0) * (d.deviceModel.depositPercent || 0))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </>
                )}
            </>
        );
    };

    /** ---- UI phần chi tiết theo loại ---- */
    const renderDetailBody = (t) => {
        if (!t) return null;

        const header = (
            <Space wrap size={8}>
                <Tag color={TYPES[t.type]?.color || "blue"}>{TYPES[t.type]?.label || t.taskCategoryName || t.type}</Tag>
                <Text type="secondary">
                    {fmtDateTime(t.date)} • {t.location || "—"}
                </Text>
                <Tag>{t.assignedBy === "admin" ? "Lịch Admin" : "Operator giao"}</Tag>
            </Space>
        );

        // === QC: chỉ hiển thị thông tin cơ bản + nút Thực hiện QC ===
        const isCompletedQC = String(t.status || "").toUpperCase() === "COMPLETED";

        if (t.type === "QC") {
            return (
                <>
                    {header}
                    <Divider />
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Mã đơn hàng">{t.orderId || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Số lượng">{t.quantity ?? "—"}</Descriptions.Item>
                        <Descriptions.Item label="Thiết bị theo đơn">
                            {Array.isArray(t.devices) ? t.devices.join(", ") : t.device}
                        </Descriptions.Item>
                        <Descriptions.Item label="Hạn chót">
                            {fmtDateTime(t.deadline || t.plannedEnd)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Category">{t.category || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Địa điểm">{t.location || "—"}</Descriptions.Item>
                        {isCompletedQC && (
                            <>
                                <Descriptions.Item label="Thời gian bắt đầu">
                                    {t.plannedStart ? fmtDateTime(t.plannedStart) : "—"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Thời gian kết thúc">
                                    {t.plannedEnd ? fmtDateTime(t.plannedEnd) : "—"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Thời gian hoàn thành">
                                    {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                                </Descriptions.Item>
                            </>
                        )}
                    </Descriptions>
                    <Divider />
                    <Space wrap>
                        {isPreRentalQC(t) && (() => {
                            const taskId = t.taskId || t.id;
                            const hasQcReport = hasQcReportMap[taskId];
                            const status = String(t.status || "").toUpperCase();
                            const buttonLabel =
                                status === "COMPLETED"
                                    ? "Cập nhật QC Report"
                                    : hasQcReport
                                        ? "Cập nhật QC Report"
                                        : "Tạo QC Report";

                            return (
                                <Button
                                    type="primary"
                                    icon={<FileTextOutlined />}
                                    onClick={() => {
                                        navigate(`/technician/tasks/qc/${taskId}`, { state: { task: t } });
                                    }}
                                >
                                    {buttonLabel}
                                </Button>
                            );
                        })()}
                    </Space>

                    {/* Order, Customer, and Device Details Section */}
                    {renderOrderCustomerDeviceDetails(t)}
                </>
            );
        }

        if (t.type === "HANDOVER_CHECK") {
            return (
                <>
                    {header}
                    <Divider />
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Mã đơn">{t.orderId}</Descriptions.Item>
                        <Descriptions.Item label="Thiết bị">{t.device}</Descriptions.Item>
                        <Descriptions.Item label="Khu vực">{t.location}</Descriptions.Item>
                    </Descriptions>
                    <Divider />
                    <Title level={5} style={{ marginTop: 0 }}>
                        Biên bản bàn giao
                    </Title>
                    <List
                        dataSource={t.handovers || []}
                        renderItem={(h) => (
                            <List.Item>
                                <List.Item.Meta
                                    title={
                                        <Space>
                                            <Text strong>{h.name}</Text>
                                            <Tag color={h.status === "đã ký" ? "green" : "gold"}>
                                                {h.status.toUpperCase()}
                                            </Tag>
                                        </Space>
                                    }
                                    description={
                                        h.url ? (
                                            <a href={h.url} target="_blank" rel="noreferrer">
                                                Xem chi tiết
                                            </a>
                                        ) : (
                                            <Text type="secondary">Chưa có tệp đính kèm</Text>
                                        )
                                    }
                                />
                            </List.Item>
                        )}
                    />
                    <Divider />
                    <Title level={5} style={{ marginTop: 0 }}>
                        Thêm ảnh/biên bản chứng minh (UI)
                    </Title>
                    <AntDragger {...evidenceProps}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p>Kéo thả hoặc bấm để chọn</p>
                    </AntDragger>

                    {/* Order, Customer, and Device Details Section */}
                    {renderOrderCustomerDeviceDetails(t)}
                </>
            );
        }

        if (t.type === "MAINTAIN") {
            const next = t.lastMaintainedAt ? dayjs(t.lastMaintainedAt).add(t.cycleDays || 30, "day") : null;
            return (
                <>
                    {header}
                    <Divider />
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                        <Descriptions.Item label="Thiết bị">{t.device}</Descriptions.Item>
                        <Descriptions.Item label="Category">{t.category}</Descriptions.Item>
                        <Descriptions.Item label="Địa điểm">{t.location}</Descriptions.Item>
                        <Descriptions.Item label="Lần bảo trì gần nhất">
                            {fmtDateTime(t.lastMaintainedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Chu kỳ">
                            {t.cycleDays ? `${t.cycleDays} ngày` : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Dự kiến lần kế tiếp">
                            {next ? fmtDateTime(next) : "—"}
                        </Descriptions.Item>
                    </Descriptions>
                    <Divider />
                    <Text type="secondary">
                        *Lịch bảo trì do Admin lập theo category. Kỹ thuật viên cập nhật kết quả sau khi hoàn tất.
                    </Text>
                </>
            );
        }

        // For DELIVERY, PICKUP etc.
        // Simplified fallback for other types
        return (
            <>
                {header}
                <Divider />
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Mã nhiệm vụ">{t.taskId || t.id || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Mô tả">{t.description || t.title}</Descriptions.Item>
                    <Descriptions.Item label="Địa điểm">{t.location || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Hạn chót">{fmtDateTime(t.plannedEnd || t.deadline)}</Descriptions.Item>
                </Descriptions>
                {/* Order, Customer, and Device Details Section */}
                {renderOrderCustomerDeviceDetails(t)}
            </>
        )
    };

    return (
        <Drawer
            title={task ? task.title || task.taskCategoryName || "Chi tiết công việc" : "Chi tiết công việc"}
            open={open}
            onClose={onClose}
            width={720}
        >
            {renderDetailBody(task)}
        </Drawer>
    );
};

export default TaskDetailDrawer;
