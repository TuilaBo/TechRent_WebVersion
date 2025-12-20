// src/lib/dashBoard.js
import { api } from "./api";

const BASE_URL = "/api/admin/dashboard";

/**
 * Get orders status statistics
 * Thống kê đơn hàng theo trạng thái / hủy
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required)
 * @param {number} params.month - Month (required)
 * @returns {Promise} Orders status statistics
 */
export const getOrdersStatus = async (params = {}) => {
  const response = await api.get(`${BASE_URL}/orders-status`, { params });
  return response.data;
};

/**
 * Get new customers count
 * Số khách hàng đăng ký mới
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required)
 * @param {number} params.month - Month (required)
 * @returns {Promise} New customers count
 */
export const getNewCustomers = async (params = {}) => {
  const response = await api.get(`${BASE_URL}/new-customers`, { params });
  return response.data;
};

/**
 * Get device incidents
 * Thiết bị hư hỏng / mất, mất trong tháng
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required)
 * @param {number} params.month - Month (required)
 * @returns {Promise} Device incidents statistics
 */
export const getDeviceIncidents = async (params = {}) => {
  const response = await api.get(`${BASE_URL}/device-incidents`, { params });
  return response.data;
};

/**
 * Get device imports by category
 * Số thiết bị nhập theo category
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required)
 * @param {number} params.month - Month (required)
 * @returns {Promise} Device imports by category
 */
export const getDeviceImportsByCategory = async (params = {}) => {
  const response = await api.get(`${BASE_URL}/device-imports-by-category`, { params });
  return response.data;
};

/**
 * Get damages statistics
 * Thống kê thiết hại
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required)
 * @param {number} params.month - Month (required)
 * @returns {Promise} Damages statistics
 */
export const getDamages = async (params = {}) => {
  const response = await api.get(`${BASE_URL}/damages`, { params });
  return response.data;
};

/**
 * Get all dashboard statistics
 * Lấy tất cả thống kê dashboard trong một lần gọi
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required)
 * @param {number} params.month - Month (required)
 * @returns {Promise} Object containing all dashboard statistics
 */
export const getAllDashboardStats = async (params = {}) => {
  try {
    const [
      ordersStatus,
      newCustomers,
      deviceIncidents,
      deviceImportsByCategory,
      damages,
    ] = await Promise.all([
      getOrdersStatus(params),
      getNewCustomers(params),
      getDeviceIncidents(params),
      getDeviceImportsByCategory(params),
      getDamages(params),
    ]);

    return {
      ordersStatus,
      newCustomers,
      deviceIncidents,
      deviceImportsByCategory,
      damages,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
};
