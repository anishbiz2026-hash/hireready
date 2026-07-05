// ============================================================
// HireReady — questionnaire.js
// Handles: package preselect from URL, validation, submission
// to the backend (with graceful demo fallback), and the
// Continue to Payment step.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const orderForm = document.getElementById("orderForm");
  if (!orderForm) return;

  const formSuccess = document.getElementById("formSuccess");
  const successText = document.getElementById("successText");
  const paymentBtn = document.getElementById("paymentBtn");
  const paymentDemoMsg = document.getElementById("paymentDemoMsg");

  let lastSubmission = null; // kept so the payment step knows the chosen package

  // ---------- Preselect package from URL (?package=starter|boost|interview|full) ----------
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("package");
  if (preselect) {
    const radio = orderForm.querySelector(`input[name="package"][data-key="${preselect}"]`);
    if (radio) radio.checked = true;
  }

  // ---------- Clear error state as the user fixes fields ----------
  orderForm.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("input", () => {
      const field = el.closest(".field, #packageGroup");
      if (field) field.classList.remove("invalid");
    });
  });

  // ---------- Submit ----------
  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    let firstInvalid = null;

    // Validate required text/select/textarea fields
    orderForm.querySelectorAll("[required]:not([type='radio'])").forEach((el) => {
      const field = el.closest(".field");
      const value = el.value.trim();
      const emailBad = el.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isInvalid = !value || emailBad;

      field.classList.toggle("invalid", isInvalid);
      if (isInvalid && !firstInvalid) firstInvalid = field;
    });

    // Validate package selection (radio group)
    const packageGroup = document.getElementById("packageGroup");
    const packageChosen = orderForm.querySelector('input[name="package"]:checked');
    packageGroup.classList.toggle("invalid", !packageChosen);
    if (!packageChosen && !firstInvalid) firstInvalid = packageGroup;

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // ---------- Collect the submission as a clean object ----------
    const submission = {
      student: {
        fullName: orderForm.fullName.value.trim(),
        grade: orderForm.grade.value,
        school: orderForm.school.value.trim(),
        email: orderForm.email.value.trim(),
        phone: orderForm.phone.value.trim() || null,
      },
      jobGoals: {
        jobTypes: orderForm.jobTypes.value.trim(),
        specificCompany: orderForm.specificCompany.value.trim() || null,
        timeline: orderForm.timeline.value,
      },
      experience: {
        hadJobBefore: orderForm.hadJob.value,
        description: orderForm.experience.value.trim(),
        topSkills: orderForm.skills.value.trim(),
      },
      availability: {
        schedule: orderForm.availability.value.trim(),
        hoursPerWeek: orderForm.hoursPerWeek.value.trim() || null,
      },
      applicationHelp: {
        stuckOn: orderForm.stuckOn.value.trim() || null,
        extraHelp: [...orderForm.querySelectorAll('input[name="extraHelp"]:checked')].map((c) => c.value),
      },
      package: {
        name: packageChosen.value,
        key: packageChosen.dataset.key, // starter | boost | interview | full
      },
      notes: orderForm.notes.value.trim() || null,
      submittedAt: new Date().toISOString(),
    };

    console.log("HireReady submission:", submission);
    lastSubmission = submission;

    // ---------- Send to the backend if it exists ----------
    // When the site is served by server.js (npm start), this POST saves
    // the submission to submissions.json. When the page is opened as a
    // plain file (no backend running), the fetch fails and we fall back
    // to demo mode so the flow still works.
    let savedToBackend = false;
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      savedToBackend = res.ok;
    } catch (err) {
      // No backend available — demo mode
    }

    successText.textContent = savedToBackend
      ? "Your questionnaire has been saved. Continue to payment to complete your order."
      : "Your HireReady request has been saved for this demo. Next step: connect this form to email, a database, or a payment system.";

    orderForm.reset();
    // Hide the submit button once submitted so the payment step is the clear next action
    orderForm.querySelector(".form-submit").hidden = true;
    formSuccess.hidden = false;
    formSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---------- Continue to Payment ----------
  // Intended flow: questionnaire saved -> Continue to Payment ->
  // backend creates a Stripe Checkout session -> browser redirects
  // to Stripe's hosted checkout page.
  paymentBtn.addEventListener("click", async () => {
    paymentBtn.disabled = true;
    paymentBtn.textContent = "Opening checkout…";

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageKey: lastSubmission ? lastSubmission.package.key : null,
          email: lastSubmission ? lastSubmission.student.email : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          // Redirect to Stripe's hosted checkout page
          window.location.href = data.url;
          return;
        }
      }
      // Backend reachable but Stripe not configured (or bad response)
      showDemoMessage();
    } catch (err) {
      // No backend running — demo mode
      showDemoMessage();
    }
  });

  function showDemoMessage() {
    paymentDemoMsg.hidden = false;
    paymentBtn.disabled = false;
    paymentBtn.textContent = "Continue to Payment";
  }
});
