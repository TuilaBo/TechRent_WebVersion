/**
 * Pure helper functions for MyOrders
 * Extracted from MyOrders.jsx to reduce file size
 */
import { diffDays } from "../../../lib/orderUtils";
import { ORDER_STATUS_ALIASES } from "../../../lib/orderConstants";

/**
 * Map order from API response to normalized format
 */
export function mapOrderFromApi(order) {
    const backendId =
        order?.id || order?.rentalOrderId || order?.orderId || order?.rentalId || null;

    const displayId =
        order?.rentalOrderCode || order?.orderCode || order?.code ||
        (backendId != null ? String(backendId) : "—");

    // Simplified: only use data from orderDetails, no API calls
    const items = (order?.orderDetails || []).map((detail) => {
        const deviceValue = Number(detail?.deviceValue ?? 0);
        const depositPercent = Number(detail?.depositPercent ?? 0);
        const depositAmountPerUnit = Number(
            detail?.depositAmountPerUnit ?? deviceValue * depositPercent
        );

        // Get name and image from deviceModel or detail
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
        startDate,
        endDate,
        days: normalizedDays,
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

/**
 * Calculate days remaining until return date
 */
const DAY_MS = 1000 * 60 * 60 * 24;
export function getDaysRemaining(endDate) {
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
}

/**
 * Format remaining days as text
 */
export function formatRemainingDaysText(daysRemaining) {
    if (daysRemaining === null) return "—";
    if (daysRemaining < 0) return "Đã quá hạn";
    if (daysRemaining === 0) return "Hết hạn hôm nay";
    if (daysRemaining <= 1) return "Còn 1 ngày";
    return `Còn ${daysRemaining} ngày`;
}

/**
 * Check if order is close to return date (less than 1 day)
 */
export function isCloseToReturnDate(order) {
    if (!order?.endDate) return false;
    const daysRemaining = getDaysRemaining(order.endDate);
    return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 1;
}

/**
 * Check if order is currently in use
 */
export function isOrderInUse(order) {
    if (!order) return false;
    const status = String(order?.orderStatus || "").toLowerCase();
    return status === "in_use";
}

/**
 * Synchronous check if return is confirmed (uses cached state)
 */
export function isReturnConfirmedSync(order, confirmedReturnOrders) {
    if (!order) return false;
    const orderId = order?.id || order?.orderId || order?.rentalOrderId;

    // Check if we've tracked this order as confirmed
    if (orderId && confirmedReturnOrders?.has(orderId)) {
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
}

/**
 * Get contracts for a specific order
 */
export function getOrderContracts(orderId, contractsList = []) {
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
}

/**
 * Check if order has a signed contract
 */
export function hasSignedContract(orderId, contractsList = []) {
    const orderContracts = getOrderContracts(orderId, contractsList);
    if (!orderContracts.length) return false;
    return orderContracts.some((c) => {
        const status = String(c.status || "").toUpperCase();
        return status === "SIGNED" || status === "ACTIVE";
    });
}

/**
 * Check if order has any contract
 */
export function hasAnyContract(orderId, contractsList = []) {
    return getOrderContracts(orderId, contractsList).length > 0;
}

/**
 * Compute order tracking progress for Steps component
 */
export function computeOrderTracking(order, contracts, invoiceInfo = null, mapInvoiceStatusToPaymentStatus) {
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
    if (isCompleted) current = 5;
    else if (isDelivered) current = 4;
    else if (isReady) current = 3;
    else if (isContractPending || (!isPaid && (isQcDone || contract))) current = 2;
    else if (isQcDone) current = 1;
    else current = 0;

    const steps = [
        { title: "Tạo đơn hàng thành công" },
        { title: "QC,KYC trước thuê thành công" },
        { title: "Ký hợp đồng & Thanh toán" },
        { title: "Sẵn sàng giao hàng" },
        { title: "Giao hàng thành công" },
        { title: "Trả hàng và hoàn cọc thành công" },
    ];

    return { current, steps };
}
