import { headers } from "next/headers";
import HalaPage from "./hala/page";
import CalculatorPage from "./calculator-page";

export default function Page() {
  const host = headers().get("host") || "";

  if (host.includes("haladigital.co.uk")) {
    return <HalaPage />;
  }

  return <CalculatorPage />;
}
