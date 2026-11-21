"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type FormState = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [launchConsent, setLaunchConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const honeypot = (new FormData(form).get("company") || "").toString();
    const trimmedEmail = email.trim();
    if (!form.reportValidity() || !trimmedEmail || trimmedEmail.length > 254 || !launchConsent) {
      setState("error");
      setMessage("Enter a valid email and agree to receive your launch notification.");
      return;
    }

    setState("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, launchConsent, marketingConsent, company: honeypot }),
      });
      const result: { message?: string } = await response.json();
      if (!response.ok) {
        setState("error");
        setMessage(result.message || "We couldn't save your email. Please try again.");
        return;
      }
      setState("success");
      setMessage("You're on the list. We'll be in touch when Seila launches.");
      setEmail("");
      setLaunchConsent(false);
      setMarketingConsent(false);
      form.reset();
    } catch {
      setState("error");
      setMessage("We couldn't connect right now. Please try again in a moment.");
    }
  }

  return (
    <div className="waitlist-block" id="waitlist">
      <p className="waitlist-prompt">Be first to know when we arrive.</p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="email-row">
          <label className="sr-only" htmlFor="waitlist-email">Email address</label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
            disabled={state === "submitting"}
          />
          <button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Joining…" : "Join the waitlist"}
          </button>
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="consent-options">
          <label className="consent-option">
            <input
              type="checkbox"
              checked={launchConsent}
              onChange={(event) => setLaunchConsent(event.target.checked)}
              required
              disabled={state === "submitting"}
            />
            <span>Email me when Seila launches.</span>
          </label>
          <label className="consent-option">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => setMarketingConsent(event.target.checked)}
              disabled={state === "submitting"}
            />
            <span>Also send me occasional style and travel updates. Optional.</span>
          </label>
        </div>
        <p className="form-privacy">
          We&apos;ll use your email for the choices above. Read our <Link href="/privacy">privacy notice</Link>.
        </p>
        <p className={`form-message ${state}`} role={state === "error" ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
      </form>
    </div>
  );
}
