import React, { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Descriptions,
  Button,
  Space,
  Form,
  Input,
  message,
  Progress,
  Tabs,
  Skeleton,
  Alert,
  Select,
} from "antd";
import { Link } from "react-router-dom";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  CheckCircleTwoTone,
  ExclamationCircleTwoTone,
  IdcardOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  EditOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  fetchMyCustomerProfile,
  updateMyCustomerProfile,
} from "../lib/customerApi";
import { fetchDistrictsHCM, fetchWardsByDistrict } from "../lib/locationVn";
import { BANKS } from "../../Bank";
const { Title, Text, Paragraph } = Typography;

// --- helpers: bỏ dấu & chuẩn hóa chuỗi để so khớp ---
const normalize = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");

export default function CustomerProfile() {
  const { isAuthenticated, user } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [infoForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  const [saving, setSaving] = useState(false);
  const [submittingPw, setSubmittingPw] = useState(false);

  // Địa giới HCM
  const [districts, setDistricts] = useState([]); // [{value,label}]
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [wardOptions, setWardOptions] = useState([]); // [{value,label}] theo quận
  const [loadingWards, setLoadingWards] = useState(false);

  // Parse địa chỉ đã lưu để prefill quận/phường/đường
  // TÁCH địa chỉ lưu trong shippingAddress ra 3 phần:
  // addressLine (số nhà + tên đường), ward, district
  const prefillAddress = async (addr, ds) => {
    if (!addr || !ds?.length) return;

    // 1) cắt theo dấu phẩy & bỏ các phần là "TP. Hồ Chí Minh"
    const isCity = (s) => {
      const n = normalize(s);
      return /(^(tp|thanh pho)\s*ho chi minh$)|(^ho chi minh city$)/.test(n);
    };
    const parts = addr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const partsNoCity = parts.filter((p) => !isCity(p));

    // 2) tìm quận theo label trong danh sách districts
    const joined = normalize(partsNoCity.join(", "));
    const foundDistrict = ds.find((d) => joined.includes(normalize(d.label)));

    if (!foundDistrict) {
      // fallback: không tìm được quận -> lấy phần đầu làm addressLine
      infoForm.setFieldsValue({ addressLine: partsNoCity[0] || addr });
      return;
    }

    // set quận để mở select phường
    setSelectedDistrict(foundDistrict.value);
    infoForm.setFieldsValue({ districtCode: foundDistrict.value });

    // 3) tải phường theo quận & tìm phường phù hợp
    setLoadingWards(true);
    try {
      const wards = await fetchWardsByDistrict(foundDistrict.value);
      setWardOptions(wards);

      const foundWard = wards.find((w) => joined.includes(normalize(w.label)));
      if (foundWard) {
        infoForm.setFieldsValue({ wardCode: foundWard.value });
      }

      // 4) Loại bỏ ward & district để còn lại CHỈ "số nhà + tên đường"
      const addressParts = partsNoCity.filter((p) => {
        const np = normalize(p);
        if (foundWard && np === normalize(foundWard.label)) return false;
        if (np === normalize(foundDistrict.label)) return false;
        return true;
      });

      // thường phần đầu chính là số nhà + đường; nếu có nhiều phần còn lại, join lại
      const addressLine = addressParts[0] || addressParts.join(", ");
      infoForm.setFieldsValue({ addressLine });
    } finally {
      setLoadingWards(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        // 1) Profile
        const c = await fetchMyCustomerProfile();
        const normalized = {
          customerID: c?.customerId ?? c?.id ?? "-",
          email: c?.email ?? user?.email ?? "-",
          phone: c?.phoneNumber ?? "",
          fullName: c?.fullName ?? c?.username ?? "",
          createdAt: c?.createdAt ?? "-",
          status: c?.status || user?.isActive ? "active" : "inactive",
          shippingAddress: c?.shippingAddress ?? "",
          kycStatus: (c?.kycStatus || "unverified").toLowerCase(),
          bankAccountNumber: c?.bankAccountNumber ?? "",
          bankName: c?.bankName ?? "",
          bankAccountHolder: c?.bankAccountHolder ?? "",
        };
        if (!mounted) return;
        setCustomer(normalized);

        infoForm.setFieldsValue({
          fullName: normalized.fullName,
          phone: normalized.phone,
          districtCode: undefined,
          wardCode: undefined,
          addressLine: "",
          bankAccountNumber: normalized.bankAccountNumber,
          bankName: normalized.bankName,
          bankAccountHolder: normalized.bankAccountHolder,
        });

        // 2) Danh sách QUẬN (không kèm phường)
        const ds = await fetchDistrictsHCM();
        if (!mounted) return;
        setDistricts(ds);

        // 3) Prefill địa chỉ từ shippingAddress
        await prefillAddress(normalized.shippingAddress, ds);
      } catch (e) {
        if (!mounted) return;
        setErr(
          e?.response?.data?.message || e?.message || "Không thể tải hồ sơ."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  // Lưu thông tin (PUT /api/customer/profile)
  const onSaveInfo = async (vals) => {
    try {
      setSaving(true);

      // Tên quận/phường từ code
      const districtName =
        districts.find((d) => d.value === vals.districtCode)?.label || "";
      const wardName =
        wardOptions.find((w) => w.value === vals.wardCode)?.label || "";

      const composedAddress =
        `${(vals.addressLine || "").trim()}${wardName ? `, ${wardName}` : ""}` +
        `${districtName ? `, ${districtName}` : ""}, TP. Hồ Chí Minh`;

      const payload = {
        email: customer.email,
        phoneNumber: (vals.phone || "").trim(),
        fullName: (vals.fullName || "").trim(),
        shippingAddress: composedAddress,
        bankAccountNumber: (vals.bankAccountNumber || "").trim() || null,
        bankName: (vals.bankName || "").trim() || null,
        bankAccountHolder: (vals.bankAccountHolder || "").trim() || null,
      };

      const updated = await updateMyCustomerProfile(payload);

      if (
        updated &&
        (updated.customerId || updated.phoneNumber || updated.shippingAddress)
      ) {
        const normalized = {
          customerID: updated.customerId ?? customer.customerID,
          email: updated.email ?? customer.email,
          phone: updated.phoneNumber ?? customer.phone,
          fullName: updated.fullName ?? customer.fullName,
          createdAt: updated.createdAt ?? customer.createdAt,
          status:
            (updated.status || "ACTIVE").toLowerCase() === "active"
              ? "active"
              : "inactive",
          shippingAddress: updated.shippingAddress ?? customer.shippingAddress,
          kycStatus: (
            updated.kycStatus ||
            customer.kycStatus ||
            "unverified"
          ).toLowerCase(),
          bankAccountNumber:
            updated.bankAccountNumber ?? customer.bankAccountNumber,
          bankName: updated.bankName ?? customer.bankName,
          bankAccountHolder:
            updated.bankAccountHolder ?? customer.bankAccountHolder,
        };
        setCustomer(normalized);
      } else {
        const fresh = await fetchMyCustomerProfile();
        setCustomer((prev) => ({
          ...prev,
          phone: fresh?.phoneNumber ?? prev.phone,
          fullName: fresh?.fullName ?? prev.fullName,
          shippingAddress: fresh?.shippingAddress ?? prev.shippingAddress,
          bankAccountNumber: fresh?.bankAccountNumber ?? prev.bankAccountNumber,
          bankName: fresh?.bankName ?? prev.bankName,
          bankAccountHolder: fresh?.bankAccountHolder ?? prev.bankAccountHolder,
        }));
      }

      message.success("Đã cập nhật hồ sơ.");
      toast.success("Cập nhật hồ sơ thành công!");
    } catch (e) {
      const msg =
        e?.response?.data?.message || e?.message || "Cập nhật hồ sơ thất bại.";
      message.error(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Password mock
  const calcStrength = (v = "") => {
    let s = 0;
    if (v.length >= 8) s += 25;
    if (/[A-Z]/.test(v)) s += 25;
    if (/[a-z]/.test(v)) s += 20;
    if (/\d/.test(v)) s += 15;
    if (/[^A-Za-z0-9]/.test(v)) s += 15;
    return Math.min(s, 100);
  };
  const onChangePassword = async () => {
    try {
      setSubmittingPw(true);
      await new Promise((r) => setTimeout(r, 600));
      pwForm.resetFields();
      message.success("Đổi mật khẩu thành công (UI).");
      toast.success("Đổi mật khẩu thành công!");
    } finally {
      setSubmittingPw(false);
    }
  };

  const KycBanner = ({ icon, title, desc, cta }) => (
    <div
      style={{
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <Space align="start">
        {icon}
        <div>
          <Text strong style={{ color: "#111827" }}>
            {title}
          </Text>
          <Paragraph style={{ margin: "4px 0 0 0", color: "#6B7280" }}>
            {desc}
          </Paragraph>
          {cta}
        </div>
      </Space>
    </div>
  );

  const kycBlock = useMemo(() => {
    const status = customer?.kycStatus || "unverified";
    if (status === "verified") {
      return (
        <KycBanner
          icon={
            <CheckCircleTwoTone
              twoToneColor="#111827"
              style={{ fontSize: 20 }}
            />
          }
          title="Đã xác thực KYC"
          desc="Tài khoản của bạn đã được xác minh."
        />
      );
    }
    if (status === "pending") {
      return (
        <KycBanner
          icon={
            <SafetyCertificateOutlined
              style={{ fontSize: 20, color: "#111827" }}
            />
          }
          title="Yêu cầu KYC đang duyệt"
          desc="Chúng tôi sẽ phản hồi sớm nhất."
        />
      );
    }
    return (
      <KycBanner
        icon={
          <ExclamationCircleTwoTone
            twoToneColor="#faad14"
            style={{ fontSize: 20 }}
          />
        }
        title="Chưa xác thực KYC"
        desc="Bạn cần hoàn tất xác minh danh tính để thuê thiết bị giá trị cao."
        cta={
          <div style={{ marginTop: 10 }}>
            <Button
              type="primary"
              style={{ background: "#111827", borderColor: "#111827" }}
            >
              <Link to="/kyc" style={{ color: "#fff" }}>
                Xác thực ngay
              </Link>
            </Button>
          </div>
        }
      />
    );
  }, [customer?.kycStatus]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }
  if (err) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Alert type="error" message={err} showIcon />
      </div>
    );
  }
  if (!customer) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card
              className="rounded-xl"
              title={
                <Space>
                  <UserOutlined />
                  <span style={{ color: "#111827", fontWeight: 600 }}>
                    Hồ sơ của bạn
                  </span>
                </Space>
              }
              bodyStyle={{ padding: 18 }}
            >
              <Descriptions
                column={1}
                size="middle"
                colon
                labelStyle={{ width: 160, color: "#6B7280" }}
                contentStyle={{ color: "#111827" }}
                items={[
                  {
                    key: "email",
                    label: "Email",
                    children: (
                      <Space>
                        <MailOutlined />
                        <Text>{customer.email}</Text>
                      </Space>
                    ),
                  },
                  {
                    key: "created",
                    label: "Ngày tạo",
                    children: <Text>{customer.createdAt}</Text>,
                  },
                  {
                    key: "addr",
                    label: "Địa chỉ giao hàng",
                    children: (
                      <Space>
                        <HomeOutlined />
                        <Text>
                          {customer.shippingAddress || "Chưa cập nhật"}
                        </Text>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>

            <Card className="rounded-xl mt-3" bodyStyle={{ padding: 0 }}>
              <Tabs
                className="profile-tabs"
                defaultActiveKey="info"
                items={[
                  {
                    key: "info",
                    label: (
                      <Space>
                        <EditOutlined />
                        <span>Chỉnh sửa thông tin</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ padding: 18 }}>
                        <Form
                          form={infoForm}
                          layout="vertical"
                          onFinish={onSaveInfo}
                          requiredMark={false}
                        >
                          <Form.Item
                            label="Họ và tên"
                            name="fullName"
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng nhập họ và tên",
                              },
                            ]}
                          >
                            <Input
                              prefix={<UserOutlined />}
                              placeholder="Họ và tên"
                            />
                          </Form.Item>

                          <Form.Item
                            label="Số điện thoại"
                            name="phone"
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng nhập số điện thoại",
                              },
                              {
                                pattern: /^[0-9+\-\s]{8,15}$/,
                                message: "Số điện thoại không hợp lệ",
                              },
                            ]}
                          >
                            <Input
                              prefix={<PhoneOutlined />}
                              placeholder="09xx xxx xxx"
                            />
                          </Form.Item>

                          {/* ĐỊA CHỈ GIAO HÀNG */}
                          <Form.Item
                            label="Quận/Huyện (TP. HCM)"
                            name="districtCode"
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng chọn quận/huyện",
                              },
                            ]}
                          >
                            <Select
                              options={districts}
                              placeholder="Chọn quận/huyện"
                              showSearch
                              optionFilterProp="label"
                              onChange={async (code) => {
                                setSelectedDistrict(code);
                                infoForm.setFieldsValue({
                                  wardCode: undefined,
                                });
                                setLoadingWards(true);
                                try {
                                  const wards = await fetchWardsByDistrict(
                                    code
                                  );
                                  setWardOptions(wards);
                                } finally {
                                  setLoadingWards(false);
                                }
                              }}
                            />
                          </Form.Item>

                          <Form.Item
                            label="Phường/Xã"
                            name="wardCode"
                            dependencies={["districtCode"]}
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng chọn phường/xã",
                              },
                            ]}
                          >
                            <Select
                              options={wardOptions}
                              placeholder="Chọn phường/xã"
                              disabled={!selectedDistrict}
                              loading={loadingWards}
                              showSearch
                              optionFilterProp="label"
                            />
                          </Form.Item>

                          <Form.Item
                            label="Địa chỉ chi tiết (Số nhà, tên đường)"
                            name="addressLine"
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng nhập số nhà, tên đường",
                              },
                            ]}
                          >
                            <Input
                              prefix={<HomeOutlined />}
                              placeholder="VD: 12 Nguyễn Trãi"
                            />
                          </Form.Item>

                          {/* BANK INFO */}
                          <Form.Item
                            label="Số tài khoản ngân hàng"
                            name="bankAccountNumber"
                            rules={[
                              { required: false },
                              {
                                pattern: /^[0-9\s\-]{6,20}$/,
                                message: "Số tài khoản không hợp lệ",
                              },
                            ]}
                          >
                            <Input
                              prefix={<IdcardOutlined />}
                              placeholder="VD: 1234567890"
                            />
                          </Form.Item>

                          <Form.Item
                            label="Ngân hàng"
                            name="bankName"
                            rules={[
                              { required: false }, // Nếu muốn required, đổi thành true
                            ]}
                          >
                            <Select
                              options={BANKS}
                              placeholder="Chọn ngân hàng"
                              showSearch
                              optionFilterProp="label"
                              allowClear // Cho phép xóa nếu không bắt buộc
                            />
                          </Form.Item>
                          <Form.Item
                            label="Chủ tài khoản"
                            name="bankAccountHolder"
                            rules={[
                              { required: false },
                              { max: 100, message: "Tên quá dài" },
                            ]}
                          >
                            <Input
                              prefix={<UserOutlined />}
                              placeholder="VD: NGUYEN VAN A"
                            />
                          </Form.Item>

                          <Space>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={saving}
                              style={{
                                background: "#111827",
                                borderColor: "#111827",
                              }}
                            >
                              Lưu thay đổi
                            </Button>
                            <Button
                              htmlType="button"
                              onClick={() => infoForm.resetFields()}
                            >
                              Hủy
                            </Button>
                          </Space>
                        </Form>
                      </div>
                    ),
                  },
                  {
                    key: "password",
                    label: (
                      <Space>
                        <LockOutlined />
                        <span>Đổi mật khẩu</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ padding: 18 }}>
                        <Form
                          form={pwForm}
                          layout="vertical"
                          requiredMark={false}
                          onFinish={onChangePassword}
                        >
                          <Form.Item
                            label="Mật khẩu hiện tại"
                            name="currentPassword"
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng nhập mật khẩu hiện tại",
                              },
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Mật khẩu hiện tại"
                              iconRender={(v) =>
                                v ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                              }
                            />
                          </Form.Item>

                          <Form.Item
                            label="Mật khẩu mới"
                            name="newPassword"
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng nhập mật khẩu mới",
                              },
                              { min: 8, message: "Tối thiểu 8 ký tự" },
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Mật khẩu mới"
                              iconRender={(v) =>
                                v ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                              }
                              onChange={(e) => {
                                const s = calcStrength(e.target.value);
                                pwForm.setFields([
                                  { name: "_pwStrength", value: s },
                                ]);
                              }}
                            />
                          </Form.Item>

                          <Form.Item name="_pwStrength" noStyle>
                            <Input type="hidden" />
                          </Form.Item>
                          <Form.Item shouldUpdate noStyle>
                            {() => {
                              const s =
                                pwForm.getFieldValue("_pwStrength") || 0;
                              const text =
                                s >= 80 ? "Mạnh" : s >= 50 ? "Khá" : "Yếu";
                              return (
                                <div
                                  style={{ marginTop: -8, marginBottom: 12 }}
                                >
                                  <Progress
                                    percent={s}
                                    size="small"
                                    showInfo={false}
                                    strokeColor="#111827"
                                    trailColor="#E5E7EB"
                                  />
                                  <Text type="secondary">
                                    Độ mạnh mật khẩu: {text}
                                  </Text>
                                </div>
                              );
                            }}
                          </Form.Item>

                          <Form.Item
                            label="Xác nhận mật khẩu mới"
                            name="confirmPassword"
                            dependencies={["newPassword"]}
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng nhập lại mật khẩu mới",
                              },
                              ({ getFieldValue }) => ({
                                validator(_, v) {
                                  if (!v || getFieldValue("newPassword") === v)
                                    return Promise.resolve();
                                  return Promise.reject(
                                    new Error("Mật khẩu xác nhận không khớp")
                                  );
                                },
                              }),
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Nhập lại mật khẩu mới"
                              iconRender={(v) =>
                                v ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                              }
                            />
                          </Form.Item>

                          <Space>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={submittingPw}
                              style={{
                                background: "#111827",
                                borderColor: "#111827",
                              }}
                            >
                              Cập nhật mật khẩu
                            </Button>
                            <Button onClick={() => pwForm.resetFields()}>
                              Làm mới
                            </Button>
                          </Space>
                        </Form>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          {/* RIGHT */}
          <Col xs={24} lg={10}>
            <Card
              className="rounded-xl"
              title={
                <Space>
                  <SafetyCertificateOutlined />
                  <span style={{ color: "#111827", fontWeight: 600 }}>
                    Trạng thái KYC
                  </span>
                </Space>
              }
              bodyStyle={{ padding: 18 }}
            >
              {kycBlock}
            </Card>

            <Card className="rounded-xl mt-3" bodyStyle={{ padding: 18 }}>
              <Title level={5} style={{ marginTop: 0, color: "#111827" }}>
                Ghi chú
              </Title>
              <Paragraph style={{ color: "#6B7280", marginBottom: 0 }}>
                • Thông tin hồ sơ dùng để xuất hợp đồng và giao/thu hồi thiết
                bị.
                <br />• Nếu bạn thay đổi địa chỉ nhận hàng, vui lòng cập nhật
                trước khi đặt đơn mới.
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </div>

      <style>{`
        .profile-tabs .ant-tabs-ink-bar { background: #111827; }
        .profile-tabs .ant-tabs-tab-btn { color: #6B7280; }
        .profile-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: #111827; }
      `}</style>
    </div>
  );
}
