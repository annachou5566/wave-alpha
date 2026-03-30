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



        tip_time: "Tournament countdown. Shows Start and Market Close dates.",



        tip_win_pool: "Number of winners (Rank) and expected total prize pool value.",



        tip_price_val: "Total prize pool value in USD and real-time Token price.",



        tip_rule: "Trading Rules: Buy Only or Buy + Sell.<br><i style='color:#ffd700'>Sub-line: Volume from Limit orders is privileged with a 4x multiplier (x4).</i>",



        tip_min_vol: "Minimum trading volume required to qualify for the reward list.",



        tip_pred_header_title: "CALCULATION METHODOLOGY",



        tip_pred_header_body: `



            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">



                <b>Data Basis:</b>



            </div>



            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>



                <li><b>Formula:</b> Combines previous Min Vol and 24h Trading Velocity.</li>



                <li><b>Activation:</b> Model starts at <b style="color:#00F0FF">00:00 UTC</b> on the final day.</li>



                <li><b>Frequency:</b> Auto-recalculated and updated every 30 minutes.</li>



                <li><b>Variables:</b> Adjusted based on participant count and market depth (Order Book).</li>



            </ul>



            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">



                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">



                    ⚠ DISCLAIMER:



                </div>



                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">



                    Figures are for reference only and <b>not financial advice</b>. You are solely responsible for your trading decisions.



                </div>



            </div>`,



        tip_model_title: "PROJECTION MODEL",



        tip_model_active: "Target projected based on historical volatility and current growth momentum.",



        tip_vote_guide: "Sentiment? <b class='text-brand'>Agree</b>, <b class='text-danger'>Lower</b>, or <b class='text-success'>Higher</b>.",



        tip_model_wait_title: "DATA ACCUMULATION",



        tip_model_wait_body: "The system is gathering session data for accuracy. Projections activate <span style='color:#ffd700'>16 hours</span> before market close.",



        tip_daily_vol: "Total trading volume recorded today (00:00 to 23:59 UTC).",



        tip_camp_vol: "Total cumulative volume from start to present.<br><i style='color:#00FFFF'>Projected final volume based on real-time estimation algorithms.</i>",



        tip_col_limit: "<b>Limit Only (Off-chain):</b> Volume from Limit orders matched off-chain on the Binance order book.<br><i>Note: Data from users directly placing orders via the Binance Limit order book.</i>",



        tip_col_onchain: "<b>On-Chain Only:</b> Volume from direct transactions on the network (Blockchain).<br><i>Mechanism: Binance routes Instant orders on-chain for execution. Includes external wallet transactions.</i>",



        tip_col_total: "<b>Aggregated (On-Chain + Limit):</b> Total valid volume recorded from both On-chain sources and Limit order books.",







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



         

         tip_time: "Đếm ngược thời gian kết thúc giải đấu. Hiển thị ngày Bắt đầu và ngày Chốt sổ.",



         tip_win_pool: "Số lượng suất nhận thưởng (Rank) và tổng giá trị giải thưởng dự kiến của Pool.",

 

         tip_price_val: "Tổng giá trị giải thưởng quy đổi sang USD và giá thị trường (Real-time) của Token.",

 

         tip_rule: "Luật giao dịch: Chỉ tính lệnh Mua (Buy Only) hoặc tính cả hai chiều (Buy + Sell).<br><i style='color:#ffd700'>Dòng phụ: Volume phát sinh từ lệnh Limit được ưu tiên nhân 4 (x4) khối lượng thực tế.</i>",

 

         tip_min_vol: "Khối lượng giao dịch tối thiểu cần đạt để đủ điều kiện lọt Top nhận thưởng.",

 

           

         tip_pred_header_title: "PHƯƠNG PHÁP TÍNH TOÁN",

 

         tip_pred_header_body: `

 

             <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">

 

                 <b>Cơ sở Dữ liệu:</b>

 

             </div>

 

             <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>

 

                 <li><b>Công thức:</b> Tổng hợp Min Vol phiên trước và Tốc độ giao dịch thực tế (Velocity) trong 24h.</li>

 

                 <li><b>Kích hoạt:</b> Mô hình bắt đầu chạy từ <b style="color:#00F0FF">00:00 UTC</b> ngày cuối cùng.</li>

 

                 <li><b>Tần suất:</b> Tự động tái cấu trúc và cập nhật dữ liệu sau mỗi 30 phút.</li>

 

                 <li><b>Biến số:</b> Điều chỉnh linh hoạt dựa trên lượng người tham gia và độ sâu thanh khoản (Order Book).</li>

 

             </ul>

 

             <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">

 

                 <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">

 

                     ⚠ MIỄN TRỪ TRÁCH NHIỆM:

 

                 </div>

 

                 <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">

 

                     Số liệu chỉ mang tính tham khảo và <b>không phải lời khuyên tài chính</b>. Bạn hoàn toàn chịu trách nhiệm về quyết định giao dịch của mình.

 

                 </div>

 

             </div>`,

 

         tip_model_title: "MÔ HÌNH DỰ BÁO",

 

         tip_model_active: "Mục tiêu dự kiến dựa trên biến động lịch sử và quán tính tăng trưởng hiện tại.",

 

         tip_vote_guide: "Quan điểm? <b class='text-brand'>Đồng ý</b>, <b class='text-danger'>Thấp hơn</b> hay <b class='text-success'>Cao hơn</b>.",

 

         tip_model_wait_title: "GIAI ĐOẠN TÍCH LŨY DỮ LIỆU",

 

         tip_model_wait_body: "Hệ thống đang thu thập dữ liệu phiên để đảm bảo độ chính xác. Dự đoán kích hoạt <span style='color:#ffd700'>16 giờ</span> trước khi đóng phiên.",

 

         

         tip_daily_vol: "Tổng khối lượng giao dịch ghi nhận trong ngày (Tính từ 00:00 đến 23:59 UTC).",

 

         tip_camp_vol: "Tổng khối lượng tích lũy từ khi bắt đầu giải đến hiện tại.<br><i style='color:#00FFFF'>Dự báo tổng Volume cuối giải dựa trên thuật toán ước lượng thời gian thực.</i>",

 

         tip_col_limit: "<b>Chỉ tính Limit (Off-chain):</b> Khối lượng từ các lệnh chờ (Limit Order) được khớp ngoài chuỗi trên sổ lệnh Binance.<br><i>Giải thích: Dữ liệu từ các lệnh người dùng trực tiếp đặt thông qua sổ lệnh Limit trên sàn Binance.</i>",

 

         tip_col_onchain: "<b>Chỉ tính On-Chain:</b> Khối lượng từ các giao dịch trực tiếp trên mạng lưới (Blockchain).<br><i>Cơ chế: Hệ thống Binance đẩy lệnh Tức thì (Instant Order) lên On-chain để khớp lệnh. Bao gồm cả giao dịch từ ví ngoài.</i>",

 

         tip_col_total: "<b>Tổng hợp (On-Chain + Limit):</b> Toàn bộ khối lượng giao dịch hợp lệ từ cả hai nguồn On-chain (lệnh tức thì/ví ngoài) và sổ lệnh Limit (lệnh chờ).",

 

     



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



        

        tip_time: "锦标赛倒计时。显示开始和结束日期。",



        tip_win_pool: "获奖名额（排名）及预计奖池总价值。",



        tip_price_val: "折算为美元的奖池总价值及代币实时市场价格。",



        tip_rule: "交易规则：仅买入或买入+卖出。<br><i style='color:#ffd700'>下行：限价单 (Limit) 交易量享有 4 倍权重 (x4)。</i>",



        tip_min_vol: "获得奖励所需的最低交易量门槛。",



        tip_pred_header_title: "计算方法论",



        tip_pred_header_body: `



            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">



                <b>数据基础：</b>



            </div>



            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>



                <li><b>公式：</b> 综合前期最低成交量与 24 小时交易速率 (Velocity)。</li>



                <li><b>激活：</b> 模型于最后一天 <b style="color:#00F0FF">00:00 UTC</b> 激活。</li>



                <li><b>频率：</b> 每 30 分钟自动重新计算并更新数据。</li>



                <li><b>变量：</b> 根据参与人数和市场深度（订单簿）灵活调整。</li>



            </ul>



            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">



                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">



                    ⚠ 免责声明：



                </div>



                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">



                    数据仅供参考，<b>不构成财务建议</b>。您需对交易决策承担全部责任。



                </div>



            </div>`,



        tip_model_title: "预测模型",



        tip_model_active: "基于历史波动率和当前增长动能的预估目标。",



        tip_vote_guide: "观点？ <b class='text-brand'>赞同</b>, <b class='text-danger'>看低</b> 或 <b class='text-success'>看高</b>。",



        tip_model_wait_title: "数据积累阶段",



        tip_model_wait_body: "系统正在收集赛段数据以确保准确性。预测将在结束前 <span style='color:#ffd700'>16 小时</span> 激活。",



        tip_daily_vol: "今日总成交量（UTC 00:00 至 23:59）。",



        tip_camp_vol: "自开赛以来的累计总成交量。<br><i style='color:#00FFFF'>基于实时估算算法的最终成交量预测。</i>",



        tip_col_limit: "<b>仅限价 (Off-chain):</b> 交易量源自币安订单簿上的脱链限价单。<br><i>说明：用户通过币安限价订单簿直接下单的数据。</i>",



        tip_col_onchain: "<b>仅链上:</b> 来自区块链网络直接交易的成交量。<br><i>机制：币安将即时订单传送到链上执行。包括外部钱包交易。</i>",



        tip_col_total: "<b>综合 (链上 + 限价):</b> 整合了来自链上和限价单的所有有效成交量。",







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



        

        tip_time: "토너먼트 종료 카운트다운. 시작일 및 마감일 표시.",



        tip_win_pool: "보상 당첨 인원(순위) 및 총 상금 풀 예상 가치.",



        tip_price_val: "USD 환산 총 상금 및 토큰 실시간 가격.",



        tip_rule: "거래 규칙: 매수 전용 또는 매수+매도.<br><i style='color:#ffd700'>하단: 지정가(Limit) 주문을 통한 거래량은 4배(x4) 가중치가 적용됩니다.</i>",



        tip_min_vol: "보상 지급 대상이 되기 위한 최소 거래량.",



        tip_pred_header_title: "산출 방법론",



        tip_pred_header_body: `



            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">



                <b>데이터 근거:</b>



            </div>



            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>



                <li><b>공식:</b> 이전 최소 거래량과 24시간 거래 속도(Velocity)를 결합.</li>



                <li><b>활성화:</b> 마지막 날 <b style="color:#00F0FF">00:00 UTC</b>부터 모델 활성화.</li>



                <li><b>주기:</b> 30분마다 자동 재계산 및 데이터 업데이트.</li>



                <li><b>변수:</b> 참여자 수 및 시장 깊이(오더북)에 따라 유동적 조정.</li>



            </ul>



            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">



                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">



                    ⚠ 면책 조항:



                </div>



                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">



                    수치는 참고용일 뿐이며 <b>재정적 조언이 아닙니다</b>. 모든 거래 결정은 본인의 책임입니다.



                </div>



            </div>`,



        tip_model_title: "예측 모델",



        tip_model_active: "과거 변동성 및 현재 성장 모멘텀 기반 예상 목표.",



        tip_vote_guide: "의견은? <b class='text-brand'>동의</b>, <b class='text-danger'>낮음</b> 또는 <b class='text-success'>높음</b>.",



        tip_model_wait_title: "데이터 축적 단계",



        tip_model_wait_body: "시스템이 정확성을 위해 세션 데이터를 수집 중입니다. 종료 <span style='color:#ffd700'>16시간 전</span>부터 예측이 활성화됩니다.",



        tip_daily_vol: "오늘 총 거래량 (UTC 00:00 ~ 23:59).",



        tip_camp_vol: "시작부터 현재까지의 누적 거래량.<br><i style='color:#00FFFF'>실시간 알고리즘 기반 최종 누적 거래량 예상치.</i>",



        tip_col_limit: "<b>지정가 전용 (Off-chain):</b> 바이낸스 오더북에서 체결된 오프체인 지정가 주문 거래량.<br><i>설명: 사용자가 바이낸스 지정가 오더북을 통해 직접 넣은 주문 데이터.</i>",



        tip_col_onchain: "<b>온체인 전용:</b> 네트워크상의 직접 거래량.<br><i>메커니즘: 바이낸스는 즉시 주문을 온체인으로 전송하여 처리합니다. 외부 지갑 거래 포함.</i>",



        tip_col_total: "<b>종합 (온체인 + 지정가):</b> 온체인 및 지정가 오더북에서 기록된 모든 유효 거래량 합계.",



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

    initBinanceTooltips();

}

