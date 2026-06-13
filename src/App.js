import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_TRAY = 40;
const MAX_SHELF_TRAYS = 12;
const SESSION_TIMEOUT = 10 * 60 * 1000;

const MODEL_CODES = [
  {code:"IP13",label:"iPhone 13"},{code:"IP13M",label:"iPhone 13 Mini"},{code:"IP13P",label:"iPhone 13 Pro"},{code:"IP13PM",label:"iPhone 13 Pro Max"},
  {code:"IP14",label:"iPhone 14"},{code:"IP14L",label:"iPhone 14 Plus"},{code:"IP14P",label:"iPhone 14 Pro"},{code:"IP14PM",label:"iPhone 14 Pro Max"},
  {code:"IP15",label:"iPhone 15"},{code:"IP15L",label:"iPhone 15 Plus"},{code:"IP15P",label:"iPhone 15 Pro"},{code:"IP15PM",label:"iPhone 15 Pro Max"},
  {code:"IP16",label:"iPhone 16"},{code:"IP16L",label:"iPhone 16 Plus"},{code:"IP16P",label:"iPhone 16 Pro"},{code:"IP16PM",label:"iPhone 16 Pro Max"},
  {code:"SGS22",label:"Galaxy S22"},{code:"SGS22P",label:"Galaxy S22+"},{code:"SGS22U",label:"Galaxy S22 Ultra"},
  {code:"SGS23",label:"Galaxy S23"},{code:"SGS23P",label:"Galaxy S23+"},{code:"SGS23U",label:"Galaxy S23 Ultra"},
  {code:"SGS24",label:"Galaxy S24"},{code:"SGS24P",label:"Galaxy S24+"},{code:"SGS24U",label:"Galaxy S24 Ultra"},
  {code:"SGS25",label:"Galaxy S25"},{code:"SGS25P",label:"Galaxy S25+"},{code:"SGS25U",label:"Galaxy S25 Ultra"},
  {code:"GP7",label:"Pixel 7"},{code:"GP7P",label:"Pixel 7 Pro"},{code:"GP8",label:"Pixel 8"},{code:"GP8P",label:"Pixel 8 Pro"},
  {code:"GP9",label:"Pixel 9"},{code:"GP9P",label:"Pixel 9 Pro"},
];
const COLOUR_CODES = [
  {code:"BK",label:"Black"},{code:"WH",label:"White"},{code:"BL",label:"Blue"},{code:"RD",label:"Red"},
  {code:"GD",label:"Gold"},{code:"SV",label:"Silver"},{code:"PU",label:"Purple"},{code:"GN",label:"Green"},
  {code:"NT",label:"Titanium/Natural"},{code:"YL",label:"Yellow"},{code:"PK",label:"Pink"},{code:"GR",label:"Graphite"},
];
const STORAGE_CODES = [{code:"64",label:"64GB"},{code:"128",label:"128GB"},{code:"256",label:"256GB"},{code:"512",label:"512GB"},{code:"1T",label:"1TB"}];
const SPEC_CODES = [{code:"U",label:"UK"},{code:"G",label:"US/Global"},{code:"J",label:"Japanese"}];
const GRADE_CODES = [{code:"A",label:"Grade A"},{code:"B",label:"Grade B"},{code:"C",label:"Grade C"},{code:"R",label:"Refurb"}];
const GRADE_COLORS = {A:{bg:"#d1fae5",text:"#065f46",border:"#6ee7b7"},B:{bg:"#dbeafe",text:"#1e40af",border:"#93c5fd"},C:{bg:"#fef3c7",text:"#92400e",border:"#fcd34d"},R:{bg:"#ede9fe",text:"#5b21b6",border:"#c4b5fd"}};
const STATUS_COLORS = {"In Stock":{bg:"#d1fae5",text:"#065f46"},"Sold":{bg:"#fee2e2",text:"#991b1b"},"In Repair":{bg:"#fef3c7",text:"#92400e"},"In Transit":{bg:"#dbeafe",text:"#1e40af"}};
const STATUSES = ["In Stock","Sold","In Repair","In Transit"];
const DISPATCH_REASONS = ["Sale","Return to Supplier","Damaged","Lost","Internal Transfer","Other"];
const hashPIN = pin => btoa(pin + "_phonestock_salt");
const nowISO = () => new Date().toISOString();
const fmtDate = iso => new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtGBP = v => isNaN(v)||v===""?"—":`£${parseFloat(v).toFixed(2)}`;
const labelFor = (list,code) => { const f=(list||[]).find(x=>x.code===code); return f?f.label:code||"—"; };
const genId = () => crypto.randomUUID();

// ─── Audio ────────────────────────────────────────────────────────────────────
function useBeep() {
  const ctx = useRef(null);
  const getCtx = () => { if(!ctx.current) ctx.current = new (window.AudioContext||window.webkitAudioContext)(); return ctx.current; };
  const beep = (freq=880,dur=120,type="sine",vol=0.3) => {
    try { const c=getCtx(),o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=freq; o.type=type; g.gain.setValueAtTime(vol,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur/1000); o.start(c.currentTime); o.stop(c.currentTime+dur/1000); } catch {}
  };
  return { success:()=>beep(880,120,"sine",0.3), error:()=>beep(220,200,"sawtooth",0.25) };
}

// ─── Code 128 Barcode ─────────────────────────────────────────────────────────
const C128=(()=>{
  const START_B=104,STOP=106;
  const P=["11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000","11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100","11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010","11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000","11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110","11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010","11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000","10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010","10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110","11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110","10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","11000111010","11"];
  return text=>{ let v=[START_B]; for(let i=0;i<text.length;i++) v.push(text.charCodeAt(i)-32); let c=START_B; for(let i=1;i<v.length;i++) c+=i*v[i]; v.push(c%103); v.push(STOP); return v.map(x=>P[x]).join("")+"1"; };
})();

function Barcode({value,width=280,height=60}) {
  const ref=useRef();
  useEffect(()=>{
    const safe=value.replace(/[^\x20-\x7E]/g,""); if(!safe) return;
    const bars=C128(safe),canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext("2d"),scale=width/bars.length;
    canvas.width=width; canvas.height=height;
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,width,height); ctx.fillStyle="#000";
    for(let i=0;i<bars.length;i++) if(bars[i]==="1") ctx.fillRect(Math.floor(i*scale),0,Math.ceil(scale),height);
  },[value,width,height]);
  return <canvas ref={ref} style={{display:"block",maxWidth:"100%"}}/>;
}

// ─── UI ───────────────────────────────────────────────────────────────────────
const Badge=({label,bg,text,border})=>(<span style={{background:bg,color:text,border:`1px solid ${border||bg}`,borderRadius:6,padding:"2px 9px",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>{label}</span>);
const GradeBadge=({code,allGrades})=>{ const list=allGrades||GRADE_CODES; const found=list.find(g=>g.code===code); const label=found?found.label:`Grade ${code}`; const c=GRADE_COLORS[code]||{bg:"#f1f5f9",text:"#475569",border:"#e2e8f0"}; return <Badge label={label} bg={c.bg} text={c.text} border={c.border}/>; };
const StatusBadge=({status})=>{ const c=STATUS_COLORS[status]||STATUS_COLORS["In Stock"]; return <Badge label={status} bg={c.bg} text={c.text}/>; };
const RoleBadge=({role})=><Badge label={role==="admin"?"👑 Admin":"👤 Staff"} bg={role==="admin"?"#fef3c7":"#eff6ff"} text={role==="admin"?"#92400e":"#1e40af"}/>;

function FillBar({current,max}) {
  const pct=Math.min(100,Math.round((current/max)*100));
  const color=pct>=100?"#ef4444":pct>=80?"#f59e0b":"#10b981";
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,background:"#e2e8f0",borderRadius:99,height:8,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,background:color,height:"100%",borderRadius:99,transition:"width 0.2s"}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color,minWidth:36}}>{current}/{max}</span>
    </div>
  );
}

function productDesc(p,catalog) {
  if(!p) return "—";
  const {allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories}=catalog;
  const parts=[labelFor(allModelCodes,p.model_code),labelFor(allStorageCodes,p.storage_code),labelFor(allColourCodes,p.colour_code),labelFor(allSpecCodes,p.spec_code),labelFor(allGradeCodes,p.grade_code)];
  if(p.category_code) parts.push(labelFor(allCategories,p.category_code));
  return parts.join(" · ");
}

// ─── CatalogSection (outside component to prevent focus loss) ─────────────────
const CatalogSection=({title,items,builtIn,newVal,setNewVal,onAdd,onDelete,codePlaceholder,labelPlaceholder,codeHint})=>{
  const inpS={padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"};
  const rowS={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:8,background:"#f8fafc",marginBottom:6,fontSize:13};
  const codeS={fontFamily:"monospace",fontWeight:700,color:"#1d4ed8",background:"#eff6ff",borderRadius:5,padding:"2px 7px",fontSize:12};
  return (
    <div>
      <div style={{background:"#f8fafc",borderRadius:10,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:"#64748b",marginBottom:8}}>ADD NEW {title.toUpperCase()}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input value={newVal.code} onChange={e=>setNewVal(p=>({...p,code:e.target.value.toUpperCase()}))} placeholder={codePlaceholder} style={{...inpS,width:110}}/>
          <input value={newVal.label} onChange={e=>setNewVal(p=>({...p,label:e.target.value}))} placeholder={labelPlaceholder} style={{...inpS,flex:1,minWidth:160}}/>
          <button onClick={onAdd} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:13}}>+ Add</button>
        </div>
        {codeHint&&<div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>{codeHint}</div>}
      </div>
      {builtIn.length>0&&<><div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:6,letterSpacing:"0.05em"}}>BUILT-IN ({builtIn.length})</div><div style={{maxHeight:150,overflowY:"auto",marginBottom:14}}>{builtIn.map(x=><div key={x.code} style={rowS}><span style={{color:"#475569"}}>{x.label}</span><span style={codeS}>{x.code}</span></div>)}</div></>}
      {items.length>0&&<><div style={{fontSize:11,fontWeight:700,color:"#3b82f6",marginBottom:6,letterSpacing:"0.05em"}}>CUSTOM ({items.length})</div>{items.map(x=><div key={x.code} style={{...rowS,background:"#eff6ff"}}><span style={{fontWeight:600,color:"#1e293b"}}>{x.label}</span><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={codeS}>{x.code}</span><button onClick={()=>onDelete(x.code)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button></div></div>)}</>}
    </div>
  );
};

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [username,setUsername]=useState("");
  const [pin,setPin]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const submit=async()=>{
    if(!username.trim()||!pin.trim()){setErr("Enter username and PIN.");return;}
    setLoading(true); setErr("");
    const hash=hashPIN(pin);
    const {data,error}=await supabase.from("users").select("*").eq("username",username.trim().toLowerCase()).single();
    setLoading(false);
    if(error||!data||data.pin_hash!==hash){setErr("Invalid username or PIN.");setPin("");return;}
    onLogin(data);
  };
  return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:20,padding:40,width:360,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:36,marginBottom:8}}>📱</div><div style={{fontWeight:900,fontSize:22,color:"#0f172a"}}>PhoneStock Pro</div><div style={{fontSize:13,color:"#64748b",marginTop:4}}>Sign in to continue</div></div>
        {err&&<div style={{background:"#fef2f2",color:"#dc2626",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,fontWeight:600}}>⚠️ {err}</div>}
        <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>USERNAME</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="e.g. admin" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:15,marginBottom:14,boxSizing:"border-box"}} autoFocus/>
        <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>PIN</label>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:20,marginBottom:20,boxSizing:"border-box",letterSpacing:"0.3em"}}/>
        <button onClick={submit} disabled={loading} style={{width:"100%",background:"#3b82f6",border:"none",borderRadius:10,padding:"13px",cursor:"pointer",fontWeight:800,color:"#fff",fontSize:15}}>{loading?"Signing in...":"Sign In"}</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null);
  const [tab,setTab]=useState("scanner");
  const [toast,setToast]=useState(null);
  const [loading,setLoading]=useState(true);
  const [shelves,setShelves]=useState([]);
  const [products,setProducts]=useState([]);
  const [trays,setTrays]=useState([]);
  const [devices,setDevices]=useState([]);
  const [history,setHistory]=useState([]);
  const [users,setUsers]=useState([]);
  const [customModelCodes,setCustomModelCodes]=useState([]);
  const [customColourCodes,setCustomColourCodes]=useState([]);
  const [customStorageCodes,setCustomStorageCodes]=useState([]);
  const [customSpecCodes,setCustomSpecCodes]=useState([]);
  const [customGradeCodes,setCustomGradeCodes]=useState([]);
  const [customCategories,setCustomCategories]=useState([]);
  const timeoutRef=useRef();
  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); };
  const resetTimeout=useCallback(()=>{ clearTimeout(timeoutRef.current); timeoutRef.current=setTimeout(()=>{ setSession(null); setTab("scanner"); },SESSION_TIMEOUT); },[]);
  useEffect(()=>{ if(!session) return; resetTimeout(); const evts=["mousedown","keydown","touchstart"]; evts.forEach(e=>window.addEventListener(e,resetTimeout)); return ()=>{ clearTimeout(timeoutRef.current); evts.forEach(e=>window.removeEventListener(e,resetTimeout)); }; },[session,resetTimeout]);

  const loadAll=useCallback(async()=>{
    setLoading(true);
    const [s,p,t,d,h,u,cm,cc,cs,csp,cg,cat]=await Promise.all([
      supabase.from("shelves").select("*").order("name"),
      supabase.from("products").select("*").order("sku"),
      supabase.from("trays").select("*"),
      supabase.from("devices").select("*").order("added_at",{ascending:false}),
      supabase.from("history").select("*").order("at",{ascending:false}).limit(500),
      supabase.from("users").select("*"),
      supabase.from("custom_model_codes").select("*"),
      supabase.from("custom_colour_codes").select("*"),
      supabase.from("custom_storage_codes").select("*"),
      supabase.from("custom_spec_codes").select("*"),
      supabase.from("custom_grade_codes").select("*"),
      supabase.from("custom_categories").select("*"),
    ]);
    setShelves(s.data||[]); setProducts(p.data||[]); setTrays(t.data||[]);
    setDevices(d.data||[]); setHistory(h.data||[]); setUsers(u.data||[]);
    setCustomModelCodes(cm.data||[]); setCustomColourCodes(cc.data||[]);
    setCustomStorageCodes(cs.data||[]); setCustomSpecCodes(csp.data||[]);
    setCustomGradeCodes(cg.data||[]); setCustomCategories(cat.data||[]);
    setLoading(false);
  },[]);

  useEffect(()=>{ if(session) loadAll(); else setLoading(false); },[session,loadAll]);

  // Realtime subscription
  useEffect(()=>{
    if(!session) return;
    const sub=supabase
      .channel("realtime-all")
      .on("postgres_changes",{event:"*",schema:"public",table:"devices"},()=>{ loadAll(); })
      .on("postgres_changes",{event:"*",schema:"public",table:"trays"},()=>{ loadAll(); })
      .on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>{ loadAll(); })
      .on("postgres_changes",{event:"*",schema:"public",table:"shelves"},()=>{ loadAll(); })
      .on("postgres_changes",{event:"*",schema:"public",table:"history"},()=>{ loadAll(); })
      .subscribe();
    return ()=>{ supabase.removeChannel(sub); };
  },[session,loadAll]);

  // Polling fallback — refresh every 8 seconds
  useEffect(()=>{
    if(!session) return;
    const interval=setInterval(()=>{ loadAll(); },8000);
    return ()=>clearInterval(interval);
  },[session,loadAll]);

  const isAdmin=session?.role==="admin";
  const allModelCodes=useMemo(()=>[...MODEL_CODES,...customModelCodes],[customModelCodes]);
  const allColourCodes=useMemo(()=>[...COLOUR_CODES,...customColourCodes],[customColourCodes]);
  const allStorageCodes=useMemo(()=>[...STORAGE_CODES,...customStorageCodes],[customStorageCodes]);
  const allSpecCodes=useMemo(()=>[...SPEC_CODES,...customSpecCodes],[customSpecCodes]);
  const allGradeCodes=useMemo(()=>[...GRADE_CODES,...customGradeCodes],[customGradeCodes]);
  const allCategories=useMemo(()=>[...customCategories],[customCategories]);
  const trayProduct=useMemo(()=>{ const m={}; trays.forEach(t=>{ m[t.id]=products.find(p=>p.id===t.product_id); }); return m; },[trays,products]);
  const trayDevices=useMemo(()=>{ const m={}; trays.forEach(t=>{ m[t.id]=devices.filter(d=>d.tray_id===t.id); }); return m; },[devices,trays]);
  const trayStock=useMemo(()=>{ const m={}; trays.forEach(t=>{ m[t.id]=devices.filter(d=>d.tray_id===t.id&&d.status==="In Stock").length; }); return m; },[devices,trays]);
  const shelfTrays=useMemo(()=>{ const m={}; shelves.forEach(s=>{ m[s.id]=trays.filter(t=>t.shelf_id===s.id); }); return m; },[trays,shelves]);
  const imeiMap=useMemo(()=>{ const m={}; devices.forEach(d=>{ m[d.imei]=d; }); return m; },[devices]);
  const skuSet=useMemo(()=>new Set(products.map(p=>p.sku)),[products]);
  const catalog={allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories};

  if(!session) return <LoginScreen onLogin={u=>{ setSession(u); setTab("scanner"); }}/>;
  if(loading) return <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700}}>Loading PhoneStock...</div>;

  const adminTabs=["scanner","shelves","trays","devices","history","dashboard","admin"];
  const staffTabs=["scanner","devices","history"];
  const availTabs=isAdmin?adminTabs:staffTabs;
  const tabLabels={"scanner":"📡 Scanner","shelves":"🗄 Shelves","trays":"📦 Trays","devices":"📱 Devices","history":"📋 History","dashboard":"📊 Dashboard","admin":"⚙️ Admin"};

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#f1f5f9",minHeight:"100vh"}}>
      {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:toast.type==="error"?"#dc2626":"#10b981",color:"#fff",borderRadius:10,padding:"12px 20px",fontWeight:600,fontSize:14,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",maxWidth:360}}>{toast.type==="error"?"⚠️ ":"✅ "}{toast.msg}</div>}
      <div style={{background:"#0f172a",color:"#fff",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:18,fontWeight:800}}>📱 PhoneStock Pro</div><div style={{fontSize:11,color:"#475569",marginTop:1}}>Warehouse Management</div></div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:13,color:"#94a3b8"}}>📦 {devices.filter(d=>d.status==="In Stock").length} in stock</span>
          <RoleBadge role={session.role}/>
          <span style={{fontSize:13,color:"#60a5fa",fontWeight:600}}>{session.username}</span>
          <button onClick={()=>setSession(null)} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>Log Out</button>
        </div>
      </div>
      <div style={{background:"#1e293b",padding:"0 24px",display:"flex",overflowX:"auto"}}>
        {availTabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",padding:"12px 16px",cursor:"pointer",fontSize:13,fontWeight:tab===t?700:400,color:tab===t?"#60a5fa":"#94a3b8",borderBottom:tab===t?"3px solid #60a5fa":"3px solid transparent",whiteSpace:"nowrap"}}>{tabLabels[t]}</button>)}
      </div>
      <div style={{padding:"20px 24px"}}>
        {tab==="scanner"  &&<ScannerTab devices={devices} trays={trays} trayStock={trayStock} trayProduct={trayProduct} imeiMap={imeiMap} showToast={showToast} session={session} catalog={catalog} loadAll={loadAll}/>}
        {tab==="shelves"  &&isAdmin&&<ShelvesTab shelves={shelves} shelfTrays={shelfTrays} trayStock={trayStock} trayProduct={trayProduct} showToast={showToast} loadAll={loadAll}/>}
        {tab==="trays"    &&isAdmin&&<TraysTab trays={trays} products={products} shelves={shelves} trayStock={trayStock} trayDevices={trayDevices} trayProduct={trayProduct} shelfTrays={shelfTrays} devices={devices} showToast={showToast} catalog={catalog} loadAll={loadAll} session={session}/>}
        {tab==="devices"  &&<DevicesTab devices={devices} trays={trays} shelves={shelves} trayProduct={trayProduct} catalog={catalog}/>}
        {tab==="history"  &&<HistoryTab history={history} devices={devices}/>}
        {tab==="dashboard"&&isAdmin&&<DashboardTab devices={devices} trays={trays} trayStock={trayStock} trayProduct={trayProduct} catalog={catalog}/>}
        {tab==="admin"    &&isAdmin&&<AdminTab users={users} shelves={shelves} products={products} showToast={showToast} session={session} catalog={catalog} skuSet={skuSet} loadAll={loadAll} allModelCodes={allModelCodes} allColourCodes={allColourCodes} allStorageCodes={allStorageCodes} allSpecCodes={allSpecCodes} allGradeCodes={allGradeCodes} allCategories={allCategories}/>}
      </div>
    </div>
  );
}

