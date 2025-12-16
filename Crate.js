class Crate extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'crateTexture');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setImmovable(true);
        this.body.setSize(32, 32);

        this.maxHealth = 50;
        this.currentHealth = 50;

        // Identify grid position for removal
        this.gridKey = null;
    }

    takeDamage(amount) {
        this.currentHealth -= amount;

        // Visual Feedback 1: Scale Shake
        this.scene.tweens.add({
            targets: this,
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 50,
            yoyo: true,
            repeat: 1
        });

        // Visual Feedback 2: Color Flash
        this.setTint(0xffffff); // Flash White/Bright

        this.scene.time.delayedCall(100, () => {
            if (this.active) {
                // Visual Feedback 3: Permanent Damage State
                // As HP gets lower, tint gets darker/redder and size gets slightly smaller
                const ratio = Math.max(0, this.currentHealth / this.maxHealth);

                // 1.0 -> 0.0
                // Tint: Normal -> Red -> Dark Red
                // Val goes 255 -> 0
                const val = Math.floor(255 * ratio);
                // Red channel stays high, G/B drop, making it red. 
                // Can also drop R slightly to make it darker red near death.
                const red = 255;
                const gb = val;
                const color = Phaser.Display.Color.GetColor(red, gb, gb);

                this.setTint(color);
                this.setAlpha(0.5 + 0.5 * ratio); // Make it slightly transparent as it breaks
            }
        });

        if (this.currentHealth <= 0) {
            this.die();
        }
    }

    die() {
        if (this.scene.mapManager) {
            this.scene.mapManager.removeCrateFromGrid(this);
        }
        this.destroy();
    }
}
