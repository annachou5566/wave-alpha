{ pkgs, ... }: {
  channel = "stable-24.05"; 

  # 1. Cài đặt các công cụ cần thiết
  packages = [
    pkgs.python311          # Cài Python 3.11 để chạy backend
    pkgs.nodejs_20          # Cài Node.js (dự phòng nếu cần)
  ];

  env = {};
  
  idx = {
    # 2. Cài sẵn Extension xịn cho bạn
    extensions = [
      "ritwickdey.LiveServer" # Extension huyền thoại để xem web HTML
      "ms-python.python"      # Hỗ trợ code Python gợi ý lỗi
    ];

    # 3. Cấu hình nút Preview (Xem trước web)
    previews = {
      enable = true;
      previews = {
        web = {
          # Lệnh này sẽ tự động bật web server bằng Python ở cổng $PORT
          command = ["python3" "-m" "http.server" "$PORT" "--bind" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}