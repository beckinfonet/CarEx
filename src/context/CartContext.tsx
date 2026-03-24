import React, { createContext, useState, useContext, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface CartCarInfo {
  id: string;
  makeName: string;
  modelName: string;
  year: number;
  price: number;
  currency: string;
  imageUrl: string;
  listingId: string;
}

export interface CartServiceItem {
  name: string;
  description: string;
  fee: string | number;
  currency: string;
}

export interface CartProviderInfo {
  id: string;
  ownerUid: string;
  companyName: string;
  phoneNumber?: string;
  telegramUsername?: string;
  type: 'broker' | 'logistics';
}

export interface CartItem {
  provider: CartProviderInfo;
  service: CartServiceItem;
}

interface CartContextType {
  car: CartCarInfo | null;
  items: CartItem[];
  setCar: (car: CartCarInfo | null) => void;
  addItem: (provider: CartProviderInfo, service: CartServiceItem) => void;
  removeItem: (providerOwnerUid: string, providerType: string, serviceName: string) => void;
  clearProviderItems: (providerOwnerUid: string, providerType: string) => void;
  clearCart: () => void;
  isInCart: (providerOwnerUid: string, providerType: string, serviceName: string) => boolean;
  itemCount: number;
  getProviderGroups: () => { provider: CartProviderInfo; services: CartServiceItem[]; subtotal: number; currency: string }[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const prevUidRef = useRef<string | null>(null);
  const [car, setCar] = useState<CartCarInfo | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const currentUid = user?.localId || null;
    if (prevUidRef.current !== null && prevUidRef.current !== currentUid) {
      setItems([]);
      setCar(null);
    }
    prevUidRef.current = currentUid;
  }, [user?.localId]);

  const addItem = useCallback((provider: CartProviderInfo, service: CartServiceItem) => {
    setItems(prev => {
      const exists = prev.some(
        i => i.provider.ownerUid === provider.ownerUid && i.provider.type === provider.type && i.service.name === service.name,
      );
      if (exists) return prev;
      return [...prev, { provider, service }];
    });
  }, []);

  const removeItem = useCallback((providerOwnerUid: string, providerType: string, serviceName: string) => {
    setItems(prev =>
      prev.filter(
        i => !(i.provider.ownerUid === providerOwnerUid && i.provider.type === providerType && i.service.name === serviceName),
      ),
    );
  }, []);

  const clearProviderItems = useCallback((providerOwnerUid: string, providerType: string) => {
    setItems(prev =>
      prev.filter(i => !(i.provider.ownerUid === providerOwnerUid && i.provider.type === providerType)),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCar(null);
  }, []);

  const isInCart = useCallback(
    (providerOwnerUid: string, providerType: string, serviceName: string) =>
      items.some(i => i.provider.ownerUid === providerOwnerUid && i.provider.type === providerType && i.service.name === serviceName),
    [items],
  );

  const getProviderGroups = useCallback(() => {
    const map: Record<string, { provider: CartProviderInfo; services: CartServiceItem[]; subtotal: number; currency: string }> = {};
    for (const item of items) {
      const key = `${item.provider.ownerUid}_${item.provider.type}`;
      if (!map[key]) {
        map[key] = { provider: item.provider, services: [], subtotal: 0, currency: '$' };
      }
      map[key].services.push(item.service);
      const fee = parseFloat(String(item.service.fee));
      if (!isNaN(fee)) {
        map[key].subtotal += fee;
        if (item.service.currency) map[key].currency = item.service.currency;
      }
    }
    return Object.values(map);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        car,
        items,
        setCar,
        addItem,
        removeItem,
        clearProviderItems,
        clearCart,
        isInCart,
        itemCount: items.length,
        getProviderGroups,
      }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
