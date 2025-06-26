import { produce } from 'immer';

type UpdateFunction<T> = (draft: T) => void;

export class OptimisticStore<T> {
  private state: T;
  private subscribers: Set<(state: T) => void>;
  private pendingUpdates: Map<string, { update: UpdateFunction<T>, rollback: T }>;

  constructor(initialState: T) {
    this.state = initialState;
    this.subscribers = new Set();
    this.pendingUpdates = new Map();
  }

  getState(): T {
    return this.state;
  }

  subscribe(callback: (state: T) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async update(
    key: string,
    updateFn: UpdateFunction<T>,
    asyncOperation: () => Promise<void>
  ): Promise<void> {
    // Store current state for rollback
    const previousState = { ...this.state };

    // Apply optimistic update
    this.state = produce(this.state, updateFn);
    this.notifySubscribers();

    // Store pending update
    this.pendingUpdates.set(key, {
      update: updateFn,
      rollback: previousState
    });

    try {
      // Perform async operation
      await asyncOperation();
      
      // Remove from pending updates on success
      this.pendingUpdates.delete(key);
    } catch (error) {
      // Rollback on failure
      this.state = this.pendingUpdates.get(key)!.rollback;
      this.pendingUpdates.delete(key);
      this.notifySubscribers();
      throw error;
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.state));
  }
}