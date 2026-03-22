// ============================================================
//  حروف أحمد - Two Team Hex Game
// ============================================================

const GRID_ROWS = 5;
const GRID_COLS = 5;

// 25 Arabic letters (removed ث, ذ, ظ for balanced 5x5 grid)
const LETTERS = [
    'ا','ب','ت','ج','ح',
    'خ','د','ر','ز','س',
    'ش','ص','ض','ط','ع',
    'غ','ف','ق','ك','ل',
    'م','ن','ه','و','ي'
];

// ============================================================
//  QUESTION BANK (Loaded externally from questions.js)
// ============================================================
// The questionBank object is now instantiated in questions.js
// This prevents CORS issues when opening the game locally.
const _questionBankLoaded = true; // marker


// ============================================================
//  HOST PHRASES
// ============================================================
const hostPhrases = {
    correct: [
        'يا سلام عليك! إجابة صحيحة! 🔥', 'يا وحش! ما شاء الله عليك! 💪',
        'إجابة صحيحة يا بطل! 🌟', 'برافو! يا سلام! 👏', 'عطنا عطنا! إجابة صح! 🎯',
    ],
    wrong: [
        'أووف! إجابة خاطئة! بس روح الرياضية! 😅', 'لا يا حبيبي! غلط! 😬',
        'أووه! ما توقعت! للمتعة! 😄', 'غلط! الدور ينتقل! 🔄',
    ],
    turnSwitch: [
        'يلا دور الفريق الثاني! اختاروا حرف! 🔷',
        'الدور انتقل! يلا يا أبطال! 💪',
    ],
    win: [
        'مبروووك! وصلتوا الطرفين! 🏆🎉 ما شاء الله!',
        'يا سلاااام! فوز مستحق! بطولة والله! 🏆✨',
    ],
};

// ============================================================
//  GAME STATE
// ============================================================
let state = {
    greenName: '', orangeName: '',
    currentTeam: 'green', // 'green' or 'orange'
    board: [],  // 25 cells: null | 'green' | 'orange'
    fazaa: { green: false, orange: false }, // true = used
    fazaaActive: false, selectedCategory: null,
    currentHexIndex: null, currentQuestion: null,
    usedQuestions: {}, gameActive: false,
};

// ============================================================
//  MULTIPLAYER STATE
// ============================================================
let mpSocket = null;
let mpPlayers = [];
let mpBuzzerPhase = 0; // 0=none, 1=first buzz, 2=other team, 3=free-for-all
let mpBuzzedPlayerName = null;
let mpBuzzedPlayerTeam = null;
let mpFirstBuzzTeam = null;
let mpJoinLink = '';

// ============================================================
//  DOM REFERENCES
// ============================================================
const $ = id => document.getElementById(id);
const setupScreen    = $('setup-screen');
const gameScreen     = $('game-screen');
const resultScreen   = $('result-screen');
const hexGrid        = $('hex-grid');
const hostText       = $('host-text');
const hostBubble     = $('host-bubble');
const greenPanel     = $('green-panel');
const orangePanel    = $('orange-panel');
const greenTeamName  = $('green-team-name');
const orangeTeamName = $('orange-team-name');
const turnDot        = $('turn-dot');
const turnLabel      = $('turn-label');
const greenFazaaBtn  = $('green-fazaa-btn');
const orangeFazaaBtn = $('orange-fazaa-btn');
const questionModal  = $('question-modal');
const fazaaModal     = $('fazaa-modal');
const modalLetter    = $('modal-letter');
const modalCategory  = $('modal-category');
const modalTeamBadge = $('modal-team-badge');
const questionText   = $('question-text');
const answerRevealArea = $('answer-reveal-area');
const showAnswerBtn    = $('show-answer-btn');
const answerContent    = $('answer-content');
const actualAnswer     = $('actual-answer');
const btnAwardGreen    = $('btn-award-green');
const btnAwardOrange   = $('btn-award-orange');
const btnChangeQ       = $('btn-change-q');
const questionTimerEl  = $('question-timer');
const resultIcon     = $('result-icon');
const resultTitle    = $('result-title');
const resultText     = $('result-text');
const roundBadge     = $('round-badge');
const matchScoreGreen= $('green-score');
const matchScoreOrange=$('orange-score');
const roundResultModal=$('round-result-modal');
const roundResultTitle=$('round-result-title');
const roundResultText= $('round-result-text');
const roundGreenScore=$('round-green-score');
const roundOrangeScore=$('round-orange-score');
const nextRoundBtn   = $('next-round-btn');

