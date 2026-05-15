interface Props {
  onBack: () => void;
  label?: string;
}

export default function SectionBack({ onBack, label = 'Назад' }: Props) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-0.5 text-tg-link text-body mb-3 interactive"
    >
      <span className="text-[14px]">{'\←'}</span>
      {label}
    </button>
  );
}
