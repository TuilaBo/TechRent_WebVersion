// src/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../lib/api";

const pickMsg = (e, fallback = "Something went wrong") =>
  e?.response?.data?.message || e?.message || fallback;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      clearError: () => set({ error: null }),

      // ----- REGISTER: {username, password, email, phoneNumber}
      register: async ({ username, password, email, phoneNumber }) => {
        set({ loading: true, error: null });
        try {
          const { data } = await api.post("/api/auth/register", {
            username,
            password,
            email,
            phoneNumber,
          });
          set({ loading: false });
          return data;
        } catch (e) {
          set({ loading: false, error: pickMsg(e, "Register failed") });
          throw e;
        }
      },

      // ----- RESEND: POST .../resend-verification?email=...
      resendVerification: async ({ email }) => {
        set({ loading: true, error: null });
        try {
          const { data } = await api.post(
            "/api/auth/resend-verification",
            null,
            { params: { email } }
          );
          set({ loading: false });
          return data;
        } catch (e) {
          set({ loading: false, error: pickMsg(e, "Resend email failed") });
          throw e;
        }
      },

      // ----- VERIFY: POST .../verify-email?email=...&code=...
      verifyEmail: async ({ email, code }) => {
        set({ loading: true, error: null });
        try {
          const { data } = await api.post("/api/auth/verify-email", null, {
            params: { email, code },
          });
          set({ loading: false });
          return data;
        } catch (e) {
          set({ loading: false, error: pickMsg(e, "Verify failed") });
          throw e;
        }
      },

      // ----- LOGIN: { usernameOrEmail, password } (giữ như đã làm)
      // src/store/authStore.js
      login: async ({ usernameOrEmail, password }) => {
        // 🔴 dọn phiên cũ ngay
        set({ loading: true, error: null, token: null, user: null });

        try {
          const { data, headers } = await api.post("/api/auth/login", {
            usernameOrEmail,
            password,
          });

          // ✅ cố gắng lấy token theo nhiều đường (tuỳ BE)
          const accessToken =
            data?.accessToken ||
            data?.token ||
            data?.jwt ||
            data?.data?.accessToken ||
            data?.data?.token ||
            headers?.authorization?.replace(/^Bearer\s+/i, "");

          if (!accessToken) {
            // không có token -> dừng, tránh giữ token cũ
            throw new Error("Không nhận được access token từ máy chủ.");
          }

          set({ token: accessToken, user: null, loading: false });

          // 🔁 nạp thông tin tài khoản mới ngay
          await get().fetchMe();
          return data;
        } catch (e) {
          set({
            loading: false,
            error: pickMsg(e, "Login failed"),
            token: null,
            user: null,
          });
          throw e;
        }
      },

      fetchMe: async () => {
        const token = get().token;
        if (!token) return null;
        set({ loading: true, error: null });
        try {
          const { data } = await api.get("/api/auth/me");
          const user = data?.data || data;
          set({ user, loading: false });
          return user;
        } catch (e) {
          set({ loading: false, error: pickMsg(e) });
          get().logout(true);
          return null;
        }
      },

      logout: (silent = false) => {
        set({ user: null, token: null });
        if (!silent) set({ error: null });
      },
    }),
    {
      name: "techrent-auth",
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
);
