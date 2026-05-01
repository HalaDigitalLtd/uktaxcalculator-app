export default function ThankYouPage() {
  return (
    <div style={{ padding: "60px", textAlign: "center", maxWidth: "700px", margin: "auto" }}>
      
      <h1 style={{ fontSize: "36px", marginBottom: "20px" }}>
        Thank you 👋
      </h1>

      <p style={{ fontSize: "18px" }}>
        We’ve received your details. An accountant will review your case and get back to you shortly.
      </p>

      <div style={{ 
        marginTop: "30px", 
        padding: "20px", 
        background: "#f5f5f5", 
        borderRadius: "10px" 
      }}>
        <strong>⚡ Want faster help?</strong>
        <p style={{ marginTop: "10px" }}>
          Skip the queue and speak directly with us now.
        </p>

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

      <div style={{ marginTop: "40px" }}>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Most clients who speak with us directly get their tax issues resolved 3x faster.
        </p>
      </div>

    </div>
  );
}
