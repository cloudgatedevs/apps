import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { imageUrl } from './branding-model';
import './profile.css';

export function ProfileAvatar({ name = '', url, color, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const src = imageUrl(url), initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
  return <span className={'profile-avatar ' + className} style={color ? { background: color } : undefined}>{src && !failed ? <img src={src} alt={name ? `${name}'s profile picture` : 'Profile picture'} onError={() => setFailed(true)}/> : initials || <UserRound size={22}/>}</span>;
}

