# Test Cases List - TechRent WebVersion

## UNIT TESTS

### orderUtils.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-001 | orderUtils | formatVND | Format positive number | 1000000 | "1.000.000 VNĐ" | High |
| UT-002 | orderUtils | formatVND | Format zero | 0 | "0 VNĐ" | High |
| UT-003 | orderUtils | formatVND | Format NaN | NaN | "0 VNĐ" | Medium |
| UT-004 | orderUtils | formatVND | Format negative number | -1000 | "-1.000 VNĐ" | Medium |
| UT-005 | orderUtils | formatVND | Format undefined | undefined | "0 VNĐ" | Medium |
| UT-006 | orderUtils | formatDateTime | Format valid ISO date | "2025-12-15T01:30:00" | "15/12/2025, 01:30" | High |
| UT-007 | orderUtils | formatDateTime | Format null | null | "—" | High |
| UT-008 | orderUtils | formatDateTime | Format invalid date string | "invalid" | "—" | Medium |
| UT-009 | orderUtils | diffDays | Calculate 2 consecutive days | "2025-12-14", "2025-12-15" | 1 | High |
| UT-010 | orderUtils | diffDays | Calculate 7 days | "2025-12-01", "2025-12-08" | 7 | High |
| UT-011 | orderUtils | diffDays | Null start date | null, "2025-12-15" | 1 | Medium |
| UT-012 | orderUtils | diffDays | Same day | "2025-12-15", "2025-12-15" | 1 | Medium |

### orderConstants.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-013 | orderConstants | mapInvoiceStatusToPaymentStatus | Map SUCCEEDED | "SUCCEEDED" | "paid" | High |
| UT-014 | orderConstants | mapInvoiceStatusToPaymentStatus | Map PAID | "PAID" | "paid" | High |
| UT-015 | orderConstants | mapInvoiceStatusToPaymentStatus | Map COMPLETED | "COMPLETED" | "paid" | High |
| UT-016 | orderConstants | mapInvoiceStatusToPaymentStatus | Map FAILED | "FAILED" | "unpaid" | High |
| UT-017 | orderConstants | mapInvoiceStatusToPaymentStatus | Map CANCELLED | "CANCELLED" | "unpaid" | High |
| UT-018 | orderConstants | mapInvoiceStatusToPaymentStatus | Map PENDING | "PENDING" | "partial" | High |
| UT-019 | orderConstants | mapInvoiceStatusToPaymentStatus | Map REFUNDED | "REFUNDED" | "refunded" | High |
| UT-020 | orderConstants | mapInvoiceStatusToPaymentStatus | Map null | null | "unpaid" | Medium |
| UT-021 | orderConstants | mapInvoiceStatusToPaymentStatus | Map lowercase | "succeeded" | "paid" | Medium |
| UT-022 | orderConstants | splitSettlementAmounts | Positive amount | 100000 | {refundAmount: 100000, customerDueAmount: 0} | High |
| UT-023 | orderConstants | splitSettlementAmounts | Negative amount | -50000 | {refundAmount: 0, customerDueAmount: 50000} | High |
| UT-024 | orderConstants | splitSettlementAmounts | Zero amount | 0 | {refundAmount: 0, customerDueAmount: 0} | Medium |

### technicianTaskApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-025 | technicianTaskApi | normalizeTechnicianTask | Normalize full task | {taskId: 1, status: "PENDING"} | Normalized object | High |
| UT-026 | technicianTaskApi | normalizeTechnicianTask | Normalize empty object | {} | Default values | High |
| UT-027 | technicianTaskApi | getTechnicianStatusColor | PENDING status | "PENDING" | {bg: "#000000", text: "#ffffff"} | High |
| UT-028 | technicianTaskApi | getTechnicianStatusColor | IN_PROGRESS status | "IN_PROGRESS" | {bg: "#1677ff", text: "#ffffff"} | High |
| UT-029 | technicianTaskApi | getTechnicianStatusColor | COMPLETED status | "COMPLETED" | {bg: "#52c41a", text: "#ffffff"} | High |
| UT-030 | technicianTaskApi | getTechnicianStatusColor | CANCELLED status | "CANCELLED" | {bg: "#ff4d4f", text: "#ffffff"} | High |
| UT-031 | technicianTaskApi | getTechnicianStatusColor | Unknown status | "UNKNOWN" | Default color | Medium |
| UT-032 | technicianTaskApi | getTaskBadgeStatus | PENDING | "PENDING" | "warning" | High |
| UT-033 | technicianTaskApi | getTaskBadgeStatus | IN_PROGRESS | "IN_PROGRESS" | "processing" | High |
| UT-034 | technicianTaskApi | getTaskBadgeStatus | COMPLETED | "COMPLETED" | "success" | High |
| UT-035 | technicianTaskApi | getTaskBadgeStatus | CANCELLED | "CANCELLED" | "error" | High |
| UT-036 | technicianTaskApi | getTaskBadgeStatus | Unknown | "UNKNOWN" | "default" | Medium |

