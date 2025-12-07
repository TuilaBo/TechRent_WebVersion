import dayjs from "dayjs";
import {
    TECH_TASK_STATUS,
} from "../../../lib/technicianTaskApi";

export const TYPES = {
    QC: { color: "blue", label: "CHECK QC outbound" },
    HANDOVER_CHECK: { color: "geekblue", label: "CHECK BIÊN BẢN" },
    MAINTAIN: { color: "orange", label: "BẢO TRÌ THIẾT BỊ" },
    DELIVERY: { color: "green", label: "ĐI GIAO THIẾT BỊ" },
};

// Helper để map maintenance status từ API sang Badge status
export const getMaintenanceBadgeStatus = (schedule, isInactive = false) => {
    if (!schedule) return "default";
    if (isInactive || schedule.isInactive) return "error"; // Grey/Red for inactive

    const status = String(schedule.status || "").toUpperCase();
    const today = dayjs().startOf('day');
    const start = dayjs(schedule.nextMaintenanceDate || schedule.startDate).startOf('day');
    const end = schedule.nextMaintenanceEndDate || schedule.endDate ? dayjs(schedule.nextMaintenanceEndDate || schedule.endDate).endOf('day') : start.endOf('day');

    if (status === "COMPLETED") return "success";
    if (status === "IN_PROGRESS" || status === "PROCESSING") return "processing";
    if (status === "FAILED" || status === "CANCELLED") return "error";

    // If PENDING or SCHEDULED
    if (dayjs().isAfter(end)) return "error"; // Quá hạn
    if (dayjs().isSame(start, 'day') || dayjs().isBetween(start, end, 'day', '[]')) return "warning"; // Đến hạn

    return "default"; // Chưa đến hạn
};

// Map BE task to display fields used by the calendar UI
export const taskToDisplay = (t) => {
    return {
        ...t,
        title: t.taskName || t.title || t.description || "Công việc",
        date: t.plannedStart ? dayjs(t.plannedStart) : dayjs(t.createdAt),
        status: t.status,
        type: t.type || "TASK", // 'QC', 'DELIVERY', 'MAINTAIN', etc.
        id: t.taskId || t.id,
        // ... map other fields
    };
};

export const fmtStatus = (s) => {
    const status = String(s || "").toUpperCase();
    return TECH_TASK_STATUS[status]?.label || status;
};

// Format thời gian nhất quán
export const fmtDateTime = (date) => {
    if (!date) return "—";
    try {
        return dayjs(date).format("DD/MM/YYYY HH:mm");
    } catch {
        return date;
    }
};

export const formatDateTime = (iso) => {
    if (!iso) return "—";
    try {
        return dayjs(iso).format("DD/MM/YYYY HH:mm");
    } catch {
        return iso;
    }
}

// Dịch status đơn hàng
export const fmtOrderStatus = (s) => {
    const status = String(s || "").toUpperCase();
    const map = {
        PENDING: "Chờ duyệt",
        CONFIRMED: "Đã xác nhận",
        DEPOSIT_PENDING: "Chờ cọc",
        PAID: "Đã thanh toán",
        PREPARING: "Đang chuẩn bị",
        DELIVERING: "Đang giao",
        DELIVERED: "Đã giao",
        RENTING: "Đang thuê",
        OVERDUE: "Quá hạn",
        RETURNING: "Đang trả",
        RETURNED: "Đã trả",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy",
        DRAFT: "Nháp",
    };
    return map[status] || status;
};

/** Kiểm tra xem task có phải là Pre rental QC không */
export const isPreRentalQC = (task) => {
    if (!task) return false;
    const categoryName = String(task.taskCategoryName || "").toUpperCase();
    const type = String(task.type || "").toUpperCase();

    // Kiểm tra taskCategoryName: "Pre rental QC", "PRE_RENTAL_QC", etc.
    if (categoryName.includes("PRE") && categoryName.includes("RENTAL") && categoryName.includes("QC")) {
        return true;
    }

    // Kiểm tra type: "PRE_RENTAL_QC", "Pre rental QC", etc.
    if (type.includes("PRE_RENTAL_QC") || (type.includes("PRE") && type.includes("RENTAL") && type.includes("QC"))) {
        return true;
    }

    return false;
};

