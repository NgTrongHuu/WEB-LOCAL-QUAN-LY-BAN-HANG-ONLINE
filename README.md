# ☕ Dailyc Coffee — Hệ thống quản lý kinh doanh

Web quản lý kinh doanh cho cửa hàng cà phê đóng gói bán online: Thực đơn, Kho hàng,
Đơn đi, Đơn hoàn về, Sổ quỹ, Báo cáo, và Sổ góp ý khách hàng.

Toàn bộ business logic (trừ/cộng kho, sinh phiếu thu/chi tự động, khóa đơn khi
hoàn thành, chặn bán vượt tồn kho, giới hạn số lượng hoàn trả...) chạy thật ở
backend, có transaction đảm bảo không bao giờ có dữ liệu nửa vời.

---

## 🚀 Chạy nhanh (chỉ cần 1 lệnh)

**Yêu cầu duy nhất:** máy đã cài [Node.js](https://nodejs.org) bản 18 trở lên.
(Python đã có sẵn trên hầu hết máy tính để chạy `start.py`.)

```bash
python start.py
```

Lệnh này sẽ tự động:
1. Kiểm tra Node.js đã cài chưa.
2. Cài thư viện backend (chỉ lần đầu tiên, mất khoảng 1 phút).
3. Tạo file cấu hình `.env` mặc định.
4. Khởi động server và tự mở trình duyệt tới `http://localhost:4000`.

Nhấn **Ctrl+C** trong terminal để tắt server.

### Tài khoản đăng nhập lần đầu

Khi chạy lần đầu, hệ thống tự tạo 1 tài khoản chủ shop và **in ra ngay trên terminal**:

```
Email:    owner@dailyc.coffee
Mật khẩu: DailycOwner123
```

**Hãy đổi mật khẩu này sau khi đăng nhập** (có thể sửa trực tiếp trong
`server/.env` trước lần chạy đầu, hoặc đổi qua API `/api/auth/change-password`
sau khi có giao diện đổi mật khẩu — hiện tại đổi bằng cách sửa `.env` rồi xóa
`server/data/dailyc.db` để tạo lại là nhanh nhất trong giai đoạn phát triển).

---

## 🖥️ Mở dự án bằng VS Code

1. Giải nén / mở thư mục `dailyc-coffee` bằng VS Code (File → Open Folder).
2. Mở Terminal tích hợp trong VS Code (`Ctrl+`` `` hoặc menu Terminal → New Terminal).
3. Chạy: `python start.py` (hoặc `python3 start.py` trên macOS/Linux).
4. Sửa code ở đâu, lưu file, rồi **tắt server (Ctrl+C) và chạy lại `python start.py`**
   để áp dụng thay đổi (backend không tự reload; frontend chỉ cần tải lại trang
   trình duyệt vì không qua bước build).

---

## 📁 Cấu trúc thư mục

```
dailyc-coffee/
├── start.py                 ← chạy file này để khởi động toàn bộ
├── server/                  ← Backend (Node.js + Express + SQLite)
│   ├── package.json
│   ├── .env.example         ← copy thành .env để tùy chỉnh cấu hình
│   ├── data/                ← file database SQLite tự tạo ở đây khi chạy
│   └── src/
│       ├── server.js        ← điểm khởi động
│       ├── app.js            ← khai báo toàn bộ route + middleware
│       ├── config/            ← đọc biến môi trường
│       ├── db/                 ← kết nối DB + schema + seed dữ liệu mẫu
│       ├── lib/                 ← hàm dùng chung (lỗi, format)
│       ├── middleware/          ← auth guard, xử lý lỗi tập trung
│       └── modules/             ← 1 THƯ MỤC = 1 NGHIỆP VỤ, mỗi module
│           ├── auth/               tự chứa route + business logic của nó
│           ├── products/           (Thực đơn + Kho hàng dùng chung)
│           ├── orders/             (Đơn đi - có business logic quan trọng nhất)
│           ├── returns/            (Đơn hoàn về)
│           ├── cashbook/           (Sổ quỹ)
│           ├── analytics/          (số liệu cho Tổng quan & Báo cáo)
│           └── feedback/           (Sổ góp ý khách hàng)
├── client/                  ← Frontend (HTML/CSS/JS thuần, không cần build)
│   ├── index.html            ← khung ứng dụng (sau khi đăng nhập)
│   ├── login.html
│   ├── css/                    tokens.css (design system) + main.css
│   └── js/
│       ├── api.js               HTTP client dùng chung
│       ├── ui.js                 format tiền, toast, modal, drawer...
│       ├── router.js              điều hướng trang (hash-based)
│       ├── main.js                 khởi động app, vẽ top bar
│       └── pages/                    1 file = 1 trang nghiệp vụ
└── docs/
    └── ARCHITECTURE.md       ← sơ đồ kiến trúc (C4 Model + ERD + UML) đã thiết kế
```

---

## 🗄️ Vì sao dùng SQLite thay vì PostgreSQL/MySQL ở bản này?

Để bạn **tải về và chạy ngay được trên máy cá nhân** mà không cần cài đặt,
cấu hình một server database riêng. SQLite vẫn là SQL thật (có transaction,
ràng buộc khóa ngoại, CHECK constraint) — toàn bộ business logic được viết
đúng chuẩn nên khi cần lên production với nhiều người dùng đồng thời, chỉ cần:

1. Đổi `server/src/db/connection.js` sang driver PostgreSQL/MySQL.
2. Chuyển schema ở `server/src/db/init.js` sang cú pháp SQL tương ứng
   (đã ghi chú tương đương ở `docs/ARCHITECTURE.md`).
3. Các module ở `server/src/modules/*` **không cần sửa** vì đã tách riêng lớp
   business logic khỏi lớp kết nối DB.

---

## 🛡️ Độ cứng/an toàn của backend (đã bổ sung sau bản đầu)

- **Validate dữ liệu đầu vào bằng Zod** (`server/src/lib/schemas.js` +
  `validateBody` middleware) ở MỌI route mutating — request thiếu field, sai
  kiểu, số âm/0 không hợp lệ bị chặn ngay với lỗi 400 rõ ràng, không rơi xuống
  tận service/DB nữa.
- **Pagination an toàn** (`server/src/lib/pagination.js`): `page`/`pageSize`
  âm, NaN, hoặc quá lớn đều được chặn — không còn dùng pattern
  `Number(x) || default` (pattern này KHÔNG chặn được số âm).
- **SQLite pragma tối ưu** (`server/src/db/connection.js`): `busy_timeout=5000`,
  `synchronous=NORMAL`, `temp_store=MEMORY` bên cạnh `foreign_keys=ON` và
  `journal_mode=WAL` đã có từ đầu.
- **Composite index** cho các truy vấn lọc nhiều điều kiện thường gặp nhất:
  `orders(status, created_at)`, `orders(status, completed_at)`,
  `return_orders(order_id, created_at)`, `cash_transactions(fund_type, created_at)`.
- **Tự động sao lưu database** mỗi 6 giờ (`server/src/db/backup.js`, dùng API
  `.backup()` gốc của better-sqlite3 — an toàn với WAL, không copy file thô),
  giữ tối đa 5 bản sao lưu gần nhất tại `server/data/backups/`.
- **Graceful shutdown**: Ctrl+C / SIGTERM đóng HTTP server rồi mới đóng kết nối
  database, có timeout 5s dự phòng nếu có request bị treo.
- **Request logging nhẹ** (method/path/status/thời gian), đánh dấu riêng
  request > 300ms — không log body/cookie/header nên không lộ dữ liệu nhạy cảm.
- **CORS & session**: `CORS_ORIGIN` mặc định đúng domain local (không dùng `*`
  khi session dùng cookie), `SESSION_SECRET` được `start.py` **tự sinh ngẫu
  nhiên** (32 byte, qua `secrets.token_hex`) cho mỗi lần cài đặt mới, không
  dùng chung 1 giá trị mẫu.

## 🆕 Tính năng bổ sung theo phản hồi thực tế

- **Quản lý nhóm sản phẩm** (nút "⚙️ Quản lý nhóm" ở Thực đơn/Kho hàng): thêm,
  đổi tên, xóa nhóm — xóa nhóm không xóa sản phẩm, sản phẩm chuyển về
  "chưa phân nhóm".
- **Endpoint phân tích riêng theo sản phẩm** (`GET /api/products/:id/stat`):
  tab "Phân tích" của 1 sản phẩm giờ gọi đúng 1 API thống kê sản phẩm đó
  (SL bán, doanh thu, SL hoàn, tỷ lệ hoàn trong khoảng ngày) thay vì tải cả
  danh sách top-products với `pageSize=1000` rồi lọc ở client.
- **KPI "Khách hàng"** thêm vào Tổng quan (khách mới / khách quay lại 7 ngày).
- **Chặn bấm trùng (double-submit)**: mọi nút Lưu/Tạo/Hủy quan trọng tự
  disable + đổi nhãn "Đang lưu..." trong lúc chờ server trả lời.
- **Giao diện**: nạp font Inter qua Google Fonts (có fallback hệ thống khi máy
  offline), input/select/filter-bar dùng 1 base style chung cao 40px bo viền
  rõ ràng (trước đây input "trần" ngoài `.field` bị trình duyệt render nhỏ,
  vuông), thêm hiệu ứng hover/focus/active cho nút và dòng bảng có thể bấm,
  menu người dùng đổi từ `confirm()` sang dropdown riêng.

## 🧠 Business logic cốt lõi (đã kiểm thử)

| Hành động | Điều gì xảy ra |
|---|---|
| Tạo đơn hàng | Trừ tồn kho ngay lập tức trong 1 transaction; chặn nếu không đủ hàng |
| Tick "Đã hoàn thành" | Khóa đơn, tự động sinh **phiếu thu** vào Sổ quỹ |
| Hủy đơn (khi đang xử lý) | Hoàn lại toàn bộ tồn kho, không tính doanh thu |
| Tạo phiếu trả hàng | Chỉ áp dụng cho đơn đã hoàn thành; cộng lại kho nếu chọn "nhập lại kho"; tự sinh **phiếu chi** |
| Điều chỉnh tồn kho tay | Ghi lại lịch sử biến động, không cho tồn âm |

Mọi KPI ở Tổng quan, Sổ quỹ, Báo cáo đều tính từ **cùng một nguồn dữ liệu** —
không có chỗ nào hard-code số liệu riêng lẻ có thể mâu thuẫn nhau.

---

## 🔄 Đặt lại dữ liệu về trạng thái ban đầu

Tắt server, xóa 3 file sau, rồi chạy lại `python start.py`:

```
server/data/dailyc.db
server/data/dailyc.db-shm
server/data/dailyc.db-wal
```

Hệ thống sẽ tự tạo lại tài khoản owner và dữ liệu mẫu (6 sản phẩm cà phê, danh
mục, kênh bán) như lần chạy đầu tiên.

---

## 🛣️ Việc còn lại để lên production thật (xem `docs/ARCHITECTURE.md`)

Bản này đã đầy đủ nghiệp vụ và chạy được thật, nhưng để phục vụ nhiều người
dùng cùng lúc trên internet, cần bổ sung (đã có thiết kế sẵn trong các trao
đổi trước, mỗi mục có thể triển khai độc lập):

- Đổi SQLite → PostgreSQL/MySQL cho môi trường nhiều người dùng đồng thời.
- Thêm rate limiting, CSP header đầy đủ, HTTPS bắt buộc khi deploy.
- Viết bộ test tự động (unit + integration) cho các luồng nghiệp vụ.
- Trang đổi mật khẩu, quản lý nhiều nhân viên (role staff) nếu cần.
- Tối ưu giao diện (code splitting, ảnh sản phẩm) khi dữ liệu lớn dần.

---

## 🆘 Xử lý sự cố thường gặp

**"Không tìm thấy Node.js"** → Cài tại https://nodejs.org, mở terminal mới rồi chạy lại.

**Cổng 4000 đã được dùng** → Sửa `PORT=4000` trong `server/.env` thành cổng khác
(ví dụ `4001`), lưu file, chạy lại `python start.py`.

**Muốn xem log lỗi backend chi tiết** → Log hiện ngay trên terminal đang chạy
`start.py`, cuộn lên để xem.
