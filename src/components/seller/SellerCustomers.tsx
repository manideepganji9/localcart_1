import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Users, Search, Phone, MapPin, Calendar, ShoppingBag, ArrowUpRight } from 'lucide-react';

export const SellerCustomers: React.FC = () => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, orders } = useStore();
  const [search, setSearch] = useState('');

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;
  const sellerOrders = seller ? orders.filter(o => o.sellerId === seller.id && o.status !== 'REJECTED' && o.status !== 'CANCELLED') : [];

  // Group orders by buyer
  const customerMap: {
    [buyerId: string]: {
      id: string;
      name: string;
      phone: string;
      area: string;
      city: string;
      orderCount: number;
      totalSpent: number;
      lastOrderDate: string;
    };
  } = {};

  sellerOrders.forEach(o => {
    if (!customerMap[o.buyerId]) {
      customerMap[o.buyerId] = {
        id: o.buyerId,
        name: o.buyerName,
        phone: o.buyerPhone,
        area: o.buyerLocation.area,
        city: o.buyerLocation.city,
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: o.createdAt
      };
    }
    customerMap[o.buyerId].orderCount += 1;
    customerMap[o.buyerId].totalSpent += o.total;
    if (new Date(o.createdAt) > new Date(customerMap[o.buyerId].lastOrderDate)) {
      customerMap[o.buyerId].lastOrderDate = o.createdAt;
    }
  });

  const customersList = Object.values(customerMap).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.area.toLowerCase().includes(search.toLowerCase())
  );

  const repeatCustomersCount = customersList.filter(c => c.orderCount > 1).length;

  return (
    <div className="space-y-8 text-[#F5F5F5]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FFFFFF12] pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#E5C392] font-mono">Customer Directory</span>
          <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
            Customers
          </h1>
          <p className="text-xs text-[#8E8E8E] mt-1 font-light">
            Verified local customers who have ordered from {seller?.businessName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-[#141414] border border-[#FFFFFF15] text-xs flex items-center gap-2 font-mono">
            <span className="text-[#888]">Repeat Customers:</span>
            <span className="text-[#86EFAC] font-bold">{repeatCustomersCount}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#121212] p-3 border border-[#FFFFFF15]">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#666]" />
          <input
            type="text"
            placeholder="Search by customer name or area..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#181818] border border-[#FFFFFF12] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#E5C392]"
          />
        </div>
      </div>

      {/* Customers Table / Grid */}
      {customersList.length === 0 ? (
        <div className="p-16 text-center bg-[#121212] border border-[#FFFFFF18]">
          <Users className="h-10 w-10 text-[#444] mx-auto mb-3" />
          <h3 className="font-serif text-lg text-white">No Customers Recorded</h3>
          <p className="text-xs text-[#808080] mt-1 font-light">
            {search ? 'No customer matches your search filter.' : 'Customers who place orders in your store will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {customersList.map(c => (
            <div
              key={c.id}
              className="bg-[#141414] border border-[#FFFFFF15] p-5 space-y-3 hover:border-[#E5C392]/50 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-base text-white">{c.name}</h3>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-[#808080] mt-0.5">
                    <MapPin className="h-2.5 w-2.5 text-[#E5C392]" />
                    <span>{c.area}, {c.city}</span>
                  </div>
                </div>

                {c.orderCount > 1 && (
                  <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-[#102816] text-[#86EFAC] border border-[#1E4D2B]">
                    ★ Repeat
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-[#FFFFFF0A] grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[9px] text-[#777] block uppercase tracking-wider">Total Orders</span>
                  <span className="font-serif text-sm text-white">{c.orderCount} order{c.orderCount > 1 ? 's' : ''}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#777] block uppercase tracking-wider">Total Spent</span>
                  <span className="font-serif text-sm text-[#E5C392]">₹{c.totalSpent.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#FFFFFF0A] flex items-center justify-between text-[10px] font-mono text-[#888]">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-[#E5C392]" />
                  {c.phone}
                </span>
                <span>Last: {new Date(c.lastOrderDate).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