// ─── SCANNER ──────────────────────────────────────────────────────────────────
function ScannerTab({devices,trays,trayStock,trayProduct,imeiMap,showToast,session,catalog,loadAll}) {
  const beep=useBeep();
  const [phase,setPhase]=useState("idle");
  const [tray,setTray]=useState(null);
  const [input,setInput]=useState("");
  const [scanLog,setScanLog]=useState([]);
  const [queue,setQueue]=useState([]); // used for both intake and dispatch
  const [reason,setReason]=useState("");
  const [lastFeedback,setLastFeedback]=useState(null);
  const inputRef=useRef();
  const product=tray?trayProduct[tray.id]:null;
  const currentTrayStock=useMemo(()=>tray?devices.filter(d=>d.tray_id===tray.id&&d.status==="In Stock").length:0,[devices,tray]);

  useEffect(()=>{ setTimeout(()=>inputRef.current?.focus(),50); },[phase]);
  const fb=(type,msg)=>{ setLastFeedback({type,msg}); setTimeout(()=>setLastFeedback(null),2200); };
  const reset=()=>{ setPhase("idle");setTray(null);setInput("");setScanLog([]);setQueue([]);setReason("");setLastFeedback(null); };

  const handleScan=async()=>{
    const v=input.trim().toUpperCase(); if(!v) return; setInput("");
    setTimeout(()=>inputRef.current?.focus(),30);

    // ── Idle: scan tray SKU ──
    if(phase==="idle"||phase==="mode_select") {
      const found=trays.find(t=>{ const p=trayProduct[t.id]; return p&&p.sku===v; });
      if(!found){ beep.error(); fb("error",`"${v}" not a known tray SKU.`); return; }
      setTray(found); setPhase("mode_select"); beep.success(); fb("success",`Tray ${v} selected.`); return;
    }

    // ── Intake: queue IMEIs ──
    if(phase==="intake") {
      if(!/^\d{15}$/.test(v)){ beep.error(); fb("error","Invalid IMEI — must be 15 digits."); setScanLog(p=>[{imei:v,ok:false,msg:"Invalid format"},...p]); return; }
      if(imeiMap[v]){ beep.error(); fb("error","IMEI already in system."); setScanLog(p=>[{imei:v,ok:false,msg:"Already exists"},...p]); return; }
      if(queue.find(d=>d.imei===v)){ beep.error(); fb("error","Already queued this session."); return; }
      if(currentTrayStock+queue.length>=MAX_TRAY){ beep.error(); fb("error","Tray is full (40/40)."); return; }
      setQueue(p=>[...p,{imei:v}]);
      beep.success(); setScanLog(p=>[{imei:v,ok:true,msg:"Queued"},...p]);
      fb("success",`Queued. ${queue.length+1} to add.`); return;
    }

    // ── Dispatch: queue devices ──
    if(phase==="dispatch") {
      if(!/^\d{15}$/.test(v)){ beep.error(); fb("error","Invalid IMEI — must be 15 digits."); setScanLog(p=>[{imei:v,ok:false,msg:"Invalid format"},...p]); return; }
      const dev=imeiMap[v];
      if(!dev){ beep.error(); fb("error","IMEI not found in system."); setScanLog(p=>[{imei:v,ok:false,msg:"Not in system"},...p]); return; }
      if(dev.tray_id!==tray.id){ const wp=trayProduct[dev.tray_id]; beep.error(); fb("error",`Belongs to ${wp?.sku||"another tray"}.`); setScanLog(p=>[{imei:v,ok:false,msg:`Wrong tray: ${wp?.sku||"?"}`},...p]); return; }
      if(dev.status!=="In Stock"){ beep.error(); fb("error",`Device is ${dev.status}.`); setScanLog(p=>[{imei:v,ok:false,msg:`Status: ${dev.status}`},...p]); return; }
      if(queue.find(d=>d.id===dev.id)){ beep.error(); fb("error","Already queued."); return; }
      setQueue(p=>[...p,dev]);
      beep.success(); setScanLog(p=>[{imei:v,ok:true,msg:"Queued"},...p]);
      fb("success",`Queued. ${queue.length+1} to dispatch.`); return;
    }
  };

  const confirmIntake=async()=>{
    const now=nowISO();
    const newDevices=queue.map(d=>({ id:genId(),imei:d.imei,tray_id:tray.id,status:"In Stock",added_at:now,added_by:session.username }));
    await supabase.from("devices").insert(newDevices);
    await supabase.from("history").insert(newDevices.map(d=>({ id:genId(),device_id:d.id,action:"Added",detail:`Added to tray ${product?.sku}`,by_user:session.username,at:now })));
    await loadAll();
    showToast(`${newDevices.length} device(s) added to ${product?.sku}.`); reset();
  };

  const confirmDispatch=async()=>{
    if(!reason){ showToast("Select a reason.","error"); return; }
    const now=nowISO();
    const ids=queue.map(d=>d.id);
    await supabase.from("devices").update({status:"Sold"}).in("id",ids);
    await supabase.from("history").insert(ids.map(id=>({ id:genId(),device_id:id,action:"Dispatched",detail:`Sold — ${reason}`,by_user:session.username,at:now })));
    await loadAll();
    showToast(`${queue.length} device(s) dispatched.`); reset();
  };

  const modeColor={idle:"#475569",mode_select:"#f59e0b",intake:"#10b981",intake_confirm:"#10b981",dispatch:"#ef4444",dispatch_confirm:"#ef4444"};
  const phaseLabel={
    idle:"Scan a Tray SKU to begin",
    mode_select:`Tray ${product?.sku||""} — Choose mode`,
    intake:`Intake → ${product?.sku||""}`,
    intake_confirm:`Confirm Intake — ${product?.sku||""}`,
    dispatch:`Dispatch → ${product?.sku||""}`,
    dispatch_confirm:`Confirm Dispatch — ${product?.sku||""}`,
  };
  const inputDisabled=phase==="dispatch_confirm"||phase==="intake_confirm";

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:16,alignItems:"start"}}>
      <div>
        <div style={{background:"#0f172a",borderRadius:14,padding:20,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{color:modeColor[phase],fontWeight:800,fontSize:15}}>{phaseLabel[phase]}</div>
            {phase!=="idle"&&<button onClick={reset} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:12}}>↺ Reset</button>}
          </div>

          {product&&(
            <div style={{background:"#1e293b",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:"#60a5fa"}}>{product.sku}</div>
              <div style={{fontSize:13,color:"#94a3b8",flex:1}}>{productDesc(product,catalog)}</div>
              <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{currentTrayStock}<span style={{fontSize:13,color:"#475569"}}>/40</span></div>
            </div>
          )}

          {phase==="mode_select"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>{setPhase("intake");setScanLog([]);setQueue([]);}} style={{background:"#064e3b",border:"2px solid #10b981",borderRadius:12,padding:"18px",cursor:"pointer",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:6}}>📥</div><div style={{fontWeight:800,fontSize:16}}>Intake</div><div style={{fontSize:12,color:"#6ee7b7",marginTop:4}}>Add new stock</div>
              </button>
              <button onClick={()=>{setPhase("dispatch");setScanLog([]);setQueue([]);}} style={{background:"#450a0a",border:"2px solid #ef4444",borderRadius:12,padding:"18px",cursor:"pointer",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:6}}>📤</div><div style={{fontWeight:800,fontSize:16}}>Dispatch</div><div style={{fontSize:12,color:"#fca5a5",marginTop:4}}>Remove stock</div>
              </button>
            </div>
          )}

          {/* Scan input */}
          <div style={{display:"flex",gap:10,marginTop:phase==="mode_select"?10:0}}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&handleScan()}
              placeholder={phase==="idle"?"Scan tray SKU...":phase==="intake"?"Scan IMEI to add...":phase==="dispatch"?"Scan IMEI to dispatch...":""}
              disabled={inputDisabled}
              style={{flex:1,padding:"13px 16px",borderRadius:10,border:`2px solid ${modeColor[phase]}`,fontSize:15,fontFamily:"monospace",background:"#1e293b",color:"#f1f5f9",outline:"none",letterSpacing:"0.05em",opacity:inputDisabled?0.4:1}}/>
            <button onClick={handleScan} disabled={inputDisabled} style={{background:modeColor[phase],border:"none",borderRadius:10,padding:"0 22px",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",opacity:inputDisabled?0.4:1}}>GO</button>
          </div>

          {lastFeedback&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:8,background:lastFeedback.type==="error"?"#450a0a":"#064e3b",color:lastFeedback.type==="error"?"#fca5a5":"#6ee7b7",fontWeight:700,fontSize:14}}>{lastFeedback.type==="error"?"❌":"✅"} {lastFeedback.msg}</div>}

          {/* Counter + Done button */}
          {(phase==="intake"||phase==="dispatch")&&(
            <div style={{marginTop:12,display:"flex",gap:10,alignItems:"center"}}>
              {phase==="intake"&&<div style={{background:"#064e3b",borderRadius:8,padding:"8px 16px",color:"#6ee7b7",fontWeight:700,fontSize:13}}>📥 {queue.length} queued</div>}
              {phase==="dispatch"&&<div style={{background:"#450a0a",borderRadius:8,padding:"8px 16px",color:"#fca5a5",fontWeight:700,fontSize:13}}>📤 {queue.length} queued</div>}
              <button onClick={()=>{ if(!queue.length){showToast("Nothing scanned.","error");return;} setPhase(phase==="intake"?"intake_confirm":"dispatch_confirm"); }}
                style={{marginLeft:"auto",background:phase==="intake"?"#10b981":"#ef4444",border:"none",borderRadius:8,padding:"9px 22px",cursor:"pointer",fontWeight:800,color:"#fff",fontSize:14}}>Done →</button>
            </div>
          )}

          {/* Intake confirm */}
          {phase==="intake_confirm"&&(
            <div style={{marginTop:14}}>
              <div style={{background:"#1e293b",borderRadius:10,padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:"#6ee7b7",marginBottom:10}}>📥 {queue.length} device(s) to add to {product?.sku}</div>
                <div style={{maxHeight:160,overflowY:"auto"}}>{queue.map((d,i)=><div key={i} style={{fontFamily:"monospace",fontSize:13,color:"#e2e8f0",padding:"4px 0",borderBottom:"1px solid #334155"}}>{d.imei}</div>)}</div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setPhase("intake")} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#94a3b8"}}>← Back</button>
                <button onClick={confirmIntake} style={{flex:1,background:"#10b981",border:"none",borderRadius:8,padding:"10px",cursor:"pointer",fontWeight:800,color:"#fff",fontSize:15}}>Confirm Add {queue.length} Device(s)</button>
              </div>
            </div>
          )}

          {/* Dispatch confirm */}
          {phase==="dispatch_confirm"&&(
            <div style={{marginTop:14}}>
              <div style={{background:"#1e293b",borderRadius:10,padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:"#fca5a5",marginBottom:10}}>📤 {queue.length} device(s) to dispatch</div>
                <div style={{maxHeight:160,overflowY:"auto"}}>{queue.map(d=><div key={d.id} style={{fontFamily:"monospace",fontSize:13,color:"#e2e8f0",padding:"4px 0",borderBottom:"1px solid #334155"}}>{d.imei}</div>)}</div>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:"#94a3b8",marginBottom:8}}>SELECT REASON</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {DISPATCH_REASONS.map(r=><button key={r} onClick={()=>setReason(r)} style={{background:reason===r?"#ef4444":"#1e293b",border:`1px solid ${reason===r?"#ef4444":"#334155"}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:600,fontSize:13,color:reason===r?"#fff":"#94a3b8"}}>{r}</button>)}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setPhase("dispatch")} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#94a3b8"}}>← Back</button>
                <button onClick={confirmDispatch} disabled={!reason} style={{flex:1,background:reason?"#ef4444":"#374151",border:"none",borderRadius:8,padding:"10px",cursor:reason?"pointer":"not-allowed",fontWeight:800,color:"#fff",fontSize:15}}>Confirm Dispatch {reason?`— ${reason}`:""}</button>
              </div>
            </div>
          )}
        </div>

        {scanLog.length>0&&(
          <div style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Scan Log — this session</div>
            <div style={{maxHeight:220,overflowY:"auto"}}>
              {scanLog.map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:6,background:s.ok?"#f0fdf4":"#fef2f2",marginBottom:4}}>
                  <span>{s.ok?"✅":"❌"}</span><span style={{fontFamily:"monospace",fontSize:13,flex:1}}>{s.imei}</span><span style={{fontSize:12,color:s.ok?"#065f46":"#dc2626",fontWeight:600}}>{s.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {tray&&(
          <div style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Tray Fill</div>
            <FillBar current={currentTrayStock} max={MAX_TRAY}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3,marginTop:12}}>
              {Array.from({length:MAX_TRAY}).map((_,i)=><div key={i} style={{width:"100%",paddingTop:"100%",borderRadius:3,background:i<currentTrayStock?"#10b981":"#e2e8f0"}}/>)}
            </div>
          </div>
        )}
        <div style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Quick Stats</div>
          {[["In Stock",devices.filter(d=>d.status==="In Stock").length,"#10b981"],["Total Devices",devices.length,"#3b82f6"],["Trays",trays.length,"#f59e0b"]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f1f5f9",fontSize:13}}>
              <span style={{color:"#64748b"}}>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SHELVES ──────────────────────────────────────────────────────────────────
function ShelvesTab({shelves,shelfTrays,trayStock,trayProduct,showToast,loadAll}) {
  const [newName,setNewName]=useState("");
  const [editShelf,setEditShelf]=useState(null);
  const add=async()=>{ if(!newName.trim()) return showToast("Enter name.","error"); if(shelves.find(s=>s.name.toLowerCase()===newName.trim().toLowerCase())) return showToast("Name exists.","error"); await supabase.from("shelves").insert({id:genId(),name:newName.trim()}); setNewName(""); await loadAll(); showToast("Shelf added."); };
  const del=async(id)=>{ if((shelfTrays[id]||[]).length>0) return showToast("Remove trays first.","error"); await supabase.from("shelves").delete().eq("id",id); await loadAll(); showToast("Shelf removed."); };
  const saveEdit=async()=>{ await supabase.from("shelves").update({name:editShelf.name.trim()}).eq("id",editShelf.id); setEditShelf(null); await loadAll(); showToast("Renamed."); };
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="New shelf name" style={{padding:"9px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,width:220}}/>
        <button onClick={add} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontWeight:700,color:"#fff"}}>+ Add Shelf</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
        {shelves.map(shelf=>{
          const trays=shelfTrays[shelf.id]||[]; const totalStock=trays.reduce((s,t)=>s+(trayStock[t.id]||0),0);
          return (
            <div key={shelf.id} style={{background:"#fff",borderRadius:14,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                {editShelf?.id===shelf.id
                  ?<div style={{display:"flex",gap:6,flex:1}}><input value={editShelf.name} onChange={e=>setEditShelf({...editShelf,name:e.target.value})} style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid #3b82f6",fontSize:14}}/><button onClick={saveEdit} style={{background:"#10b981",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:12}}>Save</button><button onClick={()=>setEditShelf(null)} style={{background:"#f1f5f9",border:"none",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:12}}>✕</button></div>
                  :<><div style={{fontWeight:800,fontSize:16}}>🗄 {shelf.name}</div><div style={{display:"flex",gap:6}}><button onClick={()=>setEditShelf({...shelf})} style={{background:"#eff6ff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#2563eb"}}>Rename</button><button onClick={()=>del(shelf.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button></div></>
                }
              </div>
              <div style={{display:"flex",gap:16,marginBottom:12,fontSize:13,color:"#64748b"}}><span>📦 {trays.length}/{MAX_SHELF_TRAYS} trays</span><span>📱 {totalStock} in stock</span></div>
              <FillBar current={trays.length} max={MAX_SHELF_TRAYS}/>
              <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                {Array.from({length:MAX_SHELF_TRAYS}).map((_,i)=>{ const t=trays[i]; const p=t?trayProduct[t.id]:null; const stock=t?trayStock[t.id]||0:0; const pct=t?Math.round((stock/MAX_TRAY)*100):0; const col=!t?"#f1f5f9":pct>=100?"#fee2e2":pct>=80?"#fef3c7":"#d1fae5"; const tc=!t?"#cbd5e1":pct>=100?"#dc2626":pct>=80?"#92400e":"#065f46";
                  return <div key={i} title={p?`${p.sku} (${stock}/40)`:""} style={{background:col,borderRadius:6,padding:"5px 3px",textAlign:"center",fontSize:9,fontWeight:700,color:tc,minHeight:34,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>{p?<><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",textAlign:"center"}}>{p.sku}</div><div>{stock}/40</div></>:<div style={{color:"#cbd5e1"}}>—</div>}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TRAYS ────────────────────────────────────────────────────────────────────
function TraysTab({trays,products,shelves,trayStock,trayDevices,trayProduct,shelfTrays,devices,showToast,catalog,loadAll,session}) {
  const {allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories}=catalog;
  const [showAdd,setShowAdd]=useState(false);
  const [printTray,setPrintTray]=useState(null);
  const [filterShelf,setFilterShelf]=useState("All");
  const [form,setForm]=useState({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",shelfId:""});
  const [matchedProduct,setMatchedProduct]=useState(null);
  const [noMatch,setNoMatch]=useState(false);
  const [clearTray,setClearTray]=useState(null);
  const [clearReason,setClearReason]=useState("");

  useEffect(()=>{
    if(!form.modelCode||!form.storageCode||!form.colourCode||!form.specCode||!form.gradeCode){setMatchedProduct(null);setNoMatch(false);return;}
    const found=products.find(p=>p.model_code===form.modelCode&&p.storage_code===form.storageCode&&p.colour_code===form.colourCode&&p.spec_code===form.specCode&&p.grade_code===form.gradeCode&&(p.category_code||"")===(form.categoryCode||""));
    setMatchedProduct(found||null); setNoMatch(!found);
  },[form,products]);

  const addTray=async()=>{
    if(!matchedProduct) return showToast("No matching product. Create it in Product Catalog first.","error");
    if(!form.shelfId) return showToast("Select a shelf.","error");
    if((shelfTrays[form.shelfId]||[]).length>=MAX_SHELF_TRAYS) return showToast("Shelf is full.","error");
    if(trays.find(t=>t.product_id===matchedProduct.id&&t.shelf_id===form.shelfId)) return showToast(`Tray for ${matchedProduct.sku} already exists on this shelf.`,"error");
    await supabase.from("trays").insert({id:genId(),product_id:matchedProduct.id,shelf_id:form.shelfId});
    await loadAll(); showToast(`Tray for ${matchedProduct.sku} created.`); setShowAdd(false);
    setForm({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",shelfId:""});
  };

  const deleteTray=async(id)=>{ if((trayDevices[id]||[]).some(d=>d.status==="In Stock")) return showToast("Tray has stock. Clear or dispatch first.","error"); await supabase.from("trays").delete().eq("id",id); await loadAll(); showToast("Tray removed."); };

  const confirmClearTray=async()=>{
    if(!clearReason) return showToast("Select a reason.","error");
    const now=nowISO();
    const inStockIds=devices.filter(d=>d.tray_id===clearTray.id&&d.status==="In Stock").map(d=>d.id);
    const p=trayProduct[clearTray.id];
    await supabase.from("devices").update({status:"Sold"}).in("id",inStockIds);
    await supabase.from("history").insert(inStockIds.map(id=>({id:genId(),device_id:id,action:"Tray Cleared",detail:`Audit — ${clearReason} — ${p?.sku||""}`,by_user:session.username,at:now})));
    await loadAll();
    showToast(`Tray ${p?.sku} cleared — ${inStockIds.length} device(s) logged.`);
    setClearTray(null); setClearReason("");
  };

  const filtered=filterShelf==="All"?trays:trays.filter(t=>t.shelf_id===filterShelf);
  const sel=(key,val)=>setForm(f=>({...f,[key]:val}));
  const selStyle={width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14};

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
        <select value={filterShelf} onChange={e=>setFilterShelf(e.target.value)} style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}>
          <option value="All">All Shelves</option>{shelves.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{fontSize:13,color:"#94a3b8"}}>{filtered.length} tray(s)</span>
        <button onClick={()=>setShowAdd(true)} style={{marginLeft:"auto",background:"#3b82f6",border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontWeight:700,color:"#fff"}}>+ New Tray</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {filtered.map(tray=>{
          const p=trayProduct[tray.id]; const shelf=shelves.find(s=>s.id===tray.shelf_id); const stock=trayStock[tray.id]||0;
          return (
            <div key={tray.id} style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div><div style={{fontWeight:800,fontSize:14,fontFamily:"monospace",color:"#0f172a"}}>{p?.sku||"?"}</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>{shelf?.name}</div></div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>setPrintTray(tray)} style={{background:"#eff6ff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#2563eb"}}>🖨</button>
                  {stock>0&&<button onClick={()=>{setClearTray(tray);setClearReason("");}} style={{background:"#fff7ed",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#ea580c"}}>🗑 Clear</button>}
                  <button onClick={()=>deleteTray(tray.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Del</button>
                </div>
              </div>
              <div style={{fontSize:12,color:"#475569",marginBottom:10}}>{productDesc(p,catalog)}</div>
              <FillBar current={stock} max={MAX_TRAY}/>
              {p&&<div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:12,color:"#64748b"}}>
                <span>Cost: {fmtGBP(p.purchase_price)}</span><span>Sale: {fmtGBP(p.sale_price)}</span>
                <span style={{fontWeight:700,color:"#10b981"}}>Val: {fmtGBP(parseFloat(p.sale_price||0)*stock)}</span>
              </div>}
            </div>
          );
        })}
      </div>

      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:18}}>Create New Tray</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[{label:"Model *",key:"modelCode",opts:allModelCodes},{label:"Storage *",key:"storageCode",opts:allStorageCodes},{label:"Colour *",key:"colourCode",opts:allColourCodes},{label:"Spec *",key:"specCode",opts:allSpecCodes},{label:"Grade *",key:"gradeCode",opts:allGradeCodes}].map(f=>(
                <div key={f.key}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>{f.label}</label><select value={form[f.key]} onChange={e=>sel(f.key,e.target.value)} style={selStyle}><option value="">— Select —</option>{f.opts.map(o=><option key={o.code} value={o.code}>{o.label} ({o.code})</option>)}</select></div>
              ))}
              <div><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Category <span style={{fontWeight:400,color:"#94a3b8"}}>(optional)</span></label><select value={form.categoryCode} onChange={e=>sel("categoryCode",e.target.value)} style={selStyle}><option value="">— None —</option>{allCategories.map(c=><option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}</select></div>
            </div>
            {matchedProduct&&<div style={{background:"#f0fdf4",border:"1px solid #6ee7b7",borderRadius:10,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"#065f46",marginBottom:4}}>✅ Product found</div><div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:"#0f172a"}}>{matchedProduct.sku}</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>{productDesc(matchedProduct,catalog)}</div></div>}
            {noMatch&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:13,fontWeight:700,color:"#dc2626",marginBottom:2}}>⚠️ No product found for this combination</div><div style={{fontSize:12,color:"#64748b"}}>Go to <b>Admin → Product Catalog → Products</b> and create it first.</div></div>}
            <div style={{marginBottom:16}}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Shelf *</label><select value={form.shelfId} onChange={e=>sel("shelfId",e.target.value)} style={selStyle}><option value="">— Select Shelf —</option>{shelves.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>{setShowAdd(false);setForm({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",shelfId:""});}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={addTray} disabled={!matchedProduct||!form.shelfId} style={{background:matchedProduct&&form.shelfId?"#3b82f6":"#cbd5e1",border:"none",borderRadius:8,padding:"10px 24px",cursor:matchedProduct&&form.shelfId?"pointer":"not-allowed",fontWeight:700,color:"#fff"}}>Create Tray</button>
            </div>
          </div>
        </div>
      )}

      {printTray&&<PrintModal tray={printTray} shelves={shelves} trayProduct={trayProduct} catalog={catalog} onClose={()=>setPrintTray(null)}/>}

      {clearTray&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:4}}>🗑 Clear Tray</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:18}}><span style={{fontFamily:"monospace",fontWeight:700,color:"#0f172a"}}>{trayProduct[clearTray.id]?.sku}</span> — {trayStock[clearTray.id]||0} device(s) will be marked as Sold and logged.</div>
            <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:13,color:"#92400e",fontWeight:600}}>⚠️ This cannot be undone.</div>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8}}>SELECT AUDIT REASON</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
              {["Stock Count Audit","Write-Off","Batch Sale","Lost Stock","Other"].map(r=><button key={r} onClick={()=>setClearReason(r)} style={{background:clearReason===r?"#ea580c":"#f1f5f9",border:`1px solid ${clearReason===r?"#ea580c":"#e2e8f0"}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:600,fontSize:13,color:clearReason===r?"#fff":"#374151"}}>{r}</button>)}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>{setClearTray(null);setClearReason("");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={confirmClearTray} disabled={!clearReason} style={{background:clearReason?"#ea580c":"#cbd5e1",border:"none",borderRadius:8,padding:"10px 24px",cursor:clearReason?"pointer":"not-allowed",fontWeight:700,color:"#fff"}}>Confirm Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PRINT MODAL ──────────────────────────────────────────────────────────────
function PrintModal({tray,shelves,trayProduct,catalog,onClose}) {
  const p=trayProduct[tray.id]; const shelf=shelves.find(s=>s.id===tray.shelf_id);
  const safeSku=(p?.sku||"").replace(/[^\x20-\x7E]/g,"");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:32,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:20}}>🖨 Print Tray Label</div>
        <div style={{border:"2px solid #1e293b",borderRadius:12,padding:24,textAlign:"center",background:"#fff"}}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6,fontWeight:600,letterSpacing:"0.1em"}}>PHONESTOCK PRO</div>
          <div style={{fontFamily:"monospace",fontSize:26,fontWeight:900,color:"#0f172a",marginBottom:12}}>{p?.sku||"—"}</div>
          {safeSku&&<div style={{display:"flex",justifyContent:"center",marginBottom:8}}><Barcode value={safeSku} width={300} height={65}/></div>}
          <div style={{fontSize:11,fontFamily:"monospace",color:"#475569",marginBottom:12}}>{p?.sku}</div>
          <div style={{fontSize:14,fontWeight:700,color:"#1e293b"}}>{productDesc(p,catalog)}</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:8}}>{shelf?.name} · Max 40 units</div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Close</button>
          <button onClick={()=>window.print()} style={{background:"#0f172a",border:"none",borderRadius:8,padding:"10px 24px",cursor:"pointer",fontWeight:700,color:"#fff"}}>🖨 Print</button>
        </div>
      </div>
    </div>
  );
}

