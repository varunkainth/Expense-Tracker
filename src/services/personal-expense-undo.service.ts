import { PersonalExpense } from '../types/personal';

type UndoListener = (
  expense: PersonalExpense | null,
) => void;

class PersonalExpenseUndoService {
  private pendingExpense: PersonalExpense | null =
    null;

  private listeners = new Set<UndoListener>();

  /**
   * Stores the deleted expense.
   */
  setPendingExpense(
    expense: PersonalExpense,
  ): void {
    this.pendingExpense = expense;

    this.notify();
  }

  /**
   * Gets the pending deleted expense.
   */
  getPendingExpense(): PersonalExpense | null {
    return this.pendingExpense;
  }

  /**
   * Clears the pending expense.
   */
  clear(): void {
    this.pendingExpense = null;

    this.notify();
  }

  /**
   * Subscribe to changes.
   */
  subscribe(
    listener: UndoListener,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.pendingExpense);
    }
  }
}

export const personalExpenseUndoService =
  new PersonalExpenseUndoService();