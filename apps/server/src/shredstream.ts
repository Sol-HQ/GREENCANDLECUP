import { createSocket, type Socket } from "node:dgram";

export type ShredStreamStatus = {
  configured: boolean;
  listening: boolean;
  active: boolean;
  bindHost: string;
  port: number | null;
  packetsTotal: number;
  packetsLastMinute: number;
  lastPacketAt: string | null;
  lastError: string | null;
};

const PACKET_WINDOW_MS = 60_000;
const ACTIVE_THRESHOLD = 1;

export class ShredStreamListener {
  private socket: Socket | null = null;
  private packetsTotal = 0;
  private recentPackets: number[] = [];
  private lastPacketAt: string | null = null;
  private lastError: string | null = null;
  private listening = false;

  constructor(
    private readonly port: number | null,
    private readonly bindHost = "0.0.0.0",
  ) {}

  start() {
    if (!this.port || this.socket) return;
    const socket = createSocket("udp4");
    socket.on("message", () => {
      const now = Date.now();
      this.packetsTotal += 1;
      this.recentPackets.push(now);
      this.lastPacketAt = new Date(now).toISOString();
      const cutoff = now - PACKET_WINDOW_MS;
      while (this.recentPackets.length && this.recentPackets[0]! < cutoff) {
        this.recentPackets.shift();
      }
    });
    socket.on("error", (error) => {
      this.lastError = error.message;
      this.listening = false;
    });
    socket.bind(this.port, this.bindHost, () => {
      this.listening = true;
      this.lastError = null;
    });
    this.socket = socket;
  }

  stop() {
    this.socket?.close();
    this.socket = null;
    this.listening = false;
  }

  getStatus(): ShredStreamStatus {
    const now = Date.now();
    const cutoff = now - PACKET_WINDOW_MS;
    this.recentPackets = this.recentPackets.filter((t) => t >= cutoff);
    const packetsLastMinute = this.recentPackets.length;
    return {
      configured: this.port != null,
      listening: this.listening,
      active: packetsLastMinute >= ACTIVE_THRESHOLD,
      bindHost: this.bindHost,
      port: this.port,
      packetsTotal: this.packetsTotal,
      packetsLastMinute,
      lastPacketAt: this.lastPacketAt,
      lastError: this.lastError,
    };
  }
}

export function resolveShredStreamPort(): number | null {
  const raw =
    process.env.SHREDSTREAM_UDP_PORT?.trim() ??
    process.env.TRITON_SHREDSTREAM_PORT?.trim();
  if (!raw) return null;
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 && port < 65536 ? port : null;
}
