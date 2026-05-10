/* L1 finalist — full lockup pack */

const Frame = ({ children, code, label, bg="var(--bone)", ink="var(--black)", w=620, h=520, pad=32 }) => (
  <div style={{width:w,height:h,background:bg,color:ink,padding:pad,position:"relative",overflow:"hidden",fontFamily:"Inter,sans-serif"}}>
    <div style={{position:"absolute",top:14,left:14,right:14,display:"flex",justifyContent:"space-between"}}>
      <div className="font-mono" style={{fontSize:9,letterSpacing:3,opacity:.55}}>{code}</div>
      <div className="font-mono" style={{fontSize:9,letterSpacing:3,opacity:.55}}>akrobacja.com</div>
    </div>
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</div>
    <div style={{position:"absolute",left:14,bottom:12,fontFamily:"JetBrains Mono",fontSize:9,letterSpacing:3,opacity:.65}}>{label}</div>
  </div>
);

/* The L1 lockup component — single source of truth */
const L1Lockup = ({ scale=1, ink="var(--navy)", accent="var(--red)", sub="var(--navy)", planeFilter="" }) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16*scale}}>
    <img src="extra-300l-illustration.png" alt="" style={{width:340*scale,height:"auto",filter:planeFilter}}/>
    <div style={{textAlign:"center"}}>
      <div className="font-display" style={{fontSize:104*scale,lineHeight:.82,color:ink,letterSpacing:2*scale}}>
        AKROBACJA<span style={{color:accent}}>.COM</span>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10*scale,marginTop:10*scale}}>
        <div style={{flex:1,height:1,background:sub,opacity:.35,maxWidth:80*scale}}/>
        <div className="font-mono" style={{fontSize:11*scale,letterSpacing:5,color:sub}}>FLYING THE EXTRA 300L · SP-EKS</div>
        <div style={{flex:1,height:1,background:sub,opacity:.35,maxWidth:80*scale}}/>
      </div>
    </div>
  </div>
);

/* A1 — primary on bone */
const L1_Primary = () => (
  <Frame code="L1A · PRIMARY" label="WERSJA PODSTAWOWA · JASNE TŁO · COLOR" w={720} h={620} pad={40}>
    <L1Lockup scale={1.05}/>
  </Frame>
);

/* A2 — on navy */
const L1_OnNavy = () => (
  <Frame code="L1B · ON NAVY" label="NEGATYW NA GRANACIE · STRONA / NAGŁÓWEK" bg="var(--navy)" ink="#fff" w={720} h={620} pad={40}>
    <L1Lockup scale={1.05} ink="#fff" accent="#fff" sub="#00E5FF" planeFilter="brightness(0) invert(1)"/>
  </Frame>
);

/* A3 — on black with red accent */
const L1_OnBlack = () => (
  <Frame code="L1C · ON BLACK" label="MONO + RED · MERCH / PLAKAT" bg="var(--black)" ink="#fff" w={720} h={620} pad={40}>
    <L1Lockup scale={1.05} ink="#fff" accent="#E11E26" sub="#fff" planeFilter="brightness(0) invert(1)"/>
  </Frame>
);

/* A4 — single ink (navy mono) */
const L1_Mono = () => (
  <Frame code="L1D · MONOCHROME" label="JEDNOKOLOROWA · HAFT / GRAWER / DRUK 1+0" w={720} h={620} pad={40}>
    <L1Lockup scale={1.05} ink="var(--navy)" accent="var(--navy)" sub="var(--navy)"
      planeFilter="brightness(0) saturate(100%) invert(15%) sepia(72%) saturate(2200%) hue-rotate(217deg)"/>
  </Frame>
);

/* A5 — clear-space + grid */
const L1_ClearSpace = () => (
  <Frame code="L1 · CLEAR SPACE" label="MINIMUM 1× WYSOKOŚĆ MAŁEJ LITERY 'A' · NIE ŚCISKAĆ" w={1100} h={620} pad={32} bg="var(--white)">
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {/* clearspace overlay */}
      <div style={{position:"absolute",inset:32,border:"1px dashed rgba(10,47,124,.4)"}}/>
      <div style={{position:"absolute",inset:80,border:"1px dashed rgba(225,30,38,.6)"}}/>
      <div style={{position:"absolute",left:40,top:28,fontFamily:"JetBrains Mono",fontSize:9,letterSpacing:2,color:"var(--navy)"}}>SAFE AREA</div>
      <div style={{position:"absolute",left:88,top:60,fontFamily:"JetBrains Mono",fontSize:9,letterSpacing:2,color:"var(--red)"}}>LOGO BOX</div>
      <div style={{transform:"scale(0.85)"}}><L1Lockup scale={.95}/></div>
      {/* corner ticks */}
      {[[40,40],[40,540],[1020,40],[1020,540]].map((p,i)=>(
        <div key={i} style={{position:"absolute",left:p[0],top:p[1],width:14,height:14,borderTop:"1px solid var(--navy)",borderLeft:"1px solid var(--navy)"}}/>
      ))}
    </div>
  </Frame>
);

