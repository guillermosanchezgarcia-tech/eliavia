require('dotenv').config();
const path = require('node:path');
const express = require('express');

const albaranesRouter = require('./routes/albaranes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/albaranes', albaranesRouter);

app.listen(PORT, () => {
  console.log(`Albaran Digital escuchando en http://localhost:${PORT}`);
});
