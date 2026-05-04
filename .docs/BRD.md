# BRD — Hệ thống Quản lý dự án (QLDA)

> **Source:** `BRD-QLDA 27042026.doc` (Microsoft Word, 2.6 MB) in this folder.
> Extracted to plain text via `word-extractor`; structure preserved here as Markdown for easy diffing.
> If the .doc is updated, re-extract and overwrite this file.
>
> **Issuer:** Công ty Cổ phần Tin học Viễn thông Hàng không (AITS — VNA group)
> **Author:** Dương Minh Phúc
> **Date:** 04/2026
> **Version:** 1

## I. Định nghĩa & thuật ngữ viết tắt

| Viết tắt | Mô tả |
| --- | --- |
| QLDA | Quản lý dự án |
| TTK | Tổ triển khai |
| TCHC | Tổ chức Hành chính (creates projects, closes projects) |
| TCNL | Tổ chức Nhân lực (closes TTK after KSV approval) |
| KSV | Kiểm soát viên (quality control / approver, lives in DBCL dept) |
| BĐH | Ban điều hành |
| PMO | Phòng Quản lý Dự án — admin role for "tạm đóng" |
| PM | Project Manager |
| QLDA / Chuyên viên QLDA | Project specialist (manages plans/risks/docs) |
| Điều phối TTK | TTK coordinator |
| Thành viên TTK | Delivery team member |
| HRM | Human Resource Management system (external) |
| KTQT | Kế toán Quản trị (Management Accounting) — external system |
| a.Office | External time / personal-plan system |
| DBHĐ | Đảm bảo hoạt động (operational support) |
| TKDA | Triển khai dự án |
| AD / LDAP | Active Directory / LDAP — for SSO |

## II. Tổng quan

### II.1. Hiện trạng

- Công tác QLDA hiện đang thủ công bằng Excel rời rạc.
- Không có cơ chế cảnh báo tự động về tiến độ, giờ công, phân bổ nguồn lực.
- Dữ liệu chưa liên thông với HRM, KTQT, hoặc các hệ nghiệp vụ (SD).

**Vấn đề:** không có công cụ theo-dõi-thời-gian-thực, dữ liệu rời rạc, khó kiểm soát rủi ro, phân bổ nguồn lực thiếu chủ động.

### II.2. Mục tiêu

1. Quản lý tiến độ dự án theo thời gian thực.
2. Kiểm soát nguồn lực và giờ công.
3. Cảnh báo và quản lý rủi ro tự động.
4. Tích hợp dữ liệu với HRM, KTQT, a.Office.
5. Báo cáo quản trị và dashboard.
6. Khả năng mở rộng cho tương lai.

### II.3. Phạm vi

Áp dụng cho thành viên TTK theo Quyết định thành lập, TCNL, KSV, BĐH, LĐ ĐVCM.

## III. Quy trình nghiệp vụ tổng thể

### III.1.2 Mô tả luồng nghiệp vụ chính

