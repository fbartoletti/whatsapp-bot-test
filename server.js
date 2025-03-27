// Importa le dipendenze
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const twilio = require('twilio');

// Inizializza l'app Express
const app = express();
const PORT = process.env.PORT || 8080;

// URL del webhook n8n - SOSTITUISCI CON IL TUO URL CLOUDFLARE TUNNEL + PERCORSO WEBHOOK
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://your-tunnel-url.trycloudflare.com/webhook/123abc';

// Middleware per parsing del body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Inizializza client Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Route principale per verificare che il server funzioni
app.get('/', (req, res) => {
  res.send('Il server del WhatsApp Bot è attivo! Integrazione con n8n configurata.');
});

// Webhook per ricevere messaggi da Twilio WhatsApp e inoltrarli a n8n
app.post('/webhook', async (req, res) => {
  console.log('Webhook WhatsApp chiamato');
  
  try {
    // Estrai i dati dal messaggio WhatsApp
    const incomingMsg = req.body.Body || '';
    const sender = req.body.From || '';
    const profileName = req.body.ProfileName || '';
    
    console.log(`Messaggio ricevuto da ${sender}: ${incomingMsg}`);
    
    // Prepara i dati da inviare a n8n
    const n8nData = {
      message: incomingMsg,
      sender: sender,
      profileName: profileName,
      timestamp: new Date().toISOString(),
      platform: 'whatsapp',
      twilioData: req.body
    };
    
    try {
      // Invia i dati a n8n e attendi la risposta
      console.log(`Inoltro a n8n: ${N8N_WEBHOOK_URL}`);
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

// Rotta per inviare messaggi proattivi (può essere chiamata da n8n)
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

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`n8n Webhook configurato: ${N8N_WEBHOOK_URL}`);
});
