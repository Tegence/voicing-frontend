/* --------------------------------------------------------------------------
 * design.ts — Enhanced Unified Design System for Next.js Audio Platform
 * Focus: Speech enhancement • Rendering • Embedding generation
 * Brand tone: precise, modern, trustworthy, performant
 * -------------------------------------------------------------------------- */

type Mode = "light" | "dark" | "auto";
type ColorScheme = "light" | "dark";

/** --------------------------------------------------------------------------
 * Type-Safe Token System
 * -------------------------------------------------------------------------- */

// Token value types for better type safety
type SpacingToken = 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96;
type RadiusToken = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
type BreakpointToken = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type SemanticColorToken = "success" | "warning" | "danger" | "info";

/** --------------------------------------------------------------------------
 * Enhanced Utilities
 * -------------------------------------------------------------------------- */

/** Fluid typography with viewport-based scaling */
const fluid = (minPx: number, maxPx: number, minVw = 320, maxVw = 1440) => {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const yAxisIntersection = -minVw * slope + minPx;
  return `clamp(${minPx}px, calc(${yAxisIntersection}px + ${slope * 100}vw), ${maxPx}px)`;
};

/** Legacy clamp helper (kept for backward compatibility) */
const clampPx = (minPx: number, vw: number, maxPx: number) =>
  `clamp(${minPx}px, ${vw}vw, ${maxPx}px)`;

