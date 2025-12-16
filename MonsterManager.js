class Monster extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'monsterTexture');

        // Physics body settings
        this.setInteractive();

        // Properties
        this.maxHealth = 30;
        this.health = 30;
        this.speed = 100;
        this.path = null;
        this.hpBar = scene.add.graphics();
        this.lastAttackTime = 0;
    }

    // Called automatically by Group if runChildUpdate is true
    update(time, delta) {
        if (!this.active) return;

        // Sync HP Bar
        this.hpBar.setPosition(this.x - 16, this.y + 20);
        this.drawHealthBar();

        if (this.path && this.path.length > 0) {
            this.moveAlongPath();
        } else {
            // Simple follow if close
            const player = this.scene.player;
            if (player && !player.isDead) {
                if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 1000) {
                    this.scene.physics.moveToObject(this, player, this.speed);
                }
            }
        }
    }

    moveAlongPath() {
        if (!this.path || this.path.length === 0) return;
        const next = this.path[0];

        // Check for Crate Obstacle
        const crate = this.scene.mapManager.getCrateAt(next.x, next.y);
        if (crate && crate.active) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, crate.x, crate.y);
            if (dist < 60) { // Attack Range for Crate
                this.body.setVelocity(0);
                this.attackCrate(crate);
                return;
            }
        }

        const dist = Phaser.Math.Distance.Between(this.x, this.y, next.x, next.y);

        if (dist < 4) {
            this.x = next.x;
            this.y = next.y;
            this.path.shift();
            if (this.path.length > 0) {
                const newNext = this.path[0];
                this.scene.physics.moveTo(this, newNext.x, newNext.y, this.speed);
            } else {
                this.body.setVelocity(0);
            }
        } else {
            this.scene.physics.moveTo(this, next.x, next.y, this.speed);
        }
    }

    attackCrate(crate) {
        const now = this.scene.time.now;
        if (now - this.lastAttackTime < 1000) return;

        this.lastAttackTime = now;
        crate.takeDamage(10); // Monster Damage

        // Attack Animation
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 100,
            yoyo: true,
            onStart: () => this.setTint(0xffaa00),
            onComplete: () => { if (this.active) this.clearTint(); }
        });
    }

    takeDamage(amount) {
        this.health -= amount;
        this.drawHealthBar();
        this.setTint(0xffffff);
        this.scene.time.delayedCall(50, () => { if (this.active) this.clearTint(); });

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        if (this.hpBar) this.hpBar.destroy();
        this.destroy();
    }

    drawHealthBar() {
        this.hpBar.clear();
        const width = 32, height = 4;
        this.hpBar.fillStyle(0x000000);
        this.hpBar.fillRect(0, 0, width, height);
        const ratio = Math.max(0, this.health / this.maxHealth);
        this.hpBar.fillStyle(0xff0000);
        this.hpBar.fillRect(0, 0, width * ratio, height);
    }
}

class MonsterManager {
    constructor(scene) {
        this.scene = scene;
        this.monsters = scene.physics.add.group({
            classType: Monster,
            runChildUpdate: true
        });

        // Spawn Timer
        scene.time.addEvent({ delay: 2000, callback: this.spawnMonster, callbackScope: this, loop: true });

        // Path Update Timer (every 500ms)
        this.lastPathTime = 0;
    }

    update(time) {
        if (time - this.lastPathTime > 500) {
            this.updateMonsterPaths();
            this.lastPathTime = time;
        }
    }

    spawnMonster() {
        if (this.scene.player.isDead) return;

        let x, y;
        let attempts = 0;
        let valid = false;

        // Try to find a valid spawn point
        while (attempts < 10) {
            attempts++;
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const dist = Phaser.Math.Between(400, 700);
            x = this.scene.player.x + Math.cos(angle) * dist;
            y = this.scene.player.y + Math.sin(angle) * dist;

            const tSize = this.scene.mapManager.tileSize;
            const gx = Math.floor(x / tSize);
            const gy = Math.floor(y / tSize);

            if (!this.scene.mapManager.wallGrid.has(`${gx},${gy}`)) {
                valid = true;
                break;
            }
        }

        if (valid) {
            const monster = this.monsters.create(x, y); // Uses classType: Monster
            // Physics body configuration is done in Constructor or here
            // Note: create() calls constructor. 
            // We need to ensure body size is set if not in constructor
            monster.body.setSize(24, 24).setOffset(4, 4);
        }
    }

    updateMonsterPaths() {
        const player = this.scene.player;
        if (!player) return;
        const map = this.scene.mapManager;

        const { matrix, gridStartX, gridStartY } = map.getLocalGrid(player.x, player.y);
        const tSize = map.tileSize;

        const pGx = Math.floor(player.x / tSize) - gridStartX;
        const pGy = Math.floor(player.y / tSize) - gridStartY;

        if (pGx < 0 || pGx >= matrix[0].length || pGy < 0 || pGy >= matrix.length) return;

        this.monsters.getChildren().forEach(monster => {
            const mGx = Math.floor(monster.x / tSize) - gridStartX;
            const mGy = Math.floor(monster.y / tSize) - gridStartY;

            if (mGx >= 0 && mGx < matrix[0].length && mGy >= 0 && mGy < matrix.length) {
                if (matrix[mGy][mGx] === 1) return; // Stuck in wall

                const path = map.customAStar(matrix, mGx, mGy, pGx, pGy);
                if (path && path.length > 1) {
                    monster.path = path.slice(1).map(p => ({
                        x: (p.x + gridStartX) * tSize + tSize / 2,
                        y: (p.y + gridStartY) * tSize + tSize / 2
                    }));
                } else {
                    monster.path = null;
                }
            }
        });
    }
}
