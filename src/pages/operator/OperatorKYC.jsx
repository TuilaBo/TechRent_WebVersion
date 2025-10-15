// src/pages/admin/AdminKyc.jsx
import React, { useState } from "react";
import { Table, Tag, Space, Button, Drawer, Descriptions, Image, Typography, message } from "antd";
import { CheckOutlined, CloseOutlined, IdcardOutlined } from "@ant-design/icons";

const { Title } = Typography;

const INIT = [
  {
    id: "KYC-001",
    name: "Nguyễn Văn A",
    phone: "0903 123 456",
    email: "a@example.com",
    status: "pending",
    frontUrl: "https://picsum.photos/seed/f1/600/360",
    backUrl: "https://picsum.photos/seed/f2/600/360",
    selfieUrl: "https://picsum.photos/seed/f3/600/360",
    createdAt: "2025-10-01 08:30",
  },
  {
    id: "KYC-002",
    name: "Trần Bảo",
    phone: "0912 666 777",
    email: "b@example.com",
    status: "approved",
    frontUrl: "https://picsum.photos/seed/f4/600/360",
    backUrl: "https://picsum.photos/seed/f5/600/360",
    selfieUrl: "https://picsum.photos/seed/f6/600/360",
    createdAt: "2025-09-28 10:00",
  },
];

const kycTag = (s) =>
  s === "approved" ? <Tag color="green">Approved</Tag> :
  s === "rejected" ? <Tag color="red">Rejected</Tag> :
  <Tag color="gold">Pending</Tag>;

export default function AdminKyc() {
  const [data, setData] = useState(INIT);
  const [cur, setCur] = useState(null);
  const [open, setOpen] = useState(false);

  const approve = (r) => {
    setData(prev => prev.map(x => x.id === r.id ? { ...x, status: "approved" } : x));
    message.success("KYC approved");
  };
  const reject = (r) => {
    setData(prev => prev.map(x => x.id === r.id ? { ...x, status: "rejected" } : x));
    message.success("KYC rejected");
  };

  const columns = [
    { title: "KYC ID", dataIndex: "id", width: 120 },
    { title: "Khách hàng", dataIndex: "name" },
    { title: "SĐT", dataIndex: "phone", width: 130 },
    { title: "Email", dataIndex: "email" },
    { title: "Ngày tạo", dataIndex: "createdAt", width: 160 },
    { title: "Trạng thái", dataIndex: "status", width: 120, render: kycTag },
    {
      title: "Thao tác", width: 240,
      render: (_, r) => (
        <Space>
          <Button icon={<IdcardOutlined />} onClick={() => { setCur(r); setOpen(true); }}>Xem</Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => approve(r)}>Chấp nhận</Button>
          <Button danger icon={<CloseOutlined />} onClick={() => reject(r)}>Từ chối</Button>
        </Space>
      )
    }
  ];

  return (
    <>
      <Title level={3}>Duyệt KYC</Title>
      <Table rowKey="id" columns={columns} dataSource={data} pagination={{ pageSize: 8 }} />
      <Drawer title={cur ? `KYC ${cur.id}` : ""} open={open} onClose={() => setOpen(false)} width={800}>
        {cur && (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Khách hàng">{cur.name}</Descriptions.Item>
              <Descriptions.Item label="SĐT">{cur.phone}</Descriptions.Item>
              <Descriptions.Item label="Email">{cur.email}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{kycTag(cur.status)}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 12 }}>
              <Image.PreviewGroup>
                <Image src={cur.frontUrl} width={230} style={{ marginRight: 8 }} />
                <Image src={cur.backUrl} width={230} style={{ marginRight: 8 }} />
                <Image src={cur.selfieUrl} width={230} />
              </Image.PreviewGroup>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
