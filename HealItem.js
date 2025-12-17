
class HealItem extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'healItem'); // 'healItem' is the key for the texture
        this.scene = scene;
        this.healingAmount = 20; // As requested by the user
        this.setOrigin(0.5); // Center the sprite
        scene.add.existing(this);
        scene.physics.world.enable(this);
        this.body.setAllowGravity(false); // Heal items should not be affected by gravity
        this.body.setImmovable(true); // Heal items should not move when collided with

        // Pulsating effect
        scene.tweens.add({
            targets: this,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.7,
            ease: 'Sine.easeInOut',
            duration: 800,
            yoyo: true,
            repeat: -1 // Loop indefinitely
        });
    }

    // You might add methods here for animation, interaction, etc.
}
