/**
 * Escape do Labirinto Vivo - Com Inimigos Perseguidores!
 * 
 * Mecânicas:
 * - Labirinto procedural que muda a cada 5 segundos
 * - Inimigos que perseguem o jogador
 * - Sistema de vida (3 hits = game over)
 * - Power-ups para ajudar na fuga
 * - Otimizado para não travar
 */

// ==================== CONFIGURAÇÕES ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAZE_SIZE = 21;
const CELL_SIZE = Math.min(28, Math.floor(canvas.width / MAZE_SIZE));
canvas.width = MAZE_SIZE * CELL_SIZE;
canvas.height = MAZE_SIZE * CELL_SIZE;

// ==================== ESTADO DO JOGO ====================
let gameRunning = true;
let gameWin = false;
let score = 0;
let coins = 0;
let keys = 0;
let distance = 0;
let timeSurvived = 0;
let highScore = localStorage.getItem('mazeHighScore') || 0;
let enemiesDefeated = 0;

// Sistema de vida
let health = 3;
let invincibleTimer = 0;

// Sistema de tempo
let timeUntilChange = 5.0;
let changeInterval = 5.0;
let freezeTimer = 0;
let speedTimer = 0;
let revealTimer = 0;
let stunTimer = 0;

// Velocidade
let playerSpeed = 3;
let baseSpeed = 3;

// Estrutura do labirinto
let maze = [];
let player = { x: 1, y: 1 };
let exit = { x: MAZE_SIZE - 2, y: MAZE_SIZE - 2 };
let items = [];
let traps = [];

// ==================== CLASSE DO INIMIGO PERSEGUIDOR ====================
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 1;
        this.height = 1;
        this.speed = 2.5;
        this.stunned = false;
        this.stunTimer = 0;
        this.lastMoveTime = 0;
        this.color = '#ff3366';
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
        
        // A-star simplificado para perseguição (BFS a cada poucos frames)
        const now = Date.now();
        if (now - this.lastMoveTime > 150) {
            this.lastMoveTime = now;
            const path = this.findPathToPlayer(player, maze);
            if (path && path.length > 1) {
                const next = path[1];
                const dx = Math.sign(next.x - this.x);
                const dy = Math.sign(next.y - this.y);
                
                const newX = this.x + dx;
                const newY = this.y + dy;
                
                if (maze[newX] && maze[newX][newY] === 0) {
                    this.x = newX;
                    this.y = newY;
                }
            }
        }
    }
    
    findPathToPlayer(player, maze) {
        const queue = [{ x: this.x, y: this.y, path: [{ x: this.x, y: this.y }] }];
        const visited = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(false));
        visited[this.x][this.y] = true;
        
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.x === player.x && current.y === player.y) {
                return current.path;
            }
            
            for (const [dx, dy] of directions) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                
                if (nx >= 0 && nx < MAZE_SIZE && ny >= 0 && ny < MAZE_SIZE &&
                    !visited[nx][ny] && maze[nx][ny] === 0) {
                    visited[nx][ny] = true;
                    queue.push({
                        x: nx,
                        y: ny,
                        path: [...current.path, { x: nx, y: ny }]
                    });
                }
            }
        }
        return null;
    }
    
    stun() {
        this.stunned = true;
        this.stunTimer = 2.0;
    }
    
    draw() {
        const x = this.y * CELL_SIZE;
        const y = this.x * CELL_SIZE;
        
        ctx.save();
        
        if (this.stunned) {
            ctx.fillStyle = '#8888ff';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#8888ff';
        } else if (freezeTimer > 0) {
            ctx.fillStyle = '#66ccff';
            ctx.shadowBlur = 3;
            ctx.shadowColor = '#66ccff';
        } else {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ff3366';
            ctx.animation = 'enemyPulse 0.5s infinite';
        }
        
        // Corpo do inimigo
        ctx.beginPath();
        ctx.ellipse(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.35, CELL_SIZE * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Olhos (olhando para o jogador)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.35, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.35, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.33, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.33, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Sobrancelhas (expressão de raiva)
        ctx.beginPath();
        ctx.moveTo(x + CELL_SIZE * 0.25, y + CELL_SIZE * 0.22);
        ctx.lineTo(x + CELL_SIZE * 0.45, y + CELL_SIZE * 0.25);
        ctx.lineTo(x + CELL_SIZE * 0.4, y + CELL_SIZE * 0.2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(x + CELL_SIZE * 0.75, y + CELL_SIZE * 0.22);
        ctx.lineTo(x + CELL_SIZE * 0.55, y + CELL_SIZE * 0.25);
        ctx.lineTo(x + CELL_SIZE * 0.6, y + CELL_SIZE * 0.2);
        ctx.fill();
        
        ctx.restore();
    }
}

let enemies = [];

// ==================== GERADOR DE LABIRINTO ====================
function generateMaze() {
    const newMaze = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(1));
    
    function isValid(x, y) {
        return x > 0 && x < MAZE_SIZE - 1 && y > 0 && y < MAZE_SIZE - 1;
    }
    
    function carve(x, y) {
        const directions = [[0, -2], [0, 2], [-2, 0], [2, 0]];
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
    
    newMaze[1][1] = 0;
    carve(1, 1);
    newMaze[MAZE_SIZE - 2][MAZE_SIZE - 2] = 0;
    
    return newMaze;
}

// ==================== INIMIGOS ====================
function spawnEnemies() {
    enemies = [];
    const numEnemies = Math.min(3 + Math.floor(timeSurvived / 30), 6);
    
    for (let i = 0; i < numEnemies; i++) {
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * MAZE_SIZE);
            y = Math.floor(Math.random() * MAZE_SIZE);
            attempts++;
            if (attempts > 100) break;
        } while (maze[x][y] !== 0 || 
                (x === player.x && y === player.y) || 
                (x === exit.x && y === exit.y) ||
                Math.abs(x - player.x) < 5);
        
        if (attempts <= 100) {
            enemies.push(new Enemy(x, y));
        }
    }
    
    document.getElementById('enemiesValue').textContent = enemies.length;
}

