// --- CONFIG & STATE ---
const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; 
let isAdmin = false;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Check mode admin từ URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_role') === 'admin') {
        isAdmin = true;
        localStorage.setItem('wave_alpha_role', 'admin');
        const overlay = document.getElementById('maintenance-overlay');
        if(overlay) overlay.style.display = 'none';
    }

    initMarket();
});

async function initMarket() {
    await fetchMarketData();
    setInterval(fetchMarketData, 60000); // 60s refresh
}

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const data = await res.json();
        
        allTokens = data.tokens || [];
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'Updated: ' + data.last_updated;
        
        renderTable();
    } catch (e) {
        console.error("Lỗi tải data:", e);
    }
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const listToRender = allTokens.slice(0, displayCount);
    const now = Date.now();

    listToRender.forEach((t, index) => {
        const tr = document.createElement('tr');
        
        // --- 1. TÍNH TOÁN BADGE (Logic cũ đã được khôi phục) ---
        // Tính ngày còn lại: Listing Time + 30 ngày
        const endTime = t.listing_time + (30 * 24 * 60 * 60 * 1000);
        const daysLeft = Math.ceil((endTime - now) / (1000 * 60 * 60 * 24));
        const dayText = daysLeft > 0 ? `${daysLeft}d` : 'End';

        let badgesHtml = '';
        
        // Logic Spot / Delisted / Multiplier
        if (t.listingCex === true && t.offline === true) {
            badgesHtml = `<span class="bd bd-spot">SPOT</span>`;
        } else if (t.listingCex === false && t.offline === true) {
            badgesHtml = `<span class="bd bd-delist">DELISTED</span>`;
        } else {
            // Nếu còn chạy Alpha
            if (t.mul_point > 1) {
                // Check xem có phải BSC x4 không để phát sáng
                const isBsc4x = (t.chain === 'BSC' || t.chain === 'BNB') && t.mul_point >= 4;
                const glowClass = isBsc4x ? 'glow-bsc' : '';
                
                badgesHtml = `
                    <div class="bd bd-mul ${glowClass}">
                        <span class="x-val">${t.mul_point}x</span>
                        <span class="d-val border-start border-secondary ps-1 ms-1">${dayText}</span>
                    </div>
                `;
            }
        }

        // --- 2. XỬ LÝ HÌNH ẢNH & DATA KHÁC ---
        const priceClass = t.change_24h >= 0 ? 'text-up' : 'text-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        const chartSvg = createSparkline(t.chart, t.change_24h >= 0);
        // Fallback icon xịn hơn
        const chainIcon = t.chain_icon || 'https://via.placeholder.com/14'; 
        const tokenIcon = t.icon || 'https://via.placeholder.com/32';

        // --- 3. RENDER HTML ---
        tr.innerHTML = `
            <td class="text-center"><div class="rank-num">${index + 1}</div></td>

            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenIcon}" class="token-logo" onerror="this.src='https://via.placeholder.com/32'">
                        <img src="${chainIcon}" class="chain-badge" title="${t.chain}">
                    </div>
                    <div class="token-info">
                        <span class="symbol" onclick="copyContract('${t.contract}')" title="Click to copy">${t.symbol} <i class="fas fa-copy text-secondary" style="font-size:10px; opacity:0.5"></i></span>
                        <div class="d-flex align-items-center gap-2">
                            <span class="name-chain">${t.name}</span>
                            <div class="badge-row">${badgesHtml}</div>
                        </div>
                    </div>
                </div>
            </td>

            <td>
                <div class="price-box">
                    <span class="price-val">$${formatPrice(t.price)}</span>
                    <span class="change-val ${priceClass}">${sign}${t.change_24h.toFixed(2)}%</span>
                </div>
            </td>

            <td class="text-end col-total border-start border-secondary" style="border-color:#2b3139!important">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end col-limit">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end col-onchain border-end border-secondary" style="border-color:#2b3139!important">$${formatNum(t.volume.daily_onchain)}</td>

            <td class="text-end col-vol24">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end col-tx">${parseInt(t.tx_count).toLocaleString()}</td>
            <td class="text-end col-liq border-end border-secondary" style="border-color:#2b3139!important">$${formatNum(t.liquidity)}</td>

            <td class="text-center" style="padding:0">${chartSvg}</td>

            <td class="text-end">
                <a href="https://www.binance.com/en/trade/${t.symbol}_USDT" target="_blank" class="btn-trade">TRADE</a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- HELPER FUNCTIONS ---
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
    navigator.clipboard.writeText(addr).then(() => {
        const x = document.getElementById("toast");
        if(x) {
            x.style.display = "block";
            x.className = "show";
            setTimeout(function(){ x.style.display = "none"; }, 3000);
        }
    });
}

function formatNum(n) {
    if (!n) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
}

function formatPrice(n) { 
    if(!n) return '0.00';
    return n < 1 ? n.toFixed(6) : n.toFixed(2); 
}

function createSparkline(data, isUp) {
    if (!data || !data.length) return '';
    const w=80, h=30;
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