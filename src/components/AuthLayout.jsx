import "./../styles/landing.css";

import landingBg from "./../assets/landing-bg.jpg";
import noatLogo from "./../assets/noat-logo.png";

/* Shared background + hero for the public auth screens (Landing, Register) */
export default function AuthLayout({ children }) {
  return (
    <div className="ln-page">
      <div className="ln-bg" aria-hidden="true">
        <img src={landingBg} alt="" />
        <div className="ln-bg-scrim" />
      </div>

      <main className="ln-main">
        <div className="ln-hero">
          <div className="ln-brand">
            <div className="ln-brand-logo">
              <img src={noatLogo} alt="N.O.A.T. Logo" />
            </div>
            <div>
              <span className="ln-brand-name">
                N<span className="ln-accent">.</span>O
                <span className="ln-accent">.</span>A
                <span className="ln-accent">.</span>T
                <span className="ln-accent">.</span>
              </span>
              <p className="ln-brand-tag">Niruthi Office Automation Tool</p>
            </div>
          </div>

          <h1 className="ln-title">
            One intelligent workspace
            <br className="ln-br" /> for a{" "}
            <span className="ln-accent">more productive Niruthi.</span>
          </h1>
          <p className="ln-subtitle">
            Bring your everyday work operations, AI assistance, documents,
            communication, tickets, files and administrative workflows into
            one intelligent platform.
          </p>
        </div>

        <div className="ln-card-wrap">
          <div className="ln-card">{children}</div>
        </div>
      </main>
    </div>
  );
}
