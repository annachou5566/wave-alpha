// public/js/maintenance.js
// NHIỆM VỤ DUY NHẤT: KIỂM TRA QUYỀN ADMIN ĐỂ ẨN/HIỆN MÀN HÌNH BẢO TRÌ

(function() {
    console.log("🛡️ Maintenance System Checking...");
    
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const savedRole = localStorage.getItem('wave_alpha_role');
    
    // Nếu phát hiện là Admin
    if (mode === 'admin' || savedRole === 'admin') {
        console.log("🚀 ADMIN ACCESS: GRANTED");
        
        // 1. Lưu quyền
        localStorage.setItem('wave_alpha_role', 'admin');
        
        // 2. Gắn cờ vào <html> và <body> để CSS xử lý ẩn/hiện
        document.documentElement.classList.add('is-admin-mode');
        if (document.body) document.body.classList.add('is-admin-mode');
        
        // 3. Mở sẵn Tab Alpha (nếu code tab đã chạy)
        if (window.pluginSwitchTab) {
            window.pluginSwitchTab('alpha');
        }
    } else {
        console.log("🔒 USER ACCESS: RESTRICTED");
        // Xóa quyền nếu không phải admin
        localStorage.removeItem('wave_alpha_role');
        document.documentElement.classList.remove('is-admin-mode');
        if (document.body) document.body.classList.remove('is-admin-mode');
    }
})();
