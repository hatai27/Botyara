// MellChat Discord -> Main bridge
// npm i discord.js   (Node 18+)
// Запуск: DISCORD_TOKEN=... CHANNEL_ID=... FIREBASE_URL=... FIREBASE_SECRET=... node bot.js

const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");

// Мини HTTP-сервер: нужен Render (Web Service) и для пинга через UptimeRobot
http
  .createServer((req, res) => res.end("ok"))
  .listen(process.env.PORT || 3000);

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;           // ID канала (#chanel)
const FIREBASE_URL = process.env.FIREBASE_URL;       // https://xxx.firebaseio.com/
const FIREBASE_SECRET = process.env.FIREBASE_SECRET; // НОВЫЙ секрет
const MAX_LENGTH = 1000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Достаём инфу об сообщении, на которое ответили в Discord
async function getReply(msg) {
  if (!msg.reference?.messageId) return null;
  try {
    const ref = await msg.fetchReference();
    let sender, text;
    const emb = ref.embeds?.[0];
    if (ref.webhookId && emb?.author) {
      // сообщение из Roblox (через вебхук): "Ник  •  Role"
      sender = emb.author.name.split("  •  ")[0];
      text = emb.description || "";
    } else {
      sender = ref.member?.displayName ?? ref.author.globalName ?? ref.author.username;
      text = ref.cleanContent || "";
    }
    return { Sender: sender, Text: text.slice(0, 50) };
  } catch {
    return null;
  }
}

client.on("messageCreate", async (msg) => {
  if (msg.channelId !== CHANNEL_ID) return;
  if (msg.webhookId || msg.author.bot) return; // не зацикливаемся на вебхуке из Roblox

  let text = msg.cleanContent || "";
  for (const a of msg.attachments.values()) text += (text ? "\n" : "") + a.url;
  text = text.trim().slice(0, MAX_LENGTH);
  if (!text) return;

  const body = {
    Sender: msg.member?.displayName ?? msg.author.globalName ?? msg.author.username,
    UserId: 0,
    Source: "discord",
    DiscordId: msg.author.id,
    AvatarUrl: msg.member?.displayAvatarURL({ extension: "png", size: 128 })
      ?? msg.author.displayAvatarURL({ extension: "png", size: 128 }),
    Role: "Discord",
    Admin: false,
    Time: Math.floor(Date.now() / 1000),
    Ts: { ".sv": "timestamp" },
    Type: "text",
    Text: text,
  };
  const reply = await getReply(msg);
  if (reply) body.ReplyTo = reply;

  try {
    const res = await fetch(`${FIREBASE_URL}SMS.json?auth=${FIREBASE_SECRET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("Firebase error", res.status, await res.text());
  } catch (e) {
    console.error("Send failed", e);
  }
});

client.once("clientReady", () => console.log("Bridge online:", client.user.tag));
console.log(
  "ENV check:",
  "TOKEN", TOKEN ? `ok (${TOKEN.length} симв.)` : "ПУСТО",
  "| CHANNEL_ID", CHANNEL_ID ? "ok" : "ПУСТО",
  "| FIREBASE_URL", FIREBASE_URL ? "ok" : "ПУСТО",
  "| SECRET", FIREBASE_SECRET ? "ok" : "ПУСТО"
);

client.on("error", (e) => console.error("Client error:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));

client.login(TOKEN).catch((e) => console.error("LOGIN FAILED:", e.code || "", e.message));
