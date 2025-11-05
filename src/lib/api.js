import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  // Dùng proxy Vite nếu không set env
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  // Nếu BE dùng cookie session -> bật true và cấu hình CORS Allow-Credentials:
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Log payment requests để debug
  if (config.url?.includes('/api/v1/payments') && config.method === 'post') {
    console.log("🔍 API Interceptor - Payment Request:");
    console.log("  URL:", config.url);
    console.log("  Method:", config.method);
    console.log("  Headers:", config.headers);
    if (config.data) {
      console.log("  Request Data:", config.data);
      console.log("  returnUrl:", config.data.returnUrl);
      console.log("  cancelUrl:", config.data.cancelUrl);
      // Validate
      if (config.data.returnUrl === "string" || config.data.cancelUrl === "string") {
        console.error("❌ ERROR: Interceptor detected 'string' placeholder in payload!");
      }
    }
  }
  
  return config;
});

api.interceptors.response.use(
  (res) => {
    // Log payment responses để debug
    if (res.config?.url?.includes('/api/v1/payments') && res.config?.method === 'post') {
      console.log("🔍 API Interceptor - Payment Response:");
      console.log("  Status:", res.status);
      console.log("  Response Data:", res.data);
      if (res.data?.data) {
        console.log("  Unwrapped Data:", res.data.data);
        if (res.data.data?.cancelUrl) {
          console.warn("⚠️ Backend returned cancelUrl in response:", res.data.data.cancelUrl);
        }
        if (res.data.data?.returnUrl) {
          console.warn("⚠️ Backend returned returnUrl in response:", res.data.data.returnUrl);
        }
      }
    }
    return res;
  },
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().logout(true);
    }
    // Log payment errors
    if (err?.config?.url?.includes('/api/v1/payments') && err?.config?.method === 'post') {
      console.error("❌ API Interceptor - Payment Error:");
      console.error("  Status:", err?.response?.status);
      console.error("  Error Data:", err?.response?.data);
      console.error("  Request Payload:", err?.config?.data);
    }
    return Promise.reject(err);
  }
);
