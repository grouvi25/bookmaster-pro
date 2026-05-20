import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';
import BookButton from '@/components/BookButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const master = await getMaster(params.slug);
  if (!master) return { title: 'Мастер не найден' };
  const name = master.display_name || master.name || 'Мастер';
  return {
    title: `${name} — ${master.specialization} в ${master.city || 'России'} | BookMaster Pro`,
    description:
      `${name}: ${master.specialization}. ` +
      `Рейтинг ${master.rating_avg?.toFixed(1) || '—'} · ${master.rating_count || 0} отзывов. ` +
      `Онлайн-запись на BookMaster Pro.`,
    openGraph: {
      type: 'profile',
      title: `${name} — ${master.specialization}`,
      description: master.description || '',
      images: master.avatar_url ? [master.avatar_url] : [],
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: name,
        description: master.description || master.specialization,
        address: {
          '@type': 'PostalAddress',
          addressLocality: master.city || '',
          addressCountry: 'RU',
        },
        aggregateRating:
          master.rating_count > 0
            ? {
                '@type': 'AggregateRating',
                ratingValue: master.rating_avg,
                reviewCount: master.rating_count,
              }
            : undefined,
      }),
    },
  };
}

async function getMaster(slug: string) {
  try {
    const resp = await axios.get(
      `${process.env.API_URL}/masters/${slug}`,
      { timeout: 5000, headers: { 'Cache-Control': 'no-cache' } }
    );
    return resp.data;
  } catch {
    return null;
  }
}

async function getReviews(masterId: number) {
  try {
    const resp = await axios.get(
      `${process.env.API_URL}/reviews/master/${masterId}`,
      { params: { limit: 5 }, timeout: 5000 }
    );
    return resp.data;
  } catch {
    return { reviews: [], stats: {} };
  }
}

export default async function MasterProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const master = await getMaster(params.slug);
  if (!master) notFound();

  const name = master.display_name || master.name || 'Мастер';
  const reviewsData = await getReviews(master.id);
  const appUrl = `${process.env.APP_URL}?startParam=m_${params.slug}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Профиль */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Аватар */}
        <div className="flex-shrink-0">
          <div className="w-32 h-32 rounded-2xl bg-blue-100 overflow-hidden flex items-center justify-center text-5xl">
            {master.avatar_url ? (
              <Image
                src={master.avatar_url}
                alt={name}
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            ) : (
              '\ud83d\udc64'
            )}
          </div>
        </div>

        {/* Основная инфо */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{name}</h1>
            {master.is_verified && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-md font-medium">
                &#10003; Проверен
              </span>
            )}
          </div>
          <p className="text-gray-600 mb-2">
            {master.specialization}
            {master.city && ` · ${master.city}`}
          </p>

          {/* Рейтинг */}
          {master.rating_count > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex text-yellow-400">
                {'\u2605'.repeat(Math.round(master.rating_avg))}
                {'\u2606'.repeat(5 - Math.round(master.rating_avg))}
              </div>
              <span className="font-semibold">
                {master.rating_avg?.toFixed(1)}
              </span>
              <span className="text-gray-400 text-sm">
                ({master.rating_count} отзывов)
              </span>
            </div>
          )}

          {/* Bio */}
          {master.description && (
            <p className="text-gray-600 leading-relaxed">{master.description}</p>
          )}
        </div>
      </div>

      {/* Услуги */}
      {master.services?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Услуги и цены</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {master.services.map((svc: any) => (
              <div
                key={svc.id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-xl"
              >
                <div>
                  <div className="font-medium">{svc.name}</div>
                  <div className="text-sm text-gray-400">
                    {svc.duration_min} мин
                  </div>
                </div>
                <div className="font-semibold text-blue-600">
                  {svc.price
                    ? `${Number(svc.price).toLocaleString('ru')} \u20bd`
                    : svc.price_from
                      ? `от ${Number(svc.price_from).toLocaleString('ru')} \u20bd`
                      : 'Дог.'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Отзывы */}
      {reviewsData.reviews?.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Отзывы</h2>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">{'\u2605'}</span>
              <span className="font-bold">
                {reviewsData.stats?.average?.toFixed(1)}
              </span>
              <span className="text-gray-400 text-sm">
                &middot; {reviewsData.stats?.total} отзывов
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {reviewsData.reviews.map((review: any) => (
              <div key={review.id} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{review.client_name}</span>
                  <div className="flex text-yellow-400 text-sm">
                    {'\u2605'.repeat(review.rating)}
                  </div>
                </div>
                {review.text && (
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {review.text}
                  </p>
                )}
                {review.master_reply && (
                  <div className="mt-3 pl-3 border-l-2 border-blue-200">
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Ответ мастера: </span>
                      {review.master_reply}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="sticky bottom-4 flex flex-col gap-3">
        <BookButton appUrl={appUrl} masterName={name} />
      </div>
    </div>
  );
}
