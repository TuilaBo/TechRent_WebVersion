// src/components/CreateScheduleByCategoryModal.jsx
import React, { useState, useEffect } from "react";
import {
    Modal,
    Form,
    Select,
    DatePicker,
    Button,
    Space,
    Alert,
    Typography,
    List,
    Tag,
    Spin,
    Divider,
    Image,
} from "antd";
import { CalendarOutlined, InfoCircleOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { fetchCategories } from "../lib/categoryApi";
import { createMaintenanceScheduleByCategory } from "../lib/maintenanceScheduleApi";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import dayjs from "dayjs";

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function CreateScheduleByCategoryModal({ open, onClose, onSuccess }) {
    const [form] = Form.useForm();
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [dateRange, setDateRange] = useState(null);
    const [durationDays, setDurationDays] = useState(0);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [previewDevices, setPreviewDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    // Load categories when modal opens
    useEffect(() => {
        if (open) {
            loadCategories();
            form.resetFields();
            setDateRange(null);
            setDurationDays(0);
            setSelectedCategoryId(null);
            setPreviewDevices([]);
        }
    }, [open, form]);

    // Calculate duration when date range changes
    useEffect(() => {
        if (dateRange && dateRange[0] && dateRange[1]) {
            const days = dateRange[1].diff(dateRange[0], "day");
            setDurationDays(days);
        } else {
            setDurationDays(0);
        }
    }, [dateRange]);

    // Load devices when category is selected
    useEffect(() => {
        if (selectedCategoryId) {
            loadDevicesByCategory(selectedCategoryId);
        } else {
            setPreviewDevices([]);
        }
    }, [selectedCategoryId]);

    const loadCategories = async () => {
        setLoadingCategories(true);
        try {
            const data = await fetchCategories();
            setCategories(data);
        } catch (err) {
            toast.error("Không thể tải danh sách danh mục");
            console.error("Load categories error:", err);
        } finally {
            setLoadingCategories(false);
        }
    };

    const loadDevicesByCategory = async (categoryId) => {
        setLoadingDevices(true);
        try {
            // Use optimized endpoint to get device models by category
            const response = await api.get(`/api/device-models/by-category/${categoryId}`);
            const deviceModels = response.data?.data || [];
            setPreviewDevices(deviceModels);
        } catch (err) {
            toast.error("Không thể tải danh sách thiết bị");
            console.error("Load devices error:", err);
        } finally {
            setLoadingDevices(false);
        }
    };

    const handleCategoryChange = (value) => {
        setSelectedCategoryId(value);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            const scheduleData = {
                categoryId: values.categoryId,
                startDate: values.dateRange[0].format("YYYY-MM-DD"),
                endDate: values.dateRange[1].format("YYYY-MM-DD"),
                durationDays: durationDays,
                status: "STARTED", // Always STARTED for new schedules
            };

            setSubmitting(true);
            const response = await createMaintenanceScheduleByCategory(scheduleData);

            toast.success(
                response.message ||
                `Đã tạo lịch bảo trì cho danh mục thành công!`
            );

            onSuccess?.();
        } catch (err) {
            if (err.errorFields) {
                // Form validation error - Ant Design handles it
                return;
            }

            const errorMsg = err?.response?.data?.message || "Không thể tạo lịch bảo trì";
            toast.error(errorMsg);
            console.error("Create schedule error:", err);
        } finally {
            setSubmitting(false);
        }
    };

    // Disable dates: today and past dates
    const disabledDate = (current) => {
        // Disable if date is today or before today
        return current && current <= dayjs().endOf("day");
    };

    // Calculate total devices across all models
    const getTotalDevices = () => {
        return previewDevices.reduce((total, model) => total + (model.amountAvailable || 0), 0);
    };

    return (
        <Modal
            title={
                <Space>
                    <CalendarOutlined style={{ color: "#1890ff" }} />
                    <span>Tạo Lịch Bảo Trì Theo Danh Mục</span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Hủy
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={submitting}
                    onClick={handleSubmit}
                >
                    Tạo lịch
                </Button>,
            ]}
            width={700}
            destroyOnClose
        >
            <Alert
                message="Lưu ý"
                description="Lịch bảo trì sẽ được tạo cho TẤT CẢ thiết bị trong danh mục đã chọn với trạng thái 'Đã lên lịch'."
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                style={{ marginBottom: 24 }}
            />

            <Form
                form={form}
                layout="vertical"
            >
                <Form.Item
                    name="categoryId"
                    label="Danh mục thiết bị"
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng chọn danh mục thiết bị",
                        },
                    ]}
                >
                    <Select
                        placeholder="Chọn danh mục thiết bị"
                        loading={loadingCategories}
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                            option.children.toLowerCase().includes(input.toLowerCase())
                        }
                        onChange={handleCategoryChange}
                    >
                        {categories.map((cat) => (
                            <Select.Option key={cat.id} value={cat.id}>
                                {cat.name}
                                {cat.description && (
                                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                        ({cat.description})
                                    </Text>
                                )}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                {/* Device Preview */}
                {selectedCategoryId && (
                    <div style={{ marginBottom: 16 }}>
                        <Divider orientation="left" style={{ margin: "8px 0 12px 0" }}>
                            <Space>
                                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                                <Text strong>Thiết bị sẽ được tạo lịch ({getTotalDevices()} thiết bị)</Text>
                            </Space>
                        </Divider>

                        {loadingDevices ? (
                            <div style={{ textAlign: "center", padding: "20px 0" }}>
                                <Spin tip="Đang tải danh sách thiết bị..." />
                            </div>
                        ) : previewDevices.length > 0 ? (
                            <List
                                size="small"
                                bordered
                                dataSource={previewDevices}
                                style={{ maxHeight: 200, overflow: "auto" }}
                                renderItem={(model) => (
                                    <List.Item>
                                        <Space style={{ width: "100%", justifyContent: "space-between" }}>
                                            <Space size="middle">
                                                {model.imageURL && (
                                                    <Image
                                                        src={model.imageURL}
                                                        alt={model.deviceName}
                                                        width={50}
                                                        height={50}
                                                        style={{
                                                            objectFit: "cover",
                                                            borderRadius: 8,
                                                            border: "1px solid #f0f0f0"
                                                        }}
                                                        preview
                                                    />
                                                )}
                                                <Space direction="vertical" size={0}>
                                                    <Text strong>{model.deviceName}</Text>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        {model.amountAvailable} thiết bị có sẵn
                                                    </Text>
                                                </Space>
                                            </Space>
                                            <Tag color={model.active ? "green" : "red"}>
                                                {model.active ? "Đang hoạt động" : "Ngưng hoạt động"}
                                            </Tag>
                                        </Space>
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <Alert
                                message="Không có thiết bị"
                                description="Danh mục này chưa có model thiết bị nào."
                                type="warning"
                                showIcon
                            />
                        )}
                    </div>
                )}

                <Form.Item
                    name="dateRange"
                    label="Thời gian bảo trì"
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng chọn thời gian bảo trì",
                        },
                        {
                            validator: (_, value) => {
                                if (!value || !value[0] || !value[1]) {
                                    return Promise.resolve();
                                }
                                if (value[1].isBefore(value[0])) {
                                    return Promise.reject("Ngày kết thúc phải sau ngày bắt đầu");
                                }
                                return Promise.resolve();
                            },
                        },
                    ]}
                >
                    <RangePicker
                        style={{ width: "100%" }}
                        format="DD/MM/YYYY"
                        placeholder={["Ngày bắt đầu", "Ngày kết thúc"]}
                        disabledDate={disabledDate}
                        onChange={setDateRange}
                    />
                </Form.Item>

                {durationDays > 0 && (
                    <Alert
                        message={
                            <Space>
                                <Text>Thời gian bảo trì:</Text>
                                <Text strong style={{ color: "#1890ff" }}>
                                    {durationDays} ngày
                                </Text>
                            </Space>
                        }
                        type="success"
                        showIcon={false}
                        style={{ marginBottom: 0 }}
                    />
                )}
            </Form>
        </Modal>
    );
}
