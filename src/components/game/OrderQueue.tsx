'use client';

import type { Order, Ingredient } from '@/types';
import OrderCard from './OrderCard';

interface OrderQueueProps {
  orders: Order[];
  currentBurger: Ingredient[];
}

const VISIBLE = 3;

export default function OrderQueue({ orders, currentBurger }: OrderQueueProps) {
  const visible = orders.slice(0, VISIBLE);
  const hidden = orders.length - VISIBLE;

  return (
    <div className="ingame__queue">
      <p className="ingame__queue-label">ORDERS</p>
      <div className="order-queue">
        {visible.map((order, idx) => (
          <OrderCard
            key={order.id}
            order={order}
            submittedCount={idx === 0 ? currentBurger.length : 0}
            isFirst={idx === 0}
          />
        ))}
        {hidden > 0 && (
          <div className="order-queue__badge">+{hidden}</div>
        )}
      </div>
    </div>
  );
}
