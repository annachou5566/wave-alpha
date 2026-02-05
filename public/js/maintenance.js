


(function() {
    
    var urlParams = new URLSearchParams(window.location.search);
    var mode = urlParams.get('mode');
    var savedRole = localStorage.getItem('wave_alpha_role');
    
    
    var overlay = document.getElementById('maintenance-overlay');

    
    if (mode === 'admin' || savedRole === 'admin') {
        console.log("🛡️ MAINTENANCE: Admin Detected - Unlocking...");
        
        
        localStorage.setItem('wave_alpha_role', 'admin');
        
        
        document.documentElement.classList.add('is-admin-mode');
        
        
        var style = document.createElement('style');
        style.innerHTML = `
            #maintenance-overlay { display: none !important; visibility: hidden !important; pointer-events: none !important; }
            #alpha-tab-nav { display: flex !important; }
            body { overflow: auto !important; }
        `;
        document.head.appendChild(style);
        
        
        if (window.pluginSwitchTab) window.pluginSwitchTab('alpha');
        
    } else {
        
        console.log("🔒 MAINTENANCE: Restricted Access");
        
        
        localStorage.removeItem('wave_alpha_role');
        document.documentElement.classList.remove('is-admin-mode');
        
        
        if (overlay) {
            
            overlay.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                position: fixed !important;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: #0b0e11; 
                z-index: 2147483647 !important;
                align-items: center;
                justify-content: center;
                flex-direction: column;
            `;
        } else {
            
            document.body.innerHTML = '<div style="background:#0b0e11;color:#fff;height:100vh;display:flex;justify-content:center;align-items:center;"><h1>SYSTEM MAINTENANCE</h1></div>';
        }
        
        
        document.body.style.overflow = 'hidden';
    }
})();