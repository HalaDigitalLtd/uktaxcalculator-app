"use client";

import { useMemo, useState } from "react";

export default function QuotePage() {
  const [pages, setPages] = useState(1);
  const [seo, setSeo] = useState(false);
  const [leadForm, setLeadForm] = useState(true);
  const [automation, setAutomation] = useState(false);

  const quote = useMemo(() => {
    let total = 299;
    if (pages > 1) total += (pages - 1) * 75;
    if (seo) total += 200;
    if (leadForm) total += 100;
    if (automation) total += 150;
    return total;
  }, [pages, seo, leadForm, automation]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "60px 20px", maxWidth: "850px", margin: "auto" }}>
      <h1>Website Quote Calculator</h1>

      <p style={{ fontSize: "18px" }}>
        Get an instant estimate for your business website, SEO setup and lead capture system.
      </p>

      <div style={{ marginTop: "30px", display: "grid", gap: "20px" }}>
        <label>
          Number of pages
          <input
            type="number"
            min="1"
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))}
            style={{ display: "block", padding: "12px", marginTop: "8px", width: "100%" }}
          />
        </label>

        <label>
          <input type="checkbox" checked={seo} onChange={(e) => setSeo(e.target.checked)} /> SEO setup
        </label>

        <label>
          <input type="checkbox" checked={leadForm} onChange={(e) => setLeadForm(e.target.checked)} /> Lead capture form
        </label>

        <label>
          <input type="checkbox" checked={automation} onChange={(e) => setAutomation(e.target.checked)} /> Basic automation / follow-up setup
        </label>
      </div>

      <div style={{ marginTop: "30px", padding: "25px", background: "#eef6ff", borderRadius: "10px" }}>
        <h2>Estimated Price: £{quote}</h2>
        <p>This is an indicative quote. Final pricing depends on design, content, integrations and project scope.</p>
        <p style={{ marginTop: "10px", fontSize: "14px", opacity: 0.75 }}>
          No obligation. Fixed pricing available. Most standard websites can be delivered within 5–7 days.
        </p>
      </div>

      <h3 style={{ marginTop: "35px" }}>
        Get your exact quote and start within 24 hours
      </h3>

      <form
        action="https://formspree.io/f/xbdwlgdv"
        method="POST"
        style={{ marginTop: "20px", display: "grid", gap: "12px" }}
      >
        <input type="hidden" name="_subject" value="New Website Quote Enquiry" />
        <input type="hidden" name="estimated_quote" value={`£${quote}`} />
        <input type="hidden" name="pages" value={pages} />
        <input type="hidden" name="seo_setup" value={seo ? "Yes" : "No"} />
        <input type="hidden" name="lead_capture_form" value={leadForm ? "Yes" : "No"} />
        <input type="hidden" name="automation" value={automation ? "Yes" : "No"} />

        <input name="name" placeholder="Your name" required style={{ padding: "12px", borderRadius: "8px" }} />
        <input name="email" type="email" placeholder="Email address" required style={{ padding: "12px", borderRadius: "8px" }} />
        <input name="phone" placeholder="Phone / WhatsApp" required style={{ padding: "12px", borderRadius: "8px" }} />

        <textarea
          name="message"
          placeholder="Tell us briefly what you need"
          rows={4}
          required
          style={{ padding: "12px", borderRadius: "8px" }}
        />

        <button
          type="submit"
          style={{
            padding: "14px",
            background: "#25D366",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Get exact quote
        </button>
      </form>

      <a
        href={`https://wa.me/447884063169?text=Hi%20Ikram,%20I%20used%20your%20quote%20calculator.%20My%20estimated%20price%20is%20£${quote}.%20Can%20you%20please%20guide%20me?`}
        style={{
          display: "inline-block",
          marginTop: "15px",
          padding: "12px 20px",
          background: "#25D366",
          color: "white",
          borderRadius: "8px",
          textDecoration: "none"
        }}
      >
        Chat on WhatsApp instead
      </a>
    </div>
  );
}
