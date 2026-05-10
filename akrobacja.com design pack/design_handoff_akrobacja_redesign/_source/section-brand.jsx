/* Brand foundation artboards — palette, type, voice, principles */

const Swatch = ({ name, hex, ink="white", note }) => (
  <div style={{background:hex,color:ink,padding:"18px 18px 16px",borderRadius:0,minHeight:140,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
    <div className="font-mono" style={{fontSize:11,letterSpacing:2,opacity:.75}}>{note}</div>
    <div>
      <div className="font-display" style={{fontSize:28,lineHeight:.95}}>{name}</div>
      <div className="font-mono" style={{fontSize:11,letterSpacing:2,opacity:.85,marginTop:6}}>{hex}</div>
    </div>
  </div>
);

const Palette = () => (
  <div style={{width:1200,height:760,background:"var(--bone)",padding:48,fontFamily:"Inter,sans-serif",color:"var(--black)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:28}}>
      <div className="font-display" style={{fontSize:64,lineHeight:.9}}>PALETA</div>
      <div className="font-mono" style={{fontSize:11,letterSpacing:3,opacity:.6}}>01 · COLOR SYSTEM</div>
    </div>
    <p style={{maxWidth:760,fontSize:15,lineHeight:1.55,marginBottom:28}}>
      Granat, biel i czerń to barwy kadłuba SP-EKS. <b>Cyan</b> wnosi „prędkość" — kolor wskaźników i akcentów cyfrowych. <b>Czerwony</b> to akcent z ogona samolotu i sygnał akcji (CTA, voucher).
    </p>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
      <Swatch name="Navy" hex="#0A2F7C" note="PRIMARY · 60%"/>
      <Swatch name="Black" hex="#070F1A" note="INK"/>
      <Swatch name="Bone" hex="#F4F1EA" ink="#070F1A" note="SURFACE"/>
      <Swatch name="White" hex="#FFFFFF" ink="#070F1A" note="PAPER"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
      <Swatch name="Cyan" hex="#00E5FF" ink="#070F1A" note="ACCENT · DIGITAL"/>
      <Swatch name="Red" hex="#E11E26" note="ACTION · CTA"/>
      <Swatch name="High-Vis" hex="#FFB300" ink="#070F1A" note="HAZARD · STRIPE"/>
    </div>
    <div style={{marginTop:28,display:"flex",gap:24,alignItems:"center"}}>
      <div className="diag-stripes" style={{height:40,flex:1}}></div>
      <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--navy)"}}>RUNWAY · HOLD SHORT</div>
    </div>
  </div>
);

const Typography = () => (
  <div style={{width:1200,height:760,background:"var(--white)",padding:48,color:"var(--black)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:24}}>
      <div className="font-display" style={{fontSize:64,lineHeight:.9}}>TYPOGRAFIA</div>
      <div className="font-mono" style={{fontSize:11,letterSpacing:3,opacity:.6}}>02 · TYPE SYSTEM</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:32}}>
      <div>
        <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--navy)"}}>DISPLAY · ANTON</div>
        <div className="font-display" style={{fontSize:140,lineHeight:.85,color:"var(--navy)",marginTop:6}}>MAKE IT<br/>VERTICAL.</div>
        <div className="font-display" style={{fontSize:48,lineHeight:.95,marginTop:18,color:"var(--black)"}}>±8G · ROLL · LOOP · HAMMERHEAD</div>
        <div style={{marginTop:32}}>
          <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--navy)"}}>BODY · INTER</div>
          <p style={{fontSize:18,lineHeight:1.5,maxWidth:540,marginTop:6}}>
            Dwumiejscowy Extra 300L SP-EKS, certyfikowany do +/-10G. Pilot Maciej Kulaszewski. Lotnisko Radom-Piastów (EPRP). Lot trwa 20 minut, z czego 12 — to czysta akrobacja.
          </p>
        </div>
        <div style={{marginTop:24}}>
          <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--navy)"}}>MONO · JETBRAINS MONO</div>
          <div className="font-mono" style={{fontSize:14,letterSpacing:2,marginTop:6,color:"var(--red)"}}>SP-EKS · EPRP · N51°23' E21°12'</div>
        </div>
      </div>
      <div style={{background:"var(--navy)",color:"var(--white)",padding:28,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--cyan)"}}>SCALE</div>
        <div>
          <div style={{fontSize:96,fontFamily:"Anton",lineHeight:.85}}>Aa</div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.6,marginTop:8}}>H1 · 96/88</div>
        </div>
        <div>
          <div style={{fontSize:48,fontFamily:"Anton",lineHeight:.9}}>Aa</div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.6,marginTop:6}}>H2 · 48/52</div>
        </div>
        <div>
          <div style={{fontSize:24,fontFamily:"Inter",fontWeight:600}}>Aa</div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.6,marginTop:6}}>H3 · 24/32</div>
        </div>
        <div>
          <div style={{fontSize:16,fontFamily:"Inter"}}>Aa</div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.6,marginTop:6}}>BODY · 16/26</div>
        </div>
        <div>
          <div style={{fontSize:11,fontFamily:"JetBrains Mono",letterSpacing:3}}>AA</div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.6,marginTop:6}}>META · 11/16</div>
        </div>
      </div>
    </div>
  </div>
);

