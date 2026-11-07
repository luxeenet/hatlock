import './globals.css';
import DashboardShell from '../components/DashboardShell';

export const metadata = {
  title: 'HatLock by Luxeenet | Laptop Financing & Protection SaaS',
  description: 'Smart Device Financing. Secure Payments. Controlled Access.'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-navy-950 text-slate-100">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
