export class ModelBridge {
  constructor() {
    this.pending = new Map();
    this.sequence = 0;
    this.startWorker();
  }

  startWorker() {
    const worker = new Worker(new URL('./model-worker.js', import.meta.url));
    this.worker = worker;

    worker.addEventListener('message', ({ data }) => {
      if (worker !== this.worker) {
        return;
      }

      const pending = this.pending.get(data.id);

      if (!pending) {
        return;
      }

      this.pending.delete(data.id);
      clearTimeout(pending.timer);

      if (data.ok) {
        pending.resolve(data.result);
      } else {
        pending.reject(new Error(data.error));
      }
    });

    worker.addEventListener('error', () => {
      if (worker !== this.worker) {
        return;
      }

      this.restartWorker('The model worker stopped. Try again through a local web server in a modern browser.');
    });
  }

  restartWorker(message) {
    this.worker.terminate();
    this.worker = null;

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }

    this.pending.clear();
  }

  call(action, payload = {}) {
    if (!this.worker) {
      this.startWorker();
    }

    const id = ++this.sequence;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.restartWorker('The model took too long to respond. Try a smaller machine.');
      }, 10000);

      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, action, payload });
    });
  }
}