const VoicePrinciples = () => (
  <div style={{width:1200,height:760,background:"var(--navy)",color:"var(--white)",padding:48,position:"relative",overflow:"hidden"}}>
    <div className="diag-stripes" style={{position:"absolute",top:0,left:0,right:0,height:24,opacity:.85}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:36,marginBottom:24}}>
      <div className="font-display" style={{fontSize:64,lineHeight:.9}}>GŁOS MARKI</div>
      <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--cyan)"}}>03 · VOICE & PRINCIPLES</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:24,marginTop:24}}>
      {[
        {n:"01",t:"PRECYZYJNI",d:"Mówimy językiem kokpitu. Liczby, jednostki, checklisty. Bez sloganów które nic nie znaczą."},
        {n:"02",t:"BEZ STRACHU",d:"Akrobacja jest bezpieczniejsza niż jazda samochodem — jeśli robisz ją z odpowiednim sprzętem i pilotem."},
        {n:"03",t:"DLA LUDZI",d:"Pilot z 6000h na Extra 300L. Voucher, podjazd, lot, kawa. Bez korpo-ściemy."},
      ].map(p=> (
        <div key={p.n} style={{borderTop:"2px solid var(--cyan)",paddingTop:14}}>
          <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--cyan)"}}>{p.n}</div>
          <div className="font-display" style={{fontSize:36,lineHeight:.95,marginTop:6}}>{p.t}</div>
          <p style={{fontSize:14,lineHeight:1.55,opacity:.85,marginTop:10}}>{p.d}</p>
        </div>
      ))}
    </div>

    <div style={{marginTop:40,display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
      <div style={{background:"rgba(255,255,255,.08)",padding:20}}>
        <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--cyan)"}}>MÓWIMY</div>
        <ul style={{fontSize:15,lineHeight:1.7,marginTop:8,paddingLeft:18}}>
          <li>„20 minut. 12 minut akrobacji. ±8G."</li>
          <li>„Lot z pilotem akrobacyjnym, nie symulator."</li>
          <li>„Kupujesz, lecisz, nie żałujesz."</li>
        </ul>
      </div>
      <div style={{background:"rgba(225,30,38,.18)",padding:20,borderLeft:"4px solid var(--red)"}}>
        <div className="font-mono" style={{fontSize:11,letterSpacing:3,color:"var(--red)"}}>NIE MÓWIMY</div>
        <ul style={{fontSize:15,lineHeight:1.7,marginTop:8,paddingLeft:18,opacity:.85}}>
          <li>„Niezapomniana przygoda życia"</li>
          <li>„Zarezerwuj swój wymarzony lot"</li>
          <li>„Adrenalina gwarantowana"</li>
        </ul>
      </div>
    </div>
  </div>
);

Object.assign(window, { Palette, Typography, VoicePrinciples });
