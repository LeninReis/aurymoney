import { useState, useRef, useEffect, useMemo } from "react"
import { initializeApp } from "firebase/app"
import {
  getFirestore, collection, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query
} from "firebase/firestore"

// ── Firebase ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}
const db = getFirestore(initializeApp(firebaseConfig))

// ── Cartões com dono e vencimento ─────────────────────────────────────────────
const CARDS = {
  nubank_l:      { name:"Nubank",       owner:"Lenin",  color:"#C084FC", bg:"#160822", logo:"Nu", venc:20, fech:13 },
  inter_l:       { name:"Inter",        owner:"Lenin",  color:"#FB923C", bg:"#180e04", logo:"In", venc:7,  fech:1  },
  nubank_e:      { name:"Nubank",       owner:"Evelyn", color:"#C084FC", bg:"#160822", logo:"Nu", venc:17, fech:10 },
  mercadopago_e: { name:"Mercado Pago", owner:"Evelyn", color:"#38BDF8", bg:"#061422", logo:"MP", venc:18, fech:11 },
  picpay_e:      { name:"PicPay",       owner:"Evelyn", color:"#34D399", bg:"#061810", logo:"PP", venc:20, fech:13 },
}

// Bancos para registros de receitas/pix (sem crédito)
const BANKS = {
  nubank_l:      { name:"Nubank (Lenin)",         color:"#C084FC" },
  inter_l:       { name:"Inter (Lenin)",           color:"#FB923C" },
  nubank_e:      { name:"Nubank (Evelyn)",         color:"#C084FC" },
  mercadopago_e: { name:"Mercado Pago (Evelyn)",   color:"#38BDF8" },
  picpay_e:      { name:"PicPay (Evelyn)",         color:"#34D399" },
}

const CATS = {
  despesa: [
    { id:"cartao",      label:"Cartão de Crédito",       emoji:"💳" },
    { id:"pix",         label:"Pix / À vista",            emoji:"📲" },
    { id:"mensalidade", label:"Mensalidade/Assinatura",   emoji:"🔁" },
    { id:"emprestimo",  label:"Empréstimo/Financiamento", emoji:"🏦" },
  ],
  receita: [
    { id:"salario",      label:"Salário",                 emoji:"💰" },
    { id:"freelance",    label:"Freelance/Extra",          emoji:"💻" },
    { id:"investimento", label:"Investimento/Rendimento",  emoji:"📈" },
    { id:"outro",        label:"Outro",                    emoji:"📌" },
  ],
}

const CAT_MAP = {}
;[...CATS.despesa, ...CATS.receita].forEach(c => { CAT_MAP[c.id] = c })

const CAT_COLOR = {
  cartao:"#A78BFA", pix:"#38BDF8", mensalidade:"#F472B6", emprestimo:"#F87171",
  salario:"#34D399", freelance:"#FBBF24", investimento:"#6EE7B7", outro:"#818CF8",
}

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

const fmt       = v  => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" })
const todayStr  = () => new Date().toISOString().slice(0, 10)
const curMonth  = () => new Date().toISOString().slice(0, 7)
const addMonths = (ym, n) => {
  const [y,m] = ym.split("-").map(Number)
  const d = new Date(y, m-1+n, 1)
  return d.toISOString().slice(0,7)
}
const monthLabel = ym => {
  const [y,m] = ym.split("-").map(Number)
  return `${MONTH_NAMES[m-1]} ${y}`
}
const monthShort = ym => {
  const [,m] = ym.split("-").map(Number)
  return MONTH_SHORT[m-1]
}

// Gera descrição automática de fatura
function autoDesc(cardKey, dateStr) {
  const card = CARDS[cardKey]
  if (!card || !dateStr) return ""
  const [y,m] = dateStr.split("-").map(Number)
  // se estamos após o fechamento, a fatura é do mês seguinte
  const day = parseInt(dateStr.split("-")[2])
  const fatMonth = day > card.fech ? m : m - 1
  const fatYear  = fatMonth < 1 ? y - 1 : (fatMonth > 12 ? y + 1 : y)
  const idx      = ((fatMonth - 1 + 12) % 12)
  return `Fatura ${card.name} (${card.owner}) - ${MONTH_NAMES[idx]}`
}

function daysUntil(day) {
  const now = new Date()
  const t   = new Date(now.getFullYear(), now.getMonth(), day)
  if (t <= now) t.setMonth(t.getMonth() + 1)
  return Math.ceil((t - now) / 86400000)
}

// ── Detect device ─────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])
  return mobile
}

// ── Charts ────────────────────────────────────────────────────────────────────
function BarPair({ data }) {
  // data: [{label, rec, exp}]
  const max = Math.max(...data.flatMap(d => [d.rec, d.exp]), 1)
  return (
    <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:90 }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:"flex", gap:2, alignItems:"flex-end" }}>
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ width:"100%", background:"#34D399", borderRadius:"3px 3px 0 0", height:`${(d.rec/max)*78}px`, minHeight:d.rec>0?3:0, transition:"height .7s cubic-bezier(.34,1.56,.64,1)" }}/>
          </div>
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ width:"100%", background:"#F87171", borderRadius:"3px 3px 0 0", height:`${(d.exp/max)*78}px`, minHeight:d.exp>0?3:0, transition:"height .7s cubic-bezier(.34,1.56,.64,1)" }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function BarLabels({ data }) {
  return (
    <div style={{ display:"flex", gap:4 }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, textAlign:"center", fontSize:8, color:"rgba(255,255,255,.3)", paddingTop:3 }}>
          {d.label}
        </div>
      ))}
    </div>
  )
}

function LineChart({ points, color="#A78BFA", height=60, showZero=true }) {
  if (points.length < 2) return null
  const vals = points.map(p => p.value)
  const min  = Math.min(...vals)
  const max  = Math.max(...vals)
  const range = max - min || 1
  const W = 280, H = height, pad = 8
  const xs = points.map((_,i) => pad + (i/(points.length-1))*(W-pad*2))
  const ys = vals.map(v => H - pad - ((v-min)/range)*(H-pad*2))
  const path = xs.map((x,i) => `${i===0?"M":"L"}${x},${ys[i]}`).join(" ")
  const zeroY = H - pad - ((0-min)/range)*(H-pad*2)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
      {showZero && min < 0 && max > 0 && (
        <line x1={pad} y1={zeroY} x2={W-pad} y2={zeroY} stroke="rgba(255,255,255,.1)" strokeWidth={1} strokeDasharray="3,3"/>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p,i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={3} fill={p.value >= 0 ? color : "#F87171"}/>
      ))}
    </svg>
  )
}

function Donut({ pct, color, size=64 }) {
  const s=7, r=size/2-s, c=2*Math.PI*r, f=(Math.min(Math.max(pct,0),100)/100)*c
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={s}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={s}
        strokeDasharray={`${f} ${c-f}`} strokeLinecap="round" style={{ transition:"stroke-dasharray 1s ease" }}/>
    </svg>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080812;--sf:#0f0f1e;--sf2:#141428;
  --bd:rgba(255,255,255,.06);--bd2:rgba(255,255,255,.11);
  --tx:#e8e8f8;--mt:rgba(255,255,255,.4);
  --pu:#A78BFA;--pk:#F472B6;--gn:#34D399;--rd:#F87171;--yw:#FBBF24;--bl:#38BDF8;
}
html,body{background:var(--bg);min-height:100vh;font-family:'Outfit',sans-serif}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#A78BFA33;border-radius:99px}

