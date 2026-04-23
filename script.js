function formatCompact(num) {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(num);
}

function renderMultiplierPath(c) {
    let isEarlyBird = c.earlyBird || (c.data && c.data.earlyBird) || false;
    if (!c || !c.start || !isEarlyBird) return ''; 

    const multipliers = [1.4, 1.3, 1.2, 1.2, 1.1, 1.1, 1.0];

    let sTime = c.startTime || "13:00:00";
    if (sTime.length === 5) sTime += ":00";
    
    const now = new Date();
    const startTime = new Date(c.start + 'T' + sTime + 'Z');
    const diffMs = now - startTime;
    
    let elapsedDays = Math.max(0, diffMs / 86400000);
    let currentDayInt = Math.min(7, Math.floor(elapsedDays) + 1);
    let fillPct = Math.min(100, (elapsedDays / 6) * 100);
    
    const currentMul = multipliers[currentDayInt - 1];

    // Tính đếm ngược
    const nextBoundary = new Date(startTime.getTime() + currentDayInt * 86400000);
    const msLeft = nextBoundary - now;
    let countdownStr = '';
    
    if (msLeft > 0 && currentDayInt < 7) {
        const h = Math.floor(msLeft / 3600000);
        const m = Math.floor((msLeft % 3600000) / 60000);
        countdownStr = `${h}h ${m}m`;
    } else if (currentDayInt === 7) {
        countdownStr = 'Final';
    }

    // Icon chạy tùy theo tốc độ (vẫn giữ độ sinh động)
    let runnerIcon = 'fa-running'; 
    if (currentMul >= 1.3) runnerIcon = 'fa-skating'; 
    if (currentMul === 1.1) runnerIcon = 'fa-walking'; 
    if (currentDayInt === 7) runnerIcon = 'fa-flag-checkered'; 

    // Các mốc (dots)
    let dotsHtml = '';
    multipliers.forEach((mul, i) => {
        const d = i + 1;
        dotsHtml += `<div class="eb-dot ${d <= currentDayInt ? 'passed' : ''}" title="Ngày ${d}: ${mul}x"></div>`;
    });

    // LOGIC NHẢY CHỮ: Nếu icon chạy qua 60% thanh, chữ nhảy sang trái
    let alignClass = fillPct > 60 ? 'align-left' : 'align-right';

    return `
        <div class="eb-compact-container" title="Early Bird Boost">
            <div class="eb-mul">${currentMul}x</div>
            <div class="eb-track">
                <div class="eb-fill" style="width:${fillPct}%"></div>
                <div class="eb-dots">${dotsHtml}</div>
                <div class="eb-runner" style="left:${fillPct}%">
                    <i class="fas ${runnerIcon}"></i>
                </div>
                ${countdownStr ? `<div class="eb-countdown ${alignClass}">${countdownStr}</div>` : ''}
            </div>
        </div>`;
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let globalTooltipInstances = [];

let lastTooltipOpenTime = 0; 
let isHeaderTooltipOpen = false;
let pendingHealthTableRenderData = null;
let pendingRealtimeServerData = null;
let pendingHealthRealtimeRefresh = false;
function initBinanceTooltips() {
    if (typeof tippy === 'undefined') return;
    if (window.currentTooltips) {
        window.currentTooltips.forEach(t => t.destroy());
    }

    window.currentTooltips = tippy('.tippy-header', {
        theme: 'binance',
        animation: 'scale',
        arrow: true,
        allowHTML: true,
        
        trigger: 'mouseenter click', 
        hideOnClick: true,
        interactive: true,
        placement: 'top',
        appendTo: document.body,
        
        onShow(instance) {
            lastTooltipOpenTime = Date.now();
            isHeaderTooltipOpen = true;
        },
        onHidden() {
            isHeaderTooltipOpen = false;

            if (pendingRealtimeServerData && typeof applyLayer2Data === 'function') {
                const queuedRealtimeData = pendingRealtimeServerData;
                pendingRealtimeServerData = null;
                applyLayer2Data(queuedRealtimeData, true);
            }

            if (pendingHealthTableRenderData !== null && typeof renderMarketHealthTable === 'function') {
                const dataToRender = pendingHealthTableRenderData;
                pendingHealthTableRenderData = null;
                renderMarketHealthTable(dataToRender);
            }

            if (pendingHealthRealtimeRefresh && typeof updateHealthTableRealtime === 'function') {
                pendingHealthRealtimeRefresh = false;
                updateHealthTableRealtime();
            }
        }
    });
}


function handleGlobalClick(e) {

    if (!e.target.closest('.tooltip') && !e.target.closest('[data-bs-toggle="tooltip"]')) {

        globalTooltipInstances.forEach(t => t.hide());
    }
}





    function showToast(msg, type='info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast-item ${type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : '')}`;

        let icon = type === 'success' ? 'fa-check-circle text-green' : (type === 'error' ? 'fa-exclamation-triangle text-red' : 'fa-info-circle text-brand');

        toast.innerHTML = `<i class="fas ${icon} fa-lg"></i><div style="flex:1; font-size:0.9rem; font-weight:600; font-family:var(--font-main)">${msg}</div>`;

        container.appendChild(toast);

        if(type === 'error') playSfx('hover');
        else playSfx('click');

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }


    window.alert = function(msg) { showToast(msg, 'info'); };


    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playSfx(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if(type === 'click') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if(type === 'hover') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc.start(); osc.stop(audioCtx.currentTime + 0.05);
        }
    }

    document.querySelectorAll('button, .tour-card, .arsenal-card, .nav-link').forEach(el => {
        el.addEventListener('mouseenter', () => playSfx('hover'));
        el.addEventListener('click', () => playSfx('click'));
    });
    

    let marketChart = null, trackerChart = null, currentPolyId = null, compList = [];


let alphaMarketCache = {}; 



async function syncAlphaData() {
    console.log("✅ Bỏ qua syncAlphaData, Server mới đã lo liệu.");
}


async function quickSyncData() {
    return; 
}

function ensureSonarGalaxy() {
    if (typeof AlphaSonarGalaxy === 'undefined') return null;
    if (mySonarGalaxy && mySonarGalaxy.ctx) return mySonarGalaxy;

    const canvas = document.getElementById('sonar-canvas');
    if (!canvas) return null;

    mySonarGalaxy = new AlphaSonarGalaxy('sonar-canvas');
    return mySonarGalaxy;
}

function init() {
    fetchUserProfile();
    checkLegal();
    syncAlphaData();
    startRealtimeSync();
    ensureSonarGalaxy();
    const cachedData = localStorage.getItem('wave_comp_list');
    let hasCache = false;

    if (cachedData) {
        try {
            compList = JSON.parse(cachedData);
            appData.running = compList; 
            
            renderGrid();
            renderStats();
            hasCache = true;
            document.getElementById('loading-overlay').style.display = 'none';
            console.log("Loaded from Cache");
        } catch (e) { console.error(e); }
    }



    initMarketRadar().then(() => {

        if (typeof quickSyncData === 'function') quickSyncData();
    });


    setInterval(updateClock, 1000);

    applyLanguage();
    if(document.getElementById('cur-lang-text')) {
        document.getElementById('cur-lang-text').innerText = currentLang.toUpperCase();
    }


    console.log("📡 Đang khởi tạo kết nối Realtime...");

    /*if (typeof supabase !== 'undefined') {
        supabase.removeAllChannels();

        supabase.channel('public:tournaments')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments' }, (payload) => {
                const newData = payload.new;
                if (!newData) return;
                

                let localItem = compList.find(c => c.db_id === newData.id);
                if (localItem) {
                    let newContent = newData.data || newData.Data;
                    if (newContent) {

        if (newContent.ai_prediction) {
            localItem.ai_prediction = newContent.ai_prediction;
        }

                        if (newContent.total_accumulated_volume) {
                            localItem.total_accumulated_volume = newContent.total_accumulated_volume;
                        }



                        if (newContent.real_alpha_volume) localItem.real_alpha_volume = newContent.real_alpha_volume;
                        

                        if (newContent.market_analysis) localItem.market_analysis = newContent.market_analysis;
                        if (newContent.daily_tx_count) localItem.daily_tx_count = newContent.daily_tx_count;
                        if (newContent.real_vol_history) localItem.real_vol_history = newContent.real_vol_history;
                    }
                }


                if (typeof updateSingleCardUI === 'function') {
                    updateSingleCardUI(newData);
                } else {

                    updateGridValuesOnly();
                    if (typeof updateHealthTableRealtime === 'function') updateHealthTableRealtime();
                    renderStats();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log("✅ Realtime Connected");
            });
    }*/


    if (!localStorage.getItem('wave_guide_seen')) {
        setTimeout(() => {
            const guideEl = document.getElementById('guideModal');
            if(guideEl) new bootstrap.Modal(guideEl).show();
            localStorage.setItem('wave_guide_seen', 'true');
        }, 1500);
    }
}



    function checkAndAutoRefresh() {

    }


    function checkLegal() {
        if (!localStorage.getItem('wave_legal_accepted')) document.getElementById('legalModal').style.display = 'flex';
    }
    function acceptLegal() {
        localStorage.setItem('wave_legal_accepted', 'true');
        document.getElementById('legalModal').style.display = 'none';
    }


let appData = {
    running: [],        
    history: [],        
    isDataReady: false, 
    currentTab: 'running', 
    currentView: 'list',   
    gridTab: 'running'     
};







async function initMarketRadar() {
    console.log("🚀 System Starting...");
    

    let savedTab = localStorage.getItem('wave_active_tab') || 'running';
    appData.currentTab = savedTab;


    document.querySelectorAll('.radar-tab').forEach(el => el.classList.remove('active'));
    let tabEl = document.getElementById(`tab-${savedTab}`);
    if(tabEl) tabEl.classList.add('active');



    await loadFromCloud(); 
    

    setInterval(() => {

        if (typeof quickSyncData === 'function') {
            quickSyncData(); 
        }
    }, 60000); 

} 

    

function switchRadarTab(type) {
    appData.currentTab = type;
    localStorage.setItem('wave_active_tab', type); 


    document.querySelectorAll('.radar-tab').forEach(el => el.classList.remove('active'));
    let activeTab = document.getElementById(`tab-${type}`);
    if(activeTab) activeTab.classList.add('active');


    if (type === 'running') {
        renderMarketHealthTable(appData.running); 
    } else {
        renderMarketHealthTable(appData.history);
    }
}


function switchGridTab(tabName) {

    appData.gridTab = tabName;



    document.querySelectorAll('.grid-tab-btn').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`gtab-${tabName}`);
    if(btn) btn.classList.add('active');


    renderGrid();
}


