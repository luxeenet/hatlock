import './globals.css';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'HatLock Customer Portal | Manage Your Device Financing',
  description: 'View your agreements, make payments, check device status and download receipts.'
};

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-navy-950 text-slate-100">
        {/* Top Nav */}
        <header className="border-b border-slate-800/80 bg-navy-900/90 backdrop-blur-md sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">HatLock</div>
                <div className="text-[10px] text-slate-400">Customer Portal</div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="hidden sm:block">Need help?</span>
              <a href="tel:+255800000000" className="text-emerald-400 font-medium hover:underline">
                +255 800 000 000
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>

        <footer className="border-t border-slate-800/50 mt-16 py-8 text-center text-xs text-slate-500">
          HatLock by Luxeenet — Smart Device Financing. Secure Payments. Controlled Access.
        </footer>
      </body>
    </html>
  );
}
