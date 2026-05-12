import axios from 'axios';
import MasterCard from './MasterCard';

async function getFeatured() {
  try {
    const resp = await axios.get(
      `${process.env.API_URL}/marketplace/featured`,
      { params: { limit: 6 }, timeout: 5000 }
    );
    return resp.data?.items || [];
  } catch {
    return [];
  }
}

export default async function FeaturedMasters() {
  const masters = await getFeatured();
  if (masters.length === 0) {
    return (
      <p className="text-gray-400 text-center py-8">
        Скоро здесь появятся лучшие мастера
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {masters.map((master: any) => (
        <MasterCard key={master.id} master={master} />
      ))}
    </div>
  );
}
