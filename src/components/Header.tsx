import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Apps", href: "#apps" },
  { label: "About Us", href: "#about" },
  { label: "Privacy Policy", href: "/privacy-policy", isRoute: true },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <a href="#home" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">AB</span>
          </div>
          <span className="text-xl font-bold text-foreground">App Bards</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.isRoute ? undefined : link.href}
              onClick={link.isRoute ? (e) => { e.preventDefault(); navigate(link.href); } : undefined}
              className="text-muted-foreground font-medium text-sm hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity duration-200"
          >
            Get in Touch
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-background border-t border-border px-6 pb-6 animate-fade-in">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.isRoute ? undefined : link.href}
              className="block py-3 text-muted-foreground font-medium hover:text-primary transition-colors cursor-pointer"
              onClick={() => { if (link.isRoute) navigate(link.href); setMobileOpen(false); }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="block mt-2 gradient-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold text-center"
            onClick={() => setMobileOpen(false)}
          >
            Get in Touch
          </a>
        </nav>
      )}
    </header>
  );
};

export default Header;
