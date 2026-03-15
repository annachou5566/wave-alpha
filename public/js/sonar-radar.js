class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) return;

        this.tokens = [];
        this.ripples = [];
        this.alertFeed = [];
        this.latestData = null;

        this.mouseX = -1;
        this.mouseY = -1;
        this.hoveredToken = null;

        this.angle = 0;
        this.frame = 0;
        this.isPaused = false;

        this.maxFeedItems = 5;
        this.maxRipples = 200;
        this.lastFrameAt = performance.now();
        this.fps = 60;

        this.resize();

        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.checkHover();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseX = -1;
            this.mouseY = -1;
            this.hoveredToken = null;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('dblclick', () => {
            this.isPaused = !this.isPaused;
        });

        this.animate();
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.width = parent?.clientWidth || 800;
        this.height = parent?.clientHeight || 600;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.max(60, Math.min(this.centerX, this.centerY) - 26);

        if (this.latestData) this.recalculate();
    }

    updateData(marketData) {
        if (!marketData || typeof marketData !== 'object') return;
        this.latestData = marketData;
        this.recalculate();
    }

    getToneByChange(change) {
        if (change > 0) return '#00f0ff';
        if (change < 0) return '#ff3366';
        return '#cfd6e4';
    }

    logAlert(symbol, message, tone = 'info') {
        const colorMap = {
            info: '#9ca3af',
            up: '#00f0ff',
            down: '#ff3366',
            hot: '#f0b90b'
        };

        this.alertFeed.unshift({
            text: `${symbol}: ${message}`,
            color: colorMap[tone] || '#9ca3af',
            at: Date.now()
        });

        if (this.alertFeed.length > this.maxFeedItems) {
            this.alertFeed.length = this.maxFeedItems;
        }
    }

    normalizeEntry(key, t, maxVol, maxLiq, oldMap) {
        const symbol = t.symbol || key.replace('ALPHA_', '');
        const change = Number(t.c || 0);
        const vol = Number(t?.v?.dt || 0);
        const liq = Number(t.l || vol || 1000);
        const tx = Number(t.tx || 0);
        const price = Number(t.p || 0);

        const liqRatio = Math.max(0.01, Math.min(1, liq / (maxLiq || 1)));
        let radius = this.maxRadius * (1 - Math.pow(liqRatio, 0.32));
        radius = Math.max(20, radius);

        const angle = (change / 18) * Math.PI;
        const targetX = this.centerX + radius * Math.cos(angle);
        const targetY = this.centerY - radius * Math.sin(angle);

        const old = oldMap.get(symbol);
        const smooth = old ? 0.2 : 1;
        const x = old ? old.x + (targetX - old.x) * smooth : targetX;
        const y = old ? old.y + (targetY - old.y) * smooth : targetY;

        const size = Math.max(3.5, Math.min(18, (vol / (maxVol || 1)) * 18));
        const tone = this.getToneByChange(change);

        if (old && tx > old.tx) {
            this.ripples.push({ x, y, r: size * 0.7, alpha: 0.95, color: tone });

            const txDelta = tx - old.tx;
            if (txDelta >= 20) {
                this.logAlert(symbol, `TX spike +${txDelta.toLocaleString()}`, 'hot');
            }
        }

        if (old && Math.abs(change - old.change) >= 2.5) {
            this.logAlert(
                symbol,
                `Momentum ${change > old.change ? 'up' : 'down'} ${change.toFixed(2)}%`,
                change > old.change ? 'up' : 'down'
            );
        }

        return {
            symbol,
            x,
            y,
            targetX,
            targetY,
            size,
            color: tone,
            tx,
            price,
            vol,
            liq,
            change,
            liqRatio
        };
    }

    recalculate() {
        if (!this.latestData || this.width <= 0) return;

        const oldMap = new Map(this.tokens.map((t) => [t.symbol, t]));
        let maxVol = 0;
        let maxLiq = 0;

        Object.values(this.latestData).forEach((t) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            const vol = Number(t.v.dt || 0);
            const liq = Number(t.l || vol || 1000);
            if (vol > maxVol) maxVol = vol;
            if (liq > maxLiq) maxLiq = liq;
        });

        const nextTokens = [];
        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            nextTokens.push(this.normalizeEntry(key, t, maxVol, maxLiq, oldMap));
        });

        nextTokens.sort((a, b) => b.vol - a.vol);
        this.tokens = nextTokens;

        if (this.ripples.length > this.maxRipples) {
            this.ripples = this.ripples.slice(-this.maxRipples);
        }

        this.checkHover();
    }

    checkHover() {
        this.hoveredToken = null;

        for (let i = this.tokens.length - 1; i >= 0; i--) {
            const t = this.tokens[i];
            const dx = this.mouseX - t.x;
            const dy = this.mouseY - t.y;
            if (Math.hypot(dx, dy) <= Math.max(t.size, 10)) {
                this.hoveredToken = t;
                break;
            }
        }

        this.canvas.style.cursor = this.hoveredToken ? 'crosshair' : 'default';
    }

    formatCompact(value) {
        if (!Number.isFinite(value)) return '0';
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(value);
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
        ctx.lineWidth = 1;

        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, (this.maxRadius / 5) * i, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(this.centerX - this.maxRadius, this.centerY);
        ctx.lineTo(this.centerX + this.maxRadius, this.centerY);
        ctx.moveTo(this.centerX, this.centerY - this.maxRadius);
        ctx.lineTo(this.centerX, this.centerY + this.maxRadius);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.font = '11px "Be Vietnam Pro", Arial';
        ctx.fillText('SELL PRESSURE', this.centerX - this.maxRadius + 8, this.centerY - 8);
        ctx.fillText('BUY PRESSURE', this.centerX + this.maxRadius - 86, this.centerY - 8);
        ctx.fillText('HIGH LIQUIDITY CORE', this.centerX - 62, this.centerY + 14);
    }

    drawSweep() {
        const ctx = this.ctx;
        this.angle += 0.018;

        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.lineTo(
            this.centerX + this.maxRadius * Math.cos(this.angle),
            this.centerY + this.maxRadius * Math.sin(this.angle)
        );
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.arc(this.centerX, this.centerY, this.maxRadius, this.angle - 0.48, this.angle, false);
        ctx.closePath();

        const grad = ctx.createRadialGradient(
            this.centerX,
            this.centerY,
            0,
            this.centerX,
            this.centerY,
            this.maxRadius
        );

        grad.addColorStop(0, 'rgba(0,240,255,0)');
        grad.addColorStop(1, 'rgba(0,240,255,0.14)');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    drawRipples() {
        const ctx = this.ctx;

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];

            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = r.alpha;
            ctx.lineWidth = 1.4;
            ctx.stroke();

            r.r += 0.9;
            r.alpha -= 0.02;

            if (r.alpha <= 0) this.ripples.splice(i, 1);
        }

        ctx.globalAlpha = 1;
    }

    drawTokens() {
        const ctx = this.ctx;

        for (const t of this.tokens) {
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            ctx.fillStyle = t.color;

            if (this.hoveredToken && this.hoveredToken.symbol === t.symbol) {
                ctx.shadowBlur = t.size * 4;
                ctx.shadowColor = '#ffffff';
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.shadowBlur = t.size * 2;
                ctx.shadowColor = t.color;
            }

            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }

    animate() {
        if (this.width === 0 || this.height === 0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        const now = performance.now();
        const dt = now - this.lastFrameAt;
        this.lastFrameAt = now;
        this.fps = 1000 / Math.max(1, dt);

        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.drawGrid();
        this.drawRipples();
        this.drawTokens();

        if (!this.isPaused) {
            this.drawSweep();
        }

        requestAnimationFrame(() => this.animate());
    }
}
