class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.tokens = [];
        this.angle = 0;
        this.latestData = null; // Lưu data để vẽ lại khi đổi Tab
        this.resize();
        window.addEventListener('resize', () => this.resize());
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
        this.maxRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 20); // Chống số âm
        this.recalculate(); // Tính lại tọa độ ngay lập tức
    }

    updateData(marketData) {
        if (!marketData) return;
        this.latestData = marketData;
        this.recalculate();
    }

    recalculate() {
        if (!this.latestData || this.width === 0) return;
        const newTokens = [];
        let maxVol = 0, maxLiq = 0;

        Object.values(this.latestData).forEach(t => {
            if (!t.v || t.ss === 1) return;
            if (t.v.dt > maxVol) maxVol = t.v.dt;
            if (t.l > maxLiq) maxLiq = t.l;
        });

        Object.values(this.latestData).forEach(t => {
            if (!t.v || t.ss === 1 || t.l <= 0) return;
            let size = Math.max(1.5, (t.v.dt / maxVol) * 15); 
            let liqRatio = Math.max(0.01, t.l / maxLiq);
            let r = this.maxRadius * (1 - Math.pow(liqRatio, 0.2)); 
            if (r < 20) r = 20 + Math.random() * 20;

            let c = t.c || 0;
            let mappedAngle = (c / 15) * Math.PI; 
            
            newTokens.push({
                symbol: t.symbol,
                x: this.centerX + r * Math.cos(mappedAngle),
                y: this.centerY - r * Math.sin(mappedAngle),
                size: size,
                color: c > 0 ? '#00f0ff' : (c < 0 ? '#ff3366' : '#ffffff'),
                tx: t.tx
            });
        });
        this.tokens = newTokens;
    }

    animate() {
        if (this.width === 0) { // Nếu đang bị ẩn thì không tốn CPU vẽ
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

        this.tokens.forEach(t => {
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            this.ctx.fillStyle = t.color;
            this.ctx.shadowBlur = t.size * 2;
            this.ctx.shadowColor = t.color;
            this.ctx.fill();
        });
        this.ctx.shadowBlur = 0;

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

        requestAnimationFrame(() => this.animate());
    }
}
