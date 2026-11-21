import Link from "next/link";
import Brand from "@/components/Brand";

export const metadata = {
  title: "Privacy — Seila",
};

export default function PrivacyPage() {
  const contact = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL;

  return (
    <main className="privacy-page">
      <div className="privacy-shell">
        <Link href="/" className="brand brand-back" aria-label="Back to Seila home">
          <Brand />
        </Link>
        <h1>Privacy at Seila</h1>
        <p className="privacy-lede">
          We only ask for the information needed to keep you informed about Seila.
        </p>
        <section>
          <h2>What we collect</h2>
          <p>
            When you join the waitlist, we store your email address, when you signed up,
            and the notification and optional marketing choices you made. We do not create an account.
            To protect the form from abuse, we temporarily keep a non-reversible, keyed token derived
            from network information. We do not store your plain IP address in the waitlist.
          </p>
        </section>
        <section>
          <h2>How we use it</h2>
          <p>
            We use your email to tell you when Seila launches. We send occasional style and travel
            updates only if you separately choose that option. We do not sell your waitlist data.
          </p>
        </section>
        <section>
          <h2>Storage and your choices</h2>
          <p>
            Signups are stored in our existing Supabase PostgreSQL project. Access is restricted to
            the server. You can ask to access or delete your signup, or withdraw optional marketing
            consent at any time. We will remove waitlist details when they are no longer needed for
            launch communication. The abuse-prevention window lasts 15 minutes; expired counters
            are removed during later signups.
          </p>
          {contact ? (
            <p>For privacy requests, email <a href={`mailto:${contact}`}>{contact}</a>.</p>
          ) : (
            <p>Privacy contact details will be published before the site goes live.</p>
          )}
        </section>
        <Link href="/" className="return-link">Back to Seila</Link>
      </div>
    </main>
  );
}