async function loadFromCloud(isSilent = false) {
    if(!isSilent && !appData.isDataReady && document.getElementById('loading-overlay')) {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    try {
        const configRes = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?id=eq.-1&select=*`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const configJson = await configRes.json();
        if (configJson && configJson.length > 0 && configJson[0].data) {
            siteConfig = configJson[0].data;
            if (typeof renderFooter === 'function') renderFooter(); 
            if (typeof renderArsenal === 'function') renderArsenal(); 
            if (typeof renderCustomHub === 'function') renderCustomHub();
        }
    } catch (e) { console.warn("⚠️ Bỏ qua lỗi Config:", e); }

    try {
        const res = await fetch("/api/competition-data");
        const serverData = await res.json(); 

        let tempRunning = [], tempHistory = [], tempAll = [];
        let seenDbIds = new Set(); // <-- THÊM BỘ LỌC CHỐNG TRÙNG LẶP
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();

        // [QUAN TRỌNG] Dùng Object.entries để GIỮ LẠI CHÌA KHÓA (ALPHA_466, ALPHA_483...)
        Object.entries(serverData).forEach(([key, item]) => {
            if (!item) return;
            
            // LƯU CHÌA KHÓA VÀO ALPHA_ID ĐỂ REALTIME SOI CHIẾU
            item.alphaId = item.alphaId || (item.data && item.data.alphaId);
            if (!item.alphaId && key.startsWith('ALPHA_')) {
                item.alphaId = key;
            }
            
            // Lấy Base Volume từ Server để cộng dồn
            item.base_total_vol = item.base_total_vol || (item.data && item.data.base_total_vol) || 0;
            item.base_limit_vol = item.base_limit_vol || (item.data && item.data.base_limit_vol) || 0;

            item.db_id = item.db_id || item.id || (item.data && item.data.id);
            if (!item.db_id) {
                if (key.startsWith('legacy_')) item.db_id = parseInt(key.replace('legacy_', ''));
                else if (key.startsWith('ALPHA_')) item.db_id = parseInt(key.replace('ALPHA_', ''));
                else item.db_id = 9999;
            }
            item.id = item.db_id; 

            // --- KHẮC PHỤC LỖI DOUBLE LỊCH SỬ ---
            // Nếu ID giải đấu này đã được xử lý rồi thì bỏ qua (Ngăn server trả về 2 key trùng nhau)
            if (seenDbIds.has(item.db_id)) return;
            seenDbIds.add(item.db_id);
            // ------------------------------------

            item.contract = item.contract || (item.data && item.data.contract) || "0x0000000000000000000000000000000000000000"; 
            
            let isEnded = false;
            let endStr = item.end_at || item.end || (item.data && item.data.end);

            if (item.end_at) { 
                isEnded = Date.now() > new Date(item.end_at).getTime(); 
            } else if (endStr) { 
                let eTimeStr = item.endTime || (item.data && item.data.endTime) || "23:59:59";
                if (eTimeStr.length === 5) eTimeStr += ":00";
                isEnded = Date.now() > new Date(endStr + 'T' + eTimeStr + 'Z').getTime(); 
            }

            if (!isEnded) tempRunning.push(item);
            else tempHistory.push(item);
            tempAll.push(item);
        });

        appData.running = tempRunning;
        appData.history = tempHistory;
        appData.isDataReady = true;
        compList = tempAll;
        localStorage.setItem('wave_comp_list', JSON.stringify(compList));

        if (typeof renderGrid === 'function') renderGrid(); 
        if (typeof renderStats === 'function') renderStats();
        if (typeof initCalendar === 'function') initCalendar();
        
        let currentTab = localStorage.getItem('wave_active_tab') || 'running';
        if(currentTab === 'running') renderMarketHealthTable(appData.running);
        else renderMarketHealthTable(appData.history);

    } catch (err) {
        console.error("❌ Lỗi tải dữ liệu:", err);
    } finally {
        if(!isSilent && document.getElementById('loading-overlay')) document.getElementById('loading-overlay').style.display = 'none';
        if (typeof updateAllPrices === 'function') updateAllPrices();
    }
}

  


    function renderFooter() {
        const c = document.getElementById('footer-socials-container');
        c.innerHTML = '';


        const fixUrl = (url) => {
            if (!url) return '#';
            try {
                let finalUrl = url.startsWith('http') ? url : 'https://' + url;
                const parsed = new URL(finalUrl);
                if (!['http:', 'https:'].includes(parsed.protocol)) return '#';
                return parsed.href;
            } catch {
                return '#';
            }
        };

        if(siteConfig.x) c.innerHTML += `<a href="${escHtml(fixUrl(siteConfig.x))}" target="_blank" class="social-btn"><i class="fab fa-twitter"></i></a>`;
        if(siteConfig.tele) c.innerHTML += `<a href="${escHtml(fixUrl(siteConfig.tele))}" target="_blank" class="social-btn"><i class="fab fa-telegram-plane"></i></a>`;
        if(siteConfig.yt) c.innerHTML += `<a href="${escHtml(fixUrl(siteConfig.yt))}" target="_blank" class="social-btn"><i class="fab fa-youtube"></i></a>`;

        const brandImg = document.getElementById('nav-brand-img');
        const brandText = document.getElementById('nav-brand-text');
        if(brandText) brandText.style.display = 'block';
        brandImg.src = "https://pub-78b1d1c3a4f64da39a75efb9b66ccf65.r2.dev/logo-wave-alpha.png";
brandImg.style.display = 'block';
        }
    


    function openConfigModal() {

    document.getElementById('cfg-x').value = siteConfig.x || '';
    document.getElementById('cfg-tele').value = siteConfig.tele || '';
    document.getElementById('cfg-yt').value = siteConfig.yt || '';
    document.getElementById('cfg-logo-url').value = siteConfig.brandLogo || '';
    

    document.getElementById('cfg-ref-binance').value = siteConfig.ref_binance || '';
    document.getElementById('cfg-ref-web3').value = siteConfig.ref_web3 || '';
    document.getElementById('cfg-ref-dex').value = siteConfig.ref_dex || '';


    let img = document.getElementById('cfg-logo-preview');
    if(siteConfig.brandLogo) { img.src = siteConfig.brandLogo; img.style.display = 'block'; }
    else { img.style.display = 'none'; }


    

    new bootstrap.Modal(document.getElementById('configModal')).show();
}


async function saveGlobalConfig() {

    let arsenalItems = [];
    document.querySelectorAll('.arsenal-item-row').forEach(row => {
        arsenalItems.push({
            name: row.querySelector('.inp-name').value,
            link: row.querySelector('.inp-link').value,
            type: row.querySelector('.inp-type').value,
            logo: row.querySelector('.inp-logo').value
        });
    });


    const newData = {
        x: document.getElementById('cfg-x').value.trim(),
        tele: document.getElementById('cfg-tele').value.trim(),
        yt: document.getElementById('cfg-yt').value.trim(),
        


        ref_binance: document.getElementById('cfg-ref-binance').value.trim(),
        ref_web3: document.getElementById('cfg-ref-web3').value.trim(),
        ref_dex: document.getElementById('cfg-ref-dex').value.trim(),


        arsenal_items: arsenalItems
    };


    let btn = document.querySelector('button[onclick="saveGlobalConfig()"]');
    let oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...'; btn.disabled = true;

    try {
        const { error } = await supabase.from('tournaments')
            .upsert({ id: -1, name: 'CONFIG', contract: 'CONFIG', data: newData });

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('configModal')).hide();
        

        await loadFromCloud(false);
        showToast("Configuration saved successfully!", "success");

    } catch (e) {
        console.error(e);
        showToast("Save failed: " + e.message, "error");
    } finally {
        btn.innerHTML = oldText; btn.disabled = false;
    }
}



    

        
    let lastRefreshTime = 0;
    const REFRESH_COOLDOWN = 10000; 


async function handleSmartRefresh(isSilent = false) {
    const now = Date.now();
    if (!isSilent) {
        if (now - lastRefreshTime < REFRESH_COOLDOWN) {
            showToast(`Please wait ${Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000)}s!`, "error");
            return;
        }
    }
    lastRefreshTime = now;

    const icon = document.querySelector('.fa-sync-alt');
    if (!isSilent) {
        if(icon) icon.classList.add('fa-spin');
        showToast("Syncing market data...", "info");
    }

    try {



const { data, error } = { data: { success: true }, error: null }; 
await loadFromCloud(false);
        
        if (error) throw error;

        if (data && data.success) {
            if (data.updatedItems && Array.isArray(data.updatedItems)) {

                data.updatedItems.forEach(newItem => {
                    let localItem = compList.find(c => c.db_id === newItem.id);
                    if (localItem) {
                        if(newItem.data.real_alpha_volume) localItem.real_alpha_volume = newItem.data.real_alpha_volume;
                        if(newItem.data.daily_tx_count) localItem.daily_tx_count = newItem.data.daily_tx_count; 
                        if(newItem.data.real_vol_history) localItem.real_vol_history = newItem.data.real_vol_history;
                        if(newItem.data.last_updated_ts) localItem.last_updated_ts = newItem.data.last_updated_ts;
                        if(newItem.data.market_analysis) localItem.market_analysis = newItem.data.market_analysis;
                    }
                });


                updateGridValuesOnly();      
                renderMarketHealthTable();   
                renderStats();               
                
                if (!isSilent) showToast(`Market Data Updated!`, "success");
            } else {


                if (!isSilent) await loadFromCloud(false); 
            }
        }
    } catch (e) {
        console.error(e);

        if (!isSilent) showToast("Sync Error: " + e.message, "error");
    } finally {
        if(icon) icon.classList.remove('fa-spin');
    }
}



function updateAllPrices() {
    console.log("⚠️ Đã chặn DexScreener.");
    

    renderGrid();
    renderStats();
}


            
    let volHistChart = null;

    function openVolHistory(dbId) {
        let c = compList.find(x => x.db_id == dbId);
        if(!c) return;

        document.getElementById('vh-title').innerText = c.name + " ANALYTICS";
        document.getElementById('vh-subtitle').innerText = "Correlation: Total Vol vs Min Target";


        let realHistory = c.real_vol_history || [];
        let minHistory = c.history || [];

        let allDates = new Set([
            ...realHistory.map(x => x.date),
            ...minHistory.map(x => x.date)
        ]);

        let isRunning = true;
        if(c.end) {
            let todayStr = new Date().toISOString().split('T')[0];
            if (todayStr > c.end) isRunning = false;
        }

        if (allDates.size === 0 && isRunning) {
            allDates.add(new Date().toISOString().split('T')[0]);
        }

        let sortedDates = Array.from(allDates).sort((a,b) => new Date(a) - new Date(b));


        if (c.end) {
            sortedDates = sortedDates.filter(d => d <= c.end);
        }



        let recentDates = sortedDates.slice(-10);

        let labels = [];
        let dataReal = [];
        let dataMin = [];
        

        let todayStr = new Date().toISOString().split('T')[0];

        recentDates.forEach(date => {
            let parts = date.split('-');
            labels.push(`${parts[2]}/${parts[1]}`);


            let rItem = realHistory.find(x => x.date === date);
            let rVal = rItem ? rItem.vol : 0;
            

            if (!rItem && date === todayStr && isRunning) {
                rVal = c.real_alpha_volume || 0;
            }
            dataReal.push(rVal);


            let mItem = minHistory.find(x => x.date === date);
            let mVal = mItem ? parseFloat(mItem.target) : 0;




            if (date === todayStr && mVal === 0) {
                dataMin.push(null); 
            } else {
                dataMin.push(mVal);
            }
        });


        new bootstrap.Modal(document.getElementById('volHistoryModal')).show();

        const ctx = document.getElementById('volHistoryChart').getContext('2d');
        if (volHistChart) volHistChart.destroy();


        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 240, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 240, 255, 0.05)');

        volHistChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Vol',
                        data: dataReal,
                        type: 'bar',
                        backgroundColor: gradient,
                        borderColor: '#00F0FF',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.5,
                        order: 2,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Min Target',
                        data: dataMin,
                        type: 'line',
                        borderColor: '#F0B90B', 
                        backgroundColor: '#F0B90B',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#000',
                        pointBorderColor: '#F0B90B',
                        tension: 0.3,
                        order: 1,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#848e9c', font: { family: 'Rajdhani', size: 11, weight: 'bold' } } },
                    y: {
                        type: 'linear', display: true, position: 'left',
                        grid: { color: '#2b3139', borderDash: [4, 4] },
                        ticks: { color: '#00F0FF', font: { family: 'Rajdhani', size: 10 }, callback: function(v) { return v>=1000000?(v/1000000).toFixed(1)+'M':(v>=1000?(v/1000).toFixed(0)+'k':v); } }
                    },
                    y1: {
                        type: 'linear', display: true, position: 'right', grid: { display: false },
                        ticks: { color: '#F0B90B', font: { family: 'Rajdhani', size: 10, weight: 'bold' }, callback: function(v) { return v>=1000000?(v/1000000).toFixed(1)+'M':(v>=1000?(v/1000).toFixed(0)+'k':v); } }
                    }
                },
                plugins: {
                    legend: { display: true, labels: { color: '#fff', font: { size: 10 }, boxWidth: 10 } },
                    tooltip: {
                        backgroundColor: 'rgba(22, 26, 30, 0.95)', titleColor: '#fff', bodyColor: '#fff', borderColor: '#333', borderWidth: 1, padding: 10,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                let val = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(context.raw);
                                return ` ${label}: $${val}`;
                            }
                        }
                    }
                }
            }
        });
    }



function renderGrid(customData = null) {
        const SHOW_PREDICT_BTN = false;
        // 1. Kiểm tra nếu đang mở xem chi tiết (thẻ bài đang active) thì không render lại toàn bộ để tránh lag
        if (document.querySelector('.tour-card.active-card')) {
            updateGridValuesOnly(); 
            return; 
        }
    
        const grid = document.getElementById('appGrid');
        if(!grid) return;
    
        // 2. Xác định danh sách cần vẽ: ÉP GRID LẤY GIỐNG TABLE
    let currentTab = appData.currentTab || localStorage.getItem('wave_active_tab') || 'running';
    let sourceList = (typeof compList !== 'undefined' && compList.length > 0) ? [...compList] : [];
    
    // Nếu compList rỗng (chưa load xong) thì mới dùng appData
    if (sourceList.length === 0) {
        sourceList = (currentTab === 'history') ? [...appData.history] : [...appData.running];
    }

    const nowMs = Date.now();
    let listToRender = sourceList.filter(item => {
        // Logic lọc y hệt bảng Table
        let isEnded = false;
        if (item.end_at) { 
            isEnded = nowMs > new Date(item.end_at).getTime(); 
        } else if (item.end) { 
            let eTimeStr = item.endTime || "23:59:59";
            if (eTimeStr.length === 5) eTimeStr += ":00";
            isEnded = nowMs > new Date(item.end + 'T' + eTimeStr + 'Z').getTime();
        }

        if (currentTab === 'running') return !isEnded;
        return isEnded;
    });

    // 3. Nếu đang có bộ lọc ngày trên Calendar thì lọc thêm
    if (typeof currentFilterDate !== 'undefined' && currentFilterDate) {
        listToRender = listToRender.filter(c => c.end === currentFilterDate);
    }
    
        // 4. Sắp xếp theo thứ tự ưu tiên (orderIndex)
        listToRender.sort((a,b) => {
            let posA = (a.orderIndex !== undefined && a.orderIndex !== null) ? a.orderIndex : 9999;
            let posB = (b.orderIndex !== undefined && b.orderIndex !== null) ? b.orderIndex : 9999;
            return posA - posB;
        });
    
        // 5. Nếu không có dữ liệu
        if(listToRender.length === 0) {
            grid.innerHTML = `<div class="col-12 text-center py-5 opacity-50"><i class="fas fa-calendar-times fa-3x mb-3 text-sub"></i><h5 class="text-sub font-num">NO DATA FOUND</h5><button class="btn btn-sm btn-outline-secondary mt-2 rounded-pill px-4" onclick="filterByDate(null)">Show All</button></div>`;
            return;
        }
    
        // 6. Xử lý hiển thị Admin
        const isAdmin = document.body.classList.contains('is-admin');
        document.querySelectorAll('.btn-save-pos').forEach(btn => btn.style.display = isAdmin ? 'block' : 'none');
    
        // 7. Render HTML
        let fullHtml = '';
        let now = new Date();
    
        listToRender.forEach(c => {
            try {



            let sTimeStr = c.startTime || "00:00:00";
            if(sTimeStr.length === 5) sTimeStr += ":00"; 
            let startDateTime = new Date(c.start + 'T' + sTimeStr + 'Z');


            let eTimeStr = c.endTime || "23:59:59";
            if(eTimeStr.length === 5) eTimeStr += ":00";
            let endDateTime = new Date(c.end + 'T' + eTimeStr + 'Z');


            let status = 'running'; 
            
            if (now < startDateTime) {
                status = 'upcoming'; 
            } else if (now > endDateTime) {
                status = 'ended';    
            }


            let cardClass = 'tour-card';
            if (status === 'ended') cardClass += ' ended-card';
            if (status === 'upcoming') cardClass += ' upcoming-card'; 


            let tourTimerHtml = '';
            
            if (status === 'upcoming') {

                let diff = startDateTime - now;
                let d = Math.floor(diff / 86400000);
                let h = Math.floor((diff % 86400000) / 3600000);
                let m = Math.floor((diff % 3600000) / 60000);
                

                let tText = d > 0 ? `Starts in ${d}d ${h}h` : `Starts in ${h}h ${m}m`;
                

                tourTimerHtml = `<div class="tour-end-timer" style="color:#FFD700"><i class="fas fa-hourglass-start" style="font-size:0.6rem"></i> ${tText}</div>`;
            
            } else if (status === 'running') {

                let diff = endDateTime - now;
                let d = Math.floor(diff / 86400000);
                let h = Math.floor((diff % 86400000) / 3600000);
                let m = Math.floor((diff % 3600000) / 60000);
                
                let tText = "Ended";
                if (diff > 0) {
                     tText = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
                }
                
                let tColor = (diff < 86400000) ? '#F6465D' : '#999'; 
                tourTimerHtml = `<div class="tour-end-timer" style="color:${tColor}"><i class="far fa-clock" style="font-size:0.6rem"></i> ${tText}</div>`;
            } else {

                tourTimerHtml = `<div class="tour-end-timer" style="color:#999"><i class="fas fa-check-circle" style="font-size:0.6rem"></i> Ended</div>`;
            }


            let statusBadgeHtml = '';
            if (status === 'upcoming') {
                statusBadgeHtml = `<div class="token-status anim-breathe" style="color:#FFD700; border-color:#FFD700">UPCOMING</div>`;
            } else if (status === 'running') {
                statusBadgeHtml = `<div class="token-status anim-breathe text-green">RUNNING</div>`;
            } else {
                statusBadgeHtml = `<div class="token-status text-red">ENDED</div>`;
            }





        const botLink = `https://t.me/WaveAlphaSignal_bot?start=check_${c.name}`;
            


            let promoTimerHtml = '';
            let isListingExpired = false;
            let tagHtml = '';

            if (c.listingTime && c.alphaType !== 'none') {
                let listingDate = new Date(c.listingTime);
                if (typeof c.listingTime === 'string' && !c.listingTime.includes('Z') && !c.listingTime.includes('+')) {
                    listingDate = new Date(c.listingTime + 'Z');
                }

                let expiryTime = new Date(Date.UTC(listingDate.getUTCFullYear(), listingDate.getUTCMonth(), listingDate.getUTCDate() + 29, 23, 59, 59, 999)).getTime();
                let diffDays = Math.ceil((expiryTime - now.getTime()) / 86400000);

                if (diffDays > 0) {
                    if (c.alphaType === 'x4') tagHtml = `<div class="tag-x4" style="text-transform: lowercase;">x4 ${diffDays}d</div>`;
                    else if (c.alphaType === 'x2') { cardClass += ' highlight-x2'; tagHtml = `<div class="tag-x2" style="text-transform: lowercase;">x2 ${diffDays}d</div>`; }
                } else {
                    isListingExpired = true; 
                }
            }
            
            if (status === 'ended') isListingExpired = true;


         
            if (!isListingExpired) {
                if (c.alphaType === 'x4') tagHtml = `<div class="tag-x4">X4 BSC</div>`;
                else if (c.alphaType === 'x2') { cardClass += ' highlight-x2'; tagHtml = `<div class="tag-x2">X2 OTHER</div>`; }
            } else { 
                tagHtml = `<div class="${c.alphaType==='x4'?'tag-x4':'tag-x2'} tag-expired">${c.alphaType==='x4'?'X4 BSC':'X2 OTHER'}</div>`; 
                promoTimerHtml = ''; 
            }
            
            if ((c.inputTokens||[]).length > 0) tagHtml = `<div class="tag-x2" style="background:#9945FF; color:#fff; border:none; box-shadow:0 0 5px #9945FF">ECOSYSTEM</div>`;
            if (c.alphaType === 'x4' && !isListingExpired && !(c.inputTokens||[]).length && status === 'running') cardClass += ' highlight-x4';


            let ruleHtml = '';

            if (c.ruleType === 'trade_x4') {

                ruleHtml = `<div class="rule-pill rp-x4"><i class="fas fa-bolt text-gold" style="font-size:0.55rem"></i> ALL VOL <span class="x4-box">x4</span></div>`;
            } 
            else if (c.ruleType === 'trade_all') {


                ruleHtml = `<div class="rule-pill rp-all"><i class="fas fa-exchange-alt" style="font-size:0.55rem"></i> ALL VOL</div>`;
            } 
            else {

                ruleHtml = `<div class="rule-pill rp-buy"><i class="fas fa-arrow-up" style="font-size:0.55rem"></i> ONLY BUY</div>`;
            }


            if(status === 'ended') ruleHtml = ruleHtml.replace('rule-pill', 'rule-pill opacity-50 grayscale');

            
            let adminEditBtn = isAdmin ? `<i class="fas fa-pencil-alt ms-2 text-sub cursor-pointer hover-white" style="font-size:0.7rem" onclick="openEditModal('${c.db_id}')"></i>` : '';
            let dragAttr = (isAdmin) ? `draggable="true" ondragstart="drag(event)" ondrop="drop(event)" ondragover="allowDrop(event)"` : '';
            let dragHandleHtml = (isAdmin) ? `<i class="fas fa-grip-vertical admin-drag-handle" title="Kéo để sắp xếp"></i>` : '';
            let isPerfect = (c.market_analysis?.label && c.market_analysis.label.includes("PERFECT"));
            let rocketBadgeHtml = isPerfect ? `<div class="rocket-badge"><i class="fas fa-rocket"></i> GEM</div>` : "";
            if(isPerfect) cardClass += " card-perfect";


// --- TÍNH TOÁN TỶ TRỌNG CEX / DEX ---
let aLimit = parseFloat(c.limit_accumulated_volume || 0);
let aOnchain = parseFloat(c.onchain_accumulated_volume || 0);

// Khắc phục lỗi % > 100: Bắt buộc dùng tổng của 2 biến Limit và Onchain làm chuẩn 100%
let sumVolForPct = aLimit + aOnchain;
let pctLimit = sumVolForPct > 0 ? (aLimit / sumVolForPct) * 100 : 50;
let pctOnchain = sumVolForPct > 0 ? (aOnchain / sumVolForPct) * 100 : 50;

// Tổng thực tế hiển thị
let aTotal = parseFloat(c.total_accumulated_volume || sumVolForPct);
let realVol = (status === 'upcoming') ? 0 : aTotal;

let prefix = (realVol > 0) ? '$' : ''; 
let realVolDisplay = realVol > 0 ? prefix + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(realVol) : '---';
let realVolColor = realVol > 0 ? '#fff' : '#666';

const fmtCompactLocal = (num) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(num || 0);

let volProgressBarHtml = status === 'upcoming' ? '' : `
    <div class="vol-progress-container mt-1 mb-1" style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; display: flex; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
        <div style="width: ${pctLimit}%; background: linear-gradient(90deg, #F0B90B, #FFD700); transition: width 0.5s ease;" title="Limit (CEX): ${prefix}${fmtNum(aLimit)}"></div>
        <div style="width: ${pctOnchain}%; background: linear-gradient(90deg, #9945FF, #D0AAFF); transition: width 0.5s ease;" title="On-chain (DEX): ${prefix}${fmtNum(aOnchain)}"></div>
    </div>
    <div class="d-flex justify-content-between align-items-start mb-2" style="font-family: 'Rajdhani', sans-serif; line-height: 1.2;">
        <div style="color: #F0B90B; display: flex; flex-direction: column; align-items: flex-start;">
            <span style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 0.5px; font-weight: 600;">CEX LIMIT</span>
            <span style="font-size: 0.85rem; font-weight: 700;">${pctLimit.toFixed(1)}% <span style="font-size: 0.75rem; font-weight: 500; opacity: 0.9;">(${prefix}${fmtCompactLocal(aLimit)})</span></span>
        </div>
        <div style="color: #9945FF; display: flex; flex-direction: column; align-items: flex-end;">
            <span style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 0.5px; font-weight: 600;">DEX ON-CHAIN</span>
            <span style="font-size: 0.85rem; font-weight: 700;"><span style="font-size: 0.75rem; font-weight: 500; opacity: 0.9;">(${prefix}${fmtCompactLocal(aOnchain)})</span> ${pctOnchain.toFixed(1)}%</span>
        </div>
    </div>
`;

            let inputTokensHtml = '';
            if (c.inputTokens && c.inputTokens.length > 0) {
                inputTokensHtml = `
                <div style="padding: 0 15px 10px 15px;">
                    <div style="font-size: 0.6rem; color: #848e9c; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">
                        <i class="fas fa-layer-group text-brand"></i> QUALIFIED TOKENS (${c.inputTokens.length})
                    </div>
                    <div class="custom-scrollbar" style="font-size: 0.75rem; color: #00F0FF; background: rgba(0, 240, 255, 0.05); padding: 6px 8px; border-radius: 4px; border: 1px dashed rgba(0, 240, 255, 0.2); max-height: 48px; overflow-y: auto; line-height: 1.4; font-weight: 600;">
                        ${c.inputTokens.join(', ')}
                    </div>
                </div>`;
            }
                
            let target = 0;
            let rawHist = c.history || [];

            let sortedHist = [...rawHist].sort((a,b) => new Date(b.date) - new Date(a.date));
            let validItem = sortedHist.find(h => parseFloat(h.target) > 0);
            if (validItem) {
                target = parseFloat(validItem.target);
            }
            
            if (isNaN(target)) target = 0;

            
let usePrice = parseFloat(c.cachedPrice) || ((c.market_analysis && c.market_analysis.price) ? parseFloat(c.market_analysis.price) : 0);
let priceStr = (usePrice > 0) ? '$' + usePrice.toLocaleString('en-US', { maximumFractionDigits: usePrice < 1 ? 6 : 2 }) : '---';
let estVal = (parseFloat(c.rewardQty)||0) * usePrice;

let estHtml = estVal > 0 ? `<span class="text-sub small fw-bold ms-1 anim-breathe live-est-val" data-qty="${c.rewardQty}" style="transition: color 0.1s ease;">~$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(estVal)}</span>` : '<span class="live-est-val" data-qty="'+(c.rewardQty||0)+'" style="transition: color 0.1s ease;"></span>';

let rewardDisplayStr = fmtNum(c.rewardQty);
let rewardLblStr = "REWARD";

if (c.rewardType === 'tiered' && c.tiers_data && c.tiers_data.length > 0) {
    rewardDisplayStr = `<span class="text-warning anim-breathe" onclick="event.stopPropagation(); showTiersModal('${c.db_id}')" style="cursor:pointer; border-bottom:1px dashed #ffc107;">Max ${fmtNum(c.rewardQty)} <i class="fas fa-list-ol ms-1"></i></span>`;
    rewardLblStr = "TIERED";
}
                
let rawName = c.name ? c.name.toUpperCase().trim() : "UNKNOWN";
let cleanSymbol = rawName.split('(')[0].trim(); 


let alphaInfo = alphaMarketCache[cleanSymbol] || {};


let localImgPath = c.logo || c.icon || alphaInfo.icon || './assets/tokens/default.png';


let chainImg = alphaInfo.chain_icon || '';
let chainBadgeHtml = chainImg ? `<img src="${chainImg}" class="chain-badge" onerror="this.style.display='none'" style="position:absolute; bottom:-2px; right:-2px; width:14px; height:14px; border-radius:50%; background:#000; border:1px solid #333;">` : '';
let defaultImgPath = `./assets/tokens/default.png`;



fullHtml += `
<div class="col-md-6 col-lg-4 col-xl-3 card-wrapper" ${dragAttr} data-id="${c.db_id}">
    <div class="${cardClass}" onclick="playSfx('click'); toggleCardHighlight(this)">
        <div class="card-head">
            ${rocketBadgeHtml}
            <div class="token-info-wrapper">
                ${dragHandleHtml}
                
                <div class="logo-wrapper" style="position:relative; display:inline-block;">
    <img src="${localImgPath}" 
         onerror="this.onerror=null; this.src='${defaultImgPath}';" 
         class="token-logo" 
         onclick="event.stopPropagation(); window.open('https://www.binance.com/en/alpha/${c.chain}/${c.contract}', '_blank')">
    ${chainBadgeHtml}
</div>
                
                <div class="token-text">

                                <div class="token-title d-flex align-items-center">
                                    ${escHtml(c.name)}
                                    <span onclick="event.stopPropagation(); let tk = allTokens.find(x => x.contract && x.contract.toLowerCase() === '${c.contract_address || c.contract || ''}'.toLowerCase()); if(tk) { window.openProChart(tk); } else { alert('Đang đồng bộ dữ liệu Chart, vui lòng thử lại sau vài giây!'); }"
                                          title="Mở Biểu Đồ Pro" 
                                          style="margin-left:8px; color:#00F0FF; font-size:0.9rem; cursor:pointer; transition:0.2s; text-shadow: 0 0 5px rgba(0,240,255,0.4);" 
                                          onmouseover="this.style.transform='scale(1.2)'" 
                                          onmouseout="this.style.transform='scale(1)'">
                                        <i class="fas fa-chart-area"></i>
                                    </span>
                                    <a href="${botLink}" target="_blank" onclick="event.stopPropagation()" 
                                       title="Check on Telegram" 
                                       style="margin-left:8px; color:#2AABEE; font-size:0.85rem; transition:0.2s;" 
                                       onmouseover="this.style.transform='scale(1.2)'" 
                                       onmouseout="this.style.transform='scale(1)'">
                                        <i class="fas fa-robot"></i>
                                    </a>
                                </div>
                                ${statusBadgeHtml}
                                ${tourTimerHtml}
                                ${renderMultiplierPath(c)}
                            </div>
                        </div>
                        <div class="card-head-right">
                            ${ruleHtml}
                            ${tagHtml}
                            ${promoTimerHtml}
                        </div>
                    </div>
                    <div class="card-stats-grid">
                        <div class="stat-cell"><div class="stat-lbl">TOP</div><div class="stat-val text-main">${c.topWinners||'--'}</div></div>
                        <div class="stat-cell border-start border-end border-secondary border-opacity-25"><div class="stat-lbl">${rewardLblStr}</div><div class="stat-val text-brand" style="font-size:0.9rem">${rewardDisplayStr}${estHtml}</div></div>
<div class="stat-cell"><div class="stat-lbl">PRICE</div><div class="stat-val fw-bold font-num live-price-val" data-id="${c.db_id}" style="font-size: 1rem; letter-spacing: 0.5px;">${priceStr}</div></div>
</div>
                    <div class="card-list" style="padding: 10px 15px 0 15px;">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="text-sub fw-bold" style="font-size:0.6rem; letter-spacing:1px; text-transform:uppercase;">MY PROGRESS</span>
                            <button class="btn btn-sm fw-bold d-flex align-items-center gap-1" onclick="event.stopPropagation(); openUpdateModal('${c.db_id}')" style="font-size:0.65rem; transition:0.2s; background: rgba(14, 203, 129, 0.15); color: #0ECB81; border: 1px solid #0ECB81; padding: 2px 8px; border-radius: 4px;">
                                <i class="fas fa-pen-to-square"></i> UPDATE VOL
                            </button>
                        </div>
                        <div class="mini-chart-wrapper" onclick="event.stopPropagation()">
                            <canvas id="miniChart-${c.db_id}"></canvas>
                        </div>
                        <div class="acc-stats-grid" id="accGrid-${c.db_id}"></div>
                    </div>
                   
                    ${inputTokensHtml}
                    
                    <div style="padding: 0px 15px 0 15px;">
                        ${volProgressBarHtml}
                    </div>

                    <div class="market-bar border-0 pt-1 pb-3">
                        <div class="mb-item text-start">
                            <div class="mb-label">Total Vol <i class="fas fa-info-circle opacity-50" title="Tổng Volume Tích Lũy"></i></div>
                            <div class="mb-val" id="live-vol-${c.db_id}" style="color:${realVolColor}; font-size:1.1rem">${realVolDisplay}</div>
                        </div>
                        <div class="mb-item text-end">
                            <div class="mb-label" style="justify-content: flex-end; color:#F0B90B">Min Target (Goal)</div>
                            <div class="mb-val text-gold anim-breathe" style="align-items: center; justify-content: flex-end;">
                                <span style="font-size: 1.4rem !important; font-weight: 900 !important; color: #ffca28 !important; line-height: 1; text-shadow: 0 0 15px rgba(240, 185, 11, 0.5);">
                                    $${fmtNum(target)}
                                </span>
                                ${adminEditBtn}
                            </div>
                        </div>
                    </div>
                    
                    

${SHOW_PREDICT_BTN ? `
                    <div class="card-actions" style="padding: 0; border:none;">
                        <button class="btn-card-action predict" onclick="event.stopPropagation(); openPredictionView('${c.db_id}')">
                            <i class="fas fa-bolt me-2"></i> ${translations[currentLang].btn_predict}
                        </button>
                    </div>
                    ` : ''}

                    
                </div>
            </div>`;
        } catch(e) { console.error("Render error", e); }
    });

    grid.innerHTML = fullHtml;
    listToRender.forEach(c => { renderCardMiniChart(c); });
    

    initBinanceTooltips();
}


