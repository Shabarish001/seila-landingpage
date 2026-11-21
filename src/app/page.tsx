import Image from "next/image";
import Link from "next/link";
import WaitlistForm from "@/components/WaitlistForm";

const pillars = [
  {
    title: "Discover",
    text: "Find pieces that feel like you, wherever you are going.",
  },
  {
    title: "Curate",
    text: "Build a considered wardrobe for the moments ahead.",
  },
  {
    title: "Travel",
    text: "Bring your style along for every new chapter.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-heading">
        <Image
          src="/images/seila-city-hero.png"
          alt="A traveler with a blush scarf and suitcase overlooking a sunlit coastal city"
          fill
          priority
          sizes="100vw"
          className="hero-background"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <header className="site-header">
            <Link href="/" className="brand" aria-label="Seila home">
              {/* Replace the wordmark with the supplied logo asset when provided. */}
              <span className="brand-wordmark">seila</span>
            </Link>
            <span className="coming-soon">Coming soon</span>
          </header>

          <div className="hero-inner">
            <div className="hero-copy">
              <h1 id="hero-heading">Style your next adventure.</h1>
              <p className="hero-description">
                Seila is a fashion discovery and travel-inspired styling experience
                for every place you&apos;ll go and every version of you along the way.
              </p>
              <WaitlistForm />
            </div>
            <div className="hero-postcard" aria-hidden="true">
              <div className="postcard-photo">
                <Image src="/images/seila-journey.png" alt="" fill sizes="230px" />
              </div>
              <div className="postcard-footer">
                <span>Pack with possibility</span>
                <div className="postcard-swatches"><i /><i /><i /><i /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell">
        <section className="brand-teaser" aria-label="The Seila experience">
          <div className="teaser-intro">
            <h2>A little more room for possibility.</h2>
            <p>From finding the right piece to feeling like yourself somewhere new, Seila is made for the whole journey.</p>
          </div>
          <div className="pillars">
            {pillars.map((pillar) => (
              <div className="pillar" key={pillar.title}>
                <h3>{pillar.title}</h3>
                <p>{pillar.text}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="site-footer">
          <span>© {new Date().getFullYear()} Seila</span>
          <span>Your email stays with Seila. No account needed.</span>
          <Link href="/privacy">Privacy</Link>
        </footer>
      </div>
    </main>
  );
}
