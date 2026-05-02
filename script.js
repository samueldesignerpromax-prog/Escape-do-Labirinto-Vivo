/**
 * Escape do Labirinto Vivo - Maze Evolution Game
 * Labirinto procedural que muda dinamicamente a cada X segundos
 * 
 * Controles: WASD ou Setas para mover
 * Mecânica: Encontre a saída antes que o labirinto mude!
 */

// ==================== CONFIGURAÇÕES ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAZE_SIZE = 21; // Tamanho ímpar para paredes e caminhos
const CELL_SIZE = Math.min(28, Math.floor(canvas.width / MAZE_SIZE));
canvas.width = MAZE_SIZE * CELL_SIZE;
canvas.height = MAZE_SIZE * CELL_SIZE;

const MINIMAP_SIZE = 5; // Tamanho do minimapa

// ==================== ESTADO DO JOGO ====================
let gameRunning = true;
let gameWin = false;
let score = 0;
let coins = 0;
let keys = 0;
let distance = 0;
let timeSurvived = 0;
let highScore = localStorage.getItem('mazeHighScore') || 0;

// Sistema de tempo
let timeUntilChange = 5.0;
let changeInterval = 5.0;
let freezeTimer = 0;
let speedTimer = 0;
let revealTimer = 0;

// Velocidade do jogador
let playerSpeed = 3;
let baseSpeed = 3;

// Estrutura do labirinto
let maze = [];
let player = { x: 1, y: 1 };
let exit = { x: MAZE_SIZE - 2, y: MAZE_SIZE - 2 };
let items = []; // Moedas e chaves
let traps = []; // Armadilhas

// Cores
const WALL_COLOR = '#1a1a2e';
const PATH_COLOR = '#0a0a1a';
const PLAYER_COLOR = '#00ffcc';
const EXIT_COLOR = '#00ff44';
const COIN_COLOR = '#ffcc00';
const KEY_COLOR = '#ff6600';
const TRAP_COLOR = '#ff3366';

// ==================== GERADOR DE LABIRINTO (DFS) ====================
function generateMaze() {
    // Inicializar matriz com paredes
    const newMaze = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(1));
    
    // Função para verificar se uma célula é válida
    function isValid(x, y) {
        return x > 0 && x < MAZE_SIZE - 1 && y > 0 && y < MAZE_SIZE - 1;
    }
    
    // DFS para criar caminhos
    function carve(x, y) {
        const directions = [
            [0, -2], [0, 2], [-2, 0], [2, 0]
        ];
        
        // Embaralhar direções
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (isValid(nx, ny) && newMaze[nx][ny] === 1) {
                newMaze[nx][ny] = 0;
                newMaze[x + dx/2][y + dy/2] = 0;
                carve(nx, ny);
            }
        }
    }
    
    // Ponto de partida
    newMaze[1][1] = 0;
    carve(1, 1);
    
    // Garantir que a saída seja acessível
    newMaze[MAZE_SIZE - 2][MAZE_SIZE - 2] = 0;
    
    return newMaze;
}

// ==================== GARANTIR CAMINHO PARA SAÍDA (BFS) ====================
function ensurePathToExit(maze, start, target) {
    const queue = [{ x: start.x, y: start.y }];
    const visited = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(false));
    const parent = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(null));
    
    visited[start.x][start.y] = true;
    
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    while (queue.length > 0) {
        const { x, y } = queue.shift();
        
        if (x === target.x && y === target.y) {
            // Reconstruir caminho e abrir paredes se necessário
            let curr = { x, y };
            while (parent[curr.x][curr.y]) {
                const prev = parent[curr.x][curr.y];
                if (maze[curr.x][curr.y] === 1) {
                    maze[curr.x][curr.y] = 0;
                }
                curr = prev;
            }
            return true;
        }
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < MAZE_SIZE && ny >= 0 && ny < MAZE_SIZE && 
                !visited[nx][ny] && maze[nx][ny] !== 1) {
                visited[nx][ny] = true;
                parent[nx][ny] = { x, y };
                queue.push({ x: nx, y: ny });
            }
        }
    }
    
    // Se não encontrou caminho, abrir caminho direto
    if (Math.random() > 0.5) {
        maze[target.x][target.y] = 0;
    }
    return false;
}