| # | Chức năng | Tác nhân | Mô tả |
| - | --------- | -------- | ----- |
| 1 | Khởi tạo dự án | TCHC | Tạo dự án sau khi có QĐ thành lập TTK. Trường: tên, mã, số QĐ, hồ sơ căn cứ, nhiệm vụ TTK, ngày bắt đầu/kết thúc, trạng thái, thông tin nhân sự TTK (chọn từ HRM). Kết quả: trạng thái "Đang triển khai". |
| 2 | Triển khai dự án | — | Chia thành 6 màn hình: Thông tin chung, Kế hoạch triển khai, Thông tin nhân sự, Phân bổ giờ công theo tháng, Thông tin tài liệu, Thông tin rủi ro. |
| 2.1 | Cập nhật thông tin chung | Điều phối TTK | Hình thức TTK (Kiêm nhiệm/Chuyên trách); Loại dự án (Tiền khả thi/Khả thi/Có HĐ/Nội bộ); Lợi nhuận, chi phí; Thông tin KH, đối tác. |
| 2.2 | Cập nhật Kế hoạch triển khai | PM, Điều phối TTK | Quản lý kế hoạch + theo dõi tiến độ. |
| 2.2.1 | Quản lý kế hoạch | Chuyên viên QLDA | CRUD task tổng & subtask. Trường: nội dung, timeline, giờ công kế hoạch, người thực hiện. Ghi lịch sử. |
| 2.2.2 | Cập nhật tiến độ | Thành viên TTK | % hoàn thành, giờ công thực tế, nội dung. Hệ thống tự tổng hợp giờ công. **Đồng bộ worklog sang a.Office.** Ghi lịch sử. |
| 2.3 | Quản lý & phân bổ nguồn lực | Chuyên viên QLDA | 3 nhóm: nguồn lực kế hoạch cá nhân (a.Office), giờ công kế hoạch TTK, giờ công thực tế và còn lại. |
| 2.3.1 | Nguồn lực kế hoạch cá nhân | — | DBHĐ và khác: đồng bộ từ a.Office. TKDA: tổng hợp từ phân bổ. Hiển thị Gantt theo tháng. **a.Office là nguồn chuẩn — không cho sửa trên QLDA.** |
| 2.3.2 | Nguồn lực kế hoạch TTK | Điều phối TTK | Phân bổ theo tháng + theo thành viên. So sánh với KTQT. **Với dự án Có HĐ/Khả thi: tổng giờ công không vượt KTQT; hệ thống tự đối chiếu, không cho lưu nếu vượt.** |
| 2.3.3 | Nguồn lực thực tế & còn lại | — | Tổng hợp từ worklog + a.Office (DBHĐ và khác). Hiển thị: cá nhân (theo tháng/lĩnh vực), TTK (tổng/đã dùng/còn lại). |
| 2.4 | Cập nhật tài liệu | Chuyên viên QLDA | CRUD tài liệu: tên, file, loại (từ danh mục), ghi chú. Ghi lịch sử. |
| 2.5 | Cập nhật rủi ro | Chuyên viên QLDA | Trường: nguyên nhân, nội dung rủi ro, giải pháp, nhân sự khắc phục, hạn xử lý, nội dung xử lý, tiến độ xử lý, ghi chú. Ghi lịch sử. |
| 2.6 | Cập nhật thông tin nhân sự | Chuyên viên QLDA | CRUD TTK / KH / Đối tác. Chọn từ danh mục hoặc tạo mới. Bổ sung vai trò, nhiệm vụ, giờ công. |
| 4 | Báo cáo | Chuyên viên QLDA | Báo cáo tuần TTK; Báo cáo tổng hợp; Báo cáo đánh giá PMO; báo cáo phát sinh. |
| 5 | Đóng / tạm đóng | Chuyên viên QLDA | Multi-step approval flow (xem section IV.5 chi tiết). |

## IV. Đặc tả chi tiết yêu cầu chức năng

### IV.1. Truy cập hệ thống

| # | Chức năng | Tác nhân | Mô tả |
| - | --------- | -------- | ----- |
| 1 | Đăng nhập | Người dùng | **LDAP domain AITS** |
| 2 | Đăng xuất | Người dùng | — |

### IV.2. Quản trị hệ thống

#### Quản trị danh mục

| # | Danh mục | Tác nhân | Trường / Quy tắc |
| - | -------- | -------- | ---------------- |
| 1 | Vai trò dự án | Admin | CRUD: tên vai trò, nhiệm vụ, trạng thái hoạt động |
| 2 | Trạng thái dự án | Admin | **READ-ONLY system values:** Đang triển khai, Đã đóng |
| 3 | Sức khỏe dự án | Admin | **READ-ONLY system values:** Ổn định (task đúng hạn), Cần xem xét (còn ≤1 ngày, chưa xong), Có rủi ro (đến hạn, chưa xong) |
| 4 | Hình thức TTK | Admin | CRUD: tên, ghi chú, active, người tạo, ngày tạo, người chỉnh sửa cuối, ngày chỉnh sửa cuối |
| 5 | Hình thức triển khai | Admin | CRUD same fields as Hình thức TTK |
| 6 | Loại tài liệu hồ sơ dự án | Admin | CRUD |
| 7 | Nhân sự KH/Đối tác | Admin, QLDA | CRUD: họ tên, mã NV, chức danh, đơn vị, vai trò, nhiệm vụ, tổng giờ công, email, SĐT, audit (người tạo, ngày tạo, người sửa cuối, ngày sửa cuối) |

#### Quản trị người dùng & phân quyền

| # | Chức năng | Tác nhân | Mô tả |
| - | --------- | -------- | ----- |
| 1 | Quản lý phân quyền | Admin | CRUD quyền: tên quyền truy cập, danh sách chức năng (hiển thị **dạng sơ đồ cây**) |
| 2 | Quản lý người dùng | Admin | Xem nhân sự đồng bộ từ HRM + cấp quyền. Trường: tên, mã, chức danh, đơn vị, có tham gia dự án nào không, trạng thái hoạt động |

