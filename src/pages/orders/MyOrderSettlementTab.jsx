import React from "react";
import { Card, Descriptions, Tag, Typography, Alert, Space, Button } from "antd";

const { Title, Text } = Typography;

export default function MyOrderSettlementTab({
  current,
  settlementInfo,
  settlementLoading,
  settlementActionLoading,
  splitSettlementAmounts,
  formatVND,
  SETTLEMENT_STATUS_MAP,
  handleRespondSettlement,
}) {
  if (!current) return null;

  if (settlementLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Text>Đang tải thông tin quyết toán...</Text>
        </Card>
      </div>
    );
  }

  if (!settlementInfo) {
    return <div style={{ padding: 24 }} />;
  }

  const totalDeposit = Number(settlementInfo.totalDeposit || 0);
  const damageFee = Number(settlementInfo.damageFee || 0);
  const lateFee = Number(settlementInfo.lateFee || 0);
  const accessoryFee = Number(settlementInfo.accessoryFee || 0);
  const totalFees = damageFee + lateFee + accessoryFee;
  const depositUsed = Math.min(totalDeposit, totalFees);
  const { refundAmount, customerDueAmount, netAmount } = splitSettlementAmounts(
    settlementInfo.finalReturnAmount ?? settlementInfo.finalAmount ?? 0
  );

  const highlightLabel =
    refundAmount > 0
      ? "Bạn sẽ được hoàn lại"
      : customerDueAmount > 0
      ? "Bạn cần thanh toán thêm"
      : "Không phát sinh số tiền cần hoàn/thu thêm";

  const highlightAmount = formatVND(
    refundAmount > 0 ? refundAmount : customerDueAmount
  );

  const highlightColor =
    refundAmount > 0
      ? "#1d4ed8"
      : customerDueAmount > 0
      ? "#dc2626"
      : "#111";

  const state = String(settlementInfo.state || "").toUpperCase();
  const canRespond = !["ISSUED", "REJECTED", "CANCELLED", "CLOSED"].includes(
    state
  );

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e8e8e8",
        }}
        title={
          <Title level={5} style={{ margin: 0 }}>
            Thông tin quyết toán
          </Title>
        }
      >
        <Descriptions bordered column={1} size="middle">
          <Descriptions.Item label="Tổng tiền cọc">
            {formatVND(totalDeposit)}
          </Descriptions.Item>
          <Descriptions.Item label="Phí hư hỏng">
            {formatVND(damageFee)}
          </Descriptions.Item>
          <Descriptions.Item label="Phí trễ hạn">
            {formatVND(lateFee)}
          </Descriptions.Item>
          <Descriptions.Item label="Phí phụ kiện">
            {formatVND(accessoryFee)}
          </Descriptions.Item>
          <Descriptions.Item label="Cọc đã dùng">
            {formatVND(depositUsed)}
          </Descriptions.Item>
          {refundAmount > 0 && (
            <Descriptions.Item label="Số tiền cọc bạn sẽ được hoàn lại">
              <Text strong style={{ color: "#1d4ed8" }}>
                {formatVND(refundAmount)}
              </Text>
            </Descriptions.Item>
          )}
          {customerDueAmount > 0 && (
            <Descriptions.Item label="Số tiền cần thanh toán thêm">
              <Text strong style={{ color: "#dc2626" }}>
                {formatVND(customerDueAmount)}
              </Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Trạng thái">
            {(() => {
              const key = String(settlementInfo.state || "").toLowerCase();
              const info =
                SETTLEMENT_STATUS_MAP[key] || {
                  label: settlementInfo.state || "—",
                  color: "default",
                };
              return <Tag color={info.color}>{info.label}</Tag>;
            })()}
          </Descriptions.Item>
        </Descriptions>
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#f5f5f5",
            border: "1px solid #d0d0d0",
            color: "#111",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <Text
            style={{
              color: "#111827",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {highlightLabel}
          </Text>
          <Text
            style={{
              fontSize: netAmount === 0 ? 18 : 20,
              fontWeight: 600,
              color: highlightColor,
            }}
          >
            {highlightAmount}
          </Text>
          {customerDueAmount > 0 && (
            <Text style={{ color: "#666", fontSize: 12 }}>
              Số tiền hiển thị là giá trị tuyệt đối bạn cần thanh toán thêm.
            </Text>
          )}
        </div>
      </Card>

      <Card
        style={{
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e8e8e8",
        }}
      >
        {canRespond ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              type="warning"
              showIcon
              message="Vui lòng xem và xác nhận quyết toán để hoàn tất việc hoàn cọc."
            />
            <Space>
              <Button
                type="primary"
                loading={settlementActionLoading}
                onClick={() => handleRespondSettlement(true)}
              >
                Chấp nhận quyết toán
              </Button>
              <Button
                danger
                loading={settlementActionLoading}
                onClick={() => handleRespondSettlement(false)}
              >
                Từ chối
              </Button>
            </Space>
          </Space>
        ) : (
          <Alert
            type={
              state === "ISSUED"
                ? "success"
                : state === "REJECTED"
                ? "error"
                : "info"
            }
            showIcon
            message={
              state === "ISSUED"
                ? "Bạn đã chấp nhận quyết toán này."
                : state === "REJECTED"
                ? "Bạn đã từ chối quyết toán này."
                : state === "CLOSED"
                ? "Quyết toán đã tất toán xong. Cảm ơn bạn đã hợp tác."
                : "Quyết toán đã được xử lý."
            }
          />
        )}
      </Card>
    </div>
  );
}


