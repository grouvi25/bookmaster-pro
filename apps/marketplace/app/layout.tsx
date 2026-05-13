import type { Metadata } from 'next';
import './globals.css';

const BOT_USERNAME = process.env.NEXT_PUBLIC_TG_BOT_USERNAME ?? '';

export const metadata: Metadata = {
  title: 'BookMaster Pro — онлайн-запись к мастерам',
  description:
    'Найдите мастера маникюра, бровиста, косметолога. Запись онлайн. Отзывы реальных клиентов.',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'BookMaster Pro',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-white">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-bold text-xl text-blue-600">
          BookMaster Pro
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <a
            href="/search"
            className="text-gray-600 hover:text-blue-600 transition-colors"
          >
            Найти мастера
          </a>
          <a
            href={`https://t.me/${BOT_USERNAME}`}
            target="_blank"
            className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Для мастеров
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-semibold text-gray-700">BookMaster Pro</span>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} BookMaster Pro. Все права
            защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}
