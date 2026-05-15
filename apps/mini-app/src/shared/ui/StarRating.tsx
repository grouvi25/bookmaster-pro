import clsx from 'clsx';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ value, onChange, size = 'md' }: Props) {
  const emojiSizes = { sm: 'text-[16px]', md: 'text-[24px]', lg: 'text-[32px]' };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange?.(star)}
          className={clsx(
            'interactive',
            onChange ? 'cursor-pointer' : 'cursor-default',
            emojiSizes[size],
          )}
        >
          {star <= value ? '\u2B50' : '\u2606'}
        </button>
      ))}
    </div>
  );
}