function updateGridValuesOnly() {
    try {
        if (window.competitionRadar && typeof window.competitionRadar.updateRealtimeStats === 'function') {
            window.competitionRadar.updateRealtimeStats(compList);
        }
        if (typeof updateHealthTableRealtime === 'function') {
            updateHealthTableRealtime();
        }

        let maxRewardVal = 0;
        let topToken = null;
        let totalEstPool = 0;

        compList.forEach(c => {
            let currentPrice = parseFloat(c.cachedPrice) || 0;
            if (currentPrice === 0 && c.market_analysis && c.market_analysis.price) {
                currentPrice = parseFloat(c.market_analysis.price);
            }
            if (currentPrice > 0) c.cachedPrice = currentPrice;

            let isRunning = !c.end || new Date() < new Date(c.end + 'T' + (c.endTime || '23:59') + 'Z');
            let qty = parseFloat(c.rewardQty) || 0;
            let currentTotalVal = qty * currentPrice;

            if (isRunning) {
                totalEstPool += currentTotalVal;
                if (currentTotalVal > maxRewardVal) { maxRewardVal = currentTotalVal; topToken = c; }
            }

            let pStr = '---';
            if (currentPrice > 0) {
                if (currentPrice >= 1) pStr = '$' + currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                else if (currentPrice >= 0.01) pStr = '$' + currentPrice.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
                else pStr = '$' + parseFloat(currentPrice.toFixed(8)).toString();
            }

            const allPriceElements = document.querySelectorAll(`.live-price-val[data-id="${c.db_id}"]`);
            allPriceElements.forEach(el => {
                let oldPrice = parseFloat(el.getAttribute('data-raw')) || 0;
                
                if (oldPrice > 0 && currentPrice !== oldPrice) {
                    if (currentPrice > oldPrice) {
                        el.classList.remove('tick-down'); el.classList.add('tick-up');
                    } else if (currentPrice < oldPrice) {
                        el.classList.remove('tick-up'); el.classList.add('tick-down');
                    }
                }
                
                if (el.innerText !== pStr) {
                    el.innerText = pStr;
                }
                el.setAttribute('data-raw', currentPrice);
            });

            const tablePoolElements = document.querySelectorAll(`.live-pool-table-val[data-id="${c.db_id}"]`);
            tablePoolElements.forEach(el => {
                let estQty = parseFloat(el.getAttribute('data-qty')) || qty;
                let estTotal = estQty * currentPrice;
                
                if (estTotal > 0) {
                    let compactStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(estTotal);
                    let oldEstTotal = parseFloat(el.getAttribute('data-raw-est')) || 0;

                    if (oldEstTotal > 0 && estTotal !== oldEstTotal) {
                        if (estTotal > oldEstTotal) {
                            el.style.setProperty('color', '#0ECB81', 'important'); 
                        } else if (estTotal < oldEstTotal) {
                            el.style.setProperty('color', '#F6465D', 'important'); 
                        }
                    }

                    if (el.innerText !== compactStr) {
                        el.innerText = compactStr;
                    }
                    el.setAttribute('data-raw-est', estTotal);
                }
            });

            const cardWrapper = document.querySelector(`.card-wrapper[data-id="${c.db_id}"]`);
            if (cardWrapper) {
                const volEl = cardWrapper.querySelector('.market-bar .mb-item:first-child .mb-val');
                if (volEl) {
                    let rv = c.limit_accumulated_volume || c.total_accumulated_volume || c.real_alpha_volume || 0;
                    let prefix = rv > 0 ? '$' : '';
                    let rvStr = rv > 0 ? prefix + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rv) : '---';
                    if(volEl.innerText !== rvStr) volEl.innerText = rvStr;
                }

                const estEl = cardWrapper.querySelector('.live-est-val');
                if (estEl) {
                    let estQty = parseFloat(estEl.getAttribute('data-qty')) || qty;
                    let estTotal = estQty * currentPrice;
                    
                    if (estTotal > 0) {
                        let newEstStr = '~$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(estTotal);
                        let oldEstTotal = parseFloat(estEl.getAttribute('data-raw-est')) || 0;

                        // TÁCH RỜI: Đồng bộ logic cho thẻ bài Grid
                        if (oldEstTotal > 0 && estTotal !== oldEstTotal) {
                            if (estTotal > oldEstTotal) {
                                estEl.style.setProperty('color', '#0ECB81', 'important'); 
                            } else if (estTotal < oldEstTotal) {
                                estEl.style.setProperty('color', '#F6465D', 'important'); 
                            }
                        }

                        if (estEl.innerText !== newEstStr) {
                            estEl.innerText = newEstStr;
                        }
                        estEl.setAttribute('data-raw-est', estTotal);
                    }
                }
                
                if (c.ai_prediction && c.ai_prediction.target > 0) {
                    let aiStr = '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(c.ai_prediction.target);
                    
                    let gridTargetEl = document.getElementById(`grid-target-${c.db_id}`);
                    if (gridTargetEl && gridTargetEl.innerText !== aiStr) {
                        gridTargetEl.innerText = aiStr;
                    }
                    
                    let tableTargetEl = document.getElementById(`table-target-${c.db_id}`);
                    if (tableTargetEl && tableTargetEl.innerText !== aiStr) {
                        tableTargetEl.innerText = aiStr;
                    }
                }

            }
        });

        const poolEl = document.getElementById('stat-pool');
        if (poolEl) poolEl.innerText = fmt(totalEstPool);

        if (topToken) {
            const topSymbolEl = document.getElementById('stat-top-symbol');
            const topValEl = document.getElementById('stat-top-val');
            const topImgEl = document.getElementById('stat-top-img');
            if(topSymbolEl) topSymbolEl.innerText = topToken.name;
            if(topValEl) topValEl.innerText = fmt(maxRewardVal);
            if(topImgEl && topToken.logo) { topImgEl.src = topToken.logo; topImgEl.style.display = 'block'; }
        }

        if (typeof initCalendar === 'function') initCalendar();

    } catch (e) {
        console.error("Lỗi cập nhật UI:", e);
    }
}
        

let mhSort = { col: 'reward', dir: 'desc' };


window.toggleHealthSort = function(col) {
    // --- CHỐNG LỖI MOBILE ---
    // Nếu người dùng vừa chạm mở Tooltip trong vòng 400ms đổ lại, thì chặn không cho Sort bảng.
    if (Date.now() - lastTooltipOpenTime < 400) return;

    if (mhSort.col === col) {
        mhSort.dir = mhSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
        mhSort.col = col;
        mhSort.dir = 'desc';
    }

    let currentData = []; 
    if (typeof appData !== 'undefined') {
        if (appData.currentTab === 'ended' || appData.currentTab === 'history') { 
            currentData = appData.history; 
        } else {
            currentData = appData.running; 
        }
    }

    renderMarketHealthTable(currentData); 
}


