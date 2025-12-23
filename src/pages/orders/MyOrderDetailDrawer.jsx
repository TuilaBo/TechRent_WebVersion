/**
 * MyOrderDetailDrawer - Order detail drawer with tabs and modals
 * Extracted from MyOrders.jsx to reduce file size
 */
import React from "react";
import {
    Typography, Tag, Button, message, Drawer, Descriptions,
    Avatar, Tabs, Modal, Card, Row, Col, Divider, Form, Steps, Radio, Checkbox, Alert, Space, Table, Input, DatePicker
} from "antd";
import {
    FilePdfOutlined,
    DownloadOutlined,
    PrinterOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import MyOrderContractTab from "./MyOrderContractTab.jsx";
import MyOrderHandoverTab from "./MyOrderHandoverTab.jsx";
import MyOrderCheckinTab from "./MyOrderCheckinTab.jsx";
import MyOrderReturnTab from "./MyOrderReturnTab.jsx";
import MyOrderSettlementTab from "./MyOrderSettlementTab.jsx";
import MyOrderComplaintsTab from "./MyOrderComplaintsTab.jsx";

const { Title, Text } = Typography;

export default function MyOrderDetailDrawer({
    // Core state
    current,
    detailOpen,
    setDetailOpen,
    detailTab,
    setDetailTab,
    detailDataReady, // True when all data finished loading

    // Contracts
    contracts,
    contractsLoading,
    selectedContract,
    setSelectedContract,
    contractPdfPreviewUrl,
    pdfGenerating,
    contractDetail,
    contractDetailOpen,
    setContractDetailOpen,
    loadingContractDetail,
    contractCustomer,

    // Handover reports
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
    handoverPdfModalOpen,
    setHandoverPdfModalOpen,
    hasUnsignedCheckoutReports,
    hasUnsignedCheckinReports,

    // Settlement
    settlementInfo,
    settlementLoading,
    settlementActionLoading,

    // Invoice
    invoiceInfo,

    // Contract signing state
    signModalOpen,
    setSignModalOpen,
    currentContractId,
    setCurrentContractId,
    pinSent,
    setPinSent,
    signingContract,
    signing,
    customerProfile,

    // Handover signing state
    handoverSignModalOpen,
    setHandoverSignModalOpen,
    currentHandoverReportId,
    setCurrentHandoverReportId,
    handoverPinSent,
    setHandoverPinSent,
    signingHandover,
    handoverSigning,

    // Return/extend state
    returnModalOpen,
    setReturnModalOpen,
    extendModalOpen,
    setExtendModalOpen,
    extendedEndTime,
    setExtendedEndTime,
    processingReturn,
    processingExtend,

    // Payment state
    paymentModalOpen,
    setPaymentModalOpen,
    paymentOrder,
    paymentMethod,
    setPaymentMethod,
    paymentTermsAccepted,
    setPaymentTermsAccepted,
    processingPayment,
    pdfBlobUrl,
    pdfModalOpen,
    setPdfModalOpen,
    pdfPreviewUrl,

    // Computed values
    needsContractAction,
    hasContracts,

    // Helpers & constants
    ORDER_STATUS_MAP,
    PAYMENT_STATUS_MAP,
    SETTLEMENT_STATUS_MAP,
    CONTRACT_STATUS_MAP,
    CONTRACT_TYPE_LABELS,
    formatVND,
    formatDateTime,
    diffDays,
    mapInvoiceStatusToPaymentStatus,
    splitSettlementAmounts,
    translateHandoverStatus,
    sanitizeContractHtml,

    // Helper functions from component
    clearContractPreviewState,
    computeOrderTracking,
    getDaysRemaining,
    formatRemainingDaysText,
    isCloseToReturnDate,
    isOrderInUse,
    isReturnConfirmedSync,
    hasSignedContract,

    // Handlers
    handlePayment,
    handleDownloadContract,
    handleSignContract,
    previewContractAsPdfInline,
    loadOrderHandoverReports,
    previewHandoverReportAsPdf,
    handleDownloadHandoverPdf,
    handleSignHandoverReport,
    handleRespondSettlement,
    handleConfirmReturn,
    handleExtendRequest,
    confirmCreatePayment,
    sendPin,
    handleSign,
    sendHandoverPin,
    handleSignHandover,
    printPdfUrl,
    downloadContractAsPdf,

    // Complaints state
    complaints,
    complaintsLoading,
    creatingComplaint,
    onCreateComplaint,
    onRefreshComplaints,

    // Refs
    handoverPrintRef,

    // Extensions & Annexes
    orderExtensions,
    extensionsLoading,
    orderAnnexes,
    annexesLoading,
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
    confirmExtensionPayment,
    annexSigningEmail,
}) {
    return (
        <>
            {/* Drawer chi tiết đơn */}
            <Drawer
                title={
                    <div>
                        <Title level={4} style={{ margin: 0, color: "#1a1a1a" }}>
                            {current ? `Chi tiết đơn ${current.displayId ?? current.id}` : "Chi tiết đơn"}
                        </Title>
                    </div>
                }
                width={900}
                open={detailOpen}
                onClose={() => {
                    setDetailOpen(false);
                    clearContractPreviewState();
                    setDetailTab("overview");
                }}
                styles={{
                    body: { padding: 0, background: "#f5f7fa" },
                    header: { background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "14px 18px" },
                }}
            >
                {current && (
                    <div
                        style={{
                            padding: "20px 24px",
                            borderBottom: "1px solid #e8e8e8",
                            background: "#ffffff",
                        }}
                    >
                        {(() => {
                            const tracking = computeOrderTracking(current, contracts, invoiceInfo);
                            return (
                                <div style={{ overflowX: "auto", padding: "8px 0" }}>
                                    <Steps
                                        current={tracking.current}
                                        size="default"
                                        responsive
                                        style={{
                                            background: "transparent",
                                            minWidth: "max-content",
                                        }}
                                        className="order-tracking-steps"
                                    >
                                        {tracking.steps.map((s, idx) => (
                                            <Steps.Step
                                                key={idx}
                                                title={<span style={{ fontSize: 13, whiteSpace: "nowrap" }}>{s.title}</span>}
                                                description={s.description ? <span style={{ fontSize: 11 }}>{s.description}</span> : null}
                                            />
                                        ))}
                                    </Steps>
                                </div>
                            );
                        })()}
                    </div>
                )}
                {current && needsContractAction && (
                    <div
                        style={{
                            padding: "16px 24px",
                            borderBottom: "1px solid #e8e8e8",
                            background: "#fff",
                        }}
                    >
                        <Alert
                            type="info"
                            showIcon
                            message={`Đơn #${current.displayId ?? current.id} đã được xác nhận`}
                            description={
                                hasContracts
                                    ? "Vui lòng ký hợp đồng và thanh toán để chúng tôi chuẩn bị giao hàng."
                                    : "Chúng tôi đang tạo hợp đồng cho đơn này. Bạn sẽ nhận được thông báo khi hợp đồng sẵn sàng."
                            }
                            action={
                                hasContracts && (
                                    <Button type="link" onClick={() => setDetailTab("contract")} style={{ padding: 0 }}>
                                        Xem hợp đồng
                                    </Button>
                                )
                            }
                        />
                    </div>
                )}
                {/* Alert phụ lục gia hạn cần ký */}
                {current && (() => {
                    const pendingAnnexes = (orderAnnexes || []).filter(
                        (a) => ["PENDING_CUSTOMER_SIGNATURE", "PENDING_SIGNATURE"].includes(String(a?.status || "").toUpperCase())
                    );
                    if (pendingAnnexes.length === 0) return null;
                    return (
                        <div
                            style={{
                                padding: "16px 24px",
                                borderBottom: "1px solid #e8e8e8",
                                background: "#fff",
                            }}
                        >
                            <Alert
                                type="warning"
                                showIcon
                                message={`Bạn có ${pendingAnnexes.length} phụ lục gia hạn cần ký`}
                                description="Vui lòng ký phụ lục gia hạn trong tab Hợp đồng để hoàn tất thủ tục gia hạn."
                                action={
                                    <Button type="link" onClick={() => setDetailTab("contract")} style={{ padding: 0 }}>
                                        Đi tới Hợp đồng
                                    </Button>
                                }
                            />
                        </div>
                    );
                })()}
                {current && settlementInfo && (() => {
                    const settlementState = String(settlementInfo.state || "").toUpperCase();
                    const isAwaitingResponse = !["ISSUED", "REJECTED", "CANCELLED", "CLOSED"].includes(settlementState);
                    if (!isAwaitingResponse) return null;
                    return (
                        <div
                            style={{
                                padding: "16px 24px",
                                borderBottom: "1px solid #e8e8e8",
                                background: "#fff",
                            }}
                        >
                            <Alert
                                type="warning"
                                showIcon
                                message={`Đơn #${current.displayId ?? current.id} có quyết toán cần xác nhận`}
                                description="Vui lòng xem bảng quyết toán và chấp nhận hoặc từ chối để chúng tôi hoàn cọc cho bạn."
                                action={
                                    <Button type="link" onClick={() => setDetailTab("settlement")} style={{ padding: 0 }}>
                                        Xem quyết toán
                                    </Button>
                                }
                            />
                        </div>
                    );
                })()}
                {current && (hasUnsignedCheckoutReports || hasUnsignedCheckinReports) && (
                    <div
                        style={{
                            padding: "16px 24px",
                            borderBottom: "1px solid #e8e8e8",
                            background: "#fff",
                        }}
                    >
                        <Alert
                            type="info"
                            showIcon
                            message={`Đơn #${current.displayId ?? current.id} có biên bản cần ký`}
                            description={
                                <>
                                    {hasUnsignedCheckoutReports && hasUnsignedCheckinReports
                                        ? "Vui lòng xem và ký biên bản bàn giao và biên bản thu hồi để hoàn tất thủ tục."
                                        : hasUnsignedCheckoutReports
                                            ? "Vui lòng xem và ký biên bản bàn giao để hoàn tất thủ tục."
                                            : "Vui lòng xem và ký biên bản thu hồi để hoàn tất thủ tục."}
                                </>
                            }
                            action={
                                <Space>
                                    {hasUnsignedCheckoutReports && (
                                        <Button type="link" onClick={() => setDetailTab("handover")} style={{ padding: 0 }}>
                                            Xem biên bản bàn giao
                                        </Button>
                                    )}
                                    {hasUnsignedCheckinReports && (
                                        <Button type="link" onClick={() => setDetailTab("checkin")} style={{ padding: 0 }}>
                                            Xem biên bản thu hồi
                                        </Button>
                                    )}
                                </Space>
                            }
                        />
                    </div>
                )}
                {/* Alert 1 ngày còn lại - ẩn nếu đã có yêu cầu gia hạn đang chờ hoặc có phụ lục */}
                {current && isOrderInUse(current) && isCloseToReturnDate(current) && !isReturnConfirmedSync(current) && (() => {
                    // Kiểm tra có extension đang xử lý (DRAFT, PROCESSING, COMPLETED) không
                    const blockingExtensionStatuses = ['DRAFT', 'PROCESSING', 'COMPLETED'];
                    const hasPendingExtension = (orderExtensions || []).some(
                        (ext) => blockingExtensionStatuses.includes(String(ext?.status || "").toUpperCase())
                    );
                    // Kiểm tra có bất kỳ phụ lục nào không
                    const hasAnyAnnex = (orderAnnexes || []).length > 0;
                    
                    // Ẩn alert nếu có extension đang xử lý hoặc có phụ lục
                    if (hasPendingExtension || hasAnyAnnex) return null;
                    return (
                        <div
                            style={{
                                padding: "16px 24px",
                                borderBottom: "1px solid #e8e8e8",
                                background: "#fffbe6",
                            }}
                        >
                            <Alert
                                type="warning"
                                showIcon
                                message={`Đơn #${current.displayId ?? current.id} còn 1 ngày nữa là đến hạn trả hàng`}
                                description="Vui lòng chọn gia hạn đơn hàng hoặc xác nhận trả hàng để hoàn tất thủ tục."
                                action={
                                    <Space>
                                        <Button type="link" onClick={() => setDetailTab("return")} style={{ padding: 0 }}>
                                            Đi tới Trả hàng & Gia hạn
                                        </Button>
                                    </Space>
                                }
                            />
                        </div>
                    );
                })()}
                {current && (() => {
                    const days = Number(current?.days || 1);
                    const items = Array.isArray(current?.items) ? current.items : [];
                    const rentalPerDay = items.reduce((sum, it) => sum + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0);
                    const rentalTotal = rentalPerDay * days;
                    const depositTotal = items.reduce((sum, it) => sum + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
                    const invoiceStatus = invoiceInfo?.invoiceStatus;
                    const paymentStatus = invoiceStatus
                        ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
                        : String(current.paymentStatus || "unpaid").toLowerCase();
                    const canPay =
                        ["unpaid", "partial"].includes(paymentStatus) &&
                        String(current.orderStatus).toLowerCase() === "processing" &&
                        hasSignedContract(current.id);
                    const totalAmount = Number(current?.total ?? rentalTotal) + depositTotal;

                    const allTabs = [
                        {
                            key: "overview",
                            label: "Tổng quan",
                            children: (
                                <div style={{ padding: 24 }}>
                                    <Card
                                        style={{
                                            marginBottom: 24,
                                            borderRadius: 12,
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                            border: "1px solid #e8e8e8",
                                        }}
                                    >
                                        <Descriptions bordered column={2} size="middle">
                                            <Descriptions.Item label="Mã đơn"><Text strong>{current.displayId ?? current.id}</Text></Descriptions.Item>
                                            <Descriptions.Item label="Ngày tạo đơn">{formatDateTime(current.createdAt)}</Descriptions.Item>
                                            {/* Ngày bắt đầu: ưu tiên hiển thị chính thức, nếu không có thì hiện dự kiến */}
                                            {current.startDate ? (
                                                <Descriptions.Item label="Ngày bắt đầu thuê (Chính thức)">
                                                    <Text strong>
                                                        {formatDateTime(current.startDate)}
                                                    </Text>
                                                </Descriptions.Item>
                                            ) : (
                                                <Descriptions.Item label="Ngày bắt đầu thuê (Dự kiến)">
                                                    {current.planStartDate ? formatDateTime(current.planStartDate) : "—"}
                                                </Descriptions.Item>
                                            )}
                                            {/* Ngày kết thúc: ưu tiên hiển thị chính thức, nếu không có thì hiện dự kiến */}
                                            {current.endDate ? (
                                                <Descriptions.Item label="Ngày kết thúc thuê (Chính thức)">
                                                    <Text strong>
                                                        {formatDateTime(current.endDate)}
                                                    </Text>
                                                </Descriptions.Item>
                                            ) : (
                                                <Descriptions.Item label="Ngày kết thúc thuê (Dự kiến)">
                                                    {current.planEndDate ? formatDateTime(current.planEndDate) : "—"}
                                                </Descriptions.Item>
                                            )}
                                            <Descriptions.Item label="Trạng thái đơn">
                                                <Tag color={(ORDER_STATUS_MAP[current.orderStatus] || {}).color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                                    {(ORDER_STATUS_MAP[current.orderStatus] || {}).label ?? current.orderStatus ?? "—"}
                                                </Tag>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Thanh toán">
                                                {(() => {
                                                    const displayPaymentStatus = invoiceStatus
                                                        ? mapInvoiceStatusToPaymentStatus(invoiceStatus)
                                                        : (String(current.orderStatus).toLowerCase() === "delivery_confirmed" ? "paid" : current.paymentStatus);
                                                    const paymentInfo = PAYMENT_STATUS_MAP[displayPaymentStatus] || {};
                                                    return (
                                                        <Tag color={paymentInfo.color} style={{ borderRadius: 20, padding: "0 12px" }}>
                                                            {paymentInfo.label ?? displayPaymentStatus ?? "—"}
                                                        </Tag>
                                                    );
                                                })()}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Tổng tiền thuê">
                                                <Space direction="vertical" size={0}>
                                                    <Text strong>{formatVND(Number(current?.total ?? rentalTotal))}</Text>
                                                </Space>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Tổng tiền cọc">
                                                <Space direction="vertical" size={0}>
                                                    <Text strong>{formatVND(depositTotal)}</Text>
                                                </Space>
                                            </Descriptions.Item>
                                        </Descriptions>
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
                                                Sản phẩm trong đơn
                                            </Title>
                                        }
                                    >
                                        <Table
                                            rowKey={(r, idx) => `${r.deviceModelId || r.name}-${idx}`}
                                            dataSource={items}
                                            pagination={false}
                                            size="small"
                                            scroll={{ x: 860 }}
                                            columns={[
                                                {
                                                    title: "Sản phẩm",
                                                    dataIndex: "name",
                                                    width: 240,
                                                    render: (v, r) => (
                                                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                                            <Avatar shape="square" size={40} src={r.image} style={{ borderRadius: 6 }} />
                                                            <div style={{ minWidth: 0 }}>
                                                                <Text strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13 }}>{v}</Text>
                                                            </div>
                                                        </div>
                                                    ),
                                                },
                                                { title: "SL", dataIndex: "qty", width: 60, align: "center" },
                                                { title: "Đơn giá SP/ngày", dataIndex: "pricePerDay", width: 120, align: "right", render: (v) => formatVND(v) },
                                                { title: "Số ngày thuê", key: "days", width: 80, align: "center", render: () => days },
                                                { title: "Tổng tiền thuê", key: "subtotal", width: 130, align: "right", render: (_, r) => formatVND(Number(r.pricePerDay || 0) * Number(days || 1)) },
                                                { title: "Cọc/1 SP", dataIndex: "depositAmountPerUnit", width: 120, align: "right", render: (v) => formatVND(v) },
                                                { title: "Tổng cọc", key: "depositSubtotal", width: 120, align: "right", render: (_, r) => formatVND(Number(r.depositAmountPerUnit || 0) * Number(r.qty || 1)) },
                                            ]}
                                        />
                                    </Card>

                                    <Card
                                        style={{
                                            borderRadius: 12,
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                            border: "1px solid #e8e8e8",
                                            background: canPay ? "#fafafa" : "#fff",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                            <Space direction="vertical" align="end" size="middle" style={{ width: "100%" }}>
                                                <div style={{ width: "100%", maxWidth: 360 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                                        <Text>Tổng tiền thuê ({days} ngày):</Text>
                                                        <Text strong style={{ fontSize: 15 }}>{formatVND(Number(current?.total ?? rentalTotal))}</Text>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                                        <Text>Tổng tiền cọc:</Text>
                                                        <Text strong style={{ fontSize: 15 }}>{formatVND(depositTotal)}</Text>
                                                    </div>
                                                    <Divider style={{ margin: "12px 0" }} />
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <Text style={{ fontSize: 16, fontWeight: 600 }}>Tổng thanh toán:</Text>
                                                        <Text strong style={{ color: "#1a1a1a", fontSize: 18, fontWeight: 700 }}>
                                                            {formatVND(totalAmount)}
                                                        </Text>
                                                    </div>
                                                </div>
                                            </Space>
                                        </div>
                                    </Card>
                                </div>
                            ),
                        },
                        {
                            key: "contract",
                            label: "Hợp đồng",
                            children: (
                                <MyOrderContractTab
                                    current={current}
                                    contracts={contracts}
                                    contractsLoading={contractsLoading}
                                    selectedContract={selectedContract}
                                    setSelectedContract={setSelectedContract}
                                    contractPdfPreviewUrl={contractPdfPreviewUrl}
                                    pdfGenerating={pdfGenerating}
                                    processingPayment={processingPayment}
                                    invoiceInfo={invoiceInfo}
                                    PAYMENT_STATUS_MAP={PAYMENT_STATUS_MAP}
                                    CONTRACT_STATUS_MAP={CONTRACT_STATUS_MAP}
                                    formatVND={formatVND}
                                    formatDateTime={formatDateTime}
                                    hasSignedContract={hasSignedContract}
                                    handlePayment={handlePayment}
                                    handleDownloadContract={handleDownloadContract}
                                    handleSignContract={handleSignContract}
                                    previewContractAsPdfInline={previewContractAsPdfInline}
                                    mapInvoiceStatusToPaymentStatus={mapInvoiceStatusToPaymentStatus}
                                    message={message}
                                    pdfPreviewUrl={pdfPreviewUrl}
                                    // Extensions & Annexes
                                    orderExtensions={orderExtensions}
                                    extensionsLoading={extensionsLoading}
                                    orderAnnexes={orderAnnexes}
                                    annexesLoading={annexesLoading}
                                    annexDetail={annexDetail}
                                    setAnnexDetail={setAnnexDetail}
                                    annexDetailOpen={annexDetailOpen}
                                    setAnnexDetailOpen={setAnnexDetailOpen}
                                    annexPdfBlobUrl={annexPdfBlobUrl}
                                    annexPdfGenerating={annexPdfGenerating}
                                    previewAnnexAsPdf={previewAnnexAsPdf}
                                    // Annex signing props
                                    handleSignAnnex={handleSignAnnex}
                                    annexSignModalOpen={annexSignModalOpen}
                                    setAnnexSignModalOpen={setAnnexSignModalOpen}
                                    currentAnnexId={currentAnnexId}
                                    annexPinSent={annexPinSent}
                                    signingAnnex={signingAnnex}
                                    annexSigning={annexSigning}
                                    sendAnnexPin={sendAnnexPin}
                                    handleAnnexSign={handleAnnexSign}
                                    customerProfile={customerProfile}
                                    annexSigningEmail={annexSigningEmail}
                                    confirmExtensionPayment={confirmExtensionPayment}
                                    processingPayment={processingPayment}
                                />
                            ),
                        },
                        {
                            key: "handover",
                            label: "Biên bản bàn giao",
                            children: (
                                <MyOrderHandoverTab
                                    current={current}
                                    checkoutReports={checkoutReports}
                                    checkinReports={checkinReports}
                                    handoverReportsLoading={handoverReportsLoading}
                                    selectedHandoverReport={selectedHandoverReport}
                                    setSelectedHandoverReport={setSelectedHandoverReport}
                                    selectedCheckinReport={selectedCheckinReport}
                                    setSelectedCheckinReport={setSelectedCheckinReport}
                                    handoverPdfPreviewUrl={handoverPdfPreviewUrl}
                                    checkinPdfPreviewUrl={checkinPdfPreviewUrl}
                                    handoverPdfBlobUrl={handoverPdfBlobUrl}
                                    handoverPdfGenerating={handoverPdfGenerating}
                                    formatDateTime={formatDateTime}
                                    translateHandoverStatus={translateHandoverStatus}
                                    loadOrderHandoverReports={loadOrderHandoverReports}
                                    previewHandoverReportAsPdf={previewHandoverReportAsPdf}
                                    handleDownloadHandoverPdf={handleDownloadHandoverPdf}
                                    handleSignHandoverReport={handleSignHandoverReport}
                                    message={message}
                                />
                            ),
                        },
                        {
                            key: "checkin",
                            label: "Biên bản thu hồi",
                            children: (
                                <MyOrderCheckinTab
                                    current={current}
                                    checkinReports={checkinReports}
                                    handoverReportsLoading={handoverReportsLoading}
                                    selectedCheckinReport={selectedCheckinReport}
                                    setSelectedCheckinReport={setSelectedCheckinReport}
                                    checkinPdfPreviewUrl={checkinPdfPreviewUrl}
                                    handoverPdfBlobUrl={handoverPdfBlobUrl}
                                    handoverPdfGenerating={handoverPdfGenerating}
                                    formatDateTime={formatDateTime}
                                    translateHandoverStatus={translateHandoverStatus}
                                    loadOrderHandoverReports={loadOrderHandoverReports}
                                    previewHandoverReportAsPdf={previewHandoverReportAsPdf}
                                    handleDownloadHandoverPdf={handleDownloadHandoverPdf}
                                    handleSignHandoverReport={handleSignHandoverReport}
                                    message={message}
                                />
                            ),
                        },
                        {
                            key: "return",
                            label: "Trả hàng và gia hạn",
                            children: (
                                <MyOrderReturnTab
                                    current={current}
                                    getDaysRemaining={getDaysRemaining}
                                    formatRemainingDaysText={formatRemainingDaysText}
                                    isCloseToReturnDate={isCloseToReturnDate}
                                    isReturnConfirmedSync={isReturnConfirmedSync}
                                    setReturnModalOpen={setReturnModalOpen}
                                    setExtendModalOpen={setExtendModalOpen}
                                    diffDays={diffDays}
                                    formatDateTime={formatDateTime}
                                    orderExtensions={orderExtensions}
                                    orderAnnexes={orderAnnexes}
                                />
                            ),
                        },
                        {
                            key: "settlement",
                            label: "Quyết toán & hoàn cọc",
                            children: (
                                <MyOrderSettlementTab
                                    current={current}
                                    settlementInfo={settlementInfo}
                                    settlementLoading={settlementLoading}
                                    settlementActionLoading={settlementActionLoading}
                                    splitSettlementAmounts={splitSettlementAmounts}
                                    formatVND={formatVND}
                                    SETTLEMENT_STATUS_MAP={SETTLEMENT_STATUS_MAP}
                                    handleRespondSettlement={handleRespondSettlement}
                                />
                            ),
                        },
                        {
                            key: "complaints",
                            label: "Khiếu nại",
                            children: (
                                <MyOrderComplaintsTab
                                    current={current}
                                    complaints={complaints}
                                    complaintsLoading={complaintsLoading}
                                    allocatedDevices={current?.allocatedDevices || []}
                                    onCreateComplaint={onCreateComplaint}
                                    onRefreshComplaints={onRefreshComplaints}
                                    creatingComplaint={creatingComplaint}
                                />
                            ),
                        },
                    ];

                    // Only show dynamic tabs when ALL data is ready (prevents flickering)
                    const filteredTabs = allTabs.filter(tab => {
                        // Always show overview tab
                        if (tab.key === "overview") {
                            return true;
                        }
                        // Tab "Trả hàng và gia hạn" chỉ hiển thị khi:
                        // 1. Đơn hàng ở trạng thái IN_USE
                        // 2. VÀ còn <= 1 ngày
                        if (tab.key === "return") {
                            const orderStatus = String(current?.orderStatus || "").toUpperCase();
                            const isInUse = orderStatus === "IN_USE" || orderStatus === "ACTIVE";
                            const daysLeft = getDaysRemaining(current?.planEndDate);
                            const isCloseToReturn = daysLeft !== null && daysLeft <= 1;
                            return isInUse && isCloseToReturn;
                        }
                        // Hide all dynamic tabs until detailDataReady is true
                        if (!detailDataReady) {
                            return false;
                        }
                        // After data is ready, show tabs based on whether data exists
                        if (tab.key === "contract") {
                            return contracts.length > 0;
                        }
                        if (tab.key === "handover") {
                            return checkoutReports.length > 0;
                        }
                        if (tab.key === "checkin") {
                            return checkinReports.length > 0;
                        }
                        if (tab.key === "settlement") {
                            return settlementInfo !== null;
                        }
                        // Tab khiếu nại chỉ hiển thị khi đơn đang sử dụng (IN_USE)
                        if (tab.key === "complaints") {
                            const orderStatus = String(current?.orderStatus || "").toUpperCase();
                            return orderStatus === "IN_USE";
                        }
                        return true;
                    });

                    return (
                        <Tabs
                            key={current.id}
                            activeKey={detailTab}
                            onChange={setDetailTab}
                            items={filteredTabs}
                        />
                    );
                })()}
            </Drawer>

            {/* Modal chi tiết hợp đồng */}
            <Modal
                title="Chi tiết hợp đồng"
                open={contractDetailOpen}
                onCancel={() => setContractDetailOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setContractDetailOpen(false)}>Đóng</Button>,
                    contractDetail && (() => {
                        const href = contractDetail.contractUrl || pdfPreviewUrl;
                        if (!href) return null;
                        return (
                            <>
                                <Button key="print" icon={<PrinterOutlined />} onClick={() => printPdfUrl(href)}>
                                    In
                                </Button>
                                <Button key="download-pdf" icon={<FilePdfOutlined />} href={href} target="_blank" rel="noopener">
                                    Tải PDF
                                </Button>
                            </>
                        );
                    })(),
                    contractDetail && String(contractDetail.status).toUpperCase() === "PENDING_SIGNATURE" && (
                        <Button key="sign" type="primary" onClick={() => handleSignContract(contractDetail.id)}>
                            Ký hợp đồng
                        </Button>
                    ),
                ]}
                width={900}
                style={{ top: 20 }}
            >
                {loadingContractDetail ? (
                    <div style={{ textAlign: "center", padding: 32 }}>
                        <Text type="secondary">Đang tải…</Text>
                    </div>
                ) : contractDetail ? (
                    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <Card
                            title={
                                <div style={{ textAlign: 'center' }}>
                                    <Title level={2} style={{ margin: 0, color: '#1a1a1a' }}>
                                        {contractDetail.title}
                                    </Title>
                                    <Text type="secondary">Số hợp đồng: {contractDetail.number}</Text>
                                </div>
                            }
                            style={{ marginBottom: 16 }}
                        >
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card size="small" title="Thông tin cơ bản">
                                        {(() => {
                                            const statusKey = String(contractDetail.status || "").toLowerCase();
                                            const statusInfo = CONTRACT_STATUS_MAP[statusKey] || { label: contractDetail.status || "—", color: "default" };
                                            const typeKey = String(contractDetail.type || "").toUpperCase();
                                            const contractType = CONTRACT_TYPE_LABELS[typeKey] || contractDetail.type || "—";
                                            const customerName = contractCustomer?.fullName || contractCustomer?.name || `Khách hàng #${contractDetail.customerId}`;
                                            const customerEmail = contractCustomer?.email;
                                            const customerPhone = contractCustomer?.phoneNumber;
                                            return (
                                                <Descriptions size="small" column={1}>
                                                    <Descriptions.Item label="Mã hợp đồng">#{contractDetail.id}</Descriptions.Item>
                                                    <Descriptions.Item label="Đơn thuê">#{contractDetail.orderId}</Descriptions.Item>
                                                    <Descriptions.Item label="Bên khách hàng">
                                                        <div>
                                                            <div><strong>{customerName}</strong></div>
                                                            <div style={{ color: "#999", fontSize: 11 }}>ID: #{contractDetail.customerId}</div>
                                                            {customerEmail && (<div style={{ color: "#666", fontSize: 12 }}>{customerEmail}</div>)}
                                                            {customerPhone && (<div style={{ color: "#666", fontSize: 12 }}>{customerPhone}</div>)}
                                                        </div>
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="Bên cho thuê">
                                                        <strong>CÔNG TY TECHRENT</strong>
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="Loại hợp đồng">
                                                        <Tag color="blue">{contractType}</Tag>
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="Trạng thái">
                                                        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                                                    </Descriptions.Item>
                                                </Descriptions>
                                            );
                                        })()}
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card size="small" title="Thời gian">
                                        <Descriptions size="small" column={1}>
                                            <Descriptions.Item label="Ngày bắt đầu">{contractDetail.startDate ? formatDateTime(contractDetail.startDate) : "—"}</Descriptions.Item>
                                            <Descriptions.Item label="Ngày kết thúc">{contractDetail.endDate ? formatDateTime(contractDetail.endDate) : "—"}</Descriptions.Item>
                                            <Descriptions.Item label="Số ngày thuê">{contractDetail.rentalPeriodDays ? `${contractDetail.rentalPeriodDays} ngày` : "—"}</Descriptions.Item>
                                            <Descriptions.Item label="Hết hạn">{contractDetail.expiresAt ? formatDateTime(contractDetail.expiresAt) : "—"}</Descriptions.Item>
                                        </Descriptions>
                                    </Card>
                                </Col>
                            </Row>

                            <Divider />

                            <Card size="small" title="Nội dung hợp đồng">
                                <div
                                    style={{
                                        border: '1px solid #f0f0f0',
                                        padding: 16,
                                        borderRadius: 6,
                                        backgroundColor: '#fafafa',
                                        maxHeight: '200px',
                                        overflowY: 'auto'
                                    }}
                                    dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(contractDetail.contentHtml || "—") }}
                                />
                            </Card>

                            <Divider />

                            <Card size="small" title="Điều khoản và điều kiện">
                                <div
                                    style={{
                                        border: '1px solid #f0f0f0',
                                        padding: 16,
                                        borderRadius: 6,
                                        backgroundColor: '#fafafa',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        whiteSpace: 'pre-line'
                                    }}
                                >
                                    {contractDetail.terms || "—"}
                                </div>
                            </Card>
                        </Card>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Text type="secondary">Không có dữ liệu hợp đồng</Text>
                    </div>
                )}
            </Modal>

            {/* Modal xem trước PDF do FE kết xuất */}
            <Modal
                title="Xem trước PDF hợp đồng (HTML→PDF)"
                open={pdfModalOpen}
                onCancel={() => {
                    setPdfModalOpen(false);
                }}
                footer={[
                    <Button key="close" onClick={() => {
                        setPdfModalOpen(false);
                    }}>
                        Đóng
                    </Button>,
                    <Button key="print" icon={<PrinterOutlined />} onClick={() => printPdfUrl(pdfBlobUrl)} disabled={!pdfBlobUrl}>
                        In
                    </Button>,
                    <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={downloadContractAsPdf} loading={pdfGenerating}>
                        Tải PDF
                    </Button>,
                ]}
                width={900}
                style={{ top: 24 }}
            >
                {pdfBlobUrl ? (
                    <iframe title="PDFPreview" src={pdfBlobUrl} style={{ width: "100%", height: "70vh", border: "none" }} />
                ) : (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <Text type="secondary">Đang tạo bản xem trước…</Text>
                    </div>
                )}
            </Modal>

            {/* Modal ký hợp đồng */}
            <Modal
                title="Ký hợp đồng"
                open={signModalOpen}
                onCancel={() => {
                    setSignModalOpen(false);
                    setCurrentContractId(null);
                    setPinSent(false);
                }}
                footer={null}
                destroyOnClose
            >
                <Form layout="vertical" onFinish={pinSent ? handleSign : sendPin}>
                    {!pinSent ? (
                        <>
                            <Text>Email nhận mã PIN: <strong>{customerProfile?.email || "Chưa cập nhật"}</strong></Text>
                            <Divider />
                            <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                                <Button
                                    onClick={() => {
                                        setSignModalOpen(false);
                                        setCurrentContractId(null);
                                        setPinSent(false);
                                    }}
                                >
                                    Hủy
                                </Button>
                                <Button type="primary" htmlType="submit" loading={signingContract} disabled={!customerProfile?.email}>
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
                                <Button onClick={() => setPinSent(false)}>Quay lại</Button>
                                <Button type="primary" htmlType="submit" loading={signing}>
                                    Ký hợp đồng
                                </Button>
                            </Space>
                        </>
                    )}
                </Form>
            </Modal>

            {/* Modal xem trước PDF biên bản bàn giao */}
            <Modal
                title="Xem trước biên bản bàn giao"
                open={handoverPdfModalOpen}
                onCancel={() => {
                    setHandoverPdfModalOpen(false);
                    setSelectedHandoverReport(null);
                }}
                width="90%"
                style={{ top: 20 }}
                footer={[
                    <Button
                        key="download"
                        icon={<DownloadOutlined />}
                        onClick={() => {
                            if (selectedHandoverReport) {
                                handleDownloadHandoverPdf(selectedHandoverReport);
                            }
                        }}
                        loading={handoverPdfGenerating}
                    >
                        Tải PDF
                    </Button>,
                    <Button
                        key="close"
                        onClick={() => {
                            setHandoverPdfModalOpen(false);
                            setSelectedHandoverReport(null);
                        }}
                    >
                        Đóng
                    </Button>,
                ]}
            >
                {handoverPdfBlobUrl ? (
                    <iframe
                        src={handoverPdfBlobUrl}
                        style={{ width: "100%", height: "80vh", border: "none" }}
                        title="Handover PDF Preview"
                    />
                ) : (
                    <div style={{ textAlign: "center", padding: "40px" }}>
                        <Text>Đang tạo PDF...</Text>
                    </div>
                )}
            </Modal>

            {/* Modal ký biên bản bàn giao */}
            <Modal
                title="Ký biên bản bàn giao"
                open={handoverSignModalOpen}
                onCancel={() => {
                    setHandoverSignModalOpen(false);
                    setCurrentHandoverReportId(null);
                    setHandoverPinSent(false);
                }}
                footer={null}
                destroyOnClose
            >
                <Form layout="vertical" onFinish={handoverPinSent ? handleSignHandover : sendHandoverPin}>
                    {!handoverPinSent ? (
                        <>
                            <Text>Email nhận mã PIN: <strong>{customerProfile?.email || "Chưa cập nhật"}</strong></Text>
                            <Divider />
                            <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                                <Button
                                    onClick={() => {
                                        setHandoverSignModalOpen(false);
                                        setCurrentHandoverReportId(null);
                                        setHandoverPinSent(false);
                                    }}
                                >
                                    Hủy
                                </Button>
                                <Button type="primary" htmlType="submit" loading={signingHandover} disabled={!customerProfile?.email}>
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
                                <Button onClick={() => setHandoverPinSent(false)}>Quay lại</Button>
                                <Button type="primary" htmlType="submit" loading={handoverSigning}>
                                    Ký biên bản
                                </Button>
                            </Space>
                        </>
                    )}
                </Form>
            </Modal>

            {/* Modal xác nhận trả hàng */}
            <Modal
                title="Xác nhận trả hàng"
                open={returnModalOpen}
                onCancel={() => setReturnModalOpen(false)}
                onOk={handleConfirmReturn}
                okText="Xác nhận trả hàng"
                okButtonProps={{ loading: processingReturn, danger: true }}
                cancelText="Hủy"
                destroyOnClose
            >
                <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    <Alert
                        type="warning"
                        showIcon
                        message="Bạn có chắc chắn muốn trả hàng?"
                        description={
                            <div>
                                {current && (
                                    <div style={{ marginTop: 12 }}>
                                        <Text strong>Thông tin đơn hàng:</Text>
                                        <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                                            <li>Mã đơn: <Text strong>#{current.displayId ?? current.id}</Text></li>
                                            <li>Ngày kết thúc thuê: <Text strong>{current.planEndDate ? formatDateTime(current.planEndDate) : "—"}</Text></li>
                                            {(() => {
                                                const days = getDaysRemaining(current.planEndDate);
                                                if (days === null) return null;
                                                return (
                                                    <li>
                                                        Thời gian còn lại: <Text strong>{formatRemainingDaysText(days)}</Text>
                                                    </li>
                                                );
                                            })()}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        }
                    />
                </Space>
            </Modal>

            {/* Modal yêu cầu gia hạn */}
            <Modal
                title="Yêu cầu gia hạn đơn hàng"
                open={extendModalOpen}
                onCancel={() => {
                    setExtendModalOpen(false);
                    setExtendedEndTime(null);
                }}
                onOk={handleExtendRequest}
                okText="Gửi yêu cầu"
                cancelText="Hủy"
                okButtonProps={{ loading: processingExtend }}
                destroyOnClose
            >
                <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    {current && (
                        <>
                            <Alert
                                type="info"
                                showIcon
                                message="Thông tin đơn hàng"
                                description={
                                    <div>
                                        <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                                            <li>Mã đơn: <Text strong>#{current.displayId ?? current.id}</Text></li>
                                            {/* Ngày bắt đầu: ưu tiên chính thức, fallback dự kiến */}
                                            <li>
                                                {current.startDate ? (
                                                    <>Ngày bắt đầu thuê: <Text strong>{formatDateTime(current.startDate)}</Text></>
                                                ) : (
                                                    <>Ngày bắt đầu thuê (Dự kiến): <Text strong>{current.planStartDate ? formatDateTime(current.planStartDate) : "—"}</Text></>
                                                )}
                                            </li>
                                            {/* Ngày kết thúc: ưu tiên chính thức, fallback dự kiến */}
                                            <li>
                                                {current.endDate ? (
                                                    <>Ngày kết thúc thuê: <Text strong>{formatDateTime(current.endDate)}</Text></>
                                                ) : (
                                                    <>Ngày kết thúc thuê (Dự kiến): <Text strong>{current.planEndDate ? formatDateTime(current.planEndDate) : "—"}</Text></>
                                                )}
                                            </li>
                                            {(() => {
                                                const endDate = current.endDate || current.planEndDate;
                                                const days = getDaysRemaining(endDate);
                                                if (days === null) return null;
                                                return (
                                                    <li>
                                                        Thời gian còn lại: <Text strong>{formatRemainingDaysText(days)}</Text>
                                                    </li>
                                                );
                                            })()}
                                        </ul>
                                    </div>
                                }
                            />
                            <Form.Item
                                label="Ngày kết thúc mới"
                                required
                                help="Chọn ngày kết thúc mới (tối thiểu 1 ngày sau ngày kết thúc dự kiến)."
                            >
                                {(() => {
                                    // Tính ngày tối thiểu: 1 ngày sau planEndDate
                                    const planEndDate = current?.planEndDate || current?.endDate;
                                    const minDate = planEndDate ? dayjs(planEndDate).add(1, 'day').startOf('day') : dayjs().add(1, 'day');
                                    // Lấy giờ gốc từ planEndDate để giữ lại
                                    const originalTime = planEndDate ? dayjs(planEndDate) : dayjs().hour(9).minute(0);
                                    
                                    return (
                                        <DatePicker
                                            style={{ width: "100%" }}
                                            format="DD/MM/YYYY HH:mm"
                                            placeholder="Chọn ngày kết thúc mới"
                                            value={extendedEndTime ? dayjs(extendedEndTime) : null}
                                            onChange={(date) => {
                                                if (date) {
                                                    // Đặt ngày mới với giờ từ ngày kết thúc gốc
                                                    const finalDate = date
                                                        .hour(originalTime.hour())
                                                        .minute(originalTime.minute())
                                                        .second(originalTime.second());
                                                    setExtendedEndTime(finalDate.format("YYYY-MM-DDTHH:mm:ss"));
                                                } else {
                                                    setExtendedEndTime(null);
                                                }
                                            }}
                                            disabledDate={(currentDate) => {
                                                if (!currentDate) return false;
                                                // Ngày phải >= ngày của minDate
                                                return currentDate.isBefore(minDate, "day");
                                            }}
                                        />
                                    );
                                })()}
                            </Form.Item>
                            {extendedEndTime && (current?.planEndDate || current?.endDate) && (() => {
                                const currentEnd = new Date(current.planEndDate || current.endDate);
                                const newEnd = new Date(extendedEndTime);
                                const diffDaysVal = Math.ceil((newEnd - currentEnd) / (1000 * 60 * 60 * 24));
                                return (
                                    <Alert
                                        type="success"
                                        message={`Đơn hàng sẽ được gia hạn thêm ${diffDaysVal} ngày`}
                                        description={`Ngày kết thúc mới: ${formatDateTime(extendedEndTime)}`}
                                    />
                                );
                            })()}
                        </>
                    )}
                </Space>
            </Modal>

            {/* Modal chọn phương thức thanh toán */}
            <Modal
                title="Thanh toán đơn hàng"
                open={paymentModalOpen}
                onCancel={() => setPaymentModalOpen(false)}
                onOk={confirmCreatePayment}
                okText="Thanh toán"
                okButtonProps={{ disabled: !paymentTermsAccepted, loading: processingPayment }}
                destroyOnClose
            >
                {(() => {
                    const order = paymentOrder || current;
                    const items = order?.items || [];
                    const days = Number(order?.days || 1);
                    const rentalTotalRecalc = items.reduce((s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0) * days;
                    const totalPriceFromBE = Number(order?.total ?? rentalTotalRecalc);
                    const depositTotal = items.reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
                    const totalAmount = totalPriceFromBE + depositTotal;
                    return (
                        <Space direction="vertical" style={{ width: "100%" }} size="large">
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <Text>Tổng tiền thuê:</Text>
                                <Text strong>{formatVND(totalPriceFromBE)}</Text>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <Text>Tổng tiền cọc:</Text>
                                <Text strong>{formatVND(depositTotal)}</Text>
                            </div>
                            <Divider style={{ margin: "8px 0" }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Text style={{ fontSize: 15, fontWeight: 600 }}>Tổng thanh toán</Text>
                                <Text strong style={{ fontSize: 18 }}>{formatVND(totalAmount)}</Text>
                            </div>

                            <div>
                                <Text style={{ display: "block", marginBottom: 8 }}>Phương thức thanh toán</Text>
                                <Radio.Group
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    optionType="button"
                                    buttonStyle="solid"
                                >
                                    <Radio.Button value="VNPAY">VNPay</Radio.Button>
                                    <Radio.Button value="PAYOS">PayOS</Radio.Button>
                                </Radio.Group>
                            </div>

                            <Checkbox
                                checked={paymentTermsAccepted}
                                onChange={(e) => setPaymentTermsAccepted(e.target.checked)}
                            >
                                Tôi đồng ý với các{" "}
                                <a
                                    href="https://www.techrent.website/api/admin/policies/5/file"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    điều khoản thanh toán
                                </a>
                            </Checkbox>
                        </Space>
                    );
                })()}
            </Modal>

            {/* Container ẩn để render handover report PDF */}
            <div
                ref={handoverPrintRef}
                style={{
                    position: "fixed",
                    left: "-99999px",
                    top: "-99999px",
                    width: "794px",
                    height: "auto",
                    backgroundColor: "#ffffff",
                    fontFamily: "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif",
                    visibility: "hidden",
                    opacity: 0,
                    pointerEvents: "none",
                    zIndex: -9999,
                    overflow: "hidden",
                    border: "none",
                    margin: 0,
                    padding: 0,
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale"
                }}
            />

            <style>{`
        .modern-table .ant-table-thead > tr > th {
          background: #fafafa;
          font-weight: 600;
          color: #1a1a1a;
          border-bottom: 1px solid #e8e8e8;
          padding: 12px;
          font-size: 13px;
        }
        .modern-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f0f0f0;
          transition: all 0.3s ease;
          padding: 12px;
        }
        .modern-table .ant-table-tbody > tr:hover > td {
          background: #f5f5f5 !important;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .modern-table .ant-table-tbody > tr {
          transition: all 0.3s ease;
        }
        .modern-table .ant-table-container {
          overflow: auto hidden;
          border-radius: 12px;
        }
        .modern-table .ant-table {
          border-radius: 12px;
          overflow: hidden;
        }
        .ant-drawer-content {
          border-radius: 0;
          overflow: hidden;
        }
        .ant-drawer-header {
          border-bottom: 1px solid #e8e8e8;
        }
        .ant-tabs-tab {
          font-weight: 500;
          font-size: 15px;
        }
        .ant-tabs-tab-active {
          font-weight: 600;
        }
        .ant-card {
          transition: all 0.3s ease;
        }
        .ant-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
        }
        .order-tracking-steps .ant-steps-item {
          flex: 0 0 auto !important;
          min-width: 140px;
          margin-right: 8px !important;
        }
        .order-tracking-steps .ant-steps-item-title {
          font-size: 13px !important;
          line-height: 1.4 !important;
          padding-right: 0 !important;
        }
        .order-tracking-steps .ant-steps-item-description {
          font-size: 11px !important;
          margin-top: 4px !important;
        }
        .order-tracking-steps .ant-steps-item-content {
          max-width: 160px;
        }
      `}</style>
        </>
    );
}
