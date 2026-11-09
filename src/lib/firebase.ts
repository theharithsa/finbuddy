import { localDate } from '@/lib/finance-period';
import { initializeApp, FirebaseError } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User, sendSignInLinkToEmail, signInWithEmailLink, isSignInWithEmailLink, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, deleteField, type FieldValue, Unsubscribe } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import type { Budget, Expense, Person } from './types';
// import { log } from './logger';

// Firebase configuration - Replace with your Firebase project config
// To set up Firebase:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select existing project
// 3. Enable Authentication with Google provider
// 4. Enable Firestore Database
// 5. Enable Storage
// 6. Add your domain to authorized domains in Authentication > Settings > Authorized domains
// 7. Copy your config from Project Settings > General > Your apps
const firebaseConfig = {
  apiKey: "AIzaSyDrZD1uiFf6BCTBvMi0WDoAr0VJrEwXWL8",
  authDomain: "finbuddy-2025.firebaseapp.com",
  projectId: "finbuddy-2025",
  storageBucket: "finbuddy-2025.firebasestorage.app",
  messagingSenderId: "1080442347255",
  appId: "1:1080442347255:web:62813824efd5a9b12cfdf2",
  measurementId: "G-ESNPQSYLCB"
};

// Debug function to check Firebase configuration
export const debugFirebaseConfig = () => {
  // Debug info available for development
};

// Check if Firebase is properly initialized and user is authenticated
export const checkFirebaseReady = (user: any): boolean => {
  if (!auth) {
    console.error('Firebase auth not initialized');
    return false;
  }
  
  if (!db) {
    console.error('Firestore not initialized');
    return false;
  }
  
  if (!user) {
    console.error('User not authenticated');
    return false;
  }
  
  if (!user.uid) {
    console.error('User ID not available');
    return false;
  }
  
  return true;
};

// Initialize Firebase
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true';
const app = initializeApp(useEmulators ? {
  apiKey: 'demo-key',
  projectId: 'demo-finbuddy',
  authDomain: 'demo-finbuddy.firebaseapp.com',
  storageBucket: 'demo-finbuddy.appspot.com',
} : firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

// Configure Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
// Explicitly request profile scope to ensure we get profile photo
googleProvider.addScope('profile');
googleProvider.addScope('email');

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param path - The storage path where the file will be stored
 * @returns Promise that resolves to the download URL
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    throw new Error('Failed to upload file. Please try again.');
  }
};

/**
 * Delete a file from Firebase Storage
 * @param path - The storage path of the file to delete
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    // Don't throw error for delete failures to avoid blocking other operations
  }
};

/**
 * Generate a unique file path for receipt storage
 * @param expenseId - The ID of the expense
 * @param fileName - The original file name
 * @returns A unique storage path
 */
export function generateReceiptPath(userId: string, fileName: string): string {
  const extension = fileName.match(/\.(jpe?g|png|webp|pdf)$/i)?.[1]?.toLowerCase() ?? 'bin';
  return `receipts/${userId}/${crypto.randomUUID()}.${extension}`;
}

export async function deleteOwnedReceipt(userId: string, url: string): Promise<void> {
  try {
    const receipt = ref(storage, url);
    if (receipt.bucket === app.options.storageBucket && receipt.fullPath.startsWith(`receipts/${userId}/`)) {
      await deleteObject(receipt);
    }
  } catch {
    // File cleanup is best effort after the expense write.
  }
}

/**
 * Validate file type and size for receipt uploads
 * @param file - The file to validate
 * @returns true if valid, throws error if invalid
 */
export const validateReceiptFile = (file: File): boolean => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

  if (file.size > maxSize) {
    throw new Error('File size must be less than 5MB');
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP, and PDF files are allowed');
  }

  return true;
};

export { storage, auth, db, functions };

// Authentication functions
export async function signInWithGoogle(useRedirect = false): Promise<User> {
  if (useRedirect) await signInWithRedirect(auth, googleProvider);
  return (await signInWithPopup(auth, googleProvider)).user;
}

export async function checkRedirectResult(): Promise<User | null> {
  return (await getRedirectResult(auth))?.user ?? null;
}

export const logOut = () => signOut(auth);
export const onAuthChange = (callback: (user: User | null) => void) => onAuthStateChanged(auth, callback);

export async function signUpWithEmail(email: string, password: string, displayName: string): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(user, { displayName });
  return user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (!(error instanceof FirebaseError) || error.code !== 'auth/user-not-found') throw error;
  }
}

