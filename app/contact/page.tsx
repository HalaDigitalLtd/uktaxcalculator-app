import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold tracking-[0.3em] text-cyan-300">
          HALA DIGITAL
        </p>

        <h1 className="mt-4 text-4xl font-black">Contact Hala Digital</h1>

        <p className="mt-6 text-slate-300">
          Speak to us about accountant SaaS onboarding, MTD ITSA workflows,
          practice automation, enterprise access, billing plans or implementation
          support.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">Start using the platform</h2>
            <p className="mt-3 text-slate-300">
              Create an account and begin the SaaS onboarding journey.
            </p>
            <Link
              href="/auth/register"
              className="mt-6 inline-block rounded-2xl bg-cyan-300 px-5 py-3 font-bold text-slate-950"
            >
              Start onboarding
            </Link>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">Existing user</h2>
            <p className="mt-3 text-slate-300">
              Log in to access your firm dashboard, billing page and MTD ITSA
              workflow tools.
            </p>
            <Link
              href="/auth/login"
              className="mt-6 inline-block rounded-2xl border border-white/20 px-5 py-3 font-bold"
            >
              Login
            </Link>
          </div>
        </div>

        <p className="mt-10 text-sm text-slate-400">
          Enterprise and bespoke onboarding enquiries can be handled through the
          Hala Digital team before production rollout.
        </p>
      </section>
    </main>
  );
}
