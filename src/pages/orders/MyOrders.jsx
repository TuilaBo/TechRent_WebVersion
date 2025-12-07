import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Table, Tag, Typography, Input, DatePicker, Space, Button,
  Dropdown, Menu, Tooltip, message, Drawer, Descriptions,
  Avatar, Tabs, Modal, Card, Row, Col, Divider, Form, Steps, Radio, Checkbox, Alert
} from "antd";
import dayjs from "dayjs";
import {
  EyeOutlined,
  ReloadOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  ExpandOutlined,
  DollarOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { listRentalOrders, getRentalOrderById, confirmReturnRentalOrder, extendRentalOrder } from "../../lib/rentalOrdersApi";
import { getDeviceModelById } from "../../lib/deviceModelsApi";
import { getMyContracts, getContractById, normalizeContract, sendPinEmail, signContract as signContractApi } from "../../lib/contractApi";
import { fetchMyCustomerProfile, normalizeCustomer } from "../../lib/customerApi";
import { connectCustomerNotifications } from "../../lib/notificationsSocket";
import { getMyKyc } from "../../lib/kycApi";
import { createPayment, getInvoiceByRentalOrderId } from "../../lib/Payment";
import { listTasks } from "../../lib/taskApi";
import { getSettlementByOrderId, respondSettlement } from "../../lib/settlementApi";
import {
  getCustomerHandoverReportsByOrderId,
  sendCustomerHandoverReportPin,
  updateCustomerHandoverReportSignature
} from "../../lib/handoverReportApi";
import { getConditionDefinitions } from "../../lib/condition.js";
import {
  sanitizeContractHtml,
  augmentContractContent,
  GLOBAL_PRINT_CSS,
  NATIONAL_HEADER_HTML,
} from "../../lib/contractPrintUtils";
import {
  buildPrintableHandoverReportHtml,
  elementToPdfBlobHandover,
  translateHandoverStatus,
} from "../../lib/handoverReportPrintUtils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  formatVND,
  formatDateTime,
  diffDays,
  createPrintSandbox,
  cleanupPrintSandbox,
} from "../../lib/orderUtils";
import {
  ORDER_STATUS_MAP,
  ORDER_STATUS_ALIASES,
  PAYMENT_STATUS_MAP,
  SETTLEMENT_STATUS_MAP,
  CONTRACT_STATUS_MAP,
  CONTRACT_TYPE_LABELS,
  mapInvoiceStatusToPaymentStatus,
  splitSettlementAmounts,
} from "../../lib/orderConstants";
import MyOrdersList from "./MyOrdersList.jsx";
import MyOrderContractTab from "./MyOrderContractTab.jsx";
import MyOrderHandoverTab from "./MyOrderHandoverTab.jsx";
import MyOrderCheckinTab from "./MyOrderCheckinTab.jsx";
import MyOrderReturnTab from "./MyOrderReturnTab.jsx";
import MyOrderSettlementTab from "./MyOrderSettlementTab.jsx";
import { useLocation } from "react-router-dom";

const { Title, Text } = Typography;


// All constants, utils, and helpers have been moved to separate files:
// - Constants: orderConstants.js
// - Utils: orderUtils.js
// - Handover PDF: handoverReportPrintUtils.js
// - Contract PDF: contractPdfUtils.js

/* =========================
 * MAP ORDER (chuẩn hoá từ BE)
 * ========================= */
