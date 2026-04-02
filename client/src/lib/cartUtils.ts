/**
 * Shared Cart Utilities
 * Centralized guest cart operations and types
 */

export interface GuestCartItem {
  productId: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  customPrinting?: boolean;
  designNotes?: string;
  designFileUrl?: string;
}

const GUEST_CART_KEY = 'guestCart';
const MAX_GUEST_CART_ITEMS = 50;
const CLEANUP_BATCH_SIZE = 5;

/**
 * Get guest cart from localStorage
 * Safe: returns empty array on error
 */
export function getGuestCart(): GuestCartItem[] {
  try {
    const saved = localStorage.getItem(GUEST_CART_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('❌ Error reading guest cart:', error);
    return [];
  }
}

/**
 * Save guest cart to localStorage
 * Safe: logs errors but doesn't throw
 */
export function setGuestCart(cart: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('❌ Error saving guest cart:', error);
  }
}

/**
 * Add item to guest cart with deduplication
 * - Merges quantities for existing items
 * - Always adds custom printing items as new
 * - Prevents cart bloat with size limit
 */
export function addToGuestCart(item: GuestCartItem): void {
  const cart = getGuestCart();
  
  // Prevent localStorage bloat
  if (cart.length >= MAX_GUEST_CART_ITEMS) {
    cart.splice(0, CLEANUP_BATCH_SIZE);
  }
  
  // Custom printing items are always unique
  if (item.customPrinting) {
    cart.push(item);
    setGuestCart(cart);
    return;
  }
  
  // Find existing item with same product/size/color combo
  const existingIdx = cart.findIndex(existing => 
    existing.productId === item.productId &&
    existing.selectedSize === item.selectedSize &&
    existing.selectedColor === item.selectedColor &&
    !existing.customPrinting
  );
  
  if (existingIdx >= 0) {
    cart[existingIdx].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  
  setGuestCart(cart);
}

/**
 * Update item quantity in guest cart
 */
export function updateGuestCartItem(productId: number, quantity: number): void {
  const cart = getGuestCart();
  const item = cart.find(i => i.productId === productId);
  
  if (item) {
    if (quantity <= 0) {
      removeFromGuestCart(productId);
    } else {
      item.quantity = quantity;
      setGuestCart(cart);
    }
  }
}

/**
 * Remove item from guest cart
 */
export function removeFromGuestCart(productId: number): void {
  const cart = getGuestCart();
  const filtered = cart.filter(item => item.productId !== productId);
  setGuestCart(filtered);
}

/**
 * Clear entire guest cart
 */
export function clearGuestCart(): void {
  setGuestCart([]);
}

/**
 * Get cart size
 */
export function getGuestCartSize(): number {
  return getGuestCart().length;
}

/**
 * Check if item exists in cart
 */
export function isInGuestCart(productId: number): boolean {
  return getGuestCart().some(item => item.productId === productId);
}

/**
 * Calculate total items (sum of quantities)
 */
export function getGuestCartTotalItems(): number {
  return getGuestCart().reduce((sum, item) => sum + item.quantity, 0);
}
