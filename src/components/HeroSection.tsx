import heroIllustration from "@/assets/hero-illustration.png";

const HeroSection = () => {
  return (
    <section id="home" className="gradient-hero overflow-hidden">
      <div className="container mx-auto px-6 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div className="space-y-6 opacity-0 animate-fade-up">
            <span className="inline-block text-sm font-semibold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
              Crafting Digital Experiences
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground">
              We Build Apps
              <br />
              <span className="text-primary">People Love</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              App Bards is a creative mobile app studio turning ideas into beautifully crafted, user-friendly applications that make a difference.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="#apps"
                className="gradient-primary text-primary-foreground px-8 py-3.5 rounded-full font-semibold text-base hover:opacity-90 transition-opacity duration-200 shadow-soft">

                Explore Our Apps
              </a>
              <a
                href="#about"
                className="bg-card text-foreground border border-border px-8 py-3.5 rounded-full font-semibold text-base hover:shadow-card transition-all duration-200">

                Learn More
              </a>
            </div>
          </div>

          {/* Right */}
          <div className="flex justify-center lg:justify-end opacity-0 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <img

              alt="People interacting with mobile app"
              className="w-full max-w-lg animate-float" src="/lovable-uploads/a17b3bb5-846b-44d8-a996-ea3b9066c31e.png" />

          </div>
        </div>
      </div>
    </section>);

};

export default HeroSection;