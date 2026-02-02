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
    tbody.innerHTML = '';
    
    const listToRender = allTokens.slice(0, displayCount);

    listToRender.forEach(t => {
        const tr = document.createElement('tr');
        
        // --- XỬ LÝ BADGE & LOGIC ---
        // 1. Tính ngày còn lại (Listing Time + 30 ngày)
        // Lưu ý: listing_time từ API là ms. 
        const endTime = t.listing_time + (30 * 24 * 60 * 60 * 1000);
        const now = Date.now();
        const daysLeft = Math.ceil((endTime - now) / (1000 * 60 * 60 * 24));
        const dayText = daysLeft > 0 ? `${daysLeft}d` : 'End';

        // 2. Logic Trạng thái
        let badgesHtml = '';
        
        // Ưu tiên 1: SPOT hoặc DELISTED
        if (t.listingCex === true && t.offline === true) {
            badgesHtml += `<span class="bd bd-spot">SPOT</span>`;
        } else if (t.listingCex === false && t.offline === true) {
            badgesHtml += `<span class="bd bd-delist">DELISTED</span>`;
        } else {
            // Nếu vẫn là Alpha: Hiển thị Multiplier
            const isBsc4x = (t.chain === 'BSC' || t.chain === 'BNB') && t.mul_point >= 4;
            const glowClass = isBsc4x ? 'glow-bsc' : '';
            
            if (t.mul_point > 1) {
                badgesHtml += `
                    <div class="bd bd-mul ${glowClass}">
                        <span class="x-val">${t.mul_point}x</span>
                        <span class="d-val">${dayText}</span>
                    </div>
                `;
            }
        }

        // 3. Chain Color & Icon
        // Nếu API trả về chain_icon lỗi, ta có thể fallback (tạm thời dùng API icon)
        const chainImg = t.chain_icon || 'https://via.placeholder.com/14';

        // 4. Chart SVG
        const chartSvg = createSparkline(t.chart, t.change_24h >= 0);
        const priceClass = t.change_24h >= 0 ? 'text-up' : 'text-down';
        const sign = t.change_24h >= 0 ? '+' : '';

        // --- RENDER ROW ---
        tr.innerHTML = `
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${t.icon}" class="token-logo" onerror="this.src='https://via.placeholder.com/32'">
                        <img src="${chainImg}" class="chain-badge" title="${t.chain}">
                    </div>
                    <div class="token-info">
                        <div class="symbol-row">
                            <span class="symbol" onclick="copyContract('${t.contract}')">${t.symbol}</span>
                        </div>
                        <div class="badge-row">${badgesHtml}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="${priceClass}" style="font-weight:700">$${formatPrice(t.price)}</div>
                <div class="${priceClass}" style="font-size:11px">${sign}${t.change_24h.toFixed(2)}%</div>
            </td>
            <td>
                <div class="vol-col">
                    <span class="v-total">${formatNum(t.volume.daily_total)}</span>
                    <span class="v-limit">CEX: ${formatNum(t.volume.daily_limit)}</span>
                    ${t.volume.daily_onchain > 0 ? 
                        `<span class="v-onchain">DEX: ${formatNum(t.volume.daily_onchain)}</span>` : 
                        '<span class="v-zero">DEX: -</span>'}
                </div>
            </td>
            <td>
                <div class="stats-col">
                    <div class="s-row"><span>Vol24h:</span> <span class="s-val">${formatNum(t.volume.rolling_24h)}</span></div>
                    <div class="s-row"><span>Tx:</span> <span class="s-val">${formatNum(t.tx_count)}</span></div>
                    <div class="s-row"><span>Cap:</span> <span class="s-val">${formatNum(t.market_cap)}</span></div>
                </div>
            </td>
            <td>${chartSvg}</td>
            <td>
                <a href="https://www.binance.com/en/trade/${t.symbol}_USDT" target="_blank" class="trade-btn">Trade</a>
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
