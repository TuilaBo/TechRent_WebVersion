// Quick fix script - Run this in browser console on CustomerProfile page
// Or manually apply these changes

/* 
CHANGES NEEDED IN CustomerProfile.jsx:

1. Line 18 - Add AutoComplete import:
   BEFORE: Select,
   AFTER:  Select,
           AutoComplete,

2. Line 1265-1272 - Replace Select with AutoComplete:
   BEFORE:
            <Select
              options={modalWardOptions}
              placeholder="Chọn phường/xã"
              disabled={!modalDistrictCode}
              loading={modalWardsLoading}
              showSearch
              optionFilterProp="label"
            />

   AFTER:
            <AutoComplete
              options={modalWardOptions}
              placeholder={
                modalWardsLoading 
                  ? "Đang tải..." 
                  : modalWardOptions.length === 0 && modalDistrictCode
                  ? "Nhập tên phường/xã (APIs lỗi)"
                  : "Chọn hoặc nhập phường/xã"
              }
              disabled={!modalDistrictCode}
              showSearch
              filterOption={(inputValue, option) =>
                option?.label?.toLowerCase().includes(inputValue.toLowerCase())
              }
              notFoundContent={
                modalWardsLoading ? "Đang tải..." : "Không tìm thấy - nhập tay"
              }
            />
*/

console.log(`
✅ locationVn.js - Already fixed with multi-API fallback

⚠️ CustomerProfile.jsx - Manual changes needed:

Step 1: Add import (around line 18)
--------------------------------
Find:
  Select,
  Modal,

Change to:
  Select,
  AutoComplete,
  Modal,


Step 2: Replace Select (around line 1265)
-----------------------------------------
Find:
            <Select
              options={modalWardOptions}
              placeholder="Chọn phường/xã"
              disabled={!modalDistrictCode}
              loading={modalWardsLoading}
              showSearch
              optionFilterProp="label"
            />

Replace with:
            <AutoComplete
              options={modalWardOptions}
              placeholder={
                modalWardsLoading 
                  ? "Đang tải..." 
                  : modalWardOptions.length === 0 && modalDistrictCode
                  ? "Nhập tên phường/xã"
                  : "Chọn hoặc nhập phường/xã"
              }
              disabled={!modalDistrictCode}
              showSearch
              filterOption={(inputValue, option) =>
                option?.label?.toLowerCase().includes(inputValue.toLowerCase())
              }
              notFoundContent={
                modalWardsLoading ? "Đang tải..." : "Không tìm thấy - nhập tay"
              }
            />

After saving, the ward selection will:
✅ Try vapi.vn API first
✅ Fallback to provinces.open-api.vn  
✅ Allow manual typing if both fail
`);
