import { api } from "./api";

/**
 * Lấy tất cả lịch bảo trì đang hoạt động
 * @returns {Promise} Danh sách lịch bảo trì
 */
export const getActiveMaintenanceSchedules = async () => {
    const { data } = await api.get("/api/maintenance/schedules/active");
    return data;
};

/**
 * Lấy chi tiết một lịch bảo trì
 * @param {number} scheduleId - ID của lịch bảo trì
 * @returns {Promise} Chi tiết lịch bảo trì
 */
export const getMaintenanceScheduleById = async (scheduleId) => {
    const { data } = await api.get(`/api/maintenance/schedules/${scheduleId}`);
    return data;
};

/**
 * Tạo lịch bảo trì theo device category
 * @param {Object} scheduleData - Dữ liệu lịch bảo trì
 * @param {number} scheduleData.categoryId - ID của device category
 * @param {string} scheduleData.startDate - Ngày bắt đầu (YYYY-MM-DD)
 * @param {string} scheduleData.endDate - Ngày kết thúc (YYYY-MM-DD)
 * @param {number} scheduleData.durationDays - Số ngày bảo trì
 * @param {string} scheduleData.status - Trạng thái (SCHEDULED, IN_PROGRESS, etc.)
 * @returns {Promise} Kết quả tạo lịch
 */
export const createMaintenanceScheduleByCategory = async (scheduleData) => {
    const { data } = await api.post("/api/maintenance/schedules/by-category", scheduleData);
    return data;
};

/**
 * Lấy tất cả lịch bảo trì của một thiết bị
 * @param {number} deviceId - ID của thiết bị
 * @returns {Promise} Danh sách lịch bảo trì theo thiết bị
 */
export const getMaintenanceSchedulesByDevice = async (deviceId) => {
    const { data } = await api.get(`/api/maintenance/schedules?deviceId=${deviceId}`);
    return data;
};

/**
 * Tạo lịch bảo trì theo thiết bị cụ thể
 * @param {Object} scheduleData - Dữ liệu lịch bảo trì
 * @param {number} scheduleData.deviceId - ID của thiết bị
 * @param {string} scheduleData.startDate - Ngày bắt đầu (YYYY-MM-DD)
 * @param {string} scheduleData.endDate - Ngày kết thúc (YYYY-MM-DD)
 * @param {string} scheduleData.status - Trạng thái (STARTED, DELAYED, etc.)
 * @returns {Promise} Kết quả tạo lịch
 */
export const createMaintenanceScheduleByDevice = async (scheduleData) => {
    const { data } = await api.post("/api/maintenance/schedules", scheduleData);
    return data;
};

/**
 * Lấy danh sách thiết bị đang bảo trì ưu tiên (cho technician)
 * @returns {Promise} Danh sách thiết bị đang bảo trì
 */
export const getPriorityMaintenanceSchedules = async () => {
    const { data } = await api.get("/api/maintenance/schedules/priority");
    return data;
};
