class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'playerTexture');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.scene = scene;

        this.body.setSize(24, 24).setOffset(4, 4);

        // Stats
        this.speed = 200;
        this.maxHealth = 100;
        this.currentHealth = 100;
        this.isDead = false;

        // Level System
        this.level = 1;
        this.experience = 0;
        this.experienceToNextLevel = 1000;

        // Movement State
        this.path = null;
        this.isDirectMoving = false;
        this.targetPosition = new Phaser.Math.Vector2(x, y);

        // Skills State
        this.skills = {
            Q: { cooldown: 3000, lastFired: -3000, aiming: false },
            W: { cooldown: 5000, lastFired: -5000, aiming: false },
            E: { cooldown: 5000, lastFired: -5000, aiming: false, casting: false },
            R: { cooldown: 20000, duration: 5000, lastFired: -20000, active: false, damageTimer: 0 }
        };

        // Basic Attack State
        this.attackSpeed = 1.0; // Attacks per second
        this.attackRange = 240; // Increased range (1.5x)
        this.lastAttackTime = -1000;
        this.isAttackAiming = false;
        this.attackIndicator = this.createRangeIndicator(0xff0000, this.attackRange); // Red Color for Attack

        // Skill Indicators
        this.qIndicator = this.createRangeIndicator(0x00ffff, 300); // Skyblue
        this.wIndicator = this.createRadiusIndicator(0xff8800, 300, 64); // Orange
        this.eIndicator = this.createTeleportIndicator(160); // Green + Marker

        // R Visual (Flame Zone)
        this.rVisual = scene.add.graphics();
        this.rVisual.setDepth(10); // Under player
        this.rVisual.setVisible(false);

        // Input
        this.keys = scene.input.keyboard.addKeys({
            Q: Phaser.Input.Keyboard.KeyCodes.Q,
            W: Phaser.Input.Keyboard.KeyCodes.W,
            E: Phaser.Input.Keyboard.KeyCodes.E,
            R: Phaser.Input.Keyboard.KeyCodes.R,
            A: Phaser.Input.Keyboard.KeyCodes.A
        });

        // Setup Mouse Input (Scene level, but handled here)
        scene.input.on('pointerdown', (pointer) => {
            if (this.isDead || this.skills.E.casting) return;

            if (pointer.rightButtonDown()) {
                this.handleMoveInput(pointer.worldX, pointer.worldY);
            } else if (pointer.leftButtonDown()) {
                this.handleClick(pointer);
            }
        });
    }

    createRangeIndicator(color, range) {
        const g = this.scene.add.graphics();
        g.setDepth(50);
        g.setVisible(false);
        g.defaultColor = color;
        g.range = range;
        return g;
    }

    createRadiusIndicator(color, range, radius) {
        const g = this.scene.add.graphics();
        g.setDepth(50);
        g.setVisible(false);
        g.defaultColor = color;
        g.range = range;
        g.radius = radius;
        return g;
    }

    createTeleportIndicator(range) {
        const g = this.scene.add.graphics();
        g.setDepth(50);
        g.setVisible(false);
        g.range = range;
        return g;
    }

    update(time, delta) {
        if (this.isDead) return;

        // Input Polling for Skill Toggles
        this.handleSkillInput(time);

        // Updates
        this.drawIndicators();

        if (this.skills.E.casting) {
            this.body.setVelocity(0);
            return;
        }

        // Movement
        if (this.path && this.path.length > 0) {
            this.moveAlongPath();
        } else if (this.isDirectMoving) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetPosition.x, this.targetPosition.y);
            if (dist < 4) {
                this.body.setVelocity(0);
                this.isDirectMoving = false;
            } else {
                this.scene.physics.moveTo(this, this.targetPosition.x, this.targetPosition.y, this.speed);
            }
        } else {
            this.body.setVelocity(0);
        }

        // Handle R Skill (Ultimate)
        if (this.skills.R.active) {
            this.updateRSkill(time, delta);
        } else {
            this.rVisual.setVisible(false);
        }
    }

    updateRSkill(time, delta) {
        // Duration Check
        if (time - this.skills.R.lastFired > this.skills.R.duration) {
            this.skills.R.active = false;
            this.rVisual.setVisible(false);
            return;
        }

        // Visuals (Flame Effect)
        this.rVisual.setVisible(true);
        this.rVisual.clear();
        const radius = 160; // 10 blocks * 32
        // Pulsing / Rotating effect
        const alpha = 0.3 + Math.sin(time / 100) * 0.1;
        this.rVisual.fillStyle(0xff4400, alpha);
        this.rVisual.fillCircle(this.x, this.y, radius);
        this.rVisual.lineStyle(2, 0xffaa00, 0.8);
        this.rVisual.strokeCircle(this.x, this.y, radius);

        // Periodic Damage (10 damage per second => check every 1 sec? or accumulate)
        // Let's do 10 damage triggers every 1000ms for simplicity
        this.skills.R.damageTimer += delta;
        if (this.skills.R.damageTimer >= 1000) {
            this.skills.R.damageTimer -= 1000;
            const damage = 10;

            // Damage Monsters
            this.scene.monsterManager.monsters.getChildren().forEach(monster => {
                if (monster.active && Phaser.Math.Distance.Between(this.x, this.y, monster.x, monster.y) <= radius) {
                    monster.takeDamage(damage);
                    monster.setTint(0xff0000);
                    this.scene.time.delayedCall(200, () => { if (monster.active) monster.clearTint(); });
                }
            });

            // Damage Crates
            if (this.scene.mapManager.crates) {
                this.scene.mapManager.crates.getChildren().forEach(crate => {
                    if (crate.active && Phaser.Math.Distance.Between(this.x, this.y, crate.x, crate.y) <= radius) {
                        crate.takeDamage(damage);
                    }
                });
            }
        }
    }

    handleMoveInput(x, y) {
        this.targetPosition.set(x, y);

        // Raycast check via MapManager
        if (this.scene.mapManager.isLineClear(this.x, this.y, x, y)) {
            this.path = null;
            this.isDirectMoving = true;
            this.scene.physics.moveTo(this, x, y, this.speed);
        } else {
            this.isDirectMoving = false;
            const path = this.scene.mapManager.findPath(this.x, this.y, x, y);
            if (path) {
                this.path = path;
            }
        }
    }

    moveAlongPath() {
        const next = this.path[0];
        const dist = Phaser.Math.Distance.Between(this.x, this.y, next.x, next.y);

        if (dist < 4) {
            this.x = next.x;
            this.y = next.y;
            this.path.shift();
            if (this.path.length > 0) {
                const newNext = this.path[0];
                this.scene.physics.moveTo(this, newNext.x, newNext.y, this.speed);
            }
        } else {
            this.scene.physics.moveTo(this, next.x, next.y, this.speed);
        }
    }

    handleSkillInput(time) {
        // Q
        if (Phaser.Input.Keyboard.JustDown(this.keys.Q) && time - this.skills.Q.lastFired >= this.skills.Q.cooldown) {
            const wasAiming = this.skills.Q.aiming;
            this.resetAiming();
            if (!wasAiming) {
                this.skills.Q.aiming = true;
                this.qIndicator.setVisible(true);
            }
        }
        // W
        if (Phaser.Input.Keyboard.JustDown(this.keys.W) && time - this.skills.W.lastFired >= this.skills.W.cooldown) {
            const wasAiming = this.skills.W.aiming;
            this.resetAiming();
            if (!wasAiming) {
                this.skills.W.aiming = true;
                this.wIndicator.setVisible(true);
            }
        }
        // E
        if (Phaser.Input.Keyboard.JustDown(this.keys.E) && time - this.skills.E.lastFired >= this.skills.E.cooldown) {
            const wasAiming = this.skills.E.aiming;
            this.resetAiming();
            if (!wasAiming) {
                this.skills.E.aiming = true;
                this.eIndicator.setVisible(true);
            }
        }

        // R (Immediate Cast)
        if (Phaser.Input.Keyboard.JustDown(this.keys.R) && time - this.skills.R.lastFired >= this.skills.R.cooldown) {
            this.fireR();
        }

        // A (Attack Move)
        if (Phaser.Input.Keyboard.JustDown(this.keys.A)) {
            const wasAiming = this.isAttackAiming;
            this.resetAiming();
            if (!wasAiming) {
                this.isAttackAiming = true;
                this.attackIndicator.setVisible(true);
            }
        }
    }

    resetAiming() {
        this.skills.Q.aiming = false;
        this.skills.W.aiming = false;
        this.skills.E.aiming = false;
        this.isAttackAiming = false;
        this.qIndicator.setVisible(false);
        this.wIndicator.setVisible(false);
        this.eIndicator.setVisible(false);
        this.attackIndicator.setVisible(false);
    }

    handleClick(pointer) {
        if (this.skills.Q.aiming) this.fireQ(pointer);
        else if (this.skills.W.aiming) this.fireW(pointer);
        else if (this.skills.E.aiming) this.fireE(pointer);
        else if (this.isAttackAiming) this.fireBasicAttack(pointer);
    }

    drawIndicators() {
        const pointer = this.scene.input.activePointer;
        const worldPoint = pointer.positionToCamera(this.scene.cameras.main);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);

        if (this.skills.Q.aiming) {
            const g = this.qIndicator;
            g.clear();
            g.lineStyle(2, g.defaultColor, 0.5);
            g.fillStyle(g.defaultColor, 0.3);
            g.beginPath();
            g.moveTo(this.x, this.y);
            g.lineTo(this.x + Math.cos(angle) * g.range, this.y + Math.sin(angle) * g.range);
            g.strokePath();
            g.fillCircle(this.x + Math.cos(angle) * g.range, this.y + Math.sin(angle) * g.range, 5);
        } else if (this.skills.W.aiming) {
            const g = this.wIndicator;
            g.clear();
            g.lineStyle(2, g.defaultColor, 0.5);
            g.fillStyle(g.defaultColor, 0.3);
            g.beginPath();
            g.moveTo(this.x, this.y);
            g.lineTo(this.x + Math.cos(angle) * g.range, this.y + Math.sin(angle) * g.range);
            g.strokePath();
            g.fillCircle(this.x + Math.cos(angle) * g.range, this.y + Math.sin(angle) * g.range, g.radius);
        } else if (this.skills.E.aiming) {
            const g = this.eIndicator;
            g.clear();
            const dist = Phaser.Math.Distance.Between(this.x, this.y, worldPoint.x, worldPoint.y);
            const valid = dist <= g.range;

            g.lineStyle(2, 0x00ff00, 0.5);
            g.fillStyle(0x00ff00, 0.1);
            g.strokeCircle(this.x, this.y, g.range);
            g.fillCircle(this.x, this.y, g.range);

            g.fillCircle(this.x, this.y, g.range);

            g.lineStyle(2, valid ? 0x00ff00 : 0xff0000, 1.0);
            g.strokeCircle(worldPoint.x, worldPoint.y, 10);
        } else if (this.isAttackAiming) {
            const g = this.attackIndicator;
            g.clear();
            g.lineStyle(2, g.defaultColor, 0.5);
            g.fillStyle(g.defaultColor, 0.1);
            g.strokeCircle(this.x, this.y, g.range);
        }
    }

    fireQ(pointer) {
        this.skills.Q.lastFired = this.scene.time.now;

        const worldPoint = pointer.positionToCamera(this.scene.cameras.main);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);

        const bullet = this.scene.bullets.create(this.x, this.y, 'bulletTexture');
        const vec = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)).scale(400);
        bullet.setVelocity(vec.x, vec.y);

        this.scene.time.delayedCall(2000, () => { if (bullet.active) bullet.destroy(); });

        this.resetAiming();
    }

    fireW(pointer) {
        this.skills.W.lastFired = this.scene.time.now;

        const worldPoint = pointer.positionToCamera(this.scene.cameras.main);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);

        const bullet = this.scene.bullets.create(this.x, this.y, 'bombTexture');
        bullet.descriptor = 'bomb';
        const vec = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)).scale(400);
        bullet.setVelocity(vec.x, vec.y);

        this.scene.time.delayedCall(1000, () => {
            if (bullet.active) {
                this.createExplosion(bullet.x, bullet.y);
                bullet.destroy();
            }
        });

        this.resetAiming();
    }

    createExplosion(x, y) {
        const explosion = this.scene.add.circle(x, y, 5, 0xff0000, 0.8);
        this.scene.tweens.add({
            targets: explosion, scaleX: 15, scaleY: 15, alpha: 0, duration: 300,
            onComplete: () => explosion.destroy()
        });

        const radius = 64;
        const damage = 10;
        this.scene.monsterManager.monsters.getChildren().forEach(monster => {
            if (monster.active && Phaser.Math.Distance.Between(x, y, monster.x, monster.y) <= radius) {
                monster.takeDamage(damage);
            }
        });

        // Damage Crates
        if (this.scene.mapManager.crates) {
            this.scene.mapManager.crates.getChildren().forEach(crate => {
                if (crate.active && Phaser.Math.Distance.Between(x, y, crate.x, crate.y) <= radius) {
                    crate.takeDamage(damage);
                }
            });
        }
    }

    fireE(pointer) {
        const worldPoint = pointer.positionToCamera(this.scene.cameras.main);
        const dist = Phaser.Math.Distance.Between(this.x, this.y, worldPoint.x, worldPoint.y);
        if (dist > 160) return;

        // Check Wall
        const gx = Math.floor(worldPoint.x / 32);
        const gy = Math.floor(worldPoint.y / 32);
        if (this.scene.mapManager.wallGrid.has(`${gx},${gy}`)) return;

        // Check Monster
        let blocked = false;
        this.scene.monsterManager.monsters.getChildren().forEach(m => {
            if (Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, m.x, m.y) < 40) blocked = true;
        });
        if (blocked) return;

        this.skills.E.lastFired = this.scene.time.now;
        this.skills.E.casting = true;
        this.setTint(0x8888ff);
        this.resetAiming();

        const castText = this.scene.add.text(this.x, this.y - 40, 'Casting...', { fontSize: '16px', color: '#00ffff' }).setOrigin(0.5);

        this.scene.time.delayedCall(500, () => {
            this.skills.E.casting = false;
            this.clearTint();
            castText.destroy();
            if (this.isDead) return;
            this.x = worldPoint.x;
            this.y = worldPoint.y;
            this.body.setVelocity(0);
            this.path = null;
            this.isDirectMoving = false;
        });
    }

    fireR() {
        if (this.isDead) return;
        this.skills.R.active = true;
        this.skills.R.lastFired = this.scene.time.now;
        this.skills.R.damageTimer = 1000; // Trigger immediately on first tick? or wait 1 sec? 
        // Let's trigger immediately for gratification
        // Actually code logic is += delta. So set to 1000 to trigger next frame.
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.currentHealth -= amount;
        this.scene.uiManager.updateHealth();
        this.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => { if (!this.isDead) this.clearTint(); });
        if (this.currentHealth <= 0) {
            this.isDead = true;
            this.setTint(0x555555);
            this.body.setVelocity(0);
            this.scene.gameOver();
        }
    }

    gainExperience(amount) {
        this.experience += amount;

        // Check for level up
        while (this.experience >= this.experienceToNextLevel) {
            this.experience -= this.experienceToNextLevel;
            this.levelUp();
        }

        // Update UI
        if (this.scene.uiManager) {
            this.scene.uiManager.updateExperience();
        }
    }

    levelUp() {
        this.level++;

        // Increase max health by 20
        this.maxHealth += 20;

        // Heal 20 HP
        this.currentHealth = Math.min(this.currentHealth + 20, this.maxHealth);

        // Visual feedback
        const levelUpText = this.scene.add.text(this.x, this.y - 50, `LEVEL UP! ${this.level}`, {
            fontSize: '24px',
            color: '#ffff00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: levelUpText,
            y: this.y - 100,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => levelUpText.destroy()
        });

        // Update UI
        if (this.scene.uiManager) {
            this.scene.uiManager.updateHealth();
            this.scene.uiManager.updateLevel();
            this.scene.uiManager.updateExperience();
        }
    }

    fireBasicAttack(pointer) {
        const cooldown = 1000 / this.attackSpeed;
        if (this.scene.time.now - this.lastAttackTime < cooldown) {
            // Cooldown not ready
            this.resetAiming();
            return;
        }

        const worldPoint = pointer.positionToCamera(this.scene.cameras.main);
        let target = null;
        const monsters = this.scene.monsterManager.monsters.getChildren();
        const crates = this.scene.mapManager.crates ? this.scene.mapManager.crates.getChildren() : [];

        // 1. Check for Direct Click (Cursor on Object)
        // Check Monsters
        for (const monster of monsters) {
            if (!monster.active) continue;
            if (Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, monster.x, monster.y) < 40) {
                if (Phaser.Math.Distance.Between(this.x, this.y, monster.x, monster.y) <= this.attackRange) {
                    target = monster;
                    break;
                }
            }
        }

        // Check Crates (if no monster clicked)
        if (!target) {
            for (const crate of crates) {
                if (!crate.active) continue;
                if (Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, crate.x, crate.y) < 30) {
                    if (Phaser.Math.Distance.Between(this.x, this.y, crate.x, crate.y) <= this.attackRange) {
                        target = crate;
                        break;
                    }
                }
            }
        }

        // 2. If no direct target, Attack Ground -> Priority: Monster > Crate
        if (!target) {
            let closestDist = this.attackRange;
            let closestEntity = null;

            // Search Nearest Monster
            for (const monster of monsters) {
                if (!monster.active) continue;
                const dist = Phaser.Math.Distance.Between(this.x, this.y, monster.x, monster.y);
                if (dist <= this.attackRange && dist < closestDist) {
                    closestDist = dist;
                    closestEntity = monster;
                }
            }

            // If no monster found, Search Nearest Crate
            if (!closestEntity) {
                closestDist = this.attackRange; // Reset distance for crate search
                for (const crate of crates) {
                    if (!crate.active) continue;
                    const dist = Phaser.Math.Distance.Between(this.x, this.y, crate.x, crate.y);
                    if (dist <= this.attackRange && dist < closestDist) {
                        closestDist = dist;
                        closestEntity = crate;
                    }
                }
            }

            target = closestEntity;
        }

        if (target) {
            this.lastAttackTime = this.scene.time.now;

            // Create Homing Projectile
            const bullet = this.scene.bullets.create(this.x, this.y, 'bulletTexture');
            bullet.setTint(0xff0000);
            bullet.target = target;
            bullet.isHoming = true;
            bullet.speed = 400;

            this.scene.time.delayedCall(3000, () => { if (bullet.active) bullet.destroy(); });

            this.resetAiming();
        } else {
            // No target found -> Move Command
            this.resetAiming();
            this.handleMoveInput(worldPoint.x, worldPoint.y);
        }
    }
}
