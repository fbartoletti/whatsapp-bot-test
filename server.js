// Importa le dipendenze
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const twilio = require('twilio');

// Inizializza l'app Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware per parsing del body - IMPORTANTE: modifica l'ordine per accettare più formati
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Cambiato in true

// Middleware per loggare tutte le richieste
app.use((req, res, next) => {
  console.log('----------------------------------');
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  console.log('----------------------------------');
  next();
});

// Inizializza client Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Route principale per verificare che il server funzioni
app.get('/', (req, res) => {
  console.log('Richiesta alla route principale /');
  res.send('Il server del WhatsApp Bot è attivo!');
});

// Endpoint di test semplice
app.get('/test', (req, res) => {
  console.log('Test endpoint chiamato!');
  res.send('Test ok!');
});

// Endpoint di test per POST
app.post('/test', (req, res) => {
  console.log('Test POST endpoint chiamato!');
  console.log('Body ricevuto:', req.body);
  res.status(200).send('Test POST ok!');
});

// Webhook per ricevere messaggi da Twilio WhatsApp
app.post('/webhook', (req, res) => {
  console.log('Webhook chiamato!');
  console.log('Headers completi:', JSON.stringify(req.headers));
  console.log('Body completo:', JSON.stringify(req.body));
  
  try {
    // Estrai il messaggio e il mittente
    let incomingMsg = '';
    let sender = '';
    
    // Controlla diversi formati possibili
    if (req.body.Body) {
      incomingMsg = req.body.Body;
      sender = req.body.From;
    } else if (req.body.body) {
      incomingMsg = req.body.body;
      sender = req.body.from;
    } else if (req.body.message) {
      incomingMsg = req.body.message;
      sender = req.body.sender;
    }
    
    console.log(`Messaggio estratto: "${incomingMsg}" da ${sender}`);
    
    // Logica semplice di risposta
    let responseMsg = 'Grazie per il tuo messaggio. Questo è un bot di test.';
    
    // Personalizza la risposta in base al contenuto
    if (incomingMsg.toLowerCase().includes('ciao')) {
      responseMsg = 'Ciao! Sono il tuo chatbot WhatsApp di test. Come posso aiutarti?';
    } else if (incomingMsg.toLowerCase().includes('aiuto')) {
      responseMsg = 'Questo è un bot di test. Puoi provare a scrivere: ciao, info, test';
    } else if (incomingMsg.toLowerCase().includes('info')) {
      responseMsg = 'Questo bot è stato creato come proof of concept per testare self-hosting con Render.';
    }
    
    console.log(`Risposta che verrà inviata: "${responseMsg}"`);
    
    // Crea la risposta in formato TwiML (formato XML di Twilio)
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(responseMsg);
    
    // Invia la risposta
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  } catch (error) {
    console.error('Errore nella gestione del webhook:', error);
    // Invia comunque una risposta HTTP 200 per evitare che Twilio continui a riprovare
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(new twilio.twiml.MessagingResponse().toString());
  }
});

// Rotta per inviare messaggi manualmente (utile per test)
app.post('/send-message', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'I parametri "to" e "message" sono obbligatori' 
      });
    }
    
    // Formatta il numero destinatario nel formato WhatsApp di Twilio
    const recipient = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    // Invia il messaggio tramite API Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: recipient
    });
    
    console.log('Messaggio inviato:', result.sid);
    res.json({ success: true, messageId: result.sid });
  } catch (error) {
    console.error('Errore nell\'invio del messaggio:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Gestisci tutte le altre richieste
app.use('*', (req, res) => {
  console.log(`Richiesta non gestita: ${req.method} ${req.originalUrl}`);
  res.status(404).send('Endpoint non trovato');
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
  console.log(`Test URL: http://localhost:${PORT}/test`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});
