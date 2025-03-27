// Importa le dipendenze
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

// Inizializza l'app Express
const app = express();
const PORT = process.env.PORT || 8080;

// URL dell'interfaccia web di n8n
const N8N_URL = process.env.N8N_URL || 'https://flag-christ-breast-latest.trycloudflare.com';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://flag-christ-breast-latest.trycloudflare.com/webhook/123abc';

// Middleware per parsing del body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Inizializza client Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Route principale - reindirizza a n8n
app.get('/', (req, res) => {
  console.log('Richiesta alla homepage, reindirizzamento a n8n');
  res.redirect(N8N_URL);
});

// Una route di status per verificare funzionamento senza redirect
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'WhatsApp Bot',
    n8n_url: N8N_URL,
    webhook_url: N8N_WEBHOOK_URL
  });
});

// Webhook per ricevere messaggi da Twilio WhatsApp
app.post('/webhook', async (req, res) => {
  console.log('Webhook WhatsApp chiamato');
  
  try {
    // Estrai i dati dal messaggio WhatsApp
    const incomingMsg = req.body.Body || '';
    const sender = req.body.From || '';
    
    console.log(`Messaggio ricevuto da ${sender}: ${incomingMsg}`);
    
    // Prepara i dati da inviare a n8n
    const n8nData = {
      message: incomingMsg,
      sender: sender,
      timestamp: new Date().toISOString(),
      platform: 'whatsapp',
      twilioData: req.body
    };
    
    try {
      // Invia i dati a n8n e attendi la risposta
      console.log(`Inoltro a n8n: ${N8N_WEBHOOK_URL}`);
      const axios = require('axios');
      const n8nResponse = await axios.post(N8N_WEBHOOK_URL, n8nData);
      console.log('Risposta da n8n:', n8nResponse.data);
      
      // Estrai la risposta da n8n
      let responseMsg = 'Grazie per il tuo messaggio.';
      
      if (n8nResponse.data && n8nResponse.data.responseMessage) {
        responseMsg = n8nResponse.data.responseMessage;
      } else {
        // Fallback di risposta se n8n non fornisce una risposta specifica
        if (incomingMsg.toLowerCase().includes('ciao')) {
          responseMsg = 'Ciao! Sono il tuo chatbot WhatsApp. Come posso aiutarti?';
        } else if (incomingMsg.toLowerCase().includes('aiuto')) {
          responseMsg = 'Puoi chiedermi informazioni su orario, meteo, o altro.';
        }
      }
      
      // Invia la risposta tramite Twilio
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message(responseMsg);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(twiml.toString());
      
    } catch (n8nError) {
      console.error('Errore nella comunicazione con n8n:', n8nError.message);
      
      // In caso di errore con n8n, rispondi con un messaggio predefinito
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message('Grazie per il tuo messaggio. Il nostro sistema sta elaborando la tua richiesta.');
      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(twiml.toString());
    }
    
  } catch (error) {
    console.error('Errore nella gestione del webhook:', error);
    // Invia comunque una risposta valida per Twilio
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(new twilio.twiml.MessagingResponse().toString());
  }
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
  console.log(`Reindirizzamento da / a: ${N8N_URL}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`n8n Webhook configurato: ${N8N_WEBHOOK_URL}`);
});