// Building module (isolated)
(function(){
  function C(state){
    const a = state.accent;
    const rgb = {'#7B00FF':'123,0,255','#FF2D20':'255,45,32','#4B7BFF':'75,123,255','#00E096':'0,224,150','#FFD60A':'255,214,10','#FF6B35':'255,107,53'}[a]||'123,0,255';
    if(state.dark) return {card:'#13131F',border:'#1E1E30',text:'#E8E8F4',muted:'#7070A0',dim:'#4A4A6A',acc:state.accent,accRGB:rgb,green:'#00E096'};
    return {card:'#FFFFFF',border:'#E0E0EC',text:'#111118',muted:'#6060A0',dim:'#A0A0C0',acc:state.accent,accRGB:rgb,green:'#00B87A'};
  }

  function fmt(n){
    const v = Math.round(+n||0);
    return '₽'+v.toLocaleString();
  }

  // Simple CRM: leads list and chat - persisted in localStorage
  let crmLeads = [];
  try{ const s = localStorage.getItem('festo_crmLeads'); crmLeads = s?JSON.parse(s):[]; }catch(e){ crmLeads = []; }
  if(!crmLeads || crmLeads.length===0){ crmLeads = [
    {id:Date.now()-2,status:'new',source:'Avito',title:'Заявка: Демонтаж стен',contact:'+7 900 111-22-33',messages:[{from:'lead',text:'Нужен расчёт',t:'09:10'},{from:'operator',text:'Отправил прайс-лист',t:'09:15'}]},
    {id:Date.now()-1,status:'new',source:'Avito',title:'Заявка: Монтаж под ключ',contact:'+7 900 222-33-44',messages:[]}
  ]; saveLeads(); }

  let invoices = [];
  try{ const s = localStorage.getItem('festo_invoices'); invoices = s?JSON.parse(s):[]; }catch(e){ invoices = []; }

  // Documents: company profile (autofill)
  const companyProfile = {name:'ООО СтройПро',inn:'7701234567',kpp:'770101001',addr:'г. Москва, ул. Пример, 10'};

  // Analytics: orders table
  let analyticsRows = [];

  const STATUSES = [
    {id:'new',label:'Новая заявка'},
    {id:'inwork',label:'В работе'},
    {id:'contract',label:'Договор'},
    {id:'closed',label:'Закрыто'}
  ];

  function saveLeads(){ try{ localStorage.setItem('festo_crmLeads', JSON.stringify(crmLeads)); }catch(e){console.warn(e);} }
  function saveInvoices(){ try{ localStorage.setItem('festo_invoices', JSON.stringify(invoices)); }catch(e){console.warn(e);} }

  function crmHTML(state){
    const c = C(state);
    // build columns
    const cols = STATUSES.map(st=>{
      const items = crmLeads.filter(l=>l.status===st.id).map(l=>`<div class="lead-card" draggable="true" data-id="${l.id}" style="background:${c.surf};border:1px solid ${c.border};border-radius:8px;padding:10px;margin-bottom:8px"><div style="font-weight:700;color:${c.text}">${l.title}</div><div style="color:${c.muted};font-size:12px">${l.contact}</div><div style="margin-top:6px;display:flex;gap:6px"><button data-action="openLead-${l.id}" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border};background:transparent">Open</button><button data-action="moveLead-${l.id}" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border};background:transparent">...</button></div></div>`).join('');
      return `<div class="kanban-col" data-status="${st.id}" style="flex:1;min-width:180px;background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:10px;display:flex;flex-direction:column"><div style="font-weight:700;margin-bottom:8px">${st.label}</div><div class="col-list" style="flex:1;min-height:60px">${items}</div></div>`;
    }).join('');
    return `<div style="display:flex;gap:12px"><div style="width:100%;display:flex;flex-direction:column;gap:12px"> <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:700;color:${c.text}">Kanban CRM</div><div><button data-action="newLead" style="padding:8px 10px;border-radius:8px;background:linear-gradient(135deg,${c.acc},${c.acc}cc);color:#fff;border:none">New lead</button></div></div><div style="display:flex;gap:12px">${cols}</div></div></div>`;
  }

  function openLead(id){
    const lead = crmLeads.find(l=>l.id==id);
    if(!lead) return;
    const c = C(window.state);
    const msgs = lead.messages.map(m=>`<div style="margin-bottom:8px"><div style="font-size:12px;color:${m.from==='operator'?c.acc:c.text};font-weight:600">${m.from==='operator'?'You':'Lead'}</div><div style="color:${c.muted};font-size:13px">${m.text}</div><div style="color:${c.dim};font-size:11px">${m.t}</div></div>`).join('');
    const html = `<div style="display:flex;flex-direction:column;height:100%"><div style="flex:1;overflow:auto;padding-bottom:8px">${msgs}</div><div style="display:flex;gap:8px"><input id="chatMsg" placeholder="Message" style="flex:1;padding:8px;border:1px solid ${c.border};border-radius:8px"/><button data-action="sendMsg-${lead.id}" style="padding:8px 10px;border-radius:8px;background:${c.acc};color:#fff;border:none">Send</button></div></div>`;
    document.getElementById('crm-detail').innerHTML = html;
  }

  // move lead to status and persist; if moved to contract, create order
  function moveLeadToStatus(id, status){
    const lead = crmLeads.find(l=>l.id==id);
    if(!lead) return;
    lead.status = status;
    saveLeads();
    renderBuilding();
    if(status==='contract'){
      createOrderFromLead(lead);
    }
  }

  function createOrderFromLead(lead){
    // create a simple order from lead data and add to global orders
    const orderId = '#B' + Date.now();
    const newOrder = {id:orderId,time:(new Date()).toLocaleTimeString().slice(0,5),type:'service',items:1,total:50000,status:'preparing',payment:'contract',leadId:lead.id,customer:lead.contact,desc:lead.title};
    if(window.setState){
      window.setState(s=>({...s,orders:[...s.orders,newOrder]}));
      try{ localStorage.setItem('festo_orders', JSON.stringify(window.state.orders)); }catch(e){console.warn(e)}
    }
  }

  function docsHTML(state){
    const c = C(state);
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:12px"> <div style="font-weight:700;color:${c.text};margin-bottom:8px">Автозаполнение реквизитов</div>
      <div style="color:${c.muted};font-size:12px">Компания</div>
      <div style="font-weight:600">${companyProfile.name}</div>
      <div style="color:${c.muted};font-size:12px;margin-top:8px">ИНН · КПП</div>
      <div style="font-weight:600">${companyProfile.inn} · ${companyProfile.kpp}</div>
      <div style="color:${c.muted};font-size:12px;margin-top:8px">Адрес</div>
      <div style="font-weight:600">${companyProfile.addr}</div>
      <div style="margin-top:12px"><button data-action="genInvoice" style="padding:8px 10px;border-radius:8px;background:${c.acc};color:#fff;border:none">Generate Invoice</button></div>
    </div>
    <div style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:12px"> <div style="font-weight:700;color:${c.text};margin-bottom:8px">Generated documents</div><div id="docs-list">No documents yet</div></div></div>`;
  }

  function analyticsHTML(state){
    const c = C(state);
    const rows = analyticsRows.map(r=>`<tr><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.job}</td><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.cost}</td><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.qty}</td><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.total}</td></tr>`).join('');
    return `<div><div style="display:flex;gap:12px;margin-bottom:12px"><input id="jobName" placeholder="Job name" style="padding:8px;border:1px solid ${c.border};border-radius:8px"/><input id="jobQty" type="number" placeholder="Quantity" style="padding:8px;border:1px solid ${c.border};border-radius:8px;width:120px"/><input id="jobUnitCost" type="number" placeholder="Unit cost" style="padding:8px;border:1px solid ${c.border};border-radius:8px;width:140px"/><button data-action="calcAdd" style="padding:8px 12px;border-radius:8px;background:${c.acc};color:#fff;border:none">Add</button></div><div style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:8px;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;color:${c.muted};padding:8px">Job</th><th style="text-align:left;color:${c.muted};padding:8px">Unit</th><th style="text-align:left;color:${c.muted};padding:8px">Qty</th><th style="text-align:left;color:${c.muted};padding:8px">Total</th></tr></thead><tbody id="analytics-rows">${rows}</tbody></table></div></div>`;
  }

  function pageBuilding(state){
    const c = C(state);
    return `<div style="padding:20px;overflow:auto;flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div><div style="font-size:18px;font-weight:700;color:${c.text}">CRM</div><div style="color:${c.muted};font-size:12px">CRM · Накладные · Аналитика</div></div><div style="display:flex;gap:8px"><button data-action="openBuilding-crm" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">CRM</button><button data-action="openBuilding-docs" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">Documents</button><button data-action="openBuilding-invoices" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">Накладные</button><button data-action="openBuilding-analytics" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">Analytics</button></div></div>
      <div id="building-content">${crmHTML(window.state)}</div>
    </div>`;
  }

  // attach to window
  window.buildingComponent = { pageBuilding };

  // wrap global setState to detect confirmed orders and auto-generate invoices
  if(window.setState && !window._building_setState_wrapped){
    window._building_setState_wrapped = true;
    const origSet = window.setState;
    window.setState = function(upd){
      const prev = JSON.parse(JSON.stringify(window.state||{}));
      origSet(upd);
      const next = window.state;
      // detect orders moved to 'confirmed'
      const prevOrders = prev.orders||[]; const nextOrders = next.orders||[];
      nextOrders.forEach(o=>{
        const prevO = prevOrders.find(po=>po.id===o.id);
        if((!prevO || prevO.status!==o.status) && o.status==='confirmed'){
          // create invoice for this order if not exists
          if(!invoices.find(inv=>inv.orderId===o.id)){
            const inv = {id:'INV'+Date.now(),orderId:o.id,date:(new Date()).toLocaleDateString(),company:companyProfile.name,items:[{name:o.desc||'Работы',qty:o.items||1,price:o.total||0}],total:o.total||0};
            invoices.push(inv); saveInvoices();
            console.log('Invoice generated for order',o.id);
          }
        }
      });
    };
  }

  // event handlers specific to building module
  function handleBuildingAction(action){
    if(action==='newLead'){
      const id = Date.now(); crmLeads.unshift({id,source:'Avito',title:'Новая заявка',contact:'+7',messages:[]});
      renderBuilding();
    }
    else if(action.startsWith('openLead-')){
      const id = action.split('-')[1]; openLead(id);
    }
    else if(action.startsWith('sendMsg-')){
      const id = +action.split('-')[1]; const text = document.getElementById('chatMsg')?.value||''; if(!text) return; const lead = crmLeads.find(l=>l.id===id); lead.messages.push({from:'operator',text,t:(new Date()).toLocaleTimeString().slice(0,5)}); openLead(id);
    }
    else if(action==='genInvoice'){
      const doc = `<div style="padding:8px;border-bottom:1px solid #eee">Invoice · ${companyProfile.name} · ${new Date().toLocaleString()}</div>`;
      const el = document.getElementById('docs-list'); if(el) el.innerHTML = (el.innerHTML||'') + doc;
    }
    else if(action==='calcAdd'){
      const job = document.getElementById('jobName')?.value||'Job'; const qty = +document.getElementById('jobQty')?.value||1; const cost = +document.getElementById('jobUnitCost')?.value||0; const total = qty*cost; analyticsRows.push({job,cost,qty,total}); const tbody = document.getElementById('analytics-rows'); if(tbody) tbody.innerHTML = analyticsRows.map(r=>`<tr><td style="padding:8px;border-bottom:1px solid #ddd">${r.job}</td><td style="padding:8px;border-bottom:1px solid #ddd">${r.cost}</td><td style="padding:8px;border-bottom:1px solid #ddd">${r.qty}</td><td style="padding:8px;border-bottom:1px solid #ddd">${r.total}</td></tr>`).join('');
    }
  }

  function renderBuilding(){
    const el = document.getElementById('building-content'); if(!el) return; el.innerHTML = crmHTML(window.state);
    // attach drag handlers
    document.querySelectorAll('.lead-card').forEach(card=>{
      card.addEventListener('dragstart', (ev)=>{
        ev.dataTransfer.setData('text/plain', card.dataset.id);
        ev.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', ()=>card.classList.remove('dragging'));
    });
    document.querySelectorAll('.kanban-col .col-list').forEach(col=>{
      col.addEventListener('dragover', (ev)=>{ ev.preventDefault(); });
      col.addEventListener('drop', (ev)=>{
        ev.preventDefault(); const id = ev.dataTransfer.getData('text/plain'); const status = col.closest('.kanban-col').dataset.status; moveLeadToStatus(id,status);
      });
    });
  }

  // global click listener to handle building actions
  document.addEventListener('click', (e)=>{
    const el = e.target.closest('[data-action]'); if(!el) return; const action = el.dataset.action;
    if(!action) return; if(action.startsWith('openBuilding-')){
      const part = action.split('-')[1]; if(part==='crm'){ renderBuilding(); }
      else if(part==='docs'){ const elc = document.getElementById('building-content'); if(elc) elc.innerHTML = docsHTML(window.state); }
      else if(part==='invoices'){ const elc = document.getElementById('building-content'); if(elc) elc.innerHTML = invoicesHTML(); }
      else if(part==='analytics'){ const elc = document.getElementById('building-content'); if(elc) elc.innerHTML = analyticsHTML(window.state); }
      return;
    }
    // module-specific actions
    if(action.startsWith('openLead-')||action==='newLead'||action.startsWith('sendMsg-')||action==='genInvoice'||action==='calcAdd'){
      handleBuildingAction(action);
    }
  });

  // invoices HTML
  function invoicesHTML(){
    const c = C(window.state);
    const rows = invoices.map(i=>`<div style="padding:10px;border-bottom:1px solid ${c.border}"><div style="font-weight:700">${i.id} · ${i.date}</div><div style="color:${c.muted};font-size:13px">Order: ${i.orderId} · Total: ${i.total}</div><div style="margin-top:6px"><button data-action="viewInvoice-${i.id}" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border}">View</button></div></div>`).join('')||'<div style="color:'+c.muted+'">No invoices</div>';
    return `<div style="display:flex;flex-direction:column;gap:12px"><div style="font-weight:700;margin-bottom:6px">Накладные</div><div style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:12px">${rows}</div></div>`;
  }

  // view individual invoice
  document.addEventListener('click', (e)=>{
    const el = e.target.closest('[data-action]'); if(!el) return; const action = el.dataset.action; if(!action) return;
    if(action.startsWith('viewInvoice-')){
      const id = action.split('-')[1]; const inv = invoices.find(x=>x.id==id); if(!inv) return; const html = invoiceTemplate(inv);
      const elc = document.getElementById('building-content'); if(elc) elc.innerHTML = `<div style="padding:12px"><div style="font-weight:700;margin-bottom:8px">${inv.id}</div><div style="background:#fff;padding:12px;border-radius:6px">${html}</div></div>`;
    }
  });

  function invoiceTemplate(inv){
    const c = C(window.state);
    const items = (inv.items||[]).map(it=>`<tr><td>${it.name}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">${fmt(it.price)}</td></tr>`).join('');
    return `<div style="font-family:Arial;padding:8px;color:${c.text}"><h3>Накладная ${inv.id}</h3><div>Дата: ${inv.date}</div><div>Компания: ${inv.company}</div><table style="width:100%;margin-top:12px;border-collapse:collapse"><thead><tr><th>Материал</th><th style="text-align:right">Кол-во</th><th style="text-align:right">Цена</th></tr></thead><tbody>${items}</tbody></table><div style="margin-top:12px;font-weight:700">Итого: ${fmt(inv.total)}</div></div>`;
  }

})();