export async function sendMagicLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, { url: window.location.origin, handleCodeInApp: true });
  localStorage.setItem('emailForSignIn', email);
}

export async function signInWithMagicLink(email?: string): Promise<User> {
  const address = email || localStorage.getItem('emailForSignIn') || window.prompt('Confirm your email address');
  if (!address) throw new Error('Email is required to complete sign-in');
  const { user } = await signInWithEmailLink(auth, address, window.location.href);
  localStorage.removeItem('emailForSignIn');
  return user;
}

export const checkMagicLinkOnLoad = (): boolean => {
  return isSignInWithEmailLink(auth, window.location.href);
};

// Firestore data functions
type NewExpense = Omit<Expense, 'id' | 'createdAt'> & { createdAt?: string };
export type ExpenseUpdate = Partial<Expense> & { _removeReceipt?: boolean };

function validateExpenseAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
    throw new FirebaseError('invalid-argument', 'Enter a valid positive amount');
  }
}

export async function addExpenseToFirestore(userId: string, expense: NewExpense): Promise<string> {
  validateExpenseAmount(expense.amount);
  const data = {
    amount: expense.amount,
    category: expense.category || '',
    description: expense.description || 'No description',
    date: expense.date || localDate(),
    createdAt: expense.createdAt || new Date().toISOString(),
    ...(expense.app && { app: expense.app }),
    ...(expense.receiptUrl && { receiptUrl: expense.receiptUrl }),
    ...(expense.receiptFileName && { receiptFileName: expense.receiptFileName }),
    ...(expense.peopleIds?.length && { peopleIds: expense.peopleIds }),
  };
  const created = await addDoc(collection(db, 'users', userId, 'expenses'), data);
  return created.id;
}

export async function updateExpenseInFirestore(userId: string, expenseId: string, expense: ExpenseUpdate): Promise<void> {
  const { _removeReceipt, id: _id, ...fields } = expense;
  if (fields.amount !== undefined) validateExpenseAmount(fields.amount);
  const updates: Record<string, string | number | string[] | FieldValue> = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  if (_removeReceipt) {
    updates.receiptUrl = deleteField();
    updates.receiptFileName = deleteField();
  }
  await updateDoc(doc(db, 'users', userId, 'expenses', expenseId), updates);
}

export function deleteExpenseFromFirestore(userId: string, expenseId: string): Promise<void> {
  return deleteDoc(doc(db, 'users', userId, 'expenses', expenseId));
}

export const getExpensesFromFirestore = async (userId: string): Promise<any[]> => {
  try {
    const q = query(
      collection(db, 'users', userId, 'expenses'),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting expenses:', error);
    throw new Error('Failed to load expenses. Please try again.');
  }
};

export function subscribeToExpenses(
  userId: string,
  callback: (expenses: Expense[]) => void,
  onError: (error: Error) => void = () => callback([]),
): Unsubscribe {
  return onSnapshot(query(collection(db, 'users', userId, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
    callback(snapshot.docs.map((document) => ({ ...document.data(), id: document.id } as Expense)));
  }, onError);
}

export const addBudgetToFirestore = async (userId: string, budget: any): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'budgets'), budget);
    return docRef.id;
  } catch (error) {
    console.error('Error adding budget:', error);
    throw new Error('Failed to save budget. Please try again.');
  }
};

export const updateBudgetInFirestore = async (userId: string, budgetId: string, budget: any): Promise<void> => {
  try {
    // Filter out undefined values as Firebase doesn't allow them
    const cleanBudget = Object.fromEntries(
      Object.entries(budget).filter(([_, value]) => value !== undefined)
    );
    
    const docRef = doc(db, 'users', userId, 'budgets', budgetId);
    await updateDoc(docRef, cleanBudget);
  } catch (error) {
    console.error('Error updating budget:', error);
    throw new Error('Failed to update budget. Please try again.');
  }
};

export const deleteBudgetFromFirestore = async (userId: string, budgetId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId, 'budgets', budgetId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting budget:', error);
    throw new Error('Failed to delete budget. Please try again.');
  }
};

export function subscribeToBudgets(
  userId: string,
  callback: (budgets: Budget[]) => void,
  onError: (error: Error) => void = () => callback([]),
): Unsubscribe {
  return onSnapshot(collection(db, 'users', userId, 'budgets'), (snapshot) => {
    callback(snapshot.docs.map((document) => ({ ...document.data(), id: document.id } as Budget)));
  }, onError);
}

