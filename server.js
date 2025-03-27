// Importa le dipendenze
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

// Inizializza l'app Express
const app = express();
const PORT = process.env.PORT || 8080;

// URL dell'interfaccia web di n8n
const N8N_URL = process.env.N8N_URL || 'https://switched-perhaps-cancellation-stating.trycloudflare.com';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://switched-perhaps-cancellation-stating.trycloudflare.com/webhook/123abc';

// Configurazione di WhatsApp Business API di Meta
// IMPORTANTE: Sostituisci questi valori con i tuoi!
const WHATSAPP_TOKEN = 'EAAaN7D6jfa0BO51ti1ZA6pVJpIOfXaaZCmCA6gXRJVCvzmX3FTQV1nT6RNSQNaws07WOn138eoQTd1auEsJRWeP4eIsr3hYlcp9ZC4BZAiMZAHOKjAjVWIozX9q6BmsIqDDamRpLzlOBSdOajZBBvNVzByv3Yb2V7FwgZBcOP1HlkWCfE9ZBwQoP5xmfFcpqBEgZBtBzifyjuwdnpGw38lSZBbVyuhUvYqO3TDD7spxiay'; // Il token di accesso permanente di WhatsApp Business
const WHATSAPP_VERIFICATION_TOKEN = 'INSERISCI_IL_TUO_TOKEN_DI_VERIFICA_QUI'; // Il token che hai scelto per la verifica del webhook
const WHATSAPP_PHONE_ID = '531630253377684'; // L'ID del tuo numero di telefono WhatsApp Business

// Middleware per parsing del body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

// Webhook per la verifica WhatsApp (GET) e ricezione messaggi (POST)
app.get('/webhook', (req, res) => {
  console.log('Richiesta di verifica webhook WhatsApp');
  
  // Verifica se questa è una richiesta di verifica del webhook
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Controlla se il token corrisponde a quello che hai impostato
  if (mode === 'subscribe' && token === WHATSAPP_VERIFICATION_TOKEN) {
    console.log('Verifica webhook superata!');
    res.status(200).send(challenge);
  } else {
    // Non autorizzato
    console.error('Verifica webhook fallita! Token non valido.');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  console.log('Webhook WhatsApp chiamato (POST)');
  
  try {
    // Assicurati che sia una richiesta valida da WhatsApp
    if (req.body.object && req.body.entry && 
        req.body.entry[0].changes && 
        req.body.entry[0].changes[0] && 
        req.body.entry[0].changes[0].value.messages && 
        req.body.entry[0].changes[0].value.messages[0]) {
      
      // Estrai i dati dal messaggio WhatsApp
      const message = req.body.entry[0].changes[0].value.messages[0];
      const sender = message.from;
      const incomingMsg = message.text?.body || '';
      
      console.log(`Messaggio ricevuto da ${sender}: ${incomingMsg}`);
      
      // Prepara i dati da inviare a n8n
      const n8nData = {
        message: incomingMsg,
        sender: sender,
        timestamp: new Date().toISOString(),
        platform: 'whatsapp',
        metaData: req.body // Invia l'intero payload di Meta a n8n
      };
      
      try {
        // Invia i dati a n8n
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
        
        // Invia la risposta tramite l'API di Meta
        await sendWhatsAppMessage(sender, responseMsg);
        
      } catch (n8nError) {
        console.error('Errore nella comunicazione con n8n:', n8nError.message);
        
        // In caso di errore con n8n, rispondi con un messaggio predefinito
        await sendWhatsAppMessage(sender, 'Grazie per il tuo messaggio. Il nostro sistema sta elaborando la tua richiesta.');
      }
      
      // Rispondi a Meta con 200 OK
      res.status(200).send('OK');
      
    } else {
      // Non è un formato di messaggio valido
      console.log('Richiesta non valida o senza messaggio.');
      res.sendStatus(400);
    }
    
  } catch (error) {
    console.error('Errore nella gestione del webhook:', error);
    res.sendStatus(500);
  }
});

// Funzione per inviare un messaggio tramite l'API WhatsApp di Meta
async function sendWhatsAppMessage(recipient, text) {
  try {
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: {
          body: text
        }
      }
    });
    
    console.log('Messaggio inviato con successo:', response.data);
    return response.data;
  } catch (error) {
    console.error('Errore nell\'invio del messaggio WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
  console.log(`Reindirizzamento da / a: ${N8N_URL}`);
  console.log(`Webhook URL per WhatsApp: http://localhost:${PORT}/webhook`);
  console.log(`n8n Webhook configurato: ${N8N_WEBHOOK_URL}`);
});