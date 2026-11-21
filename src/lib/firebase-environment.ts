import { dataRoot, type DataEnvironment } from '../../api/shared/environment';

export const firebaseEnvironment: DataEnvironment = import.meta.env.MODE === 'preprod' ? 'preprod' : 'prod';
export const firestoreRoot = dataRoot(firebaseEnvironment);
export const receiptRoot = `${firebaseEnvironment}/receipts`;