### TechnicianCalendarUtils.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-037 | TechnicianCalendarUtils | fmtStatus | Format PENDING | "PENDING" | Vietnamese label | High |
| UT-038 | TechnicianCalendarUtils | fmtStatus | Format IN_PROGRESS | "IN_PROGRESS" | Vietnamese label | High |
| UT-039 | TechnicianCalendarUtils | fmtOrderStatus | pending status | "pending" | "Chờ xác nhận" | High |
| UT-040 | TechnicianCalendarUtils | fmtOrderStatus | confirmed status | "confirmed" | "Đã xác nhận" | High |
| UT-041 | TechnicianCalendarUtils | fmtOrderStatus | active status | "active" | "Đang thuê" | High |
| UT-042 | TechnicianCalendarUtils | fmtOrderStatus | cancelled status | "cancelled" | "Đã hủy" | High |
| UT-043 | TechnicianCalendarUtils | isPreRentalQC | taskCategoryId = 1 | {taskCategoryId: 1} | true | High |
| UT-044 | TechnicianCalendarUtils | isPreRentalQC | taskCategoryId = 4 | {taskCategoryId: 4} | false | High |
| UT-045 | TechnicianCalendarUtils | isPreRentalQC | taskCategoryName = Pre rental QC | {taskCategoryName: "Pre rental QC"} | true | High |
| UT-046 | TechnicianCalendarUtils | isPostRentalQC | taskCategoryId = 2 | {taskCategoryId: 2} | true | High |
| UT-047 | TechnicianCalendarUtils | isPostRentalQC | taskCategoryId = 1 | {taskCategoryId: 1} | false | High |
| UT-048 | TechnicianCalendarUtils | isPickupTask | type = PICKUP | {type: "PICKUP"} | true | High |
| UT-049 | TechnicianCalendarUtils | isPickupTask | taskCategoryId = 6 | {taskCategoryId: 6} | true | High |
| UT-050 | TechnicianCalendarUtils | isPickupTask | type = DELIVERY | {type: "DELIVERY"} | false | High |
| UT-051 | TechnicianCalendarUtils | parseInfoString | Parse key-value string | "Key: Value" | {Key: "Value"} | Medium |
| UT-052 | TechnicianCalendarUtils | translateRole | TECHNICIAN | "TECHNICIAN" | "Kỹ thuật viên" | Medium |
| UT-053 | TechnicianCalendarUtils | translateRole | OPERATOR | "OPERATOR" | "Điều phối viên" | Medium |
| UT-054 | TechnicianCalendarUtils | translateHandoverStatus | COMPLETED | "COMPLETED" | Vietnamese label | Medium |
| UT-055 | TechnicianCalendarUtils | getMaintenanceBadgeStatus | Active schedule | {status: "ACTIVE"} | Correct badge | High |
| UT-056 | TechnicianCalendarUtils | taskToDisplay | Convert BE task | BE task object | Display fields | High |
| UT-057 | TechnicianCalendarUtils | getCalendarData | Filter tasks by date | Tasks array + date | Filtered tasks | High |

### deviceModelsApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-058 | deviceModelsApi | normalizeModel | Full BE object | {deviceModelId: 1, deviceName: "iPhone"} | Normalized FE shape | High |
| UT-059 | deviceModelsApi | normalizeModel | Empty object | {} | Default values | High |
| UT-060 | deviceModelsApi | normalizeModel | Missing optional fields | {deviceModelId: 1} | Fallback to defaults | Medium |
| UT-061 | deviceModelsApi | fmtVND | Format currency | 500000 | VND formatted string | Medium |

### categoryApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-062 | categoryApi | normalizeCategory | Full category | {deviceCategoryId: 1, deviceCategoryName: "Phone"} | Normalized object | High |
| UT-063 | categoryApi | normalizeCategory | Empty object | {} | Default values | High |

### condition.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-064 | condition | normalizeConditionDefinition | Full condition | {id: 1, name: "Scratch"} | Normalized condition | High |
| UT-065 | condition | normalizeConditionDefinition | Empty object | {} | Default values | High |

### contractApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-066 | contractApi | normalizeContract | Full contract | {contractId: 1, status: "ACTIVE"} | Normalized contract | High |
| UT-067 | contractApi | normalizeContract | Missing fields | {} | Fallback values | High |

### taskApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-068 | taskApi | normalizeTask | Full task | {taskId: 1, status: "PENDING"} | Normalized task | High |
| UT-069 | taskApi | normalizeTask | Empty object | {} | Default values | High |

### taskRulesApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-070 | taskRulesApi | normalizeTaskRule | Full rule | {taskRuleId: 1, maxTasksPerDay: 5} | Normalized rule | High |
| UT-071 | taskRulesApi | normalizeTaskRule | Empty object | {} | Default values | High |

### kycApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-072 | kycApi | normalizeKycItem | Full KYC | {customerId: 1, kycStatus: "APPROVED"} | Normalized KYC | High |
| UT-073 | kycApi | normalizeKycItem | Empty object | {} | Default values | High |

### customerApi.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-074 | customerApi | normalizeCustomer | Full customer | {customerId: 1, fullName: "Nguyen Van A"} | Normalized customer | High |
| UT-075 | customerApi | normalizeCustomer | With bank arrays | Customer with bankInformationDtos | Extracts first bank info | High |

### staffManage.js
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-076 | staffManage | normalizeStaff | Full staff | {staffId: 1, staffRole: "TECHNICIAN"} | Normalized staff | High |
| UT-077 | staffManage | normalizeStaff | Empty object | {} | Default values | High |

### kycOcrFE.js (utils/)
| ID | Module | Function | Test Case | Input | Expected Output | Priority |
|----|--------|----------|-----------|-------|-----------------|----------|
| UT-078 | kycOcrFE | toISO | Convert DD/MM/YYYY | "15/12/2025" | "2025-12-15" | High |
| UT-079 | kycOcrFE | toISO | Convert DD-MM-YY | "15-12-25" | "2025-12-15" | High |
| UT-080 | kycOcrFE | toISO | Null input | null | "" | Medium |
| UT-081 | kycOcrFE | pickIdNumber | ID with hint | "Số: 123456789012" | "123456789012" | High |
| UT-082 | kycOcrFE | pickIdNumber | 12-digit number in text | "ID number 123456789012 abc" | "123456789012" | High |
| UT-083 | kycOcrFE | cleanFullName | Clean OCR name | "LE K HOANG TRONG" | "LE HOANG TRONG" | Medium |
| UT-084 | kycOcrFE | inferIdType | 12-digit number | "123456789012" | "CCCD" | High |
| UT-085 | kycOcrFE | inferIdType | 9-digit number | "123456789" | "CMND" | High |

---

## INTEGRATION TESTS

### cartUtils.js + localStorage
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-001 | cartUtils | Add item to empty cart | Empty localStorage | 1. Call addToCart(deviceId, 1) | Cart contains 1 item with qty=1 | High |
| IT-002 | cartUtils | Add existing item to cart | Cart has item with id=1 | 1. Call addToCart(1, 1) | Item qty increased by 1 | High |
| IT-003 | cartUtils | Remove item from cart | Cart has item with id=1 | 1. Call removeFromCart(1) | Item removed from cart | High |
| IT-004 | cartUtils | Update item quantity | Cart has item with id=1, qty=1 | 1. Call updateCartItemQuantity(1, 5) | Item qty = 5 | High |
| IT-005 | cartUtils | Clear entire cart | Cart has multiple items | 1. Call clearCart() | Cart is empty | High |
| IT-006 | cartUtils | Get cart count | Cart has items with total qty=10 | 1. Call getCartCount() | Returns 10 | High |
| IT-007 | cartUtils | Cart persists after page reload | Cart has items | 1. Reload page 2. Call getCartFromStorage() | Same items returned | High |
| IT-008 | cartUtils | cart:updated event dispatched | Empty cart | 1. Call addToCart() 2. Listen for cart:updated event | Event fired with correct count | Medium |

