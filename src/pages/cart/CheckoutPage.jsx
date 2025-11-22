// src/pages/cart/CheckoutPage.jsx (hoặc Checkout.jsx)
import React, { useEffect, useMemo, useState } from "react";
import {
  Row, Col, Card, Typography, Breadcrumb, Button, Divider, Space,
  Skeleton, Form, Input, Select, Modal
} from "antd";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getCartFromStorage, clearCart } from "../../lib/cartUtils";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";
import { fetchMyCustomerProfile, createShippingAddress, updateShippingAddress } from "../../lib/customerApi";
import { fetchDistrictsHCM, fetchWardsByDistrict } from "../../lib/locationVn";
import { createRentalOrder } from "../../lib/rentalOrdersApi";
import { ShoppingCartOutlined, CheckCircleOutlined } from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

const CART_DATES_STORAGE_KEY = "techrent-cart-dates";
const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

// IMPORTANT: send local-time ISO WITHOUT timezone (avoid UTC shift -7h)
// Example: 2025-10-29T00:00:00 and 2025-10-30T23:59:59.999
const toISOStartOfDay = (d) => dayjs(d).startOf("day").format("YYYY-MM-DD[T]HH:mm:ss");
const toISOEndOfDay   = (d) => dayjs(d).endOf("day").format("YYYY-MM-DD[T]HH:mm:ss.SSS");

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const [items, setItems] = useState([]);
  // Init dates from storage immediately to avoid overwriting with defaults
  const initialDates = (() => {
    try {
      const raw = localStorage.getItem(CART_DATES_STORAGE_KEY) || sessionStorage.getItem(CART_DATES_STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.startDate && d?.endDate) {
          return { start: dayjs(d.startDate), end: dayjs(d.endDate) };
        }
      }
    } catch {
      // ignore storage parsing errors
    }
    return { start: dayjs().add(1, "day"), end: dayjs().add(6, "day") };
  })();
  const [startDate, _setStartDate] = useState(initialDates.start);
  const [endDate, _setEndDate] = useState(initialDates.end);

  // Customer info
  const [customerId, setCustomerId] = useState(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingAddresses, setShippingAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [note, setNote] = useState("");
  // Address modal state
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm] = Form.useForm();
  const [districts, setDistricts] = useState([]);
  const [modalDistrictCode, setModalDistrictCode] = useState(null);
  const [modalWardOptions, setModalWardOptions] = useState([]);
  const [modalWardsLoading, setModalWardsLoading] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const isNameValid = useMemo(() => String(fullName || "").trim().length > 0, [fullName]);
  const isAddressValid = useMemo(() => {
    const s = String(shippingAddress || "").trim();
    return Boolean(selectedAddressId) || s.length > 0;
  }, [selectedAddressId, shippingAddress]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // prefilling customer info (không fail toàn trang nếu lỗi)
        try {
          const me = await fetchMyCustomerProfile();
          setCustomerId(me?.customerId ?? me?.id ?? null);
          setFullName(me?.fullName ?? me?.username ?? "");
          setPhone(me?.phoneNumber ?? "");
          setEmail(me?.email ?? "");
          setShippingAddress(me?.shippingAddress ?? "");
          // Load shipping addresses array
          const addresses = me?.shippingAddressDtos || [];
          setShippingAddresses(addresses);
          // Pre-select first address if available
          if (addresses.length > 0) {
            setSelectedAddressId(addresses[0].shippingAddressId);
            setShippingAddress(addresses[0].address);
          }
        } catch {
          // ignore prefill errors
        }

        // dates đã init từ storage ở bước khởi tạo state (tránh ghi đè)

        // load giỏ hàng
        const cart = getCartFromStorage();
        if (!Array.isArray(cart) || cart.length === 0) {
          setItems([]);
          return;
        }

        const normalized = await Promise.all(
          cart.map(async (it) => {
            try {
              const m = await getDeviceModelById(it.id);
              const nm = normalizeModel(m);
              return { ...nm, qty: it.qty || 1 };
            } catch {
              return {
                id: it.id, name: it.name, image: it.image,
                pricePerDay: it.dailyPrice,
                depositPercent: it.depositPercent ?? 0,
                deviceValue: it.deviceValue ?? 0,
                qty: it.qty || 1,
              };
            }
          })
        );
        setItems(normalized);
        // Load districts for address modal
        try {
          const ds = await fetchDistrictsHCM();
          setDistricts(Array.isArray(ds) ? ds : []);
        } catch {
          // ignore
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Address modal helpers
  const openAddressModal = (addr = null) => {
    setEditingAddress(addr);
    if (addr) {
      addressForm.setFieldsValue({
        districtCode: addr.districtCode ?? undefined,
        wardCode: addr.wardCode ?? undefined,
        addressLine: addr.addressLine ?? addr.address ?? "",
      });
      const dCode = addr.districtCode ?? null;
      setModalDistrictCode(dCode);
      if (dCode) {
        setModalWardsLoading(true);
        fetchWardsByDistrict(dCode)
          .then((ws) => setModalWardOptions(Array.isArray(ws) ? ws : []))
          .catch(() => setModalWardOptions([]))
          .finally(() => setModalWardsLoading(false));
      } else {
        setModalWardOptions([]);
      }
    } else {
      addressForm.resetFields();
      setModalDistrictCode(null);
      setModalWardOptions([]);
    }
    setAddressModalVisible(true);
  };

  const refreshAddresses = async () => {
    try {
      const me = await fetchMyCustomerProfile();
      const list = me?.shippingAddressDtos || [];
      setShippingAddresses(list);
      if (list.length > 0) {
        // chọn địa chỉ đầu tiên sau khi thêm/sửa
        setSelectedAddressId(list[0].shippingAddressId);
        setShippingAddress(list[0].address);
      } else {
        setSelectedAddressId(null);
        setShippingAddress("");
      }
    } catch {
      // ignore
    }
  };

  const handleAddressSubmit = async (values) => {
    const { districtCode, wardCode, addressLine } = values || {};
    if (!districtCode || !wardCode || !String(addressLine || "").trim()) {
      toast.error("Vui lòng chọn quận, phường và nhập địa chỉ chi tiết.");
      return;
    }
    try {
      setAddressSubmitting(true);
      const districtName = districts.find((d) => d.value === districtCode)?.label || "";
      const wardName = modalWardOptions.find((w) => w.value === wardCode)?.label || "";
      const composed = `${(addressLine || "").trim()}${wardName ? `, ${wardName}` : ""}${districtName ? `, ${districtName}` : ""}, TP. Hồ Chí Minh`;
      const body = { address: composed };
      if (editingAddress?.shippingAddressId) {
        await updateShippingAddress(editingAddress.shippingAddressId, body);
        toast.success("Đã cập nhật địa chỉ.");
      } else {
        await createShippingAddress(body);
        toast.success("Đã thêm địa chỉ mới.");
      }
      await refreshAddresses();
      setAddressModalVisible(false);
      setEditingAddress(null);
      addressForm.resetFields();
      setModalDistrictCode(null);
      setModalWardOptions([]);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Lưu địa chỉ thất bại.");
    } finally {
      setAddressSubmitting(false);
    }
  };

  const onDistrictChange = async (code) => {
    addressForm.setFieldsValue({ wardCode: undefined });
    setModalDistrictCode(code || null);
    if (!code) {
      setModalWardOptions([]);
      return;
    }
    setModalWardsLoading(true);
    try {
      const ws = await fetchWardsByDistrict(code);
      setModalWardOptions(Array.isArray(ws) ? ws : []);
    } catch {
      setModalWardOptions([]);
    } finally {
      setModalWardsLoading(false);
    }
  };

  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = endDate.startOf("day").diff(startDate.startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  // Persist dates so that CartPage can restore when user navigates back
  useEffect(() => {
    if (startDate && endDate) {
      localStorage.setItem(
        CART_DATES_STORAGE_KEY,
        JSON.stringify({
          startDate: startDate.format("YYYY-MM-DD"),
          endDate: endDate.format("YYYY-MM-DD"),
        })
      );
    }
  }, [startDate, endDate]);

  // Tính tiền
  const lineTotals = useMemo(() => {
    return items.map((it) => {
      const qty = Number(it.qty || 1);
      const subtotal = Number(it.pricePerDay || 0) * days * qty;
      // Không làm tròn để đồng bộ với số liệu từ backend (orderDetails)
      const deposit = Number(it.deviceValue || 0) * Number(it.depositPercent || 0) * qty;
      return {
        id: it.id,
        name: it.name,
        qty,
        pricePerDay: Number(it.pricePerDay || 0),
        subtotal,
        deposit,
        depositPercent: Number(it.depositPercent || 0),
      };
    });
  }, [items, days]);

  const subtotal = useMemo(
    () => lineTotals.reduce((s, x) => s + x.subtotal, 0),
    [lineTotals]
  );
  const deposit = useMemo(
    () => lineTotals.reduce((s, x) => s + x.deposit, 0),
    [lineTotals]
  );
  const grandTotal = useMemo(() => subtotal + deposit, [subtotal, deposit]);

  const placeOrder = async () => {
    if (!items.length) return toast.error("Giỏ hàng đang trống.");
    if (!customerId) return toast.error("Không xác định được khách hàng, vui lòng đăng nhập lại.");
    if (!isNameValid) return toast.error("Vui lòng nhập họ và tên để tiếp tục.");
    if (!isAddressValid) return toast.error("Vui lòng chọn hoặc nhập địa chỉ giao hàng để tiếp tục.");
    if (placing) return; // chặn double click

    setPlacing(true);

    const payload = {
      startDate: toISOStartOfDay(startDate),
      endDate: toISOEndOfDay(endDate),
      shippingAddress: (shippingAddress || ""),
      // customerId được lấy tự động từ token xác thực, không cần gửi trong payload
      orderDetails: items.map((x) => ({
        deviceModelId: x.id,
        quantity: Number(x.qty) || 1,
      })),
      // có thể gửi note nếu BE hỗ trợ
      // note,
    };

    try {
      await toast.promise(createRentalOrder(payload), {
        loading: "Đang đặt đơn...",
        success: "Đặt đơn thành công! Vui lòng chờ xử lý.",
        error: (err) =>
          err?.response?.data?.message || err?.message || "Đặt đơn thất bại.",
      });

      clearCart();

      // cho người dùng kịp thấy toast rồi mới điều hướng
      setTimeout(() => {
        navigate("/orders");
      }, 1200);
    } catch {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <Breadcrumb
            items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Thanh toán" }]}
            className="mb-4"
          />
          <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
            Thanh toán
          </Title>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <Breadcrumb
          items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Thanh toán" }]}
          className="mb-4"
        />
        <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
          Xác nhận & Thanh toán
        </Title>

        <Row gutter={[24, 24]}>
          {/* LEFT: Info */}
          <Col xs={24} lg={14}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 20 }}
              title={<Text strong style={{ fontSize: 16 }}>Thông tin nhận hàng</Text>}
            >
              <Form layout="vertical">
                <Form.Item label={<Text strong>Họ và tên</Text>}>
                  <Input 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    placeholder="Nhập họ và tên"
                    size="large"
                  />
                </Form.Item>
                <Form.Item label={<Text strong>Số điện thoại</Text>}>
                  <Input 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="09xx xxx xxx"
                    size="large"
                  />
                </Form.Item>
                <Form.Item label={<Text strong>Email</Text>}>
                  <Input 
                    value={email} 
                    disabled 
                    size="large"
                  />
                </Form.Item>
                <Form.Item label={<Text strong>Địa chỉ giao hàng</Text>} required>
                  {shippingAddresses.length > 0 ? (
                    <>
                      <Select
                        placeholder="Chọn địa chỉ giao hàng"
                        value={selectedAddressId}
                        onChange={(addressId) => {
                          setSelectedAddressId(addressId || null);
                          const addr = shippingAddresses.find(a => a.shippingAddressId === addressId);
                          setShippingAddress(addr?.address || "");
                        }}
                        options={shippingAddresses.map((addr) => ({
                          value: addr.shippingAddressId,
                          label: addr.address,
                        }))}
                        size="large"
                        allowClear
                      />
                      <div style={{ marginTop: 8 }}>
                        <Button type="link" style={{ padding: 0 }} onClick={() => openAddressModal()}>
                          Thêm địa chỉ mới →
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <Button
                        type="primary"
                        ghost
                        size="large"
                        block
                        onClick={() => openAddressModal()}
                        style={{ height: 44 }}
                      >
                        Thêm địa chỉ mới
                      </Button>
                      <div style={{ color: "#6B7280", marginTop: 8, fontSize: 13 }}>
                        Chưa có địa chỉ nào. Bấm để thêm địa chỉ nhận hàng.
                      </div>
                    </div>
                  )}
<<<<<<< HEAD

                  {/* THỜI GIAN NHẬN HÀNG */}
                  <Form.Item
                    label="Thời gian nhận hàng"
                    name="receiveAt"
                    rules={[{ required: true, message: "Chọn thời gian nhận hàng" }]}
                  >
                    <DatePicker showTime style={{ width: "100%" }} />
                  </Form.Item>
                </Card>

                <div className="mt-4">
                  <Button type="primary" size="large" htmlType="submit" block>
                   Tạo đơn thuê 
                  </Button>
                </div>
=======
                  {!isAddressValid && (
                    <div style={{ color: "#ef4444", marginTop: 8, fontSize: 13 }}>
                      Vui lòng chọn hoặc nhập địa chỉ giao hàng.
                    </div>
                  )}
                </Form.Item>
                <Form.Item label={<Text strong>Ghi chú thêm (tuỳ chọn)</Text>}>
                  <Input.TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="VD: Giao trước 9h, gọi mình trước khi tới…"
                    size="large"
                  />
                </Form.Item>
>>>>>>> dev
              </Form>
            </Card>
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
              destroyOnClose
            >
              <Form
                form={addressForm}
                layout="vertical"
                onFinish={handleAddressSubmit}
                requiredMark={false}
              >
                <Form.Item
                  label="Quận/Huyện"
                  name="districtCode"
                  rules={[{ required: true, message: "Vui lòng chọn quận/huyện" }]}
                >
                  <Select
                    placeholder="Chọn quận/huyện"
                    options={districts}
                    showSearch
                    optionFilterProp="label"
                    onChange={onDistrictChange}
                    allowClear
                  />
                </Form.Item>
                <Form.Item
                  label="Phường/Xã"
                  name="wardCode"
                  rules={[{ required: true, message: "Vui lòng chọn phường/xã" }]}
                >
                  <Select
                    placeholder="Chọn phường/xã"
                    loading={modalWardsLoading}
                    options={modalWardOptions}
                    disabled={!modalDistrictCode}
                    showSearch
                    optionFilterProp="label"
                    allowClear
                  />
                </Form.Item>
                <Form.Item
                  label="Địa chỉ chi tiết"
                  name="addressLine"
                  rules={[{ required: true, message: "Vui lòng nhập địa chỉ chi tiết" }]}
                >
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    placeholder="Số nhà, tên đường…"
                  />
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
                  <Button type="primary" htmlType="submit" loading={addressSubmitting}>
                    {editingAddress ? "Cập nhật" : "Thêm"}
                  </Button>
                </Space>
              </Form>
            </Modal>

            <Card
              bordered
              className="rounded-xl mt-3"
              bodyStyle={{ padding: 20 }}
              title={<Text strong style={{ fontSize: 16 }}>Sản phẩm ({items.length})</Text>}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                {lineTotals.map((ln) => {
                  const item = items.find((i) => i.id === ln.id) || {};
                  const percent = Math.round(Number(item.depositPercent || 0) * 100);
                  return (
                    <div
                      key={ln.id}
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                        padding: 16,
                        background: "#F9FAFB",
                        borderRadius: 10,
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          flexShrink: 0,
                          borderRadius: 10,
                          background: `url(${item.image}) center/cover no-repeat`,
                          border: "1px solid #E5E7EB",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: "block", fontSize: 15, color: "#111827", marginBottom: 6 }}>
                          {ln.name}
                        </Text>
                        <div style={{ marginBottom: 4 }}>
                          <Text style={{ fontSize: 14, color: "#111827" }}>
                            Số lượng: <strong>{ln.qty} thiết bị</strong> • Thời gian: <strong>{days} ngày</strong>
                          </Text>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            Giá thuê: {fmtVND(ln.pricePerDay)}/ngày
                          </Text>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            Giá trị thiết bị: <strong style={{ color: "#111827" }}>{fmtVND(item.deviceValue)}</strong>
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            Tiền cọc ({percent}%): <strong style={{ color: "#111827" }}>{fmtVND(ln.deposit)}</strong>
                          </Text>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <Text strong style={{ display: "block", fontSize: 16, color: "#111827" }}>
                          {fmtVND(ln.subtotal)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Tiền thuê
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </Space>
            </Card>
          </Col>

          {/* RIGHT: Summary */}
          <Col xs={24} lg={10}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 20 }}
              title={<Text strong style={{ fontSize: 16 }}>Tóm tắt đơn hàng</Text>}
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div style={{ 
                  padding: 12, 
                  background: "#F9FAFB", 
                  borderRadius: 10,
                  border: "1px solid #E5E7EB"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Ngày bắt đầu thuê</Text>
                    <Text strong style={{ fontSize: 14, color: "#111827" }}>{startDate?.format("DD/MM/YYYY")}</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Ngày kết thúc thuê</Text>
                    <Text strong style={{ fontSize: 14, color: "#111827" }}>{endDate?.format("DD/MM/YYYY")}</Text>
                  </div>
                  <Divider style={{ margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 15, color: "#111827" }}>Tổng số ngày</Text>
                    <Text strong style={{ fontSize: 16, color: "#111827" }}>{days} ngày</Text>
                  </div>
                </div>

                <Divider />

                {lineTotals.map((ln) => {
                  const item = items.find((i) => i.id === ln.id) || {};
                  const percent = Math.round(Number(item.depositPercent || 0) * 100);
                  return (
                    <div
                      key={ln.id}
                      style={{ 
                        paddingBottom: 8,
                        borderBottom: "1px solid #F3F4F6"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: `url(${item.image}) center/cover no-repeat`,
                            border: "1px solid #E5E7EB",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                          <Text style={{ color: "#111827", fontSize: 14, flex: 1 }}>
                            {ln.name}
                          </Text>
                          <Text strong style={{ fontSize: 14, color: "#111827", marginLeft: 12 }}>
                           Tiền thuê: {fmtVND(ln.subtotal)}
                          </Text>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {ln.qty} thiết bị × {days} ngày
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Giá trị thiết bị: {fmtVND(item.deviceValue)}
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>
                          Tiền Cọc = {percent}% × Giá trị thiết bị × SL
                        </span>
                        <span style={{ fontSize: 13, color: "#6B7280" }}>
                          Tiền Cọc: <strong style={{ color: "#111827" }}>{fmtVND(ln.deposit)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}

                <Divider />

                <div style={{ padding: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Tổng tiền thuê thiết bị</Text>
                    <Text strong style={{ fontSize: 15, color: "#111827" }}>{fmtVND(subtotal)}</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Tổng tiền cọc</Text>
                    <Text strong style={{ fontSize: 15, color: "#111827" }}>{fmtVND(deposit)}</Text>
                  </div>
                </div>

                <Divider />

                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  padding: "8px 0"
                }}>
                  <Text strong style={{ fontSize: 16, color: "#111827" }}>Tổng cộng</Text>
                  <Title level={4} style={{ margin: 0, fontSize: 20, color: "#111827" }}>
                    {fmtVND(grandTotal)}
                  </Title>
                </div>

                <div style={{ 
                  background: "#F9FAFB", 
                  padding: 10, 
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  marginTop: 6
                }}>
                  <Text style={{ fontSize: 13, lineHeight: 1.6, color: "#6B7280" }}>
                    💡 Tiền cọc được hoàn trả sau khi bạn trả thiết bị trong tình trạng tốt
                  </Text>
                </div>

                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  block
                  onClick={placeOrder}
                  loading={placing}
                  style={{ 
                    background: "#111827", 
                    borderColor: "#111827",
                    height: 48,
                    fontSize: 16,
                    fontWeight: 500,
                    marginTop: 10
                  }}
                >
                  Đặt đơn thuê
                </Button>

                <Button 
                  icon={<ShoppingCartOutlined />} 
                  block 
                  onClick={() => navigate("/cart")} 
                  disabled={placing}
                  size="large"
                  style={{ height: 44 }}
                >
                  Quay lại giỏ hàng
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}