/* A6 — minimum sizes */
const L1_Sizes = () => (
  <Frame code="L1 · MIN SIZES" label="MINIMALNE ROZMIARY · NIE SCHODZIĆ PONIŻEJ" w={1100} h={520} pad={36} bg="var(--white)">
    <div style={{display:"flex",alignItems:"flex-end",gap:48,width:"100%",justifyContent:"space-around"}}>
      {[1,.55,.32,.18].map((s,i)=>(
        <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
          <div style={{transform:`scale(${s})`,transformOrigin:"bottom center"}}><L1Lockup scale={.9}/></div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:3,color:"var(--navy)"}}>{["DRUK / OUTDOOR","WEB · 320px+","FAVICON 80px","LIMIT 32px"][i]}</div>
        </div>
      ))}
    </div>
  </Frame>
);

/* A7 — color tokens for L1 */
const L1_Colors = () => (
  <Frame code="L1 · COLOR TOKENS" label="TYLKO TE 4 KOLORY · ŻADNYCH GRADIENTÓW NA LOGO" w={1100} h={420} pad={36} bg="var(--bone)">
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,width:"100%"}}>
      {[
        {n:"NAVY",h:"#0A2F7C",r:"AKROBACJA · TYP",ink:"#fff"},
        {n:"RED",h:"#E11E26",r:".COM · AKCENT",ink:"#fff"},
        {n:"BLACK",h:"#070F1A",r:"INK · 1-COLOR",ink:"#fff"},
        {n:"WHITE",h:"#FFFFFF",r:"PAPIER · NEGATYW",ink:"#070F1A"},
      ].map(c=>(
        <div key={c.n} style={{background:c.h,color:c.ink,padding:18,height:200,display:"flex",flexDirection:"column",justifyContent:"space-between",border:c.h==="#FFFFFF"?"1px solid #DDD":"none"}}>
          <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.7}}>{c.r}</div>
          <div>
            <div className="font-display" style={{fontSize:36,lineHeight:.9}}>{c.n}</div>
            <div className="font-mono" style={{fontSize:11,letterSpacing:2,marginTop:6,opacity:.85}}>{c.h}</div>
          </div>
        </div>
      ))}
    </div>
  </Frame>
);

