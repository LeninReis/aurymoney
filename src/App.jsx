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
    {id:"agenda",   lbl:"Agenda", ico:"📅"},
    {id:"registros",lbl:"Registros",ico:"☰"},
    {id:"adicionar",lbl:editId?"Editar":"Novo",ico:"+"},
    {id:"jardim",   lbl:"Jardim",ico:"🌸"},
  ]

  // ── Content JSX ────────────────────────────────────────────────────────────
  const contentJSX = (
    <>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&(loading?<div className="ld"><div className="sp"/>Carregando...</div>:<>

          {/* Hero saldo */}
          <div className="hero">
            <div className="h-lbl">Saldo Acumulado · {monthLabel(thisMonth)}</div>
            <div className={`h-val ${agSaldoAcumulado>0?"pos":agSaldoAcumulado<0?"neg":"warn"}`}>{fmt(agSaldoAcumulado)}</div>
            <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:"var(--mt)"}}>Saldo do mês:</span>
              <span style={{fontSize:12,fontWeight:700,color:tm.saldo>=0?"var(--gn)":"var(--rd)"}}>{fmt(tm.saldo)}</span>
              <span style={{fontSize:10,color:"var(--mt)",marginLeft:"auto"}}>Acumulado até hoje</span>
            </div>
            <div className="pbar">
              <div className="pfill" style={{width:`${Math.min(100,Math.abs(agSaldoAcumulado/50))}%`,background:agSaldoAcumulado>=0?"linear-gradient(90deg,var(--gn),#059669)":"linear-gradient(90deg,var(--rd),#dc2626)"}}/>
            </div>
          </div>

          {/* Totais do mês */}
          <div className="g3">
            <div className="mc"><div className="ml">↑ Receitas</div><div className="mv" style={{color:"var(--gn)"}}>{fmt(tm.rec)}</div></div>
            <div className="mc"><div className="ml">↓ Despesas</div><div className="mv" style={{color:"var(--rd)"}}>{fmt(tm.exp)}</div></div>
            <div className="mc"><div className="ml">Saldo do Mês</div><div className="mv" style={{color:tm.saldo>=0?"var(--gn)":"var(--rd)"}}>{fmt(tm.saldo)}</div></div>
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

// 🌸 JARDIM DA PROSPERIDADE - VERSÃO MÁGICA/COZY
// Cole este código no lugar da seção {tab==="jardim"&&<>...</>} no seu App.jsx

