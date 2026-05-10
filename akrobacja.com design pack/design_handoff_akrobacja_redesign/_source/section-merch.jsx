/* Merch artboards — t-shirt, hoodie, tote, cap, stickers, poster, mug, bottle */

const Tag = ({ children, color="var(--red)" }) => (
  <div style={{position:"absolute",top:18,left:18,padding:"6px 10px",background:color,color:"#fff",fontSize:10,letterSpacing:3,fontWeight:700,fontFamily:"JetBrains Mono"}}>{children}</div>
);

const ArtboardShell = ({ children, code, label, bg="var(--bone)", w=560, h=620 }) => (
  <div style={{width:w,height:h,background:bg,position:"relative",overflow:"hidden",fontFamily:"Inter,sans-serif"}}>
    <Tag>{code}</Tag>
    {children}
    <div style={{position:"absolute",left:18,bottom:14,fontFamily:"JetBrains Mono",fontSize:10,letterSpacing:3,color:"var(--navy)",opacity:.7}}>{label}</div>
  </div>
);

/* T-SHIRT — navy with chest print */
const TShirtNavy = () => (
  <ArtboardShell code="M1 · T-SHIRT · NAVY" label="200 G · BAWEŁNA ORGANICZNA · DTG · 30×40 CM">
    <svg viewBox="0 0 560 620" width="560" height="620" style={{position:"absolute",inset:0}}>
      {/* shadow on bone */}
      <ellipse cx="280" cy="580" rx="180" ry="14" fill="rgba(0,0,0,.06)"/>
      {/* tee silhouette */}
      <path d="M150 130 L210 100 Q280 140 350 100 L410 130 L460 200 L420 230 L410 240 L410 540 L150 540 L150 240 L140 230 L100 200 Z" fill="#0A2F7C"/>
      {/* collar */}
      <path d="M210 100 Q280 145 350 100 Q280 165 210 100 Z" fill="#06205A"/>
      {/* subtle fold shadows */}
      <path d="M150 240 L150 540 L180 540 L180 250 Z" fill="rgba(0,0,0,.18)"/>
      <path d="M410 240 L410 540 L380 540 L380 250 Z" fill="rgba(255,255,255,.05)"/>
    </svg>
    {/* chest print */}
    <div style={{position:"absolute",left:200,top:220,width:160,textAlign:"center"}}>
      <img src="extra-300l-illustration.png" alt="" style={{width:140,height:"auto",filter:"brightness(1.1) contrast(1.1)"}}/>
      <div className="font-display" style={{fontSize:18,letterSpacing:2,color:"#fff",marginTop:6}}>AKROBACJA<span style={{color:"#00E5FF"}}>.COM</span></div>
      <div className="font-mono" style={{fontSize:7,letterSpacing:3,color:"#00E5FF",marginTop:2}}>EXTRA 300L · SP-EKS</div>
    </div>
  </ArtboardShell>
);

/* T-SHIRT — bone with back print "MAKE IT VERTICAL" */
const TShirtBone = () => (
  <ArtboardShell code="M2 · T-SHIRT · BONE / BACK" label="DUŻY DRUK PLECY 30×40 · MOTTO + COORDS">
    <svg viewBox="0 0 560 620" width="560" height="620" style={{position:"absolute",inset:0}}>
      <ellipse cx="280" cy="580" rx="180" ry="14" fill="rgba(0,0,0,.06)"/>
      <path d="M150 130 L210 100 Q280 140 350 100 L410 130 L460 200 L420 230 L410 240 L410 540 L150 540 L150 240 L140 230 L100 200 Z" fill="#F4F1EA"/>
      {/* back collar dip */}
      <path d="M225 105 Q280 120 335 105 Q280 130 225 105" fill="#E6E2D8"/>
      <path d="M150 240 L150 540 L180 540 L180 250 Z" fill="rgba(0,0,0,.06)"/>
    </svg>
    {/* back print large */}
    <div style={{position:"absolute",left:160,top:170,width:240,textAlign:"center"}}>
      <div className="font-display" style={{fontSize:64,lineHeight:.85,letterSpacing:1,color:"#0A2F7C"}}>MAKE<br/>IT<br/><span style={{color:"#E11E26"}}>VERTICAL.</span></div>
      <div style={{height:2,background:"#0A2F7C",margin:"14px auto",width:"60%"}}/>
      <div className="font-mono" style={{fontSize:10,letterSpacing:3,color:"#0A2F7C"}}>EPRP · N51°23' E021°12'</div>
      <div className="font-mono" style={{fontSize:10,letterSpacing:3,color:"#0A2F7C",marginTop:2}}>EXTRA 300L · SP-EKS</div>
    </div>
  </ArtboardShell>
);

