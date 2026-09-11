import {Lockstep, PROTOCOL} from './lockstep.mjs';

export class DuelSession {
  constructor({room, round, fighter, build, readInput, launch, status, stop}) {
    Object.assign(this, {room, round, fighter, build, readInput, launch, status, stop});
    this.players = room.players.map(p => p.id);
    this.seat = this.players.indexOf(room.me);
    if (this.players.length !== 2 || this.seat < 0) throw new Error('A duel requires two human players');
    this.host = room.isHost; this.peer = this.players[1-this.seat];
    this.line = new Lockstep(this.host, this.seat);
    this.localHashes = new Map(); this.remoteHashes = new Map(); this.checks = [];
    this.lastMessage = Date.now(); this.lastProgress = Date.now(); this.lastHello = 0;
    this.message = e => { if (e.from !== this.peer || e.data?.round !== this.round || this.closed) return;
      try { this.receive(e.data); } catch (error) { this.fail(error.message); } };
    room.on('message', this.message);
    this.timer = setInterval(() => { try { this.pulse(); } catch (e) { this.fail(e.message); } }, 1000/30);
    this.pulse();
  }
  receive(data) {
    if (data.p !== PROTOCOL) throw new Error('Opponent is using an incompatible game version');
    this.lastMessage = Date.now();
    if (data.type === 'hello') {
      if (data.build !== this.build || !Number.isInteger(data.fighter) || data.fighter < 0 || data.fighter > 11) throw new Error('Both players must use the same game build');
      if (this.otherFighter !== undefined && this.otherFighter !== data.fighter) throw new Error('Opponent changed fighter during the round');
      this.otherFighter = data.fighter;
      if (!this.launched) {
        this.launched = true;
        const fighters = this.seat === 0 ? [this.fighter,data.fighter] : [data.fighter,this.fighter];
        this.launch(fighters, this);
      }
    } else if (data.type === 'packet') {
      if (!Array.isArray(data.checks) || data.checks.length > 4) throw new Error('Invalid match checks');
      this.peerReady = data.ready === true;
      if (this.host) this.line.receiveInputs(1-this.seat, data.rows);
      else this.line.receiveFrames(data.rows);
      for (const check of data.checks) {
        if (!Array.isArray(check) || check.length !== 3 || !check.every(Number.isInteger) ||
            check[0] < 0 || check[0] > this.line.tick + 180 || check[1] < 0 || check[1] > 0xffffffff || check[2] < -1 || check[2] > 2) throw new Error('Invalid match check');
        this.remoteHashes.set(check[0], check);
        this.compare(check[0]);
      }
    } else if (data.type === 'abort') {
      throw new Error('Opponent could not continue the synchronized match');
    }
  }
  send(data) { this.room.send({p:PROTOCOL,round:this.round,...data}, this.peer); }
  pulse() {
    if (this.closed) return;
    const now = Date.now();
    if (now - this.lastMessage > 45000 || (this.engineReady && this.peerReady && !this.reported && now - this.lastProgress > 20000)) return this.fail('Connection stalled. Please find another match.');
    // Repeat boot metadata to cover the first ready event arriving before
    // the other client's findMatch continuation installs its listeners.
    if (!this.peerReady && now - this.lastHello >= 1000) {
      this.lastHello = now; this.send({type:'hello',build:this.build,fighter:this.fighter});
    }
    if (!this.launched) return;
    let rows = [];
    if (this.engineReady && this.peerReady && !this.terminal) {
      const samples = this.line.sample(this.readInput);
      rows = this.host ? this.line.commit() : samples;
    }
    this.send({type:'packet', ready:!!this.engineReady, rows, checks:this.checks.splice(0,4)});
  }
  beforeTick() {
    if (this.closed || this.terminal || !this.engineReady || !this.peerReady) return null;
    return this.line.take();
  }
  afterTick(hash, result, stocks0, stocks1, battleTicks) {
    if (this.closed) return;
    this.lastProgress = Date.now();
    this.status(`Round ${this.round} · ${this.seat === 0 ? 'P1' : 'P2'} · ${Math.max(0,480-Math.floor(battleTicks/60))}s remaining`);
    if (this.line.tick % 60 === 0 || result >= 0) {
      const check = [this.line.tick,hash >>> 0,result];
      this.localHashes.set(check[0],check); this.checks.push(check);
      if (result >= 0) this.terminal = {check, stocks:[stocks0,stocks1]};
      this.compare(check[0]);
      // Only bounded audit history is needed during a match.
      for (const map of [this.localHashes,this.remoteHashes]) for (const t of map.keys()) if (t < this.line.tick-600) map.delete(t);
    }
  }
  compare(tick) {
    const a = this.localHashes.get(tick), b = this.remoteHashes.get(tick);
    if (!a || !b || this.reported) return;
    if (a[1] !== b[1] || a[2] !== b[2]) return this.fail('The game states diverged. This match cannot report a valid result.');
    if (a[2] < 0) return;
    this.reported = true;
    const result = a[2] === 2 ? {draw:true} : {winner:this.players[a[2]]};
    result.scores = Object.fromEntries(this.players.map((id,i) => [id,Math.max(0,this.terminal.stocks[i])]));
    this.status('Match complete. Confirming result with YouGame…');
    this.room.finish(result).catch(e => this.fail(`Result could not be confirmed: ${e.message}`));
  }
  fail(message) {
    if (this.closed) return;
    try { this.send({type:'abort'}); } catch {}
    this.destroy(); this.stop(message);
  }
  destroy() { if (this.closed) return; this.closed = true; clearInterval(this.timer); this.room.off('message',this.message); }
}
