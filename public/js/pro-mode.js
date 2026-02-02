// public/js/pro-mode.js

// --- CONFIG & STATE ---
const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayedTokens = [];
let displayCount = 50; 
let isAdmin = false;
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    injectAppStructure(); // TỰ TẠO GIAO DIỆN
    checkMaintenanceMode();
    initMarket();
    setupEventListeners();
});

// --- 1. INJECT UI (CORE FIX) ---
function injectAppStructure() {
    // 1. Tạo Tab Navigation (Thanh điều hướng)
    const nav = document.createElement('div');
    nav.id = 'alpha-tab-nav';
    nav.innerHTML = `
        <div class="nav-content">
            <button id="btn-tab-competition" class="tab-btn active" onclick="switchTab('competition')">
                🏆 Trading Competition
            </button>
            <button id="btn-tab-alpha" class="tab-btn" onclick="switchTab('alpha')">
                🌊 Alpha Market <span class="badge-pro">PRO</span>
            </button>
        </div>
    `;
    document.body.prepend(nav); // Chèn lên đầu trang

    // 2. Tạo Container cho Alpha Market (Mặc định ẩn)
    const container = document.createElement('div');
    container.id = 'alpha-market-view';
    container.style.display = 'none'; // Ẩn lúc đầu
    container.innerHTML = `
        <div class="alpha-container">
            <div class="alpha-header">
                <div class="search-wrapper">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="search-input" placeholder="Search Token, Contract..." autocomplete="off">
                </div>
                <div id="last-updated" class="time-badge">Loading...</div>
            </div>
            
            <div class="table-responsive">
                <table class="alpha-table">
                    <thead>
                        <tr class="head-top">
                            <th rowspan="2" class="text-center" style="width: 40px;">#</th>
                            <th rowspan="2" style="width: 250px;">TOKEN / CONTRACT</th>
                            <th rowspan="2" class="text-end" style="width: 100px;">PRICE</th>
                            <th colspan="3" class="text-center border-group">DAILY VOLUME (UTC)</th>
                            <th colspan="3" class="text-center border-group">MARKET STATS (24h)</th>
                        </tr>
                        <tr class="head-sub">
                            <th class="text-end cursor-pointer border-group" onclick="handleSort('volume.daily_total')">TOTAL</th>
                            <th class="text-end cursor-pointer" onclick="handleSort('volume.daily_limit')">LIMIT</th>
                            <th class="text-end cursor-pointer" onclick="handleSort('volume.daily_onchain')">ON-CHAIN</th>
                            <th class="text-end cursor-pointer border-group" onclick="handleSort('volume.rolling_24h')">VOL 24H</th>
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

    // 3. Tạo Maintenance Overlay (Nếu chưa có)
    if (!document.getElementById('maintenance-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'maintenance-overlay';
        overlay.innerHTML = `
            <div class="maintenance-box">
                <h1>🚧 SYSTEM UPGRADE</h1>
                <p>Wave Alpha Terminal is updating data logic.</p>
                <div class="loader"></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
}

function switchTab(tab) {
    const alphaView = document.getElementById('alpha-market-view');
    const compBtn = document.getElementById('btn-tab-competition');
    const alphaBtn = document.getElementById('btn-tab-alpha');
    
    // Logic ẩn hiện: Alpha View dùng position fixed đè lên giao diện cũ
    if (tab === 'alpha') {
        alphaView.style.display = 'block';
        compBtn.classList.remove('active');
        alphaBtn.classList.add('active');
    } else {
        alphaView.style.display = 'none';
        compBtn.classList.add('active');
        alphaBtn.classList.remove('active');
    }
}

// --- 2. LOGIC CŨ (GIỮ NGUYÊN) ---

function checkMaintenanceMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const overlay = document.getElementById('maintenance-overlay');
    
    if (urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_role') === 'admin') {
        isAdmin = true;
        localStorage.setItem('wave_alpha_role', 'admin');
        if(overlay) overlay.style.display = 'none';
    } else {
        if(overlay) overlay.style.display = 'flex';
    }
}

async function initMarket() {
    await fetchMarketData();
    // Auto refresh mỗi 30s
    setInterval(fetchMarketData, 30000);
}

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const data = await res.json();
        allTokens = data.tokens || [];
        applyFilterAndSort(); 
        
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'UPDATED: ' + data.last_updated;
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const listToRender = displayedTokens.slice(0, displayCount);

    listToRender.forEach((t, index) => {
        const tr = document.createElement('tr');
        
        // Logic Badges
        let badgesHtml = '';
        if (t.status === 'SPOT') badgesHtml += `<span class="smart-badge badge-spot">SPOT</span>`;
        else if (t.status === 'DELISTED') badgesHtml += `<span class="smart-badge badge-delisted">DELISTED</span>`;
        
        if (t.listing_time && t.mul_point) {
            const diffDays = Math.ceil(((t.listing_time + 2592000000) - Date.now()) / 86400000);
            if (diffDays > 0) {
                if (t.chain === 'BSC' && t.mul_point >= 4) tr.classList.add('glow-row');
                badgesHtml += `<span class="smart-badge badge-alpha">[x${t.mul_point} ${diffDays}d]</span>`;
            }
        }

        const chainIcon = t.chain_icon || 'https://placehold.co/14';
        const tokenIcon = t.icon || 'https://placehold.co/32';

        tr.innerHTML = `
            <td class="text-center rank-col">${index + 1}</td>
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenIcon}" class="token-logo">
                        <img src="${chainIcon}" class="chain-badge">
                    </div>
                    <div class="token-info">
                        <div class="d-flex align-items-center gap-2 cursor-pointer" onclick="copyContract('${t.contract}')">
                            <span class="symbol">${t.symbol}</span>
                            <i class="fas fa-copy copy-icon"></i>
                        </div>
                        <div class="badge-row">${badgesHtml}</div>
                    </div>
                </div>
            </td>
            <td class="text-end fw-bold">$${formatPrice(t.price)}</td>
            
            <td class="text-end col-total border-group">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end col-limit">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end col-onchain">$${formatNum(t.volume.daily_onchain)}</td>

            <td class="text-end col-vol24h border-group">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end col-tx">${formatInt(t.tx_count)}</td>
            <td class="text-end col-liq">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 3. HELPERS (SEARCH, SORT, FORMAT) ---
window.handleSort = (key) => {
    if (sortConfig.key === key) sortConfig.dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    else { sortConfig.key = key; sortConfig.dir = 'desc'; }
    applyFilterAndSort();
};

window.copyContract = (addr) => {
    if(!addr) return;
    navigator.clipboard.writeText(addr);
    alert(`Copied: ${addr}`);
};

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
    
    displayCount = 50; 
    renderTable();
}

function getNestedVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }
function formatNum(n) { return !n ? '0' : (n >= 1e6 ? (n/1e6).toFixed(2)+'M' : (n >= 1e3 ? (n/1e3).toFixed(2)+'K' : n.toFixed(2))); }
function formatInt(n) { return n ? new Intl.NumberFormat().format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }

// Scroll Load More
window.addEventListener('scroll', () => {
    if (document.getElementById('alpha-market-view')?.style.display !== 'none') {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            if (displayCount < displayedTokens.length) {
                displayCount += 50;
                renderTable();
            }
        }
    }
});