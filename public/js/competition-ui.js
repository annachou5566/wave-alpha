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
            const res = await fetch(COMPETITION_API_URL + '?t=' + Date.now(), {
                method: 'GET',
                headers: {
                    'X-Wave-Source': 'web-client' 
                }
            });
            
            if (!res.ok) throw new Error("Err: " + res.status);
            this.data = await res.json();
        } catch (e) { console.error(e); }
    }

    updateRealtimeStats(externalList) {
        if (!externalList || !Array.isArray(externalList)) return;

        if (!this.data) this.data = { data: {} };
        if (!this.data.data) this.data.data = {};

        externalList.forEach(item => {
            if (item.contract) {
                const key = item.contract.toLowerCase().trim();
                this.realtimeCache[key] = item;
                
                if (!this.data.data[key]) {
                    this.data.data[key] = {
                        s: item.symbol || item.name || "UNKNOWN",
                        n: item.name || "",
                        contract: item.contract,
                        l: item.logo || item.icon || "",
                        cl: item.chain_icon || item.chainLogo || "",
                        e: item.end_at || item.end,
                        h: [] 
                    };
                }
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
        const history = raw.h || raw.history || []; 
               
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

 
        if (!this.smoothCache) this.smoothCache = {};
        if (!this.smoothCache[cleanKey]) {
            this.smoothCache[cleanKey] = {
                speed: { val: 0, age: 0 },
                ticket: { val: 0, age: 0 },
                spread: { val: 0, age: 0 },
                trend: { val: 0, age: 0 }, 
                drop: { val: 0, age: 0 }, 
                netFlow: { val: 0, age: 0 }
            };
        }
        
        const smooth = this.smoothCache[cleanKey];
        
        const getSmooth = (prop, newVal, maxAge = 4) => {
            if (newVal !== 0 && newVal !== undefined && !isNaN(newVal)) {
                smooth[prop].val = newVal;
                smooth[prop].age = 0;
            } else {
                smooth[prop].age++;
                if (smooth[prop].age > maxAge) {
                    smooth[prop].val = 0; 
                }
            }
            return smooth[prop].val;
        };

        const speedRaw = getSmooth('speed', parseFloat(analysis.speed || 0), 5); 
        const ticketRaw = getSmooth('ticket', parseFloat(analysis.ticket || 0), 20); 
        const spreadVal = getSmooth('spread', parseFloat(analysis.spread || 0), 5);
        const trendVal = getSmooth('trend', parseFloat(analysis.trend || 0), 3); 
        const dropVal = getSmooth('drop', parseFloat(analysis.drop || 0), 3);   
        const netFlowVal = getSmooth('netFlow', parseFloat(analysis.netFlow || 0), 5);

        const matchSpeedUSD = Math.round(speedRaw);
        const liveAvgTicket = Math.round(ticketRaw);
   
        let txPerSecond = 0;
        if (liveAvgTicket > 0) {
            txPerSecond = speedRaw / liveAvgTicket;
        }
        
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

        // --- BẮT ĐẦU ĐOẠN XỬ LÝ REALTIME ---
        let projected = 0;
        const minPassed = now.getMinutes() || 1;

        let sumSinceUTC0 = 0;
        let startOfUTC0 = new Date(now.getTime());
        startOfUTC0.setUTCHours(0, 0, 0, 0);
        
        let startOfCurrentHour = new Date(now.getTime());
        startOfCurrentHour.setMinutes(0, 0, 0, 0); 

        if (history && history.length > 0) {
            history.forEach(pt => {
                const ts = pt[0];
                const vol = parseFloat(pt[1] || 0); 
                if (ts >= startOfUTC0.getTime() && ts < startOfCurrentHour.getTime()) {
                    sumSinceUTC0 += vol;
                }
            });
        }
        
        let rtCurrentHourVol = dailyVolUTC - sumSinceUTC0;
        
        if (rtCurrentHourVol >= 0) {
            todayVol[currentHour] = rtCurrentHourVol;
            if (rtCurrentHourVol > globalPeak) {
                globalPeak = rtCurrentHourVol; 
            }
            projected = Math.round((rtCurrentHourVol / minPassed) * 60);
        } else {
            const curVol = todayVol[currentHour] || 0;
            projected = Math.round((curVol / minPassed) * 60);
        }
        // --- KẾT THÚC XỬ LÝ REALTIME ---
        
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
    
        return {
            symbol: raw.s || raw.name, contract, 
            l: raw.l,
            cl: raw.cl,
            matchSpeedHistory, historyVol, todayVol, todayRisk,
            projected, currentHour, 
            dailyVolUTC,
            liveAvgTicket, matchSpeedUSD, spreadVal, 
            trendVal, dropVal, netFlowVal,
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
            
            
            if (item.e) {
                
                const endTimeMs = new Date(item.e).getTime();

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
   

        if (typeof initBinanceTooltips === 'function') {
            initBinanceTooltips();
        }
    }

    updateCardUI(stats) {
        let limitVal = stats.algoLimit;
        let limitColor = '#0ECB81';
        let limitText = `&lt;$${limitVal.toLocaleString()}`; 

        if (limitVal < 10) { limitColor = '#F6465D'; limitText = '💀 DEAD'; } 
        else if (limitVal < 50) { limitColor = '#F6465D'; } 
        else if (limitVal <= 200) { limitColor = '#F0B90B'; }

        const updateDynElNumberOnly = (id, newHtml) => {
            const el = document.getElementById(id);
            if (el && el.innerHTML !== newHtml) {
                el.innerHTML = newHtml;
            }
        };

        const updateDynElWithColor = (id, newHtml, rawVal, defaultColor = null) => {
            const el = document.getElementById(id);
            if (el) {
                let oldVal = parseFloat(el.getAttribute('data-raw')) || 0;
                if (el.innerHTML !== newHtml) {
                    el.innerHTML = newHtml;
                    if (oldVal > 0 && rawVal !== oldVal) {
                        if (rawVal > oldVal) {
                            el.classList.remove('tick-down'); el.classList.add('tick-up');
                        } else {
                            el.classList.remove('tick-up'); el.classList.add('tick-down');
                        }
                    } else if (defaultColor && !el.classList.contains('tick-up') && !el.classList.contains('tick-down')) {
                        el.style.color = defaultColor;
                    }
                }
                el.setAttribute('data-raw', rawVal);
            }
        };

        updateDynElWithColor(`stat-safe-${stats.contract}`, limitText, limitVal, limitColor);
        updateDynElNumberOnly(`stat-daily-${stats.contract}`, this.formatKMB(stats.dailyVolUTC));
        
        updateDynElWithColor(`stat-speed-${stats.contract}`, stats.txPerSecond + '<span style="font-size:0.7em; opacity:0.5">txs</span>', parseFloat(stats.txPerSecond));
        updateDynElWithColor(`stat-match-${stats.contract}`, this.formatKMB(stats.matchSpeedUSD) + '<span style="font-size:0.7em; opacity:0.5">/s</span>', stats.matchSpeedUSD);
        updateDynElWithColor(`stat-spread-${stats.contract}`, stats.spreadVal.toFixed(2) + '%', stats.spreadVal);

       
        // --- HIỂN THỊ DÒNG TIỀN (NET FLOW) ---
        let flowColor = stats.netFlowVal >= 0 ? '#0ECB81' : '#F6465D';
        let flowSign = stats.netFlowVal >= 0 ? '+' : '';
        let flowText = `${flowSign}${this.formatKMB(Math.abs(stats.netFlowVal))}`;
        updateDynElWithColor(`stat-flow-${stats.contract}`, flowText, stats.netFlowVal, flowColor);

        // --- HIỂN THỊ TREND VÀ CẢNH BÁO ĐẢO CHIỀU (DUMP CATCHER) ---
        let trendColor = stats.trendVal >= 0 ? '#0ECB81' : '#F6465D';
        let trendSign = stats.trendVal > 0 ? '+' : '';
        
        let trendText = `${trendSign}${stats.trendVal.toFixed(2)}%`;        
        // Nếu giá rớt khỏi đỉnh quá 0.6% -> Cảnh báo Xả Hàng!
        if (stats.dropVal <= -0.6) {
            trendColor = '#F6465D';
            trendText = `<span style="animation: flashUpdate 0.5s infinite; color: #fff; background: #F6465D; padding: 2px 4px; border-radius: 3px;">⚠️ XẢ HÀNG (${stats.dropVal.toFixed(2)}%)</span>`;
        }
        
        // Chỉ gọi updateDynElWithColor MỘT LẦN duy nhất
        updateDynElWithColor(`stat-trend-${stats.contract}`, trendText, stats.trendVal, trendColor);

        // --- CÁ MẬP TRACKER ---
        let whaleIcon = stats.liveAvgTicket > 5000 ? '🐋' : ''; 
        let ticketColor = stats.liveAvgTicket > 5000 ? '#F0B90B' : null;
        updateDynElWithColor(`stat-avg-${stats.contract}`, `${whaleIcon} ${this.formatKMB(stats.liveAvgTicket)}`, stats.liveAvgTicket, ticketColor);

        // --- HIỆU ỨNG VIỀN QUANG HỌC ---
        const cardEl = document.getElementById(`card-${stats.contract}`);
        if (cardEl) {
            const innerCard = cardEl.querySelector('.radar-card');
            if (stats.dropVal <= -0.6) {
                // Rớt đỉnh -> Nháy viền Đỏ
                innerCard.style.boxShadow = '0 0 15px rgba(246, 70, 93, 0.4)';
                innerCard.style.borderColor = '#F6465D';
            } else if (stats.trendVal >= 1.0) {
                // Trend Xanh mạnh -> Nháy viền Xanh lục
                innerCard.style.boxShadow = '0 0 15px rgba(14, 203, 129, 0.2)';
                innerCard.style.borderColor = '#0ECB81';
            } else {
                // Bình thường -> Tắt viền chớp
                innerCard.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
                innerCard.style.borderColor = '#2b3139';
            }
        }
}
    buildHTML(stats, cardId) {
        let limitVal = stats.algoLimit;
        let limitColor = '#0ECB81'; 
        let limitText = `<$${limitVal.toLocaleString()}`; 

        if (limitVal < 10) { limitColor = '#F6465D'; limitText = '💀 DEAD'; } 
        else if (limitVal < 50) { limitColor = '#F6465D'; } 
        else if (limitVal <= 200) { limitColor = '#F0B90B'; }

        const tokenImgSrc = (stats.l && stats.l.startsWith('http')) ? stats.l : `assets/tokens/${stats.symbol.toUpperCase()}.png`;
        const chainImgHtml = (stats.cl && stats.cl.startsWith('http')) ? `<img src="${stats.cl}" style="width:12px; height:12px; border-radius:50%; position: absolute; bottom: -2px; right: -2px; border: 1px solid #1c2127; background: #000; z-index: 2;">` : '';
      
        return `
        <div class="col-12 col-md-4 col-lg-3" id="${cardId}">
            <div class="radar-card" style="background: #161a1e; border: 1px solid #2b3139; border-radius: 6px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                <div class="radar-head" style="padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2b3139; background: #1c2127;">
                    <div class="d-flex align-items-center" style="flex: 1; min-width: 0; margin-right: 10px;">
                        <div style="position: relative; width: 20px; height: 20px; margin-right: 8px; flex-shrink: 0;">
                            <img src="${tokenImgSrc}" onerror="this.onerror=null; this.src='assets/tokens/default.png'" style="width:100%; height:100%; border-radius:50%; border: 1px solid #333; display: block;">
                            ${chainImgHtml}
                        </div>
                        <span style="font-weight: 800; font-size: 1rem; color: #fff; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${stats.symbol}</span>
                    </div>
                    <div class="text-end">
                        <div style="margin-bottom:-2px;">     <span class="tippy-header" data-tippy-content="Ngưỡng an toàn dựa trên tốc độ khớp lệnh Limit." style="font-size: 0.5rem; color: #888; font-weight: 700; text-transform:uppercase;">ALGO LIMIT</span> </div>
                        <div id="stat-safe-${stats.contract}" style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.1rem; color: ${limitColor}; text-shadow: 0 0 10px rgba(0,0,0,0.5);">${limitText}</div>
                    </div>
                </div>

                <div class="radar-stats-row" style="display: flex; background: rgba(22, 26, 30, 0.5); padding: 6px 0;">
                    <div style="flex: 1; text-align: center; border-right: 1px solid #2b3139;">
                        <div style="margin-bottom: 3px;"><span class="tippy-header" data-tippy-content="Giá trị trung bình 1 lệnh ($)." style="font-size: 0.55rem; color: #848e9c; font-weight: 600;">AVG</span></div>
                        <div id="stat-avg-${stats.contract}" class="radar-dyn-val" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1;">${this.formatKMB(stats.liveAvgTicket)}</div>
                    </div>
                    <div style="flex: 1; text-align: center; border-right: 1px solid #2b3139;">
                        <div style="margin-bottom: 3px;"><span class="tippy-header" data-tippy-content="Tốc độ khớp lệnh (Lệnh/giây)." style="font-size: 0.55rem; color: #848e9c; font-weight: 600;">SPEED</span></div>
                        <div id="stat-speed-${stats.contract}" class="radar-dyn-val" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1;">${stats.txPerSecond}<span style="font-size:0.7em; opacity:0.5">txs</span></div>
                    </div>
                    <div style="flex: 1; text-align: center; border-right: 1px solid #2b3139;">
                        <div style="margin-bottom: 3px;"><span class="tippy-header" data-tippy-content="Thanh khoản trung bình mỗi giây ($)." style="font-size: 0.55rem; color: #848e9c; font-weight: 600;">MATCH</span></div>
                        <div id="stat-match-${stats.contract}" class="radar-dyn-val" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1;">${this.formatKMB(stats.matchSpeedUSD)}<span style="font-size:0.7em; opacity:0.5">/s</span></div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="margin-bottom: 3px;"><span class="tippy-header" data-tippy-content="Chênh lệch giá Mua/Bán (%)." style="font-size: 0.55rem; color: #848e9c; font-weight: 600;">SPREAD</span></div>
                        <div id="stat-spread-${stats.contract}" class="radar-dyn-val" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; line-height: 1;">${stats.spreadVal.toFixed(2)}%</div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 4px 10px; background: rgba(0,0,0,0.4); border-bottom: 1px solid #2b3139; font-size: 0.65rem; font-family: 'Rajdhani', sans-serif; font-weight: bold; text-transform: uppercase;">
                    <div>
                        🌊 <span class="tippy-header" data-tippy-content="Dòng tiền chủ động 60s">FLOW</span>: <span id="stat-flow-${stats.contract}" style="font-size: 0.8rem;">---</span>
                    </div>
                    <div>
                        ⚡ <span class="tippy-header" data-tippy-content="Gia tốc giá 9s">TREND</span>: <span id="stat-trend-${stats.contract}" style="font-size: 0.8rem;">---</span>
                    </div>
                </div>

                <div class="radar-chart-container" style="position: relative; height: 100px; width: 100%; margin-top: 0px;">
                    <div style="position: absolute; top: 4px; left: 8px; z-index: 5; pointer-events: none; opacity: 0.8; text-align: left;">
                        <span class="tippy-header" data-tippy-content="Khối lượng giao dịch ghi nhận trong ngày hôm nay." style="font-size: 0.6rem; color: #555; font-weight: 800; text-transform:uppercase; font-family: 'Rajdhani', sans-serif; pointer-events: auto;">DAILY VOL (Limit): </span>
                        <span id="stat-daily-${stats.contract}" class="radar-dyn-val" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.65rem;">${this.formatKMB(stats.dailyVolUTC)}</span>
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


// =========================================
// SMART ROI CALCULATOR LOGIC
// =========================================
let currentRoiStrategy = 'limit'; // Default
let selectedRoiToken = null;

function toggleRoiSidebar() {
    const sidebar = document.getElementById('roi-sidebar');
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
        populateRoiTokens();
    }
}

// Bắt sự kiện chuyển Tab để hiện/ẩn nút Máy tính (Chỉ hiện ở Competition)
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if (originalSwitchTab) originalSwitchTab(tabId);
    document.getElementById('btn-roi-trigger').style.display = (tabId === 'comp') ? 'flex' : 'none';
};

function setRoiStrategy(type) {
    currentRoiStrategy = type;
    document.getElementById('roi-btn-limit').classList.remove('active');
    document.getElementById('roi-btn-market').classList.remove('active');
    document.getElementById(`roi-btn-${type}`).classList.add('active');
    calculateRoi();
}

function populateRoiTokens() {
    const select = document.getElementById('roi-token-select');
    select.innerHTML = '<option value="">-- Select Active Token --</option>';
    
    // Lấy danh sách token đang chạy (không phải upcoming/ended)
    if (!appData || !appData.running) return;
    appData.running.forEach(c => {
        let opt = document.createElement('option');
        opt.value = c.db_id || c.alphaId;
        opt.text = c.name + (c.market_analysis && c.market_analysis.price ? ` ($${c.market_analysis.price.toFixed(4)})` : '');
        select.appendChild(opt);
    });
}

function roiHandleTokenChange() {
    const tokenId = document.getElementById('roi-token-select').value;
    const tierSelect = document.getElementById('roi-tier-select');
    tierSelect.innerHTML = '<option value="">-- Select Reward Tier --</option>';
    selectedRoiToken = null;

    if (!tokenId) { calculateRoi(); return; }

    selectedRoiToken = appData.running.find(c => (c.db_id === tokenId || c.alphaId === tokenId));
    if (!selectedRoiToken) return;

    // Load Tiers Dropdown
    if (selectedRoiToken.rewardType === 'tiered' && selectedRoiToken.tiers_data) {
        selectedRoiToken.tiers_data.forEach(t => {
            let opt = document.createElement('option');
            opt.value = t.reward;
            opt.text = `Rank ${t.rank} (Reward: ${t.reward} ${selectedRoiToken.name})`;
            tierSelect.appendChild(opt);
        });
    } else {
        let rQty = parseFloat(selectedRoiToken.rewardQty || 0);
        let opt = document.createElement('option');
        opt.value = rQty;
        opt.text = `Top ${selectedRoiToken.topWinners || 'Win'} (Reward: ${rQty} ${selectedRoiToken.name})`;
        tierSelect.appendChild(opt);
        tierSelect.value = rQty; // Auto select if only 1 option
    }

    // Load Strategy Info (Fee & Rule)
    let feeRate = (selectedRoiToken.chain && selectedRoiToken.chain.toLowerCase() === 'bsc') ? 0.01 : 0.15;
    let spreadRate = (selectedRoiToken.market_analysis && selectedRoiToken.market_analysis.spread) ? parseFloat(selectedRoiToken.market_analysis.spread) : 0.05; // Fallback 0.05%
    
    document.getElementById('roi-fee-rate').innerText = `${feeRate}%`;
    document.getElementById('roi-spread-rate').innerText = `${spreadRate.toFixed(2)}%`;
    document.getElementById('roi-rule-badge').innerText = selectedRoiToken.ruleType === 'buy_only' ? 'Buy Only ⚠️' : 'Buy + Sell';
    document.getElementById('roi-rule-badge').className = `badge ${selectedRoiToken.ruleType === 'buy_only' ? 'bg-danger' : 'bg-success'}`;
    document.getElementById('roi-token-price').innerText = selectedRoiToken.market_analysis?.price?.toFixed(4) || '0';

    calculateRoi();
}

function calculateRoi() {
    if (!selectedRoiToken) return resetRoiDisplay();

    let targetVol = parseFloat(document.getElementById('roi-target-vol').value || 0);
    let myVol = parseFloat(document.getElementById('roi-my-vol').value || 0);
    let rewardTokenQty = parseFloat(document.getElementById('roi-tier-select').value || 0);

    let gap = Math.max(0, targetVol - myVol);
    document.getElementById('roi-gap-display').innerText = `Gap: $${gap.toLocaleString()}`;

    if (gap === 0 && rewardTokenQty === 0) return resetRoiDisplay();

    // 1. Calculate Required Trade Size
    let multiplier = (currentRoiStrategy === 'limit' && selectedRoiToken.alphaType === 'x4') ? 4 : 1;
    let tradeSize = gap / multiplier;

    // 2. Calculate Costs (Fee + Spread)
    let feeRate = (selectedRoiToken.chain && selectedRoiToken.chain.toLowerCase() === 'bsc') ? 0.0001 : 0.0015; // 0.01% = 0.0001
    let spreadRate = (selectedRoiToken.market_analysis && selectedRoiToken.market_analysis.spread) ? (selectedRoiToken.market_analysis.spread / 100) : 0;
    
    let costPerTrade = feeRate + spreadRate;
    // Nếu giải Buy_Only, bạn phải Bán để thu hồi vốn => Tốn 2 lần phí (Mua + Bán) để cày 1 Vol
    let loops = selectedRoiToken.ruleType === 'buy_only' ? 2 : 1; 
    let totalCost = tradeSize * costPerTrade * loops;

    // 3. Calculate Reward
    let price = selectedRoiToken.market_analysis?.price || 0;
    let rewardValueUSD = rewardTokenQty * price;

    // 4. Net ROI
    let netRoi = rewardValueUSD - totalCost;

    // Hiển thị UI
    document.getElementById('roi-res-trade').innerText = `$${tradeSize.toLocaleString(undefined, {maximumFractionDigits:0})}`;
    document.getElementById('roi-res-cost').innerText = `-$${totalCost.toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('roi-res-reward').innerText = `+$${rewardValueUSD.toLocaleString(undefined, {maximumFractionDigits:2})}`;
    
    let roiEl = document.getElementById('roi-res-net');
    roiEl.innerText = `${netRoi > 0 ? '+' : ''}$${netRoi.toLocaleString(undefined, {maximumFractionDigits:2})}`;
    roiEl.style.color = netRoi > 0 ? '#00F0FF' : '#ff4d4f';

    // Lời khuyên
    let adviceBox = document.getElementById('roi-advice-box');
    adviceBox.style.display = 'block';
    if (netRoi > 0) {
        adviceBox.innerHTML = `<span class="text-success"><i class="fas fa-check-circle me-1"></i>Đánh giá vị thế:</span> Chênh lệch phí và giải thưởng đang dương. R/R rất hấp dẫn. Tuy nhiên hãy dự phòng rủi ro sụt giá Token.`;
    } else {
        adviceBox.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-triangle me-1"></i>Cảnh báo vị thế:</span> Chi phí giao dịch đang cao hơn giá trị phần thưởng. Cày thêm sẽ bị ÂM. Khuyên bạn nên duy trì hoặc bỏ qua!`;
    }
}

function resetRoiDisplay() {
    document.getElementById('roi-res-trade').innerText = '$0';
    document.getElementById('roi-res-cost').innerText = '-$0';
    document.getElementById('roi-res-reward').innerText = '+$0';
    document.getElementById('roi-res-net').innerText = '$0';
    document.getElementById('roi-res-net').style.color = '#666';
    document.getElementById('roi-advice-box').style.display = 'none';
}
