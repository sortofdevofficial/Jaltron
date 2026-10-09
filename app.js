class JaltronGodEngine {
    constructor() {
        this.logStream = document.getElementById('logStream');
        this.statusBadge = document.getElementById('statusBadge');
        this.coreTrigger = document.getElementById('coreTrigger');
        this.sysClock = document.getElementById('sysClock');
        this.canvas = document.getElementById('audioCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.isListening = false;
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;

        this.appMap = {
            "youtube": "https://youtube.com",
            "google": "https://google.com",
            "github": "https://github.com",
            "discord": "https://discord.com/app",
            "whatsapp": "https://web.whatsapp.com",
            "spotify": "https://open.spotify.com"
        };

        this.startClock();
        this.initEventListeners();
        this.renderCanvasLoop();
    }

    startClock() {
        setInterval(() => {
            const now = new Date();
            this.sysClock.textContent = now.toTimeString().split(' ')[0];
        }, 1000);
    }

    async initAudioVisualizer() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            const source = this.audioCtx.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 64;
            source.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.log("[AUDIO]: Frequency spectrum connected successfully.", "msg-sys");
        } catch (err) {
            this.log(`[AUDIO_ERR]: Mic stream rejected - ${err.message}`, "msg-err");
        }
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.log("[CRITICAL]: Speech API unavailable in this browser.", "msg-err");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.statusBadge.classList.add('active');
            this.statusBadge.innerHTML = `<span class="dot"></span> ONLINE`;
            this.speak("Jaltron active.");
            this.log("[JALTRON]: Subsystems fully online. State targets.", "msg-jal");
        };

        this.recognition.onresult = (e) => {
            const cmd = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
            this.log(`USER > ${cmd}`, "msg-usr");
            this.exec(cmd);
        };

        this.recognition.onend = () => {
            if (this.isListening) this.recognition.start();
        };
    }

    exec(command) {
        if (command.includes("open") || command.includes("launch")) {
            let found = false;
            for (const [key, url] of Object.entries(this.appMap)) {
                if (command.includes(key)) {
                    this.speak(`Executing protocol for ${key}`);
                    this.log(`[JALTRON]: Launching external target -> ${key}`, "msg-jal");
                    window.open(url, '_blank');
                    found = true;
                    break;
                }
            }
            if (!found) {
                this.speak("Target not mapped in local protocol registry.");
                this.log(`[WARN]: Command match failed for '${command}'`, "msg-err");
            }
        } else if (command.includes("status") || command.includes("system")) {
            this.speak("Systems operating at maximum capacity. Memory nominal.");
            this.log("[DIAGNOSTICS]: CPU: Nominal | RAM: 12% | Network: Active", "msg-jal");
        } else if (command.includes("clear")) {
            this.logStream.innerHTML = "";
            this.log("[SYS]: Log buffer purged.", "msg-sys");
        } else {
            this.speak("Unrecognized directive.");
            this.log(`[JALTRON]: Directive unrecognized: '${command}'`, "msg-jal");
        }
    }

    speak(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const synth = new SpeechSynthesisUtterance(text);
            synth.rate = 1.05;
            synth.pitch = 0.75; // Low-pitch Ultron voice feel
            window.speechSynthesis.speak(synth);
        }
    }

    log(msg, styleClass) {
        const line = document.createElement('p');
        line.className = styleClass;
        line.textContent = msg;
        this.logStream.appendChild(line);
        this.logStream.scrollTop = this.logStream.scrollHeight;
    }

    renderCanvasLoop() {
        requestAnimationFrame(() => this.renderCanvasLoop());

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 90;

        this.ctx.clearRect(0, 0, width, height);

        // Outer static HUD ring
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius + 20, 0, Math.PI * 2);
        this.ctx.strokeStyle = "rgba(0, 243, 255, 0.15)";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        if (this.analyser && this.dataArray && this.isListening) {
            this.analyser.getByteFrequencyData(this.dataArray);

            const bars = this.dataArray.length;
            const step = (Math.PI * 2) / bars;

            for (let i = 0; i < bars; i++) {
                const value = this.dataArray[i];
                const barHeight = (value / 255) * 45;

                const angle = i * step;
                const x1 = centerX + Math.cos(angle) * radius;
                const y1 = centerY + Math.sin(angle) * radius;
                const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                const y2 = centerY + Math.sin(angle) * (radius + barHeight);

                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.strokeStyle = value > 180 ? "#ff003c" : "#00f3ff";
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }
        }
    }

    initEventListeners() {
        this.coreTrigger.addEventListener('click', async () => {
            if (!this.audioCtx) await this.initAudioVisualizer();
            if (!this.recognition) this.initSpeechRecognition();

            if (!this.isListening) {
                this.recognition.start();
            } else {
                this.isListening = false;
                this.recognition.stop();
                this.statusBadge.classList.remove('active');
                this.statusBadge.innerHTML = `<span class="dot"></span> STANDBY`;
                this.log("[SYS]: Subsystems placed on standby.", "msg-sys");
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.coreTrigger.click();
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.jaltron = new JaltronGodEngine();
});