function copyContract(addr) {
    navigator.clipboard.writeText(addr).then(() => {
        if(typeof showToast === 'function') showToast("Copied: " + addr, "success");
    });
}


   function renderMarketHealthTable(dataInput) {
       if (isHeaderTooltipOpen) {
        pendingHealthTableRenderData = dataInput;
        return;
    }

    const table = document.querySelector('.health-table');
    const tbody = document.getElementById('healthTableBody');
    if (!table || !tbody) return;

    let sourceList = dataInput || (typeof compList !== 'undefined' ? compList : []);
    
    let currentTab = 'running';
    if (typeof appData !== 'undefined') currentTab = appData.currentTab;
    else currentTab = localStorage.getItem('wave_active_tab') || 'running';
   
    const nowMs = Date.now();
    

    let projectsToRender = sourceList.filter(item => {
        let isEnded = false;
        if (item.end_at) { isEnded = nowMs > new Date(item.end_at).getTime(); } 
        else if (item.end) { 
            let eTimeStr = item.endTime || "23:59:59";
            if (eTimeStr.length === 5) eTimeStr += ":00";
            isEnded = nowMs > new Date(item.end + 'T' + eTimeStr + 'Z').getTime();
        }
        if (currentTab === 'running') return !isEnded;
        return isEnded;
    });

    if (typeof currentFilterDate !== 'undefined' && currentFilterDate) {
        projectsToRender = projectsToRender.filter(c => c.end === currentFilterDate);
    }

    let isHistoryTab = (typeof appData !== 'undefined' && (appData.currentTab === 'ended' || appData.currentTab === 'history')) || 
                       (localStorage.getItem('wave_active_tab') === 'ended' || localStorage.getItem('wave_active_tab') === 'history');

    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
    const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : translations['en'];

    const healthTitleEl = document.querySelector('[data-i18n="health_title"]');
    if(healthTitleEl) healthTitleEl.innerText = t.health_title;

 
    let thead = table.querySelector('thead');
    if (!thead) { thead = document.createElement('thead'); table.prepend(thead); }
    

    const getSortIcon = (k) => (typeof mhSort!=='undefined' && mhSort.col===k) ? (mhSort.dir==='asc'?'fa-sort-up sort-active':'fa-sort-down sort-active') : 'fa-sort sort-icon opacity-25';
    
    
    const thMain = "cursor:pointer; user-select:none; vertical-align:middle; text-align:center;";
    const thSub  = "cursor:pointer; user-select:none; text-align:center; font-size:0.7rem; color:#888; padding:6px; border-top:1px solid rgba(255,255,255,0.1); transition:color 0.2s;";
    const bLeft  = "border-left:1px solid rgba(255,255,255,0.1);";



thead.innerHTML = `
<tr class="h-top">
    <th rowspan="2" class="text-center" style="${thMain}" onclick="toggleHealthSort('token')">
        ${t.col_token} <i class="fas ${getSortIcon('token')}"></i>
    </th>
    
    <th rowspan="2" class="text-center tippy-header" style="${thMain}" onclick="toggleHealthSort('duration')" 
        data-tippy-content="${t.tip_time}">
        ${t.col_duration} <i class="fas ${getSortIcon('duration')}"></i>
    </th>

    <th rowspan="2" class="text-center tippy-header" style="${thMain}" onclick="toggleHealthSort('win_pool')"
        data-tippy-content="${t.tip_win_pool}">
        ${t.col_win_pool} <i class="fas ${getSortIcon('win_pool')}"></i>
    </th>

    <th rowspan="2" class="text-center tippy-header" style="${thMain}" onclick="toggleHealthSort('price_val')"
        data-tippy-content="${t.tip_price_val}">
        ${t.col_price_val} <i class="fas ${getSortIcon('price_val')}"></i>
    </th>

    <th rowspan="2" class="text-center tippy-header" style="${thMain}" onclick="toggleHealthSort('rule')"
        data-tippy-content="${t.tip_rule}">
        ${t.col_rule} <i class="fas ${getSortIcon('rule')}"></i>
    </th>
    
    <th colspan="3" class="text-center tippy-header" style="${thMain} ${bLeft}" 
        data-tippy-content="${t.tip_daily_vol}">
        ${t.col_daily_vol}
    </th>

    <th colspan="3" class="text-center tippy-header" style="${thMain} ${bLeft}" 
        data-tippy-content="${t.tip_camp_vol}">
        ${t.col_camp_vol}
    </th>

    <th rowspan="2" class="text-center tippy-header" style="${thMain} ${bLeft}" onclick="toggleHealthSort('min_vol')" 
        data-tippy-content="${t.tip_min_vol}">
        ${t.col_min_vol} <i class="fas ${getSortIcon('min_vol')}"></i>
    </th>

    <th rowspan="2" class="text-center px-2 tippy-header" style="${thMain}" onclick="toggleHealthSort('target')"
        data-tippy-content="${`<div style='text-align:left;'><b>${t.tip_pred_header_title}</b><br>${t.tip_pred_header_body}</div>`.replace(/"/g, '&quot;')}">
        ${t.col_target} <i class="fas ${getSortIcon('target')}"></i>
    </th>
</tr>

<tr class="h-sub">
    <th class="tippy-header" onclick="toggleHealthSort('d_lim')" 
        data-tippy-content="${t.tip_col_limit}"
        style="
                cursor: pointer; user-select: none; text-align: center; font-size: 0.7rem; color: #888; padding: 6px; 
                border-top: 1px solid rgba(255,255,255,0.1); border-left: 1px solid rgba(255,255,255,0.1);
                
                position: static !important; 
                left: auto !important; 
                z-index: 0 !important; 
                background-color: transparent !important; /* <--- SỬA THÀNH NHƯ NÀY */
                box-shadow: none !important;
            ">
        Limit <i class="fas ${getSortIcon('d_lim')}"></i>
    </th>

    <th style="${thSub}" class="tippy-header" onclick="toggleHealthSort('d_on')" 
        data-tippy-content="${t.tip_col_onchain}">
        OnChain <i class="fas ${getSortIcon('d_on')}"></i>
    </th>
    <th style="${thSub} color:#ccc;" class="tippy-header" onclick="toggleHealthSort('d_tot')" 
        data-tippy-content="${t.tip_col_total}">
        Total <i class="fas ${getSortIcon('d_tot')}"></i>
    </th>
    
    <th style="${thSub} ${bLeft}" class="tippy-header" onclick="toggleHealthSort('a_lim')" 
        data-tippy-content="${t.tip_col_limit}">
        Limit <i class="fas ${getSortIcon('a_lim')}"></i>
    </th>
    <th style="${thSub}" class="tippy-header" onclick="toggleHealthSort('a_on')" 
        data-tippy-content="${t.tip_col_onchain}">
        OnChain <i class="fas ${getSortIcon('a_on')}"></i>
    </th>
    <th style="${thSub} color:#ccc;" class="tippy-header" onclick="toggleHealthSort('a_tot')" 
        data-tippy-content="${t.tip_col_total}">
        Total <i class="fas ${getSortIcon('a_tot')}"></i>
    </th>
</tr>`;


    if (typeof mhSort !== 'undefined' && projectsToRender.length > 0) {
        if (isHistoryTab && mhSort.col === 'reward') { mhSort.col = 'duration'; mhSort.dir = 'desc'; }
        
        projectsToRender.sort((a, b) => {
            let pA = (a.market_analysis?.price) || (a.cachedPrice || 0);
            let pB = (b.market_analysis?.price) || (b.cachedPrice || 0);
            
     
            const getV = (i, k) => parseFloat(i[k] || 0);
            
     
            const getOnChainD = (i) => (i.onchain_daily_volume !== undefined) ? getV(i,'onchain_daily_volume') : Math.max(0, getV(i,'real_alpha_volume') - getV(i,'limit_daily_volume'));
            const getOnChainA = (i) => (i.onchain_accumulated_volume !== undefined) ? getV(i,'onchain_accumulated_volume') : Math.max(0, getV(i,'total_accumulated_volume') - getV(i,'limit_accumulated_volume'));

         
            const getTotAcc = (i) => {
                let v = getV(i, 'total_accumulated_volume');
                if(v===0) v = (i.real_vol_history||[]).reduce((sum,x)=>sum+parseFloat(x.vol),0) + getV(i,'real_alpha_volume');
                return v;
            };

            let valA, valB;
            switch(mhSort.col) {
                case 'token':     valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
               
                case 'd_lim':     valA = getV(a, 'limit_daily_volume'); valB = getV(b, 'limit_daily_volume'); break;
                case 'd_on':      valA = getOnChainD(a); valB = getOnChainD(b); break;
                case 'd_tot': case 'daily_vol': valA = getV(a, 'real_alpha_volume'); valB = getV(b, 'real_alpha_volume'); break;
                
              
                case 'a_lim':     valA = getV(a, 'limit_accumulated_volume'); valB = getV(b, 'limit_accumulated_volume'); break;
                case 'a_on':      valA = getOnChainA(a); valB = getOnChainA(b); break;
                case 'a_tot': case 'camp_vol': valA = getTotAcc(a); valB = getTotAcc(b); break;

                case 'duration':  valA = new Date(isHistoryTab ? a.end : a.start).getTime(); valB = new Date(isHistoryTab ? b.end : b.start).getTime(); break;
                case 'min_vol':   
                    let getT1 = (item) => {
                        let h = item.history || [];
                        let sorted = [...h].sort((a,b) => new Date(b.date) - new Date(a.date));
                        let f = sorted.find(x => parseFloat(x.target) > 0);
                        return f ? parseFloat(f.target) : 0;
                    };
                    valA = getT1(a); valB = getT1(b); break;
                default: valA = (parseFloat(a.rewardQty)||0) * pA; valB = (parseFloat(b.rewardQty)||0) * pB;
            }
            return (valA < valB ? -1 : 1) * (mhSort.dir === 'asc' ? 1 : -1);
        });
    }

    let html = '';

    if(projectsToRender.length === 0) {
        html = `<tr><td colspan="12" class="text-center py-4 text-sub opacity-50">No Data Available</td></tr>`;
    } else {
       
        const fmtNoDec = (num) => !num ? '$0' : '$' + Math.round(num).toLocaleString('en-US');
        const fmtCompact = (num) => !num ? '$0' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(num);
        const formatDateShort = (dateStr) => { if(!dateStr) return '--'; return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
        const now = new Date(); 
        const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1);
        const yestStr = yestDate.toISOString().split('T')[0];
        const dayBeforeDate = new Date(); dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
        const dayBeforeStr = dayBeforeDate.toISOString().split('T')[0];

        projectsToRender.forEach(c => {
            if (isHistoryTab && c.name && c.name.toUpperCase().includes('ARB')) return;
            let ma = c.market_analysis || {};
            
           
           let badgeHtml = '';
            if (c.listingTime) {
                let listingDate = new Date(c.listingTime);
                if (typeof c.listingTime === 'string' && !c.listingTime.includes('Z') && !c.listingTime.includes('+')) {
                    listingDate = new Date(c.listingTime + 'Z');
                }

                let expiryTime = new Date(Date.UTC(listingDate.getUTCFullYear(), listingDate.getUTCMonth(), listingDate.getUTCDate() + 29, 23, 59, 59, 999)).getTime();
                let diffDays = Math.ceil((expiryTime - now.getTime()) / 86400000);

                if (diffDays > 0) {
                    let badgeClass = (c.alphaType === 'x4') ? 'badge-bsc' : 'badge-alpha';
                    let mulText = c.alphaType === 'x4' ? 'x4' : (c.alphaType === 'x2' ? 'x2' : '');
                    
                    if (mulText !== '') {
                        badgeHtml = `<span class="smart-badge ${badgeClass}" style="text-transform: lowercase; margin-left: 3px; font-family: 'Rajdhani', sans-serif;">${mulText} ${diffDays}d</span>`;
                    }
                }
            }

            let contractHtml = c.contract ? `<div class="token-sub-row"><div class="contract-box" onclick="event.stopPropagation(); copyContract('${c.contract}')"><i class="far fa-copy"></i> ${c.contract.slice(0,4)}...${c.contract.slice(-4)}</div></div>` : '';
            
            let multiTokenHtml = '';
            if (c.inputTokens && c.inputTokens.length > 0) {
                multiTokenHtml = `<div class="token-sub-row" style="margin-top: 4px; font-size: 0.65rem; color: #00F0FF; background: rgba(0, 240, 255, 0.05); border: 1px dashed rgba(0, 240, 255, 0.3); padding: 2px 6px; border-radius: 4px; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: help;" title="${c.inputTokens.join(', ')}">
                    <i class="fas fa-layer-group"></i> ${c.inputTokens.length} Tokens: ${c.inputTokens.join(', ')}
                </div>`;
            }

            let cleanSym = c.name ? c.name.split('(')[0].trim().toUpperCase() : 'UNKNOWN';
            let alphaData = alphaMarketCache[cleanSym] || {};
            let localImgPath = c.logo || c.icon || alphaData.icon || './assets/tokens/default.png';
            let chainBadge = alphaData.chain_icon ? `<img src="${alphaData.chain_icon}" style="position:absolute; bottom:-2px; right:-2px; width:12px; height:12px; border-radius:50%; background:#000; border:1px solid #333;">` : '';

            let tokenHtml = `<div class="token-cell-wrapper" style="justify-content:center;display:flex;align-items:center;gap:8px;">
                <div style="position:relative; display:inline-block;">
                    <img src="${localImgPath}" onerror="this.src='./assets/tokens/default.png';" style="width:32px;height:32px;border-radius:50%;border:1px solid #333;flex-shrink:0;">
                    ${chainBadge}
                </div>
                <div class="token-info-col" style="text-align:left;">
    <div class="token-name-row"><span class="token-name-text" style="font-weight:700">${escHtml(c.name)}</span>${badgeHtml}</div>
    ${renderMultiplierPath(c)}
    ${multiTokenHtml}
</div></div>`;

            let sTime = c.startTime || "00:00:00"; if(sTime.length===5) sTime+=":00";
            let startDt = new Date(c.start + 'T' + sTime + 'Z');
            let eTime = c.endTime || "23:59:59"; if(eTime.length===5) eTime+=":00";
            let endDt = new Date(c.end + 'T' + eTime + 'Z');
            let isUpcoming = now < startDt;
            let isEnded = now > endDt;
            
            let countStr = t.txt_ended || 'Ended';
            let timeColor = "text-secondary";

            if (isUpcoming) {
                let diff = startDt - now;
                let d = Math.floor(diff/86400000); let h = Math.floor((diff%86400000)/3600000); let m = Math.floor((diff%3600000)/60000);
                let timeText = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
                countStr = `<i class="fas fa-hourglass-start"></i> In ${timeText}`;
                timeColor = "text-gold";
            } else if (!isEnded) {
                let diff = endDt - now;
                if (diff > 0) countStr = `${Math.floor(diff/86400000)}d ${Math.floor((diff%86400000)/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
                timeColor = "text-green";
            } else if (isHistoryTab) {
                countStr = `<span class="text-secondary" style="font-size:0.8rem">Ended: ${formatDateShort(c.end)}</span>`;
            }
            let durationHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary ${timeColor}" style="font-size:0.8rem; font-weight:bold">${countStr}</span><span class="cell-secondary">${c.start ? formatDateShort(c.start) + ' - ' + formatDateShort(c.end) : '--'}</span></div>`;

            let symName = c.name ? c.name.split('(')[0].trim().toUpperCase() : 'UNKNOWN';
let winPoolHtml = '';

if (c.rewardType === 'tiered' && c.tiers_data && c.tiers_data.length > 0) {
    winPoolHtml = `<div class="cell-stack justify-content-center">
                    <span class="cell-primary text-warning fw-bold anim-breathe" onclick="event.stopPropagation(); showTiersModal('${c.db_id}')" style="cursor:pointer; border-bottom:1px dashed #ffc107;">Tiered <i class="fas fa-list-ol"></i></span>
                    <span class="cell-secondary">Min ${(parseFloat(c.rewardQty)||0).toLocaleString()} ${symName}</span>
                   </div>`;
} else {
    winPoolHtml = `<div class="cell-stack justify-content-center">
                    <span class="cell-primary text-white">${c.topWinners ? c.topWinners.replace(/\(p\d+\)/gi, '').trim() : '--'}</span>
                    <span class="cell-secondary">${(parseFloat(c.rewardQty)||0).toLocaleString()} ${symName}</span>
                   </div>`;
}
            
            let price = parseFloat(c.cachedPrice) || parseFloat(ma.price) || 0;
            let pStr = '---';
            if (price > 0) {
                if (price >= 1) { pStr = '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } 
                else if (price >= 0.01) { pStr = '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }); } 
                else { pStr = '$' + parseFloat(price.toFixed(8)).toString(); }
            }
let priceValHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary live-pool-table-val" data-id="${c.db_id}" data-qty="${parseFloat(c.rewardQty)||0}" style="transition: color 0.1s ease;">${fmtCompact((parseFloat(c.rewardQty)||0) * price)}</span><span class="live-price-val" data-id="${c.db_id}" style="font-family: var(--font-num); font-size: 0.75rem; font-weight: 500; color: #848e9c; transition: color 0.1s ease;">${pStr}</span></div>`;
            let rt = c.ruleType || 'buy_only'; 
            let ruleHtml = `<div class="cell-stack align-items-center justify-content-center"><div class="rule-pill ${rt==='buy_only'?'rp-buy':'rp-all'} ${isHistoryTab?'opacity-50 grayscale':''}">${rt==='trade_x4'?t.rule_buy_sell:(rt==='trade_all'?t.rule_buy_sell:t.rule_buy)}</div><span class="cell-secondary" style="${rt==='trade_x4'?'color:#F0B90B;font-weight:700;opacity:1':'opacity:0'};font-size:0.65rem;margin-top:2px;">${rt==='trade_x4'?t.rule_limit_x4:'&nbsp;'}</span></div>`;

            let dLimit = parseFloat(c.limit_daily_volume || 0);
            let lh = c.real_vol_history || []; 
            if (dLimit === 0 && lh.length > 0) { 
                let checkDate = (isHistoryTab && c.end) ? c.end : yestStr; 
                let found = lh.find(x => x.date === checkDate);
                if (found) dLimit = parseFloat(found.limitVol || 0); 
                else if (lh.length > 0) dLimit = parseFloat(lh[lh.length-1].limitVol || 0);
            }
            let dTotal = parseFloat(c.real_alpha_volume || 0);
            let dOnChain = (c.onchain_daily_volume !== undefined) ? parseFloat(c.onchain_daily_volume) : Math.max(0, dTotal - dLimit);
            if(c.onchain_daily_volume !== undefined) dTotal = dLimit + dOnChain; // Re-sync

            
            let aLimit = parseFloat(c.limit_accumulated_volume || 0);
            if (aLimit === 0 && lh.length > 0) aLimit = lh.reduce((acc,curr)=>acc+parseFloat(curr.vol),0);
            let aTotal = parseFloat(c.total_accumulated_volume || 0);
            if (aTotal === 0 && (c.real_vol_history||[]).length>0) aTotal = c.real_vol_history.reduce((acc,i)=>acc+parseFloat(i.vol),0) + dTotal;
            let aOnChain = (c.onchain_accumulated_volume !== undefined) ? parseFloat(c.onchain_accumulated_volume) : Math.max(0, aTotal - aLimit);
            if(c.onchain_accumulated_volume !== undefined) aTotal = aLimit + aOnChain;

           
            let tPart = (c.endTime || "23:59:59").trim(); if(tPart.length===5) tPart+=":00";
            let diffMs = new Date(`${c.end}T${tPart}Z`) - now;
            let isFinalDay = (diffMs > 0 && diffMs <= 86400000); // Còn <= 24h là coi như ngày cuối
            let speedVal = parseFloat(ma.speed || 0);
            
            let showEst = (!isEnded && !isUpcoming && isFinalDay);
            let estLimit=aLimit, estOnChain=aOnChain, estTotal=aTotal;
            if (showEst && speedVal > 0) {
                let added = speedVal * (diffMs/1000);
                let ratio = dTotal>0 ? (dLimit/dTotal) : 0.5;
                estLimit += added*ratio; estOnChain += added*(1-ratio); estTotal += added;
            }

            const styBase = "text-center font-num";
            const bLeft   = "border-left:1px solid rgba(255,255,255,0.05);";
            const subEst = "display:block; font-size:0.75rem; color:#00FFFF; margin-top:1px; opacity:0.8;";

            let dailyColsHtml, accColsHtml;

            if (isUpcoming) {
                dailyColsHtml = `<td colspan="3" class="text-center text-sub opacity-50" style="${bLeft}">-- UPCOMING --</td>`;
                accColsHtml   = `<td colspan="3" class="text-center text-sub opacity-50" style="${bLeft}">--</td>`;
            } else {
                dailyColsHtml = `
                    <td class="${styBase}" style="${bLeft}"><span class="table-dyn-val" style="font-weight: 200;" id="tb-dlim-${c.db_id}">${fmtCompact(dLimit)}</span></td>
                    <td class="${styBase}"><span class="table-dyn-val" style="font-weight: 200;" id="tb-doc-${c.db_id}">${fmtCompact(dOnChain)}</span></td>
                    <td class="${styBase}"><span class="table-dyn-val" style="font-weight: 300; color: #fff;" id="tb-dtot-${c.db_id}">${fmtCompact(dTotal)}</span></td>
                `;
                accColsHtml = `
                    <td class="${styBase}" style="${bLeft}">
                        <span class="table-dyn-val" style="font-weight: 300;" id="tb-alim-${c.db_id}">${fmtCompact(aLimit)}</span> ${showEst ? `<span style="${subEst}" id="est-alim-${c.db_id}">Est: ${fmtCompact(estLimit)}</span>` : ''}
                    </td>
                    <td class="${styBase}">
                        <span class="table-dyn-val" style="font-weight: 300;" id="tb-aoc-${c.db_id}">${fmtCompact(aOnChain)}</span> ${showEst ? `<span style="${subEst}" id="est-aoc-${c.db_id}">Est: ${fmtCompact(estOnChain)}</span>` : ''}
                    </td>
                    <td class="${styBase}">
                        <span class="table-dyn-val" style="font-weight: 400; color: #fff;" id="tb-atot-${c.db_id}">${fmtCompact(aTotal)}</span> ${showEst ? `<span style="${subEst}" id="est-atot-${c.db_id}">Est: ${fmtCompact(estTotal)}</span>` : ''}
                    </td>
                `;
            }

       
            let h = c.history || [];
            let curTarget = 0, diff = 0, hasData = false;
            let latest = null; let prev = null;

            // Bốc thẳng 2 cấu hình mới nhất từ Supabase (bỏ qua ngày)
            let sortedHist = [...h].sort((a,b) => new Date(b.date) - new Date(a.date));
            let validItems = sortedHist.filter(x => parseFloat(x.target) > 0);
            
            if (validItems.length > 0) {
                latest = validItems[0]; // Số lưu mới nhất (Min Vol)
                curTarget = parseFloat(latest.target);
                if (validItems.length > 1) {
                    prev = validItems[1]; // Số liền kề trước đó (để tính % chênh lệch)
                    diff = curTarget - parseFloat(prev.target);
                    hasData = true;
                }
            }

            let diffHtml = `<span class="cell-secondary opacity-50">${t.txt_no_data || '--'}</span>`;
            if (hasData) {
                let pct = (curTarget - diff) > 0 ? ((diff / (curTarget - diff)) * 100).toFixed(1) : 0;
                let color = diff >= 0 ? 'text-green' : 'text-red';
                let sign = diff >= 0 ? '+' : '';
                diffHtml = `<span class="${color} cell-secondary" style="font-size:0.7rem; font-weight:bold">${sign}${Math.abs(diff).toLocaleString('en-US')} (${pct}%)</span>`;
            } else if (curTarget > 0) { diffHtml = `<span class="cell-secondary text-brand" style="font-size:0.6rem; font-weight:bold">${t.txt_new || 'NEW'}</span>`; }
            let minVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-gold">${fmtNoDec(curTarget)}</span></div>`;

            let aiTargetHtml = (typeof calculateAiTarget === 'function') ? calculateAiTarget(c, isHistoryTab) : '<td class="text-center">--</td>';
            
       
            html += `<tr style="cursor:pointer; border-bottom: 1px solid rgba(255,255,255,0.05);" onclick="jumpToCard('${c.db_id}')">
                <td class="text-center">${tokenHtml}</td>
                <td class="text-center">${durationHtml}</td>
                <td class="text-center">${winPoolHtml}</td>
                <td class="text-center">${priceValHtml}</td>
                <td class="text-center">${ruleHtml}</td>
                ${dailyColsHtml}
                ${accColsHtml}
                <td class="text-center font-num">${minVolHtml}</td>
                ${aiTargetHtml}
            </tr>`;
        });
    }

    tbody.innerHTML = html;


if (typeof initBinanceTooltips === 'function') {
    initBinanceTooltips();
}
}


function calculateAiTarget(c, isHistory = false) {
    if (!c) return '<td></td>';


    if (c.name && c.name.toUpperCase().includes('ARB')) {
        return '<td class="text-center"><span style="opacity:0.3; font-size:0.8rem">--</span></td>';
    }


    let prediction = c.ai_prediction || {};
    let target = parseFloat(prediction.target || 0);
    let delta = parseFloat(prediction.delta || 0);


    let now = new Date();
    let todayStr = now.toISOString().split('T')[0]; 
    let isFinalDay = (c.end === todayStr);

    let unlockTime = new Date();
    unlockTime.setUTCHours(0, 0, 0, 0); 
    
    let showPrediction = false;
    if (isHistory) {
        showPrediction = true; 
    } else {
        if (isFinalDay && now >= unlockTime) {
            showPrediction = true;
        }
    }


    let contentHtml = '';
    let isDisabled = false;
    let tipTitle = "";
    let tipBody = "";

    if (showPrediction && target > 0) {
        isDisabled = false; 
        tipTitle = "AI PREDICTION";
        tipBody = isHistory ? "Final AI result recorded." : "Forecast active.";


        let deltaHtml = '';
        if (delta !== 0) {
            let sign = delta > 0 ? '+' : '';


            let color = delta > 0 ? '#00FF99' : '#ff6b6b'; 
            

           
        }

        contentHtml = `
        <div style="line-height:1.1; display:flex; flex-direction:column; align-items:center;">
            <span class="text-discord fw-bold" style="font-size:1.1em;" id="table-target-${c.db_id}">$${Math.round(target).toLocaleString('en-US')}</span>
            ${deltaHtml}
        </div>`;

    } else {

        isDisabled = true;
        
        if (isHistory) {
            contentHtml = '<span style="color:#666; font-size:0.8rem">N/A</span>';
        } else {
            let tPart = (c.endTime || "13:00").trim();
            if(tPart.length === 5) tPart += ":00";
            let endObj = new Date(`${c.end}T${tPart}Z`); 
            let diffMs = endObj - now;

            if (isFinalDay && now < unlockTime) {
                let waitMs = unlockTime - now;
                let h = Math.floor(waitMs / 3600000);
                let m = Math.floor((waitMs % 3600000) / 60000);
                contentHtml = `<div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                    <span style="font-size:0.8rem; color:#6c757d; font-weight:600;"><i class="fas fa-clock me-1"></i> ${h}h ${m}m</span>
                    <span style="font-size:0.65rem; color:#00f2ea; animation: pulse 1s infinite;">Scanning...</span>
                </div>`;
                tipTitle = "SCANNING";
                tipBody = "Unlocks at 05:00 UTC.";
            } else if (diffMs > 0) {
                let days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                let hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                let timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                contentHtml = `<span style="font-size:0.8rem; color:#6c757d; font-weight:600;"><i class="fas fa-clock me-1"></i> ${timeStr}</span>`;
                tipTitle = "WAITING";
                tipBody = "Prediction activates on Final Day.";
            } else {
                contentHtml = `<span style="font-size:0.75rem; color:#aaa;">Ended</span>`;
            }
        }
    }


    let dbId = c.db_id || c.id || 'uid';
    let stats = (prediction && prediction.stats) ? prediction.stats : {};
    let seed = (typeof dbId === 'string') ? dbId.charCodeAt(0) : 70;
    let pctLow = stats.pct_low !== undefined ? stats.pct_low : ((seed % 15) + 20);
    let pctHigh = stats.pct_high !== undefined ? stats.pct_high : ((seed % 15) + 20);
    let pctMatch = 100 - pctLow - pctHigh;

    let voteKey = `vote_${dbId}`;
    let myVote = localStorage.getItem(voteKey); 
    let activeLow = myVote === 'low' ? 'active' : '';
    let activeMatch = myVote === 'match' ? 'active' : '';
    let activeHigh = myVote === 'high' ? 'active' : '';

    let trackStyle = '';
    let labelStyle = '';
    let tooltipAttr = '';

    if (isHistory) {
        trackStyle = 'style="pointer-events:none; border:none; background:transparent; box-shadow:none; opacity:0.8;"';
        labelStyle = 'style="display:none !important;"';
    } else if (isDisabled) {
        trackStyle = 'style="opacity:0.3; pointer-events:none; filter:grayscale(1);"';
        labelStyle = 'style="opacity:0.3; pointer-events:none; filter:grayscale(1);"';
    }

    if (!isDisabled) {
        let tooltipContent = tipTitle ? `<div class='cyber-tip-content'><div class='cyber-tip-header'><i class='fas fa-robot'></i> ${tipTitle}</div><div class='cyber-tip-body'>${tipBody}</div></div>` : '';
        tooltipAttr = tipTitle ? `data-bs-toggle="tooltip" data-bs-html="true" data-bs-custom-class="custom-cyber-tooltip" title="${tooltipContent.replace(/"/g, '&quot;')}"` : '';
    }

    return `
    <td class="text-center col-ai-target" style="vertical-align: middle;">
        <div class="ai-cell-micro" id="cell-${dbId}">
            <div id="popup-${dbId}" class="popup-micro" onclick="event.stopPropagation()">
                <input type="text" id="inp-${dbId}" class="mic-input" placeholder="Est.?" onkeydown="if(event.key==='Enter') saveMicVote('${dbId}')">
                <button class="mic-btn" onclick="saveMicVote('${dbId}')">OK</button>
            </div>
            
            <div class="ai-pred-val-micro" ${tooltipAttr}>${contentHtml}</div>
            
            <div class="track-micro" ${trackStyle}>
                <div class="seg-micro bg-mic-low ${activeLow}" style="width: ${pctLow}%" id="seg-low-${dbId}" onclick="submitVote('${dbId}', 'low')" title="Lower">
                    <span>${Math.round(pctLow)}%</span> <i class="fas fa-check icon-check"></i>
                </div>
                <div class="seg-micro bg-mic-match ${activeMatch}" style="width: ${pctMatch}%" id="seg-match-${dbId}" onclick="submitVote('${dbId}', 'match')" title="Agree">
                    <span>${Math.round(pctMatch)}%</span> <i class="fas fa-check icon-check"></i>
                </div>
                <div class="seg-micro bg-mic-high ${activeHigh}" style="width: ${pctHigh}%" id="seg-high-${dbId}" onclick="submitVote('${dbId}', 'high')" title="Higher">
                    <span>${Math.round(pctHigh)}%</span> <i class="fas fa-check icon-check"></i>
                </div>
            </div>

            <div class="labels-micro" ${labelStyle}>
                <span class="lbl-text-low" onclick="submitVote('${dbId}', 'low')">Lower</span>
                <span class="lbl-text-match" onclick="submitVote('${dbId}', 'match')">Agree</span>
                <span class="lbl-text-high" onclick="submitVote('${dbId}', 'high')">Higher</span>
            </div>
        </div>
    </td>`;
}


function submitVote(id, type) {
    if(event) event.stopPropagation();


    if (!currentUser) {
        showToast("Please login to vote!", "error");
        openLoginModal(); 
        return; 
    }



    const cell = document.getElementById(`cell-${id}`);
    if(cell) {
        cell.querySelectorAll('.seg-micro').forEach(el => el.classList.remove('active'));
    }


    let segId = (type === 'low') ? `seg-low-${id}` : (type === 'high') ? `seg-high-${id}` : `seg-match-${id}`;
    let activeSeg = document.getElementById(segId);
    

    if (type === 'match') {

        if(activeSeg) {
            activeSeg.classList.add('active');
            activeSeg.classList.add('showing-check');
            setTimeout(() => activeSeg.classList.remove('showing-check'), 1500);
        }

        let popup = document.getElementById(`popup-${id}`);
        if(popup) popup.classList.remove('show');
        
    } else {

        if(activeSeg) activeSeg.classList.add('active');
        

        document.querySelectorAll('.popup-micro').forEach(p => p.classList.remove('show')); 
        let popup = document.getElementById(`popup-${id}`);
        if(popup) {
            popup.classList.add('show');
            setTimeout(() => {
                let inp = document.getElementById(`inp-${id}`);
                if(inp) inp.focus();
            }, 50);
        }
    }


    localStorage.setItem(`vote_${id}`, type);


    callVoteBackend(id, type, null);
}


function saveMicVote(id) {
    let inp = document.getElementById(`inp-${id}`);
    let val = inp ? inp.value : null;
    

    let type = localStorage.getItem(`vote_${id}`) || 'low'; 
    

    callVoteBackend(id, type, val);
    

    let popup = document.getElementById(`popup-${id}`);
    if(popup) popup.classList.remove('show');
    

    let segId = (type === 'low') ? `seg-low-${id}` : `seg-high-${id}`;
    let seg = document.getElementById(segId);
    if(seg) {
        seg.classList.add('showing-check');
        setTimeout(() => seg.classList.remove('showing-check'), 1500);
    }
}


async function callVoteBackend(tournamentId, voteType, estVal) {

    if (!currentUser) return console.warn("Vote skipped: No user logged in");

    try {

        const { data, error } = await supabase
            .from('prediction_votes')
            .upsert({
                user_id: currentUser.id,
                tournament_id: parseInt(tournamentId),
                vote_type: voteType, 
                estimated_value: estVal ? parseFloat(estVal) : null,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'user_id, tournament_id'  
            });

        if (error) throw error;
        console.log("✅ Vote synced to DB:", voteType);

    } catch (e) {
        console.error("❌ Vote Sync Error:", e.message);

        if(e.code === '42501') console.warn("RLS Policy chặn ghi dữ liệu.");
    }
}

             

    
    let draggedItem = null;
    function allowDrop(ev) { ev.preventDefault(); }

    function drag(ev) {
        draggedItem = ev.currentTarget;
        ev.dataTransfer.effectAllowed = 'move';
        ev.currentTarget.querySelector('.tour-card').classList.add('dragging');
    }

    function drop(ev) {
        ev.preventDefault();
        if(!draggedItem) return;
        draggedItem.querySelector('.tour-card').classList.remove('dragging');
        let targetItem = ev.target.closest('.card-wrapper');
        if (draggedItem !== targetItem && targetItem) {
            let container = document.getElementById('appGrid');
            let dragIdx = [...container.children].indexOf(draggedItem);
            let dropIdx = [...container.children].indexOf(targetItem);
            if (dragIdx < dropIdx) targetItem.after(draggedItem); else targetItem.before(draggedItem);
    showToast("Position changed! Click SAVE POSITION to save.", "info"); 
}
    }

    async function saveCustomOrder() {

    if(!confirm("Save current position?")) return;

    let btns = document.querySelectorAll('.btn-save-pos');
    btns.forEach(btn => {
        btn.dataset.oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
        btn.disabled = true;
    });

    try {
        const container = document.getElementById('appGrid');
        const items = container.querySelectorAll('.card-wrapper');
        let updates = [];

        items.forEach((item, index) => {
            let dbId = parseInt(item.getAttribute('data-id'));
            let comp = compList.find(c => c.db_id === dbId);
            if(comp) {
                comp.orderIndex = index;
                updates.push(comp);
            }
        });

        for (let item of updates) {
            let dataToSave = { ...item };
            delete dataToSave.db_id;
            delete dataToSave.id;
            delete dataToSave.cachedPrice;
            dataToSave.history = item.history || [];
            dataToSave.predictions = item.predictions || [];

            await supabase.from('tournaments').update({
                data: dataToSave
            }).eq('id', item.db_id);
        }

        showToast("Position saved successfully!", "success"); 
        await loadFromCloud(false);

    } catch (e) {
        console.error(e);
        showToast("Error saving: " + e.message, "error"); 
    } finally {
        btns.forEach(btn => {
            btn.innerHTML = btn.dataset.oldText || '<i class="fas fa-save me-1"></i> SAVE POSITION';
            btn.disabled = false;
        });
    }
}

    

    function switchTab(t) { document.querySelectorAll('.p-tab').forEach(el=>el.classList.remove('active')); document.getElementById(`tab-${t}`).classList.add('active'); ['chart','activity','chat'].forEach(x => document.getElementById(`content-${x}`).style.display = x===t ? (x==='chat'?'flex':'block') : 'none'); }

        
function switchMainTab(tab) {
    // 1. Cập nhật trạng thái Active cho nút (Market, Comp, Sonar)
    document.querySelectorAll('#alpha-tab-nav .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('btn-tab-' + tab);
    if (activeBtn) activeBtn.classList.add('active');

    // 2. Ẩn tất cả các màn hình nội dung
    const views = ['alpha-market-view', 'view-dashboard', 'sonar-market-view', 'view-predict'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 3. Hiển thị màn hình tương ứng
    if (tab === 'market') {
        document.getElementById('alpha-market-view').style.display = 'block';
    } else if (tab === 'comp') {
        document.getElementById('view-dashboard').style.display = 'block';
        if (typeof renderGrid === 'function') renderGrid(); 
    } else if (tab === 'sonar') {
        document.getElementById('sonar-market-view').style.display = 'block';
        // Ép Radar vẽ lại để không bị đen màn hình
        const sonar = ensureSonarGalaxy();
        if (sonar) {
            setTimeout(() => sonar.resize(), 50);
        }
    }
}

function updateTerminalData(id) {
    let c = compList.find(x => x.db_id == id); if(!c) return;
    

    document.getElementById('pt-symbol').innerText = c.name;
    

let logoEl = document.getElementById('pt-logo');

let rawName = c.name ? c.name.toUpperCase().trim() : "UNKNOWN";
let cleanSymbol = rawName.split('(')[0].trim(); 


let alphaInfo = alphaMarketCache[cleanSymbol] || {};





let localImgPath = c.logo || c.icon || alphaInfo.icon || './assets/tokens/default.png';


logoEl.src = localImgPath;
logoEl.onerror = function() { 
    this.onerror = null; 
    this.src = './assets/tokens/default.png'; 
};

    
    

    let curMin = (c.history && c.history.length > 0) ? c.history[c.history.length-1].target : 0;
    document.getElementById('pt-min-vol').innerText = fmtNum(curMin);
    
    let totalPool = (c.predictions?.length || 0) * PREDICT_FEE;
    document.getElementById('pt-pool').innerText = fmt(totalPool);


    let isEnded = false;
    if(c.end) {

        let endString = c.end + 'T' + (c.endTime || '23:59:59') + 'Z';
        let endTime = new Date(endString).getTime();
        

        if(Date.now() > endTime) isEnded = true;
    }


    let btn = document.getElementById('btn-predict-action');
    if(isEnded) {
        btn.innerHTML = '<span>MARKET CLOSED</span> <i class="fas fa-lock"></i>';
        btn.classList.add('btn-ended'); 
        btn.disabled = true; 
    } else {
        btn.innerHTML = '<span>ENTER PREDICTION</span> <i class="fas fa-bolt"></i>';
        btn.classList.remove('btn-ended');
        btn.disabled = false; 
        btn.onclick = openInputModal; 
    }


    let changeHtml = '';
    if (c.history && c.history.length >= 2) {
        let todayVal = parseFloat(c.history[c.history.length - 1].target);
        let yestVal = parseFloat(c.history[c.history.length - 2].target);
        let diff = todayVal - yestVal;
        let pct = yestVal > 0 ? ((diff / yestVal) * 100).toFixed(2) : 0;
        let color = diff >= 0 ? '#0ECB81' : '#F6465D';
        let icon = diff >= 0 ? 'fa-caret-up' : 'fa-caret-down';
        changeHtml = `<span style="color:${color}; font-size:0.8rem; font-weight:bold"><i class="fas ${icon} me-1"></i>${diff>=0?'+':''}${pct}% (24h)</span>`;
    }
    document.getElementById('pt-vol-change').innerHTML = changeHtml;


    if(!marketChart) {
        let ctx = document.getElementById('marketChart').getContext('2d');
        let labels=[], data=[];
        if(c.history) c.history.forEach(h=>{ labels.push(h.date.substring(5)); data.push(h.target); });
        
        marketChart = new Chart(ctx, { 
             type: 'line', 
             data: { labels, datasets: [{ 
                 label: 'Min Vol', data, borderColor: '#00F0FF', 
                 backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
                    gradient.addColorStop(1, 'rgba(0, 240, 255, 0)');
                    return gradient;
                },
                fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 
             }]}, 
             options: { 
                 responsive: true, maintainAspectRatio: false, 
                 interaction: { intersect: false, mode: 'index' },
                 scales: { 
                     x:{ display:true, grid:{display:false}, ticks:{color:'#555', font:{size:9}} }, 
                     y:{ grid:{color:'#222', borderDash:[5,5]}, ticks:{color:'#666', font:{family:'Rajdhani'}} } 
                 }, 
                 plugins:{ legend:{display:false} } 
             } 
         });
    } else {
        let labels=[], data=[];
        if(c.history) c.history.forEach(h=>{ labels.push(h.date.substring(5)); data.push(h.target); });
        marketChart.data.labels = labels;
        marketChart.data.datasets[0].data = data;
        marketChart.update();
    }



    let lb = document.getElementById('pt-leaderboard');
        if (lb) { 
            lb.innerHTML = ''; 
            

            let preds = (c.predictions || []).sort((a, b) => {
                let aValid = a.guess >= curMin;
                let bValid = b.guess >= curMin;


                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;


                if (aValid && bValid) {
                    return a.guess - b.guess;
                } 

                else {
                    return b.guess - a.guess;
                }
            });
            
            if(preds.length === 0) lb.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-sub opacity-50">No Data</td></tr>';

            preds.forEach((p, i) => {

                let isValid = p.guess >= curMin;
                

                let rankColor = isValid 
                    ? (i===0?'#FFD700':(i===1?'#C0C0C0':(i===2?'#CD7F32':'#666'))) 
                    : '#333'; 

                let rankText = isValid ? `#${i + 1}` : '<i class="fas fa-times"></i>'; 

                let badgeHtml = `<span class="rank-badge" style="background:${rankColor}; color:${isValid && i<3 ? '#000' : '#fff'}; border:1px solid #444">${rankText}</span>`;
                
                let avatarHtml = p.avatar ? `<img src="${p.avatar}" class="list-avatar">` : `<div class="list-avatar-placeholder">${p.name.substring(0, 1).toUpperCase()}</div>`;
                

                let myName = document.getElementById('modal-p-name')?.value || '';
                let highlightClass = (p.name === myName) ? 'anim-breathe' : '';
                

                let rowStyle = isValid ? '' : 'opacity: 0.4; filter: grayscale(1);';

                lb.innerHTML += `
                <tr class="${highlightClass}" style="${rowStyle}">
                    <td class="ps-4 align-middle">${badgeHtml}</td>
                    <td class="align-middle">
                        <div class="d-flex align-items-center gap-2">
                            ${avatarHtml}
                            <span class="text-white small fw-bold">${p.name}</span>
                        </div>
                    </td>
                    <td class="text-end pe-4 align-middle font-num fw-bold" style="color:${isValid ? 'var(--brand)' : '#666'}">
                        ${fmtNum(p.guess)}
                    </td>
                </tr>`;
            });
        }

    let chatDiv = document.getElementById('chat-feed');
    if(chatDiv) {
        chatDiv.innerHTML = '';
        (c.comments || []).sort((a,b)=>a.time-b.time).forEach(m => {
            let isMe = m.user === (userProfile?.nickname || currentUser?.email.split('@')[0]);
            chatDiv.innerHTML += `<div class="mb-2 d-flex ${isMe?'justify-content-end':''}"><div style="background:${isMe?'var(--brand)':'#222'}; color:${isMe?'#000':'#ddd'}; padding:5px 10px; border-radius:10px; font-size:0.8rem; max-width:85%"><div class="fw-bold" style="font-size:0.65rem; opacity:0.7; margin-bottom:2px">${m.user}</div>${DOMPurify.sanitize(m.text)}</div></div>`;
        });
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }
}

    function openInputModal() {

    if (!currentPolyId) return showToast("System Error: No Tournament Selected", "error");

    let c = compList.find(x => x.db_id == currentPolyId);
    

    if (!c) {
        console.error("Data missing for ID: " + currentPolyId);
        return showToast("Data not ready. Please reload page!", "error");
    }


    if(c.end) {

        let endString = c.end + 'T' + (c.endTime || '23:59:59') + 'Z';
        let endTime = new Date(endString).getTime();
        

        if(Date.now() > endTime) {
            return showToast("⛔ Tournament has ENDED! Prediction closed.", "error");
        }
    }


    if(!currentUser) { showToast("Please login to predict!", "error"); return; }
    

    if((userProfile.balance_usdt || 0) < PREDICT_FEE) {
        return showToast(`Insufficient Balance! You need ${PREDICT_FEE} USDT.`, "error");
    }

    let displayName = userProfile?.nickname || currentUser.email.split('@')[0];
    let nameInput = document.getElementById('modal-p-name');
    if(nameInput) {
        nameInput.value = displayName;
        nameInput.disabled = true;
    }
    
    let guessInput = document.getElementById('modal-p-guess');
    if(guessInput) guessInput.placeholder = `Fee: ${PREDICT_FEE} USDT`;

    new bootstrap.Modal(document.getElementById('inputModal')).show();
}

async function submitPredictionFromModal() {
    let nameInput = document.getElementById('modal-p-name');
    let guessInput = document.getElementById('modal-p-guess');
    

    let name = nameInput.value.trim();
    let guess = parseFloat(guessInput.value);

    if(!currentUser) return showToast("Please Login to predict!", "error");
    if(!name) return showToast("Nickname required", "error");
    if(isNaN(guess) || guess < 0) return showToast("Invalid Prediction Volume", "error");


    let btn = document.querySelector('#inputModal .btn-action');
    let oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> PROCESSING...';
    btn.disabled = true;

    try {

        const { data, error } = await supabase.rpc('submit_prediction_action', {
            p_tourn_id: parseInt(currentPolyId),
            p_guess: guess,
            p_name: name,
            p_avatar: userProfile?.avatar_url || ''
        });

        if (error) throw error;
        if (data && data.status === 'error') throw new Error(data.message);


        if(data && data.new_balance !== undefined) {
            userProfile.balance_usdt = data.new_balance;
            document.getElementById('user-balance').innerText = fmtNum(data.new_balance);
        }

        showToast(`🚀 ENTRY CONFIRMED! (-${PREDICT_FEE} USDT)`, "success");
        playSfx('click');
        

        bootstrap.Modal.getInstance(document.getElementById('inputModal')).hide();



        renderStats();


        if(currentPolyId) await silentReload(currentPolyId);


        setTimeout(() => { 
             generateShareCard(guess);
        }, 800);

    } catch (e) {
        console.error(e);
        showToast("Error: " + e.message, "error");
        playSfx('hover');
    } finally {

        if(btn) {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
}



    


async function saveToCloud(compObj) {

    let cloudObj = { ...compObj };
    

    delete cloudObj.myProgress; 
    delete cloudObj.db_id; 
    delete cloudObj.id; 
    delete cloudObj.cachedPrice;
    




    const payload = { 
        name: cloudObj.name, 
        contract: cloudObj.contract, 
        data: cloudObj 
    };

    console.log("Saving payload:", payload); 

    let result;
    

    if (compObj.db_id) {

        result = await supabase
            .from('tournaments')
            .update(payload)
            .eq('id', parseInt(compObj.db_id))
            .select(); 
    } else {

        result = await supabase
            .from('tournaments')
            .insert([payload])
            .select();
    }


        if (result.error) throw result.error;
    
    if (!result.data || result.data.length === 0) {
        console.error("Save failed (RLS Blocked). Result:", result);

        throw new Error("ADMIN PERMISSION ERROR! Database refused to save. Check RLS Policies.");
    }

    console.log("Save Success:", result.data);


    await loadFromCloud(false);
}


    function openUpdateModal(dbId) {
        let c=compList.find(x=>x.db_id==dbId); if(!c)return;
        document.getElementById('u-db-id').value=dbId; document.getElementById('u-symbol-display').innerText=c.name;
        let today=new Date().toISOString().split('T')[0];
        document.getElementById('u-original-date').value = "";
        document.getElementById('u-date').value=today;

        let min=document.getElementById('u-min-vol');
        if(document.body.classList.contains('is-admin')){ min.disabled=false; min.placeholder="Admin Edit"; } else { min.disabled=true; min.placeholder="---"; }
        let html='';
        accSettings.forEach(acc=>{
            html+=`<div class="acc-input-row" id="row-${acc.id}"><span style="color:${acc.color}; font-weight:700;">${acc.name}</span><input type="number" class="form-control font-num text-center text-brand" id="u-vol-${acc.id}" placeholder="Volume" oninput="calcRowGap('${acc.id}')"><div class="d-flex align-items-center gap-2"><span class="font-num fw-bold text-sub small" id="gap-display-${acc.id}" style="width:70px; text-align:right;">---</span><input type="number" class="form-control font-num text-end text-danger" id="u-cost-${acc.id}" placeholder="Cost ($)" style="max-width:80px"></div></div>`;
        });
        document.getElementById('u-acc-inputs').innerHTML=html; loadDateData(today); document.getElementById('u-date').onchange=function(){loadDateData(this.value)}; new bootstrap.Modal(document.getElementById('updateModal')).show();
    }

    function calcRowGap(accId) {
        let minInput = document.getElementById('u-min-vol').value.replace(/,/g, '');
        let min = parseFloat(minInput) || 0;
        let vol = parseFloat(document.getElementById(`u-vol-${accId}`).value) || 0;
        let gap = vol - min;
        let el = document.getElementById(`gap-display-${accId}`);
        if(min > 0) { el.innerText = (gap>=0 ? '+' : '') + fmtNum(gap); el.className = `font-num fw-bold small ${gap>=0?'text-green':'text-red'}`; } else { el.innerText = '---'; }
    }


    function loadDateData(d) {
        let id=document.getElementById('u-db-id').value; let c=compList.find(x=>x.id==id);
        let min=0;
        if(c.history){let e=c.history.find(h=>h.date===d); if(e)min=e.target; else if(c.history.length>0)min=c.history[c.history.length-1].target;}
        let minInput = document.getElementById('u-min-vol');
        minInput.value=fmtNum(min).replace(/\./g, '');
        formatCurrency(minInput);

        accSettings.forEach(acc=>{ document.getElementById(`u-vol-${acc.id}`).value=''; document.getElementById(`u-cost-${acc.id}`).value=''; calcRowGap(acc.id); });


        let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[id]) ? userProfile.tracker_data[id] : [];

        if(myProgress){
            let p = myProgress.find(x => x.date === d);
            if(p && p.accsDetail){
                accSettings.forEach(acc=>{
                    if(p.accsDetail[acc.id]){
                        document.getElementById(`u-vol-${acc.id}`).value=p.accsDetail[acc.id].vol;
                        document.getElementById(`u-cost-${acc.id}`).value=p.accsDetail[acc.id].cost;
                        calcRowGap(acc.id);
                    }
                })
            }
        }
        renderTrackerChart(c); renderHistoryList(c);
    }

    function loadHistoryToEdit(date) {
        document.getElementById('u-date').value = date;
        document.getElementById('u-original-date').value = date;
        loadDateData(date);
        document.getElementById('u-date').focus();
    }

    function renderTrackerChart(c) {
        const ctx = document.getElementById('trackerChart').getContext('2d');
        if(trackerChart) trackerChart.destroy();

        let labels=[], minData=[], dates=new Set();
        if(c.history) c.history.forEach(x => dates.add(x.date));


        let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[c.id]) ? userProfile.tracker_data[c.id] : [];
        if(myProgress) myProgress.forEach(x => dates.add(x.date));

        let sortedDates = Array.from(dates).sort();

        minData = sortedDates.map(d => {
            let h = c.history ? c.history.find(x => x.date === d) : null;
            return h ? h.target : 0;
        });

        let datasets = [{
            label: 'Target (Min)',
            data: minData,
            borderColor: '#F0B90B',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            fill: false,
            order: 0
        }];

        accSettings.forEach(acc => {
            let accData = [];
            sortedDates.forEach(d => {
                let p = myProgress ? myProgress.find(x => x.date === d) : null;
                let vol = (p && p.accsDetail && p.accsDetail[acc.id]) ? parseFloat(p.accsDetail[acc.id].vol) : 0;
                accData.push(vol);
            });

            datasets.push({
                label: acc.name,
                data: accData,
                borderColor: acc.color,
                backgroundColor: acc.color,
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: (ctx) => {
                    let idx = ctx.dataIndex;
                    let val = ctx.raw;
                    let target = minData[idx] || 0;
                    return val >= target ? '#0ECB81' : '#F6465D';
                },
                pointBorderColor: '#fff',
            });
        });

        trackerChart = new Chart(ctx, {
            type: 'line',
            data: { labels: sortedDates.map(d => d.substring(5)), datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#aaa', boxWidth: 10, font: {size: 10} } },
                    tooltip: {
                        enabled: true, backgroundColor: 'rgba(22, 26, 30, 0.95)', titleColor: '#00F0FF',
                        titleFont: { family: 'Rajdhani', size: 14, weight: 'bold' },
                        bodyColor: '#fff', bodyFont: { family: 'Rajdhani', size: 13 },
                        borderColor: '#333', borderWidth: 1, padding: 10, displayColors: true, boxPadding: 4,
                        callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += new Intl.NumberFormat('en-US').format(context.parsed.y); } return label; } }
                    }
                },
                scales: { x: { display: true, ticks: { color: '#555', font:{size:9} }, grid: {display:false} }, y: { display: false } }
            }
        });
    }