export const addTemplateToFirestore = async (userId: string, template: any): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'templates'), template);
    return docRef.id;
  } catch (error) {
    console.error('Error adding template:', error);
    throw new Error('Failed to save template. Please try again.');
  }
};

export const deleteTemplateFromFirestore = async (userId: string, templateId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId, 'templates', templateId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting template:', error);
    throw new Error('Failed to delete template. Please try again.');
  }
};

export const subscribeToTemplates = (userId: string, callback: (templates: any[]) => void) => {
  try {
    if (!userId || !db) {
      console.error('Invalid userId or database not initialized');
      callback([]);
      return () => {};
    }

    const q = query(collection(db, 'users', userId, 'templates'));
    
    return onSnapshot(q, 
      (querySnapshot) => {
        try {
          const templates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(templates);
        } catch (error) {
          console.error('Error processing templates data:', error);
          callback([]);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') {
          console.warn('Permission denied for templates subscription. User may not be fully authenticated yet.');
        } else {
          console.error('Error in templates subscription:', error);
        }
        callback([]);
      }
    );
  } catch (error) {
    console.error('Error setting up templates subscription:', error);
    callback([]);
    return () => {};
  }
};

// Custom Category functions
export const addCustomCategoryToFirestore = async (userId: string, category: any): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'customCategories'), category);
    
    // If category is public, also add to global collection
    if (category.isPublic) {
      try {
        await addDoc(collection(db, 'publicCategories'), {
          ...category,
          originalId: docRef.id,
          userId: userId
        });
      } catch (publicError: any) {
        // Handle permission errors gracefully for public categories
        if (publicError.code === 'permission-denied') {
          console.warn('Permission denied for public categories. Private category was created successfully.');
          // Don't throw error - the private category creation was successful
        } else {
          console.error('Error adding to public categories:', publicError);
          // Still don't throw - the main category was created successfully
        }
      }
    }
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding custom category:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to create categories.');
    } else {
      throw new Error('Failed to save custom category. Please try again.');
    }
  }
};

export const updateCustomCategoryInFirestore = async (userId: string, categoryId: string, category: any): Promise<void> => {
  try {
    // First, get the current category data to ensure we have all required fields
    const currentDocRef = doc(db, 'users', userId, 'customCategories', categoryId);
    const currentDoc = await getDoc(currentDocRef);
    
    if (!currentDoc.exists()) {
      throw new Error('Category not found');
    }
    
    const currentData = currentDoc.data();
    const updatedData = { ...currentData, ...category };
    
    // Filter out undefined values as Firebase doesn't allow them
    const cleanCategory = Object.fromEntries(
      Object.entries(category).filter(([_, value]) => value !== undefined)
    );
    
    // Update the user's private category first
    await updateDoc(currentDocRef, cleanCategory);
    
    // Handle public collection updates only if the user has permission
    try {
      const publicQ = query(
        collection(db, 'publicCategories'),
        where('originalId', '==', categoryId),
        where('userId', '==', userId)
      );
      const publicSnapshot = await getDocs(publicQ);
      
      if (updatedData.isPublic) {
        // Category should be public
        if (!publicSnapshot.empty) {
          // Update existing public category with complete data
          const publicDoc = publicSnapshot.docs[0];
          await updateDoc(doc(db, 'publicCategories', publicDoc.id), {
            ...updatedData,
            originalId: categoryId,
            userId: userId
          });
        } else {
          // Add to public collection with complete data
          await addDoc(collection(db, 'publicCategories'), {
            ...updatedData,
            originalId: categoryId,
            userId: userId
          });
        }
      } else {
        // Category should not be public, remove from public collection if it exists
        if (!publicSnapshot.empty) {
          const publicDoc = publicSnapshot.docs[0];
          await deleteDoc(doc(db, 'publicCategories', publicDoc.id));
        }
      }
    } catch (publicError: any) {
      // Handle permission errors gracefully for public categories
      if (publicError.code === 'permission-denied') {
        console.warn('Permission denied for public categories. User\'s private category was updated successfully.');
        // Don't throw error - the private category update was successful
      } else {
        console.error('Error updating public category:', publicError);
        // Still don't throw - the main update succeeded
      }
    }
  } catch (error: any) {
    console.error('Error updating custom category:', error);
    
    // Only throw if the main category update failed
    if (error.message === 'Category not found') {
      throw error;
    } else if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to update this category.');
    } else {
      throw new Error('Failed to update custom category. Please try again.');
    }
  }
};

