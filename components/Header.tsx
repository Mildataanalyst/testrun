import Link from 'next/link';

export default function Header({ active }: { active?: 'repository' }) {
  return (
    <header className="dfp-topbar">
      <div className="dfp-wrap dfp-topbar-inner">
        <Link href="/" className="dfp-mini-brand" aria-label="DFP 2.0">
          <span>DFP</span><b>·</b><em>2.0</em>
        </Link>
        <nav className="dfp-nav" aria-label="Primary navigation">
          <Link className={active === undefined ? 'nav-pill active' : 'nav-pill'} href="/">Home</Link>
          <Link className={active === 'repository' ? 'nav-pill active' : 'nav-pill'} href="/ngo-discovery">NGO Discovery</Link>
        </nav>
      </div>
    </header>
  );
}
