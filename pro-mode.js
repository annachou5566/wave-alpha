/* pro-mode.js - Module Bảo trì & Nâng cấp */

(function() {
    // 1. Kiểm tra xem có phải Admin không?
    // Admin là người có ?mode=admin trên URL hoặc đã từng đăng nhập trước đó
    const urlParams = new URLSearchParams(window.location.search);
    const isUrlAdmin = urlParams.get('mode') === 'admin';
    const isSavedAdmin = localStorage.getItem('wave_alpha_admin') === 'true';
    
    // Nếu là Admin -> Lưu quyền lại và KHÔNG làm gì cả (để web cũ chạy)
    if (isUrlAdmin || isSavedAdmin) {
        if (isUrlAdmin) localStorage.setItem('wave_alpha_admin', 'true');
        console.log("Creating Pro Mode: ADMIN DETECTED - Access Granted");
        return; 
    }

    // 2. Nếu KHÔNG phải Admin -> Chèn màn hình bảo trì che lấp tất cả
    console.log("Creating Pro Mode: VISITOR DETECTED - Maintenance Active");
    
    const maintenanceHTML = `
    <div id="maintenance-overlay">
        <div class="pm-loader"></div>
        <div class="pm-title">SYSTEM UPGRADE</div>
        <p class="pm-desc">
            Hệ thống đang bảo trì để nâng cấp dữ liệu Real-time.<br>
            Vui lòng quay lại sau ít phút.
        </p>
    </div>
    `;

    // Chèn vào ngay đầu trang web
    document.body.insertAdjacentHTML('afterbegin', maintenanceHTML);
    
    // Khóa cuộn trang để không kéo xuống xem được
    document.body.style.overflow = 'hidden';

})();
