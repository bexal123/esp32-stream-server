const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const port = process.env.PORT || 10000; 
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server attivo!');
});

const wss = new WebSocket.Server({ server });
let esp32Socket = null;
let contatoreBrowser = 0;

const CHIAVE_SICUREZZA = "Stocazzo@123";

wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const role = parameters.role;
    const token = parameters.token;

    if (token !== CHIAVE_SICUREZZA) {
        console.log("Tentativo di connessione rifiutato: Chiave errata o mancante.");
        ws.close(); 
        return; 
    }

    if (role === 'esp32') {
        esp32Socket = ws;
        console.log('ESP32-CAM connesso.');
        
        // Se c'è già un browser in attesa, ordina subito all'ESP32 di partire
        if (contatoreBrowser > 0) {
            console.log("Browser già presente. Invio START a ESP32.");
            ws.send('START');
        }

        // CORREZIONE CRITICA: L'ascoltatore dei messaggi deve essere registrato QUI
        ws.on('message', (message) => {
            let stringaBase64 = "";
            if (Buffer.isBuffer(message)) {
                stringaBase64 = message.toString('utf-8');
            } else {
                stringaBase64 = message;
            }

            // Inoltra il testo a tutti i browser connessi
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(stringaBase64); 
                }
            });
        });

        ws.on('close', () => {
            console.log('ESP32-CAM disconnesso.');
            esp32Socket = null;
        });

    } else if (role === 'browser') {
        contatoreBrowser++;
        console.log(`PC connesso. Spettatori: ${contatoreBrowser}`);

        // Se è il primo browser e l'ESP32 è già online, dagli il via
        if (contatoreBrowser === 1 && esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
            console.log("Primo browser connesso. Invio START a ESP32.");
            esp32Socket.send('START');
        }

        ws.on('close', () => {
            contatoreBrowser--;
            console.log(`PC disconnesso. Spettatori: ${contatoreBrowser}`);
            if (contatoreBrowser === 0 && esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
                esp32Socket.send('STOP');
            }
        });
    } else {
        ws.close();
    }
});

server.listen(port, () => {
    console.log(`Server in ascolto sulla porta ${port}`);
});
