// src/pages/CST/SupportSettlement.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  Table,
  Tag,
  Button,
  Space,
  Drawer,
  Typography,
  Modal,
  Input,
  InputNumber,
  Descriptions,
  Divider,
  Statistic,
  Card,
  Row,
  Col,
  Form,
  Alert,
} from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
  EditOutlined,
  PlusOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getRentalOrderById, fmtVND } from "../../lib/rentalOrdersApi";
import { fetchCustomerById, normalizeCustomer } from "../../lib/customerApi";
import {
  getDeviceModelById,
  normalizeModel as normalizeDeviceModel,
} from "../../lib/deviceModelsApi";
import { listTasks, normalizeTask } from "../../lib/taskApi";
import {
  createSettlement,
  updateSettlement,
  getSettlementByOrderId,
} from "../../lib/settlementApi";
import {
  getInvoiceByRentalOrderId,
  confirmRefundSettlement,
} from "../../lib/Payment";

const { Title, Text } = Typography;

const normalizeCustomerData = (customer) =>
  normalizeCustomer ? normalizeCustomer(customer) : customer;

// Map settlement status to Vietnamese labels/colors (sync with MyOrders)
const SETTLEMENT_STATUS_MAP = {
  draft: { label: "Nháp", color: "default" },
  pending: { label: "Chờ xử lý", color: "gold" },
  awaiting_customer: { label: "Chờ khách xác nhận", color: "orange" },
  submitted: { label: "Đã gửi", color: "blue" },
  issued: { label: "Đã chấp nhận", color: "green" },
  closed: { label: "Đã tất toán", color: "geekblue" },
  rejected: { label: "Đã từ chối", color: "red" },
};

// Format currency
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "—";
  return fmtVND(amount);
};

// Format date
const fmtDate = (date) => {
  if (!date) return "—";
  return dayjs(date).format("DD/MM/YYYY");
};

const renderCustomerInfo = (order = {}, detail = null, opts = {}) => {
  const source =
    detail ||
    order.customer ||
    order.customerInfo ||
    order.customerDetail ||
    {};

  const customerId =
    source.customerId ||
    detail?.customerId ||
    order.customerId ||
    order.customer?.id ||
    order.customer?.customerId ||
    order.customer?.accountId ||
    order.customerAccountId;

  const name =
    source.fullName ||
    source.name ||
    source.username ||
    order.customerName ||
    (customerId ? `Khách hàng #${customerId}` : "Khách hàng");

  const phone =
    source.phoneNumber || source.phone || order.customerPhone || order.phone;
  const email = source.email || order.customerEmail || order.email;

  const meta = [phone, email].filter(Boolean).join(" • ");

  return (
    <div>
      <div style={{ fontWeight: 600 }}>{name}</div>
      {meta && (
        <div style={{ color: "#666", fontSize: 12 }}>
          {meta}
        </div>
      )}
      {customerId && opts?.showId !== false && (
        <div style={{ color: "#999", fontSize: 11 }}>ID: #{customerId}</div>
      )}
    </div>
  );
};

const splitFinalAmounts = (finalAmount = 0) => {
  const amount = Number(finalAmount || 0);
  return {
    refundAmount: amount > 0 ? amount : 0,
    customerDueAmount: amount < 0 ? Math.abs(amount) : 0,
  };
};

