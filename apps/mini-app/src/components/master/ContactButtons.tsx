import clsx from 'clsx';
import { Phone, Send } from 'lucide-react';

interface Props {
  phone?: string | null;
  clientPlatform?: string | null;
  clientPlatformId?: string | null;
  className?: string;
}

function getTelegramLink(platformId: string): string {
  // platformId может быть username или числовой ID
  if (/^\d+$/.test(platformId)) {
    return `tg://user?id=${platformId}`;
  }
  return `tg://resolve?domain=${platformId.replace('@', '')}`;
}

function getVkLink(platformId: string): string {
  if (/^\d+$/.test(platformId)) {
    return `https://vk.com/id${platformId}`;
  }
  return `https://vk.com/${platformId}`;
}

function getMaxLink(platformId: string): string {
  return `https://max.ru/user/${platformId}`;
}

export default function ContactButtons({
  phone,
  clientPlatform,
  clientPlatformId,
  className,
}: Props) {
  const hasPhone = !!phone;
  const hasPlatform = !!clientPlatform && !!clientPlatformId;

  if (!hasPhone && !hasPlatform) return null;

  let messengerLink: string | null = null;
  let messengerLabel = 'Написать';
  let MessengerIcon = Send;

  if (hasPlatform) {
    switch (clientPlatform) {
      case 'telegram':
        messengerLink = getTelegramLink(clientPlatformId!);
        messengerLabel = 'Telegram';
        break;
      case 'vk':
        messengerLink = getVkLink(clientPlatformId!);
        messengerLabel = 'VK';
        break;
      case 'max':
        messengerLink = getMaxLink(clientPlatformId!);
        messengerLabel = 'MAX';
        break;
      default:
        messengerLink = null;
    }
  }

  return (
    <div className={clsx('flex gap-2', className)}>
      {hasPhone && (
        <a
          href={`tel:${phone}`}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2',
            'py-2.5 rounded-btn text-xs font-semibold',
            'bg-[#34C759]/12 text-[#34C759]',
            'active:scale-95 transition-all',
          )}
        >
          <Phone className="w-3.5 h-3.5" />
          Позвонить
        </a>
      )}
      {messengerLink && (
        <a
          href={messengerLink}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex-1 flex items-center justify-center gap-2',
            'py-2.5 rounded-btn text-xs font-semibold',
            'bg-[#007AFF]/12 text-[#007AFF]',
            'active:scale-95 transition-all',
          )}
        >
          <MessengerIcon className="w-3.5 h-3.5" />
          {messengerLabel}
        </a>
      )}
    </div>
  );
}
