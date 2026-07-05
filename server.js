// ============================================================
// HireReady — server.js
// Minimal Express backend for the HireReady MVP.
//
// Run it:
//   1. npm install
//   2. npm start
//   3. Open http://localhost:3000
//
// What it does:
//   - Serves the website from /public
//   - POST /api/submissions            -> saves questionnaires to submissions.json
//   - POST /api/create-checkout-session -> creates a Stripe Checkout session
//                                          (demo response until Stripe keys are added)
// ============================================================

require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SUBMISSIONS_FILE = path.join(__dirname, "submissions.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
// Stripe setup
// Add your real secret key to a .env file (see .env.example):
//   STRIPE_SECRET_KEY=sk_test_...
// Until then, the payment endpoint returns a friendly demo response.
// ------------------------------------------------------------
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
}

// Package catalog — single source of truth for prices.
// TODO (Stripe): replace `amount` cents with real Stripe Price IDs
// (create Products in the Stripe dashboard, then use price: "price_xxx"
// instead of price_data below).
const PACKAGES = {
  starter:   { name: "Resume Starter",      amount: 1000 }, // $10.00
  boost:     { name: "Application Boost",   amount: 2000 }, // $20.00
  interview: { name: "Interview Ready",     amount: 3000 }, // $30.00
  full:      { name: "Full HireReady Pack", amount: 4500 }, // $45.00
};

// ------------------------------------------------------------
// POST /api/submissions — save a questionnaire
// ------------------------------------------------------------
app.post("/api/submissions", (req, res) => {
  try {
    const submission = req.body;

    // Basic sanity check
    if (!submission || !submission.student || !submission.student.email) {
      return res.status(400).json({ error: "Invalid submission data." });
    }

    // Read existing submissions (start fresh if the file doesn't exist yet)
    let submissions = [];
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      try {
        submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, "utf8"));
      } catch {
        submissions = []; // corrupted file — start over rather than crash
      }
    }

    const record = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      receivedAt: new Date().toISOString(),
      paid: false, // flipped to true after payment (see Stripe webhook note below)
      ...submission,
    };

    submissions.push(record);
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));

    // ============================================================
    // DATABASE INTEGRATION POINT
    // The JSON file works fine for an MVP. When you outgrow it,
    // replace the read/write above with a real database, e.g.:
    //   - Supabase:  await supabase.from("submissions").insert(record)
    //   - Firebase:  await db.collection("submissions").add(record)
    //   - Airtable:  await base("Submissions").create(record)
    // ============================================================

    // ============================================================
    // EMAIL INTEGRATION POINT
    // Notify yourself of new orders here, e.g. with Resend or
    // Nodemailer:
    //   await resend.emails.send({ to: "you@example.com",
    //     subject: `New HireReady order from ${record.student.fullName}`,
    //     text: JSON.stringify(record, null, 2) });
    // ============================================================

    console.log(`New submission saved: ${record.id} (${record.student.fullName})`);
    res.status(201).json({ ok: true, id: record.id });
  } catch (err) {
    console.error("Failed to save submission:", err);
    res.status(500).json({ error: "Could not save your submission. Please try again." });
  }
});

// ------------------------------------------------------------
// POST /api/create-checkout-session — start a Stripe payment
// ------------------------------------------------------------
app.post("/api/create-checkout-session", async (req, res) => {
  const { packageKey, email } = req.body || {};
  const pkg = PACKAGES[packageKey];

  if (!pkg) {
    return res.status(400).json({ error: "Unknown package." });
  }

  // Stripe not configured yet -> tell the frontend to show the demo message
  if (!stripe) {
    return res.status(503).json({
      demo: true,
      message: "Payment setup is ready for Stripe connection.",
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || undefined,
      line_items: [
        {
          // TODO (Stripe): once you create Products in the Stripe
          // dashboard, replace price_data with: price: "price_xxx"
          price_data: {
            currency: "usd",
            product_data: { name: `HireReady — ${pkg.name}` },
            unit_amount: pkg.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${req.protocol}://${req.get("host")}/index.html?payment=success`,
      cancel_url: `${req.protocol}://${req.get("host")}/questionnaire.html?payment=cancelled`,
    });

    // ============================================================
    // WEBHOOK NOTE
    // To reliably mark submissions as paid, add a Stripe webhook
    // endpoint (checkout.session.completed) that finds the matching
    // submission and sets paid: true. Docs: stripe.com/docs/webhooks
    // ============================================================

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Could not start checkout. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`HireReady running at http://localhost:${PORT}`);
  console.log(stripe ? "Stripe: configured ✓" : "Stripe: not configured (demo mode)");
});
