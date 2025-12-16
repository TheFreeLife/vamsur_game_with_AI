class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    preload() {
        // Generate Textures programmatically
        let graphics = this.make.graphics({ x: 0, y: 0, add: false });

        // Player
        graphics.fillStyle(0x6666ff, 1.0);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('playerTexture', 32, 32);

        // Ground
        graphics.clear();
        graphics.fillStyle(0x4caf50, 1.0);
        graphics.fillRect(0, 0, 64, 64);
        graphics.fillStyle(0x45a049, 1.0);
        graphics.fillCircle(10, 10, 5);
        graphics.fillCircle(40, 50, 8);
        graphics.generateTexture('groundTexture', 64, 64);

        // Grass
        graphics.clear();
        graphics.fillStyle(0x2e7d32, 1.0);
        graphics.beginPath();
        graphics.moveTo(0, 20);
        graphics.lineTo(10, 0);
        graphics.lineTo(20, 20);
        graphics.closePath();
        graphics.fillPath();
        graphics.generateTexture('grassTexture', 20, 20);

        // Bullet
        graphics.clear();
        graphics.fillStyle(0xffff00, 1.0);
        graphics.fillCircle(5, 5, 5);
        graphics.generateTexture('bulletTexture', 10, 10);

        // Bomb (W Skill)
        graphics.clear();
        graphics.fillStyle(0xff8800, 1.0);
        graphics.fillCircle(8, 8, 8);
        graphics.generateTexture('bombTexture', 16, 16);

        // Monster
        graphics.clear();
        graphics.fillStyle(0x722140, 1.0);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('monsterTexture', 32, 32);

        // Wall
        graphics.clear();
        graphics.fillStyle(0x555555, 1.0);
        graphics.fillRect(0, 0, 32, 32);
        graphics.lineStyle(2, 0x333333);
        graphics.strokeRect(0, 0, 32, 32);
        graphics.generateTexture('wallTexture', 32, 32);

        // Crate
        graphics.clear();
        graphics.fillStyle(0x8B4513, 1.0);
        graphics.fillRect(0, 0, 32, 32);
        graphics.lineStyle(2, 0x5D4037);
        graphics.strokeRect(0, 0, 32, 32);
        graphics.generateTexture('crateTexture', 32, 32);
    }

    create() {
        // Disable Right Click Menu
        this.input.mouse.disableContextMenu();

        // Background
        this.background = this.add.tileSprite(400, 300, 800, 600, 'groundTexture');
        this.background.setScrollFactor(0);

        // Physics Groups
        this.bullets = this.physics.add.group();

        // Managers
        this.mapManager = new MapManager(this);
        this.player = new Player(this, 400, 300);
        this.monsterManager = new MonsterManager(this);
        this.uiManager = new UIManager(this);

        // Setup UI
        this.uiManager.setPlayer(this.player);
        this.uiManager.createUI();

        // Camera
        this.cameras.main.startFollow(this.player);

        // Fog of War (after camera setup)
        this.fogOfWar = new FogOfWar(this);

        // Colliders (Obstacles)
        this.physics.add.collider(this.player, this.mapManager.obstacles);
        this.physics.add.collider(this.monsterManager.monsters, this.mapManager.obstacles);

        // Colliders (Crates)
        // Assume MapManager adds crates to a group or we expose it.
        // It's better if MapManager exposes the crates group or we access it.
        this.physics.add.collider(this.player, this.mapManager.crates);
        this.physics.add.collider(this.monsterManager.monsters, this.mapManager.crates);

        this.physics.add.collider(this.monsterManager.monsters, this.monsterManager.monsters);

        // Collision: Player vs Monster
        this.physics.add.collider(this.player, this.monsterManager.monsters, (p, m) => {
            this.handlePlayerMonsterCollision(p, m);
        });

        // Collision: Bullet vs Monster
        this.physics.add.overlap(this.bullets, this.monsterManager.monsters, (b, m) => {
            if (b.descriptor === 'bomb') {
                this.player.createExplosion(b.x, b.y);
                b.destroy();
            } else {
                m.takeDamage(10);
                b.destroy();
            }
        });

        // Collision: Bullet vs Wall & Crate
        this.physics.add.overlap(this.bullets, this.mapManager.obstacles, (b, o) => {
            if (b.descriptor === 'bomb') {
                this.player.createExplosion(b.x, b.y);
            }
            b.destroy();
        });

        this.physics.add.overlap(this.bullets, this.mapManager.crates, (b, c) => {
            if (b.descriptor === 'bomb') {
                this.player.createExplosion(b.x, b.y);
                b.destroy();
            } else {
                // Check if this bullet is homing AND targeting this specific crate
                if (b.isHoming && b.target === c) {
                    if (c.takeDamage) c.takeDamage(10);
                    b.destroy();
                } else if (!b.isHoming) {
                    // Non-homing bullets damage and destroy
                    if (c.takeDamage) c.takeDamage(10);
                    b.destroy();
                }
                // Else: homing bullet targeting something else, pass through
            }
        });

        // Debug Path Graphics
        this.pathGraphics = this.add.graphics();
        this.pathGraphics.setDepth(1);
    }

    update(time, delta) {
        if (!this.player || this.player.isDead) return;

        // Managers Update
        this.player.update(time, delta);
        this.monsterManager.update(time); // Path updates
        this.mapManager.updateChunks(this.player);
        this.uiManager.update();

        // Update Fog of War
        this.fogOfWar.update(this.player.x, this.player.y);

        // Update Monster Visibility based on Fog
        this.monsterManager.monsters.getChildren().forEach(monster => {
            if (monster.active) {
                const isVisible = this.fogOfWar.isVisible(monster.x, monster.y, this.player.x, this.player.y);
                monster.setVisible(isVisible);
                if (monster.hpBar) monster.hpBar.setVisible(isVisible);
            }
        });

        // Update Bullets (Homing)
        this.bullets.getChildren().forEach(b => {
            if (b.active && b.isHoming) {
                if (b.target && b.target.active) {
                    this.physics.moveToObject(b, b.target, b.speed);
                } else {
                    // Target dead or lost
                    b.destroy();
                }
            }
        });

        // Background Scroll
        this.background.tilePositionX = this.cameras.main.scrollX;
        this.background.tilePositionY = this.cameras.main.scrollY;

        // Draw Path (Debug)
        this.drawDebugPath();
    }

    handlePlayerMonsterCollision(player, monster) {
        const now = this.time.now;
        const attackCooldown = 1000;

        if (monster.lastAttackTime && now - monster.lastAttackTime < attackCooldown) return;

        monster.lastAttackTime = now;
        player.takeDamage(10);

        // Monster Attack Animation
        this.tweens.add({
            targets: monster,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 100,
            yoyo: true,
            ease: 'Sine.easeInOut',
            onStart: () => monster.setTint(0xffaa00),
            onComplete: () => { if (monster.active) monster.clearTint(); }
        });
    }

    drawDebugPath() {
        this.pathGraphics.clear();
        this.pathGraphics.lineStyle(2, 0x00ff00, 0.5);

        if (this.player.path && this.player.path.length > 0) {
            this.pathGraphics.beginPath();
            this.pathGraphics.moveTo(this.player.x, this.player.y);
            for (const p of this.player.path) {
                this.pathGraphics.lineTo(p.x, p.y);
            }
            this.pathGraphics.strokePath();

            this.pathGraphics.fillStyle(0x00ff00, 0.5);
            for (const p of this.player.path) {
                this.pathGraphics.fillCircle(p.x, p.y, 3);
            }
        } else if (this.player.isDirectMoving) {
            this.pathGraphics.beginPath();
            this.pathGraphics.moveTo(this.player.x, this.player.y);
            this.pathGraphics.lineTo(this.player.targetPosition.x, this.player.targetPosition.y);
            this.pathGraphics.strokePath();

            this.pathGraphics.fillStyle(0x00ff00, 0.5);
            this.pathGraphics.fillCircle(this.player.targetPosition.x, this.player.targetPosition.y, 4);
        }
    }

    gameOver() {
        this.add.text(400, 250, 'GAME OVER', { fontSize: '64px', fill: '#ff0000', fontStyle: 'bold' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(200);

        const restartBtn = this.add.text(400, 350, 'RESTART', { fontSize: '32px', fill: '#ffffff', backgroundColor: '#333333', padding: { x: 10, y: 5 } })
            .setOrigin(0.5).setScrollFactor(0).setDepth(200)
            .setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => {
            // Restart Scene
            this.scene.restart();
        });

        restartBtn.on('pointerover', () => restartBtn.setStyle({ fill: '#ffff00' }));
        restartBtn.on('pointerout', () => restartBtn.setStyle({ fill: '#ffffff' }));

        this.physics.pause();
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#5c94fc',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [MenuScene, MainScene] // MenuScene first, then MainScene
};

// Global Game Instance
const game = new Phaser.Game(config);
