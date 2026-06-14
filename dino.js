
const dinoCanvas = document.getElementById('dino-canvas');
const ctx = dinoCanvas.getContext('2d');
const dinoBackBtn = document.getElementById('dino-back-btn');

// --- Game Constants ---
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 150;
const GROUND_Y = 130;
const DINO_WIDTH = 44;
const DINO_HEIGHT = 47;
const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const MIN_JUMP_FORCE = -5; // For variable jump height
const INITIAL_SPEED = 6;
const MAX_SPEED = 12;

// --- State Variables ---
let gameRunning = false;
let dinoY = GROUND_Y - DINO_HEIGHT;
let velocity = 0;
let isJumping = false;
let obstacles = [];
let clouds = [];
let groundParticles = [];
let gameSpeed = INITIAL_SPEED;
let dinoScore = 0;
let frameCount = 0;
let isSpacePressed = false;
let highdinoScore = localStorage.getItem('dinoHighScore') || 0;

// --- Initialization ---
window.startDinoGame = () => {
    if (gameRunning) return;
    gameRunning = true;
    obstacles = [];
    clouds = [];
    groundParticles = [];
    dinoScore = 0;
    gameSpeed = INITIAL_SPEED;
    dinoY = GROUND_Y - DINO_HEIGHT;
    velocity = 0;
    isJumping = false;
    frameCount = 0;
    
    // Spawn initial clouds
    for(let i=0; i<3; i++) spawnCloud(Math.random() * CANVAS_WIDTH);
    
    requestAnimationFrame(update);
};

// --- Input Handling ---
function handleJumpStart() {
    if (!gameRunning) return;
    if (!isJumping) {
        velocity = JUMP_FORCE;
        isJumping = true;
        isSpacePressed = true;
    }
}

function handleJumpEnd() {
    isSpacePressed = false;
    // Variable jump height: if we release early, cut the upward velocity
    if (velocity < MIN_JUMP_FORCE) {
        velocity = MIN_JUMP_FORCE;
    }
}

dinoCanvas.addEventListener('mousedown', () => {
    if (!gameRunning) window.startDinoGame();
    else handleJumpStart();
});
dinoCanvas.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    if (!gameRunning) window.startDinoGame();
    else handleJumpStart();
});
window.addEventListener('mouseup', handleJumpEnd);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJumpStart();
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleJumpEnd();
    }
});

// --- Entities ---
function spawnCloud(x = CANVAS_WIDTH) {
    clouds.push({
        x: x,
        y: 30 + Math.random() * 50,
        speed: 0.5 + Math.random() * 1,
        width: 40 + Math.random() * 30
    });
}

function spawnObstacle() {
    const type = Math.random() > 0.3 ? 'cactus' : 'bird';
    if (type === 'cactus') {
        const h = 30 + Math.random() * 20;
        obstacles.push({
            type: 'cactus',
            x: CANVAS_WIDTH,
            y: GROUND_Y - h,
            width: 20,
            height: h
        });
    } else {
        obstacles.push({
            type: 'bird',
            x: CANVAS_WIDTH,
            y: GROUND_Y - 60 - Math.random() * 30,
            width: 34,
            height: 24,
            frame: 0
        });
    }
}

// --- Physics & Logic ---
function update() {
    if (!gameRunning) return;

    frameCount++;
    
    // Smooth speed increase
    gameSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + (dinoScore / 500));

    // Dino Physics
    velocity += GRAVITY;
    dinoY += velocity;

    if (dinoY > GROUND_Y - DINO_HEIGHT) {
        dinoY = GROUND_Y - DINO_HEIGHT;
        velocity = 0;
        isJumping = false;
    }

    // Clouds
    if (frameCount % 120 === 0) spawnCloud();
    clouds.forEach((c, i) => {
        c.x -= c.speed;
        if (c.x + c.width < 0) clouds.splice(i, 1);
    });

    // Obstacles
    const minGap = 150 + (gameSpeed * 10);
    const lastObs = obstacles[obstacles.length - 1];
    if (!lastObs || (CANVAS_WIDTH - lastObs.x > minGap)) {
        if (Math.random() < 0.02) spawnObstacle();
    }

    obstacles.forEach((obs, index) => {
        obs.x -= gameSpeed;
        if (obs.x + obs.width < 0) {
            obstacles.splice(index, 1);
            dinoScore += 1;
        }

        // Collision detection with "fair" hitbox (padding)
        const padding = 6;
        if (
            dinoX + padding < obs.x + obs.width - padding &&
            dinoX + DINO_WIDTH - padding > obs.x + padding &&
            dinoY + padding < obs.y + obs.height - padding &&
            dinoY + DINO_HEIGHT - padding > obs.y + padding
        ) {
            gameOver();
        }
    });

    // Ground details
    if (frameCount % 10 === 0) {
        groundParticles.push({ x: CANVAS_WIDTH, y: GROUND_Y + Math.random() * 5, w: 2 + Math.random() * 5 });
    }
    groundParticles.forEach((p, i) => {
        p.x -= gameSpeed;
        if (p.x < 0) groundParticles.splice(i, 1);
    });

    draw();
    requestAnimationFrame(update);
}

