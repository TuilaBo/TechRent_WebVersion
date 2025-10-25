// src/pages/auth/OtpVerify.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Typography, message, Alert } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
const { Title, Text } = Typography;
const DIGITS = 6;
const RESEND_SECONDS = 30;

export default function OtpVerify() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email || "";

  const { verifyEmail, resendVerification, loading, error, clearError } = useAuth();

  const [values, setValues] = useState(Array(DIGITS).fill(""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const code = useMemo(() => values.join(""), [values]);
  const canSubmit = /^\d{6}$/.test(code);

  const focusAt = (i) => inputsRef.current[i]?.focus();
  const handleChange = (i, v) => {
    clearError();
    const char = v.replace(/\D/g, "").slice(-1);
    setValues((prev) => { const c = [...prev]; c[i] = char || ""; return c; });
    if (char && i < DIGITS - 1) focusAt(i + 1);
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, DIGITS);
    if (!text) return;
    e.preventDefault();
    const spread = text.split("");
    setValues((prev) => spread.concat(Array(DIGITS).fill("")).slice(0, DIGITS));
    focusAt(Math.min(spread.length - 1, DIGITS - 1));
  };

  const resend = async () => {
    if (!email) return toast("Thiếu email, vui lòng đăng ký lại.");
    try {
      await resendVerification({ email }); // POST ?email=...
      setSeconds(RESEND_SECONDS);
      toast.success("Đã gửi lại mã OTP.");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Gửi lại mã thất bại");
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (!email) return toast("Thiếu email để xác thực.");
    try {
      await verifyEmail({ email, code }); // POST ?email=...&code=...
      toast.success("Xác thực thành công! Hãy đăng nhập.");
      navigate("/login");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Xác thực thất bại");
    }
  };

  const boxStyle = { width: 44, height: 44, borderRadius: 8, border: "1px solid #E5E7EB", textAlign: "center", fontSize: 18 };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FAFAFA", padding: 16 }}>
      <div style={{ width: 360, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", padding: 24, textAlign: "center" }}>
        <Title level={4} style={{ marginBottom: 4 }}>Xác minh email</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          {email ? <>Mã OTP đã gửi tới <span style={{ color: "#111827" }}>{email}</span></> : <>Không tìm thấy email. Hãy quay lại đăng ký.</>}
        </Text>

        {error && <Alert type="error" message={error} showIcon className="mb-3" />}

        <div onPaste={handlePaste} style={{ display: "flex", gap: 8, justifyContent: "center", margin: "0 auto 16px" }}>
          {values.map((val, i) => (
            <input key={i} ref={(el) => (inputsRef.current[i] = el)} value={val}
              inputMode="numeric" maxLength={1} onChange={(e) => handleChange(i, e.target.value)}
              style={boxStyle} />
          ))}
        </div>

        <Button type="primary" block size="large" disabled={!canSubmit || loading} loading={loading} onClick={submit}
          style={{ background: "#111827", borderColor: "#111827", marginBottom: 8 }}>
          Xác minh
        </Button>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span>Gửi lại mã sau: <strong>00:{String(seconds).padStart(2, "0")}</strong></span>
          {seconds === 0 ? (
            <button onClick={resend} style={{ background: "transparent", border: 0, textDecoration: "underline", cursor: "pointer" }}>
              Gửi lại mã
            </button>
          ) : (
            <span style={{ opacity: 0.6 }}>Gửi lại mã</span>
          )}
        </div>

        <div style={{ marginTop: 8, fontSize: 12 }}>
          <Link to="/register">Đổi email</Link>
        </div>
      </div>
    </div>
  );
}
