import { headers } from "next/headers";
import HalaPage from "./hala/page";
import CalculatorPage from "./calculator-page";

function SaaSGatewayPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-cyan-300">
              HALA DIGITAL
            </p>
            <h1 className="mt-1 text-xl font-bold">
              MTD ITSA Practice Platform
            </h1>
          </div>

          <div className="flex gap-3">
            <a href="/auth/login" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
              Login
            </a>
            <a href="/auth/register" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200">
              Start onboarding
            </a>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-2">
          <section>
            <p className="mb-5 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              Secure SaaS gateway for UK accountancy practices
            </p>

            <h2 className="text-5xl font-black tracking-tight md:text-7xl">
              Accountant-grade MTD ITSA workflows, evidence and control.
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Hala Digital helps practices manage HMRC authorisation, client onboarding, quarterly workflows, ledger evidence, review controls, Stripe billing access and operational visibility from one SaaS workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a href="/auth/register" className="rounded-2xl bg-cyan-300 px-6 py-4 font-bold text-slate-950 hover:bg-cyan-200">
                Start onboarding
              </a>
              <a href="/dashboard" className="rounded-2xl border border-white/20 px-6 py-4 font-bold hover:bg-white/10">
                Go to dashboard
              </a>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <h3 className="text-2xl font-bold">Practice operating system</h3>
            <div className="mt-6 space-y-4 text-sm text-slate-200">
              {[
                "HMRC OAuth and client connection workflows",
                "Cumulative-aware obligations and quarter provisioning",
                "Ledger-first quarterly records with digital evidence",
                "Review, lock, submit and amendment-safe controls",
                "Stripe billing, usage limits and operational dashboard",
                "RBAC, audit trails and future GDPR-ready governance",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  ✓ {item}
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="border-t border-white/10 py-6 text-xs text-slate-500">
          <p>
            Hala Digital supports accounting practice workflows and evidence management. Firms remain responsible for professional review, client authority and final submission decisions.
          </p>
        </footer>
      </section>
    </main>
  );
}

export default async function Page() {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  if (host.startsWith("app.haladigital.co.uk")) {
    return <SaaSGatewayPage />;
  }

  if (host === "haladigital.co.uk" || host === "www.haladigital.co.uk") {
    return <HalaPage />;
  }

  return <CalculatorPage />;
}
