import React from 'react';
import { render, act } from '@testing-library/react-native';

const readCtx = { current: null };

const CartProbe = ({ useCart }) => {
  readCtx.current = useCart();
  return null;
};

describe('CartContext', () => {
  beforeEach(() => {
    readCtx.current = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it('adds item and computes totals', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 10 },
        2
      );
    });

    expect(readCtx.current.cartItems).toHaveLength(1);
    expect(readCtx.current.getItemCount()).toBe(2);
    expect(readCtx.current.getCartTotal()).toBe(100);
    expect(readCtx.current.getItemQuantity('p-1')).toBe(2);
    expect(readCtx.current.isInCart('p-1')).toBe(true);
  });

  it('merges quantity when adding same item again', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 10 },
        1
      );
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 10 },
        2
      );
    });

    expect(readCtx.current.cartItems).toHaveLength(1);
    expect(readCtx.current.getItemQuantity('p-1')).toBe(3);
    expect(readCtx.current.getCartTotal()).toBe(150);
  });

  it('rejects invalid quantities and stock overflow', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 2 },
        0
      );
    });
    expect(readCtx.current.cartItems).toHaveLength(0);

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 2 },
        3
      );
    });
    expect(readCtx.current.cartItems).toHaveLength(0);

    expect(console.warn).toHaveBeenCalled();
  });

  it('updates quantity and removes item when quantity is set to zero', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 10 },
        2
      );
    });

    act(() => {
      readCtx.current.updateQuantity('p-1', 5);
    });

    expect(readCtx.current.getItemQuantity('p-1')).toBe(5);
    expect(readCtx.current.getCartTotal()).toBe(250);

    act(() => {
      readCtx.current.updateQuantity('p-1', 0);
    });

    expect(readCtx.current.cartItems).toHaveLength(0);
  });

  it('clears cart and updates summary', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 10 },
        2
      );
      readCtx.current.addToCart(
        { id: 'p-2', name: 'Gasoline', current_price: 60, stock_quantity: 10 },
        1
      );
    });

    expect(readCtx.current.cartSummary.totalItems).toBe(2);
    expect(readCtx.current.cartSummary.totalQuantity).toBe(3);
    expect(readCtx.current.cartSummary.subtotal).toBe(160);

    act(() => {
      readCtx.current.clearCart();
    });

    expect(readCtx.current.cartItems).toHaveLength(0);
    expect(readCtx.current.getCartTotal()).toBe(0);
    expect(readCtx.current.getItemCount()).toBe(0);
  });

  it('prevents merged add when resulting quantity exceeds stock', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 3 },
        2
      );
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 3 },
        2
      );
    });

    expect(readCtx.current.getItemQuantity('p-1')).toBe(2);
    expect(console.warn).toHaveBeenCalledWith('Cannot add more than available stock');
  });

  it('does not set quantity above stock in updateQuantity', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 4 },
        2
      );
    });

    act(() => {
      readCtx.current.updateQuantity('p-1', 5);
    });

    expect(readCtx.current.getItemQuantity('p-1')).toBe(2);
    expect(console.warn).toHaveBeenCalledWith('Cannot set quantity above available stock');
  });

  it('removes item via removeFromCart and returns defaults for missing product', () => {
    const { CartProvider, useCart } = require('../../context/CartContext');

    render(
      <CartProvider>
        <CartProbe useCart={useCart} />
      </CartProvider>
    );

    act(() => {
      readCtx.current.addToCart(
        { id: 'p-1', name: 'Diesel', current_price: 50, stock_quantity: 10 },
        1
      );
    });

    expect(readCtx.current.isInCart('missing')).toBe(false);
    expect(readCtx.current.getItemQuantity('missing')).toBe(0);

    act(() => {
      readCtx.current.removeFromCart('p-1');
    });

    expect(readCtx.current.cartItems).toHaveLength(0);
  });
});

describe('useCart', () => {
  it('throws when used outside CartProvider', () => {
    const { useCart } = require('../../context/CartContext');

    const BadProbe = () => {
      useCart();
      return null;
    };

    expect(() => render(<BadProbe />)).toThrow('useCart must be used within a CartProvider');
  });
});