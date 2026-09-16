import React from 'react';
import { ArrowDown, ArrowUpRight, ArrowRight, MapPin, Search, Ticket, Music2, CalendarDays, ScanLine, Users } from 'lucide-react';
import { money, dateLabel } from './api';
import { Empty } from './ui';
import { imageUrl } from './branding-model';

// Event imagery is selected in the back office and stored on the media server.
export function eventArtwork(event) {
  const url = imageUrl(event?.image_url);
  return url && !['/event-music.svg','/event-talks.svg','/event-food.svg'].includes(url) ? url : '/event-placeholder.svg';
}
const eventHref = event => '/event?id=' + event.ref;
const entryPrice = event => !event.tiers.length ? 'Coming soon' : Math.min(...event.tiers.map(t => t.price)) === 0 ? 'Free entry' : 'From ' + money(Math.min(...event.tiers.map(t => t.price)), event.currency);
function HeroTitle({ title }) {
  if (!title || title === 'Be there. Feel everything.') return <>Some nights<br/>stay with <em>you.</em></>;
  return title;
}

export default function Storefront({ settings, catalog, filtered, alerts, search, setSearch, category, setCategory }) {
  const featured = [...catalog.events].sort((a,b) => a.starts-b.starts)[0];
  const heroImage = imageUrl(settings.hero_image_url), editorialImage = imageUrl(settings.about_image_url);
  return <>
    <section className="event-hero" aria-label="Discover exceptional experiences">
      {heroImage && <img className="hero-atmosphere" src={heroImage} alt="" fetchPriority="high"/>}
      <div className="hero-shade"/>
      <div className="hero-copy">
        <span className="eyebrow hero-kicker"><span/>THE ART OF BEING THERE</span>
        <h1><HeroTitle title={settings.hero_title}/></h1>
        <p>{!settings.hero_subtitle || settings.hero_subtitle.startsWith('A good night. A new perspective.') ? 'Extraordinary rooms. Unforgettable people. Discover live experiences that deserve a place in your story.' : settings.hero_subtitle}</p>
        <a className="button hero-button" href="#discover">Explore the collection <ArrowUpRight size={18}/></a>
      </div>
      <div className="hero-bottom"><a href="#discover" className="hero-scroll"><ArrowDown size={16}/><span>SCROLL TO DISCOVER</span></a>{featured && <a className="hero-feature" href={eventHref(featured)}><span className="hero-feature-number">01</span><span><small>COMING UP · {featured.category}</small><strong>{featured.title}</strong><span>{dateLabel(featured.starts)} · {featured.venue}</span></span><ArrowUpRight size={24}/></a>}</div>
      <span className="hero-side-note">LIVE WELL. BE PRESENT.</span>
    </section>

    <section className="collection-intro" aria-label="The collection"><span className="eyebrow">A LITTLE LESS ORDINARY</span><p>For the music. For the conversation.<br/>For the feeling of <em>being there.</em></p><span className="collection-count">{String(catalog.events.length).padStart(2,'0')}<small>EXPERIENCES<br/>TO DISCOVER</small></span></section>

    <section className="discover" id="discover">
      <div className="section-title"><div><span className="eyebrow">THE COLLECTION</span><h2>Make room for <em>something good.</em></h2></div><span className="collection-season">YOUR NEXT CHAPTER, LIVE <ArrowDown size={15}/></span></div>
      {alerts}
      <div className="discover-tools"><div className="category-tabs">{['All', ...new Set(catalog.events.map(e => e.category))].map(c => <button className={category === c ? 'active' : ''} aria-pressed={category === c} onClick={() => setCategory(c)} key={c}>{c === 'All' ? 'All experiences' : c}</button>)}</div><label className="search"><Search size={17}/><input aria-label="Search events" placeholder="Find your next experience" value={search} onChange={e => setSearch(e.target.value)}/></label></div>
      <div className="discovery-grid">{filtered.map((event,index) => <a className="discovery-card" key={event.ref} href={eventHref(event)}>
        <div className="event-card-image"><img src={eventArtwork(event)} alt="" loading="lazy"/><span className="date-stamp"><strong>{new Date(event.starts*1000).getUTCDate()}</strong><span>{new Date(event.starts*1000).toLocaleDateString('en',{month:'short',timeZone:'UTC'})}</span></span><span className="card-open"><ArrowUpRight size={23}/></span></div>
        <div className="event-card-body"><div className="card-index"><span className="eyebrow">{event.category}</span><span>{String(index+1).padStart(2,'0')}</span></div><h3>{event.title}</h3><p><MapPin size={13}/>{event.venue}</p><div className="event-card-bottom"><span>{entryPrice(event)}</span><span>Discover event <ArrowRight size={14}/></span></div></div>
      </a>)}</div>
      {!filtered.length && <Empty title="Your next discovery is still to come">Try another search or category, or return for the next announcement.</Empty>}
    </section>

    <section className="event-manifesto" id="why"><div className="manifesto-image">{editorialImage ? <img src={editorialImage} alt="" loading="lazy"/> : <div className="editorial-placeholder" aria-hidden="true"><Ticket size={92} strokeWidth={.6}/></div>}<span>GOOD COMPANY. LASTING MEMORIES.</span></div><div className="manifesto-copy"><span className="eyebrow">MORE THAN A TICKET</span><h2>A place in<br/>the <em>moment.</em></h2><p>A favourite new artist. A conversation that stays with you. A table with room for one more. Find an experience, bring your people, and let the evening unfold.</p><a href="#discover" className="text-link">Find your next moment <ArrowUpRight size={18}/></a></div></section>
    <section className="experience-promise" aria-label="Your experience"><div><Music2 size={22}/><span><strong>Find your kind of live</strong><small>Music, culture and new perspectives.</small></span></div><div><Ticket size={22}/><span><strong>A seamless reservation</strong><small>Your bookings together in one place.</small></span></div><div><ScanLine size={22}/><span><strong>Arrive. Scan. Enjoy.</strong><small>Your personal QR ticket at the door.</small></span></div></section>
  </>;
}

