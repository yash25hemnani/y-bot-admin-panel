import { WebSocket } from "ws";
import { createHmac } from "crypto";

// Read from env vars, not command-line args, so the secret doesn't end up in your shell history.
const DEVICE_ID = process.env.DEVICE_ID ?? "";
const HMAC_SECRET = process.env.HMAC_SECRET ?? "";
const URL = process.env.WS_URL ?? "ws://localhost:4000/device";

if (!DEVICE_ID || !HMAC_SECRET) {
  console.error("Set DEVICE_ID and HMAC_SECRET");
  process.exit(1);
}

const ws = new WebSocket(URL);

ws.on("message", (data) => {
  const text = data.toString();
  console.log("<-", text);

  if (text.startsWith("auth:challenge:")) {
    const nonce = text.slice("auth:challenge:".length);
    const sig = createHmac("sha256", HMAC_SECRET).update(`${DEVICE_ID}:${nonce}`).digest("hex");
    ws.send(`auth:login:${DEVICE_ID}:${sig}`);
    console.log("-> auth:login:<id>:<sig>"); // never print the signature or secret
  }

  if (text === "auth:ok") ws.send("ok:hello from fake robot");
});

ws.on("close", (code, reason) => console.log(`closed ${code} ${reason}`));
