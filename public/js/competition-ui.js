const COMPETITION_API_URL = 'data/competition-history.json';

if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Rajdhani', sans-serif";
    Chart.defaults.color = '#848e9c';
}


const style = document.createElement('style');
style.innerHTML = `
    .flash-update { animation: flashUpdate 0.6s ease-out; }
    @keyframes flashUpdate { 0% { color: #fff; text-shadow: 0 0 8px rgba(255,255,255,0.8); } 100% { } }
`;
document.head.appendChild(style);

class CompetitionRadar {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.data = null;
        this.realtimeCache = {}; 
    }

    async init() {
        if (!this.container) return;
        this.container.classList.add('radar-wrapper-container');
        
        await this.fetchData();
        if (this.data && this.data.data) {
            this.renderCards();
        } else {
            this.container.innerHTML = '';
        }
    }

    async fetchData() {
        try {
            const res = await fetch(COMPETITION_API_URL + '?t=' + Date.now());
            if (!res.ok) throw new Error("Err");
            this.data = await res.json();
        } catch (e) { console.error(e); }
    }

    updateRealtimeStats(externalList) {
        if (!externalList || !Array.isArray(externalList)) return;

        externalList.forEach(item => {
            if (item.contract) {
                const key = item.contract.toLowerCase().trim();
                this.realtimeCache[key] = item;
            }
        });

        if (this.data && this.data.data) {
            this.renderCards();
        }
    }

    formatKMB(num) {
        if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
        return '$' + Math.round(num).toLocaleString();
    }

    processToken(contract, raw) {
        const history = raw.h || raw.history; 
        if (!history || history.length === 0) return null;
        
        const historyVol = new Array(24).fill(0); 
        const todayVol = new Array(24).fill(0); 
        const todayRisk = new Array(24).fill(0); 
        const todayTx = new Array(24).fill(0);
        const matchSpeedHistory = new Array(24).fill(null);
    
        const now = new Date();
        const currentHour = now.getHours(); 
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lookbackStart = startOfToday - (3 * 24 * 60 * 60 * 1000); 
    
        let globalPeak = 0; 
        
        history.forEach(pt => {
            const ts = pt[0]; const vol = pt[1]; const tx = pt[2]; const risk = pt[3];
            const hour = new Date(ts).getHours();
            
            if (ts >= startOfToday) {
                todayVol[hour] = vol; todayTx[hour] = tx; todayRisk[hour] = risk;
                if (hour <= currentHour && vol > 0) {
                    const secondsPassed = (hour === currentHour) ? ((now.getMinutes() * 60) + now.getSeconds() || 1) : 3600;
                    matchSpeedHistory[hour] = Math.round(vol / secondsPassed);
                }
            } else if (ts >= lookbackStart) {
                if (vol > historyVol[hour]) { historyVol[hour] = vol; }
            }
        });
    
        for (let i = 0; i < 24; i++) {
            const m = Math.max(historyVol[i], todayVol[i]);
            if (m > globalPeak) globalPeak = m;
        }
        
        const hotZones = new Array(24).fill(false);
        const threshold = globalPeak * 0.7; 
        for (let i = 0; i < 24; i++) { if (Math.max(historyVol[i], todayVol[i]) >= threshold) hotZones[i] = true; }
        
        const cleanKey = contract.toLowerCase().trim();
        const cachedItem = this.realtimeCache[cleanKey] || {};
        const analysis = cachedItem.market_analysis || raw.market_analysis || {};
        
        const matchSpeedUSD = analysis.realTimeVol ? Math.round(analysis.realTimeVol) : 0;
        const liveAvgTicket = analysis.avgTicket ? Math.round(analysis.avgTicket) : 0;
        const spreadVal = analysis.spread !== undefined ? analysis.spread : 0;
        const txPerSecond = analysis.velocity ? (analysis.velocity / 60) : 0;
        
        if (matchSpeedUSD > 0) matchSpeedHistory[currentHour] = matchSpeedUSD;
    
        let dailyVolUTC = parseFloat(cachedItem.limit_daily_volume || raw.limit_daily_volume || 0);
    
        const lh = cachedItem.limit_vol_history || raw.limit_vol_history || [];
        
        if (dailyVolUTC === 0 && Array.isArray(lh) && lh.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const found = lh.find(x => x.date === todayStr);
    
            if (found) {
                dailyVolUTC = parseFloat(found.vol);
            } else {
                const last = lh[lh.length - 1];
                if (last) dailyVolUTC = parseFloat(last.vol);
            }
        }
    
        let algoLimit = matchSpeedUSD * 0.15; 
        
        if (spreadVal <= 0.5) algoLimit *= 1.0;
        else if (spreadVal <= 1.5) algoLimit *= 0.8;
        else if (spreadVal <= 3.0) algoLimit *= 0.5;
        else algoLimit *= 0.2;
    
        const isLowTxs = txPerSecond < 3;
        if (isLowTxs) algoLimit *= 0.5;
    
        algoLimit = Math.round(algoLimit);
    
        let riskScore = 0;
    if (spreadVal <= 0.5) {
        riskScore = 0; 
    } else if (spreadVal <= 1.5) {
        riskScore = 1; 
    } else if (spreadVal <= 3.0) {
        riskScore = 2; 
    } else {
        riskScore = 3; 
    }
    
        let projected = 0;
        const curVol = todayVol[currentHour] || 0;
        const minPassed = now.getMinutes() || 1;
        if (Math.max(historyVol[currentHour], todayVol[currentHour]) > 0) {
            projected = Math.round((curVol / minPassed) * 60);
        }
    
        return {
            symbol: raw.s || raw.name, contract, 
            l: raw.l,
            cl: raw.cl,
            matchSpeedHistory, historyVol, todayVol, todayRisk,
            projected, currentHour, 
            dailyVolUTC,
            liveAvgTicket, matchSpeedUSD, spreadVal, 
            txPerSecond: txPerSecond.toFixed(2), 
            riskScore, hotZones, globalPeak,
            algoLimit, isLowTxs 
        };
    }

    filterRadar(allowedList) {
        this.currentFilterList = allowedList; 
        this.renderCards(); 
    }

    renderCards() {
        if (!this.data || !this.data.data) return;

        let tokens = Object.keys(this.data.data);
        const nowMs = Date.now();
        tokens = tokens.filter(key => {
            const item = this.data.data[key];
            
            // Item.e là chuỗi "2026-02-11T11:00:00Z"
            if (item.e) {
                // new Date() đọc chữ Z sẽ tự hiểu là UTC
                const endTimeMs = new Date(item.e).getTime();

                // So sánh chính xác từng mili giây
                // Nếu hiện tại > giờ kết thúc -> ẨN
                if (nowMs > endTimeMs) {
                    return false; 
                }
            }
            return true;
        });

        if (this.currentFilterList && Array.isArray(this.currentFilterList)) {
            tokens = tokens.filter(key => {
                const item = this.data.data[key];
                const keyLower = key.toLowerCase(); 
                const symbolLower = item.s ? item.s.toLowerCase().trim() : ''; 
                const nameLower = item.n ? item.n.toLowerCase().trim() : '';   
                return this.currentFilterList.includes(keyLower) || 
                       (symbolLower && this.currentFilterList.includes(symbolLower)) ||
                       (nameLower && this.currentFilterList.includes(nameLower));
            });
        }
        
        const processed = tokens.map(k => this.processToken(k, this.data.data[k])).filter(i => i !== null);
        
        let universeMaxPeak = 0;
        processed.forEach(p => { if (p.globalPeak > universeMaxPeak) universeMaxPeak = p.globalPeak; });
        processed.sort((a, b) => b.dailyVolUTC - a.dailyVolUTC);

        
        const existingCards = Array.from(this.container.children);
        const processedIds = processed.map(p => `card-${p.contract}`);
        existingCards.forEach(card => {
            if (!processedIds.includes(card.id)) card.remove();
        });

        processed.forEach(stats => {
            let rawRatio = (universeMaxPeak > 0) ? (stats.globalPeak / universeMaxPeak) : 1;
            const minVisibility = 0.3; 
            const visualScale = minVisibility + (rawRatio * (1 - minVisibility));

            const cardId = `card-${stats.contract}`;
            let cardEl = document.getElementById(cardId);

            if (!cardEl) {
                
                const cardHTML = this.buildHTML(stats, cardId);
                this.container.insertAdjacentHTML('beforeend', cardHTML);
                this.drawChart(stats, visualScale, true); 
            } else {
                
                this.container.appendChild(cardEl); 
                this.updateCardUI(stats);
                this.drawChart(stats, visualScale, false); 
            }
        });
    }

    updateCardUI(stats) {
        let spreadColor = '#0ECB81'; 
        let spreadText = stats.spreadVal.toFixed(2) + '%';
        if (stats.riskScore === 1) spreadColor = '#F0B90B'; 
        if (stats.riskScore === 2) spreadColor = '#F6465D';
        
        let matchColor = stats.matchSpeedUSD >= 1000 ? '#00F0FF' : '#fff'; 
        let avgColor = stats.liveAvgTicket >= 1000 ? '#FF9F43' : '#fff';
        
        
        let limitVal = stats.algoLimit;
        let limitColor = '#0ECB81';
        let limitText = `&lt;$${limitVal.toLocaleString()}`;

        if (limitVal < 10) {
            limitColor = '#F6465D';
            limitText = '💀 DEAD';
        } else if (limitVal < 50) {
            limitColor = '#F6465D'; 
        } else if (limitVal <= 200) {
            limitColor = '#F0B90B'; 
        }

        const updateEl = (id, newVal, color) => {
            const el = document.getElementById(id);
            if (el && el.innerHTML !== newVal) {
                el.innerHTML = newVal;
                if(color) el.style.color = color;
                el.classList.remove('flash-update');
                void el.offsetWidth; 
                el.classList.add('flash-update');
            }
        };

        
        updateEl(`stat-safe-${stats.contract}`, limitText, limitColor);

        
        updateEl(`stat-daily-${stats.contract}`, this.formatKMB(stats.dailyVolUTC), '#888');

        updateEl(`stat-avg-${stats.contract}`, this.formatKMB(stats.liveAvgTicket), avgColor);
        updateEl(`stat-match-${stats.contract}`, this.formatKMB(stats.matchSpeedUSD) + '<span style="font-size:0.7em; color:#666">/s</span>', matchColor);
        updateEl(`stat-spread-${stats.contract}`, spreadText, spreadColor);
        updateEl(`stat-speed-${stats.contract}`, stats.txPerSecond + '<span style="font-size:0.7em; color:#666">txs</span>', '#fff');
    }

    buildHTML(stats, cardId) {
        let spreadColor = '#0ECB81'; 
        let spreadText = stats.spreadVal.toFixed(2) + '%';
        if (stats.riskScore === 1) spreadColor = '#F0B90B'; 
        if (stats.riskScore === 2) spreadColor = '#F6465D';
        
        let matchColor = stats.matchSpeedUSD >= 1000 ? '#00F0FF' : '#fff';
        let avgColor = stats.liveAvgTicket >= 1000 ? '#FF9F43' : '#fff';

        let limitVal = stats.algoLimit;
        let limitColor = '#0ECB81'; 
        let limitText = `<$${limitVal.toLocaleString()}`; 

        if (limitVal < 10) {
            limitColor = '#F6465D'; 
            limitText = '💀 DEAD'; 
        } else if (limitVal < 50) {
            limitColor = '#F6465D'; 
        } else if (limitVal <= 200) {
            limitColor = '#F0B90B'; 
        }

        // --- XỬ LÝ ẢNH (MỚI) ---
        // 1. Ảnh Token: Nếu có link API (stats.l) thì dùng, không thì tìm file local viết hoa
        const tokenImgSrc = (stats.l && stats.l.startsWith('http')) 
            ? stats.l 
            : `assets/tokens/${stats.symbol.toUpperCase()}.png`;

        // 2. Ảnh Chain: Nếu có link API (stats.cl) thì tạo thẻ img nhỏ
        const chainImgHtml = (stats.cl && stats.cl.startsWith('http'))
            ? `<img src="${stats.cl}" style="width:12px; height:12px; border-radius:50%; position: absolute; bottom: -2px; right: -2px; border: 1px solid #1c2127; background: #000; z-index: 2;">`
            : '';
        // -----------------------

        return `
        <div class="col-12 col-md-4 col-lg-3" id="${cardId}">
            <div class="radar-card" style="background: #161a1e; border: 1px solid #2b3139; border-radius: 6px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                
                <div class="radar-head" style="padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2b3139; background: #1c2127;">
                    
                    <div class="d-flex align-items-center" style="flex: 1; min-width: 0; margin-right: 10px;">
                        
                        <div style="position: relative; width: 20px; height: 20px; margin-right: 8px; flex-shrink: 0;">
                            <img src="${tokenImgSrc}" 
                                 onerror="this.onerror=null; this.src='assets/tokens/default.png'" 
                                 style="width:100%; height:100%; border-radius:50%; border: 1px solid #333; display: block;">
                            ${chainImgHtml}
                        </div>

                        <span style="font-weight: 800; font-size: 1rem; color: #fff; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${stats.symbol}</span>
                    </div>

                    <div class="text-end">
                        <div style="font-size: 0.5rem; color: #888; font-weight: 700; text-transform:uppercase; margin-bottom:-2px;">ALGO LIMIT</div>
                        <div id="stat-safe-${stats.contract}" style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.1rem; color: ${limitColor}; text-shadow: 0 0 10px rgba(0,0,0,0.5);">
                            ${limitText}
                        </div>
                    </div>
                </div>

                <div class="radar-stats-row" style="display: flex; background: rgba(22, 26, 30, 0.5); padding: 6px 0;">
                    
                    <div style="flex: 1; text-align: center; border-right: 1px solid #2b3139;">
                        <div style="font-size: 0.55rem; color: #848e9c; margin-bottom: 3px; font-weight: 600;">AVG</div>
                        <div id="stat-avg-${stats.contract}" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1; color: ${avgColor};">${this.formatKMB(stats.liveAvgTicket)}</div>
                    </div>

                    <div style="flex: 1; text-align: center; border-right: 1px solid #2b3139;">
                        <div style="font-size: 0.55rem; color: #848e9c; margin-bottom: 3px; font-weight: 600;">SPEED</div>
                        <div id="stat-speed-${stats.contract}" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1; color: #fff;">${stats.txPerSecond}<span style="font-size:0.7em; color:#666">txs</span></div>
                    </div>

                    <div style="flex: 1; text-align: center; border-right: 1px solid #2b3139;">
                        <div style="font-size: 0.55rem; color: #848e9c; margin-bottom: 3px; font-weight: 600;">MATCH</div>
                        <div id="stat-match-${stats.contract}" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1; color: ${matchColor};">${this.formatKMB(stats.matchSpeedUSD)}<span style="font-size:0.7em; color:#666">/s</span></div>
                    </div>

                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 0.55rem; color: #848e9c; margin-bottom: 3px; font-weight: 600;">SPREAD</div>
                        <div id="stat-spread-${stats.contract}" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1; color: ${spreadColor};">${spreadText}</div>
                    </div>

                </div>

                <div class="radar-chart-container" style="position: relative; height: 100px; width: 100%; margin-top: 0px;">
                    
                    <div style="position: absolute; top: 4px; right: 8px; z-index: 5; pointer-events: none; opacity: 0.8;">
                        <span style="font-size: 0.6rem; color: #555; font-weight: 800; text-transform:uppercase; font-family: 'Rajdhani', sans-serif;">DAILY VOL: </span>
                        <span id="stat-daily-${stats.contract}" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.65rem; color: #888;">
                            ${this.formatKMB(stats.dailyVolUTC)}
                        </span>
                    </div>

                    <canvas id="chart-${stats.contract}"></canvas>
                </div>
            </div>
        </div>
        `;
    }

    drawChart(stats, visualScale = 1, isNew = false) {
        const ctx = document.getElementById(`chart-${stats.contract}`);
        if (!ctx) return;

        const barColors = stats.todayVol.map((vol, index) => {
            if (index > stats.currentHour) return 'transparent';
            
            const risk = stats.todayRisk[index];

            
            if (vol < 500) return 'rgba(108, 117, 125, 0.3)'; 

            
            if (risk === 3) return '#FF003C'; 
            if (risk === 2) return '#F6465D'; 
            if (risk === 1) return '#FF8181'; 
            
            
            return '#0ECB81'; 
        });

        const finalColors = visualScale <= 0.6 ? barColors.map(c => {
                if (c === '#0ECB81') return 'rgba(14, 203, 129, 0.6)';
                if (c === '#FF8181') return 'rgba(255, 129, 129, 0.6)'; 
                if (c === '#F6465D') return 'rgba(246, 70, 93, 0.6)';   
                if (c === '#FF003C') return 'rgba(255, 0, 60, 0.6)';    
                return c;
            }) : barColors;

        const dynamicMaxY = (stats.globalPeak / visualScale) * 1.5;

        if (!isNew) {
            const chart = Chart.getChart(ctx);
            if (chart) {
                chart.data.datasets[0].data = stats.matchSpeedHistory;
                chart.data.datasets[1].data = stats.todayVol.map((v, i) => i <= stats.currentHour ? v : null);
                chart.data.datasets[1].backgroundColor = finalColors;
                chart.data.datasets[2].data = stats.historyVol;
                chart.data.datasets[3].data = Array.from({length: 24}, (_, i) => i === stats.currentHour ? stats.projected : null);
                
                chart.options.scales.y.max = dynamicMaxY;
                chart.options.scales.x.ticks.color = (ctx) => {
                    if (ctx.tick.value === stats.currentHour) return '#fff'; 
                    if (stats.hotZones[ctx.tick.value]) return '#F0B90B'; 
                    return '#444'; 
                };
                chart.update('none'); 
                return;
            }
        }

        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => i),
                datasets: [
                    {
                        label: 'Match Speed',
                        type: 'line',
                        data: stats.matchSpeedHistory,
                        borderColor: '#00F0FF', borderWidth: 1.5,
                        pointStyle: 'line', pointRadius: 0, pointHoverRadius: 0,
                        tension: 0.4, fill: false, 
                        yAxisID: 'y1', order: 0, spanGaps: false 
                    },
                    {
                        label: 'Live',
                        data: stats.todayVol.map((v, i) => i <= stats.currentHour ? v : null),
                        backgroundColor: finalColors,
                        pointStyle: 'rect', grouped: false, order: 10, barPercentage: 0.9, yAxisID: 'y'
                    },
                    {
                        label: 'History',
                        data: stats.historyVol,
                        backgroundColor: '#383e46',
                        pointStyle: 'rect', grouped: false, order: 20, barPercentage: 0.9, yAxisID: 'y'
                    },
                    {
                        label: 'Projected',
                        type: 'line',
                        data: Array.from({length: 24}, (_, i) => i === stats.currentHour ? stats.projected : null),
                        borderColor: '#fff', borderDash: [2, 2], borderWidth: 1, 
                        pointStyle: 'dash', pointRadius: 0, order: 1, yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(10, 14, 18, 0.98)',
                        titleColor: '#848e9c', bodyColor: '#fff',
                        bodyFont: { family: "'Rajdhani', sans-serif", size: 11 },
                        titleFont: { size: 10 },
                        borderColor: '#2b3139', borderWidth: 1, 
                        
                        padding: 10,       
                        caretPadding: 15,  
                        xAlign: 'left',    
                        yAlign: 'center',  
                        
                        boxWidth: 10,      
                        displayColors: true, usePointStyle: true,
                        callbacks: {
                            title: (items) => `TIME: ${items[0].label}:00`,
                            label: (context) => {
                                const labelName = context.dataset.label;
                                
                                
                                if (labelName === 'Match Speed') {
                                    const speed = context.raw || 0;
                                    return `Match: $${speed.toLocaleString()}/s`;
                                }

                                if (labelName === 'Live') {
                                    const vol = context.raw;
                                    const idx = context.dataIndex;
                                    const risk = stats.todayRisk[idx];
                                    let statusText = 'Stable';
                                    if (vol < 500) statusText = 'Inactive';
                                    else if (risk >= 2) statusText = 'DANGER';
                                    else if (risk === 1) statusText = 'Warning';
                                    return `Live: ${this.formatKMB(vol)} (${statusText})`;
                                }
                                if (labelName === 'History') return `Hist: ${this.formatKMB(context.raw)}`;
                                return null;
                            },
                            labelColor: (context) => {
                                if (context.dataset.label === 'Match Speed') return { borderColor: '#00F0FF', backgroundColor: '#00F0FF', borderWidth: 2, borderRadius: 0 };
                                return { borderColor: 'transparent', backgroundColor: context.element.options.backgroundColor, borderWidth: 0, borderRadius: 2 };
                            }
                        }
                    }
                },
                scales: {
                    x: { display: true, grid: { display: false }, 
                        ticks: { 
                            font: (ctx) => ({ size: 9, weight: (ctx.tick.value === stats.currentHour || stats.hotZones[ctx.tick.value]) ? 'bold' : 'normal' }),
                            color: (ctx) => {
                                if (ctx.tick.value === stats.currentHour) return '#fff'; 
                                if (stats.hotZones[ctx.tick.value]) return '#F0B90B'; 
                                return '#444'; 
                            },
                            maxRotation: 0, minRotation: 0, autoSkip: false 
                        } 
                    },
                    y: { display: false, max: dynamicMaxY },
                    y1: { display: false, position: 'right', beginAtZero: true, grace: '10%' } 
                },
                layout: { padding: { left: 5, right: 5, bottom: 0 } }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('competition-radar-area')) {
        window.competitionRadar = new CompetitionRadar('competition-radar-area');
        window.competitionRadar.init();
    }
});
