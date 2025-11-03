// src/pages/technician/TechnicianQcDetail.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Card, Descriptions, Typography, Tag, Space, Divider, Progress,
  Checkbox, Select, Input, Upload, Button, message, Row, Col, DatePicker, Spin
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { InboxOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getTaskById, normalizeTask } from "../../lib/taskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { createQcReport } from "../../lib/qcReportApi";
import { getDevicesByModelId } from "../../lib/deviceManage";

const { Title, Text } = Typography;
const { Dragger } = Upload;

/** Checklist mẫu theo category */
const QC_CHECKLIST_BY_CATEGORY = {
  "VR/AR": ["Vệ sinh ống kính", "Test tracking", "Kiểm tra pin", "Kiểm tra dây cáp", "Update firmware"],
  "Console": ["Vệ sinh máy", "Test game demo", "Kiểm tra tay cầm", "Kiểm tra cổng HDMI", "Update hệ thống"],
  "Camera": ["Kiểm tra cảm biến", "Test màn trập", "Kiểm tra pin + sạc", "Kiểm tra thẻ nhớ", "Vệ sinh ống kính"],
  "Drone": ["Kiểm tra cánh quạt", "Test GPS", "Kiểm tra pin", "Hiệu chỉnh compa", "Test quay video"],
};

/** Fallback mock nếu vào trực tiếp */
function mockFromId(id) {
  return {
    id,
    type: "QC",
    title: "QC – Meta Quest 3",
    orderId: "TR-241001-023",
    quantity: 2,
    devices: ["Meta Quest 3 #A12", "Meta Quest 3 #B09"],
    category: "VR/AR",
    deadline: "2025-10-03 17:00",
    location: "Kho A",
    // Danh mục yêu cầu theo đơn (model + số lượng)
    orderItems: [
      { model: "Meta Quest 3", quantity: 2 },
      { model: "Controller Touch Plus (L/R)", quantity: 2 },
    ],
  };
}

