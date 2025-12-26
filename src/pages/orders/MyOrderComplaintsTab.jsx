/**
 * MyOrderComplaintsTab - Tab khiếu nại trong drawer chi tiết đơn hàng
 * Includes device replacement report viewing and signing functionality
 */
import React, { useState, useCallback } from "react";
import {
  Typography,
  Tag,
  Button,
  List,
  Card,
  Form,
  Input,
  Select,
  Space,
  Empty,
  Skeleton,
  Modal,
  Divider,
  message,
  Upload,
  Image,
  Descriptions,
  Alert,
  Steps,
  Spin,
} from "antd";
import {
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  MailOutlined,
  EditOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getCustomerReplacementReportById,
  sendCustomerReplacementPin,
  signCustomerReplacementReport,
} from "../../lib/complaints";
import {
  buildPrintableReplacementReportHtml,
  elementToPdfBlobReplacement,
} from "../../lib/replacementReportPrintUtils";

const { Title, Text } = Typography;
const { TextArea } = Input;

// Map complaint status to display
const COMPLAINT_STATUS_MAP = {
  PENDING: { color: "orange", label: "Chờ xử lý" },
  IN_PROGRESS: { color: "blue", label: "Đang xử lý" },
  RESOLVED: { color: "green", label: "Đã giải quyết" },
  REJECTED: { color: "red", label: "Từ chối" },
  CLOSED: { color: "default", label: "Đã đóng" },
};

// Map replacement report status
const REPLACEMENT_STATUS_MAP = {
  PENDING_STAFF_SIGNATURE: { color: "orange", label: "Chờ NV ký" },
  STAFF_SIGNED: { color: "blue", label: "NV đã ký - Chờ KH ký" },
  CUSTOMER_SIGNED: { color: "cyan", label: "KH đã ký - Chờ NV ký" },
  BOTH_SIGNED: { color: "green", label: "Hoàn tất" },
};

