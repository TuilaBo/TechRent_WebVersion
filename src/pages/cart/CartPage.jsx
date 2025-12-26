// src/pages/cart/CartPage.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Breadcrumb,
  Button,
  InputNumber,
  Divider,
  Space,
  Empty,
  DatePicker,
  TimePicker,
  Tooltip,
  Skeleton,
  Form,
  Input,
  Select,
  AutoComplete,
  Modal,
  Alert,
  Popconfirm,
} from "antd";
import {
  DeleteOutlined,
  ArrowLeftOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getDeviceModelById, normalizeModel, getDeviceAvailability } from "../../lib/deviceModelsApi";
import {
  getCartFromStorage,
  saveCartToStorage,
  removeFromCart,
  updateCartItemQuantity,
  debugCart,
} from "../../lib/cartUtils";
import { getMyKyc } from "../../lib/kycApi";
import {
  fetchMyCustomerProfile,
  createShippingAddress,
  updateShippingAddress,
  createBankInformation,
  updateBankInformation,
  deleteBankInformation,
} from "../../lib/customerApi";
import { fetchDistrictsHCM, fetchWardsByDistrict } from "../../lib/locationVn";
import { createRentalOrder } from "../../lib/rentalOrdersApi";
import { BANKS } from "../../../Bank";

const { Title, Text } = Typography;
const { Option } = Select;

const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });
const disabledPast = (cur) => cur && cur < dayjs().startOf("day");
const CART_DATES_STORAGE_KEY = "techrent-cart-dates";
const PENDING_ORDER_STORAGE_KEY = "pending-order-payload";

/* ===== Helpers: persist/read rental dates ===== */
function persistCartDates(startDate, endDate) {
  if (!startDate || !endDate) return;
  const payload = {
    startDate: dayjs(startDate).format("YYYY-MM-DD"),
    endDate: dayjs(endDate).format("YYYY-MM-DD"),
  };
  try {
    localStorage.setItem(CART_DATES_STORAGE_KEY, JSON.stringify(payload));
    // backup session để hạn chế mất dữ liệu khi tab riêng tư
    sessionStorage.setItem(CART_DATES_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors (quota/unsupported)
  }
}

function readCartDates() {
  try {
    const fromLocal = localStorage.getItem(CART_DATES_STORAGE_KEY);
    const fromSession = sessionStorage.getItem(CART_DATES_STORAGE_KEY);
    const raw = fromLocal || fromSession;
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.startDate || !d?.endDate) return null;
    return { start: dayjs(d.startDate), end: dayjs(d.endDate) };
  } catch {
    return null;
  }
}

