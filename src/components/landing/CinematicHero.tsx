import React, { useEffect, useRef, useState } from 'react';
import {
  ShoppingBag,
  Store,
  ArrowRight,
  ChevronDown,
  MapPin,
} from 'lucide-react';

interface CinematicHeroProps {
  onStartShopping: () => void;
  onStartSelling: () => void;
  currentCity: string;
  currentArea?: string;
}

interface StoryScene {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  accentColor: string;
}

const SCENES: StoryScene[] = [
  {
    id: 1,
    title: 'Local Shopkeeper With Products',
    subtitle: 'Fresh inventory ready in the neighborhood store',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=2400&q=85',
    accentColor: 'from-amber-500/20 to-transparent',
  },
  {
    id: 2,
    title: 'Buyer Searching Nearby',
    subtitle: 'Looking for quality local products in the neighborhood',
    image: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=2400&q=85',
    accentColor: 'from-sky-500/20 to-transparent',
  },
  {
    id: 3,
    title: 'LocalCart Bridges The Gap',
    subtitle: 'Direct technology connection between neighbor & store',
    image: 'https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?auto=format&fit=crop&w=2400&q=85',
    accentColor: 'from-amber-600/25 to-transparent',
  },
  {
    id: 4,
    title: 'Products Become Discoverable',
    subtitle: 'Real-time location motion across bakery, apparel & crafts',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=2400&q=85',
    accentColor: 'from-emerald-500/20 to-transparent',
  },
  {
    id: 5,
    title: 'Direct Purchase & UPI Payment',
    subtitle: 'Buyer selects product with instant 0% commission settlement',
    image: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=2400&q=85',
    accentColor: 'from-emerald-600/25 to-transparent',
  },
  {
    id: 6,
    title: 'Seller & Buyer Connected',
    subtitle: 'Fresh local handover completed right in the neighborhood',
    image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=2400&q=85',
    accentColor: 'from-amber-500/20 to-transparent',
  },
];

