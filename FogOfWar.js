class FogOfWar {
    constructor(scene) {
        this.scene = scene;
        this.visionRadius = 300; // Player vision range (reduced)
        this.tileSize = 32;

        // Track explored tiles
        this.exploredTiles = new Set();

        // Fog layer (world coordinates, scrolls with camera)
        this.fogGraphics = scene.add.graphics();
        this.fogGraphics.setDepth(100); // Above game objects, below UI
    }

    update(playerX, playerY) {
        // Mark tiles as explored
        const exploredRadius = Math.ceil(this.visionRadius / this.tileSize);
        const centerTileX = Math.floor(playerX / this.tileSize);
        const centerTileY = Math.floor(playerY / this.tileSize);

        for (let dy = -exploredRadius; dy <= exploredRadius; dy++) {
            for (let dx = -exploredRadius; dx <= exploredRadius; dx++) {
                const tx = centerTileX + dx;
                const ty = centerTileY + dy;
                const worldX = tx * this.tileSize + this.tileSize / 2;
                const worldY = ty * this.tileSize + this.tileSize / 2;
                const dist = Phaser.Math.Distance.Between(playerX, playerY, worldX, worldY);

                if (dist <= this.visionRadius) {
                    this.exploredTiles.add(`${tx},${ty}`);
                }
            }
        }

        this.render(playerX, playerY);
    }

    render(playerX, playerY) {
        const camera = this.scene.cameras.main;
        this.fogGraphics.clear();

        // Calculate visible area (screen bounds + padding)
        const padding = this.visionRadius + 200;
        const startTileX = Math.floor((camera.scrollX - padding) / this.tileSize);
        const endTileX = Math.ceil((camera.scrollX + camera.width + padding) / this.tileSize);
        const startTileY = Math.floor((camera.scrollY - padding) / this.tileSize);
        const endTileY = Math.ceil((camera.scrollY + camera.height + padding) / this.tileSize);

        // Use smaller steps for smoother fog (16x16 instead of 32x32)
        const renderSize = 16;

        // Draw fog for each sub-tile
        for (let ty = startTileY; ty <= endTileY; ty++) {
            for (let tx = startTileX; tx <= endTileX; tx++) {
                const key = `${tx},${ty}`;
                const isExplored = this.exploredTiles.has(key);

                // Draw 4 sub-tiles per tile for smoother gradients
                for (let sy = 0; sy < 2; sy++) {
                    for (let sx = 0; sx < 2; sx++) {
                        const worldX = tx * this.tileSize + sx * renderSize;
                        const worldY = ty * this.tileSize + sy * renderSize;
                        const centerX = worldX + renderSize / 2;
                        const centerY = worldY + renderSize / 2;
                        const distToPlayer = Phaser.Math.Distance.Between(playerX, playerY, centerX, centerY);

                        const inVision = distToPlayer <= this.visionRadius;

                        if (inVision) {
                            // In vision range - smooth gradient at edges
                            const ratio = distToPlayer / this.visionRadius;
                            if (ratio > 0.6) { // Start fading from 60%
                                const edgeRatio = (ratio - 0.6) / 0.4; // 0 to 1
                                const alpha = Math.pow(edgeRatio, 1.5) * 0.5; // Cubic curve for smooth fade
                                this.fogGraphics.fillStyle(0x000000, alpha);
                                this.fogGraphics.fillRect(worldX, worldY, renderSize, renderSize);
                            }
                            // else: fully visible, no fog
                        } else if (isExplored) {
                            // Explored but not in vision - medium fog
                            // Add slight gradient based on distance from player
                            const distRatio = Math.min(distToPlayer / (this.visionRadius * 2), 1);
                            const alpha = 0.45 + distRatio * 0.15; // 0.45 to 0.6
                            this.fogGraphics.fillStyle(0x000000, alpha);
                            this.fogGraphics.fillRect(worldX, worldY, renderSize, renderSize);
                        } else {
                            // Unexplored - heavy fog
                            this.fogGraphics.fillStyle(0x000000, 0.9);
                            this.fogGraphics.fillRect(worldX, worldY, renderSize, renderSize);
                        }
                    }
                }
            }
        }
    }

    isVisible(x, y, playerX, playerY) {
        const dist = Phaser.Math.Distance.Between(playerX, playerY, x, y);
        return dist <= this.visionRadius;
    }

    isExplored(x, y) {
        const tx = Math.floor(x / this.tileSize);
        const ty = Math.floor(y / this.tileSize);
        return this.exploredTiles.has(`${tx},${ty}`);
    }

    destroy() {
        if (this.fogGraphics) {
            this.fogGraphics.destroy();
        }
    }
}