// ==================== GERAR ITENS ====================
function generateItems() {
    items = [];
    const numCoins = Math.floor(Math.random() * 10) + 8;
    const numKeys = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numCoins; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.floor(Math.random() * MAZE_SIZE);
            y = Math.floor(Math.random() * MAZE_SIZE);
            attempts++;
            if (attempts > 50) break;
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) || 
                (x === exit.x && y === exit.y) || items.some(item => item.x === x && item.y === y));
        
        if (attempts <= 50) items.push({ x, y, type: 'coin' });
    }
    
    for (let i = 0; i < numKeys; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.floor(Math.random() * MAZE_SIZE);
            y = Math.floor(Math.random() * MAZE_SIZE);
            attempts++;
            if (attempts > 50) break;
        } while (maze[x][y] !== 0 || (x === player.x && y === player.y) ||
                (x === exit.x && y === exit.y) || items.some(item => item.x === x && item.y === y));
        
        if (attempts <= 50) items.push({ x, y, type: 'key' });
    }
}

// ==================== MUTAÇÃO CONTROLADA ====================
function mutateMaze() {
    if (freezeTimer > 0) return;
    
    const flash = document.getElementById('mazeFlash');
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 150);
    
    const oldPlayerPos = { x: player.x, y: player.y };
    const oldExitPos = { x: exit.x, y: exit.y };
    
    const numMutations = Math.floor(Math.random() * 8) + 3;
    
    for (let i = 0; i < numMutations; i++) {
        const x = Math.floor(Math.random() * MAZE_SIZE);
        const y = Math.floor(Math.random() * MAZE_SIZE);
        
        if ((x === oldPlayerPos.x && y === oldPlayerPos.y) || 
            (x === oldExitPos.x && y === oldExitPos.y)) {
            continue;
        }
        
        if (maze[x][y] === 1) {
            maze[x][y] = 0;
        } else if (maze[x][y] === 0) {
            maze[x][y] = 1;
            const testMaze = maze.map(row => [...row]);
            testMaze[x][y] = 1;
            if (!hasPath(testMaze, oldPlayerPos, oldExitPos)) {
                maze[x][y] = 0;
            }
        }
    }
    
    generateItems();
    updateUI();
}

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