/* A8 — Don'ts */
const L1_Donts = () => (
  <Frame code="L1 · DON'TS" label="NIE RÓB TEGO · 6 PRZYPADKÓW" w={1100} h={620} pad={36} bg="var(--white)">
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gridTemplateRows:"1fr 1fr",gap:14,width:"100%",height:"100%"}}>
      {[
        {l:"NIE OBRACAJ",t:s=>"rotate(-12deg)"},
        {l:"NIE SKALUJ NIESYMETRYCZNIE",t:_=>"scaleX(.6)"},
        {l:"NIE ZMIENIAJ KOLORÓW",t:_=>"",inkOver:"#7AB000",accentOver:"#FFB300"},
        {l:"NIE DODAWAJ EFEKTÓW",t:_=>"",shadow:true},
        {l:"NIE PRZESTAWIAJ ELEMENTÓW",t:_=>"",reverse:true},
        {l:"NIE UŻYWAJ NA NIECZYTELNYM TLE",t:_=>"",bgPatt:true},
      ].map((d,i)=>(
        <div key={i} style={{position:"relative",border:"1px solid #E6E2D8",overflow:"hidden",background:d.bgPatt?"radial-gradient(circle at 30% 30%,#FFB300 0%,#E11E26 60%)":"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{transform:d.t(.2),filter:d.shadow?"drop-shadow(0 8px 8px rgba(0,0,0,.4))":"",flexDirection:d.reverse?"column-reverse":"column",display:"flex",alignItems:"center",gap:6}}>
            <img src="extra-300l-illustration.png" alt="" style={{width:80,height:"auto"}}/>
            <div className="font-display" style={{fontSize:22,lineHeight:.85,color:d.inkOver||"var(--navy)"}}>AKROBACJA<span style={{color:d.accentOver||"var(--red)"}}>.COM</span></div>
          </div>
          {/* slash */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
            <line x1="0" y1="100" x2="100" y2="0" stroke="#E11E26" strokeWidth=".6" opacity=".7"/>
          </svg>
          <div style={{position:"absolute",bottom:8,left:10,fontFamily:"JetBrains Mono",fontSize:9,letterSpacing:2,color:"var(--red)",fontWeight:700}}>✕ {d.l}</div>
        </div>
      ))}
    </div>
  </Frame>
);

/* A9 — applications row: favicon, social avatar, business card */
const L1_Apps = () => (
  <Frame code="L1 · APPLICATIONS" label="FAVICON · AVATAR · WIZYTÓWKA · STOPKA EMAIL" w={1100} h={520} pad={36} bg="var(--bone)">
    <div style={{display:"flex",gap:16,width:"100%",alignItems:"stretch",justifyContent:"center"}}>
      {/* Favicon — uses just the plane silhouette in navy */}
      <div style={{flex:"0 0 130px",background:"#fff",border:"1px solid #E6E2D8",padding:18,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between"}}>
        <div className="font-mono" style={{fontSize:9,letterSpacing:2,color:"var(--navy)"}}>FAVICON 64</div>
        <div style={{width:64,height:64,background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src="extra-300l-illustration.png" alt="" style={{width:54,filter:"brightness(0) invert(1)"}}/>
        </div>
        <div className="font-mono" style={{fontSize:8,letterSpacing:2,color:"var(--navy)",opacity:.6}}>akrobacja.com</div>
      </div>

      {/* Social avatar */}
      <div style={{flex:"0 0 200px",background:"#fff",border:"1px solid #E6E2D8",padding:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between"}}>
        <div className="font-mono" style={{fontSize:9,letterSpacing:2,color:"var(--navy)"}}>SOCIAL · 1024</div>
        <div style={{width:140,height:140,borderRadius:"50%",background:"var(--navy)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#fff",overflow:"hidden",position:"relative"}}>
          <img src="extra-300l-illustration.png" alt="" style={{width:90,filter:"brightness(0) invert(1)",marginBottom:-4}}/>
          <div className="font-display" style={{fontSize:14,letterSpacing:1}}>AKROBACJA<span style={{color:"#E11E26"}}>.COM</span></div>
        </div>
        <div className="font-mono" style={{fontSize:8,letterSpacing:2,color:"var(--navy)",opacity:.6}}>IG · FB · YT · TIKTOK</div>
      </div>

      {/* Business card */}
      <div style={{flex:"1 1 360px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{flex:1,background:"var(--navy)",color:"#fff",padding:20,display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>
          <div className="diag-stripes" style={{position:"absolute",bottom:0,left:0,right:0,height:8}}/>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <img src="extra-300l-illustration.png" alt="" style={{width:60,filter:"brightness(0) invert(1)"}}/>
            <div>
              <div className="font-display" style={{fontSize:24,lineHeight:.9,letterSpacing:1}}>AKROBACJA<span style={{color:"#E11E26"}}>.COM</span></div>
              <div className="font-mono" style={{fontSize:8,letterSpacing:3,color:"#00E5FF",marginTop:4}}>FLYING THE EXTRA 300L · SP-EKS</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",fontSize:11,fontFamily:"JetBrains Mono"}}>
            <div>
              <div style={{fontFamily:"Anton",fontSize:18,letterSpacing:1}}>MACIEJ KULASZEWSKI</div>
              <div style={{opacity:.7,marginTop:2}}>PILOT · INSTRUKTOR FCL.800</div>
            </div>
            <div style={{textAlign:"right",lineHeight:1.6}}>
              <div>+48 535 535 221</div>
              <div style={{color:"#00E5FF"}}>dto@akrobacja.com</div>
            </div>
          </div>
        </div>
        {/* email signature */}
        <div style={{flex:"0 0 90px",background:"#fff",border:"1px solid #E6E2D8",padding:14,display:"flex",alignItems:"center",gap:14}}>
          <img src="extra-300l-illustration.png" alt="" style={{width:54}}/>
          <div style={{borderLeft:"2px solid var(--red)",paddingLeft:12,fontSize:11}}>
            <div style={{fontFamily:"Anton",fontSize:18,color:"var(--navy)"}}>Maciej Kulaszewski</div>
            <div style={{color:"#444",fontSize:10,lineHeight:1.5}}>akrobacja.com · pilot · +48 535 535 221</div>
          </div>
        </div>
      </div>
    </div>
  </Frame>
);

Object.assign(window, { L1_Primary, L1_OnNavy, L1_OnBlack, L1_Mono, L1_ClearSpace, L1_Sizes, L1_Colors, L1_Donts, L1_Apps });
