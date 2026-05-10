/* Logo exploration artboards */

const LogoFrame = ({ children, label, code, dark=false, width=560, height=560 }) => (
  <div style={{width,height,background:dark?"var(--navy)":"var(--bone)",color:dark?"#fff":"var(--black)",padding:32,display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>
    <div style={{display:"flex",justifyContent:"space-between"}}>
      <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.6}}>{code}</div>
      <div className="font-mono" style={{fontSize:10,letterSpacing:3,opacity:.6}}>akrobacja.com</div>
    </div>
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</div>
    <div className="font-display" style={{fontSize:18,letterSpacing:1.5}}>{label}</div>
  </div>
);

/* L1 — refined wordmark with Extra illustration */
const Logo_Wordmark = () => (
  <LogoFrame code="L1 · WORDMARK + ILLUSTRATION" label="HERO LOCKUP · STRONA · FAKTURA · PREZENTACJE" width={620} height={620}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18,position:"relative"}}>
      <img src="extra-300l-illustration.png" alt="" style={{width:340,height:"auto",filter:"drop-shadow(0 8px 0 rgba(10,47,124,.08))"}}/>
      <div style={{textAlign:"center"}}>
        <div className="font-display" style={{fontSize:104,lineHeight:.82,color:"var(--navy)",letterSpacing:2}}>
          AKROBACJA<span style={{color:"var(--red)"}}>.COM</span>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:10}}>
          <div style={{flex:1,height:1,background:"var(--navy)",opacity:.35,maxWidth:80}}/>
          <div className="font-mono" style={{fontSize:11,letterSpacing:5,color:"var(--navy)"}}>FLYING THE EXTRA 300L · SP-EKS</div>
          <div style={{flex:1,height:1,background:"var(--navy)",opacity:.35,maxWidth:80}}/>
        </div>
      </div>
    </div>
  </LogoFrame>
);

/* L2 — circular badge with plane */
const Logo_Badge = () => (
  <LogoFrame code="L2 · BADGE / PATCH" label="HAFT · PIN · NAKLEJKA · Ś CIANA W HANGARZE" dark width={620} height={620}>
    <div style={{position:"relative",width:440,height:440}}>
      <svg width="440" height="440" viewBox="0 0 440 440">
        {/* outer thin ring */}
        <circle cx="220" cy="220" r="214" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".4"/>
        {/* main field */}
        <circle cx="220" cy="220" r="206" fill="var(--white)"/>
        <circle cx="220" cy="220" r="206" fill="none" stroke="var(--navy)" strokeWidth="8"/>
        {/* inner navy band */}
        <circle cx="220" cy="220" r="176" fill="none" stroke="var(--navy)" strokeWidth="32"/>
        {/* red accent ring */}
        <circle cx="220" cy="220" r="154" fill="none" stroke="var(--red)" strokeWidth="3"/>
        {/* center field */}
        <circle cx="220" cy="220" r="148" fill="var(--bone)"/>
        {/* sun rays burst */}
        <g stroke="var(--red)" strokeWidth="2" opacity=".25">
          {Array.from({length:24}).map((_,i)=>(<line key={i} x1="220" y1="100" x2="220" y2="60" transform={`rotate(${i*15} 220 220)`}/>))}
        </g>
        <defs>
          <path id="badge-top2" d="M 220,220 m -178,0 a 178,178 0 0,1 356,0"/>
          <path id="badge-bot2" d="M 42,220 a 178,178 0 0,0 356,0" transform="rotate(180 220 220)"/>
        </defs>
        <text fill="var(--white)" fontFamily="Anton,Impact" fontSize="30" letterSpacing="8">
          <textPath href="#badge-top2" startOffset="50%" textAnchor="middle">AKROBACJA · .COM</textPath>
        </text>
        <text fill="var(--white)" fontFamily="JetBrains Mono,monospace" fontSize="13" letterSpacing="5" fontWeight="700">
          <textPath href="#badge-bot2" startOffset="50%" textAnchor="middle">EPRP · EST. 2018 · POLAND</textPath>
        </text>
        {/* corner stars in band */}
        <g fill="var(--red)">
          <polygon points="220,40 224,52 218,52" transform="translate(0,178)"/>
          <polygon points="220,40 224,52 218,52" transform="translate(0,-178)"/>
        </g>
        {/* SP-EKS plate at bottom */}
        <g transform="translate(220,330)">
          <rect x="-46" y="-12" width="92" height="24" fill="var(--navy)" stroke="var(--red)" strokeWidth="2"/>
          <text textAnchor="middle" y="6" fill="#fff" fontFamily="Anton,Impact" fontSize="18" letterSpacing="4">SP-EKS</text>
        </g>
      </svg>
      <img src="extra-300l-illustration.png" alt="" style={{position:"absolute",top:"42%",left:"50%",transform:"translate(-50%,-50%) rotate(-12deg)",width:200,height:"auto"}}/>
    </div>
  </LogoFrame>
);

