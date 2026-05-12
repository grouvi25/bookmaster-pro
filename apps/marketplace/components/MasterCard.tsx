import Link from 'next/link';
import Image from 'next/image';

interface MasterCardProps {
  master: {
    id: number;
    slug: string;
    name: string;
    specialization: string;
    city?: string;
    avatar_url?: string;
    rating_avg?: number;
    rating_count?: number;
    is_verified?: boolean;
  };
}

export default function MasterCard({ master }: MasterCardProps) {
  return (
    <Link
      href={`/masters/${master.slug}`}
      className="block bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Аватар */}
      <div className="h-40 bg-blue-50 flex items-center justify-center text-5xl">
        {master.avatar_url ? (
          <Image
            src={master.avatar_url}
            alt={master.name}
            width={320}
            height={160}
            className="w-full h-full object-cover"
          />
        ) : (
          '\ud83d\udc64'
        )}
      </div>

      {/* Информация */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-lg">{master.name}</h3>
          {master.is_verified && (
            <span className="text-blue-500 text-xs">&#10003;</span>
          )}
        </div>

        <p className="text-gray-500 text-sm mb-2">
          {master.specialization}
          {master.city && ` · ${master.city}`}
        </p>

        {/* Рейтинг */}
        {(master.rating_count ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-yellow-400">{'\u2605'}</span>
            <span className="font-medium">
              {master.rating_avg?.toFixed(1)}
            </span>
            <span className="text-gray-400">
              ({master.rating_count} отзывов)
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
