import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Shield,
  Globe,
  Users,
  Target,
  BookOpen,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import FadeIn from "../components/FadeIn";

const values = [
  {
    title: "Faith-first matching",
    description:
      "Profiles and prompts are designed to surface shared beliefs, worship rhythms, and long-term intentions.",
    Icon: Heart,
  },
  {
    title: "Safe and respectful",
    description:
      "Community guidelines, content moderation, and reporting tools help keep conversations wholesome.",
    Icon: Shield,
  },
  {
    title: "Across Africa and beyond",
    description:
      "Connect with believers across countries, cultures, and denominations while honoring local values.",
    Icon: Globe,
  },
  {
    title: "Real community",
    description:
      "From prayer partners to intentional dating, FaithBliss is built to support authentic connection.",
    Icon: Users,
  },
];

const steps = [
  {
    title: "Create your story",
    description: "Share your testimony, values, and what you are praying for in a partner.",
    Icon: BookOpen,
  },
  {
    title: "Discover with purpose",
    description: "Use faith-based filters to meet people who align with your convictions.",
    Icon: Target,
  },
  {
    title: "Start meaningful chats",
    description: "Guided prompts help you move beyond small talk into real conversation.",
    Icon: MessageCircle,
  },
];

export default function About() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navOpacity = Math.min(scrollY / 100, 0.95);

  return (
    <main className="bg-gray-900 text-white min-h-screen no-horizontal-scroll">
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: `rgba(17, 24, 39, ${navOpacity})`,
          backdropFilter: navOpacity > 0.1 ? "blur(10px)" : "none",
        }}
      >
        <div className="w-full px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Heart className="h-8 w-8 text-pink-500" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-white">FaithBliss</span>
                <span className="text-xs text-pink-300 font-medium">Africa&apos;s Trusted Platform for Christian Singles</span>
              </div>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="/" className="text-white hover:text-pink-400 transition-colors">
                Home
              </a>
              <a href="#about" className="text-white hover:text-pink-400 transition-colors">
                About
              </a>
              <a href="#values" className="text-white hover:text-pink-400 transition-colors">
                Values
              </a>
              <a href="#how" className="text-white hover:text-pink-400 transition-colors">
                How It Works
              </a>
              <a href="#cta" className="text-white hover:text-pink-400 transition-colors">
                Join
              </a>
            </div>
            <div className="flex gap-2">
              <Link to="/login">
                <button className="text-sm md:text-base bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-pink-600 transition-all whitespace-nowrap">
                  Sign in
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative overflow-hidden pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.15),transparent_50%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.18),transparent_55%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />

        <div className="relative z-10">
          <section id="about" className="min-h-screen flex items-center py-16 md:py-24">
            <FadeIn>
              <div className="w-full px-4 sm:px-6 lg:px-12">
                <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-pink-300 mb-4">
                      About FaithBliss
                    </p>
                    <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white leading-tight">
                      Building faith-centered connections across Africa.
                    </h1>
                    <p className="text-lg text-gray-300 mt-6 max-w-2xl leading-relaxed">
                      FaithBliss exists to help Christian singles meet with clarity, prayer,
                      and intention. We blend local culture, safety, and thoughtful design to
                      create a space where love can grow with purpose.
                    </p>
                  </div>

                  <div className="bg-gray-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl">
                    <div className="space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-pink-500/20 flex items-center justify-center">
                          <Heart className="text-pink-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">Our mission</h3>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            Empower believers to find companionship rooted in faith, character,
                            and shared purpose.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                          <Target className="text-blue-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">Our vision</h3>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            A thriving community where African Christian singles discover love
                            that honors God and family.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                          <Shield className="text-emerald-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">Our promise</h3>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            Respectful experiences, honest profiles, and community standards
                            that protect faith and dignity.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </section>

          <section id="values" className="py-16 md:py-24">
            <FadeIn>
              <div className="w-full px-4 sm:px-6 lg:px-12 text-center mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white">
                  What makes FaithBliss different
                </h2>
                <p className="text-gray-300 mt-4 max-w-2xl mx-auto">
                  We focus on spiritual alignment, cultural understanding, and intentional
                  relationships.
                </p>
              </div>
            </FadeIn>

            <div className="w-full px-4 sm:px-6 lg:px-12">
              <div className="grid gap-6 md:grid-cols-2">
                {values.map((value, index) => (
                  <FadeIn key={value.title} delay={150 * index}>
                    <div className="group bg-gray-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-pink-400/60 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                          <value.Icon className="text-pink-300" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white">{value.title}</h3>
                          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
                            {value.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </section>

          <section id="how" className="py-16 md:py-24">
            <FadeIn>
              <div className="w-full px-4 sm:px-6 lg:px-12">
                <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-center">
                  <div className="space-y-6">
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white">
                      How it works
                    </h2>
                    <p className="text-gray-300 leading-relaxed">
                      FaithBliss blends guided storytelling with thoughtful discovery so your
                      next conversation starts with meaning.
                    </p>
                    <div className="space-y-3 text-sm text-gray-300">
                      {[
                        "Prayerful profile prompts",
                        "Values-based matching signals",
                        "Community-driven reporting and moderation",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="text-pink-400" size={18} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {steps.map((step, index) => (
                      <FadeIn key={step.title} delay={200 * index}>
                        <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-300 font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <step.Icon className="text-pink-300" size={18} />
                              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                            </div>
                            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          </section>

          <section id="cta" className="py-16 md:py-24">
            <FadeIn>
              <div className="w-full px-4 sm:px-6 lg:px-12">
                <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-blue-500/15 p-10 md:p-14 text-center">
                  <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white">
                    Ready to begin your faith-centered journey?
                  </h2>
                  <p className="text-gray-300 mt-4 max-w-2xl mx-auto">
                    Join a growing community of believers who want love that honors God and
                    celebrates culture.
                  </p>
                  <div className="flex flex-wrap justify-center gap-4 mt-8">
                    <Link
                      to="/signup"
                      className="bg-pink-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-pink-600 transition"
                    >
                      Get started
                    </Link>
                    <Link
                      to="/login"
                      className="border border-white/20 text-white px-6 py-3 rounded-full font-semibold hover:border-white/50 transition"
                    >
                      I already have an account
                    </Link>
                  </div>
                </div>
              </div>
            </FadeIn>
          </section>

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
                  <Link to="/about" className="text-gray-300 hover:text-white transition-colors">
                    About
                  </Link>
                  <Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">
                    Privacy
                  </Link>
                  <Link to="/terms" className="text-gray-300 hover:text-white transition-colors">
                    Terms
                  </Link>
                  <Link to="/contact" className="text-gray-300 hover:text-white transition-colors">
                    Contact
                  </Link>
                </div>
              </div>

              <div className="border-t border-gray-800 mt-8 pt-8 text-center space-y-3">
                <p className="text-gray-400">2025 FaithBliss. Built with faith.</p>
                <p className="text-gray-500 text-sm">
                  Powered by <span className="text-blue-400 font-semibold">FutureGRIN</span>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
