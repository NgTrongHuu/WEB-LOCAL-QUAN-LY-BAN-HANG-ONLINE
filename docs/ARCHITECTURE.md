# ☕ Kiến trúc hệ thống Dailyc Coffee

> Tài liệu này dùng 3 chuẩn quốc tế phổ biến trong ngành phần mềm:
> **C4 Model** (kiến trúc hệ thống, 3 tầng zoom Context → Container → Component) ·
> **Crow's Foot Notation** (sơ đồ dữ liệu ERD) ·
> **UML State & Sequence Diagram** (vòng đời trạng thái & luồng xử lý).

---

## PHẦN A — KIẾN TRÚC HỆ THỐNG (C4 Model)

### A1. Level 1 — System Context
*Hệ thống nhìn từ bên ngoài: ai dùng, kết nối với gì.*

```mermaid
flowchart TB
    Owner(["👤 Chủ shop<br/><small>Actor</small>"])
    Sys["☕ Dailyc Coffee<br/><small>Hệ thống quản lý kinh doanh cà phê online</small>"]
    Ext[("🏦 Ngân hàng / Ví điện tử<br/><small>External System — tùy chọn</small>")]

    Owner -->|"Sử dụng"| Sys
    Sys -.->|"Đối soát giao dịch (tùy chọn)"| Ext

    classDef person fill:#1E6FD9,color:#fff,stroke:#1E6FD9,stroke-width:2px
    classDef system fill:#EEF4FB,stroke:#1E6FD9,stroke-width:2px,color:#1A1F2B
    classDef ext fill:#F1F5F9,stroke:#94A3B8,color:#475569,stroke-dasharray:4 3

    class Owner person
    class Sys system
    class Ext ext
```

### A2. Level 2 — Container Diagram
*Bên trong hệ thống gồm những khối chạy độc lập nào (app, server, database).*

```mermaid
flowchart TB
    Owner(["👤 Chủ shop"])

    subgraph SYS["☕ Dailyc Coffee — System Boundary"]
        direction LR
        SPA["🖥️ Web App<br/><small>SPA · React/Vue</small>"]
        API["⚙️ API Server<br/><small>Node.js · Express</small>"]
        DB[("🗄️ Database<br/><small>PostgreSQL</small>")]
        SPA -->|"REST API · JSON/HTTPS"| API
        API -->|"SQL"| DB
    end

    Owner -->|"HTTPS"| SPA

    classDef person fill:#1E6FD9,color:#fff,stroke:#1E6FD9,stroke-width:2px
    classDef container fill:#EEF4FB,stroke:#1E6FD9,stroke-width:2px,color:#1A1F2B
    classDef db fill:#F0FDF4,stroke:#16A34A,stroke-width:2px,color:#1A1F2B

    class Owner person
    class SPA,API container
    class DB db
```

### A3. Level 3 — Component Diagram
*Phóng to bên trong API Server: các module nghiệp vụ và quan hệ giữa chúng.*

```mermaid
flowchart TB
    subgraph API["⚙️ API Server — Component Boundary"]
        direction TB
        Auth["🔐 Auth"]
        Orders["🛒 Orders"]
        Inventory["📦 Inventory"]
        Returns["↩️ Returns"]
        Cashbook["💰 Cashbook"]
        Reports["📊 Reports"]

        Orders -->|"trừ / cộng kho"| Inventory
        Orders -->|"sinh phiếu thu"| Cashbook
        Returns -->|"cộng kho"| Inventory
        Returns -->|"sinh phiếu chi"| Cashbook
    end

    DB[("🗄️ Database")]
    API ==>|"đọc / ghi chung"| DB

    classDef comp fill:#FFF7ED,stroke:#D97706,color:#1A1F2B
    classDef db fill:#F0FDF4,stroke:#16A34A,stroke-width:2px,color:#1A1F2B

    class Auth,Orders,Inventory,Returns,Cashbook,Reports comp
    class DB db
```

> Ghi chú: `Reports` và `Auth` chỉ đọc/ghi trực tiếp Database, không có quan hệ chéo với module khác — nên không vẽ thêm đường để giữ sơ đồ sạch.

---

## PHẦN B — SƠ ĐỒ DỮ LIỆU (ERD — Crow's Foot Notation)

