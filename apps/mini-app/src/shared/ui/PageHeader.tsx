import type { ReactNode } from 'react';

interface Props {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}

export default function PageHeader({ title, left, right }: Props) {
  return (
    <div className="flex justify-between items-center mb-5">
      <div className="flex items-center gap-2">
        {left}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {right}
    </div>
  );
}
