// =========================================================================
// 🎨 WAVE ALPHA CORE: UNIVERSAL HSV COLOR PICKER (DÙNG CHUNG TOÀN WEB)
// =========================================================================
(function initGlobalColorPicker() {
    if (window.WaveColorPicker) return;

    // 1. Nhúng CSS (Chỉ nhúng 1 lần duy nhất)
    const style = document.createElement('style');
    style.textContent = `
        #wa-ucp-overlay { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 99999998; }
        #wa-ucp { display: none; position: fixed; background: #1e222d; border: 1px solid #363c4e; border-radius: 8px; padding: 12px; width: 220px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 99999999; font-family: 'Inter', sans-serif; }
        #wa-ucp.show { display: block; animation: waFadeIn 0.15s ease; }
        @keyframes waFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .wa-ucp-sv { position: relative; width: 100%; height: 130px; border-radius: 4px; overflow: hidden; cursor: crosshair; background-color: #ff0000; }
        .wa-ucp-sv-w { position: absolute; width: 100%; height: 100%; background: linear-gradient(to right, #fff, rgba(255,255,255,0)); pointer-events: none; }
        .wa-ucp-sv-b { position: absolute; width: 100%; height: 100%; background: linear-gradient(to top, #000, rgba(0,0,0,0)); pointer-events: none; }
        .wa-ucp-thumb { position: absolute; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.6); pointer-events: none; }
        .wa-ucp-ctrls { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .wa-ucp-preview { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); background-image: conic-gradient(#333 0.25turn, #444 0.25turn 0.5turn, #333 0.5turn 0.75turn, #444 0.75turn); background-size: 8px 8px; position: relative; overflow: hidden; flex-shrink: 0; }
        #wa-ucp-color { position: absolute; width: 100%; height: 100%; }
        .wa-ucp-sliders { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .wa-ucp-range { -webkit-appearance: none; width: 100%; height: 8px; border-radius: 4px; outline: none; background: transparent; margin: 0; }
        .wa-ucp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 1px solid #ccc; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
        #wa-ucp-hue { background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); }
        .wa-ucp-alpha-bg { background-image: conic-gradient(#333 0.25turn, #444 0.25turn 0.5turn, #333 0.5turn 0.75turn, #444 0.75turn); background-size: 8px 8px; border-radius: 4px; height: 8px; }
        #wa-ucp-alpha { width: 100%; display: block; border-radius: 4px; height: 100%; }
        .wa-ucp-hex { margin-top: 12px; display: flex; align-items: center; background: #131722; border: 1px solid #363c4e; border-radius: 4px; padding: 4px 8px; }
        .wa-ucp-hex span { font-size: 11px; color: #848e9c; font-weight: 600; margin-right: 8px; }
        #wa-ucp-hex-inp { background: transparent; border: none; color: #EAECEF; font-family: monospace; font-size: 13px; width: 100%; outline: none; text-transform: uppercase; }
        @media (max-width: 768px) {
            #wa-ucp { top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 280px; }
            .wa-ucp-sv { height: 180px; }
        }
    `;
    document.head.appendChild(style);

    // 2. Nhúng HTML
    document.body.insertAdjacentHTML('beforeend', `
        <div id="wa-ucp-overlay"></div>
        <div id="wa-ucp">
            <div class="wa-ucp-sv" id="wa-ucp-sv"><div class="wa-ucp-sv-w"></div><div class="wa-ucp-sv-b"></div><div class="wa-ucp-thumb" id="wa-ucp-thumb"></div></div>
            <div class="wa-ucp-ctrls">
                <div class="wa-ucp-preview"><div id="wa-ucp-color"></div></div>
                <div class="wa-ucp-sliders">
                    <input type="range" id="wa-ucp-hue" class="wa-ucp-range" min="0" max="360" value="0">
                    <div class="wa-ucp-alpha-bg"><input type="range" id="wa-ucp-alpha" class="wa-ucp-range" min="0" max="1" step="0.01" value="1"></div>
                </div>
            </div>
            <div class="wa-ucp-hex"><span>HEX</span><input type="text" id="wa-ucp-hex-inp" maxlength="9"></div>
        </div>
    `);

    // 3. Logic xử lý HSV (Rút gọn)
    const picker = document.getElementById('wa-ucp'), svArea = document.getElementById('wa-ucp-sv'), thumb = document.getElementById('wa-ucp-thumb'), hueInp = document.getElementById('wa-ucp-hue'), alphaInp = document.getElementById('wa-ucp-alpha'), hexInp = document.getElementById('wa-ucp-hex-inp'), colorPreview = document.getElementById('wa-ucp-color'), overlay = document.getElementById('wa-ucp-overlay');
    let h = 0, s = 1, v = 1, a = 1, onChangeCb = null;

    const hsv2rgb = (h, s, v) => {
        let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
        return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
    };
    const rgb2hsv = (r, g, b) => {
        let v = Math.max(r, g, b), c = v - Math.min(r, g, b);
        let h = c && ((v == r) ? (g - b) / c : ((v == g) ? 2 + (b - r) / c : 4 + (r - g) / c));
        return [60 * (h < 0 ? h + 6 : h), v && c / v, v / 255];
    };
    const rgb2hex = (r, g, b) => "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();

    const updateUI = (fromHex = false) => {
        const rgb = hsv2rgb(h, s, v);
        const pureRgb = hsv2rgb(h, 1, 1);
        svArea.style.backgroundColor = `rgb(${pureRgb[0]},${pureRgb[1]},${pureRgb[2]})`;
        thumb.style.left = (s * 100) + '%'; thumb.style.top = ((1 - v) * 100) + '%';
        const colorStr = a < 1 ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : rgb2hex(rgb[0], rgb[1], rgb[2]);
        colorPreview.style.background = colorStr;
        alphaInp.style.background = `linear-gradient(to right, transparent, rgb(${rgb[0]},${rgb[1]},${rgb[2]}))`;
        if (!fromHex) hexInp.value = a < 1 ? rgb2hex(rgb[0], rgb[1], rgb[2]) + Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase() : rgb2hex(rgb[0], rgb[1], rgb[2]);
        if (onChangeCb) onChangeCb(colorStr);
    };

    const updateSV = (e) => {
        const rect = svArea.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        s = Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width;
        v = 1 - (Math.max(0, Math.min(clientY - rect.top, rect.height)) / rect.height);
        updateUI();
    };

    let isDragging = false;
    svArea.onmousedown = (e) => { isDragging = true; updateSV(e); };
    window.addEventListener('mousemove', (e) => { if (isDragging) updateSV(e); });
    window.addEventListener('mouseup', () => isDragging = false);
    svArea.addEventListener('touchstart', (e) => { isDragging = true; updateSV(e); }, {passive:true});
    window.addEventListener('touchmove', (e) => { if (isDragging) updateSV(e); }, {passive:true});
    window.addEventListener('touchend', () => isDragging = false);
    hueInp.oninput = () => { h = parseFloat(hueInp.value); updateUI(); };
    alphaInp.oninput = () => { a = parseFloat(alphaInp.value); updateUI(); };

    window.WaveColorPicker = {
        open: function(anchorEl, initColor, callback) {
            onChangeCb = callback;
            if (initColor && initColor !== 'transparent') {
                if (initColor.startsWith('rgba')) {
                    let m = initColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                    if(m) { let hsv = rgb2hsv(parseInt(m[1]), parseInt(m[2]), parseInt(m[3])); h = hsv[0]; s = hsv[1]; v = hsv[2]; a = m[4] ? parseFloat(m[4]) : 1; }
                } else if (initColor.startsWith('#')) {
                    let r = parseInt(initColor.slice(1,3), 16), g = parseInt(initColor.slice(3,5), 16), b = parseInt(initColor.slice(5,7), 16), al = initColor.length === 9 ? parseInt(initColor.slice(7,9), 16)/255 : 1;
                    let hsv = rgb2hsv(r,g,b); h = hsv[0]; s = hsv[1]; v = hsv[2]; a = al;
                }
            }
            updateUI();
            picker.classList.add('show'); overlay.style.display = 'block';
            if (window.innerWidth > 768 && anchorEl) {
                const rect = anchorEl.getBoundingClientRect();
                picker.style.left = Math.max(10, rect.left - 200) + 'px';
                picker.style.top = (rect.bottom + 10) + 'px';
            }
        },
        close: () => { picker.classList.remove('show'); overlay.style.display = 'none'; }
    };
    overlay.onclick = window.WaveColorPicker.close;
})();

