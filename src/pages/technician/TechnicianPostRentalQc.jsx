// src/pages/technician/TechnicianPostRentalQc.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Card, Descriptions, Typography, Tag, Space, Divider, Progress,
  Checkbox, Select, Input, Upload, Button, message, Row, Col, DatePicker, Spin, Modal, InputNumber, Table
} from "antd";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { InboxOutlined, ArrowLeftOutlined, DeleteOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { getTaskById, normalizeTask } from "../../lib/taskApi";
import { getRentalOrderById } from "../../lib/rentalOrdersApi";
import { 
  createPostRentalQcReport,
  updatePostRentalQcReport,
  getQcReportsByOrderId,
  getPostRentalQcReportById
} from "../../lib/qcReportApi";
import { updateDevice, listDevices } from "../../lib/deviceManage";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getConditionDefinitions } from "../../lib/condition";
import { fmtVND } from "../../lib/deviceModelsApi";
import dayjs from "dayjs";

const { Title, Text } = Typography;


const translateStatus = (status) => {
  const s = String(status || "").toUpperCase();
  const map = {
    "PENDING": "Đang chờ",
    "IN_PROGRESS": "Đang xử lý",
    "COMPLETED": "Hoàn thành",
    "CANCELLED": "Đã hủy",
    "READY_FOR_RE_STOCK": "Sẵn sàng nhập kho",
    "POST_RENTAL_FAILED": "QC sau thuê thất bại",
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
    case "READY_FOR_RE_STOCK":
      return "green";
    case "POST_RENTAL_FAILED":
      return "red";
    default:
      return "default";
  }
};

const { Dragger } = Upload;

