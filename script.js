/**
 * Escape do Labirinto Vivo - Com Perseguidores!
 * 
 * Controles: WASD ou Setas para mover
 * Tecla X para atacar inimigos adjacentes
 * O labirinto muda a cada 5 segundos!
 */

// ==================== CONFIGURAÇÕES ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAZE_SIZE = 19; // Tamanho ímpar (19x19)
const CELL_SIZE = Math.floor(canvas.width / MAZE_SIZE);

// ==================== ESTADO DO JOGO ====================
let gameRunning = true;
let gameWin = false;
let score = 0;
let coins = 0;
let keys = 0;
let distance = 0;
let timeSurvived = 0;
let highScore = localStorage.getItem('mazeHighScore') || 0;

let health = 3;
let invincibleTimer = 0;

let timeUntilChange = 5.0;
let changeInterval = 5.0;
let freezeTimer = 0;
let speedTimer = 0;
let revealTimer = 0;

// Estruturas do jogo
let maze = [];
let player = { x: 1, y: 1 };
let exit = { x: MAZE_SIZE - 2, y: MAZE_SIZE - 2 };
let items = [];
let enemies = [];

// Movimento com cooldown (evita movimento muito rápido)
let moveCooldown = 0;

// Elementos DOM
const timerValueEl = document.getElementById('timerValue');
const distanceValueEl = document.getElementById('distanceValue');
const coinsValueEl = document.getElementById('coinsValue');
const keysValueEl = document.getElementById('keysValue');
const enemiesValueEl = document.getElementById('enemiesValue');
const nextChangeValueEl = document.getElementById('nextChangeValue');
const highScoreValueEl = document.getElementById('highScoreValue');
const powerupStatusEl = document.getElementById('powerupStatus');
const healthBarFill = document.getElementById('healthBarFill');

// ==================== CLASSE DO INIMIGO ====================
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.stunned = false;
        this.stunTimer = 0;
        this.moveCooldown = 0;
    }
    
    update(deltaTime, player, maze) {
        if (this.stunned) {
            this.stunTimer -= deltaTime;
            if (this.stunTimer <= 0) {
                this.stunned = false;
            }
            return;
        }
        
        if (freezeTimer > 0) return;
        
        this.moveCooldown -= deltaTime;
        if (this.moveCooldown <= 0) {
            this.moveCooldown = 0.25;
            
            // Movimento inteligente em direção ao jogador
            let dx = 0, dy = 0;
            if (Math.abs(player.x - this.x) > Math.abs(player.y - this.y)) {
                dx = Math.sign(player.x - this.x);
                dy = 0;
            } else {
                dx = 0;
                dy = Math.sign(player.y - this.y);
            }
            
            const newX = this.x + dx;
            const newY = this.y + dy;
            
            if (newX >= 0 && newX < MAZE_SIZE && newY >= 0 && newY < MAZE_SIZE && maze[newX][newY] === 0) {
                this.x = newX;
                this.y = newY;
            }
        }
    }
    
    stun() {
        this.stunned = true;
        this.stunTimer = 2.0;
    }
    
    draw() {
        const x = this.y * CELL_SIZE;
        const y = this.x * CELL_SIZE;
        
        ctx.fillStyle = this.stunned ? '#8888ff' : (freezeTimer > 0 ? '#66ccff' : '#ff3366');
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ff3366';
        ctx.beginPath();
        ctx.ellipse(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.3, CELL_SIZE * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.35, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.35, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.33, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.33, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
}

// ==================== GERADOR DE LABIRINTO ====================
function generateMaze() {
    const newMaze = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(1));
    
    function carve(x, y) {
        const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }
        
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx > 0 && nx < MAZE_SIZE - 1 && ny > 0 && ny < MAZE_SIZE - 1 && newMaze[nx][ny] === 1) {
                newMaze[nx][ny] = 0;
                newMaze[x + dx/2][y + dy/2] = 0;
                carve(nx, ny);
            }
        }
    }
    
    newMaze[1][1] = 0;
    carve(1, 1);
    newMaze[MAZE_SIZE - 2][MAZE_SIZE - 2] = 0;
    
    return newMaze;
}