export default function TechnicianQcDetail() {
  const nav = useNavigate();
  const { taskId: paramTaskId } = useParams();
  const { state } = useLocation();
  
  const actualTaskId = paramTaskId || state?.task?.id || state?.task?.taskId;
  
  // States
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [order, setOrder] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  // Map: orderDetailId -> danh sách devices (để lấy serialNumbers)
  const [devicesByOrderDetail, setDevicesByOrderDetail] = useState({});
  
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
          toast.error("Không tìm thấy task");
          nav(-1);
          return;
        }
        
        const normalizedTask = normalizeTask(taskData);
        setTask(normalizedTask);
        
        // Fetch order details
        if (normalizedTask.orderId) {
          const orderData = await getRentalOrderById(normalizedTask.orderId);
          setOrder(orderData);
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không tải được dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [actualTaskId, nav]);

  // Fetch devices for each orderDetail based on deviceModelId
  useEffect(() => {
    const fetchDevices = async () => {
      if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
        return;
      }

      try {
        setLoadingDevices(true);
        const devicesMap = {};

        // Fetch devices for each orderDetail concurrently
        const fetchPromises = order.orderDetails.map(async (orderDetail) => {
          const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
          const deviceModelId = orderDetail.deviceModelId;

          if (!deviceModelId) {
            console.warn(`OrderDetail ${orderDetailId} không có deviceModelId`);
            return { orderDetailId, devices: [] };
          }

          try {
            const devices = await getDevicesByModelId(deviceModelId);
            return { orderDetailId, devices: Array.isArray(devices) ? devices : [] };
          } catch (e) {
            console.error(`Lỗi khi fetch devices cho modelId ${deviceModelId}:`, e);
            toast.error(`Không thể tải devices cho model ${deviceModelId}`);
            return { orderDetailId, devices: [] };
          }
        });

        const results = await Promise.all(fetchPromises);
        
        // Build devicesMap
        results.forEach(({ orderDetailId, devices }) => {
          devicesMap[orderDetailId] = devices;
        });

        setDevicesByOrderDetail(devicesMap);
      } catch (e) {
        console.error("Lỗi khi fetch devices:", e);
        toast.error("Không thể tải danh sách thiết bị từ kho");
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDevices();
  }, [order]);

  /** ---------- MOCK INVENTORY TRONG KHO ----------
   * Map: orderDetailId -> danh sách serial/asset code có sẵn
   * (Sau này thay bằng API: GET /inventory?orderDetailId=...)
   */
  const INVENTORY = useMemo(
    () => ({
      // Mock data - sau này sẽ fetch từ API dựa trên orderDetailId
      default: ["SN-001", "SN-002", "SN-003", "SN-004", "SN-005"],
    }),
    []
  );

  // ----- STATES -----
  const [checklistDone, setChecklistDone] = useState([]);
  const [phase, setPhase] = useState("PRE_RENTAL");
  const [result, setResult] = useState("READY_FOR_SHIPPING");

  // Allowed results per phase
  const resultOptions = useMemo(() => {
    const p = String(phase || "").toUpperCase();
    if (p === "POST_RENTAL") {
      return [
        { label: "READY_FOR_RE_STOCK", value: "READY_FOR_RE_STOCK" },
        { label: "POST_RENTAL_FAILED", value: "POST_RENTAL_FAILED" },
      ];
    }
    // default: PRE_RENTAL
    return [
      { label: "READY_FOR_SHIPPING", value: "READY_FOR_SHIPPING" },
      { label: "PRE_RENTAL_FAILED", value: "PRE_RENTAL_FAILED" },
    ];
  }, [phase]);

  // Ensure current result is valid when phase changes
  useEffect(() => {
    const allowed = new Set(resultOptions.map((o) => o.value));
    if (!allowed.has(String(result))) {
      // set a sensible default for the chosen phase
      setResult(resultOptions[0]?.value || "");
    }
  }, [phase, resultOptions]);
  const [findings, setFindings] = useState("");
  const [accessorySnapShotUrl, setAccessorySnapShotUrl] = useState("");

  // Chọn thiết bị từ kho theo từng orderDetailId:
  // selectedDevicesByOrderDetail = { orderDetailId: ["SN-001", "SN-002"], ... }
  const [selectedDevicesByOrderDetail, setSelectedDevicesByOrderDetail] = useState({});

  // Get order details from order
  const orderDetails = useMemo(() => {
    if (!order || !Array.isArray(order.orderDetails)) return [];
    return order.orderDetails;
  }, [order]);

  const checklist = useMemo(() => {
    // Có thể lấy từ taskCategoryName hoặc từ category của order
    return QC_CHECKLIST_BY_CATEGORY[task?.taskCategoryName] || [];
  }, [task]);

  const percent = Math.round((checklistDone.length / Math.max(1, checklist.length)) * 100);

  /** Gợi ý auto chọn đủ số lượng đầu tiên trong kho */
  const autoPick = () => {
    const next = { ...selectedDevicesByOrderDetail };
    orderDetails.forEach((orderDetail) => {
      const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
      const quantity = orderDetail.quantity || 1;
      
      // Lấy devices từ API, extract serialNumbers
      const devices = devicesByOrderDetail[orderDetailId] || [];
      const serialNumbers = devices
        .map(device => device.serialNumber || device.serial || device.serialNo || device.id)
        .filter(Boolean);
      
      // Fallback về mock nếu không có devices từ API
      const avail = serialNumbers.length > 0 
        ? serialNumbers 
        : (INVENTORY[orderDetailId] || INVENTORY.default || []);
      
      next[orderDetailId] = avail.slice(0, quantity).map(String);
    });
    setSelectedDevicesByOrderDetail(next);
    message.success("Đã gợi ý đủ số lượng từ kho.");
  };

  /** Khi chọn thay đổi per-orderDetail, giữ không vượt quá số lượng yêu cầu */
  const onChangeOrderDetailPick = (orderDetailId, quantity, values) => {
    if (values.length > quantity) {
      message.warning(`Chỉ cần ${quantity} thiết bị cho order detail này.`);
      values = values.slice(0, quantity);
    }
    setSelectedDevicesByOrderDetail((prev) => ({ ...prev, [orderDetailId]: values }));
  };

  /** Validate số lượng chọn đủ chưa */
  const isPickComplete = () => {
    if (!orderDetails.length) return false;
    return orderDetails.every((orderDetail) => {
      const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
      const quantity = orderDetail.quantity || 1;
      const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
      return picked.length === quantity;
    });
  };

  const onSave = async () => {
    console.log("=== onSave called ===");
    console.log("task:", task);
    console.log("actualTaskId:", actualTaskId);
    console.log("orderDetails:", orderDetails);
    console.log("selectedDevicesByOrderDetail:", selectedDevicesByOrderDetail);
    console.log("selectedDevicesByOrderDetail (detailed):", JSON.stringify(selectedDevicesByOrderDetail, null, 2));
    console.log("findings:", findings);
    console.log("isPickComplete():", isPickComplete());
    
    // Debug chi tiết từng order detail
    if (orderDetails.length > 0) {
      console.log("=== Order Details Analysis ===");
      orderDetails.forEach((od, idx) => {
        const orderDetailId = od.orderDetailId || od.id;
        const quantity = od.quantity || 1;
        const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
        console.log(`OrderDetail #${idx + 1}:`, {
          orderDetailId,
          quantity,
          pickedCount: picked.length,
          pickedItems: picked,
          isComplete: picked.length === quantity
        });
      });
    }
    
    if (!task || !actualTaskId) {
      console.error("Validation failed: missing task or actualTaskId");
      message.error("Không có thông tin task");
      return;
    }

    if (!isPickComplete()) {
      console.error("Validation failed: pick not complete");
      
      // Chi tiết từng order detail để debug
      const incompleteDetails = orderDetails.map(od => {
        const orderDetailId = od.orderDetailId || od.id;
        const quantity = od.quantity || 1;
        const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
        const status = picked.length === quantity ? "✓ OK" : `✗ THIẾU (cần ${quantity}, đã chọn ${picked.length})`;
        return {
          orderDetailId,
          quantity,
          picked: picked.length,
          selected: picked,
          status
        };
      });
      
      console.log("Order details check:", incompleteDetails);
      
      // Tìm các order detail chưa đủ để hiển thị message rõ ràng hơn
      const missingDetails = incompleteDetails.filter(d => d.picked !== d.quantity);
      if (missingDetails.length > 0) {
        const missingList = missingDetails.map(d => `Order Detail #${d.orderDetailId}: cần ${d.quantity}, đã chọn ${d.picked}`);
        console.error("Missing details:", missingList);
        
        // Hiển thị message với danh sách rõ ràng
        const errorMsg = `Bạn chưa chọn đủ thiết bị. ${missingList.join("; ")}`;
        message.error(errorMsg, 6); // Hiển thị 6 giây
      } else {
        message.error("Bạn chưa chọn đủ thiết bị từ kho theo từng order detail trong đơn.", 6);
      }
      return;
    }

    if (!findings.trim()) {
      console.error("Validation failed: findings is empty");
      message.error("Vui lòng nhập findings (phát hiện/quan sát)");
      return;
    }

    try {
      console.log("Starting to build payload...");
      
      // Map orderDetails thành orderDetailSerialNumbers format
      // Format: { "355": [serialNumbers], "356": [serialNumbers], ... }
      // Backend mong đợi key là orderDetailId (Long), nhưng JSON chỉ hỗ trợ string keys
      // Backend sẽ tự parse string key thành Long
      const orderDetailSerialNumbers = {};
      
      orderDetails.forEach((orderDetail) => {
        const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
        const serialNumbers = selectedDevicesByOrderDetail[orderDetailId] || [];
        
        // Dùng orderDetailId trực tiếp làm key (sẽ được convert thành string trong JSON)
        // Backend sẽ parse lại thành Long
        const key = String(orderDetailId);
        // Đảm bảo serialNumbers là array of strings
        orderDetailSerialNumbers[key] = serialNumbers.map(String);
        
        console.log(`Mapped orderDetailId ${orderDetailId} (key: "${key}"):`, serialNumbers);
      });

      const payload = {
        taskId: Number(actualTaskId),
        orderDetailSerialNumbers,
        phase: String(phase || "PRE_RENTAL").toUpperCase(),
        result: String(result || "READY_FOR_SHIPPING").toUpperCase(),
        findings: findings.trim(),
        accessorySnapShotUrl: accessorySnapShotUrl.trim() || "",
      };

      console.log("QC report payload:", payload);
      console.log("Calling createQcReport...");
      
      await createQcReport(payload);
      console.log("createQcReport succeeded");
      
      toast.success("Đã tạo QC report thành công!");
      
      // Navigate back sau khi thành công
      setTimeout(() => {
        nav(-1);
      }, 1500);
    } catch (e) {
      console.error("Create QC report error:", e);
      console.error("Error details:", {
        message: e?.message,
        response: e?.response?.data,
        stack: e?.stack
      });
      toast.error(e?.response?.data?.message || e?.response?.data?.details || e?.message || "Không thể tạo QC report");
    }
  };

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
          <Text type="danger">Không tìm thấy task</Text>
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
          Chi tiết QC
        </Title>
        <Tag color="blue">CHECK QC</Tag>
      </Space>

      {/* Thông tin task và đơn hàng */}
      <Card title="Thông tin task & đơn hàng" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Task ID">{task.taskId || task.id}</Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{task.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">{task.taskCategoryName || "—"}</Descriptions.Item>
          <Descriptions.Item label="Type">{task.type || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{task.description || "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={task.status === "PENDING" ? "orange" : task.status === "IN_PROGRESS" ? "blue" : "green"}>
              {task.status || "—"}
            </Tag>
          </Descriptions.Item>
          {order && (
            <>
              <Descriptions.Item label="Tổng số order details">{orderDetails.length}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái đơn">{order.status || order.orderStatus || "—"}</Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Chọn thiết bị từ kho theo từng order detail */}
      {orderDetails.length > 0 ? (
        <Card
          title={
            <Space>
              Chọn serial numbers theo từng order detail
              <Button onClick={autoPick}>Gợi ý đủ số lượng</Button>
            </Space>
          }
          className="mb-3"
        >
          <Row gutter={[16, 16]}>
            {orderDetails.map((orderDetail, index) => {
              const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
              const quantity = orderDetail.quantity || 1;
              const deviceModelId = orderDetail.deviceModelId;
              
              // Lấy devices từ API cho orderDetail này
              const devices = devicesByOrderDetail[orderDetailId] || [];
              
              // Extract serialNumbers từ devices
              // Hỗ trợ nhiều tên field: serialNumber, serial, serialNo, deviceId, id
              const serialNumbersFromDevices = devices
                .map(device => device.serialNumber || device.serial || device.serialNo || device.deviceId || device.id)
                .filter(Boolean)
                .map(String);
              
              // Fallback: lấy từ orderDetail nếu có, hoặc mock
              const serialNumbersFromOrder = orderDetail.serialNumbers || orderDetail.serialNumberList || [];
              const mockSerialNumbers = INVENTORY[orderDetailId] || INVENTORY.default || [];
              
              // Ưu tiên: devices từ API > từ orderDetail > mock
              const availableSerialNumbers = serialNumbersFromDevices.length > 0
                ? serialNumbersFromDevices
                : (serialNumbersFromOrder.length > 0 ? serialNumbersFromOrder : mockSerialNumbers);
              
              const serialOptions = availableSerialNumbers.map((serial) => ({
                label: String(serial),
                value: String(serial),
              }));
              
              const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
              const ok = picked.length === quantity;

              return (
                <Col xs={24} md={12} key={orderDetailId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <Text strong>Order Detail #{orderDetailId}</Text>
                        <Tag color={ok ? "green" : "gold"}>
                          {picked.length}/{quantity} serial numbers
                        </Tag>
                      </Space>
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Device Model ID: {deviceModelId} • Quantity: {quantity}
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        {loadingDevices ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <Spin size="small" style={{ marginRight: 4 }} /> Đang tải devices...
                          </Text>
                        ) : serialNumbersFromDevices.length > 0 ? (
                          <Text type="success" style={{ fontSize: 11 }}>
                            ✓ {serialNumbersFromDevices.length} device(s) có sẵn từ kho
                          </Text>
                        ) : serialNumbersFromOrder.length > 0 ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            (Serial numbers từ đơn)
                          </Text>
                        ) : (
                          <Text type="warning" style={{ fontSize: 11 }}>
                            ⚠ Không có devices trong kho cho model này
                          </Text>
                        )}
                      </div>
                    </div>
                    <Select
                      mode="multiple"
                      placeholder={
                        loadingDevices 
                          ? "Đang tải devices..." 
                          : `Chọn ${quantity} serial number(s)`
                      }
                      style={{ width: "100%" }}
                      value={picked.map(String)}
                      onChange={(vals) => onChangeOrderDetailPick(orderDetailId, quantity, vals)}
                      options={serialOptions}
                      maxTagCount="responsive"
                      showSearch
                      disabled={loadingDevices}
                      loading={loadingDevices}
                      filterOption={(input, option) =>
                        (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>
          {!isPickComplete() && (
            <div style={{ marginTop: 8 }}>
              <Text type="warning">*Vui lòng chọn đủ số lượng serial numbers cho từng order detail.</Text>
            </div>
          )}
        </Card>
      ) : (
        <Card className="mb-3">
          <Text type="secondary">Chưa có order details. Vui lòng kiểm tra lại đơn hàng.</Text>
        </Card>
      )}

      {/* QC Report Form */}
      <Card title="Thông tin QC Report" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Phase <Text type="danger">*</Text>
                </Text>
                <Select
                  value={phase}
                  onChange={setPhase}
                  style={{ width: "100%" }}
                  options={[
                    { label: "PRE_RENTAL", value: "PRE_RENTAL" },
                    { label: "POST_RENTAL", value: "POST_RENTAL" },
                  ]}
                />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Result <Text type="danger">*</Text>
                </Text>
                <Select
                  value={result}
                  onChange={setResult}
                  style={{ width: "100%" }}
                  options={resultOptions}
                />
              </div>
            </Col>
          </Row>

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Findings (Phát hiện/Quan sát) <Text type="danger">*</Text>
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="Nhập findings/phát hiện/quan sát trong quá trình QC..."
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              required
            />
          </div>

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Accessory Snapshot URL
            </Text>
            <Input
              placeholder="URL ảnh phụ kiện (nếu có)"
              value={accessorySnapShotUrl}
              onChange={(e) => setAccessorySnapShotUrl(e.target.value)}
            />
          </div>
        </Space>
      </Card>

      {/* Checklist (optional, for reference) */}
      {checklist.length > 0 && (
        <Card title="Checklist tham khảo" className="mb-3">
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Text strong>Tiến độ</Text>
              <Progress percent={percent} style={{ maxWidth: 360, marginLeft: 12 }} />
            </div>

            <Checkbox.Group
              value={checklistDone}
              onChange={setChecklistDone}
              style={{ width: "100%" }}
            >
              <Space direction="vertical">
                {checklist.map((item) => (
                  <Checkbox key={item} value={item}>
                    {item}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Space>
        </Card>
      )}

      {/* Media bằng chứng */}
      <Card title="Ảnh/Video bằng chứng (UI)" className="mb-3">
        <Dragger
          beforeUpload={() => false}
          multiple
          accept=".jpg,.jpeg,.png,.webp,.mp4,.pdf"
          onChange={() => message.success("Đã thêm file (UI).")}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p>Kéo thả hoặc bấm để chọn</p>
        </Dragger>
      </Card>

      <Space>
        <Button onClick={() => nav(-1)}>Hủy</Button>
        <Button 
          type="primary" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Button clicked!");
            try {
              onSave();
            } catch (error) {
              console.error("Error in button onClick:", error);
              message.error("Có lỗi xảy ra: " + (error?.message || "Unknown error"));
            }
          }}
          disabled={loading}
        >
          Lưu kết quả QC
        </Button>
      </Space>
    </div>
  );
}
