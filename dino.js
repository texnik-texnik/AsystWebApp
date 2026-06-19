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
const CANVAS_HEIGHT = 200;
const GROUND_Y = 170;
const DINO_X = 50;
const DINO_RUN_WIDTH = 44;
const DINO_RUN_HEIGHT = 47;
const DINO_DUCK_WIDTH = 58;
const DINO_DUCK_HEIGHT = 30;
const GRAVITY = 0.62;
const JUMP_FORCE = -12.2;
const MIN_JUMP_FORCE = -6;
const INITIAL_SPEED = 5;
const MAX_SPEED = 14;
const SCORE_PER_FRAME = 0.12;

// --- State Variables ---
let gameRunning = false;
let gamePaused = false;
let dinoY = GROUND_Y - DINO_RUN_HEIGHT;
let velocity = 0;
let isJumping = false;
let isDucking = false;
let obstacles = [];
let clouds = [];
let groundParticles = [];
let stars = [];
let gameSpeed = INITIAL_SPEED;
let dinoScore = 0;
let frameCount = 0;
let nextMilestone = 100;
let milestoneText = '';
let milestoneFrames = 0;
let animationFrameId = null;
let highDinoScore = Number(localStorage.getItem('dinoHighScore')) || 0;

hiScoreEl.textContent = `HI ${String(highDinoScore).padStart(5, '0')}`;

// --- Initialization ---
window.startDinoGame = () => {
    stopGameLoop();
    resetGameState();
    dinoOverlay.classList.remove('hidden');
    startContent.classList.remove('hidden');
    deathContent.classList.add('hidden');
    updateScoreUI(true);
    drawStatic();
};

function resetGameState() {
    gameRunning = false;
    gamePaused = false;
    obstacles = [];
    clouds = [];
    groundParticles = [];
    stars = [];
    dinoScore = 0;
    frameCount = 0;
    nextMilestone = 100;
    milestoneText = '';
    milestoneFrames = 0;
    gameSpeed = INITIAL_SPEED;
    dinoY = GROUND_Y - DINO_RUN_HEIGHT;
    velocity = 0;
    isJumping = false;
    isDucking = false;
}

function runGame() {
    stopGameLoop();
    resetGameState();
    gameRunning = true;
    dinoOverlay.classList.add('hidden');

    for (let i = 0; i < 4; i += 1) spawnCloud(Math.random() * CANVAS_WIDTH);
    for (let i = 0; i < 30; i += 1) spawnStar();

    animationFrameId = requestAnimationFrame(update);
}

function stopGameLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

startBtn.onclick = runGame;
restartBtn.onclick = runGame;

// --- Input Handling ---
function isOnGround() {
    return dinoY >= GROUND_Y - getDinoHeight() - 0.5;
}

function getDinoWidth() {
    return isDucking && !isJumping ? DINO_DUCK_WIDTH : DINO_RUN_WIDTH;
}

function getDinoHeight() {
    return isDucking && !isJumping ? DINO_DUCK_HEIGHT : DINO_RUN_HEIGHT;
}

function handleJumpStart() {
    if (!gameRunning || gamePaused) return;
    if (!isJumping) {
        isDucking = false;
        dinoY = GROUND_Y - DINO_RUN_HEIGHT;
        velocity = JUMP_FORCE;
        isJumping = true;
        if (navigator.vibrate) navigator.vibrate(12);
    }
}

function handleJumpEnd() {
    if (velocity < MIN_JUMP_FORCE) velocity = MIN_JUMP_FORCE;
}

function handleDuckStart() {
    if (!gameRunning || gamePaused || isJumping) return;
    isDucking = true;
    dinoY = GROUND_Y - DINO_DUCK_HEIGHT;
}

function handleDuckEnd() {
    if (!isDucking) return;
    isDucking = false;
    if (!isJumping) dinoY = GROUND_Y - DINO_RUN_HEIGHT;
}

function togglePause() {
    if (!gameRunning || !dinoOverlay.classList.contains('hidden')) return;
    gamePaused = !gamePaused;
    if (!gamePaused && animationFrameId === null) animationFrameId = requestAnimationFrame(update);
}

dinoCanvas.addEventListener('mousedown', () => handleJumpStart());
window.addEventListener('mouseup', handleJumpEnd);

dinoCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleJumpStart();
}, { passive: false });
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

    if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleDuckStart();
    }

    if (e.code === 'KeyP') togglePause();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleJumpEnd();
    if (e.code === 'ArrowDown') handleDuckEnd();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameRunning) gamePaused = true;
});

// --- Entities ---
function spawnCloud(x = CANVAS_WIDTH) {
    clouds.push({
        x,
        y: 18 + Math.random() * 58,
        speed: 0.25 + Math.random() * 0.55,
        w: 38 + Math.random() * 42
    });
}

function spawnStar() {
    stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 12 + Math.random() * 95,
        r: 1 + Math.random() * 1.6,
        alpha: 0.25 + Math.random() * 0.55
    });
}

