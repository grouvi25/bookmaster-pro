interface Props { text?: string; }

export default function FullscreenLoader({ text = 'Загрузка...' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-tg-bg">
      <div className="w-10 h-10 rounded-full border-[3px] border-tg-secondary border-t-tg-button animate-spin-fast" />
      <p className="text-body text-tg-hint">{text}</p>
    </div>
  );
}
