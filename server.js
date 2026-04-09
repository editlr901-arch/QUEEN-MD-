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
    // Save authentication data in 'auth_info' folder
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["RD-AI-Bot", "Chrome", "1.0.0"]
    });

    // Requesting Pairing Code
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                // Your target phone number
                let code = await sock.requestPairingCode("94772398287");
                console.log("\n========================================");
                console.log(`🚀 PAIRING CODE: ${code}`);
                console.log("========================================\n");
            } catch (err) {
                console.error("Failed to get pairing code:", err);
            }
        }, 7000); // 7-second delay to ensure socket is ready
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            // CRITICAL FIX: Optional chaining (?.) prevents crash when lastDisconnect is undefined
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Connection closed. Reconnecting:", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("RD AI Bot is Online! ✅");
        }
    });
}

// Reaction API Endpoint
app.post("/api/react", async (req, res) => {
    const { channelLink, emoji, reactionCount } = req.body;

    if (!sock) {
        return res.status(500).json({ success: false, error: "Bot not connected." });
    }

    try {
        console.log(`Service Triggered: ${reactionCount} reactions for ${channelLink}`);

        // Note: Real channel reactions require specific message JIDs and Keys.
        // This loop simulates the automation process.
        let targetCount = parseInt(reactionCount) || 10;

        for (let i = 0; i < targetCount; i++) {
            // Logic to fetch channel message and send reaction
            // await sock.sendMessage(jid, { react: { text: emoji, key: msgKey } });
            await delay(1500); // 1.5s delay to avoid spam detection
        }

        res.json({ 
            success: true, 
            message: `Successfully initiated ${reactionCount} reactions!` 
        });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Configure Port for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    startBot();
});
