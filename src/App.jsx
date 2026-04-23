                          <div style={{fontSize:13,fontWeight:600}}>{r.desc}</div>
                          <div style={{fontSize:9,color:"var(--mt)",marginTop:1}}>{r.date} · {USERS[r.user]?.name}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,fontWeight:700,color:r.type==="receita"?"var(--gn)":"var(--rd)"}}>{r.type==="receita"?"+":"-"}{fmt(r.value)}</div>
                          {bank&&<div style={{fontSize:9,color:bank.color,marginTop:1}}>{bank.name}</div>}
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
                <button key={k} className={`fb ${fBank===k?"on":""}`}
                  style={fBank===k?{background:b.color,borderColor:"transparent"}:{}}
                  onClick={()=>setFBank(fBank===k?"todos":k)}>{b.name}</button>
              ))}
              {[...CATEGORIES.despesa,...CATEGORIES.receita].map(c=>(
                <button key={c.id} className={`fb ${fCat===c.id?"on":""}`} onClick={()=>setFCat(fCat===c.id?"todos":c.id)}>{c.emoji} {c.label.split("/")[0]}</button>
              ))}
            </div>
            {loading
              ?<div className="ld"><div className="sp"/>Carregando...</div>
              :filtered.length===0
                ?<div className="empty"><div style={{fontSize:36,marginBottom:10}}>📭</div>Nenhum registro</div>
                :<>
                  {recG.length>0&&<><div className="rgl">↻ Recorrentes — {fmt(recG.reduce((a,b)=>a+b.value,0))}/mês</div>{recG.map(r=><RecItem key={r.id} r={r}/>)}</>}
                  {avG.length>0&&<><div className="rgl">⚡ Avulsas</div>{avG.map(r=><RecItem key={r.id} r={r}/>)}</>}
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
                {CATEGORIES[form.type].map(c=>(
                  <div key={c.id} className={`cat-opt ${form.category===c.id?"sel":""}`} onClick={()=>setF("category",c.id)}>
                    <div className="cat-opt-em">{c.emoji}</div>
                    <div className="cat-opt-nm">{c.label}</div>
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
                  <div key={k} className={`bo ${form.bank===k?"sel":""}`}
                    style={form.bank===k?{borderColor:b.color+"55",background:b.bg}:{}}
                    onClick={()=>setF("bank",k)}>
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
                {chatHist.map((m,i)=>(
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
