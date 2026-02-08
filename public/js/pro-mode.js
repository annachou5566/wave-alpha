const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let currentPage = 1;
let rowsPerPage = 20;
let pinnedTokens = JSON.parse(localStorage.getItem('alpha_pins')) || [];
let sortConfig = { key: null, dir: null };

let currentFilter = 'ALL';
let filterPoints = false;


document.addEventListener('DOMContentLoaded', () => {
    
    if (!document.querySelector('meta[name="referrer"]')) {
        const meta = document.createElement('meta');
        meta.name = "referrer";
        meta.content = "no-referrer";
        document.head.appendChild(meta);
    }

    
    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    
    
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        document.body.appendChild(modal);
    }); 
   
    injectLayout();

    
    const savedTab = localStorage.getItem('wave_main_tab') || 'alpha'; 
    window.pluginSwitchTab(savedTab, true);
    
    initMarket();
    setupEvents();
});




function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    
    let stats = {
        totalScan: allTokens.length,
        countActive: 0,
        countSpot: 0,
        countDelisted: 0,
        alphaDailyTotal: 0,
        alphaDailyLimit: 0,
        alphaDailyChain: 0,
        alphaRolling24h: 0,
        gainers: 0,
        losers: 0,
        
        distribList: {
            up_0_2: [], up_2_4: [], up_4_6: [], up_6_8: [], up_8: [],
            down_0_2: [], down_2_4: [], down_4_6: [], down_6_8: [], down_8: []
        },
        maxDistribCount: 0,
        topVolTokens: []
    };

    let tempVolList = [];

    allTokens.forEach(t => {
        const status = getTokenStatus(t);

        
        if (status === 'SPOT') {
            stats.countSpot++;
        } else if (status === 'DELISTED') {
            stats.countDelisted++;
        } else {
            
            
            
            stats.countActive++;
            const v = t.volume || {};
            stats.alphaDailyTotal += (v.daily_total || 0);
            stats.alphaDailyLimit += (v.daily_limit || 0);
            stats.alphaDailyChain += (v.daily_onchain || 0);
            stats.alphaRolling24h += (v.rolling_24h || 0);

            
            if ((v.daily_total || 0) > 0) {
                tempVolList.push(t);
            }

            
            const chg = t.change_24h || 0;
            if (chg >= 0) stats.gainers++;
            else stats.losers++;
            
            const abs = Math.abs(chg);

            
            if (chg >= 0) {
                if (abs >= 8) stats.distribList.up_8.push(t.symbol);
                else if (abs >= 6) stats.distribList.up_6_8.push(t.symbol);
                else if (abs >= 4) stats.distribList.up_4_6.push(t.symbol);
                else if (abs >= 2) stats.distribList.up_2_4.push(t.symbol);
                else stats.distribList.up_0_2.push(t.symbol);
            } else {
                if (abs >= 8) stats.distribList.down_8.push(t.symbol);
                else if (abs >= 6) stats.distribList.down_6_8.push(t.symbol);
                else if (abs >= 4) stats.distribList.down_4_6.push(t.symbol);
                else if (abs >= 2) stats.distribList.down_2_4.push(t.symbol);
                else stats.distribList.down_0_2.push(t.symbol);
            }
            
            
        } 
    }); 

    
    tempVolList.sort((a, b) => (b.volume?.daily_total || 0) - (a.volume?.daily_total || 0));
    stats.topVolTokens = tempVolList.slice(0, 10);

    
    const d = stats.distribList;
    stats.maxDistribCount = Math.max(
        d.up_8.length, d.up_6_8.length, d.up_4_6.length, d.up_2_4.length, d.up_0_2.length,
        d.down_0_2.length, d.down_2_4.length, d.down_4_6.length, d.down_6_8.length, d.down_8.length, 1
    );

    
    renderMarketHUD(stats);

    
    renderTableRows(tbody);
}


