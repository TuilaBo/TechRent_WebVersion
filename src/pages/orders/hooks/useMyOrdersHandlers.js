/**
 * useMyOrdersHandlers - Custom hook containing handler functions extracted from MyOrders.jsx
 * This hook contains exact implementations from the original component
 */
import { message } from "antd";
import { listRentalOrders, getRentalOrderById, confirmReturnRentalOrder, extendRentalOrder } from "../../../lib/rentalOrdersApi";
import { getDeviceModelById } from "../../../lib/deviceModelsApi";
import { getContractById, normalizeContract, sendPinEmail, signContract as signContractApi } from "../../../lib/contractApi";
import { fetchMyCustomerProfile, normalizeCustomer } from "../../../lib/customerApi";
import { getMyKyc } from "../../../lib/kycApi";
import { createPayment } from "../../../lib/Payment";
import { getSettlementByOrderId, respondSettlement } from "../../../lib/settlementApi";
import { sendCustomerHandoverReportPin, updateCustomerHandoverReportSignature } from "../../../lib/handoverReportApi";
import { getConditionDefinitions } from "../../../lib/condition.js";
import { augmentContractContent } from "../../../lib/contractPrintUtils";
import { buildPrintableHandoverReportHtml, elementToPdfBlobHandover } from "../../../lib/handoverReportPrintUtils";
import { buildPrintableHtml, elementToPdfBlob } from "../utils/myOrderPdfUtils";
import { mapOrderFromApi } from "../utils/myOrderHelpers";
import { createPrintSandbox, cleanupPrintSandbox } from "../../../lib/orderUtils";

/**
 * Custom hook that provides all handler functions for MyOrders component
 * @param {Object} deps - Dependencies object containing state, setters, and helper functions
 * @returns {Object} All handler functions
 */
