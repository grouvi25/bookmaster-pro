'use client';

interface Props {
  appUrl: string;
  masterName: string;
}

export default function BookButton({ appUrl, masterName }: Props) {
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-4">
      <a
        href={appUrl}
        className="block w-full bg-blue-600 text-white text-center py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors"
      >
        Записаться к {masterName.split(' ')[0]}
      </a>
      <p className="text-center text-xs text-gray-400 mt-2">
        Открывается в Telegram
      </p>
    </div>
  );
}
