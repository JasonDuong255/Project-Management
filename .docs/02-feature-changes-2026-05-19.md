# Feature changes - 2026-05-19

Snapshot này ghi lại các thay đổi đã được triển khai trong app QLDA sau vòng góp ý dùng thử. Đây là trạng thái đã code và build được, không phải backlog mong muốn.

## 1. Danh sách dự án

- Trang `/projects` đã đổi danh sách dự án từ card sang bảng để dễ quét thông tin.
- Bộ lọc danh sách gồm 3 nhóm:
  - `Tất cả`
  - `Đang triển khai`
  - `Đã đóng/tạm đóng`
- Bảng hiển thị các cột chính: mã dự án, tên dự án, PM, Sponsor, trạng thái, health, tiến độ, nhân sự, tài liệu, rủi ro, thời gian và thao tác xem.
- Các subtitle nhỏ trong title chọn tab của màn chi tiết dự án đã được bỏ để giao diện gọn hơn.

## 2. Tạo mới dự án

- Người dùng `ADMIN_HC` / TCHC là nhóm tạo dự án theo luồng hiện tại.
- Bỏ nhập thủ công mã dự án. Mã dự án tự fill realtime theo công thức:

```text
Năm khởi tạo dự án-Số thứ tự dự án trong năm-Mã trung tâm kinh doanh-Mã nhóm khách hàng-Mã lĩnh vực-Mã loại dự án
```

- Form tạo mới dự án bổ sung các trường chọn:
  - Mã trung tâm kinh doanh: `BU1`, `BU2`, `BU3`, `BU4`, `BU5`
  - Mã nhóm khách hàng: `VNA`, `LDLK`, `OT`, `NB`
  - Mã thị trường: `HK`, `CHK`, `AN`, `CP`, `XD`, `TC`, `GD`, `NL`, `DN`, `YT`, `HH`
  - Mã lĩnh vực: `PM`, `HT`, `DV`
  - Mã loại dự án: `NC`, `KT`, `HĐ`, `NB`
- Bỏ trường tóm tắt khỏi form tạo mới. Tóm tắt dự án được cập nhật trong tab overview bởi điều phối/nhóm có quyền.
- Cho phép đính kèm file số quyết định TTK khi tạo dự án. File được lưu thành tài liệu dự án với loại tài liệu `Quyết định thành lập TTK`.

## 3. Tab Khởi tạo

- User TCHC được phép cập nhật thông tin trong tab `Khởi tạo`.
- Phần căn cứ chỉ còn 2 bảng:
  - `Hợp đồng mua`
  - `Hợp đồng bán`
- Hai bảng này cho phép thêm, sửa, xóa tài liệu đúng loại tương ứng.

## 4. Tab Thông tin chung

- Sponsor / PS được đẩy lên hiển thị trước PM trong phần overview.
- Điều phối có thể cập nhật tóm tắt dự án tại tab overview.

## 5. Thứ tự tab chi tiết dự án

Thứ tự tab hiện tại:

```text
Khởi tạo -> Thông tin chung -> Nhân sự -> Kế hoạch -> Nguồn lực -> Rủi ro -> Tài liệu
```

## 6. Tab Quản lý nguồn lực

- Có toggle hiển thị phân bổ theo từng tháng.
- Bảng nguồn lực quản lý:
  - Giờ công kế hoạch
  - Giờ công đã thực hiện
  - Giờ công đã thực hiện theo tháng
  - Tổng theo từng cá nhân và tổng toàn dự án
- Tổng giờ công theo Kinh doanh hiển thị cạnh tổng giờ công kế hoạch.
- Cột tổng giờ công đã thực hiện lấy từ dữ liệu khai báo tiến độ/worklog của từng thành viên.

## 7. Công việc và khai báo tiến độ

- Công việc đã hoàn thành không được khai báo thêm giờ công.
- Công việc đã hoàn thành không được sửa task.
- Các thao tác cập nhật, khai báo tiến độ và thêm subtask được đưa trực tiếp vào từng dòng task để giảm thao tác mở modal không cần thiết.

## 8. Tạm đóng, đóng và mở lại dự án

- Nút chức năng `Tạm đóng`, `Đóng`, `Mở lại` đã được gom vào một khu vực thao tác gọn hơn, không chiếm nhiều diện tích màn hình.
- Tạm đóng và mở lại dự án bắt buộc nhập lý do trong popup.
- Backend lưu lý do tạm đóng/mở lại và ghi nhận vào workflow đóng dự án.

## 9. Tài liệu và file đính kèm

- Backend có helper lưu file local cho tài liệu dự án.
- Express serve thư mục `/uploads` để frontend có thể mở file đã lưu.
- API tài liệu nhận thêm payload file đính kèm base64, tên file, MIME type và kích thước file.

## 10. Kiểm tra đã chạy

- Backend build: pass.
- Frontend build: pass.
- Frontend lint hiện vẫn có một số cảnh báo/lỗi rule cũ không thuộc thay đổi này, chủ yếu liên quan fast-refresh exports và hooks lint trong code hiện hữu.

