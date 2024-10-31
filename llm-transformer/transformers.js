const resolveBackend = async (backendHints) => {
  const backendNames = backendHints.length === 0 ? backendsSortedByPriority : backendHints;
  const errors = [];
  for (const backendName of backendNames) {
      const backendInfo = backends[backendName];
      if (backendInfo) {
            return backendInfo.backend;
          const isInitializing = !!backendInfo.initPromise;
          try {
             
              await backendInfo.initPromise;
              backendInfo.initialized = true;
              return backendInfo.backend;
          }
          catch (e) {
              if (!isInitializing) {
                  errors.push({ name: backendName, err: e });
              }
              backendInfo.aborted = true;
          }
          finally {
              delete backendInfo.initPromise;
          }
      }
  }
  throw new Error(`no available backend found. ERR: ${errors.map(e => `[${e.name}] ${e.err}`).join(', ')}`);
};

