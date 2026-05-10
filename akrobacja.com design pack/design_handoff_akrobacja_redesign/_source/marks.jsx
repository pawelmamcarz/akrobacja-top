/* SVG marks for akrobacja.com — reusable across artboards */

/* Tiny plane silhouette (Extra 300-ish, low-wing aerobatic) viewed from below */
const PlaneSilhouette = ({ size=120, fill="currentColor", roll=0, style={} }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" style={{transform:`rotate(${roll}deg)`,...style}} aria-hidden>
    {/* fuselage */}
    <path fill={fill} d="M60 8 c2 0 3 1 3.5 3 l1.5 22 l0 8 l28 4 l0 6 l-28 4 l0 14 l10 3 l0 5 l-10 1 l-1 18 c-.4 4-2 6-4 6 s-3.6-2-4-6 l-1-18 l-10-1 l0-5 l10-3 l0-14 l-28-4 l0-6 l28-4 l0-8 l1.5-22 c.5-2 1.5-3 3.5-3z"/>
    {/* canopy */}
    <ellipse cx="60" cy="48" rx="3.2" ry="9" fill="rgba(255,255,255,.18)"/>
    {/* prop disc */}
    <ellipse cx="60" cy="9" rx="14" ry="1.8" fill={fill} opacity=".35"/>
  </svg>
);

/* "A" with plane shooting through — refined wordmark mark */
const AMark = ({ size=200, primary="var(--navy)", accent="var(--red)", trail="var(--cyan)" }) => (
  <svg width={size} height={size*1.05} viewBox="0 0 200 210" aria-hidden>
    {/* Big A as two triangular blades */}
    <path d="M40 200 L96 6 L104 6 L78 90 L60 200 Z" fill={primary}/>
    <path d="M160 200 L104 6 L96 6 L122 90 L140 200 Z" fill={accent}/>
    {/* Crossbar as smoke ribbon */}
    <path d="M70 130 Q100 118 130 130 L132 144 Q100 132 68 144 Z" fill="white"/>
    {/* Plane breaking out top-right */}
    <g transform="translate(120,4) rotate(28)">
      <PlaneSilhouette size={70} fill={primary}/>
    </g>
  </svg>
);

/* Roundel — military/airshow style badge */
const Roundel = ({ size=200, ring="var(--navy)", center="var(--red)", text="AKROBACJA" }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <circle cx="100" cy="100" r="98" fill={ring}/>
    <circle cx="100" cy="100" r="78" fill="var(--white)"/>
    <circle cx="100" cy="100" r="58" fill={center}/>
    <circle cx="100" cy="100" r="38" fill="var(--white)"/>
    <g transform="translate(100,100) rotate(-25)">
      <PlaneSilhouette size={60} fill={ring} style={{transformOrigin:'center'}}/>
    </g>
    <defs>
      <path id="r-ring" d="M 100,100 m -88,0 a 88,88 0 1,1 176,0 a 88,88 0 1,1 -176,0" />
    </defs>
    <text className="font-display" fontSize="14" fill="var(--white)" letterSpacing="6">
      <textPath href="#r-ring" startOffset="6%">{text} · EXTRA 300L · SP-EKS · </textPath>
    </text>
  </svg>
);

/* Smoke loop monogram — plane drawing an "A" */
const SmokeLoop = ({ size=240, ink="var(--navy)", smoke="var(--white)", accent="var(--red)" }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden>
    {/* sky panel */}
    <rect width="240" height="240" rx="0" fill="transparent"/>
    {/* smoke A path */}
    <path d="M30 210 L120 30 L210 210 M70 150 L170 150" stroke={smoke} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".95"/>
    <path d="M30 210 L120 30 L210 210 M70 150 L170 150" stroke={ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="2 8" opacity=".5"/>
    {/* plane finishing the line */}
    <g transform="translate(210,210) rotate(60)">
      <PlaneSilhouette size={56} fill={accent}/>
    </g>
  </svg>
);

/* Stencil "A" — stencil/military plate look */
const StencilA = ({ size=200, ink="var(--white)", bg="var(--navy)" }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <rect width="200" height="200" fill={bg}/>
    <g fill={ink}>
      {/* stencil A with bridges */}
      <path d="M30 175 L88 25 L112 25 L170 175 L140 175 L128 140 L72 140 L60 175 Z M82 115 L118 115 L100 60 Z"/>
      <rect x="82" y="115" width="36" height="6" fill={bg}/>
      <rect x="60" y="175" width="20" height="6" fill={bg}/>
      <rect x="120" y="175" width="20" height="6" fill={bg}/>
    </g>
    <text x="100" y="195" textAnchor="middle" fill={ink} fontSize="9" letterSpacing="3" className="font-mono">SP-EKS · EXTRA 300L</text>
  </svg>
);

/* Speedline mark — type-led horizontal lockup */
const SpeedlineLockup = ({ width=520, ink="var(--navy)", accent="var(--red)" }) => (
  <svg width={width} height={width*0.28} viewBox="0 0 520 145" aria-hidden>
    <g transform="skewX(-10)">
      <text x="20" y="100" fontFamily="Anton,Impact,sans-serif" fontSize="92" fill={ink} letterSpacing="2">AKROBACJA</text>
      <text x="20" y="130" fontFamily="JetBrains Mono,monospace" fontSize="14" fill={accent} letterSpacing="6">.COM · EXTRA 300L · MAKE IT VERTICAL</text>
    </g>
    {/* speed lines */}
    <g fill={accent}>
      <rect x="430" y="20" width="80" height="4"/>
      <rect x="450" y="34" width="60" height="4"/>
      <rect x="470" y="48" width="40" height="4"/>
    </g>
  </svg>
);

/* Compact horizontal lockup — for header + merch tag */
const HorizontalLockup = ({ scale=1, ink="var(--navy)", accent="var(--red)", on="light" }) => {
  const fg = on==="dark" ? "var(--white)" : ink;
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:14*scale}}>
      <svg width={48*scale} height={48*scale} viewBox="0 0 48 48" aria-hidden>
        <path d="M6 44 L22 4 L26 4 L42 44 L34 44 L29 32 L19 32 L14 44 Z" fill={fg}/>
        <path d="M21 26 L27 26 L24 16 Z" fill={accent}/>
      </svg>
      <div style={{lineHeight:1, color:fg}}>
        <div className="font-display" style={{fontSize:22*scale, letterSpacing:1}}>AKROBACJA<span style={{color:accent}}>.COM</span></div>
        <div className="font-mono" style={{fontSize:8.5*scale, letterSpacing:3, opacity:.7, marginTop:4}}>EXTRA 300L · SP‑EKS · EPRP</div>
      </div>
    </div>
  );
};

Object.assign(window, { PlaneSilhouette, AMark, Roundel, SmokeLoop, StencilA, SpeedlineLockup, HorizontalLockup });
