import { testStore } from './store.js';

export const mockFirestore = {
  collection: (rootCollection: string) => {
    return {
      doc: (rootDocId: string) => {
        const rootPath = `${rootCollection}/${rootDocId}`;
        return {
          // Direct doc methods on root collection (e.g. presence)
          set: async (data: any, options?: any) => {
            const col = testStore.getCollection(rootCollection);
            if (options?.merge && col.has(rootDocId)) {
              col.set(rootDocId, { ...col.get(rootDocId), ...data });
            } else {
              col.set(rootDocId, data);
            }
          },
          get: async () => {
            const col = testStore.getCollection(rootCollection);
            const data = col.get(rootDocId);
            return {
              exists: Boolean(data),
              data: () => data,
            };
          },
          update: async (data: Record<string, any>) => {
            const col = testStore.getCollection(rootCollection);
            const existing = col.get(rootDocId) || {};
            col.set(rootDocId, { ...existing, ...data });
          },
          // Subcollection method (e.g. chats/{chatId}/messages or chats/{chatId}/typing)
          collection: (subCollection: string) => {
            const path = `${rootCollection}/${rootDocId}/${subCollection}`;
            return {
              doc: (docId: string) => ({
                set: async (data: any, options?: any) => {
                  const col = testStore.getCollection(path);
                  if (options?.merge && col.has(docId)) {
                    col.set(docId, { ...col.get(docId), ...data });
                  } else {
                    col.set(docId, data);
                  }
                },
                get: async () => {
                  const col = testStore.getCollection(path);
                  const data = col.get(docId);
                  return {
                    exists: Boolean(data),
                    data: () => data,
                  };
                },
                update: async (data: Record<string, any>) => {
                  const col = testStore.getCollection(path);
                  const existing = col.get(docId) || {};
                  for (const [key, val] of Object.entries(data)) {
                    if (key.includes('.')) {
                      const parts = key.split('.');
                      let target = existing;
                      for (let i = 0; i < parts.length - 1; i++) {
                        target[parts[i]] = target[parts[i]] || {};
                        target = target[parts[i]];
                      }
                      target[parts[parts.length - 1]] = val;
                    } else {
                      existing[key] = val;
                    }
                  }
                  col.set(docId, existing);
                },
              }),
              get: async () => {
                const col = testStore.getCollection(path);
                const items = Array.from(col.values());
                return {
                  empty: items.length === 0,
                  docs: items.map((item) => ({
                    data: () => item,
                  })),
                };
              },
              orderBy: (field: string, direction = 'asc') => ({
                limit: (limitCount: number) => ({
                  startAfter: (cursorVal: any) => ({
                    get: async () => {
                      const col = testStore.getCollection(path);
                      let items = Array.from(col.values());
                      items.sort((a, b) => {
                        const valA = a[field] || '';
                        const valB = b[field] || '';
                        return direction === 'desc'
                          ? valB.localeCompare(valA)
                          : valA.localeCompare(valB);
                      });
                      const cursorIdx = items.findIndex((i) => i[field] === cursorVal);
                      if (cursorIdx !== -1) {
                        items = items.slice(cursorIdx + 1);
                      }
                      items = items.slice(0, limitCount);
                      return {
                        empty: items.length === 0,
                        docs: items.map((item) => ({
                          data: () => item,
                        })),
                      };
                    },
                  }),
                  get: async () => {
                    const col = testStore.getCollection(path);
                    let items = Array.from(col.values());
                    items.sort((a, b) => {
                      const valA = a[field] || '';
                      const valB = b[field] || '';
                      return direction === 'desc'
                        ? valB.localeCompare(valA)
                        : valA.localeCompare(valB);
                    });
                    items = items.slice(0, limitCount);
                    return {
                      empty: items.length === 0,
                      docs: items.map((item) => ({
                        data: () => item,
                      })),
                    };
                  },
                }),
              }),
            };
          },
        };
      },
      get: async () => {
        const col = testStore.getCollection(rootCollection);
        const items = Array.from(col.values());
        return {
          empty: items.length === 0,
          docs: items.map((item) => ({
            data: () => item,
          })),
        };
      },
    };
  },
};
