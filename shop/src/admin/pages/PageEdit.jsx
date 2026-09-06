import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Badge, PageHead } from '@/shared/ui/ui';
import { SkeletonForm } from '@/shared/ui/skeleton';
import { Field, ConfirmButton } from '@/shared/ui/forms';
import { Tooltip } from '@/shared/ui/menus';
import { renderMarkdown } from '@/shared/lib/markdown';
import { errorMessage } from '@/shared/lib/errors';
import { ExternalLink } from 'lucide-react';

const empty = { title: '', slug: '', summary: '', bodyMarkdown: '', status: 'published', showInNav: false, showInFooter: true, showContact: false };
const fromServer = (p) => ({ title: p.Title ?? '', slug: p.Slug ?? '', summary: p.Summary ?? '', bodyMarkdown: p.BodyMarkdown ?? '', status: p.Status ?? 'published', showInNav: !!p.ShowInNav, showInFooter: p.ShowInFooter !== 0, showContact: !!p.ShowContact });

const TOOLBAR = [
  ['H2', (s) => `## ${s || 'Heading'}`], ['H3', (s) => `### ${s || 'Heading'}`], ['B', (s) => `**${s || 'bold'}**`], ['I', (s) => `_${s || 'italic'}_`],
  ['List', (s) => (s ? s.split('\n').map((l) => `- ${l}`).join('\n') : '- item')], ['Link', (s) => `[${s || 'link text'}](https://)`], ['Quote', (s) => `> ${s || 'quote'}`],
];

