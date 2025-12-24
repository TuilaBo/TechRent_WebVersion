import React from "react";
import { Card, Table, Space, Button, Tag, Typography, Divider, Skeleton, Modal, Row, Col, Form, Input, Alert } from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  ExpandOutlined,
  DollarOutlined,
  FilePdfOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

// Extension status mapping
const EXTENSION_STATUS_MAP = {
  PROCESSING: { label: "Đang xử lý", color: "blue" },
  COMPLETED: { label: "Hoàn thành", color: "green" },
  DONE: { label: "Hoàn thành", color: "green" },
  PENDING: { label: "Chờ xử lý", color: "orange" },
  CANCELLED: { label: "Đã hủy", color: "red" },
  IN_USE: { label: "Có hiệu lực", color: "green" },
  PAID: { label: "Đã thanh toán", color: "cyan" },
  DRAFT: { label: "Đang chờ xử lý", color: "default" },
};

// Annex status mapping
const ANNEX_STATUS_MAP = {
  PENDING_ADMIN_SIGNATURE: { label: "Chờ admin ký", color: "orange" },
  PENDING_CUSTOMER_SIGNATURE: { label: "Chờ khách hàng ký", color: "gold" },
  PENDING_SIGNATURE: { label: "Chờ ký", color: "gold" },
  SIGNED: { label: "2 bên đã ký", color: "green" },
  ACTIVE: { label: "2 bên đã ký", color: "green" },
  CANCELLED: { label: "Đã hủy", color: "red" },
};

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
  // Extensions & Annexes
  orderExtensions = [],
  extensionsLoading = false,
  orderAnnexes = [],
  annexesLoading = false,
  annexDetail,
  setAnnexDetail,
  annexDetailOpen,
  setAnnexDetailOpen,
  annexPdfBlobUrl,
  annexPdfGenerating,
  previewAnnexAsPdf,
  // Annex signing props
  handleSignAnnex,
  annexSignModalOpen,
  setAnnexSignModalOpen,
  currentAnnexId,
  annexPinSent,
  signingAnnex,
  annexSigning,
  sendAnnexPin,
  handleAnnexSign,
  customerProfile,
  annexSigningEmail,
  confirmExtensionPayment,
}) {
  // Ẩn các hợp đồng ở trạng thái "Nháp" đối với khách hàng
  const visibleContracts = Array.isArray(contracts)
    ? contracts.filter(
        (c) => String(c?.status || "").toUpperCase() !== "DRAFT"
      )
    : [];

  const renderExtensionStatus = (status) => {
    const s = String(status || "").toUpperCase();
    const config = EXTENSION_STATUS_MAP[s] || { label: status || "—", color: "default" };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const renderAnnexStatus = (status) => {
    const s = String(status || "").toUpperCase();
    const config = ANNEX_STATUS_MAP[s] || { label: status || "—", color: "default" };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  // Check for pending signatures
  const pendingContracts = visibleContracts.filter(
    (c) => String(c?.status || "").toUpperCase() === "PENDING_SIGNATURE"
  );
  const pendingAnnexes = orderAnnexes.filter(
    (a) => ["PENDING_CUSTOMER_SIGNATURE", "PENDING_SIGNATURE"].includes(String(a?.status || "").toUpperCase())
  );
  const hasPendingSignatures = pendingContracts.length > 0 || pendingAnnexes.length > 0;

  return (
    <div style={{ padding: 24 }}>
      {/* Alert khi có hợp đồng/phụ lục cần ký */}
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

      {/* ========== GIA HẠN ĐƠN THUÊ ========== */}
      {orderExtensions.length > 0 && (
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e8e8e8",
          }}
          title={
            <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
              Gia hạn đơn thuê
            </Title>
          }
        >
          {extensionsLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <Table
              rowKey="extensionId"
              columns={[
                {
                  title: "ID",
                  dataIndex: "extensionId",
                  width: 60,
                  render: (v) => <strong>#{v}</strong>,
                },
                {
                  title: "Thời gian gia hạn",
                  key: "extensionPeriod",
                  width: 200,
                  render: (_, record) => (
                    <span>
                      {record.extensionStart ? dayjs(record.extensionStart).format("DD/MM/YYYY HH:mm") : "—"}
                      {" → "}
                      {record.extensionEnd ? dayjs(record.extensionEnd).format("DD/MM/YYYY HH:mm") : "—"}
                    </span>
                  ),
                },
                {
                  title: "Số ngày",
                  dataIndex: "durationDays",
                  width: 80,
                  align: "center",
                  render: (v) => `${v || 0} ngày`,
                },
                {
                  title: "Phí gia hạn",
                  dataIndex: "additionalPrice",
                  width: 120,
                  align: "right",
                  render: (v) => formatVND(v || 0),
                },
                {
                  title: "Ngày tạo",
                  dataIndex: "createdAt",
                  width: 130,
                  render: (v) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
                },
                {
                  title: "Trạng thái",
                  dataIndex: "status",
                  width: 120,
                  render: renderExtensionStatus,
                },
              ]}
              dataSource={orderExtensions}
              pagination={false}
              size="small"
            />
          )}
        </Card>
      )}

      {/* ========== PHỤ LỤC GIA HẠN HỢP ĐỒNG ========== */}
      {orderAnnexes.length > 0 && (
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e8e8e8",
          }}
          title={
            <Title level={5} style={{ margin: 0, color: "#1a1a1a" }}>
              Phụ lục gia hạn hợp đồng
            </Title>
          }
        >
          {annexesLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <Table
              rowKey="annexId"
              columns={[
                {
                  title: "ID",
                  dataIndex: "annexId",
                  width: 80,
                  render: (v) => <strong>#{v || "—"}</strong>,
                },
                {
                  title: "Thời gian gia hạn",
                  key: "extensionPeriod",
                  width: 180,
                  render: (_, record) => (
                    <span>
                      {record.extensionStartDate ? dayjs(record.extensionStartDate).format("DD/MM/YYYY") : "—"}
                      {" → "}
                      {record.extensionEndDate ? dayjs(record.extensionEndDate).format("DD/MM/YYYY") : "—"}
                    </span>
                  ),
                },
                {
                  title: "Phí gia hạn",
                  dataIndex: "extensionFee",
                  width: 120,
                  render: (v) => formatVND(v || 0),
                },
                {
                  title: "Trạng thái",
                  dataIndex: "status",
                  width: 140,
                  render: renderAnnexStatus,
                },
                {
                  title: "Thao tác",
                  key: "action",
                  width: 100,
                  render: (_, record) => (
                    <Space size="small">
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          setAnnexDetail(record);
                          setAnnexDetailOpen(true);
                          previewAnnexAsPdf(record);
                        }}
                      >
                        Xem
                      </Button>
                      {(String(record.status || "").toUpperCase() === "PENDING_CUSTOMER_SIGNATURE" || 
                        String(record.status || "").toUpperCase() === "PENDING_SIGNATURE") && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => handleSignAnnex(record)}
                        >
                          Ký
                        </Button>
                      )}
                      {(String(record.status || "").toUpperCase() === "SIGNED" || 
                        String(record.status || "").toUpperCase() === "ACTIVE") && (() => {
                        // Find matching extension to check if already paid
                        const matchingExtension = orderExtensions.find(
                          ext => ext.extensionId === record.extensionId
                        );
                        const extensionStatus = String(matchingExtension?.status || "").toUpperCase();
                        // Hide button if extension is already paid (IN_USE, PAID, or COMPLETED)
                        const isPaid = ["IN_USE", "PAID", "COMPLETED", "DONE"].includes(extensionStatus);
                        
                        if (isPaid) return null;
                        
                        return (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => {
                              if (matchingExtension && confirmExtensionPayment) {
                                confirmExtensionPayment({
                                  extensionId: matchingExtension.extensionId,
                                  additionalPrice: matchingExtension.additionalPrice,
                                  annexId: record.annexId || record.id,
                                  contractId: record.contractId,
                                });
                              } else if (confirmExtensionPayment && record.extensionId) {
                                const fallbackAmount = record.extensionFee || record.totalPayable || 0;
                                confirmExtensionPayment({
                                  extensionId: record.extensionId,
                                  additionalPrice: fallbackAmount,
                                  annexId: record.annexId || record.id,
                                });
                              } else {
                                message.warning("Không tìm thấy thông tin gia hạn để thanh toán.");
                              }
                            }}
                            loading={processingPayment}
                          >
                            Thanh toán
                          </Button>
                        );
                      })()}
                    </Space>
                  ),
                },
              ]}
              dataSource={orderAnnexes}
              pagination={false}
              size="small"
            />
          )}
        </Card>
      )}

      {/* ========== HỢP ĐỒNG PDF ========== */}
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

      {/* ========== MODAL XEM PHỤ LỤC PDF ========== */}
      <Modal
        title={`Chi tiết phụ lục: ${annexDetail?.annexNumber || annexDetail?.annexId || ""}`}
        open={annexDetailOpen}
        onCancel={() => {
          setAnnexDetailOpen(false);
          setAnnexDetail(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setAnnexDetailOpen(false);
            setAnnexDetail(null);
          }}>Đóng</Button>,
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {annexDetail ? (
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <Title level={5} style={{ marginBottom: 16 }}>Phụ lục PDF</Title>
            <Space style={{ marginBottom: 12 }} wrap>
              <Button
                icon={<ExpandOutlined />}
                onClick={() => {
                  return annexPdfBlobUrl
                    ? window.open(annexPdfBlobUrl, "_blank", "noopener")
                    : message.warning("Đang tạo PDF, vui lòng chờ...");
                }}
              >Xem toàn màn hình</Button>
              {annexPdfBlobUrl && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = annexPdfBlobUrl;
                    link.download = `Phu-luc-${annexDetail.annexNumber || annexDetail.annexId}.pdf`;
                    link.click();
                  }}
                >Tải phụ lục</Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={() => previewAnnexAsPdf(annexDetail)}
                loading={annexPdfGenerating}
              >Tạo lại PDF</Button>
            </Space>

            {/* PDF Preview */}
            <div style={{ border: "1px solid #e8e8e8", borderRadius: 8, overflow: "hidden", height: 500 }}>
              {annexPdfGenerating ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                  <Skeleton.Button active style={{ width: 200, height: 20 }} />
                  <Text type="secondary">Đang tạo PDF phụ lục...</Text>
                </div>
              ) : annexPdfBlobUrl ? (
                <iframe src={annexPdfBlobUrl} title="Annex PDF Preview" style={{ width: "100%", height: "100%", border: "none" }} />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Text type="secondary"><FilePdfOutlined /> Nhấn "Tạo lại PDF" để xem phụ lục.</Text>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Text type="secondary">Không có dữ liệu.</Text>
        )}
      </Modal>

      {/* ========== ANNEX SIGNING MODAL ========== */}
      <Modal
        title="Ký phụ lục gia hạn"
        open={annexSignModalOpen}
        onCancel={() => {
          setAnnexSignModalOpen(false);
          setCurrentAnnexId(null);
          setCurrentAnnexContractId(null);
          setAnnexPinSent(false);
        }}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={annexPinSent ? handleAnnexSign : sendAnnexPin}>
          {!annexPinSent ? (
            <>
              <Text>Email nhận mã PIN: <strong>{annexSigningEmail || customerProfile?.email || "Chưa cập nhật"}</strong></Text>
              <Divider />
              <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                <Button
                  onClick={() => {
                    setAnnexSignModalOpen(false);
                    setCurrentAnnexId(null);
                    setCurrentAnnexContractId(null);
                    setAnnexPinSent(false);
                  }}
                >
                  Hủy
                </Button>
                <Button type="primary" htmlType="submit" loading={signingAnnex} disabled={!annexSigningEmail && !customerProfile?.email}>
                  Gửi mã PIN
                </Button>
              </Space>
            </>
          ) : (
            <>
              <Form.Item
                label="Mã PIN"
                name="pinCode"
                rules={[{ required: true, message: "Vui lòng nhập mã PIN" }, { min: 6, message: "Ít nhất 6 ký tự" }]}
              >
                <Input placeholder="Nhập mã PIN" maxLength={10} />
              </Form.Item>
              <Space style={{ justifyContent: "space-between", width: "100%" }}>
                <Button onClick={() => setAnnexPinSent(false)}>Quay lại</Button>
                <Button type="primary" htmlType="submit" loading={annexSigning}>
                  Ký phụ lục
                </Button>
              </Space>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
