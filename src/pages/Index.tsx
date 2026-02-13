import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AppsSection from "@/components/AppsSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <AppsSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
