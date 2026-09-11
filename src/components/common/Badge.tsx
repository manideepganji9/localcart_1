import React from 'react';
import { OrderStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]',
    md: 'px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] font-medium',
    lg: 'px-3 py-1 text-xs uppercase tracking-[0.22em] font-medium',
  };

  const variantClasses = {
    default: 'bg-[#181818] text-[#A0A0A0] border border-[#FFFFFF15]',
    primary: 'bg-[#E5C392]/10 text-[#E5C392] border border-[#E5C392]/30',
    gold: 'bg-[#D4AF37]/15 text-[#F5DEB3] border border-[#D4AF37]/40',
    success: 'bg-[#102A18] text-[#86EFAC] border border-[#1E4D2B]',
    warning: 'bg-[#2A1F0D] text-[#FDE047] border border-[#523E15]',
    danger: 'bg-[#2E1010] text-[#FCA5A5] border border-[#571B1B]',
    info: 'bg-[#0E2238] text-[#93C5FD] border border-[#1A3D63]',
    purple: 'bg-[#241233] text-[#D8B4FE] border border-[#482367]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono transition-colors ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  switch (status) {
    case 'CONFIRMED':
      return (
        <Badge variant="gold" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5C392]"></span>
          Confirmed
        </Badge>
      );
    case 'PENDING_SELLER_APPROVAL':
      return (
        <Badge variant="warning" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FDE047] animate-pulse"></span>
          Confirmed
        </Badge>
      );
    case 'ACCEPTED':
      return (
        <Badge variant="gold" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5C392]"></span>
          Confirmed (Locked)
        </Badge>
      );
    case 'PREPARING':
      return (
        <Badge variant="purple" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D8B4FE]"></span>
          Preparing
        </Badge>
      );
    case 'READY':
    case 'READY_FOR_DELIVERY':
      return (
        <Badge variant="primary" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5C392]"></span>
          Ready for Dispatch
        </Badge>
      );
    case 'OUT_FOR_DELIVERY':
      return (
        <Badge variant="info" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#93C5FD] animate-bounce"></span>
          En Route
        </Badge>
      );
    case 'DELIVERED':
      return (
        <Badge variant="success" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#86EFAC]"></span>
          Delivered
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="danger" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FCA5A5]"></span>
          Declined
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge variant="default" size="md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#666]"></span>
          Cancelled
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};