### authStore.js + API
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-009 | authStore | Login success | Mock API returns token | 1. Call login({usernameOrEmail, password}) | Token set, user fetched | High |
| IT-010 | authStore | Login failure - invalid credentials | Mock API returns 401 | 1. Call login({usernameOrEmail, password}) | Error message set | High |
| IT-011 | authStore | Login failure - server error | Mock API returns 500 | 1. Call login() | Error message set | Medium |
| IT-012 | authStore | Logout clears state | User is logged in | 1. Call logout() | Token and user are null | High |
| IT-013 | authStore | 401 response triggers auto logout | User is logged in | 1. Make API call 2. Mock returns 401 | User logged out | High |
| IT-014 | authStore | Register success | Mock API returns success | 1. Call register({...}) | Account created, no error | High |
| IT-015 | authStore | Register failure - duplicate email | Mock API returns 400 | 1. Call register({...}) | Error message set | High |
| IT-016 | authStore | Verify email success | Mock API returns success | 1. Call verifyEmail({email, code}) | Account verified | High |
| IT-017 | authStore | Resend verification | Mock API returns success | 1. Call resendVerification({email}) | Email sent | Medium |
| IT-018 | authStore | fetchMe success | Valid token, Mock API returns user | 1. Call fetchMe() | User data loaded | High |
| IT-019 | authStore | Token persistence | User logged in | 1. Reload page 2. Check token | Token persisted in storage | High |

### rentalOrdersApi.js
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-020 | rentalOrdersApi | createRentalOrder success | Mock API returns order | 1. Call createRentalOrder({...}) | Order created with orderId | High |
| IT-021 | rentalOrdersApi | searchRentalOrders with filters | Mock API returns paginated | 1. Call searchRentalOrders({orderStatus: "pending"}) | Correct query params sent | High |
| IT-022 | rentalOrdersApi | searchRentalOrders pagination | Mock API returns page 2 | 1. Call searchRentalOrders({page: 1}) | Page 2 data returned | High |
| IT-023 | rentalOrdersApi | getRentalOrderById | Mock API returns order | 1. Call getRentalOrderById(1) | Order details returned | High |
| IT-024 | rentalOrdersApi | confirmReturnRentalOrder | Mock API returns success | 1. Call confirmReturnRentalOrder(1) | Status updated | High |
| IT-025 | rentalOrdersApi | extendRentalOrder | Mock API returns success | 1. Call extendRentalOrder(1, "2025-12-31") | Extension processed | High |

### Payment.js
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-026 | Payment | createPayment VNPay | Mock API returns payment URL | 1. Call createPayment({paymentMethod: "VNPAY"}) | VNPay URL returned | High |
| IT-027 | Payment | createPayment PayOS | Mock API returns payment URL | 1. Call createPayment({paymentMethod: "PAYOS"}) | PayOS URL returned | High |
| IT-028 | Payment | getInvoiceByRentalOrderId | Mock API returns invoice | 1. Call getInvoiceByRentalOrderId(1) | Invoice details returned | High |
| IT-029 | Payment | getTransactions | Mock API returns list | 1. Call getTransactions() | Transaction list returned | High |
| IT-030 | Payment | confirmRefundSettlement | Mock API returns success | 1. Call confirmRefundSettlement(1) | Refund confirmed | High |

