    
    
    
    const SUPABASE_URL = 'https://akbcpryqjigndzpuoany.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYmNwcnlxamlnbmR6cHVvYW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODg0NTEsImV4cCI6MjA4MDY2NDQ1MX0.p1lBHZ12fzyIrKiSL7DXv7VH74cq3QcU7TtBCJQBH9M';
    const REALTIME_API_URL = 'https://alpha-realtime.onrender.com/api/prices';
    const REALTIME_API_KEY = 'WaveAlpha_S3cur3_P@ssw0rd_5566';
let layer2Interval = null;
const PREDICT_FEE = 100;


const TELE_BOT_CONFIG = {

    get token() {
        return localStorage.getItem('WAVE_TELE_TOKEN'); 
    },

    chatId: '-1003355713341' 
};



function requireBotToken() {
    let currentToken = TELE_BOT_CONFIG.token;
    if (!currentToken) {

        let input = prompt("⚠️ CHƯA CÓ TOKEN BOT!\n\nVui lòng dán Token BotFather vào đây (Chỉ cần làm 1 lần trên máy này):");
        if (input && input.trim() !== "") {
            localStorage.setItem('WAVE_TELE_TOKEN', input.trim());
            alert("✅ Đã lưu Token vào máy! Từ giờ bạn có thể cập nhật thoải mái.");
            return true;
        } else {
            alert("❌ Bạn chưa nhập Token nên không thể gửi tin nhắn Telegram.");
            return false;
        }
    }
    return true;
}


async function sendTelePhoto(comp, newTarget) {
    

    if (!requireBotToken()) return;
    const token = TELE_BOT_CONFIG.token;
    const chatId = TELE_BOT_CONFIG.chatId;


    const cardWrapper = document.querySelector(`.card-wrapper[data-id="${comp.db_id}"]`);
    if (!cardWrapper) {
        showToast("Error: Card element not found!", "error");
        return;
    }
    const cardElement = cardWrapper.querySelector('.tour-card');


    const cleanNum = (val) => {
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '').trim()) || 0;
    };



    let currentPrice = (comp.market_analysis && comp.market_analysis.price) ? comp.market_analysis.price : (comp.cachedPrice || 0);
    

    let priceStr = "---";
    if (currentPrice > 0) {
        priceStr = '$' + currentPrice.toLocaleString('en-US', { maximumFractionDigits: 4 });
    }


    let qty = cleanNum(comp.rewardQty);
    let rewardVal = qty * currentPrice;
    let rewardHtml = fmtNum(qty); 
    if (rewardVal > 0) {
        let valStr = '~$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rewardVal);
        rewardHtml += ` <span style="color:#0ECB81; font-size:0.8em; font-weight:bold;">${valStr}</span>`;
    }


    let statsGrid = cardElement.querySelector('.card-stats-grid');
    let oldRewardHTML = "", oldPriceHTML = "";
    let priceEl, rewardEl;

    if (statsGrid) {

        rewardEl = statsGrid.children[1].querySelector('.stat-val');
        if (rewardEl) {
            oldRewardHTML = rewardEl.innerHTML;
            rewardEl.innerHTML = rewardHtml; 
        }

        priceEl = statsGrid.children[2].querySelector('.stat-val');
        if (priceEl) {
            oldPriceHTML = priceEl.innerHTML;
            priceEl.innerHTML = priceStr;    
            priceEl.style.color = "#00F0FF"; 
        }
    }


    cardElement.classList.add('snapshot-mode');
    showToast("📸 Snapping...", "info");

    try {

        const canvas = await html2canvas(cardElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#161a1e',
            logging: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
                let clonedCard = clonedDoc.querySelector('.tour-card');
                if(clonedCard) {
                    clonedCard.style.transform = 'none';
                    clonedCard.style.boxShadow = 'none';
                }
            }
        });

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));


        let rewardMsg = rewardVal > 0 ? `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rewardVal)}` : '---';
        
        let changeText = "";
        let currVal = cleanNum(newTarget); 


        let history = comp.history ? [...comp.history] : [];
        history.sort((a, b) => new Date(a.date) - new Date(b.date));




        if (history.length >= 2) {
            let prevVal = cleanNum(history[history.length - 2].target);
            let diff = currVal - prevVal;
            
            if (diff !== 0) {
                let sign = diff > 0 ? '+' : '-';
                let icon = diff > 0 ? '📈' : '📉';
                let diffStr = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(diff));
                changeText = ` (${icon} ${sign}$${diffStr})`;
            }
        } else if (currVal > 0) {
            changeText = ` (🚀 New)`;
        }

        const caption = `
🌊 <b>OFFICIAL UPDATE: ${comp.name}</b>
━━━━━━━━━━━━━━━━━━
🎯 <b>New Min Target:</b> <code>${newTarget}</code>${changeText}
💰 <b>Total Reward:</b> ${rewardMsg}
💵 <b>Current Price:</b> ${priceStr}

👇 <b>Tap to Open Wave Alpha Mini App</b>
        `.trim();


        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', blob, 'update.png');
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        
        const replyMarkup = {
            inline_keyboard: [[{ text: "🚀 Open Wave Alpha Mini App", url: "https://t.me/WaveAlphaSignal_bot/miniapp" }]]
        };
        formData.append('reply_markup', JSON.stringify(replyMarkup));

        const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.ok) {
            console.log("✅ Photo sent!");
            showToast("✅ Image sent to Telegram!", "success");
        } else {
            throw new Error(result.description || "API Error");
        }

    } catch (e) {
        console.error("Tele Photo Error:", e);
        showToast("❌ Failed: " + e.message, "error");
    } finally {

        cardElement.classList.remove('snapshot-mode');
        if (rewardEl && oldRewardHTML) rewardEl.innerHTML = oldRewardHTML;
        if (priceEl && oldPriceHTML) {
            priceEl.innerHTML = oldPriceHTML;
            priceEl.style.color = "";
        }
    }
}




let tokenVolHistory = {}; 
const SAFETY_WINDOW = 10; 
let currentFilterDate = null;

let currentLang = localStorage.getItem('wave_lang') || 'en';



function formatCompact(num) {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
}