### B1. Miền dữ liệu: Luồng bán hàng

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : "đặt"
    CHANNEL ||--o{ ORDER : "qua kênh"
    ORDER ||--|{ ORDER_ITEM : "gồm"
    PRODUCT ||--o{ ORDER_ITEM : "được bán"
    ORDER ||--o{ RETURN_ORDER : "phát sinh"
    RETURN_ORDER ||--|{ RETURN_ITEM : "gồm"
    PRODUCT ||--o{ RETURN_ITEM : "được hoàn"
```

### B2. Miền dữ liệu: Hạ tầng hỗ trợ

```mermaid
erDiagram
    CATEGORY ||--o{ PRODUCT : "phân nhóm"
    PRODUCT ||--o{ STOCK_MOVEMENT : "biến động tồn"
    ORDER ||--o| CASH_TRANSACTION : "sinh phiếu thu"
    RETURN_ORDER ||--o| CASH_TRANSACTION : "sinh phiếu chi"
    FEEDBACK_CONTACT ||--o{ FEEDBACK_MESSAGE : "có góp ý"
```

### B3. Từ điển dữ liệu (Data Dictionary)

| Bảng | Khóa / Trường quan trọng | Ghi chú |
|---|---|---|
| **Product** | `code` (UK), `sellPrice`, `costPrice`, `stockQty`, `minStockThreshold`, `status` | Không xóa được nếu đã có giao dịch |
| **Order** | `code` (UK), `status` (processing/completed/cancelled), `paymentMethod`, `createdAt`, `completedAt` | Completed thì khóa, không sửa |
| **OrderItem** | `quantity`, `unitPrice`, `unitCost` | Chụp giá tại thời điểm bán, không tham chiếu giá hiện tại |
| **ReturnOrder** | `reason`, `refundAmount`, `refundMethod` | Chỉ tạo được từ Order đã completed |
| **ReturnItem** | `quantity`, `restock` (boolean) | `restock=false` khi hàng hỏng |
| **StockMovement** | `type` (sale/return/manual_adjust/cancel_restore), `quantityChange` | Nhật ký toàn bộ biến động tồn |
| **CashTransaction** | `type` (thu/chi), `fundType` (cash/bank/ewallet), `amount` | Sinh tự động từ Order/ReturnOrder hoặc tạo tay |
| **User** | `email` (UK), `passwordHash`, `role` (owner/staff) | Mật khẩu hash bcrypt |

---

## PHẦN C — HÀNH VI HỆ THỐNG (UML)

### C1. Vòng đời Đơn đi (State Diagram)

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Processing: Tạo đơn 🔻 trừ kho
    Processing --> Completed: ✅ Hoàn thành 💰 sinh thu
    Processing --> Cancelled: ❌ Hủy 🔺 hoàn kho
    Completed --> [*]
    Cancelled --> [*]

    classDef p fill:#FFF7ED,stroke:#D97706,color:#1A1F2B
    classDef c fill:#F0FDF4,stroke:#16A34A,color:#1A1F2B
    classDef x fill:#FEF2F2,stroke:#DC2626,color:#1A1F2B
    class Processing p
    class Completed c
    class Cancelled x
```

### C2. Luồng xử lý — Tạo đơn → Hoàn thành (Sequence Diagram)

```mermaid
sequenceDiagram
    actor U as 👤 Chủ shop
    participant FE as 🖥️ Frontend
    participant API as ⚙️ API
    participant DB as 🗄️ Database

    U->>FE: Tạo đơn
    FE->>API: POST /orders
    API->>DB: Kiểm tra & trừ tồn kho
    alt ✅ Đủ hàng
        DB-->>API: OK, đã ghi đơn
        API-->>FE: 201 Created
    else ❌ Thiếu hàng
        DB-->>API: Từ chối
        API-->>FE: 422 lỗi
    end

    U->>FE: ✅ Tick hoàn thành
    FE->>API: POST /orders/:id/complete
    API->>DB: Cập nhật trạng thái + sinh phiếu thu
    DB-->>API: OK
    API-->>FE: 200 OK
    FE-->>U: 📊 Cập nhật Tổng quan & Sổ quỹ
```

### C3. Luồng xử lý — Trả hàng (Sequence Diagram)

```mermaid
sequenceDiagram
    actor U as 👤 Chủ shop
    participant FE as 🖥️ Frontend
    participant API as ⚙️ API
    participant DB as 🗄️ Database

    U->>FE: Tạo phiếu trả
    FE->>API: POST /returns
    API->>DB: Kiểm tra hợp lệ<br/>(đơn completed, SL còn được hoàn)
    alt ✅ Hợp lệ
        DB-->>API: OK
        API->>DB: Cộng lại kho (nếu restock) + sinh phiếu chi
        API-->>FE: 201 Created
    else ❌ Vượt số lượng
        DB-->>API: Từ chối
        API-->>FE: 422 lỗi
    end
    FE-->>U: 📊 Cập nhật Kho & Sổ quỹ
```

---

## PHẦN D — MAPPING CODEBASE

| Feature (Frontend) | Module (Backend) | Bảng dữ liệu chính |
|---|---|---|
| 🛒 orders | /modules/orders | orders, order_items, stock_movements |
| 📦 inventory | /modules/products | products, stock_movements |
| ↩️ returns | /modules/returns | return_orders, return_items |
| 💰 cashbook | /modules/cashbook | cash_transactions |
| 💬 customers-feedback | /modules/customers | feedback_contacts, feedback_messages |
| 📊 reports | /modules/reports | đọc tổng hợp từ các bảng trên |
| 🔐 (toàn hệ thống) | /modules/auth | users |