// ─── DEVICES ──────────────────────────────────────────────────────────────────
function DevicesTab({devices,trays,shelves,trayProduct,catalog}) {
  const [search,setSearch]=useState("");
  const [filterStatus,setFilterStatus]=useState("All");
  const [filterTray,setFilterTray]=useState("All");
  const filtered=useMemo(()=>{
    let res=devices; const q=search.toLowerCase();
    if(q) res=res.filter(d=>d.imei.includes(q)||(trayProduct[d.tray_id]?.sku||"").toLowerCase().includes(q));
    if(filterStatus!=="All") res=res.filter(d=>d.status===filterStatus);
    if(filterTray!=="All") res=res.filter(d=>d.tray_id===filterTray);
    return res;
  },[devices,trayProduct,search,filterStatus,filterTray]);
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 IMEI or SKU" style={{flex:"1 1 200px",padding:"9px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}/>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}>
          <option value="All">All Statuses</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTray} onChange={e=>setFilterTray(e.target.value)} style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}>
          <option value="All">All Trays</option>{trays.map(t=>{ const p=trayProduct[t.id]; return <option key={t.id} value={t.id}>{p?.sku||t.id}</option>; })}
        </select>
        <span style={{fontSize:13,color:"#94a3b8",alignSelf:"center"}}>{filtered.length} device(s)</span>
      </div>
      <div style={{background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}>
          <thead><tr style={{background:"#f8fafc"}}>{["IMEI","Tray SKU","Product","Shelf","Grade","Status","Added By","Date"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",borderBottom:"2px solid #e2e8f0",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={8} style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No devices found</td></tr>}
            {filtered.map((dev,i)=>{ const p=trayProduct[dev.tray_id]; const tray=trays.find(t=>t.id===dev.tray_id); const shelf=shelves.find(s=>s.id===tray?.shelf_id); return (
              <tr key={dev.id} style={{background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:13,borderBottom:"1px solid #f1f5f9"}}>{dev.imei}</td>
                <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:12,fontWeight:700,borderBottom:"1px solid #f1f5f9"}}>{p?.sku||"—"}</td>
                <td style={{padding:"9px 12px",fontSize:12,borderBottom:"1px solid #f1f5f9",color:"#475569"}}>{productDesc(p,catalog)}</td>
                <td style={{padding:"9px 12px",fontSize:13,borderBottom:"1px solid #f1f5f9"}}>{shelf?.name||"—"}</td>
                <td style={{padding:"9px 12px",borderBottom:"1px solid #f1f5f9"}}>{p?<GradeBadge code={p.grade_code} allGrades={catalog.allGradeCodes}/>:"—"}</td>
                <td style={{padding:"9px 12px",borderBottom:"1px solid #f1f5f9"}}><StatusBadge status={dev.status}/></td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#3b82f6",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>{dev.added_by||"—"}</td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#94a3b8",borderBottom:"1px solid #f1f5f9",whiteSpace:"nowrap"}}>{fmtDate(dev.added_at)}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function HistoryTab({history,devices}) {
  const [search,setSearch]=useState("");
  const filtered=useMemo(()=>{ const q=search.toLowerCase(); if(!q) return history; return history.filter(h=>h.action?.toLowerCase().includes(q)||h.detail?.toLowerCase().includes(q)||h.by_user?.toLowerCase().includes(q)||devices.find(d=>d.id===h.device_id)?.imei.includes(q)); },[history,devices,search]);
  return (
    <div>
      <div style={{marginBottom:14}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 IMEI, user, action..." style={{padding:"9px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,width:300}}/></div>
      <div style={{background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f8fafc"}}>{["Time","User","IMEI","Action","Detail"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",borderBottom:"2px solid #e2e8f0",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={5} style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No history</td></tr>}
            {filtered.map((h,i)=>{ const dev=devices.find(d=>d.id===h.device_id); return (
              <tr key={h.id} style={{background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 12px",fontSize:12,color:"#94a3b8",borderBottom:"1px solid #f1f5f9",whiteSpace:"nowrap"}}>{fmtDate(h.at)}</td>
                <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,color:"#3b82f6",borderBottom:"1px solid #f1f5f9"}}>{h.by_user||"—"}</td>
                <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:13,borderBottom:"1px solid #f1f5f9"}}>{dev?.imei||"—"}</td>
                <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>{h.action}</td>
                <td style={{padding:"9px 12px",fontSize:13,color:"#475569",borderBottom:"1px solid #f1f5f9"}}>{h.detail}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardTab({devices,trays,trayStock,trayProduct,catalog}) {
  const stats=useMemo(()=>{
    const inStock=devices.filter(d=>d.status==="In Stock");
    const totalCost=inStock.reduce((s,d)=>{ const p=trayProduct[d.tray_id]; return s+(parseFloat(p?.purchase_price)||0); },0);
    const totalSale=inStock.reduce((s,d)=>{ const p=trayProduct[d.tray_id]; return s+(parseFloat(p?.sale_price)||0); },0);
    const byGrade=catalog.allGradeCodes.map(g=>({grade:g.code,label:g.label,count:inStock.filter(d=>trayProduct[d.tray_id]?.grade_code===g.code).length}));
    const bySpec=catalog.allSpecCodes.map(s=>({spec:s.code,label:s.label,count:inStock.filter(d=>trayProduct[d.tray_id]?.spec_code===s.code).length}));
    return {inStock:inStock.length,sold:devices.filter(d=>d.status==="Sold").length,repair:devices.filter(d=>d.status==="In Repair").length,transit:devices.filter(d=>d.status==="In Transit").length,totalCost,totalSale,profit:totalSale-totalCost,byGrade,bySpec,fullTrays:trays.filter(t=>(trayStock[t.id]||0)>=MAX_TRAY),emptyTrays:trays.filter(t=>(trayStock[t.id]||0)===0)};
  },[devices,trays,trayStock,trayProduct,catalog]);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[{l:"In Stock",v:stats.inStock,i:"📦",c:"#10b981"},{l:"Sold",v:stats.sold,i:"📤",c:"#3b82f6"},{l:"In Repair",v:stats.repair,i:"🔧",c:"#f59e0b"},{l:"In Transit",v:stats.transit,i:"🚚",c:"#8b5cf6"}].map(s=>(
          <div key={s.l} style={{background:"#fff",borderRadius:12,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><div style={{fontSize:22}}>{s.i}</div><div style={{fontSize:28,fontWeight:800,color:s.c,marginTop:6}}>{s.v}</div><div style={{fontSize:13,color:"#64748b"}}>{s.l}</div></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[{l:"Stock Cost",v:`£${stats.totalCost.toFixed(2)}`,i:"💷",c:"#6366f1"},{l:"Sale Value",v:`£${stats.totalSale.toFixed(2)}`,i:"💰",c:"#10b981"},{l:"Potential Profit",v:`£${stats.profit.toFixed(2)}`,i:"📈",c:"#f59e0b"}].map(s=>(
          <div key={s.l} style={{background:"#fff",borderRadius:12,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><div style={{fontSize:22}}>{s.i}</div><div style={{fontSize:24,fontWeight:800,color:s.c,marginTop:6}}>{s.v}</div><div style={{fontSize:13,color:"#64748b"}}>{s.l}</div></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>By Grade</div>
          {stats.byGrade.filter(g=>g.count>0).map(g=><div key={g.grade} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><GradeBadge code={g.grade} allGrades={catalog.allGradeCodes}/><span style={{fontWeight:700,fontSize:15}}>{g.count}</span></div>)}
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>By Spec</div>
          {stats.bySpec.filter(s=>s.count>0).map(s=><div key={s.spec} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:"#475569"}}>{s.label}</span><span style={{fontWeight:700,fontSize:15}}>{s.count}</span></div>)}
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>⚠️ Alerts</div>
          {stats.fullTrays.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:600,color:"#dc2626",marginBottom:5}}>FULL ({stats.fullTrays.length})</div>{stats.fullTrays.map(t=>{ const p=trayProduct[t.id]; return <div key={t.id} style={{fontFamily:"monospace",fontSize:12,color:"#dc2626",marginBottom:2}}>{p?.sku||"?"}</div>; })}</div>}
          {stats.emptyTrays.length>0&&<div><div style={{fontSize:12,fontWeight:600,color:"#94a3b8",marginBottom:5}}>EMPTY ({stats.emptyTrays.length})</div>{stats.emptyTrays.map(t=>{ const p=trayProduct[t.id]; return <div key={t.id} style={{fontFamily:"monospace",fontSize:12,color:"#94a3b8",marginBottom:2}}>{p?.sku||"?"}</div>; })}</div>}
          {!stats.fullTrays.length&&!stats.emptyTrays.length&&<div style={{color:"#10b981",fontSize:13}}>✅ All trays healthy</div>}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminTab({users,shelves,products,showToast,session,catalog,skuSet,loadAll,allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories}) {
  const [showAddUser,setShowAddUser]=useState(false);
  const [newUser,setNewUser]=useState({username:"",pin:"",role:"staff"});
  const [changePIN,setChangePIN]=useState(null);
  const [newPIN,setNewPIN]=useState("");
  const [catalogTab,setCatalogTab]=useState("products");
  const [newProduct,setNewProduct]=useState({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",sku:"",purchasePrice:"",salePrice:""});
  const [newModel,setNewModel]=useState({code:"",label:""});
  const [newColour,setNewColour]=useState({code:"",label:""});
  const [newStorage,setNewStorage]=useState({code:"",label:""});
  const [newSpec,setNewSpec]=useState({code:"",label:""});
  const [newGrade,setNewGrade]=useState({code:"",label:""});
  const [newCategory,setNewCategory]=useState({code:"",label:""});

  const addUser=async()=>{ if(!newUser.username.trim()) return showToast("Username required.","error"); if(!/^\d{4,6}$/.test(newUser.pin)) return showToast("PIN must be 4-6 digits.","error"); if(users.find(u=>u.username.toLowerCase()===newUser.username.trim().toLowerCase())) return showToast("Username exists.","error"); const {error}=await supabase.from("users").insert({id:genId(),username:newUser.username.trim().toLowerCase(),pin_hash:hashPIN(newUser.pin),role:newUser.role}); if(error) return showToast(error.message,"error"); await loadAll(); showToast(`User "${newUser.username}" created.`); setShowAddUser(false); setNewUser({username:"",pin:"",role:"staff"}); };
  const deleteUser=async(id)=>{ if(id===session.id) return showToast("Cannot delete yourself.","error"); await supabase.from("users").delete().eq("id",id); await loadAll(); showToast("User removed."); };
  const savePIN=async()=>{ if(!/^\d{4,6}$/.test(newPIN)) return showToast("PIN must be 4-6 digits.","error"); await supabase.from("users").update({pin_hash:hashPIN(newPIN)}).eq("id",changePIN); await loadAll(); showToast("PIN updated."); setChangePIN(null); setNewPIN(""); };

  const addProduct=async()=>{
    const {modelCode,storageCode,colourCode,specCode,gradeCode,sku,purchasePrice,salePrice,categoryCode}=newProduct;
    if(!modelCode||!storageCode||!colourCode||!specCode||!gradeCode) return showToast("Fill all required fields.","error");
    if(!sku.trim()) return showToast("SKU is required.","error");
    const skuClean=sku.trim().toUpperCase();
    if(skuSet.has(skuClean)) return showToast(`SKU "${skuClean}" already exists.`,"error");
    const dupCombo=products.find(p=>p.model_code===modelCode&&p.storage_code===storageCode&&p.colour_code===colourCode&&p.spec_code===specCode&&p.grade_code===gradeCode&&(p.category_code||"")===(categoryCode||""));
    if(dupCombo) return showToast(`This combination already exists as ${dupCombo.sku}.`,"error");
    const {error}=await supabase.from("products").insert({id:genId(),sku:skuClean,model_code:modelCode,storage_code:storageCode,colour_code:colourCode,spec_code:specCode,grade_code:gradeCode,category_code:categoryCode||"",purchase_price:purchasePrice,sale_price:salePrice});
    if(error) return showToast(error.message,"error");
    await loadAll(); showToast(`Product ${skuClean} created.`);
    setNewProduct({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",sku:"",purchasePrice:"",salePrice:""});
  };

  const deleteProduct=async(id)=>{ const {data:usedTrays}=await supabase.from("trays").select("id").eq("product_id",id); if(usedTrays&&usedTrays.length>0) return showToast("Product is used by a tray.","error"); await supabase.from("products").delete().eq("id",id); await loadAll(); showToast("Product removed."); };

  const mkAdd=(table,allList,newVal,setNewVal,label)=>async()=>{ const code=newVal.code.trim().toUpperCase(),lbl=newVal.label.trim(); if(!code||!lbl) return showToast("Code and label required.","error"); if(allList.find(x=>x.code===code)) return showToast(`${label} code already exists.`,"error"); await supabase.from(table).insert({id:genId(),code,label:lbl}); await loadAll(); setNewVal({code:"",label:""}); showToast(`${label} "${lbl}" added.`); };
  const mkDel=(table,label)=>async(code)=>{ await supabase.from(table).delete().eq("code",code); await loadAll(); showToast(`${label} removed.`); };

  const inpS={padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"};
  const selS={width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:"#fff",borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:15}}>👥 Users</div>
            <button onClick={()=>setShowAddUser(true)} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:13}}>+ Add</button>
          </div>
          {users.map(u=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:10,background:"#f8fafc",marginBottom:8}}>
              <div><div style={{fontWeight:700,fontSize:14}}>{u.username} {u.id===session.id&&<span style={{fontSize:11,color:"#94a3b8"}}>(you)</span>}</div><RoleBadge role={u.role}/></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setChangePIN(u.id);setNewPIN("");}} style={{background:"#eff6ff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#2563eb"}}>PIN</button>
                {u.id!==session.id&&<button onClick={()=>deleteUser(u.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button>}
              </div>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>⚙️ System</div>
          {[["Products",products.length],["Shelves",shelves.length],["Session Timeout","10 min"],["Database","Supabase ☁️"],["Realtime Sync","✅ Active"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f1f5f9",fontSize:13}}><span style={{color:"#64748b"}}>{k}</span><span style={{fontWeight:700}}>{v}</span></div>
          ))}
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>📋 Product Catalog</div>
        <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"2px solid #f1f5f9",overflowX:"auto"}}>
          {[["products","📦 Products"],["models","📱 Models"],["colours","🎨 Colours"],["storage","💾 Storage"],["specs","🌍 Specs"],["grades","⭐ Grades"],["categories","📂 Categories"]].map(([t,label])=>(
            <button key={t} onClick={()=>setCatalogTab(t)} style={{background:"none",border:"none",padding:"10px 16px",cursor:"pointer",fontWeight:catalogTab===t?700:500,color:catalogTab===t?"#3b82f6":"#64748b",borderBottom:catalogTab===t?"2px solid #3b82f6":"2px solid transparent",fontSize:13,marginBottom:-2,whiteSpace:"nowrap"}}>{label}</button>
          ))}
        </div>

        {catalogTab==="products"&&(
          <div>
            <div style={{background:"#f8fafc",borderRadius:10,padding:18,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:12,letterSpacing:"0.05em"}}>CREATE NEW PRODUCT</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                {[{label:"Model *",key:"modelCode",opts:allModelCodes},{label:"Storage *",key:"storageCode",opts:allStorageCodes},{label:"Colour *",key:"colourCode",opts:allColourCodes},{label:"Spec *",key:"specCode",opts:allSpecCodes},{label:"Grade *",key:"gradeCode",opts:allGradeCodes}].map(f=>(
                  <div key={f.key}><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>{f.label}</label><select value={newProduct[f.key]} onChange={e=>setNewProduct(p=>({...p,[f.key]:e.target.value}))} style={selS}><option value="">— Select —</option>{f.opts.map(o=><option key={o.code} value={o.code}>{o.label} ({o.code})</option>)}</select></div>
                ))}
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>Category <span style={{fontWeight:400}}>(optional)</span></label><select value={newProduct.categoryCode} onChange={e=>setNewProduct(p=>({...p,categoryCode:e.target.value}))} style={selS}><option value="">— None —</option>{allCategories.map(c=><option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}</select></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>SKU *</label><input value={newProduct.sku} onChange={e=>setNewProduct(p=>({...p,sku:e.target.value.toUpperCase()}))} placeholder="e.g. IP14P128BKU-A" style={{...inpS,width:"100%",fontFamily:"monospace",fontSize:14,fontWeight:700}}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>Purchase £</label><input type="number" value={newProduct.purchasePrice} onChange={e=>setNewProduct(p=>({...p,purchasePrice:e.target.value}))} style={{...inpS,width:"100%"}}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>Sale £</label><input type="number" value={newProduct.salePrice} onChange={e=>setNewProduct(p=>({...p,salePrice:e.target.value}))} style={{...inpS,width:"100%"}}/></div>
                <div style={{display:"flex",alignItems:"flex-end"}}><button onClick={addProduct} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"9px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:13,width:"100%"}}>+ Create</button></div>
              </div>
            </div>
            <div style={{maxHeight:340,overflowY:"auto"}}>
              {products.length===0&&<div style={{textAlign:"center",padding:30,color:"#94a3b8",fontSize:14}}>No products yet.</div>}
              {products.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:10,background:"#f8fafc",marginBottom:8}}>
                  <div style={{flex:1}}><div style={{fontFamily:"monospace",fontWeight:800,fontSize:14,color:"#0f172a"}}>{p.sku}</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>{productDesc(p,catalog)}</div></div>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginLeft:12}}>
                    <div style={{fontSize:12,color:"#64748b",textAlign:"right"}}><div>Cost: {fmtGBP(p.purchase_price)}</div><div>Sale: {fmtGBP(p.sale_price)}</div></div>
                    <button onClick={()=>deleteProduct(p.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {catalogTab==="models"&&<CatalogSection title="Model" items={allModelCodes.filter(m=>!MODEL_CODES.find(b=>b.code===m.code))} builtIn={MODEL_CODES} newVal={newModel} setNewVal={setNewModel} onAdd={mkAdd("custom_model_codes",allModelCodes,newModel,setNewModel,"Model")} onDelete={mkDel("custom_model_codes","Model")} codePlaceholder="e.g. IP17P" labelPlaceholder="e.g. iPhone 17 Pro" codeHint="IP=iPhone, SGS=Samsung Galaxy S, GP=Google Pixel"/>}
        {catalogTab==="colours"&&<CatalogSection title="Colour" items={allColourCodes.filter(c=>!COLOUR_CODES.find(b=>b.code===c.code))} builtIn={COLOUR_CODES} newVal={newColour} setNewVal={setNewColour} onAdd={mkAdd("custom_colour_codes",allColourCodes,newColour,setNewColour,"Colour")} onDelete={mkDel("custom_colour_codes","Colour")} codePlaceholder="e.g. OR" labelPlaceholder="e.g. Orange" codeHint="2-3 letters."/>}
        {catalogTab==="storage"&&<CatalogSection title="Storage" items={allStorageCodes.filter(s=>!STORAGE_CODES.find(b=>b.code===s.code))} builtIn={STORAGE_CODES} newVal={newStorage} setNewVal={setNewStorage} onAdd={mkAdd("custom_storage_codes",allStorageCodes,newStorage,setNewStorage,"Storage")} onDelete={mkDel("custom_storage_codes","Storage")} codePlaceholder="e.g. 2T" labelPlaceholder="e.g. 2TB" codeHint="Keep consistent."/>}
        {catalogTab==="specs"&&<CatalogSection title="Spec" items={allSpecCodes.filter(s=>!SPEC_CODES.find(b=>b.code===s.code))} builtIn={SPEC_CODES} newVal={newSpec} setNewVal={setNewSpec} onAdd={mkAdd("custom_spec_codes",allSpecCodes,newSpec,setNewSpec,"Spec")} onDelete={mkDel("custom_spec_codes","Spec")} codePlaceholder="e.g. E" labelPlaceholder="e.g. European" codeHint="U=UK, G=US/Global, J=Japanese"/>}
        {catalogTab==="grades"&&<CatalogSection title="Grade" items={allGradeCodes.filter(g=>!GRADE_CODES.find(b=>b.code===g.code))} builtIn={GRADE_CODES} newVal={newGrade} setNewVal={setNewGrade} onAdd={mkAdd("custom_grade_codes",allGradeCodes,newGrade,setNewGrade,"Grade")} onDelete={mkDel("custom_grade_codes","Grade")} codePlaceholder="e.g. S" labelPlaceholder="e.g. Sealed" codeHint="A, B, C, R are built-in."/>}
        {catalogTab==="categories"&&<CatalogSection title="Category" items={allCategories} builtIn={[]} newVal={newCategory} setNewVal={setNewCategory} onAdd={mkAdd("custom_categories",allCategories,newCategory,setNewCategory,"Category")} onDelete={mkDel("custom_categories","Category")} codePlaceholder="e.g. MC" labelPlaceholder="e.g. Matching Color" codeHint="Used to differentiate product variants."/>}
      </div>

      {showAddUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:360,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:20}}>Add User</div>
            {[{label:"Username",key:"username",type:"text"},{label:"PIN (4-6 digits)",key:"pin",type:"password"}].map(f=>(
              <div key={f.key} style={{marginBottom:14}}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>{f.label}</label><input type={f.type} value={newUser[f.key]} onChange={e=>setNewUser(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:15,boxSizing:"border-box"}}/></div>
            ))}
            <div style={{marginBottom:20}}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Role</label><select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAddUser(false)} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={addUser} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"10px 22px",cursor:"pointer",fontWeight:700,color:"#fff"}}>Create</button>
            </div>
          </div>
        </div>
      )}
      {changePIN&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:320,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>Change PIN</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>User: <b>{users.find(u=>u.id===changePIN)?.username}</b></div>
            <input type="password" value={newPIN} onChange={e=>setNewPIN(e.target.value)} placeholder="New PIN" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:20,letterSpacing:"0.3em",marginBottom:18,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setChangePIN(null)} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={savePIN} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontWeight:700,color:"#fff"}}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_TRAY = 40;
const MAX_SHELF_TRAYS = 12;
const SESSION_TIMEOUT = 10 * 60 * 1000;

const MODEL_CODES = [
  {code:"IP13",label:"iPhone 13"},{code:"IP13M",label:"iPhone 13 Mini"},{code:"IP13P",label:"iPhone 13 Pro"},{code:"IP13PM",label:"iPhone 13 Pro Max"},
  {code:"IP14",label:"iPhone 14"},{code:"IP14L",label:"iPhone 14 Plus"},{code:"IP14P",label:"iPhone 14 Pro"},{code:"IP14PM",label:"iPhone 14 Pro Max"},
  {code:"IP15",label:"iPhone 15"},{code:"IP15L",label:"iPhone 15 Plus"},{code:"IP15P",label:"iPhone 15 Pro"},{code:"IP15PM",label:"iPhone 15 Pro Max"},
  {code:"IP16",label:"iPhone 16"},{code:"IP16L",label:"iPhone 16 Plus"},{code:"IP16P",label:"iPhone 16 Pro"},{code:"IP16PM",label:"iPhone 16 Pro Max"},
  {code:"SGS22",label:"Galaxy S22"},{code:"SGS22P",label:"Galaxy S22+"},{code:"SGS22U",label:"Galaxy S22 Ultra"},
  {code:"SGS23",label:"Galaxy S23"},{code:"SGS23P",label:"Galaxy S23+"},{code:"SGS23U",label:"Galaxy S23 Ultra"},
  {code:"SGS24",label:"Galaxy S24"},{code:"SGS24P",label:"Galaxy S24+"},{code:"SGS24U",label:"Galaxy S24 Ultra"},
  {code:"SGS25",label:"Galaxy S25"},{code:"SGS25P",label:"Galaxy S25+"},{code:"SGS25U",label:"Galaxy S25 Ultra"},
  {code:"GP7",label:"Pixel 7"},{code:"GP7P",label:"Pixel 7 Pro"},{code:"GP8",label:"Pixel 8"},{code:"GP8P",label:"Pixel 8 Pro"},
  {code:"GP9",label:"Pixel 9"},{code:"GP9P",label:"Pixel 9 Pro"},
];
const COLOUR_CODES = [
  {code:"BK",label:"Black"},{code:"WH",label:"White"},{code:"BL",label:"Blue"},{code:"RD",label:"Red"},
  {code:"GD",label:"Gold"},{code:"SV",label:"Silver"},{code:"PU",label:"Purple"},{code:"GN",label:"Green"},
  {code:"NT",label:"Titanium/Natural"},{code:"YL",label:"Yellow"},{code:"PK",label:"Pink"},{code:"GR",label:"Graphite"},
];
const STORAGE_CODES = [{code:"64",label:"64GB"},{code:"128",label:"128GB"},{code:"256",label:"256GB"},{code:"512",label:"512GB"},{code:"1T",label:"1TB"}];
const SPEC_CODES = [{code:"U",label:"UK"},{code:"G",label:"US/Global"},{code:"J",label:"Japanese"}];
const GRADE_CODES = [{code:"A",label:"Grade A"},{code:"B",label:"Grade B"},{code:"C",label:"Grade C"},{code:"R",label:"Refurb"}];
const GRADE_COLORS = {A:{bg:"#d1fae5",text:"#065f46",border:"#6ee7b7"},B:{bg:"#dbeafe",text:"#1e40af",border:"#93c5fd"},C:{bg:"#fef3c7",text:"#92400e",border:"#fcd34d"},R:{bg:"#ede9fe",text:"#5b21b6",border:"#c4b5fd"}};
const STATUS_COLORS = {"In Stock":{bg:"#d1fae5",text:"#065f46"},"Sold":{bg:"#fee2e2",text:"#991b1b"},"In Repair":{bg:"#fef3c7",text:"#92400e"},"In Transit":{bg:"#dbeafe",text:"#1e40af"}};
const STATUSES = ["In Stock","Sold","In Repair","In Transit"];
const DISPATCH_REASONS = ["Sale","Return to Supplier","Damaged","Lost","Internal Transfer","Other"];
const hashPIN = pin => btoa(pin + "_phonestock_salt");
const nowISO = () => new Date().toISOString();
const fmtDate = iso => new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtGBP = v => isNaN(v)||v===""?"—":`£${parseFloat(v).toFixed(2)}`;
const labelFor = (list,code) => { const f=(list||[]).find(x=>x.code===code); return f?f.label:code||"—"; };
const genId = () => crypto.randomUUID();

// ─── Audio ────────────────────────────────────────────────────────────────────
function useBeep() {
  const ctx = useRef(null);
  const getCtx = () => { if(!ctx.current) ctx.current = new (window.AudioContext||window.webkitAudioContext)(); return ctx.current; };
  const beep = (freq=880,dur=120,type="sine",vol=0.3) => {
    try { const c=getCtx(),o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=freq; o.type=type; g.gain.setValueAtTime(vol,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur/1000); o.start(c.currentTime); o.stop(c.currentTime+dur/1000); } catch {}
  };
  return { success:()=>beep(880,120,"sine",0.3), error:()=>beep(220,200,"sawtooth",0.25) };
}

// ─── Code 128 Barcode ─────────────────────────────────────────────────────────
const C128=(()=>{
  const START_B=104,STOP=106;
  const P=["11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000","11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100","11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010","11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000","11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110","11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010","11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000","10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010","10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110","11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110","10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","11000111010","11"];
  return text=>{ let v=[START_B]; for(let i=0;i<text.length;i++) v.push(text.charCodeAt(i)-32); let c=START_B; for(let i=1;i<v.length;i++) c+=i*v[i]; v.push(c%103); v.push(STOP); return v.map(x=>P[x]).join("")+"1"; };
})();

function Barcode({value,width=280,height=60}) {
  const ref=useRef();
  useEffect(()=>{
    const safe=value.replace(/[^\x20-\x7E]/g,""); if(!safe) return;
    const bars=C128(safe),canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext("2d"),scale=width/bars.length;
    canvas.width=width; canvas.height=height;
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,width,height); ctx.fillStyle="#000";
    for(let i=0;i<bars.length;i++) if(bars[i]==="1") ctx.fillRect(Math.floor(i*scale),0,Math.ceil(scale),height);
  },[value,width,height]);
  return <canvas ref={ref} style={{display:"block",maxWidth:"100%"}}/>;
}

// ─── UI Components ────────────────────────────────────────────────────────────
const Badge=({label,bg,text,border})=>(<span style={{background:bg,color:text,border:`1px solid ${border||bg}`,borderRadius:6,padding:"2px 9px",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>{label}</span>);
const GradeBadge=({code,allGrades})=>{ const list=allGrades||GRADE_CODES; const found=list.find(g=>g.code===code); const label=found?found.label:`Grade ${code}`; const c=GRADE_COLORS[code]||{bg:"#f1f5f9",text:"#475569",border:"#e2e8f0"}; return <Badge label={label} bg={c.bg} text={c.text} border={c.border}/>; };
const StatusBadge=({status})=>{ const c=STATUS_COLORS[status]||STATUS_COLORS["In Stock"]; return <Badge label={status} bg={c.bg} text={c.text}/>; };
const RoleBadge=({role})=><Badge label={role==="admin"?"👑 Admin":"👤 Staff"} bg={role==="admin"?"#fef3c7":"#eff6ff"} text={role==="admin"?"#92400e":"#1e40af"}/>;

function FillBar({current,max}) {
  const pct=Math.min(100,Math.round((current/max)*100));
  const color=pct>=100?"#ef4444":pct>=80?"#f59e0b":"#10b981";
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,background:"#e2e8f0",borderRadius:99,height:8,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,background:color,height:"100%",borderRadius:99,transition:"width 0.2s"}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color,minWidth:36}}>{current}/{max}</span>
    </div>
  );
}

function productDesc(p, catalog) {
  if(!p) return "—";
  const {allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories}=catalog;
  const parts=[labelFor(allModelCodes,p.model_code),labelFor(allStorageCodes,p.storage_code),labelFor(allColourCodes,p.colour_code),labelFor(allSpecCodes,p.spec_code),labelFor(allGradeCodes,p.grade_code)];
  if(p.category_code) parts.push(labelFor(allCategories,p.category_code));
  return parts.join(" · ");
}

// ─── Stable CatalogSection ────────────────────────────────────────────────────
const CatalogSection = ({title,items,builtIn,newVal,setNewVal,onAdd,onDelete,codePlaceholder,labelPlaceholder,codeHint}) => {
  const inpS={padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"};
  const rowS={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:8,background:"#f8fafc",marginBottom:6,fontSize:13};
  const codeS={fontFamily:"monospace",fontWeight:700,color:"#1d4ed8",background:"#eff6ff",borderRadius:5,padding:"2px 7px",fontSize:12};
  return (
    <div>
      <div style={{background:"#f8fafc",borderRadius:10,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:"#64748b",marginBottom:8}}>ADD NEW {title.toUpperCase()}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input value={newVal.code} onChange={e=>setNewVal(p=>({...p,code:e.target.value.toUpperCase()}))} placeholder={codePlaceholder} style={{...inpS,width:110}}/>
          <input value={newVal.label} onChange={e=>setNewVal(p=>({...p,label:e.target.value}))} placeholder={labelPlaceholder} style={{...inpS,flex:1,minWidth:160}}/>
          <button onClick={onAdd} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:13}}>+ Add</button>
        </div>
        {codeHint&&<div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>{codeHint}</div>}
      </div>
      {builtIn.length>0&&<><div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:6,letterSpacing:"0.05em"}}>BUILT-IN ({builtIn.length})</div><div style={{maxHeight:150,overflowY:"auto",marginBottom:14}}>{builtIn.map(x=><div key={x.code} style={rowS}><span style={{color:"#475569"}}>{x.label}</span><span style={codeS}>{x.code}</span></div>)}</div></>}
      {items.length>0&&<><div style={{fontSize:11,fontWeight:700,color:"#3b82f6",marginBottom:6,letterSpacing:"0.05em"}}>CUSTOM ({items.length})</div>{items.map(x=><div key={x.code} style={{...rowS,background:"#eff6ff"}}><span style={{fontWeight:600,color:"#1e293b"}}>{x.label}</span><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={codeS}>{x.code}</span><button onClick={()=>onDelete(x.code)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button></div></div>)}</>}
    </div>
  );
};

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [username,setUsername]=useState("");
  const [pin,setPin]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const submit=async()=>{
    if(!username.trim()||!pin.trim()){setErr("Enter username and PIN.");return;}
    setLoading(true); setErr("");
    const {data,error}=await supabase.from("users").select("*").eq("username",username.trim().toLowerCase()).eq("pin_hash",hashPIN(pin)).single();
    setLoading(false);
    if(error||!data){setErr("Invalid username or PIN.");setPin("");return;}
    onLogin(data);
  };

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:20,padding:40,width:360,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:36,marginBottom:8}}>📱</div><div style={{fontWeight:900,fontSize:22,color:"#0f172a"}}>PhoneStock Pro</div><div style={{fontSize:13,color:"#64748b",marginTop:4}}>Sign in to continue</div></div>
        {err&&<div style={{background:"#fef2f2",color:"#dc2626",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,fontWeight:600}}>⚠️ {err}</div>}
        <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>USERNAME</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="e.g. admin" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:15,marginBottom:14,boxSizing:"border-box"}} autoFocus/>
        <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>PIN</label>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:20,marginBottom:20,boxSizing:"border-box",letterSpacing:"0.3em"}}/>
        <button onClick={submit} disabled={loading} style={{width:"100%",background:"#3b82f6",border:"none",borderRadius:10,padding:"13px",cursor:"pointer",fontWeight:800,color:"#fff",fontSize:15}}>{loading?"Signing in...":"Sign In"}</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null);
  const [tab,setTab]=useState("scanner");
  const [toast,setToast]=useState(null);
  const [loading,setLoading]=useState(true);

  // All data from Supabase
  const [shelves,setShelves]=useState([]);
  const [products,setProducts]=useState([]);
  const [trays,setTrays]=useState([]);
  const [devices,setDevices]=useState([]);
  const [history,setHistory]=useState([]);
  const [users,setUsers]=useState([]);
  const [customModelCodes,setCustomModelCodes]=useState([]);
  const [customColourCodes,setCustomColourCodes]=useState([]);
  const [customStorageCodes,setCustomStorageCodes]=useState([]);
  const [customSpecCodes,setCustomSpecCodes]=useState([]);
  const [customGradeCodes,setCustomGradeCodes]=useState([]);
  const [customCategories,setCustomCategories]=useState([]);

  const timeoutRef=useRef();
  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const resetTimeout=useCallback(()=>{
    clearTimeout(timeoutRef.current);
    timeoutRef.current=setTimeout(()=>{ setSession(null); setTab("scanner"); },SESSION_TIMEOUT);
  },[]);

  useEffect(()=>{
    if(!session) return;
    resetTimeout();
    const evts=["mousedown","keydown","touchstart"];
    evts.forEach(e=>window.addEventListener(e,resetTimeout));
    return ()=>{ clearTimeout(timeoutRef.current); evts.forEach(e=>window.removeEventListener(e,resetTimeout)); };
  },[session,resetTimeout]);

  // Load all data
  const loadAll=useCallback(async()=>{
    setLoading(true);
    const [s,p,t,d,h,u,cm,cc,cs,csp,cg,cat]=await Promise.all([
      supabase.from("shelves").select("*").order("name"),
      supabase.from("products").select("*").order("sku"),
      supabase.from("trays").select("*"),
      supabase.from("devices").select("*").order("added_at",{ascending:false}),
      supabase.from("history").select("*").order("at",{ascending:false}).limit(500),
      supabase.from("users").select("*"),
      supabase.from("custom_model_codes").select("*"),
      supabase.from("custom_colour_codes").select("*"),
      supabase.from("custom_storage_codes").select("*"),
      supabase.from("custom_spec_codes").select("*"),
      supabase.from("custom_grade_codes").select("*"),
      supabase.from("custom_categories").select("*"),
    ]);
    setShelves(s.data||[]); setProducts(p.data||[]); setTrays(t.data||[]);
    setDevices(d.data||[]); setHistory(h.data||[]); setUsers(u.data||[]);
    setCustomModelCodes(cm.data||[]); setCustomColourCodes(cc.data||[]);
    setCustomStorageCodes(cs.data||[]); setCustomSpecCodes(csp.data||[]);
    setCustomGradeCodes(cg.data||[]); setCustomCategories(cat.data||[]);
    setLoading(false);
  },[]);

  useEffect(()=>{ if(session) loadAll(); else setLoading(false); },[session,loadAll]);

  // Realtime subscriptions
  useEffect(()=>{
    if(!session) return;
    const sub=supabase.channel("realtime-all")
      .on("postgres_changes",{event:"*",schema:"public"},(payload)=>{ loadAll(); })
      .subscribe();
    return ()=>{ supabase.removeChannel(sub); };
  },[session,loadAll]);

  const isAdmin=session?.role==="admin";
  const allModelCodes=useMemo(()=>[...MODEL_CODES,...customModelCodes],[customModelCodes]);
  const allColourCodes=useMemo(()=>[...COLOUR_CODES,...customColourCodes],[customColourCodes]);
  const allStorageCodes=useMemo(()=>[...STORAGE_CODES,...customStorageCodes],[customStorageCodes]);
  const allSpecCodes=useMemo(()=>[...SPEC_CODES,...customSpecCodes],[customSpecCodes]);
  const allGradeCodes=useMemo(()=>[...GRADE_CODES,...customGradeCodes],[customGradeCodes]);
  const allCategories=useMemo(()=>[...customCategories],[customCategories]);

  const trayProduct=useMemo(()=>{ const m={}; trays.forEach(t=>{ m[t.id]=products.find(p=>p.id===t.product_id); }); return m; },[trays,products]);
  const trayDevices=useMemo(()=>{ const m={}; trays.forEach(t=>{ m[t.id]=devices.filter(d=>d.tray_id===t.id); }); return m; },[devices,trays]);
  const trayStock=useMemo(()=>{ const m={}; trays.forEach(t=>{ m[t.id]=devices.filter(d=>d.tray_id===t.id&&d.status==="In Stock").length; }); return m; },[devices,trays]);
  const shelfTrays=useMemo(()=>{ const m={}; shelves.forEach(s=>{ m[s.id]=trays.filter(t=>t.shelf_id===s.id); }); return m; },[trays,shelves]);
  const imeiMap=useMemo(()=>{ const m={}; devices.forEach(d=>{ m[d.imei]=d; }); return m; },[devices]);
  const skuSet=useMemo(()=>new Set(products.map(p=>p.sku)),[products]);

  const logAction=async(deviceId,action,detail,by)=>{
    await supabase.from("history").insert({id:genId(),device_id:deviceId,action,detail,by_user:by||session?.username||"?",at:nowISO()});
  };

  const catalog={allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories};

  if(!session) return <LoginScreen onLogin={u=>{ setSession(u); setTab("scanner"); }}/>;

  if(loading) return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700}}>
      Loading PhoneStock...
    </div>
  );

  const adminTabs=["scanner","shelves","trays","devices","history","dashboard","admin"];
  const staffTabs=["scanner","devices","history"];
  const availTabs=isAdmin?adminTabs:staffTabs;
  const tabLabels={"scanner":"📡 Scanner","shelves":"🗄 Shelves","trays":"📦 Trays","devices":"📱 Devices","history":"📋 History","dashboard":"📊 Dashboard","admin":"⚙️ Admin"};

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#f1f5f9",minHeight:"100vh"}}>
      {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:toast.type==="error"?"#dc2626":"#10b981",color:"#fff",borderRadius:10,padding:"12px 20px",fontWeight:600,fontSize:14,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",maxWidth:360}}>{toast.type==="error"?"⚠️ ":"✅ "}{toast.msg}</div>}
      <div style={{background:"#0f172a",color:"#fff",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:18,fontWeight:800}}>📱 PhoneStock Pro</div><div style={{fontSize:11,color:"#475569",marginTop:1}}>Warehouse Management</div></div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:13,color:"#94a3b8"}}>📦 {devices.filter(d=>d.status==="In Stock").length} in stock</span>
          <RoleBadge role={session.role}/>
          <span style={{fontSize:13,color:"#60a5fa",fontWeight:600}}>{session.username}</span>
          <button onClick={()=>setSession(null)} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>Log Out</button>
        </div>
      </div>
      <div style={{background:"#1e293b",padding:"0 24px",display:"flex",overflowX:"auto"}}>
        {availTabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",padding:"12px 16px",cursor:"pointer",fontSize:13,fontWeight:tab===t?700:400,color:tab===t?"#60a5fa":"#94a3b8",borderBottom:tab===t?"3px solid #60a5fa":"3px solid transparent",whiteSpace:"nowrap"}}>{tabLabels[t]}</button>
        ))}
      </div>
      <div style={{padding:"20px 24px"}}>
        {tab==="scanner"  &&<ScannerTab devices={devices} trays={trays} trayStock={trayStock} trayProduct={trayProduct} imeiMap={imeiMap} showToast={showToast} logAction={logAction} session={session} catalog={catalog} loadAll={loadAll}/>}
        {tab==="shelves"  &&isAdmin&&<ShelvesTab shelves={shelves} shelfTrays={shelfTrays} trayStock={trayStock} trayProduct={trayProduct} showToast={showToast} loadAll={loadAll}/>}
        {tab==="trays"    &&isAdmin&&<TraysTab trays={trays} products={products} shelves={shelves} trayStock={trayStock} trayDevices={trayDevices} trayProduct={trayProduct} shelfTrays={shelfTrays} devices={devices} showToast={showToast} catalog={catalog} loadAll={loadAll} session={session}/>}
        {tab==="devices"  &&<DevicesTab devices={devices} trays={trays} shelves={shelves} trayProduct={trayProduct} catalog={catalog}/>}
        {tab==="history"  &&<HistoryTab history={history} devices={devices}/>}
        {tab==="dashboard"&&isAdmin&&<DashboardTab devices={devices} trays={trays} trayStock={trayStock} trayProduct={trayProduct} catalog={catalog}/>}
        {tab==="admin"    &&isAdmin&&<AdminTab users={users} shelves={shelves} products={products} showToast={showToast} session={session} catalog={catalog} skuSet={skuSet} loadAll={loadAll}/>}
      </div>
    </div>
  );
}

