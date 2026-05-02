export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://haladigital.co.uk</loc>
    </url>
    <url>
      <loc>https://haladigital.co.uk/vat-sic</loc>
    </url>
    <url>
      <loc>https://haladigital.co.uk/vat-registration</loc>
    </url>
    <url>
      <loc>https://haladigital.co.uk/vat-property</loc>
    </url>
    <url>
      <loc>https://haladigital.co.uk/quote</loc>
    </url>
  </urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
