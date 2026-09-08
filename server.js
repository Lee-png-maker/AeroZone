const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 10000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://lee-png-maker.github.io/AeroZone";

const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY;


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());

app.use(
  cors({
    origin: FRONTEND_URL
  })
);


// ==========================================
// PRODUCTS
// IMPORTANT:
// These are the REAL prices used for payment.
// Do not rely on prices sent from index.html.
// ==========================================

const PRODUCTS = {
  1: {
    name: "Rechargeable LED Emergency Bulb (Pack of 2)",
    price: 299
  },

  2: {
    name: "Portable Solar Power Bank (20,000mAh)",
    price: 449
  },

  3: {
    name: "Mini Portable Wireless Wi-Fi UPS Battery",
    price: 599
  },

  4: {
    name: "Portable Rechargeable Travel Espresso Maker",
    price: 899
  },

  5: {
    name: "MistBrush™ 2-in-1 Spray Hairbrush",
    price: 399
  },

  6: {
    name: "Express Chopper Electric Veggie Dicer",
    price: 349
  },

  7: {
    name: "SplashFree™ Anti-Spill Pet Water Bowl",
    price: 299
  },

  8: {
    name: "Motion-Sensor Solar Security Wall Light",
    price: 249
  },

  9: {
    name: "PocketGlide™ Cordless Hair Straightener",
    price: 499
  },

  10: {
    name: "SonicShine™ Ultrasonic Jewelry Cleaner",
    price: 429
  }
};


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AeroZone Yoco backend is running."
  });
});


app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    yocoConfigured: Boolean(YOCO_SECRET_KEY)
  });
});


// ==========================================
// CREATE YOCO CHECKOUT
// ==========================================

app.post("/api/checkout/yoco", async (req, res) => {

  try {

    if (!YOCO_SECRET_KEY) {

      return res.status(500).json({
        success: false,
        message: "YOCO_SECRET_KEY is not configured on the server."
      });

    }


    const { items } = req.body;


    if (!Array.isArray(items) || items.length === 0) {

      return res.status(400).json({
        success: false,
        message: "Your cart is empty."
      });

    }


    // ======================================
    // CALCULATE TOTAL ON SERVER
    // ======================================

    let total = 0;

    const checkoutItems = [];


    for (const item of items) {

      const productId = String(item.id);

      const quantity = Number(item.quantity);

      const product = PRODUCTS[productId];


      if (!product) {

        return res.status(400).json({
          success: false,
          message: `Invalid product: ${productId}`
        });

      }


      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {

        return res.status(400).json({
          success: false,
          message: "Invalid product quantity."
        });

      }


      const itemTotal = product.price * quantity;

      total += itemTotal;


      checkoutItems.push({
        id: productId,
        name: product.name,
        quantity: quantity,
        unitPrice: product.price,
        total: itemTotal
      });

    }


    if (total < 2) {

      return res.status(400).json({
        success: false,
        message: "The minimum payment amount is R2."
      });

    }


    // ======================================
    // YOCO CHECKOUT
    // ======================================

    const checkoutPayload = {

      amountInCents: Math.round(total * 100),

      currency: "ZAR",

      successUrl:
        `${FRONTEND_URL}/?payment=success`,

      cancelUrl:
        `${FRONTEND_URL}/?payment=cancelled`,

      failureUrl:
        `${FRONTEND_URL}/?payment=failed`,

      metadata: {
        store: "AeroZone",
        items: JSON.stringify(checkoutItems)
      }

    };


    const response = await fetch(
      "https://payments.yoco.com/api/checkouts",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${YOCO_SECRET_KEY}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify(checkoutPayload)
      }
    );


    const data = await response.json();


    if (!response.ok) {

      console.error("Yoco error:", data);

      return res.status(response.status).json({
        success: false,
        message: "Yoco could not create the payment checkout.",
        error: data
      });

    }


    // ======================================
    // SEND CHECKOUT URL TO WEBSITE
    // ======================================

    return res.json({
      success: true,

      checkoutId:
        data.id || null,

      redirectUrl:
        data.redirectUrl ||
        data.redirect_url ||
        data.url ||
        null,

      total: total,

      currency: "ZAR",

      items: checkoutItems
    });

  }

  catch (error) {

    console.error("Server error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create Yoco payment.",
      error: error.message
    });

  }

});


// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `AeroZone backend running on port ${PORT}`
  );

});
