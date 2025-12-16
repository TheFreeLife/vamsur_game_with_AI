class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Background
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // Title
        this.add.text(width / 2, 150, 'VAMSUR', {
            fontSize: '72px',
            fill: '#00ff88',
            fontStyle: 'bold',
            stroke: '#003322',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, 220, 'Survive the Endless Wave', {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Start Button
        const startBtn = this.add.text(width / 2, 320, 'START GAME', {
            fontSize: '36px',
            fill: '#ffffff',
            backgroundColor: '#16213e',
            padding: { x: 30, y: 15 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        // Button Hover Effects
        startBtn.on('pointerover', () => {
            startBtn.setStyle({ fill: '#00ff88', backgroundColor: '#0f3460' });
            this.tweens.add({
                targets: startBtn,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100
            });
        });

        startBtn.on('pointerout', () => {
            startBtn.setStyle({ fill: '#ffffff', backgroundColor: '#16213e' });
            this.tweens.add({
                targets: startBtn,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 100
            });
        });

        startBtn.on('pointerdown', () => {
            this.cameras.main.fade(500, 0, 0, 0);
            this.time.delayedCall(500, () => {
                this.scene.start('MainScene');
            });
        });

        // Controls Info
        const controls = [
            'Controls:',
            'Right Click - Move',
            'Q, W, E, R - Skills',
            'A - Attack Move',
            'Left Click - Use Skill / Attack'
        ];

        let yPos = 420;
        controls.forEach((text, index) => {
            this.add.text(width / 2, yPos, text, {
                fontSize: index === 0 ? '20px' : '16px',
                fill: index === 0 ? '#00ff88' : '#aaaaaa',
                fontStyle: index === 0 ? 'bold' : 'normal'
            }).setOrigin(0.5);
            yPos += index === 0 ? 30 : 22;
        });

        // Animated particles in background
        this.createBackgroundEffect();
    }

    createBackgroundEffect() {
        const particles = [];
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, 800);
            const y = Phaser.Math.Between(0, 600);
            const size = Phaser.Math.Between(2, 5);

            const particle = this.add.circle(x, y, size, 0x00ff88, 0.3);
            particles.push(particle);

            this.tweens.add({
                targets: particle,
                y: y + Phaser.Math.Between(50, 150),
                alpha: 0,
                duration: Phaser.Math.Between(2000, 4000),
                repeat: -1,
                yoyo: false,
                onRepeat: () => {
                    particle.y = Phaser.Math.Between(-50, 0);
                    particle.x = Phaser.Math.Between(0, 800);
                }
            });
        }
    }
}