const translations = {
    /* ==========================================================
       1. ENGLISH (EN)
       ========================================================== */
    en: {

        nav_sys_time: "TIME (UTC)",
        nav_guide: "GUIDE",
        nav_login: "Login",
        nav_logout: "Logout",
        nav_wallet: "Wallets",
        nav_feedback: "Feedback",
        hero_title: "TOURNAMENT VOLUME TRACKER",
        hero_sub: "Manage your accounts & Join the prediction.",
        cmd_eco: "ECOSYSTEM",
        cmd_platform: "PLATFORMS",
        cmd_miniapp: "Mini App",
        cmd_channel: "Channel",
        cmd_bot: "Bot",
        cmd_cex: "BINANCE CEX",
        cmd_web3: "BINANCE WALLET",
        cmd_dex: "ASTER DEX",
        sect_market: "MARKET OVERVIEW",
        stat_active: "ACTIVE POOLS",
        stat_pool: "TOTAL REWARDS",
        stat_top_reward: "HIGHEST REWARD",
        health_title: "MARKET RADAR",
        health_realtime: "Real-time",
        col_token: "TOKEN",
        col_duration: "TIME",
        col_win_pool: "WIN / POOL",
        col_price_val: "VAL / PRICE",
        col_rule: "RULE",
        col_min_vol: "MIN VOL",
        col_daily_vol: "DAILY VOL",
        col_camp_vol: "TOTAL VOL",
        col_speed: "SPEED",
        col_match: "SPD / MATCH",
        col_ord_spr: "ORD / SPR",
        col_target: "PREDICTION",

        tip_time: "Start - End Date & Countdown",
        tip_win_pool: "Top Winners & Pool Size",
        tip_price_val: "Est. Total Value & Token Price",
        tip_rule: "Trading Rule: Buy Only or Buy + Sell",
        tip_min_vol: "Minimum volume required to qualify for rewards (Rank Cut-off). Updated T+1.",
        tip_daily_vol: "Real-time Vol (Sub: Yesterday)",
        tip_camp_vol: "Total cumulative volume from the start of the tournament until now.",
        tip_speed_match: "Match Vol & Execution Speed",
        tip_ord_spr: "Avg Order Value & Spread %",



        tip_pred_header_title: "MODEL METHODOLOGY",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>Data Basis:</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>Formula:</b> Aggregates previous session's Min Vol and real-time transaction Velocity.</li>
                <li><b>Range:</b> Model activates from <b style="color:#00F0FF">05:00 UTC</b> on the final day.</li>
                <li><b>Update:</b> Model automatically recalculates every 30 minutes.</li>
                <li><b>Adjustment:</b> Applies variable coefficients based on participant count and market depth.</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ DISCLAIMER:
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    Figures are for reference only and <b>do not constitute financial advice</b>. You are solely responsible for your trading decisions.
                </div>
            </div>`,


        tip_model_title: "MODEL PROJECTION",
        tip_model_active: "Target is projected based on historical volatility, real-time momentum, and liquidity depth.",
        tip_vote_guide: "Sentiment? Vote <b class='text-brand'>Agree</b>, <b class='text-danger'>Lower</b> or <b class='text-success'>Higher</b>.",


        tip_model_wait_title: "DATA ACCUMULATION",
        tip_model_wait_body: "Model requires comprehensive session data. Projection activates <span style='color:#ffd700'>16 hours</span> before close.",

        txt_ended: "Ended",
        txt_yest: "Yest",
        txt_new: "NEW",
        txt_no_data: "No Data",
        txt_ops: "ops",
        rule_buy: "ONLY BUY",
        rule_buy_sell: "BUY + SELL",
        rule_limit_x4: "Trade Limit x4",
        rule_all: "ALL VOL",
        rule_x4: "ALL VOL x4",
        tag_x4: "X4 BSC",
        tag_x2: "X2 OTHER",
        sect_deadline: "DEADLINE RADAR",
        btn_view_all: "View All",
        sect_board: "TRACKING BOARD",
        btn_create: "CREATE",
        btn_config: "Site Config",
        card_top: "TOP",
        card_reward: "REWARD",
        card_price: "PRICE",
        card_my_prog: "MY PROGRESS",
        card_update: "UPDATE VOL",
        card_total_vol: "Total Vol (Alpha)",
        card_min_target: "Min Target (Goal)",
        btn_predict: "PREDICT",
        btn_market_closed: "MARKET CLOSED",
        leg_title: "METRIC LEGEND",
        leg_price: "Current market price (Live).",
        leg_reward: "Est. Prize Value (Qty * Price).",
        leg_min_vol: "Target Vol (Yesterday vs Day-2).",
        leg_daily_vol: "Real-time Vol (Sub: Yesterday).",
        leg_camp_vol: "Total accumulated volume since start.",
        leg_speed: "Execution speed (Orders/sec).",
        leg_match: "Avg market absorption per second ($).",
        leg_ord: "Average value per single order ($).",
        leg_spread: "Bid/Ask price gap (%).",
        modal_login_title: "SECURE ACCESS",
        modal_login_desc: "Authenticate via Email OTP",
        btn_send_code: "SEND CODE",
        btn_verify: "VERIFY LOGIN",
        modal_update_title: "MY TRADING TRACKER",
        lbl_date: "DATE",
        lbl_acc_vol: "MY VOLUMES & GAP",
        lbl_history: "MY HISTORY",
        btn_save_prog: "SAVE MY PROGRESS",
        modal_pred_title: "ENTER PREDICTION",
        modal_pred_desc: "Predict the final Min Volume.",
        lbl_your_name: "YOUR NAME",
        lbl_your_guess: "YOUR GUESS (VOL)",
        btn_pay_fee: "CONFIRM & PAY FEE",
        toast_login: "Please Login first!",
        toast_success: "Action Successful!",
        toast_error: "Error occurred!",
        toast_saved: "Data Saved!",
        toast_copied: "Copied to clipboard!",
        guide_title: "QUICK START GUIDE",
        guide_s1_t: "STEP 1: SETUP LIST",
        guide_s1_d: "Define your tracking list (e.g. Account A, Account B).",
        guide_s2_t: "STEP 2: INPUT VOLUME",
        guide_s2_d: "Click UPDATE on any tournament. Manually input volume.",
        guide_s3_t: "STEP 3: TRACK GAP",
        guide_s3_d: "System automatically calculates the GAP to Min Volume.",
        btn_setup_list: "SETUP MY LIST",
        leg_feedback_t: "Feedback / Support",
        leg_feedback_d: "Send ideas or report bugs.",
        leg_wallet_t: "Manage Wallets",
        leg_wallet_d: "Add or remove tracking accounts.",
        leg_login_t: "Login",
        leg_login_d: "Access Admin features.",
        stat_create: "CREATE"
    },

    /* ==========================================================
       2. TIẾNG VIỆT (VI)
       ========================================================== */
    vi: {
        nav_sys_time: "GIỜ (UTC)",
        nav_guide: "HƯỚNG DẪN",
        nav_login: "Đăng nhập",
        nav_logout: "Đăng xuất",
        nav_wallet: "Quản lý Ví",
        nav_feedback: "Góp ý",
        hero_title: "CÔNG CỤ THEO DÕI VOLUME",
        hero_sub: "Quản lý tài khoản & Tham gia dự đoán.",
        cmd_eco: "HỆ SINH THÁI",
        cmd_platform: "SÀN GIAO DỊCH",
        cmd_miniapp: "Mini App",
        cmd_channel: "Kênh Tin Tức",
        cmd_bot: "Bot Data",
        cmd_cex: "SÀN BINANCE",
        cmd_web3: "VÍ BINANCE",
        cmd_dex: "SÀN ASTER",
        sect_market: "TỔNG QUAN THỊ TRƯỜNG",
        stat_active: "GIẢI ĐANG CHẠY",
        stat_pool: "TỔNG GIẢI THƯỞNG",
        stat_top_reward: "THƯỞNG CAO NHẤT",
        health_title: "RADAR THỊ TRƯỜNG",
        health_realtime: "Thời gian thực",
        col_token: "TOKEN",
        col_duration: "THỜI GIAN",
        col_win_pool: "WIN / POOL",
        col_price_val: "GT / GIÁ",
        col_rule: "LUẬT",
        col_min_vol: "MỤC TIÊU",
        col_daily_vol: "VOL HÔM NAY",
        col_camp_vol: "TỔNG VOL",
        col_speed: "TỐC ĐỘ",
        col_match: "KHỚP/TỐC ĐỘ",
        col_ord_spr: "LỆNH / SPR",
        col_target: "DỰ ĐOÁN",

        tip_time: "Ngày bắt đầu - Kết thúc & Đếm ngược",
        tip_win_pool: "Số người thắng & Tổng giải",
        tip_price_val: "Tổng giá trị ước tính & Giá Token",
        tip_rule: "Luật giao dịch: Chỉ Mua hoặc Mua + Bán",
        tip_min_vol: "Khối lượng tối thiểu để lọt Top nhận thưởng (Vol chốt sổ). Cập nhật T+1.",
        tip_daily_vol: "Vol thực tế (Dòng dưới: Hôm qua)",
        tip_camp_vol: "Tổng khối lượng tích lũy tính từ khi bắt đầu giải cho đến hiện nay.",
        tip_speed_match: "Tốc độ khớp & Volume khớp lệnh",
        tip_ord_spr: "Giá trị trung bình lệnh & Chênh lệch giá",


        tip_pred_header_title: "PHƯƠNG PHÁP TÍNH",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>Cơ sở Dữ liệu:</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>Công thức:</b> Tổng hợp Min Vol phiên trước và Tốc độ giao dịch thực (Velocity).</li>
                <li><b>Phạm vi:</b> Mô hình kích hoạt từ <b style="color:#00F0FF">05:00 UTC</b> ngày cuối cùng.</li>
                <li><b>Cập nhật:</b> Mô hình tự động tính toán lại sau mỗi 30 phút.</li>
                <li><b>Điều chỉnh:</b> Áp dụng hệ số biến thiên dựa trên số người tham gia và độ sâu thị trường.</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ MIỄN TRỪ TRÁCH NHIỆM:
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    Số liệu chỉ mang tính tham khảo và <b>không phải lời khuyên tài chính</b>. Bạn hoàn toàn chịu trách nhiệm về quyết định giao dịch của mình.
                </div>
            </div>`,

        tip_model_title: "MÔ HÌNH DỰ ĐOÁN",
        tip_model_active: "Mục tiêu dựa trên biến động lịch sử và đà tăng trưởng thực tế.",
        tip_vote_guide: "Quan điểm? <b class='text-brand'>Đồng ý</b>, <b class='text-danger'>Thấp hơn</b> hay <b class='text-success'>Cao hơn</b>.",
        tip_model_wait_title: "ĐANG THU THẬP DỮ LIỆU",
        tip_model_wait_body: "Mô hình cần dữ liệu phiên đầy đủ. Dự đoán kích hoạt <span style='color:#ffd700'>16 giờ</span> trước khi đóng phiên.",

        txt_ended: "Kết thúc",
        txt_yest: "H.Qua",
        txt_new: "MỚI",
        txt_no_data: "Chưa có",
        txt_ops: "lệnh/s",
        rule_buy: "CHỈ MUA",
        rule_buy_sell: "MUA + BÁN",
        rule_limit_x4: "Lệnh Limit x4",
        rule_all: "MUA + BÁN",
        rule_x4: "MUA + BÁN (x4)",
        tag_x4: "X4 MẠNG BSC",
        tag_x2: "X2 MẠNG KHÁC",
        sect_deadline: "LỊCH CHỐT SỔ",
        btn_view_all: "Xem Tất Cả",
        sect_board: "BẢNG THEO DÕI",
        btn_create: "TẠO GIẢI",
        btn_config: "Cấu hình",
        card_top: "TOP",
        card_reward: "THƯỞNG",
        card_price: "GIÁ",
        card_my_prog: "TIẾN ĐỘ CỦA TÔI",
        card_update: "CẬP NHẬT VOL",
        card_total_vol: "Tổng Vol (Alpha)",
        card_min_target: "Mục Tiêu Min (Goal)",
        btn_predict: "DỰ ĐOÁN",
        btn_market_closed: "ĐÃ ĐÓNG SỔ",
        leg_title: "CHÚ THÍCH THÔNG SỐ",
        leg_price: "Giá thị trường hiện tại (Live).",
        leg_reward: "Giá trị giải thưởng (Qty * Price).",
        leg_min_vol: "Mục tiêu (So sánh Hôm qua vs Hôm kia).",
        leg_daily_vol: "Vol thực (Dòng dưới: Vol hôm qua).",
        leg_camp_vol: "Tổng volume tích lũy từ khi bắt đầu.",
        leg_speed: "Tốc độ khớp lệnh (Lệnh/giây).",
        leg_match: "Thanh khoản trung bình mỗi giây ($).",
        leg_ord: "Giá trị trung bình 1 lệnh ($).",
        leg_spread: "Chênh lệch giá Mua/Bán (%).",
        modal_login_title: "ĐĂNG NHẬP",
        modal_login_desc: "Xác thực qua Email OTP",
        btn_send_code: "GỬI MÃ CODE",
        btn_verify: "XÁC NHẬN",
        modal_update_title: "CẬP NHẬT TIẾN ĐỘ",
        lbl_date: "NGÀY",
        lbl_acc_vol: "VOL VÀ KHOẢNG CÁCH",
        lbl_history: "LỊCH SỬ NHẬP",
        btn_save_prog: "LƯU TIẾN ĐỘ",
        modal_pred_title: "DỰ ĐOÁN",
        modal_pred_desc: "Dự đoán Min Volume chốt sổ.",
        lbl_your_name: "TÊN BẠN",
        lbl_your_guess: "DỰ ĐOÁN (VOL)",
        btn_pay_fee: "XÁC NHẬN & TRẢ PHÍ",
        toast_login: "Vui lòng đăng nhập trước!",
        toast_success: "Thao tác thành công!",
        toast_error: "Có lỗi xảy ra!",
        toast_saved: "Dữ liệu đã lưu!",
        toast_copied: "Đã sao chép!",
        guide_title: "HƯỚNG DẪN NHANH",
        guide_s1_t: "BƯỚC 1: TẠO DANH SÁCH",
        guide_s1_d: "Định nghĩa các ví cần theo dõi.",
        guide_s2_t: "BƯỚC 2: NHẬP VOLUME",
        guide_s2_d: "Bấm CẬP NHẬT trên thẻ giải đấu.",
        guide_s3_t: "BƯỚC 3: THEO DÕI GAP",
        guide_s3_d: "Hệ thống tự động tính khoảng cách.",
        btn_setup_list: "CÀI ĐẶT DANH SÁCH",
        leg_feedback_t: "Góp ý / Hỗ trợ",
        leg_feedback_d: "Gửi ý tưởng hoặc báo lỗi.",
        leg_wallet_t: "Quản lý Ví",
        leg_wallet_d: "Thêm hoặc xóa ví theo dõi.",
        leg_login_t: "Đăng nhập",
        leg_login_d: "Truy cập tính năng Admin.",
        stat_create: "TẠO GIẢI"
    },

    /* ==========================================================
       3. TIẾNG TRUNG (ZH)
       ========================================================== */
    zh: {
        nav_sys_time: "TIME (UTC)",
        nav_guide: "指南",
        nav_login: "登录",
        nav_logout: "登出",
        nav_wallet: "钱包管理",
        nav_feedback: "反馈",
        hero_title: "锦标赛成交量追踪",
        hero_sub: "管理账户并参与预测。",
        cmd_eco: "生态系统",
        cmd_platform: "交易平台",
        cmd_miniapp: "小程序",
        cmd_channel: "频道",
        cmd_bot: "机器人",
        cmd_cex: "币安交易所",
        cmd_web3: "币安钱包",
        cmd_dex: "ASTER去中心化",
        sect_market: "市场概览",
        stat_active: "进行中奖池",
        stat_pool: "总奖励价值",
        stat_top_reward: "最高奖励",
        health_title: "市场雷达",
        health_realtime: "实时",
        col_token: "代币",
        col_duration: "时间",
        col_win_pool: "赢家 / 奖池",
        col_price_val: "价值 / 价格",
        col_rule: "规则",
        col_min_vol: "最低量",
        col_daily_vol: "今日量",
        col_camp_vol: "累计量",
        col_speed: "速度",
        col_match: "撮合",
        col_ord_spr: "均单 / 价差",
        col_target: "模型预测",

        tip_time: "开始 - 结束日期 & 倒计时",
        tip_win_pool: "获奖人数 & 奖池大小",
        tip_price_val: "预估总价值 & 代币价格",
        tip_rule: "交易规则：仅买入 或 全部量",
        tip_min_vol: "获得奖励所需的最低交易量 (排名截止)。T+1 更新。",
        tip_daily_vol: "实时量 (下方：昨日)",
        tip_camp_vol: "从比赛开始到现在的累计总交易量。",
        tip_speed_match: "撮合量 & 执行速度",
        tip_ord_spr: "平均订单价值 & 价差 %",


        tip_pred_header_title: "模型方法论",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>数据基础：</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>公式：</b> 综合上一时段的最小成交量和实时交易速度。</li>
                <li><b>范围：</b> 模型在最后一天的 <b style="color:#00F0FF">05:00 UTC</b> 激活。</li>
                <li><b>更新：</b> 模型每 30 分钟自动重新计算一次。</li>
                <li><b>调整：</b> 根据参与人数和市场深度应用可变系数。</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ 免责声明：
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    数据仅供参考，<b>不构成财务建议</b>。您需对自己的交易决定全权负责。
                </div>
            </div>`,

        tip_model_title: "模型预测",
        tip_model_active: "目标量基于历史波动率、实时动量和流动性深度计算得出。仅供参考。",
        tip_vote_guide: "您的观点？投票 <b class='text-brand'>赞同</b>，<b class='text-danger'>看低</b> 或 <b class='text-success'>看高</b>。",
        tip_model_wait_title: "数据积累中",
        tip_model_wait_body: "模型需要完整的数据谱。预测将在结束前 <span style='color:#ffd700'>16小时</span> 激活，以确保最高准确性。",

        txt_ended: "已结束",
        txt_yest: "昨",
        txt_new: "新",
        txt_no_data: "无数据",
        txt_ops: "单/秒",
        rule_buy: "仅买入",
        rule_buy_sell: "买入 + 卖出",
        rule_limit_x4: "限价单 x4",
        rule_all: "买入 + 卖出",
        rule_x4: "全量 x4",
        tag_x4: "X4 BSC链",
        tag_x2: "X2 其他链",
        sect_deadline: "截止雷达",
        btn_view_all: "查看全部",
        sect_board: "追踪面板",
        btn_create: "创建",
        btn_config: "配置",
        card_top: "排名",
        card_reward: "奖励",
        card_price: "价格",
        card_my_prog: "我的进度",
        card_update: "更新量",
        card_total_vol: "总成交量 (Alpha)",
        card_min_target: "最低目标 (Min)",
        btn_predict: "预测",
        btn_market_closed: "市场已关闭",
        leg_title: "指标说明",
        leg_price: "当前市场价格 (实时)。",
        leg_reward: "预估奖池价值 (数量 * 价格)。",
        leg_min_vol: "目标量变化 (对比上次更新)。",
        leg_daily_vol: "实时量 (下方: 昨日)。",
        leg_camp_vol: "自开始以来的累计交易量。",
        leg_speed: "交易速度 (订单/秒)。",
        leg_match: "每秒平均吸筹 ($)。",
        leg_ord: "单笔订单平均值 ($)。",
        leg_spread: "买卖价差 (Spread %)。",
        modal_login_title: "安全登录",
        modal_login_desc: "通过邮箱 OTP 验证",
        btn_send_code: "发送验证码",
        btn_verify: "验证登录",
        modal_update_title: "我的交易追踪",
        lbl_date: "日期",
        lbl_acc_vol: "我的成交量 & 差距",
        lbl_history: "历史记录",
        btn_save_prog: "保存进度",
        modal_pred_title: "输入预测",
        modal_pred_desc: "预测最终最低成交量。",
        lbl_your_name: "您的昵称",
        lbl_your_guess: "预测值 (VOL)",
        btn_pay_fee: "确认并支付",
        toast_login: "请先登录!",
        toast_success: "操作成功!",
        toast_error: "发生错误!",
        toast_saved: "数据已保存!",
        toast_copied: "已复制!",
        guide_title: "快速入门指南",
        guide_s1_t: "步骤 1: 设置列表",
        guide_s1_d: "定义您的追踪列表。",
        guide_s2_t: "步骤 2: 输入交易量",
        guide_s2_d: "点击更新 (UPDATE)。",
        guide_s3_t: "步骤 3: 追踪差距",
        guide_s3_d: "系统自动计算差距 (GAP)。",
        btn_setup_list: "设置我的列表",
        leg_feedback_t: "反馈 / 支持",
        leg_feedback_d: "发送想法或报告错误。",
        leg_wallet_t: "钱包管理",
        leg_wallet_d: "添加或删除追踪账户。",
        leg_login_t: "登录",
        leg_login_d: "访问管理员功能。",
        stat_create: "创建"
    },

    /* ==========================================================
       4. TIẾNG HÀN (KO)
       ========================================================== */
    ko: {
        nav_sys_time: "TIME (UTC)",
        nav_guide: "가이드",
        nav_login: "로그인",
        nav_logout: "로그아웃",
        nav_wallet: "지갑 관리",
        nav_feedback: "피드백",
        hero_title: "토너먼트 거래량 트래커",
        hero_sub: "계정을 관리하고 예측에 참여하세요.",
        cmd_eco: "생태계",
        cmd_platform: "거래 플랫폼",
        cmd_miniapp: "미니 앱",
        cmd_channel: "채널",
        cmd_bot: "봇",
        cmd_cex: "바이낸스 CEX",
        cmd_web3: "바이낸스 지갑",
        cmd_dex: "ASTER DEX",
        sect_market: "시장 개요",
        stat_active: "진행 중인 풀",
        stat_pool: "총 보상",
        stat_top_reward: "최고 보상",
        health_title: "시장 레이더",
        health_realtime: "실시간",
        col_token: "토큰",
        col_duration: "시간",
        col_win_pool: "승자 / 풀",
        col_price_val: "가치 / 가격",
        col_rule: "규칙",
        col_min_vol: "최소 거래량",
        col_daily_vol: "일일 거래량",
        col_camp_vol: "누적 거래량",
        col_speed: "속도",
        col_match: "체결",
        col_ord_spr: "평균 / 스프레드",
        col_target: "예측 모델",

        tip_time: "시작 - 종료 날짜 & 카운트다운",
        tip_win_pool: "최고 당첨자 & 풀 크기",
        tip_price_val: "총 추정 가치 & 토큰 가격",
        tip_rule: "거래 규칙: 매수 전용 또는 전체",
        tip_min_vol: "보상을 받기 위한 최소 거래량 (커트라인). T+1 업데이트.",
        tip_daily_vol: "실시간 볼륨 (하단: 어제)",
        tip_camp_vol: "대회 시작부터 현재까지의 누적 총 거래량.",
        tip_speed_match: "매칭 볼륨 & 체결 속도",
        tip_ord_spr: "평균 주문 가치 & 스프레드 %",


        tip_pred_header_title: "모델 방법론",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>데이터 기준:</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>공식:</b> 이전 세션의 최소 거래량과 실시간 거래 속도를 집계합니다.</li>
                <li><b>범위:</b> 모델은 마지막 날 <b style="color:#00F0FF">05:00 UTC</b>부터 활성화됩니다.</li>
                <li><b>업데이트:</b> 모델은 30분마다 자동으로 다시 계산됩니다.</li>
                <li><b>조정:</b> 참여자 수와 시장 깊이에 따라 가변 계수를 적용합니다.</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ 면책 조항:
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    수치는 참고용이며 <b>재정적 조언이 아닙니다</b>. 거래 결정에 대한 책임은 전적으로 본인에게 있습니다.
                </div>
            </div>`,

        tip_model_title: "모델 예측",
        tip_model_active: "목표 거래량은 과거 변동성과 실시간 시장 모멘텀을 기반으로 산출됩니다 (투자 조언 아님).",
        tip_vote_guide: "당신의 관점은? <b class='text-brand'>동의</b>, <b class='text-danger'>낮음</b> 또는 <b class='text-success'>높음</b> 투표.",
        tip_model_wait_title: "데이터 수집 중",
        tip_model_wait_body: "모델은 포괄적인 데이터가 필요합니다. 정확성을 위해 종료 <span style='color:#ffd700'>16시간 전</span>에 예측이 활성화됩니다.",

        txt_ended: "종료됨",
        txt_yest: "어제",
        txt_new: "신규",
        txt_no_data: "데이터 없음",
        txt_ops: "주문/초",
        rule_buy: "매수 전용",
        rule_buy_sell: "매수 + 매도",
        rule_limit_x4: "지정가 x4",
        rule_all: "매수 + 매도",
        rule_x4: "전체 볼륨 x4",
        tag_x4: "X4 BSC 체인",
        tag_x2: "X2 기타 체인",
        sect_deadline: "마감 레이더",
        btn_view_all: "모두 보기",
        sect_board: "추적 보드",
        btn_create: "생성",
        btn_config: "설정",
        card_top: "순위",
        card_reward: "보상",
        card_price: "가격",
        card_my_prog: "나의 진행 상황",
        card_update: "거래량 업데이트",
        card_total_vol: "총 거래량 (Alpha)",
        card_min_target: "최소 목표 (Goal)",
        btn_predict: "예측하기",
        btn_market_closed: "시장 마감",
        leg_title: "지표 범례",
        leg_price: "현재 시장 가격 (실시간).",
        leg_reward: "예상 상금 가치 (수량 * 가격).",
        leg_min_vol: "목표 거래량 변화 (지난 업데이트 대비).",
        leg_daily_vol: "실시간 볼륨 (하단: 어제).",
        leg_camp_vol: "시작 이후 누적 거래량.",
        leg_speed: "체결 속도 (주문/초).",
        leg_match: "초당 평균 매수 ($).",
        leg_ord: "주문당 평균 가치 ($).",
        leg_spread: "매수/매도 스프레드 (%).",
        modal_login_title: "보안 접속",
        modal_login_desc: "이메일 OTP 인증",
        btn_send_code: "코드 전송",
        btn_verify: "로그인 확인",
        modal_update_title: "거래 추적기",
        lbl_date: "날짜",
        lbl_acc_vol: "나의 볼륨 & 격차",
        lbl_history: "나의 기록",
        btn_save_prog: "진행 상황 저장",
        modal_pred_title: "예측 입력",
        modal_pred_desc: "최종 최소 거래량을 예측하세요.",
        lbl_your_name: "닉네임",
        lbl_your_guess: "예측값 (VOL)",
        btn_pay_fee: "확인 및 수수료 지불",
        toast_login: "먼저 로그인해주세요!",
        toast_success: "작업 성공!",
        toast_error: "오류가 발생했습니다!",
        toast_saved: "데이터 저장됨!",
        toast_copied: "복사됨!",
        guide_title: "빠른 시작 가이드",
        guide_s1_t: "1단계: 리스트 설정",
        guide_s1_d: "추적할 리스트를 정의하세요.",
        guide_s2_t: "2단계: 거래량 입력",
        guide_s2_d: "업데이트(UPDATE)를 클릭하세요.",
        guide_s3_t: "3단계: 격차 추적",
        guide_s3_d: "격차(GAP)를 시스템이 자동 계산합니다.",
        btn_setup_list: "내 리스트 설정",
        leg_feedback_t: "피드백 / 지원",
        leg_feedback_d: "아이디어 전송 또는 버그 신고.",
        leg_wallet_t: "지갑 관리",
        leg_wallet_d: "추적 계정 추가 또는 제거.",
        leg_login_t: "로그인",
        leg_login_d: "관리자 기능 액세스.",
        stat_create: "생성"
    }
};