let questionTimerInterval = null;
let questionTimeLeft = 30;
let questionPassed = false;
let originalTeam = null;

// Buzzer info UI
const buzzerInfo = $('buzzer-info');
const buzzerInfoBadge = $('buzzer-info-badge');

// ============================================================
//  MULTIPLAYER INIT
// ============================================================
function initMultiplayer() {
    try {
        mpSocket = io();
    } catch (e) {
        console.warn('Socket.IO not available - running without multiplayer');
        return;
    }

    mpSocket.on('room-created', (roomId) => {
        const display = $('room-code-display');
        const actionsContainer = $('room-actions-container');
        if (display) {
            display.textContent = roomId;
            display.style.display = 'block';
        }
        if (actionsContainer) actionsContainer.style.display = 'none';
        
        mpJoinLink = `${window.location.origin}/join.html?room=${roomId}`;
        const copyBtn = $('btn-copy-link');
        if (copyBtn) copyBtn.style.display = 'inline-block';
    });

    // Handle host disconnection (e.g. if another host takes over?)
    mpSocket.on('host-disconnected', () => {
        mpPlayers = [];
        updateMpPlayerList();
    });

    // Player list updates
    mpSocket.on('player-list', (players) => {
        if (players.length > mpPlayers.length) {
            try { SFX.playerJoin(); } catch(e) {}
        }
        mpPlayers = players;
        updateMpPlayerList();
    });

    // Buzzer result from server
    mpSocket.on('buzzer-result', (data) => {
        // data: { playerName, playerTeam, phase, timeLimit }
        mpBuzzedPlayerName = data.playerName;
        mpBuzzedPlayerTeam = data.playerTeam;
        mpBuzzerPhase = data.phase;
        if (data.phase === 1) mpFirstBuzzTeam = data.playerTeam;

        try { SFX.buzzer(); } catch(e) {}

        showBuzzerInfo(`🔔 ${data.playerName} ضغط أولاً! (${data.timeLimit} ثوانٍ)`, data.playerTeam);

        // Update modal team badge to the buzzed player's team
        const teamName = data.playerTeam === 'green' ? state.greenName : state.orangeName;
        modalTeamBadge.textContent = `${data.playerName} - ${teamName}`;
        modalTeamBadge.className = 'modal-team-badge ' + (data.playerTeam === 'green' ? 'green-badge' : 'orange-badge');

        state.currentTeam = data.playerTeam;
        updateTurnUI();

        // Restart timer with buzzer time limit
        clearInterval(questionTimerInterval);
        questionTimeLeft = data.timeLimit;
        questionTimerEl.textContent = questionTimeLeft;
        questionTimerInterval = setInterval(() => {
            questionTimeLeft--;
            questionTimerEl.textContent = questionTimeLeft;
            if (questionTimeLeft <= 0) {
                clearInterval(questionTimerInterval);
                handleBuzzerTimeout();
            }
        }, 1000);
    });

    // Phase change
    mpSocket.on('phase-change', (data) => {
        mpBuzzerPhase = data.phase;
        try { SFX.phaseChange(); } catch(e) {}
        if (data.phase === 2) {
            const teamName = data.team === 'green' ? state.greenName : state.orangeName;
            showBuzzerInfo(`⏳ الفرصة لـ${teamName} (${data.timeLimit} ثوانٍ)`, data.team);

            modalTeamBadge.textContent = teamName;
            modalTeamBadge.className = 'modal-team-badge ' + (data.team === 'green' ? 'green-badge' : 'orange-badge');

            state.currentTeam = data.team;
            updateTurnUI();

            // Timer
            clearInterval(questionTimerInterval);
            questionTimeLeft = data.timeLimit;
            questionTimerEl.textContent = questionTimeLeft;
            questionTimerInterval = setInterval(() => {
                questionTimeLeft--;
                questionTimerEl.textContent = questionTimeLeft;
                if (questionTimeLeft <= 0) {
                    clearInterval(questionTimerInterval);
                    handleBuzzerTimeout();
                }
            }, 1000);
        } else if (data.phase === 3) {
            showBuzzerInfo(`⚡ من يضغط أولاً! (${data.timeLimit} ثوانٍ)`, null);
        }
    });
}

