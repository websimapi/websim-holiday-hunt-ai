import { themes } from './themes.js';
import { AssetGenerator } from './generator.js';
import { SoundManager } from './audio.js';

class Game {
    constructor() {
        this.currentTheme = null;
        this.assets = [];
        this.itemsToFind = {}; // { id: { count: N, found: 0, asset: obj } }
        this.generator = new AssetGenerator();
        this.sound = new SoundManager();
        
        this.ui = {
            menu: document.getElementById('menu-view'),
            loading: document.getElementById('loading-view'),
            game: document.getElementById('game-view'),
            themeGrid: document.getElementById('theme-grid'),
            loaderBar: document.getElementById('loader-bar'),
            loaderText: document.getElementById('loading-text'),
            gameArea: document.getElementById('game-area'),
            legendList: document.getElementById('legend-list'),
            itemsRemaining: document.getElementById('items-remaining'),
            victoryModal: document.getElementById('victory-modal')
        };

        this.init();
    }

    init() {
        this.renderMenu();
    }

    renderMenu() {
        this.ui.themeGrid.innerHTML = '';
        Object.keys(themes).forEach(themeKey => {
            const btn = document.createElement('div');
            btn.className = 'theme-btn';
            btn.textContent = themeKey.replace(/_/g, ' '); // simple formatting
            btn.onclick = () => this.startGame(themeKey);
            this.ui.themeGrid.appendChild(btn);
        });
    }

    async startGame(theme) {
        this.currentTheme = theme;
        this.switchView('loading');
        
        // Reset state
        this.assets = [];
        this.ui.gameArea.innerHTML = '';
        this.ui.legendList.innerHTML = '';
        this.ui.victoryModal.classList.remove('active');
        this.ui.loaderBar.style.width = '0%';
        this.ui.loaderText.textContent = 'Preparing...';

        try {
            this.assets = await this.generator.generateAssetsForTheme(theme, (current, total) => {
                const pct = (current / total) * 100;
                this.ui.loaderBar.style.width = `${pct}%`;
                this.ui.loaderText.textContent = `${current} / ${total} Assets Generated`;
            });
            
            // Switch to game view first so we can calculate dimensions for placement
            this.switchView('game');
            
            // Allow DOM to update before calculating positions
            requestAnimationFrame(() => {
                this.setupLevel();
            });

        } catch (e) {
            console.error(e);
            alert('Error generating assets. Please try again.');
            this.switchView('menu');
        }
    }

    setupLevel() {
        // Requirements:
        // 25 assets total.
        // Indices 0-14 (15 items): Targets. Count: 1-3 times each.
        // Indices 15-24 (10 items): Distractors (Extras). Count: 4-5 times each.
        
        const targets = this.assets.slice(0, 15);
        const distractors = this.assets.slice(15);
        
        const itemsToPlace = [];
        this.itemsToFind = {};
        
        // Setup Targets
        targets.forEach(asset => {
            // Random count 1-3
            const count = Math.floor(Math.random() * 3) + 1;
            this.itemsToFind[asset.id] = {
                count: count,
                found: 0,
                asset: asset
            };
            
            for(let i=0; i<count; i++) {
                itemsToPlace.push({ ...asset, type: 'target', uniqueId: Math.random() });
            }
        });

        // Setup Distractors
        distractors.forEach(asset => {
            // Random count 8-10
            const count = Math.floor(Math.random() * 3) + 8;
            for(let i=0; i<count; i++) {
                itemsToPlace.push({ ...asset, type: 'distractor', uniqueId: Math.random() });
            }
        });

        // Place on board (sorting happens inside placeItems)
        this.placeItems(itemsToPlace);
        this.renderLegend();
        this.updateRemainingCount();
    }

