class Monster extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'monsterTexture');

        // Physics body settings
        this.setInteractive();

        // Properties
        this.maxHealth = 30;
        this.health = 30;
        this.speed = 100;
        this.damage = 10; // Base damage
        this.expReward = 50; // Experience reward on death
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
        crate.takeDamage(this.damage); // Use damage property

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
        // Grant experience to player
        if (this.scene.player && !this.scene.player.isDead) {
            this.scene.player.gainExperience(this.expReward);
        }

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

// Werewolf Monster - Special monster with rage mechanic
class Werewolf extends Monster {
    constructor(scene, x, y) {
        super(scene, x, y);

        // Override texture to differentiate
        this.setTexture('werewolfTexture');

        // Werewolf specific properties
        this.baseSpeed = 100;
        this.baseDamage = 7;
        this.speed = this.baseSpeed;
        this.damage = this.baseDamage;
        this.expReward = 100; // Werewolves give more XP

        // Rage mechanic
        this.isRaging = false;
        this.rageTimer = null;
        this.rageEndTimer = null;
        this.rageCooldown = 8000; // 8 seconds
        this.rageDuration = 5000; // 5 seconds

        // Visual effects for rage
        this.rageGlow = null;
        this.rageTween = null;

        // Start rage cycle
        this.startRageCycle();
    }

    startRageCycle() {
        // Rage every 8 seconds - store timer reference
        this.rageTimer = this.scene.time.addEvent({
            delay: this.rageCooldown,
            callback: this.enterRage,
            callbackScope: this,
            loop: true
        });
    }

    enterRage() {
        if (!this.active) return;

        this.isRaging = true;
        this.speed = this.baseSpeed * 1.5; // 150
        this.damage = this.baseDamage * 2; // 14

        // Visual feedback - red tint and scale increase
        this.setTint(0xff3333);
        this.setScale(1.2);

        // Add pulsing glow effect
        this.rageGlow = this.scene.add.graphics();
        this.rageGlow.setDepth(this.depth - 1);

        // Pulsing animation
        this.rageTween = this.scene.tweens.add({
            targets: this,
            alpha: 0.7,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // End rage after duration - store timer reference
        this.rageEndTimer = this.scene.time.delayedCall(this.rageDuration, () => {
            this.exitRage();
        });
    }

    exitRage() {
        if (!this.active) return;

        this.isRaging = false;
        this.speed = this.baseSpeed;
        this.damage = this.baseDamage;

        // Clear visual effects
        this.clearTint();
        this.setScale(1.0);
        this.setAlpha(1.0);

        // Remove glow
        if (this.rageGlow) {
            this.rageGlow.destroy();
            this.rageGlow = null;
        }

        // Stop pulsing animation
        if (this.rageTween) {
            this.rageTween.stop();
            this.rageTween = null;
        }
    }

    update(time, delta) {
        super.update(time, delta);

        // Update rage glow position
        if (this.isRaging && this.rageGlow && this.active) {
            this.rageGlow.clear();
            this.rageGlow.lineStyle(3, 0xff0000, 0.6);
            this.rageGlow.strokeCircle(this.x, this.y, 20);
            this.rageGlow.lineStyle(2, 0xff3333, 0.4);
            this.rageGlow.strokeCircle(this.x, this.y, 25);
        }
    }

    attackCrate(crate) {
        const now = this.scene.time.now;
        if (now - this.lastAttackTime < 1000) return;

        this.lastAttackTime = now;
        crate.takeDamage(this.damage); // Use current damage (base or raged)

        // Attack Animation - larger scale when raging
        this.scene.tweens.add({
            targets: this,
            scaleX: this.isRaging ? 1.5 : 1.3,
            scaleY: this.isRaging ? 1.5 : 1.3,
            duration: 100,
            yoyo: true,
            onStart: () => {
                if (!this.isRaging) this.setTint(0xffaa00);
            },
            onComplete: () => {
                if (this.active) {
                    if (this.isRaging) {
                        this.setTint(0xff3333); // Restore rage tint
                        this.setScale(1.2); // Restore rage scale
                    } else {
                        this.clearTint();
                        this.setScale(1.0);
                    }
                }
            }
        });
    }

    die() {
        // Clear werewolf-specific timers only
        if (this.rageTimer) {
            this.rageTimer.remove();
            this.rageTimer = null;
        }
        if (this.rageEndTimer) {
            this.rageEndTimer.remove();
            this.rageEndTimer = null;
        }
        if (this.rageGlow) {
            this.rageGlow.destroy();
            this.rageGlow = null;
        }
        if (this.rageTween) {
            this.rageTween.stop();
            this.rageTween = null;
        }

        super.die();
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
            // 30% chance to spawn werewolf
            const spawnWerewolf = Math.random() < 0.3;

            let monster;
            if (spawnWerewolf) {
                // Create werewolf manually
                monster = new Werewolf(this.scene, x, y);
                this.scene.add.existing(monster);
                this.scene.physics.add.existing(monster);
                this.monsters.add(monster);
            } else {
                // Create regular monster using group
                monster = this.monsters.create(x, y);
            }

            // Physics body configuration
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
