// src/pages/kyc/KycPage.jsx
import React, { useState, useEffect } from "react";
import {
  Steps,
  Card,
  Form,
  Input,
  DatePicker,
  Select,
  Upload,
  Button,
  Typography,
  Row,
  Col,
  Space,
  Result,
  Alert,
  Spin,
} from "antd";
import {
  UserOutlined,
  IdcardOutlined,
  CheckCircleTwoTone,
  InboxOutlined,
  CameraOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import { uploadKycDocumentsBatch, getMyKyc } from "../../lib/kycApi";

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

export default function KycPage() {
  const [step, setStep] = useState(0);

  // Chỉ để hiển thị UI upload (không upload lên server)
  const [front, setFront] = useState([]);
  const [back, setBack] = useState([]);
  const [selfie, setSelfie] = useState([]);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // KYC status checking
  const [kycStatus, setKycStatus] = useState(null);
  const [loadingKyc, setLoadingKyc] = useState(true);

  const next = () => setStep((s) => s + 1);
  const prev = () => setStep((s) => s - 1);

  // Check KYC status on mount
  useEffect(() => {
    const checkKycStatus = async () => {
      try {
        setLoadingKyc(true);
        const response = await getMyKyc();
        console.log("Raw KYC response:", response);
        
        // Handle different response structures
        const kyc = response?.data || response;
        console.log("Parsed KYC data:", kyc);
        console.log("KYC status:", kyc?.kycStatus);
        
        setKycStatus(kyc?.kycStatus);
      } catch (err) {
        console.error("Error checking KYC status:", err);
        // If error, assume no KYC exists yet
        setKycStatus(null);
      } finally {
        setLoadingKyc(false);
      }
    };
    checkKycStatus();
  }, []);

  /**
   * Panel upload: Ảnh fill-full khung, cao mặc định 260px.
   * - showUploadList=false để không hiện thumbnail mặc định của AntD
   * - dùng backgroundImage + cover để lấp đầy khung
   */
  const UploadPanel = ({
    label,
    icon = <InboxOutlined />,
    fileList,
    setFileList,
    height = 260, // bạn có thể tăng 280/300 nếu muốn
  }) => {
    const getPreviewUrl = (fl) => {
      const f = fl?.[0];
      if (!f) return "";
      return f.thumbUrl || f.url || (f.originFileObj ? URL.createObjectURL(f.originFileObj) : "");
    };
    const url = getPreviewUrl(fileList);

    return (
      <>
        <Text strong className="block mb-2" style={{ color: "#000" }}>{label}</Text>
        <Dragger
          multiple={false}
          fileList={fileList}
          showUploadList={false}
          beforeUpload={() => false}  // UI-only
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
              <p className="ant-upload-drag-icon" style={{ color: "#000" }}>{icon}</p>
              <p className="ant-upload-text" style={{ color: "#000" }}>Kéo thả hoặc bấm để chọn</p>
              <p className="ant-upload-hint" style={{ color: "#666" }}>1 ảnh</p>
            </>
          )}
        </Dragger>
      </>
    );
  };

  // Show loading while checking KYC status
  if (loadingKyc) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }


  // Show success if KYC was approved
  if (kycStatus === "APPROVED") {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Title level={2} style={{ marginBottom: 8, color: "#000" }}>
            Xác minh danh tính (KYC)
          </Title>
          
          <Card className="rounded-xl mt-4" bodyStyle={{ padding: 20, background: "#fff" }} style={{ borderColor: "#ddd" }}>
            <Result
              status="success"
              title="KYC đã được phê duyệt"
              subTitle="Tài khoản của bạn đã được xác minh thành công!"
              extra={
                <Button 
                  type="primary" 
                  onClick={() => (window.location.href = "/")}
                  style={{ background: "#000", borderColor: "#000", color: "#fff" }}
                >
                  Về trang chủ
                </Button>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Title level={2} style={{ marginBottom: 8, color: "#000" }}>
          Xác minh danh tính (KYC)
        </Title>
        <Text type="secondary" style={{ color: "#666" }}>
          Hoàn tất các bước sau để xác minh tài khoản và tiếp tục thuê thiết bị.
        </Text>


        <Card className="rounded-xl mt-4" bodyStyle={{ padding: 20, background: "#fff" }} style={{ borderColor: "#ddd" }}>
          <Steps
            current={step}
            items={[
              { title: "Tải giấy tờ", icon: <IdcardOutlined style={{ color: "#000" }} /> },
              { title: "Xác nhận", icon: <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 20 }} /> },
            ]}
            responsive
            size="small"
            style={{ marginBottom: 16 }}
          />

          {/* BƯỚC 1: UPLOAD GIẤY TỜ (đứng trước) */}
          {step === 0 && (
            <div className="max-w-5xl mx-auto">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <UploadPanel
                    label="Mặt trước"
                    icon={<InboxOutlined style={{ color: "#000" }} />}
                    fileList={front}
                    setFileList={setFront}
                    height={260}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <UploadPanel
                    label="Mặt sau"
                    icon={<InboxOutlined style={{ color: "#000" }} />}
                    fileList={back}
                    setFileList={setBack}
                    height={260}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <UploadPanel
                    label="Selfie cầm giấy tờ"
                    icon={<CameraOutlined style={{ color: "#000" }} />}
                    fileList={selfie}
                    setFileList={setSelfie}
                    height={260}
                  />
                </Col>
              </Row>

              <Space className="mt-3">
                <Button type="primary" onClick={next} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
                  Tiếp tục
                </Button>
              </Space>
            </div>
          )}

          {/* BƯỚC 2: XÁC NHẬN & GỬI ẢNH (bỏ qua nhập thông tin) */}

          {step === 1 && !done && (
            <div className="max-w-4xl mx-auto">
              <Row gutter={16}>
                <Col xs={24} md={14}>
                  <Card type="inner" title="Xem lại thông tin" className="mb-3" style={{ borderColor: "#ddd" }}>
                    <Row gutter={[8, 8]}>
                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Họ tên</Text>
                      </Col>
                      <Col span={16}>
                        <Text strong style={{ color: "#000" }}>—</Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Số giấy tờ</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>—</Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Loại giấy tờ</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>—</Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Ngày sinh</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>—</Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Ngày cấp</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>—</Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Địa chỉ</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>—</Text>
                      </Col>
                    </Row>
                  </Card>

                  <Space>
                    <Button onClick={prev} style={{ borderColor: "#ddd", color: "#000" }}>Quay lại</Button>
                    <Button
                      type="primary"
                      loading={submitting}
                      onClick={async () => {
                        try {
                          setSubmitting(true);
                          const payload = {
                            front: front?.[0]?.originFileObj || front?.[0]?.file || null,
                            back: back?.[0]?.originFileObj || back?.[0]?.file || null,
                            selfie: selfie?.[0]?.originFileObj || selfie?.[0]?.file || null,
                          };
                          if (!payload.front && !payload.back && !payload.selfie) {
                            toast.error("Vui lòng chọn ít nhất 1 ảnh");
                            setSubmitting(false);
                            return;
                          }
                          await uploadKycDocumentsBatch(payload);
                          toast.success("Đã gửi ảnh KYC");
                          setDone(true);
                          // Reset KYC status to check again after upload
                          setKycStatus(null);
                        } catch (e) {
                          toast.error(e?.response?.data?.message || e?.message || "Gửi ảnh KYC thất bại");
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      style={{ background: "#000", borderColor: "#000", color: "#fff" }}
                    >
                      Gửi xác minh
                    </Button>
                  </Space>
                </Col>

                <Col xs={24} md={10}>
                  <Card type="inner" title="Ảnh đã tải lên" style={{ borderColor: "#ddd" }}>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <Text type="secondary" style={{ color: "#666" }}>Mặt trước</Text>
                        {front[0] && (
                          <div
                            style={{
                              width: "100%",
                              paddingTop: "66%",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              backgroundImage: `url(${
                                front[0].thumbUrl ||
                                front[0].url ||
                                (front[0].originFileObj
                                  ? URL.createObjectURL(front[0].originFileObj)
                                  : "")
                              })`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }}
                          />
                        )}
                      </div>

                      <div>
                        <Text type="secondary" style={{ color: "#666" }}>Mặt sau</Text>
                        {back[0] && (
                          <div
                            style={{
                              width: "100%",
                              paddingTop: "66%",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              backgroundImage: `url(${
                                back[0].thumbUrl ||
                                back[0].url ||
                                (back[0].originFileObj
                                  ? URL.createObjectURL(back[0].originFileObj)
                                  : "")
                              })`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }}
                          />
                        )}
                      </div>

                      <div className="col-span-2">
                        <Text type="secondary" style={{ color: "#666" }}>Selfie</Text>
                        {selfie[0] && (
                          <div
                            style={{
                              width: "100%",
                              paddingTop: "56%",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              backgroundImage: `url(${
                                selfie[0].thumbUrl ||
                                selfie[0].url ||
                                (selfie[0].originFileObj
                                  ? URL.createObjectURL(selfie[0].originFileObj)
                                  : "")
                              })`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          {/* HOÀN TẤT (UI) */}
          {done && (
            <Result
              status="success"
              title="Đã gửi thông tin KYC"
              subTitle="Chúng tôi sẽ kiểm tra và phản hồi sớm nhất. Cảm ơn bạn!"
              extra={
                <Button type="primary" onClick={() => (window.location.href = "/")} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
                  Về trang chủ
                </Button>
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
}