import React, { useEffect, useRef, useState } from 'react';
import { Store, ShoppingBag, MapPin, ArrowRight, ShieldCheck, CheckCircle2, Navigation } from 'lucide-react';

interface CinematicBridgeStoryProps {
  onStartShopping: () => void;
  onStartSelling: () => void;
  currentCity?: string;
}

export const CinematicBridgeStory: React.FC<CinematicBridgeStoryProps> = ({
  onStartShopping,
  onStartSelling,
  currentCity = 'Your Neighborhood',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [activeStep, setActiveStep] = useState(0); // 0: Seller, 1: LocalCart Bridge, 2: Buyer
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const isVisibleRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // IntersectionObserver to pause when not visible
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

  // Animation Loop (8 seconds full cycle)
  const CYCLE_DURATION = 8000;
  useEffect(() => {
    if (isReducedMotion) return;

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (isVisibleRef.current) {
        setProgress((prev) => {
          const next = (prev + delta / CYCLE_DURATION) % 1;
          if (next < 0.35) setActiveStep(0);
          else if (next < 0.70) setActiveStep(1);
          else setActiveStep(2);
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReducedMotion]);

  // Handle manual step selection
  const handleSelectStep = (stepIdx: number) => {
    setActiveStep(stepIdx);
    if (stepIdx === 0) setProgress(0.15);
    else if (stepIdx === 1) setProgress(0.5);
    else setProgress(0.85);
  };

  // Product traveling calculation (horizontal percentage from seller to buyer)
  // Progress 0.05 to 0.95 maps to 0% to 100% traversal
  const travelPct = Math.min(100, Math.max(0, ((progress - 0.05) / 0.85) * 100));

  return (
    <section
      id="story-section"
      ref={containerRef}
      className="relative py-20 sm:py-32 bg-[#FAF9F6] text-stone-900 border-b border-stone-200/80 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Headline */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-stone-100 border border-stone-300/80 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            <span>The LocalCart Connection</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 leading-tight">
            Local sellers. Local buyers. One simple connection.
          </h2>

          <p className="text-base sm:text-lg text-stone-600 font-light leading-relaxed">
            A local maker creates something exceptional right in your neighborhood. LocalCart bridges the gap so you discover and enjoy it directly.
          </p>
        </div>

        {/* Step Navigation Pills */}
        <div className="flex justify-center">
          <div className="inline-flex p-1.5 rounded-full bg-stone-200/70 border border-stone-300/60 backdrop-blur-xs gap-1">
            {[
              { label: '1. Local Seller', sub: 'Has great products' },
              { label: '2. LocalCart Bridge', sub: 'Connects nearby' },
              { label: '3. Local Buyer', sub: 'Receives direct' },
            ].map((step, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectStep(idx)}
                className={`px-4 sm:px-6 py-2 rounded-full text-xs font-semibold transition-all duration-300 cursor-pointer ${
                  activeStep === idx
                    ? 'bg-white text-stone-950 shadow-md'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-white/50'
                }`}
              >
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* The Signature Technology Bridge Visualization */}
        <div className="relative rounded-3xl bg-white border border-stone-200 shadow-xl p-6 sm:p-10 lg:p-14 overflow-hidden">
          {/* Subtle architectural grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Desktop Bridge Layout: 3 Columns with Connecting Animated SVG Conduit */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center">
            
            {/* 1. SELLER NODE */}
            <div
              className={`relative rounded-2xl p-6 transition-all duration-500 border ${
                activeStep === 0
                  ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/20 shadow-lg scale-[1.02]'
                  : 'bg-stone-50/60 border-stone-200 opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-semibold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-md">
                  Step 1 · The Seller
                </span>
                <span className="text-xs text-stone-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  {currentCity}
                </span>
              </div>

              {/* Store & Product Preview */}
              <div className="space-y-4">
                <div className="relative h-44 rounded-xl overflow-hidden bg-stone-200">
                  <img
                    src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80"
                    alt="Local Baker"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-[11px] font-mono text-amber-300">Rao's Heritage Bakery</p>
                    <p className="text-sm font-bold truncate">Belgian Dark Truffle Cake</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-stone-600">
                  <p className="font-medium text-stone-900">
                    Handmade daily in small batches with premium ingredients.
                  </p>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-200 font-mono text-stone-500">
                    <span>Stock: 8 units ready</span>
                    <span className="font-bold text-stone-900">₹480</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. LOCALCART BRIDGE NODE */}
            <div
              className={`relative rounded-2xl p-6 transition-all duration-500 border text-center ${
                activeStep === 1
                  ? 'bg-stone-950 text-white border-stone-900 shadow-2xl scale-[1.04]'
                  : 'bg-stone-900 text-white border-stone-800'
              }`}
            >
              {/* Radar Circles Pulse */}
              <div className="relative w-20 h-20 mx-auto my-2 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-amber-400/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-amber-400/50" />
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-lg shadow-lg">
                  LC
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-amber-400 block font-semibold">
                  The Bridge
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Direct Neighborhood Match
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed max-w-xs mx-auto">
                  Instant local routing maps proximity, confirms real inventory, and locks pricing directly.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-2 gap-2 text-left font-mono text-[10px] text-stone-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Zero Markup</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Direct UPI</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>1.2 km Distance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>~20m Delivery</span>
                </div>
              </div>
            </div>

            {/* 3. BUYER NODE */}
            <div
              className={`relative rounded-2xl p-6 transition-all duration-500 border ${
                activeStep === 2
                  ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20 shadow-lg scale-[1.02]'
                  : 'bg-stone-50/60 border-stone-200 opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
                  Step 3 · The Buyer
                </span>
                <span className="text-xs text-stone-500 flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  Your Doorstep
                </span>
              </div>

              {/* Order Receipt and Delivery Confirmation */}
              <div className="space-y-4">
                <div className="relative h-44 rounded-xl overflow-hidden bg-stone-200">
                  <img
                    src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
                    alt="Customer enjoying cake"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-[11px] font-mono text-emerald-300">Order Confirmed</p>
                    <p className="text-sm font-bold truncate">Delivered Fresh & Warm</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-stone-600">
                  <p className="font-medium text-stone-900">
                    Fresh from the oven directly to your table with locked bill confirmation.
                  </p>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-200 font-mono text-emerald-700 font-semibold">
                    <span>Direct Payment Settled</span>
                    <span>100% to Creator</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Desktop Animated Traveling Product Conduit Bar */}
          <div className="hidden lg:block relative mt-10 pt-6 border-t border-stone-200/80">
            <div className="relative w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-stone-900 to-emerald-500 transition-all duration-75 ease-linear"
                style={{ width: `${travelPct}%` }}
              />
            </div>

            {/* Traveling Product Indicator Icon Floating on Track */}
            <div
              className="absolute top-3 transition-all duration-75 ease-linear transform -translate-x-1/2"
              style={{ left: `${travelPct}%` }}
            >
              <div className="flex items-center gap-2 bg-stone-950 text-white px-3 py-1 rounded-full text-[10px] font-mono shadow-xl border border-white/20">
                <ShoppingBag className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="font-semibold whitespace-nowrap">Product Traveling: ₹480</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 mt-5 pt-2">
              <span>LOCAL SELLER</span>
              <span className="text-amber-700 font-bold">LOCALCART PLATFORM</span>
              <span>LOCAL BUYER</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-end gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onStartShopping}
                className="px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition shadow-sm cursor-pointer flex items-center gap-2"
              >
                <span>Find Nearby Sellers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onStartSelling}
                className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-full transition cursor-pointer"
              >
                <span>Open a Store</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
