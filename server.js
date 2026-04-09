const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    delay, 
    pino 
} = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let sock;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["RD AI", "Chrome", "1.0.0"]
    });

    // Requesting Pairing Code
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode("94772398287");
                console.log(`\n🚀 YOUR PAIRING CODE: ${code}\n`);
            } catch (err) {
                console.error("Pairing Error:", err);
            }
        }, 8000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("RD AI Bot Online! ✅");
        }
    });
}

// THE CHANNEL REACTION SERVICE ENDPOINT
app.post("/api/react", async (req, res) => {
    const { channelLink, emoji } = req.body;

    if (!sock) return res.status(500).json({ success: false, error: "Bot not connected." });

    try {
        // 1. Get the Channel ID from the Invite Link
        const inviteCode = channelLink.split("channel/")[1];
        if (!inviteCode) throw new Error("Invalid Channel Link.");

        console.log(`Fetching metadata for: ${inviteCode}`);
        const newsletterMeta = await sock.newsletterMetadata("invite", inviteCode);
        const channelJid = newsletterMeta.id;

        // 2. Fetch the most recent message from the channel
        const messages = await sock.newsletterMessages("updates", channelJid, { limit: 1 });
        const lastMsg = messages[0];

        if (!lastMsg) throw new Error("No messages found in this channel to react to.");

        // 3. Construct the Message Key for Reaction
        const msgKey = {
            remoteJid: channelJid,
            fromMe: false,
            id: lastMsg.id
        };

        // 4. Send the Reaction
        await sock.sendMessage(channelJid, {
            react: {
                text: emoji || "👍",
                key: msgKey
            }
        });

        console.log(`Successfully reacted ${emoji} to channel: ${channelJid}`);
        res.json({ success: true, message: "Reaction sent successfully!" });

    } catch (err) {
        console.error("Service Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    startBot();
});
