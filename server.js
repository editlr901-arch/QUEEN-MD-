const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    disconnectReason 
} = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require("cors");
const pino = require("pino");

const app = express();
app.use(cors());
app.use(express.json());

let sock;
const MY_NUMBER = "94772398287";

async function startRD_AI_Bot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Automatically Request Pair Code if not logged in
    if (!sock.authState.creds.registered) {
        console.log(`[RD AI] Generating Pair Code for: ${MY_NUMBER}`);
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(MY_NUMBER);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n----------------------------`);
                console.log(`✅ YOUR PAIR CODE: ${code}`);
                console.log(`----------------------------\n`);
            } catch (err) {
                console.log("Error generating pair code: ", err);
            }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log("✅ RD AI BOT IS ONLINE");
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== disconnectReason.loggedOut;
            if (shouldReconnect) startRD_AI_Bot();
        }
    });
}

// API for Website
app.post("/api/react", async (req, res) => {
    const { channelLink, emoji, amount } = req.body;
    console.log(`[REQUEST] Reacting ${emoji} (${amount}) to ${channelLink}`);
    
    // Automation Logic Here
    res.json({ status: "success", message: "Task started successfully!" });
});

app.listen(10000, () => {
    console.log("Server running on port 10000");
    startRD_AI_Bot();
});