/* L3 — compact horizontal */
const Logo_Horizontal = () => (
  <LogoFrame code="L3 · HORIZONTAL LOCKUP" label="NAGŁÓWEK · EMAIL · FAKTURA · STOPKA SOCIAL" width={840} height={620}>
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      {/* Variant A — plane + wordmark side by side */}
      <div style={{display:"flex",alignItems:"center",gap:24,padding:"16px 20px",background:"#fff",border:"1px solid #E6E2D8"}}>
        <img src="extra-300l-illustration.png" alt="" style={{width:120,height:"auto"}}/>
        <div style={{borderLeft:"3px solid var(--red)",paddingLeft:20}}>
          <div className="font-display" style={{fontSize:64,lineHeight:.85,color:"var(--navy)",letterSpacing:1}}>
            AKROBACJA<span style={{color:"var(--red)"}}>.COM</span>
          </div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:4,color:"var(--navy)",opacity:.75,marginTop:6}}>FLYING THE EXTRA 300L · SP-EKS · EPRP</div>
        </div>
      </div>
      {/* Variant B — negative for dark backgrounds */}
      <div style={{display:"flex",alignItems:"center",gap:24,padding:"16px 20px",background:"var(--navy)"}}>
        <img src="extra-300l-illustration.png" alt="" style={{width:120,height:"auto",filter:"brightness(0) invert(1)"}}/>
        <div style={{borderLeft:"3px solid var(--red)",paddingLeft:20}}>
          <div className="font-display" style={{fontSize:64,lineHeight:.85,color:"#fff",letterSpacing:1}}>
            AKROBACJA<span style={{color:"var(--red)"}}>.COM</span>
          </div>
          <div className="font-mono" style={{fontSize:10,letterSpacing:4,color:"#00E5FF",marginTop:6}}>FLYING THE EXTRA 300L · SP-EKS · EPRP</div>
        </div>
      </div>
      {/* Variant C — single-line for narrow contexts */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",background:"#fff",border:"1px solid #E6E2D8"}}>
        <img src="extra-300l-illustration.png" alt="" style={{width:46,height:"auto"}}/>
        <div className="font-display" style={{fontSize:30,lineHeight:.95,color:"var(--navy)",letterSpacing:1}}>AKROBACJA<span style={{color:"var(--red)"}}>.COM</span></div>
        <div style={{flex:1}}/>
        <div className="font-mono" style={{fontSize:9,letterSpacing:3,color:"var(--navy)",opacity:.6}}>SP-EKS</div>
      </div>
    </div>
  </LogoFrame>
);

/* L4 — stacked monogram "A" with stripe */
const Logo_Mono = () => (
  <LogoFrame code="L4 · MONOGRAM" label="FAVICON · APP ICON · PIN · NAKLEJKA" dark>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
      <div style={{width:280,height:280,background:"var(--white)",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
        {/* diagonal red stripe */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(120deg, transparent 0 55%, var(--red) 55% 62%, transparent 62%)"}}></div>
        <svg width="220" height="220" viewBox="0 0 220 220" style={{position:"relative"}}>
          <path d="M30 200 L100 16 L120 16 L190 200 L156 200 L142 156 L78 156 L64 200 Z M88 132 L132 132 L110 60 Z" fill="var(--navy)"/>
        </svg>
      </div>
      <div className="font-mono" style={{fontSize:10,letterSpacing:4,color:"var(--cyan)"}}>1:1 · GRID 16 · #FAVICON</div>
    </div>
  </LogoFrame>
);

/* L5 — speedline lockup */
const Logo_Speed = () => (
  <LogoFrame code="L5 · SPEEDLINE" label="DYNAMICZNA WERSJA · BANNER · MERCH PRINT">
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:8}}>
      <div style={{transform:"skewX(-10deg)",display:"inline-block"}}>
        <div className="font-display" style={{fontSize:96,lineHeight:.85,color:"var(--navy)",letterSpacing:2}}>AKROBACJA</div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginTop:6}}>
          <div className="font-display" style={{fontSize:24,color:"var(--red)",letterSpacing:8}}>.COM</div>
          <div style={{flex:1,height:6,background:"var(--red)"}}></div>
          <div style={{flex:1,height:4,background:"var(--red)"}}></div>
          <div style={{flex:1,height:2,background:"var(--red)"}}></div>
        </div>
        <div className="font-mono" style={{fontSize:11,letterSpacing:5,color:"var(--navy)",marginTop:12,opacity:.7}}>EPRP · ±10G · POLAND</div>
      </div>
    </div>
  </LogoFrame>
);

/* L6 — stamp/inverted */
const Logo_Stamp = () => (
  <LogoFrame code="L6 · STAMP" label="WERSJA NEGATYWNA · CIEMNE TŁA · KLISZA" dark>
    <div style={{border:"3px solid #fff",padding:"24px 40px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,position:"relative"}}>
      <div className="font-mono" style={{fontSize:9,letterSpacing:5,color:"var(--cyan)"}}>EST. 2018 · POLAND</div>
      <div className="font-display" style={{fontSize:72,lineHeight:.9,letterSpacing:2,color:"#fff"}}>AKROBACJA</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{height:1,width:50,background:"#fff",opacity:.5}}/>
        <div className="font-mono" style={{fontSize:10,letterSpacing:4,color:"#fff"}}>EXTRA 300L · SP-EKS</div>
        <div style={{height:1,width:50,background:"#fff",opacity:.5}}/>
      </div>
      <div className="font-display" style={{fontSize:24,color:"var(--red)",letterSpacing:6,marginTop:4}}>.COM</div>
    </div>
  </LogoFrame>
);

Object.assign(window, { Logo_Wordmark, Logo_Badge, Logo_Horizontal });