export const deleteCustomCategoryFromFirestore = async (userId: string, categoryId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId, 'customCategories', categoryId);
    await deleteDoc(docRef);
    
    // Remove from public collection if it exists there
    try {
      const publicQ = query(
        collection(db, 'publicCategories'),
        where('originalId', '==', categoryId),
        where('userId', '==', userId)
      );
      const publicSnapshot = await getDocs(publicQ);
      
      if (!publicSnapshot.empty) {
        const publicDoc = publicSnapshot.docs[0];
        await deleteDoc(doc(db, 'publicCategories', publicDoc.id));
      }
    } catch (publicError: any) {
      // Handle permission errors gracefully for public categories
      if (publicError.code === 'permission-denied') {
        console.warn('Permission denied for public categories. Private category was deleted successfully.');
        // Don't throw error - the private category deletion was successful
      } else {
        console.error('Error removing from public categories:', publicError);
        // Still don't throw - the main category was deleted successfully
      }
    }
  } catch (error: any) {
    console.error('Error deleting custom category:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to delete this category.');
    } else {
      throw new Error('Failed to delete custom category. Please try again.');
    }
  }
};

export const subscribeToCustomCategories = (userId: string, callback: (categories: any[]) => void) => {
  try {
    if (!userId || !db) {
      console.error('Invalid userId or database not initialized');
      callback([]);
      return () => {};
    }

    const q = query(collection(db, 'users', userId, 'customCategories'));
    
    return onSnapshot(q, 
      (querySnapshot) => {
        try {
          const categories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(categories);
        } catch (error) {
          console.error('Error processing custom categories data:', error);
          callback([]);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') {
          console.warn('Permission denied for custom categories subscription. User may not be fully authenticated yet.');
        } else {
          console.error('Error in custom categories subscription:', error);
        }
        callback([]);
      }
    );
  } catch (error) {
    console.error('Error setting up custom categories subscription:', error);
    callback([]);
    return () => {};
  }
};

export const subscribeToPublicCategories = (callback: (categories: any[]) => void) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      callback([]);
      return () => {};
    }

    const q = query(collection(db, 'publicCategories'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, 
      (querySnapshot) => {
        try {
          const categories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(categories);
        } catch (error) {
          console.error('Error processing public categories data:', error);
          callback([]);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') {
          // Log a more helpful message for public categories permission issues
          console.warn('Permission denied for public categories subscription. This feature may not be configured or you may need to check Firebase rules.');
          callback([]);
        } else {
          console.error('Error in public categories subscription:', error);
          callback([]);
        }
      }
    );
  } catch (error) {
    console.error('Error setting up public categories subscription:', error);
    callback([]);
    return () => {};
  }
};

export const adoptPublicCategory = async (userId: string, publicCategory: any): Promise<string> => {
  try {
    // Add to user's custom categories
    const categoryData = {
      name: publicCategory.name,
      color: publicCategory.color,
      icon: publicCategory.icon,
      isPublic: false, // User's copy is private by default
      createdAt: new Date().toISOString(),
      createdBy: `Adopted from ${publicCategory.createdBy}`
    };
    
    const docRef = await addDoc(collection(db, 'users', userId, 'customCategories'), categoryData);
    return docRef.id;
  } catch (error) {
    console.error('Error adopting public category:', error);
    throw new Error('Failed to adopt category. Please try again.');
  }
};

// Budget Template functions
export const addBudgetTemplateToFirestore = async (userId: string, template: any): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'budgetTemplates'), template);
    
    // If template is public, also add to global collection
    if (template.isPublic) {
      try {
        await addDoc(collection(db, 'publicBudgetTemplates'), {
          ...template,
          originalId: docRef.id,
          userId: userId
        });
      } catch (publicError: any) {
        // Handle permission errors gracefully for public templates
        if (publicError.code === 'permission-denied') {
          console.warn('Permission denied for public budget templates. Private template was created successfully.');
        } else {
          console.error('Error adding to public budget templates:', publicError);
        }
      }
    }
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding budget template:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to create budget templates.');
    } else {
      throw new Error('Failed to save budget template. Please try again.');
    }
  }
};

