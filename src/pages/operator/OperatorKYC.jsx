// src/pages/operator/OperatorKYC.jsx
import React, { useEffect, useState } from "react";
import { Table, Tag, Space, Button, Drawer, Descriptions, Image, Typography, message, Divider, Form, Select, Input, DatePicker, Modal } from "antd";
import { IdcardOutlined } from "@ant-design/icons";
import { listAllKycs, updateKycStatus, normalizeKycItem, listKycStatuses } from "../../lib/kycApi";
import { listActiveStaff } from "../../lib/staffManage";
import dayjs from "dayjs";

const { Title } = Typography;

// Map màu trạng thái KYC (tiếng Việt)
const kycTag = (s) => {
  const v = String(s || "").toUpperCase();
  if (v.includes("VERIFIED") || v.includes("APPROVED")) return <Tag color="green">Đã duyệt</Tag>;
  if (v.includes("REJECT") || v.includes("DENIED")) return <Tag color="red">Đã từ chối</Tag>;
  if (v.includes("PENDING") || v.includes("SUBMITTED")) return <Tag color="gold">Chờ duyệt</Tag>;
  if (v.includes("EXPIRED")) return <Tag color="default">Hết hạn</Tag>;
  if (v.includes("NOT_STARTED") || v === "") return <Tag color="default">Chưa bắt đầu</Tag>;
  return <Tag color="default">{v || "Không xác định"}</Tag>;
};

