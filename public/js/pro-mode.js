// public/js/pro-mode.js

// --- CONFIG & STATE ---
const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayedTokens = [];
let displayCount = 50; 
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

// --- MAIN EVENTS ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Kiểm tra chế độ bảo trì ngay lập tức
    checkMaintenanceMode();

    // 2. Khởi tạo dữ liệu thị trường (Chạy ngầm)
    initMarket();
    setupEventListeners();
});

// --- 1. LOGIC MAINTENANCE MODE (QUAN TRỌNG) ---
function checkMaintenanceMode() {
    // Lấy tham số ?mode=... trên URL
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    // Kiểm tra: Nếu là admin trên URL hoặc đã lưu trong máy
    if (mode === 'admin' || localStorage.getItem('wave_alpha_role') === 'admin') {
        
        // Lưu quyền vào LocalStorage để lần sau không cần gõ lại
        localStorage.setItem('wave_alpha_role', 'admin');
        
        // Thêm class vào body -> CSS sẽ tự động ẩn #maintenance-overlay
        document.body.classList.add('is-admin-mode');
        
        console.log("✅ Admin Access Granted: Overlay Hidden");
    } else {
        console.log("🔒 Restricted Access: Overlay Active");
    }
}

// --- 2. LOGIC MARKET DATA (Cốt lõi) ---

async function initMarket() {
    await fetchMarketData();
    setInterval(fetchMarketData, 60000); // Tự động cập nhật mỗi 60s
}

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const data = await res.json();
        
        allTokens = data.tokens || [];
        applyFilterAndSort(); // Xử lý và render
        
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'Updated: ' + data.last_updated;
    } catch (e) {
        console.error("Lỗi tải data:", e);
    }
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    // Nếu chưa có bảng (do chưa sửa HTML bước sau) thì dừng lại, không lỗi
    if (!tbody) return; 
    
    tbody.innerHTML = '';
    const listToRender = displayedTokens.slice(0, displayCount);

    listToRender.forEach((t, index) => {
        const tr = document.createElement('tr');
        
        // Logic Badge
        let badgesHtml = '';
        if (t.status === 'SPOT') badgesHtml += `<span class="smart-badge badge-spot">SPOT</span>`;
        else if (t.status === 'DELISTED') badgesHtml += `<span class="smart-badge badge-delisted">DELISTED</span>`;
        
        if (t.listing_time && t.mul_point) {
            const diffDays = Math.ceil(((t.listing_time + 2592000000) - Date.now()) / 86400000); // 30 ngày
            if (diffDays > 0) {
                if (t.chain === 'BSC' && t.mul_point >= 4) tr.classList.add('glow-row');
                badgesHtml += `<span class="smart-badge badge-alpha">[x${t.mul_point} ${diffDays}d]</span>`;
            }
        }

        const chainIcon = t.chain_icon || 'https://placehold.co/14';
        const tokenIcon = t.icon || 'https://placehold.co/32';

        tr.innerHTML = `
            <td class="text-center"><div class="rank-num">${index + 1}</div></td>
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenIcon}" class="token-logo" onerror="this.src='https://placehold.co/32'">
                        <img src="${chainIcon}" class="chain-badge">
                    </div>
                    <div class="token-info">
                        <div class="d-flex align-items-center gap-2 cursor-pointer" onclick="copyContract('${t.contract}')">
                            <span class="symbol fw-bold text-white">${t.symbol}</span>
                            <i class="fas fa-copy text-secondary" style="font-size:10px; opacity:0.5"></i>
                        </div>
                        <div class="badge-row">${badgesHtml}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="price-box text-end">
                    <div class="font-num fw-bold">$${formatPrice(t.price)}</div>
                    <div class="small ${t.change_24h >= 0 ? 'text-success' : 'text-danger'}">
                        ${t.change_24h >= 0 ? '+' : ''}${t.change_24h}%
                    </div>
                </div>
            </td>
            
            <td class="text-end col-total border-start border-secondary" style="border-color:#2b3139!important">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end col-limit">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end col-onchain">$${formatNum(t.volume.daily_onchain)}</td>

            <td class="text-end col-vol24h border-start border-secondary" style="border-color:#2b3139!important">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end col-tx font-num">${formatInt(t.tx_count)}</td>
            <td class="text-end col-liq">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 3. HELPER FUNCTIONS ---

function formatNum(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
}

function formatInt(num) { return num ? new Intl.NumberFormat('en-US').format(num) : '0'; }
function formatPrice(num) { return !num ? '0' : (num < 0.0001 ? num.toExponential(2) : num.toFixed(4)); }

window.copyContract = (addr) => {
    if(!addr) return;
    navigator.clipboard.writeText(addr);
    alert(`Copied: ${addr}`);
};

// --- 4. FILTER & SORT ---

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', () => applyFilterAndSort());
    }
    
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            if (displayCount < displayedTokens.length) {
                displayCount += 50;
                renderTable();
            }
        }
    });
}

function applyFilterAndSort() {
    const term = document.getElementById('search-input')?.value.toLowerCase() || '';
    
    displayedTokens = allTokens.filter(t => 
        (t.symbol && t.symbol.toLowerCase().includes(term)) || 
        (t.contract && t.contract.toLowerCase().includes(term))
    );
    
    displayedTokens.sort((a, b) => {
        const valA = getNestedVal(a, sortConfig.key);
        const valB = getNestedVal(b, sortConfig.key);
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
    });
    
    // Reset khi search
    displayCount = 50; 
    renderTable();
}

window.handleSort = (key) => {
    if (sortConfig.key === key) sortConfig.dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    else { sortConfig.key = key; sortConfig.dir = 'desc'; }
    applyFilterAndSort();
};

function getNestedVal(obj, path) {
    return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj);
}