export const CinematicHero: React.FC<CinematicHeroProps> = ({
  onStartShopping,
  onStartSelling,
  currentCity,
  currentArea,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const isVisibleRef = useRef<boolean>(true);

  // Total loop: 21,000ms (3.5s per scene across 6 scenes)
  const SCENE_DURATION = 3500;
  const TOTAL_DURATION = SCENE_DURATION * SCENES.length; // 21000ms

  const [time, setTime] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Pause loop when scrolled off-screen for battery/performance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Continuous, seamless animation loop with NO pause between loops
  useEffect(() => {
    if (isReducedMotion) {
      setTime(SCENE_DURATION * 2.5);
      return;
    }

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (isVisibleRef.current) {
        setTime((prev) => (prev + delta) % TOTAL_DURATION);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReducedMotion, TOTAL_DURATION]);

  // Subtle interactive parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  const handleScrollDown = () => {
    const nextSection = document.getElementById('story-section');
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: window.innerHeight * 0.85, behavior: 'smooth' });
    }
  };

  // Derive active scene and crossfade weights safely
  const safeTime = Number.isFinite(time) && time >= 0 ? time : 0;
  const rawIndex = Math.floor(safeTime / SCENE_DURATION) % SCENES.length;
  const currentSceneIndex = Number.isFinite(rawIndex) && rawIndex >= 0 && rawIndex < SCENES.length ? rawIndex : 0;
  const activeScene = SCENES[currentSceneIndex] ?? SCENES[0];
  const nextSceneIndex = (currentSceneIndex + 1) % SCENES.length;
  const timeIntoScene = safeTime % SCENE_DURATION;

  // Crossfade during the last 800ms of each scene
  const FADE_WINDOW = 800;
  const isCrossfading = timeIntoScene > SCENE_DURATION - FADE_WINDOW;
  const fadeProgress = isCrossfading
    ? (timeIntoScene - (SCENE_DURATION - FADE_WINDOW)) / FADE_WINDOW
    : 0;

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full min-h-[94vh] sm:min-h-screen flex flex-col justify-between overflow-hidden bg-stone-950 text-white select-none"
    >
      {/* ========================================================================= */}
      {/* 1. SEAMLESS CINEMATIC 6-SCENE STORY BACKGROUND ENGINE                    */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        {/* Render scene layers with smooth cross-dissolve */}
        {SCENES.map((scene, idx) => {
          let opacity = 0;
          if (idx === currentSceneIndex) {
            opacity = 1 - fadeProgress;
          } else if (idx === nextSceneIndex && isCrossfading) {
            opacity = fadeProgress;
          }

          if (opacity <= 0) return null;

          return (
            <div
              key={scene.id}
              className="absolute inset-0 w-full h-full transition-opacity duration-300"
              style={{ opacity }}
            >
              <img
                src={scene.image}
                alt={scene.title}
                className="w-full h-full object-cover object-center will-change-transform"
                style={{
                  transform: `scale(${1.03 + (timeIntoScene / SCENE_DURATION) * 0.04}) translate3d(${
                    mousePos.x * 6
                  }px, ${mousePos.y * 4}px, 0)`,
                  transition: 'transform 0.2s linear',
                }}
                loading="eager"
              />
            </div>
          );
        })}

        {/* Sophisticated Cinematic Light & Vignette Scrim (Ensures text legibility) */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/55 to-stone-950/35" />
        <div className="absolute inset-0 bg-radial-at-c from-stone-950/20 via-stone-950/50 to-stone-950/80" />

        {/* Dynamic Scene Accent Glow */}
        <div
          className={`absolute inset-0 bg-gradient-to-b ${activeScene?.accentColor || 'from-amber-500/20 to-transparent'} transition-colors duration-1000`}
        />

        {/* Subtle Ambient Star/Particle Dots (Automotive/Editorial luxury feel) */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP LOCATION BAR & AMBIENT INDICATOR                                   */}
      {/* ========================================================================= */}
      <div className="relative z-10 pt-8 sm:pt-12 px-6 sm:px-12 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-stone-900/70 backdrop-blur-md border border-white/15 text-stone-200 text-xs tracking-wider font-medium shadow-md">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <MapPin className="w-3.5 h-3.5 text-amber-300" />
          <span>
            {currentCity} {currentArea ? `· ${currentArea}` : '· Local Marketplace'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CENTER CINEMATIC TYPOGRAPHY & INTERACTIVE CONTROLS                     */}
      {/* ========================================================================= */}
      <div className="relative z-10 px-6 sm:px-12 lg:px-16 max-w-5xl mx-auto w-full text-center space-y-8 my-auto py-12">
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight text-white leading-[1.05] drop-shadow-md font-display">
            LocalCart
          </h1>
          <p className="text-xl sm:text-2xl lg:text-3xl font-light text-stone-200 tracking-wide max-w-2xl mx-auto leading-relaxed drop-shadow-sm">
            Discover what’s around you.
          </p>
        </div>

        {/* Minimalist Dual CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
          <button
            onClick={onStartShopping}
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-stone-100 text-stone-950 font-semibold text-sm rounded-full transition-all duration-200 shadow-2xl flex items-center justify-center gap-2.5 cursor-pointer group active:scale-[0.98]"
          >
            <ShoppingBag className="w-4 h-4 text-stone-900" />
            <span>Start Shopping</span>
            <ArrowRight className="w-4 h-4 text-stone-600 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onStartSelling}
            className="w-full sm:w-auto px-8 py-4 bg-stone-900/70 hover:bg-stone-900/90 text-white border border-white/25 hover:border-white/45 font-medium text-sm rounded-full backdrop-blur-md transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
          >
            <Store className="w-4 h-4 text-amber-300" />
            <span>Start Selling</span>
          </button>
        </div>

        {/* Commercial Trust Signals */}
        <div className="pt-2 text-stone-300 text-xs tracking-wide flex flex-wrap items-center justify-center gap-3 sm:gap-4 font-light drop-shadow-sm">
          <span>Direct payments via UPI</span>
          <span className="text-stone-500">·</span>
          <span>Zero markup</span>
          <span className="text-stone-500">·</span>
          <span>Local neighborhood delivery</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM SCROLL INDICATOR                                                */}
      {/* ========================================================================= */}
      <div className="relative z-10 pb-8 sm:pb-12 px-6 flex justify-center">
        <button
          onClick={handleScrollDown}
          className="group flex flex-col items-center gap-2 text-stone-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Scroll to discover"
        >
          <span className="text-[10px] uppercase tracking-[0.25em] font-mono text-stone-400 group-hover:text-stone-200">
            Explore The Connection
          </span>
          <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/50 transition-colors animate-bounce">
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>
      </div>
    </section>
  );
};
