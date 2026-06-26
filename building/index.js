// Building module (isolated)
(function(){
  function C(state){
    const a = state.accent;
    const rgb = {'#7B00FF':'123,0,255','#FF2D20':'255,45,32','#4B7BFF':'75,123,255','#00E096':'0,224,150','#FFD60A':'255,214,10','#FF6B35':'255,107,53'}[a]||'123,0,255';
    if(state.dark) return {card:'#13131F',border:'#1E1E30',text:'#E8E8F4',muted:'#7070A0',dim:'#4A4A6A',acc:state.accent,accRGB:rgb,green:'#00E096'};
    return {card:'#FFFFFF',border:'#E0E0EC',text:'#111118',muted:'#6060A0',dim:'#A0A0C0',acc:state.accent,accRGB:rgb,green:'#00B87A'};
  }

  const t = window.t || ((key)=>key);

  function fmt(n){
    const v = Math.round(+n||0);
    return '₽'+v.toLocaleString();
  }

  const LEAD_STATUSES = ['New','In Progress','Done'];
  let leads = [];
  try{ const s = localStorage.getItem('festo_crmLeads'); leads = s ? JSON.parse(s) : []; }catch(e){ leads = []; }
  if(!leads || leads.length===0){ leads = [
    {id:Date.now()-2,companyId:1,name:'Иван Иванов',phone:'+7 900 111-22-33',source:'Avito',status:'New',messages:[{from:'lead',text:'Нужен расчёт',t:'09:10'},{from:'operator',text:'Отправил прайс-лист',t:'09:15'}]},
    {id:Date.now()-1,companyId:1,name:'Пётр Петров',phone:'+7 900 222-33-44',source:'AmoCRM',status:'New',messages:[]}
  ]; saveLeads(); }

  let invoices = [];
  try{ const s = localStorage.getItem('festo_invoices'); invoices = s?JSON.parse(s):[]; }catch(e){ invoices = []; }
  let waybills = [];
  try{ const s = localStorage.getItem('festo_waybills'); waybills = s?JSON.parse(s):[]; }catch(e){ waybills = []; }

  // Documents: company profile (autofill)
  const companyProfile = {name:'ООО СтройПро',inn:'7701234567',kpp:'770101001',addr:'г. Москва, ул. Пример, 10'};

  // Analytics: orders table
  let analyticsRows = [];

  // Building CRM internal state
  const stages = ['Новая', 'В работе', 'Договор', 'Закрыто'];
  const stageIds = ['new', 'inwork', 'contract', 'closed'];
  const STATUSES = stageIds.map((id,index)=>({id,label:stages[index]}));
  const buildingState = { activePage: 'crm-kanban' };
  const invoiceDraft = { orderId:null, clientName:'', clientAddress:'', clientPhone:'', items:[], note:'' };
  function setActivePage(page){ buildingState.activePage = page || 'crm-kanban'; renderBuilding(); }

  let integrationSettings = { avitoClientId:'', avitoClientSecret:'', amoSubdomain:'', amoAccessToken:'', avitoEnabled:true, amoEnabled:true };
  try{ const s = localStorage.getItem('festo_integrationSettings'); integrationSettings = s?JSON.parse(s):integrationSettings; }catch(e){ integrationSettings = integrationSettings; }

  function saveIntegrationSettings(){ try{ localStorage.setItem('festo_integrationSettings', JSON.stringify(integrationSettings)); }catch(e){console.warn(e);} }
  function saveLeads(){ try{ localStorage.setItem('festo_crmLeads', JSON.stringify(leads)); }catch(e){console.warn(e);} }
  function saveInvoices(){ try{ localStorage.setItem('festo_invoices', JSON.stringify(invoices)); }catch(e){console.warn(e);} }
  function saveWaybills(){ try{ localStorage.setItem('festo_waybills', JSON.stringify(waybills)); }catch(e){console.warn(e);} }

  function openLeadModal(){ buildingState.isLeadModalOpen = true; buildingState.leadForm = {name:'',phone:'',source:'Avito',status:'New'}; renderBuilding(); }
  function closeLeadModal(){ buildingState.isLeadModalOpen = false; renderBuilding(); }
  function addLead(leadData){
    const newLead = {
      id: Date.now(),
      name: leadData.name || 'New Lead',
      phone: leadData.phone || '',
      source: leadData.source || 'Manual',
      status: leadData.status || 'New'
    };
    leads = [newLead, ...leads];
    saveLeads();
    buildingState.isLeadModalOpen = false;
    renderBuilding();
  }
  function updateStatus(id, newStatus){
    leads = leads.map(lead => lead.id == id ? {...lead, status: newStatus} : lead);
    saveLeads();
    renderBuilding();
  }
  function moveNext(id){
    const lead = leads.find(l => l.id == id);
    if(!lead) return;
    const currentIndex = LEAD_STATUSES.indexOf(lead.status);
    const nextStatus = LEAD_STATUSES[Math.min(currentIndex + 1, LEAD_STATUSES.length - 1)];
    updateStatus(id, nextStatus);
  }

  function crmHTML(state){
    const c = C(state);
    const currentCompanyId = state.activeCompanyId || null;
    const companyLeads = currentCompanyId ? leads.filter(l=>l.companyId===currentCompanyId) : leads;
    const cols = LEAD_STATUSES.map(status=>{
      const items = companyLeads.filter(l=>l.status===status).map(l=>`<div class="lead-card" draggable="true" data-id="${l.id}" style="background:${c.surf};border:1px solid ${c.border};border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="font-weight:700;color:${c.text}">${l.name}</div>
          <div style="color:${c.muted};font-size:12px">${l.phone} · ${l.source}</div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <button data-action="moveNext-${l.id}" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border};background:transparent">Next</button>
            <button data-action="setStatus-${l.id}-New" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border};background:transparent">New</button>
            <button data-action="setStatus-${l.id}-In Progress" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border};background:transparent">In Progress</button>
            <button data-action="setStatus-${l.id}-Done" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border};background:transparent">Done</button>
          </div>
        </div>`).join('');
      const content = items || `<div style="color:${c.muted};font-size:12px;padding:12px">${t('noLeads')}</div>`;
      return `<div class="kanban-col" data-status="${status}" style="flex:1;min-width:180px;background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:10px;display:flex;flex-direction:column"><div style="font-weight:700;margin-bottom:8px">${status}</div><div class="col-list" style="flex:1;min-height:60px">${content}</div></div>`;
    }).join('');

    const modalHTML = buildingState.isLeadModalOpen ? `<div id="lead-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:999">
        <div style="background:${c.card};padding:20px;border-radius:16px;min-width:320px;max-width:90%">
          <div style="font-weight:700;margin-bottom:12px">Add Lead</div>
          <label style="display:block;margin-bottom:10px"><div style="font-size:12px;color:${c.muted};margin-bottom:4px">Name</div><input id="leadName" value="${buildingState.leadForm.name}" style="width:100%;padding:8px;border:1px solid ${c.border};border-radius:8px"/></label>
          <label style="display:block;margin-bottom:10px"><div style="font-size:12px;color:${c.muted};margin-bottom:4px">Phone</div><input id="leadPhone" value="${buildingState.leadForm.phone}" style="width:100%;padding:8px;border:1px solid ${c.border};border-radius:8px"/></label>
          <label style="display:block;margin-bottom:10px"><div style="font-size:12px;color:${c.muted};margin-bottom:4px">Source</div><input id="leadSource" value="${buildingState.leadForm.source}" style="width:100%;padding:8px;border:1px solid ${c.border};border-radius:8px"/></label>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px">
            <button data-action="closeLeadModal" style="padding:8px 12px;border-radius:8px;border:1px solid ${c.border};background:transparent">Cancel</button>
            <button data-action="addLeadConfirm" style="padding:8px 12px;border-radius:8px;border:none;background:${c.acc};color:#fff">Save</button>
          </div>
        </div>
      </div>` : '';

    return `<div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:700;color:${c.text}">${t('crm')}</div><button data-action="newLead" style="padding:8px 10px;border-radius:8px;background:linear-gradient(135deg,${c.acc},${c.acc}cc);color:#fff;border:none">${t('newLead')}</button></div>
      <div style="display:flex;gap:12px;min-height:420px">
        <div style="flex:1;display:flex;gap:12px;overflow:auto">${cols}</div>
        <div id="crm-detail" style="width:320px;background:${c.card};border:1px solid ${c.border};border-radius:12px;padding:14px;overflow:auto;min-height:320px"><div style="color:${c.muted};font-size:12px">${t('selectLead')}</div></div>
      </div>
      ${modalHTML}
    </div>`;
  }

  function getBuildingContent(state){
    if(!buildingState.activePage) buildingState.activePage = 'crm-kanban';
    switch(buildingState.activePage){
      case 'docs': return docsHTML(state);
      case 'invoices': return invoicesHTML();
      case 'analytics': return analyticsHTML(state);
      case 'integrations': return integrationsHTML(state);
      default: return crmHTML(state);
    }
  }

  function openLead(id){
    const lead = leads.find(l=>l.id==id);
    if(!lead) return;
    const c = C(window.state);
    const msgs = (lead.messages||[]).map(m=>`<div style="margin-bottom:8px"><div style="font-size:12px;color:${m.from==='operator'?c.acc:c.text};font-weight:600">${m.from==='operator'?'You':'Lead'}</div><div style="color:${c.muted};font-size:13px">${m.text}</div><div style="color:${c.dim};font-size:11px">${m.t}</div></div>`).join('');
    const html = `<div style="display:flex;flex-direction:column;height:100%"><div style="flex:1;overflow:auto;padding-bottom:8px">${msgs}</div><div style="display:flex;gap:8px"><input id="chatMsg" placeholder="${t('message')}" style="flex:1;padding:8px;border:1px solid ${c.border};border-radius:8px"/><button data-action="sendMsg-${lead.id}" style="padding:8px 10px;border-radius:8px;background:${c.acc};color:#fff;border:none">${t('send')}</button></div></div>`;
    document.getElementById('crm-detail').innerHTML = html;
  }

  // move lead to status and persist; if moved to contract, create order
  function moveLeadToStatus(id, status){
    leads = leads.map(l => l.id==id ? {...l, status} : l);
    saveLeads();
    renderBuilding();
    if(status==='contract'){
      const lead = leads.find(l=>l.id==id);
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
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:12px"> <div style="font-weight:700;color:${c.text};margin-bottom:8px">${t('autoFill')}</div>
      <div style="color:${c.muted};font-size:12px">${t('company')}</div>
      <div style="font-weight:600">${companyProfile.name}</div>
      <div style="color:${c.muted};font-size:12px;margin-top:8px">ИНН · КПП</div>
      <div style="font-weight:600">${companyProfile.inn} · ${companyProfile.kpp}</div>
      <div style="color:${c.muted};font-size:12px;margin-top:8px">${t('address')}</div>
      <div style="font-weight:600">${companyProfile.addr}</div>
      <div style="margin-top:12px"><button data-action="genInvoice" style="padding:8px 10px;border-radius:8px;background:${c.acc};color:#fff;border:none">${t('generateInvoice')}</button></div>
    </div>
    <div style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:12px"> <div style="font-weight:700;color:${c.text};margin-bottom:8px">${t('generatedDocs')}</div><div id="docs-list">${t('noDocs')}</div></div></div>`;
  }

  function analyticsHTML(state){
    const c = C(state);
    const rows = analyticsRows.map(r=>`<tr><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.job}</td><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.cost}</td><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.qty}</td><td style="padding:8px;border-bottom:1px solid ${c.border}">${r.total}</td></tr>`).join('');
    return `<div><div style="display:flex;gap:12px;margin-bottom:12px"><input id="jobName" placeholder="${t('jobName')}" style="padding:8px;border:1px solid ${c.border};border-radius:8px"/><input id="jobQty" type="number" placeholder="${t('quantity')}" style="padding:8px;border:1px solid ${c.border};border-radius:8px;width:120px"/><input id="jobUnitCost" type="number" placeholder="${t('unitCost')}" style="padding:8px;border:1px solid ${c.border};border-radius:8px;width:140px"/><button data-action="calcAdd" style="padding:8px 12px;border-radius:8px;background:${c.acc};color:#fff;border:none">${t('add')}</button></div><div style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:8px;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;color:${c.muted};padding:8px">${t('job')}</th><th style="text-align:left;color:${c.muted};padding:8px">${t('unit')}</th><th style="text-align:left;color:${c.muted};padding:8px">${t('qty')}</th><th style="text-align:left;color:${c.muted};padding:8px">${t('total')}</th></tr></thead><tbody id="analytics-rows">${rows}</tbody></table></div></div>`;
  }

  function pageBuilding(state){
    const c = C(state);
    if(!buildingState.activePage){ buildingState.activePage = 'crm-kanban'; }
    const companies = state.buildingCompanies || [];
    const companyButtons = companies.map(company=>{
      const active = state.activeCompanyId===company.id;
      return `<button data-action="selectCompany-${company.id}" style="padding:10px 14px;border-radius:14px;border:1px solid ${active?c.acc:c.border};background:${active?c.acc:c.surf};color:${active?'#fff':c.text};cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:180px">
        <span style="font-weight:700">${company.name}</span>
        <span style="font-size:12px;color:${active?'rgba(255,255,255,0.8)':c.muted}">${company.location} · ${company.customers} ${t('customers')} · ${company.openLeads} ${t('openLeads')}</span>
      </button>`;
    }).join('');
    return `<div style="padding:20px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:20px">
      <div style="display:flex;flex-wrap:wrap;gap:10px;">${companyButtons}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div><div style="font-size:18px;font-weight:700;color:${c.text}">${t('crm')}</div><div style="color:${c.muted};font-size:12px">${t('crm')} · ${t('waybills')} · ${t('analytics')}</div></div><div style="display:flex;gap:8px"><button data-action="openBuilding-crm" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">${t('crm')}</button><button data-action="openBuilding-docs" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">${t('docs')}</button><button data-action="openBuilding-invoices" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">${t('waybills')}</button><button data-action="openBuilding-analytics" style="padding:8px 10px;border-radius:8px;background:${c.surf};border:1px solid ${c.border}">${t('analytics')}</button></div></div>
      <div id="building-content">${getBuildingContent(state)}</div>
    </div>`;
  }

  function pageIntegrations(state){
    const c = C(state);
    return `<div style="padding:20px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div style="font-size:18px;font-weight:700;color:${c.text}">${t('integrations')}</div><div style="color:${c.muted};font-size:12px">${t('integrationNotice')}</div></div><div><button data-action="fetchLeads" style="padding:10px 14px;border-radius:10px;background:${c.acc};color:#fff;border:none">${t('fetchLeads')}</button></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="background:${c.card};border:1px solid ${c.border};border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px">
          <div style="font-weight:700;color:${c.text};font-size:14px">Avito</div>
          <label style="display:flex;flex-direction:column;font-size:12px;color:${c.muted}">${t('clientId')}<input id="avitoClientId" value="${integrationSettings.avitoClientId}" style="margin-top:6px;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none"/></label>
          <label style="display:flex;flex-direction:column;font-size:12px;color:${c.muted}">${t('clientSecret')}<input id="avitoClientSecret" value="${integrationSettings.avitoClientSecret}" style="margin-top:6px;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none"/></label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:${c.text}"><input id="toggleAvito" type="checkbox" ${integrationSettings.avitoEnabled?'checked':''}/> ${t('enableAvito')}</label>
        </div>
        <div style="background:${c.card};border:1px solid ${c.border};border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px">
          <div style="font-weight:700;color:${c.text};font-size:14px">AmoCRM</div>
          <label style="display:flex;flex-direction:column;font-size:12px;color:${c.muted}">${t('subdomain')}<input id="amoSubdomain" value="${integrationSettings.amoSubdomain}" style="margin-top:6px;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none"/></label>
          <label style="display:flex;flex-direction:column;font-size:12px;color:${c.muted}">${t('accessToken')}<input id="amoAccessToken" value="${integrationSettings.amoAccessToken}" style="margin-top:6px;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none"/></label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:${c.text}"><input id="toggleAmo" type="checkbox" ${integrationSettings.amoEnabled?'checked':''}/> ${t('enableAmo')}</label>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap"><button data-action="saveIntegrations" style="padding:12px 18px;border-radius:12px;background:${c.acc};color:#fff;border:none">${t('save')}</button><div style="color:${c.muted};font-size:13px">${t('localSettingsNotice')}</div></div>
      <div id="integration-notice" style="color:${c.acc};font-size:13px"></div>
    </div>`;
  }

  // attach to window
  function fetchLeadsFromSources(){
    const newLeads = [];
    const companyId = window.state?.activeCompanyId || 1;
    if(integrationSettings.avitoEnabled){
      newLeads.push({id:Date.now()+Math.floor(Math.random()*1000),companyId,name:'Авито лид',phone:'+7 900 123-45-67',source:'Avito',status:'New',messages:[]});
    }
    if(integrationSettings.amoEnabled){
      newLeads.push({id:Date.now()+Math.floor(Math.random()*1000)+2000,companyId,name:'AmoCRM лид',phone:'+7 900 765-43-21',source:'AmoCRM',status:'New',messages:[]});
    }
    if(newLeads.length){
      leads = [...newLeads, ...leads];
      saveLeads();
      if(buildingState.activePage==='crm-kanban') renderBuilding();
    }
    return newLeads;
  }

  function pageInvoices(state){ return invoicesHTML(); }

  function openSection(part){
    if(!part || part==='crm'){ setActivePage('crm-kanban'); return; }
    if(part==='docs'){ setActivePage('docs'); return; }
    if(part==='invoices'){ setActivePage('invoices'); return; }
    if(part==='analytics'){ setActivePage('analytics'); return; }
    if(part==='integrations'){ setActivePage('integrations'); return; }
    setActivePage('crm-kanban');
  }
  window.buildingComponent = { pageBuilding, pageInvoices, pageIntegrations, open: openSection, getActivePage: ()=>buildingState.activePage, fetchLeadsFromSources, addLead, updateStatus, moveNext, openLeadModal, closeLeadModal };

  function renderBuilding(){
    const el = document.getElementById('building-content'); if(!el) return; el.innerHTML = getBuildingContent(window.state);
    if(buildingState.activePage !== 'crm-kanban') return;
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
      openLeadModal();
    }
    else if(action==='closeLeadModal'){
      closeLeadModal();
    }
    else if(action==='addLeadConfirm'){
      const name = document.getElementById('leadName')?.value||'';
      const phone = document.getElementById('leadPhone')?.value||'';
      const source = document.getElementById('leadSource')?.value||'Manual';
      addLead({name,phone,source,status:'New'});
    }
    else if(action.startsWith('moveNext-')){
      const id = action.split('-')[1]; moveNext(id); }
    else if(action.startsWith('setStatus-')){
      const [_, id, status] = action.split('-'); if(id && status){ updateStatus(id, status); }
    }
    else if(action.startsWith('openLead-')){
      const id = action.split('-')[1]; openLead(id);
    }
    else if(action.startsWith('sendMsg-')){
      const id = +action.split('-')[1]; const text = document.getElementById('chatMsg')?.value||''; if(!text) return; const lead = leads.find(l=>l.id===id); lead.messages = lead.messages || []; lead.messages.push({from:'operator',text,t:(new Date()).toLocaleTimeString().slice(0,5)}); saveLeads(); openLead(id);
    }

    else if (action === 'genInvoice') {
        const doc = `<div style="padding:8px;border-bottom:1px solid #eee">Invoice - ${companyProfile.name} - ${new Date().toLocaleString()}</div>`;
        const el = document.getElementById('docs-list');
        if (el) el.innerHTML = (el.innerHTML || '') + doc;
    } else if (action === 'calcAdd') {
        const job = document.getElementById('jobName')?.value || 'Job';
        const qty = +document.getElementById('jobQty')?.value || 1;
        const cost = +document.getElementById('jobUnitCost')?.value || 0;
    } else if (action === 'saveIntegrations') {
        integrationSettings.avitoClientId = document.getElementById('avitoClientId')?.value || '';
        integrationSettings.avitoClientSecret = document.getElementById('avitoClientSecret')?.value || '';
        integrationSettings.amoSubdomain = document.getElementById('amoSubdomain')?.value || '';
        integrationSettings.amoAccessToken = document.getElementById('amoAccessToken')?.value || '';
        integrationSettings.avitoEnabled = !!document.getElementById('toggleAvito')?.checked;
        saveIntegrationSettings();
        const notice = document.getElementById('integration-notice');
        if (notice) notice.innerText = 'Сохранено локально';
     } else if(action==='fetchLeads'){
      const newLeads = fetchLeadsFromSources();
      const notice = document.getElementById('integration-notice'); if(notice) notice.innerText = newLeads.length ? `Импортировано ${newLeads.length} лидов` : 'Нет включенных источников';
    }
  
  // global click listener to handle building actions
  document.addEventListener('click', (e)=>{
    const el = e.target.closest('[data-action]'); if(!el) return; const action = el.dataset.action;
    if(!action) return;
    if(action.startsWith('openBuilding-')){
      const part = action.split('-')[1];
      if(window.buildingComponent && typeof window.buildingComponent.open === 'function'){
        window.buildingComponent.open(part);
      }
      function renderBuildingDashboard() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    // Очищаем текущий контент
    container.innerHTML = '';

    // Генерируем карточки из массива buildings
    const cards = state.buildings.map(b => `
        <div class="card" style="border: 1px solid #ccc; padding: 15px; margin: 10px; border-radius: 8px;">
            <h3>${b.name}</h3>
            <p>Статус: <strong>${b.status}</strong></p>
            <p>Бюджет: ${int(b.revenue, '₽')}</p>
            <p>Дедлайн: ${b.deadline}</p>
            <button onclick="handleBuildingAction('moveNext-${b.id}')">Следующий этап</button>
        </div>
    `).join('');

    container.innerHTML = `<div class="dashboard-grid">${cards}</div>`;
}
// ... предыдущие условия
} else if (action === 'refreshDashboard') {
    renderBuildingDashboard(); // Dashboard
    return; // Stop action
} else if (action === 'openLead-') {
    // ...
      return;
    }
    // module-specific actions
    if(action.startsWith('openLead-')||action==='newLead'||action.startsWith('sendMsg-')||action==='genInvoice'||action==='calcAdd'||action==='saveIntegrations'||action==='fetchLeads'||action.startsWith('startInvoice-')||action==='generateInvoice'||action==='printInvoice'||action.startsWith('viewInvoice-')||action.startsWith('startWaybill-')||action==='generateWaybill'||action==='printWaybill'||action.startsWith('viewWaybill-')){
      if(action.startsWith('viewWaybill-')){
        const id = action.split('-')[1]; const wb = waybills.find(x=>x.id==id); if(!wb) return; const html = waybillTemplate(wb); const elc = document.getElementById('building-content'); if(elc) elc.innerHTML = `<div style="padding:12px"><div style="font-weight:700;margin-bottom:8px">${wb.id}</div><div style="background:${C(window.state).card};padding:12px;border-radius:6px">${html}</div></div>`;
        return;
      }
      if(action.startsWith('startWaybill-')){
        const id = action.split('-')[1]; startWaybill(id); return;
      }
      if(action==='generateWaybill'){ generateWaybill(); return; }
      if(action==='printWaybill'){ printWaybill(); return; }
      if(action.startsWith('viewInvoice-')){
        const id = action.split('-')[1]; const inv = invoices.find(x=>x.id==id); if(!inv) return; const html = invoiceTemplate(inv); const elc = document.getElementById('building-content'); if(elc) elc.innerHTML = `<div style="padding:12px"><div style="font-weight:700;margin-bottom:8px">${inv.id}</div><div style="background:${C(window.state).card};padding:12px;border-radius:6px">${html}</div></div>`;
        return;
      }
      if(action.startsWith('startInvoice-')){
        const id = action.split('-')[1]; startInvoice(id); return;
      }
      if(action==='generateInvoice'){ generateInvoice(); return; }
      if(action==='printInvoice'){ printInvoice(); return; }
      handleBuildingAction(action);
    }
  });

  // invoices HTML
  function getConfirmedOrders(){
    const orders = (window.state?.orders || []).filter(o=>o.status==='confirmed');
    return orders;
  }

  function getOrderPositions(order){
    if(order.positions && order.positions.length) return order.positions;
    const qty = Math.max(1, order.items || 1);
    const unit = qty ? Math.round((order.total || 0) / qty) : Math.round(order.total || 0);
    return [{name: order.desc || 'Услуги', qty, price: unit, total: unit * qty}];
  }

  function startInvoice(orderId){
    const order = (window.state?.orders || []).find(o=>o.id==orderId);
    if(!order) return;
    invoiceDraft.orderId = orderId;
    invoiceDraft.clientName = order.customer || 'Клиент не указан';
    invoiceDraft.clientAddress = order.address || 'Адрес не указан';
    invoiceDraft.clientPhone = order.phone || order.customer || '+7 900 000-00-00';
    invoiceDraft.items = getOrderPositions(order);
    invoiceDraft.note = '';
    renderBuilding();
  }

  function startWaybill(orderId){
    const order = (window.state?.orders || []).find(o=>o.id==orderId);
    if(!order) return;
    invoiceDraft.orderId = orderId;
    invoiceDraft.clientName = order.customer || 'Клиент не указан';
    invoiceDraft.clientAddress = order.address || 'Адрес не указан';
    invoiceDraft.clientPhone = order.phone || order.customer || '+7 900 000-00-00';
    invoiceDraft.items = getOrderPositions(order);
    invoiceDraft.note = '';
    renderBuilding();
  }

  function generateInvoice(){
    const order = (window.state?.orders || []).find(o=>o.id==invoiceDraft.orderId);
    if(!order) return;
    invoiceDraft.clientName = document.getElementById('invoiceClientName')?.value || invoiceDraft.clientName;
    invoiceDraft.clientAddress = document.getElementById('invoiceClientAddress')?.value || invoiceDraft.clientAddress;
    invoiceDraft.clientPhone = document.getElementById('invoiceClientPhone')?.value || invoiceDraft.clientPhone;
    invoiceDraft.note = document.getElementById('invoiceNote')?.value || invoiceDraft.note;
    const total = invoiceDraft.items.reduce((sum,item)=>sum + ((item.total != null ? item.total : item.qty * item.price) || 0), 0);
    const inv = {
      id: 'NB' + Date.now(),
      orderId: order.id,
      date: (new Date()).toLocaleDateString(),
      company: companyProfile.name,
      companyAddress: companyProfile.addr,
      companyPhone: companyProfile.phone || '+7 495 000-00-00',
      clientName: invoiceDraft.clientName,
      clientAddress: invoiceDraft.clientAddress,
      clientPhone: invoiceDraft.clientPhone,
      items: invoiceDraft.items,
      total,
      status: 'Сгенерировано',
      note: invoiceDraft.note
    };
    invoices.unshift(inv);
    saveInvoices();
    invoiceDraft.orderId = null;
    renderBuilding();
  }

  function generateWaybill(){
    const order = (window.state?.orders || []).find(o=>o.id==invoiceDraft.orderId);
    if(!order) return;
    invoiceDraft.clientName = document.getElementById('invoiceClientName')?.value || invoiceDraft.clientName;
    invoiceDraft.clientAddress = document.getElementById('invoiceClientAddress')?.value || invoiceDraft.clientAddress;
    invoiceDraft.clientPhone = document.getElementById('invoiceClientPhone')?.value || invoiceDraft.clientPhone;
    invoiceDraft.note = document.getElementById('invoiceNote')?.value || invoiceDraft.note;
    const total = invoiceDraft.items.reduce((sum,item)=>sum + ((item.total != null ? item.total : item.qty * item.price) || 0), 0);
    const waybill = {
      id: 'WB' + Date.now(),
      orderId: order.id,
      date: (new Date()).toLocaleDateString(),
      sender: {
        name: companyProfile.name,
        inn: companyProfile.inn,
        kpp: companyProfile.kpp,
        address: companyProfile.addr,
        phone: companyProfile.phone || '+7 495 000-00-00'
      },
      recipient: {
        name: invoiceDraft.clientName,
        address: invoiceDraft.clientAddress,
        phone: invoiceDraft.clientPhone
      },
      supplier: companyProfile.name,
      payer: invoiceDraft.clientName,
      basis: `Заказ ${order.id}`,
      items: invoiceDraft.items.map((item,index)=>({
        no: index + 1,
        description: item.name,
        quantity: item.qty,
        unit: item.unit || 'шт',
        unitPrice: item.price,
        total: item.total != null ? item.total : item.qty * item.price
      })),
      total,
      note: invoiceDraft.note
    };
    waybills.unshift(waybill);
    saveWaybills();
    invoiceDraft.orderId = null;
    renderBuilding();
  }

  function printWaybill(){
    window.print();
  }

  function invoicesHTML(){
    const c = C(window.state);
    const confirmed = getConfirmedOrders();
    const orderRows = confirmed.map(o=>{
      const qty = o.items || 1;
      const total = fmt(o.total);
      return `<tr><td style="padding:10px;border-bottom:1px solid ${c.border}">${o.id}</td><td style="padding:10px;border-bottom:1px solid ${c.border}">${o.customer||'Клиент'}</td><td style="padding:10px;border-bottom:1px solid ${c.border}">${total}</td><td style="padding:10px;border-bottom:1px solid ${c.border}"><button data-action="startWaybill-${o.id}" style="padding:6px 10px;border-radius:8px;border:1px solid ${c.border};background:${c.surf};cursor:pointer">Сформировать накладную</button></td></tr>`;
    }).join('');

    const historyRows = waybills.map(inv=>`<div style="padding:10px;border-bottom:1px solid ${c.border}"><div style="font-weight:700">${inv.id} · ${inv.date}</div><div style="color:${c.muted};font-size:13px">Заказ: ${inv.orderId} · ${fmt(inv.total)}${inv.note?` · ${inv.note}`:''}</div><div style="margin-top:6px"><button data-action="viewWaybill-${inv.id}" style="padding:6px 8px;border-radius:6px;border:1px solid ${c.border}">Открыть</button></div></div>`).join('') || `<div style="color:${c.muted}">История накладных пуста</div>`;

    return `<div style="padding:20px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div style="font-size:18px;font-weight:700;color:${c.text}">Накладные</div><div style="color:${c.muted};font-size:12px">Список подтверждённых заказов и история документов</div></div></div>
      <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:16px;min-height:320px">
        <div style="background:${c.card};border:1px solid ${c.border};border-radius:14px;padding:18px">
          <div style="font-weight:700;margin-bottom:14px">Подтверждённые заказы</div>
          ${confirmed.length ? `<div style="overflow:auto;max-height:440px"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px;border-bottom:1px solid ${c.border}">Заказ</th><th style="text-align:left;padding:10px;border-bottom:1px solid ${c.border}">Клиент</th><th style="text-align:left;padding:10px;border-bottom:1px solid ${c.border}">Сумма</th><th style="text-align:left;padding:10px;border-bottom:1px solid ${c.border}"></th></tr></thead><tbody>${orderRows}</tbody></table></div>` : `<div style="color:${c.muted}">Нет подтверждённых заказов</div>`}
        </div>
        <div style="background:${c.card};border:1px solid ${c.border};border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px">
          <div style="font-weight:700">История документов</div>
          <div style="flex:1;overflow:auto">${historyRows}</div>
        </div>
      </div>
      ${invoiceDraft.orderId ? invoiceDraftForm() : ''}
    </div>`;
  }

  function invoiceDraftForm(){
    const c = C(window.state);
    const order = (window.state?.orders || []).find(o=>o.id==invoiceDraft.orderId);
    if(!order) return '';
    const total = invoiceDraft.items.reduce((sum,item)=>sum + ((item.total != null ? item.total : item.qty * item.price) || 0), 0);
    const rows = invoiceDraft.items.map(it=>`<tr><td style="padding:10px;border-bottom:1px solid ${c.border}">${it.name}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${it.qty}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${fmt(it.price)}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${fmt(it.total != null ? it.total : it.qty * it.price)}</td></tr>`).join('');
    return `<div style="background:${c.card};border:1px solid ${c.border};border-radius:14px;padding:18px">
      <div style="font-weight:700;margin-bottom:12px">${t('waybillDraftForOrder').replace('{orderId}', order.id)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div style="display:flex;flex-direction:column;gap:10px"><label style="font-size:12px;color:${c.muted}">${t('clientName')}<input id="invoiceClientName" value="${invoiceDraft.clientName}" style="width:100%;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none"/></label><label style="font-size:12px;color:${c.muted}">${t('clientPhone')}<input id="invoiceClientPhone" value="${invoiceDraft.clientPhone}" style="width:100%;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none"/></label></div>
        <div style="display:flex;flex-direction:column;gap:10px"><label style="font-size:12px;color:${c.muted}">${t('clientAddress')}<textarea id="invoiceClientAddress" style="width:100%;min-height:84px;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none">${invoiceDraft.clientAddress}</textarea></label></div>
      </div>
      <div style="background:${state.dark?'#0F0F1A':'#fff'};border:1px solid ${c.border};border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px"><div><div style="font-weight:700;color:${c.text}">${companyProfile.name}</div><div style="color:${c.muted};font-size:13px">${companyProfile.addr}</div><div style="color:${c.muted};font-size:13px">${t('phone')}: ${companyProfile.phone || '+7 495 000-00-00'}</div></div><div style="text-align:right"><div style="font-weight:700;color:${c.text}">${t('waybill')}</div><div style="color:${c.muted};font-size:13px">${t('date')}: ${(new Date()).toLocaleDateString()}</div></div></div>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="padding:10px;border-bottom:1px solid ${c.border};text-align:left">${t('item')}</th><th style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${t('quantity')}</th><th style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${t('price')}</th><th style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${t('total')}</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="display:flex;justify-content:flex-end;padding-top:12px;font-weight:700;color:${c.text}">${t('total')}: ${fmt(total)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px">
          <div style="padding:14px;border:1px solid ${c.border};border-radius:10px"><div style="font-size:12px;color:${c.muted};margin-bottom:8px">${t('supplierSignature')}</div><div style="height:32px;border-bottom:1px solid ${c.border}"></div></div>
          <div style="padding:14px;border:1px solid ${c.border};border-radius:10px"><div style="font-size:12px;color:${c.muted};margin-bottom:8px">${t('recipientSignature')}</div><div style="height:32px;border-bottom:1px solid ${c.border}"></div></div>
        </div>
      </div>
      <label style="font-size:12px;color:${c.muted};display:block;margin-bottom:10px">${t('note')}<textarea id="invoiceNote" style="width:100%;min-height:80px;padding:10px;border:1px solid ${c.border};border-radius:10px;background:${c.surf};color:${c.text};outline:none">${invoiceDraft.note}</textarea></label>
      <div style="display:flex;gap:12px;flex-wrap:wrap"><button data-action="generateWaybill" style="padding:12px 18px;border-radius:12px;background:${c.acc};color:#fff;border:none">${t('saveAndCreate')}</button><button data-action="printWaybill" style="padding:12px 18px;border-radius:12px;background:${c.surf};color:${c.text};border:1px solid ${c.border}">${t('print')}</button></div>
    </div>`;
  }

  function waybillData(order){
    return {
      sender: {
        name: companyProfile.name,
        inn: companyProfile.inn,
        kpp: companyProfile.kpp,
        address: companyProfile.addr,
        phone: companyProfile.phone || '+7 495 000-00-00'
      },
      recipient: {
        name: invoiceDraft.clientName,
        address: invoiceDraft.clientAddress,
        phone: invoiceDraft.clientPhone
      },
      supplier: companyProfile.name,
      payer: invoiceDraft.clientName,
      basis: `Заказ ${order.id}`,
      items: invoiceDraft.items.map((item,index)=>({
        no: index + 1,
        description: item.name,
        quantity: item.qty,
        unit: item.unit || 'шт',
        unitPrice: item.price,
        total: item.total != null ? item.total : item.qty * item.price
      })),
      total: invoiceDraft.items.reduce((sum,item)=>sum + ((item.total != null ? item.total : item.qty * item.price) || 0), 0),
      note: invoiceDraft.note
    };
  }

  function waybillTemplate(wb){
    const c = C(window.state);
    const rows = (wb.items||[]).map(it=>`<tr><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:center">${it.no}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:left">${it.description}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${it.quantity}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:left">${it.unit}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${fmt(it.unitPrice)}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${fmt(it.total)}</td></tr>`).join('');
    return `<div style="background:#fff;color:#111;font-family:Inter,Arial,sans-serif;padding:24px;border:1px solid #000"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px"><div><div style="font-size:22px;font-weight:800;margin-bottom:6px">${wb.sender.name}</div><div style="font-size:13px;line-height:1.6">ИНН ${wb.sender.inn} / КПП ${wb.sender.kpp}</div><div style="font-size:13px;line-height:1.6">${wb.sender.address}</div><div style="font-size:13px;line-height:1.6">Телефон: ${wb.sender.phone}</div></div><div style="text-align:right"><div style="font-size:18px;font-weight:800">Товарная накладная ТОРГ-12</div><div style="font-size:13px;line-height:1.6">Документ № ${wb.id}</div><div style="font-size:13px;line-height:1.6">Дата: ${wb.date}</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px"><div style="font-size:13px"><div style="font-weight:700;margin-bottom:6px">Получатель</div><div>${wb.recipient.name}</div><div>${wb.recipient.address}</div><div>Телефон: ${wb.recipient.phone}</div></div><div style="font-size:13px"><div style="font-weight:700;margin-bottom:6px">Основание</div><div>${wb.basis}</div><div style="margin-top:10px;font-weight:700">Плательщик</div><div>${wb.payer}</div></div></div><table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px"><thead><tr><th style="padding:10px;border-bottom:2px solid #000;text-align:center">№</th><th style="padding:10px;border-bottom:2px solid #000;text-align:left">Товар</th><th style="padding:10px;border-bottom:2px solid #000;text-align:right">Кол-во</th><th style="padding:10px;border-bottom:2px solid #000;text-align:left">Ед.</th><th style="padding:10px;border-bottom:2px solid #000;text-align:right">Цена</th><th style="padding:10px;border-bottom:2px solid #000;text-align:right">Сумма</th></tr></thead><tbody>${rows}</tbody></table><div style="display:flex;justify-content:flex-end;gap:24px;font-size:13px;font-weight:700;margin-bottom:20px"><div>Всего:</div><div>${fmt(wb.total)}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div style="padding:12px;border:1px solid #000;border-radius:10px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">Подпись отправителя</div><div style="height:48px;border-bottom:1px solid #000"></div></div><div style="padding:12px;border:1px solid #000;border-radius:10px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">Подпись получателя</div><div style="height:48px;border-bottom:1px solid #000"></div></div></div><div style="margin-top:18px;font-size:12px;color:#555">Примечание: ${wb.note || '—'}</div></div>`;
  }
  function invoiceTemplate(inv){
    const c = C(window.state);
    const rows = (inv.items||[]).map(it=>`<tr><td style="padding:10px;border-bottom:1px solid ${c.border}">${it.name}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${it.qty}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${fmt(it.price)}</td><td style="padding:10px;border-bottom:1px solid ${c.border};text-align:right">${fmt(it.total != null ? it.total : it.qty * it.price)}</td></tr>`).join('');
    return `<div style="background:#fff;color:#111;font-family:Inter,Arial,sans-serif;padding:24px;border:1px solid #000"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px"><div><div style="font-size:22px;font-weight:800;margin-bottom:6px">${companyProfile.name}</div><div style="font-size:13px;line-height:1.6">${companyProfile.addr}</div><div style="font-size:13px;line-height:1.6">Телефон: ${companyProfile.phone || '+7 495 000-00-00'}</div></div><div style="text-align:right"><div style="font-size:16px;font-weight:700">Накладная</div><div style="font-size:13px;line-height:1.6">${inv.date}</div><div style="font-size:13px;line-height:1.6">Документ № ${inv.id}</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px"><div><div style="font-size:13px;font-weight:700;margin-bottom:6px">Поставщик</div><div style="font-size:13px;line-height:1.6">${companyProfile.name}</div><div style="font-size:13px;line-height:1.6">${companyProfile.addr}</div><div style="font-size:13px;line-height:1.6">Телефон: ${companyProfile.phone || '+7 495 000-00-00'}</div></div><div><div style="font-size:13px;font-weight:700;margin-bottom:6px">Получатель</div><div style="font-size:13px;line-height:1.6">${inv.clientName}</div><div style="font-size:13px;line-height:1.6">${inv.clientAddress}</div><div style="font-size:13px;line-height:1.6">${inv.clientPhone}</div></div></div><table style="width:100%;border-collapse:collapse;margin-bottom:18px"><thead><tr><th style="text-align:left;border-bottom:2px solid #000;padding:10px">Товар</th><th style="text-align:right;border-bottom:2px solid #000;padding:10px">Кол-во</th><th style="text-align:right;border-bottom:2px solid #000;padding:10px">Цена</th><th style="text-align:right;border-bottom:2px solid #000;padding:10px">Сумма</th></tr></thead><tbody>${rows}</tbody></table><div style="display:flex;justify-content:flex-end;font-size:13px;font-weight:700;gap:20px;margin-bottom:40px"><span>Итого:</span><span>${fmt(inv.total)}</span></div><div style="display:flex;justify-content:space-between;gap:20px"><div style="width:45%"><div style="font-size:12px;color:#555;margin-bottom:8px">Подпись поставщика</div><div style="height:48px;border-bottom:1px solid #000"></div></div><div style="width:45%"><div style="font-size:12px;color:#555;margin-bottom:8px">Подпись получателя</div><div style="height:48px;border-bottom:1px solid #000"></div></div></div></div>`;
  }
  }
})();
