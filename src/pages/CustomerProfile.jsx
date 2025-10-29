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

  // addresses & banks
  const [addresses, setAddresses] = useState([]);
  const [banks, setBanks] = useState([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [editingBank, setEditingBank] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);

  // HCM location (for modal)
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
        // profile
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

        // KYC
        try {
          const kyc = await getMyKyc();
          const ks = String(
            kyc?.kycStatus || kyc?.status || normalized.kycStatus || ""
          ).toLowerCase();
          setKycStatus(ks);
          setKycRejectionReason(kyc?.rejectionReason || "");
        } catch {}

        // preselect first items
        const firstAddress = normalized.shippingAddresses?.[0];
        const firstBank = normalized.bankInformations?.[0];
        infoForm.setFieldsValue({
          fullName: normalized.fullName,
          phone: normalized.phone,
          selectedAddressId: firstAddress?.shippingAddressId || null,
          selectedBankId: firstBank?.bankInformationId || null,
        });

        // districts for modal
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

  // address modal submit
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

  // password mock
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

  // === KycBanner with tone (NEW) ===
  const KycBanner = ({ tone = "info", icon, title, desc, cta }) => {
    const TONES = {
      success: {
        bg: "#ECFDF5",
        border: "#A7F3D0",
        title: "#065F46",
        desc: "#047857",
      },
      warning: {
        bg: "#FFFBEB",
        border: "#FDE68A",
        title: "#92400E",
        desc: "#B45309",
      },
      error: {
        bg: "#FEF2F2",
        border: "#FCA5A5",
        title: "#7F1D1D",
        desc: "#B91C1C",
      },
      info: {
        bg: "#F9FAFB",
        border: "#E5E7EB",
        title: "#111827",
        desc: "#6B7280",
      },
    };
    const c = TONES[tone] || TONES.info;

    return (
      <div
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Space align="start">
          {icon}
          <div>
            <Text strong style={{ color: c.title }}>
              {title}
            </Text>
            <Paragraph style={{ margin: "4px 0 0 0", color: c.desc }}>
              {desc}
            </Paragraph>
            {cta}
          </div>
        </Space>
      </div>
    );
  };

  // === KYC block (UPDATED) ===
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
          icon={
            <CheckCircleTwoTone
              twoToneColor="#10B981"
              style={{ fontSize: 20 }}
            />
          }
          title="Đã xác thực KYC"
          desc="Tài khoản của bạn đã được xác minh."
        />
      );
    }

    if (status === "rejected") {
      return (
        <div>
          <KycBanner
            tone="error"
            icon={
              <ExclamationCircleTwoTone
                twoToneColor="#EF4444"
                style={{ fontSize: 20 }}
              />
            }
            title="KYC đã bị từ chối"
            desc="Vui lòng xem lý do từ chối và xác thực lại KYC."
            cta={
              <div style={{ marginTop: 10 }}>
                <Button
                  type="primary"
                  style={{ background: "#111827", borderColor: "#111827" }}
                >
                  <Link to="/kyc" style={{ color: "#fff" }}>
                    Xác thực lại
                  </Link>
                </Button>
              </div>
            }
          />
          {kycRejectionReason && (
            <Alert
              message="Lý do từ chối"
              description={kycRejectionReason}
              type="error"
              showIcon
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      );
    }

    if (status === "pending") {
      return (
        <KycBanner
          tone="warning"
          icon={
            <SafetyCertificateOutlined
              style={{ fontSize: 20, color: "#B45309" }}
            />
          }
          title="Yêu cầu KYC đang duyệt"
          desc="Chúng tôi sẽ phản hồi sớm nhất."
        />
      );
    }

    return (
      <KycBanner
        tone="info"
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
  }, [customer?.kycStatus, kycStatus, kycRejectionReason]);

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
                          {(() => {
                            const selectedAddrId =
                              infoForm.getFieldValue("selectedAddressId");
                            const selectedAddr = addresses.find(
                              (a) =>
                                a.shippingAddressId === selectedAddrId
                            );
                            return (
                              selectedAddr?.address ||
                              customer.shippingAddress ||
                              "Chưa cập nhật"
                            );
                          })()}
                        </Text>
                      </Space>
                    ),
                  },
                  {
                    key: "bank",
                    label: "Tài khoản ngân hàng",
                    children: (
                      <Space>
                        <BankOutlined />
                        <Text>
                          {(() => {
                            const selectedBankId =
                              infoForm.getFieldValue("selectedBankId");
                            const selectedBank = banks.find(
                              (b) =>
                                b.bankInformationId === selectedBankId
                            );
                            return selectedBank
                              ? `${selectedBank.bankName} - ${selectedBank.bankHolder} - ${selectedBank.cardNumber}`
                              : customer.bankName
                              ? `${customer.bankName} - ${customer.bankAccountHolder} - ${customer.bankAccountNumber}`
                              : "Chưa cập nhật";
                          })()}
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

                          {/* Select địa chỉ */}
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

                          {/* Select ngân hàng */}
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
                                    new Error(
                                      "Mật khẩu xác nhận không khớp"
                                    )
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
            <Input prefix={<HomeOutlined />} placeholder="VD: 12 Nguyễn Trãi" />
          </Form.Item>

          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
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
              style={{ background: "#111827", borderColor: "#111827" }}
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
            rules={[{ required: true, message: "Vui lòng nhập tên ngân hàng" }]}
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
              style={{ background: "#111827", borderColor: "#111827" }}
            >
              {editingBank ? "Cập nhật" : "Thêm"}
            </Button>
          </Space>
        </Form>
      </Modal>

      <style>{`
        .profile-tabs .ant-tabs-ink-bar { background: #111827; }
        .profile-tabs .ant-tabs-tab-btn { color: #6B7280; }
        .profile-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: #111827; }
      `}</style>
    </div>
  );
}
