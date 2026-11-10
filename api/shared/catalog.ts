export interface Category {
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Food & Dining', color: 'oklch(0.65 0.2 40)', icon: '🍽️' },
  { name: 'Transportation', color: 'oklch(0.6 0.25 220)', icon: '🚗' },
  { name: 'Shopping', color: 'oklch(0.7 0.2 300)', icon: '🛍️' },
  { name: 'Entertainment', color: 'oklch(0.65 0.25 330)', icon: '🎬' },
  { name: 'Bills & Utilities', color: 'oklch(0.5 0.15 20)', icon: '⚡' },
  { name: 'Healthcare', color: 'oklch(0.6 0.2 140)', icon: '🏥' },
  { name: 'Education', color: 'oklch(0.55 0.2 260)', icon: '📚' },
  { name: 'Travel', color: 'oklch(0.65 0.2 180)', icon: '✈️' },
  { name: 'Other', color: 'oklch(0.6 0.1 240)', icon: '📝' },
];

// Popular Indian Apps for expense categorization
export interface AppOption {
  name: string;
  category: string;
  icon: string;
  color: string;
}

export const DEFAULT_INDIAN_APPS: AppOption[] = [
  // Payment & Cash
  { name: 'Cash', category: 'General', icon: '💵', color: 'oklch(0.6 0.15 120)' },
  { name: 'Other', category: 'General', icon: '📱', color: 'oklch(0.6 0.1 240)' },

  // Food Delivery Apps
  { name: 'Swiggy', category: 'Food & Dining', icon: '🟠', color: 'oklch(0.65 0.25 35)' },
  { name: 'Zomato', category: 'Food & Dining', icon: '🔴', color: 'oklch(0.6 0.3 25)' },
  { name: 'UberEats', category: 'Food & Dining', icon: '🛵', color: 'oklch(0.5 0.2 180)' },
  { name: 'Dunzo', category: 'Food & Dining', icon: '🎯', color: 'oklch(0.65 0.25 60)' },

  // E-commerce & Shopping
  { name: 'Amazon', category: 'Shopping', icon: '📦', color: 'oklch(0.4 0.15 40)' },
  { name: 'Flipkart', category: 'Shopping', icon: '🛒', color: 'oklch(0.55 0.3 250)' },
  { name: 'Myntra', category: 'Shopping', icon: '👗', color: 'oklch(0.7 0.25 320)' },
  { name: 'Nykaa', category: 'Shopping', icon: '💄', color: 'oklch(0.65 0.3 320)' },
  { name: 'BigBasket', category: 'Shopping', icon: '🥬', color: 'oklch(0.6 0.25 140)' },
  { name: 'Grofers/Blinkit', category: 'Shopping', icon: '🛍️', color: 'oklch(0.65 0.3 60)' },
  { name: 'JioMart', category: 'Shopping', icon: '🏪', color: 'oklch(0.55 0.25 250)' },
  { name: 'Meesho', category: 'Shopping', icon: '🎁', color: 'oklch(0.7 0.2 340)' },

  // Transportation
  { name: 'Ola', category: 'Transportation', icon: '🚖', color: 'oklch(0.6 0.25 120)' },
  { name: 'Uber', category: 'Transportation', icon: '🚕', color: 'oklch(0.4 0.2 0)' },
  { name: 'Rapido', category: 'Transportation', icon: '🏍️', color: 'oklch(0.65 0.3 60)' },
  { name: 'Metro', category: 'Transportation', icon: '🚇', color: 'oklch(0.5 0.2 220)' },
  { name: 'IRCTC', category: 'Transportation', icon: '🚅', color: 'oklch(0.45 0.25 240)' },
  { name: 'RedBus', category: 'Transportation', icon: '🚌', color: 'oklch(0.6 0.3 15)' },

  // Entertainment & OTT
  { name: 'Netflix', category: 'Entertainment', icon: '🎬', color: 'oklch(0.4 0.3 15)' },
  { name: 'Amazon Prime', category: 'Entertainment', icon: '📺', color: 'oklch(0.45 0.25 240)' },
  { name: 'Disney+ Hotstar', category: 'Entertainment', icon: '⭐', color: 'oklch(0.5 0.3 60)' },
  { name: 'Zee5', category: 'Entertainment', icon: '📱', color: 'oklch(0.6 0.3 280)' },
  { name: 'SonyLIV', category: 'Entertainment', icon: '📽️', color: 'oklch(0.45 0.25 220)' },
  { name: 'YouTube Premium', category: 'Entertainment', icon: '▶️', color: 'oklch(0.6 0.3 15)' },
  { name: 'Spotify', category: 'Entertainment', icon: '🎵', color: 'oklch(0.6 0.3 140)' },
  { name: 'BookMyShow', category: 'Entertainment', icon: '🎭', color: 'oklch(0.55 0.3 15)' },

  // Financial & Payment Apps
  { name: 'Paytm', category: 'Bills & Utilities', icon: '💳', color: 'oklch(0.55 0.3 240)' },
  { name: 'PhonePe', category: 'Bills & Utilities', icon: '📱', color: 'oklch(0.6 0.3 280)' },
  { name: 'Google Pay', category: 'Bills & Utilities', icon: '💰', color: 'oklch(0.5 0.2 220)' },
  { name: 'CRED', category: 'Bills & Utilities', icon: '💎', color: 'oklch(0.3 0.2 0)' },
  { name: 'MobiKwik', category: 'Bills & Utilities', icon: '🔵', color: 'oklch(0.5 0.3 240)' },

  // Healthcare
  { name: 'Practo', category: 'Healthcare', icon: '👨‍⚕️', color: 'oklch(0.55 0.25 180)' },
  { name: '1mg', category: 'Healthcare', icon: '💊', color: 'oklch(0.6 0.3 15)' },
  { name: 'PharmEasy', category: 'Healthcare', icon: '⚕️', color: 'oklch(0.6 0.25 140)' },

  // Education
  { name: 'BYJU\'S', category: 'Education', icon: '📚', color: 'oklch(0.6 0.3 280)' },
  { name: 'Unacademy', category: 'Education', icon: '🎓', color: 'oklch(0.6 0.25 140)' },
  { name: 'Vedantu', category: 'Education', icon: '📖', color: 'oklch(0.55 0.3 240)' },

  // Travel
  { name: 'MakeMyTrip', category: 'Travel', icon: '✈️', color: 'oklch(0.6 0.3 15)' },
  { name: 'Cleartrip', category: 'Travel', icon: '🧳', color: 'oklch(0.55 0.25 60)' },
  { name: 'Goibibo', category: 'Travel', icon: '🏨', color: 'oklch(0.6 0.3 240)' },
  { name: 'OYO', category: 'Travel', icon: '🏩', color: 'oklch(0.6 0.3 15)' },
  { name: 'Airbnb', category: 'Travel', icon: '🏠', color: 'oklch(0.65 0.3 15)' },
];

// Default people for common expense sharing
export const DEFAULT_PEOPLE: { name: string; color: string; icon: string; relationship: string }[] = [
  { name: 'Myself', color: 'oklch(0.6 0.2 260)', icon: '👤', relationship: 'Self' },
  { name: 'Spouse/Partner', color: 'oklch(0.65 0.25 350)', icon: '💑', relationship: 'Family' },
  { name: 'Family', color: 'oklch(0.7 0.2 30)', icon: '👨‍👩‍👧‍👦', relationship: 'Family' },
  { name: 'Kids', color: 'oklch(0.75 0.25 120)', icon: '👶', relationship: 'Family' },
  { name: 'Parents', color: 'oklch(0.6 0.15 60)', icon: '👴', relationship: 'Family' },
  { name: 'Friends', color: 'oklch(0.65 0.2 180)', icon: '👫', relationship: 'Friends' },
  { name: 'Colleagues', color: 'oklch(0.55 0.2 220)', icon: '👥', relationship: 'Work' },
];

export function getDefaultPeople() {
  return DEFAULT_PEOPLE.map((person, index) => ({ ...person, id: `default-${index}` }));
}
