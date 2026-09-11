import React from 'react';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { Product } from '../../types';

interface CinematicCategorySectionProps {
  products: Product[];
  onSelectCategory: (categoryName: string) => void;
  onExploreAll?: () => void;
}

interface CategoryItem {
  id: string;
  name: string;
  queryCategory: string;
  image: string;
  description: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'bakery',
    name: 'Bakery & Cakes',
    queryCategory: 'Bakery & Desserts',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    description: 'Fresh sourdough, handcrafted celebration cakes & warm pastries',
  },
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    queryCategory: 'Boutique & Fashion',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    description: 'Handloom sarees, kurtas, boutique wear & fabrics',
  },
  {
    id: 'jewellery',
    name: 'Jewellery & Adornments',
    queryCategory: 'Handmade Jewellery',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    description: 'Custom silver crafts, beaded earrings & delicate necklaces',
  },
  {
    id: 'groceries',
    name: 'Groceries & Gourmet',
    queryCategory: 'Organic & Gourmet Snacks',
    image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
    description: 'Cold-pressed oils, spice blends & traditional pickles',
  },
  {
    id: 'home-decor',
    name: 'Home & Decor',
    queryCategory: 'Home Decor & Art',
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
    description: 'Ceramic planters, hand-poured soy candles & wall accents',
  },
  {
    id: 'gifts',
    name: 'Gifts & Keepsakes',
    queryCategory: 'Gifts & Handcrafted Studio',
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80',
    description: 'Curated gift boxes, personalized woodcraft & party hampers',
  },
  {
    id: 'handmade',
    name: 'Handmade Crafts',
    queryCategory: 'Gifts & Handcrafted Studio',
    image: 'https://images.unsplash.com/photo-1608248597359-0a6493c4a20b?auto=format&fit=crop&w=800&q=80',
    description: 'Hand-milled herbal soaps, embroidery & woven stationery',
  },
  {
    id: 'stationery',
    name: 'Stationery & Journals',
    queryCategory: 'Gifts & Handcrafted Studio',
    image: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=800&q=80',
    description: 'Handmade paper journals, fountain pen inks & wax seals',
  },
];

export const CinematicCategorySection: React.FC<CinematicCategorySectionProps> = ({
  products,
  onSelectCategory,
  onExploreAll,
}) => {
  // Count real items in each category
  const getCategoryCount = (queryCategory: string) => {
    return products.filter((p) => p.category === queryCategory || p.category.toLowerCase().includes(queryCategory.toLowerCase())).length;
  };

  return (
    <section className="py-24 sm:py-32 bg-[#FAF9F6] text-stone-900 border-b border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200/90 pb-6">
          <div className="space-y-2 max-w-2xl">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-amber-700 font-semibold block">
              Specialized Departments
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900">
              Explore by Category
            </h2>
            <p className="text-stone-600 text-sm sm:text-base font-light">
              Connect directly with verified independent makers across diverse local disciplines.
            </p>
          </div>

          {onExploreAll && (
            <button
              onClick={onExploreAll}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-800 hover:text-amber-700 transition cursor-pointer"
            >
              <span>View All Categories</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categories Grid (Editorial Visual Tiles) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CATEGORIES.map((cat) => {
            const count = getCategoryCount(cat.queryCategory);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.queryCategory)}
                className="group relative h-80 rounded-2xl overflow-hidden bg-stone-900 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex flex-col justify-end p-6 border border-stone-200/80"
              >
                {/* Large Background Image */}
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                />

                {/* Subtle Cinematic Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />

                {/* Top Count Badge */}
                {count > 0 && (
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-stone-950/70 backdrop-blur-md border border-white/20 text-stone-200 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full">
                      {count} items listed
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="relative z-10 space-y-1.5 text-white">
                  <h3 className="text-lg font-bold tracking-tight group-hover:text-amber-300 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-stone-300 line-clamp-2 font-light leading-relaxed">
                    {cat.description}
                  </p>

                  <div className="pt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-300 group-hover:translate-x-1 transition-transform">
                    <span>Discover Sellers</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
};
