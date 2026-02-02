document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, 60000); // 1 phút refresh 1 lần
});

async function loadData() {
    try {
        // Thêm timestamp để tránh cache trình duyệt cũ
        const res = await fetch('public/data/market-data.json?t=' + Date.now());
        const data = await res.json();
        document.getElementById('updated-time').innerText = 'Last Update: ' + data.last_updated;
        render(data.tokens);
    } catch (e) { console.error(e); }
}

function render(tokens) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    tokens.forEach(t => {
        const days = Math.floor((Date.now() - t.listing_time) / 86400000);
        const priceClass = t.change_24h >= 0 ? 'up' : 'down';
        const sign = t.change_24h >= 0 ? '+' : '';
        
        // Vẽ Chart SVG Mini
        const chartSvg = makeSparkline(t.chart, t.change_24h >= 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="token-cell">
                    <div class="icon-wrapper">
                        <img src="${t.icon}" class="token-icon">
                        <img src="${t.chain_icon}" class="chain-icon">
                    </div>
                    <div>
                        <span class="symbol">${t.symbol}</span>
                        <span class="name">${t.name}</span>
                        <div class="badges">
                            ${t.mul_point > 1 ? `<span class="badge b-mul">x${t.mul_point}</span>` : ''}
                            <span class="badge b-day">${days}d</span>
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <div class="${priceClass}" style="font-weight:bold">$${fmtPrice(t.price)}</div>
                <div class="${priceClass}" style="font-size:11px">${sign}${t.change_24h.toFixed(2)}%</div>
            </td>
            <td>
                <div class="vol-group">
                    <span class="v-total" title="Total UTC">${fmtNum(t.volume.daily_total)}</span>
                    <span class="v-limit" title="CEX Limit">CEX: ${fmtNum(t.volume.daily_limit)}</span>
                    ${t.volume.daily_onchain > 0 ? `<span class="v-onchain">DEX: ${fmtNum(t.volume.daily_onchain)}</span>` : ''}
                </div>
            </td>
            <td>
                <div class="stats">
                    <div class="stat-row">Vol24h: <span>${fmtNum(t.volume.rolling_24h)}</span></div>
                    <div class="stat-row">Tx: <span>${fmtNum(t.tx_count)}</span></div>
                    <div class="stat-row">Liq: <span>${fmtNum(t.liquidity)}</span></div>
                    <div class="stat-row">Cap: <span>${fmtNum(t.market_cap)}</span></div>
                </div>
            </td>
            <td>${chartSvg}</td>
            <td>
                <a href="https://www.binance.com/en/trade/${t.symbol}_USDT" target="_blank" 
                   style="color:#fcd535; text-decoration:none; border:1px solid #fcd535; padding:4px 8px; border-radius:4px; font-size:12px">Trade</a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function fmtNum(n) {
    if (!n) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
}
function fmtPrice(n) { return n < 1 ? n.toFixed(6) : n.toFixed(2); }

function makeSparkline(data, isUp) {
    if (!data || !data.length) return '<span style="color:#333;font-size:10px">No Data</span>';
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
