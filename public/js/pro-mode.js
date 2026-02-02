// public/js/pro-mode.js

// --- CONFIG ---
const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayedTokens = [];
let displayCount = 50; 
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

// --- MAIN EXECUTION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. BUỘC PHẢI CHẠY ĐẦU TIÊN: Tạo giao diện nếu thiếu
    ensureInterfaceExists(); 

    // 2. Kiểm tra quyền Admin
    checkMaintenanceMode();

    // 3. Khởi tạo dữ liệu
    initMarket();
    setupEventListeners();
});

// --- 1. CORE SYSTEM: AUTO-INJECT UI (FIX LỖI MẤT GIAO DIỆN) ---
function ensureInterfaceExists() {
    // A. Chèn Maintenance Overlay nếu chưa có
    if (!document.getElementById('maintenance-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'maintenance-overlay';
        overlay.innerHTML = `
            <div class="maintenance-content">
                <div class="maintenance-icon">🚧</div>
                <h1>SYSTEM MAINTENANCE</h1>
                <p>Wave Alpha Terminal is upgrading.</p>
                <p style="font-size:12px; opacity:0.6; margin-top:5px">Restricted Access</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // B. Chèn Tab Navigation nếu chưa có
    if (!document.getElementById('alpha-tab-nav')) {
        const nav = document.createElement('div');
        nav.id = 'alpha-tab-nav';
        nav.innerHTML = `
            <div class="nav-content">
                <button id="btn-tab-competition" class="tab-btn active" onclick="switchTab('competition')">
                    🏆 Competition
                </button>
                <button id="btn-tab-alpha" class="tab-btn" onclick="switchTab('alpha')">
                    🌊 Alpha Market <span class="badge-pro">PRO</span>
                </button>
            </div>
        `;
        document.body.prepend(nav);
    }

    // C. Chèn Container Alpha Market nếu chưa có
    if (!document.getElementById('alpha-market-view')) {
        const container = document.createElement('div');
        container.id = 'alpha-market-view';
        container.innerHTML = `
            <div class="alpha-container">
                <div class="alpha-header">
                    <div class="search-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="search-input" placeholder="Search Token / Contract..." autocomplete="off">
                    </div>
                    <div id="last-updated" style="color:#848e9c; font-family:'Rajdhani'">Loading...</div>
                </div>
                <div class="table-responsive">
                    <table class="alpha-table">
                        <thead>
                            <tr class="head-top">
                                <th rowspan="2" class="text-center" style="width:40px">#</th>
                                <th rowspan="2">TOKEN / CONTRACT</th>
                                <th rowspan="2" class="text-end">PRICE</th>
                                <th colspan="3" class="text-center" style="border-left:1px solid #2b3139">DAILY VOLUME (UTC)</th>
                                <th colspan="3" class="text-center" style="border-left:1px solid #2b3139">MARKET STATS (24h)</th>
                            </tr>
                            <tr class="head-sub">
                                <th class="text-end cursor-pointer" style="border-left:1px solid #2b3139" onclick="handleSort('volume.daily_total')">TOTAL</th>
                                <th class="text-end cursor-pointer" onclick="handleSort('volume.daily_limit')">LIMIT</th>
                                <th class="text-end cursor-pointer" onclick="handleSort('volume.daily_onchain')">ON-CHAIN</th>
                                <th class="text-end cursor-pointer" style="border-left:1px solid #2b3139" onclick="handleSort('volume.rolling_24h')">VOL 24H</th>
                                <th class="text-end cursor-pointer" onclick="handleSort('tx_count')">TXs</th>
                                <th class="text-end cursor-pointer" onclick="handleSort('liquidity')">LIQ</th>
                            </tr>
                        </thead>
                        <tbody id="market-table-body"></tbody>
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }
}

// --- 2. LOGIC MAINTENANCE (QUAN TRỌNG) ---
function checkMaintenanceMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    // Logic: Nếu URL có admin HOẶC localStorage có admin -> Unlock
    if (mode === 'admin' || localStorage.getItem('wave_alpha_role') === 'admin') {
        localStorage.setItem('wave_alpha_role', 'admin');
        document.body.classList.add('is-admin-mode'); // Class này sẽ kích hoạt CSS display:none cho overlay
        console.log("🔓 Admin Access Granted");
    } else {
        localStorage.removeItem('wave_alpha_role'); // Đảm bảo sạch sẽ
        document.body.classList.remove('is-admin-mode');
        console.log("🔒 Maintenance Mode Active");
    }
}

