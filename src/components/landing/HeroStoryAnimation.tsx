import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Store,
  Search,
  Check,
  Bell,
  Package,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface HeroStoryAnimationProps {
  onStartShopping?: () => void;
  onStartSelling?: () => void;
  currentCity?: string;
  className?: string;
}

export const HeroStoryAnimation: React.FC<HeroStoryAnimationProps> = ({
  onStartShopping,
  onStartSelling,
  currentCity = 'Your Neighborhood',
  className = '',
}) => {
  // Total animation loop duration: 11.5 seconds (11500 ms)
  const LOOP_DURATION = 11500;

  const [time, setTime] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const isVisibleRef = useRef<boolean>(true);

  // Check for prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Pause animation when scrolled off-screen
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

  // Continuous animation loop
  useEffect(() => {
    if (isReducedMotion) {
      setTime(5500); // Fixed representative state for reduced-motion
      return;
    }

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (isVisibleRef.current) {
        setTime(prev => (prev + delta) % LOOP_DURATION);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReducedMotion]);

  // Subtle mouse parallax handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  // =========================================================================
  // ANIMATION STATE DERIVATIONS ACROSS 11.5s TIMELINE
  // =========================================================================

  // 1. Seller Entrance (0ms - 1000ms)
  const sellerOpacity = Math.min(1, Math.max(0, time / 900));
  const sellerTranslateX = Math.max(0, 24 - (time / 900) * 24);

  // 2. Buyer Entrance (1200ms - 2200ms)
  const buyerOpacity = time < 1200 ? 0 : Math.min(1, (time - 1200) / 900);
  const buyerTranslateX = time < 1200 ? 24 : Math.max(0, 24 - ((time - 1200) / 900) * 24);

  // 3. Search query typing simulation: "c-a-k-e" (1600ms - 2800ms)
  const getSearchText = () => {
    if (time < 1600) return '';
    if (time < 1900) return 'c';
    if (time < 2200) return 'ca';
    if (time < 2500) return 'cak';
    if (time < 10400) return 'cake';
    return '';
  };
  const searchText = getSearchText();
  const isSearchActive = time >= 2400 && time < 10400;

  // 4. Highlight on Seller Product & Search Result in Buyer (2600ms+)
  const isCakeHighlighted = time >= 2600 && time < 10600;

  // 5. Connection Line Drawing (2800ms - 4200ms)
  // Connection line progress: 0 to 1
  const connectionProgress =
    time < 2800
      ? 0
      : time < 4200
      ? (time - 2800) / 1400
      : time < 10600
      ? 1
      : Math.max(0, 1 - (time - 10600) / 800);

  // Central LocalCart Node pulse/active when line passes through (~3500ms to 10600ms)
  const isCenterActive = time >= 3400 && time < 10400;
  const centerPulseScale =
    time >= 3400 && time < 4200
      ? 1 + 0.12 * Math.sin(((time - 3400) / 800) * Math.PI)
      : isCenterActive
      ? 1
      : 0.96;

  // 6. Flying Product Card (4200ms - 6200ms)
  // Travels from Seller (0%) to Buyer (100%)
  const isProductFlying = time >= 4200 && time < 6200;
  const productFlightProgress = isProductFlying ? (time - 4200) / 2000 : 0;
  // Smooth easing function for flight
  const flightEase = Math.sin((productFlightProgress * Math.PI) / 2);

  // 7. Product Received & Added to Cart in Buyer (6000ms - 7400ms)
  const isProductInBuyer = time >= 6000 && time < 10600;
  const isAddingToCart = time >= 6200 && time < 7200;
  const cartCount = time >= 6800 && time < 10600 ? 1 : 0;

  // 8. Order Placed Signal sent back (7200ms - 8400ms)
  const isOrderPlaced = time >= 7200 && time < 10600;
  const isSignalReturning = time >= 7300 && time < 8500;
  const returnSignalProgress = isSignalReturning ? (time - 7300) / 1200 : 0;

  // 9. Seller Receives Order & Updates Stock (7800ms+)
  const sellerHasNewOrder = time >= 7900 && time < 10600;
  const cakeStock = time >= 8000 && time < 10600 ? 3 : 4;
  const sellerOrderCount = time >= 8000 && time < 10600 ? 4 : 3;

  // 10. Seller Prepares Order (8600ms - 10200ms)
  // "New Order" -> "Preparing" -> "Ready"
  const getOrderStatus = () => {
    if (time < 7900) return null;
    if (time < 8800) return 'NEW';
    if (time < 9800) return 'PREPARING';
    if (time < 10600) return 'READY';
    return null;
  };
  const orderStatus = getOrderStatus();

  // Subtle end glow harmony before looping (10000ms - 11000ms)
  const isHarmonized = time >= 9800 && time < 10600;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full rounded-2xl sm:rounded-3xl border border-stone-200/90 bg-white shadow-sm overflow-hidden select-none ${className}`}
    >
      {/* Background Architectural Canvas Grid & Soft Light Ambient */}
      <div className="absolute inset-0 pointer-events-none opacity-35 bg-[radial-gradient(#d4cdbe_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-emerald-100/30 blur-3xl pointer-events-none" />

      {/* Main Living Motion Scene */}
      <div className="relative z-10 p-4 sm:p-7 lg:p-8">
        
        {/* Desktop / Tablet Layout: Horizontal Composition */}
        <div className="relative min-h-[460px] sm:min-h-[440px] flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
          
          {/* ========================================================= */}
          {/* LEFT: REALISTIC SELLER / STORE INTERFACE                  */}
          {/* ========================================================= */}
          <div
            className="w-full lg:w-[41%] flex flex-col transition-all duration-500 ease-out"
            style={{
              opacity: sellerOpacity,
              transform: `translate3d(${-sellerTranslateX - mousePos.x * 6}px, ${-mousePos.y * 4}px, 0)`,
            }}
          >
            {/* Small UI Header Label */}
            <div className="flex items-center justify-between mb-2.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-stone-500">
                  Seller Storefront & Inventory
                </span>
              </div>
              <span className="text-[10px] font-medium text-stone-400">Live Management</span>
            </div>

            {/* Seller Interface Card (Clean modern SaaS UI) */}
            <div className="relative rounded-2xl bg-white border border-stone-200 shadow-sm p-4 sm:p-5 space-y-4">
              
              {/* Store Identity Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
                        The Neighborhood Store
                      </h4>
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Verified
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-stone-400" />
                      <span>{currentCity} · 1.1 km away</span>
                    </p>
                  </div>
                </div>

                {/* Seller Live Metrics Pill */}
                <div className="text-right">
                  <span className="text-[10px] text-stone-400 block font-medium">Today's Orders</span>
                  <span className="text-xs sm:text-sm font-extrabold text-stone-800 transition-all">
                    {sellerOrderCount}
                  </span>
                </div>
              </div>

              {/* Realistic Product Inventory List across multiple categories */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
                  <span>Store Products (14 items)</span>
                  <span>Stock</span>
                </div>

                {/* Product 1: Belgian Truffle Cake (The Featured Active Item) */}
                <div
                  className={`relative p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                    isCakeHighlighted
                      ? 'bg-amber-50/70 border-amber-300 shadow-xs ring-2 ring-amber-400/20'
                      : 'bg-stone-50/60 border-stone-200/80 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-base shadow-2xs">
                      🎂
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-900">
                          Dark Belgian Truffle Cake
                        </span>
                        {isCakeHighlighted && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 animate-pulse">
                            Selected
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-amber-700">₹480</span>
                    </div>
                  </div>

                  {/* Stock count with animated decrement */}
                  <div className="text-right">
                    <span
                      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                        cakeStock === 3
                          ? 'bg-amber-100 text-amber-900 font-bold scale-105'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {cakeStock} in stock
                    </span>
                  </div>
                </div>

                {/* Product 2: Handcrafted Silver Band (Jewellery category) */}
                <div className="p-2 rounded-xl border border-stone-200/70 bg-stone-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-sm">
                      💍
                    </div>
                    <div>
                      <div className="text-xs font-medium text-stone-800">
                        Handcrafted Silver Band
                      </div>
                      <span className="text-[10px] text-stone-500">₹890 · Jewellery</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-500 px-2 py-0.5 bg-stone-100 rounded">
                    6 in stock
                  </span>
                </div>

                {/* Product 3: Linen Overshirt (Clothing category) */}
                <div className="p-2 rounded-xl border border-stone-200/70 bg-stone-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sm">
                      👔
                    </div>
                    <div>
                      <div className="text-xs font-medium text-stone-800">
                        Linen Overshirt
                      </div>
                      <span className="text-[10px] text-stone-500">₹750 · Apparel</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-500 px-2 py-0.5 bg-stone-100 rounded">
                    12 in stock
                  </span>
                </div>

                {/* Product 4: Hand-bound Leather Journal (Stationery category) */}
                <div className="p-2 rounded-xl border border-stone-200/70 bg-stone-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-sm">
                      📓
                    </div>
                    <div>
                      <div className="text-xs font-medium text-stone-800">
                        Hand-bound Leather Journal
                      </div>
                      <span className="text-[10px] text-stone-500">₹340 · Stationery</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-500 px-2 py-0.5 bg-stone-100 rounded">
                    8 in stock
                  </span>
                </div>
              </div>

              {/* Dynamic Order Status Alert inside Seller UI */}
              <div className="pt-2 border-t border-stone-100 min-h-[38px] flex items-center">
                {orderStatus === null ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                    <Clock className="w-3.5 h-3.5 text-stone-300" />
                    <span>Store active · Ready to receive local orders</span>
                  </div>
                ) : orderStatus === 'NEW' ? (
                  <div className="w-full p-2 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-950 font-bold flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                      <span>New Order #1042: Truffle Cake</span>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-700">₹480</span>
                  </div>
                ) : orderStatus === 'PREPARING' ? (
                  <div className="w-full p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-bold flex items-center gap-2 animate-fadeIn">
                    <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Preparing Order #1042 for dispatch...</span>
                  </div>
                ) : (
                  <div className="w-full p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-950 font-bold flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Order #1042 Prepared & Ready!</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CENTER: LOCALCART CONNECTION NEXUS & FLYING OBJECTS       */}
          {/* ========================================================= */}
          <div className="w-full lg:w-[18%] flex flex-col items-center justify-center relative min-h-[140px] lg:min-h-[380px] my-2 lg:my-0">
            
            {/* SVG Dynamic Digital Connection Line */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible hidden lg:block"
              viewBox="0 0 200 380"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="connGradient" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#D97706" />
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
                <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background trace line */}
              <path
                d="M -30 190 Q 100 160 230 190"
                fill="none"
                stroke="#E7E5E4"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Active Animated Glowing Connection Path */}
              {connectionProgress > 0 && (
                <path
                  d="M -30 190 Q 100 160 230 190"
                  fill="none"
                  stroke="url(#connGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="280"
                  strokeDashoffset={280 * (1 - connectionProgress)}
                  filter="url(#softGlow)"
                  className="transition-all duration-100 ease-out"
                />
              )}

              {/* Forward Light Particle travelling SELLER -> LOCALCART -> BUYER */}
              {connectionProgress > 0.05 && connectionProgress < 0.95 && (
                <circle
                  r="5"
                  fill="#FFFFFF"
                  stroke="#D97706"
                  strokeWidth="2.5"
                  filter="url(#softGlow)"
                >
                  <animateMotion
                    path="M -30 190 Q 100 160 230 190"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Return Signal: BUYER -> LOCALCART -> SELLER when order is placed */}
              {isSignalReturning && (
                <circle
                  r="4.5"
                  fill="#10B981"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                >
                  <animateMotion
                    path="M 230 190 Q 100 220 -30 190"
                    dur="1.2s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </circle>
              )}
            </svg>

            {/* Mobile Vertical Dynamic Connection Path (lg:hidden) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible lg:hidden"
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
            >
              {/* Background trace line */}
              <line
                x1="50"
                y1="-20"
                x2="50"
                y2="160"
                stroke="#E7E5E4"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              {connectionProgress > 0 && (
                <line
                  x1="50"
                  y1="-20"
                  x2="50"
                  y2={-20 + 180 * connectionProgress}
                  stroke="#D97706"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              )}
              {connectionProgress > 0.1 && connectionProgress < 0.95 && (
                <circle r="4" fill="#FFFFFF" stroke="#D97706" strokeWidth="2">
                  <animateMotion
                    path="M 50 -20 L 50 160"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </svg>

            {/* Central LocalCart Nexus Node */}
            <div
              className="relative z-20 flex flex-col items-center transition-transform duration-300"
              style={{
                transform: `scale(${centerPulseScale}) translate3d(${mousePos.x * 4}px, ${mousePos.y * 3}px, 0)`,
              }}
            >
              {/* Outer Pulse Rings when connected */}
              {isCenterActive && (
                <div className="absolute -inset-3 rounded-full bg-amber-400/20 animate-ping pointer-events-none" />
              )}
              {isHarmonized && (
                <div className="absolute -inset-5 rounded-full bg-emerald-400/20 animate-pulse pointer-events-none" />
              )}

              {/* Brand Nexus Disc */}
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border flex flex-col items-center justify-center transition-all duration-500 shadow-md ${
                  isCenterActive
                    ? 'border-amber-400 ring-4 ring-amber-100 shadow-amber-200/50'
                    : 'border-stone-200 shadow-stone-100'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-extrabold text-xs shadow-xs">
                  LC
                </div>
                <span className="text-[9px] font-bold text-stone-800 tracking-tight mt-1">
                  LocalCart
                </span>
              </div>

              {/* Subtle status tag */}
              <div className="mt-2.5 px-2.5 py-0.5 rounded-full bg-stone-100/90 border border-stone-200/80 text-[9px] font-bold text-stone-600 tracking-wide">
                {isHarmonized
                  ? 'Connected ✓'
                  : isCenterActive
                  ? 'Direct Link'
                  : 'Discovery'}
              </div>
            </div>

            {/* ======================================================= */}
            {/* THE PHYSICAL FLYING PRODUCT CARD TRANSITION              */}
            {/* ======================================================= */}
            {isProductFlying && (
              <>
                {/* Desktop horizontal flight */}
                <div
                  className="absolute z-30 pointer-events-none hidden lg:block"
                  style={{
                    left: `${(flightEase - 0.5) * 220}%`,
                    top: `${45 - Math.sin(flightEase * Math.PI) * 28}%`,
                    transform: `scale(${1 + Math.sin(flightEase * Math.PI) * 0.15}) rotate(${
                      (flightEase - 0.5) * 12
                    }deg)`,
                    transition: 'none',
                  }}
                >
                  <div className="p-2.5 rounded-xl bg-white border border-amber-300 shadow-xl flex items-center gap-2.5 ring-2 ring-amber-400/30">
                    <span className="text-xl">🎂</span>
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-stone-900 leading-tight">
                        Belgian Truffle Cake
                      </div>
                      <div className="text-[9px] font-extrabold text-amber-700">₹480</div>
                    </div>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  </div>
                </div>

                {/* Mobile vertical flight */}
                <div
                  className="absolute z-30 pointer-events-none lg:hidden"
                  style={{
                    left: '50%',
                    top: `${(flightEase - 0.5) * 160 + 50}%`,
                    transform: 'translate(-50%, -50%) scale(1.05)',
                    transition: 'none',
                  }}
                >
                  <div className="p-2 rounded-xl bg-white border border-amber-300 shadow-lg flex items-center gap-2 ring-2 ring-amber-400/30">
                    <span className="text-lg">🎂</span>
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-stone-900 leading-tight">
                        Truffle Cake
                      </div>
                      <div className="text-[9px] font-bold text-amber-700">₹480</div>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* ========================================================= */}
          {/* RIGHT: REALISTIC BUYER INTERFACE                         */}
          {/* ========================================================= */}
          <div
            className="w-full lg:w-[41%] flex flex-col transition-all duration-500 ease-out"
            style={{
              opacity: buyerOpacity,
              transform: `translate3d(${buyerTranslateX + mousePos.x * 6}px, ${mousePos.y * 4}px, 0)`,
            }}
          >
            {/* Small UI Header Label */}
            <div className="flex items-center justify-between mb-2.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-stone-500">
                  Buyer Neighborhood Explorer
                </span>
              </div>
              <span className="text-[10px] font-medium text-stone-400">Direct Purchase</span>
            </div>

            {/* Buyer Interface Card (Clean modern SaaS UI) */}
            <div className="relative rounded-2xl bg-white border border-stone-200 shadow-sm p-4 sm:p-5 space-y-4">
              
              {/* Buyer Search & Cart Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100">
                
                {/* Search Input Simulation */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <div className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200/90 rounded-xl text-xs font-medium text-stone-800 flex items-center h-8">
                    {searchText || (
                      <span className="text-stone-400">Search cakes, jewellery, shirts...</span>
                    )}
                    {time >= 1600 && time < 2800 && (
                      <span className="w-1.5 h-3.5 bg-amber-600 ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Buyer Cart Icon with Dynamic Badge */}
                <div
                  className={`relative p-2 rounded-xl border transition-all duration-300 flex items-center justify-center ${
                    isAddingToCart
                      ? 'bg-amber-100 border-amber-300 scale-110 shadow-xs'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-stone-700" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs animate-scaleIn">
                      {cartCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px] font-medium">
                <span className={`px-2.5 py-1 rounded-lg border transition ${
                  isSearchActive
                    ? 'bg-amber-600 border-amber-700 text-white font-bold'
                    : 'bg-stone-100 border-stone-200 text-stone-700'
                }`}>
                  Bakery & Cakes
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-500">
                  Jewellery
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-500">
                  Fashion
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-500">
                  Stationery
                </span>
              </div>

              {/* Dynamic Product Result Discovery */}
              <div className="space-y-2 min-h-[168px] flex flex-col justify-center">
                {isSearchActive ? (
                  /* Found product from nearby seller! */
                  <div
                    className={`p-3 rounded-xl border transition-all duration-500 ${
                      isProductInBuyer
                        ? 'bg-amber-50/60 border-amber-300 shadow-sm'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-lg shrink-0">
                          🎂
                        </div>
                        <div>
                          <div className="text-xs font-bold text-stone-900 leading-tight">
                            Dark Belgian Truffle Cake
                          </div>
                          <div className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <span>The Neighborhood Store</span>
                            <span className="text-amber-700 font-semibold">· 1.1 km</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-extrabold text-stone-900">
                        ₹480
                      </span>
                    </div>

                    {/* Action button inside buyer card */}
                    <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-emerald-700 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Freshly baked today</span>
                      </span>

                      <button
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-300 ${
                          cartCount > 0
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : isAddingToCart
                            ? 'bg-amber-700 text-white scale-95'
                            : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                        }`}
                      >
                        {cartCount > 0 ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added to Bag</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Searching indicator */
                  <div className="p-6 rounded-xl border border-dashed border-stone-200 flex flex-col items-center justify-center text-center text-stone-400 space-y-1">
                    <Search className="w-5 h-5 text-stone-300 animate-pulse" />
                    <span className="text-xs font-medium text-stone-500">
                      Explore nearby sellers in {currentCity}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      Zero middleman markup · Direct creator support
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Order Confirmation / Dispatch Status */}
              <div className="pt-2 border-t border-stone-100 min-h-[38px] flex items-center">
                {isOrderPlaced ? (
                  <div className="w-full p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 font-bold flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Order #1042 Paid direct via UPI</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700">
                      {orderStatus === 'READY' ? 'Ready for Pickup' : 'Seller Preparing'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-stone-400" />
                      <span>Direct neighborhood pickup or delivery</span>
                    </span>
                    <span className="font-semibold text-stone-500">₹0 Fee</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Subtle Bottom Bar: Visual narrative reminder without timeline/phase labels */}
      <div className="px-6 py-3 bg-stone-50/80 border-t border-stone-200/70 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
            ⚡
          </span>
          <span className="font-medium">
            Direct local connection: Sellers list products, nearby buyers discover & order instantly.
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={onStartShopping}
            className="text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Shop Near You</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <span className="text-stone-300">|</span>
          <button
            onClick={onStartSelling}
            className="text-stone-700 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
          >
            <span>List Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
