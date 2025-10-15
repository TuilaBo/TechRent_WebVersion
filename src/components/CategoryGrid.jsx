import { Menu } from "antd";
import {
  LaptopOutlined,
  MobileOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  SoundOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const items = [
  { label: "Thực tế ảo", key: "vr", icon: <PlayCircleOutlined />, children: [
    { key: "meta", label: <Link to="/category/meta">Meta Quest</Link> },
    { key: "apple", label: <Link to="/category/apple">Apple Vision Pro</Link> },
  ]},
  { label: "Gaming", key: "gaming", icon: <AppstoreOutlined />, children: [
    { key: "ps5", label: <Link to="/category/ps5">PlayStation 5</Link> },
    { key: "xbox", label: <Link to="/category/xbox">Xbox Series</Link> },
  ]},
  { label: "PC & Mac", key: "pc", icon: <LaptopOutlined />, children: [
    { key: "macbook", label: <Link to="/category/macbook">MacBook</Link> },
    { key: "gaming-pc", label: <Link to="/category/gaming-pc">Gaming PC</Link> },
  ]},
  { label: "Điện thoại", key: "phone", icon: <MobileOutlined />, children: [
    { key: "iphone", label: <Link to="/category/iphone">iPhone</Link> },
    { key: "samsung", label: <Link to="/category/samsung">Samsung</Link> },
  ]},
  { label: "Máy tính bảng", key: "tablet", icon: <LaptopOutlined />, children: [
    { key: "ipad", label: <Link to="/category/ipad">iPad</Link> },
    { key: "android-tablet", label: <Link to="/category/android">Android</Link> },
    { key: "gaming-tablet", label: <Link to="/category/gaming-tablet">Gaming Tablet</Link> },
  ]},
  { label: "Máy ảnh & Máy quay", key: "camera", icon: <VideoCameraOutlined />, children: [
    { key: "dslr", label: <Link to="/category/dslr">DSLR</Link> },
    { key: "mirrorless", label: <Link to="/category/mirrorless">Mirrorless</Link> },
  ]},
  { label: "Audio & Video", key: "audio-video", icon: <SoundOutlined />, children: [
    // Add sub-items as needed, e.g.
    { key: "headphones", label: <Link to="/category/headphones">Headphones</Link> },
    { key: "speakers", label: <Link to="/category/speakers">Speakers</Link> },
  ]},
];

export default function CategoryGrid() {
  return (
    <div 
      className="bg-white"
      style={{
        boxShadow: 'none', // Remove shadow for cleaner look
        borderBottom: 'none', // Remove border to eliminate visual gap
        marginBottom: 0, // Ensure no bottom margin to connect seamlessly with Hero
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <Menu
          mode="horizontal"
          items={items}
          selectable={false}
          className="!border-0 category-menu-center"
          style={{
            display: 'flex',
            justifyContent: 'center', // Center the menu items horizontally
            fontSize: '15px', // Slightly larger font for modern readability
            fontWeight: 500, // Medium weight for a clean, professional look
            backgroundColor: '#fff', // Ensure white background
            lineHeight: '48px', // Adjust height for better vertical alignment
            gap: '8px', // Subtle spacing between items
          }}
        />
      </div>
    </div>
  );
}
