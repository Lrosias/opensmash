/** OpenSmash GameCubeAdapter compatibility facade. Game-specific converters stay in OpenSmash. */
const neutral = (port, source = {}) =>
  Object.freeze({
    ...source,
    port,
    seat: port,
    connected: false,
    type: null,
    buttons: 0,
    axes: Object.freeze([128, 128, 128, 128]),
    triggers: Object.freeze([0, 0]),
    origin: Object.freeze(Array.from(source.origin || [128, 128, 128, 128, 0, 0])),
    calibrationRevision: source.calibrationRevision || 0,
  });
const empty = () => ({
  owned: false,
  stale: true,
  suspended: false,
  sequence: 0,
  receivedAt: 0,
  ports: Array.from({ length: 4 }, (_, i) => neutral(i)),
});
export class PlatformGameCubeAdapter {
  constructor({ sdk = globalThis.YouGame, fallbackFactory = null } = {}) {
    this.sdk = sdk;
    this.fallbackFactory = fallbackFactory;
    this.direct = null;
    this.mode = null;
    this.suspended = false;
    this.listeners = new Set();
    this.last = empty();
    this.localMessage = "Connect a GameCube adapter in YouGame Controls.";
    this.pending = false;
    this.dead = false;
    this.off = sdk?.controllers?.on("change", () => {
      const s = this.refresh();
      const key = JSON.stringify([
        s.state,
        s.owned,
        s.message,
        s.ports.map((p) => [p.connected, p.type, p.calibrationRevision]),
      ]);
      if (key !== this.statusKey) {
        this.statusKey = key;
        this.emit();
      }
    });
    this.offError = sdk?.controllers?.on("error", (e) => {
      this.localMessage = e.message;
      this.emit();
    });
  }
  get hosted() {
    return this.mode === "host" || (!this.direct && !!this.sdk?.controllers?.capabilities().host);
  }
  select() {
    if (this.mode) return;
    if (this.sdk?.controllers?.capabilities().host) this.mode = "host";
    else if (this.sdk?.mode !== "connecting" && this.fallbackFactory) {
      this.mode = "direct";
      this.direct = this.fallbackFactory();
      this.offDirect = this.direct.subscribe(() => this.emit());
    }
  }
  refresh(diagnostic = true) {
    this.select();
    if (this.direct) return this.direct.snapshot({ diagnostic });
    const s = this.hosted ? this.sdk.controllers.snapshot({ diagnostic }) : empty();
    // Physical port order is invariant even if the platform's ordinary gamepad seats are reassigned.
    this.last = {
      ...s,
      ports: Array.from(
        { length: 4 },
        (_, port) => s.ports.find((p) => p.port === port) || neutral(port),
      ),
    };
    return this.last;
  }
  get owned() {
    return this.refresh().owned;
  }
  get origins() {
    const s = this.refresh();
    if (this.direct) return this.direct.origins;
    return s.ports.map((p) => Array.from(p.origin || [128, 128, 128, 128, 0, 0]));
  }
  get device() {
    if (this.direct) return this.direct.device;
    const s = this.refresh();
    return s.owned && s.state === "connected" ? { platform: true } : null;
  }
  get busy() {
    return this.direct ? this.direct.busy : this.pending;
  }
  get state() {
    return this.direct ? this.direct.state : this.refresh().state || "idle";
  }
  get message() {
    return this.direct ? this.direct.message : this.refresh().message || this.localMessage;
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const f of [...this.listeners]) f();
  }
  snapshot({ diagnostic = false } = {}) {
    const s = this.refresh(diagnostic);
    if (this.suspended && !diagnostic)
      return { ...s, suspended: true, ports: s.ports.map((p, i) => neutral(i, p)) };
    return s;
  }
  suspend(value) {
    this.suspended = !!value;
    this.direct?.suspend(value);
  }
  async connect() {
    this.select();
    if (this.dead) return;
    if (this.direct) return this.direct.connect();
    if (!this.hosted) {
      this.localMessage = "YouGame is still connecting. Please try Connect again.";
      this.emit();
      return;
    }
    this.pending = true;
    this.emit();
    try {
      await this.sdk.controllers.connect({ kind: "gamecube-adapter" });
      this.localMessage = "Use Connect adapter in YouGame Controls.";
    } finally {
      this.pending = false;
      this.emit();
    }
  }
  async close(releaseOwnership = true) {
    if (this.direct) return this.direct.close(releaseOwnership);
    if (releaseOwnership && this.hosted) await this.sdk.controllers.disconnect();
  }
  async calibrate(port) {
    if (this.direct) return this.direct.calibrate(port);
    if (!this.hosted) throw Error("No connected adapter");
    return this.sdk.controllers.calibrate(port);
  }
  async resetCalibration() {
    if (this.direct) return this.direct.resetCalibration();
    if (this.hosted) return this.sdk.controllers.resetCalibration();
  }
  async destroy() {
    this.dead = true;
    this.off?.();
    this.offError?.();
    this.offDirect?.();
    this.listeners.clear();
    if (this.direct) await this.direct.destroy();
  }
}
export function createOpenSmashAdapter(DirectAdapter, sdk = globalThis.YouGame) {
  return new PlatformGameCubeAdapter({ sdk, fallbackFactory: () => new DirectAdapter() });
}
