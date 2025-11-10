// src/pages/technician/TechnicianQcDetail.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Card, Descriptions, Typography, Tag, Space, Divider, Progress,
  Checkbox, Select, Input, Upload, Button, message, Row, Col, DatePicker, Spin
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { InboxOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { getTaskById, normalizeTask } from "../../lib/taskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { createQcReport } from "../../lib/qcReportApi";
import { getDevicesByModelId } from "../../lib/deviceManage";
import { getDeviceModelById } from "../../lib/deviceModelsApi";

const { Title, Text } = Typography;

// --- Tiện ích dịch và tô màu trạng thái ---
const translateStatus = (status) => {
  const s = String(status || "").toUpperCase();
  const map = {
    // Task Status
    "PENDING": "Đang chờ",
    "IN_PROGRESS": "Đang xử lý",
    "COMPLETED": "Hoàn thành",
    "CANCELLED": "Đã hủy",
    // QC Result
    "READY_FOR_SHIPPING": "Sẵn sàng giao",
    "PRE_RENTAL_FAILED": "QC trước thuê thất bại",
    "READY_FOR_RE_STOCK": "Sẵn sàng nhập kho",
    "POST_RENTAL_FAILED": "QC sau thuê thất bại",
    // Order Status
    "PENDING_PAYMENT": "Chờ thanh toán",
    "PENDING_CONFIRMATION": "Chờ xác nhận",
    "CONFIRMED": "Đã xác nhận",
    "SHIPPED": "Đã giao hàng",
    "DELIVERED": "Đã nhận hàng",
    "RETURNED": "Đã trả hàng",
    "AVAILABLE": "Có sẵn",
    "PROCESSING": "Đang xử lý",
  };
  return map[s] || status;
};

const getStatusColor = (status) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PENDING":
    case "PENDING_PAYMENT":
    case "PENDING_CONFIRMATION":
      return "orange";
    case "IN_PROGRESS":
    case "PROCESSING":
      return "blue";
    case "COMPLETED":
    case "DELIVERED":
    case "RETURNED":
    case "READY_FOR_SHIPPING":
    case "READY_FOR_RE_STOCK":
      return "green";
    case "CANCELLED":
    case "PRE_RENTAL_FAILED":
    case "POST_RENTAL_FAILED":
      return "red";
    default:
      return "default";
  }
};
const { Dragger } = Upload;

/** Checklist mẫu theo category */
const QC_CHECKLIST_BY_CATEGORY = {
  "VR/AR": ["Vệ sinh ống kính", "Kiểm tra theo dõi chuyển động (tracking)", "Kiểm tra pin", "Kiểm tra dây cáp", "Cập nhật phần mềm (firmware)"],
  "Console": ["Vệ sinh máy", "Chạy thử game demo", "Kiểm tra tay cầm", "Kiểm tra cổng HDMI", "Cập nhật hệ thống"],
  "Camera": ["Kiểm tra cảm biến", "Kiểm tra màn trập", "Kiểm tra pin & sạc", "Kiểm tra thẻ nhớ", "Vệ sinh ống kính"],
  "Drone": ["Kiểm tra cánh quạt", "Kiểm tra GPS", "Kiểm tra pin", "Hiệu chỉnh la bàn (compass)", "Kiểm tra quay video"],
};