function renderHistoryList(c) {

    let headerHtml = `<th class="text-sub small">Date</th><th class="text-gold small">Target</th>`;
    accSettings.forEach(acc => { headerHtml += `<th class="small text-center" style="color:${acc.color}">${acc.name}</th>`; });
    headerHtml += `<th class="text-end small">Action</th>`;
    document.getElementById('historyHeader').innerHTML = headerHtml;

    const l = document.getElementById('historyList');
    l.innerHTML = '';


    let adminHistory = c.history || [];
    let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[c.id]) ? userProfile.tracker_data[c.id] : [];


    let startDateStr = c.start;

    if (!startDateStr) {
        let allDates = [...adminHistory.map(h=>h.date), ...myProgress.map(p=>p.date)];
        if(allDates.length > 0) startDateStr = allDates.sort()[0];
        else startDateStr = new Date().toISOString().split('T')[0];
    }


    let now = new Date();
    let todayStr = now.toISOString().split('T')[0]; 



    let limitStr = todayStr;


    if (c.end) {


        if (c.end < todayStr) {
            limitStr = c.end;
        }
    }


    let timelineData = [];
    let lastKnownTarget = 0;
    let lastKnownVols = {}; 
    accSettings.forEach(acc => lastKnownVols[acc.id] = 0);


    let loopDate = new Date(startDateStr);

    loopDate.setHours(12,0,0,0); 


    while (true) {
        let dStr = loopDate.toISOString().split('T')[0];
        

        if (dStr > limitStr) break;


        let realAdminData = adminHistory.find(h => h.date === dStr);
        if (realAdminData) lastKnownTarget = parseFloat(realAdminData.target);


        let realUserData = myProgress.find(p => p.date === dStr);
        let currentDayVols = {};
        
        accSettings.forEach(acc => {
            if (realUserData && realUserData.accsDetail && realUserData.accsDetail[acc.id]) {
                let v = parseFloat(realUserData.accsDetail[acc.id].vol);
                lastKnownVols[acc.id] = v; 
            }
            currentDayVols[acc.id] = lastKnownVols[acc.id]; 
        });

        let isAutoFill = !realUserData; 

        timelineData.push({
            date: dStr,
            target: lastKnownTarget,
            vols: currentDayVols,
            isAuto: isAutoFill
        });


        loopDate.setDate(loopDate.getDate() + 1);
    }


    timelineData.reverse().forEach(item => {
        let dateDisplay = item.date.substring(5); 
        let targetDisplay = fmtNum(item.target);
        
        let accCells = '';
        accSettings.forEach(acc => {
            let vol = item.vols[acc.id];
            let cls = vol >= item.target && item.target > 0 ? 'text-green fw-bold' : (vol > 0 ? 'text-white' : 'text-sub opacity-50');
            accCells += `<td class="text-center font-num ${cls}">${vol > 0 ? fmtNum(vol) : '-'}</td>`;
        });


        let deleteBtn = item.isAuto 
            ? `<i class="fas fa-trash text-secondary opacity-25" style="cursor:not-allowed" title="Auto-filled"></i>` 
            : `<i class="fas fa-trash text-danger cursor-pointer" onclick="deleteHistory('${item.date}')" title="Delete"></i>`;

        l.innerHTML += `<tr>
            <td class="font-num text-sub">${dateDisplay}</td>
            <td class="text-gold font-num fw-bold">${targetDisplay}</td>
            ${accCells}
            <td class="text-end">
                <i class="fas fa-pencil-alt text-secondary me-3 cursor-pointer" onclick="loadHistoryToEdit('${item.date}')" title="Edit"></i>
                ${deleteBtn}
            </td>
        </tr>`;
    });
}

    async function deleteHistory(date) {
        if(!confirm("Delete history for " + date + "?")) return;
        let id = document.getElementById('u-db-id').value;
        let c = compList.find(x => x.id == id);


        if(userProfile.tracker_data && userProfile.tracker_data[id]) {
            userProfile.tracker_data[id] = userProfile.tracker_data[id].filter(p => p.date !== date);

            await supabase.from('profiles').update({ tracker_data: userProfile.tracker_data }).eq('id', currentUser.id);
        }

        if(document.body.classList.contains('is-admin')) {
             if(c.history) {
                 c.history = c.history.filter(h => h.date !== date);
                 await saveToCloud(c);
             }
        } else {
            renderTrackerChart(c);
            renderHistoryList(c);
        }
        if(document.getElementById('u-date').value === date) {
             document.getElementById('u-date').value = new Date().toISOString().split('T')[0];
             loadDateData(document.getElementById('u-date').value);
        } else {
             loadDateData(document.getElementById('u-date').value);
        }
    }


