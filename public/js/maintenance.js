// public/js/maintenance.js
// NHIỆM VỤ: KIỂM TRA QUYỀN VÀ MỞ KHÓA GIAO DIỆN HOẶC KHÓA CHẶT

(function() {
    // 1. Kiểm tra URL hoặc LocalStorage
    var urlParams = new URLSearchParams(window.location.search);
    var mode = urlParams.get('mode');
    var savedRole = localStorage.getItem('wave_alpha_role');
    
    // Lấy phần tử overlay từ HTML (đã có sẵn trong index.html)
    var overlay = document.getElementById('maintenance-overlay');

    // 2. Nếu là Admin (người có quyền truy cập)
    if (mode === 'admin' || savedRole === 'admin') {
        console.log("🛡️ MAINTENANCE: Admin Detected - Unlocking...");
        
        // Lưu quyền vào máy để lần sau không cần ?mode=admin nữa
        localStorage.setItem('wave_alpha_role', 'admin');
        
        // Đánh dấu vào HTML để CSS biết
        document.documentElement.classList.add('is-admin-mode');
        
        // Bơm CSS cưỡng chế ẩn Overlay NGAY LẬP TỨC để Admin dùng được web
        var style = document.createElement('style');
        style.innerHTML = `
            #maintenance-overlay { display: none !important; visibility: hidden !important; pointer-events: none !important; }
            #alpha-tab-nav { display: flex !important; }
            body { overflow: auto !important; }
        `;
        document.head.appendChild(style);
        
        // Nếu Tab Script đã load, kích hoạt tab Alpha
        if (window.pluginSwitchTab) window.pluginSwitchTab('alpha');
        
    } else {
        // 3. NẾU LÀ NGƯỜI DÙNG THƯỜNG -> KHÓA CHẶT
        console.log("🔒 MAINTENANCE: Restricted Access");
        
        // Xóa quyền cũ nếu có (đề phòng)
        localStorage.removeItem('wave_alpha_role');
        document.documentElement.classList.remove('is-admin-mode');
        
        // --- LOGIC QUAN TRỌNG: Cưỡng chế bật màn hình bảo trì ---
        if (overlay) {
            // Set style trực tiếp (inline style) để đè lên mọi CSS khác
            overlay.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                position: fixed !important;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: #0b0e11; 
                z-index: 2147483647 !important; /* Số lớn nhất có thể của z-index */
                align-items: center;
                justify-content: center;
                flex-direction: column;
            `;
        } else {
            // Trường hợp file HTML chưa load xong hoặc thiếu ID, tạo màn đen che tạm
            document.body.innerHTML = '<div style="background:#0b0e11;color:#fff;height:100vh;display:flex;justify-content:center;align-items:center;"><h1>SYSTEM MAINTENANCE</h1></div>';
        }
        
        // Khóa cuộn chuột của trang web để không kéo xuống xem trộm được
        document.body.style.overflow = 'hidden';
    }
})();