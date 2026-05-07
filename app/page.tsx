import { headers } from "next/headers";
import HalaPage from "./hala/page";
import CalculatorPage from "./calculator-page";

export default async function Page() {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  if (host.includes("haladigital.co.uk")) {
    return <HalaPage />;
  }

  return <CalculatorPage />;
}
