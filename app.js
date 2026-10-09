class JaltronWebCore {
    constructor() {
        this.logOutput = document.getElementById('logOutput');
        this.statusTag = document.getElementById('statusTag');
        this.coreNode = document.getElementById('coreNode');
        this.listenBtn = document.getElementById('listenBtn');
        
        this.isListening = false;
        
        // Command Protocol Map
        this.appRegistry = {
            "youtube": "https://youtube.com",
            "google": "https://google.com",
            "github": "https://github.com",
            "whatsapp": "https://web.whatsapp.com",
            "discord": "https://discord.com/app"
        };

        this.initSpeechEngine();
        this.attachEvents();
    }

    initSpeechEngine() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.log("[ERR]: Web Speech API is not supported in this browser.", "system-msg");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.statusTag.textContent = "ONLINE";
            this.statusTag.style.color = "#00f3ff";
            this.statusTag.style.borderColor = "#00f3ff";
            this.coreNode.style.backgroundColor = "#00f3ff";
            this.log("[SYS]: Jaltron active. Listening for targets...", "system-msg");
        };

        this.recognition.onresult = (event) => {
            const lastIndex = event.results.length - 1;
            const commandText = event.results[lastIndex][0].transcript.trim().toLowerCase();
            this.log(`USER > ${commandText}`, "user-msg");
            this.processCommand(commandText);
        };

        this.recognition.onerror = (event) => {
            this.log(`[ERR]: Speech recognition error: ${event.error}`, "system-msg");
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                // Auto-restart continuous listening loop
                this.recognition.start();
            } else {
                this.statusTag.textContent = "OFFLINE";
                this.statusTag.style.color = "#ff0055";
                this.statusTag.style.borderColor = "#ff0055";
                this.coreNode.style.backgroundColor = "#ff0055";
            }
        };
    }

    attachEvents() {
        this.listenBtn.addEventListener('click', () => {
            if (!this.isListening) {
                this.recognition.start();
                this.listenBtn.textContent = "DEACTIVATE";
            } else {
                this.isListening = false;
                this.recognition.stop();
                this.listenBtn.textContent = "ACTIVATE JALTRON";
                this.log("[SYS]: Jaltron powered down.", "system-msg");
            }
        });
    }

    processCommand(text) {
        if (text.includes("open") || text.includes("launch")) {
            let matched = false;
            for (const [key, url] of Object.entries(this.appRegistry)) {
                if (text.includes(key)) {
                    this.speak(`Launching ${key}`);
                    this.log(`JALTRON > Executing target protocol: Opening ${key}`, "jaltron-msg");
                    window.open(url, '_blank');
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                this.speak("App target not found in web registry.");
                this.log("JALTRON > Target not mapped in local registry.", "jaltron-msg");
            }
        } else if (text.includes("status")) {
            this.speak("All Web Core modules operating at nominal levels.");
            this.log("JALTRON > All Web Core modules nominal.", "jaltron-msg");
        } else if (text.includes("clear")) {
            this.logOutput.innerHTML = "";
            this.log("[SYS]: Logs cleared.", "system-msg");
        } else {
            this.speak("Command protocol unrecognized.");
            this.log(`JALTRON > No match rule for: '${text}'`, "jaltron-msg");
        }
    }

    speak(phrase) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(phrase);
            utterance.rate = 1.0;
            utterance.pitch = 0.8; // Lower pitch for Ultron-style voice
            window.speechSynthesis.speak(utterance);
        }
    }

    log(message, typeClass) {
        const p = document.createElement('p');
        p.className = typeClass;
        p.textContent = message;
        this.logOutput.appendChild(p);
        this.logOutput.scrollTop = this.logOutput.scrollHeight;
    }
}

// Instantiate Engine on Load
window.addEventListener('DOMContentLoaded', () => {
    window.jaltron = new JaltronWebCore();
});