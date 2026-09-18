/**
 * High-Fidelity WAV Audio Recorder
 * Captures raw 16-bit linear PCM audio via the Web Audio API and encodes
 * standard RIFF/WAVE files with exact headers for universal desktop & browser playback.
 */

export class WavAudioRecorder {
  /**
   * @param {AudioContext} audioContext
   * @param {MediaStream} mediaStream
   */
  constructor(audioContext, mediaStream) {
    this.audioContext = audioContext;
    this.mediaStream = mediaStream;
    this.sampleRate = audioContext.sampleRate;
    this.sourceNode = null;
    this.processorNode = null;
    this.pcmChunks = [];
    this.totalSamples = 0;
    this.isRecording = false;
  }

  /**
   * Start capturing PCM audio
   */
  async start() {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.pcmChunks = [];
    this.totalSamples = 0;
    this.isRecording = true;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Use ScriptProcessorNode (bufferSize: 4096, 1 input channel, 1 output channel)
    // for guaranteed, cross-browser continuous Float32 PCM streaming without network module dependencies.
    const bufferSize = 4096;
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      const inputChannel = event.inputBuffer.getChannelData(0);
      // Copy the Float32 array slice
      const copy = new Float32Array(inputChannel.length);
      copy.set(inputChannel);
      this.pcmChunks.push(copy);
      this.totalSamples += copy.length;
    };

    // Connect source -> processor -> destination (muted to prevent feedback)
    this.sourceNode.connect(this.processorNode);
    // Connect to destination so onaudioprocess continues firing in all browsers
    this.processorNode.connect(this.audioContext.destination);
  }

  /**
   * Stop recording and return { blob, durationSeconds }
   * @returns {Promise<{ blob: Blob, durationSeconds: number }>}
   */
  async stop() {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Merge all Float32 chunks into a single Float32Array
    const mergedSamples = new Float32Array(this.totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    const durationSeconds = this.sampleRate > 0 
      ? Math.round(this.totalSamples / this.sampleRate) 
      : 0;

    const wavBlob = this.encodeWAV(mergedSamples, this.sampleRate);
    return { blob: wavBlob, durationSeconds };
  }

  /**
   * Encode Float32 PCM samples to 16-bit linear PCM RIFF WAV Blob
   * @param {Float32Array} samples
   * @param {number} sampleRate
   * @returns {Blob}
   */
  encodeWAV(samples, sampleRate) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataByteLength = samples.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    // Helper to write ASCII strings
    const writeString = (view, byteOffset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(byteOffset + i, string.charCodeAt(i));
      }
    };

    /* RIFF header */
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataByteLength, true); // RIFF chunk size
    writeString(view, 8, "WAVE");

    /* "fmt " subchunk */
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);             // Subchunk1Size (16 for standard PCM)
    view.setUint16(20, 1, true);              // AudioFormat (1 = uncompressed PCM)
    view.setUint16(22, numChannels, true);    // NumChannels (1 = Mono)
    view.setUint32(24, sampleRate, true);     // SampleRate
    view.setUint32(28, byteRate, true);       // ByteRate
    view.setUint16(32, blockAlign, true);     // BlockAlign
    view.setUint16(34, bitsPerSample, true);  // BitsPerSample

    /* "data" subchunk */
    writeString(view, 36, "data");
    view.setUint32(40, dataByteLength, true); // Data chunk byte length

    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    let pcmOffset = 44;
    for (let i = 0; i < samples.length; i++, pcmOffset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(pcmOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }
}