export default function TechnicianPostRentalQc() {
  const nav = useNavigate();
  const { taskId: paramTaskId } = useParams();
  const { state } = useLocation();
  
  const actualTaskId = paramTaskId || state?.task?.id || state?.task?.taskId;
  
  // States
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [order, setOrder] = useState(null);
  const [modelNameById, setModelNameById] = useState({});
  const [existingQcReport, setExistingQcReport] = useState(null);
  const [loadingQcReport, setLoadingQcReport] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // POST_RENTAL specific states
  const [result, setResult] = useState("READY_FOR_RE_STOCK");
  const [findings, setFindings] = useState("");
  const [accessorySnapshotFile, setAccessorySnapshotFile] = useState(null);
  const [accessorySnapshotPreview, setAccessorySnapshotPreview] = useState("");
  const [selectedDevicesByOrderDetail, setSelectedDevicesByOrderDetail] = useState({});
  
  // Condition definitions for discrepancies only
  const [conditionDefinitions, setConditionDefinitions] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);
  
  // Discrepancies state (POST_RENTAL only)
  const [discrepancies, setDiscrepancies] = useState([]);
  
  // Device status update state
  const [deviceStatusUpdated, setDeviceStatusUpdated] = useState(false);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [updatingDeviceStatus, setUpdatingDeviceStatus] = useState(false);
  const [selectedDeviceStatus, setSelectedDeviceStatus] = useState("AVAILABLE");
  
  // Fetch task and order details
  useEffect(() => {
    const loadData = async () => {
      if (!actualTaskId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const taskData = await getTaskById(actualTaskId);
        if (!taskData) {
          toast.error("Không tìm thấy công việc");
          nav(-1);
          return;
        }
        
        const normalizedTask = normalizeTask(taskData);
        setTask(normalizedTask);
        
        if (normalizedTask.orderId) {
          const orderData = await getRentalOrderById(normalizedTask.orderId);
          setOrder(orderData);

          // Fetch existing POST_RENTAL QC report
          try {
            setLoadingQcReport(true);
            const qcReports = await getQcReportsByOrderId(normalizedTask.orderId);
            
            if (Array.isArray(qcReports) && qcReports.length > 0) {
              const taskIdNum = Number(normalizedTask.taskId || normalizedTask.id);
              const taskIdStr = String(normalizedTask.taskId || normalizedTask.id);
              
              const matchingReport = qcReports.find(r => {
                const reportPhase = String(r.phase || "").toUpperCase();
                const reportTaskId = r.taskId;
                const reportTaskIdNum = Number(reportTaskId);
                const reportTaskIdStr = String(reportTaskId || "");
                
                const phaseMatch = reportPhase === "POST_RENTAL";
                const taskIdMatch = 
                  (!Number.isNaN(reportTaskIdNum) && !Number.isNaN(taskIdNum) && reportTaskIdNum === taskIdNum) || 
                  (reportTaskIdStr && taskIdStr && reportTaskIdStr === taskIdStr);
                
                return phaseMatch && taskIdMatch;
              });
              
              if (!matchingReport) {
                const reportByPhase = qcReports.find(r => {
                  const reportPhase = String(r.phase || "").toUpperCase();
                  return reportPhase === "POST_RENTAL";
                });
                if (reportByPhase) {
                  setExistingQcReport(reportByPhase);
                } else {
                  setExistingQcReport(null);
                }
              } else {
                setExistingQcReport(matchingReport);
              }
            } else {
              setExistingQcReport(null);
            }
          } catch (e) {
            console.error("Error loading QC reports:", e);
            setExistingQcReport(null);
          } finally {
            setLoadingQcReport(false);
          }
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không tải được dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [actualTaskId, nav]);

  // Fetch devices from PRE_RENTAL QC report
  useEffect(() => {
    const fetchDevices = async () => {
      if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
        return;
      }

      try {
        const namesMap = {};

        if (order.orderId) {
          try {
            const qcReports = await getQcReportsByOrderId(order.orderId);
            const preRentalReport = Array.isArray(qcReports) 
              ? qcReports.find(r => String(r.phase || "").toUpperCase() === "PRE_RENTAL")
              : null;
            
            if (preRentalReport) {
              const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
              const modelPromises = modelIds.map(async (modelId) => {
                try {
                  const model = await getDeviceModelById(modelId);
                  return [modelId, model?.deviceName || model?.name || null];
                } catch {
                  return [modelId, null];
                }
              });
              const modelResults = await Promise.all(modelPromises);
              modelResults.forEach(([modelId, name]) => {
                if (modelId != null && name) namesMap[modelId] = name;
              });
              
              setModelNameById((prev) => ({ ...prev, ...namesMap }));
              return;
            }
          } catch (e) {
            console.warn("Không thể lấy QC report PRE_RENTAL:", e);
          }
        }
      } catch (e) {
        console.error("Lỗi khi fetch devices:", e);
        toast.error("Không thể tải danh sách thiết bị");
      }
    };

    fetchDevices();
  }, [order]);

  // Load existing QC report data
  useEffect(() => {
    if (existingQcReport) {
      if (existingQcReport.result) {
        setResult(String(existingQcReport.result).toUpperCase());
      }
      if (existingQcReport.findings) {
        setFindings(String(existingQcReport.findings));
      }
      if (existingQcReport.accessorySnapShotUrl || existingQcReport.accessorySnapshotUrl) {
        const url = existingQcReport.accessorySnapShotUrl || existingQcReport.accessorySnapshotUrl;
        setAccessorySnapshotPreview(url);
      }
      
    }
  }, [existingQcReport]);

  // Load discrepancies separately to ensure devices are loaded
  useEffect(() => {
    if (existingQcReport && Array.isArray(existingQcReport.discrepancies) && existingQcReport.discrepancies.length > 0) {
      const loadDiscrepancies = async () => {
        try {
          const allDevices = await listDevices();
          const loadedDiscrepancies = existingQcReport.discrepancies.map(d => {
            // Find device by deviceId to get serial number
            const device = Array.isArray(allDevices)
              ? allDevices.find(dev => {
                  const devId = dev.deviceId || dev.id;
                  return Number(devId) === Number(d.deviceId);
                })
              : null;
            
            const serialNumber = device 
              ? (device.serialNumber || device.serial || device.serialNo || String(d.deviceId))
              : String(d.deviceId);
            
            return {
              discrepancyType: d.discrepancyType || "DAMAGE",
              conditionDefinitionId: d.conditionDefinitionId || null,
              orderDetailId: d.orderDetailId || null,
              deviceId: serialNumber, // Store serial number in form
              penaltyAmount: d.penaltyAmount || 0,
              staffNote: d.staffNote || "",
              customerNote: d.customerNote || "",
            };
          });
          
          setDiscrepancies(loadedDiscrepancies);
        } catch (e) {
          console.error("Error loading discrepancies:", e);
          // Fallback: use deviceId as-is
          setDiscrepancies(existingQcReport.discrepancies.map(d => ({
            discrepancyType: d.discrepancyType || "DAMAGE",
            conditionDefinitionId: d.conditionDefinitionId || null,
            orderDetailId: d.orderDetailId || null,
            deviceId: String(d.deviceId || ""),
            penaltyAmount: d.penaltyAmount || 0,
            staffNote: d.staffNote || "",
            customerNote: d.customerNote || "",
          })));
        }
      };
      
      loadDiscrepancies();
    }
  }, [existingQcReport]);

  // Load serial numbers from existing QC report
  useEffect(() => {
    if (existingQcReport && order && Array.isArray(order.orderDetails) && order.orderDetails.length > 0) {
      const serialMap = {};
      
      if (existingQcReport.orderDetailSerialNumbers && typeof existingQcReport.orderDetailSerialNumbers === 'object') {
        Object.keys(existingQcReport.orderDetailSerialNumbers).forEach((orderDetailId) => {
          const serials = existingQcReport.orderDetailSerialNumbers[orderDetailId];
          if (Array.isArray(serials)) {
            serialMap[String(orderDetailId)] = serials.map(String);
          }
        });
      } else if (Array.isArray(existingQcReport.devices)) {
        const devicesByModel = {};
        existingQcReport.devices.forEach((d) => {
          const modelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
          const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
          if (modelId && serial) {
            if (!devicesByModel[modelId]) devicesByModel[modelId] = [];
            devicesByModel[modelId].push(String(serial));
          }
        });
        
        order.orderDetails.forEach((od) => {
          const orderDetailId = od.orderDetailId || od.id;
          const modelId = Number(od.deviceModelId ?? NaN);
          const quantity = Number(od.quantity ?? 1);
          if (orderDetailId && modelId && devicesByModel[modelId]) {
            serialMap[String(orderDetailId)] = devicesByModel[modelId].slice(0, quantity).map(String);
          }
        });
      }
      
      if (Object.keys(serialMap).length > 0) {
        setSelectedDevicesByOrderDetail(serialMap);
      }
    } else if (order?.orderId && !existingQcReport) {
      // Pre-fill from PRE_RENTAL report
      const loadPreRentalSerials = async () => {
        try {
          const qcReports = await getQcReportsByOrderId(order.orderId);
          const preRentalReport = Array.isArray(qcReports) 
            ? qcReports.find(r => String(r.phase || "").toUpperCase() === "PRE_RENTAL")
            : null;
          
          if (preRentalReport) {
            const serialMap = {};
            if (preRentalReport.orderDetailSerialNumbers) {
              Object.keys(preRentalReport.orderDetailSerialNumbers).forEach((orderDetailId) => {
                const serials = preRentalReport.orderDetailSerialNumbers[orderDetailId];
                if (Array.isArray(serials)) {
                  serialMap[String(orderDetailId)] = serials.map(String);
                }
              });
            } else if (Array.isArray(preRentalReport.devices)) {
              const devicesByModel = {};
              preRentalReport.devices.forEach((d) => {
                const modelId = Number(d.deviceModelId ?? d.modelId ?? d.device_model_id ?? NaN);
                const serial = d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id;
                if (modelId && serial) {
                  if (!devicesByModel[modelId]) devicesByModel[modelId] = [];
                  devicesByModel[modelId].push(String(serial));
                }
              });
              
              order.orderDetails.forEach((od) => {
                const orderDetailId = od.orderDetailId || od.id;
                const modelId = Number(od.deviceModelId ?? NaN);
                const quantity = Number(od.quantity ?? 1);
                if (orderDetailId && modelId && devicesByModel[modelId]) {
                  serialMap[String(orderDetailId)] = devicesByModel[modelId].slice(0, quantity).map(String);
                }
              });
            }
            
            if (Object.keys(serialMap).length > 0) {
              setSelectedDevicesByOrderDetail(serialMap);
            }
          }
        } catch (e) {
          console.warn("Không thể load serial từ PRE_RENTAL report:", e);
        }
      };
      
      loadPreRentalSerials();
    }
  }, [existingQcReport, order]);

  // Load condition definitions for discrepancies
  useEffect(() => {
    const loadConditionDefinitions = async () => {
      if (!order || !Array.isArray(order.orderDetails) || order.orderDetails.length === 0) {
        setConditionDefinitions([]);
        return;
      }

      try {
        setLoadingConditions(true);
        const categoryIds = new Set();
        
        for (const orderDetail of order.orderDetails) {
          if (orderDetail.deviceModelId) {
            try {
              const model = await getDeviceModelById(orderDetail.deviceModelId);
              const categoryId = model?.deviceCategoryId || model?.categoryId;
              if (categoryId) {
                categoryIds.add(categoryId);
              }
            } catch (e) {
              console.warn(`Failed to load model ${orderDetail.deviceModelId}:`, e);
            }
          }
        }

        const allConditions = [];
        for (const categoryId of categoryIds) {
          try {
            const conditions = await getConditionDefinitions({ deviceCategoryId: categoryId });
            allConditions.push(...conditions);
          } catch (e) {
            console.warn(`Failed to load conditions for category ${categoryId}:`, e);
          }
        }

        const uniqueConditions = Array.from(
          new Map(allConditions.map(c => [c.id, c])).values()
        );
        
        setConditionDefinitions(uniqueConditions);
      } catch (e) {
        console.error("Error loading condition definitions:", e);
        setConditionDefinitions([]);
      } finally {
        setLoadingConditions(false);
      }
    };

    loadConditionDefinitions();
  }, [order]);

  const orderDetails = useMemo(() => {
    if (!order || !Array.isArray(order.orderDetails)) return [];
    return order.orderDetails;
  }, [order]);

  const availableDevicesForConditions = useMemo(() => {
    const devices = [];
    Object.keys(selectedDevicesByOrderDetail).forEach((orderDetailId) => {
      const serials = selectedDevicesByOrderDetail[orderDetailId] || [];
      const orderDetail = orderDetails.find(od => String(od.orderDetailId || od.id) === orderDetailId);
      
      serials.forEach((serial) => {
        devices.push({
          serial: String(serial),
          orderDetailId,
          deviceModelId: orderDetail?.deviceModelId,
        });
      });
    });
    return devices;
  }, [selectedDevicesByOrderDetail, orderDetails]);

  const isPickComplete = () => {
    if (!orderDetails.length) return false;
    return orderDetails.every((orderDetail) => {
      const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
      const quantity = orderDetail.quantity || 1;
      const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
      return picked.length === quantity;
    });
  };

  const handleUpdateDeviceStatus = async () => {
    if (!orderDetails.length || !selectedDevicesByOrderDetail) {
      message.error("Không có thông tin thiết bị để cập nhật");
      return;
    }

    try {
      setUpdatingDeviceStatus(true);
      
      const allSerialNumbers = [];
      Object.values(selectedDevicesByOrderDetail).forEach((serials) => {
        if (Array.isArray(serials)) {
          allSerialNumbers.push(...serials.map(String));
        }
      });

      if (allSerialNumbers.length === 0) {
        message.error("Không có serial numbers để cập nhật");
        return;
      }

      const allDevices = await listDevices();
      const devicesToUpdate = [];

      allSerialNumbers.forEach((serial) => {
        const device = Array.isArray(allDevices) 
          ? allDevices.find((d) => {
              const deviceSerial = String(d.serialNumber || d.serial || d.serialNo || d.deviceId || d.id || "").toUpperCase();
              return deviceSerial === String(serial).toUpperCase();
            })
          : null;
        
        if (device) {
          const deviceId = device.deviceId || device.id;
          const deviceModelId = device.deviceModelId || device.modelId || device.device_model_id;
          const deviceSerialNumber = device.serialNumber || device.serial || device.serialNo || serial;
          if (deviceId && deviceModelId) {
            devicesToUpdate.push({ deviceId, serial, deviceModelId, serialNumber: deviceSerialNumber });
          }
        }
      });

      if (devicesToUpdate.length === 0) {
        message.warning("Không tìm thấy thiết bị nào với serial numbers đã chọn");
        return;
      }

      const updatePromises = devicesToUpdate.map(async ({ deviceId, serial, deviceModelId, serialNumber }) => {
        try {
          await updateDevice(deviceId, { 
            status: String(selectedDeviceStatus || "AVAILABLE").toUpperCase(),
            deviceModelId: Number(deviceModelId),
            serialNumber: String(serialNumber || serial)
          });
          return { success: true, deviceId, serial };
        } catch (e) {
          console.error(`Failed to update device ${deviceId} (serial: ${serial}):`, e);
          return { success: false, deviceId, serial, error: e };
        }
      });

      const results = await Promise.all(updatePromises);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        const statusLabel = translateStatus(selectedDeviceStatus);
        toast.success(`Đã cập nhật status ${successCount} thiết bị về "${statusLabel}"`);
        setDeviceStatusUpdated(true);
        setShowUpdateStatusModal(false);
        
        setTimeout(() => {
          nav(-1);
        }, 1500);
      }

      if (failCount > 0) {
        message.warning(`${failCount} thiết bị không thể cập nhật status`);
      }
    } catch (e) {
      console.error("Error updating device status:", e);
      toast.error(e?.response?.data?.message || e?.message || "Không thể cập nhật status thiết bị");
    } finally {
      setUpdatingDeviceStatus(false);
    }
  };

  const onSave = async () => {
    if (saving) return;
    
    if (!task || !actualTaskId) {
      message.error("Không có thông tin task");
      return;
    }

    if (!isPickComplete()) {
      message.error("Vui lòng chọn đủ số lượng thiết bị cho mỗi mục trong đơn hàng.");
      return;
    }

    if (!findings.trim()) {
      message.error("Vui lòng nhập Ghi chú/Phát hiện");
      return;
    }

    try {
      setSaving(true);
      
      const orderDetailSerialNumbers = {};
      orderDetails.forEach((orderDetail) => {
        const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
        const serialNumbers = selectedDevicesByOrderDetail[orderDetailId] || [];
        const key = String(orderDetailId);
        orderDetailSerialNumbers[key] = serialNumbers.map(String);
      });

      // Build discrepancies payload - convert serial number to deviceId
      const allDevices = await listDevices();
      const discrepanciesPayload = [];
      let missingOrderDetailRef = false;
      for (const d of discrepancies) {
        if (!d.deviceId || !d.conditionDefinitionId) {
          continue; // Skip incomplete discrepancies
        }
        
        const deviceSerialUpper = String(d.deviceId).toUpperCase();
        // Find device by serial number (deviceId in form is actually serial number)
        const device = Array.isArray(allDevices)
          ? allDevices.find(dev => {
              const deviceSerial = String(
                dev.serialNumber || dev.serial || dev.serialNo || dev.deviceId || dev.id || ""
              ).toUpperCase();
              return deviceSerial === deviceSerialUpper;
            })
          : null;
        
        if (!device) {
          console.warn("Không tìm thấy device cho discrepancy", d);
          missingOrderDetailRef = true;
          continue;
        }
        
        let resolvedOrderDetailId = d.orderDetailId !== null && d.orderDetailId !== undefined && d.orderDetailId !== ""
          ? Number(d.orderDetailId)
          : NaN;
        if (Number.isNaN(resolvedOrderDetailId) || resolvedOrderDetailId <= 0) {
          const matchedEntry = Object.entries(selectedDevicesByOrderDetail)
            .find(([, serials]) =>
              Array.isArray(serials) && serials.some(serial => String(serial).toUpperCase() === deviceSerialUpper)
            );
          if (matchedEntry) {
            resolvedOrderDetailId = Number(matchedEntry[0]);
          }
        }
        
        if (!resolvedOrderDetailId || Number.isNaN(resolvedOrderDetailId)) {
          console.warn("Không xác định được orderDetailId cho discrepancy", d);
          missingOrderDetailRef = true;
          continue;
        }
        
        const actualDeviceId = device.deviceId || device.id;
        discrepanciesPayload.push({
          discrepancyType: String(d.discrepancyType || "DAMAGE"),
          conditionDefinitionId: Number(d.conditionDefinitionId || 0),
          orderDetailId: resolvedOrderDetailId,
          deviceId: Number(actualDeviceId),
          staffNote: String(d.staffNote || ""),
          customerNote: String(d.customerNote || ""),
        });
      }
      
      if (missingOrderDetailRef) {
        setSaving(false);
        message.error("Có sự cố chưa chọn đúng thiết bị/đơn hàng. Vui lòng kiểm tra lại các trường 'Thiết bị' trong mục Sự cố.");
        return;
      }

      const basePayload = {
        taskId: Number(actualTaskId),
        orderDetailSerialNumbers,
        result: String(result || "READY_FOR_RE_STOCK").toUpperCase(),
        findings: findings.trim(),
        discrepancies: discrepanciesPayload,
        accessoryFile: accessorySnapshotFile || null,
      };

      const taskStatus = String(task?.status || "").toUpperCase();
      const isCompleted = taskStatus === "COMPLETED";
      const qcReportId = existingQcReport?.qcReportId || existingQcReport?.id;
      
      if (isCompleted && !qcReportId) {
        message.error("Task đã hoàn thành. Chỉ có thể cập nhật QC report đã tồn tại, không thể tạo mới.");
        return;
      }
      
      if (existingQcReport && qcReportId) {
        const updatePayload = {
          orderDetailSerialNumbers: basePayload.orderDetailSerialNumbers,
          result: basePayload.result,
          findings: basePayload.findings,
          discrepancies: basePayload.discrepancies,
          accessoryFile: basePayload.accessoryFile,
        };
        
        await updatePostRentalQcReport(qcReportId, updatePayload);
        toast.success("Đã cập nhật QC report thành công!");
        
        // Load updated report
        try {
          const updatedReport = await getPostRentalQcReportById(qcReportId);
          setExistingQcReport(updatedReport);
        } catch (e) {
          console.error("Failed to load updated report:", e);
        }
      } else {
        const createdReport = await createPostRentalQcReport(basePayload);
        toast.success("Đã tạo QC report thành công!");
        
        const newQcReportId = createdReport?.qcReportId || createdReport?.id;
        if (newQcReportId) {
          try {
            const loadedReport = await getPostRentalQcReportById(newQcReportId);
            if (loadedReport) {
              setExistingQcReport(loadedReport);
            }
          } catch (e) {
            console.error("Failed to load created QC report:", e);
          }
        }
        
        message.success("QC report đã được tạo thành công!");
        setTimeout(() => {
          nav(-1);
        }, 1500);
      }
      
      const isReadyForRestock = String(result || "").toUpperCase() === "READY_FOR_RE_STOCK";
      
      if (existingQcReport && qcReportId) {
        if (isReadyForRestock && !deviceStatusUpdated) {
          setShowUpdateStatusModal(true);
        } else {
          setTimeout(() => {
            nav(-1);
          }, 1500);
        }
      }
    } catch (e) {
      console.error("Create QC report error:", e);
      toast.error(e?.response?.data?.message || e?.response?.data?.details || e?.message || "Không thể tạo QC report");
    } finally {
      setSaving(false);
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
          {existingQcReport ? "Cập nhật QC Report (Sau thuê)" : "Tạo QC Report (Sau thuê)"}
        </Title>
        <Tag color={existingQcReport ? "orange" : "blue"}>
          POST_RENTAL QC
        </Tag>
      </Space>

      <Card title="Thông tin Nhiệm vụ" className="mb-3">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mã nhiệm vụ">{task.taskId || task.id}</Descriptions.Item>
          <Descriptions.Item label="Mã đơn">{task.orderId || "—"}</Descriptions.Item>
          <Descriptions.Item label="Loại công việc">{task.taskCategoryName || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{task.description || "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái của nhiệm vụ">
            <Tag color={getStatusColor(task.status)}>
              {translateStatus(task.status) || "—"}
            </Tag>
          </Descriptions.Item>
          {order && (
            <Descriptions.Item label="Số loại sản phẩm">{orderDetails.length}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {existingQcReport && (
        <Card className="mb-3" title="Báo cáo QC hiện có">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Mã QC Report">
              {existingQcReport.qcReportId || existingQcReport.id || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đơn hàng">
              {existingQcReport.orderId || order?.orderId || order?.id || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian tạo">
              {existingQcReport.createdAt ? dayjs(existingQcReport.createdAt).format("DD/MM/YYYY HH:mm") : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Kết quả">
              {String(existingQcReport.result || "").toUpperCase()}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Chọn thiết bị từ PRE_RENTAL QC report */}
      {orderDetails.length > 0 ? (
        <Card
          title="Thiết bị trong đơn (từ QC trước thuê)"
          className="mb-3"
        >
          <Row gutter={[16, 16]}>
            {orderDetails.map((orderDetail) => {
              const orderDetailId = orderDetail.orderDetailId || orderDetail.id;
              const quantity = orderDetail.quantity || 1;
              const deviceModelId = orderDetail.deviceModelId;
              const picked = selectedDevicesByOrderDetail[orderDetailId] || [];
              const ok = picked.length === quantity;

              return (
                <Col xs={24} md={12} key={orderDetailId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <Text strong>Thiết bị trong đơn</Text>
                        <Tag color={ok ? "green" : "gold"}>
                          {picked.length}/{quantity} thiết bị
                        </Tag>
                      </Space>
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Mẫu thiết bị: {modelNameById[deviceModelId] || `#${deviceModelId}`} • Số lượng: {quantity}
                      </Text>
                    </div>
                    {picked.length > 0 ? (
                      <div style={{ 
                        padding: 12, 
                        backgroundColor: '#f5f5f5', 
                        borderRadius: 6,
                        border: '1px solid #d9d9d9'
                      }}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                          Danh sách thiết bị đã giao:
                        </Text>
                        <Space wrap size={[8, 8]}>
                          {picked.map((serial, idx) => (
                            <Tag 
                              key={idx} 
                              color="blue" 
                              style={{ 
                                fontSize: 13, 
                                padding: '4px 12px',
                                margin: 0
                              }}
                            >
                              {serial}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    ) : (
                      <div style={{ 
                        padding: 12, 
                        backgroundColor: '#fffbe6', 
                        borderRadius: 6,
                        border: '1px solid #ffe58f'
                      }}>
                        <Text type="warning" style={{ fontSize: 12 }}>
                          ⚠ Chưa có thông tin serial numbers từ QC report trước thuê
                        </Text>
                      </div>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      ) : (
        <Card className="mb-3">
          <Text type="secondary">Chưa có order details. Vui lòng kiểm tra lại đơn hàng.</Text>
        </Card>
      )}

      {/* QC Report Form */}
      <Card title="Báo cáo chất lượng của thiết bị (QC Sau thuê)" className="mb-3">
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Giai đoạn <Text type="danger">*</Text>
                </Text>
                <Select
                  value="POST_RENTAL"
                  style={{ width: "100%" }}
                  disabled
                  options={[
                    { label: "Sau thuê (POST_RENTAL)", value: "POST_RENTAL" },
                  ]}
                />
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
                  options={[
                    { label: "Đạt - Sẵn sàng nhập kho", value: "READY_FOR_RE_STOCK" },
                    { label: "Không đạt - QC sau thuê", value: "POST_RENTAL_FAILED" },
                  ]}
                />
              </div>
            </Col>
          </Row>

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
              Ảnh chụp bằng chứng
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

          {/* Discrepancies Section (POST_RENTAL only) */}
          <Divider />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text strong style={{ fontSize: 16 }}>
                Sự cố/Chênh lệch (Discrepancies)
              </Text>
              <Button
                type="dashed"
                onClick={() => {
                  setDiscrepancies([
                    ...discrepancies,
                    {
                      discrepancyType: "DAMAGE",
                      conditionDefinitionId: null,
                      orderDetailId: null,
                      deviceId: null,
                      penaltyAmount: 0,
                      staffNote: "",
                      customerNote: "",
                    },
                  ]);
                }}
              >
                + Thêm sự cố
              </Button>
            </div>
            
            {discrepancies.length === 0 ? (
              <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                Chưa có sự cố nào được thêm. Nhấn nút "Thêm sự cố" để bắt đầu.
              </Text>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                {discrepancies.map((disc, index) => {
                  // Get available devices and order details for selection
                  // Note: deviceId in form state is serial number, will be converted to actual deviceId on save
                  const availableDevices = availableDevicesForConditions.map(d => ({
                    label: d.serial,
                    value: d.serial,
                    deviceId: d.serial, // Store serial as deviceId in form, convert on save
                    orderDetailId: d.orderDetailId,
                  }));

                  return (
                    <Card
                      key={index}
                      size="small"
                      title={`Sự cố #${index + 1}`}
                      extra={
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            setDiscrepancies(discrepancies.filter((_, i) => i !== index));
                          }}
                        >
                          Xóa
                        </Button>
                      }
                    >
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ display: "block", marginBottom: 4 }}>
                              Loại sự cố <Text type="danger">*</Text>
                            </Text>
                            <Select
                              style={{ width: "100%" }}
                              value={disc.discrepancyType}
                              onChange={(value) => {
                                const newDiscrepancies = [...discrepancies];
                                newDiscrepancies[index] = {
                                  ...newDiscrepancies[index],
                                  discrepancyType: value,
                                };
                                setDiscrepancies(newDiscrepancies);
                              }}
                              options={[
                                { label: "Hư hỏng", value: "DAMAGE" },
                                { label: "Mất mát", value: "LOSS" },
                                { label: "Khác", value: "OTHER" },
                              ]}
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={12}>
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ display: "block", marginBottom: 4 }}>
                              Thiết bị <Text type="danger">*</Text>
                            </Text>
                            <Select
                              style={{ width: "100%" }}
                              placeholder="Chọn thiết bị"
                              value={disc.deviceId ? String(disc.deviceId) : null}
                              onChange={(value) => {
                                const newDiscrepancies = [...discrepancies];
                                const selectedDevice = availableDevices.find(d => d.value === value);
                                newDiscrepancies[index] = {
                                  ...newDiscrepancies[index],
                                  deviceId: selectedDevice ? selectedDevice.deviceId : null, // Store serial number
                                  orderDetailId: selectedDevice ? Number(selectedDevice.orderDetailId) : null,
                                };
                                setDiscrepancies(newDiscrepancies);
                              }}
                              options={availableDevices.map(d => ({
                                label: d.label,
                                value: d.value,
                              }))}
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={12}>
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ display: "block", marginBottom: 4 }}>
                              Điều kiện <Text type="danger">*</Text>
                            </Text>
                            <Select
                              style={{ width: "100%" }}
                              placeholder="Chọn điều kiện"
                              value={disc.conditionDefinitionId}
                              onChange={(value) => {
                                const newDiscrepancies = [...discrepancies];
                                newDiscrepancies[index] = {
                                  ...newDiscrepancies[index],
                                  conditionDefinitionId: value,
                                };
                                setDiscrepancies(newDiscrepancies);
                              }}
                              loading={loadingConditions}
                              options={conditionDefinitions.map(c => ({
                                label: c.name,
                                value: c.id,
                              }))}
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={12}>
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ display: "block", marginBottom: 4 }}>
                              Phí phạt (VNĐ) <Text type="danger">*</Text>
                            </Text>
                            <InputNumber
                              style={{ width: "100%" }}
                              placeholder="Nhập phí phạt"
                              value={disc.penaltyAmount}
                              onChange={(value) => {
                                const newDiscrepancies = [...discrepancies];
                                newDiscrepancies[index] = {
                                  ...newDiscrepancies[index],
                                  penaltyAmount: value || 0,
                                };
                                setDiscrepancies(newDiscrepancies);
                              }}
                              min={0}
                              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                            />
                            {disc.penaltyAmount > 0 && (
                              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
                                {fmtVND(disc.penaltyAmount)}
                              </Text>
                            )}
                          </div>
                        </Col>
                        <Col xs={24} md={12}>
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ display: "block", marginBottom: 4 }}>
                              Ghi chú nhân viên
                            </Text>
                            <Input.TextArea
                              rows={2}
                              placeholder="Nhập ghi chú nhân viên"
                              value={disc.staffNote}
                              onChange={(e) => {
                                const newDiscrepancies = [...discrepancies];
                                newDiscrepancies[index] = {
                                  ...newDiscrepancies[index],
                                  staffNote: e.target.value,
                                };
                                setDiscrepancies(newDiscrepancies);
                              }}
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={12}>
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ display: "block", marginBottom: 4 }}>
                              Ghi chú khách hàng
                            </Text>
                            <Input.TextArea
                              rows={2}
                              placeholder="Nhập ghi chú khách hàng"
                              value={disc.customerNote}
                              onChange={(e) => {
                                const newDiscrepancies = [...discrepancies];
                                newDiscrepancies[index] = {
                                  ...newDiscrepancies[index],
                                  customerNote: e.target.value,
                                };
                                setDiscrepancies(newDiscrepancies);
                              }}
                            />
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </Space>
            )}
          </div>
        </Space>
      </Card>

      <Space>
        <Button onClick={() => nav(-1)}>Hủy</Button>
        <Button 
          type="primary" 
          onClick={onSave}
          disabled={loading || loadingQcReport}
          loading={saving}
        >
          {existingQcReport ? "Cập nhật QC Report" : "Lưu kết quả QC"}
        </Button>
        {existingQcReport && !deviceStatusUpdated && (
          <Button
            type="default"
            onClick={() => setShowUpdateStatusModal(true)}
            disabled={loading || loadingQcReport || saving}
          >
            Cập nhật status thiết bị
          </Button>
        )}
      </Space>

      {/* Modal cập nhật status thiết bị */}
      <Modal
        title="Cập nhật trạng thái thiết bị"
        open={showUpdateStatusModal}
        onOk={handleUpdateDeviceStatus}
        onCancel={() => {
          setShowUpdateStatusModal(false);
          if (existingQcReport || !saving) {
            setTimeout(() => {
              nav(-1);
            }, 500);
          }
        }}
        okText="Cập nhật"
        cancelText="Bỏ qua"
        okButtonProps={{ loading: updatingDeviceStatus }}
        width={600}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text>
              Sau khi QC POST_RENTAL thành công, bạn cần cập nhật trạng thái các thiết bị để có thể cho thuê lại hoặc xử lý tiếp.
            </Text>
          </div>
          
          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Chọn trạng thái thiết bị <Text type="danger">*</Text>
            </Text>
            <Select
              value={selectedDeviceStatus}
              onChange={setSelectedDeviceStatus}
              style={{ width: "100%" }}
              options={[
                { label: "Có sẵn", value: "AVAILABLE" },
                { label: "Kiểm tra trước thuê", value: "PRE_RENTAL_QC" },
                { label: "Đang thuê", value: "RENTED" },
                { label: "Bảo trì", value: "MAINTENANCE" },
                { label: "Hỏng", value: "BROKEN" },
              ]}
            />
          </div>

          <div>
            <Text strong>Danh sách thiết bị sẽ được cập nhật:</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {Object.values(selectedDevicesByOrderDetail).flat().map((serial, idx) => (
                <li key={idx}>
                  <Text code>{serial}</Text>
                </li>
              ))}
            </ul>
          </div>
        </Space>
      </Modal>
    </div>
  );
}