export function useMyOrdersHandlers(deps) {
    const {
        // State values
        current,
        contracts,
        contractDetail,
        settlementInfo,
        extendedEndTime,
        contractCustomer,
        customerProfile,
        currentContractId,
        currentHandoverReportId,
        paymentOrder,
        paymentMethod,
        paymentTermsAccepted,
        selectedContract,
        pdfBlobUrl,
        contractPdfPreviewUrl,

        // State setters
        setCurrent,
        setProcessingReturn,
        setReturnModalOpen,
        setConfirmedReturnOrders,
        setDetailTab,
        setSettlementActionLoading,
        setProcessingExtend,
        setExtendModalOpen,
        setExtendedEndTime,
        setPdfGenerating,
        setCustomerProfile,
        setContractDetail,
        setContractDetailOpen,
        setLoadingContractDetail,
        setContractCustomer,
        setSignModalOpen,
        setCurrentContractId,
        setPinSent,
        setSigningContract,
        setSigning,
        setHandoverSignModalOpen,
        setCurrentHandoverReportId,
        setHandoverPinSent,
        setSigningHandover,
        setHandoverSigning,
        setPaymentModalOpen,
        setPaymentOrder,
        setPaymentMethod,
        setPaymentTermsAccepted,
        setProcessingPayment,
        setPdfModalOpen,
        setPdfBlobUrl,
        setPdfPreviewUrl,
        setContractPdfPreviewUrl,
        setSelectedContract,
        setHandoverPdfGenerating,

        // Refs
        handoverPrintRef,

        // Helper functions from parent
        loadOrders,
        loadOrderSettlement,
        loadOrderContracts,
        loadOrderHandoverReports,
        loadAllContracts,
        revokeBlob,
    } = deps;

    // ========== RETURN/EXTEND HANDLERS ==========

    const handleConfirmReturn = async () => {
        if (!current || !current.id) {
            message.error("Không có thông tin đơn hàng để trả.");
            return;
        }
        try {
            setProcessingReturn(true);
            await confirmReturnRentalOrder(current.id);
            message.success("Đã xác nhận trả hàng. Chúng tôi sẽ liên hệ với bạn để thu hồi thiết bị.");
            setReturnModalOpen(false);
            if (current?.id) {
                setConfirmedReturnOrders(prev => {
                    const newSet = new Set([...prev, current.id]);
                    try {
                        localStorage.setItem("confirmedReturnOrders", JSON.stringify(Array.from(newSet)));
                    } catch (e) {
                        console.error("Failed to save confirmed return orders to localStorage:", e);
                    }
                    return newSet;
                });
            }
            await loadOrders();
            const updatedOrder = await getRentalOrderById(current.id);
            if (updatedOrder) {
                const mapped = await mapOrderFromApi(updatedOrder);
                setCurrent(mapped);
                setConfirmedReturnOrders(prev => {
                    const newSet = new Set([...prev, current.id]);
                    try {
                        localStorage.setItem("confirmedReturnOrders", JSON.stringify(Array.from(newSet)));
                    } catch (e) {
                        console.error("Failed to save confirmed return orders to localStorage:", e);
                    }
                    return newSet;
                });
                setDetailTab("return");
            }
        } catch (error) {
            console.error("Error confirming return:", error);
            message.error(error?.response?.data?.message || error?.message || "Không thể xác nhận trả hàng.");
        } finally {
            setProcessingReturn(false);
        }
    };

    const handleRespondSettlement = async (accepted) => {
        if (!settlementInfo) {
            message.warning("Chưa có quyết toán để xử lý.");
            return;
        }
        const settlementId = settlementInfo.settlementId || settlementInfo.id;
        if (!settlementId) {
            message.error("Không tìm thấy ID settlement.");
            return;
        }
        try {
            setSettlementActionLoading(true);
            await respondSettlement(settlementId, accepted);
            message.success(accepted ? "Bạn đã chấp nhận quyết toán thành công." : "Bạn đã từ chối quyết toán.");
            await loadOrderSettlement(settlementInfo.orderId || current?.id || settlementInfo.orderId);
        } catch (error) {
            console.error("Failed to respond settlement:", error);
            message.error(error?.response?.data?.message || error?.message || "Không xử lý được yêu cầu.");
        } finally {
            setSettlementActionLoading(false);
        }
    };

    const handleExtendRequest = async () => {
        if (!current || !current.id) {
            message.error("Không có thông tin đơn hàng để gia hạn.");
            return;
        }
        if (!extendedEndTime) {
            message.warning("Vui lòng chọn ngày kết thúc mới cho đơn hàng.");
            return;
        }
        if (current.endDate) {
            const currentEndDate = new Date(current.endDate);
            const newEndDate = new Date(extendedEndTime);
            if (newEndDate <= currentEndDate) {
                message.error("Ngày kết thúc mới phải sau ngày kết thúc hiện tại.");
                return;
            }
        }
        try {
            setProcessingExtend(true);
            const result = await extendRentalOrder(current.id, extendedEndTime);
            if (result) {
                message.success("Yêu cầu gia hạn đơn hàng đã được gửi thành công!");
                setExtendModalOpen(false);
                setExtendedEndTime(null);
                await loadOrders();
                if (current?.id) {
                    const updatedOrder = await getRentalOrderById(current.id);
                    if (updatedOrder) {
                        setCurrent(updatedOrder);
                    }
                }
            } else {
                message.error("Không thể gửi yêu cầu gia hạn. Vui lòng thử lại.");
            }
        } catch (error) {
            console.error("Error extending rental order:", error);
            message.error(error?.response?.data?.message || error?.message || "Không thể gửi yêu cầu gia hạn. Vui lòng thử lại.");
        } finally {
            setProcessingExtend(false);
        }
    };

    // ========== CONTRACT HANDLERS ==========

    const handleDownloadContract = async (record) => {
        let sandbox = null;
        try {
            if (record?.contractUrl) {
                const a = document.createElement("a");
                a.href = record.contractUrl;
                a.target = "_blank";
                a.rel = "noopener";
                a.download = record.contractFileName || `contract-${record.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return;
            }
            setPdfGenerating(true);
            let customer = contractCustomer || customerProfile;
            if (!customer) {
                try {
                    const prof = await fetchMyCustomerProfile();
                    customer = normalizeCustomer(prof || {});
                    setCustomerProfile(customer);
                } catch { /* ignore */ }
            }
            let kyc = null;
            try { kyc = await getMyKyc(); } catch { /* ignore */ }
            const detail = augmentContractContent(record);
            sandbox = createPrintSandbox();
            if (!sandbox) {
                message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
                return;
            }
            sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);
            const blob = await elementToPdfBlob(sandbox);
            const a = document.createElement("a");
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = detail.contractFileName || detail.number || `contract-${detail.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (e) {
            console.error("Download contract error:", e);
            message.error("Không thể tạo/tải PDF.");
        } finally {
            cleanupPrintSandbox(sandbox);
            setPdfGenerating(false);
        }
    };

    const viewContractDetail = async (contractId) => {
        try {
            setLoadingContractDetail(true);
            const contract = await getContractById(contractId);
            const normalized = normalizeContract(contract);
            setContractDetail(normalized);
            if (normalized?.contractUrl) setPdfPreviewUrl(normalized.contractUrl);
            if (customerProfile) setContractCustomer(customerProfile);
            else {
                try {
                    const profile = await fetchMyCustomerProfile();
                    const normalizedProfile = normalizeCustomer(profile || {});
                    setCustomerProfile(normalizedProfile);
                    setContractCustomer(normalizedProfile);
                } catch (e) {
                    console.error("Failed to fetch customer profile:", e);
                    setContractCustomer(null);
                }
            }
            setContractDetailOpen(true);
        } catch (e) {
            message.error(e?.response?.data?.message || e?.message || "Không tải được chi tiết hợp đồng.");
        } finally {
            setLoadingContractDetail(false);
        }
    };

    const handleSignContract = async (contractId) => {
        if (!contractId) { message.error("ID hợp đồng không hợp lệ"); return; }
        let profile = customerProfile;
        if (!profile) {
            try {
                const loaded = await fetchMyCustomerProfile();
                profile = normalizeCustomer(loaded || {});
                setCustomerProfile(profile);
            } catch {
                message.error("Không thể tải thông tin khách hàng.");
                return;
            }
        }
        if (!profile?.email) {
            message.error("Không tìm thấy email trong tài khoản. Vui lòng cập nhật thông tin cá nhân.");
            return;
        }
        setCurrentContractId(contractId);
        setSignModalOpen(true);
        setPinSent(false);
    };

    const sendPin = async () => {
        if (!currentContractId || !customerProfile?.email) {
            message.error("Không tìm thấy email để gửi mã PIN.");
            return;
        }
        try {
            setSigningContract(true);
            await sendPinEmail(currentContractId, customerProfile.email);
            message.success("Đã gửi mã PIN đến email của bạn!");
            setPinSent(true);
        } catch (e) {
            message.error(e?.response?.data?.message || e?.message || "Không gửi được mã PIN.");
        } finally {
            setSigningContract(false);
        }
    };

    const handleSign = async (values) => {
        if (!currentContractId) {
            message.error("Không tìm thấy hợp đồng để ký.");
            return;
        }
        try {
            setSigning(true);
            await signContractApi(currentContractId, {
                pinCode: values.pinCode,
                signatureMethod: "EMAIL_OTP",
            });
            message.success("Ký hợp đồng thành công!");
            message.success("Bạn đã ký hợp đồng thành công. Vui lòng thanh toán để hoàn tất đơn.");
            setSignModalOpen(false);
            setCurrentContractId(null);
            setPinSent(false);
            await loadOrderContracts(current?.id);
            await loadAllContracts();
        } catch (e) {
            message.error(e?.response?.data?.message || e?.message || "Không thể ký hợp đồng.");
        } finally {
            setSigning(false);
        }
    };

    // ========== HANDOVER HANDLERS ==========

    const handleSignHandoverReport = async (reportId) => {
        if (!reportId) {
            message.error("ID biên bản không hợp lệ");
            return;
        }
        if (!customerProfile?.email) {
            message.error("Không tìm thấy email trong tài khoản. Vui lòng cập nhật thông tin cá nhân.");
            return;
        }
        setCurrentHandoverReportId(reportId);
        setHandoverSignModalOpen(true);
        setHandoverPinSent(false);
    };

    const sendHandoverPin = async () => {
        if (!currentHandoverReportId || !customerProfile?.email) {
            message.error("Không tìm thấy email để gửi mã PIN.");
            return;
        }
        try {
            setSigningHandover(true);
            await sendCustomerHandoverReportPin(currentHandoverReportId, { email: customerProfile.email });
            message.success("Đã gửi mã PIN đến email của bạn!");
            setHandoverPinSent(true);
        } catch (e) {
            message.error(e?.response?.data?.message || e?.message || "Không gửi được mã PIN.");
        } finally {
            setSigningHandover(false);
        }
    };

    const handleSignHandover = async (values) => {
        if (!currentHandoverReportId) {
            message.error("Không tìm thấy biên bản để ký.");
            return;
        }
        try {
            setHandoverSigning(true);
            const customerSignature = customerProfile?.fullName || customerProfile?.name || customerProfile?.email || "";
            await updateCustomerHandoverReportSignature(currentHandoverReportId, {
                pinCode: values.pinCode,
                customerSignature: customerSignature,
            });
            message.success("Ký biên bản bàn giao thành công!");
            setHandoverSignModalOpen(false);
            setCurrentHandoverReportId(null);
            setHandoverPinSent(false);
            if (current?.id) {
                await loadOrderHandoverReports(current.id);
            }
        } catch (e) {
            message.error(e?.response?.data?.message || e?.message || "Không thể ký biên bản.");
        } finally {
            setHandoverSigning(false);
        }
    };

    const handleDownloadHandoverPdf = async (report) => {
        if (!report) return message.warning("Chưa chọn biên bản.");
        try {
            setHandoverPdfGenerating(true);
            let order = null;
            let conditionDefinitions = [];
            if (report.orderId) {
                try {
                    order = await getRentalOrderById(report.orderId);
                    if (order && Array.isArray(order.orderDetails)) {
                        const modelIds = Array.from(new Set(order.orderDetails.map(od => od.deviceModelId).filter(Boolean)));
                        const modelPairs = await Promise.all(
                            modelIds.map(async (id) => {
                                try {
                                    const m = await getDeviceModelById(id);
                                    return [id, m];
                                } catch {
                                    return [id, null];
                                }
                            })
                        );
                        const modelMap = Object.fromEntries(modelPairs);
                        order = {
                            ...order,
                            orderDetails: order.orderDetails.map(od => ({
                                ...od,
                                deviceModel: modelMap[od.deviceModelId] || null,
                            })),
                        };
                    }
                } catch (e) {
                    console.warn("Could not fetch order for PDF:", e);
                }
            }
            try {
                conditionDefinitions = await getConditionDefinitions();
            } catch (e) {
                console.warn("Could not fetch condition definitions for PDF:", e);
            }
            if (handoverPrintRef.current) {
                handoverPrintRef.current.style.visibility = "visible";
                handoverPrintRef.current.style.opacity = "1";
                handoverPrintRef.current.style.left = "-99999px";
                handoverPrintRef.current.style.top = "-99999px";
                handoverPrintRef.current.style.width = "794px";
                handoverPrintRef.current.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
                handoverPrintRef.current.innerHTML = buildPrintableHandoverReportHtml(report, order, conditionDefinitions);
                const allElements = handoverPrintRef.current.querySelectorAll('*');
                allElements.forEach(el => {
                    if (el.style) {
                        el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
                        el.style.webkitFontSmoothing = "antialiased";
                        el.style.mozOsxFontSmoothing = "grayscale";
                    }
                });
                handoverPrintRef.current.offsetHeight;
                if (document.fonts && document.fonts.ready) {
                    await document.fonts.ready;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
                const blob = await elementToPdfBlobHandover(handoverPrintRef.current);
                handoverPrintRef.current.style.visibility = "hidden";
                handoverPrintRef.current.style.opacity = "0";
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                const handoverType = String(report.handoverType || "").toUpperCase();
                const isCheckin = handoverType === "CHECKIN";
                a.download = `${isCheckin ? "checkin" : "handover"}-report-${report.handoverReportId || report.id || "report"}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(a.href), 0);
            }
        } catch (e) {
            console.error("Error downloading handover PDF:", e);
            message.error("Không thể tải PDF");
        } finally {
            setHandoverPdfGenerating(false);
        }
    };

    // ========== PAYMENT HANDLERS ==========

    const handlePayment = async (order) => {
        if (!order || !order.id) { message.error("Không có thông tin đơn hàng để thanh toán."); return; }
        setPaymentOrder(order);
        setPaymentMethod("VNPAY");
        setPaymentTermsAccepted(false);
        setPaymentModalOpen(true);
    };

    const confirmCreatePayment = async () => {
        const order = paymentOrder || current;
        if (!order || !order.id) { message.error("Không có thông tin đơn hàng để thanh toán."); return; }
        if (!paymentTermsAccepted) { message.warning("Vui lòng chấp nhận điều khoản trước khi thanh toán."); return; }
        try {
            setProcessingPayment(true);
            const items = order.items || [];
            const days = Number(order.days || 1);
            const rentalTotalRecalc = items.reduce((s, it) => s + Number(it.pricePerDay || 0) * Number(it.qty || 1), 0) * days;
            const totalPriceFromBE = Number(order.total ?? rentalTotalRecalc);
            const depositTotal = items.reduce((s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1), 0);
            const totalAmount = totalPriceFromBE + depositTotal;
            if (totalAmount <= 0) { message.error("Số tiền thanh toán không hợp lệ."); return; }

            const baseUrl = window.location.origin;
            const orderIdParam = Number(order.id);
            const orderCodeParam = order.displayId || order.id;
            const cancelUrl = `${baseUrl}/payment/cancel?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
            const frontendSuccessUrl = `${baseUrl}/success?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;
            const frontendFailureUrl = `${baseUrl}/failure?orderId=${orderIdParam}&orderCode=${encodeURIComponent(orderCodeParam)}`;

            const payload = {
                orderId: orderIdParam,
                invoiceType: "RENT_PAYMENT",
                paymentMethod: String(paymentMethod || "VNPAY").toUpperCase(),
                amount: totalAmount,
                description: `Thanh toán đơn hàng #${orderCodeParam}`,
                cancelUrl,
                frontendSuccessUrl,
                frontendFailureUrl,
            };

            const result = await createPayment(payload);
            const redirectUrl = result?.checkoutUrl || result?.payUrl || result?.deeplink || result?.qrUrl;
            if (redirectUrl) {
                localStorage.setItem("pendingPaymentOrderId", String(orderIdParam));
                localStorage.setItem("pendingPaymentOrderCode", String(orderCodeParam));
                window.location.href = redirectUrl;
            } else {
                message.error("Không nhận được link thanh toán từ hệ thống.");
            }
        } catch (error) {
            console.error("Error creating payment:", error);
            message.error(error?.response?.data?.message || error?.message || "Không thể tạo thanh toán.");
        } finally {
            setProcessingPayment(false);
        }
    };

    // ========== PDF HANDLERS ==========

    async function previewContractAsPdf() {
        if (!current?.id) return message.warning("Chưa chọn đơn.");
        const rawDetail = contractDetail || (contracts[0] ? { ...contracts[0] } : null);
        if (!rawDetail) return message.warning("Đơn này chưa có dữ liệu hợp đồng.");
        let sandbox = null;
        try {
            setPdfGenerating(true);
            revokeBlob(pdfBlobUrl);
            const detail = augmentContractContent(rawDetail);
            let customer = contractCustomer || customerProfile;
            let kyc = null;
            try {
                if (!customer) {
                    const customerData = await fetchMyCustomerProfile();
                    customer = normalizeCustomer(customerData || {});
                }
            } catch (e) {
                console.error("Failed to fetch customer profile:", e);
            }
            try {
                const kycData = await getMyKyc();
                kyc = kycData || null;
            } catch (e) {
                console.error("Failed to fetch KYC data:", e);
            }
            sandbox = createPrintSandbox();
            if (!sandbox) {
                message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
                return;
            }
            sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);
            const blob = await elementToPdfBlob(sandbox);
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
            setPdfModalOpen(true);
        } catch (e) {
            console.error(e);
            message.error("Không tạo được bản xem trước PDF.");
        } finally {
            cleanupPrintSandbox(sandbox);
            setPdfGenerating(false);
        }
    }

    async function downloadContractAsPdf() {
        if (!current?.id) return message.warning("Chưa chọn đơn.");
        const rawDetail = contractDetail || (contracts[0] ? { ...contracts[0] } : null);
        if (!rawDetail) return message.warning("Đơn này chưa có dữ liệu hợp đồng.");
        let sandbox = null;
        try {
            setPdfGenerating(true);
            revokeBlob(pdfBlobUrl);
            const detail = augmentContractContent(rawDetail);
            let customer = contractCustomer || customerProfile;
            let kyc = null;
            try {
                if (!customer) {
                    const customerData = await fetchMyCustomerProfile();
                    customer = normalizeCustomer(customerData || {});
                }
            } catch (e) {
                console.error("Failed to fetch customer profile:", e);
            }
            try {
                const kycData = await getMyKyc();
                kyc = kycData || null;
            } catch (e) {
                console.error("Failed to fetch KYC data:", e);
            }
            sandbox = createPrintSandbox();
            if (!sandbox) {
                message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
                return;
            }
            sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);
            const blob = await elementToPdfBlob(sandbox);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const name = detail.contractFileName || detail.number || `contract-${detail.id}.pdf`;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            console.error(e);
            message.error("Không thể tạo/tải PDF.");
        } finally {
            cleanupPrintSandbox(sandbox);
            setPdfGenerating(false);
        }
    }

    const previewContractAsPdfInline = async (contract) => {
        if (!contract) return message.warning("Chưa chọn hợp đồng.");
        try {
            setPdfGenerating(true);
            setSelectedContract(contract);
            if (contractPdfPreviewUrl) {
                URL.revokeObjectURL(contractPdfPreviewUrl);
                setContractPdfPreviewUrl("");
            }
            if (contract.contractUrl) {
                setContractPdfPreviewUrl(contract.contractUrl);
                setPdfGenerating(false);
                return;
            }
            if (current?.contractUrl) {
                setContractPdfPreviewUrl(current.contractUrl);
                setPdfGenerating(false);
                return;
            }
            const detail = augmentContractContent(contract);
            let customer = contractCustomer || customerProfile;
            let kyc = null;
            try {
                if (!customer) {
                    const customerData = await fetchMyCustomerProfile();
                    customer = normalizeCustomer(customerData || {});
                }
            } catch (e) {
                console.error("Failed to fetch customer profile:", e);
            }
            try {
                const kycData = await getMyKyc();
                kyc = kycData || null;
            } catch (e) {
                console.error("Failed to fetch KYC data:", e);
            }
            const sandbox = createPrintSandbox();
            if (!sandbox) {
                message.error("Không thể chuẩn bị vùng in. Vui lòng thử lại sau.");
                setPdfGenerating(false);
                return;
            }
            try {
                sandbox.style.visibility = "visible";
                sandbox.style.opacity = "1";
                sandbox.innerHTML = buildPrintableHtml(detail, customer, kyc);
                const allElements = sandbox.querySelectorAll('*');
                allElements.forEach(el => {
                    if (el.style) {
                        el.style.fontFamily = "Arial, Helvetica, 'Times New Roman', 'DejaVu Sans', sans-serif";
                        el.style.webkitFontSmoothing = "antialiased";
                        el.style.mozOsxFontSmoothing = "grayscale";
                    }
                });
                sandbox.offsetHeight;
                if (document.fonts && document.fonts.ready) {
                    await document.fonts.ready;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
                const blob = await elementToPdfBlob(sandbox);
                const url = URL.createObjectURL(blob);
                setContractPdfPreviewUrl(url);
            } finally {
                cleanupPrintSandbox(sandbox);
            }
        } catch (e) {
            console.error("Error generating contract PDF:", e);
            message.error("Không thể tạo bản xem trước PDF");
        } finally {
            setPdfGenerating(false);
        }
    };

    // Return all handlers
    return {
        // Return/Extend
        handleConfirmReturn,
        handleRespondSettlement,
        handleExtendRequest,

        // Contract
        handleDownloadContract,
        viewContractDetail,
        handleSignContract,
        sendPin,
        handleSign,

        // Handover
        handleSignHandoverReport,
        sendHandoverPin,
        handleSignHandover,
        handleDownloadHandoverPdf,

        // Payment
        handlePayment,
        confirmCreatePayment,

        // PDF
        previewContractAsPdf,
        downloadContractAsPdf,
        previewContractAsPdfInline,
    };
}
