import Link from 'next/link';
import { Suspense } from 'react';
import FeaturedMasters from '@/components/FeaturedMasters';

const CATEGORIES = [
  { name: 'Маникюр/педикюр', slug: 'manicure', icon: '\ud83d\udc85' },
  { name: 'Брови и ресницы', slug: 'brows', icon: '\u2728' },
  { name: 'Массаж', slug: 'massage', icon: '\ud83d\udcaa' },
  { name: 'Косметология', slug: 'cosmetology', icon: '\ud83e\uddea' },
  { name: 'Парикмахер', slug: 'hair', icon: '\u2702\ufe0f' },
  { name: 'Фотограф', slug: 'photo', icon: '\ud83d\udcf7' },
  { name: 'Репетитор', slug: 'tutoring', icon: '\ud83d\udcda' },
  { name: 'Фитнес', slug: 'fitness', icon: '\ud83c\udfcb\ufe0f' },
];

function MastersSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-gray-100 rounded-2xl h-48 animate-pulse"
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Запись к мастеру —<br />
            <span className="text-blue-200">легко и удобно</span>
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Найдите мастера маникюра, бровиста, косметолога или репетитора.
            Онлайн-запись. Реальные отзывы.
          </p>
          {/* Поиск */}
          <form
            action="/search"
            method="get"
            className="flex gap-2 max-w-lg mx-auto"
          >
            <input
              name="q"
              placeholder="Маникюр, брови, массаж..."
              className="flex-1 px-4 py-3 rounded-xl text-gray-900 text-base outline-none"
            />
            <button
              type="submit"
              className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              Найти
            </button>
          </form>
        </div>
      </section>

      {/* Категории */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Популярные категории</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/search?specialization=${cat.slug}`}
              className="flex flex-col items-center p-5 rounded-2xl bg-gray-50 hover:bg-blue-50 transition-colors border border-gray-100 hover:border-blue-200"
            >
              <span className="text-3xl mb-2">{cat.icon}</span>
              <span className="text-sm font-medium text-gray-700">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Топ мастера */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold mb-6">Топ мастера платформы</h2>
        <Suspense fallback={<MastersSkeleton />}>
          <FeaturedMasters />
        </Suspense>
      </section>

      {/* CTA для мастеров */}
      <section className="bg-blue-600 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Вы мастер? Подключитесь бесплатно
          </h2>
          <p className="text-blue-100 mb-6 text-lg">
            Получите онлайн-запись, CRM, напоминания и AI-ассистента
          </p>
          <a
            href="https://t.me/BookMasterProBot"
            target="_blank"
            className="inline-block bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg transition-all"
          >
            Начать бесплатно в Telegram &rarr;
          </a>
        </div>
      </section>
    </div>
  );
}
