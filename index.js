const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8082;

app.use(cors());
app.use(express.json());

// Example endpoint matching SDK expectation
app.get('/mock_server/card', (req, res) => {
  // Respond with simple card JSON; could be extended to use query params
  res.json({
    cardholderName: 'Jane Merchant',
    cardNumber: '**** **** **** 4242',
    cvv: '***',
    expiry: '01/30'
  });
});

app.listen(port, () => {
  console.log(`Mock server listening on http://localhost:${port}`);
});