export const updateBudgetTemplateInFirestore = async (userId: string, templateId: string, template: any): Promise<void> => {
  try {
    // First, get the current template data
    const currentDocRef = doc(db, 'users', userId, 'budgetTemplates', templateId);
    const currentDoc = await getDoc(currentDocRef);
    
    if (!currentDoc.exists()) {
      throw new Error('Budget template not found');
    }
    
    const currentData = currentDoc.data();
    const updatedData = { ...currentData, ...template };
    
    // Filter out undefined values as Firebase doesn't allow them
    const cleanTemplate = Object.fromEntries(
      Object.entries(template).filter(([_, value]) => value !== undefined)
    );
    
    // Update the user's private template first
    await updateDoc(currentDocRef, cleanTemplate);
    
    // Handle public collection updates
    try {
      const publicQ = query(
        collection(db, 'publicBudgetTemplates'),
        where('originalId', '==', templateId),
        where('userId', '==', userId)
      );
      const publicSnapshot = await getDocs(publicQ);
      
      if (updatedData.isPublic) {
        // Template should be public
        if (!publicSnapshot.empty) {
          // Update existing public template
          const publicDoc = publicSnapshot.docs[0];
          await updateDoc(doc(db, 'publicBudgetTemplates', publicDoc.id), {
            ...updatedData,
            originalId: templateId,
            userId: userId
          });
        } else {
          // Add to public collection
          await addDoc(collection(db, 'publicBudgetTemplates'), {
            ...updatedData,
            originalId: templateId,
            userId: userId
          });
        }
      } else {
        // Template should not be public, remove from public collection if it exists
        if (!publicSnapshot.empty) {
          const publicDoc = publicSnapshot.docs[0];
          await deleteDoc(doc(db, 'publicBudgetTemplates', publicDoc.id));
        }
      }
    } catch (publicError: any) {
      if (publicError.code === 'permission-denied') {
        console.warn('Permission denied for public budget templates. User\'s private template was updated successfully.');
      } else {
        console.error('Error updating public budget template:', publicError);
      }
    }
  } catch (error: any) {
    console.error('Error updating budget template:', error);
    
    if (error.message === 'Budget template not found') {
      throw error;
    } else if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to update this budget template.');
    } else {
      throw new Error('Failed to update budget template. Please try again.');
    }
  }
};

export const deleteBudgetTemplateFromFirestore = async (userId: string, templateId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId, 'budgetTemplates', templateId);
    await deleteDoc(docRef);
    
    // Remove from public collection if it exists there
    try {
      const publicQ = query(
        collection(db, 'publicBudgetTemplates'),
        where('originalId', '==', templateId),
        where('userId', '==', userId)
      );
      const publicSnapshot = await getDocs(publicQ);
      
      if (!publicSnapshot.empty) {
        const publicDoc = publicSnapshot.docs[0];
        await deleteDoc(doc(db, 'publicBudgetTemplates', publicDoc.id));
      }
    } catch (publicError: any) {
      if (publicError.code === 'permission-denied') {
        console.warn('Permission denied for public budget templates. Private template was deleted successfully.');
      } else {
        console.error('Error removing from public budget templates:', publicError);
      }
    }
  } catch (error: any) {
    console.error('Error deleting budget template:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to delete this budget template.');
    } else {
      throw new Error('Failed to delete budget template. Please try again.');
    }
  }
};

export const subscribeToBudgetTemplates = (userId: string, callback: (templates: any[]) => void) => {
  try {
    if (!userId || !db) {
      console.error('Invalid userId or database not initialized');
      callback([]);
      return () => {};
    }

    const q = query(collection(db, 'users', userId, 'budgetTemplates'));
    
    return onSnapshot(q, 
      (querySnapshot) => {
        try {
          const templates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(templates);
        } catch (error) {
          console.error('Error processing budget templates data:', error);
          callback([]);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') {
          console.warn('Permission denied for budget templates subscription. User may not be fully authenticated yet.');
        } else {
          console.error('Error in budget templates subscription:', error);
        }
        callback([]);
      }
    );
  } catch (error) {
    console.error('Error setting up budget templates subscription:', error);
    callback([]);
    return () => {};
  }
};

export const subscribeToPublicBudgetTemplates = (callback: (templates: any[]) => void) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      callback([]);
      return () => {};
    }

    const q = query(collection(db, 'publicBudgetTemplates'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, 
      (querySnapshot) => {
        try {
          const templates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(templates);
        } catch (error) {
          console.error('Error processing public budget templates data:', error);
          callback([]);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') {
          // This is expected when public budget templates sharing isn't configured
          callback([]);
        } else {
          console.error('Error in public budget templates subscription:', error);
          callback([]);
        }
      }
    );
  } catch (error) {
    console.error('Error setting up public budget templates subscription:', error);
    callback([]);
    return () => {};
  }
};

