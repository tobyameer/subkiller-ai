const footerLinks = ["About", "Privacy", "Terms", "Contact", "Twitter", "Instagram"];

export function Footer() {
  return (
    <footer className="border-t border-slate-800/60 bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-sky-300">SubKiller</div>
          <p className="text-sm text-slate-400">
            Kill the zombie subscriptions draining your wallet.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          {footerLinks.map((item) => (
            <span key={item} className="cursor-pointer hover:text-sky-100">
              {item}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