// ==================== GERAR ITENS ====================
function generateItems() {
    items = [];
    const numCoins = 8 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < numCoins; i++) {
        let x, y, attempts = 0;
        do {
            x = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
            y = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
            attempts++;
            if (attempts > 100) break;
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) || 
                (x === exit.x && y === exit.y) || items.some(item => item.x === x && item.y === y));
        
        if (attempts <= 100) items.push({ x, y, type: 'coin' });
    }
    
    const numKeys = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numKeys; i++) {
        let x, y, attempts = 0;
        do {
            x = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
            y = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
            attempts++;
            if (attempts > 100) break;
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) ||
                (x === exit.x && y === exit.y) || items.some(item => item.x === x && item.y === y));
        
        if (attempts <= 100) items.push({ x, y, type: 'key' });
    }
}

// ==================== GERAR INIMIGOS ====================
function spawnEnemies() {
    enemies = [];
    const numEnemies = Math.min(3 + Math.floor(timeSurvived / 30), 6);
    
    for (let i = 0; i < numEnemies; i++) {
        let x, y, attempts = 0;
        do {
            x = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
            y = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
            attempts++;
            if (attempts > 100) break;
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) || 
                (x === exit.x && y === exit.y) || Math.abs(x - player.x) < 3);
        
        if (attempts <= 100) {
            enemies.push(new Enemy(x, y));
        }
    }
    enemiesValueEl.textContent = enemies.length;
}

// ==================== MUTAÇÃO DO LABIRINTO ====================
function mutateMaze() {
    if (freezeTimer > 0) return;
    
    const flash = document.getElementById('mazeFlash');
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 150);
    
    const oldPlayerPos = { x: player.x, y: player.y };
    const oldExitPos = { x: exit.x, y: exit.y };
    
    const numMutations = Math.floor(Math.random() * 8) + 3;
    
    for (let i = 0; i < numMutations; i++) {
        const x = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
        const y = 1 + Math.floor(Math.random() * (MAZE_SIZE - 2));
        
        if ((x === oldPlayerPos.x && y === oldPlayerPos.y) || 
            (x === oldExitPos.x && y === oldExitPos.y)) {
            continue;
        }
        
        if (maze[x][y] === 1) {
            maze[x][y] = 0;
        } else if (maze[x][y] === 0 && Math.random() > 0.3) {
            maze[x][y] = 1;
        }
    }
    
    generateItems();
}

// ==================== MOVIMENTO DO JOGADOR ====================
function movePlayer(dx, dy) {
    if (!gameRunning || gameWin) return false;
    if (moveCooldown > 0) return false;
    
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    if (newX < 0 || newX >= MAZE_SIZE || newY < 0 || newY >= MAZE_SIZE) return false;
    if (maze[newX][newY] === 1) return false;
    
    // Movimento confirmado
    moveCooldown = 0.1; // Pequeno cooldown para controle
    player.x = newX;
    player.y = newY;
    distance++;
    
    // Coletar itens
    const itemIndex = items.findIndex(item => item.x === player.x && item.y === player.y);
    if (itemIndex !== -1) {
        const item = items[itemIndex];
        if (item.type === 'coin') {
            coins++;
            playSound(880, 0.08);
        } else if (item.type === 'key') {
            keys++;
            playSound(659, 0.1);
        }
        items.splice(itemIndex, 1);
        updateUI();
    }
    
    // Verificar saída
    if (player.x === exit.x && player.y === exit.y && keys > 0) {
        gameWin = true;
        gameRunning = false;
        victory();
    }
    
    updateUI();
    return true;
}

