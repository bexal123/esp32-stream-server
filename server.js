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
//____________________________________
// CHIAVE SEGRETA PERSONALIZZATA
const CHIAVE_SICUREZZA = "Stocazzo@123";
//____________________________________
wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const role = parameters.role;
    const token = parameters.token; // <--- Legge il token inviato dall'URL

    // --- BLOCCO DI SICUREZZA: Controlla se la chiave è corretta ---
    if (token !== CHIAVE_SICUREZZA) {
        console.log("Tentativo di connessione rifiutato: Chiave errata o mancante.");
        ws.close(); 
        return; 
    }

 if (role === 'esp32') {
        ws.on('message', (message) => {
            // Converte il Buffer ricevuto da Python in stringa Base64 pulita
            const stringaBase64 = message.toString('utf-8');

            wss.clients.forEach((client) => {
                // Invia la stringa come testo puro a tutti i browser connessi
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(stringaBase64); 
                }
            });
        });
    }

    } else if (role === 'browser') {
        contatoreBrowser++;
        console.log(`PC connesso. Spettatori: ${contatoreBrowser}`);

        if (contatoreBrowser === 1 && esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
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

    if (role === 'esp32') {
        ws.on('message', (message) => {
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message); 
                }
            });
        });
    }
});

server.listen(port);