async function mapOrderFromApi(order) {
  const backendId =
    order?.id || order?.rentalOrderId || order?.orderId || order?.rentalId || null;

  const displayId =
    order?.rentalOrderCode || order?.orderCode || order?.code ||
    (backendId != null ? String(backendId) : "—");

  // Đơn giản hoá: chỉ dùng dữ liệu có sẵn trong orderDetails, KHÔNG gọi getDeviceModelById
  const items = (order?.orderDetails || []).map((detail) => {
    const deviceValue = Number(detail?.deviceValue ?? 0);
    const depositPercent = Number(detail?.depositPercent ?? 0);
    const depositAmountPerUnit = Number(
      detail?.depositAmountPerUnit ?? deviceValue * depositPercent
    );

    // Lấy tên và ảnh từ deviceModel object hoặc từ detail trực tiếp
    const deviceModel = detail?.deviceModel || {};
    const deviceName =
      deviceModel?.deviceName ||
      deviceModel?.name ||
      detail?.deviceName ||
      `Model ${detail?.deviceModelId ?? ""}`;

    const imageUrl =
      deviceModel?.imageUrl ||
      deviceModel?.imageURL ||
      deviceModel?.image ||
      detail?.imageUrl ||
      detail?.imageURL ||
      detail?.image ||
      "";

    return {
      name: deviceName,
      qty: detail?.quantity ?? 1,
      image: imageUrl,
      pricePerDay: Number(detail?.pricePerDay ?? 0),
      depositAmountPerUnit,
      deviceValue,
      depositPercent,
      deviceModelId: detail?.deviceModelId ?? null,
    };
  });

  const startDate = order?.startDate ?? order?.rentalStartDate ?? null;
  const endDate = order?.endDate ?? order?.rentalEndDate ?? null;

  const rawTotal = Number(order?.totalPrice ?? order?.total ?? 0);
  const rawDailyFromBE = Number(order?.pricePerDay ?? 0);
  const dailyFromItems = items.reduce(
    (s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0
  );
  const dailyTotal = rawDailyFromBE > 0 ? rawDailyFromBE : dailyFromItems;
  const daysFromMoney = dailyTotal > 0 ? Math.max(1, Math.round(rawTotal / dailyTotal)) : 0;
  const daysByRange = diffDays(startDate, endDate);
  const normalizedDays = daysFromMoney || daysByRange || 1;

  const rawStatus = String(order?.orderStatus ?? "pending").toLowerCase();
  const orderStatus = ORDER_STATUS_ALIASES[rawStatus] || rawStatus;

  return {
    id: backendId,
    displayId,

    createdAt: order?.createdAt ?? order?.created_date ?? null,
    startDate, endDate, days: normalizedDays,

    items,
    total: order?.totalPrice ?? order?.total ?? 0,

    orderStatus,
    paymentStatus: String(order?.paymentStatus ?? "unpaid").toLowerCase(),

    depositAmountHeld: order?.depositAmount ?? order?.depositAmountHeld ?? 0,
    depositAmountReleased: order?.depositAmountReleased ?? 0,
    depositAmountUsed: order?.depositAmountUsed ?? 0,
    cancelReason: order?.cancelReason ?? null,
    contractUrl: order?.contractUrl ?? "",
    contractFileName: order?.contractFileName ?? `${displayId}.pdf`,
  };
}

/* =========================
 * COMPONENT
 * ========================= */
export default function MyOrders() {
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

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [contractPdfPreviewUrl, setContractPdfPreviewUrl] = useState(""); // For inline preview
  const [selectedContract, setSelectedContract] = useState(null);

  // PDF (FE render)
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const notifSocketRef = useRef(null);
  const pollingRef = useRef(null);
  const wsConnectedRef = useRef(false);
  const shownReturnNotificationRef = useRef(new Set());

  // Signing
  const [signingContract, setSigningContract] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [currentContractId, setCurrentContractId] = useState(null);
  const [pinSent, setPinSent] = useState(false);
  const [signing, setSigning] = useState(false);

  const [customerProfile, setCustomerProfile] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("PAYOS");
  const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [invoiceInfo, setInvoiceInfo] = useState(null); // Invoice info from API
  const [settlementInfo, setSettlementInfo] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementActionLoading, setSettlementActionLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  // Handover reports
  const [handoverReports, setHandoverReports] = useState([]);
  const [handoverReportsLoading, setHandoverReportsLoading] = useState(false);
  const [handoverPdfModalOpen, setHandoverPdfModalOpen] = useState(false);
  const [handoverPdfBlobUrl, setHandoverPdfBlobUrl] = useState("");
  const [handoverPdfPreviewUrl, setHandoverPdfPreviewUrl] = useState(""); // For inline preview
  const [handoverPdfGenerating, setHandoverPdfGenerating] = useState(false);
  const [selectedHandoverReport, setSelectedHandoverReport] = useState(null);
  const handoverPrintRef = useRef(null);
  // Checkin reports (separate state for checkin)
  const [checkinPdfPreviewUrl, setCheckinPdfPreviewUrl] = useState(""); // For inline preview
  const [selectedCheckinReport, setSelectedCheckinReport] = useState(null);
  // Handover signing
  const [signingHandover, setSigningHandover] = useState(false);
  const [handoverSignModalOpen, setHandoverSignModalOpen] = useState(false);
  const [currentHandoverReportId, setCurrentHandoverReportId] = useState(null);
  const [handoverPinSent, setHandoverPinSent] = useState(false);
  const [handoverSigning, setHandoverSigning] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);
  const [processingExtend, setProcessingExtend] = useState(false);
  const [extendedEndTime, setExtendedEndTime] = useState(null);
  const [confirmedReturnOrders, setConfirmedReturnOrders] = useState(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem("confirmedReturnOrders");
      if (saved) {
        const ids = JSON.parse(saved);
        return new Set(Array.isArray(ids) ? ids : []);
      }
    } catch (e) {
      console.error("Failed to load confirmed return orders from localStorage:", e);
    }
    return new Set();
  });
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const deeplinkOrderId = queryParams.get("orderId");
  const deeplinkTab = queryParams.get("tab");
  const deepLinkHandledRef = useRef(false);

  function revokeBlob(url) { try { if (url) URL.revokeObjectURL(url); } catch (e) { console.error("Error revoking blob:", e); } }
  function clearContractPreviewState() {
    revokeBlob(pdfBlobUrl);
    setPdfBlobUrl("");
    setPdfPreviewUrl("");
    setContractDetail(null);
    setContractCustomer(null);
  }

  // Calculate days remaining until return date
  const DAY_MS = 1000 * 60 * 60 * 24;
  const getDaysRemaining = (endDate) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return null;
    const now = new Date();

    // Calculate based on local date (not UTC) to match user's calendar
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diff = endDateOnly - nowDateOnly;
    const days = Math.ceil(diff / DAY_MS);
    return days;
  };

  const formatRemainingDaysText = (daysRemaining) => {
    if (daysRemaining === null) return "—";
    if (daysRemaining < 0) return "Đã quá hạn";
    if (daysRemaining === 0) return "Hết hạn hôm nay";
    if (daysRemaining <= 1) return "Còn 1 ngày";
    return `Còn ${daysRemaining} ngày`;
  };

  // Check if order is close to return date (less than 1 day)
  const isCloseToReturnDate = (order) => {
    if (!order?.endDate) return false;
    const daysRemaining = getDaysRemaining(order.endDate);
    return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 1;
  };

  const isOrderInUse = (order) => {
    if (!order) return false;
    const status = String(order?.orderStatus || "").toLowerCase();
    return status === "in_use";
  };

  // Check if order has been confirmed for return
  const isReturnConfirmed = async (order) => {
    if (!order) return false;
    const orderId = order?.id || order?.orderId || order?.rentalOrderId;

    // Check if we've tracked this order as confirmed (from localStorage)
    if (orderId && confirmedReturnOrders.has(orderId)) {
      return true;
    }

    // Check status
    const status = String(order?.orderStatus || order?.status || "").toLowerCase();
    if (status === "returned" || status === "return_confirmed") {
      return true;
    }

    // Check for return confirmation flag
    if (order?.returnConfirmed === true || order?.returnConfirmed === "true") {
      return true;
    }

    // Check if status contains "return" keyword
    if (status.includes("return")) {
      return true;
    }

    // Check if there's a return task for this order
    try {
      const tasksRes = await listTasks({ orderId, size: 100 });
      // Handle paginated response
      const tasks = (tasksRes && typeof tasksRes === 'object' && Array.isArray(tasksRes.content))
        ? tasksRes.content
        : (Array.isArray(tasksRes) ? tasksRes : []);
      const hasReturnTask = tasks.some(task => {
        const taskType = String(task?.type || "").toUpperCase();
        const taskDesc = String(task?.description || "").toLowerCase();
        return taskType.includes("RETURN") ||
          taskType.includes("PICKUP") ||
          taskDesc.includes("thu hồi") ||
          taskDesc.includes("trả hàng");
      });
      if (hasReturnTask && orderId) {
        // Mark as confirmed
        setConfirmedReturnOrders(prev => {
          const newSet = new Set([...prev, orderId]);
          // Save to localStorage
          try {
            localStorage.setItem("confirmedReturnOrders", JSON.stringify(Array.from(newSet)));
          } catch (e) {
            console.error("Failed to save confirmed return orders to localStorage:", e);
          }
          return newSet;
        });
        return true;
      }
    } catch (e) {
      console.error("Error checking return tasks:", e);
    }

    return false;
  };

  // Synchronous version for use in render (uses cached state)
  const isReturnConfirmedSync = (order) => {
    if (!order) return false;
    const orderId = order?.id || order?.orderId || order?.rentalOrderId;

    // Check if we've tracked this order as confirmed
    if (orderId && confirmedReturnOrders.has(orderId)) {
      return true;
    }

    // Check status
    const status = String(order?.orderStatus || order?.status || "").toLowerCase();
    if (status === "returned" || status === "return_confirmed") {
      return true;
    }

    // Check for return confirmation flag
    if (order?.returnConfirmed === true || order?.returnConfirmed === "true") {
      return true;
    }

    // Check if status contains "return" keyword
    if (status.includes("return")) {
      return true;
    }

    return false;
  };

  useEffect(() => {
    loadOrders();
    loadAllContracts();
    loadCustomerProfile();
  }, []);

  // Cleanup khi rời trang / component unmount
  useEffect(() => {
    return () => {
      try {
        if (notifSocketRef.current) {
          notifSocketRef.current.disconnect?.();
          notifSocketRef.current = null;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Error disconnecting notifications socket:", e);
      }

      try {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Error clearing polling interval:", e);
      }
    };
  }, []);

  // Check for orders close to return date and show notification
  useEffect(() => {
    const checkCloseToReturn = () => {
      const closeOrders = orders.filter((order) =>
        isOrderInUse(order) &&
        isCloseToReturnDate(order) &&
        !isReturnConfirmedSync(order)
      );
      if (closeOrders.length > 0 && !returnModalOpen && !extendModalOpen) {
        const firstCloseOrder = closeOrders[0];
        const orderId = firstCloseOrder.id;
        // Only show notification once per order
        if (shownReturnNotificationRef.current.has(orderId)) {
          return;
        }
        const daysRemaining = getDaysRemaining(firstCloseOrder.endDate);
        if (daysRemaining !== null && daysRemaining <= 1) {
          shownReturnNotificationRef.current.add(orderId);
          const reminderText = "1 ngày";
          Modal.confirm({
            title: `Đơn #${firstCloseOrder.displayId ?? firstCloseOrder.id} sắp đến hạn trả hàng`,
            content: `Còn ${reminderText} nữa là đến hạn trả hàng. Bạn muốn gia hạn hay trả hàng?`,
            okText: "Trả hàng",
            cancelText: "Gia hạn",
            onOk: () => {
              setCurrent(firstCloseOrder);
              setDetailOpen(true);
              setDetailTab("return");
              setReturnModalOpen(true);
            },
            onCancel: () => {
              setCurrent(firstCloseOrder);
              setDetailOpen(true);
              setDetailTab("return");
              setExtendModalOpen(true);
            },
            width: 500,
          });
        }
      }
    };

    if (orders.length > 0) {
      checkCloseToReturn();
    }
  }, [orders, returnModalOpen, extendModalOpen]);

  // Filter handover reports by type
  const checkoutReports = useMemo(() => {
    return handoverReports.filter(report => {
      const handoverType = String(report?.handoverType || "").toUpperCase();
      return handoverType !== "CHECKIN";
    });
  }, [handoverReports]);

  const checkinReports = useMemo(() => {
    return handoverReports.filter(report => {
      const handoverType = String(report?.handoverType || "").toUpperCase();
      return handoverType === "CHECKIN";
    });
  }, [handoverReports]);

  // Auto select and preview first handover report when reports are loaded
  useEffect(() => {
    if (checkoutReports.length > 0 && !selectedHandoverReport) {
      const firstReport = checkoutReports[0];
      setSelectedHandoverReport(firstReport);
      previewHandoverReportAsPdf(firstReport, { target: "handover" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutReports]);

  // Auto select first checkin report when reports are loaded
  useEffect(() => {
    if (checkinReports.length > 0 && !selectedCheckinReport) {
      setSelectedCheckinReport(checkinReports[0]);
      return;
    }

    // Clear selection when no checkin reports
    if (checkinReports.length === 0 && selectedCheckinReport) {
      setSelectedCheckinReport(null);
      if (checkinPdfPreviewUrl) {
        try {
          URL.revokeObjectURL(checkinPdfPreviewUrl);
        } catch { }
        setCheckinPdfPreviewUrl("");
      }
    }
  }, [checkinReports, selectedCheckinReport, checkinPdfPreviewUrl]);

  // Ensure PDFs are available when switching tabs
  useEffect(() => {
    if (
      detailTab === "handover" &&
      selectedHandoverReport &&
      !handoverPdfPreviewUrl &&
      !handoverPdfGenerating
    ) {
      previewHandoverReportAsPdf(selectedHandoverReport, {
        target: "handover",
        skipSelection: true,
      });
    }
  }, [detailTab, selectedHandoverReport, handoverPdfPreviewUrl, handoverPdfGenerating]);

  useEffect(() => {
    if (
      detailTab === "checkin" &&
      selectedCheckinReport &&
      !checkinPdfPreviewUrl &&
      !handoverPdfGenerating
    ) {
      previewHandoverReportAsPdf(selectedCheckinReport, {
        target: "checkin",
        skipSelection: true,
      });
    }
  }, [detailTab, selectedCheckinReport, checkinPdfPreviewUrl, handoverPdfGenerating]);

  // Reload handover reports when switching to handover/checkin tabs (only if switching to this tab for the first time)
  const handoverTabRef = useRef(null);
  useEffect(() => {
    if (current?.id && (detailTab === "handover" || detailTab === "checkin")) {
      const orderId = current.id;
      const previousTab = handoverTabRef.current;
      // Only reload if switching to this tab for the first time (not on every render)
      if (previousTab !== detailTab) {
        loadOrderHandoverReports(orderId);
      }
      handoverTabRef.current = detailTab;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailTab, current?.id]);

  // Auto select and preview first contract when contracts are loaded
  useEffect(() => {
    if (contracts.length > 0 && !selectedContract) {
      const firstContract = contracts[0];
      setSelectedContract(firstContract);
      previewContractAsPdfInline(firstContract);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts]);

  const loadCustomerProfile = async () => {
    try {
      const profile = await fetchMyCustomerProfile();
      const normalized = normalizeCustomer(profile || {});
      setCustomerProfile(normalized);
      // Connect WS after profile ready
      try { notifSocketRef.current?.disconnect(); } catch { }
      try { clearInterval(pollingRef.current); } catch { }
      pollingRef.current = null;
      if (normalized?.id) {
        notifSocketRef.current = connectCustomerNotifications({
          endpoint: "http://160.191.245.242:8080/ws",
          customerId: normalized.id,
          onMessage: async (payload) => {
            console.log("📬 MyOrders: Received WebSocket message", payload);
            const statusRaw = String(payload?.orderStatus || payload?.status || "").toUpperCase();
            const lowerMsg = String(payload?.message || payload?.title || "").toLowerCase();
            const lowerType = String(payload?.type || payload?.notificationType || "").toLowerCase();

            // Check if this is a PROCESSING notification
            const isProcessing =
              statusRaw === "PROCESSING" ||
              lowerType === "order_processing" ||
              lowerType === "processing" ||
              lowerMsg.includes("xử lý") ||
              lowerMsg.includes("processing") ||
              lowerType === "approved";

            if (!isProcessing) {
              console.log("⚠️ MyOrders: Message not PROCESSING, ignoring", { statusRaw, lowerMsg, lowerType });
              return;
            }
            console.log("✅ MyOrders: Processing PROCESSING notification", payload);

            // Load orders first to get the latest orderId
            let refreshedOrders = [];
            try {
              const res = await listRentalOrders();
              refreshedOrders = Array.isArray(res) ? res : [];
              // Update orders state
              const mapped = await Promise.all((refreshedOrders || []).map(mapOrderFromApi));
              setOrders(mapped.filter(o => o && o.id != null));
            } catch (err) {
              console.error("Failed to refresh orders after notification:", err);
            }

            // Find the most recent PROCESSING order
            const processingOrder = refreshedOrders
              .filter(o => {
                const status = String(o?.status || o?.orderStatus || "").toUpperCase();
                return status === "PROCESSING";
              })
              .sort((a, b) => {
                const ta = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
                const tb = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
                return tb - ta; // newest first
              })[0];

            const orderId = processingOrder?.orderId || processingOrder?.id || payload?.orderId || payload?.rentalOrderId;
            const orderCode = processingOrder?.orderId || processingOrder?.id || payload?.orderCode || payload?.orderId || "";

            console.log("🔍 MyOrders: Found processing order", { orderId, orderCode, processingOrder });

            let contractsSnapshot = [];
            try {
              contractsSnapshot = await loadAllContracts();
            } catch (err) {
              console.error("Failed to refresh contracts after notification:", err);
            }

            const hasContractAlready = orderId ? hasAnyContract(orderId, contractsSnapshot) : false;
            console.log("📋 MyOrders: Contract check", { orderId, hasContractAlready, contractsCount: contractsSnapshot.length });

            if (hasContractAlready) {
              message.success(
                orderCode
                  ? `Đơn #${orderCode} đã có hợp đồng. Vui lòng ký và thanh toán ngay.`
                  : "Đơn của bạn đã có hợp đồng. Vui lòng ký và thanh toán ngay."
              );
            } else {
              message.success(
                orderCode
                  ? `Đơn #${orderCode} đã được duyệt thành công. Chúng tôi sẽ gửi hợp đồng trong ít phút.`
                  : "Đơn của bạn đã được duyệt thành công. Chúng tôi sẽ gửi hợp đồng trong ít phút."
              );
            }
          },
          onConnect: () => {
            console.log("✅ MyOrders: WebSocket connected successfully");
            wsConnectedRef.current = true;
            // stop polling if any
            try { clearInterval(pollingRef.current); } catch { }
            pollingRef.current = null;
          },
          onError: (err) => {
            console.error("❌ MyOrders: WebSocket error", err);
            if (!pollingRef.current) startPollingProcessing();
          },
        });
        // If WS not connected within 3s, start polling
        setTimeout(() => {
          if (!wsConnectedRef.current && !pollingRef.current) {
            startPollingProcessing();
          }
        }, 3000);
      }
    } catch (e) {
      console.error("Failed to load customer profile:", e);
    }
  };

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await listRentalOrders();
      const mapped = await Promise.all((res || []).map(mapOrderFromApi));

      // Enrich orders with device model data if missing
      const modelIdsToFetch = new Set();
      mapped.forEach(order => {
        if (order?.items) {
          order.items.forEach(item => {
            if (item.deviceModelId) {
              // Fetch nếu thiếu image hoặc name bắt đầu bằng "Model" (fallback name)
              const needsFetch = !item.image || (item.name && item.name.startsWith("Model"));
              if (needsFetch) {
                modelIdsToFetch.add(item.deviceModelId);
              }
            }
          });
        }
      });

      // Fetch device models in parallel
      const modelMap = new Map();
      if (modelIdsToFetch.size > 0) {
        const modelPromises = Array.from(modelIdsToFetch).map(async (id) => {
          try {
            const model = await getDeviceModelById(id);
            return [id, model];
          } catch (err) {
            console.error(`Failed to fetch device model ${id}:`, err);
            return [id, null];
          }
        });
        const modelResults = await Promise.all(modelPromises);
        modelResults.forEach(([id, model]) => {
          if (model) {
            modelMap.set(id, {
              deviceName: model.deviceName || model.name || "",
              imageUrl: model.imageUrl || model.imageURL || model.image || "",
            });
          }
        });
      }

      // Enrich orders with fetched device model data
      const enrichedOrders = mapped.map(order => {
        if (!order?.items) return order;
        return {
          ...order,
          items: order.items.map(item => {
            if (item.deviceModelId && modelMap.has(item.deviceModelId)) {
              const modelData = modelMap.get(item.deviceModelId);
              return {
                ...item,
                // Ưu tiên deviceName từ API, nếu không có thì giữ name hiện tại
                name: modelData.deviceName || item.name || `Model ${item.deviceModelId}`,
                // Ưu tiên imageUrl từ API, nếu không có thì giữ image hiện tại
                image: modelData.imageUrl || item.image || "",
              };
            }
            return item;
          }),
        };
      });

      const validOrders = enrichedOrders.filter(o => o && o.id != null);
      setOrders(validOrders);

      // Check for orders that might have return tasks created
      // This helps detect orders that were confirmed for return even if status hasn't changed
      try {
        const tasksRes = await listTasks({ size: 1000 });
        // Handle paginated response
        const allTasks = (tasksRes && typeof tasksRes === 'object' && Array.isArray(tasksRes.content))
          ? tasksRes.content
          : (Array.isArray(tasksRes) ? tasksRes : []);
        const returnTaskOrderIds = new Set();
        allTasks.forEach(task => {
          const taskType = String(task?.type || "").toUpperCase();
          const taskDesc = String(task?.description || "").toLowerCase();
          const isReturnTask = taskType.includes("RETURN") ||
            taskType.includes("PICKUP") ||
            taskDesc.includes("thu hồi") ||
            taskDesc.includes("trả hàng");
          if (isReturnTask && task?.orderId) {
            returnTaskOrderIds.add(task.orderId);
          }
        });

        // Update confirmedReturnOrders if we found return tasks
        if (returnTaskOrderIds.size > 0) {
          setConfirmedReturnOrders(prev => {
            const newSet = new Set([...prev, ...returnTaskOrderIds]);
            try {
              localStorage.setItem("confirmedReturnOrders", JSON.stringify(Array.from(newSet)));
            } catch (e) {
              console.error("Failed to save confirmed return orders to localStorage:", e);
            }
            return newSet;
          });
        }
      } catch (taskErr) {
        console.error("Error checking return tasks:", taskErr);
        // Don't fail the whole load if task check fails
      }
    } catch (err) {
      console.error(err);
      message.error("Không thể tải danh sách đơn hàng.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const needsContractAction = useMemo(() => {
    const status = String(current?.orderStatus || current?.status || "").toUpperCase();
    return status === "PROCESSING";
  }, [current?.orderStatus, current?.status]);

  const hasContracts = useMemo(() => (contracts || []).length > 0, [contracts]);

  const refresh = async () => {
    setLoading(true);
    await loadOrders();
    await loadAllContracts();
    setLoading(false);
    message.success("Đã tải lại danh sách đơn và hợp đồng.");
  };

  // ---------- Tracking bar helpers ----------
  function computeOrderTracking(order, contracts, invoiceInfo = null) {
    const status = String(order?.orderStatus || order?.status || "").toLowerCase();
    // Use invoice status if available, otherwise use order paymentStatus
    const invoiceStatus = invoiceInfo?.invoiceStatus;
    const paymentStatus = invoiceStatus
      ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
      : String(order?.paymentStatus || "unpaid").toLowerCase();
    const contract = (contracts || [])[0];
    const contractStatus = String(contract?.status || "").toLowerCase();

    const isCreated = true;
    const isQcDone =
      ["processing", "ready_for_delivery", "delivery_confirmed", "delivering", "active", "returned", "completed"].includes(status) ||
      !!contract;
    const isContractPending = contractStatus === "pending_signature";
    const isPaid = paymentStatus === "paid";
    const isReady =
      ["ready_for_delivery", "delivery_confirmed"].includes(status) ||
      (isPaid && (status === "processing" || status === "active" || status === "delivering"));
    const isDelivered = status === "in_use";
    const isCompleted = status === "completed";

    let current = 0;
    if (isCompleted) current = 5; // Trả hàng và hoàn cọc thành công
    else if (isDelivered) current = 4; // Giao hàng thành công
    else if (isReady) current = 3; // Sẵn sàng giao hàng
    else if (isContractPending || (!isPaid && (isQcDone || contract))) current = 2; // Ký hợp đồng & Thanh toán
    else if (isQcDone) current = 1; // QC,KYC trước thuê thành công
    else current = 0; // Tạo đơn hàng thành công

    const steps = [
      { title: "Tạo đơn hàng thành công" },
      { title: "QC,KYC trước thuê thành công" },
      { title: "Ký hợp đồng & Thanh toán" },
      { title: "Sẵn sàng giao hàng" },
      { title: "Giao hàng thành công" },
      { title: "Trả hàng và hoàn cọc thành công" },
    ];

    steps[0].description = formatDateTime(order?.createdAt) || "";

    return { current, steps };
  }

  const getOrderContracts = (orderId, contractsList = allContracts) => {
    if (!orderId || !Array.isArray(contractsList) || contractsList.length === 0) {
      return [];
    }
    const keyStr = String(orderId);
    const keyNum = Number(orderId);
    return contractsList.filter((c) => {
      const cid =
        c.orderId ??
        c.rentalOrderId ??
        c.order?.orderId ??
        c.order?.id ??
        null;
      if (cid == null) return false;
      return (
        cid === orderId ||
        cid === keyNum ||
        String(cid) === keyStr
      );
    });
  };

  const hasSignedContract = (orderId, contractsList = allContracts) => {
    const orderContracts = getOrderContracts(orderId, contractsList);
    if (!orderContracts.length) return false;
    return orderContracts.some((c) => {
      const status = String(c.status || "").toUpperCase();
      return status === "SIGNED" || status === "ACTIVE";
    });
  };

  const hasAnyContract = (orderId, contractsList = allContracts) => {
    return getOrderContracts(orderId, contractsList).length > 0;
  };

  // Handle return confirmation
  const handleConfirmReturn = async () => {
    if (!current || !current.id) {
      message.error("Không có thông tin đơn hàng để trả.");
      return;
    }
    try {
      setProcessingReturn(true);
      await confirmReturnRentalOrder(current.id);
      message.success("Đã xác nhận trả hàng. Chúng tôi sẽ liên hệ với bạn để thu hồi thiết bị.");
      setReturnModalOpen(false);
      // Mark this order as confirmed for return
      if (current?.id) {
        setConfirmedReturnOrders(prev => {
          const newSet = new Set([...prev, current.id]);
          // Save to localStorage
          try {
            localStorage.setItem("confirmedReturnOrders", JSON.stringify(Array.from(newSet)));
          } catch (e) {
            console.error("Failed to save confirmed return orders to localStorage:", e);
          }
          return newSet;
        });
      }
      // Reload orders to get updated status
      await loadOrders();
      // Update current order to reflect return confirmation
      const updatedOrder = await getRentalOrderById(current.id);
      if (updatedOrder) {
        const mapped = await mapOrderFromApi(updatedOrder);
        setCurrent(mapped);
        // Mark as confirmed even if status doesn't change immediately
        setConfirmedReturnOrders(prev => {
          const newSet = new Set([...prev, current.id]);
          // Save to localStorage
          try {
            localStorage.setItem("confirmedReturnOrders", JSON.stringify(Array.from(newSet)));
          } catch (e) {
            console.error("Failed to save confirmed return orders to localStorage:", e);
          }
          return newSet;
        });
        // Switch to return tab to show thank you message
        setDetailTab("return");
      }
      // Keep drawer open to show thank you message
    } catch (error) {
      console.error("Error confirming return:", error);
      message.error(error?.response?.data?.message || error?.message || "Không thể xác nhận trả hàng.");
    } finally {
      setProcessingReturn(false);
    }
  };

  const handleRespondSettlement = async (accepted) => {
    if (!settlementInfo) {
      message.warning("Chưa có quyết toán để xử lý.");
      return;
    }
    const settlementId = settlementInfo.settlementId || settlementInfo.id;
    if (!settlementId) {
      message.error("Không tìm thấy ID settlement.");
      return;
    }
    try {
      setSettlementActionLoading(true);
      await respondSettlement(settlementId, accepted);
      message.success(accepted ? "Bạn đã chấp nhận quyết toán thành công." : "Bạn đã từ chối quyết toán.");
      await loadOrderSettlement(settlementInfo.orderId || current?.id || settlementInfo.orderId);
    } catch (error) {
      console.error("Failed to respond settlement:", error);
      message.error(error?.response?.data?.message || error?.message || "Không xử lý được yêu cầu.");
    } finally {
      setSettlementActionLoading(false);
    }
  };

  // Handle extend request
  const handleExtendRequest = async () => {
    if (!current || !current.id) {
      message.error("Không có thông tin đơn hàng để gia hạn.");
      return;
    }
    if (!extendedEndTime) {
      message.warning("Vui lòng chọn ngày kết thúc mới cho đơn hàng.");
      return;
    }

    // Validate: extended end time must be after current end date
    if (current.endDate) {
      const currentEndDate = new Date(current.endDate);
      const newEndDate = new Date(extendedEndTime);
      if (newEndDate <= currentEndDate) {
        message.error("Ngày kết thúc mới phải sau ngày kết thúc hiện tại.");
        return;
      }
    }

    try {
      setProcessingExtend(true);
      const result = await extendRentalOrder(current.id, extendedEndTime);
      if (result) {
        message.success("Yêu cầu gia hạn đơn hàng đã được gửi thành công!");
        setExtendModalOpen(false);
        setExtendedEndTime(null);
        // Reload orders to get updated data
        await loadOrders();
        if (current?.id) {
          const updatedOrder = await getRentalOrderById(current.id);
          if (updatedOrder) {
            setCurrent(updatedOrder);
          }
        }
      } else {
        message.error("Không thể gửi yêu cầu gia hạn. Vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Error extending rental order:", error);
      message.error(error?.response?.data?.message || error?.message || "Không thể gửi yêu cầu gia hạn. Vui lòng thử lại.");
    } finally {
      setProcessingExtend(false);
    }
  };
  const handleDownloadContract = async (record) => {
    let sandbox = null;
    try {
      // 1) Có URL -> tải thẳng
      if (record?.contractUrl) {
        const a = document.createElement("a");
        a.href = record.contractUrl;
        a.target = "_blank";
        a.rel = "noopener";
        a.download = record.contractFileName || `contract-${record.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 2) Không có URL -> fallback HTML→PDF
      setPdfGenerating(true);

      // chuẩn bị dữ liệu KH & KYC
      let customer = contractCustomer || customerProfile;
      if (!customer) {
        try {
          const prof = await fetchMyCustomerProfile();
          customer = normalizeCustomer(prof || {});
          setCustomerProfile(customer);
        } catch { }
      }
      let kyc = null;
      try { kyc = await getMyKyc(); } catch { }

      // gộp điều khoản mở rộng rồi render HTML -> PDF
      const detail = augmentContractContent(record);
      sandbox = createPrintSandbox();
      if (!sandbox) {
        message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
        return;
      }

      sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);
      const blob = await elementToPdfBlob(sandbox);

      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = detail.contractFileName || detail.number || `contract-${detail.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      console.error("Download contract error:", e);
      message.error("Không thể tạo/tải PDF.");
    } finally {
      cleanupPrintSandbox(sandbox);
      setPdfGenerating(false);
    }
  };


  const showDetail = async (record) => {
    const idNum = Number(record?.id);
    if (!record || record.id == null || Number.isNaN(idNum)) {
      message.error("ID đơn hàng không hợp lệ để xem chi tiết.");
      return;
    }
    clearContractPreviewState();
    setCurrent(record);
    setSettlementInfo(null);
    setDetailOpen(true);
    setDetailTab("overview");
    setInvoiceInfo(null); // Reset invoice info

    try {
      const fullOrder = await getRentalOrderById(idNum);
      if (fullOrder) {
        const mapped = await Promise.all([mapOrderFromApi(fullOrder)]);
        const merged = mapped[0];

        setCurrent((prev) => {
          const prevItems = Array.isArray(prev?.items) ? prev.items : [];
          const mergedItems = Array.isArray(merged?.items) ? merged.items : [];

          // Giữ lại tên & ảnh đã được enrich từ danh sách orders (prev.items)
          const mergedWithEnrichedItems =
            mergedItems.length > 0
              ? mergedItems.map((mi) => {
                const match = prevItems.find(
                  (pi) =>
                    (pi.deviceModelId != null &&
                      pi.deviceModelId === mi.deviceModelId) ||
                    (pi.name && mi.name && pi.name === mi.name)
                );
                return {
                  ...mi,
                  name: match?.name || mi.name,
                  image: match?.image || mi.image,
                };
              })
              : prevItems;

          return {
            ...prev,
            ...merged,
            items:
              (mergedWithEnrichedItems && mergedWithEnrichedItems.length > 0
                ? mergedWithEnrichedItems
                : prevItems) ?? [],
          };
        });
      }
      // Load invoice info
      try {
        const invoiceRes = await getInvoiceByRentalOrderId(idNum);
        // API có thể trả về 1 object hoặc 1 mảng invoice
        let invoice = null;
        if (Array.isArray(invoiceRes)) {
          invoice =
            // Ưu tiên invoice thanh toán tiền thuê
            invoiceRes.find(
              (inv) =>
                String(inv?.invoiceType || "").toUpperCase() === "RENT_PAYMENT"
            ) || invoiceRes[0] || null;
        } else {
          invoice = invoiceRes || null;
        }
        setInvoiceInfo(invoice);
      } catch (invoiceErr) {
        // Invoice có thể chưa tồn tại – không coi là lỗi
        console.log("No invoice found for order:", idNum);
        setInvoiceInfo(null);
      }
      await loadOrderContracts(idNum);
      await loadOrderSettlement(idNum);
      await loadOrderHandoverReports(idNum);
    } catch (err) {
      console.error("Error loading order details:", err);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!deeplinkOrderId) return;
    if (!orders || orders.length === 0) return;
    const target = orders.find((o) => {
      const id = o?.id ?? o?.orderId;
      return (
        String(id) === String(deeplinkOrderId) ||
        String(o?.displayId) === String(deeplinkOrderId)
      );
    });
    if (!target) return;
    deepLinkHandledRef.current = true;
    showDetail(target);
    if (deeplinkTab === "contract") {
      setDetailTab("contract");
    } else if (deeplinkTab === "settlement") {
      setDetailTab("settlement");
    }
  }, [orders, deeplinkOrderId, deeplinkTab]);

  const loadAllContracts = async () => {
    try {
      const allContractsRes = await getMyContracts();
      const normalized = Array.isArray(allContractsRes)
        ? allContractsRes.map(normalizeContract)
        : [];
      setAllContracts(normalized);
      return normalized;
    } catch (e) {
      console.error("Failed to fetch all contracts:", e);
      setAllContracts([]);
      return [];
    }
  };

  const loadOrderContracts = async (orderId, contractsToFilter = null) => {
    try {
      setContractsLoading(true);
      let inScope = contractsToFilter;
      if (!inScope) {
        if (allContracts.length === 0) await loadAllContracts();
        inScope = allContracts;
      }
      let orderContracts = getOrderContracts(orderId, inScope);

      const needDetail = orderContracts.some(c => !c.contractUrl);
      if (needDetail) {
        orderContracts = await Promise.all(orderContracts.map(async (c) => {
          if (c.contractUrl) return c;
          try {
            const detail = await getContractById(c.id ?? c.contractId ?? c.contractID);
            const normalizedDetail = normalizeContract(detail || {});
            return { ...c, ...normalizedDetail };
          } catch (err) {
            console.error("Failed to fetch contract detail for preview:", err);
            return c;
          }
        }));
        setAllContracts(prev => {
          const map = new Map((prev || []).map(x => [x.id, x]));
          orderContracts.forEach(x => { if (x?.id != null) map.set(x.id, x); });
          return Array.from(map.values());
        });
      }

      setContracts(orderContracts);

      const primary = orderContracts[0];
      const contractUrl = primary?.contractUrl || "";

      setCurrent(prev => ({
        ...(prev || {}),
        contractUrl: contractUrl || "",
        contractFileName: primary?.contractFileName || prev?.contractFileName,
      }));

      if (contractUrl) setPdfPreviewUrl(contractUrl);
      else setPdfPreviewUrl("");
    } catch (e) {
      console.error("Failed to filter order contracts:", e);
      setContracts([]);
      setPdfPreviewUrl("");
    } finally {
      setContractsLoading(false);
    }
  };

  const loadOrderSettlement = async (orderId) => {
    if (!orderId) {
      setSettlementInfo(null);
      return null;
    }
    try {
      setSettlementLoading(true);
      const settlementResponse = await getSettlementByOrderId(orderId);
      const settlementData = settlementResponse?.data ?? settlementResponse ?? null;
      setSettlementInfo(settlementData);
      return settlementData;
    } catch (e) {
      console.error("Failed to fetch settlement by orderId:", e);
      setSettlementInfo(null);
      return null;
    } finally {
      setSettlementLoading(false);
    }
  };

  const loadOrderHandoverReports = async (orderId) => {
    if (!orderId) {
      // Clear old previews/selections when no orderId
      if (handoverPdfPreviewUrl) {
        try { URL.revokeObjectURL(handoverPdfPreviewUrl); } catch { }
      }
      if (checkinPdfPreviewUrl) {
        try { URL.revokeObjectURL(checkinPdfPreviewUrl); } catch { }
      }
      setHandoverPdfPreviewUrl("");
      setCheckinPdfPreviewUrl("");
      setSelectedHandoverReport(null);
      setSelectedCheckinReport(null);
      setHandoverReports([]);
      return [];
    }
    try {
      setHandoverReportsLoading(true);
      // Save IDs of currently selected reports before clearing
      const previousCheckinId = selectedCheckinReport?.handoverReportId || selectedCheckinReport?.id;
      const previousHandoverId = selectedHandoverReport?.handoverReportId || selectedHandoverReport?.id;

      // Clear previous selections and previews before loading new data
      if (handoverPdfPreviewUrl) {
        try { URL.revokeObjectURL(handoverPdfPreviewUrl); } catch { }
      }
      if (checkinPdfPreviewUrl) {
        try { URL.revokeObjectURL(checkinPdfPreviewUrl); } catch { }
      }
      setHandoverPdfPreviewUrl("");
      setCheckinPdfPreviewUrl("");
      setSelectedHandoverReport(null);
      setSelectedCheckinReport(null);

      const reports = await getCustomerHandoverReportsByOrderId(orderId);
      const reportsArray = Array.isArray(reports) ? reports : [];
      setHandoverReports(reportsArray);

      // Try to restore previously selected reports with updated data
      if (previousCheckinId) {
        const updatedCheckin = reportsArray.find(r =>
          (r.handoverReportId || r.id) === previousCheckinId &&
          String(r.handoverType || "").toUpperCase() === "CHECKIN"
        );
        if (updatedCheckin) {
          setSelectedCheckinReport(updatedCheckin);
        }
      }

      if (previousHandoverId) {
        const updatedHandover = reportsArray.find(r =>
          (r.handoverReportId || r.id) === previousHandoverId &&
          (String(r.handoverType || "").toUpperCase() === "CHECKOUT" || !r.handoverType)
        );
        if (updatedHandover) {
          setSelectedHandoverReport(updatedHandover);
        }
      }

      return reportsArray;
    } catch (e) {
      console.error("Failed to fetch handover reports by orderId:", e);
      setSelectedHandoverReport(null);
      setSelectedCheckinReport(null);
      setHandoverPdfPreviewUrl("");
      setCheckinPdfPreviewUrl("");
      setHandoverReports([]);
      return [];
    } finally {
      setHandoverReportsLoading(false);
    }
  };

  // Check if there are unsigned handover reports (both checkout and checkin)
  const hasUnsignedHandoverReports = useMemo(() => {
    return handoverReports.some(report => {
      const status = String(report?.status || "").toUpperCase();
      return status === "STAFF_SIGNED" && !report?.customerSigned;
    });
  }, [handoverReports]);

  // Check if there are unsigned checkout reports
  const hasUnsignedCheckoutReports = useMemo(() => {
    return checkoutReports.some(report => {
      const status = String(report?.status || "").toUpperCase();
      return status === "STAFF_SIGNED" && !report?.customerSigned;
    });
  }, [checkoutReports]);

  // Check if there are unsigned checkin reports
  const hasUnsignedCheckinReports = useMemo(() => {
    return checkinReports.some(report => {
      const status = String(report?.status || "").toUpperCase();
      return status === "STAFF_SIGNED" && !report?.customerSigned;
    });
  }, [checkinReports]);

  // Preview handover report PDF (for modal)
  const handlePreviewHandoverPdf = async (report) => {
    try {
      setHandoverPdfGenerating(true);
      setSelectedHandoverReport(report);

      if (handoverPdfBlobUrl) {
        URL.revokeObjectURL(handoverPdfBlobUrl);
        setHandoverPdfBlobUrl("");
      }

      // Fetch order and condition definitions
      let order = null;
      let conditionDefinitions = [];

      if (report.orderId) {
        try {
          order = await getRentalOrderById(report.orderId);
          // Enrich order with device model info
          if (order && Array.isArray(order.orderDetails)) {
            const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
            const modelPairs = await Promise.all(
              modelIds.map(async (id) => {
                try {
                  const m = await getDeviceModelById(id);
                  return [id, m];
                } catch {
                  return [id, null];
                }
              })
            );
            const modelMap = Object.fromEntries(modelPairs);
            order = {
              ...order,
              orderDetails: order.orderDetails.map(od => ({
                ...od,
                deviceModel: modelMap[od.deviceModelId] || null,
              })),
            };
          }
        } catch (e) {
          console.warn("Could not fetch order for PDF:", e);
        }
      }

      try {
        conditionDefinitions = await getConditionDefinitions();
      } catch (e) {
        console.warn("Could not fetch condition definitions for PDF:", e);
      }

      if (handoverPrintRef.current) {
        handoverPrintRef.current.style.visibility = "visible";
        handoverPrintRef.current.style.opacity = "1";
        handoverPrintRef.current.style.left = "-99999px";
        handoverPrintRef.current.style.top = "-99999px";
        handoverPrintRef.current.style.width = "794px";
        handoverPrintRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";

        handoverPrintRef.current.innerHTML = buildPrintableHandoverReportHtml(report, order, conditionDefinitions);

        const allElements = handoverPrintRef.current.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.style) {
            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
            el.style.webkitFontSmoothing = "antialiased";
            el.style.mozOsxFontSmoothing = "grayscale";
          }
        });

        handoverPrintRef.current.offsetHeight;

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 500));

        const blob = await elementToPdfBlobHandover(handoverPrintRef.current);

        handoverPrintRef.current.style.visibility = "hidden";
        handoverPrintRef.current.style.opacity = "0";

        const url = URL.createObjectURL(blob);
        setHandoverPdfBlobUrl(url);
        setHandoverPdfModalOpen(true);
      }
    } catch (e) {
      console.error("Error generating handover PDF:", e);
      message.error("Không thể tạo bản xem trước PDF");
    } finally {
      setHandoverPdfGenerating(false);
    }
  };

  // Preview handover report PDF (for inline preview)
  const previewHandoverReportAsPdf = async (report, options = {}) => {
    if (!report) return message.warning("Chưa chọn biên bản.");

    // Determine if this is a checkin report
    const handoverType = String(report.handoverType || "").toUpperCase();
    const isCheckinReport = handoverType === "CHECKIN";
    const target = options.target || "auto";
    const useCheckinPreview =
      target === "checkin" ? true : target === "handover" ? false : isCheckinReport;

    const skipSelection = options.skipSelection === true;

    try {
      setHandoverPdfGenerating(true);

      // Set appropriate selected report and clear preview URL
      if (useCheckinPreview) {
        if (!skipSelection) {
          setSelectedCheckinReport(report);
        }
        if (checkinPdfPreviewUrl) {
          URL.revokeObjectURL(checkinPdfPreviewUrl);
          setCheckinPdfPreviewUrl("");
        }
      } else {
        if (!skipSelection) {
          setSelectedHandoverReport(report);
        }
        if (handoverPdfPreviewUrl) {
          URL.revokeObjectURL(handoverPdfPreviewUrl);
          setHandoverPdfPreviewUrl("");
        }
      }

      // Fetch order and condition definitions
      let order = null;
      let conditionDefinitions = [];

      if (report.orderId) {
        try {
          order = await getRentalOrderById(report.orderId);
          // Enrich order with device model info
          if (order && Array.isArray(order.orderDetails)) {
            const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
            const modelPairs = await Promise.all(
              modelIds.map(async (id) => {
                try {
                  const m = await getDeviceModelById(id);
                  return [id, m];
                } catch {
                  return [id, null];
                }
              })
            );
            const modelMap = Object.fromEntries(modelPairs);
            order = {
              ...order,
              orderDetails: order.orderDetails.map(od => ({
                ...od,
                deviceModel: modelMap[od.deviceModelId] || null,
              })),
            };
          }
        } catch (e) {
          console.warn("Could not fetch order for PDF:", e);
        }
      }

      try {
        conditionDefinitions = await getConditionDefinitions();
      } catch (e) {
        console.warn("Could not fetch condition definitions for PDF:", e);
      }

      if (handoverPrintRef.current) {
        handoverPrintRef.current.style.visibility = "visible";
        handoverPrintRef.current.style.opacity = "1";
        handoverPrintRef.current.style.left = "-99999px";
        handoverPrintRef.current.style.top = "-99999px";
        handoverPrintRef.current.style.width = "794px";
        handoverPrintRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";

        handoverPrintRef.current.innerHTML = buildPrintableHandoverReportHtml(report, order, conditionDefinitions);

        const allElements = handoverPrintRef.current.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.style) {
            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
            el.style.webkitFontSmoothing = "antialiased";
            el.style.mozOsxFontSmoothing = "grayscale";
          }
        });

        handoverPrintRef.current.offsetHeight;

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 500));

        const blob = await elementToPdfBlobHandover(handoverPrintRef.current);

        handoverPrintRef.current.style.visibility = "hidden";
        handoverPrintRef.current.style.opacity = "0";

        const url = URL.createObjectURL(blob);
        if (useCheckinPreview) setCheckinPdfPreviewUrl(url);
        else setHandoverPdfPreviewUrl(url);
      }
    } catch (e) {
      console.error("Error generating handover PDF:", e);
      message.error("Không thể tạo bản xem trước PDF");
    } finally {
      setHandoverPdfGenerating(false);
    }
  };

  // Download handover report PDF
  const handleDownloadHandoverPdf = async (report) => {
    if (!report) return message.warning("Chưa chọn biên bản.");

    try {
      setHandoverPdfGenerating(true);

      // Fetch order and condition definitions
      let order = null;
      let conditionDefinitions = [];

      if (report.orderId) {
        try {
          order = await getRentalOrderById(report.orderId);
          // Enrich order with device model info
          if (order && Array.isArray(order.orderDetails)) {
            const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
            const modelPairs = await Promise.all(
              modelIds.map(async (id) => {
                try {
                  const m = await getDeviceModelById(id);
                  return [id, m];
                } catch {
                  return [id, null];
                }
              })
            );
            const modelMap = Object.fromEntries(modelPairs);
            order = {
              ...order,
              orderDetails: order.orderDetails.map(od => ({
                ...od,
                deviceModel: modelMap[od.deviceModelId] || null,
              })),
            };
          }
        } catch (e) {
          console.warn("Could not fetch order for PDF:", e);
        }
      }

      try {
        conditionDefinitions = await getConditionDefinitions();
      } catch (e) {
        console.warn("Could not fetch condition definitions for PDF:", e);
      }

      if (handoverPrintRef.current) {
        handoverPrintRef.current.style.visibility = "visible";
        handoverPrintRef.current.style.opacity = "1";
        handoverPrintRef.current.style.left = "-99999px";
        handoverPrintRef.current.style.top = "-99999px";
        handoverPrintRef.current.style.width = "794px";
        handoverPrintRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";

        handoverPrintRef.current.innerHTML = buildPrintableHandoverReportHtml(report, order, conditionDefinitions);

        const allElements = handoverPrintRef.current.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.style) {
            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
            el.style.webkitFontSmoothing = "antialiased";
            el.style.mozOsxFontSmoothing = "grayscale";
          }
        });

        handoverPrintRef.current.offsetHeight;

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 500));

        const blob = await elementToPdfBlobHandover(handoverPrintRef.current);

        handoverPrintRef.current.style.visibility = "hidden";
        handoverPrintRef.current.style.opacity = "0";

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const handoverType = String(report.handoverType || "").toUpperCase();
        const isCheckin = handoverType === "CHECKIN";
        a.download = `${isCheckin ? "checkin" : "handover"}-report-${report.handoverReportId || report.id || "report"}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
      }
    } catch (e) {
      console.error("Error downloading handover PDF:", e);
      message.error("Không thể tải PDF");
    } finally {
      setHandoverPdfGenerating(false);
    }
  };

  // Handle sign handover report
  const handleSignHandoverReport = async (reportId) => {
    if (!reportId) {
      message.error("ID biên bản không hợp lệ");
      return;
    }
    if (!customerProfile?.email) {
      message.error("Không tìm thấy email trong tài khoản. Vui lòng cập nhật thông tin cá nhân.");
      return;
    }
    setCurrentHandoverReportId(reportId);
    setHandoverSignModalOpen(true);
    setHandoverPinSent(false);
  };

  // Send PIN for handover report
  const sendHandoverPin = async () => {
    if (!currentHandoverReportId || !customerProfile?.email) {
      message.error("Không tìm thấy email để gửi mã PIN.");
      return;
    }
    try {
      setSigningHandover(true);
      await sendCustomerHandoverReportPin(currentHandoverReportId, { email: customerProfile.email });
      message.success("Đã gửi mã PIN đến email của bạn!");
      setHandoverPinSent(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không gửi được mã PIN.");
    } finally {
      setSigningHandover(false);
    }
  };

  // Sign handover report
  const handleSignHandover = async (values) => {
    if (!currentHandoverReportId) {
      message.error("Không tìm thấy biên bản để ký.");
      return;
    }
    try {
      setHandoverSigning(true);
      const customerSignature = customerProfile?.fullName || customerProfile?.name || customerProfile?.email || "";
      await updateCustomerHandoverReportSignature(currentHandoverReportId, {
        pinCode: values.pinCode,
        customerSignature: customerSignature,
      });
      message.success("Ký biên bản bàn giao thành công!");
      setHandoverSignModalOpen(false);
      setCurrentHandoverReportId(null);
      setHandoverPinSent(false);
      // Reload handover reports
      if (current?.id) {
        await loadOrderHandoverReports(current.id);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không thể ký biên bản.");
    } finally {
      setHandoverSigning(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const viewContractDetail = async (contractId) => {
    try {
      setLoadingContractDetail(true);
      const contract = await getContractById(contractId);
      const normalized = normalizeContract(contract);
      setContractDetail(normalized);
      if (normalized?.contractUrl) setPdfPreviewUrl(normalized.contractUrl);

      if (customerProfile) setContractCustomer(customerProfile);
      else {
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
    if (!contractId) { message.error("ID hợp đồng không hợp lệ"); return; }
    let profile = customerProfile;
    if (!profile) {
      try {
        const loaded = await fetchMyCustomerProfile();
        profile = normalizeCustomer(loaded || {});
        setCustomerProfile(profile);
      } catch {
        message.error("Không thể tải thông tin khách hàng.");
        return;
      }
    }
    if (!profile?.email) {
      message.error("Không tìm thấy email trong tài khoản. Vui lòng cập nhật thông tin cá nhân.");
      return;
    }
    setCurrentContractId(contractId);
    setSignModalOpen(true);
    setPinSent(false);
  };

  const sendPin = async () => {
    if (!currentContractId || !customerProfile?.email) {
      message.error("Không tìm thấy email để gửi mã PIN.");
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
    if (!currentContractId) {
      message.error("Không tìm thấy hợp đồng để ký.");
      return;
    }
    try {
      setSigning(true);
      await signContractApi(currentContractId, {
        pinCode: values.pinCode,
        signatureMethod: "EMAIL_OTP",
      });
      message.success("Ký hợp đồng thành công!");
      message.success("Bạn đã ký hợp đồng thành công. Vui lòng thanh toán để hoàn tất đơn.");
      setSignModalOpen(false);
      setCurrentContractId(null);
      setPinSent(false);
      await loadOrderContracts(current?.id);
      await loadAllContracts();
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không thể ký hợp đồng.");
    } finally {
      setSigning(false);
    }
  };

  const handlePayment = async (order) => {
    if (!order || !order.id) { message.error("Không có thông tin đơn hàng để thanh toán."); return; }
    setPaymentOrder(order);
    setPaymentMethod("VNPAY");
    setPaymentTermsAccepted(false);
    setPaymentModalOpen(true);
  };

  const confirmCreatePayment = async () => {
    const order = paymentOrder || current;
    if (!order || !order.id) { message.error("Không có thông tin đơn hàng để thanh toán."); return; }
    if (!paymentTermsAccepted) { message.warning("Vui lòng chấp nhận điều khoản trước khi thanh toán."); return; }
    try {
      setProcessingPayment(true);
      const items = order.items || [];
      const days = Number(order.days || 1);
      const rentalTotalRecalc = items.reduce((s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0) * days;
      const totalPriceFromBE = Number(order.total ?? rentalTotalRecalc);
      const depositTotal = items.reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
      const totalAmount = totalPriceFromBE + depositTotal;
      if (totalAmount <= 0) { message.error("Số tiền thanh toán không hợp lệ."); return; }

      const baseUrl = window.location.origin;
      const orderIdParam = Number(order.id);
      const orderCodeParam = order.displayId || order.id;
      const cancelUrl = `${baseUrl}/payment/cancel?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
      // VNPay sẽ redirect về các URL này với query params từ backend
      const frontendSuccessUrl = `${baseUrl}/success?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
      const frontendFailureUrl = `${baseUrl}/failure?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;

      const payload = {
        orderId: orderIdParam,
        invoiceType: "RENT_PAYMENT",
        paymentMethod: String(paymentMethod || "VNPAY").toUpperCase(),
        amount: totalAmount,
        description: `Thanh toán đơn hàng #${orderCodeParam}`,
        cancelUrl,
        frontendSuccessUrl,
        frontendFailureUrl,
      };

      const result = await createPayment(payload);
      const redirectUrl = result?.checkoutUrl || result?.payUrl || result?.deeplink || result?.qrUrl;
      if (redirectUrl) {
        localStorage.setItem("pendingPaymentOrderId", String(orderIdParam));
        localStorage.setItem("pendingPaymentOrderCode", String(orderCodeParam));
        window.location.href = redirectUrl;
      } else {
        message.error("Không nhận được link thanh toán từ hệ thống.");
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      message.error(error?.response?.data?.message || error?.message || "Không thể tạo thanh toán.");
    } finally {
      setProcessingPayment(false);
    }
  };

  /* =========================
   * 6) HTML → PDF
   * ========================= */
  function buildPrintableHtml(detail, customer, kyc) {
    if (!detail) return "<div>Không có dữ liệu hợp đồng</div>";
    const title = detail.title || "HỢP ĐỒNG";
    const number = detail.number ? `Số: ${detail.number}` : "";
    const customerName = customer?.fullName || customer?.name || `Khách hàng #${detail.customerId}`;
    const customerEmail = customer?.email || "";
    const customerPhone = customer?.phoneNumber || "";
    const identificationCode = kyc?.identificationCode || "";
    let contentHtml = sanitizeContractHtml(detail.contentHtml || "");

    const termsBlock = detail.terms
      ? `<pre style="white-space:pre-wrap;margin:0">${detail.terms}</pre>`
      : "";

    return `
      <div style="
        width:794px;margin:0 auto;background:#fff;color:#111;
        font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;
        padding:32px 40px;box-sizing:border-box;">
        ${GLOBAL_PRINT_CSS}
        ${NATIONAL_HEADER_HTML}

        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:22px;font-weight:700;letter-spacing:.5px">${title}</div>
          <div style="color:#666">${number}</div>
        </div>
        <hr style="border:none;border-top:1px solid #e8e8e8;margin:12px 0 16px"/>

        <section class="kv">
          <div><b>Bên A (Bên cho thuê):</b> CÔNG TY TECHRENT</div>
          <div><b>Bên B (Khách hàng):</b> ${customerName}</div>
          ${identificationCode ? `<div><b>Số căn cước công dân:</b> ${identificationCode}</div>` : ""}
          ${customerEmail ? `<div><b>Email:</b> ${customerEmail}</div>` : ""}
          ${customerPhone ? `<div><b>Điện thoại:</b> ${customerPhone}</div>` : ""}
          ${(() => {
        const bankInfo = customer?.bankInformationDtos || customer?.bankInformations || [];
        if (bankInfo.length > 0) {
          return bankInfo.map((bank, idx) => {
            const bankName = bank?.bankName || "";
            const bankHolder = bank?.bankHolder || "";
            const cardNumber = bank?.cardNumber || "";
            if (!bankName && !bankHolder && !cardNumber) return "";
            return `<div><b>Tài khoản ngân hàng${bankInfo.length > 1 ? ` ${idx + 1}` : ""}:</b> ${bankName ? `${bankName}` : ""}${bankHolder ? ` - Chủ tài khoản: ${bankHolder}` : ""}${cardNumber ? ` - Số tài khoản: ${cardNumber}` : ""}</div>`;
          }).filter(Boolean).join("");
        }
        return "";
      })()}
        </section>

        <section style="page-break-inside:avoid;margin:10px 0 16px">${contentHtml}</section>

        ${termsBlock ? `
        <section style="page-break-inside:avoid;margin:10px 0 16px">
          <h3>Điều khoản &amp; Điều kiện</h3>
          ${termsBlock}
        </section>` : ""}

        <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN B</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${(() => {
        const status = String(detail.status || "").toUpperCase();
        if (status === "ACTIVE") {
          return '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>';
        }
        return "";
      })()}
            </div>
            <div>
              ${(() => {
        const status = String(detail.status || "").toUpperCase();
        if (status === "ACTIVE") {
          return `<div style="color:#000;font-weight:600">${customerName}</div>`;
        }
        return "(Ký, ghi rõ họ tên)";
      })()}
            </div>
          </div>
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN A</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">
            ${(() => {
        const status = String(detail.status || "").toUpperCase();
        if (status === "PENDING_SIGNATURE" || status === "ACTIVE") {
          return '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>';
        }
        return "";
      })()}
            </div>
            <div>
              ${(() => {
        const status = String(detail.status || "").toUpperCase();
        if (status === "PENDING_SIGNATURE" || status === "ACTIVE") {
          return '<div style="color:#000;font-weight:600">CÔNG TY TECHRENT</div>';
        }
        return "(Ký, ghi rõ họ tên)";
      })()}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  async function elementToPdfBlob(el) {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = pageWidth / canvas.width;

    const pageCanvas = document.createElement("canvas");
    const ctx = pageCanvas.getContext("2d");

    let renderedHeight = 0;
    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageHeight / ratio, canvas.height - renderedHeight);
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0, renderedHeight, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight
      );
      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (renderedHeight > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, sliceHeight * ratio);
      renderedHeight += sliceHeight;
    }
    return pdf.output("blob");
  }

  async function previewContractAsPdf() {
    if (!current?.id) return message.warning("Chưa chọn đơn.");
    const rawDetail = contractDetail || (contracts[0] ? { ...contracts[0] } : null);
    if (!rawDetail) return message.warning("Đơn này chưa có dữ liệu hợp đồng.");

    let sandbox = null;
    try {
      setPdfGenerating(true);
      revokeBlob(pdfBlobUrl);

      const detail = augmentContractContent(rawDetail);

      let customer = contractCustomer || customerProfile;
      let kyc = null;

      try {
        if (!customer) {
          const customerData = await fetchMyCustomerProfile();
          customer = normalizeCustomer(customerData || {});
        }
      } catch (e) {
        console.error("Failed to fetch customer profile:", e);
      }

      try {
        const kycData = await getMyKyc();
        kyc = kycData || null;
      } catch (e) {
        console.error("Failed to fetch KYC data:", e);
      }

      sandbox = createPrintSandbox();
      if (!sandbox) {
        message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
        return;
      }

      sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);
      const blob = await elementToPdfBlob(sandbox);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setPdfModalOpen(true);
    } catch (e) {
      console.error(e);
      message.error("Không tạo được bản xem trước PDF.");
    } finally {
      cleanupPrintSandbox(sandbox);
      setPdfGenerating(false);
    }
  }

  async function downloadContractAsPdf() {
    if (!current?.id) return message.warning("Chưa chọn đơn.");
    const rawDetail = contractDetail || (contracts[0] ? { ...contracts[0] } : null);
    if (!rawDetail) return message.warning("Đơn này chưa có dữ liệu hợp đồng.");

    let sandbox = null;
    try {
      setPdfGenerating(true);
      revokeBlob(pdfBlobUrl);

      const detail = augmentContractContent(rawDetail);

      let customer = contractCustomer || customerProfile;
      let kyc = null;

      try {
        if (!customer) {
          const customerData = await fetchMyCustomerProfile();
          customer = normalizeCustomer(customerData || {});
        }
      } catch (e) {
        console.error("Failed to fetch customer profile:", e);
      }

      try {
        const kycData = await getMyKyc();
        kyc = kycData || null;
      } catch (e) {
        console.error("Failed to fetch KYC data:", e);
      }

      sandbox = createPrintSandbox();
      if (!sandbox) {
        message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
        return;
      }

      sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);
      const blob = await elementToPdfBlob(sandbox);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const name = detail.contractFileName || detail.number || `contract-${detail.id}.pdf`;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
      message.error("Không thể tạo/tải PDF.");
    } finally {
      cleanupPrintSandbox(sandbox);
      setPdfGenerating(false);
    }
  }

  // Preview contract PDF inline (for Card preview)
  const previewContractAsPdfInline = async (contract) => {
    if (!contract) return message.warning("Chưa chọn hợp đồng.");

    try {
      setPdfGenerating(true);
      setSelectedContract(contract);

      if (contractPdfPreviewUrl) {
        URL.revokeObjectURL(contractPdfPreviewUrl);
        setContractPdfPreviewUrl("");
      }

      // If contract has URL, use it directly (but still set selected contract)
      if (contract.contractUrl) {
        setContractPdfPreviewUrl(contract.contractUrl);
        setPdfGenerating(false);
        return;
      }

      // Also check current.contractUrl as fallback
      if (current?.contractUrl) {
        setContractPdfPreviewUrl(current.contractUrl);
        setPdfGenerating(false);
        return;
      }

      // Otherwise, generate from HTML
      const detail = augmentContractContent(contract);

      let customer = contractCustomer || customerProfile;
      let kyc = null;

      try {
        if (!customer) {
          const customerData = await fetchMyCustomerProfile();
          customer = normalizeCustomer(customerData || {});
        }
      } catch (e) {
        console.error("Failed to fetch customer profile:", e);
      }

      try {
        const kycData = await getMyKyc();
        kyc = kycData || null;
      } catch (e) {
        console.error("Failed to fetch KYC data:", e);
      }

      const sandbox = createPrintSandbox();
      if (!sandbox) {
        message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
        setPdfGenerating(false);
        return;
      }

      try {
        sandbox.style.visibility = "visible";
        sandbox.style.opacity = "1";
        sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);

        const allElements = sandbox.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.style) {
            el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
            el.style.webkitFontSmoothing = "antialiased";
            el.style.mozOsxFontSmoothing = "grayscale";
          }
        });

        sandbox.offsetHeight;

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 500));

        const blob = await elementToPdfBlob(sandbox);

        const url = URL.createObjectURL(blob);
        setContractPdfPreviewUrl(url);
      } finally {
        cleanupPrintSandbox(sandbox);
      }
    } catch (e) {
      console.error("Error generating contract PDF:", e);
      message.error("Không thể tạo bản xem trước PDF");
    } finally {
      setPdfGenerating(false);
    }
  };

  // Polling fallback: detect orders entering 'processing'
  const seenProcessingRef = useRef(new Set());
  const startPollingProcessing = () => {
    const run = async () => {
      try {
        const res = await listRentalOrders();
        const processing = (Array.isArray(res) ? res : []).filter((o) =>
          String(o?.orderStatus || o?.status || "").toLowerCase() === "processing"
        );

        let hasNewProcessingOrder = false;
        const newlySeenIds = [];

        for (const o of processing) {
          const id = o.orderId ?? o.id;
          if (id == null) continue;
          if (!seenProcessingRef.current.has(id)) {
            seenProcessingRef.current.add(id);
            newlySeenIds.push(id);
            hasNewProcessingOrder = true;
          }
        }

        if (hasNewProcessingOrder) {
          // Cập nhật lại orders & contracts một lần cho tất cả đơn mới phát hiện
          try {
            await loadOrders();
          } catch { }

          let contractsSnapshot = [];
          try {
            contractsSnapshot = await loadAllContracts();
          } catch { }

          newlySeenIds.forEach((id) => {
            const hasContractReady = hasAnyContract(id, contractsSnapshot);
            message.success(
              hasContractReady
                ? `Đơn ${id} đã có hợp đồng. Vui lòng ký và thanh toán ngay.`
                : `Đơn ${id} đã được duyệt thành công. Chúng tôi sẽ gửi hợp đồng trong ít phút.`
            );
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Polling] Load orders failed:", e?.message || e);
      }
    };

    // Không tạo thêm interval nếu đã tồn tại
    if (pollingRef.current) return;

    run();
    pollingRef.current = setInterval(run, 20000);
  };

  function printPdfUrl(url) {
    if (!url) return message.warning("Không có tài liệu để in.");
    const w = window.open(url, "_blank", "noopener");
    if (w) {
      const listener = () => {
        try { w.focus(); w.print(); } catch (err) { console.error("Print window error:", err); }
      };
      setTimeout(listener, 800);
    }
  }

  /* =========================
   * 7) COLUMNS
   * ========================= */
  /* =========================
   * 8) RENDER
   * ========================= */
  return (
    <>
      <MyOrdersList
        orders={orders}
        loading={loading || loadingOrders}
        onRefresh={refresh}
        onSelectOrder={showDetail}
        formatDateTime={formatDateTime}
        formatVND={formatVND}
        orderStatusMap={ORDER_STATUS_MAP}
      />

      {/* Drawer chi tiết đơn */}
      <Drawer
        title={
          <div>
            <Title level={4} style={{ margin: 0, color: "#1a1a1a" }}>
              {current ? `Chi tiết đơn ${current.displayId ?? current.id}` : "Chi tiết đơn"}
            </Title>
          </div>
        }
        width={900}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          clearContractPreviewState();
          setDetailTab("overview");
          setSettlementInfo(null);
          // Clear handover preview
          if (handoverPdfPreviewUrl) {
            URL.revokeObjectURL(handoverPdfPreviewUrl);
            setHandoverPdfPreviewUrl("");
          }
          setSelectedHandoverReport(null);
          // Clear contract preview
          if (contractPdfPreviewUrl && !contractPdfPreviewUrl.startsWith('http')) {
            URL.revokeObjectURL(contractPdfPreviewUrl);
          }
          setContractPdfPreviewUrl("");
          setSelectedContract(null);
        }}
        styles={{
          body: { padding: 0, background: "#f5f7fa" },
          header: { background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "14px 18px" },
        }}
      >
        {current && (
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e8e8e8",
              background: "#ffffff",
            }}
          >
            {(() => {
              const tracking = computeOrderTracking(current, contracts, invoiceInfo);
              return (
                <div style={{ overflowX: "auto", padding: "8px 0" }}>
                  <Steps
                    current={tracking.current}
                    size="default"
                    responsive
                    style={{
                      background: "transparent",
                      minWidth: "max-content",
                    }}
                    className="order-tracking-steps"
                  >
                    {tracking.steps.map((s, idx) => (
                      <Steps.Step
                        key={idx}
                        title={<span style={{ fontSize: 13, whiteSpace: "nowrap" }}>{s.title}</span>}
                        description={s.description ? <span style={{ fontSize: 11 }}>{s.description}</span> : null}
                      />
                    ))}
                  </Steps>
                </div>
              );
            })()}
          </div>
        )}
        {current && needsContractAction && (
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #e8e8e8",
              background: "#fff",
            }}
          >
            <Alert
              type="info"
              showIcon
              message={`Đơn #${current.displayId ?? current.id} đã được xác nhận`}
              description={
                hasContracts
                  ? "Vui lòng ký hợp đồng và thanh toán để chúng tôi chuẩn bị giao hàng."
                  : "Chúng tôi đang tạo hợp đồng cho đơn này. Bạn sẽ nhận được thông báo khi hợp đồng sẵn sàng."
              }
              action={
                hasContracts && (
                  <Button type="link" onClick={() => setDetailTab("contract")} style={{ padding: 0 }}>
                    Xem hợp đồng
                  </Button>
                )
              }
            />
          </div>
        )}
        {current && settlementInfo && (() => {
          const settlementState = String(settlementInfo.state || "").toUpperCase();
          const isAwaitingResponse = !["ISSUED", "REJECTED", "CANCELLED", "CLOSED"].includes(settlementState);
          if (!isAwaitingResponse) return null;
          return (
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #e8e8e8",
                background: "#fff",
              }}
            >
              <Alert
                type="warning"
                showIcon
                message={`Đơn #${current.displayId ?? current.id} có quyết toán cần xác nhận`}
                description="Vui lòng xem bảng quyết toán và chấp nhận hoặc từ chối để chúng tôi hoàn cọc cho bạn."
                action={
                  <Button type="link" onClick={() => setDetailTab("settlement")} style={{ padding: 0 }}>
                    Xem quyết toán
                  </Button>
                }
              />
            </div>
          );
        })()}
        {current && (hasUnsignedCheckoutReports || hasUnsignedCheckinReports) && (
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #e8e8e8",
              background: "#fff",
            }}
          >
            <Alert
              type="info"
              showIcon
              message={`Đơn #${current.displayId ?? current.id} có biên bản cần ký`}
              description={
                <>
                  {hasUnsignedCheckoutReports && hasUnsignedCheckinReports
                    ? "Vui lòng xem và ký biên bản bàn giao và biên bản thu hồi để hoàn tất thủ tục."
                    : hasUnsignedCheckoutReports
                      ? "Vui lòng xem và ký biên bản bàn giao để hoàn tất thủ tục."
                      : "Vui lòng xem và ký biên bản thu hồi để hoàn tất thủ tục."}
                </>
              }
              action={
                <Space>
                  {hasUnsignedCheckoutReports && (
                    <Button type="link" onClick={() => setDetailTab("handover")} style={{ padding: 0 }}>
                      Xem biên bản bàn giao
                    </Button>
                  )}
                  {hasUnsignedCheckinReports && (
                    <Button type="link" onClick={() => setDetailTab("checkin")} style={{ padding: 0 }}>
                      Xem biên bản thu hồi
                    </Button>
                  )}
                </Space>
              }
            />
          </div>
        )}
        {current && isOrderInUse(current) && isCloseToReturnDate(current) && !isReturnConfirmedSync(current) && (
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #e8e8e8",
              background: "#fffacd",
            }}
          >
            <Alert
              type="warning"
              showIcon
              message={`Đơn #${current.displayId ?? current.id} sắp đến hạn trả hàng`}
              description={
                "Còn 1 ngày nữa là đến hạn trả hàng. Bạn muốn gia hạn hay trả hàng?"
              }
              action={
                <Space>
                </Space>
              }
            />
          </div>
        )}
        {current && (() => {
          // Filter tabs based on data availability - only show tabs that have data
          const allTabs = [
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

                    // Check payment status from invoice if available, otherwise use order paymentStatus
                    const invoiceStatus = invoiceInfo?.invoiceStatus;
                    const paymentStatus = invoiceStatus
                      ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
                      : String(current.paymentStatus || "unpaid").toLowerCase();

                    const canPay =
                      ["unpaid", "partial"].includes(paymentStatus) &&
                      String(current.orderStatus).toLowerCase() === "processing" &&
                      hasSignedContract(current.id);
                    const totalAmount = Number(current?.total ?? rentalTotal) + depositTotal;

                    return (
                      <>
                        <Card
                          style={{
                            marginBottom: 24,
                            borderRadius: 12,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            border: "1px solid #e8e8e8",
                          }}
                        >
                          <Descriptions bordered column={2} size="middle">
                            <Descriptions.Item label="Mã đơn"><Text strong>{current.displayId ?? current.id}</Text></Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo đơn">{formatDateTime(current.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="Ngày bắt đầu thuê">
                              {current.startDate ? formatDateTime(current.startDate) : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày kết thúc thuê">
                              {current.endDate ? formatDateTime(current.endDate) : "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái đơn">
                              <Tag color={(ORDER_STATUS_MAP[current.orderStatus] || {}).color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                {(ORDER_STATUS_MAP[current.orderStatus] || {}).label ?? current.orderStatus ?? "—"}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thanh toán">
                              {(() => {
                                // Use invoice status if available, otherwise fallback to order paymentStatus
                                const invoiceStatus = invoiceInfo?.invoiceStatus;
                                const displayPaymentStatus = invoiceStatus
                                  ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
                                  : (String(current.orderStatus).toLowerCase() === "delivery_confirmed" ? "paid" : current.paymentStatus);
                                const paymentInfo = PAYMENT_STATUS_MAP[displayPaymentStatus] || {};
                                return (
                                  <Tag color={paymentInfo.color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                    {paymentInfo.label ?? displayPaymentStatus ?? "—"}
                                  </Tag>
                                );
                              })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="Tổng tiền thuê">
                              <Space direction="vertical" size={0}>
                                <Text strong>{formatVND(Number(current?.total ?? rentalTotal))}</Text>
                              </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tổng tiền cọc">
                              <Space direction="vertical" size={0}>
                                <Text strong>{formatVND(depositTotal)}</Text>
                              </Space>
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>

                        {/* Products Section */}
                        <Card
                          style={{
                            marginBottom: 24,
                            borderRadius: 12,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            border: "1px solid #e8e8e8",
                          }}
                          title={
                            <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
                              Sản phẩm trong đơn
                            </Title>
                          }
                        >
                          <Table
                            rowKey={(r, idx) => `${r.deviceModelId || r.name}-${idx}`}
                            dataSource={items}
                            pagination={false}
                            size="small"
                            scroll={{ x: 860 }}
                            columns={[
                              {
                                title: "Sản phẩm",
                                dataIndex: "name",
                                width: 240,
                                render: (v, r) => (
                                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <Avatar shape="square" size={40} src={r.image} style={{ borderRadius: 6 }} />
                                    <div style={{ minWidth: 0 }}>
                                      <Text strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13 }}>{v}</Text>
                                    </div>
                                  </div>
                                ),
                              },
                              { title: "SL", dataIndex: "qty", width: 60, align: "center" },
                              { title: "Đơn giá SP/ngày", dataIndex: "pricePerDay", width: 120, align: "right", render: (v) => formatVND(v) },
                              { title: "Số ngày thuê", key: "days", width: 80, align: "center", render: () => days },
                              { title: "Tổng tiền thuê", key: "subtotal", width: 130, align: "right", render: (_, r) => formatVND(Number(r.pricePerDay || 0) * Number(days || 1)) },
                              { title: "Cọc/1 SP", dataIndex: "depositAmountPerUnit", width: 120, align: "right", render: (v) => formatVND(v) },
                              { title: "Tổng cọc", key: "depositSubtotal", width: 120, align: "right", render: (_, r) => formatVND(Number(r.depositAmountPerUnit || 0) * Number(r.qty || 1)) },
                            ]}
                          />
                        </Card>

                        {/* Payment Summary */}
                        <Card
                          style={{
                            borderRadius: 12,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            border: "1px solid #e8e8e8",
                            background: canPay ? "#fafafa" : "#fff",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Space direction="vertical" align="end" size="middle" style={{ width: "100%" }}>
                              <div style={{ width: "100%", maxWidth: 360 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                  <Text>Tổng tiền thuê ({days} ngày):</Text>
                                  <Text strong style={{ fontSize: 15 }}>{formatVND(Number(current?.total ?? rentalTotal))}</Text>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                  <Text>Tổng tiền cọc:</Text>
                                  <Text strong style={{ fontSize: 15 }}>{formatVND(depositTotal)}</Text>
                                </div>
                                <Divider style={{ margin: "12px 0" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <Text style={{ fontSize: 16, fontWeight: 600 }}>Tổng thanh toán:</Text>
                                  <Text strong style={{ color: "#1a1a1a", fontSize: 18, fontWeight: 700 }}>
                                    {formatVND(totalAmount)}
                                  </Text>
                                </div>
                              </div>


                            </Space>
                          </div>
                        </Card>
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
                <MyOrderContractTab
                  current={current}
                  contracts={contracts}
                  contractsLoading={contractsLoading}
                  selectedContract={selectedContract}
                  setSelectedContract={setSelectedContract}
                  contractPdfPreviewUrl={contractPdfPreviewUrl}
                  pdfGenerating={pdfGenerating}
                  processingPayment={processingPayment}
                  invoiceInfo={invoiceInfo}
                  PAYMENT_STATUS_MAP={PAYMENT_STATUS_MAP}
                  CONTRACT_STATUS_MAP={CONTRACT_STATUS_MAP}
                  formatVND={formatVND}
                  formatDateTime={formatDateTime}
                  hasSignedContract={hasSignedContract}
                  handlePayment={handlePayment}
                  handleDownloadContract={handleDownloadContract}
                  handleSignContract={handleSignContract}
                  previewContractAsPdfInline={previewContractAsPdfInline}
                  mapInvoiceStatusToPaymentStatus={mapInvoiceStatusToPaymentStatus}
                  message={message}
                  pdfPreviewUrl={pdfPreviewUrl}
                />
              ),
            },
            {
              key: "handover",
              label: "Biên bản bàn giao",
              children: (
                <MyOrderHandoverTab
                  current={current}
                  checkoutReports={checkoutReports}
                  checkinReports={checkinReports}
                  handoverReportsLoading={handoverReportsLoading}
                  selectedHandoverReport={selectedHandoverReport}
                  setSelectedHandoverReport={setSelectedHandoverReport}
                  selectedCheckinReport={selectedCheckinReport}
                  setSelectedCheckinReport={setSelectedCheckinReport}
                  handoverPdfPreviewUrl={handoverPdfPreviewUrl}
                  checkinPdfPreviewUrl={checkinPdfPreviewUrl}
                  handoverPdfBlobUrl={handoverPdfBlobUrl}
                  handoverPdfGenerating={handoverPdfGenerating}
                  formatDateTime={formatDateTime}
                  translateHandoverStatus={translateHandoverStatus}
                  loadOrderHandoverReports={loadOrderHandoverReports}
                  previewHandoverReportAsPdf={previewHandoverReportAsPdf}
                  handleDownloadHandoverPdf={handleDownloadHandoverPdf}
                  handleSignHandoverReport={handleSignHandoverReport}
                  message={message}
                />
              ),
            },
            {
              key: "checkin",
              label: "Biên bản thu hồi",
              children: (
                <MyOrderCheckinTab
                  current={current}
                  checkinReports={checkinReports}
                  handoverReportsLoading={handoverReportsLoading}
                  selectedCheckinReport={selectedCheckinReport}
                  setSelectedCheckinReport={setSelectedCheckinReport}
                  checkinPdfPreviewUrl={checkinPdfPreviewUrl}
                  handoverPdfBlobUrl={handoverPdfBlobUrl}
                  handoverPdfGenerating={handoverPdfGenerating}
                  formatDateTime={formatDateTime}
                  translateHandoverStatus={translateHandoverStatus}
                  loadOrderHandoverReports={loadOrderHandoverReports}
                  previewHandoverReportAsPdf={previewHandoverReportAsPdf}
                  handleDownloadHandoverPdf={handleDownloadHandoverPdf}
                  handleSignHandoverReport={handleSignHandoverReport}
                  message={message}
                />
              ),
            },
            {
              key: "return",
              label: "Trả hàng và gia hạn",
              children: (
                <MyOrderReturnTab
                  current={current}
                  getDaysRemaining={getDaysRemaining}
                  formatRemainingDaysText={formatRemainingDaysText}
                  isCloseToReturnDate={isCloseToReturnDate}
                  isReturnConfirmedSync={isReturnConfirmedSync}
                  setReturnModalOpen={setReturnModalOpen}
                  setExtendModalOpen={setExtendModalOpen}
                  diffDays={diffDays}
                  formatDateTime={formatDateTime}
                />
              ),
            },
            {
              key: "settlement",
              label: "Quyết toán & hoàn cọc",
              children: (
                <MyOrderSettlementTab
                  current={current}
                  settlementInfo={settlementInfo}
                  settlementLoading={settlementLoading}
                  settlementActionLoading={settlementActionLoading}
                  splitSettlementAmounts={splitSettlementAmounts}
                  formatVND={formatVND}
                  SETTLEMENT_STATUS_MAP={SETTLEMENT_STATUS_MAP}
                  handleRespondSettlement={handleRespondSettlement}
                />
              ),
            },
          ];

          // Filter tabs: only show tabs that have data (hide empty tabs completely)
          // Show tab while loading, but hide if loaded and no data
          const filteredTabs = allTabs.filter(tab => {
            if (tab.key === "overview" || tab.key === "return") {
              // Always show overview and return tabs
              return true;
            }
            if (tab.key === "contract") {
              // Show while loading, or if there are contracts
              return contractsLoading || contracts.length > 0;
            }
            if (tab.key === "handover") {
              // Show while loading, or if there are checkout reports
              return handoverReportsLoading || checkoutReports.length > 0;
            }
            if (tab.key === "checkin") {
              // Show while loading, or if there are checkin reports
              return handoverReportsLoading || checkinReports.length > 0;
            }
            if (tab.key === "settlement") {
              // Show while loading, or if there is settlement info
              return settlementLoading || settlementInfo !== null;
            }
            return true;
          });

          return (
            <Tabs
              key={current.id}
              activeKey={detailTab}
              onChange={setDetailTab}
              items={filteredTabs}
            />
          );
        })()}
      </Drawer>

      {/* Modal chi tiết hợp đồng */}
      <Modal
        title="Chi tiết hợp đồng"
        open={contractDetailOpen}
        onCancel={() => setContractDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setContractDetailOpen(false)}>Đóng</Button>,
          contractDetail && (() => {
            const href = contractDetail.contractUrl || pdfPreviewUrl;
            if (!href) return null;
            return (
              <>
                <Button key="print" icon={<PrinterOutlined />} onClick={() => printPdfUrl(href)}>
                  In
                </Button>
                <Button key="download-pdf" icon={<FilePdfOutlined />} href={href} target="_blank" rel="noopener">
                  Tải PDF
                </Button>
              </>
            );
          })(),
          contractDetail && String(contractDetail.status).toUpperCase() === "PENDING_SIGNATURE" && (
            <Button key="sign" type="primary" onClick={() => handleSignContract(contractDetail.id)}>
              Ký hợp đồng
            </Button>
          ),
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {loadingContractDetail ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Text type="secondary">Đang tải…</Text>
          </div>
        ) : contractDetail ? (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Card
              title={
                <div style={{ textAlign: 'center' }}>
                  <Title level={2} style={{ margin: 0, color: '#1a1a1a' }}>
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
                    {(() => {
                      const statusKey = String(contractDetail.status || "").toLowerCase();
                      const statusInfo = CONTRACT_STATUS_MAP[statusKey] || { label: contractDetail.status || "—", color: "default" };
                      const typeKey = String(contractDetail.type || "").toUpperCase();
                      const contractType = CONTRACT_TYPE_LABELS[typeKey] || contractDetail.type || "—";
                      const customerName = contractCustomer?.fullName || contractCustomer?.name || `Khách hàng #${contractDetail.customerId}`;
                      const customerEmail = contractCustomer?.email;
                      const customerPhone = contractCustomer?.phoneNumber;
                      return (
                        <Descriptions size="small" column={1}>
                          <Descriptions.Item label="Mã hợp đồng">#{contractDetail.id}</Descriptions.Item>
                          <Descriptions.Item label="Đơn thuê">#{contractDetail.orderId}</Descriptions.Item>
                          <Descriptions.Item label="Bên khách hàng">
                            <div>
                              <div><strong>{customerName}</strong></div>
                              <div style={{ color: "#999", fontSize: 11 }}>ID: #{contractDetail.customerId}</div>
                              {customerEmail && (<div style={{ color: "#666", fontSize: 12 }}>{customerEmail}</div>)}
                              {customerPhone && (<div style={{ color: "#666", fontSize: 12 }}>{customerPhone}</div>)}
                            </div>
                          </Descriptions.Item>
                          <Descriptions.Item label="Bên cho thuê">
                            <strong>CÔNG TY TECHRENT</strong>
                          </Descriptions.Item>
                          <Descriptions.Item label="Loại hợp đồng">
                            <Tag color="blue">{contractType}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Trạng thái">
                            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                          </Descriptions.Item>
                        </Descriptions>
                      );
                    })()}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Thời gian">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Ngày bắt đầu">{contractDetail.startDate ? formatDateTime(contractDetail.startDate) : "—"}</Descriptions.Item>
                      <Descriptions.Item label="Ngày kết thúc">{contractDetail.endDate ? formatDateTime(contractDetail.endDate) : "—"}</Descriptions.Item>
                      <Descriptions.Item label="Số ngày thuê">{contractDetail.rentalPeriodDays ? `${contractDetail.rentalPeriodDays} ngày` : "—"}</Descriptions.Item>
                      <Descriptions.Item label="Hết hạn">{contractDetail.expiresAt ? formatDateTime(contractDetail.expiresAt) : "—"}</Descriptions.Item>
                    </Descriptions>
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
                  dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(contractDetail.contentHtml || "—") }}
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
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">Không có dữ liệu hợp đồng</Text>
          </div>
        )}
      </Modal>

      {/* Modal xem trước PDF do FE kết xuất */}
      <Modal
        title="Xem trước PDF hợp đồng (HTML→PDF)"
        open={pdfModalOpen}
        onCancel={() => {
          setPdfModalOpen(false);
          if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(""); }
        }}
        footer={[
          <Button key="close" onClick={() => {
            setPdfModalOpen(false);
            if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(""); }
          }}>
            Đóng
          </Button>,
          <Button key="print" icon={<PrinterOutlined />} onClick={() => printPdfUrl(pdfBlobUrl)} disabled={!pdfBlobUrl}>
            In
          </Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={downloadContractAsPdf} loading={pdfGenerating}>
            Tải PDF
          </Button>
        ]}
        width={900}
        style={{ top: 24 }}
      >
        {pdfBlobUrl ? (
          <iframe title="PDFPreview" src={pdfBlobUrl} style={{ width: "100%", height: "70vh", border: "none" }} />
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Text type="secondary">Đang tạo bản xem trước…</Text>
          </div>
        )}
      </Modal>

      {/* Modal ký hợp đồng */}
      <Modal
        title="Ký hợp đồng"
        open={signModalOpen}
        onCancel={() => {
          setSignModalOpen(false);
          setCurrentContractId(null);
          setPinSent(false);
        }}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={pinSent ? handleSign : sendPin}>
          {!pinSent ? (
            <>
              <Text>Email nhận mã PIN: <strong>{customerProfile?.email || "Chưa cập nhật"}</strong></Text>
              <Divider />
              <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                <Button
                  onClick={() => {
                    setSignModalOpen(false);
                    setCurrentContractId(null);
                    setPinSent(false);
                  }}
                >
                  Hủy
                </Button>
                <Button type="primary" htmlType="submit" loading={signingContract} disabled={!customerProfile?.email}>
                  Gửi mã PIN
                </Button>
              </Space>
            </>
          ) : (
            <>
              <Form.Item
                label="Mã PIN"
                name="pinCode"
                rules={[{ required: true, message: "Vui lòng nhập mã PIN" }, { min: 6, message: "Ít nhất 6 ký tự" }]}
              >
                <Input placeholder="Nhập mã PIN" maxLength={10} />
              </Form.Item>
              <Space style={{ justifyContent: "space-between", width: "100%" }}>
                <Button onClick={() => setPinSent(false)}>Quay lại</Button>
                <Button type="primary" htmlType="submit" loading={signing}>
                  Ký hợp đồng
                </Button>
              </Space>
            </>
          )}
        </Form>
      </Modal>

      {/* Modal xem trước PDF biên bản bàn giao */}
      <Modal
        title="Xem trước biên bản bàn giao"
        open={handoverPdfModalOpen}
        onCancel={() => {
          setHandoverPdfModalOpen(false);
          if (handoverPdfBlobUrl) {
            URL.revokeObjectURL(handoverPdfBlobUrl);
            setHandoverPdfBlobUrl("");
          }
          setSelectedHandoverReport(null);
        }}
        width="90%"
        style={{ top: 20 }}
        footer={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (selectedHandoverReport) {
                handleDownloadHandoverPdf(selectedHandoverReport);
              }
            }}
            loading={handoverPdfGenerating}
          >
            Tải PDF
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setHandoverPdfModalOpen(false);
              if (handoverPdfBlobUrl) {
                URL.revokeObjectURL(handoverPdfBlobUrl);
                setHandoverPdfBlobUrl("");
              }
              setSelectedHandoverReport(null);
            }}
          >
            Đóng
          </Button>,
        ]}
      >
        {handoverPdfBlobUrl ? (
          <iframe
            src={handoverPdfBlobUrl}
            style={{ width: "100%", height: "80vh", border: "none" }}
            title="Handover PDF Preview"
          />
        ) : (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Text>Đang tạo PDF...</Text>
          </div>
        )}
      </Modal>

      {/* Modal ký biên bản bàn giao */}
      <Modal
        title="Ký biên bản bàn giao"
        open={handoverSignModalOpen}
        onCancel={() => {
          setHandoverSignModalOpen(false);
          setCurrentHandoverReportId(null);
          setHandoverPinSent(false);
        }}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handoverPinSent ? handleSignHandover : sendHandoverPin}>
          {!handoverPinSent ? (
            <>
              <Text>Email nhận mã PIN: <strong>{customerProfile?.email || "Chưa cập nhật"}</strong></Text>
              <Divider />
              <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                <Button
                  onClick={() => {
                    setHandoverSignModalOpen(false);
                    setCurrentHandoverReportId(null);
                    setHandoverPinSent(false);
                  }}
                >
                  Hủy
                </Button>
                <Button type="primary" htmlType="submit" loading={signingHandover} disabled={!customerProfile?.email}>
                  Gửi mã PIN
                </Button>
              </Space>
            </>
          ) : (
            <>
              <Form.Item
                label="Mã PIN"
                name="pinCode"
                rules={[{ required: true, message: "Vui lòng nhập mã PIN" }, { min: 6, message: "Ít nhất 6 ký tự" }]}
              >
                <Input placeholder="Nhập mã PIN" maxLength={10} />
              </Form.Item>
              <Space style={{ justifyContent: "space-between", width: "100%" }}>
                <Button onClick={() => setHandoverPinSent(false)}>Quay lại</Button>
                <Button type="primary" htmlType="submit" loading={handoverSigning}>
                  Ký biên bản
                </Button>
              </Space>
            </>
          )}
        </Form>
      </Modal>

      {/* Modal xác nhận trả hàng */}
      <Modal
        title="Xác nhận trả hàng"
        open={returnModalOpen}
        onCancel={() => setReturnModalOpen(false)}
        onOk={handleConfirmReturn}
        okText="Xác nhận trả hàng"
        okButtonProps={{ loading: processingReturn, danger: true }}
        cancelText="Hủy"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Alert
            type="warning"
            showIcon
            message="Bạn có chắc chắn muốn trả hàng?"
            description={
              <div>

                {current && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>Thông tin đơn hàng:</Text>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                      <li>Mã đơn: <Text strong>#{current.displayId ?? current.id}</Text></li>
                      <li>Ngày kết thúc thuê: <Text strong>{current.endDate ? formatDateTime(current.endDate) : "—"}</Text></li>
                      {(() => {
                        const days = getDaysRemaining(current.endDate);
                        if (days === null) return null;
                        return (
                          <li>
                            Thời gian còn lại: <Text strong>{formatRemainingDaysText(days)}</Text>
                          </li>
                        );
                      })()}
                    </ul>
                  </div>
                )}
              </div>
            }
          />
        </Space>
      </Modal>

      {/* Modal yêu cầu gia hạn */}
      <Modal
        title="Yêu cầu gia hạn đơn hàng"
        open={extendModalOpen}
        onCancel={() => {
          setExtendModalOpen(false);
          setExtendedEndTime(null);
        }}
        onOk={handleExtendRequest}
        okText="Gửi yêu cầu"
        cancelText="Hủy"
        okButtonProps={{ loading: processingExtend }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {current && (
            <>
              <Alert
                type="info"
                showIcon
                message="Thông tin đơn hàng"
                description={
                  <div>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                      <li>Mã đơn: <Text strong>#{current.displayId ?? current.id}</Text></li>
                      <li>Ngày bắt đầu thuê: <Text strong>{current.startDate ? formatDateTime(current.startDate) : "—"}</Text></li>
                      <li>Ngày kết thúc thuê hiện tại: <Text strong>{current.endDate ? formatDateTime(current.endDate) : "—"}</Text></li>
                      {(() => {
                        const days = getDaysRemaining(current.endDate);
                        if (days === null) return null;
                        return (
                          <li>
                            Thời gian còn lại: <Text strong>{formatRemainingDaysText(days)}</Text>
                          </li>
                        );
                      })()}
                    </ul>
                  </div>
                }
              />
              <Form.Item
                label="Ngày kết thúc mới"
                required
                help="Vui lòng chọn ngày kết thúc mới cho đơn hàng. Ngày này phải sau ngày kết thúc hiện tại."
              >
                <DatePicker
                  style={{ width: "100%" }}
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  placeholder="Chọn ngày kết thúc mới"
                  value={extendedEndTime ? dayjs(extendedEndTime) : null}
                  onChange={(date) => {
                    if (date) {
                      // Convert to ISO string
                      setExtendedEndTime(date.toISOString());
                    } else {
                      setExtendedEndTime(null);
                    }
                  }}
                  disabledDate={(currentDate) => {
                    if (!current?.endDate || !currentDate) return false;
                    const endDate = dayjs(current.endDate);
                    // Disable dates before or equal to current end date
                    return currentDate.isBefore(endDate, "day") || currentDate.isSame(endDate, "day");
                  }}
                  disabledTime={(currentDate) => {
                    if (!currentDate) return {};
                    if (!current?.endDate) return {};
                    const endDate = dayjs(current.endDate);
                    // If selected date is same as end date, disable times before end time
                    if (currentDate.isSame(endDate, "day")) {
                      return {
                        disabledHours: () => {
                          const hours = [];
                          for (let i = 0; i < endDate.hour(); i++) {
                            hours.push(i);
                          }
                          return hours;
                        },
                        disabledMinutes: (selectedHour) => {
                          if (selectedHour === endDate.hour()) {
                            const minutes = [];
                            for (let i = 0; i <= endDate.minute(); i++) {
                              minutes.push(i);
                            }
                            return minutes;
                          }
                          return [];
                        },
                      };
                    }
                    return {};
                  }}
                />
              </Form.Item>
              {extendedEndTime && current?.endDate && (() => {
                const currentEnd = new Date(current.endDate);
                const newEnd = new Date(extendedEndTime);
                const diffDays = Math.ceil((newEnd - currentEnd) / (1000 * 60 * 60 * 24));
                return (
                  <Alert
                    type="success"
                    message={`Đơn hàng sẽ được gia hạn thêm ${diffDays} ngày`}
                    description={`Ngày kết thúc mới: ${formatDateTime(extendedEndTime)}`}
                  />
                );
              })()}
            </>
          )}
        </Space>
      </Modal>

      {/* Modal chọn phương thức thanh toán */}
      <Modal
        title="Thanh toán đơn hàng"
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        onOk={confirmCreatePayment}
        okText="Thanh toán"
        okButtonProps={{ disabled: !paymentTermsAccepted, loading: processingPayment }}
        destroyOnClose
      >
        {(() => {
          const order = paymentOrder || current;
          const items = order?.items || [];
          const days = Number(order?.days || 1);
          const rentalTotalRecalc = items.reduce((s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0) * days;
          const totalPriceFromBE = Number(order?.total ?? rentalTotalRecalc);
          const depositTotal = items.reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
          const totalAmount = totalPriceFromBE + depositTotal;
          return (
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>Tổng tiền thuê:</Text>
                <Text strong>{formatVND(totalPriceFromBE)}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>Tổng tiền cọc:</Text>
                <Text strong>{formatVND(depositTotal)}</Text>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 15, fontWeight: 600 }}>Tổng thanh toán</Text>
                <Text strong style={{ fontSize: 18 }}>{formatVND(totalAmount)}</Text>
              </div>

              <div>
                <Text style={{ display: "block", marginBottom: 8 }}>Phương thức thanh toán</Text>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="VNPAY">VNPay</Radio.Button>
                  <Radio.Button value="PAYOS">PayOS</Radio.Button>
                </Radio.Group>
              </div>

              <Checkbox
                checked={paymentTermsAccepted}
                onChange={(e) => setPaymentTermsAccepted(e.target.checked)}
              >
                Tôi đồng ý với các{" "}
                <a
                  href="https://docs.google.com/document/d/1GtAaYcQcSuvX8f-al_v_Q0mYYOWZMj-To8zHAKa0OnA/edit?tab=t.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  điều khoản thanh toán
                </a>
              </Checkbox>
            </Space>
          );
        })()}
      </Modal>

      {/* Container ẩn để render handover report PDF */}
      <div
        ref={handoverPrintRef}
        style={{
          position: "fixed",
          left: "-99999px",
          top: "-99999px",
          width: "794px",
          height: "auto",
          backgroundColor: "#ffffff",
          fontFamily: "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif",
          visibility: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -9999,
          overflow: "hidden",
          border: "none",
          margin: 0,
          padding: 0,
          webkitFontSmoothing: "antialiased",
          mozOsxFontSmoothing: "grayscale"
        }}
      />

      <style>{`
        .modern-table .ant-table-thead > tr > th {
          background: #fafafa;
          font-weight: 600;
          color: #1a1a1a;
          border-bottom: 1px solid #e8e8e8;
          padding: 12px;
          font-size: 13px;
        }
        .modern-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f0f0f0;
          transition: all 0.3s ease;
          padding: 12px;
        }
        .modern-table .ant-table-tbody > tr:hover > td {
          background: #f5f5f5 !important;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .modern-table .ant-table-tbody > tr {
          transition: all 0.3s ease;
        }
        .modern-table .ant-table-container {
          overflow: auto hidden;
          border-radius: 12px;
        }
        .modern-table .ant-table {
          border-radius: 12px;
          overflow: hidden;
        }
        .ant-drawer-content {
          border-radius: 0;
          overflow: hidden;
        }
        .ant-drawer-header {
          border-bottom: 1px solid #e8e8e8;
        }
        .ant-tabs-tab {
          font-weight: 500;
          font-size: 15px;
        }
        .ant-tabs-tab-active {
          font-weight: 600;
        }
        .ant-card {
          transition: all 0.3s ease;
        }
        .ant-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
        }
        .order-tracking-steps .ant-steps-item {
          flex: 0 0 auto !important;
          min-width: 140px;
          margin-right: 8px !important;
        }
        .order-tracking-steps .ant-steps-item-title {
          font-size: 13px !important;
          line-height: 1.4 !important;
          padding-right: 0 !important;
        }
        .order-tracking-steps .ant-steps-item-description {
          font-size: 11px !important;
          margin-top: 4px !important;
        }
        .order-tracking-steps .ant-steps-item-content {
          max-width: 160px;
        }
      `}</style>
    </>
  );
}
