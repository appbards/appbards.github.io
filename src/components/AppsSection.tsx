

const apps = [
{
  name: "TaskFlow",
  icon: "/lovable-uploads/app-1-icon.png",
  description:
  "A smart task manager that helps teams collaborate, prioritize, and get things done with delightful simplicity.",
  gradient: "gradient-card-1",
  hasAppStore: false,
  hasPlayStore: true,
  comingSoon: false,
  bgImage: "/lovable-uploads/app-1-bg.png",
  screenshot: "/lovable-uploads/app-1-phone.png"
},
{
  name: "MindGarden",
  icon: "/lovable-uploads/app-2-icon.png",
  description:
  "A calming mindfulness and meditation app designed to help you grow healthy mental habits, one day at a time.",
  gradient: "gradient-card-2",
  hasAppStore: false,
  hasPlayStore: true,
  comingSoon: false,
  bgImage: "/lovable-uploads/app-2-bg.png",
  screenshot: "/lovable-uploads/app-2-phone.png"
},
{
  name: "FitPulse",
  icon: "/lovable-uploads/app-3-icon.png",
  description:
  "Your personal fitness companion that tracks workouts, meals, and progress with a fun, motivating experience.",
  gradient: "gradient-card-3",
  hasAppStore: true,
  hasPlayStore: false,
  comingSoon: false,
  bgImage: "/lovable-uploads/app-3-bg.png",
  screenshot: "/lovable-uploads/app-3-phone.png"
},
{
  name: "SnapNest",
  icon: "/lovable-uploads/app-4-icon.png",
  description:
  "A beautiful photo organizer that helps you capture, curate, and share your most precious family moments.",
  gradient: "gradient-card-1",
  hasAppStore: false,
  hasPlayStore: true,
  comingSoon: false,
  bgImage: "/lovable-uploads/app-4-bg.png",
  screenshot: "/lovable-uploads/app-4-phone.png"
},
{
  name: "LullaBy",
  icon: "/lovable-uploads/app-5-icon.png",
  description:
  "A soothing sleep companion for babies and parents with gentle lullabies, white noise, and bedtime routines.",
  gradient: "gradient-card-2",
  hasAppStore: true,
  hasPlayStore: true,
  comingSoon: false,
  bgImage: "/lovable-uploads/app-5-bg.png",
  screenshot: "/lovable-uploads/app-5-phone.png"
},
{
  name: "TinySteps",
  icon: "/lovable-uploads/app-6-icon.png",
  description:
  "Track your little one's milestones, growth, and daily activities with a joyful and intuitive experience.",
  gradient: "gradient-card-3",
  hasAppStore: true,
  hasPlayStore: false,
  comingSoon: true,
  bgImage: "/lovable-uploads/app-6-bg.png",
  screenshot: "/lovable-uploads/app-6-phone.png"
}];


const AppsSection = () => {
  return (
    <section id="apps" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 opacity-0 animate-fade-up">
          <span className="inline-block text-sm font-semibold text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-4">
            Our Portfolio
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Apps We've Crafted
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Each app is built with care, attention to detail, and a passion for creating experiences users truly enjoy.
          </p>
        </div>

        <div className="space-y-12">
          {apps.map((app, index) => {
            const isReversed = index % 2 !== 0;

            return (
              <div
                key={app.name}
                className="opacity-0 animate-fade-up"
                style={{ animationDelay: `${index * 0.15}s` }}>

                <div
                  className={`${app.gradient} rounded-3xl p-8 md:p-12 shadow-card hover:shadow-elevated transition-shadow duration-300 relative overflow-hidden`}
                  style={{
                    backgroundImage: `url(${app.bgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}>

                  <div className={`grid md:grid-cols-2 gap-8 items-center`}>
                    {/* Text content */}
                    <div className={`space-y-5 ${isReversed ? "md:order-2" : ""}`}>
                      {/* App icon */}
                      <div className="w-20 h-20 rounded-2xl shadow-soft overflow-hidden">
                        {app.icon ?
                        <img src={app.icon} alt={`${app.name} icon`} className="w-full h-full object-cover" /> :

                        <div className="w-full h-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">{app.name[0]}</span>
                          </div>
                        }
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold text-primary-foreground">
                        {app.name}
                      </h3>
                      <p className="leading-relaxed text-primary-foreground">
                        {app.description}
                      </p>
                      <div className="flex flex-wrap gap-3 pt-2">
                        {app.hasAppStore &&
                        <button className="bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 relative">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                            App Store
                            {app.comingSoon &&
                          <span className="absolute -top-2.5 -right-3 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                Soon
                              </span>
                          }
                          </button>
                        }
                        {app.hasPlayStore &&
                        <button className="bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-.91L19.59 12 17.72 10.79l-2.27 2.27 2.27 2.15zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z" />
                            </svg>
                            Google Play
                          </button>
                        }
                      </div>
                    </div>

                    {/* App screenshot */}
                    <div className={`hidden md:flex justify-center ${isReversed ? "md:order-1" : ""}`}>
                      <div className="relative">
                        <img
                          src={app.screenshot}
                          alt={`${app.name} screenshot`}
                          className="w-80 h-auto object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-110" />

                      </div>
                    </div>
                  </div>
                </div>
              </div>);

          })}
        </div>
      </div>
    </section>);

};

export default AppsSection;