let globalTooltipInstances = []; 

function initSmartTooltips() {
    try {

        document.querySelectorAll('.tooltip').forEach(t => t.remove());
        globalTooltipInstances = []; 


        document.removeEventListener('click', handleGlobalClick);
        document.addEventListener('click', handleGlobalClick);

        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));

        tooltipTriggerList.map(function (el) {

            const oldInstance = bootstrap.Tooltip.getInstance(el);
            if (oldInstance) oldInstance.dispose();


            let t = new bootstrap.Tooltip(el, {
                trigger: 'hover click', 
                html: true,
                animation: true,
                delay: { "show": 50, "hide": 50 },

                interactive: true 
            });

            globalTooltipInstances.push(t);


            el.addEventListener('click', function (e) {

                e.stopPropagation();
                

                if(el.classList.contains('col-ai-target')) {
                    t.show();
                }
            });
            

            el.addEventListener('mouseleave', function() {

                t.hide(); 
            });

            return t;
        });

    } catch (e) {
        console.log("Tooltip error:", e);
    }
}


function handleGlobalClick(e) {

    if (!e.target.closest('.tooltip') && !e.target.closest('[data-bs-toggle="tooltip"]')) {

        globalTooltipInstances.forEach(t => t.hide());
    }
}


function changeLanguage(lang) {

    currentLang = lang;
    localStorage.setItem('wave_lang', lang);


    let langBtn = document.getElementById('cur-lang-text');
    if(langBtn) langBtn.innerText = lang.toUpperCase();


    applyLanguage();


    renderGrid();



    if(typeof renderMarketHealthTable === 'function') {
        renderMarketHealthTable(); 
    }
}

function applyLanguage() {
    const t = translations[currentLang];
    

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = t[key];
            } else {
                el.innerHTML = t[key]; 
            }
        }
    });


    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.getAttribute('data-i18n-tooltip');
        if (t[key]) {

            el.setAttribute('title', t[key]);
            el.setAttribute('data-bs-original-title', t[key]);
            

            const tooltipInstance = bootstrap.Tooltip.getInstance(el);
            if (tooltipInstance) {
                tooltipInstance.setContent({ '.tooltip-inner': t[key] });
            }
        }
    });


    let sortSel = document.getElementById('sortFilter');
    if(sortSel) {
        sortSel.options[0].text = t.sort_newest;
        sortSel.options[1].text = t.sort_ending;
        sortSel.options[2].text = t.sort_reward;
    }
    initSmartTooltips();
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
    try {
        console.log("🔄 Đang xin danh sách Token từ Server Layer 2...");
        
        // Gọi vào API mới vừa tạo trên Node.js
        const res = await fetch('https://alpha-realtime.onrender.com/api/tokens', {
            headers: {
                'x-api-key': 'WaveAlpha_S3cur3_P@ssw0rd_5566' 
            }
        });

        if (!res.ok) throw new Error("Server từ chối hoặc lỗi R2");

        const json = await res.json();
        const rawList = json.data || [];

        // NẠP DỮ LIỆU
        window.compList = rawList.map(item => ({
            alphaId: (item.alphaId || item.id || item.i || '').toString().replace("ALPHA_", ""),
            name: item.s || item.symbol || item.name || 'UNKNOWN',
            cachedPrice: item.p || item.price || 0,
            icon: item.ic || item.icon || ''
        }));

        console.log(`✅ Đã nạp thành công: ${window.compList.length} Token`);

        // Vẽ giao diện
        if(typeof renderGrid === 'function') renderGrid();
        if(typeof renderMarketHealthTable === 'function') renderMarketHealthTable();

        // Bật Realtime
        if (typeof startRealtimeSync === 'function') startRealtimeSync();

    } catch (e) {
        console.error("❌ Lỗi tải danh sách Token:", e);
    }
}


    let siteConfig = { x:'', tele:'', yt:'', affiliate: {} };
    let accSettings = JSON.parse(localStorage.getItem('wave_settings')) || [{id:'acc1', name:'Main', color:'#00F0FF'}, {id:'acc2', name:'Clone', color:'#FFD700'}];
    let currentUser = null;
    let userProfile = null;

    const fmtNum = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(n);
    const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n).replace('US$', '$').trim();
    const formatCurrency = (input) => {
        let val = input.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        input.value = val;
        if(input.id === 'u-min-vol') accSettings.forEach(acc => calcRowGap(acc.id));
    };

    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                currentUser = session.user;
                document.getElementById('loginBtn').classList.add('d-none');
                document.getElementById('userProfile').classList.remove('d-none');
                document.getElementById('userProfile').classList.add('d-flex');

                fetchUserProfile();
                checkUserAdmin();
                bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();
            } else {
                currentUser = null;
                userProfile = null;
                document.getElementById('loginBtn').classList.remove('d-none');
                document.getElementById('userProfile').classList.add('d-none');
                document.getElementById('userProfile').classList.remove('d-flex');
                document.body.classList.remove('is-admin');
            }
        });
    }


    let isSyncing = false; 
    let lastWakeupTime = 0;


async function quickSyncData() {
    if (isSyncing || !supabase) return; 
    isSyncing = true;

    try {

        const { data, error } = await supabase.rpc('get_minimal_market_data');
        
        if (!error && data && data.length > 0) {
            let hasChanges = false;


data.forEach(miniRow => {
    let localItem = compList.find(c => c.db_id === miniRow.id);
    if (localItem) {

        let isEnded = false;
        if (localItem.end) {

            let todayStr = new Date().toISOString().split('T')[0];
            if (localItem.end < todayStr) isEnded = true;
        }


        if (miniRow.ai_prediction) {
            localItem.ai_prediction = miniRow.ai_prediction;
            hasChanges = true;
        }


        if (!isEnded && miniRow.limit_daily_volume !== undefined) {
            if (localItem.limit_daily_volume !== miniRow.limit_daily_volume) {
                localItem.limit_daily_volume = miniRow.limit_daily_volume;
                hasChanges = true;
            }
        }


        if (!isEnded && miniRow.limit_accumulated_volume !== undefined) {
            if (localItem.limit_accumulated_volume !== miniRow.limit_accumulated_volume) {
                localItem.limit_accumulated_volume = miniRow.limit_accumulated_volume;
                hasChanges = true;
            }
        }


        if (JSON.stringify(localItem.market_analysis) !== JSON.stringify(miniRow.market_analysis)) {
            localItem.market_analysis = miniRow.market_analysis;
            hasChanges = true;
        }


        if (!isEnded && localItem.daily_tx_count !== miniRow.daily_tx_count) {
            localItem.daily_tx_count = miniRow.daily_tx_count;
            hasChanges = true;
        }
    }
});

            if (hasChanges) {
                updateGridValuesOnly(); 
                if (typeof renderMarketHealthTable === 'function') renderMarketHealthTable();
                renderStats();
                console.log("⚡ Data synced (Full Vol)");
            }
        }
    } catch (e) { 
        console.error("Sync Error:", e); 
    } finally {
        isSyncing = false; 

    }
}

