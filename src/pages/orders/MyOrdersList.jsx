import React, { useMemo, useState } from "react";
import { Table, Tag, Typography, Input, DatePicker, Space, Button, Dropdown, Menu, Card } from "antd";
import { SearchOutlined, FilterOutlined, ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import AnimatedEmpty from "../../components/AnimatedEmpty.jsx";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * Danh sách đơn hàng + bộ lọc & bảng chính
 * - Tách riêng để MyOrders.jsx gọn hơn
 */
export default function MyOrdersList({
  orders,
  loading,
  onRefresh,
  onSelectOrder,
  formatDateTime,
  formatVND,
  orderStatusMap,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  // Chiều cao scroll theo viewport
  const TABLE_TOP_BLOCK = 40 + 40 + 16;
  const TABLE_BOTTOM_BLOCK = 56;
  const tableScrollY = `calc(100vh - ${TABLE_TOP_BLOCK + TABLE_BOTTOM_BLOCK}px)`;

  const data = useMemo(() => {
    let rows = Array.isArray(orders) ? [...orders] : [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.displayId).toLowerCase().includes(q) ||
          (Array.isArray(r.items) &&
            r.items.some((it) => (it.name || "").toLowerCase().includes(q)))
      );
    }
    if (statusFilter) {
      rows = rows.filter((r) => String(r.orderStatus).toLowerCase() === String(statusFilter).toLowerCase());
    }
    if (dateRange?.length === 2) {
      const [s, e] = dateRange;
      const start = s.startOf("day").toDate().getTime();
      const end = e.endOf("day").toDate().getTime();
      rows = rows.filter((r) => {
        const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return t >= start && t <= end;
      });
    }
    return rows.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
  }, [search, statusFilter, dateRange, orders]);

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "displayId",
      key: "displayId",
      width: 90,
      fixed: "left",
      render: (v) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
      sorter: (a, b) => String(a.displayId).localeCompare(String(b.displayId)),
    },
    {
      title: "Sản phẩm",
      key: "items",
      width: 220,
      render: (_, r) => {
        const first = r.items?.[0] || {};
        const extra = (r.items?.length ?? 0) > 1 ? ` +${r.items.length - 1} mục` : "";
        const imageUrl = first.image || "";
        const productName = first.name || "—";

        return (
          <Space size="middle">
            {imageUrl ? (
              <AvatarLike imageUrl={imageUrl} productName={productName} />
            ) : (
              <FallbackAvatar productName={productName} />
            )}
            <div style={{ maxWidth: 150 }}>
              <Text
                strong
                style={{ display: "block", fontSize: 13 }}
                ellipsis={{ tooltip: productName }}
              >
                {productName}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                SL: {first.qty ?? 1}
                {extra}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: "Ngày tạo đơn",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 130,
      render: (v) => formatDateTime(v),
      sorter: (a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0),
      defaultSortOrder: "descend",
    },
    {
      title: "Số ngày",
      dataIndex: "days",
      key: "days",
      align: "center",
      width: 80,
      sorter: (a, b) => (a.days ?? 0) - (b.days ?? 0),
    },
    {
      title: "Tổng tiền thuê",
      key: "rentalTotal",
      align: "right",
      width: 120,
      render: (_, r) => <Text strong>{formatVND(Number(r.total || 0))}</Text>,
      sorter: (a, b) => Number(a.total || 0) - Number(b.total || 0),
    },
    {
      title: "Tổng tiền cọc",
      key: "depositTotal",
      align: "right",
      width: 120,
      render: (_, r) => {
        const depositTotal = (r.items || []).reduce(
          (sum, it) => sum + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1),
          0
        );
        return <Text>{formatVND(depositTotal)}</Text>;
      },
      sorter: (a, b) => {
        const aDep = (a.items || []).reduce(
          (s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1),
          0
        );
        const bDep = (b.items || []).reduce(
          (s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1),
          0
        );
        return aDep - bDep;
      },
    },
    {
      title: "Tổng thanh toán",
      key: "grandTotal",
      align: "right",
      width: 140,
      render: (_, r) => {
        const dep = (r.items || []).reduce(
          (s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1),
          0
        );
        return <Text strong>{formatVND(Number(r.total || 0) + dep)}</Text>;
      },
      sorter: (a, b) => {
        const depA = (a.items || []).reduce(
          (s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1),
          0
        );
        const depB = (b.items || []).reduce(
          (s, it) => s + Number(it.depositAmountPerUnit || 0) * Number(it.qty || 1),
          0
        );
        return Number(a.total || 0) + depA - (Number(b.total || 0) + depB);
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "orderStatus",
      key: "orderStatus",
      width: 140,
      render: (s) => {
        const key = String(s || "").toLowerCase();
        const m = orderStatusMap[key] || { label: s || "—", color: "default" };
        return (
          <Tag color={m.color} style={{ borderRadius: 20, padding: "0 12px" }}>
            {m.label}
          </Tag>
        );
      },
      filters: Object.entries(orderStatusMap).map(([value, { label }]) => ({
        text: label,
        value,
      })),
      onFilter: (v, r) =>
        String(r.orderStatus).toLowerCase() === String(v).toLowerCase(),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, r) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onSelectOrder?.(r)}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: "calc(100vh - var(--stacked-header,128px))",
        marginTop: "-24px",
        marginBottom: "-24px",
        background: "#f0f2f5",
        padding: "24px",
      }}
    >
      <div className="h-full flex flex-col max-w-7xl mx-auto">
        {/* Header Section */}
        <Card
          style={{
            marginBottom: 16,
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            border: "1px solid #eee",
            background: "#ffffff",
          }}
          bodyStyle={{ padding: "16px 20px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
            }}
          >
            <div>
              <Title
                level={3}
                style={{
                  margin: 0,
                  color: "#1a1a1a",
                  fontWeight: 700,
                  fontSize: 22,
                }}
              >
                Đơn thuê của tôi
              </Title>
              <Text
                type="secondary"
                style={{ fontSize: 13, marginTop: 6, display: "block", color: "#666" }}
              >
                Theo dõi trạng thái đơn, thanh toán và tải hợp đồng
              </Text>
            </div>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              loading={loading}
              size="middle"
              style={{
                borderRadius: 8,
                height: 36,
                padding: "0 16px",
                fontWeight: 600,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              Tải lại
            </Button>
          </div>

          {/* Filters Section */}
          <Space wrap size="small" style={{ width: "100%" }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Tìm theo mã đơn, tên thiết bị…"
              size="middle"
              style={{
                width: 300,
                borderRadius: 8,
                height: 36,
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <RangePicker
              onChange={setDateRange}
              size="middle"
              style={{
                borderRadius: 8,
                height: 36,
              }}
            />
            <Dropdown
              trigger={["click"]}
              overlay={
                <Menu
                  onClick={({ key }) =>
                    setStatusFilter(key === "all" ? undefined : key)
                  }
                  items={[
                    { key: "all", label: "Tất cả trạng thái" },
                    ...Object.entries(orderStatusMap).map(([k, v]) => ({
                      key: k,
                      label: v.label,
                    })),
                  ]}
                />
              }
            >
              <Button
                size="middle"
                icon={<FilterOutlined />}
                style={{
                  borderRadius: 8,
                  height: 36,
                  padding: "0 14px",
                  borderColor: "#d9d9d9",
                }}
              >
                {statusFilter
                  ? `Lọc: ${orderStatusMap[statusFilter].label}`
                  : "Lọc trạng thái"}
              </Button>
            </Dropdown>
          </Space>
        </Card>

        {/* Table Section */}
        <Card
          style={{
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            border: "none",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
          bodyStyle={{
            padding: 16,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {data.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 400,
              }}
            >
              <AnimatedEmpty description="Chưa có đơn nào" />
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <Table
                rowKey="id"
                columns={columns}
                dataSource={data}
                loading={loading}
                size="small"
                bordered={false}
                className="modern-table"
                sticky
                scroll={{ x: 900, y: tableScrollY }}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  position: ["bottomRight"],
                  showTotal: (total) => `Tổng ${total} đơn`,
                  style: { marginTop: 16 },
                }}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AvatarLike({ imageUrl, productName }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 6,
        overflow: "hidden",
        background: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={productName}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}

function FallbackAvatar({ productName }) {
  const char =
    productName && productName !== "—"
      ? productName.charAt(0).toUpperCase()
      : "?";
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 6,
        background: "#f0f0f0",
        color: "#999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
      }}
    >
      {char}
    </div>
  );
}