export default function SupportSettlement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [settlementForm] = Form.useForm();
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState(null);
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [customerMap, setCustomerMap] = useState({});
  const customerCacheRef = useRef({});

  const upsertCustomerCache = useCallback((id, customer) => {
    if (!id || !customer) return;
    const current = customerCacheRef.current || {};
    if (current[id]) return;
    const next = { ...current, [id]: customer };
    customerCacheRef.current = next;
    setCustomerMap(next);
  }, []);

  const hydrateCustomers = useCallback(async (list = []) => {
    const ids = Array.from(
      new Set(
        list
          .map(
            (order) =>
              order?.customerId ||
              order?.customer?.customerId ||
              order?.customer?.id ||
              order?.customerAccountId
          )
          .filter(Boolean)
      )
    );
    const missing = ids.filter((id) => !customerCacheRef.current[id]);
    if (!missing.length) return;
    try {
      const pairs = await Promise.all(
        missing.map(async (id) => {
          try {
            const raw = await fetchCustomerById(id);
            return [id, normalizeCustomerData(raw)];
          } catch (err) {
            console.warn("SupportSettlement: load customer failed", id, err);
            return null;
          }
        })
      );
      const next = { ...customerCacheRef.current };
      pairs.forEach((pair) => {
        if (pair && pair[0] && pair[1]) {
          next[pair[0]] = pair[1];
        }
      });
      customerCacheRef.current = next;
      setCustomerMap(next);
    } catch (err) {
      console.warn("SupportSettlement: hydrate customers error", err);
    }
  }, []);

  // Load orders from completed DELIVERY tasks
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);

      // Get all tasks
      const allTasks = await listTasks();
      const normalizedTasks = allTasks.map(normalizeTask);

      // Filter tasks: type = PICK_UP_RENTAL_ORDER and status = COMPLETED
      const completedPickupTasks = normalizedTasks.filter((task) => {
        const taskType = String(task.type || "").toUpperCase();
        const taskCategoryName = String(
          task.taskCategoryName || ""
        ).toUpperCase();
        const taskStatus = String(task.status || "").toUpperCase();

        // Check if task is PICK_UP_RENTAL_ORDER (check both type and categoryName)
        const isPickupTask =
          taskType.includes("PICK_UP_RENTAL_ORDER") ||
          taskType.includes("PICKUP") ||
          taskType.includes("PICK UP") ||
          taskCategoryName.includes("PICK_UP_RENTAL_ORDER") ||
          taskCategoryName.includes("PICKUP") ||
          taskCategoryName.includes("PICK UP");

        return isPickupTask && taskStatus === "COMPLETED";
      });

      // Extract unique orderIds from completed pickup tasks
      const orderIds = Array.from(
        new Set(
          completedPickupTasks
            .map((task) => task.orderId)
            .filter((id) => id != null)
        )
      );

      // Fetch order details for each orderId
      const orderPromises = orderIds.map(async (orderId) => {
        try {
          return await getRentalOrderById(orderId);
        } catch (e) {
          console.warn(`Error loading order ${orderId}:`, e);
          return null;
        }
      });

      const fetchedOrders = await Promise.all(orderPromises);
      const validOrders = fetchedOrders.filter((order) => order != null);

      // Sort orders from newest to oldest (by createdAt or orderId)
      const sortedOrders = validOrders.sort((a, b) => {
        // Try createdAt first, then orderId as fallback
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateA !== dateB) {
          return dateB - dateA; // newest first
        }
        // If dates are equal or missing, sort by orderId
        const idA = a.orderId || a.id || 0;
        const idB = b.orderId || b.id || 0;
        return idB - idA; // higher ID = newer
      });

      setOrders(sortedOrders);
      hydrateCustomers(sortedOrders);
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Không tải được danh sách đơn hàng"
      );
    } finally {
      setLoading(false);
    }
  }, [hydrateCustomers]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // View order detail
  const viewOrderDetail = useCallback(
    async (orderId) => {
      try {
        const order = await getRentalOrderById(orderId);
        setSelectedOrder(order);

        // Fetch customer info
        if (order?.customerId) {
          try {
            const customer = await fetchCustomerById(order.customerId);
            const normalizedCustomer = normalizeCustomerData(customer);
            setCustomerDetail(normalizedCustomer);
            upsertCustomerCache(order.customerId, normalizedCustomer);
          } catch {
            setCustomerDetail(null);
          }
        }

        // Enrich order details with device model info (must be done before calculating totalRent)
        if (
          order &&
          Array.isArray(order.orderDetails) &&
          order.orderDetails.length
        ) {
          const modelIds = Array.from(
            new Set(
              order.orderDetails.map((d) => d.deviceModelId).filter(Boolean)
            )
          );
          const modelPairs = await Promise.all(
            modelIds.map(async (id) => {
              try {
                const model = await getDeviceModelById(id);
                return [id, normalizeDeviceModel(model)];
              } catch {
                return [id, null];
              }
            })
          );
          const modelMap = Object.fromEntries(modelPairs);
          const enrichedOrderDetails = order.orderDetails.map((d) => ({
            ...d,
            deviceModel: modelMap[d.deviceModelId] || null,
          }));

          // Update order object with enriched details for calculation
          order.orderDetails = enrichedOrderDetails;
        } else {
          order.orderDetails = [];
        }

        // Fetch invoice info
        try {
          const invoice = await getInvoiceByRentalOrderId(orderId);
          setInvoiceInfo(invoice);
        } catch {
          setInvoiceInfo(null);
        }

        // Fetch existing settlement
        try {
          const settlementResponse = await getSettlementByOrderId(orderId);
          const settlementData = settlementResponse?.data ?? settlementResponse ?? null;
          setSettlement(settlementData);

          if (settlementData) {
            const split = splitFinalAmounts(
              settlementData.finalReturnAmount ?? settlementData.finalAmount ?? 0
            );
            settlementForm.setFieldsValue({
              totalDeposit: settlementData.totalDeposit ?? (order?.depositAmount || 0),
              damageFee: settlementData.damageFee || 0,
              lateFee: settlementData.lateFee || 0,
              accessoryFee: settlementData.accessoryFee || 0,
              refundAmount: split.refundAmount,
              customerDueAmount: split.customerDueAmount,
              finalReturnAmount:
                settlementData.finalReturnAmount ??
                settlementData.finalAmount ??
                split.refundAmount - split.customerDueAmount,
            });
          } else {
            const depositAmount = order?.depositAmount || 0;
            settlementForm.setFieldsValue({
              totalDeposit: depositAmount,
              damageFee: 0,
              lateFee: 0,
              accessoryFee: 0,
              refundAmount: depositAmount,
              customerDueAmount: 0,
              finalReturnAmount: depositAmount,
            });
          }
        } catch {
          setSettlement(null);
          const depositAmount = order?.depositAmount || 0;
          settlementForm.setFieldsValue({
            totalDeposit: depositAmount,
            damageFee: 0,
            lateFee: 0,
            accessoryFee: 0,
            refundAmount: depositAmount,
            customerDueAmount: 0,
            finalReturnAmount: depositAmount,
          });
        }

        setDrawerOpen(true);
      } catch (e) {
        toast.error(
          e?.response?.data?.message ||
            e?.message ||
            "Không tải được chi tiết đơn hàng"
        );
      }
    },
    [settlementForm, upsertCustomerCache]
  );

  // Calculate final amount when other fields change
  const calculateFinalAmount = useCallback(() => {
    const values = settlementForm.getFieldsValue();
    const totalDeposit = Number(values.totalDeposit || 0);
    const damageFee = Number(values.damageFee || 0);
    const lateFee = Number(values.lateFee || 0);
    const accessoryFee = Number(values.accessoryFee || 0);
    const diff = totalDeposit - (damageFee + lateFee + accessoryFee);
    const refundAmount = diff > 0 ? diff : 0;
    const customerDueAmount = diff < 0 ? Math.abs(diff) : 0;
    settlementForm.setFieldsValue({
      refundAmount,
      customerDueAmount,
      finalReturnAmount: diff,
    });
  }, [settlementForm]);

  // Save settlement (create or update)
  const handleSaveSettlement = useCallback(async () => {
    try {
      // Nếu settlement đã tất toán (CLOSED) thì không cho cập nhật nữa
      if (
        settlement &&
        String(settlement.state || "").toUpperCase() === "CLOSED"
      ) {
        toast.error("Quyết toán này đã được tất toán, không thể cập nhật.");
        return;
      }

      const values = await settlementForm.validateFields();
      const { refundAmount = 0, customerDueAmount = 0 } = values;
      const finalReturnAmount = Number(refundAmount || 0) - Number(customerDueAmount || 0);
      values.finalReturnAmount = finalReturnAmount;
      setSavingSettlement(true);

      if (settlement?.settlementId || settlement?.id) {
        // Update existing settlement
        const settlementId = settlement.settlementId || settlement.id;
        await updateSettlement(settlementId, values);
        toast.success("Đã cập nhật quyết toán thành công!");
      } else {
        // Create new settlement
        await createSettlement({
          orderId: selectedOrder?.orderId || selectedOrder?.id,
          ...values,
        });
        toast.success("Đã tạo quyết toán thành công!");
      }

      setSettlementModalOpen(false);
      // Reload order detail to get updated settlement
      if (selectedOrder?.orderId || selectedOrder?.id) {
        await viewOrderDetail(selectedOrder.orderId || selectedOrder.id);
      }
      await loadOrders();
    } catch (e) {
      if (e?.errorFields) {
        // Form validation errors
        return;
      }
      toast.error(
        e?.response?.data?.message || e?.message || "Không thể lưu settlement"
      );
    } finally {
      setSavingSettlement(false);
    }
  }, [settlement, selectedOrder, settlementForm, viewOrderDetail, loadOrders]);

  const handleConfirmRefundPayment = useCallback(async () => {
    if (!settlement) {
      toast.error("Chưa có quyết toán để xác nhận.");
      return;
    }
    const settlementId = settlement.settlementId || settlement.id;
    if (!settlementId) {
      toast.error("Không tìm thấy ID của settlement.");
      return;
    }
    try {
      setConfirmingRefund(true);
      await confirmRefundSettlement(settlementId);
      toast.success(
        "Đã xác nhận giao dịch hoàn cọc cho đơn hàng #" +
          (selectedOrder?.orderId || selectedOrder?.id || "—")
      );
      if (selectedOrder?.orderId || selectedOrder?.id) {
        await viewOrderDetail(selectedOrder.orderId || selectedOrder.id);
      } else {
        await loadOrders();
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Không thể xác nhận giao dịch."
      );
    } finally {
      setConfirmingRefund(false);
    }
  }, [settlement, selectedOrder, viewOrderDetail, loadOrders]);

  // Table columns
  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "orderId",
        key: "orderId",
        width: 100,
        render: (v, r) => r.orderId || r.id || "—",
      },
      {
        title: "Khách hàng",
        key: "customer",
        render: (_, r) =>
          renderCustomerInfo(
            {
              ...r,
              customer: customerMap[r.customerId] || r.customer,
            },
            customerMap[r.customerId]
          ),
      },
      {
        title: "Ngày bắt đầu",
        dataIndex: "startDate",
        key: "startDate",
        width: 120,
        render: (date) => fmtDate(date),
      },
      {
        title: "Ngày kết thúc",
        dataIndex: "endDate",
        key: "endDate",
        width: 120,
        render: (date) => fmtDate(date),
      },
      {
        title: "Tổng tiền thuê",
        dataIndex: "totalPrice",
        key: "totalPrice",
        width: 150,
        align: "right",
        render: (amount, record) => {
          // Try totalPrice first, then totalAmount
          const totalRent = record?.totalPrice || record?.totalAmount || 0;
          return formatCurrency(totalRent);
        },
      },
      {
        title: "Tiền cọc",
        dataIndex: "depositAmount",
        key: "depositAmount",
        width: 150,
        align: "right",
        render: (amount) => formatCurrency(amount),
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 150,
        render: (_, r) => (
          <Space>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => viewOrderDetail(r.orderId || r.id)}
            >
              Xem
            </Button>
          </Space>
        ),
      },
    ],
    [viewOrderDetail, customerMap]
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Giải quyết Quyết toán 
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadOrders}
          loading={loading}
        >
          Tải lại
        </Button>
      </div>

      <Card>
        <Table
          rowKey={(r) => r.orderId || r.id}
          loading={loading}
          columns={columns}
          dataSource={orders}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Order Detail Drawer */}
      <Drawer
        title={`Chi tiết đơn hàng #${
          selectedOrder?.orderId || selectedOrder?.id || ""
        }`}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedOrder(null);
          setCustomerDetail(null);
          setSettlement(null);
          setInvoiceInfo(null);
        }}
        width={800}
      >
        {selectedOrder && (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Mã đơn">
                {selectedOrder.orderId || selectedOrder.id || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {renderCustomerInfo(selectedOrder, customerDetail)}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian thuê">
                {fmtDate(selectedOrder.startDate)} →{" "}
                {fmtDate(selectedOrder.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao">
                {selectedOrder.shippingAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Tổng tiền thuê"
                  value={
                    selectedOrder.totalPrice || selectedOrder.totalAmount || 0
                  }
                  formatter={(v) => formatCurrency(v)}
                  valueStyle={{ fontWeight: "bold" }} // <- Đã thêm
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Tiền cọc"
                  value={selectedOrder.depositAmount || 0}
                  formatter={(v) => formatCurrency(v)}
                  valueStyle={{ fontWeight: "bold" }} // <- Đã thêm
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Tổng thanh toán"
                  value={
                    (selectedOrder.totalPrice ||
                      selectedOrder.totalAmount ||
                      0) + (selectedOrder.depositAmount || 0)
                  }
                  formatter={(v) => formatCurrency(v)}
                  valueStyle={{ fontWeight: "bold" }} // <- Đã thêm
                />
              </Col>
            </Row>

            {invoiceInfo && (
              <>
                
              </>
            )}

            {(() => {
              const bankInfos =
                customerDetail?.bankInformationDtos ||
                customerDetail?.bankInformations ||
                [];
              if (!bankInfos.length) return null;
              return (
                <>
                  <Divider />
                  <Title level={5}>Thông tin tài khoản ngân hàng</Title>
                  <Descriptions bordered size="small" column={1}>
                    {bankInfos.map((bank, idx) => (
                      <React.Fragment key={bank.bankInformationId || idx}>
                        <Descriptions.Item
                          label={`Ngân hàng ${
                            bankInfos.length > 1 ? idx + 1 : ""
                          }`}
                        >
                          {bank.bankName || "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Chủ tài khoản">
                          {bank.bankHolder || "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Số tài khoản">
                          {bank.cardNumber || bank.bankAccountNumber || "—"}
                        </Descriptions.Item>
                      </React.Fragment>
                    ))}
                  </Descriptions>
                </>
              );
            })()}

            {settlement && (
              <>
                <Divider />
                <Title level={5}>Quyết toán hiện có</Title>
                {(() => {
                  const split = splitFinalAmounts(
                    settlement.finalReturnAmount ?? settlement.finalAmount ?? 0
                  );
                  const { refundAmount, customerDueAmount } = split;

                  return (
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="Tổng tiền cọc">
                        {formatCurrency(settlement.totalDeposit || 0)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phí hư hỏng">
                        {formatCurrency(settlement.damageFee || 0)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phí trễ">
                        {formatCurrency(settlement.lateFee || 0)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phí phụ kiện">
                        {formatCurrency(settlement.accessoryFee || 0)}
                      </Descriptions.Item>

                      {refundAmount > 0 && (
                        <Descriptions.Item label="Số tiền cần hoàn cho khách">
                          <Text strong style={{ color: "#1d4ed8" }}>
                            {formatCurrency(refundAmount)}
                          </Text>
                        </Descriptions.Item>
                      )}

                      {customerDueAmount > 0 && (
                        <Descriptions.Item label="Số tiền đền bù khách cần thanh toán thêm">
                          <Text strong style={{ color: "#dc2626" }}>
                            {formatCurrency(customerDueAmount)}
                          </Text>
                        </Descriptions.Item>
                      )}

                      <Descriptions.Item label="Trạng thái">
                        {(() => {
                          const key = String(settlement.state || "").toLowerCase();
                          const info = SETTLEMENT_STATUS_MAP[key] || {
                            label: settlement.state || "—",
                            color: "default",
                          };
                          return <Tag color={info.color}>{info.label}</Tag>;
                        })()}
                      </Descriptions.Item>
                    </Descriptions>
                  );
                })()}
                {String(settlement.state || "").toUpperCase() === "ISSUED" && (
                  <div style={{ marginTop: 16 }}>
                    <Alert
                      type="info"
                      showIcon
                      message="Quyết toán đã được khách hàng chấp nhận"
                      description="Vui lòng xác nhận giao dịch hoàn cọc để ghi nhận cho bộ phận admin."
                      style={{ marginBottom: 12 }}
                    />
                    <Button
                      type="primary"
                      icon={<DollarOutlined />}
                      loading={confirmingRefund}
                      onClick={handleConfirmRefundPayment}
                    >
                      Xác nhận đã giao dịch hoàn cọc
                    </Button>
                  </div>
                )}
              </>
            )}

            {(() => {
              const isClosed =
                settlement &&
                String(settlement.state || "").toUpperCase() === "CLOSED";

              // Nếu đã tất toán (CLOSED) thì không cho cập nhật nữa
              if (isClosed) return null;

              return (
                <>
                  <Divider />
                  <Space>
                    <Button
                      type="primary"
                      icon={settlement ? <EditOutlined /> : <PlusOutlined />}
                      onClick={() => setSettlementModalOpen(true)}
                    >
                      {settlement ? "Cập nhật Settlement" : "Tạo Settlement"}
                    </Button>
                  </Space>
                </>
              );
            })()}
          </>
        )}
      </Drawer>

      {/* Settlement Modal */}
      <Modal
        title={settlement ? "Cập nhật Settlement" : "Tạo Settlement"}
        open={settlementModalOpen}
        onOk={handleSaveSettlement}
        onCancel={() => {
          setSettlementModalOpen(false);
          settlementForm.resetFields();
        }}
        confirmLoading={savingSettlement}
        width={600}
      >
        <Form
          form={settlementForm}
          layout="vertical"
          onValuesChange={calculateFinalAmount}
        >
          <Form.Item
            name="totalDeposit"
            label="Tổng tiền cọc"
            rules={[{ required: true, message: "Vui lòng nhập tổng tiền cọc" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
              min={0}
              addonAfter="VND"
            />
          </Form.Item>

          <Form.Item
            name="damageFee"
            label="Phí hư hỏng"
            rules={[{ required: true, message: "Vui lòng nhập phí hư hỏng" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
              min={0}
              addonAfter="VND"
            />
          </Form.Item>

          <Form.Item
            name="lateFee"
            label="Phí trễ"
            rules={[{ required: true, message: "Vui lòng nhập phí trễ" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
              min={0}
              addonAfter="VND"
            />
          </Form.Item>

          <Form.Item
            name="accessoryFee"
            label="Phí phụ kiện"
            rules={[{ required: true, message: "Vui lòng nhập phí phụ kiện" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
              min={0}
              addonAfter="VND"
            />
          </Form.Item>

          <Form.Item
            name="refundAmount"
            label="Số tiền cần hoàn cho khách"
            rules={[{ required: true, message: "Vui lòng nhập số tiền cần hoàn" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
              min={0}
              addonAfter="VND"
              readOnly
            />
          </Form.Item>

          <Form.Item
            name="customerDueAmount"
            label="Số tiền khách cần thanh toán thêm"
            rules={[{ required: true, message: "Vui lòng nhập số tiền khách cần thanh toán" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
              min={0}
              addonAfter="VND"
              readOnly
            />
          </Form.Item>

          <Form.Item name="finalReturnAmount" hidden>
            <InputNumber />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
