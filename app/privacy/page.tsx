export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold tracking-[0.3em] text-cyan-300">
          HALA DIGITAL
        </p>

        <h1 className="mt-4 text-4xl font-black">Privacy Notice</h1>

        <p className="mt-6 text-slate-300">
          Hala Digital Ltd is building a secure SaaS platform for UK accounting
          firms, including client workflow management, HMRC-related practice
          processes, evidence records and billing access controls.
        </p>

        <div className="mt-10 space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-bold text-white">Data we may process</h2>
            <p className="mt-2">
              We may process firm details, user account information, client
              workflow records, billing metadata, audit logs and technical usage
              data required to operate the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Security approach</h2>
            <p className="mt-2">
              The platform is designed around server-side APIs, access control,
              tenant isolation, Supabase row-level security, immutable evidence
              records, Stripe-hosted payment handling and audit-safe workflows.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Professional responsibility</h2>
            <p className="mt-2">
              Accounting firms remain responsible for client authority,
              professional judgement, review, filing decisions and regulatory
              compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Important note</h2>
            <p className="mt-2">
              This notice is an operational draft and should be legally reviewed
              before full public launch or production client onboarding.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