function updateMpPlayerList() {
    const greenList = $('mp-green-players');
    const orangeList = $('mp-orange-players');
    const countEl = $('mp-count');
    if (!greenList || !orangeList) return;

    greenList.innerHTML = '';
    orangeList.innerHTML = '';

    mpPlayers.forEach(p => {
        const div = document.createElement('div');
        div.className = 'mp-player-chip';
        div.textContent = p.name;
        if (p.team === 'green') greenList.appendChild(div);
        else orangeList.appendChild(div);
    });

    if (countEl) countEl.textContent = `اللاعبين: ${mpPlayers.length}/8`;
}

function copyJoinLink() {
    navigator.clipboard.writeText(mpJoinLink).then(() => {
        const btn = $('btn-copy-link');
        btn.textContent = '✅ تم النسخ!';
        setTimeout(() => { btn.textContent = '📋 نسخ الرابط (إختياري)'; }, 2000);
    });
}

function createRoom() {
    if (mpSocket) mpSocket.emit('create-room');
}

function showBuzzerInfo(text, team) {
    if (!buzzerInfo) return;
    buzzerInfo.style.display = 'block';
    buzzerInfoBadge.textContent = text;
    buzzerInfoBadge.className = 'buzzer-info-badge' + (team ? ` bi-${team}` : ' bi-neutral');
}

function hideBuzzerInfo() {
    if (buzzerInfo) buzzerInfo.style.display = 'none';
}

function handleBuzzerTimeout() {
    if (mpBuzzerPhase === 1) {
        // Wrong in phase 1 -> go to phase 2 (other team)
        try { SFX.wrong(); } catch(e) {}
        if (mpSocket) mpSocket.emit('answer-wrong-phase1');
        const otherTeam = mpFirstBuzzTeam === 'green' ? 'orange' : 'green';
        const otherName = otherTeam === 'green' ? state.greenName : state.orangeName;
        setHostText(`⏳ انتهى الوقت! الفرصة تنتقل لـ${otherName}!`, 'sad');
    } else if (mpBuzzerPhase === 2) {
        // Wrong in phase 2 -> go to phase 3 (free-for-all)
        try { SFX.wrong(); } catch(e) {}
        if (mpSocket) mpSocket.emit('answer-wrong-phase2');
        setHostText(`⚡ الفرصة الأخيرة! من يضغط أولاً!`, 'sad');
    } else if (mpBuzzerPhase === 3) {
        // Phase 3 timeout -> loop back to phase 3 (keep buzzer open)
        try { SFX.timeUp(); } catch(e) {}
        if (mpSocket) mpSocket.emit('answer-wrong-phase3');
        setHostText(`⚡ من يضغط أولاً! 3 ثوانٍ!`, 'sad');
    }
}

// ============================================================
//  GRID
// ============================================================
function buildGrid() {
    hexGrid.innerHTML = '';
    state.board = new Array(GRID_ROWS * GRID_COLS).fill(null);
    
    // Shuffle letters for random positions each round
    const shuffledLetters = shuffle([...LETTERS]);
    state.gridLetters = shuffledLetters; // store for question lookup
    
    let idx = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'hex-row' + (r % 2 === 1 ? ' offset' : '');

        for (let c = 0; c < GRID_COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'hex-cell';
            cell.dataset.index = idx;
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.innerHTML = `<span>${shuffledLetters[idx]}</span>`;
            cell.addEventListener('click', () => onHexClick(parseInt(cell.dataset.index)));
            rowDiv.appendChild(cell);
            idx++;
        }
        hexGrid.appendChild(rowDiv);
    }
}