function init() {
    checkLegal();
    syncAlphaData();
    startRealtimeSync();

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


async function fetchUserProfile() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    
    if (sessionError || !sessionData.user) {
        return;
    }

    const uid = sessionData.user.id;

    let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

    if (error) {
        console.error(error);
        return;
    }

    if (data) {
        userProfile = data;
        currentUser = sessionData.user;

        const userBtn = document.querySelector('.user-email'); 
        if (userBtn) {
            userBtn.textContent = data.nickname || data.email; 
        }

        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) {
            userNameDisplay.innerText = data.nickname || currentUser.email.split('@')[0];
        }

        let bal = data.balance_usdt !== null ? data.balance_usdt : 0;
        const userBalance = document.getElementById('user-balance');
        if (userBalance) {
            userBalance.innerText = fmtNum(bal);
        }
        userProfile.balance_usdt = bal;

        const navAvatar = document.getElementById('nav-avatar');
        if (navAvatar) {
            if (data.avatar_url) {
                navAvatar.src = data.avatar_url;
                navAvatar.style.display = 'block';
            } else {
                navAvatar.style.display = 'none';
            }
        }

        checkUserAdmin();
        checkDailyBonus();

        userProfile.tracker_data = data.tracker_data || {};

        if (userProfile.tracker_data && userProfile.tracker_data.meta_wallets) {
            accSettings = userProfile.tracker_data.meta_wallets;
            localStorage.setItem('wave_settings', JSON.stringify(accSettings));
        } else {
            updateCloudWallets(); 
        }

        if (typeof renderGrid === 'function') {
            renderGrid();
        }
    }
}


    async function checkDailyBonus() {
        if(!currentUser || !userProfile) return;
        const today = new Date().toISOString().split('T')[0];
        const lastClaimKey = 'wave_daily_claim_' + currentUser.id;
        const lastClaim = localStorage.getItem(lastClaimKey);

        if(lastClaim !== today) {
            const bonus = 100;
            const newBal = (userProfile.balance_usdt || 0) + bonus;


            userProfile.balance_usdt = newBal;
            document.getElementById('user-balance').innerText = fmtNum(newBal);

            showToast(`🎉 Daily Login Bonus: +${bonus} USDT!`, 'success');
            localStorage.setItem(lastClaimKey, today);


            await supabase.from('profiles').update({ balance_usdt: newBal }).eq('id', currentUser.id);
        }
    }

    function openProfileModal() {
        if(!currentUser) return;
        document.getElementById('pf-nickname').value = userProfile?.nickname || '';
        document.getElementById('pf-avatar-url').value = userProfile?.avatar_url || '';

        let preview = document.getElementById('pf-preview');
        let placeholder = document.getElementById('pf-placeholder');
        if(userProfile?.avatar_url) {
            preview.src = userProfile.avatar_url;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.style.display = 'none';
            placeholder.style.display = 'block';
        }
        new bootstrap.Modal(document.getElementById('profileModal')).show();
    }


    async function handleFileUpload(input) {
        if(!input.files || input.files.length === 0) return;
        if(!currentUser) return showToast("Please Login", "error");

        const file = input.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

        let placeholder = document.getElementById('pf-placeholder');
        let loader = document.getElementById('upload-loading');
        loader.style.display = 'flex';

        try {
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if(uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);

            document.getElementById('pf-avatar-url').value = publicUrl;
            document.getElementById('pf-preview').src = publicUrl;
            document.getElementById('pf-preview').style.display = 'block';
            placeholder.style.display = 'none';
            loader.style.display = 'none';
            showToast("Avatar updated successfully!", "success");
        } catch (error) {
            showToast("Upload failed: " + error.message, "error");
            loader.style.display = 'none';
        }
    }

    async function saveProfile() {
        const nickname = document.getElementById('pf-nickname').value.trim();
        const avatar_url = document.getElementById('pf-avatar-url').value.trim();
        const btn = document.getElementById('btn-save-profile');
        if(!nickname) return showToast("Nickname required", "error");
        btn.innerText = "SAVING..."; btn.disabled = true;
        const updates = { id: currentUser.id, nickname, avatar_url };
        const { error } = await supabase.from('profiles').upsert(updates);
        btn.innerText = "SAVE CHANGES"; btn.disabled = false;
        if(error) {
            if(error.code === '23505') showToast("Nickname already taken!", "error");
            else showToast(error.message, "error");
        } else {
            fetchUserProfile();
            bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
            showToast("Profile Saved!", "success");
        }
    }


    async function uploadImage(input, previewId, valueId) {
        if (!input.files || input.files.length === 0) return;
        let previewEl = document.getElementById(previewId);
        previewEl.style.opacity = '0.5';

        try {
            const file = input.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `img_${Date.now()}_${Math.floor(Math.random()*1000)}.${fileExt}`;
            const { error } = await supabase.storage.from('avatars').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;
            document.getElementById(valueId).value = publicUrl;
            previewEl.src = publicUrl;
            previewEl.style.display = 'block';
            previewEl.style.opacity = '1';
        } catch (e) {
            showToast("Upload Error: " + e.message, "error");
            previewEl.style.opacity = '1';
        }
    }

    function openLoginModal() { resetLoginModal(); new bootstrap.Modal(document.getElementById('loginModal')).show(); }
    function resetLoginModal() { document.getElementById('login-step-1').style.display = 'block'; document.getElementById('login-step-2').style.display = 'none'; document.getElementById('otp-token').value = ''; }

    async function sendOtpCode() {
        const email = document.getElementById('otp-email').value.trim();
        if(!email) return showToast("Please enter email", "error");
        let btn = document.querySelector('#login-step-1 button');
        let oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...'; btn.disabled = true;
        try {
            const { error } = await supabase.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
            if (error) throw error;
            document.getElementById('login-step-1').style.display = 'none';
            document.getElementById('login-step-2').style.display = 'block';
            setTimeout(() => document.getElementById('otp-token').focus(), 500);
            showToast("OTP Code sent to " + email, "success");
        } catch (e) { showToast("Error sending code: " + e.message, "error"); }
        finally { btn.innerHTML = oldText; btn.disabled = false; }
    }

    async function verifyOtpCode() {
        const email = document.getElementById('otp-email').value.trim();
        const token = document.getElementById('otp-token').value.trim();
        if(!token) return showToast("Enter code", "error");
        let btn = document.querySelector('#login-step-2 button');
        let oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFYING...'; btn.disabled = true;
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
            if (error) {
                console.log("Retrying with signup type...");
                const { data: data2, error: error2 } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
                if (error2) throw error;
            }
            window.location.reload();
        } catch (e) { showToast("Invalid Code or Expired.", "error"); btn.innerHTML = oldText; btn.disabled = false; }
    }

    async function handleLogout() { 
    await supabase.auth.signOut(); 
    

    localStorage.removeItem('wave_settings'); 

    
    window.location.reload(); 
}


