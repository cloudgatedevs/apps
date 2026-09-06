# Pages — public reads of published content pages.
d = body()
op = op_of(d, 'nav')
if op == 'nav':
    return "SELECT Slug, Title, Summary, ShowInNav, ShowInFooter, Position FROM pages WHERE Status = 'published' ORDER BY Position, Title;"
if op == 'get':
    slug = str(d.get('slug') or '').strip().lower()
    if not slug or len(slug) > 80:
        fail('slug is required.')
    return "SELECT Slug, Title, Summary, BodyMarkdown, ShowContact, UpdatedAt FROM pages WHERE Status = 'published' AND Slug = " + q(slug) + " LIMIT 1;"
fail('Unknown op: ' + op)
