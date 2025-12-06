import React from 'react';
import { Drawer, Descriptions, Button, Tag, Space, Divider, Typography } from 'antd';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const TaskDetailDrawer = ({ isOpen, onClose, task, onUpdate }) => {
    const navigate = useNavigate();

    if (!task) return null;

    const handleAction = () => {
        if (task.type === 'QC_S' || task.type === 'QC_R') {
            navigate(`/technician/qc-detail/${task.orderId}/${task.id}`);
        } else if (task.type === 'DELIVERY' || task.type === 'PICKUP') {
            // Navigate to delivery/pickup logic or show modal
            // For now, maybe just close or show a message
        }
    };

    const getStatusColor = (status) => {
        if (status === 'PENDING') return 'gold';
        if (status === 'IN_PROGRESS' || status === 'STARTED') return 'blue';
        if (status === 'COMPLETED') return 'green';
        if (status === 'FAILED' || status === 'DELAYED') return 'red';
        return 'default';
    };

    return (
        <Drawer
            title={
                <Space>
                    <Tag color={task.type === 'QC_S' ? 'blue' : task.type === 'QC_R' ? 'cyan' : task.type === 'DELIVERY' ? 'orange' : 'green'}>
                        {task.type}
                    </Tag>
                    <span>#{task.id}</span>
                </Space>
            }
            placement="right"
            onClose={onClose}
            open={isOpen}
            width={480}
            extra={
                <Space>
                    <Button onClick={onClose}>Đóng</Button>
                    <Button type="primary" onClick={handleAction}>
                        Chi tiết & Xử lý
                    </Button>
                </Space>
            }
        >
            <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Mô tả">
                    {task.description || task.notes || 'Không có mô tả'}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                    <Tag color={getStatusColor(task.status)}>
                        {task.status}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian">
                    {task.createdAt && format(parseISO(task.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                </Descriptions.Item>
                {task.scheduledDate && (
                    <Descriptions.Item label="Lịch bảo trì">
                        {format(parseISO(task.scheduledDate), "dd/MM/yyyy", { locale: vi })}
                    </Descriptions.Item>
                )}

                {task.device && (
                    <Descriptions.Item label="Thiết bị">
                        {typeof task.device === 'object' ? task.device.name : task.device}
                    </Descriptions.Item>
                )}

                {task.order && (
                    <>
                        <Descriptions.Item label="Đơn hàng">#{task.order.id}</Descriptions.Item>
                        <Descriptions.Item label="Địa chỉ">{task.order.shippingAddress}</Descriptions.Item>
                    </>
                )}
            </Descriptions>

            {task.priorityReason && (
                <>
                    <Divider orientation="left">Thông tin ưu tiên</Divider>
                    <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="Lý do">
                            <Text type={task.priorityReason === 'RENTAL_CONFLICT' ? 'danger' : 'warning'}>
                                {task.priorityReason}
                            </Text>
                        </Descriptions.Item>
                    </Descriptions>
                </>
            )}

        </Drawer>
    );
};

export default TaskDetailDrawer;
