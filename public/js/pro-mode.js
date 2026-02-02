// --- CONFIG & STATE ---
const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; // Load trước 50 token
let isAdmin = false;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    checkMaintenance();
    
    // Nếu qua được bảo trì thì load data
    if (isAdmin || !document.getElementById('maintenance-overlay')) {
        initMarket();
    }
});

// 1. LOGIC BẢO TRÌ (ADMIN CHECK)
function checkMaintenance() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    // Nếu có ?mode=admin hoặc đã lưu trong localStorage
    if (mode === 'admin' || localStorage.getItem('wave_alpha_role') === 'admin') {
        isAdmin = true;
        localStorage.setItem('wave_alpha_role', 'admin');
        document.getElementById('maintenance-overlay').style.display = 'none';
    } else {
        // Mặc định hiện Overlay (đã có sẵn trong HTML)
        isAdmin = false;
    }
}

// 2. SAFE SWITCH (CHUYỂN TAB AN TOÀN)
function safeSwitch(tabName) {
    const marketSec = document.getElementById('market-section');
    const tourneySec = document.getElementById('tourney-section');
    const btns = document.querySelectorAll('.tab-btn');

    // Reset active class
    btns.forEach(b => b.classList.remove('active'));

    if (tabName === 'market') {
        marketSec.style.display = 'block';
        tourneySec.style.display = 'none';
        btns[0].classList.add('active');
    } else if (tabName === 'tourney') {
        marketSec.style.display = 'none';
        tourneySec.style.display = 'block';
        btns[1].classList.add('active');
        // Lưu ý: Logic Supabase của Tourney nằm trong file khác hoặc được load riêng
        // Chúng ta chỉ ẩn hiện div, không can thiệp logic.
    }
}

// 3. MARKET DATA LOGIC
async function initMarket() {
    await fetchMarketData();
    // Auto refresh mỗi 60s
    setInterval(fetchMarketData, 60000);
}

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now()); // No-cache
        const data = await res.json();
        
        allTokens = data.tokens || [];
        document.getElementById('last-updated').innerText = 'Last updated: ' + data.last_updated;
        
        renderTable();
    } catch (e) {
        console.error("Lỗi tải data market:", e);
    }
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const listToRender = allTokens.slice(0, displayCount);

    listToRender.forEach((t, index) => {
        const tr = document.createElement('tr');
        
        // --- 1. PREPARE DATA ---
        const priceClass = t.change_24h >= 0 ? 'text-up' : 'text-down'; // text-up = Green defined in CSS
        const sign = t.change_24h >= 0 ? '+' : '';
        const chartSvg = createSparkline(t.chart, t.change_24h >= 0);
        const chainIcon = t.chain_icon || 'https://via.placeholder.com/12';

        // --- 2. RENDER ROW HTML ---
        tr.innerHTML = `
            <td class="text-center"><div class="rank-num">${index + 1}</div></td>

            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${t.icon}" class="token-logo" onerror="this.src='https://via.placeholder.com/32'">
                        <img src="${chainIcon}" class="chain-badge" title="${t.chain}">
                    </div>
                    <div class="token-info">
                        <span class="symbol" onclick="copyContract('${t.contract}')">${t.symbol}</span>
                        <span class="name-chain">${t.name} <span style="opacity:0.5">(${t.chain})</span></span>
                    </div>
                </div>
            </td>

            <td>
                <div class="price-box">
                    <span class="price-val">$${formatPrice(t.price)}</span>
                    <span class="change-val ${priceClass}">${sign}${t.change_24h.toFixed(2)}%</span>
                </div>
            </td>

            <td class="text-end col-total border-start border-secondary" style="border-color: #2b3139 !important;">
                $${formatNum(t.volume.daily_total)}
            </td>
            <td class="text-end col-limit">
                $${formatNum(t.volume.daily_limit)}
            </td>
            <td class="text-end col-onchain border-end border-secondary" style="border-color: #2b3139 !important;">
                $${formatNum(t.volume.daily_onchain)}
            </td>

            <td class="text-end col-vol24">
                $${formatNum(t.volume.rolling_24h)}
            </td>
            <td class="text-end col-tx">
                ${parseInt(t.tx_count).toLocaleString()}
            </td>
            <td class="text-end col-liq border-end border-secondary" style="border-color: #2b3139 !important;">
                $${formatNum(t.liquidity)}
            </td>

            <td class="text-center" style="padding:0">
                ${chartSvg}
            </td>

            <td class="text-end">
                <a href="https://www.binance.com/en/trade/${t.symbol}_USDT" target="_blank" class="btn-trade">TRADE</a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}


// --- UTILS ---
function loadMore() {
    displayCount += 50;
    renderTable();
}

function filterTable() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#market-table-body tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

function copyContract(addr) {
    if(!addr) return;
    navigator.clipboard.writeText(addr);
    const x = document.getElementById("toast");
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}

function formatNum(n) {
    if (!n) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
}
function formatPrice(n) { return n < 1 ? n.toFixed(6) : n.toFixed(2); }

function createSparkline(data, isUp) {
    if (!data || !data.length) return '';
    const w=100, h=35;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    let pts = '';
    data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        pts += `${x},${y} `;
    });
    const color = isUp ? '#0ecb81' : '#f6465d';
    return `<svg width="${w}" height="${h}" style="overflow:visible"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}
