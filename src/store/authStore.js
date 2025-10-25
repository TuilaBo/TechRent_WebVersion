// src/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../lib/api";

const pickMsg = (e, fallback="Something went wrong") =>
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
          const { data } = await api.post(
            "/api/auth/verify-email",
            null,
            { params: { email, code } }
          );
          set({ loading: false });
          return data;
        } catch (e) {
          set({ loading: false, error: pickMsg(e, "Verify failed") });
          throw e;
        }
      },

      // ----- LOGIN: { usernameOrEmail, password } (giữ như đã làm)
      login: async ({ usernameOrEmail, password }) => {
        set({ loading: true, error: null });
        try {
          const { data } = await api.post("/api/auth/login", {
            usernameOrEmail,
            password,
          });
          const accessToken =
            data?.accessToken || data?.token || data?.jwt || data?.data?.token;
          const user = data?.user ?? data?.data?.user ?? null;
          set({ token: accessToken, user, loading: false });
          return data;
        } catch (e) {
          set({ loading: false, error: pickMsg(e, "Login failed") });
          throw e;
        }
      },

      fetchMe: async () => {
        const token = get().token;
        if (!token) return null;
        set({ loading: true, error: null });
        try {
          const { data } = await api.get("/api/auth/me");
          set({ user: data, loading: false });
          return data;
        } catch (e) {
          set({ loading: false, error: pickMsg(e) });
          get().logout(true);
          return null;
        }
      },

      logout: (silent=false) => {
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