export default function MyOrderComplaintsTab({
  current,
  complaints,
  complaintsLoading,
  allocatedDevices,
  onCreateComplaint,
  onRefreshComplaints,
  creatingComplaint,
  customerEmail, // Email của customer (từ profile)
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [evidenceFile, setEvidenceFile] = useState(null);

  // Device Replacement Report states
  const [replacementReportModalOpen, setReplacementReportModalOpen] = useState(false);
  const [currentReplacementReport, setCurrentReplacementReport] = useState(null);
  const [loadingReplacementReport, setLoadingReplacementReport] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewContent, setPdfPreviewContent] = useState("");

  // Signing flow states
  const [signingStep, setSigningStep] = useState(0); // 0: View, 1: Send PIN, 2: Enter PIN
  const [pinSent, setPinSent] = useState(false);
  const [pinSending, setPinSending] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [signing, setSigning] = useState(false);

  // Lấy danh sách thiết bị đã được gán cho đơn hàng
  const devices = allocatedDevices || [];

  // Lấy danh sách items (orderDetails mapped) để tìm tên model
  const orderItems = current?.items || [];

  // Hàm lấy tên mẫu thiết bị từ deviceModelId
  const getDeviceModelName = (deviceModelId) => {
    if (!deviceModelId) return null;
    const matchingItem = orderItems.find(item =>
      item.deviceModelId === deviceModelId ||
      Number(item.deviceModelId) === Number(deviceModelId)
    );
    return matchingItem?.name || null;
  };

  // Tạo danh sách thiết bị kèm tên model
  const devicesWithModelName = devices.map(device => {
    const modelName = getDeviceModelName(device.deviceModelId);
    return {
      ...device,
      modelName,
      displayName: modelName
        ? `${modelName} (SN: ${device.serialNumber || device.deviceId || device.id})`
        : `Thiết bị #${device.deviceId || device.id}${device.serialNumber ? ` (SN: ${device.serialNumber})` : ''}`
    };
  });

  // Đóng modal và reset form
  const handleCloseModal = () => {
    setCreateModalOpen(false);
    form.resetFields();
    setEvidenceFile(null);
  };

  const handleSubmit = async (values) => {
    try {
      await onCreateComplaint({
        orderId: current.id,
        deviceId: values.deviceId,
        customerDescription: values.customerDescription,
        evidenceImage: evidenceFile,
      });
      message.success("Tạo khiếu nại thành công!");
      handleCloseModal();
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không thể tạo khiếu nại"
      );
    }
  };

  const formatDateTime = (date) => {
    if (!date) return "—";
    return dayjs(date).format("DD/MM/YYYY HH:mm");
  };

  const getStatusTag = (status) => {
    const s = String(status || "").toUpperCase();
    const config = COMPLAINT_STATUS_MAP[s] || { color: "default", label: status || "—" };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const getReplacementStatusTag = (status) => {
    const s = String(status || "").toUpperCase();
    const config = REPLACEMENT_STATUS_MAP[s] || { color: "default", label: status || "—" };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  // View replacement report detail
  const handleViewReplacementReport = useCallback(async (replacementReportId) => {
    if (!replacementReportId) {
      message.warning("Không tìm thấy mã biên bản thay thế thiết bị.");
      return;
    }

    try {
      setLoadingReplacementReport(true);
      const report = await getCustomerReplacementReportById(replacementReportId);
      if (report) {
        setCurrentReplacementReport(report);
        setReplacementReportModalOpen(true);
        // Reset signing states
        setSigningStep(0);
        setPinSent(false);
        setPinValue("");
      } else {
        message.error("Không tìm thấy biên bản thay thế thiết bị.");
      }
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không thể tải biên bản thay thế thiết bị"
      );
    } finally {
      setLoadingReplacementReport(false);
    }
  }, []);

  // Close replacement report modal
  const handleCloseReplacementModal = () => {
    setReplacementReportModalOpen(false);
    setCurrentReplacementReport(null);
    setSigningStep(0);
    setPinSent(false);
    setPinValue("");
  };

  // Send PIN for signing
  const handleSendPin = useCallback(async () => {
    if (!currentReplacementReport?.replacementReportId) {
      message.error("Không tìm thấy biên bản để gửi PIN.");
      return;
    }

    const emailToUse = customerEmail;
    if (!emailToUse) {
      message.error("Không tìm thấy email. Vui lòng cập nhật thông tin tài khoản.");
      return;
    }

    try {
      setPinSending(true);
      await sendCustomerReplacementPin(currentReplacementReport.replacementReportId, emailToUse);
      message.success("Đã gửi mã PIN đến email của bạn!");
      setPinSent(true);
      setSigningStep(2);
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không thể gửi mã PIN"
      );
    } finally {
      setPinSending(false);
    }
  }, [currentReplacementReport, customerEmail]);

  // Sign replacement report
  const handleSignReport = useCallback(async () => {
    if (!currentReplacementReport?.replacementReportId) {
      message.error("Không tìm thấy biên bản để ký.");
      return;
    }

    if (!pinValue.trim()) {
      message.error("Vui lòng nhập mã PIN.");
      return;
    }

    try {
      setSigning(true);
      // Use customer's name as signature
      const signature = "Customer";

      await signCustomerReplacementReport(currentReplacementReport.replacementReportId, {
        pin: pinValue.trim(),
        signature,
      });

      message.success("Ký biên bản thay thế thiết bị thành công!");
      handleCloseReplacementModal();

      // Refresh complaints list
      if (onRefreshComplaints) {
        onRefreshComplaints();
      }
    } catch (error) {
      message.error(
        error?.response?.data?.message || error?.message || "Không thể ký biên bản"
      );
    } finally {
      setSigning(false);
    }
  }, [currentReplacementReport, pinValue, onRefreshComplaints]);

  // --- PDF Handlers for Replacement Reports (Customer View) ---
  const handleFetchAndPreviewReplacementPdf = useCallback(async () => {
    if (!currentReplacementReport) return;
    try {
      const html = buildPrintableReplacementReportHtml(currentReplacementReport);
      setPdfPreviewContent(html);
      setPdfPreviewOpen(true);
    } catch (error) {
      console.error("Error generating replacement report PDF preview:", error);
      message.error("Không thể tạo bản xem trước PDF");
    }
  }, [currentReplacementReport]);

  const handleFetchAndDownloadReplacementPdf = useCallback(async () => {
    if (!currentReplacementReport) return;
    try {
      message.loading({ content: "Đang tạo PDF...", key: "pdf_gen" });
      const html = buildPrintableReplacementReportHtml(currentReplacementReport);

      // Create a temporary container
      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "800px"; // Fixed width for A4-like
      document.body.appendChild(container);

      const blob = await elementToPdfBlobReplacement(container);
      document.body.removeChild(container);

      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `BienBanThayThe_${currentReplacementReport.replacementReportId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        message.success({ content: "Tải PDF thành công!", key: "pdf_gen" });
      } else {
        message.error({ content: "Lỗi tạo PDF blob", key: "pdf_gen" });
      }
    } catch (error) {
      console.error("Error downloading replacement PDF:", error);
      message.error({ content: "Lỗi tải PDF biên bản thay thế", key: "pdf_gen" });
    }
  }, [currentReplacementReport]);


  // Check if customer can sign the report
  const canCustomerSign = (report) => {
    if (!report) return false;
    const status = String(report.status || "").toUpperCase();
    return status === "STAFF_SIGNED" && report.staffSigned && !report.customerSigned;
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          <ExclamationCircleOutlined style={{ marginRight: 8 }} />
          Khiếu nại của đơn hàng
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefreshComplaints}
            loading={complaintsLoading}
          >
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            disabled={devices.length === 0}
          >
            Tạo khiếu nại
          </Button>
        </Space>
      </div>

      {devices.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Đơn hàng chưa có thiết bị được gán nên không thể tạo khiếu nại.
          </Text>
        </div>
      )}

      {complaintsLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : complaints.length === 0 ? (
        <Empty description="Chưa có khiếu nại nào cho đơn hàng này" />
      ) : (
        <List
          dataSource={complaints}
          renderItem={(complaint) => (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              title={
                <Space>
                  <Text strong>Khiếu nại #{complaint.complaintId || complaint.id}</Text>
                  {getStatusTag(complaint.status)}
                </Space>
              }
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateTime(complaint.createdAt)}
                </Text>
              }
            >
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Thiết bị: </Text>
                <Text>
                  {complaint.deviceName || complaint.device?.name || `Thiết bị #${complaint.deviceId}`}
                </Text>
                {complaint.serialNumber && (
                  <Text type="secondary"> (SN: {complaint.serialNumber})</Text>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Mô tả khách hàng: </Text>
                <Text>{complaint.customerDescription || "—"}</Text>
              </div>
              {complaint.staffResponse && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <div>
                    <Text type="secondary">Phản hồi từ nhân viên: </Text>
                    <Text>{complaint.staffResponse}</Text>
                  </div>
                </>
              )}
              {complaint.resolvedAt && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Giải quyết lúc: </Text>
                  <Text>{formatDateTime(complaint.resolvedAt)}</Text>
                </div>
              )}

              {/* Button to view replacement report if available */}
              {complaint.replacementReportId && (
                <div style={{ marginTop: 12 }}>
                  <Button
                    type="primary"
                    icon={<SwapOutlined />}
                    onClick={() => handleViewReplacementReport(complaint.replacementReportId)}
                    loading={loadingReplacementReport}
                  >
                    Xem biên bản thay thế thiết bị
                  </Button>
                </div>
              )}
            </Card>
          )}
        />
      )}

      {/* Modal tạo khiếu nại mới */}
      <Modal
        title="Tạo khiếu nại mới"
        open={createModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="deviceId"
            label="Chọn thiết bị"
            rules={[{ required: true, message: "Vui lòng chọn thiết bị" }]}
          >
            <Select placeholder="Chọn thiết bị cần khiếu nại">
              {devicesWithModelName.map((device) => (
                <Select.Option key={device.deviceId || device.id} value={device.deviceId || device.id}>
                  {device.displayName}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="customerDescription"
            label="Mô tả vấn đề"
            rules={[
              { required: true, message: "Vui lòng mô tả vấn đề" },
              { min: 10, message: "Mô tả phải có ít nhất 10 ký tự" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Mô tả chi tiết vấn đề bạn gặp phải với thiết bị..."
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item label="Ảnh bằng chứng (tùy chọn)">
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={(file) => {
                const isImage = file.type.startsWith("image/");
                if (!isImage) {
                  message.error("Chỉ hỗ trợ tải lên file ảnh!");
                  return Upload.LIST_IGNORE;
                }
                const isLt5M = file.size / 1024 / 1024 < 5;
                if (!isLt5M) {
                  message.error("Ảnh phải nhỏ hơn 5MB!");
                  return Upload.LIST_IGNORE;
                }
                setEvidenceFile(file);
                return false;
              }}
              onRemove={() => setEvidenceFile(null)}
              listType="picture"
              fileList={evidenceFile ? [{
                uid: "-1",
                name: evidenceFile.name,
                status: "done",
                url: URL.createObjectURL(evidenceFile),
              }] : []}
            >
              {!evidenceFile && (
                <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
              )}
            </Upload>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
              Hỗ trợ: JPG, PNG. Tối đa 5MB.
            </Text>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={handleCloseModal}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={creatingComplaint}>
                Gửi khiếu nại
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal xem chi tiết biên bản thay thế thiết bị */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>Chi tiết biên bản thay thế thiết bị</span>
          </Space>
        }
        open={replacementReportModalOpen}
        onCancel={handleCloseReplacementModal}
        width={720}
        footer={
          currentReplacementReport && canCustomerSign(currentReplacementReport) ? (
            <Space>
              <Button onClick={handleCloseReplacementModal}>Đóng</Button>
              <Button icon={<FileTextOutlined />} onClick={handleFetchAndPreviewReplacementPdf}>
                Xem PDF
              </Button>
              <Button icon={<SwapOutlined />} onClick={handleFetchAndDownloadReplacementPdf}>
                Tải PDF
              </Button>
              {signingStep === 0 && (
                <Button type="primary" icon={<EditOutlined />} onClick={() => setSigningStep(1)}>
                  Ký biên bản
                </Button>
              )}
              {signingStep === 1 && !pinSent && (
                <Button type="primary" icon={<MailOutlined />} onClick={handleSendPin} loading={pinSending}>
                  Gửi mã PIN đến email
                </Button>
              )}
              {signingStep === 2 && pinSent && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSignReport} loading={signing}>
                  Xác nhận ký
                </Button>
              )}
            </Space>
          ) : (
            <Space>
              <Button onClick={handleCloseReplacementModal}>Đóng</Button>
              <Button icon={<FileTextOutlined />} onClick={handleFetchAndPreviewReplacementPdf}>
                Xem PDF
              </Button>
              <Button icon={<SwapOutlined />} onClick={handleFetchAndDownloadReplacementPdf}>
                Tải PDF
              </Button>
            </Space>
          )
        }
        destroyOnClose
      >
        {currentReplacementReport ? (
          <div>
            {/* Signing Steps (only show when can sign) */}
            {canCustomerSign(currentReplacementReport) && signingStep > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Steps
                  current={signingStep - 1}
                  size="small"
                  items={[
                    { title: "Gửi PIN", icon: <MailOutlined /> },
                    { title: "Nhập PIN & Ký", icon: <EditOutlined /> },
                  ]}
                />

                {signingStep === 1 && (
                  <Alert
                    type="info"
                    message="Xác nhận ký biên bản"
                    description={`Mã PIN xác nhận sẽ được gửi đến email: ${customerEmail || "—"}`}
                    style={{ marginTop: 16 }}
                    showIcon
                  />
                )}

                {signingStep === 2 && pinSent && (
                  <div style={{ marginTop: 16 }}>
                    <Alert
                      type="success"
                      message="Đã gửi mã PIN"
                      description="Vui lòng kiểm tra email và nhập mã PIN bên dưới để ký biên bản."
                      style={{ marginBottom: 12 }}
                      showIcon
                    />
                    <Input.OTP
                      length={6}
                      value={pinValue}
                      onChange={(val) => setPinValue(val)}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}

                <Divider />
              </div>
            )}

            {/* Alert for signing status */}
            {canCustomerSign(currentReplacementReport) && signingStep === 0 && (
              <Alert
                type="warning"
                message="Yêu cầu ký biên bản"
                description="Nhân viên đã ký biên bản. Vui lòng ký để hoàn tất quá trình thay thế thiết bị."
                style={{ marginBottom: 16 }}
                showIcon
              />
            )}

            {currentReplacementReport.customerSigned && (
              <Alert
                type="success"
                message="Đã ký hoàn tất"
                description={`Bạn đã ký biên bản lúc: ${formatDateTime(currentReplacementReport.customerSignedAt)}`}
                style={{ marginBottom: 16 }}
                showIcon
              />
            )}

            {/* Report Info */}
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Mã biên bản">
                #{currentReplacementReport.replacementReportId}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {getReplacementStatusTag(currentReplacementReport.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Mã task">
                #{currentReplacementReport.taskId}
              </Descriptions.Item>
              <Descriptions.Item label="Mã đơn hàng">
                #{currentReplacementReport.orderId}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian thay thế" span={2}>
                {formatDateTime(currentReplacementReport.replacementDateTime)}
              </Descriptions.Item>
              <Descriptions.Item label="Địa điểm" span={2}>
                {currentReplacementReport.replacementLocation || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng" span={2}>
                {currentReplacementReport.customerInfo || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kỹ thuật viên" span={2}>
                {currentReplacementReport.technicianInfo || "—"}
              </Descriptions.Item>
            </Descriptions>

            {/* Signature Status */}
            <div style={{ marginTop: 16 }}>
              <Text strong>Trạng thái ký:</Text>
              <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                <div>
                  <Text type="secondary">Nhân viên: </Text>
                  {currentReplacementReport.staffSigned ? (
                    <Tag color="green">Đã ký ({formatDateTime(currentReplacementReport.staffSignedAt)})</Tag>
                  ) : (
                    <Tag color="orange">Chưa ký</Tag>
                  )}
                </div>
                <div>
                  <Text type="secondary">Khách hàng: </Text>
                  {currentReplacementReport.customerSigned ? (
                    <Tag color="green">Đã ký ({formatDateTime(currentReplacementReport.customerSignedAt)})</Tag>
                  ) : (
                    <Tag color="orange">Chưa ký</Tag>
                  )}
                </div>
              </div>
            </div>

            {/* Device Items */}
            {currentReplacementReport.items && currentReplacementReport.items.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>Thiết bị thay thế:</Text>
                {currentReplacementReport.items.map((item, idx) => (
                  <Card key={item.itemId || idx} size="small" style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <Tag color={item.isOldDevice ? "red" : "green"}>
                          {item.isOldDevice ? "Thiết bị cũ" : "Thiết bị mới"}
                        </Tag>
                        <Text strong style={{ marginLeft: 8 }}>{item.deviceModelName || "—"}</Text>
                      </div>
                      <Text type="secondary">SN: {item.deviceSerialNumber || "—"}</Text>
                    </div>

                    {/* Evidence Images */}
                    {item.evidenceUrls && item.evidenceUrls.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Bằng chứng:</Text>
                        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                          <Image.PreviewGroup>
                            {item.evidenceUrls.map((url, imgIdx) => (
                              <Image
                                key={imgIdx}
                                src={url}
                                width={80}
                                height={80}
                                style={{ objectFit: "cover", borderRadius: 4 }}
                              />
                            ))}
                          </Image.PreviewGroup>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Created By */}
            {currentReplacementReport.createdByStaff && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tạo bởi: {currentReplacementReport.createdByStaff.fullName} ({currentReplacementReport.createdByStaff.role}) - {formatDateTime(currentReplacementReport.createdAt)}
                </Text>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Spin />
            <div style={{ marginTop: 8 }}>Đang tải...</div>
          </div>
        )}
      </Modal>

      {/* PDF Preview Modal */}
      <Modal
        title="Xem trước biên bản thay thế (PDF)"
        open={pdfPreviewOpen}
        onCancel={() => setPdfPreviewOpen(false)}
        width={850}
        footer={[
          <Button key="close" onClick={() => setPdfPreviewOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<SwapOutlined />}
            onClick={handleFetchAndDownloadReplacementPdf}
          >
            Tải về
          </Button>,
        ]}
      >
        <div
          style={{
            width: "100%",
            height: "70vh",
            overflow: "auto",
            border: "1px solid #ddd",
            padding: 16,
            backgroundColor: "#fff",
          }}
          dangerouslySetInnerHTML={{ __html: pdfPreviewContent }}
        />
      </Modal>
    </div>
  );
}
