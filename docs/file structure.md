# File Structure

Tài liệu này mô tả ý nghĩa của các thư mục chính trong dự án `gym-web`.

## apps/
Chứa các ứng dụng chính của dự án.

- `backend/`
  - `src/`
    - `config/` : Cấu hình ứng dụng như biến môi trường, thiết lập dịch vụ, cấu hình cơ sở dữ liệu.
    - `middlewares/` : Các middleware cho server, ví dụ xác thực, xử lý lỗi, ghi log.
    - `modules/` : Các chức năng chính của backend được chia theo module, ví dụ quản lý người dùng, bài tập, lịch tập.
    - `utils/` : Hàm tiện ích dùng chung, helper functions và công cụ hỗ trợ.

- `frontend/`
  - `src/`
    - `asset/` : Hình ảnh, biểu tượng, font chữ.
    - `components/` : Các thành phần giao diện tái sử dụng chung.
    - `features/` : Các chức năng hoặc domain chính của frontend, thường chứa logic và giao diện theo tính năng.
    - `layouts/` : Cấu trúc bố cục trang chung, ví dụ header, footer, điều hướng.
    - `pages/` : Các trang chính của ứng dụng.
    - `services/` : Gọi API, xử lý dữ liệu từ backend, các service client.
    - `utils/` : Hàm tiện ích frontend dùng chung.

## data/

- `seeds/`

## db/

- `prisma/`

## docs/

## packages/

## README.md
Tập tin hướng dẫn chính của dự án, cung cấp thông tin tổng quan, cách cài đặt và sử dụng.
