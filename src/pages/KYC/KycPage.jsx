// src/pages/kyc/KycPage.jsx
import React, { useState } from "react";
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
} from "antd";
import {
  UserOutlined,
  IdcardOutlined,
  CheckCircleTwoTone,
  InboxOutlined,
  CameraOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

export default function KycPage() {
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();

  // Chỉ để hiển thị UI upload (không upload lên server)
  const [front, setFront] = useState([]);
  const [back, setBack] = useState([]);
  const [selfie, setSelfie] = useState([]);
  const [done, setDone] = useState(false);

  const next = () => setStep((s) => s + 1);
  const prev = () => setStep((s) => s - 1);

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
              { title: "Thông tin", icon: <UserOutlined style={{ color: "#000" }} /> },
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

          {/* BƯỚC 2: THÔNG TIN (không validate) */}
          {step === 1 && (
            <div className="max-w-3xl mx-auto">
              <Form form={form} layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Họ và tên" name="fullName">
                      <Input placeholder="Nguyễn Văn A" style={{ borderColor: "#ddd" }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Số giấy tờ" name="idNumber">
                      <Input placeholder="CCCD/CMND/Passport" style={{ borderColor: "#ddd" }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item label="Loại giấy tờ" name="idType" initialValue="cccd">
                      <Select style={{ borderColor: "#ddd" }}>
                        <Option value="cccd">Căn cước công dân</Option>
                        <Option value="cmnd">Chứng minh nhân dân</Option>
                        <Option value="passport">Hộ chiếu</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Ngày sinh" name="dob">
                      <DatePicker style={{ width: "100%", borderColor: "#ddd" }} format="DD/MM/YYYY" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Ngày cấp" name="issueDate">
                      <DatePicker style={{ width: "100%", borderColor: "#ddd" }} format="DD/MM/YYYY" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Địa chỉ (trên giấy tờ)" name="address">
                  <Input placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" style={{ borderColor: "#ddd" }} />
                </Form.Item>

                <Space>
                  <Button onClick={prev} style={{ borderColor: "#ddd", color: "#000" }}>Quay lại</Button>
                  <Button type="primary" onClick={next} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
                    Tiếp tục
                  </Button>
                </Space>
              </Form>
            </div>
          )}

          {/* BƯỚC 3: XÁC NHẬN */}
          {step === 2 && !done && (
            <div className="max-w-4xl mx-auto">
              <Row gutter={16}>
                <Col xs={24} md={14}>
                  <Card type="inner" title="Xem lại thông tin" className="mb-3" style={{ borderColor: "#ddd" }}>
                    <Row gutter={[8, 8]}>
                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Họ tên</Text>
                      </Col>
                      <Col span={16}>
                        <Text strong style={{ color: "#000" }}>{form.getFieldValue("fullName") || "—"}</Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Số giấy tờ</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>{form.getFieldValue("idNumber") || "—"}</Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Loại giấy tờ</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>
                          {form.getFieldValue("idType") === "cccd"
                            ? "Căn cước công dân"
                            : form.getFieldValue("idType") === "cmnd"
                            ? "Chứng minh nhân dân"
                            : form.getFieldValue("idType") === "passport"
                            ? "Hộ chiếu"
                            : "—"}
                        </Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Ngày sinh</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>
                          {form.getFieldValue("dob")?.format?.("DD/MM/YYYY") || "—"}
                        </Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Ngày cấp</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>
                          {form.getFieldValue("issueDate")?.format?.("DD/MM/YYYY") || "—"}
                        </Text>
                      </Col>

                      <Col span={8}>
                        <Text type="secondary" style={{ color: "#666" }}>Địa chỉ</Text>
                      </Col>
                      <Col span={16}>
                        <Text style={{ color: "#000" }}>{form.getFieldValue("address") || "—"}</Text>
                      </Col>
                    </Row>
                  </Card>

                  <Space>
                    <Button onClick={prev} style={{ borderColor: "#ddd", color: "#000" }}>Quay lại</Button>
                    <Button type="primary" onClick={() => setDone(true)} style={{ background: "#000", borderColor: "#000", color: "#fff" }}>
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