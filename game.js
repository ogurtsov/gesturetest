class LabyrinthGame extends Phaser.Scene {
    constructor() {
        super({ key: 'LabyrinthGame' });
        
        // Game state
        this.score = 0;
        this.gameStartTime = 0;
        this.gameWon = false;
        this.timer = null;
        
        // Maze properties - will be calculated dynamically
        this.mazeWidth = 0;
        this.mazeHeight = 0;
        this.cellSize = 0;
        this.maze = [];
        
        // Game objects
        this.player = null;
        this.goal = null;
        this.walls = null;
        this.cursors = null;
        this.wasdKeys = null;
        
        // Player position in maze coordinates
        this.playerX = 1;
        this.playerY = 1;
        this.goalX = 0;
        this.goalY = 0;
        
        // Movement properties
        this.playerSpeed = 200; // pixels per second
        this.isMoving = false;
        this.targetX = 1;
        this.targetY = 1;
    }

    preload() {
        // No assets needed - we'll use Phaser's built-in graphics
        // This ensures immediate rendering without waiting for asset loads
    }

    create() {
        // Calculate optimal maze dimensions for screen
        this.calculateMazeDimensions();
        
        // Generate the maze
        this.generateMaze();
        
        // Create visual elements
        this.createMazeVisuals();
        this.createPlayer();
        this.createGoal();
        
        // Set up controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,S,A,D');
        
        // Start the timer
        this.gameStartTime = Date.now();
        this.startTimer();
    }

    calculateMazeDimensions() {
        // Get the game canvas dimensions
        const gameWidth = this.sys.game.config.width;
        const gameHeight = this.sys.game.config.height;
        
        // Target cell size for optimal visibility
        const targetCellSize = 20;
        
        // Calculate how many cells can fit
        let potentialWidth = Math.floor(gameWidth / targetCellSize);
        let potentialHeight = Math.floor(gameHeight / targetCellSize);
        
        // Ensure dimensions are odd (required for maze generation algorithm)
        this.mazeWidth = potentialWidth % 2 === 0 ? potentialWidth - 1 : potentialWidth;
        this.mazeHeight = potentialHeight % 2 === 0 ? potentialHeight - 1 : potentialHeight;
        
        // Ensure minimum size
        this.mazeWidth = Math.max(this.mazeWidth, 15);
        this.mazeHeight = Math.max(this.mazeHeight, 11);
        
        // Calculate actual cell size based on final dimensions
        this.cellSize = Math.min(
            Math.floor(gameWidth / this.mazeWidth),
            Math.floor(gameHeight / this.mazeHeight)
        );
        
        // Set goal position
        this.goalX = this.mazeWidth - 2;
        this.goalY = this.mazeHeight - 2;
    }

    generateMaze() {
        // Initialize maze with all walls
        this.maze = [];
        for (let y = 0; y < this.mazeHeight; y++) {
            this.maze[y] = [];
            for (let x = 0; x < this.mazeWidth; x++) {
                this.maze[y][x] = 1; // 1 = wall, 0 = path
            }
        }

        // Recursive backtracking algorithm
        const stack = [];
        const startX = 1;
        const startY = 1;
        
        this.maze[startY][startX] = 0; // Start position is a path
        stack.push({ x: startX, y: startY });

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(current.x, current.y);

            if (neighbors.length > 0) {
                // Choose a random neighbor
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                // Remove wall between current and next
                const wallX = current.x + (next.x - current.x) / 2;
                const wallY = current.y + (next.y - current.y) / 2;
                this.maze[wallY][wallX] = 0;
                this.maze[next.y][next.x] = 0;
                
                stack.push(next);
            } else {
                stack.pop();
            }
        }

        // Ensure goal position is accessible
        this.maze[this.goalY][this.goalX] = 0;
    }

    getUnvisitedNeighbors(x, y) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -2 }, // Up
            { x: 2, y: 0 },  // Right
            { x: 0, y: 2 },  // Down
            { x: -2, y: 0 }  // Left
        ];

        for (const dir of directions) {
            const newX = x + dir.x;
            const newY = y + dir.y;

            if (newX > 0 && newX < this.mazeWidth - 1 && 
                newY > 0 && newY < this.mazeHeight - 1 && 
                this.maze[newY][newX] === 1) {
                neighbors.push({ x: newX, y: newY });
            }
        }

        return neighbors;
    }

    createMazeVisuals() {
        this.walls = this.add.group();

        for (let y = 0; y < this.mazeHeight; y++) {
            for (let x = 0; x < this.mazeWidth; x++) {
                if (this.maze[y][x] === 1) {
                    const wall = this.add.rectangle(
                        x * this.cellSize + this.cellSize / 2,
                        y * this.cellSize + this.cellSize / 2,
                        this.cellSize,
                        this.cellSize,
                        0x808080 // Grey color
                    );
                    wall.setStrokeStyle(1, 0x606060);
                    this.walls.add(wall);
                }
            }
        }
    }

    createPlayer() {
        const playerX = this.playerX * this.cellSize + this.cellSize / 2;
        const playerY = this.playerY * this.cellSize + this.cellSize / 2;
        
        this.player = this.add.circle(
            playerX,
            playerY,
            this.cellSize / 3,
            0xffff00 // Yellow color
        );
        this.player.setStrokeStyle(2, 0xffcc00);
    }

    createGoal() {
        const goalX = this.goalX * this.cellSize + this.cellSize / 2;
        const goalY = this.goalY * this.cellSize + this.cellSize / 2;
        
        this.goal = this.add.circle(
            goalX,
            goalY,
            this.cellSize / 3,
            0x00ff00 // Green color
        );
        this.goal.setStrokeStyle(2, 0x00cc00);
    }

    update(time, delta) {
        if (this.gameWon) return;

        // Handle continuous movement
        this.handleMovement(delta);

        // Update timer display
        this.updateTimer();
    }

    handleMovement(delta) {
        // Get current input state
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;
        const upPressed = this.cursors.up.isDown || this.wasdKeys.W.isDown;
        const downPressed = this.cursors.down.isDown || this.wasdKeys.S.isDown;

        // Calculate movement vector
        let velocityX = 0;
        let velocityY = 0;

        if (leftPressed && !rightPressed) velocityX = -1;
        if (rightPressed && !leftPressed) velocityX = 1;
        if (upPressed && !downPressed) velocityY = -1;
        if (downPressed && !upPressed) velocityY = 1;

        // Normalize diagonal movement
        if (velocityX !== 0 && velocityY !== 0) {
            const length = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
            velocityX /= length;
            velocityY /= length;
        }

        // Calculate new position
        const moveDistance = this.playerSpeed * (delta / 1000);
        let newPixelX = this.player.x + velocityX * moveDistance;
        let newPixelY = this.player.y + velocityY * moveDistance;

        // Try moving on both axes
        if (this.canMoveToPixel(newPixelX, newPixelY)) {
            // Can move to the target position
            this.player.x = newPixelX;
            this.player.y = newPixelY;
        } else {
            // Try moving on X axis only
            if (velocityX !== 0 && this.canMoveToPixel(this.player.x + velocityX * moveDistance, this.player.y)) {
                this.player.x += velocityX * moveDistance;
            }
            // Try moving on Y axis only
            else if (velocityY !== 0 && this.canMoveToPixel(this.player.x, this.player.y + velocityY * moveDistance)) {
                this.player.y += velocityY * moveDistance;
            }
        }

        // Update maze coordinates for win condition checking
        this.playerX = Math.floor(this.player.x / this.cellSize);
        this.playerY = Math.floor(this.player.y / this.cellSize);

        // Check win condition
        if (this.playerX === this.goalX && this.playerY === this.goalY) {
            this.winGame();
        }
    }

    canMoveTo(x, y) {
        // Check bounds
        if (x < 0 || x >= this.mazeWidth || y < 0 || y >= this.mazeHeight) {
            return false;
        }
        
        // Check if it's a wall
        return this.maze[y][x] === 0;
    }

    canMoveToPixel(pixelX, pixelY) {
        // Calculate the player's radius
        const radius = this.cellSize / 3;
        
        // Check all four corners of the player's bounding box
        const corners = [
            { x: pixelX - radius, y: pixelY - radius }, // Top-left
            { x: pixelX + radius, y: pixelY - radius }, // Top-right
            { x: pixelX - radius, y: pixelY + radius }, // Bottom-left
            { x: pixelX + radius, y: pixelY + radius }  // Bottom-right
        ];

        for (const corner of corners) {
            const mazeX = Math.floor(corner.x / this.cellSize);
            const mazeY = Math.floor(corner.y / this.cellSize);
            
            if (!this.canMoveTo(mazeX, mazeY)) {
                return false;
            }
        }
        
        return true;
    }

    winGame() {
        this.gameWon = true;
        this.score += 100;
        
        // Update score display
        document.getElementById('score').textContent = this.score;
        
        // Show win message
        const winMessage = document.getElementById('win-message');
        winMessage.style.display = 'block';
        
        // Add visual feedback
        this.tweens.add({
            targets: this.player,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            yoyo: true,
            repeat: 2
        });

        // Generate new maze after 3 seconds
        this.time.delayedCall(3000, () => {
            this.resetGame();
        });
    }

    resetGame() {
        // Reset game state
        this.gameWon = false;
        this.playerX = 1;
        this.playerY = 1;
        this.isMoving = false;
        this.targetX = 1;
        this.targetY = 1;
        
        // Hide win message
        document.getElementById('win-message').style.display = 'none';
        
        // Clear existing visuals
        this.walls.clear(true, true);
        this.player.destroy();
        this.goal.destroy();
        
        // Recalculate maze dimensions (in case screen size changed)
        this.calculateMazeDimensions();
        
        // Generate new maze
        this.generateMaze();
        this.createMazeVisuals();
        this.createPlayer();
        this.createGoal();
        
        // Reset timer
        this.gameStartTime = Date.now();
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    updateTimer() {
        if (!this.gameWon) {
            const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
            document.getElementById('timer').textContent = elapsed;
        }
    }


}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth - 20,
    height: window.innerHeight - 20,
    parent: 'game-container',
    backgroundColor: '#000000',
    scene: LabyrinthGame,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
        antialias: false,
        pixelArt: true
    }
};

// Start the game
const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
    const newWidth = window.innerWidth - 20;
    const newHeight = window.innerHeight - 20;
    
    game.scale.resize(newWidth, newHeight);
    
    // Restart the scene to recalculate maze dimensions
    setTimeout(() => {
        game.scene.scenes[0].scene.restart();
    }, 100);
});

// Initialize game when page loads
window.addEventListener('load', () => {
    // Game initialization complete
});
