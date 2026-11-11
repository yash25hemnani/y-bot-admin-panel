import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Device } from "../db/models";
import { logger } from "../utils/logger";

const AUTH_TIMEOUT_MS = 5000;
const HEARTBEAT_MS = 15000;

// isAlive: set false before each ping, back to true when the pong arrives
type DeviceSocket = WebSocket & { isAlive?: boolean };

// deviceId -> live socket. The admin panel will use this later to send commands.
export const onlineDevices = new Map<string, WebSocket>();

// Must match the robot exactly: hex(HMAC-SHA256(key = hmacSecret, msg = "deviceId:nonce"))
function sign(secret: string, deviceId: string, nonce: string): string {
  return createHmac("sha256", secret)
    .update(`${deviceId}:${nonce}`)
    .digest("hex");
}

// Constant-time compare, so an attacker can't guess the signature byte by byte from response timing.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Returns the deviceId if the login is valid, otherwise null. Never logs the signature or secret.
async function verifyLogin(
  text: string,
  nonce: string,
): Promise<string | null> {
  const parts = text.split(":");
  if (parts.length !== 4 || parts[0] !== "auth" || parts[1] !== "login")
    return null;

  const [, , deviceId, sig] = parts;
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;

  const device = await Device.findOne({ where: { deviceId } });
  if (!device || device.isRevoked) return null;

  return safeEqual(sign(device.hmacSecret, deviceId, nonce), sig)
    ? deviceId
    : null;
}

export function sendToDevice(deviceId: string, text: string): boolean {
  const ws = onlineDevices.get(deviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(text);
  return true;
}

// Force a robot offline (revoked / secret rotated / deleted). Its close handler cleans up onlineDevices.
export function disconnectDevice(deviceId: string, reason: string): void {
  onlineDevices.get(deviceId)?.close(4005, reason);
}

export function attachDeviceSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/device",
    maxPayload: 1024,
  });

  wss.on("connection", (ws) => {
    const nonce = randomBytes(16).toString("hex"); // new for every connection
    let deviceId: string | null = null;
    let checking = false;

    (ws as DeviceSocket).isAlive = true;
    ws.on("pong", () => ((ws as DeviceSocket).isAlive = true));

    // Drop sockets that don't log in quickly
    const timer = setTimeout(() => {
      if (!deviceId) ws.close(4001, "auth timeout");
    }, AUTH_TIMEOUT_MS);

    ws.send(`auth:challenge:${nonce}`);

    ws.on("message", async (data, isBinary) => {
      if (isBinary) return ws.close(4002, "text only");
      const text = data.toString();

      if (deviceId) {
        // Logged in: for now just log what the robot says (replies, status)
        logger.info({ deviceId, text }, "device message");
        return;
      }

      if (checking) return; // one login attempt at a time
      checking = true;

      try {
        const id = await verifyLogin(text, nonce);

        if (ws.readyState !== WebSocket.OPEN) return; // closed while we were checking the DB

        if (!id) {
          ws.send("auth:fail");
          return ws.close(4003, "auth failed");
        }

        clearTimeout(timer);
        deviceId = id;
        onlineDevices.get(id)?.close(4004, "replaced"); // same robot reconnected; drop the old socket
        onlineDevices.set(id, ws);
        ws.send("auth:ok");
        logger.info({ deviceId: id }, "device online");
      } catch (err) {
        logger.error({ err }, "device login error");
        ws.close(1011, "server error");
      }
    });

    ws.on("close", () => {
      clearTimeout(timer);
      // Only remove it if this socket is still the current one (it may have been replaced)
      if (deviceId && onlineDevices.get(deviceId) === ws) {
        onlineDevices.delete(deviceId);
        logger.info({ deviceId }, "device offline");
      }
    });
  });

  // Every HEARTBEAT_MS: drop sockets that didn't answer the last ping, ping the rest.
  // terminate() (not close()) because a dead robot never answers a polite close.
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const ws = client as DeviceSocket;
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);

  wss.on("close", () => clearInterval(heartbeat));
}