export default function AdminKyc() {
  const [data, setData] = useState([]);
  const [allData, setAllData] = useState([]); // Lưu tất cả data để filter
  const [cur, setCur] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState(""); // Filter theo trạng thái
  const [, setStatusOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [form] = Form.useForm();
  const [updateOpen, setUpdateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listAllKycs();
      const mapped = (Array.isArray(rows) ? rows : []).map(normalizeKycItem);
      // sort newest submissions first
      mapped.sort((a, b) => {
        const ta = new Date(a?.createdAt || a?.submittedAt || a?.verifiedAt || 0).getTime();
        const tb = new Date(b?.createdAt || b?.submittedAt || b?.verifiedAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (b?.customerId || 0) - (a?.customerId || 0);
      });
      setAllData(mapped);
      applyFilter(mapped, statusFilter);
      
      const sts = await listKycStatuses();
      setStatusOptions((Array.isArray(sts) ? sts : []).map((s) => ({ label: s.label ?? s.value, value: s.value })));

      // Load active staff and filter OPERATOR
      const staff = await listActiveStaff();
      const ops = (Array.isArray(staff) ? staff : [])
        .filter((s) => String(s.staffRole || "").toUpperCase() === "OPERATOR")
        .map((s) => ({ label: `${s.username || s.email || "User"} #${s.staffId}` , value: s.staffId }));
      setOperatorOptions(ops);
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Không tải được danh sách KYC");
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (kycs, filter) => {
    if (!filter || filter === "") {
      setData(kycs);
      return;
    }
    const filtered = kycs.filter((k) => {
      const status = String(k.kycStatus || "").toUpperCase();
      const filterUpper = String(filter).toUpperCase();
      return status === filterUpper || status.includes(filterUpper);
    });
    setData(filtered);
  };

  useEffect(() => {
    if (allData.length > 0) {
      applyFilter(allData, statusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveKyc = async () => {
    if (!cur) return;
    try {
      setUpdating(true);
      await updateKycStatus(cur.customerId, {
        status: "VERIFIED",
        verifiedAt: dayjs().toISOString(),
        verifiedBy: cur?.verifiedBy ?? (operatorOptions?.[0]?.value ?? undefined),
      });
      message.success("Đã duyệt KYC");
      setUpdateOpen(false);
      setOpen(false);
      setCur(null);
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Duyệt thất bại");
    } finally {
      setUpdating(false);
    }
  };

  const submitReject = async () => {
    if (!cur) return;
    try {
      setUpdating(true);
      await updateKycStatus(cur.customerId, {
        status: "REJECTED",
        rejectionReason: rejectReason || undefined,
        verifiedAt: dayjs().toISOString(),
        verifiedBy: cur?.verifiedBy ?? (operatorOptions?.[0]?.value ?? undefined),
      });
      message.success("Đã từ chối KYC");
      setRejectOpen(false);
      setUpdateOpen(false);
      setOpen(false);
      setCur(null);
      setRejectReason("");
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Từ chối thất bại");
    } finally {
      setUpdating(false);
    }
  };

  // Chỉ cho phép duyệt/từ chối khi trạng thái là SUBMITTED (đã nộp)
  const isActionableKyc = (status) => {
    const s = String(status || "").toUpperCase();
    return s === "SUBMITTED" || s.includes("SUBMITTED");
  };

  const columns = [
    { title: "Customer ID", dataIndex: "customerId", width: 120 },
    { title: "Khách hàng", dataIndex: "fullName" },
    { title: "Email", dataIndex: "email", width: 200, ellipsis: true },
    { title: "Trạng thái", dataIndex: "kycStatus", width: 160, render: kycTag },
    {
      title: "Thao tác",
      width: 280,
      render: (_, r) => (
        <Space>
          <Button
            icon={<IdcardOutlined />}
            onClick={() => {
              setCur(r);
              setOpen(true);
            }}
          >
            Xem
          </Button>
          {isActionableKyc(r.kycStatus) && (
            <Button
              type="primary"
              onClick={() => {
                setCur(r);
                setUpdateOpen(true);
              }}
            >
              Xem xét
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý KYC</Title>
        <Select
          placeholder="Lọc theo trạng thái"
          allowClear
          value={statusFilter || undefined}
          onChange={(value) => setStatusFilter(value || "")}
          style={{ width: 200 }}
          options={[
            { label: "Tất cả", value: "" },
            { label: "Chờ duyệt", value: "PENDING" },
            { label: "Đã duyệt", value: "VERIFIED" },
            { label: "Đã từ chối", value: "REJECTED" },
          ]}
        />
      </div>

      <Table
        rowKey={(r) => r.customerId}
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 8 }}
      />

      <Drawer
        title={cur ? `KYC của KH #${cur.customerId}` : ""}
        open={open}
        onClose={() => setOpen(false)}
        width={860}
      >
        {cur && (
          <>
            {/* Khối 1: Thông tin cơ bản */}
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Khách hàng" span={1}>
                {cur.fullName}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={1}>
                {kycTag(cur.kycStatus)}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{cur.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Customer ID">{cur.customerId}</Descriptions.Item>
              <Descriptions.Item label="Ngày xác thực">{cur.verifiedAt || "—"}</Descriptions.Item>
              {cur.rejectionReason && (
                <Descriptions.Item label="Lý do từ chối" span={2}>
                  {cur.rejectionReason}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            {/* Khối 3: Ảnh đã tải lên */}
            <Title level={5} style={{ marginTop: 0 }}>
              Ảnh giấy tờ & selfie
            </Title>
            <Image.PreviewGroup>
              <Image
                src={cur.frontUrl}
                width={260}
                style={{ marginRight: 8, borderRadius: 8 }}
                alt="Mặt trước"
              />
              <Image
                src={cur.backUrl}
                width={260}
                style={{ marginRight: 8, borderRadius: 8 }}
                alt="Mặt sau"
              />
              <Image
                src={cur.selfieUrl}
                width={260}
                style={{ borderRadius: 8 }}
                alt="Selfie"
              />
            </Image.PreviewGroup>

            <Divider />
            <Space>
              <Button onClick={() => setOpen(false)}>Đóng</Button>
              {isActionableKyc(cur.kycStatus) && (
                <Button 
                  type="primary" 
                  onClick={() => { 
                    setUpdateOpen(true); 
                    form.setFieldsValue({ 
                      status: cur.kycStatus, 
                      rejectionReason: cur.rejectionReason || undefined, 
                      verifiedAt: dayjs(), 
                      verifiedBy: cur.verifiedBy ?? (operatorOptions?.[0]?.value ?? null) 
                    }); 
                  }}
                >
                  Xem xét (Duyệt/Từ chối)
                </Button>
              )}
            </Space>
          </>
        )}
      </Drawer>

      <Modal
        title={cur ? `Xem xét KYC • KH #${cur.customerId}` : "Xem xét KYC"}
        open={updateOpen}
        onCancel={() => setUpdateOpen(false)}
        footer={[
          <Button key="reject" danger onClick={() => setRejectOpen(true)}>
            Từ chối
          </Button>,
          <Button key="approve" type="primary" loading={updating} onClick={approveKyc}>
            Duyệt
          </Button>,
        ]}
        destroyOnClose
      >
        <p>Hãy chọn Duyệt hoặc Từ chối. Nếu từ chối, bạn sẽ nhập lý do ở bước tiếp theo.</p>
      </Modal>

      <Modal
        title="Nhập lý do từ chối"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={submitReject}
        okText="Xác nhận từ chối"
        confirmLoading={updating}
      >
        <Input.TextArea
          rows={4}
          placeholder="Nhập lý do từ chối KYC"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </>
  );
}
