import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Table, Tag, Typography, Input, DatePicker, Space, Button, message, Drawer, Descriptions,
  Avatar, Tabs, Modal, Card, Row, Col, Divider, Form, Steps, Radio, Checkbox, Alert
} from "antd";
import dayjs from "dayjs";
import {
  FilePdfOutlined,
  DownloadOutlined,
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
import { getComplaintsByOrderId, createComplaint } from "../../lib/complaints";
import { getAnnexesByContractId, sendAnnexPinEmail, signAnnexAsCustomer } from "../../lib/annexes";
import {
  augmentContractContent,
} from "../../lib/contractPrintUtils";
import {
  buildPrintableHandoverReportHtml,
  elementToPdfBlobHandover,
  translateHandoverStatus,
} from "../../lib/handoverReportPrintUtils";
import { buildPrintableHtml, elementToPdfBlob } from "./utils/myOrderPdfUtils";
import {
  mapOrderFromApi,
  getDaysRemaining,
  formatRemainingDaysText,
  isCloseToReturnDate,
  isOrderInUse,
  isReturnConfirmedSync,
  getOrderContracts,
  hasSignedContract,
  hasAnyContract,
  computeOrderTracking,
} from "./utils/myOrderHelpers";
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
import { sanitizeContractHtml } from "../../lib/contractPrintUtils";
import MyOrdersList from "./MyOrdersList.jsx";
import MyOrderDetailDrawer from "./MyOrderDetailDrawer.jsx";
import { useMyOrdersHandlers } from "./hooks/useMyOrdersHandlers";
import { useLocation } from "react-router-dom";

const { Title, Text } = Typography;


// All constants, utils, and helpers have been moved to separate files:
// - Constants: orderConstants.js
// - Utils: orderUtils.js
// - Handover PDF: handoverReportPrintUtils.js
// - Contract PDF: contractPdfUtils.js
// - Order helpers: ./utils/myOrderHelpers.js
// - PDF utils: ./utils/myOrderPdfUtils.js

/* =========================
 * COMPONENT
 * ========================= */
export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDataReady, setDetailDataReady] = useState(false); // True when all detail data loaded
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

  // Complaints state
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [creatingComplaint, setCreatingComplaint] = useState(false);

  // Extensions state (Gia hạn đơn thuê)
  const [orderExtensions, setOrderExtensions] = useState([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);

  // Annexes state (Phụ lục gia hạn hợp đồng)
  const [orderAnnexes, setOrderAnnexes] = useState([]);
  const [annexesLoading, setAnnexesLoading] = useState(false);
  const [annexDetail, setAnnexDetail] = useState(null);
  const [annexDetailOpen, setAnnexDetailOpen] = useState(false);
  const [annexPdfBlobUrl, setAnnexPdfBlobUrl] = useState("");
  const [annexPdfGenerating, setAnnexPdfGenerating] = useState(false);
  // Annex signing states
  const [annexSignModalOpen, setAnnexSignModalOpen] = useState(false);
  const [currentAnnexId, setCurrentAnnexId] = useState(null);
  const [currentAnnexContractId, setCurrentAnnexContractId] = useState(null);
  const [annexPinSent, setAnnexPinSent] = useState(false);
  const [signingAnnex, setSigningAnnex] = useState(false);
  const [annexSigning, setAnnexSigning] = useState(false);
  const [pendingExtensionPayment, setPendingExtensionPayment] = useState(null);
  const [annexSigningEmail, setAnnexSigningEmail] = useState(""); // Store email for modal display
  const [extensionPaymentModalOpen, setExtensionPaymentModalOpen] = useState(false);
  const [extensionPaymentMethod, setExtensionPaymentMethod] = useState("VNPAY");
  const [extensionTermsAccepted, setExtensionTermsAccepted] = useState(false);


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
    // Use planEndDate first, fallback to endDate
    const endDate = order?.planEndDate ?? order?.endDate;
    if (!endDate) return false;
    const daysRemaining = getDaysRemaining(endDate);
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
    // Extension statuses that should block (DRAFT, PROCESSING, COMPLETED)
    const blockingExtensionStatuses = ['DRAFT', 'PROCESSING', 'COMPLETED'];
    
    // Check if order has blocking extension
    const hasPendingExtension = (order) => {
      const extensions = order?.extensions || [];
      if (!Array.isArray(extensions)) return false;
      return extensions.some(ext => 
        blockingExtensionStatuses.includes(String(ext?.status || "").toUpperCase())
      );
    };
    
    // Check if order has any annex (any status blocks)
    const hasAnyAnnex = (order) => {
      const annexes = order?.annexes || [];
      return Array.isArray(annexes) && annexes.length > 0;
    };
    
    const checkCloseToReturn = () => {
      const closeOrders = orders.filter((order) =>
        isOrderInUse(order) &&
        isCloseToReturnDate(order) &&
        !isReturnConfirmedSync(order) &&
        !hasPendingExtension(order) &&  // Skip orders with blocking extensions
        !hasAnyAnnex(order)  // Skip orders with any annexes
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

  // PERFORMANCE OPTIMIZATION: Removed auto-generate PDF when reports first load
  // PDF will now generate only when user clicks on the handover/checkin tab
  // This prevents blocking the drawer from opening while PDF is being generated
  // useEffect(() => {
  //   if (checkoutReports.length > 0 && !selectedHandoverReport) {
  //     const firstReport = checkoutReports[0];
  //     setSelectedHandoverReport(firstReport);
  //     previewHandoverReportAsPdf(firstReport, { target: "handover" });
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [checkoutReports]);

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
  // Auto-select first report if none selected yet
  useEffect(() => {
    if (detailTab === "handover") {
      // Auto-select first report if none selected
      if (!selectedHandoverReport && checkoutReports.length > 0) {
        const firstReport = checkoutReports[0];
        setSelectedHandoverReport(firstReport);
        // Don't generate PDF yet, let the next condition handle it
        return;
      }
      
      // Generate PDF if report is selected but preview not available
      if (
        selectedHandoverReport &&
        !handoverPdfPreviewUrl &&
        !handoverPdfGenerating
      ) {
        previewHandoverReportAsPdf(selectedHandoverReport, {
          target: "handover",
          skipSelection: true,
        });
      }
    }
  }, [detailTab, selectedHandoverReport, handoverPdfPreviewUrl, handoverPdfGenerating, checkoutReports]);

  // Auto-select first checkin report if none selected when switching to checkin tab
  useEffect(() => {
    if (detailTab === "checkin") {
      // Auto-select first checkin report if none selected
      if (!selectedCheckinReport && checkinReports.length > 0) {
        const firstReport = checkinReports[0];
        setSelectedCheckinReport(firstReport);
        // Don't generate PDF yet, let the next condition handle it
        return;
      }
      
      // Generate PDF if report is selected but preview not available
      if (
        selectedCheckinReport &&
        !checkinPdfPreviewUrl &&
        !handoverPdfGenerating
      ) {
        previewHandoverReportAsPdf(selectedCheckinReport, {
          target: "checkin",
          skipSelection: true,
        });
      }
    }
  }, [detailTab, selectedCheckinReport, checkinPdfPreviewUrl, handoverPdfGenerating, checkinReports]);

  // REMOVED: Unnecessary reload on tab switch - reports already loaded when drawer opens
  // This was causing slow loading every time user switches to handover/checkin tab
  // const handoverTabRef = useRef(null);
  // useEffect(() => {
  //   if (current?.id && (detailTab === "handover" || detailTab === "checkin")) {
  //     const orderId = current.id;
  //     const previousTab = handoverTabRef.current;
  //     // Only reload if switching to this tab for the first time (not on every render)
  //     if (previousTab !== detailTab) {
  //       loadOrderHandoverReports(orderId);
  //     }
  //     handoverTabRef.current = detailTab;
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [detailTab, current?.id]);

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

  // NOTE: handlers = useMyOrdersHandlers(...) is called AFTER loadOrder* functions are defined (around line 1136)


  const showDetail = async (record) => {
    const idNum = Number(record?.id);
    if (!record || record.id == null || Number.isNaN(idNum)) {
      message.error("ID đơn hàng không hợp lệ để xem chi tiết.");
      return;
    }

    // Reset state and show loading
    clearContractPreviewState();
    setCurrent(record);
    setDetailTab("overview");
    setInvoiceInfo(null);

    // IMPORTANT: Reset ALL data states to prevent old tabs from showing
    setContracts([]);
    setSettlementInfo(null);
    setHandoverReports([]);
    setSelectedContract(null);
    setSelectedHandoverReport(null);
    setSelectedCheckinReport(null);

    // Set loading states
    setDetailDataReady(false);
    setContractsLoading(true);
    setSettlementLoading(true);
    setHandoverReportsLoading(true);
    setComplaintsLoading(true);
    setComplaints([]);

    // NOTE: Drawer opens AFTER data loads to prevent tab flickering

    try {
      // Load full order details first
      const fullOrder = await getRentalOrderById(idNum);
      if (fullOrder) {
        const mapped = await Promise.all([mapOrderFromApi(fullOrder)]);
        const merged = mapped[0];

        setCurrent((prev) => {
          const prevItems = Array.isArray(prev?.items) ? prev.items : [];
          const mergedItems = Array.isArray(merged?.items) ? merged.items : [];

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
        let invoice = null;
        if (Array.isArray(invoiceRes)) {
          invoice =
            invoiceRes.find(
              (inv) =>
                String(inv?.invoiceType || "").toUpperCase() === "RENT_PAYMENT"
            ) || invoiceRes[0] || null;
        } else {
          invoice = invoiceRes || null;
        }
        setInvoiceInfo(invoice);
      } catch (invoiceErr) {
        console.log("No invoice found for order:", idNum);
        setInvoiceInfo(null);
      }

      // Load all related data in PARALLEL for faster loading
      await Promise.all([
        loadOrderContracts(idNum),
        loadOrderSettlement(idNum),
        loadOrderHandoverReports(idNum),
        loadOrderComplaints(idNum)
      ]);

      // Load extensions from order data (sync - from record.extensions)
      loadOrderExtensions(record);

      // Mark data as fully loaded AND open drawer - all tabs appear at once
      setDetailDataReady(true);
      setDetailOpen(true);
    } catch (err) {
      console.error("Error loading order details:", err);
      setDetailDataReady(true);
      setDetailOpen(true); // Still open on error so user can see partial data
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

      // Load annexes for first signed contract
      const signedContract = orderContracts.find(c => {
        const status = String(c.status || "").toUpperCase();
        return status === "SIGNED" || status === "ACTIVE";
      });
      if (signedContract?.id) {
        loadOrderAnnexes(signedContract.id);
      } else {
        setOrderAnnexes([]);
      }
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

  // ========== COMPLAINTS ==========
  const loadOrderComplaints = async (orderId) => {
    if (!orderId) {
      setComplaints([]);
      return [];
    }
    try {
      setComplaintsLoading(true);
      const complaintsData = await getComplaintsByOrderId(orderId);
      const complaintsArray = Array.isArray(complaintsData) ? complaintsData : [];
      setComplaints(complaintsArray);
      return complaintsArray;
    } catch (e) {
      console.error("Failed to fetch complaints by orderId:", e);
      setComplaints([]);
      return [];
    } finally {
      setComplaintsLoading(false);
    }
  };

  const handleCreateComplaint = async ({ orderId, deviceId, customerDescription }) => {
    try {
      setCreatingComplaint(true);
      const result = await createComplaint({ orderId, deviceId, customerDescription });
      // Reload complaints after creating
      await loadOrderComplaints(orderId);
      return result;
    } catch (e) {
      console.error("Failed to create complaint:", e);
      throw e;
    } finally {
      setCreatingComplaint(false);
    }
  };

  const handleRefreshComplaints = async () => {
    if (current?.id) {
      await loadOrderComplaints(current.id);
    }
  };

  // ========== EXTENSIONS (Gia hạn đơn thuê) ==========
  const loadOrderExtensions = (order) => {
    const extensions = order?.extensions || [];
    setOrderExtensions(Array.isArray(extensions) ? extensions : []);
  };

  // ========== ANNEXES (Phụ lục gia hạn hợp đồng) ==========
  const loadOrderAnnexes = async (contractId) => {
    if (!contractId) {
      setOrderAnnexes([]);
      return;
    }
    try {
      setAnnexesLoading(true);
      const annexes = await getAnnexesByContractId(contractId);
      setOrderAnnexes(Array.isArray(annexes) ? annexes : []);
    } catch (e) {
      console.error("Failed to fetch annexes:", e);
      setOrderAnnexes([]);
    } finally {
      setAnnexesLoading(false);
    }
  };

  /** Format annexContent text - convert ISO dates and money values */
  const formatAnnexContent = (content) => {
    if (!content) return "";
    let formatted = content;
    formatted = formatted.replace(
      /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?/g,
      (match, year, month, day, hour, minute) => `${day}/${month}/${year} ${hour}:${minute}`
    );
    formatted = formatted.replace(
      /(\d+)(\.\d{2})?\s*VND/g,
      (match, amount) => {
        const num = parseInt(amount, 10);
        return num.toLocaleString("vi-VN") + " VNĐ";
      }
    );
    return formatted;
  };

  /** Build printable HTML for Annex */
  const buildPrintableAnnexHtml = (annex, customer = null) => {
    if (!annex) return "<div>Không có dữ liệu phụ lục</div>";
    const title = annex.title || "PHỤ LỤC GIA HẠN HỢP ĐỒNG THUÊ THIẾT BỊ";
    const annexNumber = annex.annexNumber || "";
    const contractNumber = annex.contractNumber || "";
    const customerName = customer?.fullName || customer?.name || `Khách hàng #${annex.originalOrderId || ""}`;
    const fmtDate = (d) => d ? dayjs(d).format("DD/MM/YYYY HH:mm") : "—";
    const fmtMoney = (v) => (v != null ? v.toLocaleString("vi-VN") + " ₫" : "0 ₫");
    const adminSigned = !!annex.adminSignedAt;
    const customerSigned = !!annex.customerSignedAt;

    return `
      <div style="width:794px;margin:0 auto;background:#fff;color:#111;font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;padding:32px 40px;box-sizing:border-box;">
        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:20px;font-weight:700;letter-spacing:.5px">${title}</div>
          <div style="color:#666;margin-top:4px">Số: ${annexNumber}</div>
        </div>
        <hr style="border:none;border-top:1px solid #e8e8e8;margin:12px 0 16px"/>
        <section style="background:#fafafa;padding:12px;border-radius:6px;margin-bottom:16px">
          <div><b>Căn cứ hợp đồng số:</b> ${contractNumber}</div>
          <div><b>Đơn hàng:</b> #${annex.originalOrderId || "—"}</div>
          <div><b>Bên A (Bên cho thuê):</b> CÔNG TY TECHRENT</div>
          <div><b>Bên B (Khách hàng):</b> ${customerName}</div>
        </section>
        <section style="margin:16px 0">
          <h3 style="font-size:14px;margin:12px 0 8px;text-transform:uppercase">Nội dung gia hạn</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5;width:40%"><b>Thời gian gia hạn</b></td><td style="padding:6px 8px;border:1px solid #ddd">${fmtDate(annex.extensionStartDate)} → ${fmtDate(annex.extensionEndDate)}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5"><b>Số ngày gia hạn</b></td><td style="padding:6px 8px;border:1px solid #ddd">${annex.extensionDays || 0} ngày</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5"><b>Phí gia hạn</b></td><td style="padding:6px 8px;border:1px solid #ddd">${fmtMoney(annex.extensionFee)}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5"><b>Tổng thanh toán</b></td><td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;color:#1890ff">${fmtMoney(annex.extensionFee)}</td></tr>
          </table>
        </section>
        ${annex.annexContent ? `
        <section style="margin:16px 0">
          <h3 style="font-size:14px;margin:12px 0 8px;text-transform:uppercase">Điều khoản phụ lục</h3>
          <div style="background:#fafafa;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:12px;line-height:1.7">${formatAnnexContent(annex.annexContent)}</div>
        </section>` : ""}
        <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN B</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">${customerSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}</div>
            <div>${customerSigned ? `<div style="color:#000;font-weight:600">${customerName}</div>` : "(Ký, ghi rõ họ tên)"}</div>
          </div>
          <div style="flex:1;text-align:center">
            <div><b>ĐẠI DIỆN BÊN A</b></div>
            <div style="height:72px;display:flex;align-items:center;justify-content:center">${adminSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}</div>
            <div>${adminSigned ? '<div style="color:#000;font-weight:600">CÔNG TY TECHRENT</div>' : "(Ký, ghi rõ họ tên)"}</div>
          </div>
        </section>
  
      </div>
    `;
  };

  /** Preview Annex as PDF */
  const previewAnnexAsPdf = async (annex) => {
    if (!annex) return message.warning("Chưa có dữ liệu phụ lục.");
    try {
      setAnnexPdfGenerating(true);
      if (annexPdfBlobUrl) {
        try { URL.revokeObjectURL(annexPdfBlobUrl); } catch (e) {}
      }
      const tempContainer = document.createElement("div");
      tempContainer.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;";
      tempContainer.innerHTML = buildPrintableAnnexHtml(annex, customerProfile);
      document.body.appendChild(tempContainer);
      try {
        // Use html2canvas + jsPDF
        const canvas = await import("html2canvas").then(m => m.default(tempContainer, { scale: 2, useCORS: true, allowTaint: true }));
        const imgData = canvas.toDataURL("image/png");
        const { default: jsPDF } = await import("jspdf");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        setAnnexPdfBlobUrl(url);
      } finally {
        document.body.removeChild(tempContainer);
      }
    } catch (e) {
      console.error(e);
      message.error("Không tạo được bản xem trước PDF phụ lục.");
    } finally {
      setAnnexPdfGenerating(false);
    }
  };

  // ========== ANNEX SIGNING HANDLERS ==========
  
  /** Open annex signing modal - similar to handleSignContract */
  const handleSignAnnex = async (annex) => {
    if (!annex || !annex.annexId) {
      message.error("ID phụ lục không hợp lệ");
      return;
    }
    
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
    
    // Find the matching extension for payment
    const matchingExtension = orderExtensions.find(ext => ext.extensionId === annex.extensionId);
    setPendingExtensionPayment(matchingExtension || null);
    
    // Store email for modal display
    setAnnexSigningEmail(profile.email || "");
    
    setCurrentAnnexId(annex.annexId);
    setCurrentAnnexContractId(annex.contractId);
    setAnnexSignModalOpen(true);
    setAnnexPinSent(false);
  };

  /** Send PIN for annex signing */
  const sendAnnexPin = async () => {
    if (!currentAnnexId || !currentAnnexContractId || !customerProfile?.email) {
      message.error("Không tìm thấy email để gửi mã PIN.");
      return;
    }
    
    try {
      setSigningAnnex(true);
      await sendAnnexPinEmail(currentAnnexContractId, currentAnnexId, customerProfile.email);
      message.success("Đã gửi mã PIN đến email của bạn!");
      setAnnexPinSent(true);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không gửi được mã PIN.");
    } finally {
      setSigningAnnex(false);
    }
  };

  /** Sign annex with PIN */
  const handleAnnexSign = async (values) => {
    if (!currentAnnexId || !currentAnnexContractId) {
      message.error("Không tìm thấy phụ lục để ký.");
      return;
    }
    
    try {
      setAnnexSigning(true);
      await signAnnexAsCustomer(currentAnnexContractId, currentAnnexId, {
        pinCode: values.pinCode,
        signatureMethod: "EMAIL_OTP",
      });
      
      message.success("Ký phụ lục thành công!");
      setAnnexSignModalOpen(false);
      setCurrentAnnexId(null);
      setCurrentAnnexContractId(null);
      setAnnexPinSent(false);
      
      // Reload annexes
      const signedContract = contracts.find(c => {
        const status = String(c.status || "").toUpperCase();
        return status === "SIGNED" || status === "ACTIVE";
      });
      if (signedContract?.id) {
        await loadOrderAnnexes(signedContract.id);
      }

      // If there's a pending extension payment, prompt for payment
      if (pendingExtensionPayment && pendingExtensionPayment.additionalPrice > 0) {
        Modal.confirm({
          title: "Thanh toán phí gia hạn",
          content: `Bạn đã ký phụ lục thành công. Vui lòng thanh toán phí gia hạn ${Number(pendingExtensionPayment.additionalPrice || 0).toLocaleString("vi-VN")} ₫ để hoàn tất.`,
          okText: "Thanh toán ngay",
          cancelText: "Để sau",
          onOk: () => confirmExtensionPayment(pendingExtensionPayment),
        });
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không thể ký phụ lục.");
    } finally {
      setAnnexSigning(false);
    }
  };

  /** Open modal to select payment method for extension */
  const confirmExtensionPayment = (extension) => {
    if (!extension || !current?.id) {
      message.error("Không có thông tin gia hạn để thanh toán.");
      return;
    }
    
    const additionalPrice = Number(extension.additionalPrice || extension.extensionFee || 0);
    if (additionalPrice <= 0) {
      message.warning("Không có phí gia hạn cần thanh toán.");
      return;
    }
    
    // Store pending extension payment and open modal
    setPendingExtensionPayment(extension);
    setExtensionPaymentMethod("VNPAY");
    setExtensionPaymentModalOpen(true);
  };

  /** Execute payment for extension with selected payment method */
  const executeExtensionPayment = async () => {
    const extension = pendingExtensionPayment;
    if (!extension || !current?.id) {
      message.error("Không có thông tin gia hạn để thanh toán.");
      return;
    }
    
    const additionalPrice = Number(extension.additionalPrice || extension.extensionFee || 0);
    
    try {
      setProcessingPayment(true);
      
      const baseUrl = window.location.origin;
      const orderIdParam = Number(current.id);
      const orderCodeParam = current.displayId || current.id;
      const cancelUrl = `${baseUrl}/payment/cancel?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
      const frontendSuccessUrl = `${baseUrl}/success?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
      const frontendFailureUrl = `${baseUrl}/failure?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;

      const payload = {
        orderId: orderIdParam,
        extensionId: extension.extensionId,  // Add extensionId required by backend
        invoiceType: "RENT_PAYMENT",
        paymentMethod: extensionPaymentMethod,
        amount: additionalPrice,
        description: `Thanh toán gia hạn đơn hàng #${orderCodeParam} - Extension #${extension.extensionId}`,
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
      console.error("Error creating extension payment:", error);
      message.error(error?.response?.data?.message || error?.message || "Không thể tạo thanh toán.");
    } finally {
      setProcessingPayment(false);
      setExtensionPaymentModalOpen(false);
      setPendingExtensionPayment(null);
    }
  };

  // ========== HANDLERS FROM HOOK ==========
  // Called here (after loadOrder* functions are defined) to avoid "can't access before initialization" error
  const handlers = useMyOrdersHandlers({
    // State values
    current,
    contracts,
    contractDetail,
    settlementInfo,
    extendedEndTime,
    contractCustomer,
    customerProfile,
    currentContractId,
    currentHandoverReportId,
    paymentOrder,
    paymentMethod,
    paymentTermsAccepted,
    selectedContract,
    pdfBlobUrl,
    contractPdfPreviewUrl,

    // State setters
    setCurrent,
    setProcessingReturn,
    setReturnModalOpen,
    setConfirmedReturnOrders,
    setDetailTab,
    setSettlementActionLoading,
    setProcessingExtend,
    setExtendModalOpen,
    setExtendedEndTime,
    setPdfGenerating,
    setCustomerProfile,
    setContractDetail,
    setContractDetailOpen,
    setLoadingContractDetail,
    setContractCustomer,
    setSignModalOpen,
    setCurrentContractId,
    setPinSent,
    setSigningContract,
    setSigning,
    setHandoverSignModalOpen,
    setCurrentHandoverReportId,
    setHandoverPinSent,
    setSigningHandover,
    setHandoverSigning,
    setPaymentModalOpen,
    setPaymentOrder,
    setPaymentMethod,
    setPaymentTermsAccepted,
    setProcessingPayment,
    setPdfModalOpen,
    setPdfBlobUrl,
    setPdfPreviewUrl,
    setContractPdfPreviewUrl,
    setSelectedContract,
    setHandoverPdfGenerating,

    // Refs
    handoverPrintRef,

    // Helper functions
    loadOrders,
    loadOrderSettlement,
    loadOrderContracts,
    loadOrderHandoverReports,
    loadAllContracts,
    revokeBlob,
    setOrderExtensions,
  });

  // Destructure all handlers for use
  const {
    handleConfirmReturn,
    handleRespondSettlement,
    handleExtendRequest,
    handleDownloadContract,
    handleSignHandoverReport,
    sendHandoverPin,
    handleSignHandover,
    handleDownloadHandoverPdf,
    viewContractDetail,
    handleSignContract,
    sendPin,
    handleSign,
    handlePayment,
    confirmCreatePayment,
    previewContractAsPdf,
    downloadContractAsPdf,
    previewContractAsPdfInline,
  } = handlers;


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

      // PERFORMANCE OPTIMIZATION: Same as previewHandoverReportAsPdf
      let order = null;
      let conditionDefinitions = [];

      const useCurrentOrder = current && current.id === report.orderId;
      
      const [fetchedOrder, fetchedConditions] = await Promise.all([
        useCurrentOrder 
          ? Promise.resolve(current)
          : (report.orderId 
              ? getRentalOrderById(report.orderId).catch(e => {
                  console.warn("Could not fetch order for PDF:", e);
                  return null;
                })
              : Promise.resolve(null)
            ),
        getConditionDefinitions().catch(e => {
          console.warn("Could not fetch condition definitions for PDF:", e);
          return [];
        })
      ]);

      order = fetchedOrder;
      conditionDefinitions = fetchedConditions;

      if (order && Array.isArray(order.orderDetails)) {
        const needsEnrichment = order.orderDetails.some(od => 
          od.deviceModelId && !od.deviceModel
        );
        
        if (needsEnrichment) {
          const modelIds = Array.from(new Set(
            order.orderDetails.map(od => od.deviceModelId).filter(Boolean)
          ));
          
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
              deviceModel: od.deviceModel || modelMap[od.deviceModelId] || null,
            })),
          };
        }
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
        // OPTIMIZATION: Reduced timeout from 500ms to 200ms
        await new Promise(resolve => setTimeout(resolve, 200));

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

      // PERFORMANCE OPTIMIZATION: Fetch order and condition definitions IN PARALLEL
      let order = null;
      let conditionDefinitions = [];

      // Use cached current order if available (avoid redundant API call)
      const useCurrentOrder = current && current.id === report.orderId;
      
      const [fetchedOrder, fetchedConditions] = await Promise.all([
        // Only fetch order if not already in current state
        useCurrentOrder 
          ? Promise.resolve(current)
          : (report.orderId 
              ? getRentalOrderById(report.orderId).catch(e => {
                  console.warn("Could not fetch order for PDF:", e);
                  return null;
                })
              : Promise.resolve(null)
            ),
        // Fetch condition definitions in parallel
        getConditionDefinitions().catch(e => {
          console.warn("Could not fetch condition definitions for PDF:", e);
          return [];
        })
      ]);

      order = fetchedOrder;
      conditionDefinitions = fetchedConditions;

      // Enrich order with device model info (only if not already enriched)
      if (order && Array.isArray(order.orderDetails)) {
        const needsEnrichment = order.orderDetails.some(od => 
          od.deviceModelId && !od.deviceModel
        );
        
        if (needsEnrichment) {
          const modelIds = Array.from(new Set(
            order.orderDetails
              .map(od => od.deviceModelId)
              .filter(Boolean)
          ));
          
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
              deviceModel: od.deviceModel || modelMap[od.deviceModelId] || null,
            })),
          };
        }
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
        // OPTIMIZATION: Reduced timeout from 500ms to 200ms
        await new Promise(resolve => setTimeout(resolve, 200));

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

  // handleDownloadHandoverPdf is now provided by useMyOrdersHandlers hook


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

      <MyOrderDetailDrawer
        // Core state
        current={current}
        detailOpen={detailOpen}
        setDetailOpen={setDetailOpen}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        detailDataReady={detailDataReady}

        // Contracts
        contracts={contracts}
        contractsLoading={contractsLoading}
        selectedContract={selectedContract}
        setSelectedContract={setSelectedContract}
        contractPdfPreviewUrl={contractPdfPreviewUrl}
        pdfGenerating={pdfGenerating}
        contractDetail={contractDetail}
        contractDetailOpen={contractDetailOpen}
        setContractDetailOpen={setContractDetailOpen}
        loadingContractDetail={loadingContractDetail}
        contractCustomer={contractCustomer}

        // Handover reports
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
        handoverPdfModalOpen={handoverPdfModalOpen}
        setHandoverPdfModalOpen={setHandoverPdfModalOpen}
        hasUnsignedCheckoutReports={hasUnsignedCheckoutReports}
        hasUnsignedCheckinReports={hasUnsignedCheckinReports}

        // Settlement
        settlementInfo={settlementInfo}
        settlementLoading={settlementLoading}
        settlementActionLoading={settlementActionLoading}

        // Invoice
        invoiceInfo={invoiceInfo}

        // Contract signing state
        signModalOpen={signModalOpen}
        setSignModalOpen={setSignModalOpen}
        currentContractId={currentContractId}
        setCurrentContractId={setCurrentContractId}
        pinSent={pinSent}
        setPinSent={setPinSent}
        signingContract={signingContract}
        signing={signing}
        customerProfile={customerProfile}

        // Handover signing state
        handoverSignModalOpen={handoverSignModalOpen}
        setHandoverSignModalOpen={setHandoverSignModalOpen}
        currentHandoverReportId={currentHandoverReportId}
        setCurrentHandoverReportId={setCurrentHandoverReportId}
        handoverPinSent={handoverPinSent}
        setHandoverPinSent={setHandoverPinSent}
        signingHandover={signingHandover}
        handoverSigning={handoverSigning}

        // Return/extend state
        returnModalOpen={returnModalOpen}
        setReturnModalOpen={setReturnModalOpen}
        extendModalOpen={extendModalOpen}
        setExtendModalOpen={setExtendModalOpen}
        extendedEndTime={extendedEndTime}
        setExtendedEndTime={setExtendedEndTime}
        processingReturn={processingReturn}
        processingExtend={processingExtend}

        // Payment state
        paymentModalOpen={paymentModalOpen}
        setPaymentModalOpen={setPaymentModalOpen}
        paymentOrder={paymentOrder}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentTermsAccepted={paymentTermsAccepted}
        setPaymentTermsAccepted={setPaymentTermsAccepted}
        processingPayment={processingPayment}
        pdfBlobUrl={pdfBlobUrl}
        pdfModalOpen={pdfModalOpen}
        setPdfModalOpen={setPdfModalOpen}
        pdfPreviewUrl={pdfPreviewUrl}

        // Computed values
        needsContractAction={needsContractAction}
        hasContracts={hasContracts}

        // Helpers & constants
        ORDER_STATUS_MAP={ORDER_STATUS_MAP}
        PAYMENT_STATUS_MAP={PAYMENT_STATUS_MAP}
        SETTLEMENT_STATUS_MAP={SETTLEMENT_STATUS_MAP}
        CONTRACT_STATUS_MAP={CONTRACT_STATUS_MAP}
        CONTRACT_TYPE_LABELS={CONTRACT_TYPE_LABELS}
        formatVND={formatVND}
        formatDateTime={formatDateTime}
        diffDays={diffDays}
        mapInvoiceStatusToPaymentStatus={mapInvoiceStatusToPaymentStatus}
        splitSettlementAmounts={splitSettlementAmounts}
        translateHandoverStatus={translateHandoverStatus}
        sanitizeContractHtml={sanitizeContractHtml}

        // Helper functions
        clearContractPreviewState={clearContractPreviewState}
        computeOrderTracking={computeOrderTracking}
        getDaysRemaining={getDaysRemaining}
        formatRemainingDaysText={formatRemainingDaysText}
        isCloseToReturnDate={isCloseToReturnDate}
        isOrderInUse={isOrderInUse}
        isReturnConfirmedSync={isReturnConfirmedSync}
        hasSignedContract={hasSignedContract}

        // Handlers
        handlePayment={handlePayment}
        handleDownloadContract={handleDownloadContract}
        handleSignContract={handleSignContract}
        previewContractAsPdfInline={previewContractAsPdfInline}
        loadOrderHandoverReports={loadOrderHandoverReports}
        previewHandoverReportAsPdf={previewHandoverReportAsPdf}
        handleDownloadHandoverPdf={handleDownloadHandoverPdf}
        handleSignHandoverReport={handleSignHandoverReport}
        handleRespondSettlement={handleRespondSettlement}
        handleConfirmReturn={handleConfirmReturn}
        handleExtendRequest={handleExtendRequest}
        confirmCreatePayment={confirmCreatePayment}
        sendPin={sendPin}
        handleSign={handleSign}
        sendHandoverPin={sendHandoverPin}
        handleSignHandover={handleSignHandover}
        printPdfUrl={printPdfUrl}
        downloadContractAsPdf={downloadContractAsPdf}

        // Complaints state
        complaints={complaints}
        complaintsLoading={complaintsLoading}
        creatingComplaint={creatingComplaint}
        onCreateComplaint={handleCreateComplaint}
        onRefreshComplaints={handleRefreshComplaints}

        // Refs
        handoverPrintRef={handoverPrintRef}

        // Extensions & Annexes
        orderExtensions={orderExtensions}
        extensionsLoading={extensionsLoading}
        orderAnnexes={orderAnnexes}
        annexesLoading={annexesLoading}
        annexDetail={annexDetail}
        setAnnexDetail={setAnnexDetail}
        annexDetailOpen={annexDetailOpen}
        setAnnexDetailOpen={setAnnexDetailOpen}
        annexPdfBlobUrl={annexPdfBlobUrl}
        annexPdfGenerating={annexPdfGenerating}
        previewAnnexAsPdf={previewAnnexAsPdf}
        // Annex signing props
        handleSignAnnex={handleSignAnnex}
        annexSignModalOpen={annexSignModalOpen}
        setAnnexSignModalOpen={setAnnexSignModalOpen}
        currentAnnexId={currentAnnexId}
        annexPinSent={annexPinSent}
        signingAnnex={signingAnnex}
        annexSigning={annexSigning}
        sendAnnexPin={sendAnnexPin}
        handleAnnexSign={handleAnnexSign}
        confirmExtensionPayment={confirmExtensionPayment}
        customerProfile={customerProfile}
        annexSigningEmail={annexSigningEmail}
      />

      {/* Extension Payment Modal */}
      <Modal
        title="Thanh toán gia hạn"
        open={extensionPaymentModalOpen}
        onCancel={() => {
          setExtensionPaymentModalOpen(false);
          setPendingExtensionPayment(null);
          setExtensionTermsAccepted(false);
        }}
        onOk={executeExtensionPayment}
        okText="Thanh toán"
        cancelText="Hủy"
        okButtonProps={{ disabled: !extensionTermsAccepted, loading: processingPayment }}
        confirmLoading={processingPayment}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Typography.Text>Phí gia hạn:</Typography.Text>
            <Typography.Text strong>
              {formatVND(Number(pendingExtensionPayment?.additionalPrice || pendingExtensionPayment?.extensionFee || 0))}
            </Typography.Text>
          </div>
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography.Text style={{ fontSize: 15, fontWeight: 600 }}>Tổng thanh toán</Typography.Text>
            <Typography.Text strong style={{ fontSize: 18 }}>
              {formatVND(Number(pendingExtensionPayment?.additionalPrice || pendingExtensionPayment?.extensionFee || 0))}
            </Typography.Text>
          </div>

          <div>
            <Typography.Text style={{ display: "block", marginBottom: 8 }}>Phương thức thanh toán</Typography.Text>
            <Radio.Group
              value={extensionPaymentMethod}
              onChange={(e) => setExtensionPaymentMethod(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="VNPAY">VNPay</Radio.Button>
              <Radio.Button value="PAYOS">PayOS</Radio.Button>
            </Radio.Group>
          </div>

          <Checkbox
            checked={extensionTermsAccepted}
            onChange={(e) => setExtensionTermsAccepted(e.target.checked)}
          >
            Tôi đồng ý với các{" "}
            <a
              href="https://www.techrent.website/api/admin/policies/5/file"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              điều khoản thanh toán
            </a>
          </Checkbox>
        </Space>
      </Modal>
    </>
  );
}
