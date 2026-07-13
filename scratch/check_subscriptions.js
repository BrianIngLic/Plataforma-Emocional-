const https = require('https');

const ACCESS_TOKEN = "EAAWMkCsMgr4BR1j6oTpYj3AAEbbGT5omSMZA1FPNiYoIRkm4FJDbJUy2VGiazn5E2EXBM6B7Tfp1Wv36Tn9AtzQQq0n2frohQKeZBcgpwEzL8YOo6AmTTcuBVloCaq6OwRXb5w8wZA4klIGSeSfNCLxZCSwx48VZCZAKqWzKOOWXwZAKKNYSJZC81rNgLObDHoUzlH6F0DQ2WdYI8WLaePUuZBHgg6vDJVdOhZCPP2";
const APP_ID = "1561925708972734";

function makeRequest(url, method, headers, postData) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  try {
    console.log(`🔍 1. Consultando suscripciones de Webhook para la App ${APP_ID}...`);
    const url = `https://graph.facebook.com/v19.0/${APP_ID}/subscriptions?access_token=${ACCESS_TOKEN}`;
    const resp = await makeRequest(url, 'GET', { 'Content-Type': 'application/json' });

    console.log(`Response Status: ${resp.status}`);
    console.log("Subscriptions:", JSON.stringify(resp.body, null, 2));
  } catch (err) {
    console.error("Error en la ejecución:", err);
  }
}

run();
