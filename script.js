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
//  FIREBASE MULTIPLAYER INIT
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyBd5OLAAHGSVOptwtK3agFu03W_ch1yKR4",
    authDomain: "hrof-faf04.firebaseapp.com",
    projectId: "hrof-faf04",
    storageBucket: "hrof-faf04.firebasestorage.app",
    messagingSenderId: "296004967939",
    appId: "1:296004967939:web:3f2039c41d0bcd825c3836",
    measurementId: "G-Z6MLKLCGHC"
};

let dbRef = null;
let roomRef = null;

function initMultiplayer() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const auth = firebase.auth();
        const db = firebase.database();
        dbRef = db;

        // Handle Auth State Change (MANDATORY REAL AUTH)
        auth.onAuthStateChanged((user) => {
            if (user && !user.isAnonymous) {
                // Check for email verification
                if (!user.emailVerified) {
                    showScreen($('auth-screen'));
                    hideAuthViews();
                    $('view-verify').style.display = 'block';
                    return;
                }

                const nameDisplay = $('display-user-name');
                if (nameDisplay) nameDisplay.textContent = user.displayName || user.email.split('@')[0];
                showScreen(setupScreen);
                proceedWithRoomSetup(user);
            } else {
                showScreen($('auth-screen'));
            }
        });

        function hideAuthViews() {
            if ($('view-login')) $('view-login').style.display = 'none';
            if ($('view-register')) $('view-register').style.display = 'none';
            if ($('view-verify')) $('view-verify').style.display = 'none';
            if ($('auth-mode-selector')) $('auth-mode-selector').style.display = 'none';
        }

        function proceedWithRoomSetup(user) {
            // Generate Random 5 digit Room ID (only if not already set)
            if (roomRef) return; 

            const roomId = Math.floor(10000 + Math.random() * 90000).toString();
            roomRef = db.ref('rooms/' + roomId);
            
            roomRef.set({
                status: 'setup',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            roomRef.onDisconnect().remove(); 

            // Update DOM with room code
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

            // Watch for Players joining
            roomRef.child('players').on('value', (snapshot) => {
                const players = [];
                snapshot.forEach(child => {
                    players.push(child.val());
                });
                if (players.length > mpPlayers.length) {
                    try { window.SFX && SFX.playerJoin(); } catch(e) {}
                }
                mpPlayers = players;
                updateMpPlayerList();
            });

            // Host catching the buzzer hit
            roomRef.child('buzzer').on('value', (snapshot) => {
                const buzzData = snapshot.val();
                if (buzzData && mpBuzzerPhase > 0 && mpBuzzerPhase < 4) {
                    const oldPhase = mpBuzzerPhase;
                    mpBuzzerPhase = 0; // Lock immediately to prevent race conditions executing local UI twice

                    let timeLimit = 15;
                    roomRef.child('buzzerResult').set({
                        playerName: buzzData.name,
                        playerTeam: buzzData.team,
                        phase: oldPhase,
                        timeLimit: timeLimit,
                        ts: Date.now()
                    });

                    mpBuzzedPlayerName = buzzData.name;
                    mpBuzzedPlayerTeam = buzzData.team;
                    if (oldPhase === 1) mpFirstBuzzTeam = buzzData.team;
                    
                    try { window.SFX && SFX.buzzer(); } catch(e) {}
                    showBuzzerInfo(`🔔 ${buzzData.name} ضغط أولاً! (${timeLimit} ثوانٍ)`, buzzData.team);
                    
                    const teamName = buzzData.team === 'green' ? state.greenName : state.orangeName;
                    modalTeamBadge.textContent = `${buzzData.name} - ${teamName}`;
                    modalTeamBadge.className = 'modal-team-badge ' + (buzzData.team === 'green' ? 'green-badge' : 'orange-badge');

                    state.currentTeam = buzzData.team;
                    updateTurnUI();

                    clearInterval(questionTimerInterval);
                    questionTimeLeft = timeLimit;
                    questionTimerEl.textContent = questionTimeLeft;
                    questionTimerInterval = setInterval(() => {
                        questionTimeLeft--;
                        questionTimerEl.textContent = questionTimeLeft;
                        if (questionTimeLeft <= 0) {
                            clearInterval(questionTimerInterval);
                            handleBuzzerTimeoutWrapper(oldPhase);
                        }
                    }, 1000);
                }
            });
        }

    } catch (e) {
        console.warn('Firebase initialization failed ->', e);
    }
}