// ==================== GERAR ITENS ====================
function generateItems() {
    items = [];
    const numCoins = Math.floor(Math.random() * 8) + 5;
    const numKeys = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numCoins; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * MAZE_SIZE);
            y = Math.floor(Math.random() * MAZE_SIZE);
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) || (x === exit.x && y === exit.y));
        
        items.push({ x, y, type: 'coin' });
    }
    
    for (let i = 0; i < numKeys; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * MAZE_SIZE);
            y = Math.floor(Math.random() * MAZE_SIZE);
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) || (x === exit.x && y === exit.y));
        
        items.push({ x, y, type: 'key' });
    }
}

// ==================== GERAR ARMADILHAS ====================
function generateTraps() {
    traps = [];
    const numTraps = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numTraps; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * MAZE_SIZE);
            y = Math.floor(Math.random() * MAZE_SIZE);
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) || 
                (x === exit.x && y === exit.y) || items.some(item => item.x === x && item.y === y));
        
        traps.push({ x, y, active: true });
    }
}

// ==================== MUDAR LABIRINTO DINAMICAMENTE ====================
function mutateMaze() {
    if (freezeTimer > 0) return;
    
    // Efeito visual de flash
    const flash = document.getElementById('mazeFlash');
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 150);
    
    // Guardar posição atual do jogador
    const oldPlayerPos = { x: player.x, y: player.y };
    const oldExitPos = { x: exit.x, y: exit.y };
    
    // Aplicar mutações controladas (não pode bloquear o jogador ou saída)
    const numMutations = Math.floor(Math.random() * 8) + 3;
    
    for (let i = 0; i < numMutations; i++) {
        const x = Math.floor(Math.random() * MAZE_SIZE);
        const y = Math.floor(Math.random() * MAZE_SIZE);
        
        // Não mutar células do jogador ou saída
        if ((x === oldPlayerPos.x && y === oldPlayerPos.y) || 
            (x === oldExitPos.x && y === oldExitPos.y)) {
            continue;
        }
        
        // Inverter parede/caminho
        if (maze[x][y] === 1) {
            maze[x][y] = 0;
        } else if (maze[x][y] === 0) {
            // Verificar se fechar este caminho não isola o jogador ou saída
            maze[x][y] = 1;
            
            // Testar se ainda há caminho
            const testMaze = maze.map(row => [...row]);
            testMaze[x][y] = 1;
            
            if (!hasPath(testMaze, oldPlayerPos, oldExitPos)) {
                maze[x][y] = 0; // Reverter se isolar
            }
        }
    }
    
    // Regenerar itens e armadilhas
    generateItems();
    generateTraps();
    
    // Atualizar UI
    updateUI();
}

// Verificar se existe caminho entre dois pontos
function hasPath(maze, start, target) {
    const queue = [start];
    const visited = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(false));
    visited[start.x][start.y] = true;
    
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    while (queue.length > 0) {
        const { x, y } = queue.shift();
        
        if (x === target.x && y === target.y) return true;
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < MAZE_SIZE && ny >= 0 && ny < MAZE_SIZE &&
                !visited[nx][ny] && maze[nx][ny] !== 1) {
                visited[nx][ny] = true;
                queue.push({ x: nx, y: ny });
            }
        }
    }
    
    return false;
}

