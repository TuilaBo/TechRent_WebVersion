// src/pages/auth/OtpVerify.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Typography, Alert } from "antd";
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
    setValues((list) => { const c = [...list]; c[i] = char || ""; return c; });
    if (char && i < DIGITS - 1) focusAt(i + 1);
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, DIGITS);
    if (!text) return;
    e.preventDefault();
    const spread = text.split("");
    setValues(() => spread.concat(Array(DIGITS).fill("")).slice(0, DIGITS));
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
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #fafafa 0%, #e5e7eb 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <style>{`
        .login-card { 
          border-radius: 24px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15) !important;
          border: none !important;
          overflow: hidden;
          backdrop-filter: blur(10px);
          max-width: 400px; width: 100%;
        }
        .login-input { 
          border-radius: 12px !important;
          border: 2px solid #e5e7eb !important;
        }
        .login-btn { height: 48px !important; border-radius: 12px !important; font-weight: 600 !important; font-size: 15px !important; }
        .login-btn-primary { background: linear-gradient(135deg, #111111 0%, #374151 100%) !important; border: 1px solid #111111 !important; color: #ffffff !important; }
      `}</style>
      <div className="login-card" style={{ background: "#fff" }}>
        <div style={{ padding: "28px 24px", textAlign: "center" }}>
          <div style={{ color: "#111", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>TECHRENT</div>
          <Title level={4} style={{ marginBottom: 4, fontSize: 22 }}>Xác minh email</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 16, color: "#6b7280", fontSize: 14 }}>
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
            className="login-btn login-btn-primary" style={{ marginBottom: 8 }}>
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
            <Link to="/register" className="login-link">Đổi email</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