### complaints.js
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-031 | complaints | getMyComplaints | Mock API returns list | 1. Call getMyComplaints() | Customer complaints returned | High |
| IT-032 | complaints | createComplaint | Mock API returns complaint | 1. Call createComplaint({orderId, deviceId, description}) | Complaint created | High |
| IT-033 | complaints | getStaffComplaints | Mock API returns list | 1. Call getStaffComplaints({status: "PENDING"}) | Filtered complaints | High |
| IT-034 | complaints | processComplaint | Mock API returns success | 1. Call processComplaint(1, {...}) | Device replacement initiated | High |
| IT-035 | complaints | resolveComplaint | Mock API returns success | 1. Call resolveComplaint(1, {staffNote}) | Complaint resolved | High |

### handoverReportApi.js
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-036 | handoverReportApi | createHandoverReportCheckout | Mock API returns report | 1. Call createHandoverReportCheckout({...}) | Checkout report created | High |
| IT-037 | handoverReportApi | createHandoverReportCheckin | Mock API returns report | 1. Call createHandoverReportCheckin({...}) | Checkin report with discrepancies | High |
| IT-038 | handoverReportApi | updateHandoverReportSignature | Mock API returns success | 1. Call updateHandoverReportSignature(1, {pinCode, staffSignature}) | Signature added | High |
| IT-039 | handoverReportApi | sendHandoverPin | Mock API returns success | 1. Call sendHandoverPin(1) | PIN sent to email | Medium |
| IT-040 | handoverReportApi | getHandoverReportsByOrderId | Mock API returns list | 1. Call getHandoverReportsByOrderId(1) | Reports list returned | High |

### settlementApi.js
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-041 | settlementApi | createSettlement | Mock API returns settlement | 1. Call createSettlement({orderId, ...}) | Draft settlement created | High |
| IT-042 | settlementApi | updateSettlement | Mock API returns updated | 1. Call updateSettlement(1, {...}) | Settlement updated | High |
| IT-043 | settlementApi | respondSettlement accept | Mock API returns success | 1. Call respondSettlement(1, true) | Status = Issued | High |
| IT-044 | settlementApi | respondSettlement reject | Mock API returns success | 1. Call respondSettlement(1, false) | Status = Rejected | High |
| IT-045 | settlementApi | confirmRefundSettlement | Mock API returns success | 1. Call confirmRefundSettlement(1, proofFile) | Refund confirmed | High |

### qcReportApi.js
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| IT-046 | qcReportApi | createPreRentalQcReport | Mock API returns report | 1. Call createPreRentalQcReport({taskId, ...}) | Pre-rental QC created | High |
| IT-047 | qcReportApi | createPostRentalQcReport | Mock API returns report | 1. Call createPostRentalQcReport({taskId, ...}) | Post-rental QC created | High |
| IT-048 | qcReportApi | updatePreRentalQcReport | Mock API returns updated | 1. Call updatePreRentalQcReport(1, {...}) | Report updated | High |
| IT-049 | qcReportApi | getQcReportByTaskId | Mock API returns report | 1. Call getQcReportByTaskId(1) | QC report returned | High |

---

## SYSTEM TESTS (E2E)

### Authentication Flow
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| ST-001 | Auth | Login with valid credentials | User exists | 1. Go to /login 2. Enter username/password 3. Click Login | Redirected to dashboard | High |
| ST-002 | Auth | Login with invalid credentials | - | 1. Go to /login 2. Enter wrong credentials 3. Click Login | Error message displayed | High |
| ST-003 | Auth | Register new account | - | 1. Go to /register 2. Fill form 3. Submit | Verification email sent | High |
| ST-004 | Auth | Verify email with OTP | Account pending verification | 1. Enter OTP code 2. Submit | Account activated | High |
| ST-005 | Auth | Logout | User logged in | 1. Click Logout button | Redirected to login page | High |

### RequireRole.jsx
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| ST-006 | RequireRole | Unauthenticated access to protected route | Not logged in | 1. Navigate to /admin | Redirected to /login | High |
| ST-007 | RequireRole | Wrong role access | Logged in as CUSTOMER | 1. Navigate to /admin | Redirected to customer dashboard | High |
| ST-008 | RequireRole | Correct role access | Logged in as ADMIN | 1. Navigate to /admin | Admin dashboard shown | High |
| ST-009 | RequireRole | Loading state | Auth bootstrapping | 1. Load protected route | Spinner shown | Medium |