function spawnObstacle() {
    const canSpawnBird = dinoScore > 80;
    const type = canSpawnBird && Math.random() < 0.36 ? 'bird' : 'cactus';

    if (type === 'cactus') {
        const h = 34 + Math.random() * 28;
        const w = 18 + Math.random() * 12;
        const cluster = Math.random() > 0.72 ? 2 : 1;
        obstacles.push({ type, x: CANVAS_WIDTH, y: GROUND_Y - h, w: w * cluster + 8 * (cluster - 1), h, cluster });
        return;
    }

    const isLowBird = dinoScore > 180 && Math.random() > 0.5;
    obstacles.push({
        type,
        x: CANVAS_WIDTH,
        y: isLowBird ? GROUND_Y - 58 : GROUND_Y - 88,
        w: 42,
        h: 24,
        low: isLowBird
    });
}

function updateScoreUI(force = false) {
    const roundedScore = Math.floor(dinoScore);
    if (force || frameCount % 5 === 0) currentScoreEl.textContent = String(roundedScore).padStart(5, '0');

    if (roundedScore > highDinoScore) {
        highDinoScore = roundedScore;
        hiScoreEl.textContent = `HI ${String(highDinoScore).padStart(5, '0')}`;
    }
}

function getDinoHitbox() {
    const width = getDinoWidth();
    const height = getDinoHeight();
    return {
        x: DINO_X + 5,
        y: dinoY + 4,
        w: width - 10,
        h: height - 8
    };
}

function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// --- Main Loop ---
function update() {
    animationFrameId = null;
    if (!gameRunning) return;

    if (gamePaused) {
        draw();
        drawPausedOverlay();
        animationFrameId = requestAnimationFrame(update);
        return;
    }

    frameCount += 1;
    dinoScore += SCORE_PER_FRAME;
    gameSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + (dinoScore / 650));

    if (dinoScore >= nextMilestone) {
        milestoneText = `${nextMilestone}!`;
        milestoneFrames = 55;
        nextMilestone += 100;
        if (navigator.vibrate) navigator.vibrate(25);
    }

    velocity += GRAVITY;
    dinoY += velocity;

    const currentHeight = getDinoHeight();
    if (dinoY > GROUND_Y - currentHeight) {
        dinoY = GROUND_Y - currentHeight;
        velocity = 0;
        isJumping = false;
    }

    if (frameCount % 170 === 0) spawnCloud();
    clouds.forEach((cloud, index) => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.w < 0) clouds.splice(index, 1);
    });

    const minGap = 185 + (gameSpeed * 14) + Math.random() * 20;
    const lastObs = obstacles[obstacles.length - 1];
    if (!lastObs || (CANVAS_WIDTH - lastObs.x > minGap)) {
        if (Math.random() < 0.045) spawnObstacle();
    }

    const dinoHitbox = getDinoHitbox();
    obstacles.forEach((obs, index) => {
        obs.x -= gameSpeed;
        if (obs.x + obs.w < 0) {
            obstacles.splice(index, 1);
            dinoScore += obs.type === 'bird' ? 8 : 5;
            updateScoreUI(true);
            return;
        }

        const obstacleHitbox = { x: obs.x + 4, y: obs.y + 4, w: obs.w - 8, h: obs.h - 8 };
        if (intersects(dinoHitbox, obstacleHitbox)) gameOver();
    });

    if (frameCount % 12 === 0) {
        groundParticles.push({ x: CANVAS_WIDTH, y: GROUND_Y + 5 + Math.random() * 20, w: 2 + Math.random() * 12 });
    }
    groundParticles.forEach((particle, index) => {
        particle.x -= gameSpeed;
        if (particle.x + particle.w < 0) groundParticles.splice(index, 1);
    });

    if (milestoneFrames > 0) milestoneFrames -= 1;

    updateScoreUI();
    draw();
    animationFrameId = requestAnimationFrame(update);
}

function gameOver() {
    gameRunning = false;
    stopGameLoop();
    localStorage.setItem('dinoHighScore', String(highDinoScore));

    finalScoreText.textContent = `Счёт: ${Math.floor(dinoScore)}`;
    dinoOverlay.classList.remove('hidden');
    startContent.classList.add('hidden');
    deathContent.classList.remove('hidden');
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
}

function drawStatic() {
    const isDark = document.body.classList.contains('dark-theme');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBackground(isDark);
    drawGround(isDark);
    drawDino(isDark);
}

function draw() {
    const isDark = document.body.classList.contains('dark-theme');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBackground(isDark);

    drawClouds(isDark);
    drawGround(isDark);

    ctx.fillStyle = isDark ? '#444' : '#ddd';
    groundParticles.forEach((particle) => ctx.fillRect(particle.x, particle.y, particle.w, 2));

    drawDino(isDark);
    obstacles.forEach((obs) => {
        if (obs.type === 'cactus') drawCactus(obs, isDark);
        else drawBird(obs, isDark);
    });

    if (milestoneFrames > 0) drawMilestone(isDark);
}