/**/

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
  // Map: deviceModelId -> device model name
  const [modelNameById, setModelNameById] = useState({});
  
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
        const namesMap = {};

        // Fetch devices for each orderDetail concurrently
        const fetchPromises = order.orderDetails.map(async (orderDetail) => {
          const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
          const deviceModelId = orderDetail.deviceModelId;

          if (!deviceModelId) {
            console.warn(`OrderDetail ${orderDetailId} không có deviceModelId`);
            return { orderDetailId, devices: [] };
          }

          try {
            const [devices, model] = await Promise.all([
              getDevicesByModelId(deviceModelId).catch(() => []),
              getDeviceModelById(deviceModelId).catch(() => null),
            ]);
            const name = model?.deviceName || model?.name || null;
            // Chỉ lấy devices có status là "AVAILABLE"
            const availableDevices = Array.isArray(devices) 
              ? devices.filter(device => {
                  const status = String(device.status || device.deviceStatus || device.state || "").toUpperCase();
                  return status === "AVAILABLE";
                })
              : [];
            return { orderDetailId, devices: availableDevices, deviceModelId, name };
          } catch (e) {
            console.error(`Lỗi khi fetch devices cho modelId ${deviceModelId}:`, e);
            toast.error(`Không thể tải devices cho model ${deviceModelId}`);
            return { orderDetailId, devices: [], deviceModelId, name: null };
          }
        });

        const results = await Promise.all(fetchPromises);
        
        // Build devicesMap
        results.forEach(({ orderDetailId, devices, deviceModelId, name }) => {
          devicesMap[orderDetailId] = devices;
          if (deviceModelId != null && name) namesMap[deviceModelId] = name;
        });

        setDevicesByOrderDetail(devicesMap);
        setModelNameById((prev) => ({ ...prev, ...namesMap }));
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

  // Allowed results per phase (labels in Vietnamese, values giữ nguyên để gửi API)
  const resultOptions = useMemo(() => {
    const p = String(phase || "").toUpperCase();
    if (p === "POST_RENTAL") {
      return [
        { label: "Đạt - Sẵn sàng nhập kho", value: "READY_FOR_RE_STOCK" },
        { label: "Không đạt - QC sau thuê", value: "POST_RENTAL_FAILED" },
      ];
    }
    // default: PRE_RENTAL
    return [
      { label: "Đạt - Sẵn sàng giao hàng", value: "READY_FOR_SHIPPING" },
      { label: "Không đạt - QC trước thuê", value: "PRE_RENTAL_FAILED" },
    ];
  }, [phase]);

  // Ensure current result is valid when phase changes
  useEffect(() => {
    const allowed = new Set(resultOptions.map((o) => o.value));
    if (!allowed.has(String(result))) {
      // set a sensible default for the chosen phase
      setResult(resultOptions[0]?.value || "");
    }
  }, [phase, resultOptions, result]);
  const [findings, setFindings] = useState("");
  const [description, setDescription] = useState("");
  // Ảnh chụp phụ kiện: chọn 1 ảnh để upload kèm báo cáo
  const [accessorySnapshotFile, setAccessorySnapshotFile] = useState(null);
  const [accessorySnapshotPreview, setAccessorySnapshotPreview] = useState("");

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
        const errorMsg = `Vui lòng chọn đủ thiết bị: ${missingList.join("; ")}`;
        message.error(errorMsg, 6); // Hiển thị 6 giây
      } else {
        message.error("Vui lòng chọn đủ số lượng thiết bị cho mỗi mục trong đơn hàng.", 6);
      }
      return;
    }

    if (!findings.trim()) {
      console.error("Validation failed: findings is empty");
      message.error("Vui lòng nhập Ghi chú/Phát hiện");
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
        description: description.trim() || "",
        findings: findings.trim(),
        accessoryFile: accessorySnapshotFile || null,
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
          Chi tiết QC
        </Title>
        <Tag color="blue">KIỂM TRA QC</Tag>
      </Space>

      {/* Thông tin task và đơn hàng */}
      <Card title="Thông tin task & đơn hàng" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã Task">{task.taskId || task.id}</Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{task.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">{task.taskCategoryName || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{task.description || "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={getStatusColor(task.status)}>
              {translateStatus(task.status) || "—"}
            </Tag>
          </Descriptions.Item>
          {order && (
            <>
              <Descriptions.Item label="Số loại sản phẩm">{orderDetails.length}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái đơn">
                <Tag color={getStatusColor(order.status || order.orderStatus)}>
                  {translateStatus(order.status || order.orderStatus) || "—"}
                </Tag>
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Chọn thiết bị từ kho theo từng order detail */}
      {orderDetails.length > 0 ? (
        <Card
          title={
            <Space>
              Chọn thiết bị từ kho
              <Button onClick={autoPick}>Gợi ý đủ số lượng</Button>
            </Space>
          }
          className="mb-3"
        >
          <Row gutter={[16, 16]}>
            {orderDetails.map((orderDetail) => {
              const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
              const quantity = orderDetail.quantity || 1;
              const deviceModelId = orderDetail.deviceModelId;

              const devices = devicesByOrderDetail[orderDetailId] || [];
              const serialNumbersFromDevices = devices
                .map(device => device.serialNumber || device.serial || device.serialNo || device.deviceId || device.id)
                .filter(Boolean)
                .map(String);

              const serialNumbersFromOrder = orderDetail.serialNumbers || orderDetail.serialNumberList || [];
              const mockSerialNumbers = INVENTORY[orderDetailId] || INVENTORY.default || [];

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
                        <Text strong>Chọn thiết bị </Text>
                        <Tag color={ok ? "green" : "gold"}>
                          {picked.length}/{quantity} thiết bị
                        </Tag>
                      </Space>
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Model: {modelNameById[deviceModelId] || `#${deviceModelId}`} • Số lượng: {quantity}
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        {loadingDevices ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <Spin size="small" style={{ marginRight: 4 }} /> Đang tải...
                          </Text>
                        ) : serialNumbersFromDevices.length > 0 ? (
                          <Text type="success" style={{ fontSize: 11 }}>
                            ✓ {serialNumbersFromDevices.length} thiết bị có sẵn
                          </Text>
                        ) : serialNumbersFromOrder.length > 0 ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            (Số serial từ đơn hàng)
                          </Text>
                        ) : (
                          <Text type="warning" style={{ fontSize: 11 }}>
                            ⚠ Không có thiết bị trong kho cho model này
                          </Text>
                        )}
                      </div>
                    </div>
                    <Select
                      mode="multiple"
                      placeholder={
                        loadingDevices
                          ? "Đang tải..."
                          : `Chọn ${quantity} số serial`
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
              <Text type="warning">*Vui lòng chọn đủ số lượng thiết bị cho mỗi loại sản phẩm.</Text>
            </div>
          )}
        </Card>
      ) : (
        <Card className="mb-3">
          <Text type="secondary">Chưa có order details. Vui lòng kiểm tra lại đơn hàng.</Text>
        </Card>
      )}

      {/* QC Report Form */}
      <Card title="Báo cáo Quality Control (QC)" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Giai đoạn <Text type="danger">*</Text>
                </Text>
                <Select
                  value={phase}
                  onChange={setPhase}
                  style={{ width: "100%" }}
                  options={[
                    { label: "Trước thuê (PRE_RENTAL)", value: "PRE_RENTAL" },
                    { label: "Sau thuê (POST_RENTAL)", value: "POST_RENTAL" },
                  ]}
                  disabled
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Giai đoạn được xác định bởi hệ thống và không thể chỉnh sửa.
                </Text>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Kết quả <Text type="danger">*</Text>
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
              Mô tả
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="Nhập mô tả về quá trình kiểm tra QC..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Ghi chú/Phát hiện <Text type="danger">*</Text>
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="Nhập ghi chú, phát hiện hoặc quan sát trong quá trình QC..."
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              required
            />
          </div>

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Ảnh chụp phụ kiện 
            </Text>
            <Upload.Dragger
              multiple={false}
              accept=".jpg,.jpeg,.png,.webp"
              beforeUpload={() => false}
              showUploadList={false}
              onChange={({ file }) => {
                const f = file?.originFileObj || file;
                if (f) {
                  setAccessorySnapshotFile(f);
                  const url = file.thumbUrl || file.url || (f ? URL.createObjectURL(f) : "");
                  setAccessorySnapshotPreview(url);
                } else {
                  setAccessorySnapshotFile(null);
                  setAccessorySnapshotPreview("");
                }
              }}
            >
              {accessorySnapshotPreview ? (
                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img
                    src={accessorySnapshotPreview}
                    alt="accessory"
                    style={{ maxHeight: 170, maxWidth: "100%", borderRadius: 8 }}
                  />
                </div>
              ) : (
                <>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p>Thả hoặc bấm để chọn 1 ảnh phụ kiện</p>
                  <p style={{ color: "#888", fontSize: 12 }}>Hỗ trợ: JPG, PNG, WEBP</p>
                </>
              )}
            </Upload.Dragger>
            {accessorySnapshotPreview && (
              <div style={{ marginTop: 8 }}>
                <Button onClick={() => { setAccessorySnapshotFile(null); setAccessorySnapshotPreview(""); }}>
                  Chọn lại ảnh
                </Button>
              </div>
            )}
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