const createCartItem = (model, qty = 1) => ({
  id: model.id,
  name: model.name,
  brand: model.brand,
  image: model.image,
  dailyPrice: model.pricePerDay,
  depositPercent: model.depositPercent,
  deviceValue: model.deviceValue,
  qty,
  note: model.description || "",
});

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [itemAvailabilities, setItemAvailabilities] = useState({}); // { itemId: availableCount }
  const [checkingAvailabilities, setCheckingAvailabilities] = useState(false);

  // KYC
  const [kycStatus, setKycStatus] = useState("");
  const [kycLoading, setKycLoading] = useState(true);

  // Customer info
  const [customerId, setCustomerId] = useState(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingAddresses, setShippingAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [note, setNote] = useState("");
  const [bankInformations, setBankInformations] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const hasBankInfo = useMemo(() => (bankInformations?.length ?? 0) > 0, [bankInformations]);
  // Address modal state
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm] = Form.useForm();
  const [bankForm] = Form.useForm();
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

  // Dates (init from storage to avoid reset)
  const initialDates = (() => {
    const stored = readCartDates();
    if (stored?.start && stored?.end) return stored;
    return { start: dayjs().add(1, "day"), end: dayjs().add(6, "day") };
  })();
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [startTime, setStartTime] = useState(() =>
    dayjs().hour(9).minute(0).second(0)
  );
  const [endTime, setEndTime] = useState(() =>
    dayjs().hour(9).minute(0).second(0)
  );

  const applyProfileData = useCallback((profile) => {
    if (!profile) return;
    setCustomerId(profile?.customerId ?? profile?.id ?? null);
    setFullName((prev) => prev || profile?.fullName || profile?.username || "");
    setPhone((prev) => prev || profile?.phoneNumber || "");
    setEmail(profile?.email || "");

    const addresses = profile?.shippingAddressDtos || [];
    setShippingAddresses(addresses);
    if (addresses.length > 0) {
      setSelectedAddressId(addresses[0].shippingAddressId);
      setShippingAddress(addresses[0].address);
    } else {
      setSelectedAddressId(null);
      setShippingAddress(profile?.shippingAddress || "");
    }

    const banks = profile?.bankInformationDtos || profile?.bankInformations || [];
    setBankInformations(banks);
    setSelectedBankId(banks[0]?.bankInformationId || null);
  }, []);

  useEffect(() => {
    const loadCart = async () => {
      try {
        setLoading(true);

        // Prefill customer info
        try {
          const me = await fetchMyCustomerProfile();
          applyProfileData(me);
        } catch {
          // ignore
        }
        // Load districts for address modal (HCM)
        try {
          const ds = await fetchDistrictsHCM();
          setDistricts(Array.isArray(ds) ? ds : []);
        } catch {
          // ignore
        }

        // 1) đọc ngày đã lưu (nếu có)
        const stored = readCartDates();
        if (stored?.start) setStartDate(stored.start);
        if (stored?.end) setEndDate(stored.end);

        // 2) load items
        const cartItems = getCartFromStorage();
        if (!Array.isArray(cartItems) || cartItems.length === 0) {
          setItems([]);
          return;
        }

        const itemsWithDetails = await Promise.all(
          cartItems.map(async (ci) => {
            try {
              const m = await getDeviceModelById(ci.id);
              const nm = normalizeModel(m);
              return createCartItem(nm, ci.qty || 1);
            } catch {
              return {
                id: ci.id,
                name: ci.name,
                image: ci.image,
                dailyPrice: ci.dailyPrice,
                depositPercent: ci.depositPercent ?? 0,
                deviceValue: ci.deviceValue ?? 0,
                qty: ci.qty || 1,
                note: ci.note || "",
              };
            }
          })
        );

        setItems(itemsWithDetails);
        debugCart();
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [applyProfileData]);

  // Load KYC status
  useEffect(() => {
    const loadKycStatus = async () => {
      try {
        setKycLoading(true);
        const kyc = await getMyKyc();
        const status = String(
          kyc?.kycStatus || kyc?.status || ""
        ).toLowerCase();
        setKycStatus(status || "unverified");
      } catch {
        setKycStatus("unverified");
      } finally {
        setKycLoading(false);
      }
    };
    loadKycStatus();
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

  const refreshAddresses = useCallback(async () => {
    try {
      const me = await fetchMyCustomerProfile();
      applyProfileData(me);
    } catch {
      // ignore
    }
  }, [applyProfileData]);

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

  const handleBankSubmit = async (values) => {
    const payload = {
      bankName: values.bankName?.trim(),
      bankHolder: values.bankHolder?.trim(),
      cardNumber: values.cardNumber?.trim(),
    };
    if (!payload.bankName || !payload.bankHolder || !payload.cardNumber) {
      toast.error("Vui lòng nhập đầy đủ thông tin ngân hàng.");
      return;
    }
    try {
      setBankSubmitting(true);
      if (editingBank?.bankInformationId) {
        await updateBankInformation(editingBank.bankInformationId, payload);
        toast.success("Cập nhật thông tin ngân hàng thành công!");
      } else {
        await createBankInformation(payload);
        toast.success("Thêm thông tin ngân hàng thành công!");
      }
      setBankModalVisible(false);
      setEditingBank(null);
      bankForm.resetFields();
      const profile = await fetchMyCustomerProfile();
      applyProfileData(profile);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e?.message || "Không thể lưu thông tin ngân hàng."
      );
    } finally {
      setBankSubmitting(false);
    }
  };

  const handleDeleteBank = async (bankId) => {
    try {
      await deleteBankInformation(bankId);
      toast.success("Đã xóa thông tin ngân hàng.");
      const profile = await fetchMyCustomerProfile();
      applyProfileData(profile);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không thể xóa thông tin ngân hàng.");
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

  // Số ngày thuê
  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = endDate.startOf("day").diff(startDate.startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  // Kết hợp ngày + giờ để gửi BE
  const startDateTime = useMemo(() => {
    if (!startDate || !startTime) return null;
    return startDate
      .hour(startTime.hour())
      .minute(startTime.minute())
      .second(0)
      .millisecond(0);
  }, [startDate, startTime]);

  const endDateTime = useMemo(() => {
    if (!endDate || !endTime) return null;
    return endDate
      .hour(endTime.hour())
      .minute(endTime.minute())
      .second(0)
      .millisecond(0);
  }, [endDate, endTime]);

  // Persist items
  useEffect(() => {
    if (!loading) saveCartToStorage(items);
  }, [items, loading]);

  // Check availability for all items when dates/time change
  useEffect(() => {
    if (!items.length || !startDateTime || !endDateTime) {
      setItemAvailabilities({});
      return;
    }

    const checkAllAvailabilities = async () => {
      try {
        setCheckingAvailabilities(true);
        const start = startDateTime.format("YYYY-MM-DD[T]HH:mm:ss");
        const end = endDateTime.format("YYYY-MM-DD[T]HH:mm:ss");
        
        const results = await Promise.all(
          items.map(async (item) => {
            try {
              const result = await getDeviceAvailability(item.id, start, end);
              const count = typeof result === "number" 
                ? result 
                : (result?.availableCount ?? result?.available ?? result?.count ?? 0);
              return { id: item.id, count: Math.max(0, Number(count) || 0) };
            } catch (err) {
              console.error(`Error checking availability for item ${item.id}:`, err);
              return { id: item.id, count: 0 };
            }
          })
        );

        const availMap = {};
        results.forEach(({ id, count }) => {
          availMap[id] = count;
        });
        setItemAvailabilities(availMap);
      } catch (err) {
        console.error("Error checking availabilities:", err);
      } finally {
        setCheckingAvailabilities(false);
      }
    };

    checkAllAvailabilities();
  }, [items, startDateTime, endDateTime]);

  // Persist dates tự động + đảm bảo khi rời trang
  useEffect(() => {
    if (startDate && endDate) persistCartDates(startDate, endDate);

    const onBeforeUnload = () => {
      if (startDate && endDate) persistCartDates(startDate, endDate);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (startDate && endDate) persistCartDates(startDate, endDate);
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [startDate, endDate]);


  // Tính tiền
  const lineTotals = useMemo(
    () =>
      items.map((it) => {
        const qty = Number(it.qty || 1);
        const subtotal = Number(it.dailyPrice || 0) * days * qty;
        const deposit =
          Number(it.deviceValue || 0) * Number(it.depositPercent || 0) * qty;
        return {
          id: it.id,
          name: it.name,
          qty,
          subtotal,
          deposit,
          depositPercent: Number(it.depositPercent || 0),
        };
      }),
    [items, days]
  );

  const subtotal = useMemo(
    () => lineTotals.reduce((s, x) => s + x.subtotal, 0),
    [lineTotals]
  );
  const deposit = useMemo(
    () => lineTotals.reduce((s, x) => s + x.deposit, 0),
    [lineTotals]
  );
  const grandTotal = useMemo(() => subtotal + deposit, [subtotal, deposit]);

  const updateItem = (id, patch) => {
    const idStr = String(id);
    setItems((prevItems) => {
      const updated = prevItems.map((it) =>
        String(it.id) === idStr ? { ...it, ...patch } : it
      );
      // Update cart storage immediately
      if (patch.qty !== undefined) {
        updateCartItemQuantity(id, patch.qty);
      }
      return updated;
    });
  };

  const removeItemHandler = (id) => {
    const idStr = String(id);
    setItems((prev) => prev.filter((it) => String(it.id) !== idStr));
    removeFromCart(id);
  };

  // Chuẩn hoá kyc -> bucket
  const kycBucket = useMemo(() => {
    const s = String(kycStatus || "").toLowerCase();
    if (!s || s === "unverified") return "unverified";
    if (s.includes("verified") || s.includes("approved")) return "verified";
    if (s.includes("reject") || s.includes("denied")) return "rejected";
    // Trạng thái hồ sơ đã gửi đủ: DOCUMENTS_SUBMITTED (cho phép đặt đơn)
    if (s.includes("documents_submitted") || s.includes("documents-submitted"))
      return "submitted";
    // Các trạng thái khác: đang chờ/pending hoặc review
    if (s.includes("pending") || s.includes("review")) return "pending";
    return "unverified";
  }, [kycStatus]);

  const goShopping = () => {
    persistCartDates(startDate, endDate);
    navigate("/");
  };

  const submitOrderPayload = useCallback(
    async (payload, { silent = false } = {}) => {
      try {
        if (!silent) setPlacing(true);
        else setAutoSubmitting(true);

        const promise = createRentalOrder(payload);

        if (silent) {
          await promise;
          toast.success("Đã đặt đơn thành công!");
        } else {
          await toast.promise(promise, {
            loading: "Đang đặt đơn...",
            success: "Đặt đơn thành công! Vui lòng chờ xử lý.",
            error: (err) =>
              err?.response?.data?.message ||
              err?.message ||
              "Đặt đơn thất bại.",
          });
        }

        sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        saveCartToStorage([]);
        setItems([]);
        setTimeout(() => navigate("/orders"), 1200);
      } finally {
        if (!silent) setPlacing(false);
        else setAutoSubmitting(false);
      }
    },
    [navigate]
  );

  const placeOrder = async () => {
    persistCartDates(startDate, endDate);

    // Validate dates & time
    if (!startDateTime || !endDateTime) {
      return toast.error("Vui lòng chọn đầy đủ ngày và giờ thuê.");
    }
    const now = dayjs();
    if (startDateTime.isBefore(now)) {
      return toast.error("Thời gian bắt đầu thuê không được ở trong quá khứ.");
    }
    if (!endDateTime.isAfter(startDateTime)) {
      return toast.error("Thời gian kết thúc thuê phải sau thời gian bắt đầu thuê.");
    }

    if (!items.length) return toast("Giỏ hàng đang trống.", { icon: "🛒" });
    if (kycLoading) {
      toast.loading("Đang kiểm tra trạng thái KYC...", { id: "kyc-check" });
      setTimeout(() => toast.dismiss("kyc-check"), 900);
      return;
    }
    if (!customerId) return toast.error("Không xác định được khách hàng, vui lòng đăng nhập lại.");
    if (!isNameValid) return toast.error("Vui lòng nhập họ và tên để tiếp tục.");
    if (!isAddressValid)
      return toast.error(
        "Vui lòng chọn hoặc nhập địa chỉ giao hàng để tiếp tục."
      );
    if (!hasBankInfo) {
      toast.error("Vui lòng nhập thông tin tài khoản ngân hàng trước khi đặt đơn.");
      return;
    }

    const payload = {
      startDate: startDateTime.format("YYYY-MM-DD[T]HH:mm:ss"),
      endDate: endDateTime.format("YYYY-MM-DD[T]HH:mm:ss.SSS"),
      shippingAddress: shippingAddress || "",
      orderDetails: items.map((x) => ({
        deviceModelId: x.id,
        quantity: Number(x.qty) || 1,
      })),
    };

    // YÊU CẦU: Cho phép đặt đơn khi KYC đã xác minh hoặc đã nộp đủ hồ sơ (DOCUMENTS_SUBMITTED)
    if (!["verified", "submitted"].includes(kycBucket)) {
      try {
        sessionStorage.setItem(
          PENDING_ORDER_STORAGE_KEY,
          JSON.stringify(payload)
        );
      } catch {
        // ignore storage errors
      }
      toast(
        "Vui lòng hoàn tất KYC trước khi đặt đơn. Đơn hàng sẽ được gửi tự động sau khi KYC hoàn thành.",
        {
          icon: "🪪",
        }
      );
      navigate(`/kyc?return=${encodeURIComponent("/cart")}`);
      return;
    }
    if (placing) return;

    await submitOrderPayload(payload);
  };

  useEffect(() => {
    if (
      kycLoading ||
      autoSubmitting ||
      placing ||
      !["verified", "submitted"].includes(kycBucket) ||
      !hasBankInfo
    ) {
      return;
    }

    const pendingRaw = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!pendingRaw) return;

    try {
      const payload = JSON.parse(pendingRaw);
      toast.loading("Đang gửi đơn đã lưu sau khi hoàn tất KYC...", {
        id: "auto-order",
      });
      submitOrderPayload(payload, { silent: true })
        .then(() => toast.dismiss("auto-order"))
        .catch((err) => {
          toast.dismiss("auto-order");
          toast.error(
            err?.response?.data?.message ||
              err?.message ||
              "Không thể gửi đơn tự động, vui lòng thử lại."
          );
        });
    } catch {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    }
  }, [
    kycLoading,
    kycBucket,
    placing,
    autoSubmitting,
    submitOrderPayload,
    hasBankInfo,
  ]);

  if (loading || kycLoading) {
    return (
      <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <Breadcrumb
            items={[
              { title: <Link to="/">Trang chủ</Link> },
              { title: "Giỏ hàng" },
            ]}
            className="mb-4"
          />
          <Title level={3}>Giỏ hàng</Title>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <Breadcrumb
          items={[
            { title: <Link to="/">Trang chủ</Link> },
            { title: "Giỏ hàng" },
          ]}
          className="mb-4"
        />
        <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
          Giỏ hàng
        </Title>

        <Row gutter={[24, 24]}>
          {/* LEFT: Delivery Info */}
          <Col xs={24} lg={12} xl={11}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={<Text strong>Thông tin nhận hàng</Text>}
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
                  <Input value={email} disabled size="large" />
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
                  {!isAddressValid && (
                    <div style={{ color: "#ef4444", marginTop: 8, fontSize: 13 }}>
                      Vui lòng chọn hoặc nhập địa chỉ giao hàng.
                    </div>
                  )}
                </Form.Item>
                {/* <Form.Item label={<Text strong>Ghi chú thêm (tuỳ chọn)</Text>}>
                  <Input.TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="VD: Giao trước 9h, gọi mình trước khi tới giao nhé…"
                    size="large"
                  />
                </Form.Item> */}

                <Divider />
                <Form.Item
                  label={<Text strong>Thông tin tài khoản ngân hàng</Text>}
                  required
                >
                  {hasBankInfo ? (
                    <Select
                      placeholder="Chọn tài khoản ngân hàng"
                      value={selectedBankId}
                      onChange={(val) => setSelectedBankId(val || null)}
                      allowClear
                      options={bankInformations.map((bank) => ({
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
                                size="small"
                                type="link"
                                icon={<EditOutlined />}
                                onClick={() => openBankModal(bank)}
                              />
                              <Popconfirm
                                title="Xóa thông tin ngân hàng này?"
                                onConfirm={() =>
                                  handleDeleteBank(bank.bankInformationId)
                                }
                                okText="Xóa"
                                cancelText="Hủy"
                              >
                                <Button
                                  size="small"
                                  danger
                                  type="link"
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
                              Thêm tài khoản ngân hàng mới
                            </Button>
                          </div>
                        </>
                      )}
                    />
                  ) : (
                    <Alert
                      type="warning"
                      showIcon
                      message="Bạn chưa thêm thông tin ngân hàng"
                      description={
                        <div>
                          <div style={{ marginBottom: 8, fontSize: 13 }}>
                            Thông tin ngân hàng được dùng để điền vào hợp đồng
                            và tự động lưu trong hồ sơ.
                          </div>
                          <Button type="primary" onClick={() => openBankModal()}>
                            Thêm thông tin ngân hàng
                          </Button>
                        </div>
                      }
                    />
                  )}
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* RIGHT: Summary (wider) */}
          <Col xs={24} lg={12} xl={13}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16, wordBreak: "break-word" }}
              title={<Text strong>Tóm tắt đơn hàng</Text>}
            >
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {/* Thời gian thuê - có thể chọn */}
                <div
                  style={{
                    padding: 12,
                    background: "#F9FAFB",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" className="block" style={{ marginBottom: 4 }}>
                      Ngày bắt đầu thuê
                    </Text>
                    <DatePicker
                      value={startDate}
                      onChange={(v) => {
                        setStartDate(v);
                        persistCartDates(v, endDate);
                        if (v && endDate && v.isAfter(endDate)) {
                          setEndDate(v.add(5, "day"));
                        }
                      }}
                      style={{ width: "100%" }}
                      format="YYYY-MM-DD"
                      disabledDate={disabledPast}
                      suffixIcon={<CalendarOutlined />}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" className="block" style={{ marginBottom: 4 }}>
                      Ngày kết thúc thuê(Dự kiến)
                    </Text>
                    <DatePicker
                      value={endDate}
                      onChange={(v) => {
                        setEndDate(v);
                        persistCartDates(startDate, v);
                      }}
                      style={{ width: "100%" }}
                      format="YYYY-MM-DD"
                      disabledDate={(cur) =>
                        disabledPast(cur) ||
                        (startDate &&
                          cur
                            .startOf("day")
                            .diff(startDate.startOf("day"), "day") <= 0)
                      }
                      suffixIcon={<CalendarOutlined />}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <Text type="secondary" className="block" style={{ marginBottom: 4 }}>
                        Giờ bắt đầu thuê (7:00 - 19:00)
                      </Text>
                      <TimePicker
                        value={startTime}
                        onChange={(t) => {
                          setStartTime(t);
                          setEndTime(t);
                        }}
                        format="HH:mm"
                        style={{ width: "100%" }}
                        disabledTime={() => ({
                          disabledHours: () => [0, 1, 2, 3, 4, 5, 6, 20, 21, 22, 23],
                        })}
                        hideDisabledOptions
                      />
                    </div>
                    <div>
                      <Text type="secondary" className="block" style={{ marginBottom: 4 }}>
                        Giờ kết thúc thuê (Dự kiến)
                      </Text>
                      <TimePicker
                        value={endTime}
                        format="HH:mm"
                        style={{ width: "100%" }}
                        disabled
                      />
                    </div>
                  </div>
                  {checkingAvailabilities && (
                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Đang kiểm tra tính khả dụng cho tất cả sản phẩm...
                      </Text>
                    </div>
                  )}
                  <Divider style={{ margin: "8px 0" }} />
                  <div
                    style={{ display: "grid", gridTemplateColumns: "1fr auto" }}
                  >
                    <Text style={{ fontSize: 15, color: "#111827" }}>
                      Tổng số ngày
                    </Text>
                    <Text strong style={{ fontSize: 16, color: "#111827" }}>
                      {days} ngày
                    </Text>
                  </div>
                </div>

                <Divider />

                {lineTotals.map((ln) => {
                  const item = items.find((i) => i.id === ln.id) || {};
                  const percent = Math.round(
                    Number(item.depositPercent || 0) * 100
                  );
                  const availableCount = itemAvailabilities[ln.id] ?? null;
                  const isItemAvailable = availableCount !== null && availableCount > 0;
                  const canSelectQty = isItemAvailable && ln.qty <= availableCount;
                  return (
                    <div
                      key={ln.id}
                      style={{
                        paddingBottom: 8,
                        borderBottom: "1px solid #F3F4F6",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          marginBottom: 6,
                        }}
                      >
                        {/* Ảnh + bộ chọn số lượng xếp dọc */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 8,
                              background: `url(${item.image}) center/cover no-repeat`,
                              border: "1px solid #E5E7EB",
                              flexShrink: 0,
                            }}
                          />
                          <Space.Compact>
                            <Button
                              size="small"
                              onClick={() =>
                                updateItem(ln.id, {
                                  qty: Math.max(1, (item.qty || ln.qty || 1) - 1),
                                })
                              }
                              disabled={!isItemAvailable}
                            >
                              –
                            </Button>
                            <InputNumber
                              min={1}
                              max={availableCount ?? undefined}
                              value={item.qty || ln.qty || 1}
                              onChange={(v) => {
                                const max = availableCount ?? 0;
                                if (max > 0) {
                                  updateItem(ln.id, { qty: Math.min(Math.max(1, v || 1), max) });
                                } else {
                                  updateItem(ln.id, { qty: v || 1 });
                                }
                              }}
                              style={{ width: 60, textAlign: "center" }}
                              size="small"
                              disabled={!isItemAvailable}
                            />
                            <Button
                              size="small"
                              onClick={() => {
                                const max = availableCount ?? 0;
                                const currentQty = item.qty || ln.qty || 1;
                                if (max > 0) {
                                  updateItem(ln.id, { qty: Math.min(currentQty + 1, max) });
                                } else {
                                  updateItem(ln.id, { qty: currentQty + 1 });
                                }
                              }}
                              disabled={!isItemAvailable || (availableCount !== null && (item.qty || ln.qty || 1) >= availableCount)}
                            >
                              +
                            </Button>
                          </Space.Compact>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            width: "100%",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{ color: "#111827", fontSize: 14, flex: 1 }}
                          >
                            {ln.name}
                          </Text>
                          <Text
                            strong
                            style={{
                              fontSize: 14,
                              color: "#111827",
                              marginLeft: 12,
                            }}
                          >
                            Tiền thuê {ln.qty > 1 ? `(×${ln.qty})` : ''}: {fmtVND(ln.subtotal)}
                          </Text>
                          <Tooltip title="Xoá khỏi giỏ hàng">
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => removeItemHandler(ln.id)}
                              style={{ marginLeft: 8 }}
                            />
                          </Tooltip>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {ln.qty} thiết bị × {days} ngày
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Giá trị thiết bị: {fmtVND(item.deviceValue)}
                        </Text>
                      </div>
                      {/* Bộ chọn số lượng đã chuyển xuống dưới ảnh */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#6B7280" }}>
                          Tiền Cọc = {percent}% × Giá trị thiết bị × SL
                        </span>
                        <Text strong style={{ fontSize: 13, color: "#111827" }}>
                          Tiền Cọc: {fmtVND(ln.deposit)}
                        </Text>
                      </div>
                      {availableCount !== null && (
                        <div style={{ marginTop: 8 }}>
                          {!isItemAvailable ? (
                            <Text type="danger" style={{ fontSize: 12 }}>
                              ⚠️ Không còn thiết bị khả dụng trong khoảng thời gian đã chọn
                            </Text>
                          ) : !canSelectQty ? (
                            <Text type="warning" style={{ fontSize: 12 }}>
                              ⚠️ Chỉ còn {availableCount} thiết bị khả dụng. Vui lòng giảm số lượng.
                            </Text>
                          ) : (
                            <Text type="success" style={{ fontSize: 12 }}>
                              ✓ Còn {availableCount} thiết bị có thể thuê
                            </Text>
                          )}
                        </div>
                      )}
                      {checkingAvailabilities && availableCount === null && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Đang kiểm tra tính khả dụng...
                          </Text>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Space>

              <Divider />

              <div className="space-y-2">
                <div
                  className="flex items-center justify-between"
                  style={{ padding: "8px 0" }}
                >
                  <Text style={{ color: "#6B7280", fontSize: 14 }}>
                    Tổng tiền thuê thiết bị
                  </Text>
                  <Text strong style={{ color: "#111827", fontSize: 15 }}>
                    {fmtVND(subtotal)}
                  </Text>
                </div>
                <div
                  className="flex items-center justify-between"
                  style={{ padding: "8px 0" }}
                >
                  <Text style={{ color: "#6B7280", fontSize: 14 }}>
                    Tổng tiền cọc
                  </Text>
                  <Text strong style={{ color: "#111827", fontSize: 15 }}>
                    {fmtVND(deposit)}
                  </Text>
                </div>
              </div>

              <Divider />

              <div
                className="flex items-center justify-between"
                style={{ padding: "12px 0" }}
              >
                <Text strong style={{ fontSize: 16, color: "#111827" }}>
                  Tổng cộng
                </Text>
                <Title
                  level={4}
                  style={{ margin: 0, color: "#111827", fontSize: 20 }}
                >
                  {fmtVND(grandTotal)}
                </Title>
              </div>

              <div
                style={{
                  background: "#F9FAFB",
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 8,
                  border: "1px solid #E5E7EB",
                }}
              >
                <Text
                  type="secondary"
                  style={{ fontSize: 13, lineHeight: 1.6 }}
                >
                  💡 Tiền cọc được hoàn trả sau khi bạn trả thiết bị trong tình
                  trạng tốt
                </Text>
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<ShoppingCartOutlined />}
                onClick={placeOrder}
                loading={placing}
                style={{
                  marginTop: 12,
                  background: "#111827",
                  borderColor: "#111827",
                }}
              >
                Đặt đơn thuê
              </Button>

              <Button
                type="link"
                block
                icon={<ArrowLeftOutlined />}
                style={{ marginTop: 8, color: "#6B7280" }}
                onClick={goShopping}
              >
                Tiếp tục mua sắm
              </Button>
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
                  rules={[{ required: true, message: "Vui lòng chọn hoặc nhập phường/xã" }]}
                >
                  <AutoComplete
                    placeholder={
                      modalWardsLoading
                        ? "Đang tải..."
                        : modalWardOptions.length === 0 && modalDistrictCode
                        ? "API lỗi - Nhập tay phường/xã"
                        : "Chọn hoặc nhập phường/xã"
                    }
                    options={modalWardOptions}
                    disabled={!modalDistrictCode}
                    filterOption={(inputValue, option) =>
                      option?.label?.toLowerCase().includes(inputValue.toLowerCase())
                    }
                    allowClear
                    notFoundContent={modalWardsLoading ? "Đang tải..." : "Không tìm thấy"}
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

            <Modal
              title={editingBank ? "Sửa thông tin ngân hàng" : "Thêm thông tin ngân hàng"}
              open={bankModalVisible}
              onCancel={() => {
                setBankModalVisible(false);
                setEditingBank(null);
                bankForm.resetFields();
              }}
              footer={null}
              width={520}
              destroyOnClose
            >
              <Form
                form={bankForm}
                layout="vertical"
                onFinish={handleBankSubmit}
                requiredMark={false}
              >
                <Form.Item
                  label="Ngân hàng"
                  name="bankName"
                  rules={[{ required: true, message: "Vui lòng chọn ngân hàng" }]}
                >
                  <Select
                    placeholder="Chọn ngân hàng"
                    showSearch
                    optionFilterProp="label"
                    options={BANKS}
                  />
                </Form.Item>
                <Form.Item
                  label="Chủ tài khoản"
                  name="bankHolder"
                  rules={[{ required: true, message: "Vui lòng nhập chủ tài khoản" }]}
                >
                  <Input placeholder="Họ và tên chủ tài khoản" />
                </Form.Item>
                <Form.Item
                  label="Số tài khoản"
                  name="cardNumber"
                  rules={[
                    { required: true, message: "Vui lòng nhập số tài khoản" },
                    { pattern: /^[0-9\s-]{6,20}$/, message: "Số tài khoản không hợp lệ" },
                  ]}
                >
                  <Input placeholder="VD: 0123456789" />
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
                  <Button type="primary" htmlType="submit" loading={bankSubmitting}>
                    {editingBank ? "Cập nhật" : "Thêm"}
                  </Button>
                </Space>
              </Form>
            </Modal>
          </Col>
        </Row>
      </div>
    </div>
  );
}