/* Layout */
.app{color:var(--tx);min-height:100vh;display:flex;flex-direction:column;position:relative;overflow-x:hidden}
.app.mobile{max-width:430px;margin:0 auto}
.app.desktop{max-width:1200px;margin:0 auto}
.ga{position:fixed;top:-200px;left:-150px;width:500px;height:500px;background:radial-gradient(circle,rgba(167,139,250,.06),transparent 65%);pointer-events:none;z-index:0}
.gb{position:fixed;bottom:-150px;right:-100px;width:400px;height:400px;background:radial-gradient(circle,rgba(244,114,182,.04),transparent 65%);pointer-events:none;z-index:0}

/* Header */
.hdr{position:sticky;top:0;z-index:50;background:rgba(8,8,18,.93);backdrop-filter:blur(24px);border-bottom:1px solid var(--bd);padding:14px 20px 12px;display:flex;justify-content:space-between;align-items:center}
.logo{font-size:20px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(135deg,var(--pu),var(--pk));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-sub{font-size:9px;color:var(--mt);letter-spacing:2.5px;text-transform:uppercase;margin-top:1px;display:flex;align-items:center;gap:5px}
.sync{width:6px;height:6px;border-radius:50%;background:var(--gn);box-shadow:0 0 6px var(--gn);display:inline-block;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.avs{display:flex;gap:6px;align-items:center}
.av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid}

/* Content */
.content{flex:1;overflow-y:auto;padding:14px 16px 90px;position:relative;z-index:1}
.desktop .content{padding:20px 24px 40px}

/* Desktop grid */
.desktop .dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.desktop .dash-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.desktop .full-col{grid-column:1/-1}

/* Nav - mobile only */
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(8,8,18,.97);backdrop-filter:blur(30px);border-top:1px solid var(--bd);display:flex;z-index:100;padding:7px 6px 18px;gap:3px}
.desktop .nav{display:none}
.nb{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 2px;border:none;background:none;cursor:pointer;border-radius:11px;transition:all .2s}
.nb.on{background:linear-gradient(135deg,rgba(167,139,250,.1),rgba(244,114,182,.05))}
.nb-i{font-size:17px;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.nb.on .nb-i{transform:scale(1.2)}
.nb-l{font-size:9px;font-weight:600;color:var(--mt)}
.nb.on .nb-l{background:linear-gradient(135deg,var(--pu),var(--pk));-webkit-background-clip:text;-webkit-text-fill-color:transparent}

/* Desktop sidebar */
.sidebar{display:none}
.desktop .sidebar{display:flex;flex-direction:column;gap:4px;padding:20px 16px;background:rgba(15,15,30,.8);border-right:1px solid var(--bd);min-height:100vh;width:220px;position:fixed;left:0;top:60px}
.desktop .with-sidebar{margin-left:220px}
.sb-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border:none;background:none;cursor:pointer;border-radius:12px;transition:all .2s;color:var(--mt);font-size:13px;font-weight:500;font-family:'Outfit',sans-serif;width:100%;text-align:left}
.sb-btn.on{background:linear-gradient(135deg,rgba(167,139,250,.12),rgba(244,114,182,.06));color:var(--tx)}
.sb-btn:hover:not(.on){background:rgba(255,255,255,.04)}
.sb-ico{font-size:16px;width:22px;text-align:center}

