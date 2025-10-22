// src/pages/admin/AdminKyc.jsx
import React, { useState } from "react";
import {
  Table,
  Tag,
  Space,
  Button,
  Drawer,
  Descriptions,
  Image,
  Typography,
  message,
  Divider,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  IdcardOutlined,
} from "@ant-design/icons";

const { Title } = Typography;

const INIT = [
  {
    id: "KYC-001",
    name: "Nguyễn Văn A",
    phone: "0903 123 456",
    email: "a@example.com",
    status: "pending",
    frontUrl: "https://canhsatquanlyhanhchinh.gov.vn/Uploads/Images/2024/7/4/3/4.1.2.jpg",
    backUrl: "https://static.hieuluat.vn/uploaded/Images/Original/2021/03/23/mat-sau-can-cuoc-cong-dan-gan-chip_2303161703.jpg",
    selfieUrl: "https://nhadathoangviet.com/wp-content/uploads/2024/08/lam-can-cuoc-cong-dan-thu-duc.png",
    createdAt: "2025-10-01 08:30",

    // ▼ Bổ sung dữ liệu giấy tờ
    docNumber: "0792xxxxxx",
    docType: "Căn cước công dân", // CCCD/CMND/Passport
    dob: "1995-06-21",
    issueDate: "2022-03-12",
    idAddress: "Số 12 Nguyễn Trãi, P.Bến Thành, Q.1, TP.HCM",
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

    docNumber: "CMND 0123xxxxx",
    docType: "Chứng minh nhân dân",
    dob: "1990-05-15",
    issueDate: "2015-04-10",
    idAddress: "123 Main Street, Cityville, State 12345",
  },
];

const kycTag = (s) =>
  s === "approved" ? (
    <Tag color="green">Approved</Tag>
  ) : s === "rejected" ? (
    <Tag color="red">Rejected</Tag>
  ) : (
    <Tag color="gold">Pending</Tag>
  );

export default function AdminKyc() {
  const [data, setData] = useState(INIT);
  const [cur, setCur] = useState(null);
  const [open, setOpen] = useState(false);

  const approve = (r) => {
    setData((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: "approved" } : x))
    );
    message.success("KYC approved");
  };
  const reject = (r) => {
    setData((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: "rejected" } : x))
    );
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
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => approve(r)}
          >
            Chấp nhận
          </Button>
          <Button danger icon={<CloseOutlined />} onClick={() => reject(r)}>
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Title level={3}>Duyệt KYC</Title>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 8 }}
      />

      <Drawer
        title={cur ? `KYC ${cur.id}` : ""}
        open={open}
        onClose={() => setOpen(false)}
        width={860}
      >
        {cur && (
          <>
            {/* Khối 1: Thông tin cơ bản */}
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Khách hàng" span={1}>
                {cur.name}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={1}>
                {kycTag(cur.status)}
              </Descriptions.Item>

              <Descriptions.Item label="SĐT">{cur.phone}</Descriptions.Item>
              <Descriptions.Item label="Email">{cur.email}</Descriptions.Item>

              <Descriptions.Item label="Ngày tạo" span={2}>
                {cur.createdAt}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            {/* Khối 2: Thông tin giấy tờ — thêm mới theo hình */}
            <Title level={5} style={{ marginTop: 0 }}>
              Thông tin giấy tờ
            </Title>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Họ và tên">
                {cur.name || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Số giấy tờ">
                {cur.docNumber || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Loại giấy tờ">
                {cur.docType || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {cur.dob || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Ngày cấp">
                {cur.issueDate || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ (trên giấy tờ)" span={2}>
                {cur.idAddress || "—"}
              </Descriptions.Item>
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
          </>
        )}
      </Drawer>
    </>
  );
}
