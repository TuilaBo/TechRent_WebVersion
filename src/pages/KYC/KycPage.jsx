import React, { useState, useEffect } from "react";
import {
  Steps, Card, Form, Input, DatePicker, Select, Upload, Button,
  Typography, Row, Col, Space, Result, Spin, message,
} from "antd";
import { IdcardOutlined, CheckCircleTwoTone, InboxOutlined, CameraOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { uploadKycDocumentsBatch, getMyKyc } from "../../lib/kycApi";
import { extractIdFieldsFE } from "../../../utils/kycOcrFE";

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

export default function KycPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search || "");
  const returnTo = search.get("return") || "/checkout";

  // 0 = Upload → 1 = Nhập thông tin → 2 = Xem lại & Gửi
  const [step, setStep] = useState(0);

  const [front, setFront] = useState([]);
  const [back, setBack] = useState([]);
  const [selfie, setSelfie] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [ocring, setOcring] = useState(false);

  const [kycStatus, setKycStatus] = useState(null);
  const [loadingKyc, setLoadingKyc] = useState(true);

  // ✅ GIỮ FORM LUÔN MOUNTED
  const [form] = Form.useForm();

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingKyc(true);
        const res = await getMyKyc();
        const kyc = res?.data || res;
        setKycStatus(kyc?.kycStatus || null);
      } finally {
        setLoadingKyc(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (kycStatus === "APPROVED" && returnTo) {
      const t = setTimeout(() => navigate(returnTo), 800);
      return () => clearTimeout(t);
    }
  }, [kycStatus, returnTo, navigate]);

  const UploadPanel = ({ label, icon, fileList, setFileList, height = 260 }) => {
    const f = fileList?.[0];
    const url = f ? f.thumbUrl || f.url || (f.originFileObj ? URL.createObjectURL(f.originFileObj) : "") : "";

    return (
      <div className="upload-panel-wrapper">
        <Text strong className="block mb-2" style={{ color: "#000" }}>{label}</Text>
        <Dragger
          multiple={false}
          fileList={fileList}
          showUploadList={false}
          beforeUpload={() => false}
          onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
          accept=".jpg,.jpeg,.png,.webp"
          listType="picture-card"
          className="w-full relative group" // Added group for hover effect
          style={{
            height, minHeight: height, padding: 0, borderRadius: 10, border: "1px solid #ddd",
            backgroundImage: url ? `url(${url})` : undefined, backgroundSize: "cover",
            backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundColor: "#fff",
            cursor: url ? 'pointer' : 'default', // Change cursor on hover when image is present
          }}
        >
          {/* This overlay will appear on hover when an image is uploaded */}
          {url && (
            <div 
              className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center transition-all duration-300"
              style={{ borderRadius: 10 }}
            >
              <Text className="text-white opacity-0 group-hover:opacity-100 font-semibold">Nhấp để thay đổi ảnh</Text>
            </div>
          )}

          {/* This content shows when no image is uploaded */}
          {!url && (
            <>
              <p className="ant-upload-drag-icon" style={{ color: "#000" }}>{icon}</p>
              <p className="ant-upload-text" style={{ color: "#000" }}>Kéo thả hoặc bấm để chọn</p>
              <p className="ant-upload-hint" style={{ color: "#666" }}>1 ảnh</p>
            </>
          )}
        </Dragger>
        {/* The "Chọn lại ảnh" button is now removed */}
      </div>
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
          <Title level={2} style={{ marginBottom: 8, color: "#000" }}>Xác minh danh tính (KYC)</Title>
          <Card className="rounded-xl mt-4" bodyStyle={{ padding: 20, background: "#fff" }} style={{ borderColor: "#ddd" }}>
            <Result
              status="success"
              title="KYC đã được phê duyệt"
              subTitle="Tài khoản của bạn đã được xác minh thành công!"
              extra={
                <Space>
                  <Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>
                  <Button type="primary" onClick={() => navigate(returnTo)} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
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

  // OCR (có thể gọi lại ở bước 1)
  const doOCR = async () => {
    const frontFile = front?.[0]?.originFileObj || front?.[0]?.file;
    const backFile  = back?.[0]?.originFileObj  || back?.[0]?.file;
    if (!frontFile && !backFile) return message.warning("Hãy chọn ít nhất ảnh mặt trước (tốt nhất thêm mặt sau).");

    setOcring(true);
    try {
      const f = await extractIdFieldsFE(frontFile, backFile);
      form.setFieldsValue({
        fullName:  f.fullName  || undefined,
        idNumber:  f.idNumber  || undefined,
        idType:    f.idType    || "CCCD",
        dob:       f.dobISO       ? dayjs(f.dobISO)       : undefined,
        expirationDate: f.issueDateISO ? dayjs(f.issueDateISO) : undefined,
        address:   f.address   || undefined,
      });
      message.success("Đã tự điền từ ảnh. Kiểm tra lại giúp mình nhé.");
    } catch (e) {
      console.error(e);
      message.error("OCR thất bại. Hãy thử ảnh rõ, thẳng và đủ sáng.");
    } finally {
      setOcring(false);
    }
  };

  // Bước 0 → chạy OCR → qua bước 1 để user kiểm tra/điền tay
  const continueFromStep0 = async () => {
    const frontFile = front?.[0]?.originFileObj || front?.[0]?.file;
    const backFile  = back?.[0]?.originFileObj  || back?.[0]?.file;
    if (!frontFile && !backFile) return message.warning("Hãy chọn ít nhất ảnh mặt trước (tốt nhất thêm mặt sau).");

    setOcring(true);
    try {
      const f = await extractIdFieldsFE(frontFile, backFile);
      form.setFieldsValue({
        fullName:  f.fullName  || undefined,
        idNumber:  f.idNumber  || undefined,
        idType:    f.idType    || "CCCD",
        dob:       f.dobISO       ? dayjs(f.dobISO)       : undefined,
        expirationDate: f.issueDateISO ? dayjs(f.issueDateISO) : undefined,
        address:   f.address   || undefined,
      });
      message.success("Đã tự điền từ ảnh. Vui lòng kiểm tra và bổ sung.");
    } catch (e) {
      console.error(e);
      message.error("OCR thất bại. Bạn có thể điền tay ở bước tiếp theo.");
    } finally {
      setOcring(false);
      setStep(1);
    }
  };

  // ✅ Form luôn mounted — chỉ ẩn/hiện theo step
  const formSection = (
    <div style={{ display: step === 1 ? "block" : "none" }}>
      <Form form={form} layout="vertical" preserve>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="Họ tên" name="fullName" rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}>
              <Input placeholder="VD: LÊ THỊ HỒNG VƯƠNG" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Số CCCD/CMND" name="idNumber" rules={[{ required: true, message: "Vui lòng nhập số giấy tờ" }]}>
              <Input placeholder="001183000001" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Loại giấy tờ" name="idType" rules={[{ required: true, message: "Chọn loại giấy tờ" }]} initialValue="CMND">
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
            <Form.Item label="Ngày hết hạn" name="expirationDate">
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
        
        <Button type="primary" onClick={() => setStep(2)} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
          Tiếp tục
        </Button>
      </Space>
    </div>
  );

  const submitAll = async () => {
    try {
      // ✅ validate các field bắt buộc dù đang ẩn
      await form.validateFields(["fullName", "idNumber", "idType"]);

      const v = form.getFieldsValue(true); // lấy tất cả field, kể cả đang ẩn
      setSubmitting(true);

      await uploadKycDocumentsBatch({
        front:  front?.[0]?.originFileObj || front?.[0]?.file || null,
        back:   back?.[0]?.originFileObj  || back?.[0]?.file  || null,
        selfie: selfie?.[0]?.originFileObj|| selfie?.[0]?.file|| null,

        fullName:            (v.fullName || "").trim(),
        identificationCode:  (v.idNumber || "").trim(),
        typeOfIdentification:(v.idType   || "").trim(),
        birthday:            v.dob ? dayjs(v.dob).format("YYYY-MM-DD") : "",
        expirationDate:      v.expirationDate ? dayjs(v.expirationDate).format("YYYY-MM-DD") : "",
        permanentAddress:    (v.address || "").trim(),
      });

      toast.success("Đã gửi thông tin KYC");
      setTimeout(() => navigate(returnTo), 800);
    } catch (e) {
      if (e?.errorFields) return; // lỗi validate
      toast.error(e?.response?.data?.message || e?.message || "Gửi KYC thất bại");
    } finally {
      setSubmitting(false);
    }
  };

    const reviewSection = (
    <div style={{ display: step === 2 ? "block" : "none" }}>
      <div className="max-w-4xl mx-auto">
        <Card type="inner" title="Xem lại thông tin" className="mb-3" style={{ borderColor: "#ddd" }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Title level={5}>Thông tin đã nhập</Title>
              <Row gutter={[8, 8]}>
                {(() => {
                  const v = form.getFieldsValue(true);
                  const row = (label, value) => (
                    <React.Fragment key={label}>
                      <Col span={8}><Text type="secondary" style={{ color: "#666" }}>{label}</Text></Col>
                      <Col span={16}><Text strong style={{ color: "#000" }}>{value || "—"}</Text></Col>
                    </React.Fragment>
                  );
                  return (
                    <>
                      {row("Họ tên", v.fullName)}
                      {row("Số giấy tờ", v.idNumber)}
                      {row("Loại giấy tờ", v.idType)}
                      {row("Ngày sinh", v.dob ? dayjs(v.dob).format("YYYY-MM-DD") : "")}
                      {row("Ngày hết hạn", v.expirationDate ? dayjs(v.expirationDate).format("YYYY-MM-DD") : "")}
                      {row("Địa chỉ", v.address)}
                    </>
                  );
                })()}
              </Row>
            </Col>
            <Col xs={24} md={12}>
              <Title level={5}>Ảnh đã tải lên</Title>
              <Row gutter={[8, 8]}>
                {[ { label: 'Mặt trước', file: front[0] }, { label: 'Mặt sau', file: back[0] }, { label: 'Selfie', file: selfie[0] } ].map(({ label, file }) => {
                  const url = file ? (file.thumbUrl || file.url || (file.originFileObj ? URL.createObjectURL(file.originFileObj) : "")) : "";
                  return (
                    <Col span={8} key={label}>
                      <Text type="secondary" className="block text-center mb-1" style={{ fontSize: 12 }}>{label}</Text>
                      <div style={{ height: 80, background: '#f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
                        {url ? <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="flex items-center justify-center h-full"><Text type="secondary" style={{ fontSize: 11 }}>Chưa có ảnh</Text></div>}
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </Col>
          </Row>
        </Card>

        <Space>
          <Button onClick={() => setStep(1)}>Sửa thông tin</Button>
          <Button onClick={() => setStep(0)}>Chọn lại ảnh</Button>
          <Button type="primary" loading={submitting} onClick={submitAll} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
            Gửi xác minh
          </Button>
        </Space>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Title level={2} style={{ marginBottom: 8, color: "#000" }}>Xác minh danh tính (KYC)</Title>
        <Text type="secondary" style={{ color: "#666" }}>
          Hoàn tất các bước sau để xác minh tài khoản và tiếp tục thuê thiết bị . 
        </Text>

        <Card className="rounded-xl mt-4" bodyStyle={{ padding: 20, background: "#fff" }} style={{ borderColor: "#ddd" }}>
          <Steps
            current={step}
            items={[
              { title: "Tải giấy tờ", icon: <IdcardOutlined style={{ color: "#000" }} /> },
              { title: "Nhập thông tin", icon: <IdcardOutlined style={{ color: "#000" }} /> },
              { title: "Xác nhận & gửi", icon: <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 20 }} /> },
            ]}
            responsive size="small" style={{ marginBottom: 16 }}
          />

          {/* STEP 0 */}
          {step === 0 && (
            <Spin spinning={ocring}>
              <div className="max-w-5xl mx-auto">
                <Row gutter={16}>
                  <Col xs={24} md={8}><UploadPanel label="Mặt trước" icon={<InboxOutlined style={{ color: "#000" }} />} fileList={front} setFileList={setFront} /></Col>
                  <Col xs={24} md={8}><UploadPanel label="Mặt sau"   icon={<InboxOutlined style={{ color: "#000" }} />} fileList={back}  setFileList={setBack}  /></Col>
                  <Col xs={24} md={8}><UploadPanel label="Selfie cầm giấy tờ" icon={<CameraOutlined style={{ color: "#000" }} />} fileList={selfie} setFileList={setSelfie} /></Col>
                </Row>
                <Space className="mt-3" wrap>
                  <Button type="primary" onClick={continueFromStep0} loading={ocring} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
                    Tiếp tục
                  </Button>
                  <Button onClick={() => setStep(1)} disabled={ocring}>Điền tay (bỏ qua OCR)</Button>
                </Space>
              </div>
            </Spin>
          )}

          {/* STEP 1 (always mounted, only hidden/visible) */}
          {formSection}

          {/* STEP 2 */}
          {reviewSection}
        </Card>
      </div>
    </div>
  );
}
