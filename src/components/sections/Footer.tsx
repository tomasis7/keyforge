// PLACEHOLDER: keyforge.dev is a fictional domain, so this address does not
// receive mail. Kept deliberately as demo copy — the site is a portfolio piece,
// not a storefront. Swap it for a real contact route (email, GitHub, a form)
// before treating this as a way to reach anyone.
const CONTACT_HREF = 'mailto:hello@keyforge.dev';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p className="footer-big">This configurator was designed &amp; built by Tomas.</p>
        <p className="footer-sub">Want one for your product?</p>
        <a className="btn footer-cta" href={CONTACT_HREF}>
          Get in touch
        </a>
      </div>
    </footer>
  );
}
