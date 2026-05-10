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
              <div className="ml">Saldo do Mês</div>
              <div className="mv" style={{color:agData.saldo>=0?"var(--gn)":"var(--rd)"}}>{fmt(agData.saldo)}</div>
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
  <div style={{marginBottom:16}}>
    <div className="pt">🌾 Jardim da Prosperidade</div>
    <div style={{fontSize:11,color:"var(--mt)",lineHeight:1.6}}>
      Seu jardim cresce com as economias do mês — estilo Stardew Valley! 🌱
    </div>
  </div>

  {(()=>{
    const niveis = [
      {min:-999999,max:0,   nome:"Terra Árida",     emoji:"🏜️", cor:"#8B6914",cor2:"#C9A23A"},
      {min:0,      max:400, nome:"Canteiro Inicial", emoji:"🌱", cor:"#5C8A2E",cor2:"#8BC34A"},
      {min:400,    max:1000,nome:"Horta Florescente",emoji:"🌿", cor:"#2E7D32",cor2:"#66BB6A"},
      {min:1000,   max:2000,nome:"Pomar Encantado",  emoji:"🌺", cor:"#AD1457",cor2:"#F06292"},
      {min:2000,   max:3500,nome:"Bosque Místico",   emoji:"🌳", cor:"#4527A0",cor2:"#9575CD"},
      {min:3500,   max:5500,nome:"Santuário Etéreo", emoji:"✨", cor:"#1565C0",cor2:"#42A5F5"},
      {min:5500,   max:999999,nome:"Éden Dourado",   emoji:"👑", cor:"#B8860B",cor2:"#FFD700"},
    ]
    const saldoMes = Math.max(0, tm.saldo)
    const nivel = niveis.find(n=>saldoMes>=n.min&&saldoMes<n.max)||niveis[niveis.length-1]
    const nIdx = niveis.indexOf(nivel)
    const prog = nivel.max===999999?100:Math.min(100,((saldoMes-nivel.min)/(nivel.max-nivel.min))*100)
    const prox = nIdx<niveis.length-1?niveis[nIdx+1]:null

    const flores    = Math.min(24, Math.max(0,Math.floor(saldoMes/80)))
    const arvores   = Math.min(6,  Math.max(0,Math.floor((saldoMes-800)/500)))
    const borboletas= Math.min(10, Math.max(0,Math.floor((saldoMes-400)/250)))
    const passaros  = Math.min(5,  Math.max(0,Math.floor((saldoMes-1500)/600)))
    const rio       = saldoMes>=2500
    const arcoiris  = saldoMes>=4000
    const fonteMagica = saldoMes>=3000

    // Paleta stardew: céu azul pastoral, grama verde viva
    const skyColor = saldoMes<=0?"linear-gradient(180deg,#D4C5A9,#C9B88A)":
                     saldoMes<1000?"linear-gradient(180deg,#87CEEB 0%,#B0E2FF 50%,#C8E6C9 100%)":
                     saldoMes<3000?"linear-gradient(180deg,#64B5F6 0%,#90CAF9 40%,#A5D6A7 100%)":
                     "linear-gradient(180deg,#42A5F5 0%,#81D4FA 40%,#AED581 100%)"

    // Cores de flores por índice
    const floresCores = [
      {petala:"#FF4081",centro:"#FFC107"},
      {petala:"#7C4DFF",centro:"#FFEB3B"},
      {petala:"#FF6D00",centro:"#FFEE58"},
      {petala:"#00BFA5",centro:"#FFCA28"},
      {petala:"#2979FF",centro:"#FFD740"},
      {petala:"#F50057",centro:"#FFF176"},
      {petala:"#AA00FF",centro:"#FFD740"},
      {petala:"#FFAB00",centro:"#E8F5E9"},
    ]

    return(<>
      {/* Painel de Nível */}
      <div style={{background:`linear-gradient(135deg,${nivel.cor}25,${nivel.cor2}15)`,border:`2px solid ${nivel.cor}60`,borderRadius:20,padding:18,marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,opacity:.08}}>
          {Array.from({length:10}).map((_,i)=>(
            <div key={i} style={{position:"absolute",width:3+Math.random()*4,height:3+Math.random()*4,background:nivel.cor2,borderRadius:"50%",left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,animation:`sparkle ${2+Math.random()*3}s ease-in-out infinite`,animationDelay:`${Math.random()*2}s`}}/>
          ))}
        </div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{fontSize:36}}>{nivel.emoji}</div>
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,.6)",letterSpacing:1.5}}>NÍVEL DO JARDIM · {(() => { const [y,m] = thisMonth.split("-").map(Number); return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][m-1]+" "+y })()}</div>
              <div style={{fontSize:22,fontWeight:800,background:`linear-gradient(135deg,${nivel.cor},${nivel.cor2})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{nivel.nome}</div>
            </div>
          </div>
          <div style={{background:"rgba(0,0,0,.25)",borderRadius:99,height:14,overflow:"hidden",position:"relative",marginBottom:6}}>
            <div style={{background:`linear-gradient(90deg,${nivel.cor},${nivel.cor2})`,height:"100%",width:`${prog}%`,borderRadius:99,transition:"width 1.2s cubic-bezier(.34,1.56,.64,1)",boxShadow:`0 0 16px ${nivel.cor2}80`,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent)",animation:"shimmer 2s infinite"}}/>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
            <span style={{color:"rgba(255,255,255,.6)"}}>{prox?`Próximo: ${prox.nome}`:"✨ Nível Máximo!"}</span>
            <span style={{fontWeight:700,color:nivel.cor2}}>{Math.round(prog)}%{prox&&` · faltam ${(() => { const v = Math.max(0, prox.min - saldoMes); return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) })()}`}</span>
          </div>
        </div>
      </div>

      {/* CANVAS STARDEW VALLEY */}
      <div style={{position:"relative",background:skyColor,borderRadius:20,minHeight:440,overflow:"hidden",border:"3px solid rgba(101,67,33,.4)",boxShadow:"0 8px 32px rgba(0,0,0,.3),inset 0 0 0 1px rgba(255,255,255,.1)"}}>

        {/* === CÉU === */}

        {/* Sol */}
        {saldoMes>0&&<div style={{position:"absolute",top:24,right:50,zIndex:5}}>
          <div style={{width:56,height:56,background:"radial-gradient(circle,#FFF176,#FFD600)",borderRadius:"50%",boxShadow:"0 0 30px rgba(255,214,0,.7),0 0 60px rgba(255,214,0,.3)"}}>
            {[0,45,90,135,180,225,270,315].map(ang=>(
              <div key={ang} style={{position:"absolute",width:4,height:14,background:"#FFD600",borderRadius:99,top:"50%",left:"50%",transform:`translate(-50%,-50%) rotate(${ang}deg) translateY(-34px)`,opacity:.8}}/>
            ))}
          </div>
        </div>}

        {/* Lua (se no vermelho) */}
        {saldoMes<=0&&<div style={{position:"absolute",top:20,right:50,zIndex:5}}>
          <div style={{width:48,height:48,background:"radial-gradient(circle at 40% 40%,#ECEFF1,#B0BEC5)",borderRadius:"50%",boxShadow:"0 0 20px rgba(176,190,197,.5)"}}>
            <div style={{position:"absolute",width:38,height:38,background:"#8B7355",borderRadius:"50%",top:4,right:-8,opacity:.95}}/>
          </div>
        </div>}

        {/* Nuvens fofinhas estilo stardew */}
        {saldoMes>0&&[
          {top:18,left:"8%",w:80,delay:0},
          {top:28,left:"35%",w:60,delay:1.5},
          {top:15,left:"60%",w:90,delay:0.8},
          {top:32,left:"82%",w:50,delay:2.2},
        ].map((c,i)=>(
          <div key={`nv${i}`} style={{position:"absolute",top:c.top,left:c.left,zIndex:4,animation:`floatCloud ${6+i}s ease-in-out infinite`,animationDelay:`${c.delay}s`}}>
            <div style={{width:c.w,height:28,background:"rgba(255,255,255,.85)",borderRadius:99,boxShadow:"0 4px 12px rgba(0,0,0,.1)",position:"relative"}}>
              <div style={{position:"absolute",width:c.w*.6,height:22,background:"rgba(255,255,255,.85)",borderRadius:99,top:-10,left:c.w*.15}}/>
              <div style={{position:"absolute",width:c.w*.4,height:18,background:"rgba(255,255,255,.85)",borderRadius:99,top:-6,left:c.w*.45}}/>
            </div>
          </div>
        ))}

        {/* Arco-íris */}
        {arcoiris&&<div style={{position:"absolute",top:50,left:"5%",width:"55%",height:120,zIndex:3,opacity:.55,pointerEvents:"none"}}>
          {["#FF0000","#FF7F00","#FFFF00","#00C853","#1565C0","#6A1B9A"].map((c,i)=>(
            <div key={c} style={{position:"absolute",width:"100%",height:18,borderTop:`4px solid ${c}`,borderRadius:"50% 50% 0 0",top:i*13,opacity:.8}}/>
          ))}
        </div>}

        {/* Pássaros voando */}
        {Array.from({length:passaros}).map((_,i)=>(
          <div key={`pa${i}`} style={{position:"absolute",top:50+i*25,left:`${5+i*15}%`,zIndex:6,animation:`birdFly ${8+i*2}s linear infinite`,animationDelay:`${i*2}s`}}>
            <svg width="22" height="12" viewBox="0 0 22 12">
              <path d="M1 6 Q5 0 11 6 Q17 0 21 6" stroke="#5D4037" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
        ))}

        {/* === TERRENO / GRAMA === */}

        {/* Colinas ao fundo — zIndex baixo, atrás de tudo */}
        <div style={{position:"absolute",bottom:195,left:"-5%",width:"40%",height:80,background:"rgba(56,142,60,.35)",borderRadius:"50%",filter:"blur(3px)",zIndex:1}}/>
        <div style={{position:"absolute",bottom:190,right:"-5%",width:"50%",height:70,background:"rgba(46,125,50,.3)",borderRadius:"50%",filter:"blur(3px)",zIndex:1}}/>

        {/* Chão arado / terra — renderizado ANTES das plantas, serve como base */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:200,background:"linear-gradient(180deg,#5C8A2E 0%,#4CAF50 8%,#388E3C 18%,#8B6914 30%,#795548 55%,#6D4C41 100%)",zIndex:3}}>
          {Array.from({length:8}).map((_,i)=>(
            <div key={`s${i}`} style={{position:"absolute",bottom:10+i*18,left:0,right:0,height:3,background:"rgba(0,0,0,.12)",borderRadius:99}}/>
          ))}
          <div style={{position:"absolute",top:0,left:0,right:0,height:28,background:"linear-gradient(180deg,rgba(56,142,60,.9),transparent)",borderRadius:"4px 4px 0 0"}}/>
          {Array.from({length:40}).map((_,i)=>(
            <div key={`gr${i}`} style={{position:"absolute",bottom:160+[4,8,2,6,3,7,1,5][i%8],left:`${i*2.5}%`,width:3,height:10+[3,6,2,8,4,7,1,5][i%8],background:`hsl(${110+i%4*8},60%,${30+i%3*8}%)`,borderRadius:"50% 50% 0 0",transform:`rotate(${[-15,-8,5,12,-3,8,-12,3][i%8]}deg)`,opacity:.7}}/>
          ))}
        </div>

        {/* Rio — ancorado no chão */}
        {rio&&<div style={{position:"absolute",bottom:150,right:30,width:50,height:180,zIndex:4}}>
          <div style={{position:"absolute",top:0,width:50,height:60,background:"linear-gradient(135deg,#78909C,#90A4AE)",borderRadius:"12px 12px 4px 4px",boxShadow:"0 4px 8px rgba(0,0,0,.3)"}}>
            <div style={{position:"absolute",bottom:-2,left:0,right:0,height:10,background:"rgba(100,181,246,.6)",borderRadius:99}}/>
          </div>
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} style={{position:"absolute",top:55+i*15,left:"50%",width:12,height:14,marginLeft:-6,background:"linear-gradient(180deg,rgba(100,181,246,.9),rgba(100,181,246,.3))",borderRadius:"0 0 50% 50%",animation:"waterfall 1.2s linear infinite",animationDelay:`${i*.3}s`}}/>
          ))}
          <div style={{position:"absolute",top:115,left:-20,width:90,height:50,background:"linear-gradient(180deg,rgba(100,181,246,.5),rgba(79,195,247,.3))",borderRadius:"50%",animation:"ripple 3s ease-in-out infinite"}}/>
        </div>}

        {/* Fonte mágica — pés no chão (bottom=200 = topo da terra) */}
        {fonteMagica&&<div style={{position:"absolute",bottom:200,left:30,zIndex:6}}>
          <div style={{width:50,height:30,background:"linear-gradient(135deg,#78909C,#607D8B)",borderRadius:"50% 50% 30% 30%",boxShadow:"0 4px 12px rgba(0,0,0,.4)",border:"2px solid rgba(255,255,255,.2)"}}>
            <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",width:10,height:20,background:"linear-gradient(90deg,#546E7A,#78909C)",borderRadius:"50% 50% 0 0"}}/>
          </div>
          {Array.from({length:5}).map((_,i)=>(
            <div key={i} style={{position:"absolute",bottom:28,left:10+i*8,width:4,height:20+Math.sin(i)*8,background:"linear-gradient(180deg,rgba(100,181,246,.9),rgba(100,181,246,.2))",borderRadius:99,animation:`fountain ${1+i*.2}s ease-in-out infinite`,animationDelay:`${i*.15}s`}}/>
          ))}
        </div>}

        {/* Cerca de madeira — estacas com pé em bottom=200 */}
        {saldoMes>200&&<>
          {Array.from({length:12}).map((_,i)=>(
            <div key={`f${i}`} style={{position:"absolute",bottom:200,left:`${3+i*8.2}%`,zIndex:5}}>
              <div style={{width:10,height:30,background:"linear-gradient(90deg,#8D6E63,#A1887F,#8D6E63)",borderRadius:"4px 4px 2px 2px",boxShadow:"2px 2px 4px rgba(0,0,0,.3)",position:"relative"}}>
                <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderBottom:"8px solid #795548"}}/>
              </div>
            </div>
          ))}
          <div style={{position:"absolute",bottom:226,left:"3%",right:"3%",height:5,background:"linear-gradient(90deg,#8D6E63,#A1887F,#8D6E63)",borderRadius:99,zIndex:4,boxShadow:"0 2px 4px rgba(0,0,0,.2)"}}/>
          <div style={{position:"absolute",bottom:212,left:"3%",right:"3%",height:4,background:"linear-gradient(90deg,#795548,#8D6E63,#795548)",borderRadius:99,zIndex:4}}/>
        </>}

        {/* === PLANTAS — todas com transformOrigin bottom, plantadas no solo === */}

        {/* ÁRVORES — tronco nasce do chão (bottom=200) */}
        {Array.from({length:arvores}).map((_,i)=>{
          const posX=[8,22,38,55,68,82][i]
          const hue=100+i*8
          const treeH=90+i*10
          return(
            <div key={`av${i}`} style={{position:"absolute",bottom:200,left:`${posX}%`,zIndex:5,transformOrigin:"bottom center",animation:`treeSway ${4+i*.5}s ease-in-out infinite`,animationDelay:`${i*.3}s`}}>
              <div style={{width:16,height:treeH*.4,background:"linear-gradient(90deg,#5D4037,#8D6E63,#5D4037)",margin:"0 auto",borderRadius:"4px 4px 2px 2px",position:"relative",boxShadow:"inset -3px 0 6px rgba(0,0,0,.3)"}}>
                <div style={{position:"absolute",width:3,height:treeH*.2,background:"rgba(0,0,0,.15)",left:4,top:"20%",borderRadius:99}}/>
              </div>
              <div style={{position:"relative",top:-20}}>
                <div style={{width:70,height:55,background:`radial-gradient(circle at 40% 35%,hsl(${hue},55%,50%),hsl(${hue},50%,35%))`,borderRadius:"50% 50% 45% 45%",margin:"0 auto",boxShadow:`0 4px 12px rgba(0,0,0,.25),inset -8px -8px 16px rgba(0,0,0,.2)`,position:"relative"}}>
                  <div style={{position:"absolute",top:8,left:12,width:20,height:14,background:"rgba(255,255,255,.15)",borderRadius:"50%",transform:"rotate(-20deg)"}}/>
                  {i%2===0&&[0,1,2,3].map(j=>(
                    <div key={j} style={{position:"absolute",width:8,height:8,background:"#FF5722",borderRadius:"50%",top:`${15+j*18}%`,left:`${12+j*18}%`,boxShadow:"0 2px 4px rgba(0,0,0,.3)"}}/>
                  ))}
                </div>
                <div style={{width:55,height:42,background:`radial-gradient(circle at 40% 35%,hsl(${hue},60%,55%),hsl(${hue},55%,40%))`,borderRadius:"50%",margin:"-18px auto 0",boxShadow:`0 4px 8px rgba(0,0,0,.2),inset -6px -6px 12px rgba(0,0,0,.15)`}}/>
                <div style={{width:38,height:30,background:`radial-gradient(circle at 40% 35%,hsl(${hue},65%,60%),hsl(${hue},60%,45%))`,borderRadius:"50%",margin:"-14px auto 0",boxShadow:`0 2px 6px rgba(0,0,0,.15)`}}/>
              </div>
            </div>
          )
        })}

        {/* FLORES — caule nasce do solo (bottom=200), transformOrigin bottom */}
        {Array.from({length:flores}).map((_,i)=>{
          const col = i % 8
          const row = Math.floor(i / 8)
          const paleta = floresCores[col % floresCores.length]
          const leftPct = 4 + col * 11.5
          // Todas as flores têm raiz no nível da grama — bottom=200
          const stemH = 36 + [0,8,4,12,2,10,6,14][col] // caules de alturas variadas mas raiz fixa
          const sz = [0.85,0.95,0.8,1,0.9,0.88,0.92,0.85][col]

          return(
            <div key={`fl${i}`} style={{position:"absolute",bottom:200,left:`${leftPct}%`,zIndex:7+row,transformOrigin:"bottom center",transform:`scale(${sz})`,animation:`plantSway ${2.5+col*0.2}s ease-in-out infinite`,animationDelay:`${i*0.15}s`}}>
              {/* Caule enraizado no solo */}
              <div style={{width:5,height:stemH,background:"linear-gradient(90deg,#2E7D32,#43A047,#2E7D32)",margin:"0 auto",borderRadius:"2px 2px 0 0",position:"relative"}}>
                <div style={{position:"absolute",width:13,height:7,background:"#4CAF50",borderRadius:"0 50% 50% 0",left:-13,top:stemH*.35,transform:"rotate(-20deg)"}}/>
                <div style={{position:"absolute",width:13,height:7,background:"#388E3C",borderRadius:"50% 0 0 50%",right:-13,top:stemH*.55,transform:"rotate(20deg)"}}/>
              </div>
              {/* Flor */}
              <div style={{position:"relative",width:34,height:34,top:-10,left:"50%",transform:"translateX(-50%)"}}>
                {[0,51,102,153,204,255,306].map(ang=>(
                  <div key={ang} style={{position:"absolute",width:12,height:18,background:`linear-gradient(135deg,${paleta.petala},${paleta.petala}BB)`,borderRadius:"50% 50% 40% 40%",top:"50%",left:"50%",transform:`translate(-50%,-50%) rotate(${ang}deg) translateY(-10px)`,boxShadow:`0 0 6px ${paleta.petala}40`,transformOrigin:"center bottom"}}/>
                ))}
                <div style={{position:"absolute",width:13,height:13,background:`radial-gradient(circle,${paleta.centro},${paleta.centro}CC)`,borderRadius:"50%",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:2,boxShadow:`0 0 8px ${paleta.centro}80`,border:"1px solid rgba(255,255,255,.3)"}}/>
              </div>
            </div>
          )
        })}

        {/* BORBOLETAS */}
        {Array.from({length:borboletas}).map((_,i)=>{
          const cbs=[
            {g:"linear-gradient(135deg,#FF4081,#FF80AB)"},
            {g:"linear-gradient(135deg,#7C4DFF,#B388FF)"},
            {g:"linear-gradient(135deg,#00BFA5,#64FFDA)"},
            {g:"linear-gradient(135deg,#FFD740,#FFAB40)"},
            {g:"linear-gradient(135deg,#40C4FF,#80D8FF)"},
          ]
          const cb=cbs[i%cbs.length]
          return(
            <div key={`bb${i}`} style={{position:"absolute",top:80+Math.sin(i)*40,left:`${10+i*8}%`,zIndex:8,animation:`butterflyFly ${9+i*1.5}s ease-in-out infinite`,animationDelay:`${i*1.2}s`}}>
              <div style={{animation:"flutter .5s ease-in-out infinite",position:"relative",width:28,height:22}}>
                <div style={{position:"absolute",width:14,height:18,background:cb.g,borderRadius:"55% 45% 35% 65%",top:0,left:0,boxShadow:"0 2px 8px rgba(0,0,0,.2)",opacity:.9}}/>
                <div style={{position:"absolute",width:14,height:18,background:cb.g,borderRadius:"45% 55% 65% 35%",top:0,right:0,boxShadow:"0 2px 8px rgba(0,0,0,.2)",opacity:.9}}/>
                <div style={{position:"absolute",width:3,height:18,background:"#37474F",left:"50%",top:"50%",transform:"translate(-50%,-50%)",borderRadius:99,zIndex:2}}>
                  <div style={{position:"absolute",width:1,height:7,background:"#37474F",top:-7,left:0,borderRadius:99,transform:"rotate(-25deg)"}}/> 
                  <div style={{position:"absolute",width:1,height:7,background:"#37474F",top:-7,right:-1,borderRadius:99,transform:"rotate(25deg)"}}/>
                </div>
              </div>
            </div>
          )
        })}

        {/* Faíscas mágicas / vagalumes */}
        {saldoMes>200&&Array.from({length:Math.min(20,Math.floor(saldoMes/100))}).map((_,i)=>(
          <div key={`sp${i}`} style={{position:"absolute",left:`${Math.random()*90}%`,top:`${120+Math.random()*180}px`,width:5,height:5,background:"radial-gradient(circle,#FFEE58,transparent 70%)",borderRadius:"50%",animation:`floatFirefly ${3+Math.random()*4}s ease-in-out infinite`,animationDelay:`${Math.random()*3}s`,boxShadow:"0 0 8px #FFEE58,0 0 14px rgba(255,238,88,.5)",zIndex:9}}/>
        ))}

        {/* Mensagem de início */}
        {saldoMes<=0&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",background:"rgba(255,255,255,.96)",padding:"24px 32px",borderRadius:20,border:"3px solid #8B6914",boxShadow:"0 8px 32px rgba(0,0,0,.25)",maxWidth:280,zIndex:10}}>
          <div style={{fontSize:48,marginBottom:8,animation:"bounce 2s ease-in-out infinite"}}>🌱</div>
          <div style={{fontSize:16,fontWeight:700,color:"#2E7D32",marginBottom:8}}>Plante a primeira semente!</div>
          <div style={{fontSize:12,color:"#555",lineHeight:1.6}}>Economize neste mês para seu jardim florescer.<br/><span style={{fontSize:10,color:"#888"}}>🌸 R$ 80 = 1 flor nova</span></div>
        </div>}

        <style>{`
          @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
          @keyframes sparkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1)}}
          @keyframes floatCloud{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}
          @keyframes birdFly{0%{transform:translateX(0)}100%{transform:translateX(120vw)}}
          @keyframes treeSway{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}
          @keyframes plantSway{0%,100%{transform:rotate(-2deg) scale(var(--s,1))}50%{transform:rotate(2deg) scale(var(--s,1))}}
          @keyframes flutter{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.7)}}
          @keyframes butterflyFly{0%,100%{transform:translate(0,0)}25%{transform:translate(50px,-30px)}50%{transform:translate(100px,10px)}75%{transform:translate(60px,30px)}}
          @keyframes floatFirefly{0%,100%{transform:translate(0,0);opacity:.3}50%{transform:translate(-15px,-25px);opacity:1}}
          @keyframes waterfall{0%{transform:translateY(0);opacity:1}100%{transform:translateY(60px);opacity:0}}
          @keyframes fountain{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(-16px);opacity:.4}}
          @keyframes ripple{0%,100%{transform:scaleX(1);opacity:.5}50%{transform:scaleX(1.1);opacity:.3}}
          @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        `}</style>
      </div>

      {/* Stats */}
      <div className="card" style={{marginTop:16}}>
        <div className="sec">🌾 Elementos do Jardim · {`${tm.rec>0?"":" Nenhuma receita este mês"}`}Saldo este mês: {(tm.saldo).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {emoji:"🌸",label:"Flores",val:flores,max:24,desc:"R$ 80 cada",cor:"#FF4081"},
            {emoji:"🦋",label:"Borboletas",val:borboletas,max:10,desc:"R$ 250 cada",cor:"#7C4DFF"},
            {emoji:"🌳",label:"Árvores",val:arvores,max:6,desc:"R$ 500 cada",cor:"#2E7D32"},
            {emoji:"🐦",label:"Pássaros",val:passaros,max:5,desc:"R$ 600 cada",cor:"#1565C0"},
          ].map(e=>(
            <div key={e.label} style={{background:`rgba(0,0,0,.15)`,borderRadius:12,padding:"11px 13px",border:`1px solid ${e.cor}25`}}>
              <div style={{fontSize:10,color:"var(--mt)",marginBottom:4}}>{e.emoji} {e.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:e.cor}}>{e.val}<span style={{fontSize:10,color:"var(--mt)",fontWeight:400}}>/{e.max}</span></div>
              <div style={{fontSize:9,color:"var(--mt)",marginTop:2}}>{e.desc}</div>
              <div style={{background:"rgba(255,255,255,.08)",borderRadius:99,height:4,marginTop:6}}>
                <div style={{background:e.cor,width:`${(e.val/e.max)*100}%`,height:"100%",borderRadius:99,boxShadow:`0 0 6px ${e.cor}`}}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:12,padding:"10px 12px",background:"rgba(167,139,250,.06)",borderRadius:10,border:"1px solid rgba(167,139,250,.12)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--pu)",marginBottom:5}}>🔓 Desbloqueios especiais</div>
          <div style={{fontSize:10,color:"var(--mt)",lineHeight:1.8}}>
            {[
              {label:"Cerca de Madeira",min:200,ico:"🪵"},
              {label:"Fonte Mágica",min:3000,ico:"⛲"},
              {label:"Rio & Cascata",min:2500,ico:"💧"},
              {label:"Arco-íris",min:4000,ico:"🌈"},
            ].map(d=>(
              <span key={d.label} style={{display:"inline-block",marginRight:12}}>{saldoMes>=d.min?"✅":"❌"} {d.ico} {d.label}{saldoMes<d.min&&` (faltam ${(d.min-saldoMes).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})})`}</span>
            ))}
          </div>
        </div>
      </div>
    </>)
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