// ==================== SISTEMA DE MOVIMENTO ====================
function movePlayer(dx, dy) {
    if (!gameRunning || gameWin) return false;
    
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    // Verificar colisão com paredes
    if (newX < 0 || newX >= MAZE_SIZE || newY < 0 || newY >= MAZE_SIZE) return false;
    if (maze[newX][newY] === 1) return false;
    
    // Atualizar distância percorrida
    distance += Math.abs(dx) + Math.abs(dy);
    score = Math.floor(timeSurvived * 10) + coins * 5 + keys * 20;
    
    // Mover jogador
    player.x = newX;
    player.y = newY;
    
    // Verificar itens
    const itemIndex = items.findIndex(item => item.x === player.x && item.y === player.y);
    if (itemIndex !== -1) {
        const item = items[itemIndex];
        if (item.type === 'coin') {
            coins++;
            playCoinSound();
        } else if (item.type === 'key') {
            keys++;
            playKeySound();
        }
        items.splice(itemIndex, 1);
        updateUI();
    }
    
    // Verificar armadilhas
    const trap = traps.find(t => t.x === player.x && t.y === player.y && t.active);
    if (trap) {
        trap.active = false;
        timeSurvived = Math.max(0, timeSurvived - 5);
        playTrapSound();
        updateUI();
    }
    
    // Verificar saída (precisa de chave se houver portas)
    if (player.x === exit.x && player.y === exit.y) {
        gameWin = true;
        gameRunning = false;
        victory();
    }
    
    // Verificar velocidade power-up
    if (speedTimer > 0) {
        playerSpeed = baseSpeed * 1.5;
    } else {
        playerSpeed = baseSpeed;
    }
    
    updateUI();
    return true;
}

// ==================== POWER-UPS ====================
let revealMapActive = false;

function useRevealMap() {
    if (revealTimer > 0) return;
    if (score >= 50) {
        score -= 50;
        revealTimer = 3;
        updateUI();
        playPowerUpSound();
    }
}

function useFreezeMaze() {
    if (freezeTimer > 0) return;
    if (score >= 75) {
        score -= 75;
        freezeTimer = 5;
        updateUI();
        playPowerUpSound();
    }
}

function useSpeedBoost() {
    if (speedTimer > 0) return;
    if (score >= 40) {
        score -= 40;
        speedTimer = 4;
        updateUI();
        playPowerUpSound();
    }
}

// ==================== TIMERS ====================
function updateTimers(deltaTime) {
    if (!gameRunning || gameWin) return;
    
    // Atualizar tempo sobrevivido
    timeSurvived += deltaTime;
    
    // Atualizar timer de mudança do labirinto
    if (freezeTimer > 0) {
        freezeTimer -= deltaTime;
        document.getElementById('powerupStatus').innerHTML = `❄️ CONGELADO: ${freezeTimer.toFixed(1)}s`;
    } else {
        timeUntilChange -= deltaTime;
        document.getElementById('powerupStatus').innerHTML = '';
        
        if (timeUntilChange <= 0) {
            mutateMaze();
            timeUntilChange = changeInterval;
        }
    }
    
    // Atualizar outros timers
    if (speedTimer > 0) {
        speedTimer -= deltaTime;
        document.getElementById('powerupStatus').innerHTML += ` ⚡ VELOCIDADE: ${speedTimer.toFixed(1)}s`;
    }
    
    if (revealTimer > 0) {
        revealTimer -= deltaTime;
    }
    
    // Atualizar UI de timers
    document.getElementById('nextChangeValue').textContent = 
        freezeTimer > 0 ? 'CONGELADO' : `${timeUntilChange.toFixed(1)}s`;
    
    document.getElementById('timerValue').textContent = formatTime(timeSurvived);
}

