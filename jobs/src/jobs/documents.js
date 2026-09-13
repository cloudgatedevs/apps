import { call, money } from './api';
export async function documentPdf(ref){
 const [{jsPDF},{autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
 const {document:d,customer,business}=await call('document',{ref});const pdf=new jsPDF();const currency=d.currency||business.currency||'ZAR';
 let headingX=15;
 if(business.logo_url){try{const response=await fetch(business.logo_url);if(response.ok){const bytes=new Uint8Array(await response.arrayBuffer());const info=pdf.getImageProperties(bytes);const width=Math.min(25,20*info.width/info.height),height=width*info.height/info.width;pdf.addImage(bytes,info.fileType,15,12,width,height);headingX=47;}}catch{/* Document remains downloadable when an external brand image is unavailable. */}}
 const businessName=business.app_name||business.name||'Cloudgate Jobs';pdf.setFontSize(22);while(pdf.getTextWidth(businessName)>195-headingX&&pdf.getFontSize()>12)pdf.setFontSize(pdf.getFontSize()-1);pdf.text(businessName,headingX,22);pdf.setFontSize(10);
 const heading=d.kind==='quote'?'QUOTE':d.kind==='payment'?'PAYMENT RECEIPT':d.kind==='credit'?'CREDIT NOTE':'INVOICE';
 pdf.text(heading+'  '+(d.number||d.ref),15,34);pdf.text('Date: '+new Date(d.created*1000).toLocaleDateString('en-GB'),15,41);
 const info=[customer.name||'',d.customer_snapshot?.address||d.address||'',customer.email||''].filter(Boolean);let y=50;
 for(const s of info){const lines=pdf.splitTextToSize(s,175);pdf.text(lines,15,y);y+=lines.length*5;}
 const p=d.pricing||d;const lines=p.lines||[];autoTable(pdf,{startY:y+7,head:[['Description','Quantity','Unit price','Amount']],body:lines.map(l=>[l.name+(l.optional?' (optional)':''),l.quantity,money(l.rate,currency),money(l.amount,currency)]),styles:{fontSize:10,cellPadding:4},headStyles:{fillColor:business.theme_primary||'#153d35'},columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}},margin:{left:15,right:15}});
 y=(pdf.lastAutoTable?.finalY||y)+12;if(y>235){pdf.addPage();y=25;}
 const totals=['payment','credit'].includes(d.kind)?[[d.kind==='credit'?'Credit amount':'Received',money(d.amount,currency)],['Status',d.status]]:[['Subtotal',money(p.subtotal,currency)],['Discount',money(p.discount,currency)],[(business.tax_label||'Tax')+(p.tax_mode==='inclusive'?' (included)':''),money(p.tax,currency)],['Total',money(d.total,currency)],...(d.kind==='invoice'?[['Credit notes',money(d.credited,currency)],['Payments applied',money(d.paid,currency)],['Balance due',money(d.balance,currency)]]:[])];
 for(const [label,value]of totals){pdf.text(label,115,y);pdf.text(String(value),195,y,{align:'right'});y+=7;}
 if(d.due)pdf.text('Due: '+new Date(d.due*1000).toLocaleDateString('en-GB'),15,y+7);
 if(d.kind==='quote'){if(y>245){pdf.addPage();y=25;}pdf.text('Valid until: '+new Date(d.expires*1000).toLocaleDateString('en-GB'),15,y+7);pdf.text('Deposit on approval: '+d.deposit_percent+'%. Optional extras are excluded unless selected.',15,y+14);}
 if(d.kind==='credit'){const reason=pdf.splitTextToSize('Reason: '+d.title,170);if(y+reason.length*5>260){pdf.addPage();y=25;}pdf.text(reason,15,y+7);}
 for(let n=1;n<=pdf.getNumberOfPages();n++){pdf.setPage(n);pdf.setFontSize(9);pdf.text([business.email,business.phone,business.tax_number?'Tax registration: '+business.tax_number:''].filter(Boolean).join(' | '),15,282);pdf.text(`${n} / ${pdf.getNumberOfPages()}`,195,290,{align:'right'});}
 pdf.save((d.number||d.ref)+'.pdf');
}
