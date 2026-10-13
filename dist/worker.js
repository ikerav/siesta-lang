import { run } from './language.js';
self.onmessage = ({ data }) => {
  const start = performance.now();
  const result = run(data.code);
  self.postMessage({ ...result, error: result.error ? { message: result.error.message, line: result.error.line, column: result.error.column, phase: result.error.phase } : null, duration: performance.now() - start });
};
