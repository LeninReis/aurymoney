import { useState, useRef, useEffect, useMemo } from "react"
import { CreatureScene } from "./Creatures"
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
  const max = Math.max(...data.flatMap(d => [d.rec, d.exp]), 1)
  return (
    <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:90 }}>
      {data.map((d,i) => {
        const opacity = d.isFuture ? 0.4 : 1
        const glow    = d.isCurrent ? "0 0 8px rgba(167,139,250,.5)" : "none"
        return (
          <div key={i} style={{ flex:1, display:"flex", gap:2, alignItems:"flex-end", position:"relative" }}>
            {d.isCurrent && <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", fontSize:7, color:"var(--pu)", fontWeight:700, whiteSpace:"nowrap" }}>HOJE</div>}
            <div style={{ flex:1 }}>
              <div style={{ width:"100%", background:"#34D399", opacity, borderRadius:"3px 3px 0 0", height:`${(d.rec/max)*78}px`, minHeight:d.rec>0?3:0, transition:"height .7s cubic-bezier(.34,1.56,.64,1)", boxShadow:glow }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ width:"100%", background:"#F87171", opacity, borderRadius:"3px 3px 0 0", height:`${(d.exp/max)*78}px`, minHeight:d.exp>0?3:0, transition:"height .7s cubic-bezier(.34,1.56,.64,1)", boxShadow:glow }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BarLabels({ data }) {
  return (
    <div style={{ display:"flex", gap:4 }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, textAlign:"center", fontSize:8, color: d.isCurrent ? "var(--pu)" : d.isFuture ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.4)", paddingTop:3, fontWeight: d.isCurrent ? 700 : 400 }}>
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

  useEffect(() => {
    const q = query(collection(db,"records"), orderBy("createdAt","desc"))
    return onSnapshot(q, snap => { setRecs(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoad(false) })
  }, [])

  // Auto-fill descrição apenas quando trocar cartão ou data (não interfere com digitação)
  const prevCardRef = useRef(form.card)
  const prevDateRef = useRef(form.date)
  useEffect(() => {
    const cardChanged = form.card !== prevCardRef.current
    const dateChanged = form.date !== prevDateRef.current
    prevCardRef.current = form.card
    prevDateRef.current = form.date
    if ((cardChanged || dateChanged) && form.type === "despesa" && form.category === "cartao") {
      const desc = autoDesc(form.card, form.date)
      if (desc) setForm(f => ({...f, desc}))
    }
  }, [form.card, form.date])

  const showToast = m => { setToast(m); setTimeout(()=>setToast(""),2200) }
  const setF = (k,v) => setForm(f=>({...f,[k]:v}))

  // ── Core financials (casal conjunto) ────────────────────────────────────────
  const totalRec = useMemo(()=>records.filter(r=>r.type==="receita").reduce((a,b)=>a+Number(b.value||0),0),[records])
  const totalExp = useMemo(()=>records.filter(r=>r.type==="despesa").reduce((a,b)=>a+Number(b.value||0),0),[records])
  const saldo    = totalRec - totalExp
  const savePct  = totalRec>0 ? Math.min(100,Math.max(0,Math.round((saldo/totalRec)*100))) : 0

  // ── Month helpers ────────────────────────────────────────────────────────────
  const getMonthData = ym => {
    const rs  = records.filter(r=>r.date?.startsWith(ym))
    const rec = rs.filter(r=>r.type==="receita").reduce((a,b)=>a+Number(b.value||0),0)
    const exp = rs.filter(r=>r.type==="despesa").reduce((a,b)=>a+Number(b.value||0),0)
    return { rec, exp, saldo:rec-exp, count:rs.length }
  }

  // Calcula saldo acumulado até um determinado mês
  const getSaldoAcumuladoAte = (targetMonth) => {
    if(records.length === 0) return 0
    
    // Pega todos os meses com registros até o mês alvo, em ordem
    const allDates = records.map(r => r.date?.slice(0,7)).filter(Boolean).sort()
    const firstMonth = allDates[0]
    
    let saldoAcumulado = 0
    let ym = firstMonth
    
    // Acumula saldo de todos os meses até o targetMonth (inclusive)
    while(ym <= targetMonth) {
      const monthData = getMonthData(ym)
      saldoAcumulado += monthData.saldo
      ym = addMonths(ym, 1)
    }
    
    return saldoAcumulado
  }

  const thisMonth  = curMonth()
  const tm         = getMonthData(thisMonth)
  const agData     = getMonthData(agMonth)
  const agSaldoAcumulado = getSaldoAcumuladoAte(agMonth) // Saldo acumulado até o mês da agenda
  
  // ── Estados do Simulador Alquimista ──────────────────────────────────────────
  const [simReceita, setSimReceita] = useState(0)
  const [simDespesa, setSimDespesa] = useState(0)

  // Atualizar simulador quando tm mudar
  useEffect(()=>{
    setSimReceita(tm.rec || 0)
    setSimDespesa(tm.exp || 0)
  },[tm.rec, tm.exp])

  // Saldo faltante do mês atual (quanto precisa de renda extra pra fechar no zero)
  const faltando = tm.saldo < 0 ? Math.abs(tm.saldo) : 0

  // ── Janela dinâmica: do primeiro ao último mês com registros ─────────────────
  const hist6 = useMemo(()=>{
    if(records.length===0) return []
    const dates = records.map(r=>r.date?.slice(0,7)).filter(Boolean).sort()
    const first = dates[0]
    const last  = dates[dates.length-1]
    const result = []
    let ym = first
    while(ym <= last){
      const rs  = records.filter(r=>r.date?.startsWith(ym))
      const rec = rs.filter(r=>r.type==="receita").reduce((a,b)=>a+Number(b.value||0),0)
      const exp = rs.filter(r=>r.type==="despesa").reduce((a,b)=>a+Number(b.value||0),0)
      result.push({ ym, label:monthShort(ym), rec, exp, saldo:rec-exp, isCurrent:ym===thisMonth, isFuture:ym>thisMonth })
      ym = addMonths(ym,1)
    }
    return result
  },[records])

  // ── Projection: do mês seguinte ao atual até o último mês com registro ───────
  const projection = useMemo(()=>{
    if(records.length===0) return []
    const fixedExp = records.filter(r=>r.type==="despesa"&&r.recorrente).reduce((a,b)=>a+Number(b.value||0),0)
    const fixedRec = records.filter(r=>r.type==="receita"&&r.recorrente).reduce((a,b)=>a+Number(b.value||0),0)

    const lastMonth = records.map(r=>r.date?.slice(0,7)).filter(Boolean).sort().reverse()[0]
    const result = []
    let ym = addMonths(thisMonth,1)
    let saldoAcumulado = tm.saldo // Começa com o saldo do mês atual
    
    while(ym <= lastMonth){
      const rs      = records.filter(r=>r.date?.startsWith(ym))
      const realExp = rs.filter(r=>r.type==="despesa").reduce((a,b)=>a+Number(b.value||0),0)
      const realRec = rs.filter(r=>r.type==="receita").reduce((a,b)=>a+Number(b.value||0),0)
      const hasReal = rs.length>0
      const projExp = hasReal ? realExp : fixedExp
      const projRec = hasReal ? realRec : fixedRec
      
      // Calcula o saldo do mês e acumula
      const saldoMes = projRec - projExp
      saldoAcumulado += saldoMes
      
      result.push({ 
        ym, 
        label: monthLabel(ym), 
        projExp, 
        projRec, 
        saldo: saldoMes,
        saldoAcumulado: saldoAcumulado, // Saldo acumulado até este mês
        hasReal 
      })
      ym = addMonths(ym,1)
    }
    return result
  },[records, thisMonth, tm.saldo])

  // ── Card balances ──────────────────────────────────────────────────────────
  const cardFaturaMonth = (cardKey, ym) =>
    records.filter(r=>r.date?.startsWith(ym)&&r.type==="despesa"&&(r.card===cardKey||r.bank===cardKey)).reduce((a,b)=>a+Number(b.value||0),0)

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
  const filtered = useMemo(()=>records.filter(r=>{
    const cardKey  = r.card || r.bank || ""
    const bankName = CARDS[cardKey]?.name || ""
    const owner    = CARDS[cardKey]?.owner || ""
    const bankMatch  = fCard==="todos" || bankName===fCard || owner===fCard
    return (fType==="todos"||r.type===fType) && bankMatch && (fCat==="todos"||r.category===fCat)
  }),[records,fType,fCard,fCat])

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if(!form.desc||!form.value||!form.category||!form.card) return
    const entry = {...form, value:parseFloat(form.value), createdAt:serverTimestamp()}
    try {
      if(editId){
        await updateDoc(doc(db,"records",editId),{...form,value:parseFloat(form.value)})
        showToast("✓ Atualizado"); setEditId(null)
      } else {
        // Salva o registro atual
        await addDoc(collection(db,"records"),entry)
        
        // Se for recorrente, cria registros para os próximos 12 meses
        if(form.recorrente) {
          const baseDate = new Date(form.date)
          const baseDay = baseDate.getDate()
          
          for(let i = 1; i <= 12; i++) {
            const futureDate = new Date(baseDate)
            futureDate.setMonth(futureDate.getMonth() + i)
            
            // Ajusta para o último dia do mês se necessário (ex: 31 de jan -> 28/29 de fev)
            const maxDay = new Date(futureDate.getFullYear(), futureDate.getMonth() + 1, 0).getDate()
            futureDate.setDate(Math.min(baseDay, maxDay))
            
            const futureEntry = {
              ...entry,
              date: futureDate.toISOString().slice(0, 10),
              createdAt: serverTimestamp()
            }
            
            await addDoc(collection(db,"records"), futureEntry)
          }
          showToast("✓ Registro recorrente criado para 12 meses! 🔄")
        } else {
          showToast("✓ Salvo e sincronizado 🔄")
        }
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
    {id:"alquimia", lbl:"Alquimia",ico:"🔮"},
    {id:"agenda",   lbl:"Agenda", ico:"📅"},
    {id:"registros",lbl:"Registros",ico:"☰"},
    {id:"adicionar",lbl:editId?"Editar":"Novo",ico:"+"},
    {id:"jardim",   lbl:"Criaturas",ico:"✨"},
  ]

  // ── Content JSX ────────────────────────────────────────────────────────────
  const contentJSX = (
    <>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&(loading?<div className="ld"><div className="sp"/>Carregando...</div>:<>

          {/* Cards principais: Total Receitas e Total Despesas */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:16}}>
            {/* Saldo do Mês Atual */}
            <div style={{background:"linear-gradient(135deg,rgba(52,211,153,.1),rgba(16,185,129,.05))",border:"1px solid rgba(52,211,153,.25)",borderRadius:16,padding:20}}>
              <div style={{fontSize:11,color:"rgba(52,211,153,.8)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8,fontWeight:600}}>💰 Saldo · {monthLabel(thisMonth)}</div>
              <div style={{fontSize:36,fontWeight:800,color:tm.saldo>=0?"var(--gn)":"var(--rd)",lineHeight:1,marginBottom:8}}>{fmt(tm.saldo)}</div>
              <div style={{fontSize:10,color:"var(--mt)",marginBottom:12}}>mês atual</div>
              <div className="pbar">
                <div className="pfill" style={{width:`${Math.min(100,Math.abs(tm.saldo/50))}%`,background:tm.saldo>=0?"linear-gradient(90deg,var(--gn),#059669)":"linear-gradient(90deg,var(--rd),#dc2626)"}}/>
              </div>
            </div>

            {/* % Gasto do Mês Atual */}
            <div style={{background:"linear-gradient(135deg,rgba(248,113,113,.1),rgba(239,68,68,.05))",border:"1px solid rgba(248,113,113,.25)",borderRadius:16,padding:20}}>
              <div style={{fontSize:11,color:"rgba(248,113,113,.8)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8,fontWeight:600}}>📊 % Gasto · {monthLabel(thisMonth)}</div>
              <div style={{fontSize:36,fontWeight:800,color:tm.rec>0&&(tm.exp/tm.rec)<0.7?"var(--gn)":tm.rec>0&&(tm.exp/tm.rec)<0.85?"var(--yw)":"var(--rd)",lineHeight:1,marginBottom:8}}>{tm.rec>0?Math.round((tm.exp/tm.rec)*100):0}%</div>
              <div style={{fontSize:10,color:"var(--mt)",marginBottom:12}}>mês atual</div>
              <div className="pbar">
                <div className="pfill" style={{width:`${tm.rec>0?Math.min(100,(tm.exp/tm.rec)*100):0}%`,background:tm.rec>0&&(tm.exp/tm.rec)<0.7?"linear-gradient(90deg,var(--gn),#059669)":tm.rec>0&&(tm.exp/tm.rec)<0.85?"linear-gradient(90deg,var(--yw),#f59e0b)":"linear-gradient(90deg,var(--rd),#dc2626)"}}/>
              </div>
            </div>
          </div>

          {/* Mês vigente — visão hierárquica */}
          <div className="card" style={{background:"linear-gradient(135deg,#0f0f20,#141428)",border:"1px solid rgba(167,139,250,.12)",marginBottom:10}}>
            <div className="sec" style={{marginBottom:12}}>📅 Mês Vigente — {monthLabel(thisMonth)}</div>

            {/* Linha 1: Receitas / Despesas / Saldo */}
            <div className="g3" style={{marginBottom:10}}>
              <div className="mc"><div className="ml">↑ Receitas</div><div className="mv" style={{color:"var(--gn)"}}>{fmt(tm.rec)}</div></div>
              <div className="mc"><div className="ml">↓ Despesas</div><div className="mv" style={{color:"var(--rd)"}}>{fmt(tm.exp)}</div></div>
              <div className="mc"><div className="ml">Saldo</div><div className="mv" style={{color:tm.saldo>=0?"var(--gn)":"var(--rd)"}}>{fmt(tm.saldo)}</div></div>
            </div>

            {/* Linha 2: % do mês vigente em destaque */}
            {(()=>{
              const pctMes   = tm.rec>0 ? Math.round((tm.exp/tm.rec)*100) : 0
              const corMes   = pctMes<60?"var(--gn)":pctMes<80?"var(--yw)":"var(--rd)"
              const statusMes= pctMes<60?"Ótimo 🎉":pctMes<70?"Bom ✅":pctMes<80?"Atenção ⚠️":"Crítico 🚨"
              return(
                <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div>
                      <div style={{fontSize:9,color:"var(--mt)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:2}}>% Gasto / Receita · Mês Atual</div>
                      <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                        <div style={{fontSize:28,fontWeight:800,color:corMes,lineHeight:1}}>{pctMes}%</div>
                        <div style={{fontSize:11,fontWeight:700,color:corMes}}>{statusMes}</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:9,color:"var(--mt)",marginBottom:2}}>Meta</div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--gn)"}}>60%</div>
                    </div>
                  </div>
                  <div style={{background:"rgba(255,255,255,.06)",borderRadius:99,height:8,overflow:"hidden",position:"relative"}}>
                    <div style={{background:`linear-gradient(90deg,var(--gn),${corMes})`,width:`${Math.min(100,pctMes)}%`,height:"100%",borderRadius:99,transition:"width 1s ease",boxShadow:`0 0 8px ${corMes}`}}/>
                    <div style={{position:"absolute",top:0,left:"60%",width:2,height:"100%",background:"rgba(255,255,255,.3)"}}/>
                    <div style={{position:"absolute",top:0,left:"80%",width:2,height:"100%",background:"rgba(248,113,113,.5)"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"rgba(255,255,255,.3)",marginTop:3}}>
                    <span>0%</span><span style={{color:"var(--gn)"}}>60% meta</span><span style={{color:"var(--rd)"}}>80% risco</span><span>100%</span>
                  </div>
                </div>
              )
            })()}

            {/* Linha 3: Total Receitas e Total Despesas com % */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.2)",borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"rgba(52,211,153,.9)",marginBottom:4,fontWeight:600,letterSpacing:0.5}}>↑ TOTAL RECEITAS</div>
                <div style={{fontSize:18,fontWeight:800,color:"var(--gn)",marginBottom:2}}>{fmt(totalRec)}</div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(52,211,153,.7)",marginTop:2}}>
                  {totalRec>0?Math.round((totalRec/(totalRec+totalExp))*100):0}% do total
                </div>
              </div>
              <div style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"rgba(248,113,113,.9)",marginBottom:4,fontWeight:600,letterSpacing:0.5}}>↓ TOTAL DESPESAS</div>
                <div style={{fontSize:18,fontWeight:800,color:"var(--rd)",marginBottom:2}}>{fmt(totalExp)}</div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(248,113,113,.7)",marginTop:2}}>
                  {totalExp>0?Math.round((totalExp/(totalRec+totalExp))*100):0}% do total
                </div>
              </div>
            </div>

            {faltando>0&&(
              <div style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
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
            <div className="sec">Visão 6 meses — 3 passados · atual · 2 futuros</div>
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
            {/* Linha total despesas — começa do primeiro mês com dados */}
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--bd)"}}>
              <div style={{fontSize:9,color:"var(--rd)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6,fontWeight:700}}>Total de Despesas / Mês</div>
              {(()=>{
                const withData = hist6.filter(m=>m.exp>0)
                if(withData.length===0) return <div style={{fontSize:11,color:"var(--mt)"}}>Nenhuma despesa registrada ainda</div>
                return(<>
                  <LineChart points={withData.map(m=>({value:m.exp,label:m.label}))} color="#F87171" height={56}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    {withData.map(m=>(
                      <div key={m.ym} style={{flex:1,textAlign:"center",fontSize:8,color:m.isCurrent?"var(--pu)":m.isFuture?"rgba(255,255,255,.25)":"rgba(255,255,255,.4)",fontWeight:m.isCurrent?700:400}}>{m.label}</div>
                    ))}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    {withData.map(m=>(
                      <div key={m.ym} style={{flex:1,textAlign:"center",fontSize:8,color:"var(--rd)",fontWeight:600}}>{fmt(m.exp).replace("R$\u00a0","").replace("R$ ","").trim()}</div>
                    ))}
                  </div>
                </>)
              })()}
            </div>
            {/* Saldo mensal linha — começa do primeiro mês com dados */}
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--bd)"}}>
              <div style={{fontSize:9,color:"var(--pu)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6,fontWeight:700}}>Saldo Mensal</div>
              {(()=>{
                const withData = hist6.filter(m=>m.rec>0||m.exp>0)
                if(withData.length===0) return <div style={{fontSize:11,color:"var(--mt)"}}>Nenhum dado ainda</div>
                return(<>
                  <LineChart points={withData.map(m=>({value:m.saldo,label:m.label}))} color="var(--pu)" height={50}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    {withData.map(m=>(
                      <div key={m.ym} style={{flex:1,textAlign:"center",fontSize:8,color:m.isCurrent?"var(--pu)":m.isFuture?"rgba(255,255,255,.25)":"rgba(255,255,255,.4)",fontWeight:m.isCurrent?700:400}}>{m.label}</div>
                    ))}
                  </div>
                </>)
              })()}
            </div>
          </div>

          {/* Projeção próximos meses */}
          <div className="card" style={{background:"linear-gradient(135deg,#14142a,#1a0f30)",border:"1px solid rgba(167,139,250,.15)"}}>
            <div className="sec">Projeção — saldo acumulado mês a mês</div>
            {projection.map((p,i)=>{
              const maxVal = Math.max(...projection.map(x=>x.projExp),totalRec,1)
              const pct    = Math.min((p.projExp/maxVal)*100,100)
              const isRed  = p.saldoAcumulado < 0
              const [mes, ano] = p.label.split(" ")
              return(
                <div key={i} className="proj-row">
                  <div className="proj-month">
                    <div style={{fontSize:11,fontWeight:700}}>{mes}</div>
                    <div style={{fontSize:8,color:"var(--mt)"}}>{ano}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div className="proj-bar-wrap">
                      <div className="proj-bar-fill" style={{width:`${pct}%`,background:isRed?"var(--rd)":"linear-gradient(90deg,var(--pu),var(--pk))"}}/>
                    </div>
                    <div style={{fontSize:9,color:"var(--mt)",marginTop:2}}>
                      Desp: {fmt(p.projExp)} · Rec: {fmt(p.projRec)}
                    </div>
                  </div>
                  <div className="proj-val">
                    <div style={{fontSize:10,color:"var(--mt)",marginBottom:2}}>
                      {p.hasReal ? "Real" : "Projeção"}
                    </div>
                    <div style={{color:isRed?"var(--rd)":"var(--gn)",fontWeight:700}}>
                      {isRed&&"−"}{fmt(Math.abs(p.saldoAcumulado))}
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{fontSize:10,color:"var(--mt)",marginTop:8,lineHeight:1.5,padding:"8px 12px",background:"rgba(167,139,250,.05)",borderRadius:8}}>
              💡 <strong>Saldo acumulado:</strong> Considera o saldo do mês anterior + receitas - despesas do mês atual. Meses com dados reais usam valores exatos; meses futuros projetam apenas recorrentes cadastrados.
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
        {/* ── DASHBOARD ALQUIMISTA ── */}
        {tab==="alquimia"&&<>
          <div style={{marginBottom:16}}>
            <div className="pt">🔮 Laboratório do Alquimista</div>
            <div style={{fontSize:11,color:"var(--mt)",lineHeight:1.6}}>
              Transforme suas finanças em ouro através da alquimia estratégica ⚗️✨
            </div>
          </div>

          {/* Indicador % de Gastos — Visão do Mês */}
          {(()=>{
            const taxaMes = tm.rec>0?(tm.exp/tm.rec)*100:0
            const taxaAcum = totalRec>0?(totalExp/totalRec)*100:0
            const corMes = taxaMes<60?"var(--gn)":taxaMes<80?"var(--yw)":"var(--rd)"
            const corAcum = taxaAcum<60?"var(--gn)":taxaAcum<80?"var(--yw)":"var(--rd)"
            const statusMes = taxaMes<60?"Excelente 🎉":taxaMes<70?"Bom ✅":taxaMes<80?"Atenção ⚠️":"Crítico 🚨"
            return(
              <div style={{background:"linear-gradient(135deg,#0c1a2e,#0f2040)",border:"2px solid rgba(56,189,248,.25)",borderRadius:20,padding:20,marginBottom:16}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:1.5,marginBottom:12}}>⚡ TERMÔMETRO DE ECONOMIA</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginBottom:6}}>Gasto / Receita · Mês Atual</div>
                    <div style={{fontSize:40,fontWeight:800,color:corMes,lineHeight:1}}>{taxaMes.toFixed(0)}%</div>
                    <div style={{fontSize:11,fontWeight:700,color:corMes,marginTop:4}}>{statusMes}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginBottom:6}}>Gasto / Receita · Acumulado</div>
                    <div style={{fontSize:40,fontWeight:800,color:corAcum,lineHeight:1}}>{taxaAcum.toFixed(0)}%</div>
                    <div style={{fontSize:11,fontWeight:700,color:corAcum,marginTop:4}}>{taxaAcum<60?"Ótimo 🎉":taxaAcum<80?"Regular ⚠️":"Crítico 🚨"}</div>
                  </div>
                </div>
                <div style={{background:"rgba(0,0,0,.3)",borderRadius:99,height:12,overflow:"hidden",position:"relative",marginBottom:8}}>
                  <div style={{background:`linear-gradient(90deg,var(--gn),${corMes})`,height:"100%",width:`${Math.min(100,taxaMes)}%`,borderRadius:99,transition:"width 1s ease",boxShadow:`0 0 16px ${corMes}`}}/>
                  {/* Marcadores de meta */}
                  <div style={{position:"absolute",top:0,left:"60%",width:2,height:"100%",background:"rgba(255,255,255,.4)"}}/>
                  <div style={{position:"absolute",top:0,left:"80%",width:2,height:"100%",background:"rgba(248,113,113,.5)"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,.5)"}}>
                  <span>0%</span><span style={{color:"var(--gn)"}}>60% meta</span><span style={{color:"var(--rd)"}}>80% crítico</span><span>100%</span>
                </div>
              </div>
            )
          })()}

          {/* Nível do Alquimista */}
          {(()=>{
            const niveis = [
              {min:0,max:500,nome:"Aprendiz",rank:"🎓",cor:"#9E9E9E",desc:"Aprendendo os fundamentos"},
              {min:500,max:1500,nome:"Iniciado",rank:"⭐",cor:"#8BC34A",desc:"Dominando o básico"},
              {min:1500,max:3000,nome:"Praticante",rank:"✨",cor:"#03A9F4",desc:"Habilidades em evolução"},
              {min:3000,max:5000,nome:"Mestre",rank:"🔮",cor:"#9C27B0",desc:"Conhecimento profundo"},
              {min:5000,max:8000,nome:"Arquimago",rank:"🌟",cor:"#FF9800",desc:"Poder extraordinário"},
              {min:8000,max:999999,nome:"Grão-Mestre",rank:"👑",cor:"#FFD700",desc:"Sabedoria infinita"}
            ]
            
            const saldoMes = Math.max(0, tm.saldo)
            const nivel = niveis.find(n=>saldoMes>=n.min&&saldoMes<n.max)||niveis[niveis.length-1]
            const nIdx = niveis.indexOf(nivel)
            const prog = nivel.max===999999?100:Math.min(100,((saldoMes-nivel.min)/(nivel.max-nivel.min))*100)
            const prox = nIdx<niveis.length-1?niveis[nIdx+1]:null
            
            return(
              <div style={{background:"linear-gradient(135deg,#1a0033,#2d1b4e)",border:"2px solid rgba(156,39,176,.3)",borderRadius:20,padding:24,marginBottom:16,position:"relative",overflow:"hidden"}}>
                {/* Partículas mágicas */}
                <div style={{position:"absolute",inset:0,opacity:.15}}>
                  {Array.from({length:20}).map((_,i)=>(
                    <div key={i} style={{position:"absolute",width:2+Math.random()*4,height:2+Math.random()*4,background:nivel.cor,borderRadius:"50%",left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,animation:`sparkle ${2+Math.random()*3}s ease-in-out infinite`,animationDelay:`${Math.random()*2}s`,boxShadow:`0 0 10px ${nivel.cor}`}}/>
                  ))}
                </div>
                
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                    <div style={{fontSize:48,filter:"drop-shadow(0 4px 12px rgba(156,39,176,.6))"}}>🧙‍♂️</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginBottom:4}}>SEU POSTO</div>
                      <div style={{fontSize:28,fontWeight:800,color:nivel.cor,textShadow:`0 0 20px ${nivel.cor}`,marginBottom:4}}>{nivel.rank} {nivel.nome}</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.7)"}}>{nivel.desc}</div>
                    </div>
                  </div>
                  
                  <div style={{marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>{prox?`Próximo posto: ${prox.nome}`:"✨ Grau Máximo Alcançado!"}</span>
                    <span style={{fontSize:12,fontWeight:700,color:nivel.cor}}>{Math.round(prog)}%</span>
                  </div>
                  
                  <div style={{background:"rgba(0,0,0,.4)",borderRadius:99,height:12,overflow:"hidden",border:"1px solid rgba(156,39,176,.3)"}}>
                    <div style={{background:`linear-gradient(90deg,${nivel.cor},${nivel.cor}dd)`,height:"100%",width:`${prog}%`,borderRadius:99,transition:"width 1s ease",boxShadow:`0 0 20px ${nivel.cor}`,position:"relative"}}>
                      <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)",animation:"shimmer 2s infinite"}}/>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Poções Mágicas (Análises Rápidas) */}
          <div className="card" style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:"1px solid rgba(3,169,244,.2)",marginBottom:16}}>
            <div className="sec">⚗️ Poções da Sabedoria</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
              
              {/* Poção do Acúmulo */}
              <div style={{background:"linear-gradient(135deg,rgba(52,211,153,.12),rgba(52,211,153,.05))",border:"1.5px solid rgba(52,211,153,.3)",borderRadius:16,padding:16,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,background:"radial-gradient(circle,rgba(52,211,153,.2),transparent)",borderRadius:"50%"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:32,marginBottom:8,filter:"drop-shadow(0 2px 8px rgba(52,211,153,.6))"}}>💰</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#34D399",marginBottom:4}}>Poção do Acúmulo</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginBottom:12}}>Saldo acumulado no mês atual</div>
                  {(()=>{
                    const meta = 1000
                    const prog = Math.min(100,(tm.saldo/meta)*100)
                    const cor  = tm.saldo<=0?"#F44336":tm.saldo<500?"#FF9800":tm.saldo<meta?"#8BC34A":"#34D399"
                    const status = tm.saldo<=0?"Mês no vermelho 🚨":tm.saldo<500?"Acumulando 📈":tm.saldo<meta?"Quase lá ✨":"Meta atingida 🎉"
                    return(<>
                      <div style={{fontSize:24,fontWeight:800,color:cor,marginBottom:4}}>{fmt(tm.saldo)}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginBottom:10}}>Meta mensal: <strong style={{color:"#34D399"}}>{fmt(meta)}</strong> · <strong style={{color:cor}}>{status}</strong></div>
                      <div style={{background:"rgba(0,0,0,.3)",borderRadius:99,height:6,position:"relative"}}>
                        <div style={{background:`linear-gradient(90deg,${cor},${cor}dd)`,width:`${Math.max(0,prog)}%`,height:"100%",borderRadius:99,boxShadow:`0 0 8px ${cor}`,transition:"width 1s ease"}}/>
                        <div style={{position:"absolute",top:0,left:"100%",marginLeft:-2,width:2,height:"100%",background:"rgba(52,211,153,.4)"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,.4)",marginTop:4}}>
                        <span>R$ 0</span><span style={{color:"#34D399"}}>meta R$ 1k</span>
                      </div>
                    </>)
                  })()}
                </div>
              </div>

              {/* Poção da Contenção */}
              <div style={{background:"linear-gradient(135deg,rgba(255,193,7,.12),rgba(255,193,7,.05))",border:"1.5px solid rgba(255,193,7,.3)",borderRadius:16,padding:16,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,background:"radial-gradient(circle,rgba(255,193,7,.2),transparent)",borderRadius:"50%"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:32,marginBottom:8,filter:"drop-shadow(0 2px 8px rgba(255,193,7,.6))"}}>⚗️</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#FFC107",marginBottom:4}}>Poção da Contenção</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginBottom:12}}>Meta: reduzir % de gasto sobre receita</div>
                  {(()=>{
                    const taxaAtual = tm.rec>0?(tm.exp/tm.rec)*100:0
                    const meta = 60
                    const distancia = taxaAtual - meta
                    const cor = taxaAtual<=meta?"#4CAF50":taxaAtual<=75?"#FF9800":"#F44336"
                    const economiaNecessaria = tm.rec>0?Math.max(0,tm.exp-(tm.rec*(meta/100))):0
                    return(<>
                      <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
                        <div style={{fontSize:28,fontWeight:800,color:cor}}>{taxaAtual.toFixed(1)}%</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>/ meta {meta}%</div>
                      </div>
                      <div style={{background:"rgba(0,0,0,.3)",borderRadius:99,height:8,marginBottom:8}}>
                        <div style={{background:`linear-gradient(90deg,${cor},${cor}dd)`,width:`${Math.min(100,taxaAtual)}%`,height:"100%",borderRadius:99,boxShadow:`0 0 8px ${cor}`}}/>
                        <div style={{position:"relative",top:-8,left:`${meta}%`,width:2,height:8,background:"rgba(255,255,255,.5)",borderRadius:99}}/>
                      </div>
                      {distancia>0
                        ?<div style={{fontSize:10,color:"rgba(255,255,255,.6)"}}>Economize <strong style={{color:"#FFC107"}}>{fmt(economiaNecessaria)}</strong> a mais pra bater a meta</div>
                        :<div style={{fontSize:10,color:"#4CAF50",fontWeight:700}}>✅ Meta de contenção atingida!</div>
                      }
                    </>)
                  })()}
                </div>
              </div>

              {/* Poção do Equilíbrio */}
              <div style={{background:"linear-gradient(135deg,rgba(156,39,176,.12),rgba(156,39,176,.05))",border:"1.5px solid rgba(156,39,176,.3)",borderRadius:16,padding:16,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,background:"radial-gradient(circle,rgba(156,39,176,.2),transparent)",borderRadius:"50%"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:32,marginBottom:8,filter:"drop-shadow(0 2px 8px rgba(156,39,176,.6))"}}>🍷</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#9C27B0",marginBottom:4}}>Poção do Equilíbrio</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginBottom:12}}>Distribuição de gastos por categoria</div>
                  {(()=>{
                    const gastosPorCat = {}
                    records.filter(r=>r.date?.startsWith(thisMonth)&&r.type==="despesa").forEach(r=>{
                      gastosPorCat[r.category] = (gastosPorCat[r.category]||0) + Number(r.value||0)
                    })
                    const topCat = Object.entries(gastosPorCat).sort((a,b)=>b[1]-a[1])[0]
                    const catLabel = topCat?CAT_MAP[topCat[0]]?.label||topCat[0]:"Nenhuma"
                    const catValue = topCat?topCat[1]:0
                    const pct = tm.exp>0?(catValue/tm.exp)*100:0
                    return(<>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.8)",marginBottom:8}}>Maior gasto: <strong style={{color:"#9C27B0"}}>{catLabel}</strong></div>
                      <div style={{fontSize:20,fontWeight:800,color:"#9C27B0",marginBottom:8}}>{fmt(catValue)}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.6)"}}>{pct.toFixed(1)}% dos gastos totais</div>
                    </>)
                  })()}
                </div>
              </div>

              {/* Poção da Visão */}
              <div style={{background:"linear-gradient(135deg,rgba(3,169,244,.12),rgba(3,169,244,.05))",border:"1.5px solid rgba(3,169,244,.3)",borderRadius:16,padding:16,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,background:"radial-gradient(circle,rgba(3,169,244,.2),transparent)",borderRadius:"50%"}}/>
                <div style={{position:"relative",zIndex:1}}>
                  <div style={{fontSize:32,marginBottom:8,filter:"drop-shadow(0 2px 8px rgba(3,169,244,.6))"}}>🔮</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#03A9F4",marginBottom:4}}>Poção da Visão</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginBottom:12}}>Tendência dos últimos 3 meses</div>
                  {(()=>{
                    const ultimos3 = [addMonths(thisMonth,-2),addMonths(thisMonth,-1),thisMonth].map(m=>getMonthData(m).saldo)
                    const tendencia = ultimos3[2]-ultimos3[0]
                    const cor = tendencia>0?"#4CAF50":tendencia<0?"#F44336":"#FF9800"
                    const emoji = tendencia>0?"📈":tendencia<0?"📉":"📊"
                    return(<>
                      <div style={{fontSize:32,marginBottom:8}}>{emoji}</div>
                      <div style={{fontSize:20,fontWeight:800,color:cor,marginBottom:8}}>{tendencia>0?"+":""}{fmt(tendencia)}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.6)"}}>
                        {tendencia>0?"Melhorando!":tendencia<0?"Precisa atenção":"Estável"}
                      </div>
                    </>)
                  })()}
                </div>
              </div>

            </div>
          </div>

          {/* Grimório de Conquistas */}
          <div className="card" style={{background:"linear-gradient(135deg,#2d1b4e,#1a0033)",border:"1px solid rgba(255,215,0,.2)",marginBottom:16}}>
            <div className="sec">📖 Grimório de Conquistas</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginBottom:16}}>12 medalhas — do iniciante ao lendário. Desbloqueie com suas conquistas financeiras reais.</div>
            
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12}}>
              
              {/* 1. Primeira Semente — salvar qualquer coisa no mês */}
              {(()=>{
                const conquistada = tm.saldo > 0
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(76,175,80,.15),rgba(76,175,80,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(76,175,80,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative",overflow:"hidden"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(76,175,80,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(76,175,80,.6))":"grayscale(1) opacity(.3)"}}>🌱</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#4CAF50":"rgba(255,255,255,.4)",marginBottom:4}}>Primeira Semente</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>Fechar o mês no positivo</div>
                  </div>
                )
              })()}

              {/* 2. Mês Zerado — fechar sem déficit */}
              {(()=>{
                const conquistada = faltando===0&&tm.rec>0
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(56,189,248,.15),rgba(56,189,248,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(56,189,248,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(56,189,248,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(56,189,248,.6))":"grayscale(1) opacity(.3)"}}>⚡</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#38BDF8":"rgba(255,255,255,.4)",marginBottom:4}}>Mês Zerado</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>Fechar sem déficit este mês</div>
                  </div>
                )
              })()}

              {/* 3. Escudo de 70% — gastos abaixo de 70% da renda */}
              {(()=>{
                const conquistada = tm.rec>0&&(tm.exp/tm.rec)<0.7
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(3,169,244,.15),rgba(3,169,244,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(3,169,244,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(3,169,244,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(3,169,244,.6))":"grayscale(1) opacity(.3)"}}>🛡️</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#03A9F4":"rgba(255,255,255,.4)",marginBottom:4}}>Escudo de Aço</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>Gastos {"<"} 70% da renda</div>
                  </div>
                )
              })()}

              {/* 4. Guardião da Meta — gastos abaixo de 60% */}
              {(()=>{
                const conquistada = tm.rec>0&&(tm.exp/tm.rec)<0.6
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(0,200,150,.15),rgba(0,200,150,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(0,200,150,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative",overflow:"hidden"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(0,200,150,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(0,200,150,.6))":"grayscale(1) opacity(.3)"}}>🏆</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#00C896":"rgba(255,255,255,.4)",marginBottom:4}}>Guardião da Meta</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>Gastos {"<"} 60% da renda</div>
                  </div>
                )
              })()}

              {/* 5. Poupador de R$ 500 no mês */}
              {(()=>{
                const conquistada = tm.saldo >= 500
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(52,211,153,.15),rgba(52,211,153,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(52,211,153,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(52,211,153,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(52,211,153,.6))":"grayscale(1) opacity(.3)"}}>🌿</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"var(--gn)":"rgba(255,255,255,.4)",marginBottom:4}}>Poupador Inicial</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>R$ 500 de saldo no mês</div>
                  </div>
                )
              })()}

              {/* 6. Acumulador de R$ 1.000 no mês */}
              {(()=>{
                const conquistada = tm.saldo >= 1000
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(156,39,176,.15),rgba(156,39,176,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(156,39,176,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(156,39,176,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(156,39,176,.6))":"grayscale(1) opacity(.3)"}}>💎</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#9C27B0":"rgba(255,255,255,.4)",marginBottom:4}}>Acumulador</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>R$ 1.000 de saldo no mês</div>
                  </div>
                )
              })()}

              {/* 7. Sequência de Ouro — saldo positivo por 3 meses seguidos */}
              {(()=>{
                const ultimos3 = [addMonths(thisMonth,-2),addMonths(thisMonth,-1),thisMonth].map(m=>getMonthData(m).saldo)
                const conquistada = ultimos3.every(s=>s>0)
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(255,152,0,.15),rgba(255,152,0,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(255,152,0,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(255,152,0,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(255,152,0,.6))":"grayscale(1) opacity(.3)"}}>🔥</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#FF9800":"rgba(255,255,255,.4)",marginBottom:4}}>Sequência de Ouro</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>Saldo + por 3 meses seguidos</div>
                  </div>
                )
              })()}

              {/* 8. Receita Dominante — receita 2x maior que despesa */}
              {(()=>{
                const conquistada = tm.exp>0&&tm.rec>=tm.exp*2
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(251,191,36,.15),rgba(251,191,36,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(251,191,36,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(251,191,36,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(251,191,36,.6))":"grayscale(1) opacity(.3)"}}>🚀</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"var(--yw)":"rgba(255,255,255,.4)",marginBottom:4}}>Receita Dominante</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>Receita 2× maior que despesa</div>
                  </div>
                )
              })()}

              {/* 9. Mestre Alquimista — R$ 3.000 no mês */}
              {(()=>{
                const conquistada = tm.saldo >= 3000
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(255,193,7,.15),rgba(255,193,7,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(255,193,7,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(255,193,7,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(255,193,7,.6))":"grayscale(1) opacity(.3)"}}>👑</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#FFC107":"rgba(255,255,255,.4)",marginBottom:4}}>Mestre Alquimista</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>R$ 3.000 de saldo no mês</div>
                  </div>
                )
              })()}

              {/* 10. Cofre Mágico — R$ 5.000 acumulados */}
              {(()=>{
                const conquistada = agSaldoAcumulado>=5000
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(244,114,182,.15),rgba(244,114,182,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(244,114,182,.4)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(244,114,182,.3),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(244,114,182,.6))":"grayscale(1) opacity(.3)"}}>🏦</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#F472B6":"rgba(255,255,255,.4)",marginBottom:4}}>Cofre Mágico</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>R$ 5.000 acumulados no total</div>
                  </div>
                )
              })()}

              {/* 11. Arquiteto da Riqueza — R$ 10.000 acumulados */}
              {(()=>{
                const conquistada = agSaldoAcumulado>=10000
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(167,139,250,.2),rgba(167,139,250,.05))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(167,139,250,.5)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(167,139,250,.4),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(167,139,250,.8))":"grayscale(1) opacity(.3)"}}>💫</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"var(--pu)":"rgba(255,255,255,.4)",marginBottom:4}}>Arquiteto da Riqueza</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>R$ 10.000 acumulados no total</div>
                  </div>
                )
              })()}

              {/* 12. Lendário — acumulado de R$ 25.000 */}
              {(()=>{
                const conquistada = agSaldoAcumulado>=25000
                return(
                  <div style={{background:conquistada?"linear-gradient(135deg,rgba(255,215,0,.2),rgba(255,140,0,.08))":"rgba(255,255,255,.03)",border:`1.5px solid ${conquistada?"rgba(255,215,0,.5)":"rgba(255,255,255,.1)"}`,borderRadius:14,padding:14,textAlign:"center",position:"relative",overflow:"hidden"}}>
                    {conquistada&&<div style={{position:"absolute",top:-10,right:-10,width:40,height:40,background:"radial-gradient(circle,rgba(255,215,0,.4),transparent)",borderRadius:"50%",animation:"pulse 2s infinite"}}/>}
                    <div style={{fontSize:36,marginBottom:8,filter:conquistada?"drop-shadow(0 2px 8px rgba(255,215,0,.8))":"grayscale(1) opacity(.3)"}}>🌟</div>
                    <div style={{fontSize:11,fontWeight:700,color:conquistada?"#FFD700":"rgba(255,255,255,.4)",marginBottom:4}}>Lendário</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>R$ 25.000 acumulados no total</div>
                  </div>
                )
              })()}

            </div>

            {/* Barra de progresso geral */}
            {(()=>{
              const total = 12
              const conquistadas = [
                tm.saldo>0,
                faltando===0&&tm.rec>0,
                tm.rec>0&&(tm.exp/tm.rec)<0.7,
                tm.rec>0&&(tm.exp/tm.rec)<0.6,
                tm.saldo>=500,
                tm.saldo>=1000,
                [addMonths(thisMonth,-2),addMonths(thisMonth,-1),thisMonth].map(m=>getMonthData(m).saldo).every(s=>s>0),
                tm.exp>0&&tm.rec>=tm.exp*2,
                tm.saldo>=3000,
                agSaldoAcumulado>=5000,
                agSaldoAcumulado>=10000,
                agSaldoAcumulado>=25000,
              ].filter(Boolean).length
              return(
                <div style={{marginTop:16,padding:"12px 14px",background:"rgba(255,215,0,.05)",border:"1px solid rgba(255,215,0,.12)",borderRadius:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)"}}>Progresso do Grimório</span>
                    <span style={{fontSize:12,fontWeight:800,color:"#FFD700"}}>{conquistadas}/{total}</span>
                  </div>
                  <div style={{background:"rgba(255,255,255,.07)",borderRadius:99,height:8,overflow:"hidden"}}>
                    <div style={{background:"linear-gradient(90deg,#FFD700,#FFA000)",width:`${(conquistadas/total)*100}%`,height:"100%",borderRadius:99,boxShadow:"0 0 10px rgba(255,215,0,.5)",transition:"width 1s ease"}}/>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Caldeirão de Transmutação removido conforme solicitado */}
          {false&&<>
          <div className="card" style={{background:"linear-gradient(135deg,#16213e,#0f1419)",border:"1px solid rgba(255,152,0,.2)"}}>
            <div className="sec">🔥 Caldeirão de Transmutação</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginBottom:16}}>Simule cenários e descubra o potencial oculto</div>
            
            {(()=>{
              const simSaldo = simReceita - simDespesa
              const economy = tm.saldo - simSaldo
              
              return(<>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:20}}>
                  
                  <div>
                    <label style={{fontSize:11,color:"rgba(255,255,255,.7)",marginBottom:8,display:"block"}}>💰 Receitas Mensais</label>
                    <input 
                      type="range" 
                      min="0" 
                      max={tm.rec*2}
                      step="100"
                      value={simReceita}
                      onChange={e=>setSimReceita(Number(e.target.value))}
                      style={{width:"100%",marginBottom:8}}
                    />
                    <div style={{fontSize:16,fontWeight:700,color:"#4CAF50"}}>{fmt(simReceita)}</div>
                  </div>
                  
                  <div>
                    <label style={{fontSize:11,color:"rgba(255,255,255,.7)",marginBottom:8,display:"block"}}>💸 Despesas Mensais</label>
                    <input 
                      type="range" 
                      min="0" 
                      max={tm.exp*1.5}
                      step="100"
                      value={simDespesa}
                      onChange={e=>setSimDespesa(Number(e.target.value))}
                      style={{width:"100%",marginBottom:8}}
                    />
                    <div style={{fontSize:16,fontWeight:700,color:"#F44336"}}>{fmt(simDespesa)}</div>
                  </div>
                  
                </div>
                
                <div style={{background:"linear-gradient(135deg,rgba(255,152,0,.15),rgba(255,152,0,.05))",border:"1.5px solid rgba(255,152,0,.3)",borderRadius:16,padding:20,textAlign:"center"}}>
                  <div style={{fontSize:48,marginBottom:12,filter:"drop-shadow(0 4px 12px rgba(255,152,0,.6))"}}>⚗️</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.7)",marginBottom:8}}>Resultado da Transmutação</div>
                  <div style={{fontSize:32,fontWeight:800,color:simSaldo>=0?"#4CAF50":"#F44336",marginBottom:16}}>{fmt(simSaldo)}</div>
                  
                  {economy !== 0 && (
                    <div style={{fontSize:12,color:"rgba(255,255,255,.8)",padding:"12px 16px",background:"rgba(0,0,0,.3)",borderRadius:12,border:"1px solid rgba(255,152,0,.2)"}}>
                      {economy > 0 ? (
                        <>🎯 Você precisa <strong style={{color:"#4CAF50"}}>economizar {fmt(Math.abs(economy))}</strong> para alcançar este cenário!</>
                      ) : (
                        <>✨ Você teria <strong style={{color:"#FF9800"}}>gastado {fmt(Math.abs(economy))} a mais</strong> neste cenário</>
                      )}
                    </div>
                  )}
                </div>
              </>)
            })()}
          </div>

          </>}

          <style>{`
            @keyframes sparkle{0%,100%{opacity:0;transform:translateY(0) scale(0)}50%{opacity:1;transform:translateY(-20px) scale(1)}}
            @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
            @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:.7}}
          `}</style>

        </>}
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
              <div className="ml">% Gasto</div>
              <div className="mv" style={{color:agData.rec>0&&(agData.exp/agData.rec)<0.7?"var(--gn)":agData.rec>0&&(agData.exp/agData.rec)<0.85?"var(--yw)":"var(--rd)"}}>
                {agData.rec>0?Math.round((agData.exp/agData.rec)*100):0}%
              </div>
            </div>
          </div>

          {/* Card de Saldo Acumulado */}
          <div className="hero" style={{marginTop:12}}>
            <div style={{position:"relative",zIndex:1}}>
              <div className="h-lbl">💰 Saldo Acumulado até {monthLabel(agMonth)}</div>
              <div className={`h-val ${agSaldoAcumulado>=0?"pos":"neg"}`}>{fmt(agSaldoAcumulado)}</div>
              <div style={{fontSize:11,color:"var(--mt)",marginTop:6,lineHeight:1.5}}>
                {agSaldoAcumulado >= 0 
                  ? "Dinheiro que você terá disponível neste mês considerando todos os meses anteriores 🎉"
                  : "Déficit acumulado até este mês — precisa de renda extra para zerar 🚨"
                }
              </div>
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
            {["Nubank","Inter","Mercado Pago","PicPay"].map(name=>{
              const color = Object.values(CARDS).find(c=>c.name===name)?.color
              return (
                <button key={name} className={`fb ${fCard===name?"on":""}`}
                  style={fCard===name?{background:color,borderColor:"transparent"}:{}}
                  onClick={()=>setFCard(fCard===name?"todos":name)}>{name}</button>
              )
            })}
            {["Lenin","Evelyn"].map(owner=>(
              <button key={owner} className={`fb ${fCard===owner?"on":""}`}
                style={fCard===owner?{background:owner==="Lenin"?"#A78BFA":"#F472B6",borderColor:"transparent"}:{}}
                onClick={()=>setFCard(fCard===owner?"todos":owner)}>{owner}</button>
            ))}
            {[...CATS.despesa,...CATS.receita].map(c=>(
              <button key={c.id} className={`fb ${fCat===c.id?"on":""}`} onClick={()=>setFCat(fCat===c.id?"todos":c.id)}>{c.emoji} {c.label.split("/")[0]}</button>
            ))}
          </div>
          {loading?<div className="ld"><div className="sp"/>Carregando...</div>
          :filtered.length===0?<div className="empty"><div style={{fontSize:32,marginBottom:8}}>📭</div>Nenhum registro</div>
          :<>
            {filtered.filter(r=>r.recorrente).length>0&&<>
              <div className="rgl">↻ Recorrentes — {fmt(filtered.filter(r=>r.recorrente).reduce((a,b)=>a+Number(b.value||0),0))}</div>
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

{tab==="jardim"&&<>
  <div style={{marginBottom:20}}>
    <div className="pt" style={{background:"linear-gradient(135deg,#A78BFA,#F472B6,#FBBF24)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:22}}>✨ Centro de Criaturas Místicas</div>
    <div style={{fontSize:11,color:"var(--mt)",lineHeight:1.6}}>
      Suas criaturas mágicas evoluem conforme sua prosperidade cresce 🐉🦉🐱🔥
    </div>
  </div>

  {(()=>{
    const saldoMes = Math.max(0, tm.saldo)
    
    // Sistema de criaturas
    const criaturas = [
      {
        nome: "Dragão",
        estagios: [
          {min:0,    max:500,  nome:"Ovo de Dragão",    emoji:"🥚", poder:0,   cor:"#9CA3AF", cor2:"#6B7280", desc:"Aguardando o calor..."},
          {min:500,  max:1500, nome:"Filhote de Dragão",emoji:"🦎", poder:15,  cor:"#F59E0B", cor2:"#D97706", desc:"Soltando faíscas"},
          {min:1500, max:3500, nome:"Dragão Juvenil",   emoji:"🐲", poder:45,  cor:"#EF4444", cor2:"#DC2626", desc:"Voando alto"},
          {min:3500, max:999999,nome:"Dragão Ancião",   emoji:"🐉", poder:100, cor:"#7C3AED", cor2:"#6D28D9", desc:"Guardião supremo"}
        ]
      },
      {
        nome: "Coruja",
        estagios: [
          {min:0,    max:400,  nome:"Ovo de Coruja",   emoji:"🥚", poder:0,   cor:"#9CA3AF", cor2:"#6B7280", desc:"No ninho quente"},
          {min:400,  max:1200, nome:"Corujinha",       emoji:"🐣", poder:12,  cor:"#A78BFA", cor2:"#8B5CF6", desc:"Aprendendo a voar"},
          {min:1200, max:2800, nome:"Coruja Sábia",    emoji:"🦉", poder:40,  cor:"#6366F1", cor2:"#4F46E5", desc:"Vê no escuro"},
          {min:2800, max:999999,nome:"Coruja Mística", emoji:"🔮", poder:85,  cor:"#14B8A6", cor2:"#0D9488", desc:"Portal da sabedoria"}
        ]
      },
      {
        nome: "Gato",
        estagios: [
          {min:0,    max:300,  nome:"Ovo Felino",    emoji:"🥚", poder:0,   cor:"#9CA3AF", cor2:"#6B7280", desc:"Ronronando"},
          {min:300,  max:1000, nome:"Gatinho",       emoji:"🐱", poder:10,  cor:"#F472B6", cor2:"#EC4899", desc:"Brincalhão"},
          {min:1000, max:2500, nome:"Gato Mágico",   emoji:"😺", poder:35,  cor:"#8B5CF6", cor2:"#7C3AED", desc:"Traz sorte"},
          {min:2500, max:999999,nome:"Gato Cósmico", emoji:"🌟", poder:75,  cor:"#F59E0B", cor2:"#D97706", desc:"Entre dimensões"}
        ]
      },
      {
        nome: "Fênix",
        estagios: [
          {min:0,    max:800,  nome:"Cinzas",         emoji:"🌫️", poder:0,   cor:"#9CA3AF", cor2:"#6B7280", desc:"Renascimento"},
          {min:800,  max:2000, nome:"Chama Nascente", emoji:"🕯️", poder:20,  cor:"#FBBF24", cor2:"#F59E0B", desc:"Primeira chama"},
          {min:2000, max:4000, nome:"Fênix Flamejante",emoji:"🔥", poder:60,  cor:"#EF4444", cor2:"#DC2626", desc:"Fogo sagrado"},
          {min:4000, max:999999,nome:"Fênix Imortal",  emoji:"✨", poder:120, cor:"#F97316", cor2:"#EA580C", desc:"Eternidade"}
        ]
      }
    ]

    const criaturasEvoluidas = criaturas.map(criatura => {
      const estagio = criatura.estagios.find(e => saldoMes >= e.min && saldoMes < e.max) || criatura.estagios[criatura.estagios.length - 1]
      const estagioIdx = criatura.estagios.indexOf(estagio)
      const progresso = estagio.max === 999999 ? 100 : Math.min(100, ((saldoMes - estagio.min) / (estagio.max - estagio.min)) * 100)
      const proximoEstagio = estagioIdx < criatura.estagios.length - 1 ? criatura.estagios[estagioIdx + 1] : null
      
      return { ...criatura, estagio, estagioIdx, progresso, proximoEstagio }
    })

    // Cenários
    const cenarios = [
      {min:0,    max:1000, nome:"Caverna dos Sonhos",  emoji:"🕳️", bg:"linear-gradient(135deg,#1e1b4b,#0f172a)", desc:"Refúgio tranquilo"},
      {min:1000, max:2500, nome:"Floresta Encantada",  emoji:"🌲", bg:"linear-gradient(135deg,#064e3b,#022c22)", desc:"Sussurros antigos"},
      {min:2500, max:4500, nome:"Vale das Estrelas",   emoji:"⭐", bg:"linear-gradient(135deg,#1e3a8a,#1e40af)", desc:"Céu tocando a terra"},
      {min:4500, max:999999,nome:"Palácio de Cristal", emoji:"🏰", bg:"linear-gradient(135deg,#581c87,#6b21a8)", desc:"Reino da prosperidade"}
    ]
    
    const cenario = cenarios.find(c => saldoMes >= c.min && saldoMes < c.max) || cenarios[cenarios.length - 1]
    const cenarioIdx = cenarios.indexOf(cenario)
    const progCenario = cenario.max === 999999 ? 100 : Math.min(100, ((saldoMes - cenario.min) / (cenario.max - cenario.min)) * 100)
    const proxCenario = cenarioIdx < cenarios.length - 1 ? cenarios[cenarioIdx + 1] : null

    return(
      <>
        {/* Ambiente Interativo com Criaturas */}
        <CreatureHabitat 
          criaturas={criaturasEvoluidas}
          cenario={cenario}
          saldoMes={saldoMes}
        />

        {/* Barra de progresso do cenário */}
        <div style={{background:"rgba(17,24,39,.95)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:20,marginTop:20,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#A78BFA",marginBottom:12,textAlign:"center"}}>
            🏰 {cenario.nome}
          </div>
          {proxCenario && (
            <>
              <div style={{background:"rgba(0,0,0,.4)",borderRadius:99,height:10,overflow:"hidden",marginBottom:8,border:"1px solid rgba(255,255,255,.1)"}}>
                <div style={{background:"linear-gradient(90deg,#FCD34D,#F59E0B)",width:`${progCenario}%`,height:"100%",borderRadius:99,boxShadow:"0 0 15px #F59E0B",transition:"width 1s ease"}}/>
              </div>
              <div style={{fontSize:10,textAlign:"center",color:"rgba(255,255,255,.7)",fontWeight:600}}>
                Faltam {fmt(proxCenario.min - saldoMes)} para {proxCenario.emoji} {proxCenario.nome}
              </div>
            </>
          )}
          {!proxCenario && (
            <div style={{fontSize:12,textAlign:"center",color:"#FCD34D",fontWeight:800}}>✨ Reino Máximo! ✨</div>
          )}
        </div>

        {/* Grid de Criaturas */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:16,marginBottom:20}}>
          {criaturasEvoluidas.map((criatura) => (
            <div key={criatura.nome} style={{
              background:"linear-gradient(135deg,rgba(17,24,39,.95),rgba(31,41,55,.9))",
              border:`2px solid ${criatura.estagio.cor}`,
              borderRadius:20,
              padding:20,
              position:"relative",
              overflow:"hidden",
              boxShadow:`0 8px 32px ${criatura.estagio.cor}60`,
              transition:"transform 0.3s ease",
              cursor:"pointer"
            }}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-4px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}
            >
              {/* Aura */}
              <div style={{
                position:"absolute",
                inset:-30,
                background:`radial-gradient(circle, ${criatura.estagio.cor}20 0%, transparent 70%)`,
                animation:"pulse 3s ease-in-out infinite"
              }}/>
              
              <div style={{position:"relative",zIndex:1}}>
                {/* Criatura SVG Animada */}
                <div style={{marginBottom:16}}>
                  <CreatureScene 
                    creature={criatura.nome} 
                    stage={criatura.estagio}
                    color={criatura.estagio.cor}
                    color2={criatura.estagio.cor2 || criatura.estagio.cor}
                  />
                </div>
                
                {/* Nome */}
                <div style={{textAlign:"center",marginBottom:12,padding:"10px 14px",background:`${criatura.estagio.cor}20`,borderRadius:12,border:`1px solid ${criatura.estagio.cor}40`}}>
                  <div style={{fontSize:16,fontWeight:800,color:criatura.estagio.cor,marginBottom:4,letterSpacing:0.5}}>
                    {criatura.estagio.nome}
                  </div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.7)",fontStyle:"italic"}}>
                    {criatura.estagio.desc}
                  </div>
                </div>

                {/* Barra de Poder */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:"var(--mt)",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{display:"flex",alignItems:"center",gap:4}}>⚡ <span style={{fontWeight:600}}>Poder</span></span>
                    <span style={{fontWeight:800,fontSize:15,color:criatura.estagio.cor,textShadow:`0 0 10px ${criatura.estagio.cor}`}}>{criatura.estagio.poder}</span>
                  </div>
                  <div style={{background:"rgba(0,0,0,.6)",borderRadius:99,height:8,overflow:"hidden",border:"1px solid rgba(255,255,255,.1)"}}>
                    <div style={{background:`linear-gradient(90deg,${criatura.estagio.cor},${criatura.estagio.cor}dd)`,width:`${criatura.estagio.poder}%`,height:"100%",borderRadius:99,boxShadow:`0 0 15px ${criatura.estagio.cor}`,transition:"width 1s ease"}}/>
                  </div>
                </div>

                {/* Progresso */}
                {criatura.proximoEstagio ? (
                  <div style={{background:"rgba(16,185,129,.12)",borderRadius:12,padding:"10px 12px",border:"1px solid rgba(16,185,129,.3)"}}>
                    <div style={{fontSize:10,color:"#6EE7B7",marginBottom:6,fontWeight:600}}>
                      🌟 Próxima: {criatura.proximoEstagio.nome}
                    </div>
                    <div style={{background:"rgba(0,0,0,.4)",borderRadius:99,height:6,overflow:"hidden",marginBottom:6}}>
                      <div style={{background:"linear-gradient(90deg,#10B981,#34D399)",width:`${criatura.progresso}%`,height:"100%",borderRadius:99,boxShadow:"0 0 10px #10B981",transition:"width 1s ease"}}/>
                    </div>
                    <div style={{fontSize:10,color:"#6EE7B7",fontWeight:700,display:"flex",justifyContent:"space-between"}}>
                      <span>{criatura.progresso.toFixed(0)}%</span>
                      <span>Faltam {fmt(criatura.proximoEstagio.min - saldoMes)}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{background:"linear-gradient(135deg,rgba(251,191,36,.25),rgba(245,158,11,.15))",border:"1px solid rgba(251,191,36,.4)",borderRadius:12,padding:"12px",textAlign:"center",boxShadow:"0 4px 12px rgba(251,191,36,.2)"}}>
                    <div style={{fontSize:12,fontWeight:800,color:"#FCD34D",textShadow:"0 0 10px #F59E0B",letterSpacing:1}}>
                      👑 FORMA SUPREMA! 👑
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard */}
        <div style={{background:"linear-gradient(135deg,rgba(139,92,246,.15),rgba(167,139,250,.1))",border:"1px solid rgba(167,139,250,.3)",borderRadius:20,padding:20,boxShadow:"0 8px 24px rgba(139,92,246,.2)"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#A78BFA",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
            <span>📊</span> Registro Místico
          </div>
          
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:12}}>
            {[
              {label:"Poder Total",value:criaturasEvoluidas.reduce((sum,c)=>sum+c.estagio.poder,0),cor:"#FCD34D",icon:"⚡"},
              {label:"Criaturas",value:criaturas.length,cor:"#A78BFA",icon:"✨"},
              {label:"Supremas",value:`${criaturasEvoluidas.filter(c=>!c.proximoEstagio).length}/${criaturas.length}`,cor:"#34D399",icon:"👑"},
              {label:"Saldo Mês",value:fmt(saldoMes),cor:saldoMes>=0?"#10B981":"#EF4444",icon:"💰"}
            ].map(stat=>(
              <div key={stat.label} style={{background:"rgba(0,0,0,.3)",borderRadius:12,padding:"12px",border:"1px solid rgba(255,255,255,.1)",transition:"transform 0.2s",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginBottom:6,display:"flex",alignItems:"center",gap:4}}>
                  <span>{stat.icon}</span><span>{stat.label}</span>
                </div>
                <div style={{fontSize:19,fontWeight:800,color:stat.cor,textShadow:`0 0 15px ${stat.cor}`,fontFamily:"'Outfit',sans-serif"}}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </>
    )
  })()}
</>}

    </>
  )

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

        {!isMobile&&(
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
        )}
        <div className={`content${isMobile?"":" with-sidebar"}`}>
          {contentJSX}
        </div>

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