/* Cards */
.card{background:var(--sf);border:1px solid var(--bd);border-radius:18px;padding:15px;margin-bottom:12px}
.card-sm{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:12px}
.hero{background:linear-gradient(135deg,#14142a,#1a0f30);border:1px solid rgba(167,139,250,.15);border-radius:22px;padding:22px;margin-bottom:12px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-60px;right:-60px;width:160px;height:160px;background:radial-gradient(circle,rgba(167,139,250,.1),transparent);border-radius:50%}
.hero::after{content:'';position:absolute;bottom:-40px;left:-40px;width:120px;height:120px;background:radial-gradient(circle,rgba(244,114,182,.07),transparent);border-radius:50%}
.h-lbl{font-size:10px;font-weight:600;color:var(--mt);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.h-val{font-size:36px;font-weight:800;line-height:1;letter-spacing:-1.5px}
.h-val.pos{background:linear-gradient(135deg,#fff,rgba(255,255,255,.8));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.h-val.neg{background:linear-gradient(135deg,var(--rd),#fca5a5);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.h-val.warn{background:linear-gradient(135deg,var(--yw),#fde68a);-webkit-background-clip:text;-webkit-text-fill-color:transparent}

.sec{font-size:10px;font-weight:700;color:var(--mt);letter-spacing:2px;text-transform:uppercase;margin-bottom:9px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}
.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px}
.mc{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:12px}
.ml{font-size:9px;font-weight:600;color:var(--mt);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}
.mv{font-size:17px;font-weight:700;line-height:1}

.pbar{height:5px;background:rgba(255,255,255,.05);border-radius:99px;overflow:hidden;margin-top:6px}
.pfill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.34,1.56,.64,1)}

/* Card scroll */
.bscroll{display:flex;gap:9px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;scrollbar-width:none}
.bscroll::-webkit-scrollbar{display:none}
.bc{min-width:130px;border-radius:16px;padding:12px;position:relative;overflow:hidden;flex-shrink:0;cursor:pointer;border:1.5px solid transparent;transition:all .2s}
.bc:hover{transform:translateY(-2px)}
.bc::before{content:'';position:absolute;top:-18px;right:-18px;width:65px;height:65px;background:radial-gradient(circle,rgba(255,255,255,.09),transparent);border-radius:50%}
.bl{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;margin-bottom:6px}
.bn{font-size:10px;color:rgba(255,255,255,.6);margin-bottom:1px;font-weight:600}
.bowner{font-size:8px;color:rgba(255,255,255,.35);margin-bottom:3px}
.bvc{font-size:8px;color:rgba(255,255,255,.3);margin-bottom:3px}
.bv{font-size:14px;font-weight:700}

/* Records */
.ri{display:flex;align-items:center;gap:9px;padding:10px 12px;background:var(--sf);border:1px solid var(--bd);border-radius:13px;margin-bottom:6px;transition:all .2s}
.ri:hover{border-color:rgba(167,139,250,.18);background:var(--sf2);transform:translateX(2px)}
.ric{width:35px;height:35px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.rif{flex:1;min-width:0}
.rdesc{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rmeta{font-size:9px;color:var(--mt);margin-top:2px;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.pill{font-size:9px;border-radius:99px;padding:1px 7px;font-weight:600}
.rval{font-size:14px;font-weight:700;white-space:nowrap}
.ras{display:flex;gap:4px;margin-top:2px;justify-content:flex-end}
.ab{width:24px;height:24px;border-radius:7px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;transition:all .2s}
.ab.e{background:rgba(167,139,250,.1);color:var(--pu)}.ab.e:hover{background:rgba(167,139,250,.22)}
.ab.d{background:rgba(248,113,113,.1);color:var(--rd)}.ab.d:hover{background:rgba(248,113,113,.22)}
.rgl{font-size:9px;font-weight:700;color:var(--mt);letter-spacing:2px;text-transform:uppercase;padding:8px 2px 4px}

/* Filters */
.filters{display:flex;gap:6px;overflow-x:auto;margin-bottom:11px;padding-bottom:3px;scrollbar-width:none}
.filters::-webkit-scrollbar{display:none}
.fb{padding:5px 12px;border-radius:99px;border:1px solid var(--bd2);background:var(--sf);color:var(--mt);font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .2s;font-family:'Outfit',sans-serif}
.fb.on{background:linear-gradient(135deg,var(--pu),var(--pk));border-color:transparent;color:#fff}

/* Form */
.fl{font-size:10px;font-weight:600;color:var(--mt);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;display:block}
.fi{width:100%;background:var(--sf);border:1px solid var(--bd2);border-radius:12px;padding:11px 13px;color:var(--tx);font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;outline:none;transition:all .2s}
.fi:focus{border-color:rgba(167,139,250,.4);box-shadow:0 0 0 3px rgba(167,139,250,.05)}
.fi option{background:var(--sf)}
.ttgl{display:grid;grid-template-columns:1fr 1fr;background:var(--sf);border-radius:13px;padding:3px;gap:3px;margin-bottom:13px}
.tb{padding:9px;border:none;border-radius:10px;cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;transition:all .2s}
.tb.on-r{background:linear-gradient(135deg,var(--gn),#059669);color:#080812}
.tb.on-d{background:linear-gradient(135deg,var(--rd),#dc2626);color:#fff}
.tb:not(.on-r):not(.on-d){background:transparent;color:rgba(255,255,255,.2)}
.cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:13px}
.cat-opt{border:1.5px solid var(--bd);border-radius:12px;padding:10px 12px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;background:var(--sf)}
.cat-opt.sel{border-color:var(--pu);background:rgba(167,139,250,.08)}
.cat-em{font-size:18px}
.cat-nm{font-size:11px;font-weight:600;color:var(--mt);line-height:1.3}
.cat-opt.sel .cat-nm{color:var(--tx)}
.bgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:13px}
.bo{border:1.5px solid var(--bd);border-radius:12px;padding:9px 11px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:7px;background:var(--sf)}
.bo:hover{border-color:var(--bd2)}
.bo-logo{width:25px;height:25px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800}
.bo-nm{font-size:11px;font-weight:600;color:var(--mt);line-height:1.2}
.trow{display:flex;align-items:center;justify-content:space-between;background:var(--sf);border-radius:11px;padding:11px 13px;border:1px solid var(--bd)}
.tgl{width:38px;height:21px;border-radius:99px;cursor:pointer;position:relative;transition:background .2s}
.tgl.on{background:linear-gradient(135deg,var(--pu),var(--pk))}.tgl.on-g{background:linear-gradient(135deg,var(--gn),#059669)}.tgl.off{background:rgba(255,255,255,.1)}
.tgd{position:absolute;top:3px;width:15px;height:15px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 2px 4px rgba(0,0,0,.3)}
.tgl.on .tgd,.tgl.on-g .tgd{left:20px}.tgl.off .tgd{left:3px}
.sbtn{width:100%;padding:13px;border:none;border-radius:13px;background:linear-gradient(135deg,var(--pu),var(--pk));color:#fff;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.5px}
.sbtn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(167,139,250,.28)}
.cbtn{width:100%;margin-top:8px;padding:11px;background:transparent;border:1px solid var(--bd);border-radius:12px;color:var(--mt);cursor:pointer;font-size:12px;font-family:'Outfit',sans-serif;transition:all .2s}
.cbtn:hover{border-color:var(--bd2);color:var(--tx)}

/* Alerts */
.alrt{border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start}
.alrt.warn{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2)}
.alrt.danger{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2)}
.alrt.ok{background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2)}
.alrt.info{background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2)}
.alrt-ico{font-size:18px;flex-shrink:0;margin-top:1px}
.alrt-title{font-size:12px;font-weight:700;margin-bottom:2px}
.alrt-text{font-size:11px;color:var(--mt);line-height:1.5}

/* Agenda card */
.vc{border-radius:16px;padding:14px;margin-bottom:9px;position:relative;overflow:hidden}
.vc::before{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:radial-gradient(circle,rgba(255,255,255,.07),transparent);border-radius:50%}
.vc-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:99px}

/* Month selector */
.month-sel{display:flex;align-items:center;justify-content:space-between;background:var(--sf);border-radius:12px;padding:10px 14px;margin-bottom:12px}
.mbtn{background:none;border:none;color:var(--mt);font-size:20px;cursor:pointer;padding:0 6px;line-height:1;transition:color .2s}
.mbtn:hover{color:var(--tx)}

/* Chat */
.chat-w{display:flex;flex-direction:column;height:calc(100svh - 160px)}
.desktop .chat-w{height:calc(100vh - 120px)}
.msgs{flex:1;overflow-y:auto;padding-bottom:10px}
.msg{margin-bottom:10px;display:flex}
.msg.u{justify-content:flex-end}.msg.a{justify-content:flex-start}
.bubble{max-width:82%;padding:10px 14px;border-radius:18px;font-size:13px;line-height:1.55}
.msg.u .bubble{background:linear-gradient(135deg,var(--pu),#8b5cf6);color:#fff;border-bottom-right-radius:4px}
.msg.a .bubble{background:var(--sf2);border:1px solid var(--bd);color:var(--tx);border-bottom-left-radius:4px}
.avy{width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,var(--pu),var(--pk));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;margin-right:6px;margin-top:1px}
.cin-row{display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--bd)}
.cin{flex:1;background:var(--sf);border:1px solid var(--bd2);border-radius:13px;padding:10px 13px;color:var(--tx);font-family:'Outfit',sans-serif;font-size:13px;outline:none;resize:none;transition:all .2s}
.cin:focus{border-color:rgba(167,139,250,.4)}
.send{width:42px;height:42px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pu),var(--pk));color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;transition:all .2s}
.send:hover{transform:scale(1.06)}.send:disabled{opacity:.4;cursor:not-allowed;transform:none}

/* Projection table */
.proj-row{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--sf);border:1px solid var(--bd);border-radius:12px;margin-bottom:6px}
.proj-month{font-size:12px;font-weight:700;min-width:80px}
.proj-bar-wrap{flex:1;height:6px;background:rgba(255,255,255,.05);border-radius:99px;overflow:hidden}
.proj-bar-fill{height:100%;border-radius:99px;transition:width .8s ease}
.proj-val{font-size:12px;font-weight:700;min-width:90px;text-align:right}

/* Misc */
.toast{position:fixed;top:68px;left:50%;transform:translateX(-50%);background:var(--sf2);border:1px solid rgba(167,139,250,.2);color:var(--tx);font-size:12px;font-weight:600;padding:7px 16px;border-radius:99px;z-index:200;white-space:nowrap;animation:tIn .3s ease;pointer-events:none}
@keyframes tIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.ld{display:flex;align-items:center;justify-content:center;padding:60px;color:var(--mt);font-size:13px;gap:8px}
.sp{width:16px;height:16px;border:2px solid rgba(167,139,250,.2);border-top-color:var(--pu);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.pt{font-size:19px;font-weight:800;letter-spacing:-.5px;margin-bottom:15px;background:linear-gradient(135deg,var(--pu),var(--pk));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.empty{text-align:center;padding:40px 20px;color:var(--mt);font-size:13px}
.divider{height:1px;background:var(--bd);margin:12px 0}
.tag-ok{color:var(--gn)}.tag-warn{color:var(--yw)}.tag-bad{color:var(--rd)}
`

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AuryMoney() {
  const isMobile = useIsMobile()
  const [tab, setTab]       = useState("dashboard")
  const [records, setRecs]  = useState([])
  const [loading, setLoad]  = useState(true)
  const [editId, setEditId] = useState(null)
  const [agMonth, setAgMonth] = useState(curMonth())
  const [form, setForm] = useState({
    type:"despesa", desc:"", value:"", category:"cartao",
    date:todayStr(), card:"nubank_l", shared:false, recorrente:false,
  })
  const [fType, setFType] = useState("todos")
  const [fCard, setFCard] = useState("todos")
  const [fCat,  setFCat]  = useState("todos")
  const [toast, setToast] = useState("")
  const [chat, setChat]   = useState([{
    role:"assistant",
    text:"Oi! Sou o Aury 💜 Estou aqui pra ajudar vocês a quitar tudo e começar a construir patrimônio. Posso analisar suas finanças, registrar lançamentos e traçar estratégias. Por onde começamos?",
  }])
  const [chatIn, setChatIn]     = useState("")
  const [chatLoad, setChatLoad] = useState(false)
  const chatEnd = useRef(null)

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }) }, [chat])
  useEffect(() => {
    const q = query(collection(db,"records"), orderBy("createdAt","desc"))
    return onSnapshot(q, snap => { setRecs(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoad(false) })
  }, [])

  // Auto-fill description when card+date changes
  useEffect(() => {
    if (form.type === "despesa" && form.category === "cartao" && form.card && form.date) {
      const desc = autoDesc(form.card, form.date)
      if (desc) setForm(f => ({...f, desc}))
    }
  }, [form.card, form.date, form.category, form.type])

  const showToast = m => { setToast(m); setTimeout(()=>setToast(""),2200) }
  const setF = (k,v) => setForm(f=>({...f,[k]:v}))

  // ── Core financials (casal conjunto) ────────────────────────────────────────
  const totalRec = useMemo(()=>records.filter(r=>r.type==="receita").reduce((a,b)=>a+b.value,0),[records])
  const totalExp = useMemo(()=>records.filter(r=>r.type==="despesa").reduce((a,b)=>a+b.value,0),[records])
  const saldo    = totalRec - totalExp
  const savePct  = totalRec>0 ? Math.min(100,Math.max(0,Math.round((saldo/totalRec)*100))) : 0

  // ── Month helpers ────────────────────────────────────────────────────────────
  const getMonthData = ym => {
    const rs  = records.filter(r=>r.date?.startsWith(ym))
    const rec = rs.filter(r=>r.type==="receita").reduce((a,b)=>a+b.value,0)
    const exp = rs.filter(r=>r.type==="despesa").reduce((a,b)=>a+b.value,0)
    return { rec, exp, saldo:rec-exp, count:rs.length }
  }

  const thisMonth  = curMonth()
  const tm         = getMonthData(thisMonth)
  const agData     = getMonthData(agMonth)

  // Saldo faltante do mês atual (quanto precisa de renda extra pra fechar no zero)
  const faltando = tm.saldo < 0 ? Math.abs(tm.saldo) : 0

  // ── 6-month history: abril (atual) na esquerda → novembro na direita ─────────
  const hist6 = useMemo(()=>{
    return Array.from({length:6},(_,i)=>{
      const ym = addMonths(thisMonth, -i)   // i=0=atual, i=1=mês anterior, etc
      const rs = records.filter(r=>r.date?.startsWith(ym))
      const rec = rs.filter(r=>r.type==="receita").reduce((a,b)=>a+b.value,0)
      const exp = rs.filter(r=>r.type==="despesa").reduce((a,b)=>a+b.value,0)
      return { ym, label:monthShort(ym), rec, exp, saldo:rec-exp }
    })
    // NÃO revertemos: i=0 (atual/abril) fica na esquerda
  },[records])

  // ── Projection: next 4 months ──────────────────────────────────────────────
  const projection = useMemo(()=>{
    // Recorrentes = todos os registros marcados como recorrente
    const recorrentes = records.filter(r=>r.type==="despesa"&&r.recorrente)
    const recorrenteRec = records.filter(r=>r.type==="receita"&&r.recorrente)

    // Média de avulsos nos últimos 3 meses com dados
    const last3 = [1,2,3].map(i=>{
      const ym = addMonths(thisMonth,-i)
      return records.filter(r=>r.date?.startsWith(ym)&&r.type==="despesa"&&!r.recorrente).reduce((a,b)=>a+b.value,0)
    }).filter(v=>v>0)
    const avgAvulso = last3.length>0 ? last3.reduce((a,b)=>a+b,0)/last3.length : 0

    const fixedExp = recorrentes.reduce((a,b)=>a+b.value,0)
    const fixedRec = recorrenteRec.reduce((a,b)=>a+b.value,0)

    return Array.from({length:4},(_,i)=>{
      const ym  = addMonths(thisMonth,i+1)
      // Use real data if exists, else project
      const real = getMonthData(ym)
      const projExp = real.exp > 0 ? real.exp : fixedExp + avgAvulso
      const projRec = real.rec > 0 ? real.rec : fixedRec
      return { ym, label:monthLabel(ym), projExp, projRec, saldo:projRec-projExp, hasReal:real.count>0 }
    })
  },[records])

  // ── Card balances ──────────────────────────────────────────────────────────
  const cardFaturaMonth = (cardKey, ym) =>
    records.filter(r=>r.date?.startsWith(ym)&&r.type==="despesa"&&(r.card===cardKey||r.bank===cardKey)).reduce((a,b)=>a+b.value,0)

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts = useMemo(()=>{
    const list = []
    Object.entries(CARDS).forEach(([k,c])=>{
      const days = daysUntil(c.venc)
      const fat  = cardFaturaMonth(k,thisMonth)
      if (days<=7&&fat>0) list.push({type:days<=3?"danger":"warn",ico:"💳",title:`Fatura ${c.name} (${c.owner}) vence em ${days}d`,text:`Gasto este mês: ${fmt(fat)}. Vencimento dia ${c.venc}.`})
      const daysFech = daysUntil(c.fech)
      if (daysFech<=3) list.push({type:"info",ico:"✂️",title:`Fatura ${c.name} (${c.owner}) fecha em ${daysFech}d`,text:`Dia ${c.fech}. Compras após essa data entram na próxima fatura.`})
    })
    if (faltando>0) list.push({type:"danger",ico:"🚨",title:`Mês atual no vermelho — faltam ${fmt(faltando)}`,text:`Precisam de ${fmt(faltando)} em receitas extras (freelas ou outro) pra fechar o mês no zero.`})
    if (totalRec>0&&totalExp/totalRec>0.8) list.push({type:"danger",ico:"⚠️",title:"Comprometimento crítico",text:`${Math.round((totalExp/totalRec)*100)}% da renda comprometida. Meta urgente: reduzir abaixo de 70%.`})
    else if (totalRec>0&&totalExp/totalRec>0.6) list.push({type:"warn",ico:"⚠️",title:"Atenção ao orçamento",text:`${Math.round((totalExp/totalRec)*100)}% comprometido. Meta: abaixo de 60%.`})
    if (savePct>=20) list.push({type:"ok",ico:"🎯",title:"Meta de poupança atingida!",text:`${savePct}% da renda poupada. Hora de começar a investir o excedente.`})
    return list
  },[records,thisMonth,totalRec,totalExp,savePct,faltando])

  // ── Filtered records ───────────────────────────────────────────────────────
  const filtered = useMemo(()=>records.filter(r=>
    (fType==="todos"||r.type===fType)&&
    (fCard==="todos"||r.card===fCard)&&
    (fCat ==="todos"||r.category===fCat)
  ),[records,fType,fCard,fCat])

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if(!form.desc||!form.value||!form.category||!form.card) return
    const entry = {...form, value:parseFloat(form.value), createdAt:serverTimestamp()}
    try {
      if(editId){
        await updateDoc(doc(db,"records",editId),{...form,value:parseFloat(form.value)})
        showToast("✓ Atualizado"); setEditId(null)
      } else {
        await addDoc(collection(db,"records"),entry)
        showToast("✓ Salvo e sincronizado 🔄")
      }
      setForm({type:"despesa",desc:"",value:"",category:"cartao",date:todayStr(),card:"nubank_l",shared:false,recorrente:false})
      setTab("registros")
    } catch { showToast("Erro ao salvar") }
  }

  function handleEdit(r) {
    setEditId(r.id)
    setForm({type:r.type,desc:r.desc,value:String(r.value),category:r.category,date:r.date,card:r.card||"nubank_l",shared:!!r.shared,recorrente:!!r.recorrente})
    setTab("adicionar")
  }
  async function handleDel(id){ await deleteDoc(doc(db,"records",id)); showToast("✓ Removido") }

  // ── Chat ───────────────────────────────────────────────────────────────────
  async function sendChat(){
    const msg=chatIn.trim(); if(!msg||chatLoad) return
    setChatIn("")
    const h=[...chat,{role:"user",text:msg}]; setChat(h); setChatLoad(true)
    const cardSum = Object.entries(CARDS).map(([k,c])=>`${c.name}(${c.owner}) vence dia ${c.venc}, fatura mês=${fmt(cardFaturaMonth(k,thisMonth))}`).join(" | ")
    const projSum = projection.map(p=>`${p.label}: exp ${fmt(p.projExp)}, rec ${fmt(p.projRec)}, saldo ${fmt(p.saldo)}`).join(" | ")
    const system = `Você é o Aury, assistente financeiro estratégico do casal Lenin e Evelyn. Meta principal: quitar todas as dívidas, depois poupar e investir.
Situação financeira conjunta: receitas totais ${fmt(totalRec)}, despesas totais ${fmt(totalExp)}, saldo ${fmt(saldo)}, poupança ${savePct}%.
Mês atual: receitas ${fmt(tm.rec)}, despesas ${fmt(tm.exp)}, saldo ${fmt(tm.saldo)}${faltando>0?`, FALTAM ${fmt(faltando)} para fechar no zero`:""}.
Cartões: ${cardSum}.
Projeção: ${projSum}.
Alertas: ${alerts.map(a=>a.title).join("; ")||"nenhum"}.
Seja direto, estratégico e empático. Dê conselhos reais e acionáveis focados em solvência.
Para REGISTRAR responda SOMENTE com JSON:
{"action":"add","type":"receita|despesa","desc":"...","value":0,"category":"cartao|pix|mensalidade|emprestimo|salario|freelance|investimento|outro","card":"nubank_l|inter_l|nubank_e|mercadopago_e|picpay_e","shared":false,"recorrente":false}`

    const messages=h.slice(-8).map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}))
    try {
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system,messages})})
      const data=await res.json()
      const text=data.text||"Não entendi 😅"
      const match=text.match(/\{[\s\S]*"action"\s*:\s*"add"[\s\S]*\}/)
      if(match){
        try{
          const p=JSON.parse(match[0])
          await addDoc(collection(db,"records"),{type:p.type,desc:p.desc,value:p.value,category:p.category,date:todayStr(),card:p.card||"nubank_l",shared:!!p.shared,recorrente:!!p.recorrente,createdAt:serverTimestamp()})
          setChat([...h,{role:"assistant",text:`✅ **${p.desc}** — ${fmt(p.value)} registrado${p.recorrente?" 🔄":""}`}])
        } catch { setChat([...h,{role:"assistant",text}]) }
      } else { setChat([...h,{role:"assistant",text}]) }
    } catch { setChat([...h,{role:"assistant",text:"Problema de conexão 😅"}]) }
    setChatLoad(false)
  }

  // ── RecItem ────────────────────────────────────────────────────────────────
  function RecItem({r}){
    const cardKey = r.card || r.bank
    const card=CARDS[cardKey], cat=CAT_MAP[r.category]
    return(
      <div className="ri">
        <div className="ric" style={{background:r.type==="receita"?"rgba(52,211,153,.1)":"rgba(248,113,113,.1)"}}>{cat?.emoji||"📌"}</div>
        <div className="rif">
          <div className="rdesc">{r.recorrente&&<span style={{color:"var(--gn)",marginRight:3,fontSize:10}}>↻</span>}{r.desc}</div>
          <div className="rmeta">
            <span>{r.date}</span>·
            {card&&<span className="pill" style={{background:card.color+"18",color:card.color}}>{card.name} · {card.owner}</span>}
            {cat&&<span className="pill" style={{background:CAT_COLOR[r.category]+"18",color:CAT_COLOR[r.category]}}>{cat.emoji} {cat.label}</span>}
            {r.shared&&<span className="pill" style={{background:"rgba(167,139,250,.1)",color:"var(--pu)"}}>Casal</span>}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div className="rval" style={{color:r.type==="receita"?"var(--gn)":"var(--rd)"}}>{r.type==="receita"?"+":"-"}{fmt(r.value)}</div>
          <div className="ras">
            <button className="ab e" onClick={()=>handleEdit(r)}>✏</button>
            <button className="ab d" onClick={()=>handleDel(r.id)}>✕</button>
          </div>
        </div>
      </div>
    )
  }

  const TABS=[
    {id:"dashboard",lbl:"Início",ico:"⬡"},
    {id:"agenda",   lbl:"Agenda", ico:"📅"},
    {id:"registros",lbl:"Registros",ico:"☰"},
    {id:"adicionar",lbl:editId?"Editar":"Novo",ico:"+"},
    {id:"chat",     lbl:"Aury IA",ico:"✦"},
  ]

  // ── Content renderer ───────────────────────────────────────────────────────
  function Content(){
    return(
      <div className={`content${isMobile?"":" with-sidebar"}`}>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&(loading?<div className="ld"><div className="sp"/>Carregando...</div>:<>

          {/* Hero saldo */}
          <div className="hero">
            <div className="h-lbl">Saldo do Casal</div>
            <div className={`h-val ${saldo>0?"pos":saldo<0?"neg":"warn"}`}>{fmt(saldo)}</div>
            <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:"var(--mt)"}}>Poupança atual:</span>
              <span style={{fontSize:12,fontWeight:700,color:savePct>=20?"var(--gn)":savePct>=10?"var(--yw)":"var(--rd)"}}>{savePct}%</span>
              <span style={{fontSize:10,color:"var(--mt)",marginLeft:"auto"}}>Meta: 20%</span>
            </div>
            <div className="pbar">
              <div className="pfill" style={{width:`${savePct}%`,background:savePct>=20?"linear-gradient(90deg,var(--gn),#059669)":savePct>=10?"linear-gradient(90deg,var(--yw),#d97706)":"linear-gradient(90deg,var(--rd),#dc2626)"}}/>
            </div>
          </div>

          {/* Totais */}
          <div className="g3">
            <div className="mc"><div className="ml">↑ Receitas</div><div className="mv" style={{color:"var(--gn)"}}>{fmt(totalRec)}</div></div>
            <div className="mc"><div className="ml">↓ Despesas</div><div className="mv" style={{color:"var(--rd)"}}>{fmt(totalExp)}</div></div>
            <div className="mc"><div className="ml">Saldo</div><div className="mv" style={{color:saldo>=0?"var(--gn)":"var(--rd)"}}>{fmt(saldo)}</div></div>
          </div>

          {/* Mês atual com saldo faltante */}
          <div className="card">
            <div className="sec">Mês atual — {monthLabel(thisMonth)}</div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[[tm.rec,"Receitas","var(--gn)"],[tm.exp,"Despesas","var(--rd)"],[tm.saldo,"Saldo",tm.saldo>=0?"var(--gn)":"var(--rd)"]].map(([v,l,c])=>(
                <div key={l} style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:10,padding:"9px 10px"}}>
                  <div style={{fontSize:9,color:"var(--mt)",marginBottom:3}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:c}}>{fmt(v)}</div>
                </div>
              ))}
            </div>
            {faltando>0&&(
              <div style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--rd)"}}>💸 Faltam para fechar o mês</div>
                  <div style={{fontSize:10,color:"var(--mt)",marginTop:2}}>Considere freelas ou renda extra</div>
                </div>
                <div style={{fontSize:18,fontWeight:800,color:"var(--rd)"}}>{fmt(faltando)}</div>
              </div>
            )}
          </div>

          {/* Alertas */}
          {alerts.length>0&&<>
            <div className="sec">Alertas</div>
            {alerts.slice(0,4).map((a,i)=>(
              <div key={i} className={`alrt ${a.type}`}>
                <div className="alrt-ico">{a.ico}</div>
                <div>
                  <div className="alrt-title" style={{color:a.type==="danger"?"var(--rd)":a.type==="warn"?"var(--yw)":a.type==="ok"?"var(--gn)":"var(--pu)"}}>{a.title}</div>
                  <div className="alrt-text">{a.text}</div>
                </div>
              </div>
            ))}
          </>}

          {/* Cartões */}
          <div className="sec">Cartões — vencimentos</div>
          <div className="bscroll">
            {Object.entries(CARDS).map(([k,c])=>{
              const fat=cardFaturaMonth(k,thisMonth), days=daysUntil(c.venc), urgent=days<=5&&fat>0
              return(
                <div key={k} className="bc" style={{background:c.bg,borderColor:urgent?"var(--rd)":c.color+"22"}} onClick={()=>setTab("agenda")}>
                  <div className="bl" style={{background:c.color+"18",color:c.color}}>{c.logo}</div>
                  <div className="bn">{c.name}</div>
                  <div className="bowner">{c.owner}</div>
                  <div className="bvc">Fecha {c.fech} · Vence {c.venc}</div>
                  <div className="bv" style={{color:urgent?"var(--rd)":fat>0?"var(--yw)":"var(--mt)"}}>{fat>0?fmt(fat):"—"}</div>
                  <div style={{fontSize:9,marginTop:2,color:urgent?"var(--rd)":days<=10?"var(--yw)":"var(--gn)"}}>{days}d para vencer</div>
                </div>
              )
            })}
          </div>

          {/* Evolução 6 meses */}
          <div className="card">
            <div className="sec">Evolução 6 meses</div>
            <BarPair data={hist6}/>
            <BarLabels data={hist6}/>
            <div style={{display:"flex",gap:14,marginTop:8}}>
              <span style={{fontSize:10,color:"var(--mt)",display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:"var(--gn)",display:"inline-block"}}/>Receitas
              </span>
              <span style={{fontSize:10,color:"var(--mt)",display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:"var(--rd)",display:"inline-block"}}/>Despesas
              </span>
            </div>
            {/* Linha total despesas */}
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--bd)"}}>
              <div style={{fontSize:9,color:"var(--rd)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6,fontWeight:700}}>Total de Despesas / Mês</div>
              <LineChart points={hist6.map(m=>({value:m.exp,label:m.label}))} color="#F87171" height={56}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                {hist6.map(m=>(
                  <div key={m.ym} style={{flex:1,textAlign:"center",fontSize:8,color:"rgba(255,255,255,.3)"}}>{m.label}</div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                {hist6.map(m=>(
                  <div key={m.ym} style={{flex:1,textAlign:"center",fontSize:8,color:m.exp>0?"var(--rd)":"rgba(255,255,255,.2)",fontWeight:600}}>{m.exp>0?fmt(m.exp).replace("R$","").trim():"-"}</div>
                ))}
              </div>
            </div>
            {/* Saldo mensal linha */}
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--bd)"}}>
              <div style={{fontSize:9,color:"var(--pu)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6,fontWeight:700}}>Saldo Mensal</div>
              <LineChart points={hist6.map(m=>({value:m.saldo,label:m.label}))} color="var(--pu)" height={50}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                {hist6.map(m=>(
                  <div key={m.ym} style={{flex:1,textAlign:"center",fontSize:8,color:"rgba(255,255,255,.3)"}}>{m.label}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Projeção próximos meses */}
          <div className="card" style={{background:"linear-gradient(135deg,#14142a,#1a0f30)",border:"1px solid rgba(167,139,250,.15)"}}>
            <div className="sec">Projeção — próximos 4 meses</div>
            {projection.map((p,i)=>{
              const maxVal = Math.max(...projection.map(x=>x.projExp),totalRec,1)
              const pct    = Math.min((p.projExp/maxVal)*100,100)
              const isRed  = p.saldo<0
              return(
                <div key={i} className="proj-row">
                  <div className="proj-month">
                    <div style={{fontSize:11,fontWeight:700}}>{p.label.split(" ")[0]}</div>
                    {p.hasReal&&<div style={{fontSize:8,color:"var(--gn)"}}>dados reais</div>}
                    {!p.hasReal&&<div style={{fontSize:8,color:"var(--mt)"}}>projeção</div>}
                  </div>
                  <div style={{flex:1}}>
                    <div className="proj-bar-wrap">
                      <div className="proj-bar-fill" style={{width:`${pct}%`,background:isRed?"var(--rd)":"linear-gradient(90deg,var(--pu),var(--pk))"}}/>
                    </div>
                    <div style={{fontSize:9,color:"var(--mt)",marginTop:2}}>
                      Desp: {fmt(p.projExp)} · Rec: {fmt(p.projRec)}
                    </div>
                  </div>
                  <div className="proj-val" style={{color:isRed?"var(--rd)":"var(--gn)"}}>
                    {isRed&&"−"}{fmt(Math.abs(p.saldo))}
                  </div>
                </div>
              )
            })}
            <div style={{fontSize:10,color:"var(--mt)",marginTop:8,lineHeight:1.5}}>
              * Projeção usa recorrentes + média de avulsos dos últimos 3 meses. Meses com dados reais são exibidos como registrado.
            </div>
          </div>

          {/* Donut resumo */}
          <div className="card" style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{position:"relative",flexShrink:0}}>
              <Donut pct={totalRec>0?(totalRec/(totalRec+totalExp))*100:50} color="var(--gn)"/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>
                {totalRec>0?Math.round((totalRec/(totalRec+totalExp))*100):0}%
              </div>
            </div>
            <div style={{flex:1,fontSize:11,lineHeight:2}}>
              <div style={{color:"var(--gn)"}}>● Receitas totais: {fmt(totalRec)}</div>
              <div style={{color:"var(--rd)"}}>● Despesas totais: {fmt(totalExp)}</div>
              <div style={{color:"var(--yw)"}}>● Mês atual despesas: {fmt(tm.exp)}</div>
              {faltando>0&&<div style={{color:"var(--rd)"}}>● Renda extra necessária: {fmt(faltando)}</div>}
              {saldo>0&&<div style={{color:"var(--pu)"}}>● Poupança acumulada: {fmt(saldo)}</div>}
            </div>
          </div>

        </>)}

        {/* ── AGENDA ── */}
        {tab==="agenda"&&<>
          <div className="pt">Agenda Financeira</div>

          <div className="month-sel">
            <button className="mbtn" onClick={()=>setAgMonth(addMonths(agMonth,-1))}>‹</button>
            <div style={{fontSize:13,fontWeight:700}}>{monthLabel(agMonth)}</div>
            <button className="mbtn" onClick={()=>setAgMonth(addMonths(agMonth,1))}>›</button>
          </div>

          {/* Resumo do mês selecionado */}
          <div className="g3">
            <div className="mc"><div className="ml">Receitas</div><div className="mv" style={{color:"var(--gn)"}}>{fmt(agData.rec)}</div></div>
            <div className="mc"><div className="ml">Despesas</div><div className="mv" style={{color:"var(--rd)"}}>{fmt(agData.exp)}</div></div>
            <div className="mc">
              <div className="ml">Saldo</div>
              <div className="mv" style={{color:agData.saldo>=0?"var(--gn)":"var(--rd)"}}>{fmt(agData.saldo)}</div>
            </div>
          </div>

          {agData.saldo<0&&(
            <div className="alrt danger">
              <div className="alrt-ico">🚨</div>
              <div>
                <div className="alrt-title" style={{color:"var(--rd)"}}>Mês no vermelho — faltam {fmt(Math.abs(agData.saldo))}</div>
                <div className="alrt-text">Precisam de renda extra pra fechar este mês no zero.</div>
              </div>
            </div>
          )}

          {/* Vencimentos */}
          <div className="sec">Vencimentos dos Cartões</div>
          {Object.entries(CARDS).map(([k,c])=>{
            const fat=cardFaturaMonth(k,agMonth), days=daysUntil(c.venc), urgent=days<=5&&fat>0
            return(
              <div key={k} className="vc" style={{background:c.bg,border:`1.5px solid ${urgent?"var(--rd)":c.color+"22"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{width:38,height:38,borderRadius:11,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:c.color}}>{c.logo}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{c.name} <span style={{fontSize:11,color:"var(--mt)"}}>· {c.owner}</span></div>
                      <div style={{fontSize:9,color:"var(--mt)"}}>Fecha dia {c.fech} · Vence dia {c.venc}</div>
                    </div>
                  </div>
                  <div className="vc-badge" style={{background:urgent?"rgba(248,113,113,.15)":days<=10?"rgba(251,191,36,.15)":"rgba(52,211,153,.15)",color:urgent?"var(--rd)":days<=10?"var(--yw)":"var(--gn)"}}>
                    {days}d
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {[["FATURA",fat,c.color],["VENCIMENTO","Dia "+c.venc,urgent?"var(--rd)":"var(--tx)"]].map(([l,v,cl])=>(
                    <div key={l} style={{flex:1,background:"rgba(255,255,255,.04)",borderRadius:9,padding:"7px 9px"}}>
                      <div style={{fontSize:8,color:"var(--mt)",marginBottom:2}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:700,color:cl}}>{typeof v==="number"?fmt(v):v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Alertas do mês */}
          {alerts.length>0&&<>
            <div className="sec" style={{marginTop:4}}>Avisos</div>
            {alerts.map((a,i)=>(
              <div key={i} className={`alrt ${a.type}`}>
                <div className="alrt-ico">{a.ico}</div>
                <div>
                  <div className="alrt-title" style={{color:a.type==="danger"?"var(--rd)":a.type==="warn"?"var(--yw)":a.type==="ok"?"var(--gn)":"var(--pu)"}}>{a.title}</div>
                  <div className="alrt-text">{a.text}</div>
                </div>
              </div>
            ))}
          </>}

          {/* Lançamentos do mês */}
          <div className="sec" style={{marginTop:4}}>Lançamentos — {monthLabel(agMonth)}</div>
          {records.filter(r=>r.date?.startsWith(agMonth)).length===0
            ?<div className="empty"><div style={{fontSize:32,marginBottom:8}}>📭</div>Nenhum lançamento neste mês</div>
            :records.filter(r=>r.date?.startsWith(agMonth)).map(r=>{
              const cat=CAT_MAP[r.category], card=CARDS[r.card]
              return(
                <div key={r.id} style={{display:"flex",gap:10,marginBottom:7}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:r.type==="receita"?"var(--gn)":"var(--rd)",marginTop:7,flexShrink:0}}/>
                    <div style={{width:1,flex:1,background:"var(--bd)",marginTop:2}}/>
                  </div>
                  <div style={{flex:1,background:"var(--sf)",borderRadius:12,padding:"9px 12px",border:"1px solid var(--bd)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.desc}</div>
                        <div style={{fontSize:9,color:"var(--mt)",marginTop:2,display:"flex",gap:6,flexWrap:"wrap"}}>
                          <span>{r.date}</span>
                          {card&&<span style={{color:card.color}}>{card.name} · {card.owner}</span>}
                          {cat&&<span style={{color:CAT_COLOR[r.category]}}>{cat.emoji} {cat.label}</span>}
                        </div>
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:r.type==="receita"?"var(--gn)":"var(--rd)",flexShrink:0,marginLeft:8}}>
                        {r.type==="receita"?"+":"-"}{fmt(r.value)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          }
        </>}

        {/* ── REGISTROS ── */}
        {tab==="registros"&&<>
          <div className="filters">
            {[["todos","Todos"],["receita","Receitas"],["despesa","Despesas"]].map(([v,l])=>(
              <button key={v} className={`fb ${fType===v?"on":""}`} onClick={()=>setFType(v)}>{l}</button>
            ))}
            {Object.entries(CARDS).map(([k,c])=>(
              <button key={k} className={`fb ${fCard===k?"on":""}`}
                style={fCard===k?{background:c.color,borderColor:"transparent"}:{}}
                onClick={()=>setFCard(fCard===k?"todos":k)}>{c.name} ({c.owner})</button>
            ))}
            {[...CATS.despesa,...CATS.receita].map(c=>(
              <button key={c.id} className={`fb ${fCat===c.id?"on":""}`} onClick={()=>setFCat(fCat===c.id?"todos":c.id)}>{c.emoji} {c.label.split("/")[0]}</button>
            ))}
          </div>
          {loading?<div className="ld"><div className="sp"/>Carregando...</div>
          :filtered.length===0?<div className="empty"><div style={{fontSize:32,marginBottom:8}}>📭</div>Nenhum registro</div>
          :<>
            {filtered.filter(r=>r.recorrente).length>0&&<>
              <div className="rgl">↻ Recorrentes — {fmt(filtered.filter(r=>r.recorrente).reduce((a,b)=>a+b.value,0))}</div>
              {filtered.filter(r=>r.recorrente).map(r=><RecItem key={r.id} r={r}/>)}
            </>}
            {filtered.filter(r=>!r.recorrente).length>0&&<>
              <div className="rgl">⚡ Avulsas</div>
              {filtered.filter(r=>!r.recorrente).map(r=><RecItem key={r.id} r={r}/>)}
            </>}
          </>}
        </>}

        {/* ── ADICIONAR / EDITAR ── */}
        {tab==="adicionar"&&<>
          <div className="pt">{editId?"Editar Registro":"Novo Registro"}</div>
          <div className="ttgl">
            {["despesa","receita"].map(t=>(
              <button key={t} className={`tb ${form.type===t?(t==="receita"?"on-r":"on-d"):""}`}
                onClick={()=>{setF("type",t);setF("category",t==="receita"?"salario":"cartao")}}>
                {t==="receita"?"↑ Receita":"↓ Despesa"}
              </button>
            ))}
          </div>
          <div style={{marginBottom:13}}>
            <label className="fl">Categoria</label>
            <div className="cat-grid">
              {CATS[form.type].map(c=>(
                <div key={c.id} className={`cat-opt ${form.category===c.id?"sel":""}`} onClick={()=>setF("category",c.id)}>
                  <div className="cat-em">{c.emoji}</div>
                  <div className="cat-nm">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label className="fl">Cartão / Banco</label>
            <div className="bgrid">
              {Object.entries(CARDS).map(([k,c])=>(
                <div key={k} className={`bo ${form.card===k?"sel":""}`}
                  style={form.card===k?{borderColor:c.color+"55",background:c.bg}:{}}
                  onClick={()=>setF("card",k)}>
                  <div className="bo-logo" style={{background:`${c.color}18`,color:c.color}}>{c.logo}</div>
                  <div className="bo-nm" style={form.card===k?{color:"var(--tx)"}:{}}>{c.name}<br/><span style={{fontSize:9,opacity:.6}}>{c.owner}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label className="fl">Data</label>
            <input className="fi" type="date" value={form.date} onChange={e=>setF("date",e.target.value)}/>
          </div>
          <div style={{marginBottom:12}}>
            <label className="fl">Descrição {form.category==="cartao"&&<span style={{fontSize:9,color:"var(--gn)",fontWeight:400}}>← gerada automaticamente</span>}</label>
            <input className="fi" placeholder="Descrição do lançamento..." value={form.desc} onChange={e=>setF("desc",e.target.value)}/>
          </div>
          <div style={{marginBottom:14}}>
            <label className="fl">Valor (R$)</label>
            <input className="fi" type="number" placeholder="0,00" value={form.value} onChange={e=>setF("value",e.target.value)}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            <div className="trow">
              <div><div style={{fontSize:13,fontWeight:600}}>Conta conjunta do casal</div><div style={{fontSize:10,color:"var(--mt)"}}>Lançamento compartilhado</div></div>
              <div className={`tgl ${form.shared?"on":"off"}`} onClick={()=>setF("shared",!form.shared)}><div className="tgd"/></div>
            </div>
            <div className="trow">
              <div><div style={{fontSize:13,fontWeight:600}}>↻ Se repete todo mês</div><div style={{fontSize:10,color:"var(--mt)"}}>Mensalidade, salário fixo etc.</div></div>
              <div className={`tgl ${form.recorrente?"on-g":"off"}`} onClick={()=>setF("recorrente",!form.recorrente)}><div className="tgd"/></div>
            </div>
          </div>
          <button className="sbtn" onClick={handleSave}>{editId?"💾 Salvar Alterações":"✦ Adicionar"}</button>
          {editId&&<button className="cbtn" onClick={()=>{setEditId(null);setForm({type:"despesa",desc:"",value:"",category:"cartao",date:todayStr(),card:"nubank_l",shared:false,recorrente:false})}}>Cancelar</button>}
        </>}

        {/* ── CHAT ── */}
        {tab==="chat"&&<>
          <div style={{marginBottom:12}}>
            <div className="pt">Aury IA</div>
            <div style={{fontSize:10,color:"var(--mt)"}}>Estratégia financeira · Powered by Claude</div>
          </div>
          <div style={{background:"linear-gradient(135deg,#16103a,#1a1240)",border:"1px solid rgba(167,139,250,.1)",borderRadius:12,padding:"10px 12px",marginBottom:11}}>
            <div style={{fontSize:11,color:"var(--mt)",lineHeight:1.6}}>
              💬 <span style={{color:"var(--pu)"}}>"paguei fatura Nubank Lenin de 450"</span> · <span style={{color:"var(--pk)"}}>"quanto falta pra fechar o mês?"</span> · <span style={{color:"var(--pu)"}}>"qual estratégia pra quitar tudo?"</span>
            </div>
          </div>
          <div className="chat-w">
            <div className="msgs">
              {chat.map((m,i)=>(
                <div key={i} className={`msg ${m.role==="user"?"u":"a"}`}>
                  {m.role==="assistant"&&<div className="avy">A</div>}
                  <div className="bubble">{m.text}</div>
                </div>
              ))}
              {chatLoad&&<div className="msg a"><div className="avy">A</div><div className="bubble" style={{color:"var(--mt)"}}>Pensando…</div></div>}
              <div ref={chatEnd}/>
            </div>
            <div className="cin-row">
              <textarea className="cin" rows={1} placeholder="Mensagem…" value={chatIn}
                onChange={e=>setChatIn(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat()}}}/>
              <button className="send" onClick={sendChat} disabled={chatLoad||!chatIn.trim()}>➤</button>
            </div>
          </div>
        </>}

      </div>
    )
  }

  // ── Desktop sidebar ────────────────────────────────────────────────────────
  function Sidebar(){
    return(
      <div className="sidebar">
        <div style={{fontSize:16,fontWeight:800,background:"linear-gradient(135deg,var(--pu),var(--pk))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:16,paddingLeft:14}}>Aury Money</div>
        {TABS.map(t=>(
          <button key={t.id} className={`sb-btn ${tab===t.id?"on":""}`} onClick={()=>{setTab(t.id);if(t.id!=="adicionar")setEditId(null)}}>
            <span className="sb-ico">{t.ico}</span>{t.lbl}
          </button>
        ))}
        <div style={{marginTop:"auto",paddingLeft:14,paddingTop:20}}>
          <div style={{fontSize:9,color:"var(--mt)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Financeiro</div>
          <div style={{fontSize:12,color:saldo>=0?"var(--gn)":"var(--rd)",fontWeight:700}}>{fmt(saldo)}</div>
          <div style={{fontSize:9,color:"var(--mt)"}}>saldo total</div>
          {faltando>0&&<>
            <div style={{fontSize:12,color:"var(--rd)",fontWeight:700,marginTop:8}}>{fmt(faltando)}</div>
            <div style={{fontSize:9,color:"var(--mt)"}}>faltam este mês</div>
          </>}
        </div>
      </div>
    )
  }

  return(
    <>
      <style>{CSS}</style>
      {toast&&<div className="toast">{toast}</div>}
      <div className={`app ${isMobile?"mobile":"desktop"}`}>
        <div className="ga"/><div className="gb"/>

        <header className="hdr">
          <div>
            <div className="logo">Aury Money</div>
            <div className="logo-sub"><span className="sync"/>Lenin & Evelyn · {isMobile?"📱":"🖥️"}</div>
          </div>
          <div className="avs">
            {!isMobile&&TABS.map(t=>(
              <button key={t.id} onClick={()=>{setTab(t.id);if(t.id!=="adicionar")setEditId(null)}}
                style={{background:tab===t.id?"linear-gradient(135deg,rgba(167,139,250,.15),rgba(244,114,182,.08))":"none",border:`1px solid ${tab===t.id?"rgba(167,139,250,.3)":"rgba(255,255,255,.08)"}`,borderRadius:10,padding:"6px 14px",color:tab===t.id?"var(--pu)":"var(--mt)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif",transition:"all .2s",display:"flex",alignItems:"center",gap:6}}>
                {t.ico} {t.lbl}
              </button>
            ))}
            <div style={{display:"flex",gap:5,marginLeft:isMobile?0:8}}>
              {[{k:"L",c:"#A78BFA"},{k:"Ev",c:"#F472B6"}].map((u,i)=>(
                <div key={i} className="av" style={{background:`${u.c}15`,borderColor:`${u.c}44`,color:u.c,fontSize:9}}>{u.k}</div>
              ))}
            </div>
          </div>
        </header>

        {!isMobile&&<Sidebar/>}
        <Content/>

        {isMobile&&(
          <nav className="nav">
            {TABS.map(t=>(
              <button key={t.id} className={`nb ${tab===t.id?"on":""}`} onClick={()=>{setTab(t.id);if(t.id!=="adicionar")setEditId(null)}}>
                <span className="nb-i" style={{color:tab===t.id?"var(--pu)":"rgba(255,255,255,.18)"}}>{t.ico}</span>
                <span className="nb-l">{t.lbl}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </>
  )
}
