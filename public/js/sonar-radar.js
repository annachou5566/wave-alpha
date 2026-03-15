class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.tokens = [];
        this.ripples = []; // Hiệu ứng sóng âm khi có giao dịch mới
        this.angle = 0;
        this.latestData = null;
        
        this.mouseX = -1;
        this.mouseY = -1;
        this.hoveredToken = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Theo dõi chuột để hiển thị Tooltip
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.checkHover();
        });

        this.animate();
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.width = parent.clientWidth || 800;
        this.height = parent.clientHeight || 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 20);
    }

    updateData(marketData) {
        if (!marketData) return;
        this.latestData = marketData;
        this.recalculate();
    }

    recalculate() {
        if (!this.latestData || typeof this.latestData !== 'object' || this.width === 0) return;
        
        // Lưu lại Tx cũ để phát hiện sóng âm (Ripples)
        const oldTxMap = {};
        this.tokens.forEach(t => { oldTxMap[t.symbol] = t.tx; });

        const newTokens = [];
        let maxVol = 0;
        let maxLiq = 0;

        // Vòng 1: Tìm Max để tính tỷ lệ (Bỏ qua metadata rác)
        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            if (t.v.dt > maxVol) maxVol = t.v.dt;
            let liq = t.l || t.v.dt || 1000;
            if (liq > maxLiq) maxLiq = liq;
        });

        // Vòng 2: Chuyển dữ liệu thành tọa độ vẽ
        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            
            let symbol = t.symbol || key.replace('ALPHA_', '');
            let liq = t.l || t.v.dt || 1000;
            let change = t.c || 0;

            // Bán kính: Thanh khoản cao nằm gần tâm
            let liqRatio = Math.max(0.01, Math.min(1, liq / (maxLiq || 1000000)));
            let r = this.maxRadius * (1 - Math.pow(liqRatio, 0.3));
            if (r < 25) r = 25 + Math.random() * 5;

            // Góc: Tăng nằm bên phải, giảm nằm bên trái
            let angle = (change / 15) * Math.PI; 
            
            let posX = this.centerX + r * Math.cos(angle);
            let posY = this.centerY - r * Math.sin(angle);
            let colorHex = change > 0 ? '#00f0ff' : (change < 0 ? '#ff3366' : '#ffffff');

            // Tạo hiệu ứng sóng âm khi có giao dịch (Tx tăng)
            if (oldTxMap[symbol] !== undefined && (t.tx || 0) > oldTxMap[symbol]) {
                this.ripples.push({ x: posX, y: posY, r: 5, alpha: 1, color: colorHex });
            }

            newTokens.push({
                symbol: symbol,
                x: posX,
                y: posY,
                size: Math.max(3, (t.v.dt / (maxVol || 1)) * 15),
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

    checkHover() {
        this.hoveredToken = null;
        for (let t of this.tokens) {
            let dx = this.mouseX - t.x;
            let dy = this.mouseY - t.y;
            if (Math.sqrt(dx*dx + dy*dy) < Math.max(t.size, 10)) {
                this.hoveredToken = t;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredToken ? 'crosshair' : 'default';
    }

    animate() {
        if (this.width === 0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        // Tạo bóng mờ cho tia quét (Fade effect)
        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Vẽ lưới Radar
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, (this.maxRadius / 4) * i, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Vẽ trục tọa độ
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.maxRadius);
        this.ctx.lineTo(this.centerX, this.centerY + this.maxRadius);
        this.ctx.moveTo(this.centerX - this.maxRadius, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius, this.centerY);
        this.ctx.stroke();

        // Vẽ hiệu ứng Sóng âm (Ripple) khi nổ Tx
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            let rip = this.ripples[i];
            this.ctx.beginPath();
            this.ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
            this.ctx.strokeStyle = rip.color;
            this.ctx.globalAlpha = rip.alpha;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            rip.r += 0.8; 
            rip.alpha -= 0.015; 
            if (rip.alpha <= 0) this.ripples.splice(i, 1);
        }
        this.ctx.globalAlpha = 1.0; 

        // Vẽ Token (Đốm sáng)
        this.tokens.forEach(t => {
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            this.ctx.fillStyle = t.color;
            
            if (this.hoveredToken && this.hoveredToken.symbol === t.symbol) {
                this.ctx.shadowBlur = t.size * 4;
                this.ctx.shadowColor = '#fff';
                this.ctx.fillStyle = '#fff';
            } else {
                this.ctx.shadowBlur = t.size * 2;
                this.ctx.shadowColor = t.color;
            }
            this.ctx.fill();
        });
        this.ctx.shadowBlur = 0;

        // Tia quét Radar (Tia quay)
        this.angle += 0.02;
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius * Math.cos(this.angle), this.centerY + this.maxRadius * Math.sin(this.angle));
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Hình quạt mờ sau tia quét
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.arc(this.centerX, this.centerY, this.maxRadius, this.angle - 0.5, this.angle, false);
        this.ctx.lineTo(this.centerX, this.centerY);
        let grad = this.ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, this.maxRadius);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.15)');
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        // Bảng Tooltip khi Hover (Xử lý chống tràn)
        if (this.hoveredToken) {
            const t = this.hoveredToken;
            this.ctx.fillStyle = 'rgba(10, 14, 23, 0.95)';
            this.ctx.strokeStyle = t.color;
            this.ctx.lineWidth = 1;
            
            let boxW = 140, boxH = 75;
            let boxX = this.mouseX + 15;
            let boxY = this.mouseY + 15;
            if (boxX + boxW > this.width) boxX = this.mouseX - boxW - 15;
            if (boxY + boxH > this.height) boxY = this.mouseY - boxH - 15;

            this.ctx.beginPath();
            if (this.ctx.roundRect) {
                this.ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            } else {
                this.ctx.rect(boxX, boxY, boxW, boxH); // Fallback cho trình duyệt cũ
            }
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.fillText(t.symbol, boxX + 10, boxY + 20);

            this.ctx.font = '12px Arial';
            this.ctx.fillStyle = '#848e9c';
            this.ctx.fillText(`Giá: $${t.price.toFixed(4)}`, boxX + 10, boxY + 38);
            this.ctx.fillText(`Vol: $${Math.round(t.vol).toLocaleString()}`, boxX + 10, boxY + 54);

            this.ctx.fillStyle = t.color;
            this.ctx.fillText(`${t.change > 0 ? '+' : ''}${t.change.toFixed(2)}%`, boxX + 10, boxY + 70);
        }

        requestAnimationFrame(() => this.animate());
    }
}
