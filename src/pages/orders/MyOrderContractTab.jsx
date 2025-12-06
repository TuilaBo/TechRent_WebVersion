import React from "react";
import { Card, Table, Space, Button, Tag, Typography } from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  ExpandOutlined,
  DollarOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function MyOrderContractTab({
  current,
  contracts,
  contractsLoading,
  selectedContract,
  setSelectedContract,
  contractPdfPreviewUrl,
  pdfGenerating,
  processingPayment,
  invoiceInfo,
  CONTRACT_STATUS_MAP,
  formatVND,
  formatDateTime,
  hasSignedContract,
  handlePayment,
  handleDownloadContract,
  handleSignContract,
  previewContractAsPdfInline,
  mapInvoiceStatusToPaymentStatus,
  message,
  pdfPreviewUrl,
}) {
  // Ẩn các hợp đồng ở trạng thái "Nháp" đối với khách hàng
  const visibleContracts = Array.isArray(contracts)
    ? contracts.filter(
        (c) => String(c?.status || "").toUpperCase() !== "DRAFT"
      )
    : [];

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
            Hợp đồng đã tạo
          </Title>
        }
      >
        {contractsLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Text type="secondary">Đang tải danh sách hợp đồng...</Text>
          </div>
        ) : visibleContracts.length > 0 ? (
          <Table
            rowKey="id"
            onRow={(record) => ({
              onClick: () => {
                const isSameContract = selectedContract?.id === record.id;
                setSelectedContract(record);
                if (!isSameContract || !contractPdfPreviewUrl) {
                  previewContractAsPdfInline(record);
                }
              },
              style: { cursor: "pointer" },
            })}
            rowClassName={(record) =>
              selectedContract?.id === record.id ? "ant-table-row-selected" : ""
            }
            columns={[
              {
                title: "Mã hợp đồng",
                dataIndex: "id",
                width: 100,
                render: (v) => <Text strong>#{v}</Text>,
              },
              {
                title: "Số hợp đồng",
                dataIndex: "number",
                width: 120,
                render: (v) => v || "—",
              },
              {
                title: "Trạng thái",
                dataIndex: "status",
                width: 140,
                render: (status) => {
                  const key = String(status || "").toLowerCase();
                  const info = CONTRACT_STATUS_MAP[key];
                  return info ? (
                    <Tag color={info.color}>{info.label}</Tag>
                  ) : (
                    <Tag>{status}</Tag>
                  );
                },
              },
              {
                title: "Ngày tạo",
                dataIndex: "createdAt",
                width: 150,
                render: (v) => formatDateTime(v),
              },
              {
                title: "Tổng thanh toán",
                key: "totalPayment",
                width: 140,
                align: "right",
                render: (_, record) => {
                  const totalAmount = Number(record.totalAmount || 0);
                  const depositAmount = Number(record.depositAmount || 0);
                  return formatVND(totalAmount + depositAmount);
                },
              },
              {
                title: "Thao tác",
                key: "actions",
                width: 220,
                render: (_, record) => (
                  <Space size="small">
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        setSelectedContract(record);
                        previewContractAsPdfInline(record);
                      }}
                      loading={pdfGenerating && selectedContract?.id === record.id}
                    >
                      Xem PDF
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownloadContract(record)}
                      loading={pdfGenerating && selectedContract?.id === record.id}
                    >
                      Tải PDF
                    </Button>

                    {String(record.status || "").toUpperCase() ===
                      "PENDING_SIGNATURE" && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => handleSignContract(record.id)}
                      >
                        Ký
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
            dataSource={visibleContracts}
            pagination={false}
            size="small"
          />
        ) : null}

        {(() => {
          const items = Array.isArray(current?.items) ? current.items : [];
          const days = Number(current?.days || 1);
          const rentalTotal =
            items.reduce(
              (s, it) =>
                s + Number(it.pricePerDay || 0) * Number(it.qty || 1),
              0
            ) * days;
          const depositTotal = items.reduce(
            (s, it) =>
              s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1),
            0
          );

          const invoiceStatus = invoiceInfo?.invoiceStatus;
          const paymentStatus = invoiceStatus
            ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
            : String(current.paymentStatus || "unpaid").toLowerCase();

          const canPayCurrent =
            ["unpaid", "partial"].includes(paymentStatus) &&
            String(current.orderStatus).toLowerCase() === "processing" &&
            hasSignedContract(current.id) &&
            Number((current?.total ?? rentalTotal) + depositTotal) > 0;

          if (!canPayCurrent) return null;

          return (
            <div
              style={{
                padding: "16px",
                textAlign: "right",
                borderTop: "1px solid #f0f0f0",
                marginTop: 16,
              }}
            >
              <Button
                type="primary"
                size="middle"
                icon={<DollarOutlined />}
                onClick={() => handlePayment(current)}
                loading={processingPayment}
                style={{
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                Thanh toán
              </Button>
            </div>
          );
        })()}
      </Card>

      <Card
        style={{
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e8e8e8",
        }}
        title={
          <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
            Hợp đồng PDF
          </Title>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          {selectedContract && (
            <>
              <Button
                icon={<ExpandOutlined />}
                onClick={() => {
                  const url =
                    contractPdfPreviewUrl ||
                    selectedContract.contractUrl ||
                    pdfPreviewUrl;
                  return url
                    ? window.open(url, "_blank", "noopener")
                    : message.warning("Không có PDF để xem");
                }}
              >
                Xem toàn màn hình
              </Button>
              {contractPdfPreviewUrl && (
                <>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      if (selectedContract) {
                        handleDownloadContract(selectedContract);
                      }
                    }}
                    loading={pdfGenerating}
                  >
                    Tải hợp đồng
                  </Button>
                </>
              )}
            </>
          )}
          {!contractPdfPreviewUrl && selectedContract && (
            <>
              <Button
                onClick={() => previewContractAsPdfInline(selectedContract)}
                loading={pdfGenerating}
              >
                Xem trước hợp đồng PDF
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  if (selectedContract) {
                    handleDownloadContract(selectedContract);
                  }
                }}
                loading={pdfGenerating}
              >
                Tạo & tải hợp đồng PDF
              </Button>
            </>
          )}
          {!selectedContract && (
            <Text type="secondary">
              Vui lòng chọn một hợp đồng từ danh sách để xem PDF
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
          {contractPdfPreviewUrl ? (
            <iframe
              key={contractPdfPreviewUrl}
              title="ContractPreview"
              src={contractPdfPreviewUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Text type="secondary">
                <FilePdfOutlined />{" "}
                {selectedContract
                  ? "Nhấn 'Xem trước hợp đồng PDF' để hiển thị"
                  : "Chưa chọn hợp đồng để hiển thị."}
              </Text>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}


