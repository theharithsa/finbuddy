import { useState } from 'react';

function safePhotoUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function AccountAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = safePhotoUrl(photoUrl);
  return (
    <span className="m3-account-avatar" role="img" aria-label={name + ' profile'}>
      {url && url !== failedUrl
        ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
        : <span aria-hidden="true">{Array.from(name.trim())[0]?.toUpperCase() || 'F'}</span>}
    </span>
  );
}