/* HOODIE — navy */
const Hoodie = () => (
  <ArtboardShell code="M3 · HOODIE · NAVY" label="350 G · BAWEŁNA · KAPTUR PODSZYTY">
    <svg viewBox="0 0 560 620" width="560" height="620" style={{position:"absolute",inset:0}}>
      <ellipse cx="280" cy="595" rx="190" ry="12" fill="rgba(0,0,0,.06)"/>
      {/* hood */}
      <path d="M210 80 Q280 60 350 80 Q360 110 350 130 Q280 110 210 130 Q200 110 210 80" fill="#06205A"/>
      {/* body */}
      <path d="M150 130 Q230 150 210 130 L130 150 L80 220 L120 250 L130 260 L130 540 L160 580 L400 580 L430 540 L430 260 L440 250 L480 220 L430 150 L350 130 Q330 150 410 130 L470 145 L430 130 Z" fill="#0A2F7C"/>
      {/* pocket */}
      <path d="M180 380 L380 380 L380 470 L180 470 Z" fill="#06205A"/>
      <path d="M180 380 L380 380 L390 395 L170 395 Z" fill="#040E2A"/>
      {/* drawstrings */}
      <line x1="270" y1="135" x2="265" y2="220" stroke="#fff" strokeWidth="2"/>
      <line x1="290" y1="135" x2="295" y2="220" stroke="#fff" strokeWidth="2"/>
      <circle cx="265" cy="225" r="4" fill="#fff"/>
      <circle cx="295" cy="225" r="4" fill="#fff"/>
      {/* kangaroo opening */}
      <line x1="180" y1="395" x2="200" y2="380" stroke="#040E2A" strokeWidth="3"/>
      <line x1="380" y1="395" x2="360" y2="380" stroke="#040E2A" strokeWidth="3"/>
    </svg>
    {/* chest print: stacked badge */}
    <div style={{position:"absolute",left:215,top:280,width:130,textAlign:"center",color:"#fff"}}>
      <div className="font-display" style={{fontSize:14,letterSpacing:2}}>AKROBACJA<span style={{color:"#00E5FF"}}>.COM</span></div>
      <div className="font-mono" style={{fontSize:6.5,letterSpacing:3,color:"#00E5FF",marginTop:2}}>EST. 2018 · POLAND</div>
    </div>
    {/* sleeve stripe nod */}
    <div style={{position:"absolute",left:80,top:200,width:50,height:6,background:"#E11E26",transform:"rotate(20deg)"}}/>
    <div style={{position:"absolute",right:80,top:200,width:50,height:6,background:"#E11E26",transform:"rotate(-20deg)"}}/>
  </ArtboardShell>
);

/* TOTE BAG */
const Tote = () => (
  <ArtboardShell code="M4 · TOTE · NATURAL" label="270 G · BAWEŁNA · 38×42 CM">
    <svg viewBox="0 0 560 620" width="560" height="620" style={{position:"absolute",inset:0}}>
      <ellipse cx="280" cy="590" rx="160" ry="10" fill="rgba(0,0,0,.06)"/>
      {/* handles */}
      <path d="M210 80 Q210 30 240 30 Q270 30 270 80" stroke="#E8E2D2" strokeWidth="10" fill="none"/>
      <path d="M290 80 Q290 30 320 30 Q350 30 350 80" stroke="#E8E2D2" strokeWidth="10" fill="none"/>
      {/* bag body */}
      <rect x="160" y="80" width="240" height="490" fill="#EDE6D2"/>
      <path d="M160 80 L400 80 L400 100 L160 100 Z" fill="#E2DAC4"/>
    </svg>
    {/* print */}
    <div style={{position:"absolute",left:175,top:200,width:210,textAlign:"left"}}>
      <img src="extra-300l-illustration.png" alt="" style={{width:200,height:"auto",transform:"rotate(-12deg)",filter:"saturate(1.05)"}}/>
      <div className="font-display" style={{fontSize:30,lineHeight:.9,color:"#0A2F7C",letterSpacing:1,marginTop:14}}>AKROBACJA<span style={{color:"#E11E26"}}>.COM</span></div>
      <div className="font-mono" style={{fontSize:9,letterSpacing:3,color:"#0A2F7C",marginTop:6}}>CARRY THE LINE</div>
    </div>
  </ArtboardShell>
);

