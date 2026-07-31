const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const port = process.env.PORT || 10000; 
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server di streaming attivo!');
});

const wss = new WebSocket.Server({ server });

let esp32Socket = null;
let contatoreBrowser = 0;

wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const role = parameters.role;

    // Gestione degli errori sulla singola connessione per evitare crash del server
    ws.on('error', (err) => console.error('Errore socket:', err.message));

    if (role === 'esp32') {
        esp32Socket = ws;
        console.log('ESP32-CAM connesso su Render.');
        
        // Se c'erano già browser in attesa, dice all'ESP32 di partire subito
        if (contatoreBrowser > 0) {
            ws.send('START');
        }

        // Ascolta i messaggi dell'ESP32 e li invia SOLO ai browser
        ws.on('message', (message) => {
            wss.clients.forEach((client) => {
                // Invia il frame solo se il client è aperto e NON è l'ESP32 stesso
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    // Il blocco try-catch previene il crash se il browser si disconnette a metà invio
                    try {
                        client.send(message); 
                    } catch (e) {
                        console.error('Errore invio al browser:', e.message);
                    }
                }
            });
        });

        ws.on('close', () => {
            console.log('ESP32-CAM disconnesso.');
            esp32Socket = null;
        });

    } else if (role === 'browser') {
        contatoreBrowser++;
        console.log(`PC connesso. Spettatori totali: ${contatoreBrowser}`);

        // Se è il primo browser, sveglia l'ESP32
        if (contatoreBrowser === 1 && esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
            esp32Socket.send('START');
        }

        ws.on('close', () => {
            contatoreBrowser--;
            console.log(`PC disconnesso. Spettatori rimanenti: ${contatoreBrowser}`);
            
            // Se non ci sono più spettatori, ferma l'ESP32 per risparmiare banda
            if (contatoreBrowser === 0 && esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
                esp32Socket.send('STOP');
            }
        });
    } else {
        // Chiude la connessione se il ruolo non è valido
        ws.close();
    }
});

server.listen(port, () => {
    console.log(`Server WebSocket in ascolto sulla porta ${port}`);
});