function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch((error) => {
        if ($('auth-error')) $('auth-error').textContent = translateError(error);
    });
}

function translateError(error) {
    if (!error) return "";
    let msg = error.message || error.toString();
    // Remove "Firebase:" branding
    msg = msg.replace(/Firebase:\s*/g, "");
    
    // Custom Arabic translations
    if (msg.includes("email-already-in-use")) return "❌ هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول.";
    if (msg.includes("invalid-email")) return "❌ عنوان البريد الإلكتروني غير صحيح.";
    if (msg.includes("weak-password")) return "❌ كلمة المرور ضعيفة جداً (يجب أن تكون 6 خانات فأكثر).";
    if (msg.includes("user-not-found") || msg.includes("wrong-password")) return "❌ البريد أو كلمة المرور غير صحيحة.";
    if (msg.includes("too-many-requests")) return "⚠️ محاولات كثيرة خاطئة، يرجى الانتظار قليلاً.";
    if (msg.includes("operation-not-allowed")) return "❌ هذه الطريقة غير مفعلة حالياً.";
    
    return msg;
}

function setAuthMode(mode) {
    const loginView = $('view-login');
    const registerView = $('view-register');
    const verifyView = $('view-verify');
    const selector = $('auth-mode-selector');
    const loginBtn = $('btn-mode-login');
    const registerBtn = $('btn-mode-register');
    if (!loginView || !registerView) return;

    // Reset views
    loginView.style.display = 'none';
    registerView.style.display = 'none';
    if (verifyView) verifyView.style.display = 'none';
    if (selector) selector.style.display = 'flex';

    if (mode === 'login') {
        loginView.style.display = 'block';
        loginBtn.className = 'btn-primary';
        registerBtn.className = 'btn-secondary';
    } else {
        registerView.style.display = 'block';
        loginBtn.className = 'btn-secondary';
        registerBtn.className = 'btn-primary';
    }
}

function loginEmail() {
    const email = $('auth-email').value;
    const pass = $('auth-pass').value;
    const err = $('auth-error');
    if (!email || !pass) { err.textContent = '❌ أدخل البريد وكلمة المرور'; return; }
    firebase.auth().signInWithEmailAndPassword(email, pass).catch(e => {
        err.textContent = translateError(e);
    });
}

function registerEmail() {
    const name = $('reg-name').value;
    const email = $('reg-email').value;
    const pass = $('reg-pass').value;
    const err = $('auth-error');
    if (!name || !email || !pass) { err.textContent = '❌ أكمل جميع الحقول'; return; }
    
    firebase.auth().createUserWithEmailAndPassword(email, pass).then((result) => {
        result.user.sendEmailVerification().then(() => {
            alert("✅ تم إرسال رابط التحقق بنجاح! يرجى مراجعة بريدك الإلكتروني (In-box/Spam).");
        }).catch(ev => {
            console.error("Verification error:", ev);
            alert("⚠️ تنبيه: تعذر إرسال رابط التفعيل حالياً. تأكد من تفعيل SMTP في الإعدادات.");
        });
        return result.user.updateProfile({ displayName: name });
    }).catch(e => {
        err.textContent = translateError(e);
    });
}

function checkVerification() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    user.reload().then(() => {
        if (user.emailVerified) {
            window.location.reload();
        } else {
            const err = document.getElementById('auth-error');
            if (err) err.textContent = '❌ لم يتم التحقق بعد، تأكد من بريدك.';
        }
    });
}

function resendVerification() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    user.sendEmailVerification().then(() => {
        const err = document.getElementById('auth-error');
        if (err) err.textContent = '✅ تمت إعادة إرسال الرابط بنجاح.';
    }).catch(e => {
        const err = document.getElementById('auth-error');
        if (err) err.textContent = '⚠️ خطأ: ' + e.message;
    });
}

function logout() {
    firebase.auth().signOut().then(() => {
        window.location.reload();
    });
}

