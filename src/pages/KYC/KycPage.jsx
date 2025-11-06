// src/pages/kyc/KycPage.jsx
import React, { useState, useEffect } from "react";
import {
  Steps, Card, Form, Input, DatePicker, Select, Upload, Button,
  Typography, Row, Col, Space, Result, Spin, message,
} from "antd";
import {
  IdcardOutlined, CheckCircleTwoTone, InboxOutlined, CameraOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { uploadKycDocumentsBatch, getMyKyc } from "../../lib/kycApi";

// ⚠️ DÙNG HELPER OCR + PARSE CỦA BẠN (FE-ONLY)
import { extractIdFieldsFE } from "../../../utils/kycOcrFE";

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

export default function KycPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search || "");
  const returnTo = search.get("return") || "/checkout";

  const [step, setStep] = useState(0);

  // Upload previews (UI only)
  const [front, setFront] = useState([]);
  const [back, setBack] = useState([]);
  const [selfie, setSelfie] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [ocring, setOcring] = useState(false);

  // KYC status
  const [kycStatus, setKycStatus] = useState(null);
  const [loadingKyc, setLoadingKyc] = useState(true);

  // Step 2 form
  const [form] = Form.useForm();

  useEffect(() => {
    const checkKycStatus = async () => {
      try {
        setLoadingKyc(true);
        const res = await getMyKyc();
        const kyc = res?.data || res;
        setKycStatus(kyc?.kycStatus || null);
      } catch {
        setKycStatus(null);
      } finally {
        setLoadingKyc(false);
      }
    };
    checkKycStatus();
  }, []);

  useEffect(() => {
    if (kycStatus === "APPROVED" && returnTo) {
      const t = setTimeout(() => navigate(returnTo), 800);
      return () => clearTimeout(t);
    }
  }, [kycStatus, returnTo, navigate]);

  /** ---------------- Upload card with "Chọn lại ảnh" ---------------- */
  const UploadPanel = ({ label, icon, fileList, setFileList, height = 260 }) => {
    const f = fileList?.[0];
    const url = f
      ? f.thumbUrl || f.url || (f.originFileObj ? URL.createObjectURL(f.originFileObj) : "")
      : "";
    return (
      <>
        <Text strong className="block mb-2" style={{ color: "#000" }}>
          {label}
        </Text>
        <Dragger
          multiple={false}
          fileList={fileList}
          showUploadList={false}
          beforeUpload={() => false}
          onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
          accept=".jpg,.jpeg,.png,.webp"
          listType="picture-card"
          className="w-full"
          style={{
            height,
            minHeight: height,
            padding: 0,
            borderRadius: 10,
            border: "1px solid #ddd",
            backgroundImage: url ? `url(${url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "#fff",
          }}
        >
          {!url && (
            <>
              <p className="ant-upload-drag-icon" style={{ color: "#000" }}>
                {icon}
              </p>
              <p className="ant-upload-text" style={{ color: "#000" }}>
                Kéo thả hoặc bấm để chọn
              </p>
              <p className="ant-upload-hint" style={{ color: "#666" }}>1 ảnh</p>
            </>
          )}
        </Dragger>
        <div className="mt-2">
          <Button size="small" onClick={() => setFileList([])}>Chọn lại ảnh</Button>
        </div>
      </>
    );
  };

  if (loadingKyc) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (kycStatus === "APPROVED") {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Title level={2} style={{ marginBottom: 8, color: "#000" }}>
            Xác minh danh tính (KYC)
          </Title>
          <Card
            className="rounded-xl mt-4"
            bodyStyle={{ padding: 20, background: "#fff" }}
            style={{ borderColor: "#ddd" }}
          >
            <Result
              status="success"
              title="KYC đã được phê duyệt"
              subTitle="Tài khoản của bạn đã được xác minh thành công!"
              extra={
                <Space>
                  <Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>
                  <Button
                    type="primary"
                    onClick={() => navigate(returnTo)}
                    style={{ background: "#000", borderColor: "#000", color: "#fff" }}
                  >
                    Tiếp tục đặt đơn
                  </Button>
                </Space>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  /** ---------------- OCR riêng cho Step 1 button (rerun nếu cần) ---------------- */
  const doOCR = async () => {
    const frontFile = front?.[0]?.originFileObj || front?.[0]?.file;
    const backFile  = back?.[0]?.originFileObj  || back?.[0]?.file;

    if (!frontFile && !backFile) {
      message.warning("Hãy chọn ít nhất ảnh mặt trước (tốt nhất thêm mặt sau).");
      return;
    }

    setOcring(true);
    try {
      const f = await extractIdFieldsFE(frontFile, backFile);

      form.setFieldsValue({
        fullName : f.fullName || undefined,
        idNumber : f.idNumber || undefined,
        idType   : f.idType || "CCCD",
        dob      : f.dobISO ? dayjs(f.dobISO) : undefined,
        issueDate: f.issueDateISO ? dayjs(f.issueDateISO) : undefined,
        address  : f.address || undefined,
      });

      message.success("Đã tự điền từ ảnh. Kiểm tra lại giúp mình nhé.");
    } catch (e) {
      console.error(e);
      message.error("OCR thất bại. Hãy thử ảnh rõ, thẳng và đủ sáng.");
    } finally {
      setOcring(false);
    }
  };

  /** ---------------- Từ Step 0 -> OCR -> auto fill -> sang Step 2 ---------------- */
  const continueFromStep0 = async () => {
    const frontFile = front?.[0]?.originFileObj || front?.[0]?.file;
    const backFile  = back?.[0]?.originFileObj  || back?.[0]?.file;

    if (!frontFile && !backFile) {
      message.warning("Hãy chọn ít nhất ảnh mặt trước (tốt nhất thêm mặt sau).");
      return;
    }

    setOcring(true);
    try {
      const f = await extractIdFieldsFE(frontFile, backFile);

      form.setFieldsValue({
        fullName : f.fullName || undefined,
        idNumber : f.idNumber || undefined,
        idType   : f.idType || "CCCD",
        dob      : f.dobISO ? dayjs(f.dobISO) : undefined,
        issueDate: f.issueDateISO ? dayjs(f.issueDateISO) : undefined,
        address  : f.address || undefined,
      });

      setStep(2); // OCR thành công -> sang bước 2 để xác nhận & gửi
      message.success("Đã tự điền từ ảnh. Vui lòng kiểm tra lại.");
    } catch (e) {
      console.error(e);
      message.error("OCR thất bại. Hệ thống chuyển bạn sang bước 1 để điền tay.");
      setStep(1);
    } finally {
      setOcring(false);
    }
  };

  const submitAll = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        front: front?.[0]?.originFileObj || front?.[0]?.file || null,
        back: back?.[0]?.originFileObj || back?.[0]?.file || null,
        selfie: selfie?.[0]?.originFileObj || selfie?.[0]?.file || null,

        fullName: values.fullName,
        idNumber: values.idNumber,
        idType: values.idType,
        dateOfBirth: values.dob ? values.dob.format("YYYY-MM-DD") : null,
        issueDate: values.issueDate ? values.issueDate.format("YYYY-MM-DD") : null,
        address: values.address || null,
      };
      await uploadKycDocumentsBatch(payload);
      toast.success("Đã gửi thông tin KYC");
      setTimeout(() => navigate(returnTo), 800);
    } catch (e) {
      if (e?.errorFields) return; // lỗi validate của antd form
      toast.error(e?.response?.data?.message || e?.message || "Gửi KYC thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Title level={2} style={{ marginBottom: 8, color: "#000" }}>
          Xác minh danh tính (KYC)
        </Title>
        <Text type="secondary" style={{ color: "#666" }}>
          Hoàn tất các bước sau để xác minh tài khoản và tiếp tục thuê thiết bị.
        </Text>

        <Card
          className="rounded-xl mt-4"
          bodyStyle={{ padding: 20, background: "#fff" }}
          style={{ borderColor: "#ddd" }}
        >
          <Steps
            current={step}
            items={[
              { title: "Tải giấy tờ", icon: <IdcardOutlined style={{ color: "#000" }} /> },
              { title: "Nhập thông tin", icon: <IdcardOutlined style={{ color: "#000" }} /> },
              { title: "Xác nhận & gửi", icon: <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 20 }} /> },
            ]}
            responsive
            size="small"
            style={{ marginBottom: 16 }}
          />

          {/* STEP 0: Upload images */}
          {step === 0 && (
            <Spin spinning={ocring}>
              <div className="max-w-5xl mx-auto">
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <UploadPanel
                      label="Mặt trước"
                      icon={<InboxOutlined style={{ color: "#000" }} />}
                      fileList={front}
                      setFileList={setFront}
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <UploadPanel
                      label="Mặt sau"
                      icon={<InboxOutlined style={{ color: "#000" }} />}
                      fileList={back}
                      setFileList={setBack}
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <UploadPanel
                      label="Selfie cầm giấy tờ"
                      icon={<CameraOutlined style={{ color: "#000" }} />}
                      fileList={selfie}
                      setFileList={setSelfie}
                    />
                  </Col>
                </Row>
                <Space className="mt-3">
                  {/* Tiếp tục: chạy OCR -> tự điền -> sang bước 2 */}
                  <Button
                    type="primary"
                    onClick={continueFromStep0}
                    loading={ocring}
                    style={{ background: "#000", borderColor: "#000", color: "#fff" }}
                  >
                    Tiếp tục
                  </Button>
                  {/* Tuỳ chọn: bỏ qua OCR để điền tay ở bước 1 */}
                  <Button onClick={() => setStep(1)} disabled={ocring}>
                    Điền tay (bỏ qua OCR)
                  </Button>
                </Space>
              </div>
            </Spin>
          )}

          {/* STEP 1: Form fields + OCR (rerun) */}
          {step === 1 && (
            <div className="max-w-4xl mx-auto">
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Họ tên"
                      name="fullName"
                      rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
                    >
                      <Input placeholder="VD: LÊ THỊ HỒNG VƯƠNG" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Số CCCD/CMND"
                      name="idNumber"
                      rules={[{ required: true, message: "Vui lòng nhập số giấy tờ" }]}
                    >
                      <Input placeholder="001183000001" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Loại giấy tờ"
                      name="idType"
                      rules={[{ required: true, message: "Chọn loại giấy tờ" }]}
                      initialValue="CMND"
                    >
                      <Select>
                        <Option value="CCCD">CCCD</Option>
                        <Option value="CMND">CMND</Option>
                        <Option value="PASSPORT">Passport</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Ngày sinh" name="dob">
                      <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Ngày hết hạn" name="issueDate">
                      <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Địa chỉ thường trú" name="address">
                      <Input placeholder="Số nhà/đường, phường/xã, quận/huyện, tỉnh/thành" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>

              <Space className="mt-1" wrap>
                <Button onClick={() => setStep(0)}>Quay lại</Button>
                <Button loading={ocring} onClick={doOCR}>Tự điền từ ảnh (OCR)</Button>
                <Button
                  type="primary"
                  onClick={() => setStep(2)}
                  style={{ background: "#000", borderColor: "#000", color: "#fff" }}
                >
                  Tiếp tục
                </Button>
              </Space>
            </div>
          )}

          {/* STEP 2: Confirm & submit */}
          {step === 2 && (
            <div className="max-w-4xl mx-auto">
              <Card type="inner" title="Xem lại thông tin" className="mb-3" style={{ borderColor: "#ddd" }}>
                <Row gutter={[8, 8]}>
                  {(() => {
                    const v = form.getFieldsValue();
                    const row = (label, value) => (
                      <>
                        <Col span={8}>
                          <Text type="secondary" style={{ color: "#666" }}>
                            {label}
                          </Text>
                        </Col>
                        <Col span={16}>
                          <Text strong style={{ color: "#000" }}>{value || "—"}</Text>
                        </Col>
                      </>
                    );
                    return (
                      <>
                        {row("Họ tên", v.fullName)}
                        {row("Số giấy tờ", v.idNumber)}
                        {row("Loại giấy tờ", v.idType)}
                        {row("Ngày sinh", v.dob ? v.dob.format("YYYY-MM-DD") : "")}
                        {row("Ngày hết hạn", v.issueDate ? v.issueDate.format("YYYY-MM-DD") : "")}
                        {row("Địa chỉ thường trú", v.address)}
                      </>
                    );
                  })()}
                </Row>
              </Card>

              <Space>
                <Button onClick={() => setStep(1)}>Quay lại</Button>
                <Button
                  type="primary"
                  loading={submitting}
                  onClick={submitAll}
                  style={{ background: "#000", borderColor: "#000", color: "#fff" }}
                >
                 Gửi xác minh
                </Button>
              </Space>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