/* CAP — dad-cap, side view, low-profile, embroidered chain stitch logo */
const Cap = () => (
  <ArtboardShell code="M5 · CAP · DAD HAT" label="6-PANEL UNSTRUCTURED · NISKI PROFIL · METALOWA KLAMRA">
    <svg viewBox="0 0 560 620" width="560" height="620" style={{position:"absolute",inset:0}}>
      {/* shadow */}
      <ellipse cx="280" cy="450" rx="240" ry="14" fill="rgba(0,0,0,.08)"/>
      {/* visor — curved, side profile */}
      <path d="M70 410 Q200 470 470 425 Q485 405 460 395 Q280 415 90 395 Q60 400 70 410 Z" fill="#040E2A"/>
      {/* visor underside shadow */}
      <path d="M90 395 Q280 415 460 395 Q445 410 280 425 Q150 425 95 408 Z" fill="#020817"/>
      {/* crown — soft dome, side view */}
      <path d="M90 395 Q70 320 110 270 Q180 220 280 220 Q380 220 460 280 Q495 330 470 395 Q400 360 280 360 Q160 360 90 395 Z" fill="#0A2F7C"/>
      {/* crown highlight */}
      <path d="M120 285 Q200 240 280 235 Q360 240 430 285" stroke="rgba(255,255,255,.18)" strokeWidth="3" fill="none"/>
      {/* sweatband peek */}
      <path d="M100 388 Q280 358 460 388" stroke="#06205A" strokeWidth="2" fill="none"/>
      {/* back strap loop hint */}
      <path d="M460 320 Q490 340 470 380" stroke="#06205A" strokeWidth="2" fill="none"/>
      {/* eyelet */}
      <circle cx="370" cy="305" r="3" fill="#06205A"/>
      <circle cx="190" cy="305" r="3" fill="#06205A"/>
    </svg>

    {/* Embroidered front patch — only chain-stitch logo on side panel */}
    <div style={{position:"absolute",left:215,top:290,textAlign:"center",color:"#fff",letterSpacing:1}}>
      <div className="font-display" style={{fontSize:24,lineHeight:.95}}>AKROBACJA</div>
      <div className="font-mono" style={{fontSize:8,letterSpacing:4,color:"#00E5FF",marginTop:3}}>· SP-EKS ·</div>
    </div>

    {/* tonal red accent — tiny tail flag on visor edge */}
    <div style={{position:"absolute",left:74,top:395,width:24,height:6,background:"#E11E26"}}/>
  </ArtboardShell>
);

