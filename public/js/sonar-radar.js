class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.tokens = [];
        this.ripples = []; // Chứa hiệu ứng sóng âm (Ping)
        this.angle = 0;
        this.latestData = null;
        
        this.mouseX = -1;
        this.mouseY = -1;
        this.hoveredToken = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Bắt sự kiện rê chuột
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
        this.recalculate();
    }

    updateData(marketData) {
    console.log("=== Sonar: Nhận dữ liệu mới ===", marketData); // Xem dữ liệu có đổ về không
    if (!marketData) {
        console.warn("Sonar: Dữ liệu marketData bị rỗng!");
        return;
    }
    this.latestData = marketData;
    this.recalculate();
}

recalculate() {
    console.log("Sonar: Bắt đầu tính toán lại Radar...");
    if (!this.latestData || typeof this.latestData !== 'object') {
        console.error("Sonar: latestData không hợp lệ!", this.latestData);
        return;
    }
    
    if (this.width === 0 || this.height === 0) {
        console.error("Sonar: Kích thước Canvas bằng 0, không thể vẽ!", {w: this.width, h: this.height});
        return;
    }

    try {
        const newTokens = [];
        let maxVol = 0;

        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v) return;
            if (t.v.dt > maxVol) maxVol = t.v.dt;
        });

        console.log(`Sonar: Tìm thấy ${Object.keys(this.latestData).length} mục, Vol lớn nhất: ${maxVol}`);

        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            
            let symbol = t.symbol || key.replace('ALPHA_', '');
            let liq = t.l || t.v.dt || 1000;
            let size = Math.max(2, (t.v.dt / (maxVol || 1)) * 15); 
            let liqRatio = Math.max(0.01, liq / 1000000); 
            let r = this.maxRadius * (1 - Math.min(1, liqRatio)); 
            
            let c = t.c || 0;
            let mappedAngle = (c / 15) * Math.PI; 
            
            newTokens.push({
                symbol: symbol,
                x: this.centerX + r * Math.cos(mappedAngle),
                y: this.centerY - r * Math.sin(mappedAngle),
                size: size,
                color: c > 0 ? '#00f0ff' : (c < 0 ? '#ff3366' : '#ffffff')
            });
        });

        this.tokens = newTokens;
        console.log(`Sonar: Đã xử lý xong ${this.tokens.length} token để vẽ.`);
    } catch (err) {
        console.error("Sonar: Lỗi nghiêm trọng trong recalculate:", err);
    }
}

    checkHover() {
        this.hoveredToken = null;
        for (let t of this.tokens) {
            let dx = this.mouseX - t.x;
            let dy = this.mouseY - t.y;
            // Cho diện tích nhận chuột to hơn đốm sáng một chút (dễ trỏ trúng)
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

        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, (this.maxRadius / 4) * i, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.maxRadius);
        this.ctx.lineTo(this.centerX, this.centerY + this.maxRadius);
        this.ctx.moveTo(this.centerX - this.maxRadius, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius, this.centerY);
        this.ctx.stroke();

        // Vẽ hiệu ứng Sóng âm (Ripple)
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            let rip = this.ripples[i];
            this.ctx.beginPath();
            this.ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
            this.ctx.strokeStyle = rip.color;
            this.ctx.globalAlpha = rip.alpha;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            rip.r += 0.8; // Tốc độ lan tỏa
            rip.alpha -= 0.015; // Tốc độ mờ dần
            if (rip.alpha <= 0) this.ripples.splice(i, 1);
        }
        this.ctx.globalAlpha = 1.0; 

        // Vẽ Token
        this.tokens.forEach(t => {
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            this.ctx.fillStyle = t.color;
            
            if (this.hoveredToken && this.hoveredToken.symbol === t.symbol) {
                this.ctx.shadowBlur = t.size * 4;
                this.ctx.shadowColor = '#fff';
                this.ctx.fillStyle = '#fff'; // Bật trắng khi trỏ chuột
            } else {
                this.ctx.shadowBlur = t.size * 2;
                this.ctx.shadowColor = t.color;
            }
            this.ctx.fill();
        });
        this.ctx.shadowBlur = 0;

        // Tia quét Radar
        this.angle += 0.02;
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius * Math.cos(this.angle), this.centerY + this.maxRadius * Math.sin(this.angle));
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.arc(this.centerX, this.centerY, this.maxRadius, this.angle - 0.5, this.angle, false);
        this.ctx.lineTo(this.centerX, this.centerY);
        let grad = this.ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, this.maxRadius);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.15)');
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        // Bảng Tooltip khi Hover
        if (this.hoveredToken) {
            const t = this.hoveredToken;
            this.ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
            this.ctx.strokeStyle = t.color;
            this.ctx.lineWidth = 1;
            
            let boxW = 140, boxH = 75;
            let boxX = this.mouseX + 15;
            let boxY = this.mouseY + 15;
            // Chống tràn màn hình
            if (boxX + boxW > this.width) boxX = this.mouseX - boxW - 15;
            if (boxY + boxH > this.height) boxY = this.mouseY - boxH - 15;

            this.ctx.beginPath();
            this.ctx.roundRect(boxX, boxY, boxW, boxH, 6);
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
