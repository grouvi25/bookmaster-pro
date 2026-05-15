import type { ReactNode } from 'react';

interface Props {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}

export default function PageHeader({ title, left, right }: Props) {
  return (
    <div className="flex justify-between items-center px-screen-x pt-section-y mb-section-y">
      <div className="flex items-center gap-2">
        {left}
        <h1 className="text-h1">{title}</h1>
      </div>
      {right}
    </div>
  );
}
