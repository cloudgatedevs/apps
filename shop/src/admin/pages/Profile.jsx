import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthContext } from '@/shared/auth';
import { Field } from '@/shared/ui/forms';
import { PageHead } from '@/shared/ui/ui';
import { SkeletonForm } from '@/shared/ui/skeleton';

const Profile = () => {
  const { headerUser, updateUser, loading } = useAuthContext();
  const user = headerUser?.user;

  const [form, setForm] = useState({ name: '', surname: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ name: user?.name ?? '', surname: user?.surname ?? '', email: user?.emailAddress ?? '' });
  }, [user?.name, user?.surname, user?.emailAddress]);

  const handleChange = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateUser({ name: form.name, surname: form.surname, email: form.email });
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(error?.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHead title="Profile" subtitle="Update the details on your IdP account." />
      {loading && !user ? (
        <SkeletonForm fields={3} />
      ) : (
        <form onSubmit={handleSubmit} className="card flex flex-col gap-5 p-4">
          <Field label="First name" htmlFor="name"><input id="name" type="text" value={form.name} onChange={handleChange('name')} className="input" /></Field>
          <Field label="Last name" htmlFor="surname"><input id="surname" type="text" value={form.surname} onChange={handleChange('surname')} className="input" /></Field>
          <Field label="Email" htmlFor="email"><input id="email" type="email" value={form.email} onChange={handleChange('email')} className="input" /></Field>
          <div className="flex items-center justify-end">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      )}
    </div>
  );
};

export { Profile };
