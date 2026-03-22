// ============================================================
//  حروف أحمد - Multiplayer Server
//  Express + Socket.IO
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// ============================================================
//  GAME STATE (MULTI-ROOM)
// ============================================================
const rooms = {};

function initRoomState(hostSocketId) {
    return {
        hostSocketId: hostSocketId,
        players: [],          // { id, name, team, socketId }
        maxPlayers: 8,
        gameStarted: false,
        currentQuestion: null,
        buzzerOpen: false,
        buzzerPhase: 0,
        buzzedPlayer: null,
        buzzedTeam: null,
        firstBuzzTeam: null,
        buzzerLocked: false,
    };
}

function generateRoomId() {
    let id;
    do {
        id = Math.floor(10000 + Math.random() * 90000).toString();
    } while (rooms[id]);
    return id;
}

// ============================================================
//  SOCKET.IO EVENTS
// ============================================================
io.on('connection', (socket) => {
    console.log(`✅ متصل: ${socket.id}`);

    // ---- Host creates room ----
    socket.on('create-room', () => {
        const roomId = generateRoomId();
        rooms[roomId] = initRoomState(socket.id);
        socket.join(roomId);
        socket.roomId = roomId;
        socket.isHost = true;
        socket.emit('room-created', roomId);
        console.log(`🏠 غرفة جديدة: ${roomId} (Host: ${socket.id})`);
    });

    // ---- Player Joins Room ----
    socket.on('player-join', (data) => {
        // data: { name, team, roomId }
        const roomId = data.roomId;
        if (!roomId || !rooms[roomId]) {
            socket.emit('join-error', 'رقم الغرفة غير صحيح أو لا توجد غرفة بهذا الرقم!');
            return;
        }

        const room = rooms[roomId];

        if (room.players.length >= room.maxPlayers) {
            socket.emit('join-error', 'الغرفة ممتلئة (الحد الأقصى 8 لاعبين)!');
            return;
        }
        if (!data.name || !data.name.trim()) {
            socket.emit('join-error', 'يرجى كتابة اسمك!');
            return;
        }
        if (data.team !== 'green' && data.team !== 'orange') {
            socket.emit('join-error', 'يرجى اختيار فريق!');
            return;
        }

        const player = {
            id: socket.id,
            name: data.name.trim().substring(0, 20),
            team: data.team,
            socketId: socket.id,
        };

        room.players.push(player);
        socket.playerData = player;
        socket.roomId = roomId;

        socket.join(roomId);

        socket.emit('join-success', player);

        if (room.gameStarted) {
            socket.emit('game-started');
        }

        io.to(roomId).emit('player-list', room.players);
        console.log(`👤 انضم: ${player.name} (${player.team}) إلى الغرفة ${roomId}`);
    });

    // ==== HOST EVENTS ====
    socket.on('game-start', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.gameStarted = true;
        io.to(socket.roomId).emit('game-started');
    });

    socket.on('question-open', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.currentQuestion = data;
        room.buzzerOpen = true;
        room.buzzerPhase = 1;
        room.buzzedPlayer = null;
        room.buzzedTeam = null;
        room.firstBuzzTeam = null;
        room.buzzerLocked = false;

        io.to(socket.roomId).emit('question-show', {
            question: data.question,
            letter: data.letter,
            category: data.category,
            phase: 1,
            twSpeed: data.twSpeed || 20
        });
    });

    socket.on('answer-wrong-phase1', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.buzzerPhase = 2;
        room.buzzerLocked = false;
        room.buzzedPlayer = null;

        const otherTeam = room.firstBuzzTeam === 'green' ? 'orange' : 'green';
        io.to(socket.roomId).emit('phase-change', { phase: 2, team: otherTeam, timeLimit: 10 });
    });

    socket.on('answer-wrong-phase2', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.buzzerPhase = 3;
        room.buzzerLocked = false;
        room.buzzedPlayer = null;
        io.to(socket.roomId).emit('phase-change', { phase: 3, team: null, timeLimit: 3 });
    });

    socket.on('answer-wrong-phase3', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.buzzerPhase = 3;
        room.buzzerLocked = false;
        room.buzzedPlayer = null;
        io.to(socket.roomId).emit('phase-change', { phase: 3, team: null, timeLimit: 3 });
    });

    socket.on('question-close', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.buzzerOpen = false;
        room.buzzerPhase = 0;
        room.buzzedPlayer = null;
        room.buzzedTeam = null;
        room.firstBuzzTeam = null;
        room.buzzerLocked = false;
        room.currentQuestion = null;
        io.to(socket.roomId).emit('question-closed');
    });

    socket.on('cell-awarded', (data) => {
        if (socket.roomId) io.to(socket.roomId).emit('cell-update', data);
    });

    socket.on('game-reset', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.gameStarted = false;
        room.buzzerOpen = false;
        room.buzzerPhase = 0;
        room.currentQuestion = null;
        room.buzzedPlayer = null;
        io.to(socket.roomId).emit('game-reset');
    });

    socket.on('round-won', (data) => {
        if (socket.roomId) io.to(socket.roomId).emit('round-result', data);
    });

    socket.on('match-won', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        room.gameStarted = false;
        room.buzzerOpen = false;
        room.buzzerPhase = 0;
        room.currentQuestion = null;
        room.buzzedPlayer = null;
        io.to(socket.roomId).emit('match-result', data);
    });

    // ==== PLAYER EVENTS ====
    socket.on('buzzer-press', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.buzzerOpen || room.buzzerLocked) return;
        if (!socket.playerData) return;

        const player = socket.playerData;

        if (room.buzzerPhase === 1) {
            room.buzzerLocked = true;
            room.buzzedPlayer = player;
            room.buzzedTeam = player.team;
            room.firstBuzzTeam = player.team;

            io.to(socket.roomId).emit('buzzer-result', {
                playerName: player.name,
                playerTeam: player.team,
                phase: 1,
                timeLimit: 5,
            });
            return;
        }

        if (room.buzzerPhase === 3) {
            room.buzzerLocked = true;
            room.buzzedPlayer = player;
            room.buzzedTeam = player.team;

            io.to(socket.roomId).emit('buzzer-result', {
                playerName: player.name,
                playerTeam: player.team,
                phase: 3,
                timeLimit: 3,
            });
            return;
        }
    });

    // ---- Disconnect ----
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        const room = rooms[roomId];
        if (room) {
            if (socket.isHost) {
                // Host left, end game
                io.to(roomId).emit('host-disconnected');
                delete rooms[roomId];
            } else if (socket.playerData) {
                room.players = room.players.filter(p => p.socketId !== socket.id);
                io.to(roomId).emit('player-list', room.players);
            }
        }
        console.log(`❌ قطع الاتصال: ${socket.id}`);
    });
});

// ============================================================
//  START SERVER
// ============================================================
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       🎮 حروف أحمد - السيرفر شغال!      ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  المنفذ: ${PORT}                            ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