async function saveAdminTargetOnly() {
    if (!document.body.classList.contains('is-admin')) return;
    
    let btn = document.querySelector('#updateModal .btn-warning');
    let orgHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        let rawId = document.getElementById('u-db-id').value;
        let dbId = parseInt(rawId);
        let c = compList.find(x => x.db_id === dbId);
        let date = document.getElementById('u-date').value;
        let minInput = document.getElementById('u-min-vol');

        if (minInput.value.trim() === "") throw new Error("Min Volume is empty!");

        let minValStr = minInput.value.replace(/,/g, '');
        let t = parseFloat(minValStr);


        if (!Array.isArray(c.history)) c.history = [];
        c.history = c.history.filter(h => h.date !== date); 
        c.history.push({ date: date, target: t });
        c.history.sort((a, b) => new Date(a.date) - new Date(b.date));


        await saveToCloud(c);


        let newMinVol = new Intl.NumberFormat('en-US').format(t);


        showToast("✅ Target Updated & Alert Sent!", "success");
        

        renderTrackerChart(c);
        renderHistoryList(c);
        renderGrid();

    } catch (e) {
        console.error(e);
        showToast("Error: " + e.message, "error");
    } finally {
        btn.innerHTML = orgHtml; btn.disabled = false;
    }
}


async function saveUpdate() {

    if (!currentUser) return showToast("Please login first!", "error");


    let btn = document.getElementById('btn-save-progress');
    let orgText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
    btn.disabled = true;

    try {

        let rawId = document.getElementById('u-db-id').value;
        let dbId = parseInt(rawId);
        

        let c = compList.find(x => x.db_id === dbId);
        if (!c) throw new Error("Tournament not found");

        let date = document.getElementById('u-date').value;


        let my = {};
        if (typeof accSettings !== 'undefined' && Array.isArray(accSettings)) {
            accSettings.forEach(acc => {
                let volInput = document.getElementById(`u-vol-${acc.id}`);
                let costInput = document.getElementById(`u-cost-${acc.id}`);
                
                let v = volInput ? parseFloat(volInput.value || 0) : 0;
                let cost = costInput ? parseFloat(costInput.value || 0) : 0;

                my[acc.id] = { vol: v, cost: cost };
            });
        }


        if (!userProfile.tracker_data) userProfile.tracker_data = {};
        if (!userProfile.tracker_data[dbId]) userProfile.tracker_data[dbId] = [];


        userProfile.tracker_data[dbId] = userProfile.tracker_data[dbId].filter(p => p.date !== date);


        let hasData = Object.values(my).some(x => x.vol > 0 || x.cost > 0);
        if (hasData) {
            userProfile.tracker_data[dbId].push({ date: date, accsDetail: my });
        }



        const { error } = await supabase
            .from('profiles')
            .update({ tracker_data: userProfile.tracker_data })
            .eq('id', currentUser.id);

        if (error) throw error;


        showToast("Personal Data saved successfully!", "success");


        btn.innerHTML = '<i class="fas fa-check"></i> SAVED!';
        btn.style.background = "#0ECB81";
        btn.style.color = "#000";


        setTimeout(() => {
            btn.innerText = orgText;
            btn.style.background = "";
            btn.style.color = "";
            btn.disabled = false;


            if (typeof renderTrackerChart === 'function') renderTrackerChart(c);
            if (typeof renderHistoryList === 'function') renderHistoryList(c);
            if (typeof renderGrid === 'function') renderGrid();
        }, 1000);

    } catch (e) {

        console.error("Save Error:", e);
        showToast("Error: " + (e.message || e), "error");
        
        btn.innerText = "ERROR";
        setTimeout(() => { 
            btn.innerText = orgText; 
            btn.disabled = false; 
        }, 3000);
    }
}


    async function settleTournament() {
        if(!confirm("CONFIRM: End tournament and distribute rewards automatically (Server-side)?")) return;

        let c = compList.find(x => x.db_id == currentPolyId);

        document.getElementById('loading-overlay').style.display = 'flex';


        const { data, error } = await supabase.rpc('settle_tournament', { tourn_id: parseInt(currentPolyId) });

        document.getElementById('loading-overlay').style.display = 'none';

        if(error) {
            console.error(error);
            showToast("Settlement Failed: " + error.message, "error");
        } else if (data.status === 'error') {
            showToast("Logic Error: " + data.message, "error");
        } else {
            showToast("SETTLEMENT COMPLETE! Check History.", "success");
            alert(`Result (Min Vol): ${fmtNum(data.actualVol)}\nPool: ${data.pool} $\nWinners:\n${data.winners.join('\n')}`);
            loadFromCloud();
        }
    }


    async function syncLocalToCloud() {
    if(!currentUser) return showToast("Please login first!", "error"); 


    if(!confirm("This action will OVERWRITE Cloud data with local data. Are you sure?")) return;

    let migrationData = {};
    let count = 0;

    for(let i=0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if(key.startsWith('wave_progress_')) {
            let dbId = key.replace('wave_progress_', '');
            try {
                let data = JSON.parse(localStorage.getItem(key));
                migrationData[dbId] = data;
                count++;
            } catch(e) {}
        }
    }

    if(count === 0) return showToast("No local data found on this device!", "error"); 

    let btn = document.querySelector('button[onclick="syncLocalToCloud()"]');
    let oldText = btn.innerHTML;
    btn.innerHTML = "UPLOADING..."; btn.disabled = true;

    const { error } = await supabase.from('profiles').update({ tracker_data: migrationData }).eq('id', currentUser.id);

    btn.innerHTML = oldText; btn.disabled = false;

    if(error) {
        showToast("Error: " + error.message, "error"); 
    } else {
        showToast(`Success! Migrated ${count} tournaments to Cloud.`, "success"); 
        if(userProfile) userProfile.tracker_data = migrationData;
        renderGrid();
        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
    }
}


        function openSettingsModal() {
        let list = document.getElementById('settingsList');
        list.innerHTML = '';
        accSettings.forEach((acc, i) => {
            list.innerHTML += `
            <div class="d-flex align-items-center gap-2">
                <input type="color" class="form-control form-control-color" value="${acc.color}" onchange="updateAccColor(${i}, this.value)" style="height:35px;width:50px">
                <input value="${acc.name}" class="form-control form-control-sm" onchange="updateAccName(${i}, this.value)" placeholder="Account Name">
                <button class="btn btn-sm btn-outline-danger border-0" onclick="delAcc(${i})"><i class="fas fa-trash"></i></button>
            </div>`;
        });
        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    }



function updateAccName(i, val) { 
    accSettings[i].name = val; 
    localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
    updateCloudWallets(); 
    renderGrid(); 
}

function updateAccColor(i, val) { 
    accSettings[i].color = val; 
    localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
    updateCloudWallets(); 
    renderGrid(); 
}

function addNewAccount() { 
    accSettings.push({
        id: 'acc_' + Date.now(), 
        name: document.getElementById('newAccName').value || 'New', 
        color: document.getElementById('newAccColor').value
    }); 
    localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
    updateCloudWallets(); 
    openSettingsModal(); 
    renderGrid(); 
}

function delAcc(i) { 
    if(confirm("Delete?")) { 
        accSettings.splice(i, 1); 
        localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
        updateCloudWallets(); 
        openSettingsModal(); 
        renderGrid(); 
    } 
}
        
function toggleTierInput() {
    let type = document.getElementById('c-rewardType').value;
    document.getElementById('c-tiers-container').style.display = type === 'tiered' ? 'block' : 'none';
}

    function openCreateModal() {
        document.getElementById('c-db-id').value = '';

document.getElementById('c-rewardType').value = 'equal';
        document.getElementById('c-tiersData').value = '';
        toggleTierInput();
        document.getElementById('c-contract').value = '';
        document.getElementById('c-symbol').value = '';
        document.getElementById('c-chain').value = ''; 
        document.getElementById('c-price').value = '';
        document.getElementById('c-logo').value = '';
        document.getElementById('c-logo-preview').style.display = 'none';

        document.getElementById('c-rewardQty').value = '';
        document.getElementById('c-winners').value = '';


        let tokenInput = document.getElementById('c-inputTokens');
        if(tokenInput) tokenInput.value = '';


        document.getElementById('btnDeleteComp').style.display = 'none';

        new bootstrap.Modal(document.getElementById('compModal')).show();
    }


function openEditModal(id) {
    let c = compList.find(x => x.db_id == id);
    if(!c) return;

    document.getElementById('c-db-id').value = id;
    document.getElementById('c-contract').value = c.contract;
    document.getElementById('c-symbol').value = c.name;
    document.getElementById('c-chain').value = c.chain;
    document.getElementById('c-price').value = c.cachedPrice;
    document.getElementById('c-rewardType').value = c.rewardType || 'equal';
    document.getElementById('c-tiersData').value = c.tiers_data ? JSON.stringify(c.tiers_data, null, 2) : '';
    toggleTierInput();
let logoInput = document.getElementById('c-logo');
    if (logoInput) {
        logoInput.type = "text";       
        logoInput.readOnly = false;    
        logoInput.style.display = "block"; 
        logoInput.placeholder = "Xóa trắng ô này để dùng ảnh tự động";
        logoInput.className = "form-control mb-2"; 
    }

    let imgPreview = document.getElementById('c-logo-preview');
    if(c.logo) { imgPreview.src = c.logo; imgPreview.style.display = 'block'; }
    else { imgPreview.style.display = 'none'; }

    document.getElementById('c-rewardQty').value = c.rewardQty;
    document.getElementById('c-winners').value = c.topWinners;
    document.getElementById('c-alphaType').value = c.alphaType;
    document.getElementById('c-rule').value = c.ruleType;
    if (document.getElementById('c-earlyBird')) document.getElementById('c-earlyBird').value = c.earlyBird ? 'true' : 'false';

    document.getElementById('c-start').value = c.start;
    document.getElementById('c-start-time').value = c.startTime || "00:00"; 
    document.getElementById('c-end').value = c.end;
    document.getElementById('c-end-time').value = c.endTime;
    

    document.getElementById('c-listing').value = c.listingTime || '';

    let tokenInput = document.getElementById('c-inputTokens');
    if(tokenInput) {
        if (c.inputTokens && Array.isArray(c.inputTokens)) tokenInput.value = c.inputTokens.join(', ');
        else tokenInput.value = '';
    }

    toggleListingTime();
    document.getElementById('btnDeleteComp').style.display = 'inline-block';
    new bootstrap.Modal(document.getElementById('compModal')).show();
}


    function toggleListingTime() {
        document.getElementById('c-listing').disabled = document.getElementById('c-alphaType').value === 'none';
    }


function saveComp() {
    let id = document.getElementById('c-db-id').value;
    let c = id ? compList.find(x => x.db_id == id) : {};

    let tokensArr = [];
    let tokenInput = document.getElementById('c-inputTokens');
    if (tokenInput && tokenInput.value.trim() !== "") {
        tokensArr = tokenInput.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    }

    // --- XỬ LÝ TIERS JSON MỚI THÊM ---
    let rewardType = document.getElementById('c-rewardType').value;
    let tiersData = null;
    if (rewardType === 'tiered') {
        try {
            let rawTiers = document.getElementById('c-tiersData').value.trim();
            if (rawTiers) tiersData = JSON.parse(rawTiers);
        } catch (e) {
            alert("❌ Lỗi JSON Tiers Data! Vui lòng kiểm tra lại dấu ngoặc, nháy kép.");
            return; // Dừng việc lưu nếu JSON lỗi
        }
    }
    // ---------------------------------

    let obj = { 
        ...c, 
        db_id: id ? parseInt(id) : null,
        name: document.getElementById('c-symbol').value.toUpperCase(),
        contract: document.getElementById('c-contract').value,
        chain: document.getElementById('c-chain').value,
        logo: document.getElementById('c-logo').value,
        cachedPrice: document.getElementById('c-price').value,
        rewardQty: document.getElementById('c-rewardQty').value,
        topWinners: document.getElementById('c-winners').value,
        
        rewardType: rewardType,
        tiers_data: tiersData,

        start: document.getElementById('c-start').value,
        startTime: document.getElementById('c-start-time').value,
        end: document.getElementById('c-end').value,
        endTime: document.getElementById('c-end-time').value,
        listingTime: document.getElementById('c-listing').value,

        alphaType: document.getElementById('c-alphaType').value,
        ruleType: document.getElementById('c-rule').value,
        earlyBird: document.getElementById('c-earlyBird') ? document.getElementById('c-earlyBird').value === 'true' : false,
        inputTokens: tokensArr,
        
        history: c.history || [],
        predictions: c.predictions || [],
        comments: c.comments || []
    };

    saveToCloud(obj);
    bootstrap.Modal.getInstance(document.getElementById('compModal')).hide();
}


    function deleteComp() {
        if(confirm('Delete this tournament?')) {
            deleteFromCloud(document.getElementById('c-db-id').value);
            bootstrap.Modal.getInstance(document.getElementById('compModal')).hide();
        }
    }


    async function deleteFromCloud(id) {
        await supabase.from('tournaments').delete().eq('id', id);
        loadFromCloud();
    }


    async function fetchTokenInfo(q) {


    console.log("DexScreener fetch disabled.");
    return;
}




    function renderStats() {
        const now = new Date();
        let activeCount = 0;
        let totalEstValue = 0;

        let maxRewardVal = 0;
        let topToken = null;

        const fmt = (num) => new Intl.NumberFormat('en-US', { 
            style: 'currency', currency: 'USD', maximumFractionDigits: 0 
        }).format(num);

        compList.forEach(c => {

            let endDateTime;


            if (c.end_time) {
                let t = c.end_time;
                if (!t.endsWith("Z")) t += "Z"; 
                endDateTime = new Date(t);
            } 

            else if (c.end) {

                let timePart = c.endTime || "23:59:59"; 
                

                let fullTimeStr = `${c.end}T${timePart}`;
                if (!fullTimeStr.endsWith("Z")) fullTimeStr += "Z";
                
                endDateTime = new Date(fullTimeStr);
            } 
            else {

                endDateTime = new Date("2099-12-31T23:59:59Z");
            }



            if (now.getTime() < endDateTime.getTime()) {
                activeCount++;


                let qty = parseFloat(c.reward_qty || c.rewardQty || 0);
                

let price = 0;
if (c.market_analysis && c.market_analysis.price) {
    price = parseFloat(c.market_analysis.price);
} else if (c.data && c.data.price) {
    price = parseFloat(c.data.price); 
}

                let currentVal = qty * price;
                totalEstValue += currentVal;


                if (currentVal > maxRewardVal) {
                    maxRewardVal = currentVal;
                    topToken = c;
                }
            }
        });




        

        const elActive = document.getElementById('stat-active');
        if (elActive) elActive.innerText = activeCount;


        const elPool = document.getElementById('stat-pool');
        if (elPool) elPool.innerText = fmt(totalEstValue);


        const elTopSym = document.getElementById('stat-top-symbol');
        const elTopVal = document.getElementById('stat-top-val');
        const elTopImg = document.getElementById('stat-top-img');

        if (topToken) {
            if (elTopSym) elTopSym.innerText = topToken.name;
            if (elTopVal) elTopVal.innerText = fmt(maxRewardVal);
            
            if (elTopImg) {
                if (topToken.logo) {
                    elTopImg.src = topToken.logo;
                    elTopImg.style.display = 'block';
                } else {
                    elTopImg.style.display = 'none';
                }
            }
        } else {

            if (elTopSym) elTopSym.innerText = "---";
            if (elTopVal) elTopVal.innerText = "$0";
            if (elTopImg) elTopImg.style.display = 'none';
        }
    }



function updateClock() {
    const now = new Date();


    if(document.getElementById('sysClock')) {

        let dateStr = now.toLocaleDateString('en-GB', { 
            day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' 
        });
        let timeStr = now.toLocaleTimeString('en-GB', {
            hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: 'UTC'
        });

        document.getElementById('sysClock').innerText = `${dateStr} ${timeStr}`;
        document.getElementById('sysClock').style.fontSize = "1rem"; 


        let labelEl = document.querySelector('[data-i18n="sys_time"]');
        if(labelEl) {
            let baseText = translations[currentLang].sys_time;
            labelEl.innerText = `${baseText} (UTC)`; 
            labelEl.style.color = "var(--brand)";
            labelEl.style.fontWeight = "bold";
        }
    }


    document.querySelectorAll('.x4-timer-val').forEach(el => {
        const listDateStr = el.dataset.list; 
        if(listDateStr) {

            let endTimeStr = listDateStr.includes('T') ? listDateStr : listDateStr + 'T00:00:00';
            const endTime = new Date(endTimeStr + 'Z').getTime() + (29*24*60*60*1000);
            const dist = endTime - now.getTime();
            if(dist < 0) { el.innerText="EXPIRED"; el.style.color='#555'; }
            else {
                const d = Math.floor(dist/(1000*60*60*24));
                const h = Math.floor((dist%(1000*60*60*24))/(1000*60*60));
                el.innerText = `${d}d ${h}h`;
            }
        }
    });


    document.querySelectorAll('.smart-timer').forEach(el => {
        let endDateStr = el.dataset.end;
        let endTimeStr = el.dataset.time;
        if(!endDateStr) return;

        let endDateTime = new Date(endDateStr + 'T' + endTimeStr + 'Z'); 
        let diff = endDateTime - now;
        
        if (diff < 0) { 
            el.innerText = "ENDED"; 
            el.style.color = 'var(--text-sub)';
            el.classList.remove('anim-breathe');
            return; 
        }


        let todayUTC = new Date().toISOString().split('T')[0];
        if (endDateStr === todayUTC) {
            let h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            let m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            let s = Math.floor((diff % (1000 * 60)) / 1000);
            el.innerText = `${h}h ${m}m ${s}s`;
            el.style.color = 'var(--brand)';
            el.classList.add('anim-breathe');
        } else {
            el.innerText = endDateStr;
            el.style.color = '';
            el.classList.remove('anim-breathe');
        }
    });


    if (currentPolyId && document.getElementById('view-predict').style.display === 'block') {
        let c = compList.find(x => x.db_id == currentPolyId);
        let timerEl = document.getElementById('pt-time');
        if (c && c.end && timerEl) {

            let endTime = new Date(c.end + 'T' + (c.endTime || '23:59:59') + 'Z').getTime(); 
            let dist = endTime - now.getTime();
            if (dist < 0) {
                timerEl.innerText = "MARKET CLOSED";
                timerEl.className = "text-danger font-num fw-bold fs-3";
            } else {
                let d = Math.floor(dist / (1000 * 60 * 60 * 24));
                let h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                let m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
                timerEl.innerText = `${d}d : ${h}h : ${m}m`;
                timerEl.className = "text-gold font-num fw-bold fs-3 anim-breathe";
            }
        }
    }
}




