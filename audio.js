export class SoundManager {
    constructor() {
        this.sounds = {
            pop: 'pop.mp3',
            success: 'success.mp3',
            win: 'win.mp3'
        };
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        this.loadSounds();
    }

    async loadSounds() {
        for (const [key, url] of Object.entries(this.sounds)) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
            } catch (e) {
                console.error(`Error loading sound ${key}:`, e);
            }
        }
    }

    play(name) {
        if (!this.buffers[name]) return;
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = this.buffers[name];
        source.connect(this.audioContext.destination);
        source.start(0);
    }
}