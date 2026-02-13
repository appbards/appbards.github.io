import { Users, Lightbulb, Heart } from "lucide-react";

const values = [
  {
    icon: Lightbulb,
    title: "Innovation First",
    description: "We push boundaries with fresh ideas and cutting-edge technology to create apps that stand out.",
  },
  {
    icon: Users,
    title: "User-Centered",
    description: "Every pixel and interaction is designed with real people in mind — intuitive, accessible, delightful.",
  },
  {
    icon: Heart,
    title: "Passion-Driven",
    description: "We genuinely love what we do, and that energy shines through in every product we ship.",
  },
];

const AboutSection = () => {
  return (
    <section id="about" className="py-24 gradient-hero">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 opacity-0 animate-fade-up">
          <span className="inline-block text-sm font-semibold text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-4">
            Who We Are
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            About App Bards
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We're a small but mighty team of designers, developers, and storytellers who believe great apps
            start with empathy and end with smiles. Based on a love for craft, we turn bold ideas into
            polished mobile experiences.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {values.map((item, index) => (
            <div
              key={item.title}
              className="bg-card rounded-2xl p-8 shadow-card hover:shadow-elevated transition-shadow duration-300 opacity-0 animate-fade-up"
              style={{ animationDelay: `${index * 0.12}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <item.icon size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
