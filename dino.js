
const dinoCanvas = document.getElementById('dino-canvas');
const ctx = dinoCanvas.getContext('2d');
const dinoBackBtn = document.getElementById('dino-back-btn');
const dinoOverlay = document.getElementById('dino-overlay');
const startContent = document.getElementById('dino-start-content');
const deathContent = document.getElementById('dino-death-content');
const startBtn = document.getElementById('dino-start-btn');
const restartBtn = document.getElementById('dino-restart-btn');
const hiScoreEl = document.getElementById('game-hi-score');
const currentScoreEl = document.getElementById('game-current-score');
const finalScoreText = document.getElementById('final-score-text');

// --- Game Constants ---
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200; // Increased height
const GROUND_Y = 170;
const DINO_WIDTH = 44;
const DINO_HEIGHT = 47;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const MIN_JUMP_FORCE = -6;
const INITIAL_SPEED = 5;
const MAX_SPEED = 13;

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
let highDinoScore = localStorage.getItem('dinoHighScore') || 0;

// Update HI score on load
hiScoreEl.innerText = `HI ${String(highDinoScore).padStart(5, '0')}`;

// --- Initialization ---
window.startDinoGame = () => {
    // Show start overlay initially, don't auto-start physics
    dinoOverlay.classList.remove('hidden');
    startContent.classList.remove('hidden');
    deathContent.classList.add('hidden');
    
    // Reset state but don't start loop yet
    obstacles = [];
    clouds = [];
    groundParticles = [];
    dinoScore = 0;
    gameSpeed = INITIAL_SPEED;
    dinoY = GROUND_Y - DINO_HEIGHT;
    velocity = 0;
    isJumping = false;
    
    updateScoreUI();
    drawStatic();
};

function runGame() {
    gameRunning = true;
    dinoOverlay.classList.add('hidden');
    obstacles = [];
    clouds = [];
    groundParticles = [];
    dinoScore = 0;
    frameCount = 0;
    
    for(let i=0; i<3; i++) spawnCloud(Math.random() * CANVAS_WIDTH);
    
    requestAnimationFrame(update);
}

startBtn.onclick = runGame;
restartBtn.onclick = runGame;

// --- Input Handling ---
function handleJumpStart() {
    if (!gameRunning) return;
    if (!isJumping) {
        velocity = JUMP_FORCE;
        isJumping = true;
    }
}

function handleJumpEnd() {
    if (velocity < MIN_JUMP_FORCE) {
        velocity = MIN_JUMP_FORCE;
    }
}

// Click anywhere on canvas/container to jump
dinoCanvas.addEventListener('mousedown', (e) => {
    if (gameRunning) handleJumpStart();
});
window.addEventListener('mouseup', handleJumpEnd);

dinoCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) handleJumpStart();
}, {passive: false});
window.addEventListener('touchend', handleJumpEnd);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (gameRunning) {
            e.preventDefault();
            handleJumpStart();
        } else if (!dinoOverlay.classList.contains('hidden')) {
            runGame();
        }
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleJumpEnd();
});

// --- Entities ---
function spawnCloud(x = CANVAS_WIDTH) {
    clouds.push({
        x: x,
        y: 20 + Math.random() * 60,
        speed: 0.3 + Math.random() * 0.5,
        w: 40 + Math.random() * 40
    });
}

function spawnObstacle() {
    const type = Math.random() > 0.3 ? 'cactus' : 'bird';
    if (type === 'cactus') {
        const h = 35 + Math.random() * 25;
        const w = 20 + Math.random() * 10;
        obstacles.push({ type, x: CANVAS_WIDTH, y: GROUND_Y - h, w, h });
    } else {
        obstacles.push({ type, x: CANVAS_WIDTH, y: GROUND_Y - 70 - Math.random() * 40, w: 40, h: 30 });
    }
}

function updateScoreUI() {
    currentScoreEl.innerText = String(Math.floor(dinoScore)).padStart(5, '0');
    if (dinoScore > highDinoScore) {
        highDinoScore = Math.floor(dinoScore);
        hiScoreEl.innerText = `HI ${String(highDinoScore).padStart(5, '0')}`;
    }
}