async function silentReload(id) {

    const { data: predsData, error } = await supabase.from('predictions').select('*').eq('tournament_id', id);
    if (error) return console.error(error);


    let c = compList.find(x => x.db_id == id);
    if (c && predsData) {
        c.predictions = predsData.map(p => ({
            user_id: p.user_id, name: p.user_name, avatar: p.user_avatar,
            guess: parseFloat(p.guess), time: new Date(p.created_at).getTime()
        }));


        let pool = (c.predictions.length || 0) * PREDICT_FEE;
        let poolEl = document.getElementById('pt-pool');
        if(poolEl) poolEl.innerText = fmt(pool);

        let curMin = (c.history && c.history.length > 0) ? c.history[c.history.length - 1].target : 0;



        let lb = document.getElementById('pt-leaderboard');
        if (lb) { 
            lb.innerHTML = ''; 
            

            let preds = (c.predictions || []).sort((a, b) => {
                let aValid = a.guess >= curMin;
                let bValid = b.guess >= curMin;

                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;

                if (aValid && bValid) {
                    if (a.guess !== b.guess) return a.guess - b.guess;
                } else {
                    if (a.guess !== b.guess) return b.guess - a.guess;
                }
                return a.time - b.time;
            });
            
            if(preds.length === 0) lb.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-sub opacity-50">No Data</td></tr>';

            preds.forEach((p, i) => {

                let isValid = p.guess >= curMin;
                

                let rankColor = isValid 
                    ? (i===0?'#FFD700':(i===1?'#C0C0C0':(i===2?'#CD7F32':'#666'))) 
                    : '#333'; 

                let rankText = isValid ? `#${i + 1}` : '<i class="fas fa-times"></i>'; 

                let badgeHtml = `<span class="rank-badge" style="background:${rankColor}; color:${isValid && i<3 ? '#000' : '#fff'}; border:1px solid #444">${rankText}</span>`;
                
                let avatarHtml = p.avatar ? `<img src="${p.avatar}" class="list-avatar">` : `<div class="list-avatar-placeholder">${p.name.substring(0, 1).toUpperCase()}</div>`;
                

                let myName = document.getElementById('modal-p-name')?.value || '';
                let highlightClass = (p.name === myName) ? 'anim-breathe' : '';
                

                let rowStyle = isValid ? '' : 'opacity: 0.4; filter: grayscale(1);';

                lb.innerHTML += `
                <tr class="${highlightClass}" style="${rowStyle}">
                    <td class="ps-4 align-middle">${badgeHtml}</td>
                    <td class="align-middle">
                        <div class="d-flex align-items-center gap-2">
                            ${avatarHtml}
                            <span class="text-white small fw-bold">${p.name}</span>
                        </div>
                    </td>
                    <td class="text-end pe-4 align-middle font-num fw-bold" style="color:${isValid ? 'var(--brand)' : '#666'}">
                        ${fmtNum(p.guess)}
                    </td>
                </tr>`;
            });
        }
        


        let actDiv = document.getElementById('content-activity');
        if (actDiv) {
            actDiv.innerHTML = '';

        }
    }
}

    init();

function backupData() {
    let data = {};

    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if (key.startsWith('wave_')) {
            data[key] = localStorage.getItem(key);
        }
    }

    let blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let date = new Date().toISOString().slice(0,10);
    a.download = 'WaveAlpha_Backup_' + date + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);


    alert("Backup file downloaded successfully!");
}

function restoreData(input) {
    let file = input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data = JSON.parse(e.target.result);
            for (let key in data) {
                localStorage.setItem(key, data[key]);
            }
            alert("Data restored successfully! Page reloading...");
            window.location.reload();
        } catch (err) {
            alert("Error: Invalid backup file!");
        }
    };
    reader.readAsText(file);
    input.value = ''; 
}


    


    


function calculateSafeAvg(id, currentTotalVol) {

    if (!tokenVolHistory[id]) {
        tokenVolHistory[id] = {
            history: [],
            lastVol: currentTotalVol, 
            lastTime: Date.now()
        };
        return 0; 
    }

    let tracker = tokenVolHistory[id];



    let delta = currentTotalVol - tracker.lastVol;


    tracker.lastVol = currentTotalVol;




    if (delta < 0 || delta > (currentTotalVol * 0.1)) {
        delta = 0;
    }


    tracker.history.push(delta);
    

    if (tracker.history.length > SAFETY_WINDOW) {
        tracker.history.shift(); 
    }




    if (tracker.history.length === 0) return 0;
    let totalInWindow = tracker.history.reduce((a, b) => a + b, 0);
    let avg = totalInWindow / tracker.history.length;

    return avg;
}




function initCalendar() {
    const container = document.getElementById('calendar-wrapper');
    if (!container) return;
    container.innerHTML = ''; 


    let dateStats = {}; 

    compList.forEach(c => {
        if(c.end) {
            if(!dateStats[c.end]) dateStats[c.end] = { count: 0, totalVal: 0 };
            

            dateStats[c.end].count++;


            let qty = parseFloat(c.rewardQty) || 0;
let price = parseFloat((c.market_analysis && c.market_analysis.price) ? c.market_analysis.price : (c.cachedPrice || 0)) || 0;

dateStats[c.end].totalVal += (qty * price);
        }
    });


    const today = new Date();
    let html = '';

    for (let i = 0; i < 15; i++) {
        let d = new Date();
        d.setDate(today.getDate() + i);


        let year = d.getFullYear();
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let day = String(d.getDate()).padStart(2, '0');
        let dateStr = `${year}-${month}-${day}`;


        let dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        let dayNum = d.getDate();


        let stat = dateStats[dateStr] || { count: 0, totalVal: 0 };
        

        let badgeHtml = stat.count > 0 ? `<div class="date-dot">${stat.count}</div>` : '';
        

        let moneyHtml = '';
        if (stat.totalVal > 0) {
            let val = stat.totalVal;
            let txt = '';
            if (val >= 1000000) txt = '$' + (val / 1000000).toFixed(1) + 'M';
            else if (val >= 1000) txt = '$' + (val / 1000).toFixed(0) + 'k';
            else txt = '$' + Math.round(val);
            
            moneyHtml = `<div class="d-val">${txt}</div>`;
        } else {

            moneyHtml = `<div class="d-val" style="visibility:hidden">-</div>`;
        }

        let activeClass = (currentFilterDate === dateStr) ? 'active' : '';

        html += `
            <div class="date-box ${activeClass}" id="dbox-${dateStr}" onclick="filterByDate('${dateStr}')">
                ${badgeHtml}
                <div class="d-name">${dayName}</div>
                <div class="d-num">${dayNum}</div>
                ${moneyHtml}
            </div>
        `;
    }
    container.innerHTML = html;
}


function refreshAllViews() {
    let listToRender = [];
    
    // Lấy đúng danh sách chuẩn đã phân loại từ hệ thống (tránh lỗi lệch ngày)
    if (appData.currentTab === 'history' || appData.currentTab === 'ended') {
        listToRender = appData.history;
    } else {
        listToRender = appData.running;
    }

    // Lọc theo ngày nếu có click trên Calendar
    if (currentFilterDate) {
        listToRender = listToRender.filter(c => c.end === currentFilterDate);
    }

    // Cập nhật cả Grid và Table bằng cùng 1 nguồn dữ liệu
    if (typeof renderGrid === 'function') {
        renderGrid(listToRender);
    }

    if (typeof renderMarketHealthTable === 'function') {
        renderMarketHealthTable(listToRender);
    }

    if (window.competitionRadar && typeof window.competitionRadar.filterRadar === 'function') {
        if (!currentFilterDate) {
            window.competitionRadar.filterRadar(null); 
        } else {
            let allowedContracts = listToRender
                .map(c => c.contract ? c.contract.toLowerCase().trim() : null)
                .filter(c => c);
            window.competitionRadar.filterRadar(allowedContracts);
        }
    }
}


function switchGlobalTab(tabName) {
  
    if (typeof appData !== 'undefined') {
        appData.currentTab = tabName;
    }
    localStorage.setItem('wave_active_tab', tabName);

   
    const btnRun = document.getElementById('tab-running');
    const btnHis = document.getElementById('tab-history');

  
    [btnRun, btnHis].forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
            
            btn.style.setProperty('background', 'transparent', 'important');
            btn.style.setProperty('color', '#848e9c', 'important'); 
            btn.style.setProperty('font-weight', '600', 'important');
            btn.style.boxShadow = 'none';
        }
    });

   
    const activeBtn = (tabName === 'running') ? btnRun : btnHis;
    if (activeBtn) {
        activeBtn.classList.add('active');
        
        
        activeBtn.style.setProperty('color', '#00F0FF', 'important'); 
        activeBtn.style.setProperty('font-weight', '800', 'important');
        
        
        activeBtn.style.setProperty('background', 'rgba(0, 240, 255, 0.1)', 'important');
    }

    
    if (typeof refreshAllViews === 'function') {
        refreshAllViews();
    }
}


function switchViewMode(mode) {
    appData.currentView = mode;
    localStorage.setItem('userViewMode', mode);

    
    const elGrid = document.getElementById('view-grid-container');
    const elList = document.getElementById('view-list-container');
    
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');

    if (mode === 'grid') {
        if(elGrid) elGrid.style.display = 'block';
        if(elList) elList.style.display = 'none';
        
        
        if(btnGrid) { btnGrid.className = 'btn btn-sm btn-primary fw-bold px-2 py-1 rounded'; btnGrid.style.background = ''; }
        if(btnList) { btnList.className = 'btn btn-sm text-sub fw-bold px-2 py-1 rounded'; btnList.style.background = 'transparent'; }
    } else {
        if(elGrid) elGrid.style.display = 'none';
        if(elList) elList.style.display = 'block';

        
        if(btnList) { btnList.className = 'btn btn-sm btn-primary fw-bold px-2 py-1 rounded'; btnList.style.background = ''; }
        if(btnGrid) { btnGrid.className = 'btn btn-sm text-sub fw-bold px-2 py-1 rounded'; btnGrid.style.background = 'transparent'; }
    }

    
    refreshAllViews();
}


function filterByDate(dateStr) {
    
    if (dateStr && currentFilterDate === dateStr) dateStr = null;
    
    currentFilterDate = dateStr;

    
    document.querySelectorAll('.date-box').forEach(el => el.classList.remove('active'));
    if (dateStr) {
        let box = document.getElementById(`dbox-${dateStr}`);
        if(box) box.classList.add('active');
        
        
        let today = new Date().toISOString().split('T')[0];
        let targetTab = (dateStr >= today) ? 'running' : 'history';
        if (appData.currentTab !== targetTab) {
            
            appData.currentTab = targetTab;
            
        }
    }

    
    refreshAllViews();
}


initCalendar();


function switchCpTab(tabName) {

    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');


    const lbBox = document.getElementById('cp-content-leaderboard');
    const chatBox = document.getElementById('cp-content-chat');


    if (tabName === 'leaderboard') {

        lbBox.classList.remove('hide-force');
        chatBox.classList.remove('chat-visible');
        chatBox.classList.add('d-none'); 
    } else {

        lbBox.classList.add('hide-force');
        chatBox.classList.remove('d-none'); 
        chatBox.classList.add('chat-visible'); 
        

        let feed = document.getElementById('chat-feed');
        if(feed) feed.scrollTop = feed.scrollHeight;
    }
}




async function openPredictionView(id) {
    currentPolyId = id;
    document.getElementById('loading-overlay').style.display = 'flex';


    const { data: predsData, error } = await supabase.from('predictions').select('*').eq('tournament_id', id);
    document.getElementById('loading-overlay').style.display = 'none';

    if (error) { showToast("Error loading data", "error"); return; }


    let c = compList.find(x => x.db_id == id);
    if(c) {
        c.predictions = predsData.map(p => ({
            user_id: p.user_id, name: p.user_name, avatar: p.user_avatar,
            guess: parseFloat(p.guess), time: new Date(p.created_at).getTime()
        }));
    }



    document.getElementById('view-predict').style.display = 'block';
    

    updateTerminalData(id);
}




function renderCardMiniChart(c, customCanvasId = null) {

    const targetId = customCanvasId || `miniChart-${c.db_id}`;
    const ctxElement = document.getElementById(targetId);
    
    if (!ctxElement) return; 

    let now = new Date();

    let tournamentEndTime = null;
    let isEnded = false;
    if (c.end) {
        let endStr = c.end.substring(0, 10);
        tournamentEndTime = new Date(endStr + 'T' + (c.endTime || '23:59:59') + 'Z');
        if (now > tournamentEndTime) isEnded = true;
    }

    let todayMidnight = new Date();
    todayMidnight.setUTCHours(23, 59, 59, 999);
    let projectionTargetTime = todayMidnight;
    
    if (tournamentEndTime && tournamentEndTime < todayMidnight) {
        projectionTargetTime = tournamentEndTime;
    }

    let secondsRemaining = (projectionTargetTime - now) / 1000;
    if (secondsRemaining < 0) secondsRemaining = 0;
    if (isEnded) secondsRemaining = 0;

    let anchorDate = new Date();
    if (isEnded && c.end) {
        let endStr = c.end.substring(0, 10);
        let parts = endStr.split('-'); 
        anchorDate = new Date(Date.UTC(parts[0], parts[1]-1, parts[2], 12, 0, 0));
    } else {
        anchorDate.setUTCHours(12, 0, 0, 0);
    }

    let todayStr = now.toISOString().split('T')[0];

    let adminHistory = c.history || [];
    let realHistory = c.real_vol_history || [];
    let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[c.id]) ? userProfile.tracker_data[c.id] : [];
    
    let labels = [];
    let limitVolData = [], projectedData = [], targetData = [];
    let accDatasets = {}; 
    if (typeof accSettings !== 'undefined') accSettings.forEach(acc => accDatasets[acc.id] = []);

    let maxDays = 6; 
    let cleanStart = null;
    let startDate = new Date(anchorDate.getTime());
    startDate.setUTCDate(anchorDate.getUTCDate() - 6); 

    if (c.start) {
        cleanStart = c.start.substring(0, 10).trim();
        let startParts = cleanStart.split('-');
        if (startParts.length === 3) {
            let actualStart = new Date(Date.UTC(startParts[0], startParts[1]-1, startParts[2], 12, 0, 0));
            if (actualStart.getTime() < startDate.getTime()) {
                startDate = actualStart;
            }
        }
    }

    let totalDays = Math.round((anchorDate.getTime() - startDate.getTime()) / 86400000);

    let limitHistory = c.limit_vol_history || [];
    let onchainHistory = c.onchain_vol_history || [];
    let onchainVolData = []; 

    for (let i = 0; i <= totalDays; i++) {
        let d = new Date(startDate.getTime());
        d.setUTCDate(startDate.getUTCDate() + i);
        let dStr = d.toISOString().split('T')[0];

        if (cleanStart && dStr < cleanStart) continue;
        labels.push(d.getUTCDate() + '/' + (d.getUTCMonth()+1));

        let limVal = 0, oncVal = 0, realVal = 0;
        let lItem = limitHistory.find(x => x.date === dStr);
        let oItem = onchainHistory.find(x => x.date === dStr);
        let rItem = realHistory.find(x => x.date === dStr);

        if (lItem) limVal = parseFloat(lItem.vol || 0);
        if (oItem) oncVal = parseFloat(oItem.vol || 0);
        if (rItem) realVal = parseFloat(rItem.vol || 0);

        if (dStr === todayStr) {
            limVal = parseFloat(c.limit_daily_volume || 0);
            oncVal = parseFloat(c.onchain_daily_volume || 0);
            realVal = parseFloat(c.real_alpha_volume || 0);
            if (oncVal === 0 && realVal > limVal) oncVal = realVal - limVal;
        }

        if (!lItem && !oItem && rItem) {
            limVal = realVal; 
            oncVal = 0;
        }

        limitVolData.push(limVal);
        onchainVolData.push(oncVal);

        let projVal = 0;
        if (dStr === todayStr && !isEnded && secondsRemaining > 0) {
            let stableSpeed = 0;
            if (c.market_analysis && c.market_analysis.realTimeVol) {
                stableSpeed = parseFloat(c.market_analysis.realTimeVol);
            }
            if (stableSpeed > 0) projVal = stableSpeed * secondsRemaining;
        }
        projectedData.push(projVal);

        // 3. XỬ LÝ DỮ LIỆU TARGET MIN
        let tVal = 0;
        let hItem = adminHistory.find(h => h.date === dStr);
        if (hItem) tVal = parseFloat(hItem.target);
        else {
            let prev = adminHistory.filter(h => h.date < dStr).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            if (prev) tVal = parseFloat(prev.target);
        }

        if (dStr === todayStr && !isEnded) {
            targetData.push(null);
            if (typeof accSettings !== 'undefined') accSettings.forEach(acc => accDatasets[acc.id].push(null));
        } else {
            targetData.push(tVal);
            let pItem = myProgress.find(p => p.date === dStr);
            if (typeof accSettings !== 'undefined') {
                accSettings.forEach(acc => {
                    let vVal = 0;
                    if (pItem && pItem.accsDetail && pItem.accsDetail[acc.id]) vVal = parseFloat(pItem.accsDetail[acc.id].vol);
                    else {
                        let prevP = myProgress.filter(p => p.date < dStr).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
                        if (prevP && prevP.accsDetail && prevP.accsDetail[acc.id]) vVal = parseFloat(prevP.accsDetail[acc.id].vol);
                        else vVal = null;
                    }
                    accDatasets[acc.id].push(vVal);
                });
            }
        }
    }


    let existingChart = Chart.getChart(targetId);
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = limitVolData;
        existingChart.data.datasets[1].data = onchainVolData;
        existingChart.data.datasets[2].data = projectedData;
        existingChart.data.datasets[3].data = targetData;
        
        accSettings.forEach((acc, index) => {
            if(existingChart.data.datasets[4 + index]) {
                existingChart.data.datasets[4 + index].data = accDatasets[acc.id];
            }
        });
        existingChart.update('none'); 
        return; 
    }


    const ctx = ctxElement.getContext('2d'); 
    let chartDatasets = [
        {
            type: 'bar', label: 'Limit (CEX)', 
            data: limitVolData,
            backgroundColor: '#F0B90B', // Vàng Binance
            borderRadius: 2, order: 4, stack: 'volStack', yAxisID: 'y_limit'
        },
        {
            type: 'bar', label: 'On-chain (DEX)', 
            data: onchainVolData,
            backgroundColor: '#9945FF', // Tím DEX
            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, 
            order: 3, stack: 'volStack', yAxisID: 'y_limit'
        },
        {
            type: 'bar', label: 'Forecast (+)', 
            data: projectedData,
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            borderColor: 'rgba(255, 255, 255, 0.5)',
            borderWidth: {top: 2, right: 2, left: 2, bottom: 0}, 
            borderDash: [4, 4],
            borderRadius: 4, order: 2, stack: 'volStack', yAxisID: 'y_limit'
        },
        {
            type: 'line', label: 'Target', data: targetData,
            borderColor: '#00F0FF', borderWidth: 2, borderDash: [3, 3],
            pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#000', pointBorderColor: '#00F0FF',
            pointBorderWidth: 2, pointHitRadius: 10, 
            fill: false, tension: 0.3, order: 1, yAxisID: 'y_user'
        }
    ];

    accSettings.forEach(acc => {
        chartDatasets.push({
            type: 'line', label: acc.name, data: accDatasets[acc.id],
            borderColor: acc.color, backgroundColor: hexToRgba(acc.color, 0.1), borderWidth: 2,
            pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#161a1e', pointBorderColor: acc.color,
            pointBorderWidth: 2, pointHitRadius: 15,
            fill: false, tension: 0.3, order: 1, yAxisID: 'y_user'
        });
    });

    new Chart(ctx, {
        data: { labels: labels, datasets: chartDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false, axis: 'x' },
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    backgroundColor: 'rgba(22, 26, 30, 0.95)', 
                    titleColor: '#888',
                    padding: 10,
                    cornerRadius: 6,
                    displayColors: true, 
                    callbacks: {
                        label: function(ctx) {
                            let val = ctx.raw; if (!val) return null;
                            let valStr = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val);
                            
                            if (ctx.dataset.label === 'Current') return ` Current: $${valStr}`;
                            if (ctx.dataset.label === 'Forecast (+)') return ` Forecast: +$${valStr}`;
                            
                            return ` ${ctx.dataset.label}: ${valStr}`;
                        },
                        footer: function(tooltipItems) {
                            let total = 0; 
                            let forecastVal = 0;
                            
                            tooltipItems.forEach(t => { 
                                if(t.dataset.stack === 'volStack') { 
                                    total += t.raw; 
                                    if(t.dataset.label.includes('Forecast')) {
                                        forecastVal = t.raw;
                                    }
                                } 
                            });

                            if (forecastVal > 0) {
                                return '----------------\n🏁 Est. Final: $' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(total);
                            }
                            return '';
                        }
                    } 
                }
            },
            scales: {
                x: { display: false },
                y_user: { display: false, position: 'left', min: 0 },
                y_limit: { display: false, position: 'right', min: 0, stacked: true, suggestedMax: Math.max(...limitVolData) * 1.5 }
            },
            layout: { padding: { top: 10, bottom: 5 } }
        }
    });
}

    

