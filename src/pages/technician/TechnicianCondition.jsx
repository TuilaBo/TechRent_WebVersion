// src/pages/technician/TechnicianCondition.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Select,
  Input,
  Upload,
  Tag,
  Typography,
  Image,
  Spin,
  Descriptions,
} from "antd";
import { EditOutlined, EyeOutlined, InboxOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { listDevices } from "../../lib/deviceManage";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getDeviceConditions, updateDeviceConditions, getConditionDefinitions } from "../../lib/condition";
import dayjs from "dayjs";

const { Title, Text } = Typography;

// Helper: convert File -> base64 data URL
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function TechnicianCondition() {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceConditions, setDeviceConditions] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [conditionDefinitions, setConditionDefinitions] = useState([]);
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [modelNameMap, setModelNameMap] = useState({}); // Map: deviceModelId -> deviceModelName
  const [filterStatus, setFilterStatus] = useState(undefined); // Filter by status
  const [filterModelId, setFilterModelId] = useState(undefined); // Filter by deviceModelId

  // Load all devices and their models
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true);
        const devicesData = await listDevices();
        const devicesArray = Array.isArray(devicesData) ? devicesData : [];
        setDevices(devicesArray);

        // Load device models for all unique deviceModelIds
        const uniqueModelIds = new Set();
        devicesArray.forEach((device) => {
          const modelId = device.deviceModelId || device.modelId;
          if (modelId) {
            uniqueModelIds.add(Number(modelId));
          }
        });

        // Load all device models concurrently
        const modelPromises = Array.from(uniqueModelIds).map(async (modelId) => {
          try {
            const model = await getDeviceModelById(modelId);
            return {
              modelId,
              name: model?.deviceName || model?.name || `Model #${modelId}`,
            };
          } catch (error) {
            console.warn(`Failed to load model ${modelId}:`, error);
            return {
              modelId,
              name: `Model #${modelId}`,
            };
          }
        });

        const modelResults = await Promise.all(modelPromises);
        const nameMap = {};
        modelResults.forEach(({ modelId, name }) => {
          nameMap[modelId] = name;
        });
        setModelNameMap(nameMap);
      } catch (error) {
        toast.error(error?.message || "Không thể tải danh sách thiết bị");
      } finally {
        setLoading(false);
      }
    };
    loadDevices();
  }, []);

  // Load condition definitions when device is selected
  useEffect(() => {
    const loadDefinitions = async () => {
      if (!selectedDevice?.deviceModelId) {
        setConditionDefinitions([]);
        return;
      }

      try {
        setLoadingDefinitions(true);
        const definitions = await getConditionDefinitions({
          deviceModelId: selectedDevice.deviceModelId,
        });
        setConditionDefinitions(Array.isArray(definitions) ? definitions : []);
      } catch (error) {
        console.error("Error loading condition definitions:", error);
        setConditionDefinitions([]);
      } finally {
        setLoadingDefinitions(false);
      }
    };

    loadDefinitions();
  }, [selectedDevice]);

  // Load device conditions when viewing/updating
  const loadDeviceConditions = async (deviceId) => {
    try {
      setLoadingConditions(true);
      const conditionsData = await getDeviceConditions(deviceId);
      
      // API trả về: { data: [...] } hoặc array trực tiếp
      let conditionsArray = [];
      if (Array.isArray(conditionsData)) {
        conditionsArray = conditionsData;
      } else if (conditionsData && Array.isArray(conditionsData.data)) {
        conditionsArray = conditionsData.data;
      }
      
      setDeviceConditions(conditionsArray);
      return conditionsArray;
    } catch (error) {
      console.error("Error loading device conditions:", error);
      toast.error(error?.message || "Không thể tải tình trạng thiết bị");
      setDeviceConditions([]);
      return [];
    } finally {
      setLoadingConditions(false);
    }
  };

  // Handle view device conditions
  const handleViewConditions = async (device) => {
    setSelectedDevice(device);
    setViewModalOpen(true);
    await loadDeviceConditions(device.deviceId || device.id);
  };

  // Handle update device conditions
  const handleUpdateConditions = async (device) => {
    setSelectedDevice(device);
    setUpdateModalOpen(true);
    const conditions = await loadDeviceConditions(device.deviceId || device.id);
    
    // Initialize form with existing conditions or empty
    if (conditions.length > 0) {
      const latestCondition = conditions.sort((a, b) => {
        const timeA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
        const timeB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
        return timeB - timeA;
      })[0];
      
      form.setFieldsValue({
        conditions: [
          {
            conditionDefinitionId: latestCondition.conditionDefinitionId,
            severity: latestCondition.severity || "NONE",
            note: latestCondition.note || "",
            images: latestCondition.images || [],
          },
        ],
      });
    } else {
      form.setFieldsValue({
        conditions: [
          {
            conditionDefinitionId: undefined,
            severity: "NONE",
            note: "",
            images: [],
          },
        ],
      });
    }
  };

  // Filter devices based on status and model
  const filteredDevices = useMemo(() => {
    let filtered = Array.isArray(devices) ? devices.slice() : [];
    
    if (filterStatus) {
      filtered = filtered.filter((d) => {
        const status = String(d.status || "").toUpperCase();
        return status === String(filterStatus).toUpperCase();
      });
    }
    
    if (filterModelId) {
      filtered = filtered.filter((d) => {
        const modelId = Number(d.deviceModelId || d.modelId || 0);
        return modelId === Number(filterModelId);
      });
    }
    
    return filtered;
  }, [devices, filterStatus, filterModelId]);

  // Get model options for filter
  const modelOptions = useMemo(() => {
    const uniqueModelIds = new Set();
    devices.forEach((device) => {
      const modelId = device.deviceModelId || device.modelId;
      if (modelId) {
        uniqueModelIds.add(Number(modelId));
      }
    });
    
    return Array.from(uniqueModelIds)
      .map((modelId) => ({
        label: modelNameMap[modelId] || `Model #${modelId}`,
        value: modelId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [devices, modelNameMap]);

  // Handle form submit
  const handleSubmit = async (values) => {
    if (!selectedDevice) return;

    try {
      const deviceId = selectedDevice.deviceId || selectedDevice.id;

      const payload = {
        conditions: values.conditions.map((c) => ({
          conditionDefinitionId: Number(c.conditionDefinitionId),
          severity: String(c.severity || "NONE"),
          note: String(c.note || ""),
          images: Array.isArray(c.images) ? c.images.filter(Boolean) : [],
        })),
      };

      await updateDeviceConditions(deviceId, payload);
      toast.success("Đã cập nhật tình trạng thiết bị thành công");
      setUpdateModalOpen(false);
      form.resetFields();
      
      // Reload conditions if view modal is open
      if (viewModalOpen) {
        await loadDeviceConditions(deviceId);
      }
    } catch (error) {
      toast.error(error?.message || "Không thể cập nhật tình trạng thiết bị");
    }
  };

  // Table columns
  const columns = [
    {
      title: "ID",
      dataIndex: "deviceId",
      width: 80,
      render: (_, record) => record.deviceId || record.id,
    },
    {
      title: "Serial Number",
      dataIndex: "serialNumber",
      render: (_, record) => record.serialNumber || record.serial || record.serialNo || "—",
    },
    {
      title: "Mẫu thiết bị",
      dataIndex: "deviceModelId",
      render: (_, record) => {
        const modelId = record.deviceModelId || record.modelId;
        if (modelId && modelNameMap[modelId]) {
          return modelNameMap[modelId];
        }
        // Fallback: try to get from record if available
        const model = record.deviceModel || record.model;
        return model?.deviceName || model?.name || (modelId ? `Model #${modelId}` : "—");
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status) => {
        const statusMap = {
          AVAILABLE: { color: "green", text: "Có sẵn" },
          PRE_RENTAL_QC: { color: "gold", text: "Kiểm tra trước thuê" },
          POST_RENTAL_QC: { color: "purple", text: "QC sau thuê" },
          RENTING: { color: "blue", text: "Đang thuê" },
          RENTED: { color: "blue", text: "Đang thuê" },
          MAINTENANCE: { color: "orange", text: "Bảo trì" },
          BROKEN: { color: "red", text: "Hỏng" },
          DAMAGED: { color: "red", text: "Hư hỏng" },
        };
        const s = String(status || "").toUpperCase();
        const mapped = statusMap[s] || { color: "default", text: status || "—" };
        return <Tag color={mapped.color}>{mapped.text}</Tag>;
      },
    },
    {
      title: "Ngày nhập kho",
      dataIndex: "acquireAt",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "—"),
    },
    {
      title: "Thao tác",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewConditions(record)}
          >
            Xem tình trạng
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleUpdateConditions(record)}
          >
            Cập nhật
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Quản lý tình trạng thiết bị</Title>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="Lọc theo trạng thái"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ minWidth: 180 }}
            options={[
              { label: "Có sẵn", value: "AVAILABLE" },
              { label: "Kiểm tra trước thuê", value: "PRE_RENTAL_QC" },
              { label: "QC sau thuê", value: "POST_RENTAL_QC" },
              { label: "Đang thuê", value: "RENTING" },
              { label: "Bảo trì", value: "MAINTENANCE" },
              { label: "Hỏng", value: "BROKEN" },
              { label: "Hư hỏng", value: "DAMAGED" },
            ]}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Lọc theo mẫu thiết bị"
            value={filterModelId}
            onChange={setFilterModelId}
            style={{ minWidth: 220 }}
            options={modelOptions}
          />
        </Space>
        <Table
          rowKey={(record) => record.deviceId || record.id}
          columns={columns}
          dataSource={filteredDevices}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* View Conditions Modal */}
      <Modal
        title={`Tình trạng thiết bị: ${selectedDevice?.serialNumber || selectedDevice?.serial || "—"}`}
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setSelectedDevice(null);
          setDeviceConditions([]);
        }}
        footer={[
          <Button key="close" onClick={() => setViewModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="update"
            type="primary"
            onClick={() => {
              setViewModalOpen(false);
              handleUpdateConditions(selectedDevice);
            }}
          >
            Cập nhật
          </Button>,
        ]}
        width={800}
      >
        {loadingConditions ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : deviceConditions.length === 0 ? (
          <Text type="secondary">Thiết bị chưa có tình trạng được ghi nhận.</Text>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            {deviceConditions
              .sort((a, b) => {
                const timeA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
                const timeB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
                return timeB - timeA;
              })
              .map((condition, index) => (
                <Card key={index} size="small" title={`Tình trạng #${index + 1}`}>
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Tình trạng">
                      {condition.conditionDefinitionName || `Condition #${condition.conditionDefinitionId}`}
                    </Descriptions.Item>
                    <Descriptions.Item label="Mức độ nghiêm trọng">
                      <Tag>
                        {condition.severity === "DAMAGE" ? "Hư hỏng" :
                         condition.severity === "NONE" ? "Không có" :
                         condition.severity === "LOW" ? "Nhẹ" :
                         condition.severity === "MEDIUM" ? "Trung bình" :
                         condition.severity === "HIGH" ? "Nặng" :
                         condition.severity === "CRITICAL" ? "Rất nặng" :
                         condition.severity}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ghi chú">
                      {condition.note || "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời gian ghi nhận">
                      {condition.capturedAt
                        ? dayjs(condition.capturedAt).format("DD/MM/YYYY HH:mm")
                        : "—"}
                    </Descriptions.Item>
                    {condition.images && condition.images.length > 0 && (
                      <Descriptions.Item label="Ảnh bằng chứng">
                        <Image.PreviewGroup>
                          <Space wrap>
                            {condition.images.map((img, imgIdx) => (
                              <Image
                                key={imgIdx}
                                src={img}
                                width={100}
                                height={100}
                                style={{ objectFit: "cover", borderRadius: 4 }}
                              />
                            ))}
                          </Space>
                        </Image.PreviewGroup>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              ))}
          </Space>
        )}
      </Modal>

      {/* Update Conditions Modal */}
      <Modal
        title={`Cập nhật tình trạng: ${selectedDevice?.serialNumber || selectedDevice?.serial || "—"}`}
        open={updateModalOpen}
        onCancel={() => {
          setUpdateModalOpen(false);
          setSelectedDevice(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={800}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.List name="conditions">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`Tình trạng #${index + 1}`}
                    extra={
                      fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          onClick={() => remove(field.name)}
                        >
                          Xóa
                        </Button>
                      )
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Form.Item
                      name={[field.name, "conditionDefinitionId"]}
                      label="Tình trạng thiết bị"
                      rules={[{ required: true, message: "Vui lòng chọn tình trạng" }]}
                    >
                      <Select
                        placeholder="Chọn tình trạng"
                        loading={loadingDefinitions}
                        options={conditionDefinitions.map((def) => ({
                          label: `${def.name}${def.damage ? " (Gây hư hỏng)" : ""}`,
                          value: def.id,
                        }))}
                      />
                    </Form.Item>

                    <Form.Item
                      name={[field.name, "severity"]}
                      label="Mức độ nghiêm trọng"
                      rules={[{ required: true, message: "Vui lòng chọn mức độ" }]}
                    >
                      <Select
                        placeholder="Chọn mức độ"
                        options={[
                          { label: "Không có", value: "NONE" },
                          { label: "Nhẹ", value: "LOW" },
                          { label: "Trung bình", value: "MEDIUM" },
                          { label: "Nặng", value: "HIGH" },
                          { label: "Rất nặng", value: "CRITICAL" },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      name={[field.name, "note"]}
                      label="Ghi chú"
                    >
                      <Input.TextArea rows={3} placeholder="Nhập ghi chú (tùy chọn)" />
                    </Form.Item>

                    <Form.Item
                      name={[field.name, "images"]}
                      label="Ảnh bằng chứng"
                    >
                      <Upload
                        multiple
                        accept=".jpg,.jpeg,.png,.webp"
                        beforeUpload={() => false}
                        listType="picture-card"
                        fileList={form.getFieldValue(["conditions", field.name, "images"])?.map((img, imgIdx) => ({
                          uid: `img-${field.name}-${imgIdx}`,
                          name: `image-${imgIdx + 1}.jpg`,
                          status: "done",
                          url: typeof img === "string" ? img : (img?.url || img?.thumbUrl || ""),
                        })) || []}
                        onChange={async ({ fileList }) => {
                          const imageUrls = await Promise.all(
                            fileList.map(async (f) => {
                              if (f.originFileObj) {
                                return await fileToBase64(f.originFileObj);
                              }
                              return f.thumbUrl || f.url || "";
                            })
                          );
                          form.setFieldValue(["conditions", field.name, "images"], imageUrls.filter(Boolean));
                        }}
                      >
                        {(form.getFieldValue(["conditions", field.name, "images"])?.length || 0) < 5 && (
                          <div>
                            <InboxOutlined />
                            <div style={{ marginTop: 8 }}>Tải ảnh</div>
                          </div>
                        )}
                      </Upload>
                    </Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  style={{ marginTop: 8 }}
                >
                  + Thêm tình trạng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}