/** Kiểm tra xem task có phải là Post rental QC không */
export const isPostRentalQC = (task) => {
    if (!task) return false;
    const categoryName = String(task.taskCategoryName || "").toUpperCase();
    const type = String(task.type || "").toUpperCase();

    // Kiểm tra taskCategoryName: "Post rental QC", "POST_RENTAL_QC", etc.
    if (categoryName.includes("POST") && categoryName.includes("RENTAL") && categoryName.includes("QC")) {
        return true;
    }

    // Kiểm tra type: "POST_RENTAL_QC", "Post rental QC", etc.
    if (type.includes("POST_RENTAL_QC") || (type.includes("POST") && type.includes("RENTAL") && type.includes("QC"))) {
        return true;
    }

    return false;
};

/** Kiểm tra xem task có phải là PickUp/Retrieval không */
export const isPickupTask = (task) => {
    if (!task) return false;
    const categoryName = String(task.taskCategoryName || "").toUpperCase();
    const type = String(task.type || "").toUpperCase();
    const description = String(task.description || "").toUpperCase();

    // Kiểm tra type: "PICKUP", "PICK UP", "RETURN", "RETRIEVAL", etc.
    if (type.includes("PICKUP") || type.includes("PICK UP") || type.includes("RETURN") || type.includes("RETRIEVAL")) {
        return true;
    }

    // Kiểm tra categoryName: "PICK UP RENTAL ORDER", "PICKUP", etc.
    if (categoryName.includes("PICKUP") || categoryName.includes("PICK UP") || categoryName.includes("RETURN") || categoryName.includes("RETRIEVAL")) {
        return true;
    }

    // Kiểm tra description
    if (description.includes("THU HỒI") || description.includes("TRẢ HÀNG") || description.includes("PICKUP") || description.includes("PICK UP")) {
        return true;
    }

    return false;
};

export const parseInfoString = (infoStr) => {
    if (!infoStr) return {};
    try {
        const parts = infoStr.split("|").map((s) => s.trim());
        const res = {};
        parts.forEach((p) => {
            const [k, v] = p.split(":").map((s) => s.trim());
            if (k && v) res[k] = v;
        });
        return res;
    } catch {
        return {};
    }
};

export const translateRole = (role) => {
    const r = String(role || "").toUpperCase();
    const map = {
        ADMIN: "Quản trị viên",
        MANAGER: "Quản lý",
        TECHNICIAN: "Kỹ thuật viên",
        SALE: "Nhân viên kinh doanh",
        CUSTOMER: "Khách hàng",
    };
    return map[r] || role;
};

export const translateHandoverStatus = (status) => {
    const s = String(status || "").toUpperCase();
    const map = {
        DRAFT: "Nháp",
        PENDING: "Chờ ký",
        PENDING_STAFF_SIGNATURE: "Chờ nhân viên ký",
        STAFF_SIGNED: "Nhân viên đã ký",
        CUSTOMER_SIGNED: "Đã ký khách hàng",
        BOTH_SIGNED: "2 bên đã ký",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy",
    };
    return map[s] || status;
};

// --- Calendar Logic ---
export const getCalendarData = (value, tasksAll = [], prioritySchedules = [], inactiveSchedules = []) => {
    if (!value) return { tasks: [], maintenance: [], inactive: [] };

    // Filter tasks
    const dayTasks = tasksAll.filter(t => {
        const start = t.plannedStart ? dayjs(t.plannedStart) : dayjs(t.date);
        return start.isSame(value, 'day');
    });

    // Filter Active/Priority Maintenance
    const dayMaintenance = prioritySchedules.filter(s => {
        const startStr = s.nextMaintenanceDate || s.startDate;
        const endStr = s.nextMaintenanceEndDate || s.endDate;

        if (!startStr) return false;

        const start = dayjs(startStr);
        const end = endStr ? dayjs(endStr) : start;
        return value.isBetween(start, end, 'day', '[]');
    });

    // Filter Inactive Maintenance
    const dayInactive = inactiveSchedules.filter(s => {
        const startStr = s.nextMaintenanceDate || s.startDate;
        const endStr = s.nextMaintenanceEndDate || s.endDate;

        if (!startStr) return false;

        const start = dayjs(startStr);
        const end = endStr ? dayjs(endStr) : start;
        return value.isBetween(start, end, 'day', '[]');
    });

    return { tasks: dayTasks, maintenance: dayMaintenance, inactive: dayInactive };
};