function checkUserAdmin() {
   
    if (currentUser && userProfile && userProfile.role === 'admin') {
        document.body.classList.add('is-admin');
        console.log("👑 ADMIN ACCESS: Đã bật chế độ Admin!");
    } else {
        document.body.classList.remove('is-admin');
        console.log("👤 USER MODE: Chế độ người dùng thường.");
    }
    
     if (typeof renderGrid === "function") {
        renderGrid();
    }
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


/* ==========================================================
   4. HÀM GỌI API (ĐÃ SỬA LỖI FLASH NHẢY TAB TRONG CATCH BLOCK)
   ========================================================== */
async function loadFromCloud(isSilent = false) {

    if(!isSilent && !appData.isDataReady && document.getElementById('loading-overlay')) {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();

        let query = supabase.from('tournaments')
    .select(`
        id, 
        name, 
        contract,
        data, 
        tournament_history (vol, daily_vol, date, target, price, tx_count)
    `)
    .order('id', { ascending: true });

        const { data, error } = await query;
        if (error) throw error;

        let tempRunning = [], tempHistory = [], tempAll = []; 

        if (data && data.length > 0) {
            data.forEach(row => {
                if(row.id === -1) {
                    siteConfig = row.data || { x:'', tele:'', yt:'', affiliate:{} };
                    renderFooter(); renderArsenal(); renderCustomHub(); 
                } else {
                    let item = row.data || row.Data;
                    if (item) {
                        item.db_id = row.id; 
                        item.id = item.db_id;
                        

                        let isRunning = true;
                        if (item.end) {
                            if (item.end < todayStr) isRunning = false;
                            else if (item.end === todayStr) {
                                let tPart = (item.endTime || "23:59:59").trim();
                                if(tPart.length === 5) tPart += ":00";
                                let endDate = new Date(`${item.end}T${tPart}Z`);
                                if (now > endDate) isRunning = false;
                            }
                        }


                        if (!isRunning) {

                            let sqlList = row.tournament_history || [];

                                if (sqlList.length > 0) {
                                item.real_vol_history = sqlList.map(h => ({
                                    date: h.date,
                                    vol: h.daily_vol
                                })).sort((a,b) => new Date(a.date) - new Date(b.date));
                            } else {
                                item.real_vol_history = [];
                            }


                            let endRecord = sqlList.find(h => h.date === item.end);
                            
                            if (!endRecord && sqlList.length > 0) {
                                sqlList.sort((a,b) => new Date(a.date) - new Date(b.date));
                                endRecord = sqlList[sqlList.length - 1];
                            }

                            if (endRecord) {
                                item.real_alpha_volume = endRecord.daily_vol; 
                                item.total_accumulated_volume = endRecord.vol;
                                item.cachedPrice = endRecord.price;
                                item.display_target = parseFloat(endRecord.target || 0);
                                
                                let d = new Date(endRecord.date); d.setDate(d.getDate() - 1);
                                let prevDateStr = d.toISOString().split('T')[0];
                                let prevRecord = sqlList.find(h => h.date === prevDateStr);
                                item.display_prev_target = prevRecord ? parseFloat(prevRecord.target || 0) : 0;

                                item.market_analysis = {
                                    price: endRecord.price, label: 'ENDED', spread: (item.market_analysis?.spread || 0),
                                    avgTicket: endRecord.daily_vol / (endRecord.tx_count || 1), realTimeVol: 0, velocity: 0
                                };
                            }
                        } 
                        else {

                            if (!item.real_vol_history) item.real_vol_history = [];
                            if (row.tournament_history) {
                                let sorted = row.tournament_history.sort((a,b) => new Date(a.date) - new Date(b.date));
                                let volMap = new Map(); item.real_vol_history.forEach(v => volMap.set(v.date, v));
                                sorted.forEach(s => {
                                    if(volMap.has(s.date)) volMap.get(s.date).vol = s.daily_vol;
                                    else item.real_vol_history.push({date:s.date, vol:s.daily_vol});
                                });
                                item.real_vol_history.sort((a,b) => new Date(a.date) - new Date(b.date));

                                let hToday = sorted.find(h => h.date === todayStr);
                                if(hToday && hToday.vol > 0) item.total_accumulated_volume = hToday.vol;

                                let d = new Date(); d.setDate(d.getDate()-1);
                                let t1 = d.toISOString().split('T')[0]; d.setDate(d.getDate()-1);
                                let t2 = d.toISOString().split('T')[0];
                                
                                if(!item.history) item.history = [];
                                let r1 = item.history.find(h => h.date === t1);
                                let r2 = item.history.find(h => h.date === t2);
                                
                                item.display_target = r1 ? parseFloat(r1.target) : 0;
                                item.display_prev_target = r2 ? parseFloat(r2.target) : 0;
                            }
                        }

                        if (isRunning) tempRunning.push(item);
                        else tempHistory.push(item);
                        tempAll.push(item);
                    }
                }
            });
        }


        appData.running = tempRunning.sort((a,b) => {
            if(!a.end) return 1; if(!b.end) return -1;
            return new Date(a.end) - new Date(b.end);
        });
        
        appData.history = tempHistory.sort((a,b) => new Date(b.end) - new Date(a.end)); 
        
        appData.isDataReady = true;
        compList = tempAll;
        localStorage.setItem('wave_comp_list', JSON.stringify(compList));


        renderGrid(); 
        renderStats();
        initCalendar();
        if (window.competitionRadar) {
            window.competitionRadar.updateRealtimeStats(compList);
        }

        let currentActiveTab = localStorage.getItem('wave_active_tab') || 'running';
        appData.currentTab = currentActiveTab; 
        
        if(currentActiveTab === 'running') {
            renderMarketHealthTable(appData.running);
        } else {
            renderMarketHealthTable(appData.history);
        }

    } catch (err) {
        console.error("Lỗi Fetch (Đã xử lý fallback):", err);
        

        const cached = localStorage.getItem('wave_comp_list');
        if(cached) { 
            let allItems = JSON.parse(cached);
            compList = allItems;


            const todayStr = new Date().toISOString().split('T')[0];
            appData.running = allItems.filter(c => !c.end || c.end >= todayStr);
            appData.history = allItems.filter(c => c.end && c.end < todayStr);


            let currentActiveTab = localStorage.getItem('wave_active_tab') || 'running';
            if (currentActiveTab === 'running') {
                renderMarketHealthTable(appData.running);
            } else {
                renderMarketHealthTable(appData.history);
            }
        }
    } finally {
        if(!isSilent && document.getElementById('loading-overlay')) {
            document.getElementById('loading-overlay').style.display = 'none';
        }
        updateAllPrices();
    }
}



    function renderArsenal() {
        const container = document.getElementById('arsenal-grid');
        if(!container) return;


        container.className = '';
        container.innerHTML = '';



        let exchanges = siteConfig.arsenal_items || [];


        if(exchanges.length === 0) {
            if(document.body.classList.contains('is-admin')) {
                container.innerHTML = `<div class="col-12 text-center text-sub border border-dashed border-secondary p-3 rounded" onclick="openConfigModal()" style="cursor:pointer; font-size:0.8rem">Admin: Click to Add Trading Platforms</div>`;
            }
            return;
        }


        const listCEX = exchanges.filter(e => e.type === 'EXCHANGE');
        const listDEX = exchanges.filter(e => e.type !== 'EXCHANGE');


        const generateCards = (list) => {
            let html = '';
            list.forEach(ex => {

                if(ex.link) {


                    let logoUrl = ex.logo || 'https://placehold.co/50x50/333/999?text=' + ex.name.charAt(0).toUpperCase();

                    html += `
                    <div class="arsenal-card" onclick="trackAffiliateClick('${ex.name}'); window.open('${ex.link}', '_blank'); playSfx('click')">
                        <img src="${logoUrl}" class="ex-logo">
                        <div class="ex-info">
                            <div class="ex-name">${ex.name}</div>
                            <div class="ex-bonus" style="opacity: 0.7; font-weight: normal;">${ex.type}</div>
                        </div>
                    </div>`;
                }
            });
            return html;
        };


        let cexHtml = generateCards(listCEX);
        let dexHtml = generateCards(listDEX);


        if (cexHtml) {
            container.innerHTML += `<div class="text-sub small fw-bold mb-2 ps-1 text-uppercase" style="letter-spacing:1px; font-size:0.7rem"><i class="fas fa-building me-2"></i> CENTRALIZED EXCHANGES (CEX)</div>`;
            container.innerHTML += `<div class="arsenal-grid mb-4">${cexHtml}</div>`;
        }


        if (dexHtml) {
            container.innerHTML += `<div class="text-sub small fw-bold mb-2 ps-1 text-uppercase" style="letter-spacing:1px; font-size:0.7rem"><i class="fas fa-wallet me-2"></i> DECENTRALIZED & WEB3</div>`;
            container.innerHTML += `<div class="arsenal-grid mb-2">${dexHtml}</div>`;
        }
    }



    function trackAffiliateClick(exchangeId) {
        console.log("Tracking Click:", exchangeId);

        if(typeof gtag === 'function') {
            gtag('event', 'click_affiliate', {
                'event_category': 'monetization',
                'event_label': exchangeId
            });
        }
    }


    function renderFooter() {
        const c = document.getElementById('footer-socials-container');
        c.innerHTML = '';


        const fixUrl = (url) => {
            if (!url) return '';

            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return 'https://' + url;
            }
            return url;
        };

        if(siteConfig.x) c.innerHTML += `<a href="${fixUrl(siteConfig.x)}" target="_blank" class="social-btn"><i class="fab fa-twitter"></i></a>`;
        if(siteConfig.tele) c.innerHTML += `<a href="${fixUrl(siteConfig.tele)}" target="_blank" class="social-btn"><i class="fab fa-telegram-plane"></i></a>`;
        if(siteConfig.yt) c.innerHTML += `<a href="${fixUrl(siteConfig.yt)}" target="_blank" class="social-btn"><i class="fab fa-youtube"></i></a>`;


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


    let arsenalList = siteConfig.arsenal_items || [];
    renderArsenalInputs(arsenalList);

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
    if (document.querySelector('.tour-card.active-card')) {
            updateGridValuesOnly(); 
            if(typeof renderMarketHealthTable === 'function') renderMarketHealthTable(); 
            return; 
        }

    const grid = document.getElementById('appGrid');
    if(!grid) return;
    

    let listToRender = customData;



    if (!listToRender && typeof currentFilterDate !== 'undefined' && currentFilterDate) {
        listToRender = compList.filter(c => c.end === currentFilterDate);
    }


    if (!listToRender) {
        if (appData.gridTab === 'history') {
            listToRender = appData.history;
        } else {

            listToRender = appData.running;
        }
    }


    listToRender.sort((a,b) => {
        let posA = (a.orderIndex !== undefined && a.orderIndex !== null) ? a.orderIndex : 9999;
        let posB = (b.orderIndex !== undefined && b.orderIndex !== null) ? b.orderIndex : 9999;
        return posA - posB;
    });

    if(listToRender.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-5 opacity-50"><i class="fas fa-calendar-times fa-3x mb-3 text-sub"></i><h5 class="text-sub font-num">NO DATA FOUND</h5><button class="btn btn-sm btn-outline-secondary mt-2 rounded-pill px-4" onclick="filterByDate(null)">Show All</button></div>`;
        return;
    }

    const isAdmin = document.body.classList.contains('is-admin');
    document.querySelectorAll('.btn-save-pos').forEach(btn => btn.style.display = isAdmin ? 'block' : 'none');

    
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

            if (c.listingTime && c.alphaType !== 'none') {



                let listingDate = new Date(c.listingTime + 'Z'); 

                

                if(isNaN(listingDate.getTime())) listingDate = new Date(c.listingTime);

                let expiryDate = new Date(listingDate.getTime() + (30 * 24 * 60 * 60 * 1000)); 
                let diff = expiryDate - now;

                if (diff > 0) {
                    let d = Math.floor(diff / (1000 * 60 * 60 * 24));
                    let h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    promoTimerHtml = `<div class="promo-timer" title="Promo expires in"><i class="fas fa-bolt" style="font-size:0.6rem"></i> ${d}d ${h}h</div>`;
                } else {
                    isListingExpired = true; 
                }
            }
            
            if (status === 'ended') isListingExpired = true;


            let tagHtml = '';
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





let realVol = (status === 'upcoming') ? 0 : (c.limit_accumulated_volume || c.total_accumulated_volume || 0);


let prefix = (c.limit_accumulated_volume > 0) ? '$' : ''; 
let realVolDisplay = realVol > 0 ? prefix + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(realVol) : '---';
            
            let realVolColor = realVol > 0 ? '#d0aaff' : '#666';

            let target = 0;
            let rawHist = c.history || [];



            let sortedHist = [...rawHist].sort((a,b) => new Date(b.date) - new Date(a.date));

            if (status === 'ended' && c.end) {


                let endRecord = sortedHist.find(h => h.date === c.end);
                
                if (endRecord && parseFloat(endRecord.target) > 0) {
                    target = parseFloat(endRecord.target); 
                } else {


                    let validItem = sortedHist.find(h => h.date <= c.end && parseFloat(h.target) > 0);
                    if (validItem) {
                        target = parseFloat(validItem.target);
                    }
                }
            } else {


                if (sortedHist.length > 0) {
                    target = parseFloat(sortedHist[0].target);
                }
            }
            

            if (isNaN(target)) target = 0;

            
let usePrice = (c.market_analysis && c.market_analysis.price) ? parseFloat(c.market_analysis.price) : 0;

let priceStr = (usePrice > 0) ? '$' + usePrice.toLocaleString('en-US', { maximumFractionDigits: usePrice < 1 ? 6 : 2 }) : '---';
let estVal = (parseFloat(c.rewardQty)||0) * usePrice;

           

let estHtml = estVal > 0 ? `<span class="text-green small fw-bold ms-1 anim-breathe live-est-val" data-qty="${c.rewardQty}">~$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(estVal)}</span>` : '<span class="live-est-val" data-qty="'+(c.rewardQty||0)+'"></span>';

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
                                    ${c.name}
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
                        <div class="stat-cell border-start border-end border-secondary border-opacity-25"><div class="stat-lbl">REWARD</div><div class="stat-val text-brand">${fmtNum(c.rewardQty)}${estHtml}</div></div>
                        <div class="stat-cell"><div class="stat-lbl">PRICE</div><div class="stat-val text-brand fw-bold font-num live-price-val" data-id="${c.db_id}" style="font-size: 1rem; letter-spacing: 0.5px;">${priceStr}</div></div>
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
                    <div class="market-bar">
                        <div class="mb-item text-start">
                            <div class="mb-label">Daily Vol <i class="fas fa-info-circle opacity-50" title="Volume Hôm Nay"></i></div>
                            <div class="mb-val" id="live-vol-${c.db_id}" style="color:${realVolColor}">${realVolDisplay}</div>
                        </div>
                        <div class="mb-item text-end">
    <div class="mb-label" style="justify-content: flex-end; color:#F0B90B">Min Target (Goal)</div>
    
    <div class="mb-val text-gold anim-breathe" style="align-items: center; justify-content: flex-end;">
        <span style="font-size: 1.4rem !important; font-weight: 900 !important; color: #ffca28 !important; line-height: 1; display: inline-block; text-shadow: 0 0 15px rgba(240, 185, 11, 0.5);">
            $${fmtNum(target)}
        </span>
        ${adminEditBtn}
    </div>
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
    

    initSmartTooltips();
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

            let isRunning = !c.end || new Date() < new Date(c.end + 'T' + (c.endTime || '23:59') + 'Z');
            

            let currentPrice = (c.market_analysis && c.market_analysis.price) ? c.market_analysis.price : (c.cachedPrice || 0);
            if (currentPrice > 0) c.cachedPrice = currentPrice;

            let qty = parseFloat(c.rewardQty) || 0;
            let currentTotalVal = qty * currentPrice;

            if (isRunning) {
                totalEstPool += currentTotalVal;
                if (currentTotalVal > maxRewardVal) {
                    maxRewardVal = currentTotalVal;
                    topToken = c;
                }
            }


            const cardWrapper = document.querySelector(`.card-wrapper[data-id="${c.db_id}"]`);
            
            if (cardWrapper) {


const volEl = cardWrapper.querySelector('.market-bar .mb-item:first-child .mb-val');

if (volEl) {

    let rv = c.limit_daily_volume || 0;
    

    if (rv === 0 && c.limit_vol_history && c.limit_vol_history.length > 0) {

        let last = c.limit_vol_history[c.limit_vol_history.length - 1];
        if (last) rv = parseFloat(last.vol);
    }
    
    let rvStr = rv > 0 ? '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rv) : '---';
    
    if(volEl.innerText !== rvStr) {
        volEl.innerText = rvStr;
        volEl.style.color = '#fff';
        volEl.style.textShadow = '0 0 5px #fff';
        setTimeout(() => { volEl.style.color = ''; volEl.style.textShadow = ''; }, 300);
    }
}


                const priceEl = cardWrapper.querySelector('.live-price-val');

if (priceEl && currentPrice > 0) {
    // 1. Format giá tiền (Logic cũ: < $1 lấy 6 số lẻ, > $1 lấy 2 số lẻ)
    let pStr = currentPrice < 1 
        ? '$' + currentPrice.toLocaleString('en-US', { maximumFractionDigits: 6 }) 
        : '$' + currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // 2. Cập nhật UI nếu Giá thay đổi HOẶC Trạng thái thay đổi (để cập nhật màu)
    if (priceEl.innerText !== pStr || c.liveStatus) {
        priceEl.innerText = pStr;

        // --- LOGIC MỚI: MÀU SẮC TỪ SERVER LAYER 2 ---
        if (c.liveColor) {
            // Áp dụng màu trực tiếp từ Server (Xanh/Đỏ/Cyan...)
            priceEl.style.color = c.liveColor;
            priceEl.style.transition = 'color 0.2s ease, text-shadow 0.2s ease'; // Hiệu ứng mượt

            // Nếu Server báo biến động mạnh (DUMP hoặc SLIPPAGE) -> Thêm hiệu ứng phát sáng
            if (c.liveStatus === 'DUMPING' || c.liveStatus === 'SLIPPAGE') {
                priceEl.style.textShadow = `0 0 8px ${c.liveColor}`; // Phát sáng
                priceEl.style.fontWeight = '800'; // Đậm hơn
            } else {
                // Trạng thái bình thường (PRIME, PUMPING, NORMAL)
                priceEl.style.textShadow = 'none';
                priceEl.style.fontWeight = '700';
            }
        } 
        // --- LOGIC CŨ (BACKUP): FLASH MÀU BRAND ---
        else {
            // Nếu chưa kết nối được Server Node.js, dùng lại hiệu ứng cũ
            priceEl.style.color = ''; // Xóa style inline để nhận class CSS
            priceEl.style.textShadow = 'none';
            
            priceEl.classList.remove('text-brand'); // Reset để kích hoạt lại animation
            void priceEl.offsetWidth; // Trigger reflow
            priceEl.classList.add('text-brand');
            
            setTimeout(() => priceEl.classList.remove('text-brand'), 500);
        }
    }
}


                const estEl = cardWrapper.querySelector('.live-est-val');
                if (estEl) {
                    let estQty = parseFloat(estEl.getAttribute('data-qty')) || qty;
                    let estTotal = estQty * currentPrice;
                    if (estTotal > 0) {
                        estEl.innerText = '~$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(estTotal);
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
        console.error("Lỗi cập nhật số liệu Realtime:", e);
    }
}
        

let mhSort = { col: 'reward', dir: 'desc' };

/* ==========================================================
   FIX 1: HÀM SORT NHẬN DIỆN ĐÚNG TAB HIỆN TẠI (ĐÃ SỬA LỖI BIẾN)
   ========================================================== */
window.toggleHealthSort = function(col) {

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

/* ==========================================================
   2. RENDER MARKET HEALTH (BẢN FULL: CÓ HEADER + TỐI ƯU BODY)
   ========================================================== */
function renderMarketHealthTable(dataInput) {
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
        
        
        if (item.end_at) {
            isEnded = nowMs > new Date(item.end_at).getTime();
        } 
        
        else if (item.end) {
            isEnded = nowMs > (new Date(item.end).getTime() + 86400000);
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



    let cols = [
        { key: 'token',       label: 'TOKEN',       align: 'text-center' },
        { key: 'duration',    label: 'TIME',        align: 'text-center', tooltip: 'tip_time' },
        { key: 'win_pool',    label: 'WIN / POOL',  align: 'text-center', tooltip: 'tip_win_pool' },
        { key: 'price_val',   label: 'VAL / PRICE', align: 'text-center', tooltip: 'tip_price_val' },
        { key: 'rule',        label: 'RULE',        align: 'text-center', tooltip: 'tip_rule' },
        { key: 'daily_vol',   label: 'DAILY VOL',   align: 'text-center', tooltip: 'tip_daily_vol' },
        { key: 'camp_vol',    label: 'TOTAL VOL',   align: 'text-center', tooltip: 'tip_camp_vol' }
    ];

    if (!isHistoryTab) {
         cols.push({ key: 'speed_match', label: 'SPD / MATCH', align: 'text-center', tooltip: 'tip_speed_match' });
         cols.push({ key: 'ord_spr',     label: 'ORD / SPR',   align: 'text-center', tooltip: 'tip_ord_spr' });
    }

    cols.push({ key: 'min_vol', label: 'MIN VOL', align: 'text-center', tooltip: 'tip_min_vol' });
    cols.push({ key: 'target', label: 'PREDICTION', align: 'text-center px-2', tooltip: 'tip_pred_header_body', title_key: 'tip_pred_header_title' });


    let thead = table.querySelector('thead');
    if (!thead) { thead = document.createElement('thead'); table.prepend(thead); }
    
    let theadHtml = '<tr>';
    cols.forEach(c => {
        let icon = 'fa-sort';
        let activeClass = '';
        if (typeof mhSort !== 'undefined' && mhSort && mhSort.col === c.key) {
            icon = mhSort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
            activeClass = 'sort-active';
        }
        
        let labelText = t['col_' + c.key] || c.label;
        let tipRaw = c.tooltip ? (t[c.tooltip] || '') : '';
        let labelWithTooltip = labelText;

        if (tipRaw) {
            let safeTip = tipRaw;
            let customTitleKey = c.title_key; 
            let tooltipTitleText = (customTitleKey && t[customTitleKey]) ? t[customTitleKey] : labelText;
            let tooltipContent = `<div class='cyber-tip-content'><div class='cyber-tip-header'><i class='fas fa-info-circle'></i> ${tooltipTitleText}</div><div class='cyber-tip-body'>${safeTip}</div></div>`;
            labelWithTooltip = `<span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-html="true" data-bs-custom-class="custom-cyber-tooltip" title="${tooltipContent.replace(/"/g, '&quot;')}" style="cursor:help; border-bottom: 1px dashed rgba(255,255,255,0.2);">${labelText}</span>`;
        }
        theadHtml += `<th class="${c.align}" onclick="toggleHealthSort('${c.key}')" style="cursor:pointer; user-select:none; vertical-align:middle;">${labelWithTooltip} <i class="fas ${icon} sort-icon ${activeClass}"></i></th>`;
    });
    theadHtml += '</tr>';
    thead.innerHTML = theadHtml;


    if (typeof mhSort !== 'undefined' && projectsToRender.length > 0) {
        if (isHistoryTab && mhSort.col === 'reward') {
            mhSort.col = 'duration';
            mhSort.dir = 'desc'; 
        }
        projectsToRender.sort((a, b) => {
            let pA = (a.market_analysis?.price) || (a.cachedPrice || 0);
            let pB = (b.market_analysis?.price) || (b.cachedPrice || 0);
            const calcCamp = (item) => (item.real_vol_history || []).reduce((acc, i) => acc + parseFloat(i.vol), 0) + (item.real_alpha_volume || 0);
            
            let valA, valB;
            switch(mhSort.col) {
                case 'token':       valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
                case 'daily_vol':   valA = parseFloat(a.real_alpha_volume || 0); valB = parseFloat(b.real_alpha_volume || 0); break;
                case 'camp_vol':    valA = calcCamp(a); valB = calcCamp(b); break;
                case 'duration':    
                    valA = new Date(isHistoryTab ? a.end : a.start).getTime();
                    valB = new Date(isHistoryTab ? b.end : b.start).getTime();
                    break;
                case 'min_vol':      
                    let getT1 = (item) => {
                        let h = item.history || [];
                        if(h.length === 0) return 0;
                        let dTarget = isHistoryTab ? item.end : new Date(new Date().setDate(new Date().getDate()-1)).toISOString().split('T')[0];
                        let f = h.find(x=>x.date===dTarget);
                        if(!isHistoryTab && !f) { let v = h.filter(x=>x.date!==new Date().toISOString().split('T')[0]); if(v.length>0) f=v[v.length-1]; }
                        return f ? parseFloat(f.target) : 0;
                    };
                    valA = getT1(a); valB = getT1(b);
                    break;
                default:            valA = (parseFloat(a.rewardQty)||0) * pA; valB = (parseFloat(b.rewardQty)||0) * pB;
            }
            if (valA < valB) return mhSort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return mhSort.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }



    let html = '';

    if(projectsToRender.length === 0) {
        html = `<tr><td colspan="${cols.length}" class="text-center py-4 text-sub opacity-50">No Data Available</td></tr>`;
    } else {

        const fmtNoDec = (num) => !num ? '$0' : '$' + Math.round(num).toLocaleString('en-US');
        const fmtCompact = (num) => !num ? '$0' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 1 }).format(num);
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
                let d = Math.floor((new Date(c.listingTime + (c.listingTime.includes('Z')?'':'Z')).getTime() + (30*86400000) - now)/86400000);
                if (d >= 0) {
                    let iconUrl = (c.alphaType === 'x4') ? 'https://i.ibb.co/hRS0Z6wf/1000003428.png' : 'https://i.ibb.co/ZyqMBQp/1000003438.png';
                    badgeHtml = `<span class="promo-badge-inline"><img src="${iconUrl}" class="promo-icon-inline"> ${d}d</span>`;
                }
            }
            

            let contractHtml = c.contract ? `<div class="token-sub-row"><div class="contract-box" onclick="event.stopPropagation(); copyContract('${c.contract}')"><i class="far fa-copy"></i> ${c.contract.slice(0,4)}...${c.contract.slice(-4)}</div></div>` : '';


let cleanSym = c.name ? c.name.split('(')[0].trim().toUpperCase() : 'UNKNOWN';
let alphaData = alphaMarketCache[cleanSym] || {};
let localImgPath = c.logo || c.icon || alphaData.icon || './assets/tokens/default.png';
let chainBadge = alphaData.chain_icon ? `<img src="${alphaData.chain_icon}" style="position:absolute; bottom:-2px; right:-2px; width:12px; height:12px; border-radius:50%; background:#000; border:1px solid #333;">` : '';


let tokenHtml = `<div class="token-cell-wrapper" style="justify-content:center;display:flex;align-items:center;gap:8px;">
    <div style="position:relative; display:inline-block;">
        <img src="${localImgPath}" onerror="this.src='./assets/tokens/default.png';" style="width:32px;height:32px;border-radius:50%;border:1px solid #333;flex-shrink:0;">
        ${chainBadge}
    </div>
    <div class="token-info-col" style="text-align:left;"><div class="token-name-row"><span class="token-name-text" style="font-weight:700">${c.name}</span>${badgeHtml}</div>${contractHtml}</div></div>`;


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


            let winPoolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white">${c.topWinners ? c.topWinners.replace(/\(p\d+\)/gi, '').trim() : '--'}</span><span class="cell-secondary">${(parseFloat(c.rewardQty)||0).toLocaleString()} ${c.name}</span></div>`;
            let price = ma.price || c.cachedPrice || 0;
            let priceValHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-highlight">${fmtCompact((parseFloat(c.rewardQty)||0) * price)}</span><span class="cell-secondary">$${price.toLocaleString()}</span></div>`;


            let rt = c.ruleType || 'buy_only'; 
            let ruleHtml = `<div class="cell-stack align-items-center justify-content-center"><div class="rule-pill ${rt==='buy_only'?'rp-buy':'rp-all'} ${isHistoryTab?'opacity-50 grayscale':''}">${rt==='trade_x4'?t.rule_buy_sell:(rt==='trade_all'?t.rule_buy_sell:t.rule_buy)}</div><span class="cell-secondary" style="${rt==='trade_x4'?'color:#F0B90B;font-weight:700;opacity:1':'opacity:0'};font-size:0.65rem;margin-top:2px;">${rt==='trade_x4'?t.rule_limit_x4:'&nbsp;'}</span></div>`;


            let dailyVolHtml = '', campVolHtml = '';
            
            if (isUpcoming) {
                dailyVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-sub opacity-50">--</span><span class="cell-secondary text-gold" style="font-size:0.6rem; font-weight:bold">UPCOMING</span></div>`;
                campVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-sub opacity-50">--</span></div>`;
            } else {


                let todayVol = parseFloat(c.limit_daily_volume || 0);



                let lh = c.limit_vol_history || [];
                
                if (todayVol === 0 && lh.length > 0) {


                    let checkDate = (isHistoryTab && c.end) ? c.end : new Date().toISOString().split('T')[0];
                    
                    let found = lh.find(x => x.date === checkDate);
                    if (found) {
                        todayVol = parseFloat(found.vol);
                    } else {

                        let last = lh[lh.length - 1];
                        if (last) todayVol = parseFloat(last.vol);
                    }
                }


                let subDailyVol = '--';
                let compareDateStr = yestStr; 

                if (isHistoryTab && c.end) {
                    let d = new Date(c.end);
                    d.setDate(d.getDate() - 1);
                    compareDateStr = d.toISOString().split('T')[0];
                }

                let prevItem = lh.find(x => x.date === compareDateStr);
                

                if (!prevItem && isHistoryTab && lh.length >= 2) {
                    let sorted = [...lh].sort((a,b) => new Date(a.date) - new Date(b.date));
                    prevItem = sorted[sorted.length - 2];
                }

                if (prevItem) {
                    let label = isHistoryTab ? 'Prev' : 'Yest';
                    subDailyVol = `${label}: ${fmtNoDec(parseFloat(prevItem.vol))}`;
                }

                dailyVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white" id="vol-${c.db_id}">${fmtNoDec(todayVol)}</span><span class="cell-secondary">${subDailyVol}</span></div>`;
                

                let currentTotal = parseFloat(c.limit_accumulated_volume || 0);
                

                if (currentTotal === 0 && lh.length > 0) {
                     currentTotal = lh.reduce((acc, curr) => acc + parseFloat(curr.vol), 0);
                }

                let estLine = '';
                

                if (!isEnded && !isHistoryTab) {
                    let tPart = (c.endTime || "23:59:59").trim();
                    if(tPart.length === 5) tPart += ":00";
                    let endObj = new Date(`${c.end}T${tPart}Z`);
                    let diffMs = endObj - now;
                    let speed = parseFloat(ma.realTimeVol) || 0;

                    if (diffMs > 0 && speed > 0) {
                        let estFinal = currentTotal + (speed * (diffMs / 1000));
                        estLine = `<div class="cell-secondary" style="
        color: #00F0FF !important;    /* Màu Cyan chuẩn */
        opacity: 1 !important;        /* Hiển thị rõ 100% */
        font-weight: 600;             /* Đậm vừa phải cho dễ đọc */
        font-size: 0.7rem;            /* Kích thước vừa vặn */
        margin-top: 1px;              /* Tách nhẹ khỏi số tổng */
    ">Est: ${fmtNoDec(estFinal)}</div>`;
}
                }
                
                campVolHtml = `<div class="cell-stack justify-content-center">
                    <span id="mh-total-${c.db_id || c.id}" class="cell-primary text-white">${fmtNoDec(currentTotal)}</span>
                    ${estLine}
                </div>`;
            }


            let extraCols = '';
            if (!isHistoryTab) {
                let matchSpdHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white">$${Math.round(parseFloat(ma.realTimeVol)||0).toLocaleString()}</span><span class="cell-secondary">${(parseFloat(ma.velocity)||0) > 0 ? ((parseFloat(ma.velocity)||0)/60).toFixed(1)+' ops' : '0 ops'}</span></div>`;
                let ordSprHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white">$${Math.round(parseFloat(ma.avgTicket)||0).toLocaleString()}</span><span class="cell-secondary ${(parseFloat(ma.spread)||0)>1?'text-red':'text-green'}">${(parseFloat(ma.spread)||0).toFixed(2)}%</span></div>`;
                extraCols = `<td class="text-center">${matchSpdHtml}</td><td class="text-center font-num">${ordSprHtml}</td>`;
            }


            let h = c.history || [];
            let curTarget = 0, diff = 0, hasData = false;
            
            let latest = null;
            let prev = null;

            if (isHistoryTab) {

                

                latest = h.find(x => x.date === c.end);


                if (!latest && h.length > 0) {

                    let sorted = [...h].sort((a,b) => new Date(b.date) - new Date(a.date));

                    latest = sorted.find(x => parseFloat(x.target) > 0);
                }


                if (latest) {
                    let d = new Date(latest.date);
                    d.setDate(d.getDate() - 1);
                    let prevDateStr = d.toISOString().split('T')[0]; 
                    prev = h.find(x => x.date === prevDateStr);
                }

            } else {

                let targetDateStr = yestStr;
                let prevTargetDateStr = dayBeforeStr;
                
                latest = h.find(x => x.date === targetDateStr);
                prev = h.find(x => x.date === prevTargetDateStr);


                if (!latest && h.length > 0) {
                    let todayStr = now.toISOString().split('T')[0];
                    let validHist = h.filter(x => x.date !== todayStr && x.target > 0).sort((a,b) => new Date(a.date) - new Date(b.date));
                    if(validHist.length > 0) { 
                        latest = validHist[validHist.length - 1]; 
                        if(validHist.length > 1) prev = validHist[validHist.length - 2]; 
                    }
                }
            }


            if (latest) { curTarget = parseFloat(latest.target); if (prev) { diff = curTarget - parseFloat(prev.target); hasData = true; } }

            let diffHtml = `<span class="cell-secondary opacity-50">${t.txt_no_data || '--'}</span>`;
            if (hasData) {
                let pct = (curTarget - diff) > 0 ? ((diff / (curTarget - diff)) * 100).toFixed(1) : 0;
                let color = diff >= 0 ? 'text-green' : 'text-red';
                let sign = diff >= 0 ? '+' : '';
                diffHtml = `<span class="${color} cell-secondary" style="font-size:0.7rem; font-weight:bold">${sign}${Math.abs(diff).toLocaleString('en-US')} (${pct}%)</span>`;
            } else if (curTarget > 0) { diffHtml = `<span class="cell-secondary text-brand" style="font-size:0.6rem; font-weight:bold">${t.txt_new || 'NEW'}</span>`; }
            let minVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-gold">${fmtNoDec(curTarget)}</span>${diffHtml}</div>`;

            let aiTargetHtml = (typeof calculateAiTarget === 'function') ? calculateAiTarget(c, isHistoryTab) : '<td class="text-center">--</td>';
            

            html += `<tr style="cursor:pointer; border-bottom: 1px solid rgba(255,255,255,0.05);" onclick="jumpToCard('${c.db_id}')">
                <td class="text-center">${tokenHtml}</td>
                <td class="text-center">${durationHtml}</td>
                <td class="text-center">${winPoolHtml}</td>
                <td class="text-center">${priceValHtml}</td>
                <td class="text-center">${ruleHtml}</td>
                <td class="text-center font-num">${dailyVolHtml}</td>
                <td class="text-center font-num">${campVolHtml}</td>
                ${extraCols}
                <td class="text-center font-num">${minVolHtml}</td>
                ${aiTargetHtml}
            </tr>`;
        });
    }


    tbody.innerHTML = html;
    

    try { var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')); tooltipTriggerList.map(function (el) { return new bootstrap.Tooltip(el); }); } catch(e) {}
}

/* ==========================================================
   FIX UI: 
   1. TÁCH DÒNG DELTA (MARGIN-TOP)
   2. ĐỔI MÀU DELTA SANG BLUE ĐỂ KHÁC BIỆT VỚI MIN VOL
   ========================================================== */
function calculateAiTarget(c, isHistory = false) {
    if (!c) return '<td></td>';


    if (c.name && c.name.toUpperCase().includes('ARB')) {
        return '<td class="text-center"><span style="opacity:0.3; font-size:0.8rem">--</span></td>';
    }


    let prediction = c.ai_prediction || {};
    let target = parseFloat(prediction.target || 0);
    let delta = parseFloat(prediction.delta || 0);


    let now = new Date();
    let todayStr = now.toLocaleDateString('en-CA'); 
    let isFinalDay = (c.end === todayStr);

    let unlockTime = new Date();
    unlockTime.setUTCHours(5, 0, 0, 0); 
    
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
            

            deltaHtml = `<div style="font-size:0.75em; color:${color}; margin-top:4px; font-weight:600;">(${sign}${delta.toLocaleString('en-US')})</div>`;
        }

        contentHtml = `
    <div style="line-height:1.1; display:flex; flex-direction:column; align-items:center;">
        <span class="text-discord fw-bold" style="font-size:1.1em;">$${Math.round(target).toLocaleString('en-US')}</span>
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

/* ==========================================================
   HÀM XỬ LÝ VOTE (OPTIMISTIC UI + API CALL)
   ========================================================== */
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

/* ==========================================================
   HÀM LƯU TỪ POPUP (KHI USER NHẬP SỐ CHO LOW/HIGH)
   ========================================================== */
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

/* ==========================================================
   HÀM KẾT NỐI BACKEND (GỌI TRỰC TIẾP TABLE SUPABASE)
   ========================================================== */
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

    function switchView(view) {
        document.getElementById('view-dashboard').style.display = view==='dashboard'?'block':'none';
        document.getElementById('view-predict').style.display = view==='predict'?'block':'none';
        if(view==='dashboard') { currentPolyId=null; renderGrid(); }
    }

    function switchTab(t) { document.querySelectorAll('.p-tab').forEach(el=>el.classList.remove('active')); document.getElementById(`tab-${t}`).classList.add('active'); ['chart','activity','chat'].forEach(x => document.getElementById(`content-${x}`).style.display = x===t ? (x==='chat'?'flex':'block') : 'none'); }

        


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



    function generateShareCard(userGuess = null) {
        let c = compList.find(x => x.db_id == currentPolyId);
        if(!c) return;


        document.getElementById('sc-token-name').innerText = c.name;


        let uName = userProfile?.nickname || "Trader";

        let uAvatar = userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${uName}&background=random&color=fff&size=128`;

        document.getElementById('sc-user-name').innerText = uName;


        let uaEl = document.getElementById('sc-user-avatar');
        uaEl.crossOrigin = "anonymous";
        uaEl.src = uAvatar + (uAvatar.includes('?')?'&':'?') + 't=' + new Date().getTime();
        uaEl.onerror = function(){ this.src = 'https://placehold.co/50/333/fff?text=' + uName.charAt(0); }; 


        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('sc-date-display').innerText = `${dateStr} | ${timeStr}`;


        let imgEl = document.getElementById('sc-token-img');
        
        let rawName = c.name ? c.name.toUpperCase().trim() : "UNKNOWN";
let cleanSym = rawName.split('(')[0].trim();
let alphaData = alphaMarketCache[cleanSym] || {};
let localImgPath = c.logo || c.icon || alphaData.icon || './assets/tokens/default.png';
        

        imgEl.crossOrigin = "anonymous"; 
        imgEl.src = localImgPath;
        

        imgEl.onerror = function() { 
            this.style.display = 'none'; 
        };
        imgEl.onload = function() {
            this.style.display = 'block';
        };


        let curMin = (c.history && c.history.length>0) ? c.history[c.history.length-1].target : 0;
        document.getElementById('sc-min-vol').innerText = fmtNum(curMin);


        if(!userGuess && currentUser && c.predictions) {
            let myP = c.predictions.find(p => p.user_id === currentUser.id);
            if(myP) userGuess = myP.guess;
        }
        document.getElementById('sc-my-guess').innerText = userGuess ? fmtNum(userGuess) : '---';


        let qrBox = document.getElementById('sc-qr-target');
        qrBox.innerHTML = '';
        let link = siteConfig.affiliate?.binance || window.location.href;
        new QRCode(qrBox, { text: link, width: 50, height: 50 });


        new bootstrap.Modal(document.getElementById('shareCardModal')).show();
    }


    async function shareImageSmart(platform) {
        const element = document.getElementById('share-card-container');
        let c = compList.find(x => x.db_id == currentPolyId);
        let guess = document.getElementById('sc-my-guess').innerText;
        let webUrl = "https://wave-alpha.pages.dev";

        let text = "";
        if (platform === 'x') {
            text = `🚀 I predicted $${c.name} Min Volume: ${guess} on Wave Alpha!\n\nCan you beat me? 👇\n${webUrl}\n\n#WaveAlpha #Crypto #Trading`;
        } else {
            text = `🔥 I predict $${c.name} Min Volume: ${guess}!\nJoin Wave Alpha Terminal here: ${webUrl}`;
        }

        try {
            showToast("Generating image...", "info");


            const canvas = await html2canvas(element, {
                backgroundColor: '#161a1e', scale: 2, useCORS: true, allowTaint: true, logging: false
            });
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            const file = new File([blob], "WaveAlpha-Prediction.png", { type: "image/png" });


            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Wave Alpha Prediction',
                    text: text,
                    files: [file]
                });
                showToast("Shared successfully!", "success");
            } else {


                const link = document.createElement('a');
                link.download = 'WaveAlpha-Prediction.png';
                link.href = canvas.toDataURL('image/png');
                link.click();

                showToast("Image Saved! Please attach it to your post.", "success");

                setTimeout(() => {
                    let shareUrl = "";
                    if (platform === 'x') {
                        let hashtags = `WaveAlpha,Crypto,${c.name}`;
                        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                    } else {
                        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(webUrl)}&text=${encodeURIComponent(text)}`;
                    }
                    window.open(shareUrl, '_blank');
                }, 1000);
            }

        } catch (e) {
            console.error(e);
            showToast("Share failed: " + e.message, "error");
        }
    }


    function shareToX() { shareImageSmart('x'); }
    function shareToTele() { shareImageSmart('tele'); }

    function downloadShareCard() {
        let element = document.getElementById('share-card-container');


        html2canvas(element, {
            backgroundColor: '#161a1e', 
            scale: 2, 
            useCORS: true, 
            allowTaint: true, 
            logging: false
        }).then(canvas => {
            let link = document.createElement('a');
            link.download = 'WaveAlpha-Prediction.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    function sendChat() {
        if(!currentUser) return showToast("Please login to chat!", "error");
        let txt = document.getElementById('chat-msg').value;
        if(!txt) return;
        let c = compList.find(x => x.db_id == currentPolyId);
        if(!c.comments) c.comments = [];

        let displayName = userProfile?.nickname || currentUser.email.split('@')[0];
        c.comments.push({
            user: displayName,
            text: txt,
            time: Date.now(),
            avatar: userProfile?.avatar_url || ''
        });

        let obj = {...c}; delete obj.db_id;
        const payload = {
            name: obj.name || c.name,
            contract: obj.contract || c.contract,
            data: obj
        };

        supabase.from('tournaments').update(payload).eq('id', currentPolyId).then(() => {
            loadFromCloud(false);
        });
        document.getElementById('chat-msg').value = '';
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
    let todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');



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
        


    function openCreateModal() {
        document.getElementById('c-db-id').value = '';


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
        
        start: document.getElementById('c-start').value,
        startTime: document.getElementById('c-start-time').value,
        end: document.getElementById('c-end').value,
        endTime: document.getElementById('c-end-time').value,
        listingTime: document.getElementById('c-listing').value,

        alphaType: document.getElementById('c-alphaType').value,
        ruleType: document.getElementById('c-rule').value,
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
            const endTime = new Date(endTimeStr + 'Z').getTime() + (30*24*60*60*1000);
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


/* ============================================================
   V47: SILENT RELOAD (CẬP NHẬT MƯỢT MÀ KHÔNG NHÁY MÀN HÌNH)
   ============================================================ */

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


    


    function renderArsenalInputs(items = []) {
        const container = document.getElementById('cfg-arsenal-list');
        container.innerHTML = '';

        items.forEach((item, index) => {
            addArsenalItem(item, index);
        });
    }


    function addArsenalItem(data = null, index = null) {
        const container = document.getElementById('cfg-arsenal-list');
        const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9); 

        const name = data ? data.name : '';
        const link = data ? data.link : '';
        const logo = data ? data.logo : '';
        const type = data ? data.type : 'EXCHANGE'; 

        const html = `
        <div class="p-3 rounded border border-secondary border-opacity-25 bg-dark arsenal-item-row" data-id="${uniqueId}">
            <div class="d-flex gap-2 mb-2">
                <input type="text" class="form-control form-control-sm inp-name" placeholder="Tên sàn (VD: Binance)" value="${name}" style="flex:1">
                <select class="form-select form-select-sm inp-type" style="width:130px">
                    <option value="EXCHANGE" ${type==='EXCHANGE'?'selected':''}>Sàn CEX</option>
                    <option value="WEB3 WALLET" ${type==='WEB3 WALLET'?'selected':''}>Binance Wallet</option>
                    <option value="DEX SWAP" ${type==='DEX SWAP'?'selected':''}>Sàn DEX</option>
                </select>
            </div>

            <div class="d-flex gap-2 mb-2 align-items-center">
                <input type="text" class="form-control form-control-sm inp-link" placeholder="Link Ref (https://...)" value="${link}">

                <div class="position-relative btn btn-sm btn-outline-secondary" style="width:35px; overflow:hidden;" title="Logo">
                    <i class="fas fa-camera"></i>
                    <input type="file" onchange="uploadImage(this, 'prev-${uniqueId}', 'val-${uniqueId}')" style="position:absolute;left:0;top:0;opacity:0;cursor:pointer;width:100%;height:100%">
                </div>
                <input type="hidden" class="inp-logo" id="val-${uniqueId}" value="${logo}">
                <img id="prev-${uniqueId}" src="${logo}" style="width:30px;height:30px;object-fit:contain; ${logo?'':'display:none'}; border:1px solid #444; border-radius:4px">
            </div>

            <div class="d-flex justify-content-between">
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-dark border-secondary" onclick="moveItem(this, -1)" title="Lên"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn btn-sm btn-dark border-secondary" onclick="moveItem(this, 1)" title="Xuống"><i class="fas fa-arrow-down"></i></button>
                </div>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('.arsenal-item-row').remove()"><i class="fas fa-trash me-1"></i> Xóa</button>
            </div>
        </div>`;

        container.insertAdjacentHTML('beforeend', html);
    }


    function moveItem(btn, direction) {
        const row = btn.closest('.arsenal-item-row');
        const container = document.getElementById('cfg-arsenal-list');
        if (direction === -1 && row.previousElementSibling) {
            container.insertBefore(row, row.previousElementSibling);
        } else if (direction === 1 && row.nextElementSibling) {
            container.insertBefore(row.nextElementSibling, row);
        }
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
            let price = (c.market_analysis && c.market_analysis.price) ? c.market_analysis.price : (c.cachedPrice || 0);
            

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
    
    let today = new Date().toISOString().split('T')[0];
    let sourceList = compList || []; 

    let listToRender = sourceList.filter(c => {
        let isRunning = c.end >= today;
        return (appData.currentTab === 'running') ? isRunning : !isRunning;
    });

    
    if (currentFilterDate) {
        listToRender = listToRender.filter(c => c.end === currentFilterDate);
    }

    
    
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
    // 1. Cập nhật biến toàn cục và lưu vào LocalStorage để nhớ tab khi F5
    if (typeof appData !== 'undefined') {
        appData.currentTab = tabName;
    }
    localStorage.setItem('wave_active_tab', tabName);

    // 2. Lấy 2 nút bấm từ DOM
    const btnRun = document.getElementById('tab-running');
    const btnHis = document.getElementById('tab-history');

    // 3. Reset giao diện cho cả 2 nút (Về trạng thái inactive - màu xám, nền trong suốt)
    [btnRun, btnHis].forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
            // Dùng setProperty important để đè style của Bootstrap/CSS gốc
            btn.style.setProperty('background', 'transparent', 'important');
            btn.style.setProperty('color', '#848e9c', 'important'); 
            btn.style.setProperty('font-weight', '600', 'important');
            btn.style.boxShadow = 'none';
        }
    });

    // 4. Active nút được chọn (Màu Cyan, đậm hơn)
    const activeBtn = (tabName === 'running') ? btnRun : btnHis;
    if (activeBtn) {
        activeBtn.classList.add('active');
        
        // Màu chữ Cyan neon
        activeBtn.style.setProperty('color', '#00F0FF', 'important'); 
        activeBtn.style.setProperty('font-weight', '800', 'important');
        
        // Thêm nền nhẹ để rõ ràng hơn (nếu bạn muốn giữ trong suốt hoàn toàn thì xóa dòng dưới)
        activeBtn.style.setProperty('background', 'rgba(0, 240, 255, 0.1)', 'important');
    }

    // 5. Quan trọng: Gọi hàm refresh để lọc lại bảng dữ liệu (Running/History)
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


function switchView(view) {

    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-predict').style.display = 'none';


    if (view === 'dashboard') {
        document.getElementById('view-dashboard').style.display = 'block';

        currentPolyId = null;
        renderGrid();
    } 
    else if (view === 'predict') {

        document.getElementById('view-predict').style.display = 'block';
    }
}


function renderCardMiniChart(c, customCanvasId = null) {

    const targetId = customCanvasId || `miniChart-${c.db_id}`;
    const ctxElement = document.getElementById(targetId);
    
    if (!ctxElement) return; 

    let now = new Date();


    let tournamentEndTime = null;
    let isEnded = false;
    if (c.end) {
        tournamentEndTime = new Date(c.end + 'T' + (c.endTime || '23:59:59') + 'Z');
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
        let parts = c.end.split('-'); 
        anchorDate = new Date(Date.UTC(parts[0], parts[1]-1, parts[2], 12, 0, 0));
    } else {
        anchorDate.setUTCHours(12, 0, 0, 0);
    }

    let todayStr = now.toISOString().split('T')[0];

   let adminHistory = c.history || [];
    

    let realHistory = c.limit_vol_history || [];
    
    let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[c.id]) ? userProfile.tracker_data[c.id] : [];
    
    let labels = [];
    let limitVolData = [], projectedData = [], targetData = [];
    let accDatasets = {}; 
    accSettings.forEach(acc => accDatasets[acc.id] = []);

    for (let i = 6; i >= 0; i--) {
        let d = new Date(anchorDate);
        d.setDate(anchorDate.getDate() - i);
        let dStr = d.toISOString().split('T')[0];
        
        if(c.start && dStr < c.start) continue;
        labels.push(d.getUTCDate() + '/' + (d.getUTCMonth()+1));


        let rVal = 0;
        let rItem = realHistory.find(x => x.date === dStr);
        if (rItem) rVal = parseFloat(rItem.vol);
        else if (dStr === todayStr) {

            rVal = parseFloat(c.limit_daily_volume || 0);
        }
        limitVolData.push(rVal);


        let projVal = 0;
        if (dStr === todayStr && !isEnded && secondsRemaining > 0) {
            let stableSpeed = 0;
            if (c.market_analysis && c.market_analysis.realTimeVol) {
                stableSpeed = parseFloat(c.market_analysis.realTimeVol);
            }
            if (stableSpeed > 0) projVal = stableSpeed * secondsRemaining;
        }
        projectedData.push(projVal);


        let tVal = 0;
        let hItem = adminHistory.find(h => h.date === dStr);
        if(hItem) tVal = parseFloat(hItem.target);
        else {
            let prev = adminHistory.filter(h => h.date < dStr).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
            if(prev) tVal = parseFloat(prev.target);
        }
        
        if (dStr === todayStr && !isEnded) {
            targetData.push(null); 
            accSettings.forEach(acc => accDatasets[acc.id].push(null));
        } else {
            targetData.push(tVal);
            let pItem = myProgress.find(p => p.date === dStr);
            accSettings.forEach(acc => {
                let vVal = 0;
                if (pItem && pItem.accsDetail && pItem.accsDetail[acc.id]) vVal = parseFloat(pItem.accsDetail[acc.id].vol);
                else {
                    let prevP = myProgress.filter(p => p.date < dStr).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
                    if(prevP && prevP.accsDetail && prevP.accsDetail[acc.id]) vVal = parseFloat(prevP.accsDetail[acc.id].vol);
                    else vVal = null;
                }
                accDatasets[acc.id].push(vVal);
            });
        }
    }


    let existingChart = Chart.getChart(targetId);
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = limitVolData;
        existingChart.data.datasets[1].data = projectedData;
        existingChart.data.datasets[2].data = targetData;
        accSettings.forEach((acc, index) => {
            if(existingChart.data.datasets[3 + index]) {
                existingChart.data.datasets[3 + index].data = accDatasets[acc.id];
            }
        });
        existingChart.update('none'); 
        return; 
    }


    const ctx = ctxElement.getContext('2d'); 
    let chartDatasets = [
        {
            type: 'bar', label: 'Current', 
            data: limitVolData,
            backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
                gradient.addColorStop(1, 'rgba(0, 240, 255, 0.1)');
                return gradient;
            },
            borderRadius: 4, order: 3, stack: 'volStack', yAxisID: 'y_limit'
        },
        {
            type: 'bar', label: 'Forecast (+)', 
            data: projectedData,
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            borderColor: 'rgba(255, 255, 255, 0.5)',
            borderWidth: {top: 2, right: 2, left: 2, bottom: 0}, 
            borderDash: [4, 4],
            borderRadius: 4, order: 3, stack: 'volStack', yAxisID: 'y_limit'
        },
        {
            type: 'line', label: 'Target', data: targetData,
            borderColor: '#F0B90B', borderWidth: 2, borderDash: [3, 3],
            pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#000', pointBorderColor: '#F0B90B',
            pointBorderWidth: 2, pointHitRadius: 10, 
            fill: false, tension: 0.3, order: 2, yAxisID: 'y_user'
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



const TELE_CONFIG = {
    get token() { return localStorage.getItem('WAVE_TELE_TOKEN'); },
    chatId: '-1003355713341' 
};


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


window.saveTokenFromUI = function() {
    const inputToken = document.getElementById('bot-token-input').value.trim();
    if (!inputToken) return alert("❌ Token is empty!");
    
    localStorage.setItem('WAVE_TELE_TOKEN', inputToken);
    alert("✅ Token saved to this device!");
    checkTokenStatus();
}

function checkTokenStatus() {
    const statusText = document.getElementById('token-status');
    if (localStorage.getItem('WAVE_TELE_TOKEN')) {
        statusText.innerText = "✅ Status: Token Ready. System Operational.";
        statusText.style.color = "#00ff88";
    } else {
        statusText.innerText = "⚠️ Status: Missing Token.";
        statusText.style.color = "orange";
    }
}


window.sendReportFromUI = async function() {
    if (!TELE_CONFIG.token) return alert("⚠️ Token missing! Please save token first.");

    let name = document.getElementById('report-name').value;
    let vol = document.getElementById('report-vol').value;
    let time = document.getElementById('report-time').value;
    let date = new Date().toLocaleDateString('en-GB'); 


    let msg = `
<b>🔔 VOLUME UPDATE (${date})</b>

🏆 <b>Tournament:</b> ${name}
📊 <b>Min Volume:</b> <code>${vol}</code>
⏳ <b>Time Left:</b> ${time}

⚠️ <i>Alert: High volatility detected. Check your position!</i>

👉 <a href="https://t.me/WaveAlphaSignal_bot/miniapp">Open Wave Alpha Terminal</a>
    `;

    const url = `https://api.telegram.org/bot${TELE_CONFIG.token}/sendMessage`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: TELE_CONFIG.chatId,
                text: msg,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        const data = await res.json();
        if(data.ok) alert("✅ Alert sent to Channel successfully!");
        else alert("❌ Telegram Error: " + data.description);
    } catch (err) {
        alert("❌ Network Error!");
    }
}



    document.addEventListener('DOMContentLoaded', function() {
        const tg = window.Telegram.WebApp;
        

        tg.ready();
        tg.expand(); 



        const user = tg.initDataUnsafe?.user;
        if (user) {
            console.log("User from Tele:", user);


            if(document.getElementById('modal-p-name')) {
                document.getElementById('modal-p-name').value = user.username || user.first_name;
            }
        }



if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
    tg.setHeaderColor('#161a1e');
} else {
    console.log("Telegram version 6.0: Header Color not supported (Skipped)");
}
    });






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


    activeCardPlaceholder = document.createElement('div');
    activeCardPlaceholder.className = 'tour-card-placeholder';
    activeCardPlaceholder.style.display = 'none'; 
    el.parentNode.insertBefore(activeCardPlaceholder, el);


    document.body.appendChild(el);



    requestAnimationFrame(() => {
        el.classList.add('active-card');
        

        let canvas = el.querySelector('canvas');
        if (canvas) {

            let dbId = canvas.id.split('-')[1];
            let c = compList.find(x => x.db_id == dbId);
            if(c) renderCardMiniChart(c); 
        }
    });


    const backdrop = document.getElementById('card-backdrop');
    if(backdrop) {
        backdrop.style.display = 'block';
        backdrop.onclick = closeActiveCard; 
        setTimeout(() => backdrop.classList.add('show'), 10);
    }
    document.body.classList.add('has-active-card');
}

