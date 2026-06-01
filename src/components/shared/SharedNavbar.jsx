import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiChevronDown, FiMenu, FiX } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import UserProfileMenu from "./UserProfileMenu";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Venues", href: "/discover", route: true },
  { label: "Events", href: "/events", route: true },
  { label: "Categories", href: "/categories", route: true },
  { label: "Contact Us", href: "/contact", route: true },
];

function isNavLinkActive(link, pathname) {
  if (!link.route) return pathname === "/" || pathname === "/home";
  if (link.href === "/discover") {
    return pathname === "/discover" || pathname.startsWith("/discover/");
  }
  if (link.href === "/events") {
    return pathname === "/events" || pathname.startsWith("/events/");
  }
  if (link.href === "/categories") {
    return pathname === "/categories" || pathname.startsWith("/categories/");
  }
  return pathname === link.href;
}

export function HeroCtaButton({ to, children, variant = "lime", className = "" }) {
  const isLime = variant === "lime";
  const isOutline = variant === "outline";
  const variantClass = isLime
    ? "bg-[#A4DA01] text-[#0a0f14] hover:bg-[#b8ef1a]"
    : isOutline
      ? "border border-white/75 bg-white/10 text-white backdrop-blur-sm hover:border-white hover:bg-white/20"
      : "bg-white text-[#0a0f14] hover:bg-slate-100";

  const buttonClass = `hero-cta-btn inline-flex w-full items-center justify-between gap-2 rounded-full py-2.5 pl-5 pr-1.5 text-sm font-bold transition sm:w-auto sm:gap-3 sm:pl-6 ${variantClass} ${className}`.trim();

  const arrow = (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base sm:h-10 sm:w-10 ${
        isLime ? "bg-[#0a0f14]/15" : isOutline ? "bg-white/15" : "bg-[#0a0f14]/10"
      }`}
    >
      →
    </span>
  );

  if (to?.startsWith("#")) {
    return (
      <a href={to} className={buttonClass}>
        <span className="min-w-0 truncate">{children}</span>
        {arrow}
      </a>
    );
  }

  return (
    <Link to={to} className={buttonClass}>
      <span className="min-w-0 truncate">{children}</span>
      {arrow}
    </Link>
  );
}

function NavLinks({ isHome, location, variant, onNavigate }) {
  return NAV_LINKS.map((link, index) => {
    const isActive = isNavLinkActive(link, location.pathname);
    const isDesktop = variant === "desktop";
    const linkClass = isDesktop
      ? `flex items-center gap-1 text-[15px] font-medium transition ${
          isActive
            ? isHome
              ? "text-[#A4DA01]"
              : "text-[#097E52]"
            : isHome
              ? "text-white/90 hover:text-[#A4DA01]"
              : "text-slate-700 hover:text-[#097E52]"
        }`
      : `flex w-full items-center justify-between border-b border-slate-100 px-4 py-3.5 text-[15px] font-semibold transition last:border-b-0 ${
          isActive ? "bg-emerald-50 text-[#097E52]" : "text-slate-800 hover:bg-slate-50"
        }`;

    const close = () => onNavigate?.();

    if (link.route) {
      return (
        <Link key={link.label} to={link.href} className={linkClass} onClick={close}>
          {link.label}
        </Link>
      );
    }

    const hashHref = isHome ? link.href : `/${link.href}`;

    return (
      <a key={link.label} href={hashHref} className={linkClass} onClick={close}>
        {link.label}
        {isDesktop && index > 0 && index < 4 ? <FiChevronDown className="text-xs opacity-70" /> : null}
      </a>
    );
  });
}

export default function SharedNavbar({ variant = "default" }) {
  const { token } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === "/" || location.pathname === "/home";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  if (variant === "hero") {
    return (
      <nav
        className={`fixed left-0 top-0 z-50 w-full transition ${
          isHome
            ? "border-b border-white/10 bg-black/50 backdrop-blur-md backdrop-saturate-150"
            : "border-b border-slate-200 bg-white/95 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <span className="text-2xl leading-none" aria-hidden="true">
              ⚽
            </span>
            <span className="relative leading-tight">
              {isHome ? (
                <span className="absolute -top-3.5 left-0 text-[10px] font-bold uppercase tracking-wider text-[#A4DA01]">
                  Football
                </span>
              ) : null}
              <span className={`text-xl font-bold tracking-tight ${isHome ? "text-white" : "text-[#192335]"}`}>
                Turf<span className="text-[#A4DA01]">Pro</span>
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-4 md:gap-6 md:flex">
            <NavLinks isHome={isHome} location={location} variant="desktop" />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {!token ? (
              <Link
                to="/auth/login"
                className={`hidden rounded-full px-4 py-2 text-sm font-semibold transition sm:inline-flex ${
                  isHome
                    ? "text-white/90 hover:bg-white/10 hover:text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-[#097E52]"
                }`}
              >
                Sign In
              </Link>
            ) : (
              <UserProfileMenu isHome={isHome} />
            )}

            <button
              type="button"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition md:hidden ${
                isHome
                  ? "border-white/20 text-white hover:bg-white/10"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              aria-expanded={mobileOpen}
              aria-controls="public-mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 top-[72px] z-40 bg-black/40 md:hidden"
            aria-label="Close menu overlay"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div
          id="public-mobile-nav"
          className={`absolute left-0 right-0 top-full z-50 border-b border-slate-200 bg-white shadow-lg shadow-slate-900/10 transition md:hidden ${
            mobileOpen ? "visible opacity-100" : "invisible pointer-events-none opacity-0"
          }`}
        >
          <div className="mx-auto max-w-7xl">
            <NavLinks
              isHome={isHome}
              location={location}
              variant="mobile"
              onNavigate={() => setMobileOpen(false)}
            />
            {!token ? (
              <div className="border-t border-slate-100 p-4 sm:hidden">
                <Link
                  to="/auth/login"
                  className="flex w-full items-center justify-center rounded-full bg-[#097E52] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#086a45]"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="landing-nav">
      <div className="brand">TurfPro</div>
      <div className="landing-nav-links">
        <Link to="/">Home</Link>
        <Link to="/auth/login">Login</Link>
        <Link to="/auth/register">Register</Link>
        <Link to="/auth/register-owner">Owner Register</Link>
        <Link to="/auth/forgot-password">Forgot Password</Link>
      </div>
    </nav>
  );
}
