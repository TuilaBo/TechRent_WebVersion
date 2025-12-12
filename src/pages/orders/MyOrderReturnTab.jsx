import React from "react";
import { Card, Descriptions, Tag, Typography, Space, Alert, Button, Divider } from "antd";

const { Title, Text } = Typography;

export default function MyOrderReturnTab({
  current,
  getDaysRemaining,
  formatRemainingDaysText,
  isCloseToReturnDate,
  isReturnConfirmedSync,
  setReturnModalOpen,
  setExtendModalOpen,
  diffDays,
  formatDateTime,
}) {
  if (!current) return null;

  const daysRemaining = getDaysRemaining(current?.planEndDate);
  const isClose = isCloseToReturnDate(current);
  const returnConfirmed = isReturnConfirmedSync(current);
  const status = String(current?.orderStatus || "").toLowerCase();
  const canReturn =
    ["active", "in_use"].includes(status) &&
    daysRemaining !== null &&
    !returnConfirmed;

  // Nếu đã xác nhận trả hàng -> hiển thị card cảm ơn
  if (returnConfirmed) {
    return (
      <div style={{ padding: 24 }}>
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #52c41a",
            background: "#f6ffed",
          }}
        >
          <Alert
            type="success"
            showIcon
            message="Cảm ơn bạn đã xác nhận trả hàng"
            description={
              <div>
                <Text>
                  Chúng tôi đã nhận được xác nhận trả hàng của bạn cho đơn hàng{" "}
                  <Text strong>
                    #{current?.displayId ?? current?.id}
                  </Text>
                  .
                </Text>
                <div style={{ marginTop: 12 }}>
                  <Text strong>Những việc tiếp theo:</Text>
                  <ul
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      paddingLeft: 20,
                    }}
                  >
                    <li>
                      Vui lòng chuẩn bị thiết bị và tất cả phụ kiện đi kèm để
                      bàn giao
                    </li>
                    <li>
                      Đảm bảo thiết bị được đóng gói cẩn thận và an toàn
                    </li>
                    <li>
                      Kiểm tra lại danh sách thiết bị và phụ kiện theo hợp đồng
                      trước khi bàn giao
                    </li>
                  </ul>
                </div>
              </div>
            }
          />
        </Card>

        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e8e8e8",
          }}
          title={
            <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
              Thông tin trả hàng
            </Title>
          }
        >
          <Descriptions bordered column={1} size="middle">
            <Descriptions.Item label="Mã đơn hàng">
              <Text strong>#{current?.displayId ?? current?.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu thuê">
              {current?.planStartDate ? formatDateTime(current.planStartDate) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc thuê">
              {current?.planEndDate ? formatDateTime(current.planEndDate) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Số ngày thuê">
              {(() => {
                if (!current?.planStartDate || !current?.planEndDate) {
                  return current?.days ? `${current.days} ngày` : "—";
                }
                const rentalDays = diffDays(current.planStartDate, current.planEndDate);
                return `${rentalDays} ngày`;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag
                color="green"
                style={{ fontSize: 14, padding: "4px 12px" }}
              >
                Đã xác nhận trả hàng
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    );
  }

  // Giao diện bình thường: thông tin trả hàng + thao tác
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
          <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
            Thông tin trả hàng
          </Title>
        }
      >
        <Descriptions bordered column={1} size="middle">
          <Descriptions.Item label="Ngày bắt đầu thuê">
            {current?.planStartDate ? formatDateTime(current.planStartDate) : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày kết thúc thuê">
            {current?.planEndDate ? formatDateTime(current.planEndDate) : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Số ngày thuê">
            {(() => {
              if (!current?.planStartDate || !current?.planEndDate) {
                return current?.days ? `${current.days} ngày` : "—";
              }
              const rentalDays = diffDays(current.planStartDate, current.planEndDate);
              return `${rentalDays} ngày`;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="Thời gian còn lại">
            {daysRemaining !== null ? (
              <Tag
                color={isClose ? "orange" : "green"}
                style={{ fontSize: 14, padding: "4px 12px" }}
              >
                {formatRemainingDaysText(daysRemaining)}
              </Tag>
            ) : (
              "—"
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {isClose && (
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #ffa940",
            background: "#fff7e6",
          }}
        >
          <Alert
            type="warning"
            showIcon
            message="Đơn hàng sắp đến hạn trả"
            description={
              <div>
                <Text>
                  Đơn hàng của bạn sẽ hết hạn sau 1 ngày. Vui lòng chọn một
                  trong các tùy chọn sau:
                </Text>
                <ul
                  style={{
                    marginTop: 8,
                    marginBottom: 0,
                    paddingLeft: 20,
                  }}
                >
                  <li>
                    <Text strong>Gia hạn:</Text> Nếu bạn muốn tiếp tục sử dụng
                    thiết bị, vui lòng liên hệ bộ phận hỗ trợ để gia hạn đơn
                    hàng.
                  </li>
                  <li>
                    <Text strong>Trả hàng:</Text> Xác nhận trả hàng để chúng tôi
                    thu hồi thiết bị đúng hạn.
                  </li>
                </ul>
              </div>
            }
          />
        </Card>
      )}

      <Card
        style={{
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e8e8e8",
        }}
        title={
          <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
            Thao tác
          </Title>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {canReturn ? (
            <>
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Gia hạn đơn hàng
                </Text>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 12 }}
                >
                  Nếu bạn muốn tiếp tục sử dụng thiết bị, vui lòng liên hệ bộ
                  phận hỗ trợ để được hỗ trợ gia hạn đơn hàng.
                </Text>
                <Button
                  type="default"
                  size="large"
                  onClick={() => setExtendModalOpen(true)}
                  style={{ width: "100%" }}
                >
                  Yêu cầu gia hạn
                </Button>
              </div>
              <Divider />
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Xác nhận trả hàng
                </Text>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => setReturnModalOpen(true)}
                  style={{ width: "100%" }}
                  danger={isClose}
                >
                  Xác nhận trả hàng
                </Button>
              </div>
            </>
          ) : (
            <Alert
              type="info"
              message="Đơn hàng này không thể trả hàng hoặc gia hạn"
              description="Chỉ các đơn hàng đang trong trạng thái 'Đang thuê' hoặc 'Đang sử dụng' mới có thể thực hiện thao tác trả hàng hoặc gia hạn."
            />
          )}
        </Space>
      </Card>
    </div>
  );
}


