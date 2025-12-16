// src/pages/CustomerProfile.jsx
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
  Modal,
  Popconfirm,
  Avatar,
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
  PlusOutlined,
  DeleteOutlined,
  BankOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  fetchMyCustomerProfile,
  updateMyCustomerProfile,
  createShippingAddress,
  updateShippingAddress,
  deleteShippingAddress,
  createBankInformation,
  updateBankInformation,
  deleteBankInformation,
  normalizeCustomer,
} from "../lib/customerApi";
import { fetchDistrictsHCM, fetchWardsByDistrict } from "../lib/locationVn";
import { BANKS } from "../../Bank";
import { getMyKyc } from "../lib/kycApi";

const { Title, Text, Paragraph } = Typography;

export default function CustomerProfile() {
  const { isAuthenticated, user } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [infoForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [addressForm] = Form.useForm();
  const [bankForm] = Form.useForm();

  const [saving, setSaving] = useState(false);
  const [submittingPw, setSubmittingPw] = useState(false);
  const [kycStatus, setKycStatus] = useState("");
  const [kycRejectionReason, setKycRejectionReason] = useState("");

  const [addresses, setAddresses] = useState([]);
  const [banks, setBanks] = useState([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [editingBank, setEditingBank] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);

  const [districts, setDistricts] = useState([]);
  const [modalDistrictCode, setModalDistrictCode] = useState(null);
  const [modalWardOptions, setModalWardOptions] = useState([]);
  const [modalWardsLoading, setModalWardsLoading] = useState(false);

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
        const c = await fetchMyCustomerProfile();
        const normalized = normalizeCustomer(c);
        normalized.customerID = c?.customerId ?? c?.id ?? "-";
        normalized.email = c?.email ?? user?.email ?? "-";
        normalized.phone = c?.phoneNumber ?? "";
        normalized.fullName = c?.fullName ?? c?.username ?? "";
        normalized.createdAt = c?.createdAt ?? "-";
        normalized.status = c?.status || user?.isActive ? "active" : "inactive";
        normalized.shippingAddress = c?.shippingAddress ?? "";
        normalized.kycStatus = (c?.kycStatus || "unverified").toLowerCase();
        normalized.bankAccountNumber = c?.bankAccountNumber ?? "";
        normalized.bankName = c?.bankName ?? "";
        normalized.bankAccountHolder = c?.bankAccountHolder ?? "";

        if (!mounted) return;
        setCustomer(normalized);
        setAddresses(normalized.shippingAddresses || []);
        setBanks(normalized.bankInformations || []);

        try {
          const kyc = await getMyKyc();
          const ks = String(
            kyc?.kycStatus || kyc?.status || normalized.kycStatus || ""
          ).toLowerCase();
          setKycStatus(ks);
          setKycRejectionReason(kyc?.rejectionReason || "");
        } catch { /* ignore */ }

        const firstAddress = normalized.shippingAddresses?.[0];
        const firstBank = normalized.bankInformations?.[0];
        infoForm.setFieldsValue({
          fullName: normalized.fullName,
          phone: normalized.phone,
          selectedAddressId: firstAddress?.shippingAddressId || null,
          selectedBankId: firstBank?.bankInformationId || null,
        });

        const ds = await fetchDistrictsHCM();
        if (!mounted) return;
        setDistricts(ds);
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
  }, [isAuthenticated, infoForm, user?.email, user?.isActive]);

  const onSaveInfo = async (vals) => {
    try {
      setSaving(true);
      const payload = {
        email: customer.email,
        phoneNumber: (vals.phone || "").trim(),
        fullName: (vals.fullName || "").trim(),
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
          bankAccountNumber:
            fresh?.bankAccountNumber ?? prev.bankAccountNumber,
          bankName: fresh?.bankName ?? prev.bankName,
          bankAccountHolder:
            fresh?.bankAccountHolder ?? prev.bankAccountHolder,
        }));
      }

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

  const handleAddressSubmit = async (values) => {
    try {
      setAddressLoading(true);
      const districtName =
        districts.find((d) => d.value === values.districtCode)?.label || "";
      const wardName =
        modalWardOptions.find((w) => w.value === values.wardCode)?.label || "";
      const composed =
        `${(values.addressLine || "").trim()}${
          wardName ? `, ${wardName}` : ""
        }` + `${districtName ? `, ${districtName}` : ""}, TP. Hồ Chí Minh`;

      const body = { address: composed };

      if (editingAddress) {
        await updateShippingAddress(editingAddress.shippingAddressId, body);
        toast.success("Cập nhật địa chỉ thành công!");
      } else {
        await createShippingAddress(body);
        toast.success("Thêm địa chỉ thành công!");
      }
      setAddressModalVisible(false);
      setEditingAddress(null);
      addressForm.resetFields();
      setModalDistrictCode(null);
      setModalWardOptions([]);

      const freshProfile = await fetchMyCustomerProfile();
      setAddresses(freshProfile.shippingAddressDtos || []);
      if (freshProfile.shippingAddressDtos?.length > 0) {
        infoForm.setFieldsValue({
          selectedAddressId:
            freshProfile.shippingAddressDtos[0].shippingAddressId,
        });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setAddressLoading(false);
    }
  };

  const handleBankSubmit = async (values) => {
    try {
      setBankLoading(true);
      if (editingBank) {
        await updateBankInformation(editingBank.bankInformationId, values);
        toast.success("Cập nhật thông tin ngân hàng thành công!");
      } else {
        await createBankInformation(values);
        toast.success("Thêm thông tin ngân hàng thành công!");
      }
      setBankModalVisible(false);
      setEditingBank(null);
      bankForm.resetFields();

      const freshProfile = await fetchMyCustomerProfile();
      setBanks(freshProfile.bankInformationDtos || []);
      if (freshProfile.bankInformationDtos?.length > 0) {
        infoForm.setFieldsValue({
          selectedBankId:
            freshProfile.bankInformationDtos[0].bankInformationId,
        });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setBankLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    try {
      await deleteShippingAddress(addressId);
      toast.success("Xóa địa chỉ thành công!");
      const freshProfile = await fetchMyCustomerProfile();
      setAddresses(freshProfile.shippingAddressDtos || []);
      if (freshProfile.shippingAddressDtos?.length > 0) {
        infoForm.setFieldsValue({
          selectedAddressId:
            freshProfile.shippingAddressDtos[0].shippingAddressId,
        });
      } else {
        infoForm.setFieldsValue({ selectedAddressId: null });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const handleDeleteBank = async (bankId) => {
    try {
      await deleteBankInformation(bankId);
      toast.success("Xóa thông tin ngân hàng thành công!");
      const freshProfile = await fetchMyCustomerProfile();
      setBanks(freshProfile.bankInformationDtos || []);
      if (freshProfile.bankInformationDtos?.length > 0) {
        infoForm.setFieldsValue({
          selectedBankId:
            freshProfile.bankInformationDtos[0].bankInformationId,
        });
      } else {
        infoForm.setFieldsValue({ selectedBankId: null });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const openAddressModal = (address = null) => {
    setEditingAddress(address);
    setModalDistrictCode(null);
    setModalWardOptions([]);
    addressForm.resetFields();
    setAddressModalVisible(true);
  };

  const openBankModal = (bank = null) => {
    setEditingBank(bank);
    if (bank) {
      bankForm.setFieldsValue({
        bankName: bank.bankName,
        bankHolder: bank.bankHolder,
        cardNumber: bank.cardNumber,
      });
    } else {
      bankForm.resetFields();
    }
    setBankModalVisible(true);
  };

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

  const KycBanner = ({ tone = "info", icon, title, desc, cta }) => {
    const TONES = {
      success: {
        bg: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
        border: "#10B981",
        title: "#065F46",
        desc: "#047857",
      },
      warning: {
        bg: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
        border: "#F59E0B",
        title: "#92400E",
        desc: "#B45309",
      },
      error: {
        bg: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
        border: "#EF4444",
        title: "#7F1D1D",
        desc: "#B91C1C",
      },
      info: {
        bg: "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)",
        border: "#6B7280",
        title: "#111827",
        desc: "#6B7280",
      },
    };
    const c = TONES[tone] || TONES.info;

    return (
      <div
        style={{
          background: c.bg,
          border: `2px solid ${c.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <Space align="start" size={16}>
          <div style={{ fontSize: 28 }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <Text strong style={{ color: c.title, fontSize: 16, display: "block", marginBottom: 6 }}>
              {title}
            </Text>
            <Paragraph style={{ margin: 0, color: c.desc, fontSize: 14 }}>
              {desc}
            </Paragraph>
            {cta && <div style={{ marginTop: 12 }}>{cta}</div>}
          </div>
        </Space>
      </div>
    );
  };

  const kycBlock = useMemo(() => {
    const statusRaw = kycStatus || customer?.kycStatus || "";
    const s = String(statusRaw).toLowerCase();
    const status = !s
      ? "unverified"
      : s.includes("verified") || s.includes("approved")
      ? "verified"
      : s.includes("rejected") || s.includes("denied")
      ? "rejected"
      : s.includes("submit") || s.includes("review") || s.includes("pending")
      ? "pending"
      : s;

    if (status === "verified") {
      return (
        <KycBanner
          tone="success"
          icon={<CheckCircleTwoTone twoToneColor="#10B981" />}
          title="Đã xác thực KYC"
          desc="Tài khoản của bạn đã được xác minh. Bạn có thể thuê các thiết bị giá trị cao."
        />
      );
    }

    if (status === "rejected") {
      return (
        <div>
          <KycBanner
            tone="error"
            icon={<ExclamationCircleTwoTone twoToneColor="#EF4444" />}
            title="KYC đã bị từ chối"
            desc="Vui lòng xem lý do từ chối bên dưới và xác thực lại KYC."
            cta={
              <Button
                type="primary"
                size="large"
                style={{ 
                  background: "#000", 
                  borderColor: "#000",
                  borderRadius: 10,
                  fontWeight: 600,
                  height: 44,
                }}
              >
                <Link to="/kyc" style={{ color: "#fff" }}>
                  Xác thực lại
                </Link>
              </Button>
            }
          />
          {kycRejectionReason && (
            <Alert
              message="Lý do từ chối"
              description={kycRejectionReason}
              type="error"
              showIcon
              style={{ marginTop: 16, borderRadius: 12 }}
            />
          )}
        </div>
      );
    }

    if (status === "pending") {
      return (
        <KycBanner
          tone="warning"
          icon={<SafetyCertificateOutlined style={{ fontSize: 28, color: "#F59E0B" }} />}
          title="Yêu cầu KYC đang được xử lý"
          desc="Chúng tôi đang xem xét yêu cầu của bạn và sẽ phản hồi sớm nhất có thể."
        />
      );
    }

    return (
      <KycBanner
        tone="info"
        icon={<ExclamationCircleTwoTone twoToneColor="#faad14" />}
        title="Chưa xác thực KYC"
        desc="Bạn cần hoàn tất xác minh danh tính để có thể thuê các thiết bị giá trị cao và nhận nhiều ưu đãi hơn."
        cta={
          <Button
            type="primary"
            size="large"
            style={{ 
              background: "#000", 
              borderColor: "#000",
              borderRadius: 10,
              fontWeight: 600,
              height: 44,
            }}
          >
            <Link to="/kyc" style={{ color: "#fff" }}>
              Xác thực ngay
            </Link>
          </Button>
        }
      />
    );
  }, [customer?.kycStatus, kycStatus, kycRejectionReason]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }
  if (err) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert type="error" message={err} showIcon style={{ borderRadius: 12 }} />
      </div>
    );
  }
  if (!customer) return null;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #fafafa 0%, #fff 100%)" }}>
      <style>{`
        .profile-card {
          border-radius: 20px !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 2px 16px rgba(0,0,0,0.06) !important;
          overflow: hidden;
        }
        
        .profile-card .ant-card-head {
          background: linear-gradient(135deg, #fafafa 0%, #fff 100%);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          padding: 20px 24px;
        }
        
        .profile-card .ant-card-head-title {
          font-size: 18px;
          font-weight: 700;
          color: #000;
        }

        .profile-tabs .ant-tabs-ink-bar { 
          background: #000; 
          height: 3px;
          border-radius: 3px 3px 0 0;
        }
        
        .profile-tabs .ant-tabs-tab { 
          padding: 16px 0;
          font-weight: 600;
          font-size: 15px;
        }
        
        .profile-tabs .ant-tabs-tab-btn { 
          color: #6B7280; 
        }
        
        .profile-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { 
          color: #000; 
        }

        .profile-tabs .ant-tabs-tab:hover .ant-tabs-tab-btn {
          color: #000;
        }

        .ant-descriptions-item-label {
          font-weight: 600 !important;
          color: #6B7280 !important;
        }

        .ant-descriptions-item-content {
          font-weight: 500 !important;
          color: #1a1a1a !important;
        }

        .ant-form-item-label > label {
          font-weight: 600 !important;
          color: #1a1a1a !important;
        }

        .ant-input, .ant-input-password, .ant-select-selector {
          border-radius: 10px !important;
          border: 1.5px solid #e5e7eb !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .ant-input:hover, .ant-input-password:hover, .ant-select:hover .ant-select-selector {
          border-color: #9ca3af !important;
        }

        .ant-input:focus, .ant-input-password:focus, .ant-select-focused .ant-select-selector {
          border-color: #000 !important;
          box-shadow: 0 0 0 2px rgba(0,0,0,0.05) !important;
        }

        .ant-input-affix-wrapper {
          border-radius: 10px !important;
          border: 1.5px solid #e5e7eb !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .ant-input-affix-wrapper:hover {
          border-color: #9ca3af !important;
        }

        .ant-input-affix-wrapper-focused {
          border-color: #000 !important;
          box-shadow: 0 0 0 2px rgba(0,0,0,0.05) !important;
        }

        .ant-input-password-icon {
          color: #9ca3af !important;
        }

        .ant-input-password-icon:hover {
          color: #000 !important;
        }

        .ant-form-item-has-error .ant-input,
        .ant-form-item-has-error .ant-input-affix-wrapper,
        .ant-form-item-has-error .ant-select-selector {
          border-color: #ef4444 !important;
        }

        .ant-form-item-has-error .ant-input:focus,
        .ant-form-item-has-error .ant-input-affix-wrapper-focused,
        .ant-form-item-has-error .ant-select-focused .ant-select-selector {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 2px rgba(239,68,68,0.1) !important;
        }

        .profile-btn {
          border-radius: 10px !important;
          font-weight: 600 !important;
          height: 42px !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .profile-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }

        .user-avatar {
          background: linear-gradient(135deg, #000 0%, #333 100%);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .info-card {
          background: rgba(0,0,0,0.02);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 12px;
          padding: 16px;
        }

        .ant-modal-content {
          border-radius: 16px !important;
        }

        .ant-modal-header {
          border-radius: 16px 16px 0 0 !important;
          border-bottom: 1px solid rgba(0,0,0,0.06) !important;
        }

        .ant-modal-title {
          font-weight: 700 !important;
          font-size: 18px !important;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div style={{ 
          background: "#fff", 
          borderRadius: 20, 
          padding: 32,
          marginBottom: 24,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        }}>
          <Space size={20} align="center">
            <Avatar 
              size={80} 
              icon={<UserOutlined />}
              className="user-avatar"
            />
            <div>
              <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#000" }}>
                {customer.fullName || "Người dùng"}
              </Title>
              <Text style={{ fontSize: 15, color: "#666", fontWeight: 500 }}>
                {customer.email}
              </Text>
            </div>
          </Space>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}>
            <Card className="profile-card" bodyStyle={{ padding: 24 }}>
              <Descriptions
                column={1}
                size="middle"
                colon
                labelStyle={{ width: 180 }}
                items={[
                  {
                    key: "email",
                    label: (
                      <Space>
                        <MailOutlined />
                        <span>Email</span>
                      </Space>
                    ),
                    children: <Text>{customer.email}</Text>,
                  },
                  {
                    key: "addr",
                    label: (
                      <Space>
                        <HomeOutlined />
                        <span>Địa chỉ giao hàng</span>
                      </Space>
                    ),
                    children: (
                      <Text>
                        {(() => {
                          const selectedAddrId =
                            infoForm.getFieldValue("selectedAddressId");
                          const selectedAddr = addresses.find(
                            (a) => a.shippingAddressId === selectedAddrId
                          );
                          return (
                            selectedAddr?.address ||
                            customer.shippingAddress ||
                            "Chưa cập nhật"
                          );
                        })()}
                      </Text>
                    ),
                  },
                  {
                    key: "bank",
                    label: (
                      <Space>
                        <BankOutlined />
                        <span>Ngân hàng</span>
                      </Space>
                    ),
                    children: (
                      <Text>
                        {(() => {
                          const selectedBankId =
                            infoForm.getFieldValue("selectedBankId");
                          const selectedBank = banks.find(
                            (b) => b.bankInformationId === selectedBankId
                          );
                          return selectedBank
                            ? `${selectedBank.bankName} - ${selectedBank.bankHolder}`
                            : customer.bankName
                            ? `${customer.bankName} - ${customer.bankAccountHolder}`
                            : "Chưa cập nhật";
                        })()}
                      </Text>
                    ),
                  },
                ]}
              />
            </Card>

            <Card className="profile-card" style={{ marginTop: 24 }} bodyStyle={{ padding: 0 }}>
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
                      <div style={{ padding: 24 }}>
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
                            <Input placeholder="Họ và tên" />
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
                            <Input placeholder="09xx xxx xxx" />
                          </Form.Item>

                          <Form.Item
                            label="Địa chỉ giao hàng"
                            name="selectedAddressId"
                          >
                            <Select
                              placeholder="Chọn địa chỉ giao hàng"
                              allowClear
                              notFoundContent="Chưa có địa chỉ"
                              options={addresses.map((addr) => ({
                                value: addr.shippingAddressId,
                                label: (
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span style={{ flex: 1 }}>
                                      {addr.address}
                                    </span>
                                    <Space
                                      size={8}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => {
                                          const addrObj = addresses.find(
                                            (a) =>
                                              a.shippingAddressId ===
                                              addr.shippingAddressId
                                          );
                                          openAddressModal(addrObj);
                                        }}
                                      />
                                      <Popconfirm
                                        title="Xóa địa chỉ này?"
                                        onConfirm={() =>
                                          handleDeleteAddress(
                                            addr.shippingAddressId
                                          )
                                        }
                                        okText="Xóa"
                                        cancelText="Hủy"
                                      >
                                        <Button
                                          type="link"
                                          size="small"
                                          danger
                                          icon={<DeleteOutlined />}
                                        />
                                      </Popconfirm>
                                    </Space>
                                  </div>
                                ),
                              }))}
                              dropdownRender={(menu) => (
                                <>
                                  {menu}
                                  <div
                                    style={{
                                      padding: "8px 12px",
                                      borderTop: "1px solid #f0f0f0",
                                    }}
                                  >
                                    <Button
                                      type="link"
                                      icon={<PlusOutlined />}
                                      onClick={() => openAddressModal()}
                                      block
                                    >
                                      Thêm địa chỉ mới
                                    </Button>
                                  </div>
                                </>
                              )}
                            />
                          </Form.Item>

                          <Form.Item
                            label="Tài khoản ngân hàng"
                            name="selectedBankId"
                          >
                            <Select
                              placeholder="Chọn tài khoản ngân hàng"
                              allowClear
                              notFoundContent="Chưa có thông tin ngân hàng"
                              options={banks.map((bank) => ({
                                value: bank.bankInformationId,
                                label: (
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span style={{ flex: 1 }}>
                                      {`${bank.bankName} - ${bank.bankHolder}`}
                                    </span>
                                    <Space
                                      size={8}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => {
                                          const bankObj = banks.find(
                                            (b) =>
                                              b.bankInformationId ===
                                              bank.bankInformationId
                                          );
                                          openBankModal(bankObj);
                                        }}
                                      />
                                      <Popconfirm
                                        title="Xóa thông tin ngân hàng này?"
                                        onConfirm={() =>
                                          handleDeleteBank(
                                            bank.bankInformationId
                                          )
                                        }
                                        okText="Xóa"
                                        cancelText="Hủy"
                                      >
                                        <Button
                                          type="link"
                                          size="small"
                                          danger
                                          icon={<DeleteOutlined />}
                                        />
                                      </Popconfirm>
                                    </Space>
                                  </div>
                                ),
                              }))}
                              dropdownRender={(menu) => (
                                <>
                                  {menu}
                                  <div
                                    style={{
                                      padding: "8px 12px",
                                      borderTop: "1px solid #f0f0f0",
                                    }}
                                  >
                                    <Button
                                      type="link"
                                      icon={<PlusOutlined />}
                                      onClick={() => openBankModal()}
                                      block
                                    >
                                      Thêm ngân hàng mới
                                    </Button>
                                  </div>
                                </>
                              )}
                            />
                          </Form.Item>

                          <Space size={12}>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={saving}
                              className="profile-btn"
                              style={{
                                background: "#000",
                                borderColor: "#000",
                              }}
                            >
                              Lưu thay đổi
                            </Button>
                            <Button
                              htmlType="button"
                              className="profile-btn"
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
                      <div style={{ padding: 24 }}>
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
                              placeholder="Mật khẩu hiện tại"
                              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
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
                              placeholder="Mật khẩu mới"
                              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
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
                              const color = s >= 80 ? "#10B981" : s >= 50 ? "#F59E0B" : "#EF4444";
                              return (
                                <div
                                  style={{ marginTop: -8, marginBottom: 16 }}
                                >
                                  <Progress
                                    percent={s}
                                    size="small"
                                    showInfo={false}
                                    strokeColor={color}
                                    trailColor="#E5E7EB"
                                    style={{ marginBottom: 8 }}
                                  />
                                  <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
                                    Độ mạnh mật khẩu: <span style={{ color, fontWeight: 600 }}>{text}</span>
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
                                    new Error(
                                      "Mật khẩu xác nhận không khớp"
                                    )
                                  );
                                },
                              }),
                            ]}
                          >
                            <Input.Password
                              placeholder="Nhập lại mật khẩu mới"
                              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                            />
                          </Form.Item>

                          <Space size={12}>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={submittingPw}
                              className="profile-btn"
                              style={{
                                background: "#000",
                                borderColor: "#000",
                              }}
                            >
                              Cập nhật mật khẩu
                            </Button>
                            <Button 
                              className="profile-btn"
                              onClick={() => pwForm.resetFields()}
                            >
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

          <Col xs={24} lg={10}>
            <Card
              className="profile-card"
              title={
                <Space>
                  <SafetyCertificateOutlined />
                  <span>Trạng thái KYC</span>
                </Space>
              }
              bodyStyle={{ padding: 24 }}
            >
              {kycBlock}
            </Card>

            <Card className="profile-card" style={{ marginTop: 24 }} bodyStyle={{ padding: 24 }}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Space>
                  <InfoCircleOutlined style={{ fontSize: 18, color: "#6B7280" }} />
                  <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
                    Ghi chú quan trọng
                  </Title>
                </Space>
                <div className="info-card">
                  <Paragraph style={{ color: "#4B5563", marginBottom: 12, fontSize: 14, lineHeight: 1.6 }}>
                    <strong>📋 Thông tin hồ sơ</strong><br />
                    Thông tin này sẽ được sử dụng để xuất hợp đồng thuê và giao/thu hồi thiết bị.
                  </Paragraph>
                  <Paragraph style={{ color: "#4B5563", marginBottom: 0, fontSize: 14, lineHeight: 1.6 }}>
                    <strong>📍 Địa chỉ giao hàng</strong><br />
                    Nếu bạn thay đổi địa chỉ nhận hàng, vui lòng cập nhật trước khi đặt đơn mới.
                  </Paragraph>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Address Modal */}
      <Modal
        title={editingAddress ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
        open={addressModalVisible}
        onCancel={() => {
          setAddressModalVisible(false);
          setEditingAddress(null);
          addressForm.resetFields();
          setModalDistrictCode(null);
          setModalWardOptions([]);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={addressForm}
          layout="vertical"
          onFinish={handleAddressSubmit}
          requiredMark={false}
        >
          <Form.Item
            label="Quận/Huyện (TP. HCM)"
            name="districtCode"
            rules={[{ required: true, message: "Vui lòng chọn quận/huyện" }]}
          >
            <Select
              options={districts}
              placeholder="Chọn quận/huyện"
              showSearch
              optionFilterProp="label"
              value={modalDistrictCode}
              onChange={async (code) => {
                setModalDistrictCode(code);
                addressForm.setFieldsValue({ wardCode: undefined });
                setModalWardsLoading(true);
                try {
                  const wards = await fetchWardsByDistrict(code);
                  setModalWardOptions(wards);
                } finally {
                  setModalWardsLoading(false);
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="Phường/Xã"
            name="wardCode"
            dependencies={["districtCode"]}
            rules={[{ required: true, message: "Vui lòng chọn phường/xã" }]}
          >
            <Select
              options={modalWardOptions}
              placeholder="Chọn phường/xã"
              disabled={!modalDistrictCode}
              loading={modalWardsLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="Địa chỉ chi tiết (Số nhà, tên đường)"
            name="addressLine"
            rules={[
              { required: true, message: "Vui lòng nhập số nhà, tên đường" },
            ]}
          >
            <Input placeholder="VD: 12 Nguyễn Trãi" />
          </Form.Item>

          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              className="profile-btn"
              onClick={() => {
                setAddressModalVisible(false);
                setEditingAddress(null);
                addressForm.resetFields();
                setModalDistrictCode(null);
                setModalWardOptions([]);
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={addressLoading}
              className="profile-btn"
              style={{ background: "#000", borderColor: "#000" }}
            >
              {editingAddress ? "Cập nhật" : "Thêm"}
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* Bank Modal */}
      <Modal
        title={
          editingBank
            ? "Sửa thông tin ngân hàng"
            : "Thêm thông tin ngân hàng mới"
        }
        open={bankModalVisible}
        onCancel={() => {
          setBankModalVisible(false);
          setEditingBank(null);
          bankForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={bankForm}
          layout="vertical"
          onFinish={handleBankSubmit}
          requiredMark={false}
        >
          <Form.Item
            label="Tên ngân hàng"
            name="bankName"
            rules={[{ required: true, message: "Vui lòng chọn ngân hàng" }]}
          >
            <Select
              options={BANKS}
              placeholder="Chọn ngân hàng"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="Chủ tài khoản"
            name="bankHolder"
            rules={[
              { required: true, message: "Vui lòng nhập tên chủ tài khoản" },
            ]}
          >
            <Input placeholder="Tên chủ tài khoản" />
          </Form.Item>

          <Form.Item
            label="Số tài khoản"
            name="cardNumber"
            rules={[
              { required: true, message: "Vui lòng nhập số tài khoản" },
              { pattern: /^[0-9\s-]{6,20}$/, message: "Số tài khoản không hợp lệ" },
            ]}
          >
            <Input placeholder="Số tài khoản" />
          </Form.Item>

          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              className="profile-btn"
              onClick={() => {
                setBankModalVisible(false);
                setEditingBank(null);
                bankForm.resetFields();
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={bankLoading}
              className="profile-btn"
              style={{ background: "#000", borderColor: "#000" }}
            >
              {editingBank ? "Cập nhật" : "Thêm"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}