const PageEdit = () => {
  const { id } = useParams();
  const creating = !id || id === 'new';
  const navigate = useNavigate();
  const page = useAsync(() => (creating ? Promise.resolve(null) : adminApi.pages.get(Number(id))), [id]);
  const [form, setForm] = useState(empty);
  const [saved, setSaved] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('split'); // write | split | preview

  useEffect(() => {
    if (creating) { setForm(empty); setSaved(empty); return; }
    if (page.data) { const f = fromServer(page.data); setForm(f); setSaved(f); }
  }, [creating, page.data]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const html = useMemo(() => renderMarkdown(form.bodyMarkdown), [form.bodyMarkdown]);
  const isSystem = !!page.data?.IsSystem;

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const save = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) return toast.error('Give the page a title.');
    setSaving(true);
    try {
      const payload = { title: form.title, slug: form.slug || undefined, summary: form.summary, bodyMarkdown: form.bodyMarkdown, status: form.status, showInNav: form.showInNav, showInFooter: form.showInFooter, showContact: form.showContact };
      if (creating) {
        const created = await adminApi.pages.create(payload);
        toast.success('Page created.');
        navigate(`/pages/${created.Id}`, { replace: true });
      } else {
        const updated = await adminApi.pages.update(Number(id), payload);
        const f = fromServer(updated);
        setForm(f);
        setSaved(f);
        toast.success('Saved.');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
    return undefined;
  };
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const insert = (fn) => {
    const ta = document.getElementById('body-md');
    if (!ta) return;
    const start = ta.selectionStart ?? form.bodyMarkdown.length;
    const end = ta.selectionEnd ?? start;
    const selected = form.bodyMarkdown.slice(start, end);
    const replacement = fn(selected);
    const next = form.bodyMarkdown.slice(0, start) + replacement + form.bodyMarkdown.slice(end);
    setForm((f) => ({ ...f, bodyMarkdown: next }));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + replacement.length, start + replacement.length); });
  };

  const remove = async () => {
    try { await adminApi.pages.remove(Number(id)); toast.success('Page deleted.'); navigate('/pages', { replace: true }); } catch (err) { toast.error(errorMessage(err)); }
  };

  if (!creating && page.loading) return <div className="flex flex-col gap-6"><SkeletonForm fields={3} /><SkeletonForm fields={1} /></div>;
  if (!creating && page.error) return <ErrorNote error={page.error} />;

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <PageHead title={creating ? 'New page' : form.title || 'Edit page'} subtitle={creating ? 'Written in Markdown. Pages can sit in the navigation, the footer, or be linked from anywhere.' : (
        <span className="inline-flex flex-wrap items-center gap-2"><Badge tone={form.status === 'published' ? 'green' : 'amber'} dot>{form.status}</Badge>{isSystem ? <Badge tone="blue">system page</Badge> : null}{form.status === 'published' ? <a href={`/pages/${saved.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:text-accent-600">View in store <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a> : null}</span>
      )}>
        <Link to="/pages" className="btn-ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back</span></Link>
        {dirty ? <span className="text-xs text-amber-600">Unsaved changes</span> : null}
        <Tooltip text="Ctrl S"><button type="submit" disabled={saving || (!creating && !dirty)} className="btn-primary">{saving ? 'Saving…' : creating ? 'Create page' : 'Save changes'}</button></Tooltip>
      </PageHead>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {TOOLBAR.map(([label, fn]) => <button key={label} type="button" onClick={() => insert(fn)} className="btn-ghost btn-sm font-mono">{label}</button>)}
            </div>
            <div className="flex rounded-lg border border-ink-600 bg-white p-0.5">
              {[['write', 'Write'], ['split', 'Split'], ['preview', 'Preview']].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 text-xs ${view === v ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={view === v}>{label}</button>
              ))}
            </div>
          </div>
          <div className={`grid gap-4 ${view === 'split' ? 'lg:grid-cols-2' : ''}`}>
            {view !== 'preview' ? (
              <textarea id="body-md" value={form.bodyMarkdown} onChange={set('bodyMarkdown')} className="textarea min-h-[28rem] font-mono text-[13px] leading-relaxed" placeholder={'## Heading\n\nWrite the page in Markdown. **Bold**, _italic_, lists, links and headings all work.'} spellCheck />
            ) : null}
            {view !== 'write' ? (
              <div className="min-h-[28rem] overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-5">
                <h1 className="mb-4 text-xl font-semibold text-mist">{form.title || 'Untitled page'}</h1>
                {form.bodyMarkdown.trim() ? <div className="prose-page" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-sm text-mist-dim">Nothing to preview yet.</p>}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-mist-dim">{form.bodyMarkdown.trim().split(/\s+/).filter(Boolean).length} words · Markdown is rendered and sanitised on the storefront; scripts and embeds are stripped.</p>
        </section>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-mist">Page</h2>
            <Field label="Title" htmlFor="p-title"><input id="p-title" value={form.title} onChange={set('title')} className="input" required autoFocus={creating} /></Field>
            <Field label="Slug" hint={isSystem ? 'System pages keep their address so existing links keep working.' : 'Address under /pages/. Leave blank to generate from the title.'} htmlFor="p-slug"><input id="p-slug" value={form.slug} onChange={set('slug')} className="input font-mono" disabled={isSystem} placeholder="auto" /></Field>
            <Field label="Summary" hint="One line shown under the title and in link previews." htmlFor="p-summary"><input id="p-summary" value={form.summary} onChange={set('summary')} className="input" maxLength={300} /></Field>
          </section>
          <section className="card flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-mist">Visibility</h2>
            <Field label="Status" htmlFor="p-status">
              <select id="p-status" value={form.status} onChange={set('status')} className="select">
                <option value="published">Published</option>
                <option value="draft">Draft (hidden)</option>
              </select>
            </Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={form.showInNav} onChange={set('showInNav')} className="accent-accent" /> Show in the top navigation</label>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={form.showInFooter} onChange={set('showInFooter')} className="accent-accent" /> Show in the footer</label>
            <label className="flex items-start gap-3 text-sm text-mist-muted"><input type="checkbox" checked={form.showContact} onChange={set('showContact')} className="mt-0.5 accent-accent" /><span>Show the store's contact details under the content<span className="block text-xs text-mist-dim">Address, hours, phone, email and social links from <Link to="/settings?tab=contact" className="text-accent">Settings → Contact</Link>. Good for the About page.</span></span></label>
          </section>
          {!creating && !isSystem ? (
            <section className="card flex flex-col gap-3 p-4">
              <h2 className="text-sm font-semibold text-mist">Danger zone</h2>
              <ConfirmButton onConfirm={remove} confirmLabel="Really delete?">Delete page</ConfirmButton>
            </section>
          ) : null}
        </div>
      </div>
    </form>
  );
};

export { PageEdit };
