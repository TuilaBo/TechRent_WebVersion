// src/pages/auth/OtpVerify.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Typography } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const DIGITS = 6;
const RESEND_SECONDS = 30;

export default function OtpVerify() {
  const navigate = useNavigate();
  const { state } = useLocation(); // truyền { email } từ trang đăng ký nếu có
  const email = state?.email || "trong***@example.com";

  const [values, setValues] = useState(Array(DIGITS).fill(""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const inputsRef = useRef([]);

  // Countdown resend
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const code = useMemo(() => values.join(""), [values]);
  const canSubmit = code.length === DIGITS && /^\d{6}$/.test(code);

  const focusAt = (i) => inputsRef.current[i]?.focus();

  const handleChange = (i, v) => {
    const char = v.replace(/\D/g, "").slice(-1); // chỉ 1 số
    setValues((prev) => {
      const copy = [...prev];
      copy[i] = char || "";
      return copy;
    });
    if (char && i < DIGITS - 1) focusAt(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (!values[i] && i > 0) focusAt(i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight" && i < DIGITS - 1) {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, DIGITS);
    if (!text) return;
    e.preventDefault();
    const spread = text.split("");
    setValues((prev) => {
      const copy = [...prev];
      for (let i = 0; i < DIGITS; i++) copy[i] = spread[i] || "";
      return copy;
    });
    const lastFilled = Math.min(spread.length - 1, DIGITS - 1);
    if (lastFilled >= 0) focusAt(lastFilled);
  };

  const resend = () => {
    // TODO: Call API gửi lại mã
    setSeconds(RESEND_SECONDS);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // TODO: Verify OTP với `code`
      await new Promise((r) => setTimeout(r, 700));
      navigate("/");
    } finally {
      setSubmitting(false);
    }
  };

  // style chung cho ô
  const boxStyle = {
    width: 44,
    height: 44,
    borderRadius: 8,
    border: "1px solid #E5E7EB",
    background: "#fff",
    textAlign: "center",
    fontSize: 18,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#FAFAFA",
        padding: 16,
      }}
    >
      <div
        role="form"
        aria-label="Xác minh email bằng mã OTP"
        style={{
          width: 360,
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <Title level={4} style={{ marginBottom: 4, color: "#111827" }}>
          Xác minh email
        </Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          <span style={{ color: "#111827" }}>{email}</span>
          <br />
          Chúng tôi đã gửi mã {DIGITS} số tới email của bạn.
        </Text>

        {/* OTP boxes — dùng flex + fixed width để không vỡ layout */}
        <div
          onPaste={handlePaste}
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            alignItems: "center",
            margin: "0 auto 16px",
            maxWidth: 44 * DIGITS + 8 * (DIGITS - 1), // chống tràn ra ngoài
          }}
        >
          {values.map((val, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={`OTP số thứ ${i + 1}`}
              value={val}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => (e.target.style.borderColor = "#111827")}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              maxLength={1}
              style={boxStyle}
            />
          ))}
        </div>

        <Button
          type="primary"
          block
          size="large"
          disabled={!canSubmit}
          loading={submitting}
          onClick={submit}
          style={{
            background: "#111827",
            borderColor: "#111827",
            marginBottom: 8,
          }}
        >
          Xác minh
        </Button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          <span>
            Gửi lại mã sau:{" "}
            <strong style={{ color: "#111827" }}>
              00:{String(seconds).padStart(2, "0")}
            </strong>
          </span>
          {seconds === 0 ? (
            <button
              onClick={resend}
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                color: "#111827",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
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