function closeActiveCard() {
    const activeEl = document.querySelector('.tour-card.active-card');
    if (!activeEl) return;


    activeEl.classList.remove('active-card');


    if (activeCardPlaceholder && activeCardPlaceholder.parentNode) {
        activeCardPlaceholder.parentNode.insertBefore(activeEl, activeCardPlaceholder);
        activeCardPlaceholder.remove();
    } else {

        activeEl.remove(); 
    }
    activeCardPlaceholder = null;


    const backdrop = document.getElementById('card-backdrop');
    if(backdrop) {
        backdrop.classList.remove('show');
        setTimeout(() => backdrop.style.display = 'none', 300);
    }
    document.body.classList.remove('has-active-card');
}

function jumpToCard(dbId) {

    const wrapper = document.querySelector(`.card-wrapper[data-id="${dbId}"]`);
    
    if (wrapper) {
        const card = wrapper.querySelector('.tour-card');


        if (card) toggleCardHighlight(card);
    }
}


function openCardOverlay(originalCard) {

    closeActiveCard();


    const clone = originalCard.cloneNode(true);
    


    clone.removeAttribute('onclick'); 
    clone.onclick = null; 


    clone.classList.remove('active-card'); 
    clone.classList.add('overlay-clone');
    

    const closeBtn = document.createElement('div');
    closeBtn.className = 'btn-close-overlay';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.onclick = function(e) {
        e.stopPropagation(); 
        closeActiveCard();   
    };
    clone.appendChild(closeBtn);


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


    document.body.appendChild(clone);

    const backdrop = document.getElementById('card-backdrop');
    if(backdrop) {
        backdrop.style.display = 'block';

        backdrop.onclick = function() {
            closeActiveCard();
        };
        setTimeout(() => backdrop.classList.add('show'), 10);
    }
    document.body.classList.add('has-active-card');
}




