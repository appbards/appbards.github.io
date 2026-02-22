import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AppsSection from "@/components/AppsSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    const target = location.state?.scrollTo || location.hash;
    if (target) {
      setTimeout(() => {
        const el = document.querySelector(target);
        el?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [location.hash, location.state]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <AppsSection />
        <AboutSection />
        {/* <ContactSection /> */}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
