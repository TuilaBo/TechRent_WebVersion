// src/pages/operator/OperatorKYC.jsx
import React, { useEffect, useState } from "react";
import { Table, Tag, Space, Button, Drawer, Descriptions, Image, Typography, message, Divider, Form, Select, Input, DatePicker, Modal } from "antd";
import { IdcardOutlined } from "@ant-design/icons";
import { listPendingKycs, updateKycStatus, normalizeKycItem, listKycStatuses } from "../../lib/kycApi";
import { listActiveStaff } from "../../lib/staffManage";
import dayjs from "dayjs";

const { Title } = Typography;

// Map màu trạng thái KYC
const kycTag = (s) => {
  const v = String(s || "").toUpperCase();
  if (v.includes("VERIFIED")) return <Tag color="green">VERIFIED</Tag>;
  if (v.includes("REJECT")) return <Tag color="red">REJECTED</Tag>;
  if (v.includes("PENDING") || v.includes("SUBMITTED")) return <Tag color="gold">PENDING</Tag>;
  if (v.includes("EXPIRED")) return <Tag>EXPIRED</Tag>;
  return <Tag>{v || "NOT_STARTED"}</Tag>;
};

export default function AdminKyc() {
  const [data, setData] = useState([]);
  const [cur, setCur] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  // giữ lại nếu cần cho tương lai; hiện tại không dùng trực tiếp
  const [, setStatusOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [form] = Form.useForm();
  const [updateOpen, setUpdateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listPendingKycs();
      const mapped = (Array.isArray(rows) ? rows : []).map(normalizeKycItem);
      // sort newest submissions first
      mapped.sort((a, b) => {
        const ta = new Date(a?.createdAt || a?.submittedAt || 0).getTime();
        const tb = new Date(b?.createdAt || b?.submittedAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (b?.customerId || 0) - (a?.customerId || 0);
      });
      setData(mapped);
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

  useEffect(() => {
    load();
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

  const columns = [
    { title: "Customer ID", dataIndex: "customerId", width: 120 },
    { title: "Khách hàng", dataIndex: "fullName" },
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
          <Button
            onClick={() => {
              setCur(r);
              setUpdateOpen(true);
            }}
          >
            Xem xét
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Title level={3}>Duyệt KYC (đang chờ)</Title>

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
              <Descriptions.Item label="Customer ID">{cur.customerId}</Descriptions.Item>
              <Descriptions.Item label="Verified At">{cur.verifiedAt || "—"}</Descriptions.Item>
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
              <Button type="primary" onClick={() => { setUpdateOpen(true); form.setFieldsValue({ status: cur.kycStatus, rejectionReason: cur.rejectionReason || undefined, verifiedAt: dayjs(), verifiedBy: cur.verifiedBy ?? (operatorOptions?.[0]?.value ?? null) }); }}>Cập nhật trạng thái</Button>
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