// --- Main Loop ---
function update() {
    if (!gameRunning) return;

    frameCount++;
    gameSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + (dinoScore / 1000) * 2);

    velocity += GRAVITY;
    dinoY += velocity;

    if (dinoY > GROUND_Y - DINO_HEIGHT) {
        dinoY = GROUND_Y - DINO_HEIGHT;
        velocity = 0;
        isJumping = false;
    }

    // Clouds
    if (frameCount % 180 === 0) spawnCloud();
    clouds.forEach((c, i) => {
        c.x -= c.speed;
        if (c.x + c.w < 0) clouds.splice(i, 1);
    });

    // Obstacles
    const minGap = 200 + (gameSpeed * 12);
    const lastObs = obstacles[obstacles.length - 1];
    if (!lastObs || (CANVAS_WIDTH - lastObs.x > minGap)) {
        if (Math.random() < 0.03) spawnObstacle();
    }

    obstacles.forEach((obs, index) => {
        obs.x -= gameSpeed;
        if (obs.x + obs.w < 0) {
            obstacles.splice(index, 1);
            dinoScore += 10;
            updateScoreUI();
        }

        const p = 8; // Collision padding
        if (
            dinoX + p < obs.x + obs.w - p &&
            dinoX + DINO_WIDTH - p > obs.x + p &&
            dinoY + p < obs.y + obs.h - p &&
            dinoY + DINO_HEIGHT - p > obs.y + p
        ) {
            gameOver();
        }
    });

    // Ground details
    if (frameCount % 15 === 0) {
        groundParticles.push({ x: CANVAS_WIDTH, y: GROUND_Y + 5 + Math.random() * 20, w: 2 + Math.random() * 10 });
    }
    groundParticles.forEach((p, i) => {
        p.x -= gameSpeed;
        if (p.x + p.w < 0) groundParticles.splice(i, 1);
    });

    draw();
    requestAnimationFrame(update);
}

function gameOver() {
    gameRunning = false;
    localStorage.setItem('dinoHighScore', highDinoScore);
    
    finalScoreText.innerText = `Final Score: ${Math.floor(dinoScore)}`;
    dinoOverlay.classList.remove('hidden');
    startContent.classList.add('hidden');
    deathContent.classList.remove('hidden');
}

function drawStatic() {
    const isDark = document.body.classList.contains('dark-theme');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGround(isDark);
    drawDino(isDark);
}

function draw() {
    const isDark = document.body.classList.contains('dark-theme');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Clouds
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
    clouds.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 15, 0, Math.PI*2);
        ctx.arc(c.x+20, c.y-10, 20, 0, Math.PI*2);
        ctx.arc(c.x+45, c.y, 15, 0, Math.PI*2);
        ctx.fill();
    });

    drawGround(isDark);
    
    // Particles
    ctx.fillStyle = isDark ? '#444' : '#ddd';
    groundParticles.forEach(p => ctx.fillRect(p.x, p.y, p.w, 2));

    drawDino(isDark);

    // Obstacles
    obstacles.forEach(obs => {
        if (obs.type === 'cactus') drawCactus(obs, isDark);
        else drawBird(obs, isDark);
    });
}

function drawGround(isDark) {
    ctx.strokeStyle = isDark ? '#444' : '#eee';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
}

function drawDino(isDark) {
    ctx.fillStyle = isDark ? '#00e676' : '#2196F3'; // Color dino!
    const x = 50;
    const y = dinoY;

    // Head & Snout
    ctx.fillRect(x + 20, y, 24, 14);
    ctx.fillRect(x + 40, y + 4, 8, 6); // Nose
    
    // Eye
    ctx.fillStyle = isDark ? '#111' : '#fff';
    ctx.fillRect(x + 34, y + 3, 4, 4);
    
    // Body
    ctx.fillStyle = isDark ? '#00e676' : '#2196F3';
    ctx.fillRect(x + 10, y + 14, 25, 20);
    ctx.fillRect(x, y + 14, 10, 16); // Tail
    
    // Legs
    const legFrame = Math.floor(frameCount / 6) % 2;
    if (isJumping) {
        ctx.fillRect(x + 15, y + 34, 6, 12);
        ctx.fillRect(x + 28, y + 34, 6, 12);
    } else {
        if (legFrame === 0) {
            ctx.fillRect(x + 15, y + 34, 6, 12);
            ctx.fillRect(x + 28, y + 34, 6, 6);
        } else {
            ctx.fillRect(x + 15, y + 34, 6, 6);
            ctx.fillRect(x + 28, y + 34, 6, 12);
        }
    }
}

function drawCactus(obs, isDark) {
    ctx.fillStyle = isDark ? '#ff5252' : '#f44336';
    const {x, y, w, h} = obs;
    ctx.fillRect(x + w*0.3, y, w*0.4, h); // Main
    ctx.fillRect(x, y + h*0.2, w, h*0.2); // Arms
    ctx.fillRect(x, y, w*0.2, h*0.4); // Left tip
    ctx.fillRect(x + w*0.8, y, w*0.2, h*0.4); // Right tip
}

function drawBird(obs, isDark) {
    ctx.fillStyle = isDark ? '#ffd740' : '#ff9800';
    const wingY = (Math.floor(frameCount / 10) % 2 === 0) ? 8 : -8;
    ctx.fillRect(obs.x, obs.y, obs.w, 12); // Body
    ctx.fillRect(obs.x + 10, obs.y + wingY, 15, 6); // Wing
    ctx.fillRect(obs.x + 35, obs.y + 4, 10, 4); // Beak
}

dinoBackBtn.addEventListener('click', () => {
    gameRunning = false;
});
