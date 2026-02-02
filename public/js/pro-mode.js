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
    checkMaintenanceMode();
    setupTableStructure();
    initMarket();
    setupEventListeners();
});

// --- 1. CORE LOGIC ---

function checkMaintenanceMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const overlay = document.getElementById('maintenance-overlay');
    
    // Check Admin
    if (urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_role') === 'admin') {
        isAdmin = true;
        localStorage.setItem('wave_alpha_role', 'admin');
        if(overlay) overlay.style.display = 'none';
    } else {
        // Nếu không phải admin, hiện overlay
        if(overlay) overlay.style.display = 'flex';
    }
}

function setupTableStructure() {
    // Inject Header 2 tầng vào bảng
    const thead = document.querySelector('.alpha-table thead');
    if (thead) {
        thead.innerHTML = `
            <tr class="head-top">
                <th rowspan="2" class="text-center" style="width: 40px;">#</th>
                <th rowspan="2" style="width: 250px;">TOKEN / CONTRACT</th>
                <th rowspan="2" class="text-end" style="width: 100px;">PRICE</th>
                <th colspan="3" class="text-center border-start border-secondary" style="border-color: #2b3139 !important">DAILY VOLUME (UTC)</th>
                <th colspan="3" class="text-center border-start border-secondary" style="border-color: #2b3139 !important">MARKET STATS (24h)</th>
            </tr>
            <tr class="head-sub">
                <th class="text-end cursor-pointer border-start border-secondary" onclick="handleSort('volume.daily_total')">TOTAL <i class="fas fa-sort text-secondary"></i></th>
                <th class="text-end cursor-pointer" onclick="handleSort('volume.daily_limit')">LIMIT</th>
                <th class="text-end cursor-pointer" onclick="handleSort('volume.daily_onchain')">ON-CHAIN</th>
                
                <th class="text-end cursor-pointer border-start border-secondary" onclick="handleSort('volume.rolling_24h')">VOL 24H</th>
                <th class="text-end cursor-pointer" onclick="handleSort('tx_count')">TX COUNT</th>
                <th class="text-end cursor-pointer" onclick="handleSort('liquidity')">LIQUIDITY</th>
            </tr>
        `;
    }
}

async function initMarket() {
    await fetchMarketData();
    setInterval(fetchMarketData, 60000); // 60s refresh
}

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const data = await res.json();
        
        allTokens = data.tokens || [];
        applyFilterAndSort(); // Xử lý dữ liệu trước khi render
        
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'Updated: ' + data.last_updated;
    } catch (e) {
        console.error("Lỗi tải data:", e);
    }
}

// --- 2. RENDER TABLE ---

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const listToRender = displayedTokens.slice(0, displayCount);

    listToRender.forEach((t, index) => {
        const tr = document.createElement('tr');
        
        // --- Logic Badge Thông Minh [x4 19d] ---
        let badgesHtml = '';
        
        // Badge 1: Status
        if (t.status === 'SPOT') badgesHtml += `<span class="smart-badge badge-spot">SPOT</span>`;
        else if (t.status === 'DELISTED') badgesHtml += `<span class="smart-badge badge-delisted">DELISTED</span>`;
        
        // Badge 2: Multiplier & Countdown
        if (t.listing_time && t.mul_point) {
            const now = Date.now();
            const endTime = t.listing_time + (30 * 24 * 60 * 60 * 1000); // +30 ngày
            const diffTime = endTime - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0) {
                // Glow effect cho hệ BSC x4
                if (t.chain === 'BSC' && t.mul_point >= 4) {
                    tr.classList.add('glow-row');
                }
                const mulClass = t.mul_point >= 4 ? 'text-brand' : 'text-primary';
                badgesHtml += `<span class="smart-badge badge-alpha">[x${t.mul_point} ${diffDays}d]</span>`;
            }
        }

        // Icons
        const chainIcon = t.chain_icon || 'https://placehold.co/14';
        const tokenIcon = t.icon || 'https://placehold.co/32';

        // HTML Row
        tr.innerHTML = `
            <td class="text-center"><div class="rank-num">${index + 1}</div></td>
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenIcon}" class="token-logo" onerror="this.src='https://placehold.co/32'">
                        <img src="${chainIcon}" class="chain-badge" title="${t.chain}">
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
            
            <td class="text-end col-total border-start border-secondary" style="border-color:#2b3139!important">
                $${formatNum(t.volume.daily_total)}
            </td>
            <td class="text-end col-limit">
                $${formatNum(t.volume.daily_limit)}
            </td>
            <td class="text-end col-onchain">
                $${formatNum(t.volume.daily_onchain)}
            </td>

            <td class="text-end col-vol24h border-start border-secondary" style="border-color:#2b3139!important">
                $${formatNum(t.volume.rolling_24h)}
            </td>
            <td class="text-end col-tx font-num">
                ${formatInt(t.tx_count)}
            </td>
            <td class="text-end col-liq">
                $${formatNum(t.liquidity)}
            </td>
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

function formatInt(num) {
    return num ? new Intl.NumberFormat('en-US').format(num) : '0';
}

function formatPrice(num) {
    if (!num) return '0';
    if (num < 0.0001) return num.toExponential(2);
    return num.toFixed(4);
}

function copyContract(addr) {
    if(!addr) return;
    navigator.clipboard.writeText(addr);
    showToast(`Copied: ${addr.substring(0,6)}...${addr.substring(addr.length-4)}`);
}

function showToast(msg) {
    // Tạo toast đơn giản nếu chưa có thư viện
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast show align-items-center text-white bg-success border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = 10000;
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// --- 4. FILTER & SORT & LOAD MORE ---

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            applyFilterAndSort();
        });
    }
    
    // Xử lý scroll để load more (infinite scroll đơn giản)
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
    
    // Filter
    displayedTokens = allTokens.filter(t => 
        (t.symbol && t.symbol.toLowerCase().includes(term)) || 
        (t.name && t.name.toLowerCase().includes(term)) ||
        (t.contract && t.contract.toLowerCase().includes(term))
    );
    
    // Sort
    displayedTokens.sort((a, b) => {
        const valA = getNestedVal(a, sortConfig.key);
        const valB = getNestedVal(b, sortConfig.key);
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
    });
    
    // Reset display count khi search/sort
    displayCount = 50; 
    renderTable();
}

function handleSort(key) {
    if (sortConfig.key === key) {
        sortConfig.dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    } else {
        sortConfig.key = key;
        sortConfig.dir = 'desc';
    }
    applyFilterAndSort();
}

function getNestedVal(obj, path) {
    return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj);
}