// ─── SCANNER ──────────────────────────────────────────────────────────────────
function ScannerTab({devices,trays,trayStock,trayProduct,imeiMap,showToast,logAction,session,catalog,loadAll}) {
  const beep=useBeep();
  const [phase,setPhase]=useState("idle");
  const [tray,setTray]=useState(null);
  const [input,setInput]=useState("");
  const [scanLog,setScanLog]=useState([]);
  const [dispatchQueue,setDispatchQueue]=useState([]);
  const [reason,setReason]=useState("");
  const [lastFeedback,setLastFeedback]=useState(null);
  const inputRef=useRef();

  const product=tray?trayProduct[tray.id]:null;
  const currentTrayStock=useMemo(()=>tray?devices.filter(d=>d.tray_id===tray.id&&d.status==="In Stock").length:0,[devices,tray]);
  const intakeCount=scanLog.filter(s=>s.ok).length;

  useEffect(()=>{ setTimeout(()=>inputRef.current?.focus(),50); },[phase]);

  const fb=(type,msg)=>{ setLastFeedback({type,msg}); setTimeout(()=>setLastFeedback(null),2200); };
  const reset=()=>{ setPhase("idle");setTray(null);setInput("");setScanLog([]);setDispatchQueue([]);setReason("");setLastFeedback(null); };

  const handleScan=async()=>{
    const v=input.trim().toUpperCase(); if(!v) return; setInput("");
    setTimeout(()=>inputRef.current?.focus(),30);

    if(phase==="idle"||phase==="mode_select") {
      const found=trays.find(t=>{ const p=trayProduct[t.id]; return p&&p.sku===v; });
      if(!found){ beep.error(); fb("error",`"${v}" not a known tray SKU.`); return; }
      setTray(found); setPhase("mode_select"); beep.success(); fb("success",`Tray ${v} selected.`); return;
    }

    if(phase==="intake") {
      if(!/^\d{15}$/.test(v)){ beep.error(); fb("error","Invalid IMEI — must be 15 digits."); setScanLog(p=>[{imei:v,ok:false,msg:"Invalid format"},...p]); return; }
      if(imeiMap[v]){ beep.error(); fb("error","IMEI already in system."); setScanLog(p=>[{imei:v,ok:false,msg:"Already exists"},...p]); return; }
      if(currentTrayStock+intakeCount>=MAX_TRAY){ beep.error(); fb("error","Tray is full (40/40)."); return; }
      const now=nowISO();
      const {error}=await supabase.from("devices").insert({id:genId(),imei:v,tray_id:tray.id,status:"In Stock",added_at:now,added_by:session.username});
      if(error){ beep.error(); fb("error","DB error: "+error.message); return; }
      await supabase.from("history").insert({id:genId(),device_id:null,action:"Added",detail:`Added to tray ${product?.sku}`,by_user:session.username,at:now});
      await loadAll();
      beep.success(); setScanLog(p=>[{imei:v,ok:true,msg:"Added"},...p]);
      fb("success",`Added. Tray total: ${currentTrayStock+intakeCount+1}`); return;
    }

    if(phase==="dispatch") {
      if(!/^\d{15}$/.test(v)){ beep.error(); fb("error","Invalid IMEI — must be 15 digits."); setScanLog(p=>[{imei:v,ok:false,msg:"Invalid format"},...p]); return; }
      const dev=imeiMap[v];
      if(!dev){ beep.error(); fb("error","IMEI not found in system."); setScanLog(p=>[{imei:v,ok:false,msg:"Not in system"},...p]); return; }
      if(dev.tray_id!==tray.id){ const wp=trayProduct[dev.tray_id]; beep.error(); fb("error",`Belongs to ${wp?.sku||"another tray"}.`); setScanLog(p=>[{imei:v,ok:false,msg:`Wrong tray: ${wp?.sku||"?"}`},...p]); return; }
      if(dev.status!=="In Stock"){ beep.error(); fb("error",`Device is ${dev.status}.`); setScanLog(p=>[{imei:v,ok:false,msg:`Status: ${dev.status}`},...p]); return; }
      if(dispatchQueue.find(d=>d.id===dev.id)){ beep.error(); fb("error","Already queued."); return; }
      setDispatchQueue(p=>[...p,dev]);
      beep.success(); setScanLog(p=>[{imei:v,ok:true,msg:"Queued"},...p]);
      fb("success",`Queued. ${dispatchQueue.length+1} to dispatch.`); return;
    }
  };

  const confirmDispatch=async()=>{
    if(!reason){ showToast("Select a reason.","error"); return; }
    const now=nowISO();
    const ids=dispatchQueue.map(d=>d.id);
    await supabase.from("devices").update({status:"Sold"}).in("id",ids);
    await supabase.from("history").insert(ids.map(id=>({id:genId(),device_id:id,action:"Dispatched",detail:`Sold — ${reason}`,by_user:session.username,at:now})));
    await loadAll();
    showToast(`${dispatchQueue.length} device(s) dispatched.`); reset();
  };

  const modeColor={idle:"#475569",mode_select:"#f59e0b",intake:"#10b981",dispatch:"#ef4444",dispatch_confirm:"#ef4444"};
  const phaseLabel={idle:"Scan a Tray SKU to begin",mode_select:`Tray ${product?.sku||""} — Choose mode`,intake:`Intake → ${product?.sku||""}`,dispatch:`Dispatch → ${product?.sku||""}`,dispatch_confirm:`Confirm Dispatch — ${product?.sku||""}`};

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:16,alignItems:"start"}}>
      <div>
        <div style={{background:"#0f172a",borderRadius:14,padding:20,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{color:modeColor[phase],fontWeight:800,fontSize:15}}>{phaseLabel[phase]}</div>
            {phase!=="idle"&&<button onClick={reset} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:12}}>↺ Reset</button>}
          </div>
          {product&&(
            <div style={{background:"#1e293b",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:"#60a5fa"}}>{product.sku}</div>
              <div style={{fontSize:13,color:"#94a3b8",flex:1}}>{productDesc(product,catalog)}</div>
              <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{currentTrayStock}<span style={{fontSize:13,color:"#475569"}}>/40</span></div>
            </div>
          )}
          {phase==="mode_select"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>{setPhase("intake");setScanLog([]);}} style={{background:"#064e3b",border:"2px solid #10b981",borderRadius:12,padding:"18px",cursor:"pointer",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:6}}>📥</div><div style={{fontWeight:800,fontSize:16}}>Intake</div><div style={{fontSize:12,color:"#6ee7b7",marginTop:4}}>Add new stock</div>
              </button>
              <button onClick={()=>{setPhase("dispatch");setScanLog([]);setDispatchQueue([]);}} style={{background:"#450a0a",border:"2px solid #ef4444",borderRadius:12,padding:"18px",cursor:"pointer",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:6}}>📤</div><div style={{fontWeight:800,fontSize:16}}>Dispatch</div><div style={{fontSize:12,color:"#fca5a5",marginTop:4}}>Remove stock</div>
              </button>
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:phase==="mode_select"?10:0}}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&handleScan()}
              placeholder={phase==="idle"?"Scan tray SKU...":phase==="intake"?"Scan IMEI to add...":phase==="dispatch"?"Scan IMEI to dispatch...":""}
              disabled={phase==="dispatch_confirm"}
              style={{flex:1,padding:"13px 16px",borderRadius:10,border:`2px solid ${modeColor[phase]}`,fontSize:15,fontFamily:"monospace",background:"#1e293b",color:"#f1f5f9",outline:"none",letterSpacing:"0.05em",opacity:phase==="dispatch_confirm"?0.4:1}}/>
            <button onClick={handleScan} disabled={phase==="dispatch_confirm"} style={{background:modeColor[phase],border:"none",borderRadius:10,padding:"0 22px",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",opacity:phase==="dispatch_confirm"?0.4:1}}>GO</button>
          </div>
          {lastFeedback&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:8,background:lastFeedback.type==="error"?"#450a0a":"#064e3b",color:lastFeedback.type==="error"?"#fca5a5":"#6ee7b7",fontWeight:700,fontSize:14}}>{lastFeedback.type==="error"?"❌":"✅"} {lastFeedback.msg}</div>}
          {(phase==="intake"||phase==="dispatch")&&(
            <div style={{marginTop:12,display:"flex",gap:10,alignItems:"center"}}>
              {phase==="intake"&&<div style={{background:"#064e3b",borderRadius:8,padding:"8px 16px",color:"#6ee7b7",fontWeight:700,fontSize:13}}>✅ {intakeCount} added</div>}
              {phase==="dispatch"&&<div style={{background:"#450a0a",borderRadius:8,padding:"8px 16px",color:"#fca5a5",fontWeight:700,fontSize:13}}>📤 {dispatchQueue.length} queued</div>}
              <button onClick={()=>{ if(phase==="intake"){showToast(`Intake complete. ${intakeCount} device(s) added.`);reset();} else {if(!dispatchQueue.length){showToast("Nothing scanned.","error");return;} setPhase("dispatch_confirm");} }}
                style={{marginLeft:"auto",background:phase==="intake"?"#10b981":"#ef4444",border:"none",borderRadius:8,padding:"9px 22px",cursor:"pointer",fontWeight:800,color:"#fff",fontSize:14}}>Done →</button>
            </div>
          )}
          {phase==="dispatch_confirm"&&(
            <div style={{marginTop:14}}>
              <div style={{background:"#1e293b",borderRadius:10,padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:"#fca5a5",marginBottom:10}}>📤 {dispatchQueue.length} device(s) to dispatch</div>
                <div style={{maxHeight:160,overflowY:"auto"}}>{dispatchQueue.map(d=><div key={d.id} style={{fontFamily:"monospace",fontSize:13,color:"#e2e8f0",padding:"4px 0",borderBottom:"1px solid #334155"}}>{d.imei}</div>)}</div>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:"#94a3b8",marginBottom:8}}>SELECT REASON</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {DISPATCH_REASONS.map(r=><button key={r} onClick={()=>setReason(r)} style={{background:reason===r?"#ef4444":"#1e293b",border:`1px solid ${reason===r?"#ef4444":"#334155"}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:600,fontSize:13,color:reason===r?"#fff":"#94a3b8"}}>{r}</button>)}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setPhase("dispatch")} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#94a3b8"}}>← Back</button>
                <button onClick={confirmDispatch} disabled={!reason} style={{flex:1,background:reason?"#ef4444":"#374151",border:"none",borderRadius:8,padding:"10px",cursor:reason?"pointer":"not-allowed",fontWeight:800,color:"#fff",fontSize:15}}>Confirm Dispatch {reason?`— ${reason}`:""}</button>
              </div>
            </div>
          )}
        </div>
        {scanLog.length>0&&(
          <div style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Scan Log — this session</div>
            <div style={{maxHeight:220,overflowY:"auto"}}>
              {scanLog.map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:6,background:s.ok?"#f0fdf4":"#fef2f2",marginBottom:4}}>
                  <span>{s.ok?"✅":"❌"}</span><span style={{fontFamily:"monospace",fontSize:13,flex:1}}>{s.imei}</span><span style={{fontSize:12,color:s.ok?"#065f46":"#dc2626",fontWeight:600}}>{s.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {tray&&(
          <div style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Tray Fill</div>
            <FillBar current={currentTrayStock} max={MAX_TRAY}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3,marginTop:12}}>
              {Array.from({length:MAX_TRAY}).map((_,i)=><div key={i} style={{width:"100%",paddingTop:"100%",borderRadius:3,background:i<currentTrayStock?"#10b981":"#e2e8f0"}}/>)}
            </div>
          </div>
        )}
        <div style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Quick Stats</div>
          {[["In Stock",devices.filter(d=>d.status==="In Stock").length,"#10b981"],["Total Devices",devices.length,"#3b82f6"],["Trays",trays.length,"#f59e0b"]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f1f5f9",fontSize:13}}>
              <span style={{color:"#64748b"}}>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SHELVES ──────────────────────────────────────────────────────────────────
function ShelvesTab({shelves,shelfTrays,trayStock,trayProduct,showToast,loadAll}) {
  const [newName,setNewName]=useState("");
  const [editShelf,setEditShelf]=useState(null);

  const add=async()=>{
    if(!newName.trim()) return showToast("Enter name.","error");
    if(shelves.find(s=>s.name.toLowerCase()===newName.trim().toLowerCase())) return showToast("Name exists.","error");
    const {error}=await supabase.from("shelves").insert({id:genId(),name:newName.trim()});
    if(error) return showToast(error.message,"error");
    setNewName(""); await loadAll(); showToast("Shelf added.");
  };

  const del=async(id)=>{
    if((shelfTrays[id]||[]).length>0) return showToast("Remove trays first.","error");
    await supabase.from("shelves").delete().eq("id",id);
    await loadAll(); showToast("Shelf removed.");
  };

  const saveEdit=async()=>{
    await supabase.from("shelves").update({name:editShelf.name.trim()}).eq("id",editShelf.id);
    setEditShelf(null); await loadAll(); showToast("Renamed.");
  };

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="New shelf name" style={{padding:"9px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,width:220}}/>
        <button onClick={add} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontWeight:700,color:"#fff"}}>+ Add Shelf</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
        {shelves.map(shelf=>{
          const trays=shelfTrays[shelf.id]||[]; const totalStock=trays.reduce((s,t)=>s+(trayStock[t.id]||0),0);
          return (
            <div key={shelf.id} style={{background:"#fff",borderRadius:14,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                {editShelf?.id===shelf.id
                  ?<div style={{display:"flex",gap:6,flex:1}}><input value={editShelf.name} onChange={e=>setEditShelf({...editShelf,name:e.target.value})} style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid #3b82f6",fontSize:14}}/><button onClick={saveEdit} style={{background:"#10b981",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:12}}>Save</button><button onClick={()=>setEditShelf(null)} style={{background:"#f1f5f9",border:"none",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:12}}>✕</button></div>
                  :<><div style={{fontWeight:800,fontSize:16}}>🗄 {shelf.name}</div><div style={{display:"flex",gap:6}}><button onClick={()=>setEditShelf({...shelf})} style={{background:"#eff6ff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#2563eb"}}>Rename</button><button onClick={()=>del(shelf.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button></div></>
                }
              </div>
              <div style={{display:"flex",gap:16,marginBottom:12,fontSize:13,color:"#64748b"}}><span>📦 {trays.length}/{MAX_SHELF_TRAYS} trays</span><span>📱 {totalStock} in stock</span></div>
              <FillBar current={trays.length} max={MAX_SHELF_TRAYS}/>
              <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                {Array.from({length:MAX_SHELF_TRAYS}).map((_,i)=>{ const t=trays[i]; const p=t?trayProduct[t.id]:null; const stock=t?trayStock[t.id]||0:0; const pct=t?Math.round((stock/MAX_TRAY)*100):0; const col=!t?"#f1f5f9":pct>=100?"#fee2e2":pct>=80?"#fef3c7":"#d1fae5"; const tc=!t?"#cbd5e1":pct>=100?"#dc2626":pct>=80?"#92400e":"#065f46";
                  return <div key={i} title={p?`${p.sku} (${stock}/40)`:""} style={{background:col,borderRadius:6,padding:"5px 3px",textAlign:"center",fontSize:9,fontWeight:700,color:tc,minHeight:34,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>{p?<><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",textAlign:"center"}}>{p.sku}</div><div>{stock}/40</div></>:<div style={{color:"#cbd5e1"}}>—</div>}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TRAYS ────────────────────────────────────────────────────────────────────
function TraysTab({trays,products,shelves,trayStock,trayDevices,trayProduct,shelfTrays,devices,showToast,catalog,loadAll,session}) {
  const {allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories}=catalog;
  const [showAdd,setShowAdd]=useState(false);
  const [printTray,setPrintTray]=useState(null);
  const [filterShelf,setFilterShelf]=useState("All");
  const [form,setForm]=useState({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",shelfId:""});
  const [matchedProduct,setMatchedProduct]=useState(null);
  const [noMatch,setNoMatch]=useState(false);
  const [clearTray,setClearTray]=useState(null);
  const [clearReason,setClearReason]=useState("");

  useEffect(()=>{
    if(!form.modelCode||!form.storageCode||!form.colourCode||!form.specCode||!form.gradeCode){setMatchedProduct(null);setNoMatch(false);return;}
    const found=products.find(p=>p.model_code===form.modelCode&&p.storage_code===form.storageCode&&p.colour_code===form.colourCode&&p.spec_code===form.specCode&&p.grade_code===form.gradeCode&&(p.category_code||"")===(form.categoryCode||""));
    setMatchedProduct(found||null); setNoMatch(!found);
  },[form,products]);

  const addTray=async()=>{
    if(!matchedProduct) return showToast("No matching product. Create it in the Product Catalog first.","error");
    if(!form.shelfId) return showToast("Select a shelf.","error");
    if((shelfTrays[form.shelfId]||[]).length>=MAX_SHELF_TRAYS) return showToast("Shelf is full.","error");
    if(trays.find(t=>t.product_id===matchedProduct.id&&t.shelf_id===form.shelfId)) return showToast(`Tray for ${matchedProduct.sku} already exists on this shelf.`,"error");
    const {error}=await supabase.from("trays").insert({id:genId(),product_id:matchedProduct.id,shelf_id:form.shelfId});
    if(error) return showToast(error.message,"error");
    await loadAll(); showToast(`Tray for ${matchedProduct.sku} created.`); setShowAdd(false);
    setForm({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",shelfId:""});
  };

  const deleteTray=async(id)=>{
    if((trayDevices[id]||[]).some(d=>d.status==="In Stock")) return showToast("Tray has stock. Clear or dispatch all first.","error");
    await supabase.from("trays").delete().eq("id",id);
    await loadAll(); showToast("Tray removed.");
  };

  const confirmClearTray=async()=>{
    if(!clearReason) return showToast("Select a reason.","error");
    const now=nowISO();
    const inStockIds=devices.filter(d=>d.tray_id===clearTray.id&&d.status==="In Stock").map(d=>d.id);
    const p=trayProduct[clearTray.id];
    await supabase.from("devices").update({status:"Sold"}).in("id",inStockIds);
    await supabase.from("history").insert(inStockIds.map(id=>({id:genId(),device_id:id,action:"Tray Cleared",detail:`Audit — ${clearReason} — ${p?.sku||""}`,by_user:session.username,at:now})));
    await loadAll();
    showToast(`Tray ${p?.sku} cleared — ${inStockIds.length} device(s) logged.`);
    setClearTray(null); setClearReason("");
  };

  const filtered=filterShelf==="All"?trays:trays.filter(t=>t.shelf_id===filterShelf);
  const sel=(key,val)=>setForm(f=>({...f,[key]:val}));
  const selStyle={width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14};

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
        <select value={filterShelf} onChange={e=>setFilterShelf(e.target.value)} style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}>
          <option value="All">All Shelves</option>{shelves.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{fontSize:13,color:"#94a3b8"}}>{filtered.length} tray(s)</span>
        <button onClick={()=>setShowAdd(true)} style={{marginLeft:"auto",background:"#3b82f6",border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontWeight:700,color:"#fff"}}>+ New Tray</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {filtered.map(tray=>{
          const p=trayProduct[tray.id]; const shelf=shelves.find(s=>s.id===tray.shelf_id); const stock=trayStock[tray.id]||0;
          return (
            <div key={tray.id} style={{background:"#fff",borderRadius:12,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div><div style={{fontWeight:800,fontSize:14,fontFamily:"monospace",color:"#0f172a"}}>{p?.sku||"?"}</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>{shelf?.name}</div></div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>setPrintTray(tray)} style={{background:"#eff6ff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#2563eb"}}>🖨</button>
                  {stock>0&&<button onClick={()=>{setClearTray(tray);setClearReason("");}} style={{background:"#fff7ed",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#ea580c"}}>🗑 Clear</button>}
                  <button onClick={()=>deleteTray(tray.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Del</button>
                </div>
              </div>
              <div style={{fontSize:12,color:"#475569",marginBottom:10}}>{productDesc(p,catalog)}</div>
              <FillBar current={stock} max={MAX_TRAY}/>
              {p&&<div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:12,color:"#64748b"}}>
                <span>Cost: {fmtGBP(p.purchase_price)}</span><span>Sale: {fmtGBP(p.sale_price)}</span>
                <span style={{fontWeight:700,color:"#10b981"}}>Val: {fmtGBP(parseFloat(p.sale_price||0)*stock)}</span>
              </div>}
            </div>
          );
        })}
      </div>

      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:18}}>Create New Tray</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[{label:"Model *",key:"modelCode",opts:allModelCodes},{label:"Storage *",key:"storageCode",opts:allStorageCodes},{label:"Colour *",key:"colourCode",opts:allColourCodes},{label:"Spec *",key:"specCode",opts:allSpecCodes},{label:"Grade *",key:"gradeCode",opts:allGradeCodes}].map(f=>(
                <div key={f.key}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>{f.label}</label><select value={form[f.key]} onChange={e=>sel(f.key,e.target.value)} style={selStyle}><option value="">— Select —</option>{f.opts.map(o=><option key={o.code} value={o.code}>{o.label} ({o.code})</option>)}</select></div>
              ))}
              <div><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Category <span style={{fontWeight:400,color:"#94a3b8"}}>(optional)</span></label><select value={form.categoryCode} onChange={e=>sel("categoryCode",e.target.value)} style={selStyle}><option value="">— None —</option>{allCategories.map(c=><option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}</select></div>
            </div>
            {matchedProduct&&<div style={{background:"#f0fdf4",border:"1px solid #6ee7b7",borderRadius:10,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"#065f46",marginBottom:4}}>✅ Product found</div><div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:"#0f172a"}}>{matchedProduct.sku}</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>{productDesc(matchedProduct,catalog)}</div></div>}
            {noMatch&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:13,fontWeight:700,color:"#dc2626",marginBottom:2}}>⚠️ No product found for this combination</div><div style={{fontSize:12,color:"#64748b"}}>Go to <b>Admin → Product Catalog → Products</b> and create it first.</div></div>}
            <div style={{marginBottom:16}}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Shelf *</label><select value={form.shelfId} onChange={e=>sel("shelfId",e.target.value)} style={selStyle}><option value="">— Select Shelf —</option>{shelves.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>{setShowAdd(false);setForm({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",shelfId:""}); }} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={addTray} disabled={!matchedProduct||!form.shelfId} style={{background:matchedProduct&&form.shelfId?"#3b82f6":"#cbd5e1",border:"none",borderRadius:8,padding:"10px 24px",cursor:matchedProduct&&form.shelfId?"pointer":"not-allowed",fontWeight:700,color:"#fff"}}>Create Tray</button>
            </div>
          </div>
        </div>
      )}

      {printTray&&<PrintModal tray={printTray} shelves={shelves} trayProduct={trayProduct} catalog={catalog} onClose={()=>setPrintTray(null)}/>}

      {clearTray&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:4}}>🗑 Clear Tray</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:18}}><span style={{fontFamily:"monospace",fontWeight:700,color:"#0f172a"}}>{trayProduct[clearTray.id]?.sku}</span> — {trayStock[clearTray.id]||0} device(s) will be marked as Sold and logged.</div>
            <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:13,color:"#92400e",fontWeight:600}}>⚠️ This cannot be undone. All in-stock IMEIs will be cleared.</div>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8}}>SELECT AUDIT REASON</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
              {["Stock Count Audit","Write-Off","Batch Sale","Lost Stock","Other"].map(r=><button key={r} onClick={()=>setClearReason(r)} style={{background:clearReason===r?"#ea580c":"#f1f5f9",border:`1px solid ${clearReason===r?"#ea580c":"#e2e8f0"}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:600,fontSize:13,color:clearReason===r?"#fff":"#374151"}}>{r}</button>)}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>{setClearTray(null);setClearReason("");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={confirmClearTray} disabled={!clearReason} style={{background:clearReason?"#ea580c":"#cbd5e1",border:"none",borderRadius:8,padding:"10px 24px",cursor:clearReason?"pointer":"not-allowed",fontWeight:700,color:"#fff"}}>Confirm Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PRINT MODAL ──────────────────────────────────────────────────────────────
function PrintModal({tray,shelves,trayProduct,catalog,onClose}) {
  const p=trayProduct[tray.id]; const shelf=shelves.find(s=>s.id===tray.shelf_id);
  const safeSku=(p?.sku||"").replace(/[^\x20-\x7E]/g,"");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:32,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:20}}>🖨 Print Tray Label</div>
        <div style={{border:"2px solid #1e293b",borderRadius:12,padding:24,textAlign:"center",background:"#fff"}}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6,fontWeight:600,letterSpacing:"0.1em"}}>PHONESTOCK PRO</div>
          <div style={{fontFamily:"monospace",fontSize:26,fontWeight:900,color:"#0f172a",marginBottom:12}}>{p?.sku||"—"}</div>
          {safeSku&&<div style={{display:"flex",justifyContent:"center",marginBottom:8}}><Barcode value={safeSku} width={300} height={65}/></div>}
          <div style={{fontSize:11,fontFamily:"monospace",color:"#475569",marginBottom:12}}>{p?.sku}</div>
          <div style={{fontSize:14,fontWeight:700,color:"#1e293b"}}>{productDesc(p,catalog)}</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:8}}>{shelf?.name} · Max 40 units</div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Close</button>
          <button onClick={()=>window.print()} style={{background:"#0f172a",border:"none",borderRadius:8,padding:"10px 24px",cursor:"pointer",fontWeight:700,color:"#fff"}}>🖨 Print</button>
        </div>
      </div>
    </div>
  );
}