// ============================================================
//  ADJACENCY
// ============================================================
function getNeighbors(index) {
    const row = Math.floor(index / GRID_COLS);
    const col = index % GRID_COLS;
    const neighbors = [];
    const isOddRow = row % 2 === 1;

    const directions = isOddRow
        ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
        : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];

    for (const [dr, dc] of directions) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
            neighbors.push(nr * GRID_COLS + nc);
        }
    }
    return neighbors;
}

// ============================================================
//  WIN DETECTION (BFS)
// ============================================================
function checkWin(team) {
    if (team === 'green') {
        // Green connects LEFT (col=0) to RIGHT (col=GRID_COLS-1)
        const startCells = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            const idx = r * GRID_COLS + 0;
            if (state.board[idx] === 'green') startCells.push(idx);
        }
        return bfsPath(startCells, 'green', idx => (idx % GRID_COLS) === GRID_COLS - 1);
    } else {
        // Orange connects TOP (row=0) to BOTTOM (row=GRID_ROWS-1)
        const startCells = [];
        for (let c = 0; c < GRID_COLS; c++) {
            if (state.board[c] === 'orange') startCells.push(c);
        }
        return bfsPath(startCells, 'orange', idx => Math.floor(idx / GRID_COLS) === GRID_ROWS - 1);
    }
}

function bfsPath(startCells, team, goalCheck) {
    if (startCells.length === 0) return null;
    const visited = new Set();
    const parent = {};
    const queue = [...startCells];
    startCells.forEach(c => { visited.add(c); parent[c] = null; });

    while (queue.length > 0) {
        const current = queue.shift();
        if (goalCheck(current)) {
            // Reconstruct path
            const path = [];
            let node = current;
            while (node !== null) { path.push(node); node = parent[node]; }
            return path;
        }
        for (const neighbor of getNeighbors(current)) {
            if (!visited.has(neighbor) && state.board[neighbor] === team) {
                visited.add(neighbor);
                parent[neighbor] = current;
                queue.push(neighbor);
            }
        }
    }
    return null;
}

// ============================================================
//  GAME FLOW
// ============================================================
function startGame() {
    const gName = $('green-name-input').value.trim() || 'الأخضر';
    const oName = $('orange-name-input').value.trim() || 'البرتقالي';

    state = {
        greenName: gName, orangeName: oName,
        currentTeam: 'green',
        board: new Array(GRID_ROWS * GRID_COLS).fill(null),
        fazaa: { green: false, orange: false },
        fazaaActive: false, selectedCategory: null,
        currentHexIndex: null, currentQuestion: null,
        usedQuestions: {}, gameActive: true,
        greenWins: 0, orangeWins: 0, currentRound: 1,
    };

    try { SFX.init(); SFX.gameStart(); } catch(e) {}

    greenTeamName.textContent = gName;
    orangeTeamName.textContent = oName;
    greenFazaaBtn.classList.remove('used');
    orangeFazaaBtn.classList.remove('used');
    greenFazaaBtn.disabled = false;
    orangeFazaaBtn.disabled = false;

    // Notify multiplayer
    if (mpSocket) mpSocket.emit('game-start');

    updateScoreUI();
    showScreen(gameScreen);
    buildGrid();
    updateTurnUI();
    setHostText(`يا هلا! ${gName} 🟢 ضد ${oName} 🟠! يلا نبدأ! الدور للأخضر! 🔥`);
}

function updateScoreUI() {
    matchScoreGreen.textContent = state.greenWins;
    matchScoreOrange.textContent = state.orangeWins;
    roundBadge.textContent = getRoundName(state.currentRound);
}

function getRoundName(round) {
    if (round === 1) return 'الجولة الأولى';
    if (round === 2) return 'الجولة الثانية';
    return 'الجولة الفاصلة';
}