    placeItems(items) {
        const cw = this.ui.gameArea.offsetWidth;
        const ch = this.ui.gameArea.offsetHeight;
        const minDim = Math.min(cw, ch);
        
        // Reduced base size to ~7% of screen dimension to fit ~120 items tightly
        const baseSizeRef = Math.max(35, minDim * 0.07);

        // 1. Prepare items with sizes
        const preparedItems = items.map(item => {
            const scale = 0.7 + Math.random() * 0.6; // 0.7x to 1.3x variation
            const size = baseSizeRef * scale;
            return { ...item, size };
        });

        // 2. Sort items largest to smallest (Bin Packing heuristic)
        // This makes it easier to find spots for big items first, then fill gaps with small ones.
        preparedItems.sort((a, b) => b.size - a.size);

        const placedRects = []; 
        
        preparedItems.forEach(item => {
            let size = item.size;
            let x, y, valid = false;
            let attempts = 0;
            const maxAttempts = 500;
            
            // Try to place without overlap
            while(!valid && attempts < maxAttempts) {
                x = Math.random() * (cw - size);
                y = Math.random() * (ch - size);

                // Clamp to positive
                if (x < 0) x = 0;
                if (y < 0) y = 0;

                // Define rect with small margin to prevent touching
                const margin = 2;
                const newRect = { 
                    left: x - margin, 
                    top: y - margin, 
                    right: x + size + margin, 
                    bottom: y + size + margin 
                };
                
                let overlap = false;
                for (const rect of placedRects) {
                     if (newRect.left < rect.right && newRect.right > rect.left &&
                         newRect.top < rect.bottom && newRect.bottom > rect.top) {
                         overlap = true;
                         break;
                     }
                }
                
                if (!overlap) {
                    valid = true;
                    placedRects.push(newRect);
                } else {
                    attempts++;
                    // Adaptive shrinking: if we can't fit it, shrink it gradually
                    // This allows items to squeeze in rather than overlap
                    if (attempts % 50 === 0 && size > 20) {
                        size *= 0.95;
                    }
                }
            }
            
            // Last resort: Place random if still fails (rare with shrinking)
            if (!valid) {
                x = Math.random() * (cw - size);
                y = Math.random() * (ch - size);
            }
            
            const el = document.createElement('img');
            el.src = item.url;
            el.className = 'game-item';
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            
            // Random rotation
            const rot = Math.random() * 60 - 30;
            el.style.transform = `rotate(${rot}deg)`;
            
            // Z-index handling: Since we render largest first (bottom of DOM), 
            // smallest are last (top of DOM). This prevents small items from hiding behind big ones.
            
            el.onclick = (e) => this.handleItemClick(e, item, el);
            
            this.ui.gameArea.appendChild(el);
        });
    }
    
    handleItemClick(e, item, element) {
        e.stopPropagation();
        
        if (element.classList.contains('found')) return;

        if (item.type === 'target') {
            this.sound.play('pop');
            
            // Animate
            element.classList.add('found');
            
            const record = this.itemsToFind[item.id];
            record.found++;
            
            this.updateLegend(item.id);
            this.checkVictory();
        } else {
            // Distractor feedback (shake)
            element.style.transition = 'transform 0.1s';
            const currentRot = parseFloat(element.style.transform.replace(/[^0-9\-.]/g, '')) || 0;
            element.style.transform = `scale(0.9) rotate(${currentRot + 10}deg)`;
            setTimeout(() => {
                 element.style.transform = `scale(1) rotate(${currentRot}deg)`;
            }, 100);
        }
    }

    renderLegend() {
        this.ui.legendList.innerHTML = '';
        Object.values(this.itemsToFind).forEach(record => {
            const row = document.createElement('div');
            row.className = 'legend-item';
            row.id = `legend-${record.asset.id}`;
            row.innerHTML = `
                <img src="${record.asset.url}" class="legend-thumb">
                <div class="legend-info">
                    <span class="legend-name">${record.asset.name}</span>
                    <span class="legend-count">${record.count}</span>
                </div>
            `;
            this.ui.legendList.appendChild(row);
        });
    }

    updateLegend(id) {
        const record = this.itemsToFind[id];
        const row = document.getElementById(`legend-${id}`);
        const remaining = record.count - record.found;
        
        const countBadge = row.querySelector('.legend-count');
        countBadge.textContent = remaining > 0 ? remaining : '✔';
        
        if (remaining === 0) {
            row.classList.add('completed');
            this.sound.play('success');
        }
        this.updateRemainingCount();
    }

    updateRemainingCount() {
        let total = 0;
        Object.values(this.itemsToFind).forEach(r => total += (r.count - r.found));
        this.ui.itemsRemaining.textContent = `${total} left`;
    }

    checkVictory() {
        let total = 0;
        Object.values(this.itemsToFind).forEach(r => total += (r.count - r.found));
        
        if (total === 0) {
            this.sound.play('win');
            setTimeout(() => {
                this.ui.victoryModal.classList.add('active');
            }, 500);
        }
    }

    switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${viewName}-view`).classList.add('active');
    }
}

// Start
new Game();