### DailyTasksModal.jsx
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| ST-010 | DailyTasksModal | Modal opens with date | Calendar with tasks | 1. Click on date cell | Modal opens with correct date in title | High |
| ST-011 | DailyTasksModal | QC tab displays tasks | Tasks exist for date | 1. Open modal 2. View QC tab | Table shows QC tasks | High |
| ST-012 | DailyTasksModal | Delivery tab displays | Tasks exist for date | 1. Open modal 2. Click Delivery tab | Table shows delivery tasks | High |
| ST-013 | DailyTasksModal | Maintenance tab displays | Maintenance exists | 1. Open modal 2. Click Maintenance tab | Table shows maintenance items | High |
| ST-014 | DailyTasksModal | Task summary cards show correct counts | Tasks with rules | 1. Open modal | Cards show X / Y format | High |
| ST-015 | DailyTasksModal | "Đạt giới hạn" when at max | Tasks at max capacity | 1. Open modal | Red tag shown on card | High |
| ST-016 | DailyTasksModal | Tab switching works | Modal open | 1. Click different tabs | Content changes correctly | High |
| ST-017 | DailyTasksModal | Chi tiết button triggers callback | Modal open | 1. Click Chi tiết button | onClickTask called with task | High |

### CartPage.jsx
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| ST-018 | CartPage | Empty cart display | Cart is empty | 1. Navigate to /cart | Empty cart message shown | High |
| ST-019 | CartPage | Cart with items | Cart has items | 1. Navigate to /cart | Items listed with details | High |
| ST-020 | CartPage | Update item quantity | Cart has items | 1. Change quantity input 2. Blur | Total price updated | High |
| ST-021 | CartPage | Remove item | Cart has items | 1. Click remove button | Item removed, total updated | High |
| ST-022 | CartPage | Proceed to checkout | Cart has items | 1. Click checkout button | Navigate to checkout page | High |

### LoginForm.jsx
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| ST-023 | LoginForm | Form renders correctly | - | 1. Navigate to /login | Username and password fields visible | High |
| ST-024 | LoginForm | Validation - empty fields | - | 1. Click Login without filling | Validation error messages | High |
| ST-025 | LoginForm | Submit form with credentials | - | 1. Fill form 2. Click Login | API called with credentials | High |
| ST-026 | LoginForm | Loading state during submit | - | 1. Submit form | Button disabled, spinner shown | High |
| ST-027 | LoginForm | Error message display | API returns error | 1. Submit with wrong credentials | Error message shown | High |

### TechnicianCalendar
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| ST-028 | TechnicianCalendar | Calendar renders | Logged in as TECHNICIAN | 1. Navigate to /technician | Calendar shows current month | High |
| ST-029 | TechnicianCalendar | Date selection opens modal | Tasks exist | 1. Click on date with tasks | DailyTasksModal opens | High |
| ST-030 | TechnicianCalendar | Task badges on dates | Tasks assigned | 1. View calendar | Dates show correct task counts | High |
| ST-031 | TechnicianCalendar | Month navigation | - | 1. Click next/prev month | Data reloads for new month | High |

### OperatorOrders
| ID | Module | Test Case | Precondition | Test Steps | Expected Result | Priority |
|----|--------|-----------|--------------|------------|-----------------|----------|
| ST-032 | OperatorOrders | Orders table renders | Logged in as OPERATOR | 1. Navigate to orders page | Orders listed in table | High |
| ST-033 | OperatorOrders | Status filter works | Orders exist | 1. Select status filter | Filtered results shown | High |
| ST-034 | OperatorOrders | Order detail drawer | Orders exist | 1. Click on order row | Drawer opens with details | High |
| ST-035 | OperatorOrders | Pagination | Many orders | 1. Click next page | Next page data loads | High |

---

## SUMMARY

| Category | Count | Priority Distribution |
|----------|-------|----------------------|
| Unit Tests | 85 | High: 65, Medium: 20 |
| Integration Tests | 49 | High: 45, Medium: 4 |
| System Tests | 35 | High: 33, Medium: 2 |
| **TOTAL** | **169** | **High: 143, Medium: 26** |