function startNextRound() {
    hideModal(roundResultModal);
    
    state.currentRound++;
    state.board = new Array(GRID_ROWS * GRID_COLS).fill(null);
    state.currentTeam = state.currentRound % 2 === 0 ? 'orange' : 'green'; 
    state.currentHexIndex = null;
    state.currentQuestion = null;
    state.fazaaActive = false;
    state.selectedCategory = null;
    state.gameActive = true;
    
    updateScoreUI();
    buildGrid();
    updateTurnUI();
    
    const startName = state.currentTeam === 'green' ? state.greenName : state.orangeName;
    setHostText(`بداية ${getRoundName(state.currentRound)}! الدور لـ ${startName}! 🔥`);
}

function onHexClick(index) {
    if (!state.gameActive) return;
    if (state.board[index] !== null) return; // already claimed

    state.currentHexIndex = index;
    const letter = state.gridLetters[index];

    if (state.fazaaActive && state.selectedCategory) {
        showQuestion(letter, state.selectedCategory);
        state.fazaaActive = false;
        state.selectedCategory = null;
    } else {
        showQuestion(letter);
    }
}

function showQuestion(letter, category = null) {
    let pool = [];
    let trackKey = letter;

    if (category) {
        // الفزعة: اسحب الأسئلة من نفس الحرف للمجال المطلوب
        const letterQuestions = questionBank[letter] || [];
        pool = letterQuestions.filter(q => q.cat === category);
        
        if (pool.length === 0) pool = letterQuestions;
        trackKey = 'FAZAA_' + category + '_' + letter;
    } else {
        pool = questionBank[letter] || [];
    }

    if (!state.usedQuestions[trackKey]) state.usedQuestions[trackKey] = [];
    let available = pool.filter((_, i) => !state.usedQuestions[trackKey].includes(i));
    if (available.length === 0) { state.usedQuestions[trackKey] = []; available = pool; }

    const qIndex = pool.indexOf(available[Math.floor(Math.random() * available.length)]);
    state.usedQuestions[trackKey].push(qIndex);

    const question = pool[qIndex];
    state.currentQuestion = question;

    questionPassed = false;
    originalTeam = state.currentTeam;

    modalLetter.textContent = category ? '🌟' : letter;
    modalCategory.textContent = category || question.cat;

    const teamName = state.currentTeam === 'green' ? state.greenName : state.orangeName;
    modalTeamBadge.textContent = teamName;
    modalTeamBadge.className = 'modal-team-badge ' + (state.currentTeam === 'green' ? 'green-badge' : 'orange-badge');

    questionText.textContent = question.q;

    // Reset UI for manual judgement
    answerRevealArea.style.display = 'block';
    showAnswerBtn.style.display = 'inline-block';
    answerContent.style.display = 'none';

    // Start Timer
    clearInterval(questionTimerInterval);
    hideBuzzerInfo();
    mpBuzzerPhase = 0;
    mpBuzzedPlayerName = null;
    mpBuzzedPlayerTeam = null;

    const hasPlayers = mpPlayers.length > 0;

    if (hasPlayers) {
        // Multiplayer: open buzzer for players
        questionTimeLeft = 999; // wait for buzzer
        questionTimerEl.textContent = '🔔';
        questionTimerEl.style.cursor = 'default';
        questionTimerEl.title = '';
        questionTimerEl.onclick = null;
        showBuzzerInfo('🔔 بانتظار الضغط...', null);

        try { SFX.questionOpen(); } catch(e) {}

        if (mpSocket) {
            const twSpeed = parseInt(document.getElementById('typewriter-speed')?.value || '20', 10);
            mpSocket.emit('question-open', {
                question: question.q,
                letter: letter,
                category: state.selectedCategory || question.cat,
                twSpeed: twSpeed
            });
        }
    } else {
        // No multiplayer players: use classic timer
        questionTimeLeft = 30;
        questionTimerEl.textContent = questionTimeLeft;
        questionTimerEl.style.cursor = 'pointer';
        questionTimerEl.title = 'تخطي الوقت';
        questionTimerEl.onclick = () => { questionTimeLeft = 1; };
        questionTimerInterval = setInterval(() => {
            questionTimeLeft--;
            questionTimerEl.textContent = questionTimeLeft;
            if (questionTimeLeft <= 5 && questionTimeLeft > 0) {
                try { SFX.tick(); } catch(e) {}
            }
            if (questionTimeLeft <= 0) {
                clearInterval(questionTimerInterval);
                try { SFX.timeUp(); } catch(e) {}
                handleTimeOut();
            }
        }, 1000);
    }

    showAnswerBtn.onclick = () => {
        clearInterval(questionTimerInterval);
        showAnswerBtn.style.display = 'none';
        answerContent.style.display = 'flex';
        actualAnswer.textContent = question.a[0]; // Primary answer
    };

    btnAwardGreen.onclick = () => {
        clearInterval(questionTimerInterval);
        hideModal(questionModal);
        if (mpSocket) mpSocket.emit('question-close');
        hideBuzzerInfo();
        awardCell('green');
    };

    btnAwardOrange.onclick = () => {
        clearInterval(questionTimerInterval);
        hideModal(questionModal);
        if (mpSocket) mpSocket.emit('question-close');
        hideBuzzerInfo();
        awardCell('orange');
    };

    btnChangeQ.onclick = () => {
        hideModal(questionModal);
        setTimeout(() => {
            showQuestion(letter, category);
        }, 300);
    };

    showModal(questionModal);
}

