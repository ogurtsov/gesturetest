class LabyrinthGame extends Phaser.Scene {
    constructor() {
        super({ key: 'LabyrinthGame' });
        
        // Initialize all game state
        this.initializeGameState();
    }

    initializeGameState() {
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
        
        // Ghost system
        this.ghosts = [];
        this.maxGhosts = 10;
        this.ghostSpawnTimer = 0;
        this.ghostSpawnInterval = 60000; // 60 seconds in milliseconds
        this.ghostSpeed = 100; // pixels per second (slower than player)
        this.minSpawnDistance = 5; // minimum cells away from player
        
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
        
        // Sound properties
        this.footstepSounds = [];
        this.lastFootstep = 'right'; // Track which foot stepped last
        this.footstepDistance = 0; // Track distance for footstep timing
        this.footstepThreshold = 25; // Distance threshold for each footstep
        this.backgroundMusic = null;
        
        // MediaPipe tracking properties
        this.holistic = null;
        this.camera = null;
        this.facePosition = { x: 0.5, y: 0.5 }; // Normalized coordinates
        this.rightPalmPosition = { x: 0.5, y: 0.5 }; // Normalized coordinates
        this.motionControlEnabled = false;
        this.motionSensitivity = 2.0; // Multiplier for motion control sensitivity
    }

    preload() {
        // Set up error handling for missing audio files
        this.load.on('loaderror', (file) => {
            console.warn(`Could not load audio file: ${file.src}`);
        });
        
        // Load footstep sounds using actual asset files
        this.load.audio('footstep-left', 'assets/25_orc_walk_stone_1.wav');
        this.load.audio('footstep-right', 'assets/25_orc_walk_stone_2.wav');
        
        // Load background music
        this.load.audio('background-music', 'assets/goblins_den_regular.wav');
    }

    create() {
        console.log('Creating game scene...');
        // Force reset all game state
        this.gameWon = false;
        this.score = 0;
        
        // Reset player state
        this.playerX = 1;
        this.playerY = 1;
        this.isMoving = false;
        this.targetX = 1;
        this.targetY = 1;
        
        // Clear any existing timers
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Calculate optimal maze dimensions for screen
        this.calculateMazeDimensions();
        
        // Generate the maze
        this.generateMaze();
        
        // Create visual elements
        this.createMazeVisuals();
        this.createPlayer();
        this.createGoal();
        
        // Spawn the first ghost
        this.spawnGhost();
        
        // Set up sounds
        this.setupSounds();
        
        // Set up MediaPipe motion tracking
        this.setupMediaPipe();
        
        // Set up controls (recreate to ensure clean state)
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,S,A,D');
        
        // Ensure all keys are in released state
        this.input.keyboard.resetKeys();
        
        // Enable audio on first user interaction
        this.input.keyboard.on('keydown', () => {
            if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
                this.backgroundMusic.play();
            }
        }, this);
        
        // Set start time (for internal tracking)
        this.gameStartTime = Date.now();
        
        // Reset ghost spawn timer
        this.ghostSpawnTimer = Date.now();
        

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

    setupSounds() {
        // Initialize footstep sounds
        try {
            this.footstepSounds.left = this.sound.add('footstep-left', { volume: 0.5 });
            this.footstepSounds.right = this.sound.add('footstep-right', { volume: 0.5 });
        } catch (error) {
            console.warn('Could not load footstep sounds:', error);
            // Create silent placeholder sounds if audio files don't exist
            this.footstepSounds.left = null;
            this.footstepSounds.right = null;
        }
        
        // Initialize background music
        try {
            this.backgroundMusic = this.sound.add('background-music', { 
                volume: 0.3,
                loop: true 
            });
            // Start playing background music
            this.backgroundMusic.play();
        } catch (error) {
            console.warn('Could not load background music:', error);
            this.backgroundMusic = null;
        }
        
        // Reset footstep tracking
        this.footstepDistance = 0;
        this.lastFootstep = 'right';
    }

    handleFootsteps(distance) {
        // Accumulate distance traveled
        this.footstepDistance += distance;
        
        // Check if we've traveled far enough for a footstep
        if (this.footstepDistance >= this.footstepThreshold) {
            this.playFootstepSound();
            this.footstepDistance = 0; // Reset distance counter
        }
    }

    playFootstepSound() {
        // Alternate between left and right footsteps
        const currentFoot = this.lastFootstep === 'left' ? 'right' : 'left';
        
        // Play the sound if available
        if (this.footstepSounds[currentFoot]) {
            this.footstepSounds[currentFoot].play();
        }
        
        // Update which foot stepped last
        this.lastFootstep = currentFoot;
    }

    setupMediaPipe() {
        // Check if MediaPipe is available
        if (typeof Holistic === 'undefined') {
            console.warn('MediaPipe Holistic not available. Motion controls disabled.');
            document.getElementById('motion-indicator').textContent = 'Unavailable';
            document.getElementById('motion-indicator').style.color = '#ffaa00';
            return;
        }

        try {
            // Initialize Holistic model
            this.holistic = new Holistic({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
                }
            });

            // Configure Holistic
            this.holistic.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                refineFaceLandmarks: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            // Set up result handler
            this.holistic.onResults((results) => {
                this.onMediaPipeResults(results);
            });

            // Set up camera
            const videoElement = document.getElementById('input_video');
            this.camera = new Camera(videoElement, {
                onFrame: async () => {
                    if (this.holistic) {
                        await this.holistic.send({ image: videoElement });
                    }
                },
                width: 640,
                height: 480
            });

            // Start camera
            this.camera.start();
            this.motionControlEnabled = true;
            console.log('MediaPipe motion tracking initialized successfully');
            
            // Update UI indicator
            document.getElementById('motion-indicator').textContent = 'Active';
            document.getElementById('motion-indicator').style.color = '#00ff00';

        } catch (error) {
            console.warn('Failed to initialize MediaPipe:', error);
            this.motionControlEnabled = false;
            
            // Update UI indicator
            document.getElementById('motion-indicator').textContent = 'Failed';
            document.getElementById('motion-indicator').style.color = '#ff0000';
        }
    }

    onMediaPipeResults(results) {
        // Track face position (nose tip)
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            // Use nose tip (landmark index 1) for face center
            const noseTip = results.faceLandmarks[1];
            this.facePosition = {
                x: noseTip.x,
                y: noseTip.y
            };
        }

        // Track right hand palm position
        if (results.rightHandLandmarks && results.rightHandLandmarks.length > 0) {
            // Use wrist (landmark index 0) as palm center
            const palm = results.rightHandLandmarks[0];
            this.rightPalmPosition = {
                x: palm.x,
                y: palm.y
            };
        }
    }

    getMotionControlInput() {
        if (!this.motionControlEnabled) {
            return { x: 0, y: 0 };
        }

        // Calculate relative position of palm to face
        // Invert X-axis to match natural movement (mirror effect correction)
        const deltaX = -(this.rightPalmPosition.x - this.facePosition.x) * this.motionSensitivity;
        const deltaY = (this.rightPalmPosition.y - this.facePosition.y) * this.motionSensitivity;

        // Apply deadzone to prevent jitter
        const deadzone = 0.1;
        const clampedX = Math.abs(deltaX) > deadzone ? deltaX : 0;
        const clampedY = Math.abs(deltaY) > deadzone ? deltaY : 0;

        return {
            x: Math.max(-1, Math.min(1, clampedX)), // Clamp to [-1, 1]
            y: Math.max(-1, Math.min(1, clampedY))  // Clamp to [-1, 1]
        };
    }

    spawnGhost() {
        if (this.ghosts.length >= this.maxGhosts) return;

        // Find a valid spawn position away from player
        const spawnPos = this.findValidSpawnPosition();
        if (!spawnPos) return; // No valid position found

        // Create ghost object
        const ghost = {
            x: spawnPos.x * this.cellSize + this.cellSize / 2,
            y: spawnPos.y * this.cellSize + this.cellSize / 2,
            mazeX: spawnPos.x,
            mazeY: spawnPos.y,
            sprite: null,
            path: [],
            pathIndex: 0,
            lastPathUpdate: 0
        };

        // Create visual representation
        ghost.sprite = this.add.circle(
            ghost.x,
            ghost.y,
            this.cellSize / 4,
            0x808080 // Grey color
        );
        ghost.sprite.setStrokeStyle(2, 0x606060);

        this.ghosts.push(ghost);
    }

    findValidSpawnPosition() {
        const attempts = 100; // Maximum attempts to find a valid position
        
        for (let i = 0; i < attempts; i++) {
            // Random position in maze
            const x = Math.floor(Math.random() * this.mazeWidth);
            const y = Math.floor(Math.random() * this.mazeHeight);
            
            // Check if position is valid (not a wall)
            if (this.maze[y][x] !== 0) continue;
            
            // Check distance from player
            const distance = Math.sqrt(
                Math.pow(x - this.playerX, 2) + Math.pow(y - this.playerY, 2)
            );
            
            if (distance >= this.minSpawnDistance) {
                return { x, y };
            }
        }
        
        return null; // No valid position found
    }

    update(time, delta) {
        if (this.gameWon) return;

        // Handle continuous movement
        this.handleMovement(delta);

        // Handle ghost spawning
        this.handleGhostSpawning();

        // Update ghosts
        this.updateGhosts(delta);

        // Check ghost collisions
        this.checkGhostCollisions();


    }

    handleMovement(delta) {
        // Get keyboard input state
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;
        const upPressed = this.cursors.up.isDown || this.wasdKeys.W.isDown;
        const downPressed = this.cursors.down.isDown || this.wasdKeys.S.isDown;

        // Get motion control input
        const motionInput = this.getMotionControlInput();

        // Calculate movement vector (combine keyboard and motion input)
        let velocityX = 0;
        let velocityY = 0;

        // Keyboard input
        if (leftPressed && !rightPressed) velocityX = -1;
        if (rightPressed && !leftPressed) velocityX = 1;
        if (upPressed && !downPressed) velocityY = -1;
        if (downPressed && !upPressed) velocityY = 1;

        // Motion input (additive with keyboard, but motion takes priority if present)
        if (Math.abs(motionInput.x) > 0 || Math.abs(motionInput.y) > 0) {
            velocityX = motionInput.x;
            velocityY = motionInput.y;
        }

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

        // Store old position for movement detection
        const oldX = this.player.x;
        const oldY = this.player.y;
        
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
        
        // Handle footstep sounds if player moved
        const actualDistance = Math.sqrt(
            Math.pow(this.player.x - oldX, 2) + Math.pow(this.player.y - oldY, 2)
        );
        
        if (actualDistance > 0) {
            this.handleFootsteps(actualDistance);
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

    handleGhostSpawning() {
        const currentTime = Date.now();
        
        if (currentTime - this.ghostSpawnTimer >= this.ghostSpawnInterval) {
            this.spawnGhost();
            this.ghostSpawnTimer = currentTime;
        }
    }

    updateGhosts(delta) {
        for (const ghost of this.ghosts) {
            this.updateGhostAI(ghost, delta);
        }
    }

    updateGhostAI(ghost, delta) {
        const currentTime = Date.now();
        
        // Update path every 500ms for performance
        if (currentTime - ghost.lastPathUpdate > 500) {
            ghost.path = this.findPathToPlayer(ghost.mazeX, ghost.mazeY);
            ghost.pathIndex = 0;
            ghost.lastPathUpdate = currentTime;
        }
        
        // Move ghost along path
        if (ghost.path.length > 1 && ghost.pathIndex < ghost.path.length - 1) {
            const currentNode = ghost.path[ghost.pathIndex];
            const nextNode = ghost.path[ghost.pathIndex + 1];
            
            const targetX = nextNode.x * this.cellSize + this.cellSize / 2;
            const targetY = nextNode.y * this.cellSize + this.cellSize / 2;
            
            // Calculate direction to target
            const dx = targetX - ghost.x;
            const dy = targetY - ghost.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 2) {
                // Move towards target
                const moveDistance = this.ghostSpeed * (delta / 1000);
                ghost.x += (dx / distance) * moveDistance;
                ghost.y += (dy / distance) * moveDistance;
                
                // Update sprite position
                ghost.sprite.x = ghost.x;
                ghost.sprite.y = ghost.y;
                
                // Update maze coordinates
                ghost.mazeX = Math.floor(ghost.x / this.cellSize);
                ghost.mazeY = Math.floor(ghost.y / this.cellSize);
            } else {
                // Reached current target, move to next node
                ghost.pathIndex++;
            }
        }
    }

    findPathToPlayer(startX, startY) {
        // Simple A* pathfinding implementation
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const start = `${startX},${startY}`;
        const goal = `${this.playerX},${this.playerY}`;
        
        openSet.push({ x: startX, y: startY, key: start });
        gScore.set(start, 0);
        fScore.set(start, this.heuristic(startX, startY, this.playerX, this.playerY));
        
        while (openSet.length > 0) {
            // Get node with lowest fScore
            openSet.sort((a, b) => fScore.get(a.key) - fScore.get(b.key));
            const current = openSet.shift();
            
            if (current.key === goal) {
                // Reconstruct path
                const path = [];
                let currentKey = current.key;
                
                while (currentKey) {
                    const [x, y] = currentKey.split(',').map(Number);
                    path.unshift({ x, y });
                    currentKey = cameFrom.get(currentKey);
                }
                
                return path;
            }
            
            closedSet.add(current.key);
            
            // Check neighbors
            const neighbors = [
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y },
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 }
            ];
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                // Skip if out of bounds or wall
                if (neighbor.x < 0 || neighbor.x >= this.mazeWidth || 
                    neighbor.y < 0 || neighbor.y >= this.mazeHeight ||
                    this.maze[neighbor.y][neighbor.x] !== 0) {
                    continue;
                }
                
                if (closedSet.has(neighborKey)) continue;
                
                const tentativeGScore = gScore.get(current.key) + 1;
                
                if (!openSet.find(n => n.key === neighborKey)) {
                    openSet.push({ x: neighbor.x, y: neighbor.y, key: neighborKey });
                } else if (tentativeGScore >= gScore.get(neighborKey)) {
                    continue;
                }
                
                cameFrom.set(neighborKey, current.key);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor.x, neighbor.y, this.playerX, this.playerY));
            }
        }
        
        return []; // No path found
    }

    heuristic(x1, y1, x2, y2) {
        // Manhattan distance
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    checkGhostCollisions() {
        for (const ghost of this.ghosts) {
            const distance = Math.sqrt(
                Math.pow(ghost.x - this.player.x, 2) + 
                Math.pow(ghost.y - this.player.y, 2)
            );
            
            // If ghost touches player (within cell radius)
            if (distance < this.cellSize / 2) {
                this.gameOver();
                return;
            }
        }
    }

    gameOver() {
        this.gameWon = true; // Stop game updates
        
        // Create red overlay covering entire screen
        const redOverlay = this.add.rectangle(
            0, 0,
            this.sys.game.config.width * 2,
            this.sys.game.config.height * 2,
            0xff0000 // Red color
        );
        redOverlay.setOrigin(0, 0);
        redOverlay.setDepth(1000); // Ensure it's on top
        
        // Create "THE END" text
        const gameOverText = this.add.text(
            this.sys.game.config.width / 2,
            this.sys.game.config.height / 2,
            'THE END',
            {
                fontSize: '120px',
                fill: '#ffffff',
                fontFamily: 'Arial Black, Arial',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }
        );
        gameOverText.setOrigin(0.5);
        gameOverText.setDepth(1001); // Above the red overlay
        
        // Add dramatic effect - make text pulse
        this.tweens.add({
            targets: gameOverText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Restart after 30 seconds
        this.time.delayedCall(30000, () => {
            console.log('30 seconds elapsed, restarting game...');
            // Force a complete scene restart
            this.scene.restart();
        });
    }

    winGame() {
        this.gameWon = true;
        
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
        
        // Clear ghosts
        for (const ghost of this.ghosts) {
            ghost.sprite.destroy();
        }
        this.ghosts = [];
        
        // Recalculate maze dimensions (in case screen size changed)
        this.calculateMazeDimensions();
        
        // Generate new maze
        this.generateMaze();
        this.createMazeVisuals();
        this.createPlayer();
        this.createGoal();
        
        // Spawn first ghost
        this.spawnGhost();
        
        // Restart background music if it exists
        if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
            this.backgroundMusic.play();
        }
        
        // Reset timers
        this.gameStartTime = Date.now();
        this.ghostSpawnTimer = Date.now();
    }

    cleanupMediaPipe() {
        // Clean up MediaPipe resources if needed
        if (this.camera) {
            this.camera.stop();
        }
        if (this.holistic) {
            this.holistic.close();
        }
        this.motionControlEnabled = false;
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