/** Enhanced color utilities */
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const normalized = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const bigint = parseInt(normalized, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hsl = (h: number, s: number, l: number, a = 1) => 
  a === 1 ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${a})`;

/** Color mixing for dynamic theming */
const mix = (color1: string, color2: string, weight = 0.5): string => {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/** Media query helper */
const mq = (bp: number) => `@media (min-width: ${bp}px)`;

/* -------------------------------------------------------------------------- */
/* Enhanced Color System with Semantic Scales                                 */
/* -------------------------------------------------------------------------- */

const primitives = {
  // Brand colors with shades
  ink: {
    50: "#F1F5F9",
    100: "#E2E8F0",
    200: "#CBD5E1",
    300: "#94A3B8",
    400: "#64748B",
    500: "#475569",
    600: "#334155",
    700: "#1E293B",
    800: "#0F172A",
    900: "#0B1220",
    950: "#020617",
  },
  accent: {
    50: "#FDF6F3",
    100: "#FAEAE5",
    200: "#F4D2C5",
    300: "#ECAE94",
    400: "#DD9675",
    500: "#D17E54",
    600: "#C46A3A",
    700: "#A15330",
    800: "#7E412A",
    900: "#5C3122",
  },
  // Neutral grays
  gray: {
    50: "#FAFAFA",
    100: "#F5F6FA",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },
};

const semantic = {
  success: {
    light: "#16A34A",
    dark: "#22C55E",
    bg: { light: "#E7F8EC", dark: rgba("#22C55E", 0.15) },
    text: { light: "#166534", dark: "#86EFAC" },
  },
  warning: {
    light: "#F59E0B",
    dark: "#FCD34D",
    bg: { light: "#FEF3C7", dark: rgba("#FCD34D", 0.15) },
    text: { light: "#92400E", dark: "#FDE68A" },
  },
  danger: {
    light: "#DC2626",
    dark: "#EF4444",
    bg: { light: "#FEE2E2", dark: rgba("#EF4444", 0.15) },
    text: { light: "#991B1B", dark: "#FCA5A5" },
  },
  info: {
    light: "#2563EB",
    dark: "#60A5FA",
    bg: { light: "#EEF2FF", dark: rgba("#60A5FA", 0.15) },
    text: { light: "#3730A3", dark: "#93BBFD" },
  },
};

/* Enhanced gradient system */
const gradients = {
  // Visualization gradients
  spectrogram: ["#1F2937", "#3B82F6", "#DD9675", "#F59E0B"] as const,
  velocity: ["#0F172A", "#334155", "#DD9675", "#FBBF24"] as const,
  thermal: ["#2563EB", "#7C3AED", "#EC4899", "#F97316"] as const,
  
  // UI gradients
  heroLight: `linear-gradient(135deg, ${primitives.accent[400]} 0%, ${semantic.warning.light} 100%)`,
  heroDark: `linear-gradient(135deg, ${primitives.accent[500]} 0%, ${semantic.warning.dark} 100%)`,
  glassMorphism: `linear-gradient(135deg, ${rgba("#FFFFFF", 0.1)} 0%, ${rgba("#FFFFFF", 0.05)} 100%)`,
};

/* -------------------------------------------------------------------------- */
/* Enhanced Typography System                                                 */
/* -------------------------------------------------------------------------- */

const typography = {
  families: {
    sans: `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
    mono: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`,
    display: `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif`, // For headings
  },
  weights: { 
    thin: 300,
    regular: 400, 
    medium: 500, 
    semibold: 600, 
    bold: 700,
    extrabold: 800,
  },
  sizes: {
    // Fluid typography scales
    displayXL: { 
      size: fluid(40, 56), 
      line: 1.1, 
      weight: 700,
      letter: "-0.02em",
    },
    displayL: { 
      size: fluid(32, 44), 
      line: 1.15, 
      weight: 700,
      letter: "-0.015em",
    },
    h1: { 
      size: fluid(28, 36), 
      line: 1.2, 
      weight: 700,
      letter: "-0.01em",
    },
    h2: { 
      size: fluid(22, 28), 
      line: 1.25, 
      weight: 600,
      letter: "-0.005em",
    },
    h3: { 
      size: fluid(18, 20), 
      line: 1.3, 
      weight: 600,
      letter: "0",
    },
    h4: { 
      size: "16px", 
      line: 1.35, 
      weight: 600,
      letter: "0",
    },
    bodyL: { 
      size: "18px", 
      line: 1.6, 
      weight: 400,
      letter: "0",
    },
    bodyM: { 
      size: "16px", 
      line: 1.55, 
      weight: 400,
      letter: "0",
    },
    bodyS: { 
      size: "14px", 
      line: 1.5, 
      weight: 400,
      letter: "0",
    },
    caption: { 
      size: "13px", 
      line: 1.45, 
      weight: 400,
      letter: "0.01em",
    },
    mono: { 
      size: "14px", 
      line: 1.45, 
      weight: 500,
      letter: "0",
    },
    label: { 
      size: "12px", 
      line: 1.4, 
      weight: 500, 
      letter: "0.04em",
      textTransform: "uppercase" as const,
    },
    tiny: { 
      size: "11px", 
      line: 1.35, 
      weight: 500,
      letter: "0.02em",
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Enhanced Layout System                                                     */
/* -------------------------------------------------------------------------- */

const spacing: Record<string, SpacingToken> = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64,
  "20": 80,
  "24": 96,
};

const radii: Record<RadiusToken, number | string> = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
};

const shadows = {
  // Elevation levels
  xs: `0 1px 2px ${rgba(primitives.ink[900], 0.04)}`,
  sm: `0 2px 4px ${rgba(primitives.ink[900], 0.06)}`,
  md: `0 4px 8px ${rgba(primitives.ink[900], 0.08)}`,
  lg: `0 8px 16px ${rgba(primitives.ink[900], 0.10)}`,
  xl: `0 12px 24px ${rgba(primitives.ink[900], 0.12)}`,
  "2xl": `0 16px 32px ${rgba(primitives.ink[900], 0.14)}`,
  
  // Specific use cases
  card: `0 1px 3px ${rgba(primitives.ink[900], 0.06)}, 0 1px 2px ${rgba(primitives.ink[900], 0.04)}`,
  pop: `0 8px 24px ${rgba(primitives.ink[900], 0.12)}`,
  modal: `0 20px 40px ${rgba(primitives.ink[900], 0.18)}`,
  inset: `inset 0 2px 4px ${rgba(primitives.ink[900], 0.06)}`,
  
  // Colored shadows
  glow: (color: string) => `0 0 20px ${rgba(color, 0.3)}`,
  coloredCard: (color: string) => `0 4px 16px ${rgba(color, 0.15)}`,
} as const;

const z = { 
  below: -1,
  base: 0, 
  float: 1,
  sticky: 5,
  header: 10, 
  dropdown: 15,
  overlay: 20, 
  modal: 30, 
  toast: 40,
  tooltip: 50,
  max: 9999,
} as const;

const breakpoints: Record<BreakpointToken, number> = {
  xs: 360,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1440,
};

const grid = {
  columns: 12,
  gutter: { xs: 16, sm: 20, md: 24, lg: 32 },
  containerMax: 1280,
  containerPadding: { xs: 16, sm: 24, md: 32, lg: 40 },
} as const;

/* -------------------------------------------------------------------------- */
/* Enhanced Motion System                                                     */
/* -------------------------------------------------------------------------- */

const motion = {
  durations: { 
    instant: 50,
    fast: 100, 
    base: 150, 
    medium: 200,
    slow: 250, 
    slower: 400,
    lazy: 600,
  },
  easing: {
    linear: "linear",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    empha: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
  // Predefined transitions
  transitions: {
    fade: (duration = 150) => `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    scale: (duration = 150) => `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
    slide: (duration = 200) => `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    all: (duration = 150) => `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  },
};

/* -------------------------------------------------------------------------- */
/* Enhanced Component Tokens                                                  */
/* -------------------------------------------------------------------------- */

const components = {
  button: {
    sizes: {
      xs: { height: 28, px: 12, fontSize: "12px" },
      sm: { height: 32, px: 16, fontSize: "13px" },
      md: { height: 40, px: 20, fontSize: "14px" },
      lg: { height: 48, px: 24, fontSize: "16px" },
      xl: { height: 56, px: 32, fontSize: "18px" },
    },
    variants: {
      primary: {
        bg: primitives.accent[400],
        text: "#FFFFFF",
        hover: primitives.accent[500],
        active: primitives.accent[600],
        disabled: primitives.gray[300],
        focusRing: `0 0 0 3px ${rgba(primitives.accent[400], 0.35)}`,
      },
      secondary: {
        bg: primitives.gray[100],
        text: primitives.ink[800],
        border: primitives.gray[300],
        hover: primitives.gray[200],
        active: primitives.gray[300],
        focusRing: `0 0 0 3px ${rgba(primitives.ink[800], 0.15)}`,
      },
      ghost: {
        bg: "transparent",
        text: primitives.accent[400],
        hover: rgba(primitives.accent[400], 0.08),
        active: rgba(primitives.accent[400], 0.12),
        focusRing: `0 0 0 3px ${rgba(primitives.accent[400], 0.25)}`,
      },
      danger: {
        bg: semantic.danger.light,
        text: "#FFFFFF",
        hover: "#B91C1C",
        active: "#991B1B",
        focusRing: `0 0 0 3px ${rgba(semantic.danger.light, 0.35)}`,
      },
    },
    radius: radii.md,
  },
  
  input: {
    sizes: {
      sm: { height: 36, fontSize: "14px", px: 12 },
      md: { height: 44, fontSize: "16px", px: 16 },
      lg: { height: 52, fontSize: "18px", px: 20 },
    },
    base: {
      bg: primitives.gray[50],
      border: primitives.gray[300],
      text: primitives.ink[800],
      placeholder: rgba(primitives.ink[800], 0.45),
      radius: radii.md,
    },
    states: {
      hover: {
        border: primitives.gray[400],
      },
      focus: {
        border: primitives.accent[400],
        ring: `0 0 0 3px ${rgba(primitives.accent[400], 0.25)}`,
      },
      error: {
        border: semantic.danger.light,
        ring: `0 0 0 3px ${rgba(semantic.danger.light, 0.25)}`,
      },
      disabled: {
        bg: primitives.gray[100],
        border: primitives.gray[200],
        text: primitives.gray[400],
      },
    },
  },
  
  card: {
    bg: primitives.gray[50],
    border: primitives.gray[200],
    radius: radii.lg,
    shadow: shadows.card,
    padding: spacing["6"],
    hover: {
      shadow: shadows.md,
      transform: "translateY(-2px)",
    },
  },
  
  badge: {
    sizes: {
      sm: { height: 20, px: 8, fontSize: "11px" },
      md: { height: 24, px: 10, fontSize: "12px" },
      lg: { height: 28, px: 12, fontSize: "13px" },
    },
    variants: {
      default: {
        bg: primitives.gray[200],
        text: primitives.gray[700],
      },
      success: {
        bg: semantic.success.bg.light,
        text: semantic.success.text.light,
      },
      warning: {
        bg: semantic.warning.bg.light,
        text: semantic.warning.text.light,
      },
      danger: {
        bg: semantic.danger.bg.light,
        text: semantic.danger.text.light,
      },
      info: {
        bg: semantic.info.bg.light,
        text: semantic.info.text.light,
      },
    },
    radius: radii.full,
  },
  
  tooltip: {
    bg: primitives.ink[900],
    text: primitives.gray[50],
    radius: radii.sm,
    shadow: shadows.lg,
    padding: { x: 12, y: 8 },
    fontSize: "13px",
    maxWidth: 280,
  },
  
  modal: {
    overlay: rgba(primitives.ink[900], 0.5),
    bg: primitives.gray[50],
    radius: radii.xl,
    shadow: shadows.modal,
    maxWidth: { sm: 400, md: 600, lg: 800, xl: 1000 },
    padding: { header: 24, body: 24, footer: 20 },
  },
  
  toast: {
    variants: {
      default: {
        bg: primitives.ink[800],
        text: primitives.gray[50],
        icon: primitives.gray[400],
      },
      success: {
        bg: semantic.success.light,
        text: "#FFFFFF",
        icon: "#FFFFFF",
      },
      warning: {
        bg: semantic.warning.light,
        text: "#FFFFFF",
        icon: "#FFFFFF",
      },
      danger: {
        bg: semantic.danger.light,
        text: "#FFFFFF",
        icon: "#FFFFFF",
      },
    },
    radius: radii.md,
    shadow: shadows.xl,
    padding: 16,
    gap: 12,
    duration: 4000,
    maxWidth: 360,
  },
  
  table: {
    header: {
      bg: primitives.gray[100],
      text: primitives.ink[700],
      fontSize: "12px",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
      height: 44,
    },
    row: {
      height: 52,
      heightDense: 44,
      hover: primitives.gray[50],
      selected: rgba(primitives.accent[400], 0.08),
      border: primitives.gray[200],
    },
    cell: {
      padding: { x: 16, y: 12 },
      fontSize: "14px",
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Enhanced Audio-Specific Tokens                                             */
/* -------------------------------------------------------------------------- */

const audio = {
  player: {
    transportHeight: 64,
    compactHeight: 48,
    minWaveHeight: 160,
    minSpecHeight: 200,
    iconSize: { sm: 18, md: 22, lg: 28 },
    radius: radii.lg,
    scrubberHeight: 4,
    volumeSliderWidth: 100,
  },
  waveform: {
    colors: {
      line: rgba(primitives.ink[800], 0.72),
      fill: rgba(primitives.ink[800], 0.45),
      selection: rgba(primitives.accent[400], 0.28),
      playhead: primitives.accent[400],
      markers: primitives.accent[500],
      grid: rgba(primitives.ink[800], 0.08),
    },
    dimensions: {
      playheadWidth: 2,
      markerWidth: 1,
      barGap: 1,
      minBarHeight: 2,
    },
  },
  spectrogram: {
    colors: {
      ramp: gradients.spectrogram,
      bg: primitives.ink[900],
      grid: rgba("#FFFFFF", 0.06),
      labels: rgba("#FFFFFF", 0.65),
    },
    frequencyScale: "mel" as "linear" | "log" | "mel",
    dynamicRange: 80, // dB
    fftSize: 2048,
  },
  meters: {
    vu: {
      bg: rgba(primitives.ink[800], 0.08),
      safe: rgba(primitives.ink[800], 0.6),
      caution: semantic.warning.light,
      peak: primitives.accent[400],
      clip: semantic.danger.light,
      width: 6,
      gap: 2,
      segments: 20,
    },
    spectrum: {
      bars: 32,
      barWidth: 8,
      gap: 2,
      gradient: gradients.velocity,
    },
  },
  controls: {
    playPause: {
      size: 48,
      iconScale: 0.55,
      bg: primitives.accent[400],
      hover: primitives.accent[500],
    },
    transport: {
      size: 32,
      iconScale: 0.6,
      gap: 8,
    },
    speed: {
      options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      default: 1,
    },
  },
  shortcuts: {
    playPause: "Space",
    stop: "Escape",
    back5: "J",
    forward5: "L",
    back30: "Shift+J",
    forward30: "Shift+L",
    setA: "I",
    setB: "O",
    clearLoop: "P",
    marker: "M",
    zoom: {
      in: "=",
      out: "-",
      reset: "0",
      selection: "Z",
      levels: ["1", "2", "3", "4", "5"],
    },
    volume: {
      up: "ArrowUp",
      down: "ArrowDown",
      mute: "M",
    },
    speed: {
      increase: "]",
      decrease: "[",
      reset: "\\",
    },
    fineDrag: "Shift+Drag",
    process: "Cmd/Ctrl+Enter",
    export: "Cmd/Ctrl+E",
  },
};

/* -------------------------------------------------------------------------- */
/* Enhanced Charts & Visualization                                            */
/* -------------------------------------------------------------------------- */

const charts = {
  colors: {
    primary: primitives.accent[400],
    secondary: primitives.ink[600],
    tertiary: primitives.gray[500],
    series: [
      primitives.accent[400],
      "#3B82F6",
      "#8B5CF6",
      "#EC4899",
      "#14B8A6",
      "#F59E0B",
    ],
  },
  grid: {
    color: rgba(primitives.ink[800], 0.08),
    strokeDasharray: "2 4",
  },
  axis: {
    color: rgba(primitives.ink[800], 0.45),
    fontSize: "11px",
    fontWeight: 500,
  },
  tooltip: {
    bg: primitives.ink[900],
    text: primitives.gray[50],
    border: primitives.gray[700],
    radius: radii.sm,
    shadow: shadows.xl,
    padding: 8,
  },
  legend: {
    fontSize: "12px",
    color: primitives.ink[600],
    gap: 16,
    markerSize: 8,
  },
  kpi: {
    up: { color: semantic.success.light, icon: "↑" },
    down: { color: semantic.danger.light, icon: "↓" },
    neutral: { color: primitives.gray[500], icon: "→" },
  },
};

/* -------------------------------------------------------------------------- */
/* Enhanced Accessibility                                                     */
/* -------------------------------------------------------------------------- */

const a11y = {
  minTouch: 44, // WCAG 2.5.5 Target Size
  minClickable: 24, // Minimum for desktop
  focusRing: {
    light: `0 0 0 2px #FFFFFF, 0 0 0 4px ${primitives.accent[400]}`,
    dark: `0 0 0 2px ${primitives.ink[900]}, 0 0 0 4px ${primitives.accent[500]}`,
    inset: `inset 0 0 0 2px ${primitives.accent[400]}`,
  },
  contrastRatios: {
    largeText: 3, // 18pt+ or 14pt+ bold
    normalText: 4.5,
    ui: 3,
    enhanced: 7, // AAA level
  },
  reducedMotion: {
    duration: 1, // Instant transitions
    easing: "linear",
  },
  highContrast: {
    border: "2px solid currentColor",
    outline: "2px solid currentColor",
  },
  screenReader: {
    visuallyHidden: {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      borderWidth: "0",
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Dark Mode Palette Generator                                                */
/* -------------------------------------------------------------------------- */

const makePalette = (scheme: ColorScheme) => {
  const isDark = scheme === "dark";
  
  return {
    // Surfaces
    surface0: isDark ? primitives.ink[900] : primitives.gray[50],
    surface1: isDark ? primitives.ink[800] : primitives.gray[100],
    surface2: isDark ? primitives.ink[700] : primitives.gray[200],
    
    // Text
    textPrimary: isDark ? primitives.gray[100] : primitives.ink[800],
    textSecondary: isDark ? primitives.gray[400] : primitives.ink[600],
    textTertiary: isDark ? primitives.gray[500] : primitives.ink[500],
    textInverse: isDark ? primitives.ink[800] : primitives.gray[100],
    
    // Borders
    borderSubtle: isDark ? primitives.gray[800] : primitives.gray[200],
    borderDefault: isDark ? primitives.gray[700] : primitives.gray[300],
    borderStrong: isDark ? primitives.gray[600] : primitives.gray[400],
    
    // Interactive
    interactive: isDark ? primitives.accent[500] : primitives.accent[400],
    interactiveHover: isDark ? primitives.accent[400] : primitives.accent[500],
    interactiveActive: isDark ? primitives.accent[600] : primitives.accent[600],
    
    // Semantic colors
    success: isDark ? semantic.success.dark : semantic.success.light,
    warning: isDark ? semantic.warning.dark : semantic.warning.light,
    danger: isDark ? semantic.danger.dark : semantic.danger.light,
    info: isDark ? semantic.info.dark : semantic.info.light,
    
    // Semantic backgrounds
    successBg: isDark ? semantic.success.bg.dark : semantic.success.bg.light,
    warningBg: isDark ? semantic.warning.bg.dark : semantic.warning.bg.light,
    dangerBg: isDark ? semantic.danger.bg.dark : semantic.danger.bg.light,
    infoBg: isDark ? semantic.info.bg.dark : semantic.info.bg.light,
    
    // Overlays
    overlay: isDark ? rgba(primitives.ink[950], 0.7) : rgba(primitives.ink[900], 0.5),
    overlayLight: isDark ? rgba(primitives.ink[950], 0.5) : rgba(primitives.ink[900], 0.3),
  };
};

/* -------------------------------------------------------------------------- */
/* CSS Custom Properties Generator                                            */
/* -------------------------------------------------------------------------- */

const toCssVars = (scheme: ColorScheme) => {
  const p = makePalette(scheme);
  const isDark = scheme === "dark";
  
  const vars: Record<string, string> = {
    // Color scheme flag
    "--color-scheme": scheme,
    
    // Surfaces
    "--surface-0": p.surface0,
    "--surface-1": p.surface1,
    "--surface-2": p.surface2,
    
    // Text
    "--text-primary": p.textPrimary,
    "--text-secondary": p.textSecondary,
    "--text-tertiary": p.textTertiary,
    "--text-inverse": p.textInverse,
    
    // Borders
    "--border-subtle": p.borderSubtle,
    "--border-default": p.borderDefault,
    "--border-strong": p.borderStrong,
    
    // Interactive
    "--interactive": p.interactive,
    "--interactive-hover": p.interactiveHover,
    "--interactive-active": p.interactiveActive,
    
    // Semantic
    "--success": p.success,
    "--warning": p.warning,
    "--danger": p.danger,
    "--info": p.info,
    "--success-bg": p.successBg,
    "--warning-bg": p.warningBg,
    "--danger-bg": p.dangerBg,
    "--info-bg": p.infoBg,
    
    // Typography
    "--ff-sans": typography.families.sans,
    "--ff-mono": typography.families.mono,
    "--ff-display": typography.families.display,
    
    // Shadows (adjusted for dark mode)
    "--shadow-xs": isDark ? shadows.xs.replace("0.04", "0.08") : shadows.xs,
    "--shadow-sm": isDark ? shadows.sm.replace("0.06", "0.10") : shadows.sm,
    "--shadow-md": isDark ? shadows.md.replace("0.08", "0.12") : shadows.md,
    "--shadow-lg": isDark ? shadows.lg.replace("0.10", "0.14") : shadows.lg,
    "--shadow-xl": isDark ? shadows.xl.replace("0.12", "0.16") : shadows.xl,
    
    // Motion
    "--motion-instant": `${motion.durations.instant}ms`,
    "--motion-fast": `${motion.durations.fast}ms`,
    "--motion-base": `${motion.durations.base}ms`,
    "--motion-medium": `${motion.durations.medium}ms`,
    "--motion-slow": `${motion.durations.slow}ms`,
    "--ease-in": motion.easing.in,
    "--ease-out": motion.easing.out,
    "--ease-in-out": motion.easing.inOut,
    "--ease-empha": motion.easing.empha,
    "--ease-bounce": motion.easing.bounce,
    "--ease-spring": motion.easing.spring,
    
    // Audio player specific
    "--player-transport-h": `${audio.player.transportHeight}px`,
    "--player-compact-h": `${audio.player.compactHeight}px`,
    "--wave-line": audio.waveform.colors.line,
    "--wave-fill": audio.waveform.colors.fill,
    "--wave-selection": audio.waveform.colors.selection,
    "--wave-playhead": audio.waveform.colors.playhead,
    
    // Focus states
    "--focus-ring": isDark ? a11y.focusRing.dark : a11y.focusRing.light,
    
    // Z-index scale
    "--z-below": `${z.below}`,
    "--z-base": `${z.base}`,
    "--z-float": `${z.float}`,
    "--z-sticky": `${z.sticky}`,
    "--z-header": `${z.header}`,
    "--z-dropdown": `${z.dropdown}`,
    "--z-overlay": `${z.overlay}`,
    "--z-modal": `${z.modal}`,
    "--z-toast": `${z.toast}`,
    "--z-tooltip": `${z.tooltip}`,
    "--z-max": `${z.max}`,
  };
  
  // Add spacing scale
  Object.entries(spacing).forEach(([key, value]) => {
    vars[`--space-${key}`] = `${value}px`;
  });
  
  // Add radius scale
  Object.entries(radii).forEach(([key, value]) => {
    vars[`--radius-${key}`] = typeof value === "number" ? `${value}px` : value;
  });
  
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");
};

/* -------------------------------------------------------------------------- */
/* CSS Generation                                                              */
/* -------------------------------------------------------------------------- */

export const cssVarsLight = `:root {\n  ${toCssVars("light")}\n}`;
export const cssVarsDark = `:root[data-theme="dark"] {\n  ${toCssVars("dark")}\n}`;

// Automatic dark mode based on system preference
export const cssVarsAuto = `
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    ${toCssVars("dark")}
  }
}`;

// Reduced motion preferences
export const cssReducedMotion = `
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: ${a11y.reducedMotion.duration}ms !important;
    animation-delay: 0s !important;
    transition-duration: ${a11y.reducedMotion.duration}ms !important;
    transition-delay: 0s !important;
  }
}`;

// High contrast mode
export const cssHighContrast = `
@media (prefers-contrast: high) {
  :focus-visible {
    outline: ${a11y.highContrast.outline} !important;
  }
  
  button, a, input, select, textarea {
    border: ${a11y.highContrast.border} !important;
  }
}`;

export const getDesignCss = (options?: { 
  includeAuto?: boolean; 
  includeA11y?: boolean;
}) => {
  const { includeAuto = true, includeA11y = true } = options || {};
  
  let css = `${cssVarsLight}\n${cssVarsDark}`;
  
  if (includeAuto) css += `\n${cssVarsAuto}`;
  if (includeA11y) css += `\n${cssReducedMotion}\n${cssHighContrast}`;
  
  return css;
};

/* -------------------------------------------------------------------------- */
/* Tailwind Configuration Helper                                              */
/* -------------------------------------------------------------------------- */

export const tailwindPreset = () => ({
  theme: {
    extend: {
      colors: {
        // Map primitive colors
        ink: primitives.ink,
        accent: primitives.accent,
        gray: primitives.gray,
        
        // Semantic colors
        success: semantic.success,
        warning: semantic.warning,
        danger: semantic.danger,
        info: semantic.info,
        
        // CSS variable references for dynamic theming
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          inverse: "var(--text-inverse)",
        },
      },
      borderRadius: radii,
      boxShadow: shadows,
      fontFamily: {
        sans: typography.families.sans.split(","),
        mono: typography.families.mono.split(","),
        display: typography.families.display.split(","),
      },
      fontSize: Object.entries(typography.sizes).reduce((acc, [key, value]) => ({
        ...acc,
        [key]: [value.size, { lineHeight: value.line }],
      }), {}),
      screens: breakpoints,
      spacing,
      zIndex: z,
      animation: {
        fadeIn: "fadeIn var(--motion-base) var(--ease-out)",
        fadeOut: "fadeOut var(--motion-base) var(--ease-in)",
        slideUp: "slideUp var(--motion-medium) var(--ease-empha)",
        slideDown: "slideDown var(--motion-medium) var(--ease-empha)",
        scaleIn: "scaleIn var(--motion-fast) var(--ease-spring)",
        pulse: "pulse 2s infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeOut: {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        slideUp: {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
});

/* -------------------------------------------------------------------------- */
/* React Hooks for Theme Management                                           */
/* -------------------------------------------------------------------------- */

export const useTheme = () => {
  if (typeof window === "undefined") return { scheme: "light" as ColorScheme };
  
  const getScheme = (): ColorScheme => {
    const stored = localStorage.getItem("theme") as ColorScheme;
    if (stored) return stored;
    
    return window.matchMedia("(prefers-color-scheme: dark)").matches 
      ? "dark" 
      : "light";
  };
  
  const setScheme = (scheme: ColorScheme | "auto") => {
    if (scheme === "auto") {
      localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("theme", scheme);
      document.documentElement.setAttribute("data-theme", scheme);
    }
  };
  
  return { scheme: getScheme(), setScheme };
};

/* -------------------------------------------------------------------------- */
/* Public Design System Export                                                */
/* -------------------------------------------------------------------------- */

export const design = {
  // Core tokens
  primitives,
  semantic,
  gradients,
  typography,
  spacing,
  radii,
  shadows,
  z,
  breakpoints,
  grid,
  motion,
  
  // Component tokens
  components,
  audio,
  charts,
  a11y,
  
  // Utilities
  utils: { 
    rgba, 
    hsl,
    mix,
    fluid,
    clampPx, 
    mq,
    hexToRgb,
  },
  
  // Theme management
  makePalette,
  toCssVars,
  css: { 
    light: cssVarsLight, 
    dark: cssVarsDark, 
    auto: cssVarsAuto,
    reducedMotion: cssReducedMotion,
    highContrast: cssHighContrast,
    get: getDesignCss,
  },
  
  // Framework integrations
  tailwindPreset,
  useTheme,
} as const;

export type Design = typeof design;
export type { Mode, ColorScheme, SpacingToken, RadiusToken, BreakpointToken, SemanticColorToken };