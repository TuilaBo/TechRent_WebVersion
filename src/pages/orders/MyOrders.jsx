// src/pages/orders/MyOrders.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Table, Tag, Typography, Input, DatePicker, Space, Button,
  Dropdown, Menu, Tooltip, message, Drawer, List, Descriptions,
  Avatar, Empty, Tabs, Modal, Card, Row, Col, Divider, Form
} from "antd";
import {
  SearchOutlined, FilterOutlined, EyeOutlined,
  ReloadOutlined, FilePdfOutlined, DownloadOutlined, ExpandOutlined
} from "@ant-design/icons";
import { listRentalOrders, getRentalOrderById } from "../../lib/rentalOrdersApi";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getMyContracts, getContractById, normalizeContract, sendPinEmail, signContract } from "../../lib/contractApi";
import { fetchMyCustomerProfile, normalizeCustomer } from "../../lib/customerApi";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AnimatedEmpty from "../../components/AnimatedEmpty.jsx";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ORDER_STATUS_MAP = {
  pending:   { label: "Chờ xác nhận", color: "default" },
  confirmed: { label: "Đã xác nhận",  color: "blue"    },
  delivering:{ label: "Đang giao",    color: "cyan"    },
  active:    { label: "Đang thuê",    color: "gold"    },
  returned:  { label: "Đã trả",       color: "green"   },
  cancelled: { label: "Đã hủy",       color: "red"     },
};
const PAYMENT_STATUS_MAP = {
  unpaid:   { label: "Chưa thanh toán",      color: "volcano"  },
  paid:     { label: "Đã thanh toán",        color: "green"    },
  refunded: { label: "Đã hoàn tiền",         color: "geekblue" },
  partial:  { label: "Thanh toán một phần",  color: "purple"   },
};

function formatVND(n = 0) {
  try { return Number(n).toLocaleString("vi-VN", { style: "currency", currency: "VND" }); }
  catch { return `${n}`; }
}
function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
function diffDays(startIso, endIso) {
  if (!startIso || !endIso) return 1;
  const s = new Date(startIso);
  const e = new Date(endIso);
  const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, days || 1);
}

/** Chuẩn hóa 1 order trả về từ API về model UI */
async function mapOrderFromApi(order) {
  // ID số cho BE
  const backendId =
    order?.id ||
    order?.rentalOrderId ||
    order?.orderId ||
    order?.rentalId ||
    null;

  // Mã hiển thị cho UI
  const displayId =
    order?.rentalOrderCode ||
    order?.orderCode ||
    order?.code ||
    (backendId != null ? String(backendId) : "—");

  // Map items từ orderDetails -> lấy thêm tên/ảnh và các thông tin giá cọc
  const items = await Promise.all(
    (order?.orderDetails || []).map(async (detail) => {
      try {
        const model = detail?.deviceModelId
          ? await getDeviceModelById(detail.deviceModelId)
          : null;
        const deviceValue = Number(detail?.deviceValue ?? model?.deviceValue ?? 0);
        const depositPercent = Number(detail?.depositPercent ?? model?.depositPercent ?? 0);
        const depositAmountPerUnit = Number(detail?.depositAmountPerUnit ?? (deviceValue * depositPercent));
        return {
          name: model?.deviceName || model?.name || detail?.deviceName || `Model ${detail?.deviceModelId ?? ""}`,
          qty: detail?.quantity ?? 1,
          image: model?.imageURL || model?.imageUrl || detail?.imageUrl || "",
          pricePerDay: Number(detail?.pricePerDay ?? model?.pricePerDay ?? 0),
          depositAmountPerUnit,
          deviceValue,
          depositPercent,
          deviceModelId: detail?.deviceModelId ?? model?.id ?? null,
        };
      } catch {
        const deviceValue = Number(detail?.deviceValue ?? 0);
        const depositPercent = Number(detail?.depositPercent ?? 0);
        const depositAmountPerUnit = Number(detail?.depositAmountPerUnit ?? (deviceValue * depositPercent));
        return {
          name: detail?.deviceName || `Model ${detail?.deviceModelId ?? ""}`,
          qty: detail?.quantity ?? 1,
          image: "",
          pricePerDay: Number(detail?.pricePerDay ?? 0),
          depositAmountPerUnit,
          deviceValue,
          depositPercent,
          deviceModelId: detail?.deviceModelId ?? null,
        };
      }
    })
  );

  const startDate = order?.startDate ?? order?.rentalStartDate ?? null;
  const endDate   = order?.endDate   ?? order?.rentalEndDate   ?? null;

  // Tính số ngày ưu tiên theo tiền BE trả về để đồng bộ hiển thị
  const rawTotal = Number(order?.totalPrice ?? order?.total ?? 0);
  const rawDailyFromBE = Number(order?.pricePerDay ?? 0);
  const dailyFromItems = items.reduce(
    (s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1),
    0
  );
  const dailyTotal = rawDailyFromBE > 0 ? rawDailyFromBE : dailyFromItems;
  const daysFromMoney = dailyTotal > 0 ? Math.max(1, Math.round(rawTotal / dailyTotal)) : 0;
  const daysByRange = diffDays(startDate, endDate);
  const normalizedDays = daysFromMoney || daysByRange || 1;

  return {
    // QUAN TRỌNG: id là Long cho BE
    id: backendId,
    // mã hiển thị
    displayId,

    createdAt: order?.createdAt ?? order?.created_date ?? null,
    startDate,
    endDate,
    days: normalizedDays,

    items,
    total: order?.totalPrice ?? order?.total ?? 0,
    orderStatus: order?.orderStatus ?? "pending",
    paymentStatus: order?.paymentStatus ?? "unpaid",
    depositAmountHeld: order?.depositAmount ?? order?.depositAmountHeld ?? 0,
    depositAmountReleased: order?.depositAmountReleased ?? 0,
    depositAmountUsed: order?.depositAmountUsed ?? 0,
    cancelReason: order?.cancelReason ?? null,
    contractUrl: order?.contractUrl ?? "",
    contractFileName:
      order?.contractFileName ??
      `${displayId}.pdf`,
  };
}