### IV.3. Trang chủ / Dashboard

- Số liệu thống kê tiến độ TKDA
- Số liệu thống kê nguồn lực TKDA
- (Chi tiết bổ sung trong FSD)

### IV.4. Quy trình Khởi tạo dự án

| # | Chức năng | Tác nhân | Mô tả |
| - | --------- | -------- | ----- |
| 1 | Tạo mới dự án | TCHC | Trường: mã, tên, nhân sự TTK, thời gian, PS, PM. Ghi lịch sử tạo. |
| 2 | Xem danh sách dự án | TCHC | Lọc theo trạng thái (Đang triển khai / Đã đóng). Cột: mã, tên, trạng thái, số NS, PM, PS, sức khỏe, hình thức TTK, hình thức triển khai. Tìm kiếm theo các cột này. |
| 3 | Cập nhật thông tin khởi tạo | TCHC | Sửa: mã, tên, nhân sự TTK, thời gian, PS, PM. |

### IV.5. Quy trình Triển khai dự án

| # | Chức năng | Tác nhân | Mô tả |
| - | --------- | -------- | ----- |
| 1 | Cập nhật thông tin dự án | TCHC, QLDA, Thành viên TTK | 7 mục: Khởi tạo, Chung, KH triển khai (Gantt), Nhân sự, Rủi ro, Hồ sơ, Quản lý giờ công |
| 1.1 | Cập nhật chung | QLDA, TV TTK | Mô tả, nhiệm vụ TTK, ngày bắt đầu/kết thúc, tổng giờ triển khai, doanh thu/chi phí/lợi nhuận, hình thức TTK, hình thức triển khai. Ghi lịch sử. |
| 1.2 | Cập nhật nhân sự | QLDA | AITS / KH / Đối tác. Họ tên, mã NV, chức danh, đơn vị, vai trò, nhiệm vụ, tổng giờ công, email, SĐT. Ghi lịch sử. |
| 1.2.1 | Xem danh sách | TV TTK | 3 loại bảng (AITS/KH/Đối tác). Phân trang + tìm kiếm theo cột. |
| 1.2.2 | Thêm nhân sự | QLDA | AITS lấy từ HRM. KH/Đối tác chọn từ danh mục hoặc tạo mới. Ghi lịch sử. |
| 1.2.3 | Sửa | QLDA | AITS không sửa được trường lấy từ HRM. KH/Đối tác đồng bộ vào danh mục KH/Đối tác. |
| 1.2.4 | Xóa khỏi dự án | QLDA | Xóa khỏi DA, **giữ nguyên giờ công đã thực hiện**. |
| 1.3 | Tài liệu | QLDA | CRUD: file, tên, loại, ghi chú. Ghi lịch sử. |
| 1.4 | Rủi ro | QLDA | Trường: nhận diện, nội dung, giải pháp, NS thực hiện, hạn, kết quả, tiến độ, thời gian cập nhật, kế hoạch tiếp, ghi chú. Ghi lịch sử. |
| 2.1 | Tạo task tổng quan | QLDA | Tên, thành viên, trạng thái, thời gian KH, tiến độ ban đầu. Ghi lịch sử **sau khi phê duyệt KH triển khai**. |
| 2.2 | Cập nhật task tổng quan | QLDA | Same fields. |
| 2.3 | Xóa task tổng quan | QLDA | — |
| 2.4 | Cập nhật subtask | QLDA | Tên, **task cha**, thành viên, trạng thái, thời gian KH, tiến độ ban đầu. |
| 2.5 | Tạo subtask | QLDA | Same. |
| 2.6 | Xóa subtask | QLDA | — |
| 2.7 | Khai báo giờ công + tiến độ | TV TTK | % hoàn thành mới, giờ công thực hiện, nội dung kết quả. **Giờ công task = tổng giờ công subtask đã thực hiện**. |
| 2.8 | Xem danh sách công việc | TV TTK, QLDA | **Biểu đồ Gantt** |
| 3.1 | Theo dõi kế hoạch cá nhân | Chuyên viên QLDA | Timeline tất cả TV TTK đang tham gia. Phân loại "Giờ DBHĐ và khác" vs "Giờ triển khai dự án". **Gantt**. |
| 3.2 | Phân bổ giờ công theo tháng / TV TTK | QLDA | Các tháng lấy từ thời gian dự án. Tổng giờ NS = tổng phân bổ tháng. |
| 3.3 | Nguồn lực | QLDA, cá nhân | Tổng KH dự án, đã thực hiện, còn lại. Per cá nhân: Giờ KH a.Office, tổng giờ KH dự án (từ phân bổ tháng), giờ thực hiện. Per tháng: QLDA phân bổ, KH a.Office, thực hiện DA, thực hiện cả tháng (HRM/a.Office, **phân thành PJ/RQ/CRQ/Khác**). QLDA xem được nguồn lực dự án khác. |
| 4 | Khai báo worklog | Hệ thống | Hệ thống ghi nhận giờ công đã khai báo, tổng hợp **gửi sang a.Office**. Trường: nội dung, thời gian, giờ công, kết quả. |
| 5.1 | Xuất báo cáo tuần | QLDA | Mẫu khách hàng cung cấp |
| 5.2 | Xuất kế hoạch triển khai chi tiết | QLDA | Mẫu khách hàng cung cấp |
| 6.1 | Cảnh báo gần đến hạn | Hệ thống | **4 ngày trước hạn task/subtask, chưa xong** → toàn bộ TTK. Trạng thái dự án → "Cần xem xét". |
| 6.2 | Cảnh báo quá hạn | Hệ thống | **Đến hạn, chưa xong** → toàn bộ TTK. Trạng thái → "Có rủi ro". |

