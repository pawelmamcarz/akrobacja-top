/* Website hi-fi mockup — landing page redesign */

const SiteLanding = () => (
  <div style={{width:1440,height:1700,background:"var(--bone)",color:"var(--black)",fontFamily:"Inter,sans-serif",position:"relative",overflow:"hidden"}}>
    {/* NAV */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"22px 56px",background:"var(--white)",borderBottom:"1px solid #E6E2D8"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <img src="extra-300l-illustration.png" alt="" style={{width:46,height:"auto"}}/>
        <div>
          <div className="font-display" style={{fontSize:22,lineHeight:.9,letterSpacing:1,color:"var(--navy)"}}>AKROBACJA<span style={{color:"var(--red)"}}>.COM</span></div>
          <div className="font-mono" style={{fontSize:9,letterSpacing:3,color:"var(--navy)",opacity:.7,marginTop:2}}>EXTRA 300L · SP-EKS</div>
        </div>
      </div>
      <div style={{display:"flex",gap:32,fontSize:13,letterSpacing:1.5,textTransform:"uppercase",fontWeight:600}}>
        <span>Lot zapoznawczy</span>
        <span>Voucher prezent</span>
        <span>Kurs FCL.800</span>
        <span>Pokazy</span>
        <span>Merch</span>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{padding:"10px 16px",border:"1.5px solid var(--navy)",fontSize:12,fontWeight:700,letterSpacing:1.5}}>+48 535 535 221</div>
        <div style={{padding:"10px 18px",background:"var(--red)",color:"#fff",fontSize:12,fontWeight:700,letterSpacing:1.5}}>KUP VOUCHER →</div>
      </div>
    </div>

    {/* HERO — full-bleed photo */}
    <div style={{position:"relative",height:780,overflow:"hidden",background:"#000"}}>
      <img src="hero-takeoff.webp" alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
      {/* tonal nav overlay (left side, fades right) */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg, rgba(4,14,42,.78) 0%, rgba(10,47,124,.55) 35%, rgba(0,0,0,0) 65%)"}}/>
      {/* hi-vis stripe */}
      <div className="diag-stripes" style={{position:"absolute",top:0,left:0,right:0,height:12,opacity:.95}}/>
      <div className="diag-stripes" style={{position:"absolute",bottom:0,left:0,right:0,height:12,opacity:.95}}/>

      {/* HUD frame */}
      <div style={{position:"absolute",top:32,left:56,right:56,display:"flex",justifyContent:"space-between",fontFamily:"JetBrains Mono,monospace",fontSize:11,letterSpacing:3,color:"var(--cyan)"}}>
        <span>● LIVE · EPRP RWY 27 · WIND 240/06 · CAVOK</span>
        <span>N51°23'21" E021°12'48"</span>
      </div>

      <div style={{position:"absolute",left:56,top:130,maxWidth:640,color:"#fff"}}>
        <div className="font-mono" style={{fontSize:12,letterSpacing:6,color:"var(--cyan)"}}>20 MIN · 12 MIN AKROBACJI · ±8G</div>
        <div className="font-display" style={{fontSize:108,lineHeight:.86,letterSpacing:1,marginTop:14}}>
          LOT, KTÓREGO<br/>NIE ZAPOMNISZ.<br/><span style={{color:"var(--cyan)"}}>NAPRAWDĘ.</span>
        </div>
        <p style={{fontSize:18,lineHeight:1.55,opacity:.92,maxWidth:480,marginTop:22}}>
          Akrobacja z pilotem instruktorem na dwumiejscowym <b>Extra 300L SP-EKS</b>. Lotnisko Radom-Piastów, 90 minut z Warszawy. Ten sam typ samolotu, którym lata reprezentacja Polski.
        </p>
        <div style={{display:"flex",gap:12,marginTop:30}}>
          <div style={{background:"var(--red)",padding:"18px 26px",fontSize:13,fontWeight:700,letterSpacing:2}}>ZAREZERWUJ — od 1 490 zł →</div>
          <div style={{border:"1.5px solid #fff",padding:"18px 26px",fontSize:13,fontWeight:700,letterSpacing:2,background:"rgba(255,255,255,.06)",backdropFilter:"blur(4px)"}}>VOUCHER PREZENT</div>
        </div>
      </div>

      {/* tail tag bottom-left */}
      <div style={{position:"absolute",left:56,bottom:32,color:"#fff",display:"flex",gap:32}}>
        {[{n:"6 000h",l:"NA EXTRA 300L"},{n:"±10G",l:"CERTYFIKAT"},{n:"4.97★",l:"GOOGLE"},{n:"1 200+",l:"PASAŻERÓW"}].map(m=>(
          <div key={m.l} style={{borderLeft:"2px solid var(--cyan)",paddingLeft:12}}>
            <div className="font-display" style={{fontSize:30,lineHeight:.9}}>{m.n}</div>
            <div className="font-mono" style={{fontSize:9,letterSpacing:3,opacity:.85,marginTop:4,color:"var(--cyan)"}}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* tail registration top right */}
      <div style={{position:"absolute",right:56,top:80,textAlign:"right",color:"#fff"}}>
        <div className="font-mono" style={{fontSize:10,letterSpacing:4,color:"var(--cyan)"}}>REG. NUMBER</div>
        <div className="font-display" style={{fontSize:42,lineHeight:.9,letterSpacing:6}}>SP-EKS</div>
        <div className="font-mono" style={{fontSize:9,letterSpacing:3,opacity:.7,marginTop:4}}>EXTRA 300L · S/N 1290</div>
      </div>
    </div>

    {/* PRODUCT TILES */}
    <div style={{padding:"56px 56px 24px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:24}}>
        <div className="font-display" style={{fontSize:64,lineHeight:.9,color:"var(--navy)"}}>WYBIERZ LOT.</div>
        <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--navy)",opacity:.6}}>3 PAKIETY · ZAPŁACISZ ZA 90 SEKUND</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {[
          {t:"PIERWSZY G",p:"1 490",s:"15 min",d:"Loop · beczka · korkociąg. Idealny pierwszy raz.",c:"var(--white)",ink:"var(--black)",b:"1px solid #DDD"},
          {t:"PEŁNY PROGRAM",p:"1 990",s:"20 min",d:"Cały zestaw figur. Tumble, hammerhead, lot odwrócony. Najczęściej kupowany.",c:"var(--navy)",ink:"#fff",accent:true},
          {t:"MASTERCLASS",p:"3 490",s:"45 min · 2 loty",d:"Briefing + lot szkoleniowy z Maciejem. Zaliczany do FCL.800.",c:"var(--black)",ink:"#fff"},
        ].map(p=>(
          <div key={p.t} style={{background:p.c,color:p.ink,padding:32,minHeight:340,position:"relative",border:p.b||"none",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            {p.accent && <div style={{position:"absolute",top:0,right:0,background:"var(--red)",color:"#fff",padding:"6px 14px",fontSize:10,letterSpacing:3,fontWeight:700}}>BESTSELLER</div>}
            <div>
              <div className="font-mono" style={{fontSize:11,letterSpacing:4,opacity:.7}}>{p.s.toUpperCase()}</div>
              <div className="font-display" style={{fontSize:42,lineHeight:.95,letterSpacing:1,marginTop:8}}>{p.t}</div>
              <p style={{fontSize:14,lineHeight:1.5,marginTop:14,opacity:.85}}>{p.d}</p>
            </div>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginTop:24}}>
              <div>
                <div className="font-display" style={{fontSize:54,lineHeight:.9}}>{p.p}<span style={{fontSize:18,opacity:.6}}> zł</span></div>
              </div>
              <div style={{padding:"12px 16px",background:p.accent?"var(--red)":(p.ink==="#fff"?"#fff":"var(--navy)"),color:p.accent?"#fff":(p.ink==="#fff"?"var(--navy)":"#fff"),fontSize:11,fontWeight:700,letterSpacing:2}}>WYBIERZ →</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* HOW IT WORKS */}
    <div style={{padding:"56px",background:"var(--white)",margin:"24px 56px",border:"1px solid #E6E2D8"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:32}}>
        <div className="font-display" style={{fontSize:48,lineHeight:.9,color:"var(--navy)"}}>JAK TO DZIAŁA.</div>
        <div className="font-mono" style={{fontSize:10,letterSpacing:3,color:"var(--navy)",opacity:.6}}>CHECKLIST · 5 STEPS</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:18,position:"relative"}}>
        <div style={{position:"absolute",left:24,right:24,top:14,height:2,background:"repeating-linear-gradient(90deg,var(--navy) 0 8px,transparent 8px 16px)"}}/>
        {[
          {n:"01",t:"KUPUJESZ",d:"Stripe / BLIK / P24. Voucher PDF na maila w 60 sek."},
          {n:"02",t:"DZWONISZ",d:"Wybieracie termin. Sprawdzamy pogodę 7 dni do przodu."},
          {n:"03",t:"PRZYJEŻDŻASZ",d:"EPRP, brama Piastów. Briefing 20 min, dopasowanie spadochronu."},
          {n:"04",t:"LECISZ",d:"20 minut. Maciej leci, ty kręcisz figury. Kamera GoPro w gratisie."},
          {n:"05",t:"WRACASZ",d:"Krótkie debriefing, kawa, pamiątkowe nagranie 4K na maila."},
        ].map(s=>(
          <div key={s.n} style={{textAlign:"left"}}>
            <div style={{width:30,height:30,borderRadius:30,background:"var(--navy)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontFamily:"JetBrains Mono",fontSize:11,position:"relative",zIndex:1}}>{s.n}</div>
            <div className="font-display" style={{fontSize:22,lineHeight:1,marginTop:14,color:"var(--navy)"}}>{s.t}</div>
            <p style={{fontSize:12,lineHeight:1.5,marginTop:8,color:"#444"}}>{s.d}</p>
          </div>
        ))}
      </div>
    </div>

    {/* PILOT FOOTER STRIP */}
    <div style={{margin:"24px 56px 56px",background:"var(--black)",color:"#fff",padding:36,display:"grid",gridTemplateColumns:"1fr 1fr",gap:32,alignItems:"center"}}>
      <div>
        <div className="font-mono" style={{fontSize:11,letterSpacing:4,color:"var(--cyan)"}}>YOUR PILOT IN COMMAND</div>
        <div className="font-display" style={{fontSize:64,lineHeight:.9,marginTop:6}}>MACIEJ<br/>KULASZEWSKI</div>
        <p style={{fontSize:14,lineHeight:1.6,opacity:.8,marginTop:16,maxWidth:440}}>
          Pilot akrobacyjny z 6 000h nalotu. Reprezentacja Polski. Instruktor FCL.800. Lata SP-EKS od 2018 roku.
        </p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,fontSize:13,fontFamily:"JetBrains Mono"}}>
        {[["NALOT OGÓŁEM","6 240 h"],["NALOT NA EXTRA","2 110 h"],["LICENCJE","CPL(A) · FI · FCL.800"],["MISTRZOSTWA","PL '22 · '24 — 1·2 m."]].map(([k,v])=>(
          <div key={k} style={{borderTop:"2px solid var(--cyan)",paddingTop:10}}>
            <div style={{fontSize:9,letterSpacing:3,color:"var(--cyan)"}}>{k}</div>
            <div style={{fontSize:18,marginTop:4}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { SiteLanding });
