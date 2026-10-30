import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bộ nhớ đệm phía trình duyệt: quay lại trang vừa xem trong 30 giây thì hiện ngay, không gọi lại máy chủ.
    // Sau mỗi thao tác lưu (server action) bộ nhớ này tự được làm mới nên không bị cũ dữ liệu.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
