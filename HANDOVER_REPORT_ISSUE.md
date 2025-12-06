# Vấn đề: Handover Report không hiển thị thông tin thiết bị trong PDF

## Mô tả vấn đề

Khi tạo biên bản bàn giao (handover report), phần "Danh sách thiết bị bàn giao" trong PDF hiển thị "—" cho tên thiết bị và serial number.

## Nguyên nhân

API `getHandoverReportsByOrderId` trả về `items` chỉ có `allocationId`, không có thông tin device:

```json
{
  "items": [
    {
      "handoverReportItemId": 1,
      "allocationId": 2202,
      "evidenceUrls": []
      // ❌ THIẾU: deviceId, serialNumber, deviceModelName
    }
  ]
}
```

Frontend phải tự map từ order data qua `allocationId`, nhưng:
- Nếu order data không có đầy đủ thông tin trong `allocations`
- Hoặc `allocationId` không khớp
- Thì sẽ không lấy được thông tin device

## Giải pháp đề xuất

### Option 1: Trả thêm thông tin device trong `items` (KHUYẾN NGHỊ)

```json
{
  "items": [
    {
      "handoverReportItemId": 1,
      "allocationId": 2202,
      "deviceId": 312,                    // ← THÊM
      "serialNumber": "SN-0021992",       // ← THÊM
      "deviceModelName": "Tên thiết bị", // ← THÊM
      "evidenceUrls": []
    }
  ]
}
```

### Option 2: Đảm bảo order data có đầy đủ thông tin

Khi frontend gọi `getRentalOrderById`, đảm bảo `allocations` có đầy đủ:
```json
{
  "orderDetails": [
    {
      "deviceModel": {
        "deviceName": "Tên thiết bị"
      },
      "allocations": [
        {
          "allocationId": 2202,
          "device": {
            "deviceId": 312,
            "serialNumber": "SN-0021992"
          }
        }
      ]
    }
  ]
}
```

## Dữ liệu hiện tại

- `items`: chỉ có `allocationId: 2202`
- `deviceConditions`: có `allocationId: 2202` và `deviceId: 312`
- Frontend đang cố map từ `deviceConditions` → `deviceId` → tìm trong order data

## Kết luận

**Vấn đề nằm ở BE**: `items` không có đủ thông tin device. Frontend đã có logic fallback nhưng vẫn phụ thuộc vào order data có đầy đủ thông tin.

**Khuyến nghị**: BE nên trả thêm `deviceId`, `serialNumber`, và `deviceModelName` trong `items` để frontend không cần phải map phức tạp.

