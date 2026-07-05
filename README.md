# HireReady

Resume, application, and interview help for students getting their first part-time job.

## Project structure

```
hireready/
  public/            <- the website (open index.html or serve with the backend)
    index.html         Home page
    packages.html      Packages page
    questionnaire.html Questionnaire (order form)
    styles.css         Shared styles
    script.js          Shared behavior (nav, FAQ, animations)
    questionnaire.js   Questionnaire logic (validation, submit, payment)
  server.js          <- Express backend
  package.json
  .env.example       <- copy to .env and add Stripe keys
```

## Run without the backend (demo mode)

Open `public/index.html` in a browser. Everything works; the questionnaire
shows a demo success message and payment shows "Payment setup is ready for
Stripe connection."

## Run with the backend

Requires Node.js (nodejs.org).

```
npm install
npm start
```

Open http://localhost:3000 — questionnaire submissions are now saved to
`submissions.json` in the project folder.

## Connect Stripe payments

1. Create a Stripe account at stripe.com
2. Copy `.env.example` to `.env`
3. Paste your secret key: `STRIPE_SECRET_KEY=sk_test_...`
4. Restart the server — "Continue to Payment" now opens real Stripe Checkout

Search the code for `INTEGRATION POINT` and `TODO (Stripe)` comments to find
where to plug in a real database, email notifications, and Stripe Price IDs.
