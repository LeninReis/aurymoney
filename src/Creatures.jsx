// Componente com TODAS as 4 Criaturas Animadas em SVG + Ambiente Fazendinha
export const CreatureScene = ({ creature, stage, color, color2 }) => {
  const { nome } = stage

  // ============================================================================
  // DRAGÃO - 4 estágios completos
  // ============================================================================
  if (creature === "Dragão") {
    if (nome.includes("Ovo")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <radialGradient id="eggGlowDragon">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color2} stopOpacity="0.3" />
            </radialGradient>
          </defs>
          <ellipse cx="100" cy="110" rx="45" ry="60" fill="url(#eggGlowDragon)" opacity="0.3">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="100" cy="110" rx="40" ry="55" fill={color} stroke={color2} strokeWidth="3">
            <animateTransform attributeName="transform" type="rotate" from="0 100 110" to="5 100 110" dur="3s" repeatCount="indefinite" values="0 100 110; 5 100 110; -5 100 110; 0 100 110" />
          </ellipse>
          <path d="M 85 100 Q 80 95 85 90" stroke={color2} strokeWidth="2" fill="none" opacity="0.6" />
          <path d="M 115 100 Q 120 95 115 90" stroke={color2} strokeWidth="2" fill="none" opacity="0.6" />
        </svg>
      )
    }

    if (nome.includes("Filhote")) {
      return (
        <svg viewBox="0 0 220 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="babyDragon">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <path d="M 140 130 Q 160 140 170 120 Q 165 110 160 115" fill={color} opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="0 140 130" to="15 140 130" dur="1.5s" repeatCount="indefinite" values="0 140 130; 15 140 130; -10 140 130; 0 140 130" />
          </path>
          <ellipse cx="100" cy="120" rx="35" ry="25" fill="url(#babyDragon)">
            <animate attributeName="cy" values="120;118;120" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="80" cy="105" r="20" fill={color}>
            <animate attributeName="cy" values="105;103;105" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="75" cy="100" r="3" fill="#fff" />
          <circle cx="74" cy="100" r="1.5" fill="#000">
            <animate attributeName="r" values="1.5;0.5;1.5" dur="4s" repeatCount="indefinite" />
          </circle>
          <ellipse cx="68" cy="108" rx="8" ry="6" fill={color2} />
          <circle cx="65" cy="107" r="1.5" fill="#333" />
          <circle cx="71" cy="107" r="1.5" fill="#333" />
          <circle cx="65" cy="103" r="2" fill="#888" opacity="0.6">
            <animate attributeName="cy" values="103;90;80" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0" dur="2s" repeatCount="indefinite" />
          </circle>
          <path d="M 85 115 Q 75 110 80 100" fill={color} opacity="0.7">
            <animateTransform attributeName="transform" type="rotate" from="-10 85 115" to="10 85 115" dur="1s" repeatCount="indefinite" />
          </path>
          <path d="M 115 115 Q 125 110 120 100" fill={color} opacity="0.7">
            <animateTransform attributeName="transform" type="rotate" from="10 115 115" to="-10 115 115" dur="1s" repeatCount="indefinite" />
          </path>
          <ellipse cx="85" cy="140" rx="6" ry="8" fill={color2}>
            <animate attributeName="cy" values="140;142;140" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="115" cy="140" rx="6" ry="8" fill={color2}>
            <animate attributeName="cy" values="140;142;140" dur="2s" repeatCount="indefinite" begin="1s" />
          </ellipse>
        </svg>
      )
    }

    if (nome.includes("Juvenil")) {
      return (
        <svg viewBox="0 0 240 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="teenDragon">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <path d="M 150 120 Q 180 130 190 100 Q 195 80 185 90" fill={color} stroke={color2} strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate" from="0 150 120" to="20 150 120" dur="2s" repeatCount="indefinite" values="0 150 120; 20 150 120; -15 150 120; 0 150 120" />
          </path>
          <ellipse cx="100" cy="110" rx="45" ry="30" fill="url(#teenDragon)">
            <animate attributeName="cy" values="110;108;110" dur="2.5s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="75" cy="95" rx="15" ry="25" fill={color} />
          <ellipse cx="70" cy="75" rx="18" ry="22" fill={color}>
            <animate attributeName="cy" values="75;73;75" dur="2.5s" repeatCount="indefinite" />
          </ellipse>
          <path d="M 60 65 L 55 50 L 62 60" fill={color2} />
          <path d="M 80 65 L 85 50 L 78 60" fill={color2} />
          <ellipse cx="65" cy="70" rx="4" ry="5" fill="#FFD700" />
          <circle cx="65" cy="70" r="2" fill="#000" />
          <path d="M 55 80 Q 50 82 52 78" stroke="#FF4500" strokeWidth="2" fill="none" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
          </path>
          <path d="M 80 100 Q 50 80 45 110 Q 50 120 60 115 Q 70 110 80 100" fill={color} opacity="0.8" stroke={color2} strokeWidth="1">
            <animateTransform attributeName="transform" type="rotate" from="-20 80 100" to="15 80 100" dur="1.2s" repeatCount="indefinite" values="-20 80 100; 15 80 100; -20 80 100" />
          </path>
          <path d="M 120 100 Q 150 80 155 110 Q 150 120 140 115 Q 130 110 120 100" fill={color} opacity="0.8" stroke={color2} strokeWidth="1">
            <animateTransform attributeName="transform" type="rotate" from="20 120 100" to="-15 120 100" dur="1.2s" repeatCount="indefinite" values="20 120 100; -15 120 100; 20 120 100" />
          </path>
          <g>
            <ellipse cx="85" cy="135" rx="8" ry="12" fill={color2}>
              <animate attributeName="cy" values="135;133;135" dur="2.5s" repeatCount="indefinite" />
            </ellipse>
            <path d="M 85 145 L 82 155 L 88 155 L 85 145" fill={color2} />
          </g>
          <g>
            <ellipse cx="115" cy="135" rx="8" ry="12" fill={color2}>
              <animate attributeName="cy" values="135;133;135" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </ellipse>
            <path d="M 115 145 L 112 155 L 118 155 L 115 145" fill={color2} />
          </g>
        </svg>
      )
    }

    return (
      <svg viewBox="0 0 260 220" style={{ width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id="elderDragon">
            <stop offset="0%" stopColor={color} />
            <stop offset="50%" stopColor="#9333EA" />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
          <filter id="dragonGlow">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <ellipse cx="130" cy="110" rx="100" ry="80" fill={color} opacity="0.1">
          <animate attributeName="rx" values="100;110;100" dur="3s" repeatCount="indefinite" />
          <animate attributeName="ry" values="80;90;80" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <path d="M 180 120 Q 220 140 230 100 Q 235 70 225 85 L 220 95" fill="url(#elderDragon)" stroke={color2} strokeWidth="3">
          <animateTransform attributeName="transform" type="rotate" from="0 180 120" to="15 180 120" dur="3s" repeatCount="indefinite" values="0 180 120; 15 180 120; -10 180 120; 0 180 120" />
        </path>
        <ellipse cx="120" cy="115" rx="55" ry="38" fill="url(#elderDragon)" filter="url(#dragonGlow)">
          <animate attributeName="cy" values="115;113;115" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <path d="M 90 100 Q 80 80 85 60" stroke="url(#elderDragon)" strokeWidth="28" fill="none" />
        <ellipse cx="85" cy="50" rx="24" ry="30" fill="url(#elderDragon)" filter="url(#dragonGlow)">
          <animate attributeName="cy" values="50;48;50" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <path d="M 68 32 L 58 12 Q 56 8 60 10 L 66 28" fill="#FFD700" stroke={color2} strokeWidth="1.5" />
        <path d="M 102 32 L 112 12 Q 114 8 110 10 L 104 28" fill="#FFD700" stroke={color2} strokeWidth="1.5" />
        <ellipse cx="78" cy="45" rx="5" ry="6" fill="#FFD700">
          <animate attributeName="opacity" values="1;0.3;1" dur="5s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="78" cy="45" r="2.5" fill="#8B00FF" />
        <path d="M 68 58 Q 58 55 53 62 Q 55 65 58 60" fill="#9333EA" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
        </path>
        <g filter="url(#dragonGlow)">
          <path d="M 90 100 Q 40 70 30 110 Q 35 140 50 135 Q 70 125 90 115" fill={color} opacity="0.85" stroke={color2} strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate" from="-25 90 100" to="10 90 100" dur="2s" repeatCount="indefinite" values="-25 90 100; 10 90 100; -25 90 100" />
          </path>
          <path d="M 150 100 Q 200 70 210 110 Q 205 140 190 135 Q 170 125 150 115" fill={color} opacity="0.85" stroke={color2} strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate" from="25 150 100" to="-10 150 100" dur="2s" repeatCount="indefinite" values="25 150 100; -10 150 100; 25 150 100" />
          </path>
        </g>
        <g>
          <ellipse cx="100" cy="145" rx="10" ry="15" fill={color2}>
            <animate attributeName="cy" values="145;143;145" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <path d="M 100 158 L 95 170 Q 94 173 97 173 L 103 173 Q 106 173 105 170 L 100 158" fill={color2} />
          <path d="M 95 173 L 93 176 M 100 173 L 100 178 M 105 173 L 107 176" stroke="#FFD700" strokeWidth="2" />
        </g>
        <g>
          <ellipse cx="140" cy="145" rx="10" ry="15" fill={color2}>
            <animate attributeName="cy" values="145;143;145" dur="3s" repeatCount="indefinite" begin="1.5s" />
          </ellipse>
          <path d="M 140 158 L 135 170 Q 134 173 137 173 L 143 173 Q 146 173 145 170 L 140 158" fill={color2} />
          <path d="M 135 173 L 133 176 M 140 173 L 140 178 M 145 173 L 147 176" stroke="#FFD700" strokeWidth="2" />
        </g>
        <path d="M 75 25 L 70 15 L 75 20 L 85 15 L 85 20 L 95 15 L 90 25" fill="#FFD700" opacity="0.9">
          <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite" />
        </path>
      </svg>
    )
  }

  // ============================================================================
  // CORUJA - 4 estágios completos  
  // ============================================================================
  if (creature === "Coruja") {
    if (nome.includes("Ovo")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <ellipse cx="100" cy="110" rx="40" ry="55" fill={color} stroke={color2} strokeWidth="3">
            <animateTransform attributeName="transform" type="rotate" from="0 100 110" to="3 100 110" dur="2.5s" repeatCount="indefinite" values="0 100 110; 3 100 110; -3 100 110; 0 100 110" />
          </ellipse>
          <path d="M 85 95 Q 82 90 87 88" stroke={color2} strokeWidth="2" fill="none" opacity="0.5" />
          <path d="M 115 95 Q 118 90 113 88" stroke={color2} strokeWidth="2" fill="none" opacity="0.5" />
        </svg>
      )
    }

    if (nome.includes("Corujinha")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <radialGradient id="owletBody">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </radialGradient>
          </defs>
          <ellipse cx="100" cy="120" rx="32" ry="38" fill="url(#owletBody)">
            <animate attributeName="cy" values="120;118;120" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="100" cy="85" r="28" fill={color}>
            <animate attributeName="cy" values="85;83;85" dur="2s" repeatCount="indefinite" />
          </circle>
          <ellipse cx="90" cy="82" rx="8" ry="10" fill="#FFF">
            <animate attributeName="ry" values="10;1;10" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="110" cy="82" rx="8" ry="10" fill="#FFF">
            <animate attributeName="ry" values="10;1;10" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="90" cy="84" r="4" fill="#000" />
          <circle cx="110" cy="84" r="4" fill="#000" />
          <path d="M 100 90 L 95 95 L 100 93 L 105 95 Z" fill="#FFA500" />
          <path d="M 80 65 Q 75 55 78 60" fill={color2} />
          <path d="M 120 65 Q 125 55 122 60" fill={color2} />
          <ellipse cx="75" cy="120" rx="12" ry="18" fill={color} opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="-15 75 120" to="5 75 120" dur="1.5s" repeatCount="indefinite" values="-15 75 120; 5 75 120; -15 75 120" />
          </ellipse>
          <ellipse cx="125" cy="120" rx="12" ry="18" fill={color} opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="15 125 120" to="-5 125 120" dur="1.5s" repeatCount="indefinite" values="15 125 120; -5 125 120; 15 125 120" />
          </ellipse>
          <ellipse cx="92" cy="155" rx="5" ry="7" fill={color2} />
          <ellipse cx="108" cy="155" rx="5" ry="7" fill={color2} />
        </svg>
      )
    }

    if (nome.includes("Sábia")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="wiseOwl">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <ellipse cx="100" cy="115" rx="38" ry="45" fill="url(#wiseOwl)">
            <animate attributeName="cy" values="115;113;115" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="100" cy="75" rx="32" ry="36" fill={color}>
            <animate attributeName="cy" values="75;73;75" dur="3s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="rotate" from="0 100 75" to="5 100 75" dur="4s" repeatCount="indefinite" values="0 100 75; 5 100 75; -5 100 75; 0 100 75" />
          </ellipse>
          <ellipse cx="88" cy="72" rx="10" ry="12" fill="#FFD700" />
          <circle cx="88" cy="74" r="5" fill="#1a1a2e">
            <animate attributeName="cx" values="88;90;88" dur="5s" repeatCount="indefinite" />
          </circle>
          <ellipse cx="112" cy="72" rx="10" ry="12" fill="#FFD700" />
          <circle cx="112" cy="74" r="5" fill="#1a1a2e">
            <animate attributeName="cx" values="112;110;112" dur="5s" repeatCount="indefinite" />
          </circle>
          <path d="M 78 64 Q 83 60 88 62" stroke={color2} strokeWidth="2" fill="none" />
          <path d="M 122 64 Q 117 60 112 62" stroke={color2} strokeWidth="2" fill="none" />
          <path d="M 100 82 Q 95 88 100 85 Q 105 88 100 82" fill="#FF8C00" />
          <path d="M 75 55 Q 70 45 73 50 L 75 58" fill={color2} />
          <path d="M 125 55 Q 130 45 127 50 L 125 58" fill={color2} />
          <path d="M 70 110 Q 45 100 40 130 Q 45 145 55 140 Q 65 130 70 120" fill={color} opacity="0.9" stroke={color2} strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate" from="-10 70 110" to="5 70 110" dur="2s" repeatCount="indefinite" values="-10 70 110; 5 70 110; -10 70 110" />
          </path>
          <path d="M 130 110 Q 155 100 160 130 Q 155 145 145 140 Q 135 130 130 120" fill={color} opacity="0.9" stroke={color2} strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate" from="10 130 110" to="-5 130 110" dur="2s" repeatCount="indefinite" values="10 130 110; -5 130 110; 10 130 110" />
          </path>
          <g>
            <path d="M 92 158 L 88 168 M 92 158 L 92 170 M 92 158 L 96 168" stroke={color2} strokeWidth="2" />
            <circle cx="92" cy="158" r="4" fill={color2} />
          </g>
          <g>
            <path d="M 108 158 L 104 168 M 108 158 L 108 170 M 108 158 L 112 168" stroke={color2} strokeWidth="2" />
            <circle cx="108" cy="158" r="4" fill={color2} />
          </g>
        </svg>
      )
    }

    return (
      <svg viewBox="0 0 200 220" style={{ width: "100%", height: "auto" }}>
        <defs>
          <radialGradient id="mysticOwl">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor={color2} />
          </radialGradient>
          <filter id="owlGlow">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <ellipse cx="100" cy="110" rx="70" ry="80" fill={color} opacity="0.15" filter="url(#owlGlow)">
          <animate attributeName="opacity" values="0.15;0.3;0.15" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="100" cy="120" rx="42" ry="50" fill="url(#mysticOwl)">
          <animate attributeName="cy" values="120;118;120" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="100" cy="80" rx="36" ry="40" fill="url(#mysticOwl)">
          <animate attributeName="cy" values="80;78;80" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="100" cy="65" rx="6" ry="8" fill="#14B8A6" opacity="0.8">
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="100" cy="66" r="3" fill="#fff" />
        <ellipse cx="85" cy="80" rx="12" ry="14" fill="#FFD700" />
        <circle cx="85" cy="82" r="7" fill="#14B8A6">
          <animate attributeName="r" values="7;8;7" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="85" cy="82" r="3" fill="#000" />
        <ellipse cx="115" cy="80" rx="12" ry="14" fill="#FFD700" />
        <circle cx="115" cy="82" r="7" fill="#14B8A6">
          <animate attributeName="r" values="7;8;7" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="115" cy="82" r="3" fill="#000" />
        <path d="M 100 90 Q 93 98 100 95 Q 107 98 100 90" fill="#0D9488" />
        <g>
          <path d="M 70 55 Q 65 40 68 45 Q 70 48 70 55" fill={color} />
          <path d="M 130 55 Q 135 40 132 45 Q 130 48 130 55" fill={color} />
          <circle cx="70" cy="42" r="2" fill="#14B8A6" opacity="0.8">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="130" cy="42" r="2" fill="#14B8A6" opacity="0.8">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
          </circle>
        </g>
        <g filter="url(#owlGlow)">
          <path d="M 65 115 Q 30 105 20 140 Q 25 165 40 160 Q 55 150 65 135" fill={color} opacity="0.9" stroke="#14B8A6" strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate" from="-15 65 115" to="8 65 115" dur="2.5s" repeatCount="indefinite" values="-15 65 115; 8 65 115; -15 65 115" />
          </path>
          <path d="M 135 115 Q 170 105 180 140 Q 175 165 160 160 Q 145 150 135 135" fill={color} opacity="0.9" stroke="#14B8A6" strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate" from="15 135 115" to="-8 135 115" dur="2.5s" repeatCount="indefinite" values="15 135 115; -8 135 115; 15 135 115" />
          </path>
        </g>
        <g>
          <ellipse cx="90" cy="165" rx="6" ry="8" fill="#0D9488" />
          <path d="M 87 172 L 84 182 M 90 172 L 90 185 M 93 172 L 96 182" stroke="#14B8A6" strokeWidth="2.5">
            <animate attributeName="stroke" values="#14B8A6;#FFD700;#14B8A6" dur="3s" repeatCount="indefinite" />
          </path>
        </g>
        <g>
          <ellipse cx="110" cy="165" rx="6" ry="8" fill="#0D9488" />
          <path d="M 107 172 L 104 182 M 110 172 L 110 185 M 113 172 L 116 182" stroke="#14B8A6" strokeWidth="2.5">
            <animate attributeName="stroke" values="#14B8A6;#FFD700;#14B8A6" dur="3s" repeatCount="indefinite" begin="1.5s" />
          </path>
        </g>
      </svg>
    )
  }

  // ============================================================================
  // GATO - 4 estágios completos
  // ============================================================================
  if (creature === "Gato") {
    if (nome.includes("Ovo")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <ellipse cx="100" cy="110" rx="38" ry="52" fill={color} stroke={color2} strokeWidth="3">
            <animateTransform attributeName="transform" type="rotate" from="0 100 110" to="4 100 110" dur="2s" repeatCount="indefinite" values="0 100 110; 4 100 110; -4 100 110; 0 100 110" />
          </ellipse>
          <ellipse cx="90" cy="100" rx="3" ry="8" fill={color2} opacity="0.4" />
          <ellipse cx="110" cy="100" rx="3" ry="8" fill={color2} opacity="0.4" />
          <path d="M 80 120 Q 85 115 90 120" stroke={color2} strokeWidth="1.5" fill="none" opacity="0.5">
            <animate attributeName="opacity" values="0.5;0.8;0.5" dur="1.5s" repeatCount="indefinite" />
          </path>
        </svg>
      )
    }

    if (nome.includes("Gatinho")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="kittenBody">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <circle cx="140" cy="145" r="10" fill="#FFB6C1" stroke="#FF69B4" strokeWidth="2">
            <animate attributeName="cx" values="140;145;140" dur="3s" repeatCount="indefinite" />
          </circle>
          <path d="M 120 125 Q 135 115 145 120 Q 150 125 145 128" fill={color} stroke={color2} strokeWidth="1.5">
            <animateTransform attributeName="transform" type="rotate" from="0 120 125" to="20 120 125" dur="1.5s" repeatCount="indefinite" values="0 120 125; 20 120 125; -10 120 125; 0 120 125" />
          </path>
          <ellipse cx="90" cy="125" rx="28" ry="22" fill="url(#kittenBody)">
            <animate attributeName="cx" values="90;92;90" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="75" cy="105" r="18" fill={color}>
            <animate attributeName="cx" values="75;77;75" dur="3s" repeatCount="indefinite" />
          </circle>
          <path d="M 62 95 L 58 82 L 65 90 Z" fill={color} />
          <path d="M 88 95 L 92 82 L 85 90 Z" fill={color} />
          <ellipse cx="60" cy="87" rx="3" ry="4" fill="#FFB6C1" />
          <ellipse cx="90" cy="87" rx="3" ry="4" fill="#FFB6C1" />
          <ellipse cx="70" cy="103" rx="4" ry="5" fill="#FFD700">
            <animate attributeName="ry" values="5;1;5" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="80" cy="103" rx="4" ry="5" fill="#FFD700">
            <animate attributeName="ry" values="5;1;5" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="70" cy="104" rx="2" ry="3" fill="#000" />
          <ellipse cx="80" cy="104" rx="2" ry="3" fill="#000" />
          <circle cx="75" cy="108" r="2" fill="#FFB6C1" />
          <path d="M 75 108 L 75 112 M 72 111 Q 75 113 78 111" stroke={color2} strokeWidth="1.5" fill="none" />
          <g stroke={color2} strokeWidth="1" fill="none">
            <path d="M 65 107 Q 50 105 45 107" />
            <path d="M 65 110 Q 50 112 45 110" />
            <path d="M 85 107 Q 100 105 105 107" />
            <path d="M 85 110 Q 100 112 105 110" />
          </g>
          <ellipse cx="80" cy="142" rx="5" ry="7" fill={color2}>
            <animate attributeName="cy" values="142;140;142" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="100" cy="142" rx="5" ry="7" fill={color2}>
            <animate attributeName="cy" values="142;140;142" dur="3s" repeatCount="indefinite" begin="1.5s" />
          </ellipse>
          <ellipse cx="70" cy="125" rx="4" ry="8" fill={color2}>
            <animateTransform attributeName="transform" type="rotate" from="0 70 125" to="-30 70 125" dur="1.5s" repeatCount="indefinite" values="0 70 125; -30 70 125; 0 70 125" />
          </ellipse>
        </svg>
      )
    }

    if (nome.includes("Mágico")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="magicCat">
              <stop offset="0%" stopColor={color} />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
            <filter id="catGlow">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          <circle cx="60" cy="90" r="2" fill="#FFD700" opacity="0.8">
            <animate attributeName="cy" values="90;80;90" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <path d="M 135 115 Q 155 105 165 115 Q 170 125 165 128" fill="url(#magicCat)" stroke={color2} strokeWidth="2" filter="url(#catGlow)">
            <animateTransform attributeName="transform" type="rotate" from="0 135 115" to="25 135 115" dur="2s" repeatCount="indefinite" values="0 135 115; 25 135 115; -15 135 115; 0 135 115" />
          </path>
          <ellipse cx="95" cy="120" rx="32" ry="24" fill="url(#magicCat)">
            <animate attributeName="cy" values="120;118;120" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="75" cy="100" rx="20" ry="22" fill="url(#magicCat)">
            <animate attributeName="cy" values="100;98;100" dur="3s" repeatCount="indefinite" />
          </ellipse>
          <path d="M 62 88 L 56 72 L 65 84 Z" fill={color} />
          <path d="M 88 88 L 94 72 L 85 84 Z" fill={color} />
          <ellipse cx="68" cy="97" rx="5" ry="6" fill="#A855F7" filter="url(#catGlow)">
            <animate attributeName="ry" values="6;1;6" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="68" cy="97" r="2" fill="#FFD700" />
          <ellipse cx="82" cy="97" rx="5" ry="6" fill="#A855F7" filter="url(#catGlow)">
            <animate attributeName="ry" values="6;1;6" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="82" cy="97" r="2" fill="#FFD700" />
          <ellipse cx="75" cy="105" rx="3" ry="2.5" fill="#FFB6C1" />
          <path d="M 75 105 L 75 109 M 72 108 Q 75 110 78 108" stroke={color2} strokeWidth="1.5" fill="none" />
          <g stroke="#A855F7" strokeWidth="1.5" fill="none" opacity="0.8">
            <path d="M 63 102 Q 48 100 43 102" />
            <path d="M 63 105 Q 48 107 43 105" />
            <path d="M 87 102 Q 102 100 107 102" />
            <path d="M 87 105 Q 102 107 107 105" />
          </g>
          <g>
            <ellipse cx="82" cy="140" rx="6" ry="9" fill={color2}>
              <animate attributeName="cy" values="140;138;140" dur="3s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="108" cy="140" rx="6" ry="9" fill={color2}>
              <animate attributeName="cy" values="140;138;140" dur="3s" repeatCount="indefinite" begin="1.5s" />
            </ellipse>
          </g>
          <g transform="translate(110, 85)">
            <circle cx="0" cy="-3" r="3" fill="#34D399" opacity="0.7" />
            <circle cx="-3" cy="0" r="3" fill="#34D399" opacity="0.7" />
            <circle cx="3" cy="0" r="3" fill="#34D399" opacity="0.7" />
            <circle cx="0" cy="3" r="3" fill="#34D399" opacity="0.7" />
            <path d="M 0 5 L 0 8" stroke="#34D399" strokeWidth="1.5" />
            <animateTransform attributeName="transform" type="translate" values="110,85; 110,80; 110,85" dur="2s" repeatCount="indefinite" />
          </g>
        </svg>
      )
    }

    return (
      <svg viewBox="0 0 220 200" style={{ width: "100%", height: "auto" }}>
        <defs>
          <radialGradient id="cosmicCat">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <filter id="cosmicGlow">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <ellipse cx="110" cy="110" rx="80" ry="70" fill="#1a1a2e" opacity="0.3" />
        <path d="M 150 115 Q 180 105 195 118 Q 200 130 195 133" fill="url(#cosmicCat)" stroke="#FCD34D" strokeWidth="2.5" filter="url(#cosmicGlow)">
          <animateTransform attributeName="transform" type="rotate" from="0 150 115" to="30 150 115" dur="2.5s" repeatCount="indefinite" values="0 150 115; 30 150 115; -20 150 115; 0 150 115" />
        </path>
        <ellipse cx="100" cy="118" rx="36" ry="28" fill="url(#cosmicCat)" filter="url(#cosmicGlow)">
          <animate attributeName="cy" values="118;116;118" dur="3.5s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="78" cy="95" rx="22" ry="24" fill="url(#cosmicCat)" filter="url(#cosmicGlow)">
          <animate attributeName="cy" values="95;93;95" dur="3.5s" repeatCount="indefinite" />
        </ellipse>
        <g filter="url(#cosmicGlow)">
          <path d="M 62 80 L 55 60 L 65 76 Z" fill="#F59E0B" />
          <path d="M 94 80 L 101 60 L 91 76 Z" fill="#F59E0B" />
        </g>
        <ellipse cx="70" cy="92" rx="6" ry="7" fill="#1a1a2e">
          <animate attributeName="ry" values="7;1;7" dur="5s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="70" cy="92" r="4" fill="#FCD34D" opacity="0.9">
          <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="70" cy="91" r="2" fill="#FFF" />
        <ellipse cx="86" cy="92" rx="6" ry="7" fill="#1a1a2e">
          <animate attributeName="ry" values="7;1;7" dur="5s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="86" cy="92" r="4" fill="#FCD34D" opacity="0.9">
          <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" begin="1s" />
        </circle>
        <circle cx="86" cy="91" r="2" fill="#FFF" />
        <ellipse cx="78" cy="101" rx="3.5" ry="3" fill="#FFB6C1" />
        <path d="M 78 101 L 78 105 M 74 104 Q 78 106 82 104" stroke="#D97706" strokeWidth="1.5" fill="none" />
        <g stroke="#FCD34D" strokeWidth="1.5" fill="none" filter="url(#cosmicGlow)">
          <path d="M 65 98 Q 48 96 40 98" />
          <path d="M 65 102 Q 48 104 40 102" />
          <path d="M 91 98 Q 108 96 116 98" />
          <path d="M 91 102 Q 108 104 116 102" />
        </g>
        <g>
          <ellipse cx="87" cy="143" rx="7" ry="10" fill="#D97706">
            <animate attributeName="cy" values="143;141;143" dur="3.5s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="87" cy="150" r="2" fill="#FCD34D" />
          <ellipse cx="113" cy="143" rx="7" ry="10" fill="#D97706">
            <animate attributeName="cy" values="143;141;143" dur="3.5s" repeatCount="indefinite" begin="1.75s" />
          </ellipse>
          <circle cx="113" cy="150" r="2" fill="#FCD34D" />
        </g>
      </svg>
    )
  }

  // ============================================================================
  // FÊNIX - 4 estágios completos
  // ============================================================================
  if (creature === "Fênix") {
    if (nome.includes("Cinzas")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <ellipse cx="100" cy="140" rx="40" ry="15" fill={color} opacity="0.6" />
          <ellipse cx="100" cy="135" rx="35" ry="12" fill={color2} opacity="0.5" />
          <ellipse cx="100" cy="130" rx="30" ry="10" fill={color} opacity="0.4" />
          <ellipse cx="100" cy="130" rx="20" ry="8" fill="#FFA500" opacity="0.2">
            <animate attributeName="opacity" values="0.2;0.4;0.2" dur="2s" repeatCount="indefinite" />
          </ellipse>
        </svg>
      )
    }

    if (nome.includes("Nascente")) {
      return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <radialGradient id="phoenixGlow">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </radialGradient>
          </defs>
          <ellipse cx="100" cy="145" rx="25" ry="10" fill="#D97706" opacity="0.6" />
          <path d="M 100 145 Q 90 130 95 110 Q 98 90 100 85 Q 102 90 105 110 Q 110 130 100 145" fill="url(#phoenixGlow)" opacity="0.9">
            <animate
              attributeName="d"
              values="M 100 145 Q 90 130 95 110 Q 98 90 100 85 Q 102 90 105 110 Q 110 130 100 145; M 100 145 Q 88 125 93 105 Q 97 85 100 78 Q 103 85 107 105 Q 112 125 100 145; M 100 145 Q 90 130 95 110 Q 98 90 100 85 Q 102 90 105 110 Q 110 130 100 145"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
          <ellipse cx="100" cy="105" rx="15" ry="20" fill="none" stroke="#F59E0B" strokeWidth="2" opacity="0.5">
            <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="95" cy="100" r="2" fill="#FFF" opacity="0.7">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="105" cy="100" r="2" fill="#FFF" opacity="0.7">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
          </circle>
        </svg>
      )
    }

    if (nome.includes("Flamejante")) {
      return (
        <svg viewBox="0 0 220 200" style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="phoenixFlame">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="30%" stopColor="#F59E0B" />
              <stop offset="70%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>
            <filter id="fireGlow">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <g filter="url(#fireGlow)">
            <path d="M 80 100 Q 40 90 20 110 Q 15 130 25 135 Q 45 140 65 130" fill="url(#phoenixFlame)" opacity="0.9">
              <animateTransform attributeName="transform" type="rotate" from="-20 80 100" to="10 80 100" dur="1.5s" repeatCount="indefinite" values="-20 80 100; 10 80 100; -20 80 100" />
            </path>
            <path d="M 140 100 Q 180 90 200 110 Q 205 130 195 135 Q 175 140 155 130" fill="url(#phoenixFlame)" opacity="0.9">
              <animateTransform attributeName="transform" type="rotate" from="20 140 100" to="-10 140 100" dur="1.5s" repeatCount="indefinite" values="20 140 100; -10 140 100; 20 140 100" />
            </path>
          </g>
          <ellipse cx="110" cy="110" rx="25" ry="32" fill="url(#phoenixFlame)" filter="url(#fireGlow)">
            <animate attributeName="cy" values="110;108;110" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="110" cy="80" rx="18" ry="20" fill="#DC2626" filter="url(#fireGlow)">
            <animate attributeName="cy" values="80;78;80" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <g>
            <path d="M 100 68 Q 95 55 98 60" fill="#FCD34D" opacity="0.9">
              <animate attributeName="d" values="M 100 68 Q 95 55 98 60; M 100 68 Q 95 50 98 58; M 100 68 Q 95 55 98 60" dur="1s" repeatCount="indefinite" />
            </path>
            <path d="M 110 65 Q 110 48 110 55" fill="#F59E0B" opacity="0.9">
              <animate attributeName="d" values="M 110 65 Q 110 48 110 55; M 110 65 Q 110 42 110 52; M 110 65 Q 110 48 110 55" dur="1s" repeatCount="indefinite" begin="0.3s" />
            </path>
            <path d="M 120 68 Q 125 55 122 60" fill="#FCD34D" opacity="0.9">
              <animate attributeName="d" values="M 120 68 Q 125 55 122 60; M 120 68 Q 125 50 122 58; M 120 68 Q 125 55 122 60" dur="1s" repeatCount="indefinite" begin="0.6s" />
            </path>
          </g>
          <ellipse cx="105" cy="77" rx="3" ry="4" fill="#FCD34D" />
          <circle cx="105" cy="77" r="1.5" fill="#FFF">
            <animate attributeName="r" values="1.5;0.5;1.5" dur="3s" repeatCount="indefinite" />
          </circle>
          <ellipse cx="115" cy="77" rx="3" ry="4" fill="#FCD34D" />
          <circle cx="115" cy="77" r="1.5" fill="#FFF">
            <animate attributeName="r" values="1.5;0.5;1.5" dur="3s" repeatCount="indefinite" />
          </circle>
          <path d="M 110 82 L 105 87 L 110 85 L 115 87 Z" fill="#F59E0B" />
          <g filter="url(#fireGlow)">
            <path d="M 120 135 Q 140 145 155 140 Q 165 135 160 130" fill="url(#phoenixFlame)" opacity="0.9">
              <animateTransform attributeName="transform" type="rotate" from="0 120 135" to="20 120 135" dur="2s" repeatCount="indefinite" values="0 120 135; 20 120 135; -15 120 135; 0 120 135" />
            </path>
          </g>
          <g opacity="0.8">
            <path d="M 100 140 L 97 152 M 100 140 L 100 153 M 100 140 L 103 152" stroke="#DC2626" strokeWidth="2.5" />
            <path d="M 120 140 L 117 152 M 120 140 L 120 153 M 120 140 L 123 152" stroke="#DC2626" strokeWidth="2.5" />
          </g>
        </svg>
      )
    }

    return (
      <svg viewBox="0 0 240 220" style={{ width: "100%", height: "auto" }}>
        <defs>
          <radialGradient id="immortalFlame">
            <stop offset="0%" stopColor="#FFF" />
            <stop offset="20%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#F97316" />
            <stop offset="80%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7C2D12" />
          </radialGradient>
          <filter id="divineGlow">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <ellipse cx="120" cy="110" rx="100" ry="90" fill="#F97316" opacity="0.15" filter="url(#divineGlow)">
          <animate attributeName="rx" values="100;110;100" dur="3s" repeatCount="indefinite" />
          <animate attributeName="ry" values="90;100;90" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="120" cy="110" r="80" fill="none" stroke="#FCD34D" strokeWidth="1.5" opacity="0.4" strokeDasharray="10,5">
          <animateTransform attributeName="transform" type="rotate" from="0 120 110" to="360 120 110" dur="20s" repeatCount="indefinite" />
        </circle>
        <g filter="url(#divineGlow)">
          <path d="M 85 95 Q 30 75 10 105 Q 5 130 18 140 Q 45 155 70 140" fill="url(#immortalFlame)" opacity="0.95">
            <animateTransform attributeName="transform" type="rotate" from="-25 85 95" to="8 85 95" dur="2s" repeatCount="indefinite" values="-25 85 95; 8 85 95; -25 85 95" />
          </path>
          <path d="M 155 95 Q 210 75 230 105 Q 235 130 222 140 Q 195 155 170 140" fill="url(#immortalFlame)" opacity="0.95">
            <animateTransform attributeName="transform" type="rotate" from="25 155 95" to="-8 155 95" dur="2s" repeatCount="indefinite" values="25 155 95; -8 155 95; 25 155 95" />
          </path>
        </g>
        <ellipse cx="120" cy="110" rx="28" ry="38" fill="url(#immortalFlame)" filter="url(#divineGlow)">
          <animate attributeName="cy" values="110;108;110" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="120" cy="75" rx="20" ry="24" fill="#DC2626" filter="url(#divineGlow)">
          <animate attributeName="cy" values="75;73;75" dur="3s" repeatCount="indefinite" />
        </ellipse>
        <g filter="url(#divineGlow)">
          <path d="M 105 58 Q 100 42 103 48" fill="#FFF" opacity="0.9">
            <animate attributeName="d" values="M 105 58 Q 100 42 103 48; M 105 58 Q 100 38 103 45; M 105 58 Q 100 42 103 48" dur="1s" repeatCount="indefinite" />
          </path>
          <path d="M 120 55 Q 120 35 120 43" fill="#FCD34D" opacity="0.9">
            <animate attributeName="d" values="M 120 55 Q 120 35 120 43; M 120 55 Q 120 30 120 40; M 120 55 Q 120 35 120 43" dur="1s" repeatCount="indefinite" begin="0.25s" />
          </path>
          <path d="M 135 58 Q 140 42 137 48" fill="#FFF" opacity="0.9">
            <animate attributeName="d" values="M 135 58 Q 140 42 137 48; M 135 58 Q 140 38 137 45; M 135 58 Q 140 42 137 48" dur="1s" repeatCount="indefinite" begin="0.5s" />
          </path>
        </g>
        <ellipse cx="113" cy="72" rx="4" ry="5" fill="#FFF" filter="url(#divineGlow)">
          <animate attributeName="opacity" values="1;0.3;1" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="113" cy="73" r="2" fill="#F97316" />
        <ellipse cx="127" cy="72" rx="4" ry="5" fill="#FFF" filter="url(#divineGlow)">
          <animate attributeName="opacity" values="1;0.3;1" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="127" cy="73" r="2" fill="#F97316" />
        <path d="M 120 80 L 113 87 L 120 84 L 127 87 Z" fill="#FCD34D" filter="url(#divineGlow)" />
        <g filter="url(#divineGlow)">
          <path d="M 125 142 Q 150 155 170 145 Q 180 138 175 132" fill="url(#immortalFlame)" opacity="0.95">
            <animateTransform attributeName="transform" type="rotate" from="0 125 142" to="25 125 142" dur="2.5s" repeatCount="indefinite" values="0 125 142; 25 125 142; -18 125 142; 0 125 142" />
          </path>
        </g>
        <g filter="url(#divineGlow)">
          <ellipse cx="110" cy="145" rx="5" ry="8" fill="#DC2626" />
          <path d="M 107 152 L 104 164 M 110 152 L 110 166 M 113 152 L 116 164" stroke="#FCD34D" strokeWidth="3" />
          <ellipse cx="130" cy="145" rx="5" ry="8" fill="#DC2626" />
          <path d="M 127 152 L 124 164 M 130 152 L 130 166 M 133 152 L 136 164" stroke="#FCD34D" strokeWidth="3" />
        </g>
        <ellipse cx="120" cy="55" rx="30" ry="8" fill="none" stroke="#FCD34D" strokeWidth="2" opacity="0.6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from="0 120 55" to="360 120 55" dur="8s" repeatCount="indefinite" />
        </ellipse>
      </svg>
    )
  }

  return null
}
