import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Steam Recommender',
  description: 'AI-powered game recommendations based on your Steam library',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="bg-steam-darker/90 backdrop-blur-sm border-b border-[#2a3f5f]/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="flex items-center gap-3 group">
                <svg className="w-8 h-8 text-steam-blue group-hover:text-steam-blue-hover transition-colors" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="text-xl font-bold text-white">Steam Recommender</span>
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
