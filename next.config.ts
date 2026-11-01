import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font nhúng vào biên lai PDF được đọc bằng fs lúc chạy, nên phải ghi rõ để Vercel đóng gói kèm.
  outputFileTracingIncludes: { "/api/hoa-don/[id]/pdf": ["./src/assets/fonts/**"], "/api/hoc-vien/[id]/lich-pdf": ["./src/assets/fonts/**"] },
  experimental: {
    // Bộ nhớ đệm phía trình duyệt: quay lại trang vừa xem trong 30 giây thì hiện ngay, không gọi lại máy chủ.
    // Sau mỗi thao tác lưu (server action) bộ nhớ này tự được làm mới nên không bị cũ dữ liệu.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
