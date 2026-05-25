import { Link } from "react-router-dom"; // <-- CHANGED from 'next/link'
import { Heart, Globe, Users, Target, Shield, Handshake, BookOpen } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import FadeIn from "../components/FadeIn"; // <-- IMPORTED our component
import InstallAppButton from "../components/InstallAppButton";

// All &apos; have been replaced with '
// All &quot; have been replaced with "

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const currentYear = new Date().getFullYear();
  
  // Array of background images
  // IMPORTANT: Place these images in the 'frontend/public' folder
  const backgroundImages = useMemo(
    () => [
      '/bg.jpg',
      '/bg2.jpg',
      '/bg3.jpg',
    ],
    []
  );

  // Preload hero background images so transitions are smooth (no black flashes)
  useEffect(() => {
    backgroundImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [backgroundImages]);

  // Image rotation effect with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        (prevIndex + 1) % backgroundImages.length
      );
    }, 4000); // Change image every 4 seconds

    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    let ticking = false;
    const smoothScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', smoothScroll, { passive: true });
    return () => window.removeEventListener('scroll', smoothScroll);
  }, []);

  // Tinder-style scroll calculations
  const heroHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const scrollProgress = Math.min(scrollY / heroHeight, 1);
  
  // Background parallax - slower movement (Tinder style)
  const bgTransform = scrollY * 0.3;
  
  // Content fade and movement - faster than background
  const contentOpacity = Math.max(0, 1 - scrollProgress * 1.2);
  const contentTransform = scrollY * 0.6;
  
  // Headline scale effect (Tinder-style)
  const headlineScale = Math.max(0.8, 1 - scrollProgress * 0.3);
  const headlineOpacity = Math.max(0, 1 - scrollProgress * 1.5);
  
  // Navigation background appears on scroll
  const navOpacity = Math.min(scrollY / 100, 0.95);

  return (
    <main className="bg-gray-900 no-horizontal-scroll dashboard-main" style={{ scrollBehavior: 'smooth' }}>
      {/* Navigation */}
      <nav 
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: `rgba(17, 24, 39, ${navOpacity})`,
          backdropFilter: navOpacity > 0.1 ? 'blur(10px)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <img
                src="/favicon.svg"
                alt="FaithBliss logo"
                className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 object-contain rounded-sm"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-2xl font-bold text-white">FaithBliss</span>
                <span className="text-xs text-pink-300 font-medium">Africa's Trusted Platform for Christian Singles</span>
              </div>
            </div>
            <div className="hidden md:flex space-x-8">
              {/* These are hash links, so <a> is correct */}
              <a href="#features" className="text-white hover:text-pink-400 transition-colors">Why FaithBliss</a>
              <a href="/about" className="text-white hover:text-pink-400 transition-colors">About</a>
              <a href="#stories" className="text-white hover:text-pink-400 transition-colors">Love Stories</a>
              <a href="#community" className="text-white hover:text-pink-400 transition-colors">Community</a>
            </div>
            <div className="flex gap-2">
              {/* These are page links, so <Link> is correct */}
              <Link to="/login">
                <button className="text-sm md:text-base bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-pink-600 transition-all whitespace-nowrap">
                  Join Now
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Tinder-Style Parallax */}
      <section className="relative min-h-screen md:h-screen overflow-hidden">
        {/* Background Images with Fade Out/In Rotation */}
        {backgroundImages.map((image, index) => (
          <div 
            key={index}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110 will-change-transform transition-opacity duration-700 ease-in-out"
            style={{
              backgroundImage: `url('${image}')`,
              backgroundColor: '#0f172a',
              transform: `translate3d(0, ${bgTransform}px, 0) scale(1.1)`,
              opacity: index === currentImageIndex ? 1 : 0,
            }}
          />
        ))}
        
        <div className="absolute inset-0">
          {/* Lighter overlay for better image visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/50"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-black/10"></div>
        </div>
        
        {/* Content Layer - Faster movement with fade */}
        <div 
          className="relative z-10 min-h-screen md:h-screen flex items-center justify-center px-4 pt-20 pb-8 md:pt-24 md:pb-0 will-change-transform"
          style={{
            opacity: contentOpacity,
            transform: `translate3d(0, ${contentTransform}px, 0)`,
          }}
        >
          <div className="text-center text-white max-w-4xl mx-auto flex flex-col items-center justify-center">
            {/* Headline with Tinder-style scale and fade effect */}
            <div 
              className="will-change-transform flex flex-col items-center"
              style={{
                opacity: headlineOpacity,
                transform: `scale(${headlineScale})`,
              }}
            >
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6 leading-tight text-center">
                African Christians Across the Globe
                <span className="block bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                  Are Finding Love
                </span>
                <span className="block text-white" style={{ fontFamily: "'Dancing Script', cursive" }}>on FaithBliss</span>
              </h1>
              <p className="text-sm md:text-xl mb-8 md:mb-12 text-gray-200 max-w-3xl mx-auto text-center">
                Built for African Christians worldwide, connecting believers across the continent and the diaspora through shared faith, values, and marriage intentions.
              </p>
              
              {/* CTA Button - Simple & Responsive */}
              <div className="flex flex-col items-center gap-3">
                <Link to="/signup">
                  <button className="bg-pink-500 text-white px-6 py-3 md:px-8 md:py-4 rounded-full text-base md:text-lg font-semibold hover:bg-pink-600 transition-all transform hover:scale-105 shadow-2xl backdrop-blur-sm border border-pink-400/20">
                    Join Now
                  </button>
                </Link>
                <InstallAppButton variant="subtle" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-gradient-to-b from-gray-900 to-gray-800 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Why FaithBliss?
              </h2>
              <p className="text-md text-gray-300 max-w-3xl mx-auto leading-relaxed">
                More than just a dating app. We understand African faith, values, and realities
              </p>
            </div>
          </FadeIn>

          {/* Features Grid - 3 per row, responsive */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* First Row */}
            <FadeIn delay={200}>
              <div className="group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-pink-500/50 transition-all duration-500 hover:transform hover:scale-105 h-full">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center">
                    <Heart className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Marriage, Not Casual Dating</h3>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                    Every connection is intended to nurture godly friendship that could lead to Christian marriage.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={300}>
              <div className="group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-green-500/50 transition-all duration-500 hover:transform hover:scale-105 h-full">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <Globe className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Built for African Christians</h3>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                    FaithBliss understands African faith, values, and realities. Built around them.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={400}>
              <div className="group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-500 hover:transform hover:scale-105 h-full">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Diverse & Interdenominational</h3>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                    From Pentecostal to Catholic and every church family in between. Connect with high-value believers across the continent and the diaspora who share your faith and your roots
                  </p>
                </div>
              </div>
            </FadeIn>

            {/* Second Row */}
            <FadeIn delay={500}>
              <div className="group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all duration-500 hover:transform hover:scale-105 h-full">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full flex items-center justify-center">
                    <Target className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Intentional Filters for Your Specific Type</h3>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                    Find exactly what you’re looking for. Narrow your search by country, denomination, or faith journey to find a partner who truly aligns with your vision.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={600}>
              <div className="group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-orange-500/50 transition-all duration-500 hover:transform hover:scale-105 h-full">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Safe & Decent</h3>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                    We welcome your gorgeous and best looks, but filter out inappropriate content to protect Christian values.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={700}>
              <div className="group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-teal-500/50 transition-all duration-500 hover:transform hover:scale-105 h-full">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <Handshake className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Community & Meetups</h3>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                    Go beyond swipes. Connect through sub-groups, interest spaces, and safe events for travelers, professionals, creatives, and more.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Faith & Love Resources - Full Width */}
          <FadeIn delay={800}>
            <div className="mt-12 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-2xl p-8 border border-gray-600 backdrop-blur-sm">
              <div className="flex items-center justify-center space-x-4 mb-1">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl md:text-3xl font-bold text-white">Faith & Love Resources</h3>
              </div>
              <p className="text-sm md:text-xl text-gray-300 text-left max-w-4xl mx-auto leading-relaxed">
                Get devotionals, relationship insights, and marriage preparation tools designed to help Christian singles grow in love and faith together.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Success Stories Section (Coming Soon) */}
      <section id="stories" className="py-20 px-6 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <FadeIn>
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Love Stories
              </h2>
              <p className="text-md md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                We're building something beautiful. Real stories from couples who met on FaithBliss.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="rounded-3xl border border-gray-700 bg-gray-900/40 backdrop-blur-xl p-10 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-500">
                <Heart className="h-10 w-10 text-white animate-pulse" />
              </div>

              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">Coming Soon</h3>
              <p className="text-gray-300 max-w-xl mx-auto">
                We'll be sharing inspiring stories from FaithBliss couples very soon. Stay tuned and join the waitlist to be the first to hear when they're live.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/signup" className="inline-flex items-center justify-center rounded-full bg-pink-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 hover:bg-pink-600 transition">
                  Join the waitlist
                </Link>
                <Link to="/about" className="inline-flex items-center justify-center rounded-full border border-gray-700 bg-white/5 px-8 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
                  Learn more
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="bg-gray-900/70 text-white py-14 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold">Need help or have a question?</h2>
            <p className="text-gray-300 mt-2 max-w-xl">
              Our Trust & Safety team is here to help. Whether you have a question about getting started, a report to make, or feedback to share.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="mailto:faithbliss@futuregrin.com"
              className="inline-flex items-center justify-center rounded-full bg-pink-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 hover:bg-pink-600 transition"
            >
              Email Support
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-7 py-3 text-sm font-semibold text-white hover:bg-white/15 transition"
            >
              Contact Page
            </Link>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row  md:justify-between items-center">
            <div className="mb-8 md:mb-0 text-center md:text-left">
              <h3 className="text-2xl font-bold  bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent">
                FaithBliss 
              </h3>
              <p className="text-gray-400 mt-2">Building faithful connections</p>
            </div>
            
            <div className="flex space-x-8">
              <Link to="/about" className="text-gray-300 hover:text-white transition-colors">About</Link>
              <Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="text-gray-300 hover:text-white transition-colors">Terms</Link>
              <Link to="/contact" className="text-gray-300 hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center space-y-3">
            <p className="text-gray-400">
              {currentYear} FaithBliss. Built with faith.
            </p>
            <p className="text-gray-500 text-sm">
              Powered by <span className="text-blue-400 font-semibold">FutureGRIN</span>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