// ─── DEVICES ──────────────────────────────────────────────────────────────────
function DevicesTab({devices,trays,shelves,trayProduct,catalog}) {
  const [search,setSearch]=useState("");
  const [filterStatus,setFilterStatus]=useState("All");
  const [filterTray,setFilterTray]=useState("All");
  const filtered=useMemo(()=>{
    let res=devices; const q=search.toLowerCase();
    if(q) res=res.filter(d=>d.imei.includes(q)||(trayProduct[d.tray_id]?.sku||"").toLowerCase().includes(q));
    if(filterStatus!=="All") res=res.filter(d=>d.status===filterStatus);
    if(filterTray!=="All") res=res.filter(d=>d.tray_id===filterTray);
    return res;
  },[devices,trayProduct,search,filterStatus,filterTray]);
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 IMEI or SKU" style={{flex:"1 1 200px",padding:"9px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}/>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}>
          <option value="All">All Statuses</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTray} onChange={e=>setFilterTray(e.target.value)} style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}>
          <option value="All">All Trays</option>{trays.map(t=>{ const p=trayProduct[t.id]; return <option key={t.id} value={t.id}>{p?.sku||t.id}</option>; })}
        </select>
        <span style={{fontSize:13,color:"#94a3b8",alignSelf:"center"}}>{filtered.length} device(s)</span>
      </div>
      <div style={{background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}>
          <thead><tr style={{background:"#f8fafc"}}>{["IMEI","Tray SKU","Product","Shelf","Grade","Status","Added By","Date"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",borderBottom:"2px solid #e2e8f0",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={8} style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No devices found</td></tr>}
            {filtered.map((dev,i)=>{ const p=trayProduct[dev.tray_id]; const tray=trays.find(t=>t.id===dev.tray_id); const shelf=shelves.find(s=>s.id===tray?.shelf_id); return (
              <tr key={dev.id} style={{background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:13,borderBottom:"1px solid #f1f5f9"}}>{dev.imei}</td>
                <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:12,fontWeight:700,borderBottom:"1px solid #f1f5f9"}}>{p?.sku||"—"}</td>
                <td style={{padding:"9px 12px",fontSize:12,borderBottom:"1px solid #f1f5f9",color:"#475569"}}>{productDesc(p,catalog)}</td>
                <td style={{padding:"9px 12px",fontSize:13,borderBottom:"1px solid #f1f5f9"}}>{shelf?.name||"—"}</td>
                <td style={{padding:"9px 12px",borderBottom:"1px solid #f1f5f9"}}>{p?<GradeBadge code={p.grade_code} allGrades={catalog.allGradeCodes}/>:"—"}</td>
                <td style={{padding:"9px 12px",borderBottom:"1px solid #f1f5f9"}}><StatusBadge status={dev.status}/></td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#3b82f6",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>{dev.added_by||"—"}</td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#94a3b8",borderBottom:"1px solid #f1f5f9",whiteSpace:"nowrap"}}>{fmtDate(dev.added_at)}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function HistoryTab({history,devices}) {
  const [search,setSearch]=useState("");
  const filtered=useMemo(()=>{ const q=search.toLowerCase(); if(!q) return history; return history.filter(h=>h.action?.toLowerCase().includes(q)||h.detail?.toLowerCase().includes(q)||h.by_user?.toLowerCase().includes(q)||devices.find(d=>d.id===h.device_id)?.imei.includes(q)); },[history,devices,search]);
  return (
    <div>
      <div style={{marginBottom:14}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 IMEI, user, action..." style={{padding:"9px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,width:300}}/></div>
      <div style={{background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f8fafc"}}>{["Time","User","IMEI","Action","Detail"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",borderBottom:"2px solid #e2e8f0",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={5} style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No history</td></tr>}
            {filtered.map((h,i)=>{ const dev=devices.find(d=>d.id===h.device_id); return (
              <tr key={h.id} style={{background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 12px",fontSize:12,color:"#94a3b8",borderBottom:"1px solid #f1f5f9",whiteSpace:"nowrap"}}>{fmtDate(h.at)}</td>
                <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,color:"#3b82f6",borderBottom:"1px solid #f1f5f9"}}>{h.by_user||"—"}</td>
                <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:13,borderBottom:"1px solid #f1f5f9"}}>{dev?.imei||"—"}</td>
                <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>{h.action}</td>
                <td style={{padding:"9px 12px",fontSize:13,color:"#475569",borderBottom:"1px solid #f1f5f9"}}>{h.detail}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardTab({devices,trays,trayStock,trayProduct,catalog}) {
  const stats=useMemo(()=>{
    const inStock=devices.filter(d=>d.status==="In Stock");
    const totalCost=inStock.reduce((s,d)=>{ const p=trayProduct[d.tray_id]; return s+(parseFloat(p?.purchase_price)||0); },0);
    const totalSale=inStock.reduce((s,d)=>{ const p=trayProduct[d.tray_id]; return s+(parseFloat(p?.sale_price)||0); },0);
    const byGrade=catalog.allGradeCodes.map(g=>({grade:g.code,label:g.label,count:inStock.filter(d=>trayProduct[d.tray_id]?.grade_code===g.code).length}));
    const bySpec=catalog.allSpecCodes.map(s=>({spec:s.code,label:s.label,count:inStock.filter(d=>trayProduct[d.tray_id]?.spec_code===s.code).length}));
    return {inStock:inStock.length,sold:devices.filter(d=>d.status==="Sold").length,repair:devices.filter(d=>d.status==="In Repair").length,transit:devices.filter(d=>d.status==="In Transit").length,totalCost,totalSale,profit:totalSale-totalCost,byGrade,bySpec,fullTrays:trays.filter(t=>(trayStock[t.id]||0)>=MAX_TRAY),emptyTrays:trays.filter(t=>(trayStock[t.id]||0)===0)};
  },[devices,trays,trayStock,trayProduct,catalog]);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[{l:"In Stock",v:stats.inStock,i:"📦",c:"#10b981"},{l:"Sold",v:stats.sold,i:"📤",c:"#3b82f6"},{l:"In Repair",v:stats.repair,i:"🔧",c:"#f59e0b"},{l:"In Transit",v:stats.transit,i:"🚚",c:"#8b5cf6"}].map(s=>(
          <div key={s.l} style={{background:"#fff",borderRadius:12,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><div style={{fontSize:22}}>{s.i}</div><div style={{fontSize:28,fontWeight:800,color:s.c,marginTop:6}}>{s.v}</div><div style={{fontSize:13,color:"#64748b"}}>{s.l}</div></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[{l:"Stock Cost",v:`£${stats.totalCost.toFixed(2)}`,i:"💷",c:"#6366f1"},{l:"Sale Value",v:`£${stats.totalSale.toFixed(2)}`,i:"💰",c:"#10b981"},{l:"Potential Profit",v:`£${stats.profit.toFixed(2)}`,i:"📈",c:"#f59e0b"}].map(s=>(
          <div key={s.l} style={{background:"#fff",borderRadius:12,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><div style={{fontSize:22}}>{s.i}</div><div style={{fontSize:24,fontWeight:800,color:s.c,marginTop:6}}>{s.v}</div><div style={{fontSize:13,color:"#64748b"}}>{s.l}</div></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>By Grade</div>
          {stats.byGrade.filter(g=>g.count>0).map(g=><div key={g.grade} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><GradeBadge code={g.grade} allGrades={catalog.allGradeCodes}/><span style={{fontWeight:700,fontSize:15}}>{g.count}</span></div>)}
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>By Spec</div>
          {stats.bySpec.filter(s=>s.count>0).map(s=><div key={s.spec} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:"#475569"}}>{s.label}</span><span style={{fontWeight:700,fontSize:15}}>{s.count}</span></div>)}
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>⚠️ Alerts</div>
          {stats.fullTrays.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:600,color:"#dc2626",marginBottom:5}}>FULL ({stats.fullTrays.length})</div>{stats.fullTrays.map(t=>{ const p=trayProduct[t.id]; return <div key={t.id} style={{fontFamily:"monospace",fontSize:12,color:"#dc2626",marginBottom:2}}>{p?.sku||"?"}</div>; })}</div>}
          {stats.emptyTrays.length>0&&<div><div style={{fontSize:12,fontWeight:600,color:"#94a3b8",marginBottom:5}}>EMPTY ({stats.emptyTrays.length})</div>{stats.emptyTrays.map(t=>{ const p=trayProduct[t.id]; return <div key={t.id} style={{fontFamily:"monospace",fontSize:12,color:"#94a3b8",marginBottom:2}}>{p?.sku||"?"}</div>; })}</div>}
          {!stats.fullTrays.length&&!stats.emptyTrays.length&&<div style={{color:"#10b981",fontSize:13}}>✅ All trays healthy</div>}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminTab({users,shelves,products,showToast,session,catalog,skuSet,loadAll}) {
  const {allModelCodes,allColourCodes,allStorageCodes,allSpecCodes,allGradeCodes,allCategories}=catalog;
  const [showAddUser,setShowAddUser]=useState(false);
  const [newUser,setNewUser]=useState({username:"",pin:"",role:"staff"});
  const [changePIN,setChangePIN]=useState(null);
  const [newPIN,setNewPIN]=useState("");
  const [catalogTab,setCatalogTab]=useState("products");
  const [newProduct,setNewProduct]=useState({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",sku:"",purchasePrice:"",salePrice:""});
  const [newModel,setNewModel]=useState({code:"",label:""});
  const [newColour,setNewColour]=useState({code:"",label:""});
  const [newStorage,setNewStorage]=useState({code:"",label:""});
  const [newSpec,setNewSpec]=useState({code:"",label:""});
  const [newGrade,setNewGrade]=useState({code:"",label:""});
  const [newCategory,setNewCategory]=useState({code:"",label:""});

  const addUser=async()=>{
    if(!newUser.username.trim()) return showToast("Username required.","error");
    if(!/^\d{4,6}$/.test(newUser.pin)) return showToast("PIN must be 4-6 digits.","error");
    if(users.find(u=>u.username.toLowerCase()===newUser.username.trim().toLowerCase())) return showToast("Username exists.","error");
    const {error}=await supabase.from("users").insert({id:genId(),username:newUser.username.trim().toLowerCase(),pin_hash:hashPIN(newUser.pin),role:newUser.role});
    if(error) return showToast(error.message,"error");
    await loadAll(); showToast(`User "${newUser.username}" created.`); setShowAddUser(false); setNewUser({username:"",pin:"",role:"staff"});
  };

  const deleteUser=async(id)=>{
    if(id===session.id) return showToast("Cannot delete yourself.","error");
    await supabase.from("users").delete().eq("id",id);
    await loadAll(); showToast("User removed.");
  };

  const savePIN=async()=>{
    if(!/^\d{4,6}$/.test(newPIN)) return showToast("PIN must be 4-6 digits.","error");
    await supabase.from("users").update({pin_hash:hashPIN(newPIN)}).eq("id",changePIN);
    await loadAll(); showToast("PIN updated."); setChangePIN(null); setNewPIN("");
  };

  const addProduct=async()=>{
    const {modelCode,storageCode,colourCode,specCode,gradeCode,sku,purchasePrice,salePrice,categoryCode}=newProduct;
    if(!modelCode||!storageCode||!colourCode||!specCode||!gradeCode) return showToast("Fill all required fields.","error");
    if(!sku.trim()) return showToast("SKU is required.","error");
    const skuClean=sku.trim().toUpperCase();
    if(skuSet.has(skuClean)) return showToast(`SKU "${skuClean}" already exists.`,"error");
    const dupCombo=products.find(p=>p.model_code===modelCode&&p.storage_code===storageCode&&p.colour_code===colourCode&&p.spec_code===specCode&&p.grade_code===gradeCode&&(p.category_code||"")===(categoryCode||""));
    if(dupCombo) return showToast(`This combination already exists as ${dupCombo.sku}.`,"error");
    const {error}=await supabase.from("products").insert({id:genId(),sku:skuClean,model_code:modelCode,storage_code:storageCode,colour_code:colourCode,spec_code:specCode,grade_code:gradeCode,category_code:categoryCode||"",purchase_price:purchasePrice,sale_price:salePrice});
    if(error) return showToast(error.message,"error");
    await loadAll(); showToast(`Product ${skuClean} created.`);
    setNewProduct({modelCode:"",storageCode:"",colourCode:"",specCode:"",gradeCode:"",categoryCode:"",sku:"",purchasePrice:"",salePrice:""});
  };

  const deleteProduct=async(id)=>{
    const {data:usedTrays}=await supabase.from("trays").select("id").eq("product_id",id);
    if(usedTrays&&usedTrays.length>0) return showToast("Product is used by a tray — cannot remove.","error");
    await supabase.from("products").delete().eq("id",id);
    await loadAll(); showToast("Product removed.");
  };

  const mkAdd=(table,allList,newVal,setNewVal,label)=>async()=>{
    const code=newVal.code.trim().toUpperCase(),lbl=newVal.label.trim();
    if(!code||!lbl) return showToast("Code and label required.","error");
    if(allList.find(x=>x.code===code)) return showToast(`${label} code already exists.`,"error");
    await supabase.from(table).insert({id:genId(),code,label:lbl});
    await loadAll(); setNewVal({code:"",label:""}); showToast(`${label} "${lbl}" added.`);
  };

  const mkDel=(table,label)=>async(code)=>{
    await supabase.from(table).delete().eq("code",code);
    await loadAll(); showToast(`${label} removed.`);
  };

  const inpS={padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"};
  const selS={width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:"#fff",borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:15}}>👥 Users</div>
            <button onClick={()=>setShowAddUser(true)} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:13}}>+ Add</button>
          </div>
          {users.map(u=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:10,background:"#f8fafc",marginBottom:8}}>
              <div><div style={{fontWeight:700,fontSize:14}}>{u.username} {u.id===session.id&&<span style={{fontSize:11,color:"#94a3b8"}}>(you)</span>}</div><RoleBadge role={u.role}/></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setChangePIN(u.id);setNewPIN("");}} style={{background:"#eff6ff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#2563eb"}}>PIN</button>
                {u.id!==session.id&&<button onClick={()=>deleteUser(u.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button>}
              </div>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>⚙️ System</div>
          {[["Products",products.length],["Shelves",shelves.length],["Session Timeout","10 min"],["Database","Supabase ☁️"],["Realtime Sync","✅ Active"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f1f5f9",fontSize:13}}><span style={{color:"#64748b"}}>{k}</span><span style={{fontWeight:700}}>{v}</span></div>
          ))}
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>📋 Product Catalog</div>
        <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"2px solid #f1f5f9",overflowX:"auto"}}>
          {[["products","📦 Products"],["models","📱 Models"],["colours","🎨 Colours"],["storage","💾 Storage"],["specs","🌍 Specs"],["grades","⭐ Grades"],["categories","📂 Categories"]].map(([t,label])=>(
            <button key={t} onClick={()=>setCatalogTab(t)} style={{background:"none",border:"none",padding:"10px 16px",cursor:"pointer",fontWeight:catalogTab===t?700:500,color:catalogTab===t?"#3b82f6":"#64748b",borderBottom:catalogTab===t?"2px solid #3b82f6":"2px solid transparent",fontSize:13,marginBottom:-2,whiteSpace:"nowrap"}}>{label}</button>
          ))}
        </div>

        {catalogTab==="products"&&(
          <div>
            <div style={{background:"#f8fafc",borderRadius:10,padding:18,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:12,letterSpacing:"0.05em"}}>CREATE NEW PRODUCT</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                {[{label:"Model *",key:"modelCode",opts:allModelCodes},{label:"Storage *",key:"storageCode",opts:allStorageCodes},{label:"Colour *",key:"colourCode",opts:allColourCodes},{label:"Spec *",key:"specCode",opts:allSpecCodes},{label:"Grade *",key:"gradeCode",opts:allGradeCodes}].map(f=>(
                  <div key={f.key}><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>{f.label}</label><select value={newProduct[f.key]} onChange={e=>setNewProduct(p=>({...p,[f.key]:e.target.value}))} style={selS}><option value="">— Select —</option>{f.opts.map(o=><option key={o.code} value={o.code}>{o.label} ({o.code})</option>)}</select></div>
                ))}
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>Category <span style={{fontWeight:400}}>(optional)</span></label><select value={newProduct.categoryCode} onChange={e=>setNewProduct(p=>({...p,categoryCode:e.target.value}))} style={selS}><option value="">— None —</option>{allCategories.map(c=><option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}</select></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>SKU *</label><input value={newProduct.sku} onChange={e=>setNewProduct(p=>({...p,sku:e.target.value.toUpperCase()}))} placeholder="e.g. IP14P128BKU-A" style={{...inpS,width:"100%",fontFamily:"monospace",fontSize:14,fontWeight:700}}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>Purchase £</label><input type="number" value={newProduct.purchasePrice} onChange={e=>setNewProduct(p=>({...p,purchasePrice:e.target.value}))} style={{...inpS,width:"100%"}}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:3}}>Sale £</label><input type="number" value={newProduct.salePrice} onChange={e=>setNewProduct(p=>({...p,salePrice:e.target.value}))} style={{...inpS,width:"100%"}}/></div>
                <div style={{display:"flex",alignItems:"flex-end"}}><button onClick={addProduct} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"9px",cursor:"pointer",fontWeight:700,color:"#fff",fontSize:13,width:"100%"}}>+ Create</button></div>
              </div>
            </div>
            <div style={{maxHeight:340,overflowY:"auto"}}>
              {products.length===0&&<div style={{textAlign:"center",padding:30,color:"#94a3b8",fontSize:14}}>No products yet.</div>}
              {products.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:10,background:"#f8fafc",marginBottom:8}}>
                  <div style={{flex:1}}><div style={{fontFamily:"monospace",fontWeight:800,fontSize:14,color:"#0f172a"}}>{p.sku}</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>{productDesc(p,catalog)}</div></div>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginLeft:12}}>
                    <div style={{fontSize:12,color:"#64748b",textAlign:"right"}}><div>Cost: {fmtGBP(p.purchase_price)}</div><div>Sale: {fmtGBP(p.sale_price)}</div></div>
                    <button onClick={()=>deleteProduct(p.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {catalogTab==="models"&&<CatalogSection title="Model" items={customModelCodes||[]} builtIn={MODEL_CODES} newVal={newModel} setNewVal={setNewModel} onAdd={mkAdd("custom_model_codes",allModelCodes,newModel,setNewModel,"Model")} onDelete={mkDel("custom_model_codes","Model")} codePlaceholder="e.g. IP17P" labelPlaceholder="e.g. iPhone 17 Pro" codeHint="IP=iPhone, SGS=Samsung Galaxy S, GP=Google Pixel"/>}
        {catalogTab==="colours"&&<CatalogSection title="Colour" items={customColourCodes||[]} builtIn={COLOUR_CODES} newVal={newColour} setNewVal={setNewColour} onAdd={mkAdd("custom_colour_codes",allColourCodes,newColour,setNewColour,"Colour")} onDelete={mkDel("custom_colour_codes","Colour")} codePlaceholder="e.g. OR" labelPlaceholder="e.g. Orange" codeHint="2-3 letters."/>}
        {catalogTab==="storage"&&<CatalogSection title="Storage" items={customStorageCodes||[]} builtIn={STORAGE_CODES} newVal={newStorage} setNewVal={setNewStorage} onAdd={mkAdd("custom_storage_codes",allStorageCodes,newStorage,setNewStorage,"Storage")} onDelete={mkDel("custom_storage_codes","Storage")} codePlaceholder="e.g. 2T" labelPlaceholder="e.g. 2TB" codeHint="Keep consistent."/>}
        {catalogTab==="specs"&&<CatalogSection title="Spec" items={customSpecCodes||[]} builtIn={SPEC_CODES} newVal={newSpec} setNewVal={setNewSpec} onAdd={mkAdd("custom_spec_codes",allSpecCodes,newSpec,setNewSpec,"Spec")} onDelete={mkDel("custom_spec_codes","Spec")} codePlaceholder="e.g. E" labelPlaceholder="e.g. European" codeHint="U=UK, G=US/Global, J=Japanese"/>}
        {catalogTab==="grades"&&<CatalogSection title="Grade" items={customGradeCodes||[]} builtIn={GRADE_CODES} newVal={newGrade} setNewVal={setNewGrade} onAdd={mkAdd("custom_grade_codes",allGradeCodes,newGrade,setNewGrade,"Grade")} onDelete={mkDel("custom_grade_codes","Grade")} codePlaceholder="e.g. S" labelPlaceholder="e.g. Sealed" codeHint="A, B, C, R are built-in."/>}
        {catalogTab==="categories"&&<CatalogSection title="Category" items={customCategories||[]} builtIn={[]} newVal={newCategory} setNewVal={setNewCategory} onAdd={mkAdd("custom_categories",allCategories,newCategory,setNewCategory,"Category")} onDelete={mkDel("custom_categories","Category")} codePlaceholder="e.g. MC" labelPlaceholder="e.g. Matching Color" codeHint="Used to differentiate product variants."/>}
      </div>

      {showAddUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:360,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:20}}>Add User</div>
            {[{label:"Username",key:"username",type:"text"},{label:"PIN (4-6 digits)",key:"pin",type:"password"}].map(f=>(
              <div key={f.key} style={{marginBottom:14}}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>{f.label}</label><input type={f.type} value={newUser[f.key]} onChange={e=>setNewUser(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:15,boxSizing:"border-box"}}/></div>
            ))}
            <div style={{marginBottom:20}}><label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Role</label><select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}}><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAddUser(false)} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={addUser} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"10px 22px",cursor:"pointer",fontWeight:700,color:"#fff"}}>Create</button>
            </div>
          </div>
        </div>
      )}
      {changePIN&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:320,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>Change PIN</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>User: <b>{users.find(u=>u.id===changePIN)?.username}</b></div>
            <input type="password" value={newPIN} onChange={e=>setNewPIN(e.target.value)} placeholder="New PIN" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:20,letterSpacing:"0.3em",marginBottom:18,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setChangePIN(null)} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:600,color:"#64748b"}}>Cancel</button>
              <button onClick={savePIN} style={{background:"#3b82f6",border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontWeight:700,color:"#fff"}}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// expose custom codes for AdminTab catalog sections
const {customModelCodes,customColourCodes,customStorageCodes,customSpecCodes,customGradeCodes}={
  customModelCodes:[],customColourCodes:[],customStorageCodes:[],customSpecCodes:[],customGradeCodes:[]
};