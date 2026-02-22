import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Apps", href: "#apps" },
  { label: "About Us", href: "#about" },
  { label: "Privacy Policy", href: "/privacy-policy", isRoute: true },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: typeof navLinks[0]) => {
    e.preventDefault();
    if (link.isRoute) {
      if (location.pathname !== link.href) {
        navigate(link.href);
      }
    } else if (location.pathname !== "/") {
      navigate("/", { state: { scrollTo: link.href } });
    } else {
      const element = document.querySelector(link.href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <a href={location.pathname === "/" ? "#home" : "/"} onClick={location.pathname !== "/" ? (e) => { e.preventDefault(); navigate("/"); } : undefined} className="flex items-center gap-2">
          <img src={logo} alt="App Bards" className="h-10 w-auto" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.isRoute ? `/#${link.href}` : undefined}
              onClick={(e) => handleNavClick(e, link)}
              className="text-muted-foreground font-medium text-sm hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              {link.label}
            </a>
          ))}
          {/* <a
            href={location.pathname === "/" ? "#contact" : undefined}
            onClick={location.pathname !== "/" ? (e) => { e.preventDefault(); navigate("/#contact"); } : undefined}
            className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity duration-200"
          >
            Get in Touch
          </a> */}
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
              href={link.isRoute ? `/#${link.href}` : undefined}
              className="block py-3 text-muted-foreground font-medium hover:text-primary transition-colors cursor-pointer"
              onClick={(e) => { handleNavClick(e, link); setMobileOpen(false); }}
            >
              {link.label}
            </a>
          ))}
          {/* <a
            href={location.pathname === "/" ? "#contact" : undefined}
            className="block mt-2 gradient-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold text-center cursor-pointer"
            onClick={(e) => {
              if (location.pathname !== "/") {
                e.preventDefault();
                navigate("/#contact");
              }
              setMobileOpen(false);
            }}
          >
            Get in Touch
          </a> */}
        </nav>
      )}
    </header>
  );
};

export default Header;