function drawBackground(isDark) {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    if (isDark) {
        gradient.addColorStop(0, '#101522');
        gradient.addColorStop(1, '#1d1d1d');
    } else {
        gradient.addColorStop(0, '#eef8ff');
        gradient.addColorStop(1, '#ffffff');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isDark) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        stars.forEach((star) => {
            ctx.globalAlpha = star.alpha;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    } else {
        ctx.fillStyle = 'rgba(255, 193, 7, 0.35)';
        ctx.beginPath();
        ctx.arc(520, 38, 24, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawClouds(isDark) {
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(33,150,243,0.08)';
    clouds.forEach((cloud) => {
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, 15, 0, Math.PI * 2);
        ctx.arc(cloud.x + 20, cloud.y - 10, 20, 0, Math.PI * 2);
        ctx.arc(cloud.x + 45, cloud.y, 15, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawGround(isDark) {
    ctx.strokeStyle = isDark ? '#444' : '#dfeaf2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
}

function drawDino(isDark) {
    const dinoColor = isDark ? '#00e676' : '#2196F3';
    const eyeColor = isDark ? '#111' : '#fff';
    const x = DINO_X;
    const y = dinoY;

    ctx.fillStyle = dinoColor;

    if (isDucking && !isJumping) {
        ctx.fillRect(x + 4, y + 10, 38, 16); // body
        ctx.fillRect(x + 38, y + 4, 20, 14); // head
        ctx.fillRect(x, y + 14, 12, 8); // tail
        ctx.fillStyle = eyeColor;
        ctx.fillRect(x + 50, y + 8, 4, 4);
        ctx.fillStyle = dinoColor;
        const legFrame = Math.floor(frameCount / 6) % 2;
        ctx.fillRect(x + 14, y + 24, 7, legFrame ? 4 : 8);
        ctx.fillRect(x + 30, y + 24, 7, legFrame ? 8 : 4);
        return;
    }

    // Head & Snout
    ctx.fillRect(x + 20, y, 24, 14);
    ctx.fillRect(x + 40, y + 4, 8, 6);

    // Eye
    ctx.fillStyle = eyeColor;
    ctx.fillRect(x + 34, y + 3, 4, 4);

    // Body
    ctx.fillStyle = dinoColor;
    ctx.fillRect(x + 10, y + 14, 25, 20);
    ctx.fillRect(x, y + 14, 10, 16);

    const legFrame = Math.floor(frameCount / 6) % 2;
    if (isJumping) {
        ctx.fillRect(x + 15, y + 34, 6, 12);
        ctx.fillRect(x + 28, y + 34, 6, 12);
    } else if (legFrame === 0) {
        ctx.fillRect(x + 15, y + 34, 6, 12);
        ctx.fillRect(x + 28, y + 34, 6, 6);
    } else {
        ctx.fillRect(x + 15, y + 34, 6, 6);
        ctx.fillRect(x + 28, y + 34, 6, 12);
    }
}

function drawCactus(obs, isDark) {
    ctx.fillStyle = isDark ? '#ff5252' : '#f44336';
    const { x, y, w, h, cluster } = obs;
    const singleWidth = cluster > 1 ? (w - 8) / 2 : w;

    for (let i = 0; i < cluster; i += 1) {
        const offset = i * (singleWidth + 8);
        ctx.fillRect(x + offset + singleWidth * 0.3, y, singleWidth * 0.4, h);
        ctx.fillRect(x + offset, y + h * 0.2, singleWidth, h * 0.2);
        ctx.fillRect(x + offset, y, singleWidth * 0.2, h * 0.4);
        ctx.fillRect(x + offset + singleWidth * 0.8, y, singleWidth * 0.2, h * 0.4);
    }
}

function drawBird(obs, isDark) {
    ctx.fillStyle = isDark ? '#ffd740' : '#ff9800';
    const wingY = (Math.floor(frameCount / 10) % 2 === 0) ? 8 : -8;
    ctx.fillRect(obs.x, obs.y + 6, obs.w, 10);
    ctx.fillRect(obs.x + 10, obs.y + 6 + wingY, 16, 6);
    ctx.fillRect(obs.x + 35, obs.y + 9, 10, 4);

    if (obs.low) {
        ctx.fillStyle = isDark ? 'rgba(255,215,64,0.25)' : 'rgba(255,152,0,0.2)';
        ctx.fillRect(obs.x - 3, obs.y + obs.h + 3, obs.w + 6, 2);
    }
}

function drawMilestone(isDark) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, milestoneFrames / 20);
    ctx.fillStyle = isDark ? '#00e676' : '#1976D2';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(milestoneText, CANVAS_WIDTH / 2, 56);
    ctx.restore();
}

function drawPausedOverlay() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Пауза', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Нажмите P, чтобы продолжить', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 26);
    ctx.restore();
}

dinoBackBtn.addEventListener('click', () => {
    gameRunning = false;
    gamePaused = false;
    stopGameLoop();
});