function updateHealthTableRealtime() {

    if (!document.getElementById('healthTableBody')) return;

    compList.forEach(c => {
        let dbId = c.db_id || c.id;




        let dailyEl = document.getElementById(`vol-${dbId}`);
        if(dailyEl) {
             let dailyVal = parseFloat(c.limit_daily_volume || 0);
             

             if (dailyVal === 0 && c.limit_vol_history && c.limit_vol_history.length > 0) {
                 let last = c.limit_vol_history[c.limit_vol_history.length-1];
                 if(last) dailyVal = parseFloat(last.vol);
             }

             let dailyText = '$' + parseInt(dailyVal).toLocaleString('en-US');
             if(dailyEl.innerText !== dailyText) {
                 dailyEl.innerText = dailyText;
                 dailyEl.style.color = '#fff';
                 setTimeout(() => dailyEl.style.color = '', 300);
             }
        }


        let totalVal = parseFloat(c.limit_accumulated_volume || 0);



        let totalEl = document.getElementById(`mh-total-${dbId}`);
        if (totalEl) {
            let newTotalText = '$' + parseInt(totalVal).toLocaleString('en-US');
            
            if (totalEl.innerText !== newTotalText) {
                totalEl.innerText = newTotalText;

                totalEl.style.transition = 'none';
                totalEl.style.color = '#00F0FF';
                totalEl.style.textShadow = '0 0 10px #00F0FF';
                
                setTimeout(() => { 
                    totalEl.style.transition = 'color 0.5s ease';
                    totalEl.style.color = ''; 
                    totalEl.style.textShadow = ''; 
                }, 500);
            }
        }
    });
}




