interface Props { text?: string; }

export default function FullscreenLoader({ text = 'Загрузка...' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-tg-bg">
      <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-brand-500 animate-spin" />
      <p className="text-sm text-tg-hint">{text}</p>
    </div>
  );
}
