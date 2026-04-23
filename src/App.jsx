import { useState, useRef, useEffect, useMemo } from "react"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from "firebase/firestore"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const db = getFirestore(initializeApp(firebaseConfig))

const USERS = {
  lenin:  { name:"Lenin",  avatar:"L",  color:"#A78BFA" },
  evelyn: { name:"Evelyn", avatar:"Ev", color:"#F472B6" },
}

const BANKS = {
  nubank:      { name:"Nubank",       color:"#C084FC", bg:"#160822", logo:"Nu", venc:19, fech:12 },
  inter:       { name:"Inter",        color:"#FB923C", bg:"#180e04", logo:"In", venc:25, fech:18 },
  mercadopago: { name:"Mercado Pago", color:"#38BDF8", bg:"#061422", logo:"MP", venc:10, fech:3  },
  picpay:      { name:"PicPay",       color:"#34D399", bg:"#061810", logo:"PP", venc:15, fech:8  },
}

const CATS = {
  despesa: [
    { id:"cartao",      label:"Cartão de Crédito",       emoji:"💳" },
    { id:"pix",         label:"Pix / À vista",            emoji:"📲" },
    { id:"mensalidade", label:"Mensalidade/Assinatura",   emoji:"🔁" },
    { id:"emprestimo",  label:"Empréstimo/Financiamento", emoji:"🏦" },
  ],
  receita: [
    { id:"salario",      label:"Salário",                  emoji:"💰" },
    { id:"freelance",    label:"Freelance/Extra",           emoji:"💻" },
    { id:"investimento", label:"Investimento/Rendimento",   emoji:"📈" },
    { id:"outro",        label:"Outro",                     emoji:"📌" },
  ],
}

const CAT_MAP = {}
;[...CATS.despesa, ...CATS.receita].forEach(c => { CAT_MAP[c.id] = c })

const CAT_COLOR = {
  cartao:"#A78BFA", pix:"#38BDF8", mensalidade:"#F472B6", emprestimo:"#F87171",
  salario:"#34D399", freelance:"#FBBF24", investimento:"#6EE7B7", outro:"#818CF8",
}

const fmt      = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" })
const todayStr = () => new Date().toISOString().slice(0, 10)
const curMonth = () => new Date().toISOString().slice(0, 7)

function daysUntil(day) {
  const now = new Date()
  const t = new Date(now.getFullYear(), now.getMonth(), day)
  if (t <= now) t.setMonth(t.getMonth() + 1)
  return Math.ceil((t - now) / 86400000)
}

