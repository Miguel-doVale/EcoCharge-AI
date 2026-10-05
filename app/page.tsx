import SmoothScroll from "@/components/landing/SmoothScroll";
import SiteNav from "@/components/landing/SiteNav";
import Hero from "@/components/landing/Hero";
import LiveTicker from "@/components/landing/LiveTicker";
import HowItWorks from "@/components/landing/HowItWorks";
import SplineStage from "@/components/landing/SplineStage";
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
        <SplineStage />
        <Features />
        <Architecture />
        <FinalCTA />
      </main>
    </SmoothScroll>
  );
}
