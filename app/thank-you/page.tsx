export default function ThankYouPage() {
  return (
    <div style={{ padding: "60px", textAlign: "center" }}>
      <h1>Thank you 👋</h1>

      <p style={{ fontSize: "18px", marginTop: "20px" }}>
        We’ve received your details. An accountant will review your case and get back to you shortly.
      </p>

      <div style={{ marginTop: "30px" }}>
        <p><strong>Need urgent help?</strong></p>

        <a
          href="https://wa.me/447884063169"
          style={{
            display: "inline-block",
            margin: "10px",
            padding: "12px 20px",
            background: "#25D366",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none"
          }}
        >
          Chat on WhatsApp
        </a>

        <a
          href="mailto:ikramzaman@gmail.com"
          style={{
            display: "inline-block",
            margin: "10px",
            padding: "12px 20px",
            background: "#0070f3",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none"
          }}
        >
          Email us
        </a>
      </div>
    </div>
  );
}