function syncStateToFirebase() {
    if (!roomRef) return;
    roomRef.child('gameState').set({
        board: state.board,
        currentTeam: state.currentTeam,
        greenWins: state.greenWins || 0,
        orangeWins: state.orangeWins || 0,
        currentRound: state.currentRound || 1,
        gridLetters: state.gridLetters || [],
        ts: Date.now()
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
    initMultiplayer();
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

function handleBuzzerTimeoutWrapper(phaseVal) {
    if (phaseVal === 1) {
        try { SFX.wrong(); } catch(e) {}
        if (roomRef) roomRef.child('phaseChange').set({ phase: 2, team: mpFirstBuzzTeam === 'green' ? 'orange' : 'green', timeLimit: 15, ts: Date.now() });
        const otherTeam = mpFirstBuzzTeam === 'green' ? 'orange' : 'green';
        const otherName = otherTeam === 'green' ? state.greenName : state.orangeName;
        setHostText(`⏳ انتهى الوقت! الفرصة تنتقل لـ${otherName}!`, 'sad');
    } else if (phaseVal === 2) {
        try { SFX.wrong(); } catch(e) {}
        if (roomRef) roomRef.child('phaseChange').set({ phase: 3, timeLimit: 15, ts: Date.now() });
        setHostText(`⚡ الفرصة الأخيرة! من يضغط أولاً!`, 'sad');
    } else if (phaseVal === 3) {
        try { SFX.timeUp(); } catch(e) {}
        if (roomRef) roomRef.child('phaseChange').set({ phase: 3, timeLimit: 15, ts: Date.now() });
        setHostText(`⚡ من يضغط أولاً! 15 ثانية!`, 'sad');
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
//  CUSTOM QUESTIONS (ADMIN PANEL)
// ============================================================
let customQuestionsData = JSON.parse(localStorage.getItem('horouf_customQs')) || {};

// Custom Select Logic
function toggleCustomSelect(type) {
    const wrapper = $(`${type}-select-wrapper`);
    // Close others
    if (type !== 'letter' && $('letter-select-wrapper')) $('letter-select-wrapper').classList.remove('open');
    if (type !== 'category' && $('category-select-wrapper')) $('category-select-wrapper').classList.remove('open');
    if (wrapper) wrapper.classList.toggle('open');
}

function selectCustomOption(type, value, text) {
    // We expect event to be available from the onclick handler
    const e = window.event;
    $(`admin-${type}`).value = value;
    $(`selected-${type}-text`).textContent = text;
    
    // Update selected class
    const options = $(`${type}-options-list`).querySelectorAll('.custom-option');
    options.forEach(opt => opt.classList.remove('selected'));
    if (e && e.currentTarget) {
        e.currentTarget.classList.add('selected');
    }
    
    $(`${type}-select-wrapper`).classList.remove('open');
}

// Close custom selects when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        const wrappers = document.querySelectorAll('.custom-select-wrapper');
        wrappers.forEach(w => w.classList.remove('open'));
    }
});

function getCombinedQuestions(letter) {
    let base = (typeof questionBank !== 'undefined') ? (questionBank[letter] || []) : [];
    let custom = customQuestionsData[letter] || [];
    return [...custom, ...base];
}

function saveAdminQuestion() {
    const letter = $('admin-letter').value;
    const cat = $('admin-category').value;
    const qText = $('admin-question-text').value.trim();
    const aText = $('admin-answer-text').value.trim();
    const feedback = $('admin-feedback');

    if (!qText || !aText) {
        feedback.textContent = '❌ يرجى تعبئة نص السؤال والإجابة!';
        feedback.style.color = '#ff4444';
        return;
    }

    if (!customQuestionsData[letter]) customQuestionsData[letter] = [];
    const newQ = { q: qText, a: [aText], cat: cat, cId: Date.now() };
    customQuestionsData[letter].push(newQ);
    
    localStorage.setItem('horouf_customQs', JSON.stringify(customQuestionsData));
    
    $('admin-question-text').value = '';
    $('admin-answer-text').value = '';
    feedback.textContent = '✅ تم الحفظ بنجاح!';
    feedback.style.color = '#4CAF50';
    setTimeout(() => { feedback.textContent = ''; }, 3000);
    
    renderCustomQuestionsList();
}

function deleteCustomQuestion(letter, cId) {
    if (!customQuestionsData[letter]) return;
    customQuestionsData[letter] = customQuestionsData[letter].filter(q => q.cId !== cId);
    if (customQuestionsData[letter].length === 0) delete customQuestionsData[letter];
    
    localStorage.setItem('horouf_customQs', JSON.stringify(customQuestionsData));
    renderCustomQuestionsList();
}

function renderCustomQuestionsList() {
    const list = $('custom-questions-list');
    const countEl = $('admin-q-count');
    if (!list) return;
    list.innerHTML = '';
    let count = 0;
    
    // 1) Custom user questions (with delete button)
    let customCount = 0;
    for (const letter in customQuestionsData) {
        customQuestionsData[letter].forEach(q => {
            customCount++;
            count++;
            const item = document.createElement('div');
            item.className = 'admin-q-item';
            item.innerHTML = `
                <div class="admin-q-item-letter">${letter}</div>
                <div class="admin-q-item-content">
                    <span class="admin-q-item-cat">✏️ ${q.cat}</span>
                    <span class="admin-q-item-text">${q.q}</span>
                    <span class="admin-q-item-answer">الجواب: ${q.a[0]}</span>
                </div>
                <button class="admin-q-delete-btn" onclick="deleteCustomQuestion('${letter}', ${q.cId})">🗑️</button>
            `;
            list.appendChild(item);
        });
    }

    // 2) Built-in question bank (no delete button)
    if (typeof questionBank !== 'undefined') {
        for (const letter in questionBank) {
            questionBank[letter].forEach(q => {
                count++;
                const item = document.createElement('div');
                item.className = 'admin-q-item';
                item.innerHTML = `
                    <div class="admin-q-item-letter">${letter}</div>
                    <div class="admin-q-item-content">
                        <span class="admin-q-item-cat">${q.cat}</span>
                        <span class="admin-q-item-text">${q.q}</span>
                        <span class="admin-q-item-answer">الجواب: ${q.a[0]}</span>
                    </div>
                `;
                list.appendChild(item);
            });
        }
    }
    
    if (countEl) countEl.textContent = count;
    
    if (count === 0) {
        list.innerHTML = '<div class="admin-empty-state"><span class="admin-empty-icon">📭</span><p>لا توجد أسئلة حتى الآن</p></div>';
    }
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
    if (roomRef) {
        roomRef.child('status').set({ state: 'game-started', ts: Date.now() });
        roomRef.child('teams').set({ green: gName, orange: oName });
        syncStateToFirebase();
    }

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

    // Notify players which hex is being looked at
    if (roomRef) roomRef.child('hexSelected').set({ index: index, letter: letter, ts: Date.now() });
}

function showQuestion(letter, category = null) {
    let pool = [];
    let trackKey = letter;

    const letterQuestions = getCombinedQuestions(letter);

    if (category) {
        // الفزعة: اسحب الأسئلة من نفس الحرف للمجال المطلوب
        pool = letterQuestions.filter(q => q.cat === category);
        
        if (pool.length === 0) pool = letterQuestions;
        trackKey = 'FAZAA_' + category + '_' + letter;
    } else {
        pool = letterQuestions;
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

        if (roomRef) {
            const twSpeed = parseInt(document.getElementById('typewriter-speed')?.value || '20', 10);
            roomRef.child('question').set({
                text: question.q,
                letter: letter,
                category: state.selectedCategory || question.cat,
                twSpeed: twSpeed,
                ts: Date.now()
            });
            roomRef.child('status').set({ state: 'question-open', ts: Date.now() });
            roomRef.child('buzzer').remove(); 
            roomRef.child('buzzerResult').remove();
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
        if (roomRef) roomRef.child('status').set({ state: 'question-closed', ts: Date.now() });
        hideBuzzerInfo();
        awardCell('green');
    };

    btnAwardOrange.onclick = () => {
        clearInterval(questionTimerInterval);
        hideModal(questionModal);
        if (roomRef) roomRef.child('status').set({ state: 'question-closed', ts: Date.now() });
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
    if (roomRef) {
        roomRef.child('cellAwarded').set({ team, index: idx, ts: Date.now() });
        syncStateToFirebase();
    }
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
    saveGameState();
    
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
    syncStateToFirebase();
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
            if (roomRef) roomRef.child('matchResult').set({ winnerName: winName, ts: Date.now() });
        } else {
            roundResultTitle.textContent = `نهاية ${getRoundName(state.currentRound)}`;
            roundResultText.textContent = `فاز ${winName} ${emoji} بهذه الجولة!`;
            roundGreenScore.textContent = state.greenWins;
            roundOrangeScore.textContent = state.orangeWins;
            showModal(roundResultModal);
            if (roomRef) roomRef.child('roundResult').set({ winnerName: winName, ts: Date.now() });
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
//  AUTO-RECOVERY (SAVE STATE)
// ============================================================
function returnToSetup() {
    showScreen(setupScreen);
    checkSavedGames();
}

function manualSaveGame() {
    saveGameState();
    const originalText = hostText.textContent;
    setHostText(`تم حفظ المباراة بنجاح! 💾`, 'celebrate');
    setTimeout(() => { 
        if(state.gameActive) setHostText(originalText); 
    }, 3000);
}

function saveGameState() {
    if (!state.gameActive) {
        localStorage.removeItem('horouf_gameState');
        return;
    }
    localStorage.setItem('horouf_gameState', JSON.stringify(state));
}

// ============================================================
//  SAVED GAMES UI
// ============================================================
function checkSavedGames() {
    const saved = localStorage.getItem('horouf_gameState');
    const section = $('saved-games-section');
    if (!section) return;
    
    if (saved) {
        try {
            const s = JSON.parse(saved);
            if (s.gameActive) {
                $('saved-green-name').textContent = s.greenName || 'الأخضر';
                $('saved-orange-name').textContent = s.orangeName || 'البرتقالي';
                $('saved-round-info').textContent = getRoundName(s.currentRound || 1);
                $('saved-score-info').textContent = `${s.greenWins || 0} - ${s.orangeWins || 0}`;
                section.style.display = 'block';
                return;
            }
        } catch(e) {}
    }
    section.style.display = 'none';
}

function resumeSavedGame() {
    if (restoreGameState()) {
        try { SFX.init(); } catch(e) {}
    }
}

function deleteSavedGame() {
    localStorage.removeItem('horouf_gameState');
    checkSavedGames();
}

function restoreGameState() {
    const saved = localStorage.getItem('horouf_gameState');
    if (!saved) return false;
    try {
        const parsedState = JSON.parse(saved);
        if (!parsedState.gameActive) return false;
        state = parsedState;
        
        greenTeamName.textContent = state.greenName;
        orangeTeamName.textContent = state.orangeName;
        if (state.fazaa.green) greenFazaaBtn.classList.add('used');
        if (state.fazaa.orange) orangeFazaaBtn.classList.add('used');
        greenFazaaBtn.disabled = state.fazaa.green;
        orangeFazaaBtn.disabled = state.fazaa.orange;
        
        updateScoreUI();
        
        // Rebuild grid
        hexGrid.innerHTML = '';
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
                cell.innerHTML = `<span>${state.gridLetters[idx]}</span>`;
                if (state.board[idx] === 'green') cell.classList.add('claimed', 'claimed-green');
                else if (state.board[idx] === 'orange') cell.classList.add('claimed', 'claimed-orange');
                cell.addEventListener('click', () => onHexClick(parseInt(cell.dataset.index)));
                rowDiv.appendChild(cell);
                idx++;
            }
            hexGrid.appendChild(rowDiv);
        }
        
        updateTurnUI();
        showScreen(gameScreen);
        const currentName = state.currentTeam === 'green' ? state.greenName : state.orangeName;
        setHostText(`تم استعادة المباراة بسلام! الدور لـ ${currentName} 🔥`, 'celebrate');
        return true;
    } catch(e) {
        console.error("Failed to restore match", e);
        return false;
    }
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
$('start-btn').addEventListener('click', startGame);
if ($('google-auth-btn')) $('google-auth-btn').addEventListener('click', handleGoogleLogin);
$('restart-btn').addEventListener('click', () => {
    showScreen(setupScreen);
    if (roomRef) roomRef.child('status').set({ state: 'game-reset', ts: Date.now() });
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

// Boot check
document.addEventListener('DOMContentLoaded', () => {
    checkSavedGames();
});

document.querySelectorAll('.btn-cat').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat));
});

[fazaaModal].forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) hideModal(modal); });
});

// Initialize multiplayer on load
initMultiplayer();
