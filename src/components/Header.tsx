import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Apps", href: "#apps" },
  { label: "About Us", href: "#about" },
  { label: "Privacy Policy", href: "/privacy-policy", isRoute: true },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: typeof navLinks[0]) => {
    if (link.isRoute) {
      e.preventDefault();
      navigate(link.href);
      setMobileOpen(false);
      return;
    }
    
    // For hash links, if we're not on the home page, navigate to home first
    if (location.pathname !== "/") {
      e.preventDefault();
      navigate("/");
      // The browser will automatically scroll to the hash after navigation
      // if we append it to the URL, or we let the link behave natively on the home page
      setTimeout(() => {
        const element = document.querySelector(link.href);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
    
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <a 
          href="/" 
          onClick={(e) => {
            if (location.pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="flex items-center gap-2"
        >
          <img src={logo} alt="App Bards" className="h-10 w-auto" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.isRoute ? link.href : link.href}
              onClick={(e) => handleNavClick(e, link)}
              className="text-muted-foreground font-medium text-sm hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              {link.label}
            </a>
          ))}
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
              href={link.isRoute ? link.href : link.href}
              className="block py-3 text-muted-foreground font-medium hover:text-primary transition-colors cursor-pointer"
              onClick={(e) => handleNavClick(e, link)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Header;