export default function MyOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [allContracts, setAllContracts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractDetail, setContractDetail] = useState(null);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [contractCustomer, setContractCustomer] = useState(null);
  const [signingContract, setSigningContract] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [currentContractId, setCurrentContractId] = useState(null);
  const [pinSent, setPinSent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [customerProfile, setCustomerProfile] = useState(null);

  useEffect(() => { 
    loadOrders(); 
    loadAllContracts();
    loadCustomerProfile();
  }, []);

  const loadCustomerProfile = async () => {
    try {
      const profile = await fetchMyCustomerProfile();
      const normalized = normalizeCustomer(profile || {});
      setCustomerProfile(normalized);
    } catch (e) {
      console.error("Failed to load customer profile:", e);
      // Không hiển thị error để không làm gián đoạn UX
    }
  };

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await listRentalOrders(); // kỳ vọng là mảng order
      const mapped = await Promise.all((res || []).map(mapOrderFromApi));
      setOrders(mapped.filter(o => o && o.id != null)); // chỉ nhận order có id Long
    } catch (err) {
      console.error(err);
      message.error("Không thể tải danh sách đơn hàng.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const data = useMemo(() => {
    let rows = [...orders];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.displayId).toLowerCase().includes(q) ||
          r.items.some((it) => (it.name || "").toLowerCase().includes(q))
      );
    }
    if (statusFilter) rows = rows.filter((r) => r.orderStatus === statusFilter);
    if (dateRange?.length === 2) {
      const [s, e] = dateRange;
      const start = s.startOf("day").toDate().getTime();
      const end = e.endOf("day").toDate().getTime();
      rows = rows.filter((r) => {
        const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return t >= start && t <= end;
      });
    }
    return rows.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
  }, [search, statusFilter, dateRange, orders]);

  const refresh = async () => {
    setLoading(true);
    await loadOrders();
    await loadAllContracts();
    setLoading(false);
    message.success("Đã tải lại danh sách đơn và hợp đồng.");
  };

  const showDetail = async (record) => {
    // id phải là Long cho BE
    const idNum = Number(record?.id);
    if (!record || record.id == null || Number.isNaN(idNum)) {
      message.error("ID đơn hàng không hợp lệ để xem chi tiết.");
      return;
    }
    setCurrent(record);
    setDetailOpen(true);

    try {
      const fullOrder = await getRentalOrderById(idNum);
      if (fullOrder) {
        const mapped = await mapOrderFromApi(fullOrder);
        // Giữ items cũ nếu API detail không có orderDetails
        setCurrent(prev => ({
          ...prev,
          ...mapped,
          items: (mapped?.items?.length ? mapped.items : prev.items) ?? [],
        }));
      }
      
      // Load contracts for this order
      await loadOrderContracts(idNum);
    } catch (err) {
      console.error("Error loading order details:", err);
      // vẫn giữ record đang có
    }
  };

  const loadAllContracts = async () => {
    try {
      console.log('Loading all contracts...');
      const allContracts = await getMyContracts();
      console.log('Raw contracts from API:', allContracts);
      const normalized = Array.isArray(allContracts) ? allContracts.map(normalizeContract) : [];
      console.log('Normalized contracts:', normalized);
      setAllContracts(normalized);
    } catch (e) {
      console.error("Failed to fetch all contracts:", e);
      setAllContracts([]);
    }
  };

  const loadOrderContracts = async (orderId, contractsToFilter = null) => {
    try {
      setContractsLoading(true);
      
      // Use provided contracts or fetch if needed
      let contracts = contractsToFilter;
      if (!contracts) {
        // If contracts haven't been loaded yet, load them first
        if (allContracts.length === 0) {
          console.log('Contracts not loaded yet, loading all contracts first...');
          await loadAllContracts();
        }
        contracts = allContracts;
      }
      
      // Filter contracts by order ID
      const orderContracts = contracts.filter(contract => 
        contract.orderId === orderId || 
        contract.orderId === Number(orderId) ||
        String(contract.orderId) === String(orderId)
      );
      console.log('Filtering contracts for orderId:', orderId);
      console.log('All contracts:', contracts);
      console.log('Filtered contracts:', orderContracts);
      setContracts(orderContracts);
    } catch (e) {
      console.error("Failed to filter order contracts:", e);
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const viewContractDetail = async (contractId) => {
    try {
      setLoadingContractDetail(true);
      const contract = await getContractById(contractId);
      const normalized = normalizeContract(contract);
      console.log('Contract detail loaded:', normalized);
      console.log('Contract status:', normalized.status);
      console.log('Status check:', String(normalized.status).toUpperCase() === "PENDING_SIGNATURE");
      setContractDetail(normalized);
      
      // Sử dụng customerProfile đã có sẵn hoặc fetch lại từ profile API
      if (customerProfile) {
        setContractCustomer(customerProfile);
      } else {
        try {
          const profile = await fetchMyCustomerProfile();
          const normalizedProfile = normalizeCustomer(profile || {});
          setCustomerProfile(normalizedProfile);
          setContractCustomer(normalizedProfile);
        } catch (e) {
          console.error("Failed to fetch customer profile:", e);
          setContractCustomer(null);
        }
      }
      
      setContractDetailOpen(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải được chi tiết hợp đồng.");
    } finally {
      setLoadingContractDetail(false);
    }
  };

  const handleSignContract = async (contractId) => {
    console.log('Starting contract signing for ID:', contractId);
    if (!contractId) {
      message.error('ID hợp đồng không hợp lệ');
      return;
    }
    
    // Đảm bảo customer profile đã được load
    if (!customerProfile) {
      try {
        await loadCustomerProfile();
      } catch {
        message.error('Không thể tải thông tin khách hàng. Vui lòng thử lại.');
        return;
      }
    }
    
    // Kiểm tra email và fullName có tồn tại không
    if (!customerProfile?.email) {
      message.error('Không tìm thấy email trong tài khoản. Vui lòng cập nhật thông tin.');
      return;
    }
    
    setCurrentContractId(contractId);
    setSignModalOpen(true);
    setPinSent(false);
  };

  const sendPin = async () => {
    if (!currentContractId || !customerProfile?.email) {
      message.error('Không tìm thấy email để gửi mã PIN.');
      return;
    }
    
    try {
      setSigningContract(true);
      await sendPinEmail(currentContractId, customerProfile.email);
      message.success("Đã gửi mã PIN đến email của bạn!");
      setPinSent(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không gửi được mã PIN.");
    } finally {
      setSigningContract(false);
    }
  };

  const handleSign = async (values) => {
    if (!currentContractId) return;
    
    // Backend yêu cầu "string" literal cho digitalSignature
    // Nhưng chúng ta hiển thị tên khách hàng trong UI cho user biết
    const digitalSignature = "string"; // Backend chỉ chấp nhận giá trị này
    
    try {
      setSigning(true);
      const payload = {
        digitalSignature: digitalSignature,
        pinCode: values.pinCode,
        signatureMethod: "EMAIL_OTP",
        deviceInfo: "string", // Use "string" like the working example
        ipAddress: "string" // Use "string" like the working example
      };
      
      console.log('Sending sign contract payload:', payload);
      console.log('Contract ID:', currentContractId);
      console.log('Contract ID type:', typeof currentContractId);
      console.log('Customer name (for display only):', customerProfile?.fullName);
      
      // Ensure contract ID is a number
      const contractIdNum = Number(currentContractId);
      console.log('Contract ID as number:', contractIdNum);
      
      // Payload với format chính xác mà backend yêu cầu
      const testPayload = {
        contractId: contractIdNum,
        digitalSignature: "string", // Backend chỉ chấp nhận giá trị literal này
        pinCode: values.pinCode,
        signatureMethod: "EMAIL_OTP",
        deviceInfo: "string",
        ipAddress: "string"
      };
      
      console.log('Test payload (exact working format):', testPayload);
      
      const result = await signContract(contractIdNum, testPayload);
      console.log('Sign contract result:', result);
      
      // Lưu contractId trước khi reset để refresh
      const signedContractId = contractIdNum;
      const currentOrderId = current?.id;
      
      // Close modal first
      setSignModalOpen(false);
      setCurrentContractId(null);
      setPinSent(false);
      
      // Show success message
      message.success("Bạn đã ký hợp đồng thành công!");
      
      // Refresh contracts và order contracts để cập nhật trạng thái
      // Load all contracts first to get fresh data
      const freshContracts = await getMyContracts();
      const normalizedContracts = Array.isArray(freshContracts) 
        ? freshContracts.map(normalizeContract) 
        : [];
      
      // Update all contracts state
      setAllContracts(normalizedContracts);
      
      // Refresh order contracts nếu có order đang mở (sử dụng contracts mới)
      if (currentOrderId) {
        await loadOrderContracts(currentOrderId, normalizedContracts);
      }
      
      // Refresh contract detail nếu đang mở
      if (contractDetailOpen) {
        await viewContractDetail(signedContractId);
      }
    } catch (e) {
      console.error('Sign contract error:', e);
      console.error('Error response:', e?.response?.data);
      console.error('Error status:', e?.response?.status);
      
      // Close modal even on error
      setSignModalOpen(false);
      setCurrentContractId(null);
      setPinSent(false);
      
      message.error(e?.response?.data?.message || e?.message || "Không ký được hợp đồng.");
    } finally {
      setSigning(false);
    }
  };

  const downloadContract = async (url, filename = "contract.pdf") => {
    if (!url) return message.warning("Không có đường dẫn hợp đồng.");
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const generateContractPDF = async (contract) => {
    if (!contract) {
      message.warning("Không có thông tin hợp đồng để tạo PDF.");
      return;
    }

    try {
      message.loading({ content: "Đang tạo file PDF...", key: "pdf-generate", duration: 0 });

      // Sử dụng customerProfile đã có sẵn hoặc fetch từ profile API
      let customerInfo = customerProfile;
      if (!customerInfo) {
        try {
          const profile = await fetchMyCustomerProfile();
          customerInfo = normalizeCustomer(profile || {});
        } catch (e) {
          console.error("Failed to fetch customer profile:", e);
          // Tiếp tục với customerId nếu không fetch được
          customerInfo = null;
        }
      }

      // Tạo một container ẩn để render HTML
      const printContainer = document.createElement("div");
      printContainer.style.position = "absolute";
      printContainer.style.left = "-9999px";
      printContainer.style.width = "210mm"; // A4 width
      printContainer.style.padding = "20mm";
      printContainer.style.backgroundColor = "#ffffff";
      printContainer.style.fontFamily = "Arial, sans-serif";
      printContainer.style.fontSize = "12px";
      printContainer.style.lineHeight = "1.6";
      printContainer.style.color = "#000000";

      // Tạo phần hiển thị khách hàng
      const customerDisplay = customerInfo 
        ? `${customerInfo.fullName || customerInfo.name || "—"}${customerInfo.email ? `<br/><span style="color: #666; font-size: 11px;">${customerInfo.email}</span>` : ""}${contract.customerId ? `<br/><span style="color: #999; font-size: 10px;">(Mã: #${contract.customerId})</span>` : ""}`
        : contract.customerId ? `#${contract.customerId}` : "—";

      // Tạo HTML content cho PDF
      const contractHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1890ff; margin: 0 0 10px 0; font-size: 24px;">${contract.title || "HỢP ĐỒNG THUÊ THIẾT BỊ"}</h1>
          <p style="margin: 5px 0; color: #666;">Số hợp đồng: ${contract.number || `#${contract.id}`}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">THÔNG TIN CƠ BẢN</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px; width: 40%;"><strong>Mã hợp đồng:</strong></td>
              <td style="padding: 5px;">#${contract.id}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Đơn thuê:</strong></td>
              <td style="padding: 5px;">#${contract.orderId || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Khách hàng:</strong></td>
              <td style="padding: 5px;">${customerDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Loại hợp đồng:</strong></td>
              <td style="padding: 5px;">${contract.type || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Trạng thái:</strong></td>
              <td style="padding: 5px;">${contract.status || "—"}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">THỜI GIAN THUÊ</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px; width: 40%;"><strong>Ngày bắt đầu:</strong></td>
              <td style="padding: 5px;">${contract.startDate ? formatDateTime(contract.startDate) : "—"}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Ngày kết thúc:</strong></td>
              <td style="padding: 5px;">${contract.endDate ? formatDateTime(contract.endDate) : "—"}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Số ngày thuê:</strong></td>
              <td style="padding: 5px;">${contract.rentalPeriodDays ? `${contract.rentalPeriodDays} ngày` : "—"}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Hết hạn:</strong></td>
              <td style="padding: 5px;">${contract.expiresAt ? formatDateTime(contract.expiresAt) : "—"}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">TÀI CHÍNH</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px; width: 40%;"><strong>Tổng tiền thuê:</strong></td>
              <td style="padding: 5px; text-align: right; font-weight: bold; color: #52c41a;">${formatVND(contract.totalAmount || 0)}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Tiền cọc:</strong></td>
              <td style="padding: 5px; text-align: right; font-weight: bold; color: #1890ff;">${formatVND(contract.depositAmount || 0)}</td>
            </tr>
          </table>
        </div>

        ${contract.description ? `
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">MÔ TẢ</h2>
          <p style="margin: 0;">${contract.description}</p>
        </div>
        ` : ""}

        ${contract.contentHtml ? `
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">NỘI DUNG HỢP ĐỒNG</h2>
          <div style="border: 1px solid #f0f0f0; padding: 15px; border-radius: 4px; background-color: #fafafa;">
            ${contract.contentHtml}
          </div>
        </div>
        ` : ""}

        ${contract.terms ? `
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">ĐIỀU KHOẢN VÀ ĐIỀU KIỆN</h2>
          <div style="border: 1px solid #f0f0f0; padding: 15px; border-radius: 4px; background-color: #fafafa; white-space: pre-line;">
            ${contract.terms}
          </div>
        </div>
        ` : ""}

        <div style="margin-top: 40px; text-align: right;">
          <p style="margin: 5px 0;">Ngày tạo: ${contract.createdAt ? formatDateTime(contract.createdAt) : "—"}</p>
          ${contract.signedAt ? `<p style="margin: 5px 0;">Ngày ký: ${formatDateTime(contract.signedAt)}</p>` : ""}
        </div>
      `;

      printContainer.innerHTML = contractHTML;
      document.body.appendChild(printContainer);

      // Convert HTML to canvas then to PDF
      const canvas = await html2canvas(printContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(printContainer);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      const xOffset = (pdfWidth - imgScaledWidth) / 2;
      const yOffset = 0;

      // Nếu nội dung dài hơn 1 trang, chia thành nhiều trang
      const pageHeight = imgScaledHeight;
      let heightLeft = imgScaledHeight;
      let position = yOffset;

      pdf.addImage(imgData, "PNG", xOffset, position, imgScaledWidth, imgScaledHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgScaledHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", xOffset, position, imgScaledWidth, imgScaledHeight);
        heightLeft -= pageHeight;
      }

      // Download PDF
      const filename = `HopDong_${contract.number || contract.id}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(filename);

      message.success({ content: "Đã tạo và tải file PDF thành công!", key: "pdf-generate" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      message.error({ content: "Không thể tạo file PDF. Vui lòng thử lại.", key: "pdf-generate" });
    }
  };

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "displayId",
      key: "displayId",
      width: 100,
      render: (v) => <Text strong>{v}</Text>,
      sorter: (a, b) => String(a.displayId).localeCompare(String(b.displayId)),
    },
    {
      title: "Sản phẩm",
      key: "items",
      width: 260,
      render: (_, r) => {
        const first = r.items?.[0] || {};
        const extra = (r.items?.length ?? 0) > 1 ? ` +${r.items.length - 1} mục` : "";
        return (
          <Space size="middle">
            <Avatar shape="square" size={64} src={first.image} style={{ borderRadius: 8 }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>{first.name || "—"}</Text>
              <br />
              <Text type="secondary">SL: {first.qty ?? 1}{extra}</Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 140,
      render: (v) => formatDateTime(v),
      sorter: (a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0),
      defaultSortOrder: "descend",
    },
    {
      title: "Số ngày",
      dataIndex: "days",
      key: "days",
      align: "center",
      width: 80,
      sorter: (a, b) => (a.days ?? 0) - (b.days ?? 0),
    },
    {
      title: "Đơn giá sản phẩm",
      key: "pricePerDay",
      align: "right",
      width: 150,
      render: (_, r) => {
        const totalPricePerDay = (r.items || []).reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
        return <Text>{formatVND(totalPricePerDay)}/ngày</Text>;
      },
      sorter: (a, b) => {
        const aPrice = (a.items || []).reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
        const bPrice = (b.items || []).reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
        return aPrice - bPrice;
      },
    },
    {
      title: "Tổng tiền",
      key: "total",
      align: "right",
      width: 120,
      render: (_, r) => {
        const totalPricePerDay = (r.items || []).reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
        const days = Number(r.days || 1);
        const calculatedTotal = totalPricePerDay * days;
        return <Text strong>{formatVND(calculatedTotal)}</Text>;
      },
      sorter: (a, b) => {
        const aPricePerDay = (a.items || []).reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
        const bPricePerDay = (b.items || []).reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
        const aDays = Number(a.days || 1);
        const bDays = Number(b.days || 1);
        return (aPricePerDay * aDays) - (bPricePerDay * bDays);
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "orderStatus",
      key: "orderStatus",
      width: 120,
      render: (s) => {
        const key = String(s || "").toLowerCase();
        const m = ORDER_STATUS_MAP[key] || { label: s || "—", color: "default" };
        return <Tag color={m.color} style={{ borderRadius: 20, padding: "0 12px" }}>{m.label}</Tag>;
      },
      filters: Object.entries(ORDER_STATUS_MAP).map(([value, { label }]) => ({ text: label, value })),
      onFilter: (v, r) => String(r.orderStatus).toLowerCase() === String(v).toLowerCase(),
    },
    
    {
      title: "",
      key: "actions",
      width: 72,
      render: (_, r) => (
        <Tooltip title="Chi tiết đơn">
          <Button type="text" icon={<EyeOutlined />} onClick={() => showDetail(r)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <div
        style={{
          height: "calc(100vh - var(--stacked-header,128px))",
          marginTop: "-24px",
          marginBottom: "-24px",
          background: "#f0f2f5",
        }}
      >
        <div className="h-full flex flex-col max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="py-6 border-b border-gray-200">
            <Title level={3} style={{ margin: 0, fontFamily: "'Inter', sans-serif" }}>Đơn thuê của tôi</Title>
            <Text type="secondary">Theo dõi trạng thái đơn, thanh toán và tải hợp đồng.</Text>
          </div>

          <div className="flex items-center justify-between py-4">
            <Space wrap size="middle">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Tìm theo mã đơn, tên thiết bị…"
                style={{ width: 320, borderRadius: 999, padding: "8px 16px" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <RangePicker onChange={setDateRange} style={{ borderRadius: 8 }} />
              <Dropdown
                trigger={["click"]}
                overlay={
                  <Menu
                    onClick={({ key }) => setStatusFilter(key === "all" ? undefined : key)}
                    items={[
                      { key: "all", label: "Tất cả trạng thái" },
                      ...Object.entries(ORDER_STATUS_MAP).map(([k, v]) => ({ key: k, label: v.label })),
                    ]}
                  />
                }
              >
                <Button shape="round" icon={<FilterOutlined />} style={{ borderRadius: 999 }}>
                  {statusFilter ? `Lọc: ${ORDER_STATUS_MAP[statusFilter].label}` : "Lọc trạng thái"}
                </Button>
              </Dropdown>
              <Button shape="round" icon={<ReloadOutlined />} onClick={refresh} loading={loading} style={{ borderRadius: 999 }}>
                Tải lại
              </Button>
            </Space>
          </div>

          <div className="flex-1 min-h-0 overflow-auto pb-3">
            {data.length === 0 ? (
              <AnimatedEmpty description="Chưa có đơn nào" />
            ) : (
              <Table
                rowKey="id"            // id là Long cho BE
                columns={columns}
                dataSource={data}
                loading={loading || loadingOrders}
                size="middle"
                bordered={false}
                className="modern-table"
                sticky
                pagination={{ pageSize: 8, showSizeChanger: true, position: ["bottomRight"] }}
              />
            )}
          </div>
        </div>
      </div>

      <Drawer
        title={current ? `Chi tiết đơn ${current.displayId ?? current.id}` : "Chi tiết đơn"}
        width={800}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        styles={{ body: { padding: 0, background: "#fff" } }}
      >
        {current && (
          <Tabs
            defaultActiveKey="overview"
            items={[
              {
                key: "overview",
                label: "Tổng quan",
                children: (
                  <div style={{ padding: 24 }}>
                    {(() => {
                      const days = Number(current?.days || 1);
                      const items = Array.isArray(current?.items) ? current.items : [];
                      const rentalPerDay = items.reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
                      const rentalTotal = rentalPerDay * days;
                      const depositTotal = items.reduce((sum, it) => sum + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
                      return (
                        <>
                          <Descriptions bordered column={2} size="middle" className="mb-4">
                            <Descriptions.Item label="Mã đơn"><Text strong>{current.displayId ?? current.id}</Text></Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo">{formatDateTime(current.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="Thời gian thuê" span={2}>
                              {current.startDate && current.endDate
                                ? (<>{formatDateTime(current.startDate)} → {formatDateTime(current.endDate)} ({days} ngày)</>)
                                : "—"}
                            </Descriptions.Item>

                            <Descriptions.Item label="Trạng thái đơn">
                              <Tag color={(ORDER_STATUS_MAP[current.orderStatus] || {}).color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                {(ORDER_STATUS_MAP[current.orderStatus] || {}).label ?? current.orderStatus ?? "—"}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thanh toán">
                              <Tag color={(PAYMENT_STATUS_MAP[current.paymentStatus] || {}).color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                {(PAYMENT_STATUS_MAP[current.paymentStatus] || {}).label ?? current.paymentStatus ?? "—"}
                              </Tag>
                            </Descriptions.Item>

                            <Descriptions.Item label="Tổng tiền thuê (ước tính)">
                              <Space direction="vertical" size={0}>
                                <Text strong>{formatVND(rentalTotal)}</Text>
                                <Text type="secondary">= (Tổng tiền/ngày {formatVND(rentalPerDay)}) × {days} ngày</Text>
                              </Space>
                            </Descriptions.Item>

                          

                            <Descriptions.Item label="Tổng tiền cọc (ước tính)">
                              <Space direction="vertical" size={0}>
                                <Text strong>{formatVND(depositTotal)}</Text>
                                {(() => {
                                  const totalDeviceValue = items.reduce((sum, it) => sum + Number(it.deviceValue || 0) * Number(it.qty || 1), 0);
                                  // Tính tổng cọc thực tế từ từng item để so sánh
                                  const calculatedDeposit = items.reduce((sum, it) => {
                                    const deviceValue = Number(it.deviceValue || 0);
                                    const depositPercent = Number(it.depositPercent || 0);
                                    const itemDeposit = deviceValue * depositPercent * Number(it.qty || 1);
                                    return sum + itemDeposit;
                                  }, 0);
                                  
                                  // Nếu có ít nhất 1 item có deviceValue và depositPercent
                                  const hasValidData = items.some(it => Number(it.deviceValue || 0) > 0 && Number(it.depositPercent || 0) > 0);
                                  
                                  if (hasValidData && totalDeviceValue > 0) {
                                    // Tính % cọc trung bình có trọng số
                                    const effectivePercent = calculatedDeposit > 0 && totalDeviceValue > 0 
                                      ? (calculatedDeposit / totalDeviceValue) * 100 
                                      : 0;
                                    
                                    if (effectivePercent > 0) {
                                      return (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                          = Giá trị sản phẩm ({formatVND(totalDeviceValue)}) × {effectivePercent.toFixed(1)}%
                                        </Text>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </Space>
                            </Descriptions.Item>
                            {(current.depositAmountReleased && Number(current.depositAmountReleased) > 0) && (
                              <Descriptions.Item label="Tiền Cọc đã hoàn">
                                {formatVND(current.depositAmountReleased)}
                              </Descriptions.Item>
                            )}
                            {(current.depositAmountUsed && Number(current.depositAmountUsed) > 0) && (
                              <Descriptions.Item label="Tiền Cọc đã trả" span={2}>
                                {formatVND(current.depositAmountUsed)}
                              </Descriptions.Item>
                            )}

                            {current.orderStatus === "cancelled" && (
                              <Descriptions.Item label="Lý do hủy" span={2}>
                                <Text type="danger">{current.cancelReason || "—"}</Text>
                              </Descriptions.Item>
                            )}
                          </Descriptions>

                          <Divider />
                          <Title level={5} style={{ marginBottom: 8 }}>Sản phẩm trong đơn</Title>
                          <Table
                            rowKey={(r, idx) => `${r.deviceModelId || r.name}-${idx}`}
                            dataSource={items}
                            pagination={false}
                            size="middle"
                            scroll={{ x: 980 }}
                            columns={[
                              {
                                title: "Sản phẩm",
                                dataIndex: "name",
                                width: 280,
                                render: (v, r) => (
                                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <Avatar shape="square" size={48} src={r.image} style={{ borderRadius: 8 }} />
                                    <div style={{ minWidth: 0 }}>
                                      <Text strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</Text>
                                    </div>
                                  </div>
                                ),
                              },
                              { title: "SL", dataIndex: "qty", width: 70, align: "center" },
                              {
                                title: "Đơn giá 1 SP",
                                dataIndex: "pricePerDay",
                                width: 130,
                                align: "right",
                                render: (v) => formatVND(v),
                              },
                              {
                                title: "Tiền/ngày",
                                key: "perDay",
                                width: 130,
                                align: "right",
                                render: (_, r) => formatVND(Number(r.pricePerDay || 0) * Number(r.qty || 1)),
                              },
                              {
                                title: "Số ngày",
                                key: "days",
                                width: 90,
                                align: "center",
                                render: () => days,
                              },
                              {
                                title: "Thành tiền thuê",
                                key: "subtotal",
                                width: 150,
                                align: "right",
                                render: (_, r) => formatVND(Number(r.pricePerDay || 0) * Number(r.qty || 1) * days),
                              },
                              {
                                title: "Cọc/1 SP",
                                dataIndex: "depositAmountPerUnit",
                                width: 130,
                                align: "right",
                                render: (v) => formatVND(v),
                              },
                              {
                                title: "Tổng cọc",
                                key: "depositSubtotal",
                                width: 130,
                                align: "right",
                                render: (_, r) => formatVND(Number(r.depositAmountPerUnit || 0) * Number(r.qty || 1)),
                              },
                            ]}
                          />

                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                            <Space direction="vertical" align="end">
                              <Text>Tổng tiền/ngày: <Text strong>{formatVND(rentalPerDay)}</Text></Text>
                              <Text>Tổng tiền thuê ({days} ngày): <Text strong>{formatVND(rentalTotal)}</Text></Text>
                              <Text>Tổng tiền cọc: <Text strong>{formatVND(depositTotal)}</Text></Text>
                            </Space>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ),
              },
              {
                key: "contract",
                label: "Hợp đồng",
                children: (
                  <div style={{ padding: 24 }}>
                    <Title level={4} style={{ marginBottom: 16 }}>Hợp đồng đã tạo</Title>
                    
                    {contractsLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Text type="secondary">Đang tải danh sách hợp đồng...</Text>
                      </div>
                    ) : contracts.length > 0 ? (
                      <div>
                        <Table
                          rowKey="id"
                          columns={[
                            {
                              title: "Mã hợp đồng",
                              dataIndex: "id",
                              width: 100,
                              render: (v) => <Text strong>#{v}</Text>,
                            },
                            {
                              title: "Số hợp đồng",
                              dataIndex: "number",
                              width: 120,
                              render: (v) => v || "—",
                            },
                            {
                              title: "Trạng thái",
                              dataIndex: "status",
                              width: 120,
                              render: (status) => {
                                switch (String(status).toUpperCase()) {
                                  case "DRAFT":
                                    return <Tag color="default">Nháp</Tag>;
                                  case "PENDING_SIGNATURE":
                                    return <Tag color="gold">Chờ ký</Tag>;
                                  case "SIGNED":
                                    return <Tag color="green">Đã ký</Tag>;
                                  case "EXPIRED":
                                    return <Tag color="red">Hết hạn</Tag>;
                                  case "CANCELLED":
                                    return <Tag color="red">Đã hủy</Tag>;
                                  default:
                                    return <Tag>{status}</Tag>;
                                }
                              },
                            },
                            {
                              title: "Ngày tạo",
                              dataIndex: "createdAt",
                              width: 120,
                              render: (v) => formatDateTime(v),
                            },
                            {
                              title: "Tổng tiền",
                              dataIndex: "totalAmount",
                              width: 120,
                              align: "right",
                              render: (v) => formatVND(v),
                            },
                            {
                              title: "Thao tác",
                              key: "actions",
                              width: 200,
                              render: (_, record) => (
                                <Space size="small">
                                  <Button 
                                    size="small" 
                                    icon={<EyeOutlined />} 
                                    onClick={() => viewContractDetail(record.id)}
                                    loading={loadingContractDetail}
                                  >
                                    Xem
                                  </Button>
                                  <Button 
                                    size="small" 
                                    icon={<FilePdfOutlined />}
                                    onClick={async () => {
                                      try {
                                        // Fetch full contract detail if not already loaded
                                        let contractData = record;
                                        if (!contractData.contentHtml && !contractData.terms) {
                                          const fullContract = await getContractById(record.id);
                                          contractData = normalizeContract(fullContract);
                                        }
                                        await generateContractPDF(contractData);
                                      } catch {
                                        message.error("Không thể tải thông tin hợp đồng để tạo PDF.");
                                      }
                                    }}
                                  >
                                    Tải PDF
                                  </Button>
                                  {record.status === "PENDING_SIGNATURE" && (
                                    <Button 
                                      size="small" 
                                      type="primary"
                                      onClick={() => handleSignContract(record.id)}
                                    >
                                      Ký
                                    </Button>
                                  )}
                                </Space>
                              ),
                            },
                          ]}
                          dataSource={contracts}
                          pagination={false}
                          size="small"
                          style={{ marginBottom: 16 }}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Text type="secondary">Chưa có hợp đồng nào được tạo cho đơn này</Text>
                      </div>
                    )}

                    <Divider />

                    <Title level={4} style={{ marginBottom: 16 }}>Hợp đồng PDF (nếu có)</Title>
                    <Space style={{ marginBottom: 12 }}>
                      <Button
                        icon={<ExpandOutlined />}
                        onClick={() => current.contractUrl ? window.open(current.contractUrl, "_blank", "noopener") : message.warning("Không có URL hợp đồng")}
                      >
                        Xem toàn màn hình
                      </Button>
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => current.contractUrl
                          ? downloadContract(current.contractUrl, current.contractFileName || `${current.displayId || current.id}.pdf`)
                          : message.warning("Không có URL hợp đồng")}
                      >
                        Tải hợp đồng
                      </Button>
                    </Space>

                    <div
                      style={{
                        height: 400,
                        border: "1px solid #f0f0f0",
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#fafafa",
                      }}
                    >
                      {current.contractUrl ? (
                        <iframe
                          title="ContractPreview"
                          src={current.contractUrl}
                          style={{ width: "100%", height: "100%", border: "none" }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Text type="secondary"><FilePdfOutlined /> Không có URL hợp đồng để hiển thị.</Text>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        <FilePdfOutlined />  Nếu nội dung không hiển thị, hãy bấm "Xem toàn màn hình".
                      </Text>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Contract Detail Modal */}
      <Modal
        title="Chi tiết hợp đồng"
        open={contractDetailOpen}
        onCancel={() => {
          setContractDetailOpen(false);
          setContractCustomer(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setContractDetailOpen(false);
            setContractCustomer(null);
          }}>
            Đóng
          </Button>,
          contractDetail && (
            <Button 
              key="download-pdf" 
              icon={<FilePdfOutlined />}
              onClick={() => generateContractPDF(contractDetail)}
            >
              Tải PDF
            </Button>
          ),
          contractDetail && String(contractDetail.status).toUpperCase() === "PENDING_SIGNATURE" && (
            <Button 
              key="sign" 
              type="primary" 
              onClick={() => handleSignContract(contractDetail.id)}
            >
              Ký hợp đồng
            </Button>
          ),
          // Temporary fallback for testing - remove in production
          contractDetail && String(contractDetail.status).toUpperCase() !== "PENDING_SIGNATURE" && String(contractDetail.status).toUpperCase() !== "SIGNED" && (
            <Button 
              key="sign-test" 
              type="dashed" 
              onClick={() => handleSignContract(contractDetail.id)}
            >
              Ký (Test - Status: {contractDetail.status})
            </Button>
          ),
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {contractDetail && (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Debug info - remove in production */}
            <div style={{ background: '#f0f0f0', padding: '8px', marginBottom: '16px', borderRadius: '4px' }}>
              <Text type="secondary">Debug: Status = "{contractDetail.status}" | Can Sign = {String(contractDetail.status).toUpperCase() === "PENDING_SIGNATURE" ? "Yes" : "No"}</Text>
            </div>
            
            <Card 
              title={
                <div style={{ textAlign: 'center' }}>
                  <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                    {contractDetail.title}
                  </Title>
                  <Text type="secondary">Số hợp đồng: {contractDetail.number}</Text>
                </div>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="Thông tin cơ bản">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Mã hợp đồng">#{contractDetail.id}</Descriptions.Item>
                      <Descriptions.Item label="Đơn thuê">#{contractDetail.orderId}</Descriptions.Item>
                      <Descriptions.Item label="Khách hàng">
                        {contractCustomer ? (
                          <div>
                            <div><strong>{contractCustomer.fullName || contractCustomer.name || "—"}</strong></div>
                            {contractCustomer.email && (
                              <div style={{ color: "#666", fontSize: "12px" }}>{contractCustomer.email}</div>
                            )}
                            {contractCustomer.phoneNumber && (
                              <div style={{ color: "#666", fontSize: "12px" }}>{contractCustomer.phoneNumber}</div>
                            )}
                            <div style={{ color: "#999", fontSize: "11px" }}>(Mã: #{contractDetail.customerId})</div>
                          </div>
                        ) : (
                          <>#{contractDetail.customerId}</>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="Loại hợp đồng">
                        <Tag color="blue">{contractDetail.type}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Trạng thái">
                        <Tag color="gold">{contractDetail.status}</Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Thời gian">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày bắt đầu">
                        {contractDetail.startDate ? formatDateTime(contractDetail.startDate) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày kết thúc">
                        {contractDetail.endDate ? formatDateTime(contractDetail.endDate) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Số ngày thuê">
                        {contractDetail.rentalPeriodDays ? `${contractDetail.rentalPeriodDays} ngày` : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Hết hạn">
                        {contractDetail.expiresAt ? formatDateTime(contractDetail.expiresAt) : "—"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="Tài chính">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Tổng tiền thuê:</Text>
                        <Text strong style={{ color: '#52c41a' }}>
                          {formatVND(contractDetail.totalAmount)}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Tiền cọc:</Text>
                        <Text strong style={{ color: '#1890ff' }}>
                          {formatVND(contractDetail.depositAmount)}
                        </Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Mô tả">
                    <Text>{contractDetail.description || "—"}</Text>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Card size="small" title="Nội dung hợp đồng">
                <div 
                  style={{ 
                    border: '1px solid #f0f0f0', 
                    padding: 16, 
                    borderRadius: 6,
                    backgroundColor: '#fafafa',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                  dangerouslySetInnerHTML={{ __html: contractDetail.contentHtml || "—" }}
                />
              </Card>

              <Divider />

              <Card size="small" title="Điều khoản và điều kiện">
                <div 
                  style={{ 
                    border: '1px solid #f0f0f0', 
                    padding: 16, 
                    borderRadius: 6,
                    backgroundColor: '#fafafa',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {contractDetail.terms || "—"}
                </div>
              </Card>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="Thông tin tạo">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày tạo">
                        {contractDetail.createdAt ? formatDateTime(contractDetail.createdAt) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Người tạo">
                        {contractDetail.createdBy ? `#${contractDetail.createdBy}` : "—"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Thông tin cập nhật">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày cập nhật">
                        {contractDetail.updatedAt ? formatDateTime(contractDetail.updatedAt) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Người cập nhật">
                        {contractDetail.updatedBy ? `#${contractDetail.updatedBy}` : "—"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </Card>
          </div>
        )}
      </Modal>

      {/* Contract Signing Modal */}
      <Modal
        title="Ký hợp đồng"
        open={signModalOpen}
        onCancel={() => {
          setSignModalOpen(false);
          setCurrentContractId(null);
          setPinSent(false);
        }}
        footer={null}
        width={500}
        style={{ top: 20 }}
      >
        <Form
          layout="vertical"
          onFinish={pinSent ? handleSign : sendPin}
          initialValues={{
            email: customerProfile?.email || '',
          }}
        >
          {!pinSent ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Text>Email đã được tự động điền từ tài khoản của bạn</Text>
              </div>
              
              <Form.Item
                label="Email"
                name="email"
              >
                <Input 
                  value={customerProfile?.email || ''}
                  disabled
                  size="large"
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
              </Form.Item>
              
              {!customerProfile?.email && (
                <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591' }}>
                  <Text type="warning">
                    Không tìm thấy email trong tài khoản. Vui lòng cập nhật thông tin trước khi ký hợp đồng.
                  </Text>
                </div>
              )}
              
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => {
                    setSignModalOpen(false);
                    setCurrentContractId(null);
                    setPinSent(false);
                  }}>
                    Hủy
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit"
                    loading={signingContract}
                    disabled={!customerProfile?.email}
                  >
                    Gửi mã PIN
                  </Button>
                </Space>
              </Form.Item>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Text>Mã PIN đã được gửi đến email của bạn</Text>
                <br />
                <Text type="secondary">Vui lòng kiểm tra email và nhập mã PIN để ký hợp đồng</Text>
              </div>
              
              <Form.Item
                label="Mã PIN"
                name="pinCode"
                rules={[
                  { required: true, message: 'Vui lòng nhập mã PIN!' },
                  { min: 6, message: 'Mã PIN phải có ít nhất 6 ký tự!' }
                ]}
              >
                <Input 
                  placeholder="Nhập mã PIN từ email"
                  size="large"
                  maxLength={10}
                />
              </Form.Item>
              
              <Form.Item
                label="Chữ ký số"
                name="digitalSignature"
              >
                <Input 
                  value={customerProfile?.fullName || 'Chưa có tên'}
                  disabled
                  size="large"
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  Tên của bạn: <Text strong>{customerProfile?.fullName || 'Chưa cập nhật'}</Text>
                </Text>
              </Form.Item>
              
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setPinSent(false)}>
                    Quay lại
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit"
                    loading={signing}
                  >
                    Ký hợp đồng
                  </Button>
                </Space>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <style>{`
        .modern-table .ant-table-thead > tr > th {
          background: #fafafa;
          font-weight: 600;
          color: #333;
          border-bottom: 2px solid #f0f0f0;
        }
        .modern-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.3s;
        }
        .modern-table .ant-table-tbody > tr:hover > td {
          background: #f6faff !important;
        }
        .ant-drawer-content {
          border-radius: 12px 0 0 12px;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}
