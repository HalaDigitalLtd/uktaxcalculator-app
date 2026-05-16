export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold tracking-[0.3em] text-cyan-300">
          HALA DIGITAL
        </p>

        <h1 className="mt-4 text-4xl font-black">Terms of Use</h1>

        <p className="mt-6 text-slate-300">
          Hala Digital provides software tools for accounting practice workflow
          management, MTD ITSA operational processes, evidence management,
          billing access and firm administration.
        </p>

        <div className="mt-10 space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-bold text-white">Use of the platform</h2>
            <p className="mt-2">
              Users must ensure they have authority to manage firm, staff and
              client information entered into the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">HMRC workflows</h2>
            <p className="mt-2">
              The platform may support HMRC-related workflows, but firms remain
              responsible for checking accuracy, obtaining client approval and
              making final submission decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Billing</h2>
            <p className="mt-2">
              Subscription billing is handled using Stripe. Access may be
              limited if billing status, usage limits or firm access controls
              require restriction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Important note</h2>
            <p className="mt-2">
              These terms are an operational draft and should be legally reviewed
              before full public launch or production client onboarding.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
