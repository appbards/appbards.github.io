const Footer = () => (
  <footer id="contact" className="bg-muted py-16">
    <div className="container mx-auto px-6">
      <div className="grid md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">AB</span>
            </div>
            <span className="text-lg font-bold text-foreground">App Bards</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            Crafting beautiful mobile experiences that people love to use every day.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-foreground">Quick Links</h4>
          <div className="flex flex-col gap-2">
            {["Home", "Apps", "About Us", "Contact"].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(" ", "")}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-foreground">Get in Touch</h4>
          <p className="text-sm text-muted-foreground">hello@appbards.com</p>
          <p className="text-sm text-muted-foreground">Follow us on social media</p>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          © 2026 App Bards. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