// ==================== RENDERIZAÇÃO ====================
function drawMaze() {
    for (let i = 0; i < MAZE_SIZE; i++) {
        for (let j = 0; j < MAZE_SIZE; j++) {
            const x = j * CELL_SIZE;
            const y = i * CELL_SIZE;
            
            if (maze[i][j] === 1) {
                // Parede com gradiente
                const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#2a2a3e');
                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                
                // Textura de parede
                ctx.fillStyle = '#00ffcc11';
                ctx.fillRect(x + 2, y + 2, CELL_SIZE - 5, 2);
            } else {
                // Caminho com brilho
                ctx.fillStyle = PATH_COLOR;
                ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                
                // Efeito de grid
                ctx.strokeStyle = '#00ffcc11';
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
            // Moeda giratória
            const pulse = Math.sin(Date.now() * 0.008) * 0.2 + 0.8;
            ctx.fillStyle = COIN_COLOR;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.3 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.font = `${CELL_SIZE * 0.4}px Arial`;
            ctx.fillText('💰', x + CELL_SIZE * 0.25, y + CELL_SIZE * 0.7);
        } else if (item.type === 'key') {
            ctx.fillStyle = KEY_COLOR;
            ctx.beginPath();
            ctx.rect(x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.4, CELL_SIZE * 0.4, CELL_SIZE * 0.2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE * 0.7, y + CELL_SIZE * 0.5, CELL_SIZE * 0.12, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawTraps() {
    for (const trap of traps) {
        if (!trap.active) continue;
        
        const x = trap.y * CELL_SIZE;
        const y = trap.x * CELL_SIZE;
        
        ctx.fillStyle = TRAP_COLOR;
        ctx.beginPath();
        ctx.ellipse(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.25, CELL_SIZE * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff6666';
        ctx.font = `${CELL_SIZE * 0.35}px Arial`;
        ctx.fillText('⚠️', x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.7);
    }
}

function drawPlayer() {
    const x = player.y * CELL_SIZE;
    const y = player.x * CELL_SIZE;
    
    // Brilho do jogador
    ctx.shadowBlur = 10;
    ctx.shadowColor = PLAYER_COLOR;
    
    // Corpo
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // Olhos (direção)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.35, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.35, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

function drawExit() {
    const x = exit.y * CELL_SIZE;
    const y = exit.x * CELL_SIZE;
    
    // Portal de saída pulsante
    const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
    ctx.fillStyle = EXIT_COLOR;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.4 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    ctx.fillStyle = 'white';
    ctx.font = `${CELL_SIZE * 0.45}px Arial`;
    ctx.fillText('🚪', x + CELL_SIZE * 0.25, y + CELL_SIZE * 0.75);
}

function drawMinimap() {
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');
    const minimapSize = 120;
    const cellSize = minimapSize / MAZE_SIZE;
    
    minimapCanvas.width = minimapSize;
    minimapCanvas.height = minimapSize;
    
    for (let i = 0; i < MAZE_SIZE; i++) {
        for (let j = 0; j < MAZE_SIZE; j++) {
            if (maze[i][j] === 1) {
                minimapCtx.fillStyle = '#333';
            } else {
                minimapCtx.fillStyle = '#0a0a1a';
            }
            minimapCtx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
    }
    
    // Jogador no minimapa
    minimapCtx.fillStyle = PLAYER_COLOR;
    minimapCtx.fillRect(player.y * cellSize, player.x * cellSize, cellSize, cellSize);
    
    // Saída no minimapa
    minimapCtx.fillStyle = EXIT_COLOR;
    minimapCtx.fillRect(exit.y * cellSize, exit.x * cellSize, cellSize, cellSize);
}

// ==================== UI E ESTADO ====================
function updateUI() {
    document.getElementById('distanceValue').textContent = Math.floor(distance);
    document.getElementById('coinsValue').textContent = coins;
    document.getElementById('keysValue').textContent = keys;
    document.getElementById('score').textContent = score;
    document.getElementById('highScoreValue').textContent = highScore;
    
    // Atualizar botões de power-up
    const revealBtn = document.getElementById('powerupReveal');
    const freezeBtn = document.getElementById('powerupFreeze');
    const speedBtn = document.getElementById('powerupSpeed');
    
    revealBtn.disabled = score < 50 || revealTimer > 0;
    freezeBtn.disabled = score < 75 || freezeTimer > 0;
    speedBtn.disabled = score < 40 || speedTimer > 0;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function victory() {
    const finalScore = Math.floor(timeSurvived * 10) + coins * 5 + keys * 20;
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem('mazeHighScore', highScore);
    }
    
    document.getElementById('finalTime').textContent = formatTime(timeSurvived);
    document.getElementById('finalCoins').textContent = coins;
    document.getElementById('finalDistance').textContent = Math.floor(distance);
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function restartGame() {
    gameRunning = true;
    gameWin = false;
    score = 0;
    coins = 0;
    keys = 0;
    distance = 0;
    timeSurvived = 0;
    freezeTimer = 0;
    speedTimer = 0;
    revealTimer = 0;
    timeUntilChange = changeInterval;
    playerSpeed = baseSpeed;
    
    player = { x: 1, y: 1 };
    exit = { x: MAZE_SIZE - 2, y: MAZE_SIZE - 2 };
    
    maze = generateMaze();
    ensurePathToExit(maze, player, exit);
    generateItems();
    generateTraps();
    
    document.getElementById('gameOverlay').classList.add('hidden');
    updateUI();
}

// ==================== SONS (Web Audio API) ====================
let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playCoinSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
        osc.stop(audioContext.currentTime + 0.1);
    } catch(e) {}
}

function playKeySound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 659;
        gain.gain.value = 0.12;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.15);
        osc.stop(audioContext.currentTime + 0.15);
    } catch(e) {}
}

function playTrapSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 220;
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
        osc.stop(audioContext.currentTime + 0.2);
    } catch(e) {}
}

function playPowerUpSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 1046;
        gain.gain.value = 0.1;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
        osc.stop(audioContext.currentTime + 0.2);
    } catch(e) {}
}