// ==================== MOVIMENTO ====================
function movePlayer(dx, dy) {
    if (!gameRunning || gameWin) return false;
    
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    if (newX < 0 || newX >= MAZE_SIZE || newY < 0 || newY >= MAZE_SIZE) return false;
    if (maze[newX][newY] === 1) return false;
    
    player.x = newX;
    player.y = newY;
    distance++;
    
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
        score = Math.floor(timeSurvived * 10) + coins * 5 + keys * 20;
        updateUI();
    }
    
    // Verificar saída
    if (player.x === exit.x && player.y === exit.y && keys > 0) {
        gameWin = true;
        gameRunning = false;
        victory();
    }
    
    // Velocidade power-up
    playerSpeed = (speedTimer > 0) ? baseSpeed * 1.5 : baseSpeed;
    
    updateUI();
    return true;
}

// ==================== COLISÃO COM INIMIGOS ====================
function checkEnemyCollision() {
    if (invincibleTimer > 0) return;
    
    for (const enemy of enemies) {
        if (enemy.x === player.x && enemy.y === player.y && !enemy.stunned) {
            health--;
            invincibleTimer = 1.0;
            updateUI();
            
            const healthFill = document.getElementById('healthBarFill');
            healthFill.style.width = `${(health / 3) * 100}%`;
            
            playHitSound();
            
            if (health <= 0) {
                gameRunning = false;
                gameOver();
            }
            
            // Efeito visual de dano
            canvas.style.animation = 'hitFlash 0.2s';
            setTimeout(() => { canvas.style.animation = ''; }, 200);
            break;
        }
    }
    
    if (invincibleTimer > 0) {
        invincibleTimer -= 0.016;
    }
}

// ==================== ATACAR INIMIGOS ====================
function attackEnemies() {
    if (!gameRunning || gameWin) return;
    
    let hit = false;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        // Verificar se inimigo está adjacente
        const isAdjacent = (Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y)) === 1;
        
        if (isAdjacent && !enemy.stunned) {
            enemy.stun();
            enemiesDefeated++;
            hit = true;
            playAttackSound();
            break;
        }
    }
    
    if (hit) {
        updateUI();
    }
}

// ==================== POWER-UPS ====================
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

function useStunEnemies() {
    if (stunTimer > 0) return;
    if (score >= 60) {
        score -= 60;
        for (const enemy of enemies) {
            enemy.stun();
        }
        stunTimer = 3;
        updateUI();
        playPowerUpSound();
    }
}

// ==================== TIMERS ====================
function updateTimers(deltaTime) {
    if (!gameRunning || gameWin) return;
    
    timeSurvived += deltaTime;
    score = Math.floor(timeSurvived * 10) + coins * 5 + keys * 20;
    
    if (freezeTimer > 0) {
        freezeTimer -= deltaTime;
        document.getElementById('powerupStatus').innerHTML = `❄️ CONGELADO: ${freezeTimer.toFixed(1)}s`;
        document.getElementById('nextChangeValue').textContent = 'CONGELADO';
    } else {
        timeUntilChange -= deltaTime;
        document.getElementById('powerupStatus').innerHTML = '';
        
        if (timeUntilChange <= 0) {
            mutateMaze();
            timeUntilChange = changeInterval;
        }
        document.getElementById('nextChangeValue').textContent = `${timeUntilChange.toFixed(1)}s`;
    }
    
    if (speedTimer > 0) {
        speedTimer -= deltaTime;
        document.getElementById('powerupStatus').innerHTML += ` ⚡ VELOCIDADE: ${speedTimer.toFixed(1)}s`;
    }
    
    if (revealTimer > 0) {
        revealTimer -= deltaTime;
    }
    
    if (stunTimer > 0) {
        stunTimer -= deltaTime;
    }
    
    document.getElementById('timerValue').textContent = formatTime(timeSurvived);
    document.getElementById('distanceValue').textContent = Math.floor(distance);
    document.getElementById('coinsValue').textContent = coins;
    document.getElementById('keysValue').textContent = keys;
    document.getElementById('score').textContent = Math.floor(score);
    document.getElementById('highScoreValue').textContent = highScore;
    document.getElementById('enemiesValue').textContent = enemies.length;
    
    // Atualizar botões
    const revealBtn = document.getElementById('powerupReveal');
    const freezeBtn = document.getElementById('powerupFreeze');
    const speedBtn = document.getElementById('powerupSpeed');
    const stunBtn = document.getElementById('powerupStun');
    
    revealBtn.disabled = score < 50 || revealTimer > 0;
    freezeBtn.disabled = score < 75 || freezeTimer > 0;
    speedBtn.disabled = score < 40 || speedTimer > 0;
    stunBtn.disabled = score < 60;
}

