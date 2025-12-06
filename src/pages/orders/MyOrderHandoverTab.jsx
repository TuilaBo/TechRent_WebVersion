import React from "react";
import { Card, Table, Space, Button, Tag, Typography } from "antd";
import {
  ReloadOutlined,
  EyeOutlined,
  DownloadOutlined,
  ExpandOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function MyOrderHandoverTab({
  current,
  checkoutReports,
  checkinReports,
  handoverReportsLoading,
  selectedHandoverReport,
  setSelectedHandoverReport,
  selectedCheckinReport,
  setSelectedCheckinReport,
  handoverPdfPreviewUrl,
  checkinPdfPreviewUrl,
  handoverPdfBlobUrl,
  handoverPdfGenerating,
  formatDateTime,
  translateHandoverStatus,
  loadOrderHandoverReports,
  previewHandoverReportAsPdf,
  handleDownloadHandoverPdf,
  handleSignHandoverReport,
  message,
}) {
  return (
    <>
      {/* Biên bản bàn giao */}
      <div style={{ padding: 24 }}>
        {handoverReportsLoading ? (
          <Card>
            <Text>Đang tải biên bản bàn giao...</Text>
          </Card>
        ) : checkoutReports.length > 0 ? (
          <>
            <Card
              style={{
                marginBottom: 24,
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e8e8e8",
              }}
              title={
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
                    Danh sách biên bản bàn giao
                  </Title>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={async () => {
                      if (current?.id) {
                        await loadOrderHandoverReports(current.id);
                        message.success("Đã tải lại danh sách biên bản bàn giao");
                      }
                    }}
                    loading={handoverReportsLoading}
                  >
                    Tải lại
                  </Button>
                </div>
              }
            >
              <Table
                rowKey="handoverReportId"
                onRow={(record) => ({
                  onClick: () => {
                    const isSameReport =
                      selectedHandoverReport?.handoverReportId ===
                      record.handoverReportId;
                    setSelectedHandoverReport(record);
                    if (!isSameReport || !handoverPdfPreviewUrl) {
                      previewHandoverReportAsPdf(record, { target: "handover" });
                    }
                  },
                  style: { cursor: "pointer" },
                })}
                rowClassName={(record) =>
                  selectedHandoverReport?.handoverReportId ===
                  record.handoverReportId
                    ? "ant-table-row-selected"
                    : ""
                }
                columns={[
                  {
                    title: "Mã biên bản",
                    dataIndex: "handoverReportId",
                    width: 120,
                    render: (v) => <Text strong>#{v}</Text>,
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    width: 160,
                    render: (status) => {
                      const s = String(status || "").toUpperCase();
                      const color =
                        s === "STAFF_SIGNED"
                          ? "green"
                          : s === "CUSTOMER_SIGNED"
                          ? "blue"
                          : s === "COMPLETED" || s === "BOTH_SIGNED"
                          ? "green"
                          : "orange";
                      const label = translateHandoverStatus(status);
                      return <Tag color={color}>{label}</Tag>;
                    },
                  },
                  {
                    title: "Thời gian bàn giao",
                    dataIndex: "handoverDateTime",
                    width: 180,
                    render: (v) => formatDateTime(v),
                  },
                  {
                    title: "Địa điểm",
                    dataIndex: "handoverLocation",
                    width: 250,
                    ellipsis: true,
                  },
                  {
                    title: "Thao tác",
                    key: "actions",
                    width: 180,
                    render: (_, record) => {
                      const status = String(record.status || "").toUpperCase();
                      const isStaffSigned =
                        status === "STAFF_SIGNED" || status === "BOTH_SIGNED";
                      const isCustomerSigned =
                        record.customerSigned === true ||
                        status === "CUSTOMER_SIGNED" ||
                        status === "BOTH_SIGNED" ||
                        status === "COMPLETED";
                      const canSign = isStaffSigned && !isCustomerSigned;

                      return (
                        <Space size="small" wrap>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedHandoverReport(record);
                              previewHandoverReportAsPdf(record, {
                                target: "handover",
                              });
                            }}
                            loading={
                              handoverPdfGenerating &&
                              selectedHandoverReport?.handoverReportId ===
                                record.handoverReportId
                            }
                          >
                            Xem PDF
                          </Button>
                          {canSign && (
                            <Button
                              size="small"
                              type="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSignHandoverReport(record.handoverReportId);
                              }}
                            >
                              Ký
                            </Button>
                          )}
                        </Space>
                      );
                    },
                  },
                ]}
                dataSource={checkoutReports}
                pagination={false}
                size="small"
                scroll={{ x: 890 }}
              />
            </Card>

            <Card
              style={{
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e8e8e8",
              }}
              title={
                <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
                  Biên bản bàn giao PDF
                </Title>
              }
            >
              <Space style={{ marginBottom: 16 }} wrap>
                {selectedHandoverReport && (
                  <>
                    <Button
                      icon={<ExpandOutlined />}
                      onClick={() => {
                        const url = handoverPdfPreviewUrl || handoverPdfBlobUrl;
                        return url
                          ? window.open(url, "_blank", "noopener")
                          : message.warning("Không có PDF để xem");
                      }}
                    >
                      Xem toàn màn hình
                    </Button>
                    {handoverPdfPreviewUrl && (
                      <>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={() => {
                            if (selectedHandoverReport) {
                              handleDownloadHandoverPdf(selectedHandoverReport);
                            }
                          }}
                          loading={handoverPdfGenerating}
                        >
                          Tải biên bản
                        </Button>
                      </>
                    )}
                  </>
                )}
                {!handoverPdfPreviewUrl && selectedHandoverReport && (
                  <>
                    <Button
                      onClick={() =>
                        previewHandoverReportAsPdf(selectedHandoverReport, {
                          target: "handover",
                        })
                      }
                      loading={handoverPdfGenerating}
                    >
                      Xem trước biên bản PDF
                    </Button>
                    <Button
                      type="primary"
                      onClick={() =>
                        handleDownloadHandoverPdf(selectedHandoverReport)
                      }
                      loading={handoverPdfGenerating}
                    >
                      Tạo & tải biên bản PDF
                    </Button>
                  </>
                )}
                {!selectedHandoverReport && (
                  <Text type="secondary">
                    Vui lòng chọn một biên bản từ danh sách để xem PDF
                  </Text>
                )}
              </Space>

              <div
                style={{
                  height: 460,
                  border: "1px solid #e8e8e8",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fafafa",
                  marginTop: 12,
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                {handoverPdfPreviewUrl ? (
                  <iframe
                    key={handoverPdfPreviewUrl}
                    title="HandoverReportPreview"
                    src={handoverPdfPreviewUrl}
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Text type="secondary">
                      <FilePdfOutlined />{" "}
                      {selectedHandoverReport
                        ? "Nhấn 'Xem trước biên bản PDF' để hiển thị"
                        : "Chưa chọn biên bản để hiển thị."}
                    </Text>
                  </div>
                )}
              </div>
            </Card>
          </>
        ) : null}
      </div>

      {/* Biên bản thu hồi sẽ vẫn dùng tab 'checkin' hiện có trong MyOrders.jsx (chưa tách) */}
    </>
  );
}


