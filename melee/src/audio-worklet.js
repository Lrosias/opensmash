class MeleeAudio extends AudioWorkletProcessor {
  constructor({processorOptions: {memory, pointer}}) {
    super();
    this.memory = memory;
    this.pointer = pointer;
  }
  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) return true;
    const control = new Uint32Array(this.memory.buffer, this.pointer, 4);
    const samples = new Int16Array(this.memory.buffer, this.pointer + 16, 8192 * 2);
    const write = Atomics.load(control, 0);
    let read = Atomics.load(control, 1);
    const available = (write - read) >>> 0;
    const count = Math.min(output[0].length, available);
    for (let i = 0; i < count; i++) {
      const pos = ((read + i) % 8192) * 2;
      output[0][i] = samples[pos] / 32768;
      output[1][i] = samples[pos + 1] / 32768;
    }
    if (count < output[0].length) Atomics.add(control, 2, 1);
    Atomics.store(control, 1, (read + count) >>> 0);
    return true;
  }
}
registerProcessor('melee-audio', MeleeAudio);
