
import React from 'react';
import { Modal, Tabs, Tag, Table, Button, Space } from 'antd';
import { getTaskBadgeStatus, getTechnicianStatusColor } from '../../../lib/technicianTaskApi';
import { fmtStatus, getMaintenanceBadgeStatus } from './TechnicianCalendarUtils';
import dayjs from 'dayjs';

const TYPES = {
    QC: { color: "blue", label: "CHECK QC outbound" },
    HANDOVER_CHECK: { color: "geekblue", label: "CHECK BIÊN BẢN" },
    MAINTAIN: { color: "orange", label: "BẢO TRÌ THIẾT BỊ" },
    DELIVERY: { color: "green", label: "ĐI GIAO THIẾT BỊ" },
};

const DailyTasksModal = ({
    open,
    onClose,
    date,
    dayTasks = [],
    dayMaintenance = [], // Combined active + priority
    dayInactive = [],
    taskRulesMap = {},
    onClickTask,
    viewMaintenanceDetail,
    openUpdateStatusModal,
    canUpdateMaintenanceStatus,
    ordersMap = {}
}) => {

    const qcTabsContent = () => {
        const qcTasks = dayTasks.filter(t => {
            // Exclude Delivery (4), Pick up (6), and Device Replacement (8) tasks
            if (t.taskCategoryId === 4 || t.taskCategoryId === 6 || t.taskCategoryId === 8) return false;
            // Additional checks to ensure excluded types
            const type = String(t.type || "").toUpperCase();
            if (['DELIVERY', 'PICKUP'].includes(type)) return false;

            // Include QC tasks
            // Logic copied from original: 
            return ['QC', 'PRE_RENTAL_QC', 'HANDOVER_CHECK'].includes(type) ||
                type.includes('QC') ||
                t.taskCategoryId === 1 || t.taskCategoryId === 2 ||
                t.taskCategoryName === 'Pre rental QC' || t.taskCategoryName === 'Post rental QC';
        });

        const cat1Tasks = dayTasks.filter(t => t.taskCategoryId === 1 || t.taskCategoryName === 'Pre rental QC');
        const cat2Tasks = dayTasks.filter(t => t.taskCategoryId === 2 || t.taskCategoryName === 'Post rental QC');

        const rule1 = taskRulesMap[1];
        const rule2 = taskRulesMap[2];

        return (
            <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    {rule1 && (
                        <div style={{
                            flex: 1,
                            minWidth: 200,
                            background: cat1Tasks.length >= rule1.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            color: '#fff',
                        }}>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>📋 Pre rental QC</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                <strong style={{ fontSize: 18 }}>{cat1Tasks.length} / {rule1.maxTasksPerDay}</strong>
                                <Tag color={cat1Tasks.length >= rule1.maxTasksPerDay ? 'red' : 'green'}>
                                    {cat1Tasks.length >= rule1.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                </Tag>
                            </div>
                        </div>
                    )}
                    {rule2 && (
                        <div style={{
                            flex: 1,
                            minWidth: 200,
                            background: cat2Tasks.length >= rule2.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            color: '#fff',
                        }}>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>📋 Post rental QC</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                <strong style={{ fontSize: 18 }}>{cat2Tasks.length} / {rule2.maxTasksPerDay}</strong>
                                <Tag color={cat2Tasks.length >= rule2.maxTasksPerDay ? 'red' : 'green'}>
                                    {cat2Tasks.length >= rule2.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                </Tag>
                            </div>
                        </div>
                    )}
                </div>
                <Table
                    dataSource={qcTasks}
                    rowKey={(r) => r.id || r.taskId}
                    columns={[
                        { title: 'Task', dataIndex: 'title' },
                        { title: 'Loại', dataIndex: 'type', render: (t, r) => <Tag color={TYPES[t]?.color || 'blue'}>{r.taskCategoryName || TYPES[t]?.label || t}</Tag> },
                        { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={getTaskBadgeStatus(s)}>{fmtStatus(s)}</Tag> },
                        { title: '', render: (r) => <Button onClick={() => onClickTask(r)}>Chi tiết</Button> }
                    ]}
                    pagination={false}
                />
            </>
        );
    };

    const deliveryTabsContent = () => {
        // Include Delivery (4), Pick up (6), and Device Replacement (8) tasks
        const deliveryTasks = dayTasks.filter(t => 
            ['DELIVERY', 'PICKUP'].includes(String(t.type).toUpperCase()) || 
            (t.taskCategoryName || '').includes('Giao') || 
            (t.taskCategoryName || '').includes('Thu') || 
            t.taskCategoryName === 'Delivery' || 
            t.taskCategoryName === 'Pick up rental order' ||
            t.taskCategoryId === 8 ||
            t.taskCategoryName === 'Device Replacement'
        );

        const cat4Tasks = dayTasks.filter(t => t.taskCategoryId === 4 || t.taskCategoryName === 'Delivery');
        const cat6Tasks = dayTasks.filter(t => t.taskCategoryId === 6 || t.taskCategoryName === 'Pick up rental order');

        const rule4 = taskRulesMap[4];
        const rule6 = taskRulesMap[6];

        return (
            <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    {rule4 && (
                        <div style={{
                            flex: 1,
                            minWidth: 200,
                            background: cat4Tasks.length >= rule4.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            color: '#fff',
                        }}>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>🚚 Delivery</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                <strong style={{ fontSize: 18 }}>{cat4Tasks.length} / {rule4.maxTasksPerDay}</strong>
                                <Tag color={cat4Tasks.length >= rule4.maxTasksPerDay ? 'red' : 'green'}>
                                    {cat4Tasks.length >= rule4.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                </Tag>
                            </div>
                        </div>
                    )}
                    {rule6 && (
                        <div style={{
                            flex: 1,
                            minWidth: 200,
                            background: cat6Tasks.length >= rule6.maxTasksPerDay ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            color: '#fff',
                        }}>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>📦 Pick up</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                <strong style={{ fontSize: 18 }}>{cat6Tasks.length} / {rule6.maxTasksPerDay}</strong>
                                <Tag color={cat6Tasks.length >= rule6.maxTasksPerDay ? 'red' : 'green'}>
                                    {cat6Tasks.length >= rule6.maxTasksPerDay ? 'Đạt giới hạn' : 'Còn slot'}
                                </Tag>
                            </div>
                        </div>
                    )}
                </div>
                <Table
                    dataSource={deliveryTasks}
                    rowKey={(r) => r.id || r.taskId}
                    columns={[
                        { title: 'Task', dataIndex: 'title' },
                        { title: 'Thiết bị', dataIndex: 'device' },
                        {
                            title: 'Địa điểm', key: 'address', render: (_, r) => {
                                const addr = ordersMap[r.orderId]?.shippingAddress || r.description || '—';
                                return <span title={addr}>{addr.length > 40 ? (addr.substring(0, 40) + '...') : addr}</span>;
                            }
                        },
                        { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={getTaskBadgeStatus(s)}>{fmtStatus(s)}</Tag> },
                        { title: '', render: (r) => <Button onClick={() => onClickTask(r)}>Chi tiết</Button> }
                    ]}
                    pagination={false}
                />
            </>
        );
    };

    const maintenanceTabsContent = () => {
        // dayMaintenance passed into this component is already sorted by priority in parent?
        // Actually parent sorts prioritySchedules globally, but getCalendarData does filtering.
        // We might need to re-sort or assume parent passed sorted list.
        // TechnicianCalendar logic:
        /*
        const allMaintenance = [...maintenance, ...inactive].sort((a, b) => {
             // ... sorting logic
        });
        */

        // Let's implement sorting here to be safe and consistent
        const allMaintenance = [...dayMaintenance, ...dayInactive];

        const priorityOrder = { 'RENTAL_CONFLICT': 1, 'SCHEDULED_MAINTENANCE': 2, 'USAGE_THRESHOLD': 3 };

        allMaintenance.sort((a, b) => {
            const isAPriority = a.type === 'PRIORITY' ? 0 : 1;
            const isBPriority = b.type === 'PRIORITY' ? 0 : 1;
            if (isAPriority !== isBPriority) return isAPriority - isBPriority;

            const pa = priorityOrder[a.priorityReason] || 99;
            const pb = priorityOrder[b.priorityReason] || 99;
            return pa - pb;
        });

        const getPriorityTag = (item) => {
            const reason = item.priorityReason;
            const config = {
                'RENTAL_CONFLICT': { color: 'red', label: 'Ưu tiên' },
                'SCHEDULED_MAINTENANCE': { color: 'orange', label: 'Bình thường' },
                'USAGE_THRESHOLD': { color: 'blue', label: 'Thấp' },
            };
            const c = config[reason];
            if (c) {
                return <Tag color={c.color}>{c.label}</Tag>;
            }
            return <Tag color="default">—</Tag>;
        };

        return (
            <Table
                dataSource={allMaintenance}
                rowKey="maintenanceScheduleId"
                scroll={{ x: 950 }}
                size="small"
                columns={[
                    {
                        title: 'Thiết bị',
                        width: 200,
                        render: (r) => (
                            <Space>
                                {r.deviceImageUrl && (
                                    <img
                                        src={r.deviceImageUrl}
                                        alt={r.deviceModelName}
                                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                                    />
                                )}
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{r.deviceModelName || '—'}</div>
                                    <div style={{ fontSize: 11, color: '#888' }}>SN: {r.deviceSerialNumber || '—'}</div>
                                </div>
                            </Space>
                        )
                    },
                    {
                        title: 'Ưu tiên', width: 130, render: (r) => getPriorityTag(r)
                    },
                    {
                        title: 'Trạng thái', width: 100, render: (r) => {
                            const status = getMaintenanceBadgeStatus(r);
                            const statusText = {
                                'warning': 'Cần xử lý',
                                'processing': 'Đang thực hiện',
                                'success': 'Đã hoàn thành',
                                'error': 'Quá hạn'
                            };
                            return <Tag color={status}>{statusText[status] || r.status}</Tag>;
                        }
                    },
                    { title: 'Thời gian', width: 100, render: (r) => `${dayjs(r.nextMaintenanceDate).format('DD/MM')} - ${r.nextMaintenanceEndDate ? dayjs(r.nextMaintenanceEndDate).format('DD/MM') : '...'}` },
                    {
                        title: 'Hành động',
                        width: 160,
                        fixed: 'right',
                        render: (r) => (
                            <Space size="small">
                                <Button size="small" onClick={() => viewMaintenanceDetail(r.maintenanceScheduleId)}>Chi tiết</Button>
                                <Button
                                    size="small"
                                    type="primary"
                                    onClick={() => openUpdateStatusModal(r)}
                                    disabled={!canUpdateMaintenanceStatus(r)}
                                >
                                    Bảo trì
                                </Button>
                            </Space>
                        )
                    }
                ]}
                pagination={{ pageSize: 5, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'], hideOnSinglePage: false }}
            />
        );
    };

    return (
        <Modal
            title={`Công việc ngày ${date ? date.format('DD/MM/YYYY') : ''}`}
            open={open}
            onCancel={onClose}
            footer={null}
            width={900}
        >
            <Tabs defaultActiveKey="1" items={[
                {
                    key: '1',
                    label: 'QC / Kiểm tra',
                    children: qcTabsContent()
                },
                {
                    key: '2',
                    label: 'Giao hàng / Thu hồi',
                    children: deliveryTabsContent()
                },
                {
                    key: '3',
                    label: 'Bảo trì',
                    children: maintenanceTabsContent()
                }
            ]} />
        </Modal>
    );
};

export default DailyTasksModal;
