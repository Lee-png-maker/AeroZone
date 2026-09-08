// ============================================================
// AEROZONE ONLINE STORE - BACKEND SERVER
// Express + PostgreSQL + JWT + Yoco Checkout
// ============================================================

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ============================================================
// CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;

const DATABASE_URL = process.env.DATABASE_URL;

const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://lee-png-maker.github.io/AeroZone";

// ============================================================
// SECURITY CHECK
// ============================================================

if (!JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not configured.");
}

if (!DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not configured.");
}

if (!YOCO_SECRET_KEY) {
  console.warn("WARNING: YOCO_SECRET_KEY is not configured.");
}

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  cors({
    origin: [
      FRONTEND_URL,
      "https://lee-png-maker.github.io"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

// ============================================================
// DATABASE
// ============================================================

const pool = new Pool({
  connectionString: DATABASE_URL,

  // Required by many hosted PostgreSQL services
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

// Test database connection
pool
  .connect()
  .then((client) => {
    console.log("PostgreSQL connected successfully.");
    client.release();
  })
  .catch((err) => {
    console.error("PostgreSQL connection error:", err.message);
  });

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AeroZone API is running",
    frontend: FRONTEND_URL
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      database: "connected",
      yoco: YOCO_SECRET_KEY ? "configured" : "not configured"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      database: "error"
    });
  }
});

// ============================================================
// AUTHENTICATION
// ============================================================

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({
      error: "Full name, email and password are required."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Password must contain at least 6 characters."
    });
  }

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "Email is already registered."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [
        full_name,
        email.toLowerCase(),
        hashedPassword,
        "customer"
      ]
    );

    res.status(201).json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      error: "Unable to create account."
    });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required."
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    const user = result.rows[0];

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      JWT_SECRET,
      {
        expiresIn: "24h"
      }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Login failed."
    });
  }
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Invalid authentication token."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(403).json({
      error: "Invalid or expired token."
    });
  }
}

// ============================================================
// PRODUCTS
// ============================================================

app.get("/api/products", async (req, res) => {
  const {
    search,
    category,
    page = 1,
    limit = 12
  } = req.query;

  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(
    Math.max(parseInt(limit) || 12, 1),
    50
  );

  const offset = (safePage - 1) * safeLimit;

  try {
    let query = `
      SELECT
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.id
      WHERE p.is_active = true
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);

      query += `
        AND p.title ILIKE $${params.length}
      `;
    }

    if (category) {
      params.push(category);

      query += `
        AND c.name = $${params.length}
      `;
    }

    query += `
      ORDER BY p.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    params.push(safeLimit);
    params.push(offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      products: result.rows,
      page: safePage,
      limit: safeLimit
    });
  } catch (error) {
    console.error("Products error:", error);

    res.status(500).json({
      error: "Unable to load products."
    });
  }
});

// ============================================================
// YOCO CHECKOUT
// ============================================================

app.post("/api/checkout/yoco", async (req, res) => {
  const {
    userId,
    items,
    shippingAddress
  } = req.body;

  if (!YOCO_SECRET_KEY) {
    return res.status(500).json({
      error: "Yoco is not configured on the server."
    });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Your cart is empty."
    });
  }

  if (!shippingAddress) {
    return res.status(400).json({
      error: "Shipping address is required."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // Calculate the price from the DATABASE.
    // Never trust prices sent from the browser.
    // --------------------------------------------------------

    let totalCents = 0;
    const orderItems = [];

    for (const item of items) {
      const productId = parseInt(item.productId);
      const quantity = parseInt(item.quantity);

      if (!productId || !quantity || quantity < 1) {
        throw new Error("Invalid cart item.");
      }

      const productResult = await client.query(
        `SELECT id, title, price_cents
         FROM products
         WHERE id = $1
         AND is_active = true`,
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(
          `Product ${productId} is unavailable.`
        );
      }

      const product = productResult.rows[0];

      const itemTotal =
        product.price_cents * quantity;

      totalCents += itemTotal;

      orderItems.push({
        productId: product.id,
        quantity,
        unitPrice: product.price_cents
      });
    }

    if (totalCents <= 0) {
      throw new Error("Invalid order amount.");
    }

    // --------------------------------------------------------
    // Create pending order
    // --------------------------------------------------------

    const orderResult = await client.query(
      `INSERT INTO orders
       (
         user_id,
         total_amount_cents,
         shipping_address,
         status
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        userId || null,
        totalCents,
        shippingAddress,
        "pending"
      ]
    );

    const orderId = orderResult.rows[0].id;

    // --------------------------------------------------------
    // Create order items
    // --------------------------------------------------------

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items
         (
           order_id,
           product_id,
           quantity,
           unit_price_cents
         )
         VALUES ($1, $2, $3, $4)`,
        [
          orderId,
          item.productId,
          item.quantity,
          item.unitPrice
        ]
      );
    }

    // --------------------------------------------------------
    // Commit database transaction
    // --------------------------------------------------------

    await client.query("COMMIT");

    // --------------------------------------------------------
    // Create Yoco Checkout
    // --------------------------------------------------------

    const yocoResponse = await fetch(
      "https://payments.yoco.com/api/checkouts",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${YOCO_SECRET_KEY}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          amountInCents: totalCents,
          currency: "ZAR",

          successUrl:
            `${FRONTEND_URL}/?payment=success&orderId=${orderId}`,

          cancelUrl:
            `${FRONTEND_URL}/?payment=cancelled&orderId=${orderId}`,

          failureUrl:
            `${FRONTEND_URL}/?payment=failed&orderId=${orderId}`,

          metadata: {
            orderId: String(orderId),
            store: "AeroZone"
          }
        })
      }
    );

    const yocoData = await yocoResponse.json();

    if (!yocoResponse.ok) {
      console.error("Yoco error:", yocoData);

      return res.status(502).json({
        error: "Unable to create Yoco payment."
      });
    }

    // --------------------------------------------------------
    // Return checkout URL to website
    // --------------------------------------------------------

    res.json({
      success: true,
      orderId,
      amount: (totalCents / 100).toFixed(2),
      checkoutId: yocoData.id,
      redirectUrl:
        yocoData.redirectUrl ||
        yocoData.redirect_url
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Yoco checkout error:",
      error
    );

    res.status(500).json({
      error: error.message ||
        "Unable to create checkout."
    });
  } finally {
    client.release();
  }
});

// ============================================================
// GET ORDER
// ============================================================

app.get(
  "/api/orders/:id",
  async (req, res) => {
    const orderId = parseInt(req.params.id);

    if (!orderId) {
      return res.status(400).json({
        error: "Invalid order ID."
      });
    }

    try {
      const result = await pool.query(
        `SELECT
           id,
           user_id,
           total_amount_cents,
           shipping_address,
           status
         FROM orders
         WHERE id = $1`,
        [orderId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Order not found."
        });
      }

      const order = result.rows[0];

      res.json({
        success: true,
        order: {
          ...order,
          amount:
            (order.total_amount_cents / 100).toFixed(2)
        }
      });

    } catch (error) {
      console.error(
        "Order lookup error:",
        error
      );

      res.status(500).json({
        error: "Unable to load order."
      });
    }
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log(
    `AeroZone API running on port ${PORT}`
  );
});
