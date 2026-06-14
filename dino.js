
const dinoCanvas = document.getElementById('dino-canvas');
const ctx = dinoCanvas.getContext('2d');
const dinoGameBtn = document.getElementById('dino-game-btn');
const dinoBackBtn = document.getElementById('dino-back-btn');
const screenDino = document.getElementById('screen-dino');
const screenWelcome = document.getElementById('screen-welcome');

let dinoY = 120;
let dinoX = 50;
let velocity = 0;
let gravity = 0.6;
let isJumping = false;
let obstacles = [];
let gameRunning = false;
let score = 0;

function jump() {
    if (!isJumping) {
        velocity = -10;
        isJumping = true;
    }
}

function update() {
    if (!gameRunning) return;
    
    velocity += gravity;
    dinoY += velocity;

    if (dinoY >= 120) {
        dinoY = 120;
        isJumping = false;
    }

    if (Math.random() < 0.02) {
        obstacles.push({ x: 600, y: 120, width: 20, height: 30 });
    }

    obstacles.forEach((obs, index) => {
        obs.x -= 5;
        if (obs.x + obs.width < 0) obstacles.splice(index, 1);
        
        if (dinoX < obs.x + obs.width && dinoX + 30 > obs.x && dinoY + 30 > obs.y) {
            gameRunning = false;
            alert('Game Over! Score: ' + Math.floor(score));
        }
    });

    score += 0.1;
    draw();
    requestAnimationFrame(update);
}

function draw() {
    ctx.clearRect(0, 0, dinoCanvas.width, dinoCanvas.height);
    ctx.fillStyle = '#555';
    ctx.fillRect(dinoX, dinoY, 30, 30); // Dino
    
    ctx.fillStyle = '#f00';
    obstacles.forEach(obs => ctx.fillRect(obs.x, obs.y, obs.width, obs.height));
}

dinoBackBtn.addEventListener('click', () => {
    screenDino.classList.add('hidden');
    screenWelcome.classList.remove('hidden');
    gameRunning = false;
});

dinoCanvas.addEventListener('click', jump);
document.addEventListener('keydown', (e) => { if (e.code === 'Space') jump(); });
