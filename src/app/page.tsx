import Link from "next/link";
import Button from "@/components/Button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-0 via-neutral-50 to-brand-50/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-mesh opacity-5" />

      <Header />

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 lg:pt-28 lg:pb-36">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center space-y-8">
            <div className="animate-fade-in">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-neutral-900 mb-6 leading-[1.1] text-balance">
                Simple, powerful
                <span className="block gradient-text">audio processing</span>
              </h1>
            </div>
            
            <div className="animate-slide-up">
              <p className="text-xl md:text-2xl text-neutral-600 max-w-3xl mx-auto leading-relaxed text-pretty">
                AI speech enhancement, rendering, and embeddings—crafted for creators and teams.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-scale-in">
              <Link href="/register">
                <Button size="xl" variant="outline" className="shadow-none hover:shadow-none !text-neutral-900">
                  Start Free Trial
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              </Link>
              <Link href="/demo">
                <Button variant="outline" size="xl" className="text-neutral-900 border-neutral-300 bg-neutral-0 shadow-none hover:shadow-none">
                  Try Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Subtle visual */}
        <div className="absolute inset-x-0 -bottom-10 flex justify-center opacity-20">
          <div className="h-24 w-[720px] bg-gradient-to-r from-brand-400/60 to-brand-600/60 blur-3xl rounded-full" />
        </div>
      </section>

      {/* Features Section
      <section id="features" className="py-24 bg-gradient-to-b from-transparent to-neutral-50/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-6 gradient-text">
              Powerful Audio Processing
            </h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto text-pretty">
              Everything you need to create professional-quality audio content with cutting-edge AI technology
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "AI Speech Enhancement",
                description: "Advanced neural networks remove noise and enhance voice clarity for crystal-clear recordings.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                  </svg>
                ),
                gradient: "from-blue-500 to-cyan-500"
              },
              {
                title: "Real-time Processing",
                description: "Process audio streams in real-time with ultra-low latency for live applications.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                gradient: "from-purple-500 to-indigo-500"
              },
              {
                title: "Batch Operations",
                description: "Process hundreds of files simultaneously with intelligent queuing and progress tracking.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                ),
                gradient: "from-emerald-500 to-teal-500"
              },
              {
                title: "Audio Embeddings",
                description: "Generate semantic embeddings for advanced audio search and content discovery.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
                gradient: "from-orange-500 to-red-500"
              },
              {
                title: "Advanced Analytics",
                description: "Deep insights into audio quality, content analysis, and performance metrics.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                gradient: "from-pink-500 to-rose-500"
              },
              {
                title: "Cloud Infrastructure",
                description: "Scalable cloud processing with global edge networks for optimal performance.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                ),
                gradient: "from-violet-500 to-purple-500"
              }
            ].map((feature, index) => (
              <div 
                key={index} 
                className="group p-8 rounded-2xl glass border border-neutral-200/50 hover:border-brand-200 transition-all duration-300 hover:shadow-glass animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* CTA Section */}
      {/* <section className="py-20">
        <div className="max-w-4xl mx-auto text-center px-6">
          <div className="glass rounded-2xl p-10 border border-neutral-200/60">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4 text-balance">Ready to transform your audio?</h2>
            <p className="text-lg text-neutral-600 mb-8">Start free, upgrade anytime. No credit card required.</p>
            <Link href="/register">
              <Button size="lg" className="shadow-glow hover:shadow-glow-lg">
                Start your free trial
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </section> */}

      <Footer />
    </div>
  );
}
