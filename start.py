#!/usr/bin/env python3
"""
start.py
========
Script khởi động TOÀN BỘ Dailyc Coffee bằng một lệnh duy nhất:

    python start.py

Việc nó làm, theo đúng thứ tự:
  1. Kiểm tra máy đã cài Node.js chưa (bắt buộc, vì backend viết bằng Node/Express).
  2. Cài đặt các thư viện backend (npm install) NẾU chưa cài (chỉ chạy 1 lần).
  3. Tạo file server/.env từ server/.env.example NẾU chưa có.
  4. Khởi động server Node.js (server/src/server.js) - server này tự tạo/khởi tạo
     database SQLite ở lần chạy đầu tiên, và phục vụ LUÔN cả giao diện web (client/),
     nên chỉ cần 1 tiến trình duy nhất, không cần chạy 2 server riêng.
  5. Tự mở trình duyệt tới http://localhost:4000 sau khi server sẵn sàng.
  6. Nhấn Ctrl+C trong cửa sổ terminal này để tắt toàn bộ server một cách an toàn.

Yêu cầu trên máy: đã cài Node.js (khuyên dùng bản 18 trở lên) - tải tại https://nodejs.org
Không cần cài Python package nào thêm - chỉ dùng thư viện chuẩn của Python.
"""
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SERVER_DIR = ROOT_DIR / "server"
PORT = 4000
URL = f"http://localhost:{PORT}"


def line(char="-", n=60):
    print(char * n)


def check_node_installed():
    node_path = shutil.which("node")
    npm_path = shutil.which("npm")
    if not node_path or not npm_path:
        line("=")
        print("LỖI: Không tìm thấy Node.js trên máy này.")
        print("Dailyc Coffee cần Node.js (khuyên dùng bản 18 trở lên) để chạy backend.")
        print("Hãy tải và cài đặt tại: https://nodejs.org")
        print("Sau khi cài xong, mở lại terminal mới rồi chạy lại: python start.py")
        line("=")
        sys.exit(1)

    try:
        version = subprocess.run(
            [node_path, "--version"], capture_output=True, text=True, check=True
        ).stdout.strip()
        print(f"✓ Đã tìm thấy Node.js phiên bản {version}")
    except Exception:
        print("✓ Đã tìm thấy Node.js (không đọc được phiên bản, vẫn tiếp tục).")

    return node_path, npm_path


def ensure_dependencies_installed(npm_path):
    node_modules = SERVER_DIR / "node_modules"
    if node_modules.exists():
        print("✓ Thư viện backend đã được cài đặt trước đó (server/node_modules đã có).")
        return

    print("→ Lần đầu chạy: đang cài đặt thư viện backend (npm install)...")
    print("  (Bước này có thể mất 1-2 phút tùy tốc độ mạng, chỉ cần làm 1 lần.)")
    result = subprocess.run([npm_path, "install"], cwd=str(SERVER_DIR))
    if result.returncode != 0:
        print("LỖI: npm install thất bại. Kiểm tra kết nối mạng rồi thử lại.")
        sys.exit(1)
    print("✓ Cài đặt thư viện backend thành công.")


def ensure_env_file():
    env_file = SERVER_DIR / ".env"
    example_file = SERVER_DIR / ".env.example"
    if not env_file.exists() and example_file.exists():
        content = example_file.read_text(encoding="utf-8")
        # Sinh SESSION_SECRET ngẫu nhiên, đủ mạnh (32 byte = 64 ký tự hex) cho MỖI
        # máy cài đặt - KHÔNG dùng chung giá trị mẫu trong .env.example cho mọi người,
        # vì đó là bí mật dùng để ký session cookie.
        random_secret = secrets.token_hex(32)
        content = re.sub(
            r"^SESSION_SECRET=.*$",
            f"SESSION_SECRET={random_secret}",
            content,
            flags=re.MULTILINE,
        )
        env_file.write_text(content, encoding="utf-8")
        print("✓ Đã tạo file server/.env từ server/.env.example (tự sinh SESSION_SECRET ngẫu nhiên).")
    elif env_file.exists():
        print("✓ Đã có file server/.env, giữ nguyên cấu hình hiện tại.")


def start_server(node_path):
    print(f"→ Đang khởi động Dailyc Coffee tại {URL} ...")
    line()
    # Chạy trực tiếp, KHÔNG bắt output - để người dùng thấy log/lỗi của server ngay trên terminal
    process = subprocess.Popen(
        [node_path, "src/server.js"],
        cwd=str(SERVER_DIR),
    )
    return process


def open_browser_when_ready():
    # Đợi vài giây cho server kịp khởi động rồi tự mở trình duyệt
    time.sleep(2.5)
    try:
        webbrowser.open(URL)
    except Exception:
        pass  # Không mở được trình duyệt tự động thì người dùng tự mở link cũng được


def main():
    line("=")
    print("  ☕  DAILYC COFFEE — Khởi động hệ thống quản lý kinh doanh")
    line("=")

    node_path, npm_path = check_node_installed()
    ensure_dependencies_installed(npm_path)
    ensure_env_file()

    process = start_server(node_path)

    # Mở trình duyệt trong một tiến trình con nhẹ, không chặn server chính
    import threading
    threading.Thread(target=open_browser_when_ready, daemon=True).start()

    print()
    print(f"  Truy cập: {URL}")
    print("  Nhấn Ctrl+C tại đây để tắt server.")
    line("=")

    try:
        process.wait()
    except KeyboardInterrupt:
        print("\n→ Đang tắt Dailyc Coffee...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        print("✓ Đã tắt server. Hẹn gặp lại!")


if __name__ == "__main__":
    main()
