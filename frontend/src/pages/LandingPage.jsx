import { useState, useEffect } from "react";
import { ArrowRight, Leaf, BarChart3, FileText, Shield, TrendingDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const handleGoogleLogin = () => {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export default function LandingPage() {
  const [isHovering, setIsHovering] = useState(false);
  const navigate = useNavigate();

  // Auto-redirect to dashboard for demo mode
  useEffect(() => {
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] relative overflow-hidden">
      {/* Hero gradient */}
      <div className="hero-gradient absolute inset-0 pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 px-6 lg:px-12 py-6">
        <nav className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-[#22C55E]" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white">
              SCOPE3 REDUCE
            </span>
          </div>
          
          <Button
            data-testid="header-login-btn"
            onClick={handleGoogleLogin}
            className="bg-transparent border border-white/20 hover:bg-white/5 text-white px-6"
          >
            Sign In
          </Button>
        </nav>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 px-6 lg:px-12 pt-16 pb-24">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 mb-8">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-sm text-[#22C55E] font-medium">AI-Powered Recommendations</span>
              </div>
              
              <h1 className="font-display text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                TURN EMISSIONS<br />
                <span className="text-[#22C55E]">INTO ACTION</span>
              </h1>
              
              <p className="text-lg text-gray-400 mb-10 max-w-lg leading-relaxed">
                Stop measuring, start reducing. Our AI engine analyzes 1M+ climate disclosures 
                to identify which suppliers to prioritize and exactly how to reduce your Scope 3 footprint.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  data-testid="hero-cta-btn"
                  onClick={handleGoogleLogin}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`
                    bg-[#22C55E] hover:bg-[#22C55E]/90 text-black font-bold text-base px-8 py-6 
                    rounded-sm uppercase tracking-wider
                    ${isHovering ? 'shadow-[0_0_30px_rgba(34,197,94,0.5)]' : ''}
                  `}
                >
                  Start Reducing Now
                  <ArrowRight className={`ml-2 w-5 h-5 transition-transform duration-200 ${isHovering ? 'translate-x-1' : ''}`} />
                </Button>
                
                <Button
                  variant="outline"
                  className="border-white/20 hover:bg-white/5 text-white px-8 py-6 rounded-sm"
                  data-testid="demo-btn"
                >
                  Watch Demo
                </Button>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="metric-card col-span-2">
                <p className="text-gray-500 text-sm mb-2 uppercase tracking-wider font-display">Total Disclosures Analyzed</p>
                <p className="font-display text-5xl font-extrabold text-white stat-glow">1.2M+</p>
              </div>
              <div className="metric-card">
                <p className="text-gray-500 text-sm mb-2 uppercase tracking-wider font-display">Avg. Reduction Identified</p>
                <p className="font-display text-4xl font-bold text-[#22C55E]">22%</p>
              </div>
              <div className="metric-card">
                <p className="text-gray-500 text-sm mb-2 uppercase tracking-wider font-display">Companies Covered</p>
                <p className="font-display text-4xl font-bold text-[#0EA5E9]">50K+</p>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mb-32">
            <h2 className="font-display text-3xl font-bold text-white text-center mb-4 uppercase tracking-tight">
              How It Works
            </h2>
            <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
              From data to action in three steps. Our AI does the heavy lifting so you can focus on negotiations.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: BarChart3,
                  title: "Prioritize",
                  description: "See which suppliers drive the most emissions. Sorted by upstream impact so you know where to start.",
                  step: "01"
                },
                {
                  icon: Building2,
                  title: "Benchmark",
                  description: "Compare laggards to leaders. Show suppliers their peers achieved 20%+ reductions—and how.",
                  step: "02"
                },
                {
                  icon: FileText,
                  title: "Negotiate",
                  description: "Get AI-generated contract clauses. Copy, paste, and make reduction targets contractually binding.",
                  step: "03"
                }
              ].map((feature, index) => (
                <div 
                  key={feature.title}
                  className="metric-card relative group hover:border-[#22C55E]/30 transition-colors duration-200"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="absolute top-4 right-4 font-display text-4xl font-extrabold text-white/5">
                    {feature.step}
                  </span>
                  <div className="w-12 h-12 rounded-lg bg-[#22C55E]/10 flex items-center justify-center mb-4 group-hover:bg-[#22C55E]/20 transition-colors duration-200">
                    <feature.icon className="w-6 h-6 text-[#22C55E]" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mb-2 uppercase tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Bar */}
          <div className="border-t border-white/10 pt-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#22C55E]" />
                <span className="text-gray-400 text-sm">Enterprise-grade security. Your supply chain data is encrypted and never shared.</span>
              </div>
              <div className="flex items-center gap-6 text-gray-500 text-sm">
                <span>Trusted by Fortune 500</span>
                <span className="w-px h-4 bg-white/20" />
                <span>SOC 2 Compliant</span>
                <span className="w-px h-4 bg-white/20" />
                <span>GDPR Ready</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-[#22C55E]" />
            <span className="text-gray-500 text-sm">© 2024 Scope3 Reduce. Mission Control for Earth.</span>
          </div>
          <div className="flex items-center gap-6 text-gray-500 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
