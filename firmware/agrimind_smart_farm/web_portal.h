/*
 * web_portal.h - AgriMind Smart Farm on-device web app (captive portal).
 * --------------------------------------------------------------------------
 * A single self-contained page (HTML + CSS + JS, no external assets) served by
 * the ESP32 on port 80. Reachable two ways:
 *   - over the device's own hotspot  (http://192.168.4.1)
 *   - over your Wi-Fi once connected  (http://<device-ip>)
 *
 * It drives these JSON/form endpoints exposed by the sketch:
 *   GET  /api/status                -> connection + live sensors + settings
 *   GET  /api/scan                  -> nearby Wi-Fi (async; poll until !scanning)
 *   GET  /api/networks              -> saved networks (no passwords)
 *   POST /api/connect   ssid,password? -> save (if pwd) + connect now
 *   POST /api/forget    ssid        -> remove a saved network
 *   POST /api/disconnect            -> drop the current link, stop auto-reconnect
 *   POST /api/settings  backend,token,interval,appwd -> persist device settings
 *
 * Stored as a flash string so it costs no RAM until requested.
 */
#pragma once
#include <Arduino.h>

const char PORTAL_HTML[] PROGMEM = R"PORTAL(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>AgriMind Smart Farm</title>
<style>
  :root{
    --green:#1b5e20; --green-2:#2e7d32; --accent:#43a047; --bg:#f4f7f3;
    --card:#ffffff; --line:#e3e8e0; --muted:#6b7a6e; --text:#1d2620;
    --ok:#2e7d32; --warn:#c98a00; --bad:#c62828; --radius:16px;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
       background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}
  .wrap{max-width:560px;margin:0 auto;padding:16px 16px 48px}
  header{display:flex;align-items:center;gap:12px;padding:18px 4px 14px}
  .logo{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;
        justify-content:center;background:linear-gradient(135deg,var(--green),var(--accent));
        color:#fff;font-size:22px}
  h1{font-size:19px;margin:0;line-height:1.1}
  .sub{font-size:12px;color:var(--muted);margin-top:2px}
  .badge{margin-left:auto;font-size:12px;font-weight:600;padding:6px 11px;border-radius:999px;
         display:flex;align-items:center;gap:6px;background:#eef3ec;color:var(--muted)}
  .badge .dot{width:8px;height:8px;border-radius:50%;background:#bbb}
  .badge.live{background:#e7f3e8;color:var(--green)} .badge.live .dot{background:var(--ok)}
  .badge.off{background:#fdeaea;color:var(--bad)} .badge.off .dot{background:var(--bad)}
  .tabs{display:flex;gap:6px;background:#e9efe7;padding:5px;border-radius:14px;margin:6px 0 16px}
  .tabs button{flex:1;border:0;background:transparent;padding:10px;border-radius:10px;
        font-size:14px;font-weight:600;color:var(--muted);cursor:pointer}
  .tabs button.on{background:var(--card);color:var(--green);box-shadow:0 1px 4px rgba(0,0,0,.06)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
        padding:16px;margin-bottom:14px}
  .card h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);
        margin:0 0 12px}
  .row{display:flex;justify-content:space-between;align-items:center;gap:10px;
        padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}
  .row:last-child{border-bottom:0}
  .row .k{color:var(--muted)} .row .v{font-weight:600;text-align:right;word-break:break-all}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .tile{background:#f6f9f5;border:1px solid var(--line);border-radius:12px;padding:11px}
  .tile .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  .tile .num{font-size:20px;font-weight:700;margin-top:2px}
  .tile .st{font-size:11px;font-weight:600;margin-top:3px}
  .st.ok{color:var(--ok)} .st.warning{color:var(--warn)} .st.critical{color:var(--bad)}
  button.btn{border:0;border-radius:11px;padding:11px 14px;font-size:14px;font-weight:600;
        cursor:pointer;background:var(--green-2);color:#fff;width:100%}
  button.btn.sec{background:#eef3ec;color:var(--green)}
  button.btn.danger{background:#fdeaea;color:var(--bad)}
  button.btn:disabled{opacity:.55;cursor:default}
  .net{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)}
  .net:last-child{border-bottom:0}
  .net .name{font-weight:600;font-size:14px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .net .meta{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px}
  .bars{display:inline-flex;align-items:flex-end;gap:2px;height:14px}
  .bars i{width:3px;background:#cdd6cc;border-radius:1px}
  .bars i.on{background:var(--accent)}
  .pwd{margin-top:10px;display:none}
  .pwd.show{display:block}
  .pwd input{width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;
        font-size:14px;margin-bottom:8px}
  .pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#e7f3e8;color:var(--green)}
  .field{margin-bottom:13px}
  .field label{display:block;font-size:13px;color:var(--muted);margin-bottom:5px}
  .field input{width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font-size:14px}
  .muted{color:var(--muted);font-size:13px;text-align:center;padding:14px 0}
  .toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(80px);
        background:#1d2620;color:#fff;padding:11px 18px;border-radius:11px;font-size:14px;
        opacity:0;transition:.25s;z-index:9}
  .toast.show{transform:translateX(-50%) translateY(0);opacity:1}
  .spin{display:inline-block;width:14px;height:14px;border:2px solid #ffffff66;border-top-color:#fff;
        border-radius:50%;animation:s .7s linear infinite;vertical-align:-2px;margin-right:6px}
  @keyframes s{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">&#127807;</div>
    <div>
      <h1>AgriMind Smart Farm</h1>
      <div class="sub" id="apline">device setup</div>
    </div>
    <div class="badge" id="badge"><span class="dot"></span><span id="badgetxt">…</span></div>
  </header>

  <div class="tabs">
    <button class="on" data-tab="status" onclick="tab('status')">Status</button>
    <button data-tab="wifi" onclick="tab('wifi')">Wi-Fi</button>
    <button data-tab="settings" onclick="tab('settings')">Settings</button>
  </div>

  <!-- STATUS -->
  <section id="status">
    <div class="card">
      <h2>Connection</h2>
      <div class="row"><span class="k">Network</span><span class="v" id="s_ssid">—</span></div>
      <div class="row"><span class="k">IP address</span><span class="v" id="s_ip">—</span></div>
      <div class="row"><span class="k">Signal</span><span class="v" id="s_rssi">—</span></div>
      <div class="row"><span class="k">Backend</span><span class="v" id="s_send">—</span></div>
      <div class="row"><span class="k">Irrigation pump</span><span class="v" id="s_pump">—</span></div>
    </div>
    <div class="card">
      <h2>Live sensors</h2>
      <div class="grid" id="sensors"><div class="muted">waiting for readings…</div></div>
    </div>
  </section>

  <!-- WIFI -->
  <section id="wifi" style="display:none">
    <div class="card">
      <h2>Available networks</h2>
      <button class="btn sec" id="scanbtn" onclick="scan()">Scan for networks</button>
      <div id="scanlist"></div>
    </div>
    <div class="card">
      <h2>Saved networks</h2>
      <div id="savedlist"><div class="muted">none saved yet</div></div>
    </div>
    <button class="btn danger" onclick="disconnect()">Disconnect from current network</button>
  </section>

  <!-- SETTINGS -->
  <section id="settings" style="display:none">
    <div class="card">
      <h2>Backend &amp; device</h2>
      <div class="field"><label>Backend telemetry URL</label>
        <input id="cfg_backend" placeholder="https://…/api/v1/iot/telemetry/"></div>
      <div class="field"><label>Device token</label>
        <input id="cfg_token" placeholder="device token from AgriMind"></div>
      <div class="field"><label>Send interval (seconds)</label>
        <input id="cfg_interval" type="number" min="5" max="3600" placeholder="30"></div>
      <button class="btn" onclick="saveSettings()">Save settings</button>
    </div>
    <div class="card">
      <h2>Setup hotspot</h2>
      <div class="field"><label>Hotspot password (min 8 chars, blank = open)</label>
        <input id="cfg_appwd" placeholder="agrimind123"></div>
      <button class="btn sec" onclick="saveAp()">Update hotspot password</button>
      <p class="muted" style="text-align:left;margin:10px 0 0">
        Changing this restarts the hotspot — you may need to reconnect to it.</p>
    </div>
  </section>
</div>

<div class="toast" id="toast"></div>

<script>
const $=id=>document.getElementById(id);
let pendingSsid=null;          // network awaiting a password in the scan list
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2400);}
function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function postForm(path,data){
  const b=Object.entries(data).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
  return fetch(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b});
}
function tab(name){
  ['status','wifi','settings'].forEach(t=>$(t).style.display=t===name?'block':'none');
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  if(name==='wifi'){loadNetworks();}
}
function bars(q){ // q = 0..100 signal quality
  const lvl=q>=70?4:q>=50?3:q>=30?2:q>0?1:0;let h='<span class="bars">';
  for(let i=1;i<=4;i++)h+=`<i class="${i<=lvl?'on':''}" style="height:${3+i*2.5}px"></i>`;
  return h+'</span>';
}

// ---- STATUS (polls every 3s) ----
async function loadStatus(){
  let d; try{ d=await (await fetch('/api/status')).json(); }catch(e){ return; }
  const b=$('badge'),bt=$('badgetxt');
  if(d.connected){b.className='badge live';bt.textContent='Online';}
  else{b.className='badge off';bt.textContent='Offline';}
  $('apline').textContent='Hotspot: '+d.ap_ssid+'  ·  '+d.ap_ip;
  $('s_ssid').textContent=d.connected?d.ssid:'not connected';
  $('s_ip').textContent=d.connected?d.ip:'—';
  $('s_rssi').textContent=d.connected?(d.rssi+' dBm'):'—';
  $('s_send').textContent=d.token_set?(d.last_send||'idle'):'no token set';
  $('s_pump').textContent=d.pump?'ON':'OFF';
  const g=$('sensors');const keys=Object.keys(d.sensors||{});
  if(!keys.length){g.innerHTML='<div class="muted">waiting for readings…</div>';return;}
  g.innerHTML=keys.map(k=>{const s=d.sensors[k];
    return `<div class="tile"><div class="lbl">${esc(k)}</div>
      <div class="num">${s.value}${esc(s.unit||'')}</div>
      <div class="st ${s.status}">${esc(s.status)}</div></div>`;}).join('');
}

// ---- WIFI SCAN ----
async function scan(){
  const btn=$('scanbtn');btn.disabled=true;btn.innerHTML='<span class="spin"></span>Scanning…';
  $('scanlist').innerHTML='';
  try{
    for(let i=0;i<18;i++){
      const d=await (await fetch('/api/scan')).json();
      if(!d.scanning){renderScan(d.networks||[]);break;}
      await sleep(1200);
    }
  }catch(e){toast('Scan failed');}
  btn.disabled=false;btn.textContent='Scan for networks';
}
function renderScan(nets){
  // strongest first, de-duplicate by SSID
  const seen={};const list=[];
  nets.sort((a,b)=>b.quality-a.quality).forEach(n=>{if(n.ssid&&!seen[n.ssid]){seen[n.ssid]=1;list.push(n);}});
  const el=$('scanlist');
  if(!list.length){el.innerHTML='<div class="muted">no networks found</div>';return;}
  el.innerHTML=list.map(n=>`
    <div class="net">
      <div class="name">${esc(n.ssid)}</div>
      <span class="meta">${n.secure?'&#128274;':'&#128275;'} ${bars(n.quality)}</span>
      <button class="btn sec" style="width:auto;padding:8px 14px"
        onclick='pickNet(${JSON.stringify(n.ssid)},${n.secure?1:0})'>Connect</button>
    </div>
    <div class="pwd" id="pwd_${cssId(n.ssid)}">
      <input type="password" placeholder="Wi-Fi password" id="pi_${cssId(n.ssid)}">
      <button class="btn" onclick='doConnect(${JSON.stringify(n.ssid)})'>Join network</button>
    </div>`).join('');
}
function cssId(s){return btoa(unescape(encodeURIComponent(s))).replace(/[^a-zA-Z0-9]/g,'');}
function pickNet(ssid,secure){
  if(!secure){doConnect(ssid,true);return;}
  document.querySelectorAll('.pwd').forEach(p=>p.classList.remove('show'));
  const p=$('pwd_'+cssId(ssid));if(p){p.classList.add('show');const i=$('pi_'+cssId(ssid));if(i)i.focus();}
}
async function doConnect(ssid,open){
  const pass=open?'':( $('pi_'+cssId(ssid)) ? $('pi_'+cssId(ssid)).value : '');
  toast('Connecting to '+ssid+'…');
  await postForm('/api/connect',{ssid,password:pass});
  await sleep(600);loadNetworks();
}

// ---- SAVED NETWORKS ----
async function loadNetworks(){
  let d; try{ d=await (await fetch('/api/networks')).json(); }catch(e){ return; }
  const el=$('savedlist');const nets=d.networks||[];
  if(!nets.length){el.innerHTML='<div class="muted">none saved yet</div>';return;}
  el.innerHTML=nets.map(n=>`
    <div class="net">
      <div class="name">${esc(n.ssid)}</div>
      ${n.active?'<span class="pill">connected</span>':
        `<button class="btn sec" style="width:auto;padding:8px 14px" onclick='reconnect(${JSON.stringify(n.ssid)})'>Connect</button>`}
      <button class="btn danger" style="width:auto;padding:8px 12px" onclick='forget(${JSON.stringify(n.ssid)})'>Forget</button>
    </div>`).join('');
}
async function reconnect(ssid){toast('Connecting to '+ssid+'…');await postForm('/api/connect',{ssid});await sleep(600);loadNetworks();}
async function forget(ssid){await postForm('/api/forget',{ssid});toast('Removed '+ssid);loadNetworks();}
async function disconnect(){await postForm('/api/disconnect',{});toast('Disconnected');await sleep(400);loadNetworks();}

// ---- SETTINGS ----
async function fillSettings(){
  try{const d=await (await fetch('/api/status')).json();
    $('cfg_backend').value=d.backend||'';
    $('cfg_interval').value=d.interval||30;
    $('cfg_appwd').value='';
    $('cfg_token').placeholder=d.token_set?'•••••• (set — type to replace)':'device token from AgriMind';
  }catch(e){}
}
async function saveSettings(){
  const body={backend:$('cfg_backend').value.trim(),interval:$('cfg_interval').value||30};
  const tk=$('cfg_token').value.trim();if(tk)body.token=tk;
  await postForm('/api/settings',body);toast('Settings saved');$('cfg_token').value='';fillSettings();
}
async function saveAp(){await postForm('/api/settings',{appwd:$('cfg_appwd').value});toast('Hotspot updating…');}

loadStatus();fillSettings();
setInterval(loadStatus,3000);
</script>
</body>
</html>
)PORTAL";
