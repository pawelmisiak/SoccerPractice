// Detects short, loud "thuds" (a ball hitting a wall) in the microphone signal.
// Runs on the audio thread and looks at every 128-sample block, so no hit is missed.
//
// A block counts as a hit when its peak is
//   - above `threshold` (absolute loudness, set by the sensitivity setting),
//   - `ratio` times louder than the recent background (so a long shout or music
//     doesn't keep triggering — a hit is a sudden jump), and
//   - at least `gap` seconds after the previous hit (ignores the echo/bounce).
class HitDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.threshold = 0.15;
    this.ratio = 4;
    this.gap = 0.3;
    this.env = 0;
    this.lastHit = -10;
    this.meterPeak = 0;
    this.meterSamples = 0;
    this.port.onmessage = (e) => Object.assign(this, e.data);
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let peak = 0;
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i] < 0 ? -ch[i] : ch[i];
      if (v > peak) peak = v;
    }
    const t = currentTime;
    if (peak > this.threshold && peak > this.env * this.ratio && t - this.lastHit > this.gap) {
      this.lastHit = t;
      this.port.postMessage({ type: 'hit', level: peak, time: t });
    }
    // Background loudness: smoothed over roughly the last 100 ms.
    const k = Math.min(1, ch.length / (sampleRate * 0.1));
    this.env += (peak - this.env) * k;

    // Report the loudest level every ~50 ms for the meter in the mic test screen.
    if (peak > this.meterPeak) this.meterPeak = peak;
    this.meterSamples += ch.length;
    if (this.meterSamples >= sampleRate * 0.05) {
      this.port.postMessage({ type: 'level', level: this.meterPeak });
      this.meterPeak = 0;
      this.meterSamples = 0;
    }
    return true;
  }
}

registerProcessor('hit-detector', HitDetector);