### IV.6. Quy trình Đóng / Tạm đóng

| # | Chức năng | Tác nhân | Mô tả |
| - | --------- | -------- | ----- |
| 1 | Tạm đóng TTK | QLDA | Trạng thái → "Tạm đóng". Ghi lịch sử. |
| 2 | Mở lại TTK | QLDA | Tạm đóng → Đang triển khai. Ghi lịch sử. |
| 3.1 | Gửi phê duyệt KSV | QLDA | Gửi info + hồ sơ tới NS đơn vị **DBCL, chức danh KSV**. **Thông báo in-app + email.** Ghi lịch sử. |
| 3.2 | Phê duyệt | KSV | Chuyển tiếp tới NS đơn vị **TCHC, chức danh TCNL**. Ghi lịch sử. |
| 3.3 | Từ chối | KSV | Thông báo + yêu cầu gửi lại QLDA. Ghi lịch sử. |
| 3.4 | Xác nhận và đóng TTK | TCHC | Trạng thái → "Đóng". Ghi lịch sử. |
| 3.5 | Từ chối đóng | TCHC | Thông báo gửi lại QLDA. Ghi lịch sử. |

**Sau khi trạng thái Đóng:** không cho phép sửa thông tin, kế hoạch, nguồn lực, tài liệu, rủi ro.

## V. Đào tạo & triển khai

- Online/offline, 1 buổi.
- Webex / Google Meet / Zoom.

## VI. Quản lý người dùng & phân quyền

- Admin chủ động phân quyền theo:
  - Dữ liệu hệ thống
  - Chức năng hệ thống

## VII. Chuyển đổi dữ liệu

- **Không có.**

## VIII. Yêu cầu phi chức năng

| Hạng mục | Yêu cầu |
| -------- | ------- |
| Môi trường | Mạng LAN nội bộ VNA. Tổng 300 người. **100 concurrent users.** |
| Hạ tầng / kết nối | Tích hợp với HRM, KTQT, a.Office |
| An ninh / bảo mật | Cam kết bảo mật + chống truy cập trái phép. **Tiêu chuẩn ngành hàng không.** Ghi log thao tác (IP, thời gian, trạng thái đăng nhập). **Xác thực bằng AD.** |
| Thời gian dịch vụ | **24/7, SLA tối thiểu 99%** |
| Chịu tải | Đáp ứng tất cả request từ các hệ thống nguồn dữ liệu (cập nhật/truy xuất hằng ngày) |
| Vận hành | Tài liệu sử dụng + kỹ thuật. ĐBHĐ bởi phòng SPDVPM AITS. Yêu cầu dịch vụ qua **helpdesk@aits.vn** + Servicedesk. |
| Backup / phục hồi | Cơ chế sao lưu. **Downtime ≤ 12 giờ.** |
| Ngôn ngữ | **Tiếng Việt** |
