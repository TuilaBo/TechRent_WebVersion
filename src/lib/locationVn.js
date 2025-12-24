import axios from "axios";

// Luôn dùng HTTPS
const BASE = "https://provinces.open-api.vn/api/v1";

// Fallback tối thiểu (mã quận chuẩn theo Tổng cục Thống kê)
const HCM_DISTRICT_FALLBACK = [
  { value: 760, label: "Quận 1" },
  { value: 761, label: "Quận 12" },
  { value: 764, label: "Quận Gò Vấp" },
  { value: 765, label: "Quận Bình Thạnh" },
  { value: 766, label: "Quận Tân Bình" },
  { value: 767, label: "Quận Tân Phú" },
  { value: 768, label: "Quận Phú Nhuận" },
  { value: 769, label: "Thành phố Thủ Đức" },
  { value: 770, label: "Quận 3" },
  { value: 771, label: "Quận 10" },
  { value: 772, label: "Quận 11" },
  { value: 773, label: "Quận 4" },
  { value: 774, label: "Quận 5" },
  { value: 775, label: "Quận 6" },
  { value: 776, label: "Quận 8" },
  { value: 777, label: "Quận Bình Tân" },
  { value: 778, label: "Quận 7" },
  { value: 783, label: "Huyện Củ Chi" },
  { value: 784, label: "Huyện Hóc Môn" },
  { value: 785, label: "Huyện Bình Chánh" },
  { value: 786, label: "Huyện Nhà Bè" },
  { value: 787, label: "Huyện Cần Giờ" },
];

/** Tải QUẬN TP.HCM. Nếu API lỗi hoặc trả rỗng → dùng fallback. */
export async function fetchDistrictsHCM() {
  try {
    // gọi depth=1 (đủ để lấy list quận)
    const { data } = await axios.get(`${BASE}/p/79?depth=1`, { timeout: 8000 });
    const arr = (data?.districts || []).map(d => ({ value: d.code, label: d.name }));
    return arr.length ? arr : HCM_DISTRICT_FALLBACK;
  } catch {
    return HCM_DISTRICT_FALLBACK;
  }
}

/** Tải PHƯỜNG theo quận với multi-API fallback. */
export async function fetchWardsByDistrict(districtCode) {
  // Try vapi.vn first (more reliable)
  try {
    const { data } = await axios.get(
      `https://vapi.vn/api/v1/district/${districtCode}`,
      { timeout: 5000 }
    );
    if (data?.results?.length > 0) {
      const wards = data.results.map(w => ({
        value: w.ward_id || w.id,
        label: w.ward_name || w.name
      }));
      return wards;
    }
  } catch (err) {
    console.warn('vapi.vn failed, trying provinces.open-api.vn:', err.message);
  }

  // Fallback to provinces.open-api.vn
  try {
    const { data } = await axios.get(
      `${BASE}/d/${districtCode}?depth=2`,
      { timeout: 5000 }
    );
    const wards = (data?.wards || []).map(w => ({
      value: w.code,
      label: w.name
    }));
    if (wards.length > 0) return wards;
  } catch (err) {
    console.warn('provinces.open-api.vn also failed:', err.message);
  }

  // Both APIs failed - return empty to allow manual input
  return [];
}