// =========================================================================
// 🎛️ WAVE ALPHA CORE: UNIVERSAL CUSTOM DROPDOWN (DÙNG CHUNG TOÀN WEB)
// =========================================================================
(function initGlobalDropdown() {
    if (window.WaveDropdown) return;

    // 1. Nhúng CSS 1 lần duy nhất cho toàn bộ hệ thống
    const style = document.createElement('style');
    style.textContent = `
        .wa-custom-select { position: relative; width: 140px; font-size: 12px; user-select: none; }
        .wa-select-trigger { background: #131722; color: #EAECEF; border: 1px solid rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s; }
        .wa-select-trigger:hover { border-color: rgba(255,255,255,0.2); }
        .wa-select-trigger.active { border-color: #26a69a; }
        .wa-select-dropdown { position: absolute; top: calc(100% + 4px); left: 0; width: 100%; background: #1e222d; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100; display: none; flex-direction: column; max-height: 200px; overflow-y: auto; }
        .wa-select-dropdown.show { display: flex; }
        .wa-select-dropdown::-webkit-scrollbar { width: 4px; }
        .wa-select-dropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .wa-select-option { padding: 8px 12px; color: #b7bdc6; cursor: pointer; transition: 0.2s; }
        .wa-select-option:hover { background: rgba(255,255,255,0.05); color: #EAECEF; }
        .wa-select-option.active { color: #26a69a; background: rgba(38,166,154,0.1); font-weight: 600; }
    `;
    document.head.appendChild(style);

    // 2. Định nghĩa API toàn cục để gọi
    window.WaveDropdown = {
        /**
         * Tạo Dropdown xịn sò vào một thẻ div bất kỳ
         * @param {HTMLElement} targetEl - Thẻ div sẽ chứa dropdown
         * @param {Array} options - Mảng object { val, text }
         * @param {number|string} currentVal - Giá trị đang chọn mặc định
         * @param {Function} onChange - Callback trả về giá trị khi user click chọn
         */
        create: function(targetEl, options, currentVal, onChange) {
            let selectedText = options.find(o => o.val === currentVal)?.text || options[0]?.text || '';
            let optsHTML = options.map(o => 
                `<div class="wa-select-option ${currentVal === o.val ? 'active' : ''}" data-value="${o.val}">${o.text}</div>`
            ).join('');
            
            // Render HTML
            targetEl.innerHTML = `
                <div class="wa-custom-select">
                    <div class="wa-select-trigger">
                        <span class="wa-select-text">${selectedText}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                    <div class="wa-select-dropdown">${optsHTML}</div>
                </div>
            `;

            const trigger = targetEl.querySelector('.wa-select-trigger');
            const dropdown = targetEl.querySelector('.wa-select-dropdown');
            const optionNodes = targetEl.querySelectorAll('.wa-select-option');
            const textSpan = targetEl.querySelector('.wa-select-text');

            // Click mở menu
            trigger.onclick = (e) => {
                e.stopPropagation();
                const isCurrentlyOpen = dropdown.classList.contains('show');
                window.WaveDropdown.closeAll(); // Đóng tất cả menu khác trước
                if (!isCurrentlyOpen) {
                    dropdown.classList.add('show');
                    trigger.classList.add('active');
                }
            };

            // Click chọn option
            optionNodes.forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    // Đổi giao diện
                    optionNodes.forEach(n => n.classList.remove('active'));
                    opt.classList.add('active');
                    textSpan.innerText = opt.innerText;
                    
                    // Thu menu lại
                    dropdown.classList.remove('show');
                    trigger.classList.remove('active');
                    
                    // Bắn dữ liệu ra ngoài
                    if (typeof onChange === 'function') {
                        onChange(opt.dataset.value);
                    }
                };
            });
        },

        // Hàm tiện ích: Đóng tất cả dropdown đang mở
        closeAll: function() {
            document.querySelectorAll('.wa-select-dropdown.show').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.wa-select-trigger.active').forEach(el => el.classList.remove('active'));
        }
    };

    // 3. Logic tự động thu menu khi click ra ngoài vùng menu
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.wa-custom-select')) {
            window.WaveDropdown.closeAll();
        }
    });
})();