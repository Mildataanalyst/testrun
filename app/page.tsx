import Image from 'next/image';
import Link from 'next/link';

function SearchIcon(){return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="21" cy="21" r="11"/><path d="M30 30l9 9"/><path className="accent" d="M15 21h12M21 15v12"/></svg>}
function ProgressIcon(){return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 36V24h6v12M21 36V16h6v20M30 36V10h6v26"/><path className="accent" d="M10 18l11-9 9 5 8-10"/></svg>}

export default function Home(){
  return <main className="home-final">
    <section className="home-shell">
      <div className="home-hero-card">
        <div className="home-copy">
          <div className="big-brand"><span>DFP</span><b>2.0</b></div>
          <div className="brand-rule" />
          <h1>NGO Discovery Engine</h1>
          <p>Finding partners who can <span>nourish</span> India better.</p>
          <div className="internal-chip"><i /> For internal use only</div>
        </div>
        <div className="india-orb" aria-hidden="true">
          <Image src="/assets/landing-asset-seamless.png" alt="" width={1235} height={890} priority />
        </div>
      </div>
      <div className="choose-label">Choose a module</div>
      <section className="home-actions" aria-label="Choose module">
        <Link href="/ngo-discovery" className="home-action-card">
          <div className="action-icon"><SearchIcon /></div>
          <div><h2>Launch Discovery</h2><p>Find and qualify NGO partners.</p><small>NGO search · Digital verification · Partner profiles</small></div>
          <strong>→</strong>
        </Link>
        <Link href="/progress" className="home-action-card">
          <div className="action-icon"><ProgressIcon /></div>
          <div><h2>Progress Tracker</h2><p>Monitor pilot execution.</p><small>Owners · Milestones · Outputs</small></div>
          <strong>→</strong>
        </Link>
      </section>
    </section>
  </main>
}
