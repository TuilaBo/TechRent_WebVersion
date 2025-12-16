// src/pages/technician/TechnicianCalendarComponents/ReplacementResolveButton.jsx
import React, { useState } from "react";
import { Button, Modal, Input, Space, Typography } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { resolveComplaint } from "../../../lib/complaints";

const { Text } = Typography;
const { TextArea } = Input;

/**
 * Button component to resolve/complete a device replacement complaint
 * Only shown when replacement report status is BOTH_SIGNED
 * 
 * @param {Object} props
 * @param {number} props.complaintId - The complaint ID to resolve
 * @param {function} props.onResolveSuccess - Callback after successful resolution
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {boolean} props.alreadyResolved - Whether already resolved
 */
export default function ReplacementResolveButton({
    complaintId,
    onResolveSuccess,
    disabled = false,
    alreadyResolved = false,
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [staffNote, setStaffNote] = useState("");
    const [resolving, setResolving] = useState(false);

    const handleOpenModal = () => {
        setStaffNote("");
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setStaffNote("");
    };

    const handleResolve = async () => {
        if (!complaintId) {
            toast.error("Không tìm thấy ID khiếu nại.");
            return;
        }

        if (!staffNote.trim()) {
            toast.error("Vui lòng nhập ghi chú hoàn thành.");
            return;
        }

        try {
            setResolving(true);

            // Call resolve API without evidenceFiles (user requirement)
            await resolveComplaint(complaintId, {
                staffNote: staffNote.trim(),
                evidenceFiles: [], // Not required per user specification
            });

            toast.success("Hoàn thành thay thế thiết bị thành công!");
            handleCloseModal();

            // Callback to parent
            if (onResolveSuccess) {
                onResolveSuccess();
            }
        } catch (error) {
            const errorMessage =
                error?.response?.data?.message ||
                error?.message ||
                "Không thể hoàn thành thay thế thiết bị";
            toast.error(errorMessage);
        } finally {
            setResolving(false);
        }
    };

    // If already resolved, show success tag
    if (alreadyResolved) {
        return (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Text type="success" style={{ fontSize: 14 }}>
                    <CheckCircleOutlined style={{ marginRight: 8 }} />
                    Task đã được hoàn thành
                </Text>
            </div>
        );
    }

    return (
        <>
            <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleOpenModal}
                disabled={disabled || !complaintId}
                style={{ marginTop: 16 }}
                size="large"
            >
                Hoàn thành thay thế thiết bị
            </Button>

            <Modal
                title="Hoàn thành thay thế thiết bị"
                open={modalOpen}
                onCancel={handleCloseModal}
                footer={[
                    <Button key="cancel" onClick={handleCloseModal}>
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={resolving}
                        onClick={handleResolve}
                        disabled={!staffNote.trim()}
                    >
                        Xác nhận hoàn thành
                    </Button>,
                ]}
                destroyOnClose
            >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Text>
                        Xác nhận hoàn thành quá trình thay thế thiết bị.
                        Vui lòng nhập ghi chú mô tả kết quả thay thế:
                    </Text>
                    <TextArea
                        placeholder="Nhập ghi chú hoàn thành (bắt buộc)..."
                        value={staffNote}
                        onChange={(e) => setStaffNote(e.target.value)}
                        rows={4}
                        maxLength={500}
                        showCount
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        * Khiếu nại sẽ được đánh dấu là đã giải quyết và task sẽ tự động hoàn thành.
                    </Text>
                </Space>
            </Modal>
        </>
    );
}