/* STICKER PACK */
const Stickers = () => (
  <ArtboardShell code="M6 · STICKER PACK" label="DIE-CUT · VINYL MATTE · 4 SZTUKI">
    <div style={{position:"absolute",inset:0,padding:50,display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:18}}>
      {/* sticker 1 — wordmark */}
      <div style={{background:"#fff",borderRadius:20,padding:14,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",boxShadow:"0 6px 0 rgba(0,0,0,.06)",transform:"rotate(-4deg)"}}>
        <img src="extra-300l-illustration.png" alt="" style={{width:80,height:"auto"}}/>
        <div className="font-display" style={{fontSize:18,color:"#0A2F7C",letterSpacing:1,marginTop:4}}>AKROBACJA<span style={{color:"#E11E26"}}>.COM</span></div>
      </div>
      {/* sticker 2 — SP-EKS plate */}
      <div style={{background:"#FFB300",borderRadius:8,padding:14,display:"flex",alignItems:"center",justifyContent:"center",transform:"rotate(3deg)",border:"3px solid #070F1A",boxShadow:"0 6px 0 rgba(0,0,0,.1)"}}>
        <div style={{textAlign:"center"}}>
          <div className="font-display" style={{fontSize:46,lineHeight:.9,color:"#070F1A",letterSpacing:4}}>SP-EKS</div>
          <div className="font-mono" style={{fontSize:9,letterSpacing:3,color:"#070F1A",marginTop:4}}>EXTRA 300L · EPRP</div>
        </div>
      </div>
      {/* sticker 3 — circle badge */}
      <div style={{background:"#0A2F7C",borderRadius:"50%",aspectRatio:1,height:"auto",display:"flex",alignItems:"center",justifyContent:"center",transform:"rotate(-2deg)",justifySelf:"center",width:180}}>
        <div style={{textAlign:"center",color:"#fff"}}>
          <div className="font-display" style={{fontSize:16,letterSpacing:2}}>MAKE IT</div>
          <div className="font-display" style={{fontSize:24,letterSpacing:2,color:"#00E5FF"}}>VERTICAL</div>
          <div className="font-mono" style={{fontSize:7,letterSpacing:3,marginTop:4}}>±10G CERTIFIED</div>
        </div>
      </div>
      {/* sticker 4 — slap rectangle */}
      <div style={{background:"#070F1A",borderRadius:6,padding:14,display:"flex",alignItems:"center",justifyContent:"center",transform:"rotate(5deg)",border:"3px solid #fff"}}>
        <div style={{textAlign:"center"}}>
          <div className="font-display" style={{fontSize:22,letterSpacing:1,color:"#fff"}}>I FLEW <span style={{color:"#E11E26"}}>SP-EKS</span></div>
          <div className="font-mono" style={{fontSize:7,letterSpacing:3,color:"#00E5FF",marginTop:4}}>RADOM-PIASTÓW · EPRP</div>
        </div>
      </div>
    </div>
  </ArtboardShell>
);

/* POSTER A2 */
const Poster = () => (
  <ArtboardShell code="M7 · POSTER A2" label="42×59.4 CM · OFFSET · 200 G PAPIER MATOWY" w={560} h={780}>
    <div style={{position:"absolute",inset:24,background:"#0A2F7C",color:"#fff",padding:32,overflow:"hidden"}}>
      {/* hi-vis */}
      <div className="diag-stripes" style={{position:"absolute",top:0,left:0,right:0,height:14}}/>
      <div className="diag-stripes" style={{position:"absolute",bottom:0,left:0,right:0,height:14}}/>
      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"JetBrains Mono",fontSize:9,letterSpacing:3,marginTop:14,color:"#00E5FF"}}>
        <span>PL · 2026 · S/N 001</span><span>EPRP · N51°23'</span>
      </div>
      <div style={{marginTop:30,position:"relative"}}>
        <div className="font-display" style={{fontSize:140,lineHeight:.78,letterSpacing:2}}>MAKE<br/>IT<br/><span style={{color:"#00E5FF"}}>VER-<br/>TICAL</span><span style={{color:"#E11E26"}}>.</span></div>
      </div>
      <img src="extra-300l-illustration.png" alt="" style={{position:"absolute",right:-30,top:200,width:380,height:"auto",transform:"rotate(-22deg)",filter:"drop-shadow(0 0 0 #fff)"}}/>
      <div style={{position:"absolute",left:32,bottom:40,right:32,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div className="font-display" style={{fontSize:28,letterSpacing:2}}>AKROBACJA<span style={{color:"#E11E26"}}>.COM</span></div>
          <div className="font-mono" style={{fontSize:9,letterSpacing:3,color:"#00E5FF",marginTop:4}}>EXTRA 300L · SP-EKS · ±10G</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div className="font-mono" style={{fontSize:9,letterSpacing:3,color:"#00E5FF"}}>FROM 1 490 PLN</div>
          <div className="font-display" style={{fontSize:18,letterSpacing:2,color:"#fff"}}>BOOK NOW →</div>
        </div>
      </div>
    </div>
  </ArtboardShell>
);

/* MUG */
const Mug = () => (
  <ArtboardShell code="M8 · MUG · 330 ML" label="CERAMIKA · NADRUK CYRKULARNY · MATOWA">
    <svg viewBox="0 0 560 620" width="560" height="620" style={{position:"absolute",inset:0}}>
      <ellipse cx="280" cy="540" rx="160" ry="10" fill="rgba(0,0,0,.06)"/>
      {/* mug body */}
      <rect x="160" y="200" width="240" height="320" rx="14" fill="#fff" stroke="#D8DEE6" strokeWidth="2"/>
      {/* handle */}
      <path d="M400 250 Q470 260 470 350 Q470 440 400 450" stroke="#fff" strokeWidth="22" fill="none"/>
      <path d="M400 250 Q470 260 470 350 Q470 440 400 450" stroke="#D8DEE6" strokeWidth="2" fill="none"/>
      {/* inner ring */}
      <ellipse cx="280" cy="200" rx="120" ry="14" fill="#070F1A"/>
      <ellipse cx="280" cy="200" rx="120" ry="14" fill="none" stroke="#D8DEE6" strokeWidth="2"/>
    </svg>
    {/* wrap print */}
    <div style={{position:"absolute",left:170,top:280,width:220,textAlign:"center"}}>
      <img src="extra-300l-illustration.png" alt="" style={{width:90,height:"auto",transform:"rotate(-8deg)"}}/>
      <div className="font-display" style={{fontSize:22,color:"#0A2F7C",letterSpacing:1,marginTop:10}}>MAKE IT VERTICAL.</div>
      <div className="font-mono" style={{fontSize:9,letterSpacing:3,color:"#E11E26",marginTop:6}}>AKROBACJA.COM · SP-EKS</div>
    </div>
  </ArtboardShell>
);

/* WATER BOTTLE */
const Bottle = () => (
  <ArtboardShell code="M9 · BIDON · 750 ML" label="STAL NIERDZEWNA · MATOWY GRANAT · DRUK BIAŁY">
    <svg viewBox="0 0 560 620" width="560" height="620" style={{position:"absolute",inset:0}}>
      <ellipse cx="280" cy="595" rx="100" ry="8" fill="rgba(0,0,0,.07)"/>
      {/* cap */}
      <rect x="240" y="60" width="80" height="50" rx="4" fill="#070F1A"/>
      <rect x="235" y="105" width="90" height="14" rx="2" fill="#040E2A"/>
      {/* body */}
      <path d="M225 120 L335 120 L345 160 L345 580 Q280 600 215 580 L215 160 Z" fill="#0A2F7C"/>
      {/* highlights */}
      <rect x="232" y="160" width="4" height="400" fill="rgba(255,255,255,.18)" rx="2"/>
      <rect x="324" y="160" width="6" height="400" fill="rgba(0,0,0,.18)" rx="2"/>
    </svg>
    {/* print */}
    <div style={{position:"absolute",left:225,top:230,width:120,textAlign:"center",color:"#fff"}}>
      <div className="font-display" style={{fontSize:14,letterSpacing:2,lineHeight:.95}}>AKROBACJA<br/><span style={{color:"#00E5FF"}}>.COM</span></div>
      <div style={{height:1,background:"#00E5FF",margin:"10px auto",width:"60%",opacity:.6}}/>
      <div className="font-mono" style={{fontSize:7,letterSpacing:2,color:"#00E5FF"}}>SP-EKS</div>
      <div className="font-mono" style={{fontSize:6,letterSpacing:2,opacity:.7,marginTop:80}}>STAY HYDRATED</div>
      <div className="font-mono" style={{fontSize:6,letterSpacing:2,opacity:.7}}>BEFORE +8G</div>
    </div>
  </ArtboardShell>
);

Object.assign(window, { TShirtNavy, TShirtBone, Hoodie, Tote, Cap, Stickers, Poster, Mug, Bottle });
