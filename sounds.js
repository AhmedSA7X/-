// ============================================================
//  حروف أحمد - Sound Effects (Web Audio API)
//  No external files needed!
// ============================================================

const SFX = (() => {
    let audioCtx = null;
    let sfxVolume = 1.0;
    let musicVolume = 0.5;
    let bgMusic = null;

    function getCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playTone(freq, duration, type = 'sine', baseVol = 0.3, ramp = true) {
        if (sfxVolume <= 0) return;
        try {
            const ctx = getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            const finalVol = baseVol * sfxVolume;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(finalVol, ctx.currentTime);
            if (ramp) {
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            }
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (e) { /* ignore audio errors */ }
    }

    function playNotes(notes, interval = 0.12) {
        notes.forEach(([freq, dur, type], i) => {
            setTimeout(() => playTone(freq, dur || 0.2, type || 'sine', 0.25), i * interval * 1000);
        });
    }

    return {
        // 🔔 Buzzer press - alarm bell sound
        buzzer() {
            playTone(880, 0.15, 'square', 0.35, false);
            setTimeout(() => playTone(1100, 0.15, 'square', 0.3, false), 100);
            setTimeout(() => playTone(880, 0.2, 'square', 0.25), 200);
        },

        // ✅ Correct answer - happy ascending
        correct() {
            playNotes([
                [523, 0.12], // C5
                [659, 0.12], // E5
                [784, 0.12], // G5
                [1047, 0.3],  // C6
            ], 0.1);
        },

        // ❌ Wrong answer - sad descending
        wrong() {
            playTone(400, 0.15, 'sawtooth', 0.2);
            setTimeout(() => playTone(300, 0.15, 'sawtooth', 0.2), 150);
            setTimeout(() => playTone(200, 0.4, 'sawtooth', 0.15), 300);
        },

        // ⏰ Timer tick (last 5 seconds)
        tick() {
            playTone(1000, 0.05, 'sine', 0.15, false);
        },

        // ⏰ Timer urgent tick (last 3 seconds)
        urgentTick() {
            playTone(1200, 0.08, 'square', 0.2, false);
        },

        // 🎮 Game start fanfare
        gameStart() {
            playNotes([
                [523, 0.15],  // C
                [659, 0.15],  // E
                [784, 0.15],  // G
                [1047, 0.15], // C high
                [784, 0.15],  // G
                [1047, 0.4],  // C high (long)
            ], 0.12);
        },

        // 🏆 Victory fanfare
        victory() {
            playNotes([
                [523, 0.15, 'triangle'],
                [523, 0.1, 'triangle'],
                [523, 0.1, 'triangle'],
                [523, 0.3, 'triangle'],
                [415, 0.3, 'triangle'],
                [466, 0.3, 'triangle'],
                [523, 0.15, 'triangle'],
                [466, 0.1, 'triangle'],
                [523, 0.5, 'triangle'],
            ], 0.15);
        },

        // 📢 Phase change notification
        phaseChange() {
            playTone(660, 0.1, 'triangle', 0.2);
            setTimeout(() => playTone(880, 0.15, 'triangle', 0.25), 120);
        },

        // 🔔 Question open
        questionOpen() {
            playTone(587, 0.12, 'sine', 0.2);
            setTimeout(() => playTone(784, 0.12, 'sine', 0.2), 100);
            setTimeout(() => playTone(987, 0.2, 'sine', 0.2), 200);
        },

        // 👤 Player joined
        playerJoin() {
            playTone(800, 0.08, 'sine', 0.15);
            setTimeout(() => playTone(1000, 0.12, 'sine', 0.15), 80);
        },

        // ⏳ Time's up
        timeUp() {
            playTone(300, 0.3, 'sawtooth', 0.2);
            setTimeout(() => playTone(200, 0.5, 'sawtooth', 0.15), 300);
        },

        // 🔘 Button click
        click() {
            playTone(600, 0.04, 'sine', 0.1, false);
        },

        // Initialize (must be called from user gesture)
        init() {
            getCtx();
            this.startMusic();
        },

        // 🔊 Set Volume for Sound Effects
        setSfxVolume(val) {
            let v = Math.max(0, Math.min(1, val));
            sfxVolume = (v < 0.05) ? 0 : Math.pow(v, 2); // Exponential curve for deep muting
        },

        // 🎵 Set Volume for Background Music
        setMusicVolume(val) {
            musicVolume = Math.max(0, Math.min(1, val));
            if (bgMusic) bgMusic.volume = musicVolume;
        },

        // 🎼 Start looping background music
        startMusic() {
            if (!bgMusic) {
                bgMusic = new Audio('bg-music.mp3');
                bgMusic.loop = true;
                bgMusic.volume = musicVolume;
            }
            bgMusic.play().catch(e => { /* Ignore autoplay block warning */ });
        }
    };
})();
