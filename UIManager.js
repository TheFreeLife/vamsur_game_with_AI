class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.player = null; // Set later

        // HUD Elements
        this.healthBarBg = null;
        this.healthBar = null;
        this.healthText = null;

        this.skillIcons = {};
        this.overlays = {};
    }

    setPlayer(player) {
        this.player = player;
    }

    createUI() {
        // Health Bar
        this.healthBarBg = this.scene.add.rectangle(700, 30, 104, 24, 0x000000);
        this.healthBarBg.setScrollFactor(0).setDepth(100);

        this.healthBar = this.scene.add.rectangle(700, 30, 100, 20, 0x00ff00);
        this.healthBar.setScrollFactor(0).setDepth(100);

        this.healthText = this.scene.add.text(700, 30, '100/100', {
            fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

        // Skills
        const baseY = 530;
        this.createSkillIcon('Q', 50, baseY);
        this.createSkillIcon('W', 110, baseY);
        this.createSkillIcon('E', 170, baseY);
        this.createSkillIcon('R', 230, baseY);
    }

    createSkillIcon(key, x, y) {
        const bg = this.scene.add.rectangle(x, y, 50, 50, 0x333333);
        bg.setScrollFactor(0).setDepth(100).setStrokeStyle(2, 0xffffff);

        const text = this.scene.add.text(x, y, key, {
            fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

        const overlay = this.scene.add.rectangle(x, y, 50, 50, 0xffffff, 0.5);
        overlay.setScrollFactor(0).setDepth(102);
        overlay.setOrigin(0.5, 1);
        overlay.y = y + 25; // Align bottom
        overlay.scaleY = 0;

        this.skillIcons[key] = { bg, text };
        this.overlays[key] = overlay;
    }

    update() {
        if (!this.player) return;
        this.updateHealth();
        this.updateCooldowns();
    }

    updateHealth() {
        const current = this.player.currentHealth;
        const max = this.player.maxHealth;
        const ratio = Math.max(0, current / max);

        this.healthBar.width = 100 * ratio;
        this.healthBar.fillColor = ratio < 0.3 ? 0xff0000 : 0x00ff00;
        this.healthText.setText(`${Math.ceil(current)}/${max}`);
    }

    updateCooldowns() {
        const now = this.scene.time.now;
        const skills = ['Q', 'W', 'E', 'R'];

        skills.forEach(key => {
            const skill = this.player.skills[key];
            const elapsed = now - skill.lastFired;

            if (elapsed < skill.cooldown) {
                const remaining = skill.cooldown - elapsed;
                const ratio = remaining / skill.cooldown;
                this.overlays[key].scaleY = ratio;
                this.overlays[key].setVisible(true);
            } else {
                this.overlays[key].setVisible(false);
            }
        });
    }
}
