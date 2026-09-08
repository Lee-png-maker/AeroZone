
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Pool Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/takealot_db',
});

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_aerozone';

// --- AUTHENTICATION ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
  const { full_name, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      [full_name, email, hashedPassword, role || 'customer']
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: 'Email already registered or invalid payload.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CATALOGUE & PRODUCTS ENDPOINTS ---

app.get('/api/products', async (req, res) => {
  const { search, category, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = true';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND p.title ILIKE $${params.length}`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const products = await pool.query(query, params);
    res.json({ products: products.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CHECKOUT & PAYFAST INTEGRATION ---

app.post('/api/checkout/payfast', async (req, res) => {
  const { userId, items, shippingAddress } = req.body;

  try {
    // 1. Calculate Total Amount
    let totalCents = 0;
    for (let item of items) {
      const prodResult = await pool.query('SELECT price_cents FROM products WHERE id = $1', [item.productId]);
      totalCents += prodResult.rows[0].price_cents * item.quantity;
    }

    // 2. Create Order in Pending State
    const orderResult = await pool.query(
      'INSERT INTO orders (user_id, total_amount_cents, shipping_address, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, totalCents, shippingAddress, 'pending']
    );
    const orderId = orderResult.rows[0].id;

    // 3. Insert Order Items
    for (let item of items) {
      const prodResult = await pool.query('SELECT price_cents FROM products WHERE id = $1', [item.productId]);
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)',
        [orderId, item.productId, item.quantity, prodResult.rows[0].price_cents]
      );
    }

    // 4. Generate PayFast Payment Form Payload (South Africa)
    const payfastMerchantId = process.env.PAYFAST_MERCHANT_ID || '10000100';
    const payfastMerchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a';
    const amountZar = (totalCents / 100).toFixed(2);

    const payfastData = {
      merchant_id: payfastMerchantId,
      merchant_key: payfastMerchantKey,
      return_url: `https://aerozone.co.za/order-success?orderId=${orderId}`,
      cancel_url: `https://aerozone.co.za/checkout`,
      notify_url: `https://api.aerozone.co.za/api/checkout/payfast-notify`,
      m_payment_id: orderId.toString(),
      amount: amountZar,
      item_name: `AeroZone Order #${orderId}`,
    };

    res.json({ orderId, payfastUrl: 'https://sandbox.payfast.co.za/eng/process', payload: payfastData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`AeroZone Enterprise Core API running on port ${PORT}`));
