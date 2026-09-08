// Host orders canonical N64 input frames. Both identical Wasm builds replay
// that stream; a slow/missing peer stalls, never predicts an unconfirmed move.
export const PROTOCOL = 'opensmash-duel-v1';
export const LEAD = 8;
export const neutral = () => [0, 0, 0];
export function validPad(p) {
  return Array.isArray(p) && p.length === 3 && p.every(Number.isInteger) &&
    p[0] >= 0 && p[0] <= 65535 && !(p[0] & 0x1000) && Math.abs(p[1]) <= 80 && Math.abs(p[2]) <= 80;
}
export class Lockstep {
  constructor(host, seat) {
    this.host = host; this.seat = seat; this.tick = 0; this.sampleTick = 0; this.commitTick = 0;
    this.inputs = [new Map(), new Map()]; this.frames = new Map();
  }
  sample(read) {
    const rows = [];
    // Two 60 Hz frames in each 30 Hz relay message. Bounded lead prevents
    // a suspended tab from growing an unbounded queue on the other machine.
    for (let n = 0; n < 2 && this.sampleTick < this.tick + LEAD; n++) {
      const pad = read();
      if (!validPad(pad)) throw new Error('Invalid local controller input');
      const t = this.sampleTick++;
      this.inputs[this.seat].set(t, pad);
      rows.push([t, pad]);
    }
    return rows;
  }
  receiveInputs(seat, rows) {
    if (!this.host || seat === this.seat || !Array.isArray(rows) || rows.length > 2) throw new Error('Invalid input packet');
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 2) throw new Error('Invalid input frame');
      const [t, pad] = row;
      if (!Number.isInteger(t) || t < 0 || t > this.tick + LEAD * 2 || !validPad(pad)) throw new Error('Invalid input frame');
      if (t >= this.commitTick && !this.inputs[seat].has(t)) this.inputs[seat].set(t, pad);
    }
  }
  commit() {
    const rows = [];
    while (rows.length < 2 && this.inputs.every(m => m.has(this.commitTick))) {
      const t = this.commitTick++;
      const pads = this.inputs.map(m => { const p = m.get(t); m.delete(t); return p; });
      this.frames.set(t, pads); rows.push([t, ...pads]);
    }
    return rows;
  }
  receiveFrames(rows) {
    if (this.host || !Array.isArray(rows) || rows.length > 2) throw new Error('Invalid timeline packet');
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 3 || row[0] !== this.commitTick ||
          row[0] > this.tick + LEAD * 2 || !validPad(row[1]) || !validPad(row[2])) throw new Error('Invalid timeline frame');
      // The host cannot replace the guest's chosen input silently.
      const own = this.inputs[this.seat].get(row[0]);
      if (!own || own.some((v, i) => v !== row[this.seat + 1][i])) throw new Error('Host changed your input');
      this.inputs[this.seat].delete(row[0]);
      this.frames.set(this.commitTick++, row.slice(1));
    }
  }
  take() {
    const pads = this.frames.get(this.tick);
    if (!pads) return null;
    this.frames.delete(this.tick++);
    return pads;
  }
}
