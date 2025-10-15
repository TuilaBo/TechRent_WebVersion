// src/pages/operator/OperatorDashboard.jsx
import React from "react";
import { Row, Col, Card, Statistic, Progress, Typography } from "antd";
import { CheckCircleTwoTone, CloseCircleTwoTone, HourglassTwoTone } from "@ant-design/icons";
const { Title, Text } = Typography;

export default function OperatorDashboard() {
  return (
    <>
      <Title level={3}>Bảng điều khiển Operator</Title>
      <Row gutter={[16,16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Đơn chờ duyệt" value={12} prefix={<HourglassTwoTone />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Đã duyệt hôm nay" value={31} prefix={<CheckCircleTwoTone twoToneColor="#52c41a" />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Đơn bị huỷ" value={3} prefix={<CloseCircleTwoTone twoToneColor="#ff4d4f" />} />
          </Card>
        </Col>
      </Row>

      <Card className="mt-4" title="Tiến độ xử lý trong ca">
        <div style={{ maxWidth: 600 }}>
          <Progress percent={72} />
          <Text type="secondary">72% nhiệm vụ đã hoàn tất trong ca hiện tại</Text>
        </div>
      </Card>
    </>
  );
}
