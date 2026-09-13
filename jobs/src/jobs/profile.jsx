import React, { useCallback, useEffect, useState } from 'react';
import { Camera, UserRound } from 'lucide-react';
import { CropImage } from './BrandingEditor';
import { imageUrl } from './branding-model';
import { preview } from './api';
import { getSelfProfile, removeProfilePicture, uploadProfilePicture } from './profile-api';
import { Button, ErrorBox, Modal } from './ui';
import './profile.css';

const PROFILE_CHANGED = 'jobs:profile-photo-changed';
export function useSelfProfile(enabled = true) {
  const [profile, setProfile] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const next = await getSelfProfile();
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED, { detail: next }));
    return next;
  }, []);
  useEffect(() => {
    if (!enabled || preview) { setProfile(null); return; }
    let active = true;
    const changed = event => { setProfile(event.detail); setError(''); };
    window.addEventListener(PROFILE_CHANGED, changed); setLoading(true); setError('');
    getSelfProfile().then(next => { if (active) setProfile(next); }).catch(err => { if (active) setError(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; window.removeEventListener(PROFILE_CHANGED, changed); };
  }, [enabled]);
  return { profile, loading, error, refresh };
}

export function ProfileAvatar({ name = '', url, color, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const src = imageUrl(url), initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
  return <span className={'profile-avatar ' + className} style={color ? { background: color } : undefined}>{src && !failed ? <img src={src} alt={name ? `${name}'s profile picture` : 'Profile picture'} onError={() => setFailed(true)}/> : initials || <UserRound size={22}/>}</span>;
}

export function ProfilePictureEditor({ account }) {
  const own = useSelfProfile(!account), { profile, loading, error: loadError, refresh } = account || own;
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirmRemove, setConfirmRemove] = useState(false);
  const name = [profile?.name, profile?.surname].filter(Boolean).join(' ');
  const saved = async () => {
    try { await refresh(); setNotice('Profile picture updated.'); }
    catch (err) { setError(err); }
  };
  return <section className="profile-picture-editor" aria-label="Profile picture"><ProfileAvatar name={name} url={profile?.photoUrl} className="profile-avatar-large"/><div><h3>Profile picture</h3><p className="muted">A photo for your account. Upload a photo and crop it to fit.</p><div className="actions"><label className={'button secondary upload-button ' + (loading || busy || preview || !profile ? 'disabled-upload' : '')}><Camera size={16}/> {profile?.photoUrl ? 'Change photo' : 'Upload photo'}<input type="file" aria-label="Upload my profile picture" disabled={loading || busy || preview || !profile} accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { const next = event.target.files?.[0]; event.target.value = ''; setError(''); setNotice(''); if (!next) return; if (next.size > 20 * 1024 * 1024) { setError('Choose an image under 20 MB.'); return; } setFile(next); }}/></label>{profile?.photoUrl && <Button type="button" secondary disabled={loading || busy} onClick={() => setConfirmRemove(true)}>Remove photo</Button>}</div>{preview && <p className="muted">Sign in to the connected app to change your account photo.</p>}{loadError && <Button type="button" secondary onClick={() => refresh().catch(setError)}>Reload profile</Button>}<ErrorBox error={error || loadError}/>{notice && <p role="status" className="profile-photo-notice">{notice}</p>}</div>
    {file && <CropImage file={file} square saveImage={uploadProfilePicture} close={() => setFile(null)} select={saved}/>}
    {confirmRemove && <Modal title="Remove your profile picture?" close={() => { if (!busy) setConfirmRemove(false); }}><p>Your initials will be shown in place of your photo.</p><ErrorBox error={error}/><div className="actions"><Button type="button" secondary disabled={busy} onClick={() => setConfirmRemove(false)}>Keep photo</Button><Button type="button" busy={busy} onClick={async () => { setBusy(true); setError(''); try { await removeProfilePicture(); await saved(); setConfirmRemove(false); } catch (err) { setError(err); } finally { setBusy(false); } }}>Remove photo</Button></div></Modal>}
  </section>;
}

export function MyProfile({ account }) {
  return <section className="panel my-profile-panel"><h2>My profile</h2><p className="muted">Manage the photo on your Cloudgate account.</p><ProfilePictureEditor account={account}/>{account.profile && <div className="my-profile-details"><strong>{[account.profile.name, account.profile.surname].filter(Boolean).join(' ')}</strong><span>{account.profile.email}</span><a className="text-link" href="/account">Open my account</a></div>}</section>;
}