function awardCell(team) {
    const idx = state.currentHexIndex;
    state.board[idx] = team;

    const cell = document.querySelector(`.hex-cell[data-index="${idx}"]`);
    cell.classList.add('claimed', `claimed-${team}`);

    try { SFX.correct(); } catch(e) {}
    setHostText(randomFrom(hostPhrases.correct), 'celebrate');

    // Check win
    const winPath = checkWin(team);
    if (winPath) {
        setTimeout(() => endGame(team, winPath), 1000);
        return;
    }

    // Set turn to the team that answered correctly
    state.currentTeam = team;
    updateTurnUI();
    const name = state.currentTeam === 'green' ? state.greenName : state.orangeName;
    setTimeout(() => setHostText(`إجابة صحيحة! الدور لـ ${name}! اختاروا حرف يا أبطال 🔷`), 600);

    // Notify multiplayer
    if (mpSocket) mpSocket.emit('cell-awarded', { team, index: idx });
}

function handleTimeOut() {
    // Ping-pong between teams
    const currentAnsweringTeam = modalTeamBadge.classList.contains('green-badge') ? 'green' : 'orange';
    const nextTeam = currentAnsweringTeam === 'green' ? 'orange' : 'green';
    
    const nextName = nextTeam === 'green' ? state.greenName : state.orangeName;
    modalTeamBadge.textContent = nextName;
    modalTeamBadge.className = 'modal-team-badge ' + (nextTeam === 'green' ? 'green-badge' : 'orange-badge');
    
    state.currentTeam = nextTeam;
    updateTurnUI();
    
    setHostText(`انتهى الوقت! ⏳ الفرصة تنتقل لـ ${nextName} للإجابة على نفس السؤال!`, 'sad');
    
    // Restart timer for 30s
    clearInterval(questionTimerInterval);
    questionTimeLeft = 30;
    questionTimerEl.textContent = questionTimeLeft;
    questionTimerInterval = setInterval(() => {
        questionTimeLeft--;
        questionTimerEl.textContent = questionTimeLeft;
        if (questionTimeLeft <= 0) {
            clearInterval(questionTimerInterval);
            handleTimeOut();
        }
    }, 1000);
}

function switchTurn() {
    state.currentTeam = state.currentTeam === 'green' ? 'orange' : 'green';
    updateTurnUI();

    const name = state.currentTeam === 'green' ? state.greenName : state.orangeName;
    setTimeout(() => setHostText(`دور ${name}! اختاروا حرف يا أبطال! 🔷`), 600);
}