// ==================== CONTROLES ====================
const keysPressed = {};

document.addEventListener('keydown', (e) => {
    const key = e.key;
    keysPressed[key] = true;
    e.preventDefault();
    
    // Movimento baseado na tecla
    if (key === 'ArrowUp' || key === 'w' || key === 'W') movePlayer(-1, 0);
    if (key === 'ArrowDown' || key === 's' || key === 'S') movePlayer(1, 0);
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') movePlayer(0, -1);
    if (key === 'ArrowRight' || key === 'd' || key === 'D') movePlayer(0, 1);
});

document.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});

// Mobile Controls
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

if (btnUp) {
    btnUp.addEventListener('click', () => movePlayer(-1, 0));
    btnDown.addEventListener('click', () => movePlayer(1, 0));
    btnLeft.addEventListener('click', () => movePlayer(0, -1));
    btnRight.addEventListener('click', () => movePlayer(0, 1));
}

if ('ontouchstart' in window) {
    document.getElementById('mobileControls').classList.remove('hidden');
}

// Power-up buttons
document.getElementById('powerupReveal').addEventListener('click', useRevealMap);
document.getElementById('powerupFreeze').addEventListener('click', useFreezeMaze);
document.getElementById('powerupSpeed').addEventListener('click', useSpeedBoost);
document.getElementById('restartButton').addEventListener('click', () => {
    initAudio();
    restartGame();
});

// ==================== LOOP PRINCIPAL ====================
let lastTimestamp = 0;

function gameLoop(timestamp) {
    const deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
    
    if (gameRunning && !gameWin) {
        updateTimers(deltaTime);
    }
    
    drawMaze();
    drawItems();
    drawTraps();
    drawExit();
    drawPlayer();
    drawMinimap();
    
    // Efeito de revelar mapa (se ativo)
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
    ensurePathToExit(maze, player, exit);
    generateItems();
    generateTraps();
    gameLoop(0);
}

canvas.addEventListener('click', () => {
    initAudio();
});

init();

// Prevenir scroll
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'w' || e.key === 'W' || e.key === 's' || e.key === 'S' ||
        e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
    }
});
