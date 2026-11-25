'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const items = window.SHOP_ITEMS;
  const byId = new Map(items.map(item => [item.slug, item]));
  const namespace = 'gamerlito.skin-shop.nov25.v1.';
  const memory = new Map();
  function read(key) {
    try { return localStorage.getItem(namespace + key) ?? memory.get(key) ?? null; }
    catch { return memory.get(key) ?? null; }
  }
  function write(key, value) {
    if (value === null) memory.delete(key); else memory.set(key, String(value));
    try { if (value === null) localStorage.removeItem(namespace + key); else localStorage.setItem(namespace + key, String(value)); } catch {}
  }
  const sum = values => values.reduce((a,b) => a+b, 0);
  const saleKey = item => item.pack ? 'pack.' + item.pack : item.slug;
  const saleOffers = new Map(items.map(item => [saleKey(item), item]));
  const openingV = Math.ceil((sum(items.filter(i => !i.currency && !i.members).map(i => i.price)) + 10000) / 10000) * 10000;
  const openingCash = Math.ceil(sum([...saleOffers.values()].filter(i => i.currency).map(i => i.price)) / 1000) * 1000;
  const format = new Intl.NumberFormat('en-US');
  const fullModels = new Set(['modena-icon','joker-p5r','panther-p5r','cap-n-hatsune-miku']);
  const motion = new Set(['she-did-it-again','sugar-on-my-tongue','walkin-pretty','surf-the-soundwaves','shape-up','boom-boom-bass']);
  const order = ["Today's Best Sellers","Welcome Offer","Iconic Emotes","Curated Picks","Persona 5 Royal","Addison Rae","The Amazing Digital Circus","One-Punch Man","Hoppers","Ferrari","No Sweat","Harvest Season","Overwatch","Treasure Hunters","One Piece","Hatsune Miku","Pirates of the Caribbean","Birds of a Feather","Phineas and Ferb","The Sidekick Squad","Crash Bandicoot & Spyro the Dragon","Main Character Energy","Save The World","TheGrefg","MrSavage","The Kid LAROI","Lil Uzi Vert","A$AP Rocky","Special Offers & Bundles"];
  const groups = new Map(order.map(name => [name, []]));
  function named(list) { return list.map(id => byId.get(id)).filter(Boolean); }
  groups.set(order[0], named(['joker-p5r','modena-icon','persona-5-royal-bundle','she-did-it-again','cardamom']));
  groups.set('Curated Picks', named(['modena-icon','black-beatles','ok','shake-it','skull-and-crossed-swords','choppin']));
  for (const item of items) {
    if (!groups.has(item.section)) groups.set(item.section, []);
    groups.get(item.section).push(item);
  }
  const pinned = {
    'Persona 5 Royal':['persona-5-royal-bundle','joker-p5r','panther-p5r','morgana-p5r'],
    'Ferrari':['ferrari-bundle','modena-icon','maranello-racer'],
    'No Sweat':['sklaxis','blockade-runner','snakepit','assault-trooper','killian','sica','tigress','splatterella'],
    'One-Punch Man':['saitama','genos','terrible-tornado'],
    'Iconic Emotes':['she-did-it-again','sugar-on-my-tongue','groove-destroyer','walkin-pretty','surf-the-soundwaves','shape-up','boom-boom-bass','the-airplane','shake-it','black-beatles','pop-muzik','a-bar-song']
  };
  Object.entries(pinned).forEach(([name,ids]) => {
    const chosen = named(ids);
    groups.set(name,[...chosen,...groups.get(name).filter(item => !chosen.includes(item))]);
  });
  let owned, paidV, paidCash, currentScreen, marketMode = 'shop', selected, origin = 'shop', filterSection = '', transaction = false;
  let scrollByMode = {}, rewardGroup = [], rewardItem, rewardToken = 0, navigationToken = 0, observer, queryText = '', soundOn = read('sound') !== 'off';
  let lastToast, revealTimer, purchaseTimer, activeAudio, usingOriginal = false;
  const loadedSheets = new Map();
  const sectionNodes = new Map();
  const mediaPath = name => 'media-' + name;
  function collectState() {
    owned = new Set(); paidV = 0; paidCash = 0;
    for (const [key, offer] of saleOffers) {
      const raw = read('sale.' + key);
      if (!raw) continue;
      let sale; try { sale = JSON.parse(raw); } catch { continue; }
      if (!Array.isArray(sale.grants) || !Number.isFinite(sale.amount)) continue;
      for (const id of sale.grants) { if (byId.has(id)) owned.add(id); }
      if (offer.currency) paidCash += sale.amount; else paidV += sale.amount;
    }
  }
  function refreshBalance() {
    document.querySelectorAll('[data-balance]').forEach(el => el.textContent = format.format(openingV-paidV));
    $('cash-balance').textContent = 'MX$'+format.format(openingCash-paidCash);
  }
  function grants(item) {
    if (item.pack) return items.filter(i => i.pack === item.pack).map(i => i.slug);
    if (item.members) return [item.slug,...item.members];
    return [item.slug];
  }
  function cost(item) {
    if (!item.members) return item.price;
    return Math.max(0, item.price - sum(item.members.filter(id => owned.has(id)).map(id => byId.get(id).price)));
  }
  function has(item) { return owned.has(item.slug) || (item.members && item.members.every(id => owned.has(id))); }
  function svg(name) { const s = document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('aria-hidden','true');const u = document.createElementNS(s.namespaceURI,'use');u.setAttribute('href','#i-'+name);s.append(u);return s; }
  function el(tag,cls,text) { const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node; }
  function coin() { return el('span','coin','V'); }
  function price(item) {
    const out = document.createDocumentFragment();
    if(item.currency) out.append(item.currency + format.format(cost(item)) + '.00');
    else out.append(coin(),' '+format.format(cost(item)));
    return out;
  }
  function tileArt(item,extra='') {
    const [page,col,row]=item.tile, art=el('span','sf-art '+extra);
    art.style.backgroundImage='url("'+mediaPath('cards-'+page+'.webp')+'")';
    art.style.backgroundPosition=(col*20)+'% '+(row*100/3)+'%';
    art.setAttribute('aria-hidden','true');return art;
  }
  function notify(message) { const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(lastToast);lastToast=setTimeout(()=>t.classList.remove('show'),2000); }
  function equipped(item) { return read('wear.'+item.kind) === item.slug; }
  function equipItem(item) {
    if (item.members) item=byId.get(item.members[0]);
    if (!has(item)) return;
    write('wear.'+item.kind,item.slug);notify(item.name+' equipped');
  }
  function figure(host, item, {moving=false, reveal=false} = {}) {
    host.replaceChildren();host.classList.toggle('appear',false);
    if (reveal) { void host.offsetWidth; host.classList.add('appear'); }
    const poster=tileArt(item,'art-fallback');host.append(poster);
    if(moving && motion.has(item.slug)) {
      const v=el('video','motion-model');v.muted=!soundOn;v.loop=true;v.playsInline=true;v.preload='metadata';v.src=mediaPath(item.slug+'.mp4');
      v.addEventListener('playing',()=>{poster.hidden=true;},{once:true});
      v.addEventListener('error',()=>v.remove(),{once:true});host.append(v);
      v.play().catch(()=>{v.muted=true;v.play().catch(()=>{});});return;
    }
    if(fullModels.has(item.slug)){
      const im=el('img','figure-img');im.alt='';im.decoding='async';im.src=mediaPath('model-'+item.slug+'.webp');
      im.decode().then(()=>{if(host.contains(poster))host.replaceChildren(im);}).catch(()=>{});return;
    }
    if(!item.model)return;
    const [page,col,row]=item.model, url=mediaPath('heroes-'+page+'.webp');
    if(!loadedSheets.has(page)){const pre=new Image();pre.src=url;loadedSheets.set(page,pre.decode().catch(()=>{loadedSheets.delete(page);throw new Error('Image unavailable');}));}
    loadedSheets.get(page).then(()=>{
      if(!host.contains(poster))return;
      const art=el('span','model-art');art.style.backgroundImage='url("'+url+'")';art.style.backgroundPosition=(col*50)+'% '+row*50+'%';
      host.replaceChildren(art);
    }).catch(()=>{});
  }
  function renderCard(item) {
    const card=el('article','tile');card.dataset.id=item.slug;
    const view=el('button','tile-body');view.type='button';view.setAttribute('aria-label','Preview '+item.name);view.dataset.preview=item.slug;
    view.append(tileArt(item,'tile-poster'));
    const caption=el('span','tile-caption');
    const name=el('span','tile-name',item.name),value=el('span','tile-price');value.append(price(item));caption.append(name,value);view.append(caption);
    if(read('fav.'+item.slug)){const h=el('span','ribbon');h.append(svg('heart'));view.append(h);}
    const own=has(item),button=el('button','tile-action'+(own?' owned':''),own?(equipped(item)?'EQUIPPED':'✓ OWNED'):'PURCHASE');
    button.type='button';button.dataset[own?'preview':'buy']=item.slug;button.setAttribute('aria-label',(own?'View owned ':'Purchase ')+item.name);
    card.append(view,button);return card;
  }
  function shelvesFor(mode) {
    if(mode==='shop') return [...groups].filter(([,list])=>list.length);
    let list=items, title='';
    if(mode==='locker'){list=items.filter(item=>owned.has(item.slug)&&!item.members);title='Locker';}
    if(mode==='favorites'){list=items.filter(item=>read('fav.'+item.slug));title='Favorites';}
    if(mode==='search'){const key=queryText.trim().toLowerCase();list=items.filter(i=>(i.name+' '+i.section).toLowerCase().includes(key));title=key?'Search results':'All items';}
    return [[title,list]];
  }
  function drawMarket(mode) {
    marketMode=mode;currentScreen='store';const shelves=$('shelves'), rail=$('dots');
    shelves.replaceChildren();rail.replaceChildren();sectionNodes.clear();observer?.disconnect();
    document.querySelectorAll('.nav nav button').forEach(b=>{if(b.dataset.go===mode)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    $('searchbox').hidden=mode!=='search';$('filter').hidden=mode!=='shop';rail.hidden=mode!=='shop';
    const sections=shelvesFor(mode), listFrag=document.createDocumentFragment();
    for(const [name,entries] of sections) {
      const section=el('section','shelf');section.dataset.section=name;const heading=el('h2','',name);section.append(heading);
      if(entries.length){const grid=el('div','cards');for(const item of entries)grid.append(renderCard(item));section.append(grid);}
      else {section.append(el('p','empty',mode==='locker'?'Purchase a skin in the shop to add it to your locker.':mode==='favorites'?'Tap the heart on an item to save it here.':'No items match this search.'));}
      listFrag.append(section);sectionNodes.set(name,section);
      if(mode==='shop'){const dot=el('button');dot.title=name;dot.setAttribute('aria-label',name);dot.onclick=()=>jump(name);rail.append(dot);}
    }
    shelves.append(listFrag);
    if(mode==='shop' && 'IntersectionObserver' in window) {
      observer=new IntersectionObserver(()=>trackSection(),{root:$('catalog'),threshold:[0,.12,.5,.95]});
      sectionNodes.forEach(s=>observer.observe(s));
    }
    $('catalog').scrollTop=scrollByMode[mode]||0;trackSection();
  }
  function trackSection() {
    if (marketMode!=='shop') return;
    const t=$('catalog').getBoundingClientRect().top+45;
    let active=[...sectionNodes.keys()][0];for(const [k,s] of sectionNodes){if(s.getBoundingClientRect().top<=t)active=k;else break;}
    filterSection=active;for(const b of $('dots').children)b.classList.toggle('current',b.title===active);
  }
  function jump(name) { const s=sectionNodes.get(name);if(!s)return;$('catalog').scrollTop+=s.getBoundingClientRect().top-$('catalog').getBoundingClientRect().top-8;trackSection(); }
  function setScreen(id) {
    navigationToken++;
    if(currentScreen==='store')scrollByMode[marketMode]=$('catalog').scrollTop;
    for(const screen of document.querySelectorAll('.screen')) { if(screen.id!==id)screen.querySelectorAll('video').forEach(v=>v.pause());screen.hidden=screen.id!==id; }
    currentScreen=id;document.body.dataset.screen=id;
    if(id!=='reward'){$('reward-video').pause();clearTimeout(revealTimer);rewardToken++;if(activeAudio && !transaction){activeAudio.pause();activeAudio=null;}}
    if(id!=='detail')$('detail-model').replaceChildren();
    refreshBalance();
  }
  function replaceHash(value) { if(location.hash!=='#'+value) { try {history.replaceState(null,'','#'+value);} catch {} } }
  function go(mode) {
    if(transaction)return;
    if(['shop','favorites','locker','search'].includes(mode)) { setScreen('store');drawMarket(mode);replaceHash(mode);return; }
    if(mode==='home') {setScreen('home');replaceHash('home');return;}
    if(mode==='lobby') {
      setScreen('lobby');replaceHash('lobby');const wear=byId.get(read('wear.Outfit')), host=$('lobby-wear');host.hidden=!wear;
      host.closest('.stage').classList.toggle('equipped',Boolean(wear));const v=$('lobby-video');
      if(wear){v.pause();figure(host,wear);}else{host.replaceChildren();if(!v.getAttribute('src'))v.src=mediaPath('lobby.mp4');v.play().catch(()=>{});}
    }
  }
  function description(item) {return item.pack ? 'Included in the '+item.pack+'.' : item.desc||'';}
  function caption(item) {return item.members?'BUNDLE':item.kind==='Outfit'?'OUTFIT – FORTNITE STYLE':item.kind.toUpperCase();}
  function showDetail(item,remember=true) {
    if(!item || transaction)return;
    if(remember)origin=currentScreen==='store'?marketMode:'shop';selected=item;setScreen('detail');replaceHash('item/'+item.slug);
    $('item-type').textContent=caption(item);$('item-name').textContent=item.name;
    $('detail-thumb').replaceChildren(tileArt(item));$('item-description').textContent=description(item);$('item-set').textContent=item.pack?'Bundle price in demo store credit.':item.set;
    const owns=has(item),p=$('item-price');p.classList.toggle('is-owned',Boolean(owns));p.replaceChildren(owns?'✓ OWNED':price(item));
    $('purchase').textContent=owns?(equipped(item)?'EQUIPPED':'EQUIP'):'PURCHASE';
    $('favorite').setAttribute('aria-pressed',String(!!read('fav.'+item.slug)));$('favorite').setAttribute('aria-label','Favorite '+item.name);
    figure($('detail-model'),item,{moving:true});
  }
  function audioPurchase() {
    if(!soundOn)return;activeAudio?.pause();activeAudio=new Audio(mediaPath('purchase.m4a'));activeAudio.volume=.85;activeAudio.play().catch(()=>{});
  }
  function buy(item) {
    if(!item||transaction)return;collectState();
    if(has(item)){showDetail(item,currentScreen!=='detail');return;}
    if(currentScreen!=='detail' || selected!==item)showDetail(item);
    const grantIds=grants(item), amount=cost(item), key=saleKey(item);
    if(!read('sale.'+key))write('sale.'+key,JSON.stringify({amount,grants:grantIds}));
    collectState();refreshBalance();transaction=true;
    $('detail-model').querySelector('video')?.pause();$('detail').querySelector('.processing').hidden=false;audioPurchase();
    const related=grantIds.filter(id=>!byId.get(id)?.members).map(id=>byId.get(id)).filter(Boolean);
    rewardGroup=[...new Set([...(item.members?[]:[item]),...related])];
    purchaseTimer=setTimeout(()=>{transaction=false;$('detail').querySelector('.processing').hidden=true;openReward(rewardGroup[0]);},650);
  }
  function chooseReward(item) {
    rewardItem=item;const token=++rewardToken;const stage=$('reward').querySelector('.stage');
    usingOriginal=item.slug==='modena-icon'&&rewardGroup.length===1;
    stage.classList.remove('native-playing','original-reward');
    $('reward-left').hidden=false;figure($('reward-model'),item,{reveal:true});$('reward-type').textContent=caption(item);$('reward-name').textContent=item.name;$('reward-desc').textContent=description(item);$('reward-set').textContent=item.set;
    const strip=$('reward-thumbs');strip.replaceChildren();
    for(const r of rewardGroup) {const b=el('button');b.append(tileArt(r));b.firstChild.style.cssText+=';width:100%;height:100%';b.setAttribute('aria-label','Show '+r.name);b.setAttribute('aria-pressed',String(r===item));b.onclick=()=>{if(rewardItem!==r)chooseReward(r);};strip.append(b);}
    const video=$('reward-video');video.muted=true;video.onplaying=()=>{if(token!==rewardToken||currentScreen!=='reward')return;stage.classList.add('native-playing');stage.classList.toggle('original-reward',usingOriginal);};
    video.onerror=()=>{if(token===rewardToken)stage.classList.remove('native-playing','original-reward');};
    video.src=mediaPath(usingOriginal?'modena.mp4':'acquisition.mp4');video.play().catch(()=>{});
    $('equip').textContent=equipped(item)?'EQUIPPED':'EQUIP';$('claim').textContent='CLAIM ALL';
  }
  function openReward(item) {setScreen('reward');replaceHash(origin);chooseReward(item);}
  function endReward(equip=false) {if(currentScreen!=='reward')return;if(equip)equipItem(rewardItem);go(origin||'shop');}
  function openProfile() { $('reset-confirm').hidden=true;$('sound').textContent='Sound · '+(soundOn?'On':'Off');refreshBalance();$('profile').showModal(); }
  function openCollections() {const list=$('collections');list.replaceChildren();for(const [name,rows] of groups){if(!rows.length)continue;const b=el('button',name===filterSection?'chosen':'',name);b.onclick=()=>{$('drawer').close();jump(name);};list.append(b);}$('drawer').showModal();}
  document.addEventListener('click', e=>{
    const btn=e.target.closest('button');if(!btn)return;
    if(btn.dataset.go)go(btn.dataset.go);
    else if(btn.hasAttribute('data-profile'))openProfile();
    else if(btn.dataset.preview)showDetail(byId.get(btn.dataset.preview));
    else if(btn.dataset.buy)buy(byId.get(btn.dataset.buy));
    else if(btn.classList.contains('close'))btn.closest('dialog').close();
  });
  for(const dlg of document.querySelectorAll('dialog'))dlg.addEventListener('click',e=>{if(e.target===dlg){const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dlg.close();}});
  function launch() {
    setScreen('loading');const current=navigationToken;const v=$('load-video');v.src=mediaPath('connecting.mp4');v.onended=()=>{if(current===navigationToken)go('lobby');};v.play().catch(()=>{});setTimeout(()=>{if(current===navigationToken)go('lobby');},3650);
  }
  document.querySelectorAll('.home-game,.home-recent').forEach(b=>b.onclick=launch);$('skip').onclick=()=>go('lobby');
  $('purchase').onclick=()=>{if(!selected||transaction)return;if(has(selected)){equipItem(selected);$('purchase').textContent='EQUIPPED';}else buy(selected);};
  $('favorite').onclick=()=>{if(!selected)return;const k='fav.'+selected.slug;write(k,read(k)?null:'1');$('favorite').setAttribute('aria-pressed',String(!!read(k)));};
  $('detail-back').onclick=()=>go(origin);$('claim').onclick=()=>endReward(false);$('equip').onclick=()=>endReward(true);$('filter').onclick=openCollections;
  $('query').oninput=e=>{queryText=e.target.value;scrollByMode.search=0;drawMarket('search');};
  $('catalog').addEventListener('scroll',()=>{if(currentScreen==='store'&&marketMode==='shop')trackSection();},{passive:true});
  $('sound').onclick=()=>{soundOn=!soundOn;write('sound',soundOn?'on':'off');$('sound').textContent='Sound · '+(soundOn?'On':'Off');};
  $('start-home').onclick=()=>{$('profile').close();go('home');};
  $('reset').onclick=()=>{$('reset-confirm').hidden=false;};$('no-reset').onclick=()=>{$('reset-confirm').hidden=true;};
  $('do-reset').onclick=()=>{for(const key of saleOffers.keys())write('sale.'+key,null);for(const kind of new Set(items.map(i=>i.kind)))write('wear.'+kind,null);collectState();scrollByMode={};$('profile').close();go('shop');notify('Demo purchases reset');};
  window.addEventListener('storage',event=>{if(event.key && !event.key.startsWith(namespace))return;collectState();refreshBalance();if(currentScreen==='store'){scrollByMode[marketMode]=$('catalog').scrollTop;drawMarket(marketMode);}});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||document.querySelector('dialog[open]')||transaction)return;if(currentScreen==='reward')endReward();else if(currentScreen==='detail')go(origin);else if(currentScreen==='store'&&marketMode!=='shop')go('shop');else if(currentScreen==='store')go('lobby');});
  function route() {if(transaction)return;const hash=location.hash.slice(1);if(hash.startsWith('item/')&&byId.has(hash.slice(5))){origin='shop';showDetail(byId.get(hash.slice(5)),false);}else go(['home','lobby','shop','locker','favorites','search'].includes(hash)?hash:'home');}
  window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>{clearTimeout(purchaseTimer);transaction=false;$('detail').querySelector('.processing').hidden=true;activeAudio?.pause();});
  window.addEventListener('pageshow',e=>{if(e.persisted){collectState();route();}});
  collectState();route();
})();