// ==================== ATAQUE ====================
function attackEnemies() {
    if (!gameRunning || gameWin) return;
    
    for (let enemy of enemies) {
        const isAdjacent = (Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y)) === 1;
        if (isAdjacent && !enemy.stunned) {
            enemy.stun();
            playSound(440, 0.1);
            break;
        }
    }
}

// ==================== COLISÃO COM INIMIGOS ====================
function checkEnemyCollision() {
    if (invincibleTimer > 0) {
        invincibleTimer -= 0.016;
        return;
    }
    
    for (let enemy of enemies) {
        if (enemy.x === player.x && enemy.y === player.y && !enemy.stunned) {
            health--;
            invincibleTimer = 1.0;
            
            const healthPercent = (health / 3) * 100;
            healthBarFill.style.width = `${healthPercent}%`;
            playSound(220, 0.15);
            
            if (health <= 0) {
                gameRunning = false;
                gameOver();
            }
            break;
        }
    }
}

// ==================== SONS ====================
let audioContext = null;

function playSound(frequency, volume) {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = frequency;
        gain.gain.value = volume;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.15);
        osc.stop(audioContext.currentTime + 0.15);
    } catch(e) {}
}

// ==================== POWER-UPS ====================
function useRevealMap() {
    if (revealTimer > 0 || score < 50) return;
    score -= 50;
    revealTimer = 3;
    playSound(1046, 0.1);
    updateUI();
}

function useFreezeMaze() {
    if (freezeTimer > 0 || score < 75) return;
    score -= 75;
    freezeTimer = 5;
    playSound(1046, 0.1);
    updateUI();
}

function useSpeedBoost() {
    if (speedTimer > 0 || score < 40) return;
    score -= 40;
    speedTimer = 4;
    playSound(1046, 0.1);
    updateUI();
}

function useStunEnemies() {
    if (score < 60) return;
    score -= 60;
    for (let enemy of enemies) {
        enemy.stun();
    }
    playSound(1046, 0.1);
    updateUI();
}

// ==================== UI ====================
function updateUI() {
    coinsValueEl.textContent = coins;
    keysValueEl.textContent = keys;
    distanceValueEl.textContent = Math.floor(distance);
    enemiesValueEl.textContent = enemies.length;
    highScoreValueEl.textContent = highScore;
    
    let status = '';
    if (freezeTimer > 0) status += `❄️ ${freezeTimer.toFixed(1)}s `;
    if (speedTimer > 0) status += `⚡ ${speedTimer.toFixed(1)}s `;
    if (revealTimer > 0) status += `🔮 ${revealTimer.toFixed(1)}s `;
    powerupStatusEl.textContent = status || '✓ ATIVO';
    
    document.getElementById('powerupReveal').disabled = score < 50 || revealTimer > 0;
    document.getElementById('powerupFreeze').disabled = score < 75 || freezeTimer > 0;
    document.getElementById('powerupSpeed').disabled = score < 40 || speedTimer > 0;
    document.getElementById('powerupStun').disabled = score < 60;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==================== TIMERS ====================
let lastFrameTime = 0;

function updateTimers(deltaTime) {
    if (!gameRunning || gameWin) return;
    
    timeSurvived += deltaTime;
    score = Math.floor(timeSurvived * 10) + coins * 5 + keys * 20;
    
    // Cooldown do movimento
    if (moveCooldown > 0) {
        moveCooldown -= deltaTime;
    }
    
    if (freezeTimer > 0) {
        freezeTimer -= deltaTime;
        nextChangeValueEl.textContent = 'CONGELADO';
    } else {
        timeUntilChange -= deltaTime;
        if (timeUntilChange <= 0) {
            mutateMaze();
            timeUntilChange = changeInterval;
        }
        nextChangeValueEl.textContent = `${timeUntilChange.toFixed(1)}s`;
    }
    
    if (speedTimer > 0) {
        speedTimer -= deltaTime;
    }
    
    if (revealTimer > 0) {
        revealTimer -= deltaTime;
    }
    
    timerValueEl.textContent = formatTime(timeSurvived);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('mazeHighScore', highScore);
        highScoreValueEl.textContent = highScore;
    }
    
    updateUI();
}