function BarChart({ data, height=72 }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:5, height }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <div style={{ width:"100%", background:d.color, borderRadius:4, height:`${(d.value/max)*(height-10)}px`, minHeight:3, transition:"height .7s cubic-bezier(.34,1.56,.64,1)", boxShadow:`0 0 8px ${d.color}44` }}/>
          <span style={{ fontSize:7, color:"rgba(255,255,255,.25)" }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function Donut({ pct, color, size=64 }) {
  const s=7, r=size/2-s, c=2*Math.PI*r, f=(pct/100)*c
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={s}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={s}
        strokeDasharray={`${f} ${c-f}`} strokeLinecap="round" style={{ transition:"stroke-dasharray 1s ease" }}/>
    </svg>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#080812;--sf:#0f0f1e;--sf2:#141428;--bd:rgba(255,255,255,.06);--bd2:rgba(255,255,255,.11);--tx:#e8e8f8;--mt:rgba(255,255,255,.38);--pu:#A78BFA;--pk:#F472B6;--gn:#34D399;--rd:#F87171;--yw:#FBBF24;--bl:#38BDF8}
html,body{background:var(--bg);min-height:100vh;font-family:'Outfit',sans-serif}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#A78BFA33;border-radius:99px}
.app{color:var(--tx);min-height:100vh;max-width:430px;margin:0 auto;display:flex;flex-direction:column;position:relative;overflow-x:hidden}
.ga{position:fixed;top:-200px;left:-150px;width:500px;height:500px;background:radial-gradient(circle,rgba(167,139,250,.07),transparent 65%);pointer-events:none;z-index:0}
.gb{position:fixed;bottom:-150px;right:-100px;width:400px;height:400px;background:radial-gradient(circle,rgba(244,114,182,.05),transparent 65%);pointer-events:none;z-index:0}
.hdr{position:sticky;top:0;z-index:50;background:rgba(8,8,18,.92);backdrop-filter:blur(24px);border-bottom:1px solid var(--bd);padding:14px 16px 12px;display:flex;justify-content:space-between;align-items:center}
.logo{font-size:20px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(135deg,var(--pu),var(--pk));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-sub{font-size:9px;color:var(--mt);letter-spacing:2.5px;text-transform:uppercase;margin-top:1px;display:flex;align-items:center;gap:5px}
.sync{width:6px;height:6px;border-radius:50%;background:var(--gn);box-shadow:0 0 6px var(--gn);display:inline-block;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.avs{display:flex;gap:5px}
.av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid}
.content{flex:1;overflow-y:auto;padding:13px 13px 82px;position:relative;z-index:1}
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(8,8,18,.97);backdrop-filter:blur(30px);border-top:1px solid var(--bd);display:flex;z-index:100;padding:7px 6px 18px;gap:3px}
.nb{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 2px;border:none;background:none;cursor:pointer;border-radius:11px;transition:all .2s}
.nb.on{background:linear-gradient(135deg,rgba(167,139,250,.1),rgba(244,114,182,.05))}
.nb-i{font-size:17px;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.nb.on .nb-i{transform:scale(1.2)}
.nb-l{font-size:9px;font-weight:600;color:var(--mt);letter-spacing:.3px}
.nb.on .nb-l{background:linear-gradient(135deg,var(--pu),var(--pk));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:var(--sf);border:1px solid var(--bd);border-radius:18px;padding:15px;margin-bottom:11px}
.hero{background:linear-gradient(135deg,#14142a,#1a0f30);border:1px solid rgba(167,139,250,.14);border-radius:22px;padding:21px;margin-bottom:11px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-60px;right:-60px;width:160px;height:160px;background:radial-gradient(circle,rgba(167,139,250,.1),transparent);border-radius:50%}
.hero::after{content:'';position:absolute;bottom:-40px;left:-40px;width:120px;height:120px;background:radial-gradient(circle,rgba(244,114,182,.07),transparent);border-radius:50%}
.h-lbl{font-size:10px;font-weight:600;color:var(--mt);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.h-val{font-size:34px;font-weight:800;line-height:1;letter-spacing:-1px}
.h-val.pos{background:linear-gradient(135deg,#fff,rgba(255,255,255,.8));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.h-val.neg{background:linear-gradient(135deg,var(--rd),#fca5a5);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sec{font-size:10px;font-weight:700;color:var(--mt);letter-spacing:2px;text-transform:uppercase;margin-bottom:9px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:11px}
.mc{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:12px}
.ml{font-size:9px;font-weight:600;color:var(--mt);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}
.mv{font-size:17px;font-weight:700;line-height:1}
.pbar{height:4px;background:rgba(255,255,255,.05);border-radius:99px;overflow:hidden;margin-top:5px}
.pfill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.34,1.56,.64,1)}
.bscroll{display:flex;gap:9px;overflow-x:auto;padding-bottom:4px;margin-bottom:11px;scrollbar-width:none}
.bscroll::-webkit-scrollbar{display:none}
.bc{min-width:120px;border-radius:16px;padding:12px;position:relative;overflow:hidden;flex-shrink:0;cursor:pointer;border:1.5px solid transparent;transition:all .2s}
.bc:hover{transform:translateY(-2px)}
.bc::before{content:'';position:absolute;top:-18px;right:-18px;width:65px;height:65px;background:radial-gradient(circle,rgba(255,255,255,.09),transparent);border-radius:50%}
.bl{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;margin-bottom:7px}
.bn{font-size:9px;color:rgba(255,255,255,.45);margin-bottom:2px}
.bvc{font-size:8px;color:rgba(255,255,255,.3);margin-bottom:3px}
.bv{font-size:14px;font-weight:700}
.ri{display:flex;align-items:center;gap:9px;padding:10px 12px;background:var(--sf);border:1px solid var(--bd);border-radius:13px;margin-bottom:6px;transition:all .2s}
.ri:hover{border-color:rgba(167,139,250,.18);background:var(--sf2);transform:translateX(2px)}
.ric{width:35px;height:35px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.rif{flex:1;min-width:0}
.rd2{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rm{font-size:9px;color:var(--mt);margin-top:2px;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.pill{font-size:9px;border-radius:99px;padding:1px 7px;font-weight:600}
.rv2{font-size:14px;font-weight:700;white-space:nowrap}
.ras{display:flex;gap:4px;margin-top:2px;justify-content:flex-end}
.ab{width:24px;height:24px;border-radius:7px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;transition:all .2s}
.ab.e{background:rgba(167,139,250,.1);color:var(--pu)}.ab.e:hover{background:rgba(167,139,250,.22)}
.ab.d{background:rgba(248,113,113,.1);color:var(--rd)}.ab.d:hover{background:rgba(248,113,113,.22)}
.rgl{font-size:9px;font-weight:700;color:var(--mt);letter-spacing:2px;text-transform:uppercase;padding:8px 2px 4px}
.filters{display:flex;gap:6px;overflow-x:auto;margin-bottom:11px;padding-bottom:3px;scrollbar-width:none}
.filters::-webkit-scrollbar{display:none}
.fb{padding:5px 12px;border-radius:99px;border:1px solid var(--bd2);background:var(--sf);color:var(--mt);font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .2s;font-family:'Outfit',sans-serif}
.fb.on{background:linear-gradient(135deg,var(--pu),var(--pk));border-color:transparent;color:#fff}
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
.bo-nm{font-size:11px;font-weight:600;color:var(--mt)}
.trow{display:flex;align-items:center;justify-content:space-between;background:var(--sf);border-radius:11px;padding:11px 13px;border:1px solid var(--bd)}
.tgl{width:38px;height:21px;border-radius:99px;cursor:pointer;position:relative;transition:background .2s}
.tgl.on{background:linear-gradient(135deg,var(--pu),var(--pk))}.tgl.on-g{background:linear-gradient(135deg,var(--gn),#059669)}.tgl.off{background:rgba(255,255,255,.1)}
.tgd{position:absolute;top:3px;width:15px;height:15px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 2px 4px rgba(0,0,0,.3)}
.tgl.on .tgd,.tgl.on-g .tgd{left:20px}.tgl.off .tgd{left:3px}
.sbtn{width:100%;padding:13px;border:none;border-radius:13px;background:linear-gradient(135deg,var(--pu),var(--pk));color:#fff;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.5px}
.sbtn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(167,139,250,.28)}
.cbtn{width:100%;margin-top:8px;padding:11px;background:transparent;border:1px solid var(--bd);border-radius:12px;color:var(--mt);cursor:pointer;font-size:12px;font-family:'Outfit',sans-serif;transition:all .2s}
.cbtn:hover{border-color:var(--bd2);color:var(--tx)}
.wtabs{display:flex;border-bottom:1px solid var(--bd);margin-bottom:12px}
.wt{flex:1;padding:8px;text-align:center;font-size:11px;font-weight:700;cursor:pointer;border:none;background:none;transition:all .2s;border-bottom:2px solid transparent;color:var(--mt);font-family:'Outfit',sans-serif}
.wt.on{color:var(--pu);border-bottom-color:var(--pu)}
.couple{display:flex;gap:9px;margin-bottom:11px}
.cc{flex:1;background:var(--sf);border-radius:15px;padding:12px}
.alrt{border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start}
.alrt.warn{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2)}
.alrt.danger{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2)}
.alrt.ok{background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2)}
.alrt.info{background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2)}
.alrt-ico{font-size:18px;flex-shrink:0;margin-top:1px}
.alrt-title{font-size:12px;font-weight:700;margin-bottom:2px}
.alrt-text{font-size:11px;color:var(--mt);line-height:1.5}
.vc{border-radius:16px;padding:14px;margin-bottom:9px;position:relative;overflow:hidden}
.vc::before{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:radial-gradient(circle,rgba(255,255,255,.07),transparent);border-radius:50%}
.vc-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:99px}
.month-sel{display:flex;align-items:center;justify-content:space-between;background:var(--sf);border-radius:12px;padding:10px 14px;margin-bottom:12px}
.mbtn{background:none;border:none;color:var(--mt);font-size:20px;cursor:pointer;padding:0 6px;line-height:1}
.chat-w{display:flex;flex-direction:column;height:calc(100svh - 160px)}
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
.toast{position:fixed;top:68px;left:50%;transform:translateX(-50%);background:var(--sf2);border:1px solid rgba(167,139,250,.2);color:var(--tx);font-size:12px;font-weight:600;padding:7px 16px;border-radius:99px;z-index:200;white-space:nowrap;animation:tIn .3s ease;pointer-events:none}
@keyframes tIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.ld{display:flex;align-items:center;justify-content:center;padding:50px;color:var(--mt);font-size:13px;gap:8px}
.sp{width:16px;height:16px;border:2px solid rgba(167,139,250,.2);border-top-color:var(--pu);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.pt{font-size:19px;font-weight:800;letter-spacing:-.5px;margin-bottom:15px;background:linear-gradient(135deg,var(--pu),var(--pk));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.empty{text-align:center;padding:40px 20px;color:var(--mt);font-size:13px}
.scs{display:flex;gap:8px;margin-bottom:11px}
.sc{flex:1;border-radius:13px;padding:11px}
`

export default function AuryMoney() {
  const [tab, setTab]       = useState("dashboard")
  const [records, setRecs]  = useState([])
  const [loading, setLoad]  = useState(true)
  const [editId, setEditId] = useState(null)
  const [month, setMonth]   = useState(curMonth())
  const [form, setForm]     = useState({ type:"despesa", desc:"", value:"", category:"cartao", date:todayStr(), user:"lenin", bank:"nubank", shared:false, recorrente:false })
  const [fUser, setFUser]   = useState("todos")
  const [fType, setFType]   = useState("todos")
  const [fBank, setFBank]   = useState("todos")
  const [fCat,  setFCat]    = useState("todos")
  const [toast, setToast]   = useState("")
  const [chat, setChat]     = useState([{ role:"assistant", text:"Oi! Sou o Aury 💜 Foco total em solvência e prosperidade pra vocês. Posso registrar gastos, analisar vencimentos e dar estratégias financeiras reais. Como posso ajudar?" }])
  const [chatIn, setChatIn] = useState("")
  const [chatLoad, setChatLoad] = useState(false)
  const chatEnd = useRef(null)

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }) }, [chat])

  useEffect(() => {
    const q = query(collection(db,"records"), orderBy("createdAt","desc"))
    return onSnapshot(q, snap => { setRecs(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setLoad(false) })
  }, [])

  const showToast = m => { setToast(m); setTimeout(() => setToast(""), 2200) }
  const setF = (k,v) => setForm(f => ({...f,[k]:v}))

  // ── Derived ────────────────────────────────────────────────────────────────
  const mRecs   = useMemo(() => records.filter(r => r.date?.startsWith(month)), [records, month])
  const allRec  = useMemo(() => records.filter(r=>r.type==="receita").reduce((a,b)=>a+b.value,0), [records])
  const allExp  = useMemo(() => records.filter(r=>r.type==="despesa").reduce((a,b)=>a+b.value,0), [records])
  const saldo   = allRec - allExp
  const sharedE = useMemo(() => records.filter(r=>r.type==="despesa"&&r.shared).reduce((a,b)=>a+b.value,0), [records])
  const savePct = allRec > 0 ? Math.min(100,Math.max(0,Math.round((saldo/allRec)*100))) : 0
  const mRec    = useMemo(() => mRecs.filter(r=>r.type==="receita").reduce((a,b)=>a+b.value,0), [mRecs])
  const mExp    = useMemo(() => mRecs.filter(r=>r.type==="despesa").reduce((a,b)=>a+b.value,0), [mRecs])

  const bankBal = (k,u="all") => {
    const rs = records.filter(r=>r.bank===k&&(u==="all"||r.user===u))
    return rs.filter(r=>r.type==="receita").reduce((a,b)=>a+b.value,0) - rs.filter(r=>r.type==="despesa").reduce((a,b)=>a+b.value,0)
  }
  const bankMExp = k => mRecs.filter(r=>r.type==="despesa"&&r.bank===k).reduce((a,b)=>a+b.value,0)
  const uTotals  = u => ({
    rec: records.filter(r=>r.user===u&&r.type==="receita").reduce((a,b)=>a+b.value,0),
    exp: records.filter(r=>r.user===u&&r.type==="despesa").reduce((a,b)=>a+b.value,0),
  })

  const monthHist = useMemo(() => {
    return Array.from({length:6},(_,i) => {
      const d = new Date(); d.setMonth(d.getMonth()-5+i)
      const key = d.toISOString().slice(0,7)
      const lbl = d.toLocaleString("pt-BR",{month:"short"})
      const rec = records.filter(r=>r.date?.startsWith(key)&&r.type==="receita").reduce((a,b)=>a+b.value,0)
      const exp = records.filter(r=>r.date?.startsWith(key)&&r.type==="despesa").reduce((a,b)=>a+b.value,0)
      return { key, label:lbl, rec, exp, saldo:rec-exp }
    })
  }, [records])

  const projecao = useMemo(() => {
    const fixas = records.filter(r=>r.type==="despesa"&&r.recorrente).reduce((a,b)=>a+b.value,0)
    const avgs  = monthHist.slice(0,5).map(m => records.filter(r=>r.date?.startsWith(m.key)&&r.type==="despesa"&&!r.recorrente).reduce((a,b)=>a+b.value,0))
    const avgAvulso = avgs.reduce((a,b)=>a+b,0) / (avgs.filter(v=>v>0).length||1)
    return fixas + avgAvulso
  }, [records, monthHist])

  const alerts = useMemo(() => {
    const list = []
    Object.entries(BANKS).forEach(([k,b]) => {
      const days = daysUntil(b.venc), exp = bankMExp(k)
      if (days <= 7 && exp > 0) list.push({ type:days<=3?"danger":"warn", ico:"💳", title:`Fatura ${b.name} vence em ${days} dia${days===1?"":"s"}`, text:`Gasto estimado: ${fmt(exp)}. Vencimento dia ${b.venc}.` })
      if (daysUntil(b.fech) <= 3) list.push({ type:"info", ico:"✂️", title:`Fatura ${b.name} fecha em ${daysUntil(b.fech)} dia${daysUntil(b.fech)===1?"":"s"}`, text:`Dia ${b.fech}. Compras após essa data entram na próxima fatura.` })
    })
    if (allRec>0 && allExp/allRec>0.8) list.push({ type:"danger", ico:"🚨", title:"Comprometimento crítico!", text:`Gastando ${Math.round((allExp/allRec)*100)}% da renda. Prioridade: cortar despesas avulsas imediatamente.` })
    else if (allRec>0 && allExp/allRec>0.6) list.push({ type:"warn", ico:"⚠️", title:"Atenção ao orçamento", text:`${Math.round((allExp/allRec)*100)}% da renda comprometida. Meta saudável: abaixo de 60%.` })
    if (savePct>=20) list.push({ type:"ok", ico:"🎯", title:"Meta de poupança atingida!", text:`${savePct}% da renda poupada. Considerem investir o excedente para acelerar a prosperidade.` })
    return list
  }, [records, mRecs, allRec, allExp, savePct])

  const filtered = useMemo(() => records.filter(r =>
    (fUser==="todos"||r.user===fUser) &&
    (fType==="todos"||r.type===fType) &&
    (fBank==="todos"||r.bank===fBank) &&
    (fCat ==="todos"||r.category===fCat)
  ), [records,fUser,fType,fBank,fCat])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.desc||!form.value||!form.category||!form.bank) return
    const entry = {...form, value:parseFloat(form.value), createdAt:serverTimestamp()}
    try {
      if (editId) { await updateDoc(doc(db,"records",editId),{...form,value:parseFloat(form.value)}); showToast("✓ Atualizado"); setEditId(null) }
      else { await addDoc(collection(db,"records"),entry); showToast("✓ Salvo e sincronizado 🔄") }
      setForm({type:"despesa",desc:"",value:"",category:"cartao",date:todayStr(),user:"lenin",bank:"nubank",shared:false,recorrente:false})
      setTab("registros")
    } catch { showToast("Erro ao salvar") }
  }

  function handleEdit(r) { setEditId(r.id); setForm({type:r.type,desc:r.desc,value:String(r.value),category:r.category,date:r.date,user:r.user,bank:r.bank,shared:!!r.shared,recorrente:!!r.recorrente}); setTab("adicionar") }
  async function handleDel(id) { await deleteDoc(doc(db,"records",id)); showToast("✓ Removido") }

  // ── Chat ──────────────────────────────────────────────────────────────────
  async function sendChat() {
    const msg = chatIn.trim(); if(!msg||chatLoad) return
    setChatIn(""); const h = [...chat,{role:"user",text:msg}]; setChat(h); setChatLoad(true)
    const bsum = Object.entries(BANKS).map(([k,b])=>`${b.name}: saldo ${fmt(bankBal(k))}, fatura mês ${fmt(bankMExp(k))}, vence dia ${b.venc}`).join(" | ")
    const system = `Você é o Aury, assistente financeiro estratégico do casal Lenin e Evelyn. Meta: solvência primeiro, depois prosperidade.
Situação: receitas ${fmt(allRec)}, despesas ${fmt(allExp)}, saldo ${fmt(saldo)}, poupança ${savePct}%.
Cartões: ${bsum}. Projeção próximo mês: ${fmt(projecao)}.
Alertas: ${alerts.map(a=>a.title).join(", ")||"nenhum"}.
Seja objetivo, empático e dê estratégias reais e acionáveis.
Para REGISTRAR, responda SOMENTE JSON: {"action":"add","type":"receita|despesa","desc":"...","value":0,"category":"cartao|pix|mensalidade|emprestimo|salario|freelance|investimento|outro","user":"lenin|evelyn","bank":"nubank|inter|mercadopago|picpay","shared":false,"recorrente":false}`
    const messages = h.slice(-8).map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}))
    try {
      const res  = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system,messages})})
      const data = await res.json()
      const text = data.text||"Não entendi 😅"
      const match = text.match(/\{[\s\S]*"action"\s*:\s*"add"[\s\S]*\}/)
      if (match) {
        try {
          const p = JSON.parse(match[0])
          await addDoc(collection(db,"records"),{type:p.type,desc:p.desc,value:p.value,category:p.category,date:todayStr(),user:p.user||"lenin",bank:p.bank||"nubank",shared:!!p.shared,recorrente:!!p.recorrente,createdAt:serverTimestamp()})
          setChat([...h,{role:"assistant",text:`✅ **${p.desc}** — ${fmt(p.value)} no ${BANKS[p.bank||"nubank"]?.name}${p.recorrente?" 🔄":""}`}])
        } catch { setChat([...h,{role:"assistant",text}]) }
      } else { setChat([...h,{role:"assistant",text}]) }
    } catch { setChat([...h,{role:"assistant",text:"Problema de conexão 😅"}]) }
    setChatLoad(false)
  }

  function RecItem({r}) {
    const bank=BANKS[r.bank], cat=CAT_MAP[r.category]
    return (
      <div className="ri">
        <div className="ric" style={{background:r.type==="receita"?"rgba(52,211,153,.1)":"rgba(248,113,113,.1)"}}>{cat?.emoji||"📌"}</div>
        <div className="rif">
          <div className="rd2">{r.recorrente&&<span style={{color:"var(--gn)",marginRight:3,fontSize:10}}>↻</span>}{r.desc}</div>
          <div className="rm">
            <span>{r.date}</span>·
            <span style={{display:"inline-flex",alignItems:"center",gap:3,background:"rgba(255,255,255,.04)",borderRadius:99,padding:"1px 6px 1px 3px",fontSize:9}}>
              <span style={{width:11,height:11,borderRadius:"50%",background:USERS[r.user]?.color+"18",color:USERS[r.user]?.color,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700}}>{USERS[r.user]?.avatar?.[0]}</span>
              {USERS[r.user]?.name}
            </span>
            {bank&&<span className="pill" style={{background:bank.color+"18",color:bank.color}}>{bank.name}</span>}
            {cat&&<span className="pill" style={{background:CAT_COLOR[r.category]+"18",color:CAT_COLOR[r.category]}}>{cat.label}</span>}
            {r.shared&&<span className="pill" style={{background:"rgba(167,139,250,.1)",color:"var(--pu)"}}>Casal</span>}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div className="rv2" style={{color:r.type==="receita"?"var(--gn)":"var(--rd)"}}>{r.type==="receita"?"+":"-"}{fmt(r.value)}</div>
          <div className="ras">
            <button className="ab e" onClick={()=>handleEdit(r)}>✏</button>
            <button className="ab d" onClick={()=>handleDel(r.id)}>✕</button>
          </div>
        </div>
      </div>
    )
  }

  function changeMonth(d) {
    const [y,m] = month.split("-").map(Number)
    const dt = new Date(y,m-1+d,1)
    setMonth(dt.toISOString().slice(0,7))
  }

  const TABS = [
    {id:"dashboard",lbl:"Início",ico:"⬡"},
    {id:"agenda",   lbl:"Agenda", ico:"📅"},
    {id:"registros",lbl:"Registros",ico:"☰"},
    {id:"adicionar",lbl:editId?"Editar":"Novo",ico:"+"},
    {id:"chat",     lbl:"Aury IA",ico:"✦"},
  ]

  return (
    <>
      <style>{CSS}</style>
      {toast&&<div className="toast">{toast}</div>}
      <div className="app">
        <div className="ga"/><div className="gb"/>

        <header className="hdr">
          <div>
            <div className="logo">Aury Money</div>
            <div className="logo-sub"><span className="sync"/>Lenin & Evelyn</div>
          </div>
          <div className="avs">
            {Object.entries(USERS).map(([k,u])=>(
              <div key={k} className="av" style={{background:`${u.color}15`,borderColor:`${u.color}44`,color:u.color}}>{u.avatar}</div>
            ))}
          </div>
        </header>

        <main className="content">

          {/* ── DASHBOARD ── */}
          {tab==="dashboard"&&(loading?<div className="ld"><div className="sp"/>Carregando...</div>:<>
            <div className="hero">
              <div className="h-lbl">Saldo Total</div>
              <div className={`h-val ${saldo>=0?"pos":"neg"}`}>{fmt(saldo)}</div>
              <div style={{marginTop:9,display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:10,color:"var(--mt)"}}>Poupança:</span>
                <span style={{fontSize:11,fontWeight:700,color:savePct>=20?"var(--gn)":savePct>=10?"var(--yw)":"var(--rd)"}}>{savePct}%</span>
                <span style={{fontSize:10,color:"var(--mt)",marginLeft:"auto"}}>Meta: 20%</span>
              </div>
              <div className="pbar"><div className="pfill" style={{width:`${savePct}%`,background:savePct>=20?"linear-gradient(90deg,var(--gn),#059669)":savePct>=10?"linear-gradient(90deg,var(--yw),#d97706)":"linear-gradient(90deg,var(--rd),#dc2626)"}}/></div>
            </div>

            <div className="g2">
              <div className="mc"><div className="ml">↑ Receitas</div><div className="mv" style={{color:"var(--gn)"}}>{fmt(allRec)}</div></div>
              <div className="mc"><div className="ml">↓ Despesas</div><div className="mv" style={{color:"var(--rd)"}}>{fmt(allExp)}</div></div>
            </div>

            <div className="card">
              <div className="sec">Este mês</div>
              <div style={{display:"flex",gap:8}}>
                {[[mRec,"Receitas","var(--gn)"],[mExp,"Despesas","var(--rd)"],[mRec-mExp,"Saldo",(mRec-mExp)>=0?"var(--gn)":"var(--rd)"]].map(([v,l,c])=>(
                  <div key={l} style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:10,padding:"9px 10px"}}>
                    <div style={{fontSize:9,color:"var(--mt)",marginBottom:3}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:700,color:c}}>{fmt(v)}</div>
                  </div>
                ))}
              </div>
            </div>

            {alerts.length>0&&<>
              <div className="sec">Alertas</div>
              {alerts.slice(0,3).map((a,i)=>(
                <div key={i} className={`alrt ${a.type}`}>
                  <div className="alrt-ico">{a.ico}</div>
                  <div>
                    <div className="alrt-title" style={{color:a.type==="danger"?"var(--rd)":a.type==="warn"?"var(--yw)":a.type==="ok"?"var(--gn)":"var(--pu)"}}>{a.title}</div>
                    <div className="alrt-text">{a.text}</div>
                  </div>
                </div>
              ))}
            </>}

            <div className="sec">Carteiras</div>
            <div className="bscroll">
              {Object.entries(BANKS).map(([k,b])=>{
                const bal=bankBal(k), days=daysUntil(b.venc), me=bankMExp(k)
                return (
                  <div key={k} className="bc" style={{background:b.bg,borderColor:days<=5&&me>0?"var(--rd)":b.color+"22"}} onClick={()=>setTab("agenda")}>
                    <div className="bl" style={{background:b.color+"18",color:b.color}}>{b.logo}</div>
                    <div className="bn">{b.name}</div>
                    <div className="bvc">vence dia {b.venc} · {days}d</div>
                    <div className="bv" style={{color:bal>=0?"var(--gn)":"var(--rd)"}}>{fmt(bal)}</div>
                    {me>0&&<div style={{fontSize:9,color:"var(--yw)",marginTop:2}}>Fatura: {fmt(me)}</div>}
                  </div>
                )
              })}
            </div>

            <div className="couple">
              {[["Lenin","lenin"],["Evelyn","evelyn"]].map(([nm,k])=>{
                const t=uTotals(k),c=USERS[k].color
                return (
                  <div key={k} className="cc" style={{border:`1.5px solid ${c}18`}}>
                    <div style={{fontSize:11,fontWeight:700,color:c,marginBottom:7}}>{nm}</div>
                    <div style={{fontSize:9,color:"var(--mt)",marginBottom:2}}>Receitas</div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--gn)"}}>{fmt(t.rec)}</div>
                    <div style={{fontSize:9,color:"var(--mt)",margin:"5px 0 2px"}}>Despesas</div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--rd)"}}>{fmt(t.exp)}</div>
                  </div>
                )
              })}
            </div>

            <div className="card">
              <div className="sec">Evolução 6 meses</div>
              <BarChart data={monthHist.map(m=>({label:m.label,value:m.rec,color:"#34D399"}))} height={56}/>
              <div style={{marginTop:6}}/>
              <BarChart data={monthHist.map(m=>({label:m.label,value:m.exp,color:"#F87171"}))} height={56}/>
              <div style={{display:"flex",gap:12,marginTop:8}}>
                <span style={{fontSize:10,color:"var(--mt)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:"var(--gn)",display:"inline-block"}}/>Receitas</span>
                <span style={{fontSize:10,color:"var(--mt)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:"var(--rd)",display:"inline-block"}}/>Despesas</span>
              </div>
            </div>

            <div className="card" style={{background:"linear-gradient(135deg,#14142a,#1a0f30)",border:"1px solid rgba(167,139,250,.14)"}}>
              <div className="sec">Projeção próximo mês</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={{fontSize:22,fontWeight:800,color:allRec>projecao?"var(--gn)":"var(--rd)"}}>{fmt(projecao)}</div>
                  <div style={{fontSize:10,color:"var(--mt)",marginTop:2}}>estimativa de despesas</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:700,color:(allRec-projecao)>=0?"var(--gn)":"var(--rd)"}}>{fmt(allRec-projecao)}</div>
                  <div style={{fontSize:10,color:"var(--mt)"}}>saldo projetado</div>
                </div>
              </div>
              <div className="pbar"><div className="pfill" style={{width:`${Math.min((projecao/Math.max(allRec,1))*100,100)}%`,background:"linear-gradient(90deg,var(--pu),var(--pk))"}}/></div>
              <div style={{fontSize:10,color:"var(--mt)",marginTop:4}}>{allRec>0?Math.round((projecao/allRec)*100):0}% da renda comprometida na projeção</div>
            </div>

            <div className="card" style={{display:"flex",gap:14,alignItems:"center"}}>
              <div style={{position:"relative",flexShrink:0}}>
                <Donut pct={allRec>0?(allRec/(allRec+allExp))*100:50} color="var(--gn)"/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{allRec>0?Math.round((allRec/(allRec+allExp))*100):0}%</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"var(--gn)",marginBottom:3}}>● Receitas: {fmt(allRec)}</div>
                <div style={{fontSize:11,color:"var(--rd)",marginBottom:3}}>● Despesas: {fmt(allExp)}</div>
                <div style={{fontSize:11,color:"var(--pu)",marginBottom:3}}>● Casal divide: {fmt(sharedE/2)}/pessoa</div>
                <div style={{fontSize:11,color:"var(--yw)"}}>● Saldo: {fmt(saldo)}</div>
              </div>
            </div>
          </>)}

          {/* ── AGENDA ── */}
          {tab==="agenda"&&<>
            <div className="pt">Agenda Financeira</div>
            <div className="month-sel">
              <button className="mbtn" onClick={()=>changeMonth(-1)}>‹</button>
              <div style={{fontSize:13,fontWeight:700}}>{new Date(month+"-15").toLocaleString("pt-BR",{month:"long",year:"numeric"})}</div>
              <button className="mbtn" onClick={()=>changeMonth(1)}>›</button>
            </div>

            <div className="g2">
              <div className="mc"><div className="ml">Receitas</div><div className="mv" style={{color:"var(--gn)"}}>{fmt(mRec)}</div></div>
              <div className="mc"><div className="ml">Despesas</div><div className="mv" style={{color:"var(--rd)"}}>{fmt(mExp)}</div></div>
            </div>

            <div className="sec">Vencimentos dos Cartões</div>
            {Object.entries(BANKS).map(([k,b])=>{
              const exp=bankMExp(k), days=daysUntil(b.venc), bal=bankBal(k)
              const urgent = days<=5&&exp>0
              return (
                <div key={k} className="vc" style={{background:b.bg,border:`1.5px solid ${urgent?"var(--rd)":b.color+"22"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:38,height:38,borderRadius:11,background:`${b.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:b.color}}>{b.logo}</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{b.name}</div>
                        <div style={{fontSize:9,color:"var(--mt)"}}>Fecha dia {b.fech} · Vence dia {b.venc}</div>
                      </div>
                    </div>
                    <div className="vc-badge" style={{background:urgent?"rgba(248,113,113,.15)":days<=10?"rgba(251,191,36,.15)":"rgba(52,211,153,.15)",color:urgent?"var(--rd)":days<=10?"var(--yw)":"var(--gn)"}}>
                      {days}d
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["FATURA MÊS",exp,b.color],["VENCIMENTO","Dia "+b.venc,urgent?"var(--rd)":"var(--tx)"],["SALDO",bal,bal>=0?"var(--gn)":"var(--rd)"]].map(([l,v,c])=>(
                      <div key={l} style={{flex:1,background:"rgba(255,255,255,.04)",borderRadius:9,padding:"7px 9px"}}>
                        <div style={{fontSize:8,color:"var(--mt)",marginBottom:2}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:700,color:c}}>{typeof v==="number"?fmt(v):v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {alerts.length>0&&<>
              <div className="sec" style={{marginTop:4}}>Avisos Inteligentes</div>
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

            <div className="sec" style={{marginTop:4}}>Lançamentos do mês</div>
            {mRecs.length===0
              ? <div className="empty"><div style={{fontSize:32,marginBottom:8}}>📭</div>Nenhum lançamento neste mês</div>
              : mRecs.slice(0,15).map(r => {
                const cat=CAT_MAP[r.category], bank=BANKS[r.bank]
                return (
                  <div key={r.id} style={{display:"flex",gap:10,marginBottom:8}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:r.type==="receita"?"var(--gn)":"var(--rd)",marginTop:6,flexShrink:0}}/>
                      <div style={{width:1,flex:1,background:"var(--bd)",marginTop:2}}/>
                    </div>
                    <div style={{flex:1,background:"var(--sf)",borderRadius:12,padding:"9px 12px",border:"1px solid var(--bd)",marginBottom:2}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.desc}</div>
                          <div style={{fontSize:9,color:"var(--mt)",marginTop:2}}>
                            {r.date} · {USERS[r.user]?.name}
                            {bank&&<span style={{marginLeft:4,color:bank.color}}>{bank.name}</span>}
                            {cat&&<span style={{marginLeft:4,color:CAT_COLOR[r.category]}}>{cat.emoji} {cat.label}</span>}
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
              {Object.entries(USERS).map(([k,u])=>(
                <button key={k} className={`fb ${fUser===k?"on":""}`} onClick={()=>setFUser(fUser===k?"todos":k)}>{u.name}</button>
              ))}
              {Object.entries(BANKS).map(([k,b])=>(
                <button key={k} className={`fb ${fBank===k?"on":""}`} style={fBank===k?{background:b.color,borderColor:"transparent"}:{}} onClick={()=>setFBank(fBank===k?"todos":k)}>{b.name}</button>
              ))}
              {[...CATS.despesa,...CATS.receita].map(c=>(
                <button key={c.id} className={`fb ${fCat===c.id?"on":""}`} onClick={()=>setFCat(fCat===c.id?"todos":c.id)}>{c.emoji} {c.label.split("/")[0]}</button>
              ))}
            </div>
            {loading
              ? <div className="ld"><div className="sp"/>Carregando...</div>
              : filtered.length===0
                ? <div className="empty"><div style={{fontSize:32,marginBottom:8}}>📭</div>Nenhum registro</div>
                : <>
                    {filtered.filter(r=>r.recorrente).length>0&&<>
                      <div className="rgl">↻ Recorrentes</div>
                      {filtered.filter(r=>r.recorrente).map(r=><RecItem key={r.id} r={r}/>)}
                    </>}
                    {filtered.filter(r=>!r.recorrente).length>0&&<>
                      <div className="rgl">⚡ Avulsas</div>
                      {filtered.filter(r=>!r.recorrente).map(r=><RecItem key={r.id} r={r}/>)}
                    </>}
                  </>
            }
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
            <div style={{marginBottom:12}}><label className="fl">Descrição</label><input className="fi" placeholder="Ex: Fatura Nubank, Salário..." value={form.desc} onChange={e=>setF("desc",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="fl">Valor (R$)</label><input className="fi" type="number" placeholder="0,00" value={form.value} onChange={e=>setF("value",e.target.value)}/></div>
            <div style={{marginBottom:13}}>
              <label className="fl">Cartão / Banco</label>
              <div className="bgrid">
                {Object.entries(BANKS).map(([k,b])=>(
                  <div key={k} className={`bo ${form.bank===k?"sel":""}`} style={form.bank===k?{borderColor:b.color+"55",background:b.bg}:{}} onClick={()=>setF("bank",k)}>
                    <div className="bo-logo" style={{background:`${b.color}18`,color:b.color}}>{b.logo}</div>
                    <div className="bo-nm" style={form.bank===k?{color:"var(--tx)"}:{}}>{b.name}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div><label className="fl">Data</label><input className="fi" type="date" value={form.date} onChange={e=>setF("date",e.target.value)}/></div>
              <div><label className="fl">Quem</label>
                <select className="fi" value={form.user} onChange={e=>setF("user",e.target.value)}>
                  {Object.entries(USERS).map(([k,u])=><option key={k} value={k}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              <div className="trow">
                <div><div style={{fontSize:13,fontWeight:600}}>Conta do casal</div><div style={{fontSize:10,color:"var(--mt)"}}>Dividir entre os dois</div></div>
                <div className={`tgl ${form.shared?"on":"off"}`} onClick={()=>setF("shared",!form.shared)}><div className="tgd"/></div>
              </div>
              <div className="trow">
                <div><div style={{fontSize:13,fontWeight:600}}>↻ Se repete todo mês</div><div style={{fontSize:10,color:"var(--mt)"}}>Mensalidade ou salário fixo</div></div>
                <div className={`tgl ${form.recorrente?"on-g":"off"}`} onClick={()=>setF("recorrente",!form.recorrente)}><div className="tgd"/></div>
              </div>
            </div>
            <button className="sbtn" onClick={handleSave}>{editId?"💾 Salvar Alterações":"✦ Adicionar"}</button>
            {editId&&<button className="cbtn" onClick={()=>{setEditId(null);setForm({type:"despesa",desc:"",value:"",category:"cartao",date:todayStr(),user:"lenin",bank:"nubank",shared:false,recorrente:false})}}>Cancelar</button>}
          </>}

          {/* ── CHAT ── */}
          {tab==="chat"&&<>
            <div style={{marginBottom:12}}>
              <div className="pt">Aury IA</div>
              <div style={{fontSize:10,color:"var(--mt)"}}>Estratégias para solvência e prosperidade · Claude</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#16103a,#1a1240)",border:"1px solid rgba(167,139,250,.1)",borderRadius:12,padding:"10px 12px",marginBottom:11}}>
              <div style={{fontSize:11,color:"var(--mt)",lineHeight:1.6}}>
                💬 Ex: <span style={{color:"var(--pu)"}}>"paguei 350 no Nubank cartão"</span> · <span style={{color:"var(--pk)"}}>"quando vence meu Nubank?"</span> · <span style={{color:"var(--pu)"}}>"como melhorar nossas finanças?"</span>
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

        </main>

        <nav className="nav">
          {TABS.map(t=>(
            <button key={t.id} className={`nb ${tab===t.id?"on":""}`} onClick={()=>{setTab(t.id);if(t.id!=="adicionar")setEditId(null)}}>
              <span className="nb-i" style={{color:tab===t.id?"var(--pu)":"rgba(255,255,255,.18)"}}>{t.ico}</span>
              <span className="nb-l">{t.lbl}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}
