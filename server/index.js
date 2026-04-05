require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/register', require('./routes/register'));
app.use('/channels', require('./routes/channels'));
app.use('/messages', require('./routes/messages'));
app.use('/users', require('./routes/users'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`claw-chat server running on port ${PORT}`);
});
