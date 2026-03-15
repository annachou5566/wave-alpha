class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.tokens = [];
        this.ripples = []; 
        this.angle = 0;
        this.latestData = null;
        
        // Tọa độ chuột trong Canvas
        this.mouseX = -1;
        this.mouseY = -1;
        // Tọa độ chuột thực trên Màn hình (Để vẽ HUD HTML)
        this.clientX = -1;
        this.clientY = -1;
        
        this.hoveredToken = null;

        this.initHUD(); // Khởi tạo Tooltip HTML

        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Theo dõi chuột
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.clientX = e.clientX;
            this.clientY = e.clientY;
            this.checkHover();
        });

        // Tắt HUD khi chuột rời khỏi Radar
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredToken = null;
            if (this.tooltip) this.tooltip.style.opacity = '0';
            this.canvas.style.cursor = 'default';
        });

        this.animate();
    }

    // --- TẠO HTML TOOLTIP ---
    initHUD() {
        this.tooltip = document.getElementById('sonar-hud-tooltip');
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.id = 'sonar-hud-tooltip';
            document.body.appendChild(this.tooltip);
        }
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.width = parent.clientWidth || 800;
        this.height = parent.clientHeight || 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 40); // Giữ lề 40px cho chữ
    }

    updateData(marketData) {
        if (!marketData) return;
        this.latestData = marketData;
        this.recalculate();
    }

    recalculate() {
        if (!this.latestData || typeof this.latestData !== 'object' || this.width === 0) return;
        
        const oldTxMap = {};
        this.tokens.forEach(t => { oldTxMap[t.symbol] = t.tx; });

        const newTokens = [];
        let maxVol = 0;
        let maxLiq = 0;

        // Quét lần 1 để tìm Max Volume / Liquidity
        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            if (t.v.dt > maxVol) maxVol = t.v.dt;
            let liq = t.l || t.v.dt || 1000;
            if (liq > maxLiq) maxLiq = liq;
        });

        // Quét lần 2 để tạo danh sách Token
        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            
            // XỬ LÝ FIX LỖI "HIỆN TOÀN SỐ"
            let realSymbol = t.symbol || t.s || t.name;
            if (!realSymbol && t.baseToken && t.baseToken.symbol) realSymbol = t.baseToken.symbol;
            if (!realSymbol) {
                if (typeof key === 'string' && isNaN(key)) {
                    realSymbol = key.replace('ALPHA_', '');
                } else {
                    realSymbol = 'UNKNOWN';
                }
            }

            let liq = t.l || t.v.dt || 1000;
            let change = t.c || 0;

            // Tính bán kính (Distance) dựa trên Liquidity/Volume
            let liqRatio = Math.max(0.01, Math.min(1, liq / (maxLiq || 1000000)));
            let r = this.maxRadius * (1 - Math.pow(liqRatio, 0.3));
            if (r < 30) r = 30 + Math.random() * 10; // Không đè ngay tâm

            // Tính góc: Phân bổ dựa trên biến động giá %
            let angleBase = (change / 15) * Math.PI; 
            let angle = angleBase + (Math.random() * 0.5 - 0.25); 
            
            let posX = this.centerX + r * Math.cos(angle);
            // Căn chỉnh trục Y theo chuẩn Canvas (Dương là đi xuống)
            let posY = this.centerY + r * Math.sin(angle); 
            
            let colorHex = change > 0 ? '#00f0ff' : (change < 0 ? '#ff3366' : '#F0B90B');

            // Bắn sóng âm nếu có giao dịch mới (TX tăng)
            if (oldTxMap[realSymbol] !== undefined && (t.tx || 0) > oldTxMap[realSymbol]) {
                this.ripples.push({ x: posX, y: posY, r: 5, alpha: 1, color: colorHex });
            }

            newTokens.push({
                symbol: realSymbol,
                x: posX,
                y: posY,
                // Tính góc thực tế từ tâm để làm hiệu ứng phát sáng khi Radar quét qua
                tAngle: Math.atan2(posY - this.centerY, posX - this.centerX),
                size: Math.max(3, (t.v.dt / (maxVol || 1)) * 10),
                color: colorHex,
                tx: t.tx || 0,
                price: t.p || 0,
                vol: t.v.dt || 0,
                change: change
            });
        });
        
        this.tokens = newTokens;
        this.checkHover();
    }

    // --- CẬP NHẬT GIAO DIỆN HTML HUD ---
    checkHover() {
        this.hoveredToken = null;
        for (let t of this.tokens) {
            let dx = this.mouseX - t.x;
            let dy = this.mouseY - t.y;
            // Tăng vùng hover (Hitbox) lên để dễ trúng hơn
            if (Math.sqrt(dx*dx + dy*dy) < Math.max(t.size * 2, 12)) {
                this.hoveredToken = t;
                break;
            }
        }
        
        this.canvas.style.cursor = this.hoveredToken ? 'crosshair' : 'default';

        if (this.hoveredToken && this.tooltip) {
            const t = this.hoveredToken;
            this.tooltip.style.opacity = '1';
            
            // Tính toán chống tràn màn hình cho Tooltip
            let tipX = this.clientX + 15;
            let tipY = this.clientY + 15;
            
            let tipW = this.tooltip.offsetWidth || 220;
            let tipH = this.tooltip.offsetHeight || 150;

            if (tipX + tipW > window.innerWidth) tipX = this.clientX - tipW - 15;
            if (tipY + tipH > window.innerHeight) tipY = this.clientY - tipH - 15;

            this.tooltip.style.transform = `translate(${tipX}px, ${tipY}px)`;
            
            let cColor = t.change > 0 ? '#0ECB81' : (t.change < 0 ? '#F6465D' : '#F0B90B');
            let cSign = t.change > 0 ? '+' : '';
            let imgSrc = `assets/tokens/${t.symbol.toUpperCase()}.png`;

            // Bơm dữ liệu vào HTML
            this.tooltip.innerHTML = `
                <div class="hud-header">
                    <img class="hud-logo" src="${imgSrc}" onerror="this.src='assets/tokens/default.png'">
                    <div>
                        <div class="hud-symbol" style="color:${t.color}">${t.symbol}</div>
                        <div class="hud-status">Target Locked <i class="fas fa-crosshairs"></i></div>
                    </div>
                </div>
                <div class="hud-row">
                    <span class="hud-label">PRICE (USDT)</span>
                    <span class="hud-val" style="color:#fff;">$${t.price.toFixed(4)}</span>
                </div>
                <div class="hud-row">
                    <span class="hud-label">24H VOL</span>
                    <span class="hud-val" style="color:#F0B90B;">$${Math.round(t.vol).toLocaleString()}</span>
                </div>
                <div class="hud-row">
                    <span class="hud-label">MOMENTUM</span>
                    <span class="hud-val" style="color:${cColor};">${cSign}${t.change.toFixed(2)}%</span>
                </div>
            `;
        } else if (this.tooltip) {
            this.tooltip.style.opacity = '0';
        }
    }

    animate() {
        if (this.width === 0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        // Tạo bóng mờ đen nhạt (Fade Trail)
        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        // --- 1. VẼ LƯỚI MILITARY RADAR ---
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        this.ctx.lineWidth = 1;
        
        // Vòng tròn khoảng cách
        for (let i = 1; i <= 4; i++) {
            let currentRadius = (this.maxRadius / 4) * i;
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Ghi số cự ly 
            if (i < 4) {
                this.ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
                this.ctx.font = '10px Courier New';
                this.ctx.fillText(`${i * 25}%`, this.centerX + 5, this.centerY - currentRadius - 5);
            }
        }

        // Trục chữ thập nét đứt
        this.ctx.setLineDash([4, 4]); 
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.maxRadius);
        this.ctx.lineTo(this.centerX, this.centerY + this.maxRadius);
        this.ctx.moveTo(this.centerX - this.maxRadius, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius, this.centerY);
        this.ctx.stroke();
        this.ctx.setLineDash([]); 

        // Chữ tọa độ N, S, E, W
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
        this.ctx.font = 'bold 12px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('0°/360°', this.centerX + this.maxRadius + 25, this.centerY + 4);
        this.ctx.fillText('180°', this.centerX - this.maxRadius - 20, this.centerY + 4);
        this.ctx.fillText('90°', this.centerX, this.centerY + this.maxRadius + 15);
        this.ctx.fillText('270°', this.centerX, this.centerY - this.maxRadius - 10);
        this.ctx.textAlign = 'left';

        // --- 2. VẼ HIỆU ỨNG SÓNG ÂM (RIPPLES) ---
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            let rip = this.ripples[i];
            this.ctx.beginPath();
            this.ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
            this.ctx.strokeStyle = rip.color;
            this.ctx.globalAlpha = rip.alpha;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            rip.r += 1.2; 
            rip.alpha -= 0.02; 
            if (rip.alpha <= 0) this.ripples.splice(i, 1);
        }
        this.ctx.globalAlpha = 1.0; 

        // Tính góc Tia quét hiện tại (Normalize về 0 -> 2PI)
        let normalizedSweep = this.angle % (Math.PI * 2);
        if (normalizedSweep < 0) normalizedSweep += Math.PI * 2;

        // --- 3. VẼ TOKEN (CÁC MỤC TIÊU/BLIPS) ---
        this.tokens.forEach(t => {
            let tA = t.tAngle;
            if (tA < 0) tA += Math.PI * 2;
            
            // Tính khoảng cách góc giữa Tia quét và Token
            let angleDiff = normalizedSweep - tA;
            if (angleDiff < 0) angleDiff += Math.PI * 2;

            // Logic phát sáng: Tia quét vừa đi qua thì sáng rực
            let blipBrightness = 0.25; // Mặc định mờ mờ
            if (angleDiff < 0.8) {
                blipBrightness = 1.0 - (angleDiff / 0.8);
            }

            let isHovered = (this.hoveredToken && this.hoveredToken.symbol === t.symbol);
            if (isHovered) blipBrightness = 1.0;

            this.ctx.globalAlpha = Math.max(0.2, blipBrightness);

            // Vẽ Lõi sáng (Core)
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            this.ctx.fillStyle = isHovered ? '#fff' : t.color;
            
            // Vẽ Vầng hào quang (Glow)
            this.ctx.shadowBlur = isHovered ? t.size * 5 : t.size * (2 + blipBrightness * 4);
            this.ctx.shadowColor = isHovered ? '#fff' : t.color;
            this.ctx.fill();

            // Hiệu ứng vòng bao (Echo) khi tia vừa lướt qua
            if (blipBrightness > 0.6 && !isHovered) {
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, t.size + 3 + (1 - blipBrightness) * 5, 0, Math.PI * 2);
                this.ctx.strokeStyle = t.color;
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }

            this.ctx.globalAlpha = 1.0;
            this.ctx.shadowBlur = 0;
        });

        // --- 4. TIA QUÉT RADAR (SWEEP BEAM) ---
        this.angle += 0.025; // Tốc độ quét

        // Tia chỉ điểm
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius * Math.cos(this.angle), this.centerY + this.maxRadius * Math.sin(this.angle));
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Vệt sáng mờ sau đuôi (Gradient sector)
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.arc(this.centerX, this.centerY, this.maxRadius, this.angle - 0.7, this.angle, false);
        this.ctx.lineTo(this.centerX, this.centerY);
        
        let grad = this.ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, this.maxRadius);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.3)'); 
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        requestAnimationFrame(() => this.animate());
    }
}