function gameOver() {
    gameRunning = false;
    if (dinoScore > highdinoScore) {
        highdinoScore = Math.floor(dinoScore);
        localStorage.setItem('dinoHighScore', highdinoScore);
    }
    
    // Draw Game Over Screen
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 10);
    ctx.font = '16px sans-serif';
    ctx.fillText(`Score: ${Math.floor(dinoScore)}  HI: ${highdinoScore}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 20);
    ctx.fillText('Tap to Restart', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 45);
}

// --- Graphics ---
function draw() {
    const isDark = document.body.classList.contains('dark-theme');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ground line
    ctx.strokeStyle = isDark ? '#555' : '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Ground particles
    ctx.fillStyle = isDark ? '#444' : '#eee';
    groundParticles.forEach(p => ctx.fillRect(p.x, p.y, p.w, 1));

    // Clouds
    ctx.fillStyle = isDark ? '#3a3a3a' : '#f0f0f0';
    clouds.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
        ctx.arc(c.x + 15, c.y - 5, 12, 0, Math.PI * 2);
        ctx.arc(c.x + 30, c.y, 10, 0, Math.PI * 2);
        ctx.fill();
    });

    drawDino(isDark);

    // Obstacles
    obstacles.forEach(obs => {
        if (obs.type === 'cactus') {
            drawCactus(obs.x, obs.y, obs.width, obs.height, isDark);
        } else {
            drawBird(obs, isDark);
        }
    });

    // Score
    ctx.fillStyle = isDark ? '#aaa' : '#555';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`HI ${String(highdinoScore).padStart(5, '0')}  ${String(Math.floor(dinoScore)).padStart(5, '0')}`, CANVAS_WIDTH - 10, 20);
}

function drawDino(isDark) {
    ctx.fillStyle = isDark ? '#bbb' : '#555';
    const x = dinoX;
    const y = dinoY;

    // Simple pixel-ish dino body
    ctx.fillRect(x + 15, y, 20, 10); // Head
    ctx.fillRect(x + 32, y + 2, 4, 4); // Eye (hole)
    ctx.clearRect(x + 32, y + 2, 2, 2); 
    
    ctx.fillRect(x + 10, y + 10, 25, 20); // Body
    ctx.fillRect(x, y + 10, 10, 15); // Tail
    
    // Legs animation
    const legFrame = Math.floor(frameCount / 6) % 2;
    if (isJumping) {
        ctx.fillRect(x + 12, y + 30, 4, 10);
        ctx.fillRect(x + 24, y + 30, 4, 10);
    } else {
        if (legFrame === 0) {
            ctx.fillRect(x + 12, y + 30, 4, 10); // Leg 1
            ctx.fillRect(x + 24, y + 30, 4, 5);  // Leg 2 up
        } else {
            ctx.fillRect(x + 12, y + 30, 4, 5);  // Leg 1 up
            ctx.fillRect(x + 24, y + 30, 4, 10); // Leg 2
        }
    }
}

function drawCactus(x, y, w, h, isDark) {
    ctx.fillStyle = isDark ? '#4a7c4a' : '#3c6e3c';
    ctx.fillRect(x + w/4, y, w/2, h); // Main trunk
    ctx.fillRect(x, y + h/3, w, h/6); // Arms base
    ctx.fillRect(x, y + h/6, w/4, h/4); // Left arm
    ctx.fillRect(x + w*0.75, y + h/6, w/4, h/4); // Right arm
}

function drawBird(obs, isDark) {
    ctx.fillStyle = isDark ? '#888' : '#777';
    const wingY = (Math.floor(frameCount / 10) % 2 === 0) ? 5 : -5;
    ctx.fillRect(obs.x, obs.y, obs.width, 10); // Body
    ctx.fillRect(obs.x + 5, obs.y + wingY, 10, 5); // Wing
    ctx.fillRect(obs.x + 25, obs.y + 2, 8, 4); // Beak
}

dinoBackBtn.addEventListener('click', () => {
    gameRunning = false;
});
