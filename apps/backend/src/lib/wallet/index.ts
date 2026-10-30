// Prepaid wallet (contract W1). Server-only barrel: it pulls in the database.
// Client components import "@/lib/wallet/pricing" directly (pure, no I/O).
export * from "./pricing";
export * from "./ledger";
export {
  afterBalanceChange,
  notifyWallet,
  followUpsFor,
  type BalanceChange,
  type WalletNotifyEvent,
} from "./after-debit";