{tab==="jardim"&&<>
  <div style={{marginBottom:16}}>
    <div className="pt">🌸 Jardim da Prosperidade</div>
    <div style={{fontSize:11,color:"var(--mt)",lineHeight:1.6}}>
      Seu jardim cresce conforme você economiza neste mês! Cada real guardado floresce em magia ✨
    </div>
  </div>

  {/* Sistema baseado no SALDO DO MÊS ATUAL (tm.saldo) */}
  {(()=>{
    // Níveis mágicos com cores místicas
    const niveis = [
      {min:-999999,max:0,nome:"Terra Árida 🏜️",desc:"Aguardando a primeira economia",cor1:"#8B4513",cor2:"#A0522D",bg:"linear-gradient(180deg,#D4A574 0%,#C9A876 60%,#8B7355 100%)"},
      {min:0,max:400,nome:"Semente Plantada 🌱",desc:"Um broto de esperança surge",cor1:"#7CB342",cor2:"#AED581",bg:"linear-gradient(180deg,#B4E1FF 0%,#E1F5FE 40%,#C8E6C9 100%)"},
      {min:400,max:1000,nome:"Jardim Florescente 🌿",desc:"A vida começa a desabrochar",cor1:"#00C853",cor2:"#69F0AE",bg:"linear-gradient(180deg,#81D4FA 0%,#B3E5FC 40%,#A5D6A7 100%)"},
      {min:1000,max:2000,nome:"Prado Encantado 🌺",desc:"Flores mágicas iluminam",cor1:"#E91E63",cor2:"#F06292",bg:"linear-gradient(180deg,#90CAF9 0%,#CE93D8 50%,#F48FB1 100%)"},
      {min:2000,max:3500,nome:"Bosque Místico 🌳",desc:"Árvores ancestrais trazem sabedoria",cor1:"#7B1FA2",cor2:"#BA68C8",bg:"linear-gradient(180deg,#9FA8DA 0%,#B39DDB 50%,#CE93D8 100%)"},
      {min:3500,max:5500,nome:"Santuário Celestial ✨",desc:"Magia pura permeia o ar",cor1:"#304FFE",cor2:"#7C4DFF",bg:"linear-gradient(180deg,#7986CB 0%,#9575CD 50%,#BA68C8 100%)"},
      {min:5500,max:999999,nome:"Éden Etéreo 🌌",desc:"Perfeição absoluta alcançada",cor1:"#FFD700",cor2:"#FFB74D",bg:"linear-gradient(180deg,#FFE082 0%,#FFCC80 50%,#FFAB91 100%)"}
    ]
    
    const saldoMes = Math.max(0, tm.saldo) // SALDO DO MÊS ATUAL!!
    const nivel = niveis.find(n=>saldoMes>=n.min&&saldoMes<n.max)||niveis[niveis.length-1]
    const nIdx = niveis.indexOf(nivel)
    const prog = nivel.max===999999?100:Math.min(100,Math.max(0,((saldoMes-nivel.min)/(nivel.max-nivel.min))*100))
    const prox = nIdx<niveis.length-1?niveis[nIdx+1]:null
    
    // Elementos baseados no saldo do mês
    const flores = Math.min(30,Math.max(0,Math.floor(saldoMes/80)))
    const borboletas = Math.min(15,Math.max(0,Math.floor((saldoMes-400)/200)))
    const vagalumes = Math.min(35,Math.max(0,Math.floor((saldoMes-200)/60)))
    const arvores = Math.min(8,Math.max(0,Math.floor((saldoMes-1000)/500)))
    const cascata = saldoMes>=3000
    const arcoiris = saldoMes>=4500
    
    return(<>
      {/* Card de Nível */}
      <div style={{background:`linear-gradient(135deg,${nivel.cor1}20,${nivel.cor2}30)`,border:`2px solid ${nivel.cor1}50`,borderRadius:20,padding:20,position:"relative",overflow:"hidden",marginBottom:16}}>
        {/* Partículas mágicas */}
        <div style={{position:"absolute",inset:0,opacity:.2,pointerEvents:"none"}}>
          {Array.from({length:12}).map((_,i)=>(
            <div key={i} style={{position:"absolute",width:3+Math.random()*5,height:3+Math.random()*5,background:`radial-gradient(circle,${nivel.cor2},transparent)`,borderRadius:"50%",left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,animation:`sparkle ${2+Math.random()*3}s ease-in-out infinite`,animationDelay:`${Math.random()*2}s`,filter:"blur(.5px)"}}/>
          ))}
        </div>

        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.7)",marginBottom:4,letterSpacing:1.5}}>NÍVEL ATUAL · {monthLabel(thisMonth).toUpperCase()}</div>
          <div style={{fontSize:26,fontWeight:800,marginBottom:4,background:`linear-gradient(135deg,${nivel.cor1},${nivel.cor2})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{nivel.nome}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.8)",marginBottom:16}}>{nivel.desc}</div>
          
          <div style={{marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>{prox?`Próximo: ${prox.nome}`:"✨ Nível Máximo!"}</span>
            <span style={{fontSize:13,fontWeight:700,color:nivel.cor2}}>{Math.round(prog)}%</span>
          </div>
          
          <div style={{background:"rgba(0,0,0,.25)",borderRadius:99,height:14,overflow:"hidden",position:"relative",boxShadow:"inset 0 2px 4px rgba(0,0,0,.2)"}}>
            <div style={{background:`linear-gradient(90deg,${nivel.cor1},${nivel.cor2})`,height:"100%",width:`${prog}%`,borderRadius:99,transition:"width 1.2s cubic-bezier(.34,1.56,.64,1)",boxShadow:`0 0 20px ${nivel.cor2}60`,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)",animation:"shimmer 2s infinite"}}/>
            </div>
          </div>
          
          {prox&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:8,textAlign:"center"}}>Faltam {fmt(Math.max(0,prox.min-saldoMes))} para {prox.nome}</div>}
        </div>
      </div>

      {/* JARDIM MÁGICO */}
      <div style={{position:"relative",background:nivel.bg,borderRadius:20,minHeight:500,overflow:"hidden",border:`2px solid ${nivel.cor1}30`,boxShadow:"0 8px 32px rgba(0,0,0,.15)"}}>
        
        {/* Céu */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(135,206,250,.3) 0%,transparent 50%)",pointerEvents:"none"}}/>
        
        {/* Sol mágico */}
        <div style={{position:"absolute",top:30,right:40}}>
          <div style={{width:70,height:70,background:"radial-gradient(circle,#FFD700,#FFA500)",borderRadius:"50%",boxShadow:"0 0 40px rgba(255,215,0,.6), 0 0 80px rgba(255,165,0,.3)",animation:"pulse 4s ease-in-out infinite"}}>
            <div style={{position:"absolute",inset:-10,background:"radial-gradient(circle,rgba(255,215,0,.3),transparent 70%)",borderRadius:"50%",animation:"pulse 4s ease-in-out infinite reverse"}}/>
          </div>
        </div>

        {/* Nuvens */}
        {[1,2,3,4].map(i=>(
          <div key={`nv${i}`} style={{position:"absolute",top:20+i*25,left:`${i*20}%`,display:"flex",gap:4,animation:`floatCloud ${5+i*1.5}s ease-in-out infinite`,animationDelay:`${i*0.8}s`,filter:"drop-shadow(0 2px 8px rgba(255,255,255,.4))"}}>
            <div style={{width:60,height:24,background:"rgba(255,255,255,.75)",borderRadius:"50%"}}/>
            <div style={{width:45,height:28,background:"rgba(255,255,255,.75)",borderRadius:"50%",marginTop:-4}}/>
            <div style={{width:50,height:22,background:"rgba(255,255,255,.75)",borderRadius:"50%",marginTop:2}}/>
          </div>
        ))}

        {/* Arco-íris */}
        {arcoiris&&<div style={{position:"absolute",top:80,left:"20%",width:"60%",height:100,opacity:.6}}>
          {["#FF0000","#FF7F00","#FFFF00","#00FF00","#0000FF","#4B0082","#9400D3"].map((c,i)=>(
            <div key={c} style={{position:"absolute",width:"100%",height:15,background:`linear-gradient(90deg,transparent,${c}60,${c}80,${c}60,transparent)`,borderRadius:"50%",top:i*12,transform:`translateY(${i*2}px)`,animation:"rainbow 6s ease-in-out infinite",animationDelay:`${i*0.1}s`}}/>
          ))}
        </div>}

        {/* Colinas */}
        <div style={{position:"absolute",bottom:200,left:0,right:0,height:150}}>
          <div style={{position:"absolute",bottom:0,left:"-10%",width:"50%",height:120,background:"rgba(76,175,80,.25)",borderRadius:"50%",filter:"blur(2px)"}}/>
          <div style={{position:"absolute",bottom:0,right:"-10%",width:"60%",height:100,background:"rgba(139,195,74,.25)",borderRadius:"50%",filter:"blur(2px)"}}/>
        </div>

        {/* Cascata */}
        {cascata&&<div style={{position:"absolute",top:150,right:50,width:40,height:200}}>
          <div style={{position:"absolute",top:0,left:0,width:60,height:80,background:"linear-gradient(135deg,#607D8B,#78909C)",borderRadius:"20% 20% 40% 40%",boxShadow:"0 4px 8px rgba(0,0,0,.2)"}}/>
          {Array.from({length:5}).map((_,i)=>(
            <div key={i} style={{position:"absolute",top:80,left:15+i*8,width:6,height:120,background:"linear-gradient(180deg,rgba(100,181,246,.8),rgba(100,181,246,.4))",borderRadius:99,animation:`waterfall 1.5s linear infinite`,animationDelay:`${i*0.2}s`,filter:"blur(.5px)",boxShadow:"0 0 8px rgba(100,181,246,.6)"}}/>
          ))}
        </div>}

        {/* Grama */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"45%",background:"linear-gradient(180deg,rgba(76,175,80,.7),#4CAF50,#388E3C)",borderRadius:"0 0 18px 18px"}}>
          {Array.from({length:60}).map((_,i)=>(
            <div key={i} style={{position:"absolute",bottom:0,left:`${(i*2)%100}%`,width:2,height:15+Math.random()*20,background:`linear-gradient(180deg,transparent,#2E7D32)`,borderRadius:"50% 50% 0 0",transform:`rotate(${-10+Math.random()*20}deg)`,opacity:.4}}/>
          ))}
        </div>

        {/* ÁRVORES */}
        {Array.from({length:arvores}).map((_,i)=>{
          const posX=10+(i*12)%75,size=0.8+Math.random()*0.4,hue=90+Math.random()*40
          return(
            <div key={`av${i}`} style={{position:"absolute",bottom:180+Math.random()*50,left:`${posX}%`,transform:`scale(${size})`,animation:`sway ${3+Math.random()*2}s ease-in-out infinite`,animationDelay:`${i*0.4}s`,filter:"drop-shadow(0 8px 12px rgba(0,0,0,.2))"}}>
              <div style={{width:18,height:80,background:"linear-gradient(90deg,#5D4037,#6D4C41,#5D4037)",borderRadius:"6px 6px 2px 2px",margin:"0 auto",position:"relative"}}>
                <div style={{position:"absolute",width:2,height:30,background:"rgba(0,0,0,.2)",left:4,top:10,borderRadius:99}}/>
                <div style={{position:"absolute",width:2,height:25,background:"rgba(0,0,0,.2)",right:5,top:35,borderRadius:99}}/>
              </div>
              <div style={{position:"relative",top:-40}}>
                <div style={{width:90,height:70,background:`radial-gradient(circle,hsl(${hue},60%,45%),hsl(${hue},50%,35%))`,borderRadius:"50%",margin:"0 auto",boxShadow:`0 0 20px hsl(${hue},60%,45%)30,inset 0 -10px 20px rgba(0,0,0,.2)`,position:"relative"}}>
                  {Array.from({length:8}).map((_,j)=>(
                    <div key={j} style={{position:"absolute",width:20+Math.random()*15,height:20+Math.random()*15,background:`hsl(${hue+10},70%,${40+Math.random()*20}%)`,borderRadius:"50%",left:`${10+Math.random()*70}%`,top:`${Math.random()*70}%`,opacity:.7,boxShadow:"0 2px 4px rgba(0,0,0,.2)"}}/>
                  ))}
                </div>
                <div style={{width:70,height:55,background:`radial-gradient(circle,hsl(${hue},65%,50%),hsl(${hue},55%,40%))`,borderRadius:"50%",margin:"-25px auto 0",position:"relative",boxShadow:`0 0 15px hsl(${hue},65%,50%)30`}}/>
                <div style={{width:50,height:40,background:`radial-gradient(circle,hsl(${hue},70%,55%),hsl(${hue},60%,45%))`,borderRadius:"50%",margin:"-20px auto 0",boxShadow:`0 0 10px hsl(${hue},70%,55%)40,inset 0 -5px 10px rgba(0,0,0,.15)`}}/>
              </div>
              {Array.from({length:3}).map((_,k)=>(
                <div key={k} style={{position:"absolute",width:4,height:4,background:`hsl(${hue+30},80%,70%)`,borderRadius:"50%",top:`${20+Math.random()*40}%`,left:`${-10+Math.random()*120}%`,animation:`floatSparkle ${2+Math.random()}s ease-in-out infinite`,animationDelay:`${k*0.6}s`,boxShadow:`0 0 6px hsl(${hue+30},80%,70%)`,filter:"blur(.5px)"}}/>
              ))}
            </div>
          )
        })}

        {/* FLORES */}
        {Array.from({length:flores}).map((_,i)=>{
          const cores=[["#FF1493","#FF69B4","#FFB6C1"],["#9C27B0","#BA55D3","#DDA0DD"],["#FF6347","#FF7F50","#FFA07A"],["#4169E1","#6495ED","#87CEEB"],["#FFD700","#FFA500","#FFEB3B"]]
          const paleta=cores[i%cores.length],left=8+((i*19)%(100-16)),bottom=70+Math.random()*140,size=0.7+Math.random()*0.5
          return(
            <div key={`fl${i}`} style={{position:"absolute",bottom,left:`${left}%`,transform:`scale(${size})`,animation:`sway ${2+Math.random()*1.5}s ease-in-out infinite`,animationDelay:`${i*0.2}s`,filter:"drop-shadow(0 4px 8px rgba(0,0,0,.15))"}}>
              <div style={{width:4,height:55,background:"linear-gradient(90deg,#2E7D32,#43A047,#2E7D32)",margin:"0 auto",borderRadius:2,position:"relative"}}>
                <div style={{position:"absolute",width:12,height:8,background:"#4CAF50",borderRadius:"0 50% 50% 0",left:-12,top:15,transform:"rotate(-20deg)"}}/>
                <div style={{position:"absolute",width:12,height:8,background:"#4CAF50",borderRadius:"50% 0 0 50%",right:-12,top:25,transform:"rotate(20deg)"}}/>
              </div>
              <div style={{position:"relative",width:32,height:32,top:-18,left:"50%",transform:"translateX(-50%)"}}>
                {[0,60,120,180,240,300].map(ang=>(
                  <div key={ang} style={{position:"absolute",width:14,height:20,background:`linear-gradient(135deg,${paleta[0]},${paleta[1]})`,borderRadius:"50% 50% 50% 0",top:"50%",left:"50%",transform:`translate(-50%,-50%) rotate(${ang}deg) translateY(-10px)`,boxShadow:`0 0 8px ${paleta[0]}50,inset 0 -2px 4px rgba(0,0,0,.1)`,transformOrigin:"center bottom"}}/>
                ))}
                <div style={{position:"absolute",width:12,height:12,background:"radial-gradient(circle,#FFD700,#FFA500)",borderRadius:"50%",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:2,boxShadow:"0 0 8px rgba(255,215,0,.6),inset 0 -2px 3px rgba(0,0,0,.2)"}}>
                  {Array.from({length:6}).map((_,j)=>(
                    <div key={j} style={{position:"absolute",width:2,height:2,background:"#FFF",borderRadius:"50%",top:`${2+Math.random()*8}px`,left:`${2+Math.random()*8}px`,opacity:.8}}/>
                  ))}
                </div>
                <div style={{position:"absolute",width:40,height:40,background:`radial-gradient(circle,${paleta[2]}20,transparent 70%)`,borderRadius:"50%",top:"50%",left:"50%",transform:"translate(-50%,-50%)",animation:"pulse 3s ease-in-out infinite",pointerEvents:"none"}}/>
              </div>
            </div>
          )
        })}

        {/* BORBOLETAS */}
        {Array.from({length:borboletas}).map((_,i)=>{
          const coresBorb=[{asa1:"linear-gradient(135deg,#FF1493,#FF69B4)",asa2:"linear-gradient(135deg,#FF69B4,#FFB6C1)"},{asa1:"linear-gradient(135deg,#9C27B0,#BA55D3)",asa2:"linear-gradient(135deg,#BA55D3,#DDA0DD)"},{asa1:"linear-gradient(135deg,#00CED1,#48D1CC)",asa2:"linear-gradient(135deg,#48D1CC,#7FFFD4)"},{asa1:"linear-gradient(135deg,#FFD700,#FFA500)",asa2:"linear-gradient(135deg,#FFA500,#FFB84D)"},{asa1:"linear-gradient(135deg,#4169E1,#6495ED)",asa2:"linear-gradient(135deg,#6495ED,#87CEEB)"}]
          const cores=coresBorb[i%coresBorb.length],startX=Math.random()*70,startY=50+Math.random()*120,duration=10+Math.random()*8,size=0.8+Math.random()*0.4
          return(
            <div key={`bb${i}`} style={{position:"absolute",left:`${startX}%`,top:startY,transform:`scale(${size})`,animation:`butterfly ${duration}s ease-in-out infinite`,animationDelay:`${i*1.5}s`,filter:"drop-shadow(0 2px 6px rgba(0,0,0,.2))"}}>
              <div style={{position:"relative",width:28,height:24,animation:"flutter .4s ease-in-out infinite"}}>
                <div style={{position:"absolute",width:14,height:18,background:cores.asa1,borderRadius:"60% 40% 40% 60%",top:0,left:0,transformOrigin:"bottom right",boxShadow:"0 0 8px rgba(255,105,180,.5),inset 2px 2px 4px rgba(255,255,255,.3)"}}>
                  <div style={{position:"absolute",width:4,height:4,background:"rgba(255,255,255,.6)",borderRadius:"50%",top:4,left:4}}/>
                  <div style={{position:"absolute",width:3,height:3,background:"rgba(255,255,255,.5)",borderRadius:"50%",top:10,left:7}}/>
                </div>
                <div style={{position:"absolute",width:12,height:14,background:cores.asa2,borderRadius:"40% 60% 60% 40%",bottom:0,left:2,transformOrigin:"top right",boxShadow:"0 0 6px rgba(255,105,180,.4)"}}/>
                <div style={{position:"absolute",width:14,height:18,background:cores.asa1,borderRadius:"40% 60% 60% 40%",top:0,right:0,transformOrigin:"bottom left",boxShadow:"0 0 8px rgba(255,105,180,.5),inset -2px 2px 4px rgba(255,255,255,.3)"}}>
                  <div style={{position:"absolute",width:4,height:4,background:"rgba(255,255,255,.6)",borderRadius:"50%",top:4,right:4}}/>
                  <div style={{position:"absolute",width:3,height:3,background:"rgba(255,255,255,.5)",borderRadius:"50%",top:10,right:7}}/>
                </div>
                <div style={{position:"absolute",width:12,height:14,background:cores.asa2,borderRadius:"60% 40% 40% 60%",bottom:0,right:2,transformOrigin:"top left",boxShadow:"0 0 6px rgba(255,105,180,.4)"}}/>
                <div style={{position:"absolute",width:4,height:22,background:"linear-gradient(180deg,#2C3E50,#34495E)",left:"50%",top:"50%",transform:"translate(-50%,-50%)",borderRadius:99,zIndex:2,boxShadow:"0 2px 4px rgba(0,0,0,.3)"}}>
                  <div style={{position:"absolute",width:1,height:6,background:"#2C3E50",top:-6,left:1,borderRadius:99,transform:"rotate(-30deg)"}}/>
                  <div style={{position:"absolute",width:1,height:6,background:"#2C3E50",top:-6,right:1,borderRadius:99,transform:"rotate(30deg)"}}/>
                </div>
                <div style={{position:"absolute",width:50,height:50,background:"radial-gradient(circle,rgba(255,105,180,.2),transparent 60%)",top:"50%",left:"50%",transform:"translate(-50%,-50%)",borderRadius:"50%",animation:"pulse 2s ease-in-out infinite",pointerEvents:"none"}}/>
              </div>
            </div>
          )
        })}

        {/* VAGALUMES */}
        {Array.from({length:vagalumes}).map((_,i)=>{
          const cores=["#FFEB3B","#FFF176","#FFD54F","#FFE082","#FFECB3"],cor=cores[i%cores.length]
          return(
            <div key={`vg${i}`} style={{position:"absolute",left:`${5+Math.random()*90}%`,top:`${40+Math.random()*200}px`,width:5,height:5,background:`radial-gradient(circle,${cor},transparent 70%)`,borderRadius:"50%",animation:`floatFirefly ${3+Math.random()*4}s ease-in-out infinite`,animationDelay:`${Math.random()*3}s`,boxShadow:`0 0 12px ${cor},0 0 20px ${cor}80`,filter:"blur(.5px)"}}>
              <div style={{position:"absolute",width:3,height:3,background:"#FFF",borderRadius:"50%",top:"50%",left:"50%",transform:"translate(-50%,-50%)",animation:"twinkle 1.5s ease-in-out infinite",animationDelay:`${Math.random()}s`}}/>
            </div>
          )
        })}

        {/* Mensagem inicial */}
        {saldoMes<=0&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",background:"linear-gradient(135deg,rgba(255,255,255,.95),rgba(255,255,255,.85))",padding:"30px 40px",borderRadius:24,border:"3px solid rgba(167,139,250,.3)",boxShadow:"0 12px 40px rgba(0,0,0,.2),0 0 60px rgba(167,139,250,.2)",maxWidth:320}}>
          <div style={{fontSize:56,marginBottom:12,animation:"bounce 2s ease-in-out infinite"}}>🌱</div>
          <div style={{fontSize:18,fontWeight:700,color:"#2E7D32",marginBottom:10,letterSpacing:-.5}}>Plante sua primeira semente mágica</div>
          <div style={{fontSize:13,color:"#666",lineHeight:1.6}}>Comece a economizar neste mês para ver seu jardim florescer!<br/><br/><span style={{fontSize:11,color:"#999"}}>💫 Cada R$ 80 faz uma flor nascer</span></div>
        </div>}

        {/* CSS Animations */}
        <style>{`
          @keyframes sparkle{0%,100%{opacity:0;transform:translateY(0) scale(0)}50%{opacity:1;transform:translateY(-20px) scale(1)}}
          @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
          @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.85}}
          @keyframes floatCloud{0%,100%{transform:translateX(0) translateY(0)}50%{transform:translateX(30px) translateY(-10px)}}
          @keyframes rainbow{0%,100%{opacity:.6;transform:translateY(0)}50%{opacity:.8;transform:translateY(-5px)}}
          @keyframes waterfall{0%{transform:translateY(0);opacity:1}100%{transform:translateY(120px);opacity:0}}
          @keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
          @keyframes butterfly{0%,100%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(60px,-40px) rotate(10deg)}50%{transform:translate(120px,-10px) rotate(-5deg)}75%{transform:translate(80px,30px) rotate(8deg)}}
          @keyframes flutter{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.85)}}
          @keyframes floatFirefly{0%,100%{transform:translate(0,0)}25%{transform:translate(-20px,-30px)}50%{transform:translate(15px,-15px)}75%{transform:translate(-10px,20px)}}
          @keyframes twinkle{0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)}50%{opacity:.3;transform:translate(-50%,-50%) scale(.7)}}
          @keyframes floatSparkle{0%,100%{transform:translateY(0);opacity:0}50%{transform:translateY(-15px);opacity:1}}
          @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        `}</style>
      </div>

      {/* Estatísticas */}
      <div className="card" style={{marginTop:16}}>
        <div className="sec">📊 Elementos do Jardim · {monthLabel(thisMonth)}</div>
        <div style={{fontSize:10,color:"var(--mt)",marginBottom:12,lineHeight:1.5}}>Baseado no saldo deste mês: <strong style={{color:tm.saldo>=0?"var(--gn)":"var(--rd)"}}>{fmt(tm.saldo)}</strong></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"linear-gradient(135deg,rgba(255,105,180,.08),rgba(255,182,193,.05))",borderRadius:14,padding:14,border:"1.5px solid rgba(255,105,180,.2)"}}>
            <div style={{fontSize:10,color:"var(--mt)",marginBottom:6}}>🌸 Flores Mágicas</div>
            <div style={{fontSize:24,fontWeight:800,color:"#FF69B4",marginBottom:4}}>{flores}</div>
            <div style={{fontSize:9,color:"var(--mt)"}}>+1 a cada R$ 80</div>
            {flores<30&&<div style={{fontSize:9,color:"#FF1493",marginTop:4}}>Faltam {fmt(Math.max(0,((flores+1)*80)-saldoMes))}</div>}
          </div>
          <div style={{background:"linear-gradient(135deg,rgba(186,85,211,.08),rgba(221,160,221,.05))",borderRadius:14,padding:14,border:"1.5px solid rgba(186,85,211,.2)"}}>
            <div style={{fontSize:10,color:"var(--mt)",marginBottom:6}}>🦋 Borboletas</div>
            <div style={{fontSize:24,fontWeight:800,color:"#BA55D3",marginBottom:4}}>{borboletas}</div>
            <div style={{fontSize:9,color:"var(--mt)"}}>+1 a cada R$ 200</div>
            {saldoMes<400&&<div style={{fontSize:9,color:"#9C27B0",marginTop:4}}>Desbloqueiam em R$ 400</div>}
          </div>
          <div style={{background:"linear-gradient(135deg,rgba(76,175,80,.08),rgba(129,199,132,.05))",borderRadius:14,padding:14,border:"1.5px solid rgba(76,175,80,.2)"}}>
            <div style={{fontSize:10,color:"var(--mt)",marginBottom:6}}>🌳 Árvores Sábias</div>
            <div style={{fontSize:24,fontWeight:800,color:"#4CAF50",marginBottom:4}}>{arvores}</div>
            <div style={{fontSize:9,color:"var(--mt)"}}>+1 a cada R$ 500</div>
            {saldoMes<1000&&<div style={{fontSize:9,color:"#388E3C",marginTop:4}}>Desbloqueiam em R$ 1.000</div>}
          </div>
          <div style={{background:"linear-gradient(135deg,rgba(255,235,59,.08),rgba(255,241,118,.05))",borderRadius:14,padding:14,border:"1.5px solid rgba(255,235,59,.2)"}}>
            <div style={{fontSize:10,color:"var(--mt)",marginBottom:6}}>✨ Vagalumes</div>
            <div style={{fontSize:24,fontWeight:800,color:"#FFD54F",marginBottom:4}}>{vagalumes}</div>
            <div style={{fontSize:9,color:"var(--mt)"}}>+1 a cada R$ 60</div>
            {saldoMes<200&&<div style={{fontSize:9,color:"#F9A825",marginTop:4}}>Desbloqueiam em R$ 200</div>}
          </div>
        </div>
        <div style={{marginTop:16,padding:12,background:"linear-gradient(135deg,rgba(167,139,250,.08),rgba(244,114,182,.05))",borderRadius:12,border:"1px solid rgba(167,139,250,.15)"}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--pu)",marginBottom:6}}>🎯 Próximos Desbloqueios</div>
          <div style={{fontSize:10,color:"var(--mt)",lineHeight:1.6}}>{cascata?"✅":"❌"} <strong>Cascata Mágica</strong> - R$ 3.000<br/>{arcoiris?"✅":"❌"} <strong>Arco-Íris Místico</strong> - R$ 4.500</div>
        </div>
      </div>
    </>)
  })()}
</>}
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