document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.log("👀 User is back! Checking for updates...");
        


        quickSyncData(); 
        

        const status = supabase.channel('public:tournaments').state;
        if (status !== 'joined' && status !== 'joining') {
            console.log("Reconnecting Realtime...");
            supabase.removeAllChannels();
            init(); 
        }
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





function startRealtimeSync() {
    if (layer2Interval) clearInterval(layer2Interval);
    

    fetchLayer2Data(); 
    layer2Interval = setInterval(fetchLayer2Data, 3000);
}

async function fetchLayer2Data() {
    if (document.hidden) return; 

    try {
        const antiCacheUrl = `${REALTIME_API_URL}?t=${Date.now()}`;
        const res = await fetch(antiCacheUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': REALTIME_API_KEY
            }
        });

        const json = await res.json();
        if (json.success && json.data) {
            applyLayer2Data(json.data);
        }
    } catch (e) {
        
    }
}

function applyLayer2Data(serverData) {
    if (!window.compList || window.compList.length === 0) return;

    const serverItems = Object.values(serverData);
    let hasChanges = false;

    compList.forEach(c => {
        const webName = (c.name || "").toUpperCase().trim();
        
        
        const liveItem = serverItems.find(item => (item.s && item.s.toUpperCase() === webName));

        if (liveItem) {
            c.cachedPrice = liveItem.p;
            c.liveStatus = liveItem.st || 'NORMAL';
            c.liveColor = liveItem.cl || '#0ECB81';
            hasChanges = true;
        }
    });


    if (hasChanges && typeof updateGridValuesOnly === 'function') {
        updateGridValuesOnly();
    }
}

document.addEventListener('DOMContentLoaded', startRealtimeSync);
