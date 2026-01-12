
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. Basic Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 2. Database Connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Helper for queries
async function query(sql, params) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (err) {
    console.error('Database Error:', err.message);
    throw err;
  }
}

// 3. API Router
const apiRouter = express.Router();

// Force JSON for all API responses
apiRouter.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

apiRouter.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: e.message });
  }
});

apiRouter.post('/login', async (req, res) => {
  const { phone, password, isAdmin } = req.body;
  try {
    const users = await query(
      'SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE phone = ? AND password = ? AND is_admin = ?',
      [phone, password, isAdmin ? 1 : 0]
    );
    if (users.length > 0) res.json(users[0]);
    else res.status(401).json({ error: 'Invalid phone number or password' });
  } catch (err) { 
    res.status(500).json({ error: 'Internal Server Error during login' }); 
  }
});

apiRouter.get('/users/:id', async (req, res) => {
  try {
    const users = await query('SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE id = ?', [req.params.id]);
    if (users.length > 0) res.json(users[0]);
    else res.status(404).json({ error: 'User not found' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/draws/active', async (req, res) => {
  try {
    const now = Date.now();
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted FROM draws WHERE is_completed = 0 AND end_time > ? ORDER BY end_time ASC LIMIT 1', [now]);
    res.json(draws[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/draws/recent', async (req, res) => {
  try {
    const draws = await query('SELECT id, cycle, winning_numbers as winningNumbers, result_time as resultTime, is_completed as isCompleted FROM draws WHERE is_completed = 1 ORDER BY result_time DESC LIMIT 10');
    res.json(draws.map(d => ({ 
      ...d, 
      winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : null 
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/bets', async (req, res) => {
  const { userId, drawId, numbers, amount, potentialWin } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [u] = await connection.execute('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!u.length || u[0].balance < amount) throw new Error('Insufficient balance to place bet');
    
    await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
    
    const betId = `b-${Date.now()}`;
    await connection.execute(
      'INSERT INTO bets (id, user_id, draw_id, numbers, amount, potential_win, status, timestamp) VALUES (?,?,?,?,?,?,"Pending",?)',
      [betId, userId, drawId, numbers.join(','), amount, potentialWin, Date.now()]
    );
    
    await connection.execute(
      'INSERT INTO transactions (id, user_id, amount, type, description, timestamp) VALUES (?,?,?,?,?,?)',
      [`tx-${Date.now()}`, userId, -amount, 'bet', 'Draw Entry Fee', Date.now()]
    );
    
    await connection.commit();
    res.json({ success: true, betId });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

apiRouter.get('/bets/user/:userId', async (req, res) => {
  try {
    const bets = await query('SELECT id, user_id as userId, draw_id as drawId, numbers, amount, potential_win as potentialWin, status, celebrated, timestamp FROM bets WHERE user_id = ? ORDER BY timestamp DESC', [req.params.userId]);
    res.json(bets.map(b => ({ ...b, numbers: b.numbers.split(',').map(Number) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/transactions/:userId', async (req, res) => {
  try {
    const txs = await query('SELECT id, user_id as userId, amount, type, description, timestamp, status FROM transactions WHERE user_id = ? ORDER BY timestamp DESC', [req.params.userId]);
    res.json(txs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin endpoints
apiRouter.get('/admin/users', async (req, res) => {
  try { res.json(await query('SELECT id, phone, name, balance, is_admin as isAdmin FROM users')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Mount API FIRST with its own 404
app.use('/api', apiRouter);

// Catch-all for /api that returns JSON 404 instead of HTML
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});

// 5. Frontend Routes (Static Files)
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// 6. SPA Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