export function OfficeOverview({events,tickets,orders,go,renderTable,allowedPages=[]}) {
  const upcoming=events.filter(e=>e.status==='published'&&e.ends>Date.now()/1000).sort((a,b)=>a.starts-b.starts);
  const next=upcoming[0];
  const metrics=[['Upcoming events',upcoming.length,CalendarDays,'On the calendar'],['Tickets issued',tickets.filter(t=>t.status==='valid').length,Ticket,'Valid admission passes'],['Checked in',tickets.filter(t=>t.checked_in).length,ScanLine,'Guests welcomed'],['Needs review',orders.filter(o=>o.status==='review').length,ArrowUpRight,'Bookings to review']];
  return <>
    <div className="office-overview-head"><div><span className="eyebrow">BEHIND THE EXPERIENCE</span><h2>Set the stage.</h2><p>Everything you need to make the next moment happen.</p></div><button className="button" onClick={()=>go('events')}>Manage events <ArrowUpRight size={17}/></button></div>
    <div className="metrics">{metrics.map(([label,value,Icon,note],i)=><div className="metric" key={label}><div className="metric-top"><span>{label}</span><Icon size={16}/></div><strong>{String(value).padStart(2,'0')}</strong><small><span className={'metric-dot metric-dot-'+i}/>{note}</small></div>)}</div>
    <div className="office-overview-grid"><section className="panel office-schedule"><div className="panel-heading"><div><span className="eyebrow">YOUR PROGRAMME</span><h2>On the horizon</h2></div><button className="text-link" onClick={()=>go('events')}>View all <ArrowUpRight size={16}/></button></div>{renderTable(events.filter(e=>e.ends>Date.now()/1000).sort((a,b)=>a.starts-b.starts).slice(0,6))}</section><aside className="office-next-event">{next?<><img src={eventArtwork(next)} alt=""/><div><span className="eyebrow">NEXT UP</span><h3>{next.title}</h3><p>{dateLabel(next.starts)}</p><span><MapPin size={13}/>{next.venue}</span><button className="text-link" onClick={()=>go('checkin')}>Open check-in <ArrowUpRight size={17}/></button></div></>:<div><span className="eyebrow">START SOMETHING</span><h3>Your next great event starts here.</h3><button className="text-link" onClick={()=>go('events')}>Create an event <ArrowUpRight size={17}/></button></div>}</aside></div>
    <div className="office-shortcuts"><span className="eyebrow">READY WHEN YOU ARE</span>{[['attendees','Guest list',Users],['checkin','Door check-in',ScanLine],['reports','Event reports',CalendarDays]].filter(([page])=>allowedPages.includes(page)).map(([page,label,Icon])=><button className="text-link" key={page} onClick={()=>go(page)}><Icon size={15}/>{label}<ArrowUpRight size={14}/></button>)}</div>
  </>;
}