// ==================== ATUALIZAR INIMIGOS ====================
let lastEnemyUpdate = 0;

function updateEnemies(deltaTime) {
    for (const enemy of enemies) {
        enemy.update(deltaTime, player, maze);
    }
    
    // Spawn de novos inimigos periodicamente
    if (enemies.length < 5 && Math.random() < 0.005) {
        spawnEnemies();
    }
}

// ==================== RENDERIZAÇÃO ====================
function drawMaze() {
    for (let i = 0; i < MAZE_SIZE; i++) {
        for (let j = 0; j < MAZE_SIZE; j++) {
            const x = j * CELL_SIZE;
            const y = i * CELL_SIZE;
            
            if (maze[i][j] === 1) {
                const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#2a2a3e');
                ctx.fillStyle = gradient;
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
            const pulse = Math.sin(Date.now() * 0.008) * 0.2 + 0.8;
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.25 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.font = `${CELL_SIZE * 0.4}px Arial`;
            ctx.fillText('💰', x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.7);
        } else if (item.type === 'key') {
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.rect(x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.4, CELL_SIZE * 0.4, CELL_SIZE * 0.2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE * 0.7, y + CELL_SIZE * 0.5, CELL_SIZE * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawPlayer() {
    const x = player.y * CELL_SIZE;
    const y = player.x * CELL_SIZE;
    
    ctx.save();
    
    if (invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffcc';
    
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.ellipse(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.35, CELL_SIZE * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Faixa de ninja
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(x + CELL_SIZE * 0.2, y + CELL_SIZE * 0.3, CELL_SIZE * 0.6, 4);
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.33, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + CELL_SIZE * 0.65, y + CELL_SIZE * 0.33, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawExit() {
    const x = exit.y * CELL_SIZE;
    const y = exit.x * CELL_SIZE;
    const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
    
    if (keys > 0) {
        ctx.fillStyle = '#00ff44';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.4 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'white';
        ctx.font = `${CELL_SIZE * 0.45}px Arial`;
        ctx.fillText('🚪', x + CELL_SIZE * 0.3, y + CELL_SIZE * 0.7);
    } else {
        ctx.fillStyle = '#ff6600';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffcc00';
        ctx.font = `${CELL_SIZE * 0.35}px Arial`;
        ctx.fillText('🔒', x + CELL_SIZE * 0.35, y + CELL_SIZE * 0.7);
    }
}

function drawEnemies() {
    for (const enemy of enemies) {
        enemy.draw();
    }
}

function drawMinimap() {
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');
    const size = 140;
    const cellSize = size / MAZE_SIZE;
    
    minimapCanvas.width = size;
    minimapCanvas.height = size;
    
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
    
    // Inimigos
    for (const enemy of enemies) {
        minimapCtx.fillStyle = '#ff3366';
        minimapCtx.fillRect(enemy.y * cellSize, enemy.x * cellSize, cellSize, cellSize);
    }
    
    // Jogador
    minimapCtx.fillStyle = '#00ffcc';
    minimapCtx.fillRect(player.y * cellSize, player.x * cellSize, cellSize, cellSize);
    
    // Saída
    minimapCtx.fillStyle = '#00ff44';
    minimapCtx.fillRect(exit.y * cellSize, exit.x * cellSize, cellSize, cellSize);
}

// ==================== UI E ESTADO ====================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateUI() {
    document.getElementById('score').textContent = Math.floor(score);
    document.getElementById('coinsValue').textContent = coins;
    document.getElementById('keysValue').textContent = keys;
    document.getElementById('distanceValue').textContent = Math.floor(distance);
    document.getElementById('enemiesValue').textContent = enemies.length;
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('mazeHighScore', highScore);
        document.getElementById('highScoreValue').textContent = highScore;
    }
}

function gameOver() {
    gameRunning = false;
    playGameOverSound();
    document.getElementById('overlayTitle').textContent = '💀 GAME OVER 💀';
    document.getElementById('overlayMessage').textContent = 'Você foi capturado pelos perseguidores!';
    document.getElementById('finalTime').textContent = formatTime(timeSurvived);
    document.getElementById('finalCoins').textContent = coins;
    document.getElementById('finalKeys').textContent = keys;
    document.getElementById('finalDistance').textContent = Math.floor(distance);
    document.getElementById('finalDefeated').textContent = enemiesDefeated;
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function victory() {
    gameRunning = false;
    gameWin = true;
    const finalScore = Math.floor(timeSurvived * 10) + coins * 5 + keys * 20;
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem('mazeHighScore', highScore);
    }
    playVictorySound();
    document.getElementById('overlayTitle').textContent = '🎉 VITÓRIA! 🎉';
    document.getElementById('overlayMessage').textContent = 'Você escapou do labirinto vivo!';
    document.getElementById('finalTime').textContent = formatTime(timeSurvived);
    document.getElementById('finalCoins').textContent = coins;
    document.getElementById('finalKeys').textContent = keys;
    document.getElementById('finalDistance').textContent = Math.floor(distance);
    document.getElementById('finalDefeated').textContent = enemiesDefeated;
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
    enemiesDefeated = 0;
    freezeTimer = 0;
    speedTimer = 0;
    revealTimer = 0;
    stunTimer = 0;
    timeUntilChange = changeInterval;
    playerSpeed = baseSpeed;
    
    player = { x: 1, y: 1 };
    exit = { x: MAZE_SIZE - 2, y: MAZE_SIZE - 2 };
    
    maze = generateMaze();
    generateItems();
    spawnEnemies();
    
    document.getElementById('healthBarFill').style.width = '100%';
    document.getElementById('gameOverlay').classList.add('hidden');
    updateUI();
}

// ==================== SONS ====================
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
        gain.gain.value = 0.08;
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
        gain.gain.value = 0.1;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.15);
        osc.stop(audioContext.currentTime + 0.15);
    } catch(e) {}
}

function playHitSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 220;
        gain.gain.value = 0.12;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
        osc.stop(audioContext.currentTime + 0.2);
    } catch(e) {}
}

function playAttackSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.1;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
        osc.stop(audioContext.currentTime + 0.1);
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

function playVictorySound() {
    if (!audioContext) return;
    try {
        const notes = [523, 659, 784, 1046];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.frequency.value = freq;
                gain.gain.value = 0.1;
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
                osc.stop(audioContext.currentTime + 0.3);
            }, i * 150);
        });
    } catch(e) {}
}

function playGameOverSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 150;
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
        osc.stop(audioContext.currentTime + 0.5);
    } catch(e) {}
}

// ==================== CONTROLES ====================
const keysPressed = {};

document.addEventListener('keydown', (e) => {
    const key = e.key;
    keysPressed[key] = true;
    e.preventDefault();
    
    let moved = false;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') moved = movePlayer(-1, 0);
    if (key === 'ArrowDown' || key === 's' || key === 'S') moved = movePlayer(1, 0);
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') moved = movePlayer(0, -1);
    if (key === 'ArrowRight' || key === 'd' || key === 'D') moved = movePlayer(0, 1);
    if (key === ' ' || key === 'x' || key === 'X') attackEnemies();
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
document.getElementById('powerupStun').addEventListener('click', useStunEnemies);
document.getElementById('restartButton').addEventListener('click', () => {
    initAudio();
    restartGame();
});

// ==================== LOOP PRINCIPAL ====================
let lastTimestamp = 0;
let lastFrameTime = 0;
const targetFPS = 60;
const frameDelay = 1000 / targetFPS;

function gameLoop(timestamp) {
    let deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
    if (deltaTime > 0.1) deltaTime = 0.016;
    
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
    gameLoop(0);
}

canvas.addEventListener('click', () => {
    initAudio();
});

init();

// Prevenir scroll
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D', 'x', 'X'];
    if (keys.includes(e.key)) {
        e.preventDefault();
    }
});
