import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-neutral-900 py-12 border-t border-neutral-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <Link href="/" className="inline-flex items-center space-x-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-glow transition-all">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-xl font-semibold text-white">Voicing</span>
          </Link>

          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-neutral-400">
            <Link href="#" className="hover:text-brand-400 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-brand-400 transition-colors">Terms</Link>
            <Link href="#" className="hover:text-brand-400 transition-colors">Status</Link>
            <Link href="#" className="hover:text-brand-400 transition-colors">Support</Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800 text-center text-neutral-500">
          <p>&copy; 2024 Voicing. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}