export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://haladigital.co.uk</loc></url>
  <url><loc>https://haladigital.co.uk/hala</loc></url>
  <url><loc>https://haladigital.co.uk/website-design-for-small-business-uk</loc></url>
  <url><loc>https://haladigital.co.uk/small-business-website-cost-uk</loc></url>
  <url><loc>https://haladigital.co.uk/accountant-website-design-uk</loc></url>
  <url><loc>https://haladigital.co.uk/company-formation</loc></url>
  <url><loc>https://haladigital.co.uk/quote</loc></url>
  <url><loc>https://haladigital.co.uk/self-assessment-calculator</loc></url>
  <url><loc>https://haladigital.co.uk/dividend-tax-calculator</loc></url>
  <url><loc>https://haladigital.co.uk/salary-calculator</loc></url>
  <url><loc>https://haladigital.co.uk/how-to-start-a-limited-company-uk</loc></url>
  <url><loc>https://haladigital.co.uk/vat-sic</loc></url>
  <url><loc>https://haladigital.co.uk/vat-registration</loc></url>
  <url><loc>https://haladigital.co.uk/vat-property</loc></url>
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
