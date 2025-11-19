// src/pages/technician/TechnicianHandover.jsx
import React, { useState, useEffect } from "react";
import {
  Card, Descriptions, Typography, Tag, Space,
  Input, Upload, Button, Row, Col, DatePicker, Spin, InputNumber, Table
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { InboxOutlined, ArrowLeftOutlined, SendOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { getTaskById, normalizeTask } from "../../lib/taskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";
import { createHandoverReport, sendHandoverPin } from "../../lib/handoverReportApi";
import { getQcReportsByOrderId } from "../../lib/qcReportApi";
import { useAuthStore } from "../../store/authStore";

const { Title, Text, TextArea } = Typography;
const { Dragger } = Upload;

const translateStatus = (status) => {
  const s = String(status || "").toUpperCase();
  const map = {
    "PENDING": "Đang chờ",
    "IN_PROGRESS": "Đang xử lý",
    "COMPLETED": "Hoàn thành",
    "CANCELLED": "Đã hủy",
  };
  return map[s] || status;
};

const getStatusColor = (status) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PENDING":
      return "orange";
    case "IN_PROGRESS":
      return "blue";
    case "COMPLETED":
      return "green";
    case "CANCELLED":
      return "red";
    default:
      return "default";
  }
};

export default function TechnicianHandover() {
  const nav = useNavigate();
  const { taskId: paramTaskId } = useParams();
  const { state } = useLocation();
  const user = useAuthStore((s) => s.user);
  
  const actualTaskId = paramTaskId || state?.task?.id || state?.task?.taskId;
  
  // States
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [order, setOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingPin, setSendingPin] = useState(false);
  
  // Form states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [technicianInfo, setTechnicianInfo] = useState("");
  const [handoverDateTime, setHandoverDateTime] = useState(dayjs());
  const [handoverLocation, setHandoverLocation] = useState("");
  const [customerSignature, setCustomerSignature] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [items, setItems] = useState([]);
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  // Fetch task and order details
  useEffect(() => {
    const loadData = async () => {
      if (!actualTaskId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // Fetch task
        const taskData = await getTaskById(actualTaskId);
        if (!taskData) {
          toast.error("Không tìm thấy công việc");
          nav(-1);
          return;
        }
        
        const normalizedTask = normalizeTask(taskData);
        setTask(normalizedTask);
        
        // Fetch order details
        if (normalizedTask.orderId) {
          const orderData = await getRentalOrderById(normalizedTask.orderId);
          setOrder(orderData);
          
          // Fetch customer info
          if (orderData?.customerId) {
            try {
              const cus = await fetchCustomerById(orderData.customerId);
              const normalizedCus = normalizeCustomer ? normalizeCustomer(cus) : cus;
              
              // Pre-fill customer info
              const customerNameValue = normalizedCus.fullName || normalizedCus.username || "";
              setCustomerName(customerNameValue);
              setCustomerPhone(normalizedCus.phoneNumber || "");
              setCustomerEmail(normalizedCus.email || "");
              // Auto-fill customer signature with customer name
              setCustomerSignature(customerNameValue);
            } catch {
              console.error("Error fetching customer");
            }
          }
          
          // Pre-fill technician info
          if (user) {
            const techInfoStr = [
              user.username || user.fullName || "",
              user.email || ""
            ].filter(Boolean).join(" • ");
            setTechnicianInfo(techInfoStr);
          }
          
          // Pre-fill location from order
          if (orderData?.shippingAddress) {
            setHandoverLocation(orderData.shippingAddress);
          }
          
          // Fetch QC report to get serial numbers
          let qcReportDevices = [];
          try {
            const qcReports = await getQcReportsByOrderId(normalizedTask.orderId);
            if (Array.isArray(qcReports) && qcReports.length > 0) {
              // Tìm QC report có taskId matching hoặc lấy report đầu tiên
              const matchingReport = qcReports.find(r => (r.taskId === normalizedTask.taskId || r.taskId === normalizedTask.id));
              const reportToUse = matchingReport || qcReports[0];
              if (reportToUse?.devices && Array.isArray(reportToUse.devices)) {
                qcReportDevices = reportToUse.devices;
              }
            }
          } catch (e) {
            console.log("No QC report found or error:", e);
            // Không có QC report cũng không sao, sẽ để itemCode trống
          }
          
          // Build items from orderDetails
          if (Array.isArray(orderData.orderDetails) && orderData.orderDetails.length > 0) {
            const itemsPromises = orderData.orderDetails.map(async (od) => {
              try {
                const model = await getDeviceModelById(od.deviceModelId);
                const normalizedModel = normalizeModel(model);
                
                // Lấy serial numbers từ QC report devices theo deviceModelId
                const deviceModelId = Number(od.deviceModelId);
                const quantity = Number(od.quantity || 1);
                const matchingDevices = qcReportDevices.filter(d => 
                  Number(d.deviceModelId || d.modelId || d.device_model_id) === deviceModelId
                );
                const serialNumbers = matchingDevices
                  .slice(0, quantity)
                  .map(d => d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id)
                  .filter(Boolean)
                  .map(String);
                
                // itemCode sẽ là serial numbers, nếu có nhiều thì join bằng dấu phẩy
                const itemCode = serialNumbers.length > 0 
                  ? serialNumbers.join(", ") 
                  : (normalizedModel.code || normalizedModel.sku || "");
                
                return {
                  itemName: normalizedModel.name || `Model #${od.deviceModelId}`,
                  itemCode: itemCode,
                  unit: "cái",
                  orderedQuantity: quantity,
                  deliveredQuantity: quantity,
                };
              } catch {
                // Fallback nếu không fetch được model
                const deviceModelId = Number(od.deviceModelId);
                const quantity = Number(od.quantity || 1);
                const matchingDevices = qcReportDevices.filter(d => 
                  Number(d.deviceModelId || d.modelId || d.device_model_id) === deviceModelId
                );
                const serialNumbers = matchingDevices
                  .slice(0, quantity)
                  .map(d => d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id)
                  .filter(Boolean)
                  .map(String);
                const itemCode = serialNumbers.length > 0 ? serialNumbers.join(", ") : "";
                
                return {
                  itemName: `Model #${od.deviceModelId}`,
                  itemCode: itemCode,
                  unit: "cái",
                  orderedQuantity: quantity,
                  deliveredQuantity: quantity,
                };
              }
            });
            
            const itemsData = await Promise.all(itemsPromises);
            setItems(itemsData);
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error(error?.response?.data?.message || error?.message || "Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [actualTaskId, nav, user]);

  // Handle evidence file upload
  const evidenceProps = {
    beforeUpload: () => false,
    multiple: true,
    accept: ".jpg,.jpeg,.png,.webp,.pdf",
    fileList: evidenceFiles,
    onChange: ({ fileList }) => {
      setEvidenceFiles(fileList);
    },
  };

  // Handle send PIN
  const handleSendPin = async () => {
    if (!order?.orderId && !order?.id) {
      toast.error("Không tìm thấy đơn hàng");
      return;
    }
    
    try {
      setSendingPin(true);
      await sendHandoverPin(order.orderId || order.id);
      toast.success("Đã gửi mã PIN thành công!");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không thể gửi mã PIN");
    } finally {
      setSendingPin(false);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!task?.taskId && !task?.id) {
      toast.error("Không tìm thấy task");
      return;
    }
    
    if (!customerName.trim()) {
      toast.error("Vui lòng nhập tên khách hàng");
      return;
    }
    
    if (!customerPhone.trim()) {
      toast.error("Vui lòng nhập số điện thoại khách hàng");
      return;
    }
    
    if (!technicianInfo.trim()) {
      toast.error("Vui lòng nhập thông tin kỹ thuật viên");
      return;
    }
    
    if (!handoverLocation.trim()) {
      toast.error("Vui lòng nhập địa điểm bàn giao");
      return;
    }
    
    if (!pinCode.trim()) {
      toast.error("Vui lòng nhập mã PIN");
      return;
    }
    
    if (items.length === 0) {
      toast.error("Không có thiết bị nào trong đơn hàng");
      return;
    }
    
    try {
      setSaving(true);
      
      // Join customer info fields into a single string for API
      const customerInfoStr = [
        customerName.trim(),
        customerPhone.trim(),
        customerEmail.trim()
      ].filter(Boolean).join(" • ");
      
      const payload = {
        taskId: task.taskId || task.id,
        customerInfo: customerInfoStr,
        technicianInfo: technicianInfo.trim(),
        handoverDateTime: handoverDateTime.format("YYYY-MM-DDTHH:mm:ss.SSS"),
        handoverLocation: handoverLocation.trim(),
        customerSignature: customerSignature.trim(),
        pinCode: pinCode.trim(),
        items: items,
        evidences: evidenceFiles.map(f => f.originFileObj).filter(Boolean),
      };
      
      await createHandoverReport(payload);
      toast.success("Đã tạo biên bản bàn giao thành công!");
      
      setTimeout(() => {
        nav(-1);
      }, 1500);
    } catch (e) {
      console.error("Create handover report error:", e);
      toast.error(e?.response?.data?.message || e?.response?.data?.details || e?.message || "Không thể tạo biên bản bàn giao");
    } finally {
      setSaving(false);
    }
  };

  // Items table columns
  const itemsColumns = [
    {
      title: "Tên thiết bị",
      dataIndex: "itemName",
      key: "itemName",
    },
    {
      title: "Mã thiết bị (Serial Number)",
      dataIndex: "itemCode",
      key: "itemCode",
      render: (text) => text || <Text type="secondary">Chưa có</Text>,
    },
    {
      title: "Đơn vị",
      dataIndex: "unit",
      key: "unit",
      width: 80,
    },
    {
      title: "SL đặt",
      dataIndex: "orderedQuantity",
      key: "orderedQuantity",
      width: 100,
      render: (val) => val || 0,
    },
    {
      title: "SL giao",
      dataIndex: "deliveredQuantity",
      key: "deliveredQuantity",
      width: 120,
      render: (val, record, index) => (
        <InputNumber
          min={0}
          max={record.orderedQuantity}
          value={val}
          onChange={(v) => {
            const newItems = [...items];
            newItems[index].deliveredQuantity = v || 0;
            setItems(newItems);
          }}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen" style={{ padding: 24, textAlign: "center" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Đang tải dữ liệu...</Text>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen" style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>
          Quay lại
        </Button>
        <Card>
          <Text type="danger">Không tìm thấy công việc</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ padding: 24 }}>
      <Space align="center" style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>
          Quay lại
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          Tạo biên bản bàn giao
        </Title>
        <Tag color="blue">HANDOVER REPORT</Tag>
      </Space>

      {/* Thông tin task và đơn hàng */}
      <Card title="Thông tin Task" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã Task">{task.taskId || task.id}</Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{task.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">{task.taskCategoryName || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{task.description || "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái Task">
            <Tag color={getStatusColor(task.status)}>
              {translateStatus(task.status) || "—"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Form tạo handover report */}
      <Card title="Thông tin bàn giao" className="mb-3">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Tên khách hàng *</Text>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên khách hàng"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Số điện thoại *</Text>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Email</Text>
              <Input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Nhập email"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Thông tin kỹ thuật viên *</Text>
              <Input
                value={technicianInfo}
                onChange={(e) => setTechnicianInfo(e.target.value)}
                placeholder="Tên, Email..."
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Thời gian bàn giao *</Text>
              <DatePicker
                showTime
                value={handoverDateTime}
                onChange={(v) => setHandoverDateTime(v || dayjs())}
                format="DD/MM/YYYY HH:mm"
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Địa điểm bàn giao *</Text>
              <Input
                value={handoverLocation}
                onChange={(e) => setHandoverLocation(e.target.value)}
                placeholder="Nhập địa chỉ..."
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Mã PIN *</Text>
              {customerEmail && (
                <div style={{ marginTop: 4, marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Email khách hàng nhận mã PIN: <Text strong style={{ color: '#1890ff' }}>{customerEmail}</Text>
                  </Text>
                </div>
              )}
              <Space.Compact style={{ width: "100%", marginTop: 8 }}>
                <Input
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="Nhập mã PIN"
                />
                <Button
                  icon={<SendOutlined />}
                  loading={sendingPin}
                  onClick={handleSendPin}
                  disabled={!order?.orderId && !order?.id}
                >
                  Gửi PIN
                </Button>
              </Space.Compact>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Chữ ký khách hàng</Text>
              <Input
                value={customerSignature}
                onChange={(e) => setCustomerSignature(e.target.value)}
                placeholder="Tên khách hàng (tự động điền)"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Danh sách thiết bị */}
      <Card title="Danh sách thiết bị" className="mb-3">
        <Table
          columns={itemsColumns}
          dataSource={items}
          rowKey={(record, index) => index}
          pagination={false}
          size="small"
        />
      </Card>

      {/* Upload bằng chứng */}
      <Card title="Bằng chứng (ảnh, PDF)" className="mb-3">
        <Dragger {...evidenceProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Kéo thả hoặc bấm để chọn file</p>
          <p className="ant-upload-hint">
            Hỗ trợ: JPG, PNG, PDF (có thể chọn nhiều file)
          </p>
        </Dragger>
      </Card>

      {/* Submit button */}
      <Card>
        <Space>
          <Button
            type="primary"
            size="large"
            onClick={handleSubmit}
            loading={saving}
          >
            Tạo biên bản bàn giao
          </Button>
          <Button onClick={() => nav(-1)}>
            Hủy
          </Button>
        </Space>
      </Card>
    </div>
  );
}

