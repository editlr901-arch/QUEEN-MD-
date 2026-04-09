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
    // Session data stored in 'auth_info'
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["RD-AI-Bot", "Chrome", "1.0.0"]
    });

    // Pairing Code Request
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode("94772398287");
                console.log("\n========================================");
                console.log(`🚀 YOUR PAIRING CODE: ${code}`);
                console.log("========================================\n");
            } catch (err) {
                console.error("Pairing Code Error:", err);
            }
        }, 7000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            // FIXED: Optional chaining (?.) to prevent the crash you had
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Connection closed. Reconnecting:", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("RD AI Bot is Online! ✅");
        }
    });
}

// Full Auto-Reaction API
app.post("/api/react", async (req, res) => {
    const { channelLink, emoji, reactionCount } = req.body;

    if (!sock) return res.status(500).json({ success: false, error: "Bot not connected." });

    try {
        // 1. Extract Invite Code from Link
        const inviteCode = channelLink.split("channel/")[1];
        if (!inviteCode) throw new Error("Invalid Channel Link.");

        // 2. Get Channel Metadata (JID)
        const newsletterMeta = await sock.newsletterMetadata("invite", inviteCode);
        const channelJid = newsletterMeta.id;

        // 3. Fetch the latest message from the channel
        const messages = await sock.newsletterMessages("updates", channelJid, { limit: 1 });
        const lastMsg = messages[0];

        if (!lastMsg) throw new Error("Could not find any messages in this channel.");

        const msgKey = {
            remoteJid: channelJid,
            fromMe: false,
            id: lastMsg.id
        };

        // 4. Send the reaction
        // (Note: To send 1K reactions, you'd need multiple accounts. 
        // This logic sends the reaction from your bot account)
        await sock.sendMessage(channelJid, {
            react: {
                text: emoji,
                key: msgKey
            }
        });

        console.log(`Reacted ${emoji} to channel: ${channelJid}`);

        res.json({ 
            success: true, 
            message: `Reaction ${emoji} sent to the latest message!` 
        });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    startBot();
});