// ==================== RENDERIZAÇÃO ====================
function drawMaze() {
    for (let i = 0; i < MAZE_SIZE; i++) {
        for (let j = 0; j < MAZE_SIZE; j++) {
            const x = j * CELL_SIZE;
            const y = i * CELL_SIZE;
            
            if (maze[i][j] === 1) {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                ctx.fillStyle = '#00ffcc11';
                ctx.fillRect(x + 2, y + 2, CELL_SIZE - 5, 2);
            } else {
                ctx.fillStyle = '#0a0a1a';
                ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                ctx.strokeStyle = '#00ffcc08';
                ctx.strokeRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
            }
        }
    }
}

function drawItems() {
    for (const item of items) {
        const x = item.y * CELL_SIZE;
        const y = item.x * CELL_SIZE;
        
        if (item.type === 'coin') {
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.font = `${CELL_SIZE * 0.35}px Arial`;
            ctx.fillText('💰', x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.7);
        } else if (item.type === 'key') {
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.4, CELL_SIZE * 0.4, CELL_SIZE * 0.15);
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE * 0.7, y + CELL_SIZE * 0.48, CELL_SIZE * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawEnemies() {
    for (let enemy of enemies) {
        enemy.draw();
    }
}

function drawPlayer() {
    const x = player.y * CELL_SIZE;
    const y = player.x * CELL_SIZE;
    
    ctx.save();
    
    if (invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    ctx.fillStyle = '#00ffcc';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffcc';
    ctx.beginPath();
    ctx.ellipse(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.3, CELL_SIZE * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Faixa de ninja
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(x + CELL_SIZE * 0.2, y + CELL_SIZE * 0.3, CELL_SIZE * 0.6, 4);
    
    // Olhos
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.33, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.33, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawExit() {
    const x = exit.y * CELL_SIZE;
    const y = exit.x * CELL_SIZE;
    
    if (keys > 0) {
        ctx.fillStyle = '#00ff44';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'white';
        ctx.font = `${CELL_SIZE * 0.4}px Arial`;
        ctx.fillText('🚪', x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.7);
    } else {
        ctx.fillStyle = '#ff6600';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffcc00';
        ctx.font = `${CELL_SIZE * 0.35}px Arial`;
        ctx.fillText('🔒', x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.7);
    }
}

function drawMinimap() {
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');
    const size = 100;
    const cellSize = size / MAZE_SIZE;
    
    minimapCanvas.width = size;
    minimapCanvas.height = size;
    
    for (let i = 0; i < MAZE_SIZE; i++) {
        for (let j = 0; j < MAZE_SIZE; j++) {
            minimapCtx.fillStyle = maze[i][j] === 1 ? '#333' : '#0a0a1a';
            minimapCtx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
    }
    
    for (let enemy of enemies) {
        minimapCtx.fillStyle = '#ff3366';
        minimapCtx.fillRect(enemy.y * cellSize, enemy.x * cellSize, cellSize, cellSize);
    }
    
    minimapCtx.fillStyle = '#00ffcc';
    minimapCtx.fillRect(player.y * cellSize, player.x * cellSize, cellSize, cellSize);
    
    minimapCtx.fillStyle = '#00ff44';
    minimapCtx.fillRect(exit.y * cellSize, exit.x * cellSize, cellSize, cellSize);
}

// ==================== GAME OVER / VITÓRIA ====================
function gameOver() {
    document.getElementById('overlayTitle').textContent = '💀 GAME OVER 💀';
    document.getElementById('finalTime').textContent = formatTime(timeSurvived);
    document.getElementById('finalCoins').textContent = coins;
    document.getElementById('finalKeys').textContent = keys;
    document.getElementById('finalDistance').textContent = Math.floor(distance);
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function victory() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('mazeHighScore', highScore);
    }
    document.getElementById('overlayTitle').textContent = '🎉 VITÓRIA! 🎉';
    document.getElementById('finalTime').textContent = formatTime(timeSurvived);
    document.getElementById('finalCoins').textContent = coins;
    document.getElementById('finalKeys').textContent = keys;
    document.getElementById('finalDistance').textContent = Math.floor(distance);
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function restartGame() {
    gameRunning = true;
    gameWin = false;
    health = 3;
    invincibleTimer = 0;
    score = 0;
    coins = 0;
    keys = 0;
    distance = 0;
    timeSurvived = 0;
    freezeTimer = 0;
    speedTimer = 0;
    revealTimer = 0;
    timeUntilChange = changeInterval;
    moveCooldown = 0;
    
    player = { x: 1, y: 1 };
    exit = { x: MAZE_SIZE - 2, y: MAZE_SIZE - 2 };
    
    maze = generateMaze();
    generateItems();
    spawnEnemies();
    
    healthBarFill.style.width = '100%';
    document.getElementById('gameOverlay').classList.add('hidden');
    updateUI();
}

// ==================== CONTROLES ====================
function updateEnemies(deltaTime) {
    for (let enemy of enemies) {
        enemy.update(deltaTime, player, maze);
    }
    
    if (enemies.length < 5 && Math.random() < 0.003) {
        spawnEnemies();
    }
}

// ==================== LOOP PRINCIPAL ====================
let lastTimestamp = 0;

function gameLoop(timestamp) {
    let deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
    if (deltaTime < 0.01) deltaTime = 0.016;
    
    if (gameRunning && !gameWin) {
        updateTimers(deltaTime);
        updateEnemies(deltaTime);
        checkEnemyCollision();
    }
    
    drawMaze();
    drawItems();
    drawEnemies();
    drawExit();
    drawPlayer();
    drawMinimap();
    
    if (revealTimer > 0) {
        ctx.fillStyle = '#00ffcc22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    lastTimestamp = timestamp;
    requestAnimationFrame(gameLoop);
}

// ==================== INICIALIZAÇÃO ====================
function init() {
    maze = generateMaze();
    generateItems();
    spawnEnemies();
    
    // Inicializar áudio
    canvas.addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    });
    
    // Controles de teclado
    document.addEventListener('keydown', (e) => {
        const key = e.key;
        
        if (key === 'ArrowUp' || key === 'w' || key === 'W') movePlayer(-1, 0);
        if (key === 'ArrowDown' || key === 's' || key === 'S') movePlayer(1, 0);
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') movePlayer(0, -1);
        if (key === 'ArrowRight' || key === 'd' || key === 'D') movePlayer(0, 1);
        if (key === 'x' || key === 'X' || key === ' ') attackEnemies();
        e.preventDefault();
    });
    
    // Controles mobile
    document.getElementById('btnUp').addEventListener('click', () => movePlayer(-1, 0));
    document.getElementById('btnDown').addEventListener('click', () => movePlayer(1, 0));
    document.getElementById('btnLeft').addEventListener('click', () => movePlayer(0, -1));
    document.getElementById('btnRight').addEventListener('click', () => movePlayer(0, 1));
    
    // Power-ups
    document.getElementById('powerupReveal').addEventListener('click', useRevealMap);
    document.getElementById('powerupFreeze').addEventListener('click', useFreezeMaze);
    document.getElementById('powerupSpeed').addEventListener('click', useSpeedBoost);
    document.getElementById('powerupStun').addEventListener('click', useStunEnemies);
    document.getElementById('restartButton').addEventListener('click', restartGame);
    
    // Mostrar controles mobile em dispositivos touch
    if ('ontouchstart' in window) {
        document.getElementById('mobileControls').style.display = 'flex';
    }
    
    updateUI();
    gameLoop(0);
    
    console.log("Jogo iniciado! Use WASD ou setas para mover. Posição inicial:", player);
}

init();