function endGame(winTeam, winPath) {
    state.gameActive = false;

    // Highlight winning path
    winPath.forEach(idx => {
        const cell = document.querySelector(`.hex-cell[data-index="${idx}"]`);
        cell.classList.add('win-path');
    });

    if (winTeam === 'green') {
        state.greenWins++;
    } else {
        state.orangeWins++;
    }
    updateScoreUI();

    const winName = winTeam === 'green' ? state.greenName : state.orangeName;
    const emoji = winTeam === 'green' ? '🟢' : '🟠';

    setTimeout(() => {
        if (state.greenWins >= 2 || state.orangeWins >= 2) {
            resultIcon.textContent = '🏆';
            resultTitle.textContent = `بطل المباراة ${winName}!`;
            resultText.textContent = `${emoji} ${randomFrom(hostPhrases.win)}`;
            spawnConfetti();
            showScreen(resultScreen);
            try { SFX.victory(); } catch(e) {}
            if (mpSocket) mpSocket.emit('match-won', { winnerName: winName });
        } else {
            roundResultTitle.textContent = `نهاية ${getRoundName(state.currentRound)}`;
            roundResultText.textContent = `فاز ${winName} ${emoji} بهذه الجولة!`;
            roundGreenScore.textContent = state.greenWins;
            roundOrangeScore.textContent = state.orangeWins;
            showModal(roundResultModal);
            if (mpSocket) mpSocket.emit('round-won', { winnerName: winName });
        }
    }, 400);
}

// ============================================================
//  FAZAA
// ============================================================
function activateFazaa(team) {
    if (state.fazaa[team] || !state.gameActive || state.currentTeam !== team) return;
    state.fazaa[team] = true;
    state.fazaaActive = true;
    const btn = team === 'green' ? greenFazaaBtn : orangeFazaaBtn;
    btn.classList.add('used');
    btn.disabled = true;
    showModal(fazaaModal);
}

function selectCategory(cat) {
    state.selectedCategory = cat;
    hideModal(fazaaModal);
    const name = state.currentTeam === 'green' ? state.greenName : state.orangeName;
    setHostText(`فزعة لـ${name}! السؤال الجاي من مجال: ${cat} 📞 اختاروا الحرف!`);
}

// ============================================================
//  UI HELPERS
// ============================================================
function showScreen(s) { document.querySelectorAll('.screen').forEach(x => x.classList.remove('active')); s.classList.add('active'); }
function showModal(m) { m.classList.add('active'); }
function hideModal(m) { m.classList.remove('active'); }

function updateTurnUI() {
    greenPanel.classList.toggle('active-turn', state.currentTeam === 'green');
    orangePanel.classList.toggle('active-turn', state.currentTeam === 'orange');
    turnDot.className = 'turn-dot ' + (state.currentTeam === 'green' ? 'green-turn' : 'orange-turn');
    const name = state.currentTeam === 'green' ? state.greenName : state.orangeName;
    turnLabel.textContent = `دور ${name}`;
}

function setHostText(text, mood = '') {
    hostText.textContent = text;
    hostBubble.className = 'host-bubble' + (mood ? ` ${mood}` : '');
}

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }



function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function spawnConfetti() {
    const colors = ['#4CAF50', '#FF9800', '#FFD700', '#FF1744', '#00B0FF', '#6F2DA8'];
    for (let i = 0; i < 60; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDelay = Math.random() * 2 + 's';
        p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        p.style.width = (5 + Math.random() * 10) + 'px';
        p.style.height = p.style.width;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 4000);
    }
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
$('start-btn').addEventListener('click', startGame);
$('restart-btn').addEventListener('click', () => {
    showScreen(setupScreen);
    if (mpSocket) mpSocket.emit('game-reset');
});
nextRoundBtn.addEventListener('click', startNextRound);

greenFazaaBtn.addEventListener('click', () => activateFazaa('green'));
orangeFazaaBtn.addEventListener('click', () => activateFazaa('orange'));

$('cancel-fazaa-btn').addEventListener('click', () => {
    hideModal(fazaaModal);
    state.fazaaActive = false;
    state.fazaa[state.currentTeam] = false;
    const btn = state.currentTeam === 'green' ? greenFazaaBtn : orangeFazaaBtn;
    btn.classList.remove('used');
    btn.disabled = false;
});

document.querySelectorAll('.btn-cat').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat));
});

[fazaaModal].forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) hideModal(modal); });
});

// Initialize multiplayer on load
initMultiplayer();
