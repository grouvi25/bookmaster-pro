export default function Loading({ text = 'Загрузка...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] animate-fade-in">
      <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-tg-hint text-sm">{text}</p>
    </div>
  );
}
