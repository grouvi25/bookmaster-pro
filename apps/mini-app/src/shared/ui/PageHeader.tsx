import type { ReactNode } from 'react';

interface Props {
  title: string;
  right?: ReactNode;
}

export default function PageHeader({ title, right }: Props) {
  return (
    <div className="flex justify-between items-center mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {right}
    </div>
  );
}