// --- 3. LOGIC TAB SWITCHING ---
window.switchTab = (tab) => {
    const alphaView = document.getElementById('alpha-market-view');
    const compBtn = document.getElementById('btn-tab-competition');
    const alphaBtn = document.getElementById('btn-tab-alpha');
    
    if (tab === 'alpha') {
        alphaView.style.display = 'block';
        compBtn.classList.remove('active');
        alphaBtn.classList.add('active');
    } else {
        alphaView.style.display = 'none';
        compBtn.classList.add('active');
        alphaBtn.classList.remove('active');
    }
};

// --- 4. MARKET DATA LOGIC ---
async function initMarket() {
    await fetchMarketData();
    setInterval(fetchMarketData, 60000);
}

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const data = await res.json();
        allTokens = data.tokens || [];
        applyFilterAndSort();
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'UPDATED: ' + data.last_updated;
    } catch (e) { console.error("Data error:", e); }
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const list = displayedTokens.slice(0, displayCount);
    list.forEach((t, i) => {
        const tr = document.createElement('tr');
        
        let badges = '';
        if (t.status === 'SPOT') badges += `<span class="smart-badge badge-spot">SPOT</span>`;
        else if (t.status === 'DELISTED') badges += `<span class="smart-badge badge-delisted">DELISTED</span>`;
        
        if (t.listing_time && t.mul_point) {
            const days = Math.ceil(((t.listing_time + 2592000000) - Date.now()) / 86400000);
            if (days > 0) {
                if (t.chain === 'BSC' && t.mul_point >= 4) tr.classList.add('glow-row');
                badges += `<span class="smart-badge badge-alpha">[x${t.mul_point} ${days}d]</span>`;
            }
        }

        tr.innerHTML = `
            <td class="text-center"><span class="rank-num">${i + 1}</span></td>
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${t.icon || 'https://placehold.co/32'}" class="token-logo" onerror="this.src='https://placehold.co/32'">
                        <img src="${t.chain_icon || 'https://placehold.co/14'}" class="chain-badge">
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2 cursor-pointer" onclick="copy('${t.contract}')">
                            <span class="fw-bold text-white">${t.symbol}</span>
                            <i class="fas fa-copy text-secondary" style="font-size:10px"></i>
                        </div>
                        <div class="badge-row">${badges}</div>
                    </div>
                </div>
            </td>
            <td class="text-end fw-bold">$${formatPrice(t.price)}</td>
            <td class="text-end col-total" style="border-left:1px solid #2b3139">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end col-limit">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end col-onchain">$${formatNum(t.volume.daily_onchain)}</td>
            <td class="text-end" style="border-left:1px solid #2b3139">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num">${formatInt(t.tx_count)}</td>
            <td class="text-end col-liq">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- HELPERS ---
function formatNum(n) { return !n ? '0' : (n >= 1e6 ? (n/1e6).toFixed(2)+'M' : (n >= 1e3 ? (n/1e3).toFixed(2)+'K' : n.toFixed(2))); }
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }

window.copy = (txt) => { if(txt) navigator.clipboard.writeText(txt); };
window.handleSort = (key) => {
    if (sortConfig.key === key) sortConfig.dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    else { sortConfig.key = key; sortConfig.dir = 'desc'; }
    applyFilterAndSort();
};

function setupEventListeners() {
    document.getElementById('search-input')?.addEventListener('keyup', applyFilterAndSort);
    window.addEventListener('scroll', () => {
        if (document.getElementById('alpha-market-view').style.display === 'block') {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                if (displayCount < displayedTokens.length) { displayCount += 50; renderTable(); }
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
        const valA = key => key.split('.').reduce((o, i) => (o ? o[i] : 0), a);
        const valB = key => key.split('.').reduce((o, i) => (o ? o[i] : 0), b);
        return sortConfig.dir === 'desc' ? valB(sortConfig.key) - valA(sortConfig.key) : valA(sortConfig.key) - valB(sortConfig.key);
    });
    displayCount = 50; renderTable();
}