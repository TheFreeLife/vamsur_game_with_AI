class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.loadedChunks = new Map();
        this.wallGrid = new Map(); // key -> type (1: wall, 2: crate)
        this.crateMap = new Map(); // key -> Crate instance
        this.obstacles = scene.physics.add.staticGroup();
        this.crates = scene.physics.add.group({
            classType: Crate,
            runChildUpdate: false,
            immovable: true,
            allowGravity: false
        });
        this.healingItems = scene.physics.add.group({
            allowGravity: false,
            immovable: true
        });

        this.chunkSize = 640;
        this.tileSize = 32;
        this.gridRadius = 30; // Grid radius for A*
    }

    spawnHealingItem(x, y) {
        const healingItem = new HealItem(this.scene, x, y);
        this.healingItems.add(healingItem);
        // We'll let the HealItem class handle its own effects
        return healingItem;
    }

    updateChunks(player) {
        const playerChunkX = Math.floor(player.x / this.chunkSize);
        const playerChunkY = Math.floor(player.y / this.chunkSize);
        const activeKeys = new Set();

        for (let x = playerChunkX - 1; x <= playerChunkX + 1; x++) {
            for (let y = playerChunkY - 1; y <= playerChunkY + 1; y++) {
                const key = `${x},${y}`;
                activeKeys.add(key);
                if (!this.loadedChunks.has(key)) this.createChunk(x, y);
            }
        }

        for (const key of this.loadedChunks.keys()) {
            if (!activeKeys.has(key)) this.removeChunk(key);
        }
    }

    createChunk(cx, cy) {
        const key = `${cx},${cy}`;
        const chunkObjects = [];

        const grassCount = Phaser.Math.Between(5, 10);
        for (let i = 0; i < grassCount; i++) {
            const x = cx * this.chunkSize + Phaser.Math.Between(0, this.chunkSize);
            const y = cy * this.chunkSize + Phaser.Math.Between(0, this.chunkSize);
            chunkObjects.push(this.scene.add.image(x, y, 'grassTexture'));
        }

        // Random Crates in field
        if (Phaser.Math.Between(0, 100) > 80) { // 20% chance per chunk to have crates
            const count = Phaser.Math.Between(1, 3);
            for (let i = 0; i < count; i++) {
                const x = cx * this.chunkSize + Phaser.Math.Between(0, this.chunkSize);
                const y = cy * this.chunkSize + Phaser.Math.Between(0, this.chunkSize);

                // Snap A bit? No, random is fine. But grid update needed?
                // Let's snap to grid for A* consistency
                const gx = Math.floor(x / this.tileSize);
                const gy = Math.floor(y / this.tileSize);
                const finalX = gx * this.tileSize + this.tileSize / 2;
                const finalY = gy * this.tileSize + this.tileSize / 2;

                const key = `${gx},${gy}`;
                if (!this.wallGrid.has(key)) {
                    const crate = this.crates.create(finalX, finalY); // Crate class
                    chunkObjects.push(crate);
                    this.wallGrid.set(key, 2); // 2 = Crate
                    this.crateMap.set(key, crate);
                    crate.gridKey = key;
                }
            }
        }
        
        // Random Healing Items in field
        if (Phaser.Math.Between(0, 100) >= 0) { // 100% chance per chunk to have a healing item (for testing)
            const x = cx * this.chunkSize + Phaser.Math.Between(0, this.chunkSize);
            const y = cy * this.chunkSize + Phaser.Math.Between(0, this.chunkSize);

            const gx = Math.floor(x / this.tileSize);
            const gy = Math.floor(y / this.tileSize);
            const finalX = gx * this.tileSize + this.tileSize / 2;
            const finalY = gy * this.tileSize + this.tileSize / 2;

            const key = `${gx},${gy}`;
            if (!this.wallGrid.has(key)) {
                const healingItem = this.spawnHealingItem(finalX, finalY);
                healingItem.gridKey = key;
                this.wallGrid.set(key, 3); // 3 = Healing Item
                chunkObjects.push(healingItem);
            }
        }

        this.loadedChunks.set(key, chunkObjects);

        if (Phaser.Math.Between(0, 100) > 40) {
            const buildX = cx * this.chunkSize + this.chunkSize / 2;
            const buildY = cy * this.chunkSize + this.chunkSize / 2;
            this.generateBuilding(buildX, buildY, chunkObjects);
        }
    }

    generateBuilding(x, y, list) {
        if (typeof buildingLayouts === 'undefined') return;

        const layoutIdx = Phaser.Math.Between(0, buildingLayouts.length - 1);
        const layout = buildingLayouts[layoutIdx];

        const rows = layout.length;
        const cols = layout[0].length;
        const startX = x - (cols * this.tileSize) / 2;
        const startY = y - (rows * this.tileSize) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (layout[r][c] === 1 || layout[r][c] === 2) {
                    const wx = startX + c * this.tileSize;
                    const wy = startY + r * this.tileSize;

                    const gridX = Math.floor(wx / this.tileSize);
                    const gridY = Math.floor(wy / this.tileSize);

                    const finalX = gridX * this.tileSize + this.tileSize / 2;
                    const finalY = gridY * this.tileSize + this.tileSize / 2;

                    // 스폰 안전 지대
                    if (Phaser.Math.Distance.Between(finalX, finalY, 400, 300) < 200) {
                        continue;
                    }

                    if (layout[r][c] === 1) {
                        const wall = this.obstacles.create(finalX, finalY, 'wallTexture');
                        wall.refreshBody();
                        list.push(wall);

                        const wallKey = `${gridX},${gridY}`;
                        this.wallGrid.set(wallKey, 1); // 1 = Wall
                        wall.gridKey = wallKey;
                    } else if (layout[r][c] === 2) {
                        const crate = this.crates.create(finalX, finalY);
                        list.push(crate);

                        const wallKey = `${gridX},${gridY}`;
                        this.wallGrid.set(wallKey, 2); // 2 = Crate
                        this.crateMap.set(wallKey, crate);
                        crate.gridKey = wallKey;
                    }
                }
            }
        }
    }

    removeChunk(key) {
        if (this.loadedChunks.has(key)) {
            const objects = this.loadedChunks.get(key);
            objects.forEach(obj => {
                if (obj.gridKey) {
                    this.wallGrid.delete(obj.gridKey);
                }
                obj.destroy();
            });
            this.loadedChunks.delete(key);
        }
    }

    removeCrateFromGrid(crate) {
        if (crate.gridKey) {
            this.wallGrid.delete(crate.gridKey);
            this.crateMap.delete(crate.gridKey);
        }
    }

    removeItemFromGrid(item) {
        if (item.gridKey) {
            this.wallGrid.delete(item.gridKey);
        }
    }

    getCrateAt(worldX, worldY) {
        const gx = Math.floor(worldX / this.tileSize);
        const gy = Math.floor(worldY / this.tileSize);
        return this.crateMap.get(`${gx},${gy}`);
    }

    // ---------------- A* Algorithm & Grid Logic ----------------

    findPath(startX, startY, targetX, targetY) {
        const { matrix, gridStartX, gridStartY } = this.getLocalGrid(startX, startY);

        const pGx = Math.floor(startX / this.tileSize) - gridStartX;
        const pGy = Math.floor(startY / this.tileSize) - gridStartY;
        let tGx = Math.floor(targetX / this.tileSize) - gridStartX;
        let tGy = Math.floor(targetY / this.tileSize) - gridStartY;

        // Grid bounds check
        const rows = matrix.length;
        const cols = matrix[0].length;
        if (tGx < 0 || tGx >= cols || tGy < 0 || tGy >= rows) return null;

        // Smart Click: If target is wall, search nearby
        if (matrix[tGy][tGx] === 1) {
            let found = false;
            for (let r = 1; r <= 3; r++) {
                for (let y = -r; y <= r; y++) {
                    for (let x = -r; x <= r; x++) {
                        const nX = tGx + x;
                        const nY = tGy + y;
                        if (nX >= 0 && nX < cols && nY >= 0 && nY < rows && matrix[nY][nX] === 0) {
                            tGx = nX;
                            tGy = nY;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
            if (!found) return null;
        }

        const path = this.customAStar(matrix, pGx, pGy, tGx, tGy);

        if (path && path.length > 0) {
            // Convert to World Coordinates
            return path.slice(1).map(p => ({
                x: (p.x + gridStartX) * this.tileSize + this.tileSize / 2,
                y: (p.y + gridStartY) * this.tileSize + this.tileSize / 2
            }));
        }
        return null;
    }

    getLocalGrid(centerX, centerY) {
        const matrix = [];
        const gridStartX = Math.floor(centerX / this.tileSize) - this.gridRadius;
        const gridStartY = Math.floor(centerY / this.tileSize) - this.gridRadius;

        for (let y = 0; y < this.gridRadius * 2; y++) {
            const row = [];
            for (let x = 0; x < this.gridRadius * 2; x++) {
                const tx = gridStartX + x;
                const ty = gridStartY + y;
                const key = `${tx},${ty}`;
                let type = 0;
                if (this.wallGrid.has(key)) {
                    type = this.wallGrid.get(key); // 1 or 2
                }
                row.push(type);
            }
            matrix.push(row);
        }
        return { matrix, gridStartX, gridStartY };
    }

    customAStar(matrix, startX, startY, endX, endY) {
        const rows = matrix.length;
        const cols = matrix[0].length;

        const grid = [];
        for (let y = 0; y < rows; y++) {
            grid[y] = [];
            for (let x = 0; x < cols; x++) {
                grid[y][x] = { x, y, g: 0, h: 0, f: 0, parent: null, walkable: matrix[y][x] === 0 || matrix[y][x] === 2 };
            }
        }

        if (!grid[startY][startX].walkable) grid[startY][startX].walkable = true;
        if (!grid[endY][endX].walkable) return null;

        const openList = [];
        const closedList = new Set();
        openList.push(grid[startY][startX]);

        while (openList.length > 0) {
            openList.sort((a, b) => b.f - a.f);
            const currentNode = openList.pop();

            if (currentNode.x === endX && currentNode.y === endY) {
                let curr = currentNode;
                const path = [];
                while (curr) {
                    path.push({ x: curr.x, y: curr.y });
                    curr = curr.parent;
                }
                return path.reverse();
            }

            closedList.add(`${currentNode.x},${currentNode.y}`);

            const neighbors = this.getSafeNeighbors(grid, currentNode);

            for (let neighbor of neighbors) {
                if (closedList.has(`${neighbor.x},${neighbor.y}`)) continue;

                const isDiagonal = (neighbor.x !== currentNode.x && neighbor.y !== currentNode.y);
                let dist = isDiagonal ? 1.414 : 1;

                // Add penalty for crate
                if (matrix[neighbor.y][neighbor.x] === 2) {
                    dist += 5; // Reduced cost to encourage breaking
                }

                const gScore = currentNode.g + dist;
                const inOpen = openList.includes(neighbor);

                if (!inOpen || gScore < neighbor.g) {
                    neighbor.g = gScore;
                    neighbor.h = Math.sqrt(Math.pow(neighbor.x - endX, 2) + Math.pow(neighbor.y - endY, 2));
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = currentNode;
                    if (!inOpen) openList.push(neighbor);
                }
            }
        }
        return null;
    }

    getSafeNeighbors(grid, node) {
        const ret = [];
        const rows = grid.length;
        const cols = grid[0].length;
        const x = node.x;
        const y = node.y;

        const dirs = [
            { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
        ];

        for (let dir of dirs) {
            const nx = x + dir.x;
            const ny = y + dir.y;

            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                const neighbor = grid[ny][nx];
                if (neighbor.walkable) {
                    if (Math.abs(dir.x) === 1 && Math.abs(dir.y) === 1) {
                        if (!grid[y][nx].walkable || !grid[ny][x].walkable) continue;
                    }
                    ret.push(neighbor);
                }
            }
        }
        return ret;
    }

    // Raycast helper
    isLineClear(x1, y1, x2, y2) {
        if (this.checkLine(x1, y1, x2, y2)) return false;
        const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);
        const offset = 25;
        const nx = Math.cos(angle + Math.PI / 2) * offset;
        const ny = Math.sin(angle + Math.PI / 2) * offset;

        if (this.checkLine(x1 + nx, y1 + ny, x2 + nx, y2 + ny)) return false;
        if (this.checkLine(x1 - nx, y1 - ny, x2 - nx, y2 - ny)) return false;
        return true;
    }

    checkLine(x1, y1, x2, y2) {
        const line = new Phaser.Geom.Line(x1, y1, x2, y2);
        const bounds = new Phaser.Geom.Rectangle();
        const children = this.obstacles.getChildren();

        for (let i = 0; i < children.length; i++) {
            const obs = children[i];
            if (!obs.active) continue;
            if (Phaser.Math.Distance.Between(x1, y1, obs.x, obs.y) > 1000) continue;
            obs.getBounds(bounds);
            if (Phaser.Geom.Intersects.LineToRectangle(line, bounds)) return true;
        }
        return false;
    }
}