function updateGridInfo(c, targetData, accDatasets) {
    let accGridEl = document.getElementById(`accGrid-${c.db_id}`);
    

    let lastTargetData = targetData.filter(v => v !== null);
    let lastTarget = lastTargetData.length > 0 ? lastTargetData[lastTargetData.length - 1] : 0;

    if(accGridEl) {
        let gridHtml = '';
        accSettings.forEach(acc => {

            let validUser = accDatasets[acc.id].filter(v => v !== null);
            let lastUserVal = validUser.length > 0 ? validUser[validUser.length - 1] : 0;
            

            let gap = lastUserVal - lastTarget;
            let gapColor = gap >= 0 ? 'text-green' : 'text-red';
            let gapIcon = gap >= 0 ? 'fa-caret-up' : 'fa-caret-down';
            
            gridHtml += `
            <div class="as-item">
                <div class="as-head"><div class="dot" style="background:${acc.color}"></div> ${acc.name}</div>
                <div class="as-vol">${fmtNum(lastUserVal)}</div>
                <div class="as-gap ${gapColor}">
                    ${lastTarget > 0 ? `<i class="fas ${gapIcon}"></i> ${fmtNum(Math.abs(gap))}` : '<span class="text-sub opacity-50">--</span>'}
                </div>
            </div>`;
        });
        accGridEl.innerHTML = gridHtml;
    }
}


function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

async function updateCloudWallets() {
    if (!currentUser || !userProfile) return;


    if (!userProfile.tracker_data) userProfile.tracker_data = {};


    userProfile.tracker_data.meta_wallets = accSettings;


    await supabase.from('profiles').update({ 
        tracker_data: userProfile.tracker_data 
    }).eq('id', currentUser.id);
    
    console.log("✅ Wallets config synced to Cloud");
}


setInterval(() => {

    if (document.hidden) return; 


    compList.forEach(c => {

        let canvas = document.getElementById(`miniChart-${c.db_id}`);
        if (canvas) {

            renderCardMiniChart(c);
        }
    });
}, 5000); 


document.addEventListener('click', function(e) {

    if (e.target.closest('.btn-predict')) {
        

        const currentCard = e.target.closest('.card-item');
        

        if (currentCard) {


            currentCard.classList.remove('active');
            currentCard.classList.remove('expanded');
            currentCard.classList.remove('show');
            currentCard.classList.remove('open');


            currentCard.style.zIndex = ''; 
            currentCard.style.position = '';
        }
    }
});



function openFeedbackModal() {

    if(typeof userProfile !== 'undefined' && userProfile && userProfile.nickname) {
        document.getElementById('fb-name').value = userProfile.nickname;
    }
    new bootstrap.Modal(document.getElementById('feedbackModal')).show();
}

function selectFbType(btn, type) {
    document.querySelectorAll('.feedback-type-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('fb-type').value = type;
}

async function sendFeedbackToDb() {
    const name = document.getElementById('fb-name').value.trim() || 'Anonymous';
    const type = document.getElementById('fb-type').value;
    const msg = document.getElementById('fb-msg').value.trim();

    if (!msg) return showToast("Please enter your message!", "error");

    let btn = document.querySelector('#feedbackModal .btn-action');
    let oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...'; btn.disabled = true;

    try {
        const { error } = await supabase.from('feedback').insert({
            sender_name: name,
            type: type,
            message: msg
        });
        if (error) throw error;

        showToast("Sent successfully! Thank you.", "success");
        document.getElementById('fb-msg').value = ''; 
        bootstrap.Modal.getInstance(document.getElementById('feedbackModal')).hide();
    } catch (e) {
        console.error(e);
        showToast("Error: " + e.message, "error");
    } finally {
        btn.innerHTML = oldHtml; btn.disabled = false;
    }
}






window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'admin') {
        document.getElementById('admin-control-panel').classList.remove('hidden');
        checkTokenStatus();
    }
});

function closeAdmin() {
    document.getElementById('admin-control-panel').classList.add('hidden');
    window.history.replaceState({}, document.title, "/");
}


function downloadBackup() {
    try {

        const backupData = {
            app: "WaveAlpha",
            version: "2.0",
            timestamp: new Date().toISOString(),
            settings: typeof accSettings !== 'undefined' ? accSettings : [], 
            profile: typeof userProfile !== 'undefined' ? userProfile : null 
        };


        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        
        a.href = dataStr;
        a.download = `WaveAlpha_Backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();


        if(typeof showToast === 'function') {
            showToast("✅ Backup file downloaded successfully!", "success");
        } else {
            alert("✅ Backup file downloaded successfully!");
        }
    } catch (e) {
        console.error(e);
        alert("❌ Error creating backup: " + e.message);
    }
}


function triggerRestore() {
    const msg = "⚠️ WARNING: IMPORTING DATA\n\nThis will OVERWRITE your current local data with the backup file.\nAre you sure you want to continue?";
    if(!confirm(msg)) return;
    document.getElementById('restoreFile').click();
}


function handleRestore(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);


            if (!data.app || data.app !== "WaveAlpha" || !data.settings) {
                alert("❌ Invalid file! Please select a valid Wave Alpha backup file.");
                return;
            }


            

            if (typeof accSettings !== 'undefined') {
                accSettings = data.settings;
            }


            localStorage.setItem('wave_settings', JSON.stringify(data.settings));
            

            if (data.profile) {
                localStorage.setItem('wave_profile', JSON.stringify(data.profile));
            }



            if (typeof updateCloudWallets === 'function') {
                if(typeof showToast === 'function') showToast("⏳ Syncing to server...", "info");
                await updateCloudWallets(); 
            } else if (typeof syncDataToCloud === 'function') {

                 await syncDataToCloud();
            }

            alert("✅ Data restored successfully! The page will now reload.");
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert("❌ Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = ''; 
}


function updateSingleCardUI(rawRow) {





    if (typeof updateGridValuesOnly === 'function') {
        updateGridValuesOnly();
    }


    if (typeof renderMarketHealthTable === 'function' && document.getElementById('healthTableBody')) {
        renderMarketHealthTable();
    }
    

    if (typeof renderStats === 'function') {
        renderStats();
    }


    if (rawRow && typeof currentPolyId !== 'undefined' && currentPolyId && rawRow.id === parseInt(currentPolyId)) {
        if (typeof updateTerminalData === 'function') {
            updateTerminalData(currentPolyId);
        }
    }
}



    async function broadcastDailyReport() {

        if(!confirm("⚠️ XÁC NHẬN:\nTổng hợp dữ liệu ngày HÔM QUA và gửi lên Telegram?")) return;
        

        showToast("⏳ Đang kết nối Server...", "info");
        const btn = document.getElementById('btn-broadcast');
        if(btn) { 
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; 
        }
    
        try {

            const { data, error } = await supabase.functions.invoke('daily-report');
            

            if (error) {
                console.error("Supabase Error:", error);
                alert("❌ LỖI KẾT NỐI SERVER:\n" + JSON.stringify(error, null, 2));
                throw error;
            }
    

            let finalData = data;
            

            if (typeof data === 'string') {
                console.log("Server trả về Text:", data);
                try {

                    finalData = JSON.parse(data);
                } catch (parseError) {

                    alert("⚠️ SERVER BÁO LỖI (TEXT):\n" + data);
                    throw new Error("Server trả về dữ liệu không hợp lệ (Non-JSON).");
                }
            }
    

            if (finalData && finalData.success) {
                showToast(`✅ Đã gửi báo cáo (${finalData.count} tokens)!`, "success");
                alert(`✅ GỬI THÀNH CÔNG!\nĐã báo cáo ${finalData.count} token lên Telegram.`);
            } else {

                const msg = finalData ? (finalData.message || finalData.error) : "Dữ liệu rỗng";
                showToast("⚠️ SERVER TỪ CHỐI: " + msg, "error");
            }
    
        } catch (e) {
            console.error(e);
            showToast("❌ Lỗi: " + e.message, "error");
        } finally {

            if(btn) { 
                btn.disabled = false; 
                btn.innerHTML = '<i class="fas fa-bullhorn me-2"></i> GỬI BÁO CÁO TỔNG HỢP'; 
            }
        }
    }


function renderCustomHub() {

    const inner = document.querySelector('.carousel-inner');
    const indicators = document.querySelector('.carousel-indicators');
    

    if (inner && siteConfig.banners && Array.isArray(siteConfig.banners) && siteConfig.banners.length > 0) {
        inner.innerHTML = ''; 
        indicators.innerHTML = '';
        
        siteConfig.banners.forEach((b, i) => {
            if(!b.img) return; 
            const active = i === 0 ? 'active' : '';
            

            inner.innerHTML += `
                <div class="carousel-item ${active}" data-bs-interval="4000">
                    <a href="${b.link||'#'}" target="_blank">
                        <img src="${b.img}" class="d-block w-100" style="height: 180px; object-fit: cover;">
                    </a>
                </div>`;
                

            indicators.innerHTML += `
                <button type="button" data-bs-target="#eventCarousel" data-bs-slide-to="${i}" class="${active}"></button>`;
        });
        const carousel = document.getElementById('eventCarousel');
        if(carousel) carousel.style.display = 'block';
    } else {

        const carousel = document.getElementById('eventCarousel');
        if(carousel) carousel.style.display = 'none';
    }


    if(siteConfig.ref_binance && document.getElementById('ui-ref-binance')) document.getElementById('ui-ref-binance').href = siteConfig.ref_binance;
    if(siteConfig.ref_web3 && document.getElementById('ui-ref-web3')) document.getElementById('ui-ref-web3').href = siteConfig.ref_web3;
    if(siteConfig.ref_dex && document.getElementById('ui-ref-dex')) document.getElementById('ui-ref-dex').href = siteConfig.ref_dex;
}
   
let activeCardPlaceholder = null; 

function toggleCardHighlight(el) {
    if (document.querySelector('.tour-card.active-card')) {
        closeActiveCard();
    }

    const closeBtnWrapper = document.createElement('div');
    closeBtnWrapper.className = 'overlay-close-btn-wrapper';
    closeBtnWrapper.innerHTML = `
        <button class="btn btn-sm text-white d-flex align-items-center gap-2 px-3 py-2 fw-bold" 
                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 30px; backdrop-filter: blur(5px);">
            <i class="fas fa-times"></i> CLOSE
        </button>
    `;
    closeBtnWrapper.onclick = function(e) {
        e.stopPropagation(); 
        closeActiveCard();   
    };
    document.body.appendChild(closeBtnWrapper);

    activeCardPlaceholder = document.createElement('div');
    activeCardPlaceholder.className = 'tour-card-placeholder';
    activeCardPlaceholder.style.display = 'none'; 
    el.parentNode.insertBefore(activeCardPlaceholder, el);

    document.body.appendChild(el);

    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -45%) scale(0.95)';
    
    void el.offsetWidth;

    el.classList.add('active-card');
    el.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%) scale(1)';

    let canvas = el.querySelector('canvas');
    if (canvas) {
        let dbId = canvas.id.split('-')[1];
        let c = compList.find(x => x.db_id == dbId);
        if(c) renderCardMiniChart(c); 
    }

    const backdrop = document.getElementById('card-backdrop');
    if(backdrop) {
        backdrop.style.display = 'block';
        backdrop.onclick = closeActiveCard; 
        setTimeout(() => backdrop.classList.add('show'), 10);
    }
    document.body.classList.add('has-active-card');
}

function closeActiveCard() {
    const clonesToRemove = document.querySelectorAll('.overlay-clone');
    const btnsToRemove = document.querySelectorAll('.overlay-close-btn-wrapper');
    const activeEl = document.querySelector('.tour-card.active-card:not(.overlay-clone)');
    const placeholder = activeCardPlaceholder;

    clonesToRemove.forEach(el => {
        el.style.animation = 'none'; 
        el.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, -45%) scale(0.95)';
    });
    
    if (activeEl) {
        activeEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        activeEl.style.opacity = '0';
        activeEl.style.transform = 'translate(-50%, -45%) scale(0.95)';
    }
    
    btnsToRemove.forEach(el => {
        el.style.opacity = '0';
    });
    
    const backdrop = document.getElementById('card-backdrop');
    if(backdrop) backdrop.classList.remove('show');

    activeCardPlaceholder = null;
    document.body.classList.remove('has-active-card');

    setTimeout(() => {
        clonesToRemove.forEach(el => el.remove());
        btnsToRemove.forEach(el => el.remove());

        if (activeEl) {
            activeEl.style.transition = 'none';
            activeEl.classList.remove('active-card');
            activeEl.style.opacity = '';
            activeEl.style.transform = '';
            
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(activeEl, placeholder);
                placeholder.remove();
            }
            
            void activeEl.offsetWidth;
            activeEl.style.transition = ''; 
        }

        if (!document.querySelector('.tour-card.active-card')) {
            if(backdrop) backdrop.style.display = 'none';
        }
    }, 200);
}

function jumpToCard(dbId) {
    const wrapper = document.querySelector(`.card-wrapper[data-id="${dbId}"]`);
    if (wrapper) {
        const card = wrapper.querySelector('.tour-card');
        if (card) openCardOverlay(card); 
    }
}

function openCardOverlay(originalCard) {
    closeActiveCard();

    const closeBtnWrapper = document.createElement('div');
    closeBtnWrapper.className = 'overlay-close-btn-wrapper';
    closeBtnWrapper.innerHTML = `
        <button class="btn btn-sm text-white d-flex align-items-center gap-2 px-3 py-2 fw-bold" 
                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 30px; backdrop-filter: blur(5px);">
            <i class="fas fa-times"></i> CLOSE
        </button>
    `;
    closeBtnWrapper.onclick = function(e) {
        e.stopPropagation(); 
        closeActiveCard();   
    };
    document.body.appendChild(closeBtnWrapper);

    const clone = originalCard.cloneNode(true);
    clone.removeAttribute('onclick'); 
    clone.onclick = null; 
    clone.classList.add('active-card', 'overlay-clone');
    
    let cardWrapper = originalCard.closest('.card-wrapper');
    let dbId = cardWrapper ? cardWrapper.getAttribute('data-id') : null;

    if (dbId) {
        let cloneCanvas = clone.querySelector('canvas');
        if (cloneCanvas) {
            let newCanvasId = `miniChart-CLONE-${dbId}`;
            cloneCanvas.id = newCanvasId;
            cloneCanvas.style.display = 'block';
            
            setTimeout(() => {
                let c = compList.find(x => x.db_id == dbId);
                if (c) renderCardMiniChart(c, newCanvasId);
            }, 50); 
        }
    }

    clone.addEventListener('click', function(e) {
        e.stopPropagation(); 
    });

    clone.style.animation = 'none';
    clone.style.transition = 'none';
    clone.style.opacity = '0';
    clone.style.transform = 'translate(-50%, -45%) scale(0.95)';
    
    document.body.appendChild(clone);

    void clone.offsetWidth;

    clone.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    clone.style.opacity = '1';
    clone.style.transform = 'translate(-50%, -50%) scale(1)';

    const backdrop = document.getElementById('card-backdrop');
    if(backdrop) {
        backdrop.style.display = 'block';
        backdrop.onclick = closeActiveCard;
        setTimeout(() => backdrop.classList.add('show'), 10);
    }
    document.body.classList.add('has-active-card');
}




function updateHealthTableRealtime() {
    if (isHeaderTooltipOpen) {
        pendingHealthRealtimeRefresh = true;
        return;
    }
    if (!document.getElementById('healthTableBody')) return;
    const fmtCompact = (num) => !num ? '$0' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(num);

    compList.forEach(c => {
        let dbId = c.db_id || c.id;

        let currentStatus = (c.status || '').toUpperCase();
        let isEnded = false;
        let endStr = c.end_at || c.end || (c.data && c.data.end);
        let endTimeStr = c.endTime || "23:59:59";
        if(endTimeStr.length === 5) endTimeStr += ":00";

        if (c.end_at) { 
            isEnded = Date.now() > new Date(c.end_at).getTime(); 
        } else if (endStr) { 
            let endDateTime = new Date(endStr + 'T' + endTimeStr + 'Z');
            isEnded = Date.now() > endDateTime.getTime(); 
        }
        
        let isFinalized = c.is_finalized || currentStatus === 'ENDED' || currentStatus === 'FINALIZED' || (c.ai_prediction && c.ai_prediction.status_label === 'FINALIZED');

        if (isEnded || isFinalized) return; 
        // -------------------------------------------------

        let dLimit = parseFloat(c.limit_daily_volume || 0);
        let dTotal = parseFloat(c.real_alpha_volume || 0);
        let dOnChain = Math.max(0, dTotal - dLimit);

        let aLimit = parseFloat(c.limit_accumulated_volume || 0);
        let aTotal = parseFloat(c.total_accumulated_volume || 0);
        let aOnChain = Math.max(0, aTotal - aLimit);


// --- BƠM REALTIME CHO "EST" ---
        let now = new Date();
        let tPart = (c.endTime || "23:59:59").trim(); if(tPart.length===5) tPart+=":00";
        let diffMs = new Date(`${c.end}T${tPart}Z`) - now;
        let isFinalDay = (diffMs > 0 && diffMs <= 86400000);
        let speedVal = parseFloat((c.market_analysis && c.market_analysis.speed) ? c.market_analysis.speed : 0);
        
        let estLimit = aLimit, estOnChain = aOnChain, estTotal = aTotal;
        if (!isEnded && !isFinalized && isFinalDay && speedVal > 0) {
            let added = speedVal * (diffMs/1000);
            let ratio = dTotal>0 ? (dLimit/dTotal) : 0.5;
            estLimit += added*ratio; estOnChain += added*(1-ratio); estTotal += added;
        }

        const updates = [
            { id: `tb-dlim-${dbId}`, val: dLimit },
            { id: `tb-doc-${dbId}`, val: dOnChain },
            { id: `tb-dtot-${dbId}`, val: dTotal },
            { id: `tb-alim-${dbId}`, val: aLimit },
            { id: `tb-aoc-${dbId}`, val: aOnChain },
            { id: `tb-atot-${dbId}`, val: aTotal },
            { id: `est-alim-${dbId}`, val: estLimit, isEst: true },
            { id: `est-aoc-${dbId}`, val: estOnChain, isEst: true },
            { id: `est-atot-${dbId}`, val: estTotal, isEst: true }
        ];

        updates.forEach(u => {
            const el = document.getElementById(u.id);
            if (el) {
                const newStr = u.isEst ? `Est: ${fmtCompact(u.val)}` : fmtCompact(u.val);
                if (el.innerText !== newStr) {
                    el.innerText = newStr;
                }
            }
        });
    }); 
} 

document.addEventListener("visibilitychange", () => {
        
    if (document.visibilityState === "visible") {
        console.log("👀 User is back! Checking for updates...");
        quickSyncData(); 
        startRealtimeSync();
    }
});




function handleVote(tokenId, type, btnElement) {

    event.stopPropagation();


    let wrapper = btnElement.closest('.sentiment-wrapper');
    let btnUp = wrapper.querySelector('button:first-child');
    let btnDown = wrapper.querySelector('button:last-child');
    let barFill = wrapper.querySelector('.sentiment-fill-up');


    let currentVote = localStorage.getItem(`vote_${tokenId}`);
    

    btnUp.classList.remove('active-up');
    btnDown.classList.remove('active-down');

    if (currentVote === type) {

        localStorage.removeItem(`vote_${tokenId}`);

        barFill.style.width = '50%';
    } else {

        localStorage.setItem(`vote_${tokenId}`, type);
        

        if (type === 'up') {
            btnUp.classList.add('active-up');
            barFill.style.width = '75%'; 
        } else {
            btnDown.classList.add('active-down');
            barFill.style.width = '25%'; 
        }
    }
    

    console.log(`User voted ${type} for token ${tokenId}`);
}



// ========================================================


function showTiersModal(dbId) {
    let c = compList.find(x => x.db_id == dbId);
    if (!c || !c.tiers_data) return;

    let tbody = document.getElementById('tiers-table-body');
    let html = '';

    let usePrice = parseFloat(c.cachedPrice) || ((c.market_analysis && c.market_analysis.price) ? parseFloat(c.market_analysis.price) : 0);
    let tokenName = c.name ? c.name.split('(')[0].trim() : '';

    c.tiers_data.forEach(t => {
        let estVal = (parseFloat(t.reward) || 0) * usePrice;
        let estValStr = estVal > 0 ? `~$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(estVal)}` : '---';
        let rewardStr = `${fmtNum(t.reward)} ${tokenName}`;

        html += `
            <tr>
                <td class="text-start ps-3 text-white fw-bold">Top ${t.rank}</td>
                <td class="text-brand">${rewardStr}</td>
                <td class="text-success text-end pe-3">${estValStr}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    new bootstrap.Modal(document.getElementById('tiersModal')).show();
}

document.addEventListener('DOMContentLoaded', () => {
    const legalModal = document.getElementById('legal-modal-overlay');
    const btnAcceptLegal = document.getElementById('btn-accept-legal');
    
    if (!localStorage.getItem('wave_alpha_legal_accepted')) {
        setTimeout(() => {
            if (legalModal) {
                legalModal.classList.add('show');
                document.body.style.overflow = 'hidden'; 
            }
        }, 1000); 
    }

    if (btnAcceptLegal) {
        btnAcceptLegal.addEventListener('click', () => {
            legalModal.classList.remove('show');
            document.body.style.overflow = ''; 
            localStorage.setItem('wave_alpha_legal_accepted', 'true');
        });
    }
});