export const adoptPublicBudgetTemplate = async (userId: string, publicTemplate: any): Promise<string> => {
  try {
    // Add to user's budget templates
    const templateData = {
      name: publicTemplate.name,
      description: publicTemplate.description,
      budgets: publicTemplate.budgets,
      totalBudget: publicTemplate.totalBudget,
      incomeLevel: publicTemplate.incomeLevel,
      tags: publicTemplate.tags,
      isPublic: false, // User's copy is private by default
      createdAt: new Date().toISOString(),
      createdBy: `Adopted from ${publicTemplate.createdBy}`
    };
    
    const docRef = await addDoc(collection(db, 'users', userId, 'budgetTemplates'), templateData);
    
    // Increment usage count in public template
    try {
      const publicDocRef = doc(db, 'publicBudgetTemplates', publicTemplate.id);
      await updateDoc(publicDocRef, {
        usageCount: (publicTemplate.usageCount || 0) + 1
      });
    } catch (error) {
      console.warn('Could not update usage count for public template');
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error adopting public budget template:', error);
    throw new Error('Failed to adopt budget template. Please try again.');
  }
};

// People management functions
export const addPersonToFirestore = async (userId: string, person: Omit<Person, 'id'>): Promise<string> => {
  try {
    const personData = {
      ...person,
      userId: userId,
      createdAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'users', userId, 'customPeople'), personData);
    
    // If person is public, also add to global collection
    if (person.isPublic) {
      try {
        await addDoc(collection(db, 'publicPeople'), {
          ...personData,
          originalId: docRef.id,
          userId: userId
        });
      } catch (publicError: any) {
        // Handle permission errors gracefully for public people
        if (publicError.code === 'permission-denied') {
          console.warn('Permission denied for public people. Private person was created successfully.');
        } else {
          console.error('Error adding to public people:', publicError);
        }
      }
    }
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding person:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to create people.');
    } else {
      throw new Error('Failed to save person. Please try again.');
    }
  }
};

export const updatePersonInFirestore = async (userId: string, personId: string, person: Partial<Person>): Promise<void> => {
  try {
    // Filter out undefined values as Firebase doesn't allow them
    const cleanPerson = Object.fromEntries(
      Object.entries(person).filter(([_, value]) => value !== undefined)
    );
    
    await updateDoc(doc(db, 'users', userId, 'customPeople', personId), cleanPerson);
  } catch (error: any) {
    console.error('Error updating person:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to update this person.');
    } else {
      throw new Error('Failed to update person. Please try again.');
    }
  }
};

export const deletePersonFromFirestore = async (userId: string, personId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId, 'customPeople', personId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.error('Error deleting person:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You don\'t have permission to delete this person.');
    } else {
      throw new Error('Failed to delete person. Please try again.');
    }
  }
};

export const subscribeToCustomPeople = (userId: string, callback: (people: Person[]) => void): Unsubscribe => {
  const q = query(
    collection(db, 'users', userId, 'customPeople'),
    orderBy('name', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const people: Person[] = snapshot.docs.map(doc => {
      const data = { id: doc.id, ...doc.data() } as Person;
      return data;
    });
    callback(people);
  }, (error) => {
    console.error('Error listening to custom people:', error);
    callback([]);
  });
};

export const subscribeToPublicPeople = (callback: (people: Person[]) => void): Unsubscribe => {
  const q = query(
    collection(db, 'publicPeople'),
    orderBy('name', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const people: Person[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Person));
    callback(people);
  }, () => callback([]));
};

export const adoptPublicPerson = async (userId: string, publicPerson: Person): Promise<string> => {
  try {
    // Increment usage count for this public person
    try {
      await updateDoc(doc(db, 'publicPeople', publicPerson.id), {
        usageCount: increment(1)
      });
    } catch (error) {
      console.warn('Could not update usage count for public person');
    }
    
    // Create user's own copy of the person
    const personData = {
      name: publicPerson.name,
      color: publicPerson.color,
      icon: publicPerson.icon,
      relationship: publicPerson.relationship,
      userId: userId,
      isPublic: false, // User's copy is private by default
      createdAt: new Date().toISOString(),
      createdBy: `Adopted from ${publicPerson.createdBy}`
    };
    
    const docRef = await addDoc(collection(db, 'users', userId, 'customPeople'), personData);
    return docRef.id;
  } catch (error) {
    console.error('Error adopting public person:', error);
    throw new Error('Failed to adopt person. Please try again.');
  }
};
