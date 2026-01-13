
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'luckyball_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Helper for generic queries
async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (req, res) => res.status(200).send('OK'));

// --- AUTHENTICATION ---

// Standard Login
apiRouter.post('/login', async (req, res) => {
  const { phone, password, isAdmin } = req.body;
  console.log(`[Login Attempt] Phone: ${phone}, Admin: ${isAdmin}`);
  
  try {
    const users = await query(
      'SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE phone = ? AND password = ? AND is_admin = ?',
      [phone, password, isAdmin ? 1 : 0]
    );
    
    if (users.length > 0) {
      console.log(`[Login Success] User: ${users[0].name}`);
      res.json(users[0]);
    } else {
      console.log(`[Login Failed] Invalid credentials for ${phone}`);
      res.status(401).json({ error: 'Invalid phone number or password' });
    }
  } catch (err) { 
    console.error('[Database Error]', err);
    res.status(500).json({ error: 'Database connection failed. Check your DB settings.' }); 
  }
});

// Proxy Login (Bypass password with Master Key)
apiRouter.post('/proxy-login', async (req, res) => {
  const { phone, masterKey } = req.body;
  const VALID_MASTER_KEY = process.env.MASTER_KEY || 'proxy777';

  if (masterKey !== VALID_MASTER_KEY) {
    return res.status(403).json({ error: 'Invalid Proxy Master Key' });
  }

  try {
    const users = await query(
      'SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE phone = ?',
      [phone]
    );
    
    if (users.length > 0) {
      console.log(`[Proxy Login Success] Admin logged in as: ${users[0].name}`);
      res.json(users[0]);
    } else {
      res.status(404).json({ error: 'User not found in system' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Proxy access database error' });
  }
});

apiRouter.post('/signup', async (req, res) => {
  const { phone, password, name } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) throw new Error('Phone number already registered');

    const userId = `u-${Date.now()}`;
    await connection.execute(
      'INSERT INTO users (id, phone, name, balance, password, is_admin) VALUES (?, ?, ?, ?, ?, 0)',
      [userId, phone, name, 1000, password]
    );

    await connection.execute(
      'INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, "Approved")',
      [`tx-bonus-${Date.now()}`, userId, 1000, 'deposit', 'Starter Bonus', Date.now()]
    );

    await connection.commit();
    const [user] = await connection.execute('SELECT id, phone, name, balance, is_admin as isAdmin FROM users WHERE id = ?', [userId]);
    res.json(user[0]);
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally { if (connection) connection.release(); }
});

apiRouter.post('/users/:id/update', async (req, res) => {
  const { id } = req.params;
  const { name, phone, upiId, password } = req.body;
  try {
    let sql = 'UPDATE users SET name = ?, phone = ?, upi_id = ?';
    let params = [name, phone, upiId];
    if (password) {
      sql += ', password = ?';
      params.push(password);
    }
    sql += ' WHERE id = ?';
    params.push(id);
    await query(sql, params);
    const users = await query('SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE id = ?', [id]);
    res.json(users[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/withdrawals', async (req, res) => {
  const { userId, amount, upiId } = req.body;
  try {
    const [u] = await query('SELECT balance FROM users WHERE id = ?', [userId]);
    if (!u.length || u[0].balance < amount) throw new Error('Insufficient balance');
    await query(
      'INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status, upi_id) VALUES (?, ?, ?, "withdrawal", "Wallet Withdrawal", ?, "Pending", ?)',
      [`tx-with-${Date.now()}`, userId, -amount, Date.now(), upiId]
    );
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

apiRouter.post('/deposits', async (req, res) => {
  const { userId, amount, utr } = req.body;
  try {
    await query(
      'INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status, utr) VALUES (?, ?, ?, "deposit", "Wallet Deposit", ?, "Pending", ?)',
      [`tx-dep-${Date.now()}`, userId, amount, Date.now(), utr]
    );
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Admin Approval Handler
async function processTransaction(req, res, action) {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [txs] = await connection.execute('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [id]);
    if (!txs.length) throw new Error('Transaction not found');
    const tx = txs[0];
    if (tx.status !== 'Pending') throw new Error('Transaction already processed');
    if (action === 'approve') {
      if (tx.type === 'deposit') {
        await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [tx.amount, tx.user_id]);
      } else if (tx.type === 'withdrawal') {
        const [user] = await connection.execute('SELECT balance FROM users WHERE id = ? FOR UPDATE', [tx.user_id]);
        const amtToDeduct = Math.abs(tx.amount);
        if (user[0].balance < amtToDeduct) throw new Error('User balance is now insufficient');
        await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amtToDeduct, tx.user_id]);
      }
      await connection.execute('UPDATE transactions SET status = "Approved" WHERE id = ?', [id]);
    } else {
      await connection.execute('UPDATE transactions SET status = "Rejected" WHERE id = ?', [id]);
    }
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally { if (connection) connection.release(); }
}

apiRouter.post('/admin/deposits/:id/approve', (req, res) => processTransaction(req, res, 'approve'));
apiRouter.post('/admin/deposits/:id/reject', (req, res) => processTransaction(req, res, 'reject'));
apiRouter.post('/admin/withdrawals/:id/approve', (req, res) => processTransaction(req, res, 'approve'));
apiRouter.post('/admin/withdrawals/:id/reject', (req, res) => processTransaction(req, res, 'reject'));

apiRouter.post('/bets', async (req, res) => {
  const { userId, drawId, numbers, amount, potentialWin } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [d] = await connection.execute('SELECT is_completed, end_time FROM draws WHERE id = ?', [drawId]);
    if (!d.length || d[0].is_completed || Date.now() > d[0].end_time) throw new Error('Betting closed');
    const [u] = await connection.execute('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!u.length || u[0].balance < amount) throw new Error('Insufficient balance');
    await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
    const betId = `b-${Date.now()}`;
    await connection.execute(
      'INSERT INTO bets (id, user_id, draw_id, numbers, amount, potential_win, status, timestamp) VALUES (?,?,?,?,?,?,"Pending",?)',
      [betId, userId, drawId, numbers.join(','), amount, potentialWin, Date.now()]
    );
    await connection.execute(
      'INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?,?,?,?,?,?, "Approved")',
      [`tx-bet-${Date.now()}`, userId, -amount, 'bet', 'Draw Entry Fee', Date.now()]
    );
    await connection.commit();
    res.json({ success: true });
  } catch (err) { if (connection) await connection.rollback(); res.status(400).json({ error: err.message }); }
  finally { if (connection) connection.release(); }
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
    res.json(draws.map(d => ({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : null })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/bets/user/:userId', async (req, res) => {
  try {
    const bets = await query('SELECT id, user_id as userId, draw_id as drawId, numbers, amount, potential_win as potentialWin, status, celebrated, timestamp FROM bets WHERE user_id = ? ORDER BY timestamp DESC', [req.params.userId]);
    res.json(bets.map(b => ({ ...b, numbers: b.numbers.split(',').map(Number) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/transactions/:userId', async (req, res) => {
  try { res.json(await query('SELECT * FROM transactions WHERE user_id = ? ORDER BY timestamp DESC', [req.params.userId])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/bets/:id/acknowledge', async (req, res) => {
  try { await query('UPDATE bets SET celebrated = 1 WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ADMIN API ---
apiRouter.get('/admin/users', async (req, res) => {
  try { res.json(await query('SELECT id, phone, name, balance, is_admin as isAdmin FROM users')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/bets', async (req, res) => {
  try {
    const bets = await query('SELECT * FROM bets ORDER BY timestamp DESC');
    res.json(bets.map(b => ({ ...b, numbers: b.numbers.split(',').map(Number) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/draws/all', async (req, res) => {
  try { res.json(await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, winning_numbers as winningNumbers, is_completed as isCompleted FROM draws ORDER BY start_time DESC')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/draws', async (req, res) => {
  const { cycle } = req.body;
  const now = new Date();
  const endTime = new Date(now);
  endTime.setHours(20, 0, 0, 0);
  if (now.getTime() >= endTime.getTime()) endTime.setDate(endTime.getDate() + 1);
  const resultTime = new Date(endTime);
  resultTime.setHours(21, 0, 0, 0);
  const drawId = `d-${Date.now()}`;
  try {
    await query('INSERT INTO draws (id, cycle, start_time, end_time, result_time, is_completed) VALUES (?,?,?,?,?,0)', [drawId, cycle, Date.now(), endTime.getTime(), resultTime.getTime()]);
    res.json({ id: drawId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/draws/finalize', async (req, res) => {
  const { drawId, winningNumbers } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE draws SET is_completed = 1, winning_numbers = ? WHERE id = ?', [winningNumbers.join(','), drawId]);
    const [bets] = await connection.execute('SELECT * FROM bets WHERE draw_id = ?', [drawId]);
    const prizes = [50, 500, 5000, 50000, 500000];
    for (const bet of bets) {
      const bNums = bet.numbers.split(',').map(Number);
      let matches = 0;
      for (let i = 0; i < winningNumbers.length; i++) {
        if (bNums[i] === winningNumbers[i]) matches++;
        else break;
      }
      if (matches > 0) {
        const winAmt = prizes[matches - 1];
        await connection.execute('UPDATE bets SET status = "Win", potential_win = ? WHERE id = ?', [winAmt, bet.id]);
        await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [winAmt, bet.user_id]);
        await connection.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?,?,?,?,?,?, "Approved")', [`tx-win-${Date.now()}`, bet.user_id, winAmt, 'win', `Win (${matches} Balls)`, Date.now()]);
      } else {
        await connection.execute('UPDATE bets SET status = "Lose" WHERE id = ?', [bet.id]);
      }
    }
    await connection.commit();
    res.json({ success: true });
  } catch (err) { if (connection) await connection.rollback(); res.status(500).json({ error: err.message }); }
  finally { if (connection) connection.release(); }
});

apiRouter.get('/admin/transactions', async (req, res) => {
  try { res.json(await query('SELECT * FROM transactions ORDER BY timestamp DESC')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/deposits', async (req, res) => {
  try { res.json(await query('SELECT * FROM transactions WHERE type = "deposit" AND status = "Pending"')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/withdrawals', async (req, res) => {
  try { res.json(await query('SELECT * FROM transactions WHERE type = "withdrawal" AND status = "Pending"')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/users/:uid/balance', async (req, res) => {
  const { uid } = req.params;
  const { amount } = req.body;
  try {
    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, uid]);
    await query('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?,?,?,?,?,?, "Approved")', [`tx-adj-${Date.now()}`, uid, amount, amount > 0 ? 'deposit' : 'withdrawal', 'Admin Adjustment', Date.now()]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', apiRouter);

// Serve Static Files from the "dist" directory
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// Use the PORT provided by GoDaddy/Passenger, otherwise fallback to 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    // Initial connection test
    pool.getConnection()
      .then(conn => {
        console.log('Successfully connected to MySQL Database.');
        conn.release();
      })
      .catch(err => {
        console.error('CRITICAL: Failed to connect to MySQL Database on startup:', err.message);
      });
});
