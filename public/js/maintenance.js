// public/js/maintenance.js
// NHIỆM VỤ: KIỂM TRA QUYỀN VÀ MỞ KHÓA GIAO DIỆN

(function() {
    // 1. Kiểm tra URL hoặc LocalStorage
    var urlParams = new URLSearchParams(window.location.search);
    var mode = urlParams.get('mode');
    var savedRole = localStorage.getItem('wave_alpha_role');

    // 2. Nếu là Admin
    if (mode === 'admin' || savedRole === 'admin') {
        console.log("🛡️ MAINTENANCE: Admin Detected - Unlocking...");
        
        // Lưu quyền
        localStorage.setItem('wave_alpha_role', 'admin');
        
        // Đánh dấu vào HTML
        document.documentElement.classList.add('is-admin-mode');
        
        // Bơm CSS cưỡng chế ẩn Overlay NGAY LẬP TỨC (quan trọng nhất)
        var style = document.createElement('style');
        style.innerHTML = `
            #maintenance-overlay { display: none !important; visibility: hidden !important; }
            #alpha-tab-nav { display: flex !important; }
            body { overflow: auto !important; }
        `;
        document.head.appendChild(style);
        
        // Nếu Tab Script đã load, kích hoạt tab Alpha
        if (window.pluginSwitchTab) window.pluginSwitchTab('alpha');
        
    } else {
        console.log("🔒 MAINTENANCE: Restricted Access");
        localStorage.removeItem('wave_alpha_role');
        document.documentElement.classList.remove('is-admin-mode');
    }
})();
