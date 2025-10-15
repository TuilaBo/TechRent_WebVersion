import React, { useMemo, useState } from "react";
import {
  Row, Col, Card, Statistic, Tag, Table, Space, Button, Input, DatePicker,
  Dropdown, Menu, Badge, Tooltip, Modal, message, Drawer, Descriptions,
  Select, Segmented
} from "antd";
import {
  ReloadOutlined, FilterOutlined, ExclamationCircleOutlined,
  UserSwitchOutlined, EyeOutlined, MessageOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

const { RangePicker } = DatePicker;

/** Mock queues/agents/tickets (thay = API thật sau) */
const QUEUES = [
  { key: "all", label: "Tất cả" },
  { key: "new", label: "Mới" },
  { key: "open", label: "Đang xử lý" },
  { key: "waiting", label: "Chờ khách" },
  { key: "resolved", label: "Đã xong" },
  { key: "overdue", label: "Quá hạn SLA" },
];

const AGENTS = ["Minh", "Lan", "Tuấn", "Hà"];

const INIT = [
  {
    id: "TCK-1023",
    createdAt: "2025-10-13T09:10:00Z",
    customerId: "C-0012",
    customerName: "Nguyễn Văn A",
    subject: "Không kết nối được tay cầm",
    status: "new",           // new | open | waiting | resolved
    priority: "high",        // low | normal | high | urgent
    assignee: null,          // tên agent
    dueAt: "2025-10-13T12:00:00Z",
    orderId: "TR-241001-023",
    chatSessionId: "CS-7881",
  },
  {
    id: "TCK-1022",
    createdAt: "2025-10-12T15:20:00Z",
    customerId: "C-0210",
    customerName: "Trần Thị B",
    subject: "Hỗ trợ setup TV 75\"",
    status: "open",
    priority: "normal",
    assignee: "Lan",
    dueAt: "2025-10-13T18:00:00Z",
    orderId: "TR-240927-004",
    chatSessionId: "CS-7870",
  },
  {
    id: "TCK-1021",
    createdAt: "2025-10-11T08:05:00Z",
    customerId: "C-0303",
    customerName: "Phạm Minh C",
    subject: "Xin xem lại tiền cọc",
    status: "waiting",
    priority: "low",
    assignee: "Minh",
    dueAt: "2025-10-14T09:00:00Z",
    orderId: "TR-240920-017",
    chatSessionId: "CS-7860",
  },
  {
    id: "TCK-1019",
    createdAt: "2025-10-10T10:00:00Z",
    customerId: "C-0008",
    customerName: "Lê Quốc D",
    subject: "Thiết bị lỗi hình ảnh",
    status: "resolved",
    priority: "urgent",
    assignee: "Tuấn",
    dueAt: "2025-10-10T14:00:00Z",
    orderId: "TR-240918-001",
    chatSessionId: "CS-7842",
  },
];

const STATUS_MAP = {
  new:      { label: "Mới",        color: "default" },
  open:     { label: "Đang xử lý", color: "blue"    },
  waiting:  { label: "Chờ khách",  color: "gold"    },
  resolved: { label: "Đã xong",    color: "green"   },
};

const PRIORITY_MAP = {
  low:    { label: "Thấp",    color: ""        },
  normal: { label: "Thường",  color: "geekblue"},
  high:   { label: "Cao",     color: "orange"  },
  urgent: { label: "Khẩn",    color: "red"     },
};

const SLA_COLOR = (dueAt) => {
  const now = dayjs();
  const due = dayjs(dueAt);
  if (!dueAt) return undefined;
  if (now.isAfter(due)) return "red";
  if (due.diff(now, "hour") <= 2) return "orange";
  return "default";
};

export default function SupportDesk() {
  const [queue, setQueue] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [data, setData] = useState(INIT);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  const navigate = useNavigate();

  const rows = useMemo(() => {
    let r = [...data];

    if (queue !== "all") {
      if (queue === "overdue") {
        r = r.filter((x) => dayjs().isAfter(dayjs(x.dueAt)));
      } else {
        r = r.filter((x) => x.status === queue);
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (x) =>
          x.id.toLowerCase().includes(q) ||
          x.customerName.toLowerCase().includes(q) ||
          (x.subject || "").toLowerCase().includes(q) ||
          (x.orderId || "").toLowerCase().includes(q)
      );
    }

    if (dateRange?.length === 2) {
      const [s, e] = dateRange;
      const from = s.startOf("day").valueOf();
      const to = e.endOf("day").valueOf();
      r = r.filter((x) => {
        const t = dayjs(x.createdAt).valueOf();
        return t >= from && t <= to;
      });
    }

    // order: overdue first, then newest
    return r.sort((a, b) => {
      const oa = dayjs().isAfter(dayjs(a.dueAt)) ? 1 : 0;
      const ob = dayjs().isAfter(dayjs(b.dueAt)) ? 1 : 0;
      if (oa !== ob) return ob - oa;
      return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();
    });
  }, [data, queue, search, dateRange]);

  const summary = useMemo(() => ({
    total: data.length,
    new: data.filter((x) => x.status === "new").length,
    open: data.filter((x) => x.status === "open").length,
    waiting: data.filter((x) => x.status === "waiting").length,
    resolved: data.filter((x) => x.status === "resolved").length,
    overdue: data.filter((x) => dayjs().isAfter(dayjs(x.dueAt))).length,
  }), [data]);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success("Đã tải lại danh sách ticket.");
    }, 500);
  };

  const openDetail = (rec) => {
    setCurrent(rec);
    setOpen(true);
  };

  const assignTo = (rec, name) => {
    setAssigningId(rec.id);
    setTimeout(() => {
      setData((prev) => prev.map((x) => x.id === rec.id ? { ...x, assignee: name, status: x.status === "new" ? "open" : x.status } : x));
      setAssigningId(null);
      message.success(`Đã phân công ${rec.id} cho ${name}`);
    }, 350);
  };

  const markResolved = (rec) => {
    Modal.confirm({
      title: `Đánh dấu đã xong ${rec.id}?`,
      icon: <ExclamationCircleOutlined />,
      onOk: () => {
        setData((prev) => prev.map((x) => x.id === rec.id ? { ...x, status: "resolved" } : x));
        message.success("Đã cập nhật trạng thái.");
      }
    });
  };

  const columns = [
    {
      title: "Ticket",
      dataIndex: "id",
      width: 130,
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Badge status={SLA_COLOR(r.dueAt) === "red" ? "error" : SLA_COLOR(r.dueAt) === "orange" ? "warning" : "default"} />
            <strong>{v}</strong>
          </Space>
          <span style={{ color: "#8c8c8c", fontSize: 12 }}>
            {dayjs(r.createdAt).format("DD/MM/YYYY HH:mm")}
          </span>
        </Space>
      ),
    },
    {
      title: "Khách hàng",
      width: 220,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <span><strong>{r.customerName}</strong> <span style={{ color: "#8c8c8c" }}>({r.customerId})</span></span>
          <span style={{ color: "#8c8c8c", fontSize: 12 }}>Đơn: {r.orderId || "-"}</span>
        </Space>
      ),
    },
    {
      title: "Chủ đề",
      dataIndex: "subject",
      ellipsis: true,
    },
    {
      title: "Ưu tiên",
      dataIndex: "priority",
      width: 110,
      filters: Object.entries(PRIORITY_MAP).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (v, r) => r.priority === v,
      render: (v) => <Tag color={PRIORITY_MAP[v].color}>{PRIORITY_MAP[v].label}</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 130,
      filters: Object.entries(STATUS_MAP).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (v, r) => r.status === v,
      render: (s) => <Tag color={STATUS_MAP[s].color}>{STATUS_MAP[s].label}</Tag>,
    },
    {
      title: "Agent",
      dataIndex: "assignee",
      width: 160,
      render: (v, r) => (
        <Dropdown
          trigger={["click"]}
          overlay={
            <Menu
              items={[
                ...AGENTS.map((name) => ({ key: name, label: name })),
                { type: "divider" },
                { key: "unassign", label: "Bỏ phân công" },
              ]}
              onClick={({ key }) => {
                if (key === "unassign") assignTo(r, null);
                else assignTo(r, key);
              }}
            />
          }
        >
          <Button size="small" icon={<UserSwitchOutlined />} loading={assigningId === r.id}>
            {v || "Chưa phân công"}
          </Button>
        </Dropdown>
      ),
    },
    {
      title: "SLA",
      dataIndex: "dueAt",
      width: 150,
      render: (v) => (
        <Tag color={SLA_COLOR(v)}>
          {v ? dayjs(v).format("DD/MM HH:mm") : "-"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      fixed: "right",
      width: 200,
      render: (_, r) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openDetail(r)}>Chi tiết</Button>
          <Tooltip title="Mở chat">
            <Button
              icon={<MessageOutlined />}
              onClick={() => navigate(`/support/console?ticket=${r.id}&chat=${r.chatSessionId}`)}
            />
          </Tooltip>
          <Button onClick={() => markResolved(r)}>Hoàn tất</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* TOP BAR */}
      <div className="page-shell" style={{ paddingTop: 12 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card>
              <Row gutter={16}>
                <Col xs={12} md={8}><Statistic title="Tổng ticket" value={summary.total} /></Col>
                <Col xs={12} md={8}><Statistic title="Mới" value={summary.new} /></Col>
                <Col xs={12} md={8}><Statistic title="Quá hạn SLA" value={summary.overdue} valueStyle={{ color: "#cf1322" }} /></Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Segmented
                  block
                  options={QUEUES.map((q) => ({ label: q.label, value: q.key }))}
                  value={queue}
                  onChange={setQueue}
                />
                <Space.Compact style={{ width: "100%" }}>
                  <Input placeholder="Tìm ticket, đơn, khách…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <Button icon={<FilterOutlined />} />
                </Space.Compact>
                <Space style={{ justifyContent: "space-between" }}>
                  <RangePicker onChange={setDateRange} />
                  <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Tải lại</Button>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* TABLE */}
        <Card style={{ marginTop: 16 }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            size="middle"
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </Card>
      </div>

      {/* TICKET DRAWER */}
      <Drawer
        width={560}
        title={current ? `Ticket ${current.id}` : "Ticket"}
        open={open}
        onClose={() => setOpen(false)}
      >
        {current && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Khách hàng">
                {current.customerName} ({current.customerId})
              </Descriptions.Item>
              <Descriptions.Item label="Đơn thuê">
                {current.orderId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Chủ đề">
                {current.subject}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_MAP[current.status].color}>{STATUS_MAP[current.status].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ưu tiên">
                <Tag color={PRIORITY_MAP[current.priority].color}>{PRIORITY_MAP[current.priority].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Agent phụ trách">
                {current.assignee || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Tạo lúc">
                {dayjs(current.createdAt).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn SLA">
                <Tag color={SLA_COLOR(current.dueAt)}>{current.dueAt ? dayjs(current.dueAt).format("DD/MM/YYYY HH:mm") : "-"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Chat session">
                {current.chatSessionId}
              </Descriptions.Item>
            </Descriptions>

            <Space style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<MessageOutlined />}
                onClick={() => navigate(`/support/console?ticket=${current.id}&chat=${current.chatSessionId}`)}
              >
                Mở chat
              </Button>
              <Dropdown
                overlay={
                  <Menu
                    items={[
                      ...AGENTS.map((name) => ({ key: name, label: name })),
                      { type: "divider" },
                      { key: "unassign", label: "Bỏ phân công" },
                    ]}
                    onClick={({ key }) => {
                      if (key === "unassign") assignTo(current, null);
                      else assignTo(current, key);
                    }}
                  />
                }
              >
                <Button icon={<UserSwitchOutlined />}>Phân công</Button>
              </Dropdown>
              <Button onClick={() => markResolved(current)}>Hoàn tất</Button>
            </Space>
          </>
        )}
      </Drawer>
    </>
  );
}
