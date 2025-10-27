// src/lib/cartUtils.js
import { getDeviceModelById, normalizeModel } from "./deviceModelsApi";

const CART_STORAGE_KEY = "techrent-cart";

// ---- NEW: phát sự kiện custom để các component (Header) nghe được ở cùng tab
const broadcastCartUpdated = () => {
  try {
    const count = getCartCount();
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: { count } }));
  } catch {}
};

const createCartItem = (deviceModel, qty = 1) => ({
  id: deviceModel.id,
  name: deviceModel.name,
  brand: deviceModel.brand,
  image: deviceModel.image,
  dailyPrice: deviceModel.pricePerDay,
  qty,
  note: deviceModel.description || "",
});

export const getCartFromStorage = () => {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    return savedCart ? JSON.parse(savedCart) : [];
  } catch (error) {
    console.error("Failed to parse cart from localStorage:", error);
    return [];
  }
};

export const saveCartToStorage = (cartItems) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    broadcastCartUpdated(); // <-- NEW
    return true;
  } catch (error) {
    console.error("Failed to save cart to localStorage:", error);
    return false;
  }
};

export const addToCart = async (deviceId, qty = 1) => {
  try {
    const currentCart = getCartFromStorage();
    // Đảm bảo so sánh id dưới dạng string hoặc number
    const deviceIdStr = String(deviceId);
    const idx = currentCart.findIndex((item) => String(item.id) === deviceIdStr);

    console.log('Adding to cart:', { deviceId, deviceIdStr, currentCart, idx });

    if (idx >= 0) {
      // Sản phẩm đã có trong giỏ -> cộng thêm số lượng
      currentCart[idx].qty += qty;
      console.log('Updated existing item:', currentCart[idx]);
    } else {
      // Sản phẩm chưa có -> thêm mới
      const deviceModel = await getDeviceModelById(deviceId);
      const normalized = normalizeModel(deviceModel);
      const newItem = createCartItem(normalized, qty);
      currentCart.push(newItem);
      console.log('Added new item:', newItem);
    }

    saveCartToStorage(currentCart); // sẽ broadcast ở trong này
    return { success: true, cart: currentCart };
  } catch (error) {
    console.error("Failed to add item to cart:", error);
    return { success: false, error: error.message };
  }
};

export const removeFromCart = (deviceId) => {
  try {
    const currentCart = getCartFromStorage();
    const deviceIdStr = String(deviceId);
    const updatedCart = currentCart.filter((item) => String(item.id) !== deviceIdStr);
    saveCartToStorage(updatedCart); // sẽ broadcast
    return { success: true, cart: updatedCart };
  } catch (error) {
    console.error("Failed to remove item from cart:", error);
    return { success: false, error: error.message };
  }
};

export const updateCartItemQuantity = (deviceId, qty) => {
  try {
    const currentCart = getCartFromStorage();
    const deviceIdStr = String(deviceId);
    const updatedCart = currentCart.map((item) =>
      String(item.id) === deviceIdStr ? { ...item, qty: Math.max(1, qty) } : item
    );
    saveCartToStorage(updatedCart); // sẽ broadcast
    return { success: true, cart: updatedCart };
  } catch (error) {
    console.error("Failed to update cart item quantity:", error);
    return { success: false, error: error.message };
  }
};

export const clearCart = () => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    broadcastCartUpdated(); // <-- NEW
    return { success: true };
  } catch (error) {
    console.error("Failed to clear cart:", error);
    return { success: false, error: error.message };
  }
};

export const getCartCount = () => {
  const cart = getCartFromStorage();
  return cart.reduce((total, item) => total + item.qty, 0);
};

// Debug function để kiểm tra trạng thái giỏ hàng
export const debugCart = () => {
  const cart = getCartFromStorage();
  console.log('Current cart state:', cart);
  console.log('Cart count:', getCartCount());
  return cart;
};
