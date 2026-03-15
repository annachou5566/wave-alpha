class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.tokens = [];
        this.angle = 0; // Góc của tia quét radar
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        // Lấy kích thước của thẻ bọc bên ngoài
        const parent = this.canvas.parentElement;
        this.width = parent.clientWidth || 800;
        this.height = parent.clientHeight || 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.min(this.centerX, this.centerY) - 20;
    }

    // Hàm nhận dữ liệu GLOBAL_MARKET mỗi 3 giây
    updateData(marketData) {
        if (!marketData) return;
        const newTokens = [];
        let maxVol = 0;
        let maxLiq = 0;

        // Tìm Max để chia tỷ lệ
        Object.values(marketData).forEach(t => {
            if (!t.v || t.ss === 1) return; // Bỏ qua nếu không có vol hoặc là RWA
            if (t.v.dt > maxVol) maxVol = t.v.dt;
            if (t.l > maxLiq) maxLiq = t.l;
        });

        // Ánh xạ (Map) dữ liệu vào tọa độ không gian
        Object.values(marketData).forEach(t => {
            if (!t.v || t.ss === 1 || t.l <= 0) return;
            
            // 1. Độ to (Size) dựa vào Daily Vol
            let size = Math.max(1.5, (t.v.dt / maxVol) * 15); 

            // 2. Khoảng cách tâm (Radius): Thanh khoản to (Cá mập) ở giữa, Rác ở ngoài rìa
            let liqRatio = Math.max(0.01, t.l / maxLiq);
            // Dùng 1 - sqrt để đảo ngược: Liq to -> r nhỏ (gần tâm)
            let r = this.maxRadius * (1 - Math.pow(liqRatio, 0.2)); 
            if (r < 20) r = 20 + Math.random() * 20; // Tránh dính hẳn vào tâm

            // 3. Góc (Angle) dựa vào % Change (c)
            // Xanh (c > 0) nằm nửa trên, Đỏ (c < 0) nằm nửa dưới
            let c = t.c || 0;
            // Ánh xạ % (-15% đến +15%) thành góc Radar (0 đến 360 độ)
            let mappedAngle = (c / 15) * Math.PI; 
            
            newTokens.push({
                symbol: t.symbol,
                x: this.centerX + r * Math.cos(mappedAngle),
                y: this.centerY - r * Math.sin(mappedAngle), // Trừ vì Y của canvas hướng xuống
                size: size,
                color: c > 0 ? '#00f0ff' : (c < 0 ? '#ff3366' : '#ffffff'),
                tx: t.tx,
                pingAlpha: 0 // Hiệu ứng lóe sáng
            });
        });

        this.tokens = newTokens;
    }

    animate() {
        // Hiệu ứng "Bóng mờ" (Trail) của tia quét - Nền đen trong suốt
        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Vẽ các vòng tròn Radar lưới
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, (this.maxRadius / 4) * i, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Vẽ trục chữ thập
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.maxRadius);
        this.ctx.lineTo(this.centerX, this.centerY + this.maxRadius);
        this.ctx.moveTo(this.centerX - this.maxRadius, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius, this.centerY);
        this.ctx.stroke();

        // Vẽ đốm sáng Token
        this.tokens.forEach(t => {
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            this.ctx.fillStyle = t.color;
            this.ctx.shadowBlur = t.size * 2;
            this.ctx.shadowColor = t.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0; // Reset
        });

        // Vẽ tia quét xoay (Sweep Line)
        this.angle += 0.02; // Tốc độ xoay
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        let endX = this.centerX + this.maxRadius * Math.cos(this.angle);
        let endY = this.centerY + this.maxRadius * Math.sin(this.angle);
        this.ctx.lineTo(endX, endY);
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Vẽ dải sáng Gradient của tia quét
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
