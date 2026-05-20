import { Metadata } from 'next';
import axios from 'axios';
import MasterCard from '@/components/MasterCard';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  specialization?: string;
  city?: string;
  page?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const spec = searchParams.specialization || '';
  const city = searchParams.city || '';
  const q = searchParams.q || '';
  let title = 'Мастера — BookMaster Pro';
  if (q) title = `${q} — BookMaster Pro`;
  if (spec) title = `${spec} в ${city || 'России'} — BookMaster Pro`;
  return {
    title,
    description: 'Найдите лучших мастеров. Онлайн-запись. Отзывы.',
  };
}

async function getMasters(params: SearchParams) {
  try {
    const response = await axios.get(
      `${process.env.API_URL}/marketplace/search`,
      {
        params: {
          q: params.q,
          specialization: params.specialization,
          city: params.city,
          limit: 20,
          offset: (parseInt(params.page || '1') - 1) * 20,
        },
        timeout: 5000,
        headers: { 'Cache-Control': 'no-cache' },
      }
    );
    return response.data;
  } catch {
    return { masters: [], total: 0 };
  }
}

function SearchFilters({ current }: { current: SearchParams }) {
  const specializations = [
    'Маникюр',
    'Брови',
    'Массаж',
    'Косметология',
    'Парикмахер',
    'Репетитор',
  ];
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {specializations.map((s) => (
        <a
          key={s}
          href={`/search?specialization=${encodeURIComponent(s)}`}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            current.specialization === s
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {s}
        </a>
      ))}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const data = await getMasters(searchParams);
  const masters = data.masters || data.items || [];
  const total = data.total || 0;
  const query = searchParams.q || searchParams.specialization || '';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Заголовок */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {query ? `Мастера по запросу «${query}»` : 'Все мастера'}
        </h1>
        {total > 0 && (
          <p className="text-gray-500 mt-1">Найдено: {total}</p>
        )}
      </div>

      {/* Фильтры */}
      <SearchFilters current={searchParams} />

      {/* Сетка мастеров */}
      {masters.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">{'\ud83d\udd0d'}</div>
          <h2 className="text-xl font-semibold mb-2">Мастера не найдены</h2>
          <p className="text-gray-500">
            Попробуйте изменить параметры поиска
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {masters.map((master: any) => (
            <MasterCard key={master.id} master={master} />
          ))}
        </div>
      )}
    </div>
  );
}
