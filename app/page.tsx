import SmoothScroll from "@/components/landing/SmoothScroll";
import SiteNav from "@/components/landing/SiteNav";
import Hero from "@/components/landing/Hero";
import LiveTicker from "@/components/landing/LiveTicker";
import HowItWorks from "@/components/landing/HowItWorks";
import SplineStage from "@/components/landing/SplineStage";
import CarExperience from "@/components/landing/car/CarExperience";
import Features from "@/components/landing/Features";
import Architecture from "@/components/landing/Architecture";
import FinalCTA from "@/components/landing/FinalCTA";

export default function Home() {
  return (
    <SmoothScroll>
      <SiteNav />
      <main>
        <Hero />
        <LiveTicker />
        <HowItWorks />
        {/* Carro 3D próprio (Three.js). Se um dia houver cena no Spline, defina NEXT_PUBLIC_SPLINE_SCENE. */}
        {process.env.NEXT_PUBLIC_SPLINE_SCENE ? <SplineStage /> : <CarExperience />}
        <Features />
        <Architecture />
        <FinalCTA />
      </main>
    </SmoothScroll>
  );
}
