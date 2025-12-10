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
        loadOrderHandoverReports(idNum)
      ]);

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

        // Refs
        handoverPrintRef={handoverPrintRef}
      />
    </>
  );
}