function renderTableRows(tbody) {
    let list = allTokens.filter(t => {
        const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
        const matchSearch = (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term));
        if (!matchSearch) return false;
        if (currentFilter === 'FAV') {
             return pinnedTokens.includes(t.symbol);
        }
        const status = getTokenStatus(t);
        if (currentFilter !== 'ALL' && status !== currentFilter) return false;
        if (filterPoints && (t.mul_point || 1) <= 1) return false;
        return true;
    });

    list.sort((a, b) => {
        const pinA = pinnedTokens.includes(a.symbol);
        const pinB = pinnedTokens.includes(b.symbol);
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;

        const statusA = getTokenStatus(a);
        const statusB = getTokenStatus(b);
        const isBottomA = (statusA === 'SPOT' || statusA === 'DELISTED' || statusA === 'PRE_DELISTED');
        const isBottomB = (statusB === 'SPOT' || statusB === 'DELISTED' || statusB === 'PRE_DELISTED');

        if (!isBottomA && isBottomB) return -1;
        if (isBottomA && !isBottomB) return 1;

        if (sortConfig.key && sortConfig.dir) {
            let key = sortConfig.key;
            if (key === 'price') key = 'change_24h'; 

            const valA = getVal(a, key);
            const valB = getVal(b, key);
            return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
        }

        return 0;
    });

    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    if (currentPage < 1) currentPage = 1;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
    const pageList = list.slice(startIndex, endIndex);

    if(document.getElementById('page-start')) document.getElementById('page-start').innerText = totalItems > 0 ? startIndex + 1 : 0;
    if(document.getElementById('page-end')) document.getElementById('page-end').innerText = endIndex;
    if(document.getElementById('total-tokens')) document.getElementById('total-tokens').innerText = totalItems;
    if(document.getElementById('page-num')) document.getElementById('page-num').innerText = `Page ${currentPage} / ${totalPages || 1}`;
    document.getElementById('btn-prev').disabled = currentPage === 1;
    document.getElementById('btn-next').disabled = currentPage >= totalPages;

    pageList.forEach((t, index) => {
        const tr = document.createElement('tr');
        const realIndex = startIndex + index + 1;
        const status = getTokenStatus(t);
        let startBadges = [];
        if (t.onlineTge) startBadges.push('<span class="smart-badge badge-tge">TGE</span>');
        if (t.onlineAirdrop) startBadges.push('<span class="smart-badge badge-airdrop">AIR</span>');
        let journeyHtml = startBadges.join(' ');
        if (status === 'SPOT') {
            let endBadge = '<span class="smart-badge badge-spot">SPOT</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        } else if (status === 'DELISTED' || status === 'PRE_DELISTED') {
            let endBadge = '<span class="smart-badge badge-delisted">DELIST</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        }
        const now = Date.now();
        let mulBadgeHtml = '';
        if (!t.offline && t.listing_time && t.mul_point > 1) {
            const expiryTime = t.listing_time + 2592000000;
            const diffDays = Math.ceil((expiryTime - now) / 86400000);
            if (diffDays > 0) {
                const badgeClass = (t.chain === 'BSC') ? 'badge-bsc' : 'badge-alpha';
                mulBadgeHtml = `<span class="smart-badge ${badgeClass}">x${t.mul_point} ${diffDays}d</span>`;
            }
        }
        const maxVolPage = Math.max(...pageList.map(i => i.volume.daily_total || 0)) || 1;
        const volPct = ((t.volume.daily_total || 0) / maxVolPage) * 100;
        const isUp = t.change_24h >= 0;
        const absChg = Math.abs(t.change_24h);
        let opacityStart = 0.15;
        let opacityEnd = 0.02;
        if (absChg >= 20) { opacityStart = 0.5; opacityEnd = 0.1; }
        else if (absChg >= 10) { opacityStart = 0.3; opacityEnd = 0.05; }
        const rgb = isUp ? '34, 171, 148' : '246, 70, 93';
        const cellStyle = `background: linear-gradient(90deg, rgba(${rgb}, ${opacityStart}) 0%, rgba(${rgb}, ${opacityEnd}) 100%) !important;`;
        const textColorClass = isUp ? 'text-green' : 'text-red';
        const sign = isUp ? '+' : '';
        
        tr.innerHTML = `
            <td class="text-center col-fix-1">
                <i class="${pinnedTokens.includes(t.symbol) ? 'fas fa-star text-brand' : 'far fa-star text-secondary'} star-icon" onclick="window.togglePin('${t.symbol}')"></i>
                <div style="font-size:9px; color:#555; margin-top:4px;">${realIndex}</div>
            </td>
            <td class="col-fix-2">
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${t.icon || 'assets/tokens/default.png'}" class="token-logo" onerror="this.src='assets/tokens/default.png'">
                        ${t.chain_icon ? `<img src="${t.chain_icon}" class="chain-badge">` : ''}
                    </div>
                    <div class="token-meta-container" style="display:block;">
                         <div class="symbol-row">
                            <span class="symbol-text">${t.symbol}</span>
                            ${mulBadgeHtml}
                        </div>
                        <div class="contract-row text-secondary" onclick="window.pluginCopy('${t.contract}')" style="cursor:pointer; font-size:11px;">
                            ${t.name || t.contract?.substring(0,6)}
                        </div>
                    </div>
                </div>
            </td>
            <td class="text-center status-col">
                <div class="status-badge-wrapper">${journeyHtml}</div>
                ${t.listing_time ? `<div class="journey-date-center"><i class="far fa-clock"></i> ${new Date(t.listing_time).toLocaleDateString('en-GB')}</div>` : ''}
            </td>
            <td class="text-center" style="${cellStyle}">
                <div class="text-primary-val" style="font-weight:700; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">$${formatPrice(t.price)}</div>
                <div class="${textColorClass}" style="font-size:11px; font-weight:700; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                    ${sign}${t.change_24h}%
                </div>
            </td>
            <td class="chart-cell" style="padding: 5px 10px; overflow: hidden; max-width: 100px; width: 100px;">
                ${getSparklineSVG(t.chart)}
            </td>
            <td class="text-end font-num">
                <div class="vol-cell-group">
                    <span class="text-primary-val">$${formatNum(t.volume.daily_total)}</span>
                    <div class="vol-bar-bg"><div class="vol-bar-fill" style="width:${volPct}%"></div></div>
                </div>
            </td>
            <td class="text-end font-num text-secondary-val">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end font-num text-secondary-val">$${formatNum(t.volume.daily_onchain)}</td>
            <td class="text-end font-num text-secondary-val">
                 $${formatNum(t.volume.rolling_24h)}
            </td>
            <td class="text-end font-num text-secondary-val">${formatInt(t.tx_count)}</td>
            <td class="text-end font-num text-secondary-val">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
    if (pageList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-secondary">No data found matching filters.</td></tr>';
    }
}




function renderMarketHUD(stats) {
    const view = document.getElementById('alpha-market-view');
    if (!view || !view.querySelector('.alpha-container')) return;
    const container = view.querySelector('.alpha-container'); 
    
    let hud = document.getElementById('market-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'market-hud';
        hud.className = 'market-hud-container';
        container.insertBefore(hud, container.firstChild);
    }

    let updateTime = "Waiting...";
    const timeEl = document.getElementById('last-updated');
    if (timeEl && timeEl.innerText.includes('Updated:')) {
        updateTime = timeEl.innerText.replace('Updated: ', '').trim();
    } else {
        updateTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    let activeTokens = allTokens.filter(t => {
        const s = getTokenStatus(t);
        return s !== 'SPOT' && s !== 'DELISTED' && s !== 'PRE_DELISTED';
    });
    activeTokens.sort((a, b) => (b.volume.rolling_24h || 0) - (a.volume.rolling_24h || 0));
    const top10Rolling = activeTokens.slice(0, 10);
    const maxVolRolling = top10Rolling[0] ? (top10Rolling[0].volume.rolling_24h || 1) : 1;
    
    const volTop10Sum = top10Rolling.reduce((sum, t) => sum + (t.volume.rolling_24h || 0), 0);
    const totalRolling = stats.alphaRolling24h || 1;
    const domPct = (volTop10Sum / totalRolling) * 100;

    let dailyTokens = [...stats.topVolTokens].sort((a, b) => (b.volume.daily_total || 0) - (a.volume.daily_total || 0));
    const top10Daily = dailyTokens.slice(0, 10);
    const maxVolDaily = top10Daily[0] ? (top10Daily[0].volume.daily_total || 1) : 1;

    const volDailyTop10Sum = top10Daily.reduce((sum, t) => sum + (t.volume.daily_total || 0), 0);
    const totalDaily = stats.alphaDailyTotal || 1;
    const dailyDomPct = (volDailyTop10Sum / totalDaily) * 100;

    const formatNumK = (num) => {
        if(num >= 1000000) return (num/1000000).toFixed(1) + 'M';
        if(num >= 1000) return (num/1000).toFixed(0) + 'K';
        return num;
    };

    let validForTrend = allTokens.filter(t => !t.offline && t.price > 0);
    let topGainers = [...validForTrend].sort((a, b) => b.change_24h - a.change_24h).slice(0, 3);
    let topLosers = [...validForTrend].sort((a, b) => a.change_24h - b.change_24h).slice(0, 3);

    const renderTrendItem = (t, type) => {
        if (!t) return '';
        const colorClass = type === 'gain' ? 'text-green' : 'text-red';
        const arrow = type === 'gain' ? '▲' : '▼';
        return `
            <div class="trend-item">
                <div class="trend-symbol">
                    <img src="${t.icon || 'assets/tokens/default.png'}" onerror="this.src='assets/tokens/default.png'">
                    <span>${t.symbol}</span>
                </div>
                <div class="trend-info">
                    <div class="trend-price">$${formatPrice(t.price)}</div>
                    <div class="trend-chg ${colorClass}">${arrow}${Math.abs(t.change_24h)}%</div>
                </div>
            </div>
        `;
    };

    const renderRow = (t, idx, type) => {
        if (!t) return '';
        
        let barHtml = '';
        let volDisplay = 0;
        let pctWidth = 0;
        
        const dataAttrs = `
            data-symbol="${t.symbol}"
            data-total="${formatNum(t.volume.daily_total)}"
            data-limit="${formatNum(t.volume.daily_limit)}"
            data-chain="${formatNum(t.volume.daily_onchain)}"
        `;
        
        const tooltipEvents = `
            onmouseenter="window.showTooltip(event, this)" 
            onmousemove="window.moveTooltip(event)" 
            onmouseleave="window.hideTooltip()"
        `;

        if (type === 'ROLLING') {
            volDisplay = t.volume.rolling_24h || 0;
            pctWidth = (volDisplay / maxVolRolling) * 100;
            barHtml = `<div class="hud-bar-fill" style="width:100%; height:100%; background:#5E6673;"></div>`;
        } else {
            volDisplay = t.volume.daily_total || 0;
            pctWidth = (volDisplay / maxVolDaily) * 100;
            const vLimit = t.volume.daily_limit || 0;
            const vChain = t.volume.daily_onchain || 0;
            const pLimit = volDisplay > 0 ? (vLimit / volDisplay) * 100 : 0;
            const pChain = volDisplay > 0 ? (vChain / volDisplay) * 100 : 0;
            
            barHtml = `
                <div style="width:100%; height:100%; display:flex; border-radius: 0 3px 3px 0; overflow:hidden;">
                    <div style="width:${pLimit}%; height:100%; background:#F0B90B;"></div>
                    <div style="width:${pChain}%; height:100%; background:#9945FF;"></div>
                </div>
            `;
        }

        return `
            <div class="hud-list-row" ${dataAttrs} ${tooltipEvents} style="cursor:pointer">
                <div class="hud-list-idx">#${idx}</div>
                <div class="hud-list-name" title="${t.symbol}">${t.symbol}</div>
                <div class="hud-bar-wrapper">
                    <div style="width:${pctWidth}%; height:15px;"> ${barHtml}</div>
                    <div class="hud-list-val">$${formatNumK(volDisplay)}</div>
                </div>
            </div>
        `;
    };

    const d = stats.distribList;
    const drawSentBar = (listTokens, label, colorClass) => {
        const count = listTokens.length;
        let h = (count / stats.maxDistribCount) * 100; 
        if (count > 0 && h < 5) h = 5;
        const tokensStr = listTokens.join(', '); 
        
        return `
            <div class="distrib-bar-item" 
                 onclick="window.showListTooltip(event, '${label}', '${tokensStr}')"
                 onmouseenter="window.showListTooltip(event, '${label}', '${tokensStr}')"
                 onmouseleave="window.hideTooltip()">
                 ${count > 0 ? `<div style="font-size:8px; font-weight:bold; color:#fff; margin-bottom:2px; text-align:center; width:100%">${count}</div>` : ''}
                 <div style="width:100%; height:${h}%; border-radius:1px;" class="${colorClass}"></div>
            </div>
        `;
    };

    const pctActive = stats.totalScan > 0 ? (stats.countActive / stats.totalScan) * 100 : 0;
    const pctSpot = stats.totalScan > 0 ? (stats.countSpot / stats.totalScan) * 100 : 0;
    const pctDelist = stats.totalScan > 0 ? (stats.countDelisted / stats.totalScan) * 100 : 0;

    hud.innerHTML = `
        <div class="hud-card">
            <div class="hud-title" style="margin-bottom:0px">MARKET LIFECYCLE</div>
            
            <div style="font-family:var(--font-num); font-size:20px; font-weight:700; color:#fff; margin-bottom:8px; display:flex; align-items:baseline; gap:4px;">
                ${stats.totalScan} 
                <span style="font-size:11px; color:#5E6673; font-weight:600; font-family:var(--font-main);">Listings</span>
            </div>
            
            <div style="display:flex; width:100%; height:24px; background:#1e2329; border-radius:4px; overflow:hidden; margin-bottom:12px; margin-top:5px; font-family:var(--font-num); font-weight:700; font-size:11px; letter-spacing:0.5px;">
                <div style="width:${pctActive}%; background:#0ecb81; color:#000; display:flex; align-items:center; justify-content:center; white-space:nowrap; overflow:hidden;">
                    ${pctActive > 5 ? `${stats.countActive} LIVE` : ''} 
                </div>
                <div style="width:${pctSpot}%; background:#F0B90B; color:#000; display:flex; align-items:center; justify-content:center; white-space:nowrap; overflow:hidden; border-left:1px solid rgba(0,0,0,0.1);">
                    ${pctSpot > 5 ? `${stats.countSpot} SPOT` : ''}
                </div>
                <div style="width:${pctDelist}%; background:#f6465d; color:#fff; display:flex; align-items:center; justify-content:center; white-space:nowrap; overflow:hidden; border-left:1px solid rgba(0,0,0,0.1);">
                    ${pctDelist > 5 ? `${stats.countDelisted} DEAD` : ''}
                </div>
            </div>

            <div class="hud-title" style="border-top:1px solid rgba(255,255,255,0.05); padding-top:10px; margin-bottom:2px;">
                24H PRICE ACTION
            </div>
            
            <div class="trend-grid-inner">
                <div class="trend-col">
                    ${topLosers.map(t => renderTrendItem(t, 'lose')).join('')}
                </div>
                <div class="trend-col">
                    ${topGainers.map(t => renderTrendItem(t, 'gain')).join('')}
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700; margin-bottom:8px; font-family:var(--font-num);">
                <div style="color:#f6465d">▼ ${stats.losers} LOSERS</div>
                <div style="color:#0ecb81">${stats.gainers} GAINERS ▲</div>
            </div>

            <div class="distrib-container">
                <div class="distrib-side red">
                    ${drawSentBar(d.down_8, '>8%', 'bg-red-5')}
                    ${drawSentBar(d.down_6_8, '6-8%', 'bg-red-4')}
                    ${drawSentBar(d.down_4_6, '4-6%', 'bg-red-3')}
                    ${drawSentBar(d.down_2_4, '2-4%', 'bg-red-2')}
                    ${drawSentBar(d.down_0_2, '0-2%', 'bg-red-1')}
                </div>
                <div class="distrib-side green">
                    ${drawSentBar(d.up_0_2, '0-2%', 'bg-green-1')}
                    ${drawSentBar(d.up_2_4, '2-4%', 'bg-green-2')}
                    ${drawSentBar(d.up_4_6, '4-6%', 'bg-green-3')}
                    ${drawSentBar(d.up_6_8, '6-8%', 'bg-green-4')}
                    ${drawSentBar(d.up_8, '>8%', 'bg-green-5')}
                </div>
            </div>
            
            <div class="distrib-label-row">
                <div class="distrib-label-side red">
                    <div class="distrib-label">>8%</div>
                    <div class="distrib-label">6-8%</div>
                    <div class="distrib-label">4-6%</div>
                    <div class="distrib-label">2-4%</div>
                    <div class="distrib-label">0-2%</div>
                </div>
                <div class="distrib-label-side green">
                    <div class="distrib-label">0-2%</div>
                    <div class="distrib-label">2-4%</div>
                    <div class="distrib-label">4-6%</div>
                    <div class="distrib-label">6-8%</div>
                    <div class="distrib-label">>8%</div>
                </div>
            </div>
        </div>

        <div class="hud-card">
            <div class="hud-title">ROLLING VOL 24H</div>
            <div class="hud-main-value" style="font-size:22px; color:#eaecef; margin-bottom:5px;">
                $${formatNum(stats.alphaRolling24h)}
            </div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                <div style="flex:1; height:4px; background:#2b3139; border-radius:2px;">
                    <div style="width:${domPct}%; height:100%; background:#eaecef; border-radius:2px;"></div>
                </div>
                <div style="font-size:9px; color:#848E9C; white-space:nowrap;">TOP 10: <span style="color:#fff">${domPct.toFixed(0)}%</span></div>
            </div>
            
            <div class="hud-sub-stat-row spacer"></div>

            <div class="hud-list-container">
                ${top10Rolling.map((t, i) => renderRow(t, i+1, 'ROLLING')).join('')}
            </div>
        </div>

        <div class="hud-card">
            <div class="hud-title" style="display:flex; align-items:center;">
                DAILY VOL (UTC +0) 
                <span class="update-badge">${lastDataUpdateTime}</span>
            </div>
            <div class="hud-main-value" style="font-size:22px; color:#eaecef; margin-bottom:5px;">
                $${formatNum(stats.alphaDailyTotal)}
            </div>
             <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                <div style="flex:1; height:4px; background:#2b3139; border-radius:2px;">
                    <div style="width:${dailyDomPct}%; height:100%; background:#eaecef; border-radius:2px;"></div>
                </div>
                <div style="font-size:9px; color:#848E9C; white-space:nowrap;">TOP 10: <span style="color:#fff">${dailyDomPct.toFixed(0)}%</span></div>
            </div>
            
            <div class="hud-sub-stat-row">
                <div style="color:#F0B90B;">● LIMIT: $${formatNumK(stats.alphaDailyLimit)}</div>
                <div style="color:#9945FF;">● CHAIN: $${formatNumK(stats.alphaDailyChain)}</div>
            </div>

            <div class="hud-list-container">
                ${top10Daily.map((t, i) => renderRow(t, i+1, 'DAILY')).join('')}
            </div>
        </div>
    `;
}




window.showTooltip = function(e, el) {
    const t = document.getElementById('hud-tooltip');
    if(t && el.dataset.symbol) {
        
        const { symbol, total, limit, chain } = el.dataset;

        t.style.display = 'block';
        t.innerHTML = `
            <div style="color:#fff; font-size:16px; font-weight:bold; margin-bottom:6px; border-bottom:1px solid #333; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                ${symbol}
                <span style="font-size:10px; background:#2b3139; padding:2px 4px; border-radius:3px; color:#848e9c">VOL RANK</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; color:#eaecef;">
                <span>Daily Vol:</span> <span style="font-weight:bold;">$${total}</span>
            </div>
            <div style="height:1px; background:#333; margin:4px 0;"></div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;">
                <span style="color:#F0B90B">● Limit:</span> <span style="color:#F0B90B; font-weight:bold;">$${limit}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px;">
                <span style="color:#00F0FF">● On-Chain:</span> <span style="color:#00F0FF; font-weight:bold;">$${chain}</span>
            </div>
        `;
        window.moveTooltip(e);
    }
};

window.moveTooltip = function(e) {
    const t = document.getElementById('hud-tooltip');
    if(t) {
        
        t.style.left = (e.clientX) + 'px';
        t.style.top = (e.clientY) + 'px';
    }
};

window.hideTooltip = function() {
    const t = document.getElementById('hud-tooltip');
    if(t) t.style.display = 'none';
};


function injectLayout() {
    document.getElementById('alpha-tab-nav')?.remove();
    document.getElementById('alpha-market-view')?.remove();
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    const tabNav = document.createElement('div');
    tabNav.id = 'alpha-tab-nav';
    tabNav.innerHTML = `
        <button id="btn-tab-alpha" class="tab-btn" onclick="window.pluginSwitchTab('alpha')">ALPHA MARKET</button>
        <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">COMPETITION</button>
    `;
    navbar.insertAdjacentElement('afterend', tabNav);
    const marketView = document.createElement('div');
    marketView.id = 'alpha-market-view';
    marketView.style.display = 'none';
    marketView.innerHTML = `
        <div class="alpha-container">
            <div class="alpha-header">
                 <div class="filter-group">
                    <button class="filter-btn active-all" id="btn-f-all" onclick="setFilter('ALL')">All</button>
                    <button class="filter-btn" id="btn-f-alpha" onclick="setFilter('ALPHA')">Alpha</button>
                    <button class="filter-btn" id="btn-f-spot" onclick="setFilter('SPOT')">Spot</button>
                    <button class="filter-btn" id="btn-f-delist" onclick="setFilter('DELISTED')">Delisted</button>
                    <button class="filter-btn" id="btn-f-fav" onclick="setFilter('FAV')">★ Favorites</button>
                    <button class="filter-btn points-btn" id="btn-f-points" onclick="togglePoints()">Points +</button>
                </div>
                <div class="search-group">
                    <i class="fas fa-search search-icon-small"></i>
                    <input type="text" id="alpha-search" placeholder="Search Token / Contract..." autocomplete="off">
                </div>
            </div>
            <div class="table-responsive">
                <table class="alpha-table">
                    <thead>
                        <tr class="h-top">
                            <th rowspan="2" class="text-center col-fix-1">#</th>
                            <th rowspan="2" class="col-fix-2">TOKEN INFO</th>
                            <th rowspan="2" class="text-center">STATUS</th>
                            <th rowspan="2" class="text-center cursor-pointer" onclick="window.pluginSort('price')">PRICE (24h%)</th>
                            <th rowspan="2" class="text-center">CHART</th>
                            <th colspan="3" class="text-center th-group-vol">DAILY VOLUME (UTC)</th>
                            <th colspan="3" class="text-center th-group-stats">MARKET STATS (24h)</th>
                        </tr>
                        <tr class="h-sub">
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_total')">TOTAL</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_limit')">LIMIT</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_onchain')">ON-CHAIN</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.rolling_24h')">VOL 24H</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('tx_count')">TXs</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('liquidity')">LIQ</th>
                        </tr>
                    </thead>
                    <tbody id="market-table-body"></tbody>
                </table>
            </div>
            <div class="pagination-container">
    <div class="footer-left">
        Showing <span id="page-start">0</span>-<span id="page-end">0</span> of <span id="total-tokens">0</span> tokens
    </div>
    
    <div class="footer-center">
        Rows: 
        <select id="rows-per-page" onchange="window.changeRows(this.value)">
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
        </select>
    </div>

    <div class="footer-right">
        <button id="btn-prev" class="page-btn" onclick="window.prevPage()">&lt;</button>
        <span id="page-num">Page 1 / 1</span>
        <button id="btn-next" class="page-btn" onclick="window.nextPage()">&gt;</button>
    </div>
</div>
        </div>
    `;
    tabNav.insertAdjacentElement('afterend', marketView);
    let lastScrollY = window.scrollY;
    window.removeEventListener('scroll', window._smartScroll);
    window._smartScroll = function() {
        const currentScrollY = window.scrollY;
        const nav = document.getElementById('alpha-tab-nav');
        if (!nav) return;
        if (currentScrollY > lastScrollY && currentScrollY > 20) {
            nav.classList.add('nav-hidden');
        } else if (currentScrollY < lastScrollY) {
            nav.classList.remove('nav-hidden');
        }
        lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', window._smartScroll, { passive: true });
}




window.pluginSwitchTab = (tab, instant = false) => {
    localStorage.setItem('wave_main_tab', tab);
    const alphaView = document.getElementById('alpha-market-view');
    const compView = document.getElementById('view-dashboard'); 
    
    const btnA = document.getElementById('btn-tab-alpha');
    const btnC = document.getElementById('btn-tab-competition');

    if (tab === 'alpha') {
        btnA?.classList.add('active');
        btnC?.classList.remove('active');
        
        
        if(compView) compView.style.display = 'none';
        if(alphaView) alphaView.style.display = 'block';
    } else {
        btnC?.classList.add('active');
        btnA?.classList.remove('active');

        
        if(alphaView) alphaView.style.display = 'none';
        if(compView) compView.style.display = 'block';
    }
};


window.pluginSort = function(key) {
    if (sortConfig.key === key) {
        if (sortConfig.dir === 'desc') {
            sortConfig.dir = 'asc';
        } else if (sortConfig.dir === 'asc') {
            sortConfig.key = null;
            sortConfig.dir = null;
        } else {
            sortConfig.dir = 'desc';
        }
    } else {
        sortConfig.key = key;
        sortConfig.dir = 'desc';
    }
    renderTable();
};

window.pluginCopy = (txt) => { 
    if(txt) {
        navigator.clipboard.writeText(txt);
        const t = document.createElement('div');
        t.innerText = 'COPIED';
        t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00F0FF;color:#000;padding:6px 12px;font-weight:800;border-radius:4px;z-index:999999;box-shadow:0 0 10px #00F0FF;font-family:sans-serif;';
        document.body.appendChild(t);
        setTimeout(()=>t.remove(), 1500);
    }
};

async function initMarket() { await fetchMarketData(); setInterval(fetchMarketData, 60000); }


let lastDataUpdateTime = "Waiting...";

async function fetchMarketData() {
    try {
        
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const json = await res.json();
        
        
        const rawList = json.data || json.tokens || []; 
        allTokens = rawList.map(item => unminifyToken(item));

        
        let rawTime = json.meta ? json.meta.u : (json.last_updated || "");
        
        if (rawTime) {
            
            
            const d = new Date(rawTime.replace(' ', 'T')); 
            
            
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();

            lastDataUpdateTime = `${hours}:${mins} ${day}/${month}/${year}`;
        } else {
            
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            
            lastDataUpdateTime = `${hours}:${mins} ${day}/${month}/${year}`;
        }

        
        updateSummary();
        renderTable();

        
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) {
            timeLbl.innerText = 'Updated: ' + lastDataUpdateTime;
        }

    } catch (e) { 
        console.error("Data error:", e); 
    }
}



window.togglePin = (symbol) => {
    
    if (pinnedTokens.includes(symbol)) {
        pinnedTokens = pinnedTokens.filter(s => s !== symbol);
    } else {
        pinnedTokens.push(symbol);
    }
    
    localStorage.setItem('alpha_pins', JSON.stringify(pinnedTokens));
    
    renderTable();
};


function formatNum(n) {
    if (!n) return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }
function getVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }




function getTokenStatus(t) {
    
    if (t.status) {
        return t.status.toUpperCase();
    }

    
    
    if (t.offline) {
        if (t.listingCex) return 'SPOT';
        return 'DELISTED';
    }
    
    return 'ALPHA'; 
}

function updateSummary() {
    let total = allTokens.length;
    let spot = 0;
    let delisted = 0;
    let alpha = 0;

    allTokens.forEach(t => {
        
        const s = (t.status || '').toUpperCase();

        if (s === 'SPOT') {
            spot++;
        } else if (s === 'DELISTED' || s === 'PRE_DELISTED') {
            delisted++;
        } else {
            alpha++; 
        }
    });

    
    
    
    const elTotal = document.getElementById('stat-total-tokens');
    const elActive = document.getElementById('stat-active-tokens');
    const elSpot = document.getElementById('stat-spot-tokens');
    const elDelist = document.getElementById('stat-delisted-tokens');

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = alpha;
    if (elSpot) elSpot.innerText = spot;
    if (elDelist) elDelist.innerText = delisted;

    
    const elRate = document.getElementById('stat-spot-rate');
    if (elRate) {
        
        
        const rate = total > 0 ? ((spot / total) * 100).toFixed(1) : "0.0";
        elRate.innerText = `${rate}%`;
        
        
        if (parseFloat(rate) > 10) elRate.style.color = '#00ff88'; 
        else elRate.style.color = '#eaecef'; 
    }
}


window.toggleFilter = (filterType) => {
    
    if (currentFilter === filterType) {
        currentFilter = 'ALL';
    } else {
        currentFilter = filterType;
    }
    
    
    document.querySelectorAll('.summary-card').forEach(c => c.classList.remove('active-filter'));
    if (currentFilter === 'ALPHA') {
        document.getElementById('card-alpha-vol')?.classList.add('active-filter');
        document.getElementById('card-active')?.classList.add('active-filter');
    } else if (currentFilter === 'SPOT') {
        document.getElementById('card-spot')?.classList.add('active-filter');
    } else if (currentFilter === 'DELISTED') {
        document.getElementById('card-delist')?.classList.add('active-filter');
    }

    renderTable(); 
};


function getSparklineSVG(data) {
    if (!data || !Array.isArray(data) || data.length < 2) return '';

    const width = 100; 
    const height = 30; 
    
    let prices, volumes, maxV = 1;

    if (typeof data[0] === 'object') {
        prices = data.map(d => d.p);
        volumes = data.map(d => d.v);
        maxV = Math.max(...volumes) || 1;
    } else {
        prices = data;
        volumes = [];
    }

    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const rangeP = maxP - minP || 1;

    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#0ecb81' : '#f6465d'; 
    
    let points = prices.map((p, i) => {
        const x = (i / (prices.length - 1)) * width;
        const bottomPadding = volumes.length > 0 ? 8 : 0; 
        const y = (height - bottomPadding) - ((p - minP) / rangeP) * (height - bottomPadding - 4) - 2; 
        return `${x},${y}`;
    }).join(' ');

    let bars = '';
    if (volumes.length > 0) {
        const barWidth = (width / (data.length - 1)) * 0.6; 
        volumes.forEach((v, i) => {
            let barHeight = (v / maxV) * 8;
            if (barHeight < 1 && v > 0) barHeight = 1;
            const x = (i / (data.length - 1)) * width;
            const y = height - barHeight;
            bars += `<rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" opacity="0.3" />`;
        });
    }

    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="mini-chart" style="overflow:visible; display:block;">
            ${bars}
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    `;
}


window.setFilter = function(status) {
    currentFilter = status;
    currentPage = 1;
    ['all', 'alpha', 'spot', 'delist', 'fav'].forEach(k => {
        document.getElementById(`btn-f-${k}`)?.classList.remove(`active-${k}`);
        document.getElementById(`btn-f-${k}`)?.classList.remove('active');
    });
    if (status === 'ALL') document.getElementById('btn-f-all').classList.add('active-all');
    else if (status === 'ALPHA') document.getElementById('btn-f-alpha').classList.add('active-alpha');
    else if (status === 'SPOT') document.getElementById('btn-f-spot').classList.add('active-spot');
    else if (status === 'DELISTED') document.getElementById('btn-f-delist').classList.add('active-delist');
    else if (status === 'FAV') {
        const btn = document.getElementById('btn-f-fav');
        if(btn) {
             btn.classList.add('active');
             btn.style.color = '#F0B90B';
        }
    }
    renderTable();
};


window.togglePoints = function() {
    filterPoints = !filterPoints;
    const btn = document.getElementById('btn-f-points');
    
    if (filterPoints) {
        btn.classList.add('active-points');
    } else {
        btn.classList.remove('active-points');
    }
    renderTable();
};


const KEY_MAP_REVERSE = {
  "i": "id", "s": "symbol", "n": "name", "ic": "icon",
  "cn": "chain", "ci": "chain_icon", 
  "ct": "contract",
  "st": "status", "p": "price", "c": "change_24h", "mp": "mul_point", 
  "mc": "market_cap", "l": "liquidity", "v": "volume",
  "r24": "rolling_24h", "dt": "daily_total",
  "dl": "daily_limit", "do": "daily_onchain",
  "ch": "chart", "lt": "listing_time", "tx": "tx_count",
  "off": "offline", "cex": "listingCex",
  "tge": "onlineTge", "air": "onlineAirdrop"
};


function unminifyToken(minifiedItem) {
  const fullItem = {};
  for (const [shortKey, value] of Object.entries(minifiedItem)) {
    const fullKey = KEY_MAP_REVERSE[shortKey];
    
    
    if (fullKey === "volume" && typeof value === 'object') {
      fullItem[fullKey] = {};
      for (const [vKey, vVal] of Object.entries(value)) {
        fullItem[fullKey][KEY_MAP_REVERSE[vKey] || vKey] = vVal;
      }
    } 
    
    else if (fullKey) {
      fullItem[fullKey] = value;
    }
  }
  return fullItem;
}


window.showListTooltip = function(e, label, tokensStr) {
    const t = document.getElementById('hud-tooltip');
    if (!t) return;
    
    
    if(e.type === 'click') e.stopPropagation();

    if (!tokensStr) tokensStr = "No tokens";
    let displayStr = tokensStr;
    if (displayStr.length > 150) displayStr = displayStr.substring(0, 150) + "...";

    t.style.display = 'block';
    
    t.innerHTML = `
        <div style="color:#00F0FF; font-size:11px; font-weight:bold; margin-bottom:4px; border-bottom:1px solid #333; padding-bottom:2px;">
            PRICE RANGE: ${label}
        </div>
        <div style="color:#eaecef; font-size:10px; line-height:1.4; word-wrap:break-word;">
            ${displayStr}
        </div>
    `;
    
    
    const x = e.clientX;
    const y = e.clientY;
    
    
    t.style.left = (x + 10) + 'px';
    t.style.top = (y + 10) + 'px';
};

window.prevPage = function() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
};
window.nextPage = function() {
    currentPage++;
    renderTable();
};
window.changeRowsPerPage = function() {
    const select = document.getElementById('rows-per-page');
    if (select) {
        rowsPerPage = parseInt(select.value);
        currentPage = 1;
        renderTable();
    }
};

window.changeRows = function(val) {
    rowsPerPage = parseInt(val);
    currentPage = 1;
    renderTable();
};

